import { and, eq, inArray, gte, ilike, or, desc, sql } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { db, schema } from "@/lib/db";
import { PipelineSpec, PipelineRunOutput } from "./types";
import { sendPipelineEmail } from "./email";

const anthropic = new Anthropic();

const MAX_ITEMS = 60;

export async function runPipelineSpec(
  userId: string,
  spec: PipelineSpec
): Promise<PipelineRunOutput> {
  const items = await loadItems(userId, spec);

  if (items.length === 0) {
    return emptyOutput(spec);
  }

  const itemsContext = items
    .map((it, i) => {
      const title = it.title ?? "(untitled)";
      const summary = it.summary ?? "";
      const tags = (it.tags ?? []).join(", ");
      return `${i + 1}. ${title}\n   ${summary}${tags ? `\n   tags: ${tags}` : ""}`;
    })
    .join("\n\n");

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

  const output = parseOutput(spec.outputShape, raw);

  if (spec.deliverByEmail) {
    try {
      await sendPipelineEmail(userId, spec, output);
    } catch (err) {
      console.error("pipeline email delivery failed:", err);
    }
  }

  return output;
}

async function loadItems(userId: string, spec: PipelineSpec) {
  const conditions = [
    eq(schema.item.userId, userId),
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
