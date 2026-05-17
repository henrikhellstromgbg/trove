import { eq } from "drizzle-orm";
import { inngest } from "./client";
import { db, schema } from "@/lib/db";
import { extractFromUrl } from "@/lib/ai/extract";
import { chunkText } from "@/lib/ai/chunk";
import { embedTexts } from "@/lib/ai/embed";
import { enrich } from "@/lib/ai/enrich";

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

      await step.run("save-raw-text", async () => {
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
