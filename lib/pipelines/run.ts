import { and, eq, inArray, gte, ilike, or, desc, sql, lt, cosineDistance } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { db, schema } from "@/lib/db";
import { embedQuery } from "@/lib/ai/embed";
import {
  PipelineSpec,
  PipelineRunOutput,
  PipelineForgotten,
  PipelineDelivery,
} from "./types";
import { sendPipelineEmail } from "./email";

const SKIPPED_DELIVERY: PipelineDelivery = {
  attempted: false,
  status: "skipped",
  recipient: null,
};

const anthropic = new Anthropic();

const MAX_ITEMS = 60;
const MAX_RETRIEVAL_CHUNKS = 40;
const FORGOTTEN_AFTER_DAYS = 30;

export async function runPipelineSpec(
  userId: string,
  projectId: string,
  spec: PipelineSpec
): Promise<PipelineRunOutput> {
  const items = await loadItems(userId, projectId, spec);
  const forgotten = spec.includeForgotten
    ? await pickForgottenItem(userId, projectId)
    : null;

  if (items.length === 0) {
    // No report body means nothing is delivered; the empty result is still
    // stored so the run is visible.
    return { ...emptyOutput(spec), forgotten, delivery: SKIPPED_DELIVERY };
  }

  const itemsContext = spec.retrieval
    ? (await loadRetrievalContext(
        userId,
        projectId,
        items.map((it) => it.id),
        spec.retrievalQuery?.trim() || spec.prompt
      )) || buildSummaryContext(items)
    : buildSummaryContext(items);

  const promptWithItems = spec.prompt.includes("{items}")
    ? spec.prompt.replace(/\{items\}/g, itemsContext)
    : `${spec.prompt}\n\nItems:\n${itemsContext}`;

  const outputInstruction = outputInstructionFor(spec.outputShape);

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1500,
    messages: [
      {
        role: "user",
        content: `${promptWithItems}\n\n${outputInstruction}`,
      },
    ],
  });

  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("No text in pipeline response");
  }
  const raw = block.text.trim();

  const output: PipelineRunOutput = { ...parseOutput(spec.outputShape, raw), forgotten };

  // Delivery never throws: a failed send is recorded on the output so the run
  // is downgraded, not lost, and the report stays stored either way.
  const delivery = spec.deliverByEmail
    ? await sendPipelineEmail(userId, spec, output)
    : SKIPPED_DELIVERY;

  return { ...output, delivery };
}

function buildSummaryContext(items: { title: string | null; summary: string | null; tags: string[] | null }[]): string {
  return items
    .map((it, i) => {
      const title = it.title ?? "(untitled)";
      const summary = it.summary ?? "";
      const tags = (it.tags ?? []).join(", ");
      return `${i + 1}. ${title}\n   ${summary}${tags ? `\n   tags: ${tags}` : ""}`;
    })
    .join("\n\n");
}

// Full chunk text for the filtered items, ranked by relevance to `query`, so a
// pipeline can reason over full content instead of just title/summary/tags.
async function loadRetrievalContext(
  userId: string,
  projectId: string,
  itemIds: string[],
  query: string
): Promise<string> {
  if (itemIds.length === 0) return "";

  const queryVec = await embedQuery(query);
  const distance = cosineDistance(schema.chunk.embedding, queryVec);

  const matches = await db
    .select({
      chunkText: schema.chunk.text,
      itemId: schema.chunk.itemId,
      title: schema.item.title,
    })
    .from(schema.chunk)
    .innerJoin(schema.item, eq(schema.chunk.itemId, schema.item.id))
    .where(
      and(
        eq(schema.chunk.userId, userId),
        eq(schema.chunk.projectId, projectId),
        inArray(schema.chunk.itemId, itemIds)
      )
    )
    .orderBy(distance)
    .limit(MAX_RETRIEVAL_CHUNKS);

  const grouped = new Map<string, { title: string | null; chunks: string[] }>();
  for (const m of matches) {
    const existing = grouped.get(m.itemId);
    if (existing) existing.chunks.push(m.chunkText);
    else grouped.set(m.itemId, { title: m.title, chunks: [m.chunkText] });
  }

  return Array.from(grouped.values())
    .map((g, i) => `${i + 1}. ${g.title ?? "(untitled)"}\n${g.chunks.join("\n\n")}`)
    .join("\n\n");
}

