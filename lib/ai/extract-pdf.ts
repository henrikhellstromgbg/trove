import Anthropic from "@anthropic-ai/sdk";
import { fetchBlobBuffer } from "@/lib/blob";
import { MODELS } from "@/lib/ai/models";

const anthropic = new Anthropic();

export type PdfExtracted = {
  title: string;
  text: string;
};

const PROMPT = `Extract the readable text from this PDF.

Return exactly:
- Line 1: a short title in sentence case, max 120 chars. Use the document's real title if present, otherwise infer one.
- Line 2: blank
- Remaining lines: the body text in reading order

No preamble, no markdown, no commentary, no horizontal rules.`;

export async function extractFromPdf(blobUrl: string): Promise<PdfExtracted> {
  const buffer = await fetchBlobBuffer(blobUrl);
  const base64 = buffer.toString("base64");

  const response = await anthropic.messages.create({
    model: MODELS.extract,
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: base64,
            },
          },
          { type: "text", text: PROMPT },
        ],
      },
    ],
  });

  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("No text block returned from PDF extraction");
  }

  const full = block.text.trim();
  const newlineIdx = full.indexOf("\n");
  if (newlineIdx === -1) {
    return { title: full.slice(0, 120) || "Untitled PDF", text: full };
  }

  const title = full.slice(0, newlineIdx).trim() || "Untitled PDF";
  const text = full.slice(newlineIdx + 1).trim();

  return { title, text: text || title };
}
