import mammoth from "mammoth";

export type DocxExtracted = {
  title: string;
  text: string;
};

export async function extractFromDocx(
  blobUrl: string,
  filename: string
): Promise<DocxExtracted> {
  const res = await fetch(blobUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch docx blob: HTTP ${res.status}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());

  const result = await mammoth.extractRawText({ buffer });
  const text = result.value.replace(/\r/g, "").trim();

  const firstLine = text.split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  const fallback = filename.replace(/\.[^.]+$/, "");
  const title = firstLine.slice(0, 120) || fallback || "Untitled document";

  return { title, text };
}
