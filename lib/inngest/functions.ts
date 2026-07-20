import { eq, and, isNotNull, isNull, gt, lt, lte, or, sql } from "drizzle-orm";
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
import { enrich } from "@/lib/ai/enrich";
import { runPipelineSpec } from "@/lib/pipelines/run";
import { nextRunFromCron } from "@/lib/pipelines/cron";
import { PipelineSpecSchema } from "@/lib/pipelines/types";

export const ingestItem = inngest.createFunction(
  {
    id: "ingest-item",
    retries: 3,
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
    if (item.status === "ready") return { skipped: "already ready" };

    await step.run("mark-processing", async () => {
      await db
        .update(schema.item)
        .set({ status: "processing" })
        .where(eq(schema.item.id, itemId));
    });

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
          embedding: embeddings[i],
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

    return { ok: true, chunks: chunks.length };
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
    model: "claude-haiku-4-5",
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

const DigestSchema = z.object({
  summary: z.string().min(1).max(1200),
  highlights: z.array(z.string().min(1)).min(3).max(5),
});

async function summarizeDigest(
  context: string
): Promise<{ summary: string; highlights: string[] }> {
  const prompt = `Below is a list of items a person saved this past week, with their titles and short summaries. Write a JSON object reflecting on what they saved.

Fields:
- summary: one paragraph in sentence case. No title case. No dashes (neither em-dash nor en-dash). Use commas or rewrite. Warm and direct. Max 1200 chars.
- highlights: an array of 3 to 5 short bullet strings. Each in sentence case. No leading dashes or bullets in the strings themselves.

Respond with only the JSON object, no preamble.

Items:
${context}
`;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("No text block in digest response");
  }

  const cleaned = block.text.trim().replace(/^```json\s*|\s*```$/g, "");
  return DigestSchema.parse(JSON.parse(cleaned));
}

export const weeklyDigest = inngest.createFunction(
  {
    id: "weekly-digest",
    retries: 1,
    triggers: [{ cron: "0 9 * * 0" }],
  },
  async ({ step }) => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);

    const recent = await step.run("load-recent-items", async () => {
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
          and(
            eq(schema.item.status, "ready"),
            gt(schema.item.capturedAt, weekAgo)
          )
        );
    });

    // One digest per (user, project), so a project's week never bleeds into another.
    const byGroup = new Map<string, typeof recent>();
    for (const it of recent) {
      if (!it.projectId) continue;
      const key = `${it.userId}::${it.projectId}`;
      const list = byGroup.get(key) ?? [];
      list.push(it);
      byGroup.set(key, list);
    }

    const results: Array<{
      userId: string;
      projectId: string;
      status: "created" | "skipped-no-items" | "skipped-duplicate";
    }> = [];

    for (const items of byGroup.values()) {
      const userId = items[0].userId;
      const projectId = items[0].projectId as string;

      const pipelineRow = await step.run(
        `ensure-pipeline-${userId}-${projectId}`,
        async () => {
          const existing = await db
            .select()
            .from(schema.pipeline)
            .where(
              and(
                eq(schema.pipeline.userId, userId),
                eq(schema.pipeline.projectId, projectId),
                eq(schema.pipeline.name, "weekly-digest")
              )
            )
            .limit(1);
          if (existing[0]) return existing[0];

          const inserted = await db
            .insert(schema.pipeline)
            .values({
              userId,
              projectId,
              name: "weekly-digest",
              description:
                "weekly summary of what you saved + one forgotten item",
              spec: {},
              cron: "0 9 * * 0",
              enabled: true,
            })
            .returning();
          return inserted[0];
        }
      );

      const duplicate = await step.run(
        `check-duplicate-${userId}-${projectId}`,
        async () => {
          const rows = await db
            .select({ id: schema.pipelineRun.id })
            .from(schema.pipelineRun)
            .where(
              and(
                eq(schema.pipelineRun.userId, userId),
                eq(schema.pipelineRun.pipelineId, pipelineRow.id),
                gt(schema.pipelineRun.startedAt, sixDaysAgo)
              )
            )
            .limit(1);
          return rows[0] ?? null;
        }
      );

      if (duplicate) {
        results.push({ userId, projectId, status: "skipped-duplicate" });
        continue;
      }

      const context = items
        .map(
          (it) =>
            `- ${it.title ?? "(untitled)"}: ${it.summary ?? "(no summary)"}`
        )
        .join("\n");

      const digest = await step.run(`summarize-${userId}-${projectId}`, async () => {
        return await summarizeDigest(context);
      });

      const forgotten = await step.run(
        `pick-forgotten-${userId}-${projectId}`,
        async () => {
        const rows = await db
          .select({
            id: schema.item.id,
            title: schema.item.title,
            summary: schema.item.summary,
          })
          .from(schema.item)
          .where(
            and(
              eq(schema.item.userId, userId),
              eq(schema.item.projectId, projectId),
              eq(schema.item.status, "ready"),
              lt(schema.item.capturedAt, monthAgo)
            )
          )
          .orderBy(sql`random()`)
          .limit(1);
        if (!rows[0]) return null;
        return {
          itemId: rows[0].id,
          title: rows[0].title,
          summary: rows[0].summary,
        };
      });

      await step.run(`insert-run-${userId}-${projectId}`, async () => {
        await db.insert(schema.pipelineRun).values({
          pipelineId: pipelineRow.id,
          userId,
          status: "completed",
          output: {
            summary: digest.summary,
            highlights: digest.highlights,
            forgotten,
          },
          completedAt: new Date(),
        });
      });

      results.push({ userId, projectId, status: "created" });
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
          return await runPipelineSpec(p.userId, spec);
        });

        await step.run(`record-${p.id}`, async () => {
          await db.insert(schema.pipelineRun).values({
            pipelineId: p.id,
            userId: p.userId,
            status: "completed",
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
