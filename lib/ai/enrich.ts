import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { MODELS } from "@/lib/ai/models";

const anthropic = new Anthropic();

const EnrichmentSchema = z.object({
  title: z.string().min(1).max(120),
  summary: z.string().min(1).max(500),
  tags: z.array(z.string()).min(2).max(6),
});

export type Enrichment = z.infer<typeof EnrichmentSchema>;

const PROMPT = `Read the content below and produce a JSON object with three fields:
- title: a short title in sentence case (no title case, max 120 chars). If the source already has a title, refine it; otherwise infer one.
- summary: one or two sentences capturing what the content is and why someone might revisit it. Max 500 chars.
- tags: 2 to 6 lowercase kebab-case tags. Prefer concrete topics (people, technologies, themes) over generic words.

Respond with only the JSON object, no preamble.

Content:
`;

export async function enrich(text: string): Promise<Enrichment> {
  const truncated = text.slice(0, 12000);

  const response = await anthropic.messages.create({
    model: MODELS.enrich,
    max_tokens: 512,
    messages: [{ role: "user", content: PROMPT + truncated }],
  });

  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("No text block in enrichment response");
  }

  const cleaned = block.text.trim().replace(/^```json\s*|\s*```$/g, "");
  const parsed = EnrichmentSchema.parse(JSON.parse(cleaned));
  return parsed;
}
