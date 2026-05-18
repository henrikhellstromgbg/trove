import Anthropic from "@anthropic-ai/sdk";
import { PipelineSpec, PipelineSpecSchema } from "./types";

const anthropic = new Anthropic();

const SYSTEM_PROMPT = `You compile English pipeline descriptions into structured JSON specs for Trove, a personal knowledge base.

Trove items have:
- type: one of text, url, pdf, image, docx, xlsx, textfile
- tags: 3 to 5 lowercase kebab-case tags auto-generated per item
- title, summary, captured_at, raw_text

A pipeline is a recurring job that:
1. Filters the user's items
2. Sends them to Claude with a prompt
3. Stores the structured output

Produce a JSON object with exactly these fields:

- name: short, sentence case, max 120 chars
- cron: a cron expression (5 fields: minute hour day-of-month month day-of-week). Times are UTC.
  - Daily morning: "0 9 * * *"
  - Sunday morning: "0 9 * * 0"
  - First of month: "0 9 1 * *"
  - Hourly: "0 * * * *"
- filter: an object with optional fields:
  - types: array from ["text","url","pdf","image","docx","xlsx","textfile"]
  - tagsAny: array of lowercase kebab-case tags ("any of these matches")
  - capturedWithinDays: integer, items captured in last N days
  - contains: substring to match in title or text
  Omit fields the user did not ask for. Filter should be empty {} if the user wants all items.
- prompt: instruction for Claude. Include "{items}" where the list of items should be inserted. The prompt should reference what Claude should produce. Sentence case, no em-dashes.
- outputShape: one of:
  - "text" if the user wants a paragraph
  - "summary_with_highlights" if they want {summary, highlights[]}
  - "list" if they want a list of items, names, links
- deliverByEmail: true if the user asked to receive the result by email ("email me", "send to my inbox", "mail me", "to my email"). False otherwise.

Rules:
- Be conservative. Do not invent filters the user did not request.
- Use sentence case in all strings. No em-dashes.
- Translate Swedish or other languages to English in the spec name and prompt.

Respond with ONLY the JSON object. No preamble, no markdown.`;

export async function compilePipelineDescription(description: string): Promise<PipelineSpec> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: description }],
  });

  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("No text returned from compiler");
  }

  const cleaned = block.text.trim().replace(/^```json\s*|\s*```$/g, "");
  const parsed = JSON.parse(cleaned);
  return PipelineSpecSchema.parse(parsed);
}
