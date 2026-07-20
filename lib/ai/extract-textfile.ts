export type TextFileExtracted = {
  title: string;
  text: string;
};

export async function extractFromTextFile(
  blobUrl: string,
  filename: string
): Promise<TextFileExtracted> {
  const res = await fetch(blobUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch text blob: HTTP ${res.status}`);
  }
  const text = (await res.text()).replace(/\r/g, "").trim();

  const firstLine = text.split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  const fallback = filename.replace(/\.[^.]+$/, "");
  const title = (firstLine || fallback || "Untitled note").slice(0, 120);

  return { title, text };
}
