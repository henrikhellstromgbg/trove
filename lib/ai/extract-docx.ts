import mammoth from "mammoth";
import { readUploadBuffer } from "@/lib/files";

export type DocxExtracted = {
  title: string;
  text: string;
};

export async function extractFromDocx(
  blobUrl: string,
  filename: string
): Promise<DocxExtracted> {
  const buffer = await readUploadBuffer(blobUrl);

  const result = await mammoth.extractRawText({ buffer });
  const text = result.value.replace(/\r/g, "").trim();

  const firstLine = text.split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  const fallback = filename.replace(/\.[^.]+$/, "");
  const title = firstLine.slice(0, 120) || fallback || "Untitled document";

  return { title, text };
}
