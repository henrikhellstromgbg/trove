import Anthropic from "@anthropic-ai/sdk";
import { fetchBlobBuffer } from "@/lib/blob";
import { MODELS } from "@/lib/ai/models";

const anthropic = new Anthropic();

export type ImageExtracted = {
  title: string;
  text: string;
};

const SUPPORTED_MEDIA = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type SupportedMedia = (typeof SUPPORTED_MEDIA)[number];

function normalizeMedia(mime: string, filename: string): SupportedMedia {
  const lower = mime.toLowerCase();
  if (SUPPORTED_MEDIA.includes(lower as SupportedMedia)) {
    return lower as SupportedMedia;
  }
  const name = filename.toLowerCase();
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".gif")) return "image/gif";
  if (name.endsWith(".webp")) return "image/webp";
  throw new Error(`Unsupported image media type: ${mime}`);
}

const PROMPT = `Look at this image and produce text Trove can index later.

Return exactly:
- Line 1: a short title in sentence case, max 120 chars. Describe what the image is.
- Line 2: blank
- Remaining lines: a clear description of what's in the image plus the complete text of anything readable in the image, in reading order

No preamble, no markdown, no commentary.`;

export async function extractFromImage(
  blobUrl: string,
  filename: string,
  mime: string
): Promise<ImageExtracted> {
  const mediaType = normalizeMedia(mime, filename);

  const buffer = await fetchBlobBuffer(blobUrl);
  const base64 = buffer.toString("base64");

  const response = await anthropic.messages.create({
    model: MODELS.extract,
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: base64 },
          },
          { type: "text", text: PROMPT },
        ],
      },
    ],
  });

  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("No text block returned from image extraction");
  }

  const full = block.text.trim();
  const newlineIdx = full.indexOf("\n");
  if (newlineIdx === -1) {
    return { title: full.slice(0, 120) || "Untitled image", text: full };
  }

  const title = full.slice(0, newlineIdx).trim() || "Untitled image";
  const text = full.slice(newlineIdx + 1).trim();
  return { title, text: text || title };
}
