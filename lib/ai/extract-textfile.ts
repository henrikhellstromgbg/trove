import { readUploadText } from "@/lib/files";

export type TextFileExtracted = {
  title: string;
  text: string;
};

const STRUCTURED_TEXT_EXTENSIONS = new Set([
  "csv",
  "html",
  "json",
  "log",
  "tsv",
  "xml",
  "yaml",
  "yml",
]);

export function selectTextFileTitle(text: string, filename: string): string {
  const extension = filename.match(/\.([^.]+)$/)?.[1]?.toLowerCase();
  if (extension && STRUCTURED_TEXT_EXTENSIONS.has(extension)) {
    return (filename || "Untitled note").slice(0, 120);
  }

  const firstLine = text.split("\n").map((line) => line.trim()).find(Boolean) ?? "";
  const fallback = filename.replace(/\.[^.]+$/, "");
  return (firstLine || fallback || "Untitled note").slice(0, 120);
}

export async function extractFromTextFile(
  blobUrl: string,
  filename: string
): Promise<TextFileExtracted> {
  const text = (await readUploadText(blobUrl)).replace(/\r/g, "").trim();

  const title = selectTextFileTitle(text, filename);

  return { title, text };
}
