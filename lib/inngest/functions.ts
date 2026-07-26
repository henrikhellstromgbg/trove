import { eq, and, isNotNull, isNull, lte, or } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { inngest } from "./client";
import { db, schema } from "@/lib/db";
import { extractFromUrl } from "@/lib/ai/extract";
import { extractFromPdf } from "@/lib/ai/extract-pdf";
import { extractFromImage } from "@/lib/ai/extract-image";
import { extractFromDocx } from "@/lib/ai/extract-docx";
import { extractFromXlsx } from "@/lib/ai/extract-xlsx";
import { extractFromTextFile } from "@/lib/ai/extract-textfile";
import { chunkText } from "@/lib/ai/chunk";
import { embedTexts } from "@/lib/ai/embed";
import { encodeEmbedding } from "@/lib/db/vector";
import { enrich } from "@/lib/ai/enrich";
import { MODELS } from "@/lib/ai/models";
import { selectEventPipelines } from "@/lib/pipelines/triggers";
import { runPipelineSpec } from "@/lib/pipelines/run";
import { nextRunFromCron } from "@/lib/pipelines/cron";
import { PipelineSpecSchema, runStatusForOutput } from "@/lib/pipelines/types";
import { runSourceSync } from "@/lib/sources/sync";
import {
  claimPendingItem,
  markProcessingItemFailed,
  reemitPendingItems,
} from "@/lib/inngest/pending-items";

export const ingestItem = inngest.createFunction(
  {
    id: "ingest-item",
    retries: 3,
    concurrency: 1,
    throttle: { limit: 2, period: "1m" },
    onFailure: async ({ event }) => {
      const originalEvent = event.data.event as {
        data?: { itemId?: unknown };
      };
      const itemId = originalEvent.data?.itemId;
      if (typeof itemId === "string") {
        await markProcessingItemFailed(itemId);
      }
    },
    triggers: [{ event: "item/captured" }],
  },
  async ({ event, step }) => {
    const { itemId } = event.data as { itemId: string };

    const item = await step.run("load-item", async () => {
      const rows = await db
        .select()
        .from(schema.item)
        .where(eq(schema.item.id, itemId))
        .limit(1);
      return rows[0] ?? null;
    });

    if (!item) return { skipped: "not found" };

    const claimed = await step.run("claim-pending", async () => {
      return await claimPendingItem(itemId);
    });
    if (!claimed) return { skipped: `item is ${item.status}` };

    let rawText = item.rawText ?? "";
    let extractedTitle: string | null = null;

    if (item.type === "url" && item.source) {
      const url = item.source;
      const extracted = await step.run("extract-url", async () => {
        return await extractFromUrl(url);
      });
      rawText = extracted.text;
      extractedTitle = extracted.title;

      await step.run("save-raw-text-url", async () => {
        await db
          .update(schema.item)
          .set({ rawText, title: extractedTitle })
          .where(eq(schema.item.id, itemId));
      });
    }

    if (
      (item.type === "pdf" ||
        item.type === "image" ||
        item.type === "docx" ||
        item.type === "xlsx" ||
        item.type === "textfile") &&
      item.blobUrl
    ) {
      const blobUrl = item.blobUrl;
      const filename = item.source ?? "file";
      const itemType = item.type;
      const extracted = await step.run(`extract-${itemType}`, async () => {
        if (itemType === "pdf") return await extractFromPdf(blobUrl);
        if (itemType === "image") {
          const guessedMime =
            filename.toLowerCase().endsWith(".jpg") ||
            filename.toLowerCase().endsWith(".jpeg")
              ? "image/jpeg"
              : filename.toLowerCase().endsWith(".gif")
                ? "image/gif"
                : filename.toLowerCase().endsWith(".webp")
                  ? "image/webp"
                  : "image/png";
          return await extractFromImage(blobUrl, filename, guessedMime);
        }
        if (itemType === "docx") return await extractFromDocx(blobUrl, filename);
        if (itemType === "xlsx") return await extractFromXlsx(blobUrl, filename);
        return await extractFromTextFile(blobUrl, filename);
      });
      rawText = extracted.text;
      extractedTitle = extracted.title;

      await step.run(`save-raw-text-${itemType}`, async () => {
        await db
          .update(schema.item)
          .set({ rawText, title: extractedTitle })
          .where(eq(schema.item.id, itemId));
      });
    }

    if (!rawText || rawText.trim().length === 0) {
      await step.run("mark-failed-empty", async () => {
        await db
          .update(schema.item)
          .set({ status: "failed" })
          .where(eq(schema.item.id, itemId));
      });
      return { failed: "no text extracted" };
    }

    const chunks = chunkText(rawText);

    const embeddings = await step.run("embed-chunks", async () => {
      return await embedTexts(chunks);
    });

    await step.run("store-chunks", async () => {
      await db.insert(schema.chunk).values(
        chunks.map((text, i) => ({
          itemId,
          userId: item.userId,
          projectId: item.projectId,
          position: i,
          text,
          embedding: encodeEmbedding(embeddings[i]),
        }))
      );
    });

    const enrichment = await step.run("enrich", async () => {
      return await enrich(rawText);
    });

    await step.run("mark-ready", async () => {
      await db
        .update(schema.item)
        .set({
          status: "ready",
          title: extractedTitle ?? enrichment.title,
          summary: enrichment.summary,
          tags: enrichment.tags,
          processedAt: new Date(),
        })
        .where(eq(schema.item.id, itemId));
    });

    // A now-ready item can trigger event-driven pipelines; the listener decides
    // which (if any) match and are off cooldown.
    await step.run("emit-ready", async () => {
      await inngest.send({ name: "item/ready", data: { itemId } });
    });

    return { ok: true, chunks: chunks.length };
  }
);

