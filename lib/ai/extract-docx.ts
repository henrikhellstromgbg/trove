import mammoth from "mammoth";
import { fetchBlobBuffer } from "@/lib/blob";

export type DocxExtracted = {
  title: string;
  text: string;
};

export async function extractFromDocx(
  blobUrl: string,
  filename: string
): Promise<DocxExtracted> {
  const buffer = await fetchBlobBuffer(blobUrl);

  const result = await mammoth.extractRawText({ buffer });
  const text = result.value.replace(/\r/g, "").trim();

  const firstLine = text.split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  const fallback = filename.replace(/\.[^.]+$/, "");
  const title = firstLine.slice(0, 120) || fallback || "Untitled document";

  return { title, text };
}