async function pickForgottenItem(
  userId: string,
  projectId: string
): Promise<PipelineForgotten> {
  const cutoff = new Date(Date.now() - FORGOTTEN_AFTER_DAYS * 24 * 60 * 60 * 1000);

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
        lt(schema.item.capturedAt, cutoff)
      )
    )
    .orderBy(sql`random()`)
    .limit(1);

  if (!rows[0]) return null;
  return { itemId: rows[0].id, title: rows[0].title, summary: rows[0].summary };
}

async function loadItems(userId: string, projectId: string, spec: PipelineSpec) {
  const conditions = [
    eq(schema.item.userId, userId),
    eq(schema.item.projectId, projectId),
    eq(schema.item.status, "ready"),
  ];

  if (spec.filter.types && spec.filter.types.length > 0) {
    conditions.push(inArray(schema.item.type, spec.filter.types));
  }

  if (spec.filter.capturedWithinDays) {
    const cutoff = new Date(
      Date.now() - spec.filter.capturedWithinDays * 24 * 60 * 60 * 1000
    );
    conditions.push(gte(schema.item.capturedAt, cutoff));
  }

  if (spec.filter.contains) {
    const needle = `%${spec.filter.contains}%`;
    conditions.push(
      or(
        ilike(schema.item.title, needle),
        ilike(schema.item.rawText, needle)
      )!
    );
  }

  if (spec.filter.tagsAny && spec.filter.tagsAny.length > 0) {
    const tagsAny = spec.filter.tagsAny;
    conditions.push(
      sql`${schema.item.tags} && ARRAY[${sql.join(
        tagsAny.map((t) => sql`${t}`),
        sql`, `
      )}]::text[]`
    );
  }

  return db
    .select({
      id: schema.item.id,
      title: schema.item.title,
      summary: schema.item.summary,
      tags: schema.item.tags,
      type: schema.item.type,
      capturedAt: schema.item.capturedAt,
    })
    .from(schema.item)
    .where(and(...conditions))
    .orderBy(desc(schema.item.capturedAt))
    .limit(MAX_ITEMS);
}

function outputInstructionFor(shape: PipelineSpec["outputShape"]): string {
  if (shape === "text") {
    return "Respond with a single paragraph as plain text. No JSON, no preamble, no markdown.";
  }
  if (shape === "summary_with_highlights") {
    return 'Respond with ONLY a JSON object: {"summary": "...", "highlights": ["...", "..."]}. Highlights should be 3 to 5 short bullets, sentence case, no markdown.';
  }
  return 'Respond with ONLY a JSON object: {"items": ["...", "...", ...]}. Items are short strings, sentence case, no markdown.';
}

function emptyOutput(spec: PipelineSpec): PipelineRunOutput {
  if (spec.outputShape === "text") {
    return { shape: "text", text: "No items matched the filter this run." };
  }
  if (spec.outputShape === "summary_with_highlights") {
    return {
      shape: "summary_with_highlights",
      summary: "No items matched the filter this run.",
      highlights: [],
    };
  }
  return { shape: "list", items: [] };
}

function parseOutput(
  shape: PipelineSpec["outputShape"],
  raw: string
): PipelineRunOutput {
  if (shape === "text") {
    return { shape: "text", text: raw };
  }
  const cleaned = raw.replace(/^```json\s*|\s*```$/g, "");
  const parsed = JSON.parse(cleaned);

  if (shape === "summary_with_highlights") {
    return {
      shape: "summary_with_highlights",
      summary: String(parsed.summary ?? ""),
      highlights: Array.isArray(parsed.highlights)
        ? parsed.highlights.map(String)
        : [],
    };
  }

  return {
    shape: "list",
    items: Array.isArray(parsed.items) ? parsed.items.map(String) : [],
  };
}