export const recoverPendingItems = inngest.createFunction(
  {
    id: "recover-pending-items",
    retries: 1,
    triggers: [{ cron: "* * * * *" }],
  },
  async ({ step }) => {
    const itemIds = await step.run("reemit-pending-items", async () => {
      return await reemitPendingItems((event) => inngest.send(event));
    });

    return { ok: true, reemitted: itemIds.length };
  }
);

const anthropic = new Anthropic();

const TopicSchema = z.object({
  name: z.string().min(1).max(120),
  summary: z.string().min(1).max(500),
});

const SIMILARITY_THRESHOLD = 0.6;
const MAX_CLUSTERS = 15;

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}

type ClusterItem = {
  id: string;
  title: string | null;
  summary: string;
  embedding: number[];
};

function clusterItems(items: ClusterItem[]): ClusterItem[][] {
  const remaining = [...items];
  const clusters: ClusterItem[][] = [];

  while (remaining.length > 0 && clusters.length < MAX_CLUSTERS) {
    const seedIndex = Math.floor(Math.random() * remaining.length);
    const seed = remaining[seedIndex];
    const cluster: ClusterItem[] = [seed];
    const leftover: ClusterItem[] = [];

    for (let i = 0; i < remaining.length; i++) {
      if (i === seedIndex) continue;
      const candidate = remaining[i];
      const sim = cosineSimilarity(seed.embedding, candidate.embedding);
      if (sim > SIMILARITY_THRESHOLD) {
        cluster.push(candidate);
      } else {
        leftover.push(candidate);
      }
    }

    clusters.push(cluster);
    remaining.length = 0;
    remaining.push(...leftover);
  }

  return clusters.filter((c) => c.length >= 2);
}

async function summarizeCluster(cluster: ClusterItem[]): Promise<{
  name: string;
  summary: string;
}> {
  const bullets = cluster
    .map((c) => `- ${c.title ?? "(untitled)"}: ${c.summary}`)
    .join("\n");

  const prompt = `Below is a cluster of related items from a personal knowledge base. Write a JSON object describing the cluster.

Fields:
- name: a short topic name in sentence case (no title case, max 120 chars). Concrete and specific.
- summary: one or two sentences describing what ties these items together. Max 500 chars. Sentence case. No dashes.

Respond with only the JSON object, no preamble.

Items:
${bullets}
`;

  const response = await anthropic.messages.create({
    model: MODELS.topicNaming,
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("No text block in cluster summary response");
  }

  const cleaned = block.text.trim().replace(/^```json\s*|\s*```$/g, "");
  return TopicSchema.parse(JSON.parse(cleaned));
}

export const clusterTopics = inngest.createFunction(
  {
    id: "cluster-topics",
    retries: 1,
    triggers: [{ cron: "0 4 * * *" }],
  },
  async ({ step }) => {
    const readyItems = await step.run("load-ready-items", async () => {
      return await db
        .select({
          id: schema.item.id,
          userId: schema.item.userId,
          projectId: schema.item.projectId,
          title: schema.item.title,
          summary: schema.item.summary,
        })
        .from(schema.item)
        .where(
          and(eq(schema.item.status, "ready"), isNotNull(schema.item.summary))
        );
    });

    // Cluster per (user, project), so topics never mix across the project wall.
    const byGroup = new Map<string, typeof readyItems>();
    for (const it of readyItems) {
      if (!it.summary || !it.projectId) continue;
      const key = `${it.userId}::${it.projectId}`;
      const list = byGroup.get(key) ?? [];
      list.push(it);
      byGroup.set(key, list);
    }

    const results: Array<{ userId: string; projectId: string; topics: number }> = [];

    for (const items of byGroup.values()) {
      const userId = items[0].userId;
      const projectId = items[0].projectId as string;
      const scope = and(
        eq(schema.topic.userId, userId),
        eq(schema.topic.projectId, projectId)
      );

      if (items.length < 2) {
        await step.run(`clear-${userId}-${projectId}`, async () => {
          await db.delete(schema.topic).where(scope);
        });
        results.push({ userId, projectId, topics: 0 });
        continue;
      }

      const summaries = items.map((i) => i.summary as string);

      const embeddings = await step.run(`embed-${userId}-${projectId}`, async () => {
        return await embedTexts(summaries);
      });

      const clusterInput: ClusterItem[] = items.map((it, i) => ({
        id: it.id,
        title: it.title,
        summary: it.summary as string,
        embedding: embeddings[i],
      }));

      const clusters = clusterItems(clusterInput);

      const topicRows: Array<{
        userId: string;
        projectId: string;
        name: string;
        summary: string;
        itemIds: string[];
      }> = [];

      for (let i = 0; i < clusters.length; i++) {
        const cluster = clusters[i];
        const meta = await step.run(
          `summarize-${userId}-${projectId}-${i}`,
          async () => {
            return await summarizeCluster(cluster);
          }
        );
        topicRows.push({
          userId,
          projectId,
          name: meta.name,
          summary: meta.summary,
          itemIds: cluster.map((c) => c.id),
        });
      }

      await step.run(`replace-topics-${userId}-${projectId}`, async () => {
        await db.delete(schema.topic).where(scope);
        if (topicRows.length > 0) {
          await db.insert(schema.topic).values(topicRows);
        }
      });

      results.push({ userId, projectId, topics: topicRows.length });
    }

    return { ok: true, groups: results };
  }
);

export const runDuePipelines = inngest.createFunction(
  {
    id: "run-due-pipelines",
    retries: 1,
    triggers: [{ cron: "*/10 * * * *" }],
  },
  async ({ step }) => {
    const now = new Date();

    const due = await step.run("load-due-pipelines", async () => {
      return await db
        .select()
        .from(schema.pipeline)
        .where(
          and(
            eq(schema.pipeline.enabled, true),
            or(
              isNull(schema.pipeline.nextRunAt),
              lte(schema.pipeline.nextRunAt, now)
            )!
          )
        );
    });

    const results: Array<{ pipelineId: string; ok: boolean; reason?: string }> = [];

    for (const p of due) {
      const parsed = PipelineSpecSchema.safeParse(p.spec);
      if (!parsed.success) {
        results.push({ pipelineId: p.id, ok: false, reason: "invalid spec" });
        continue;
      }
      const spec = parsed.data;

      try {
        const output = await step.run(`run-${p.id}`, async () => {
          return await runPipelineSpec(p.userId, p.projectId, spec);
        });

        await step.run(`record-${p.id}`, async () => {
          await db.insert(schema.pipelineRun).values({
            pipelineId: p.id,
            userId: p.userId,
            status: runStatusForOutput(output),
            output,
            completedAt: new Date(),
          });

          await db
            .update(schema.pipeline)
            .set({
              lastRunAt: new Date(),
              nextRunAt: nextRunFromCron(spec.cron, new Date()),
            })
            .where(eq(schema.pipeline.id, p.id));
        });

        results.push({ pipelineId: p.id, ok: true });
      } catch (err) {
        await step.run(`fail-${p.id}`, async () => {
          await db.insert(schema.pipelineRun).values({
            pipelineId: p.id,
            userId: p.userId,
            status: "failed",
            output: { error: err instanceof Error ? err.message : "Unknown" },
            completedAt: new Date(),
          });

          await db
            .update(schema.pipeline)
            .set({
              lastRunAt: new Date(),
              nextRunAt: nextRunFromCron(spec.cron, new Date()),
            })
            .where(eq(schema.pipeline.id, p.id));
        });
        results.push({
          pipelineId: p.id,
          ok: false,
          reason: err instanceof Error ? err.message : "unknown",
        });
      }
    }

    return { ok: true, ran: results.length, results };
  }
);

export const syncDueSources = inngest.createFunction(
  {
    id: "sync-due-sources",
    retries: 1,
    triggers: [{ cron: "*/10 * * * *" }],
  },
  async ({ step }) => {
    const now = new Date();

    const due = await step.run("load-due-sources", async () => {
      return await db
        .select()
        .from(schema.source)
        .where(
          and(
            eq(schema.source.enabled, true),
            eq(schema.source.runtime, "cloud"),
            isNotNull(schema.source.cron),
            or(
              isNull(schema.source.nextRunAt),
              lte(schema.source.nextRunAt, now)
            )!
          )
        );
    });

    const results: Array<{ sourceId: string; ok: boolean; newItems: number; reason?: string }> = [];

    for (const s of due) {
      const result = await step.run(`sync-${s.id}`, async () => {
        return await runSourceSync(s, "cron");
      });

      results.push({
        sourceId: s.id,
        ok: result.ok,
        newItems: result.newItems,
        reason: result.error,
      });
    }

    return { ok: true, ran: results.length, results };
  }
);

// Debounce window for event-triggered pipeline runs: a pipeline won't fire again
// (from an arrival or a coincident cron run) within this window, so a burst of
// items can't run the same pipeline repeatedly.
const EVENT_PIPELINE_COOLDOWN_MS = 10 * 60 * 1000;

// React to a newly-ready item: run any enabled pipeline in its project that
// opted into runOnNewItem, whose filter the item matches, and that is off
// cooldown. Cron pipelines are unaffected; this is purely additive.
export const runEventPipelines = inngest.createFunction(
  {
    id: "run-event-pipelines",
    retries: 1,
    triggers: [{ event: "item/ready" }],
  },
  async ({ event, step }) => {
    const { itemId } = event.data as { itemId: string };

    const item = await step.run("load-item", async () => {
      const rows = await db
        .select({
          userId: schema.item.userId,
          projectId: schema.item.projectId,
          type: schema.item.type,
          tags: schema.item.tags,
          title: schema.item.title,
          rawText: schema.item.rawText,
          capturedAt: schema.item.capturedAt,
          status: schema.item.status,
        })
        .from(schema.item)
        .where(eq(schema.item.id, itemId))
        .limit(1);
      return rows[0] ?? null;
    });

    if (!item || item.status !== "ready") return { ok: true, ran: 0 };

    const candidates = await step.run("load-pipelines", async () => {
      return await db
        .select({
          id: schema.pipeline.id,
          userId: schema.pipeline.userId,
          projectId: schema.pipeline.projectId,
          enabled: schema.pipeline.enabled,
          lastRunAt: schema.pipeline.lastRunAt,
          spec: schema.pipeline.spec,
        })
        .from(schema.pipeline)
        .where(
          and(
            eq(schema.pipeline.userId, item.userId),
            eq(schema.pipeline.projectId, item.projectId),
            eq(schema.pipeline.enabled, true)
          )
        );
    });

    // Dates are JSON-serialized to strings across the Inngest step boundary, so
    // rehydrate them before the pure selector, which expects Date instances.
    const now = new Date();
    const selected = selectEventPipelines(
      { ...item, capturedAt: new Date(item.capturedAt) },
      candidates.map((c) => ({
        ...c,
        lastRunAt: c.lastRunAt ? new Date(c.lastRunAt) : null,
      })),
      now,
      EVENT_PIPELINE_COOLDOWN_MS
    );

    for (const p of selected) {
      try {
        const output = await step.run(`run-${p.id}`, async () => {
          return await runPipelineSpec(p.userId, p.projectId, p.spec);
        });

        await step.run(`record-${p.id}`, async () => {
          await db.insert(schema.pipelineRun).values({
            pipelineId: p.id,
            userId: p.userId,
            status: runStatusForOutput(output),
            output,
            completedAt: new Date(),
          });
          // lastRunAt advances so the cooldown holds; nextRunAt (cron) is left
          // untouched, so the backstop schedule is unaffected by an event run.
          await db
            .update(schema.pipeline)
            .set({ lastRunAt: new Date() })
            .where(eq(schema.pipeline.id, p.id));
        });
      } catch (err) {
        await step.run(`fail-${p.id}`, async () => {
          await db.insert(schema.pipelineRun).values({
            pipelineId: p.id,
            userId: p.userId,
            status: "failed",
            output: { error: err instanceof Error ? err.message : "Unknown" },
            completedAt: new Date(),
          });
          await db
            .update(schema.pipeline)
            .set({ lastRunAt: new Date() })
            .where(eq(schema.pipeline.id, p.id));
        });
      }
    }

    return { ok: true, ran: selected.length };
  }
);
