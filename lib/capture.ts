export const MAX_FILE_BYTES = 32 * 1024 * 1024;

export type FileKind = "pdf" | "image" | "docx" | "xlsx" | "textfile";

export function isUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function classifyFile(file: File): FileKind | null {
  const name = file.name.toLowerCase();
  const mime = (file.type || "").toLowerCase();

  if (mime === "application/pdf" || name.endsWith(".pdf")) return "pdf";

  if (mime === "image/jpeg" || /\.(jpe?g)$/.test(name)) return "image";
  if (mime === "image/png" || name.endsWith(".png")) return "image";
  if (mime === "image/gif" || name.endsWith(".gif")) return "image";
  if (mime === "image/webp" || name.endsWith(".webp")) return "image";

  if (name.endsWith(".docx") || mime.includes("wordprocessingml")) return "docx";
  if (name.endsWith(".xlsx") || mime.includes("spreadsheetml")) return "xlsx";

  if (
    mime.startsWith("text/") ||
    mime === "application/json" ||
    /\.(txt|md|markdown|csv|tsv|json|html|xml|log|yaml|yml)$/.test(name)
  ) {
    return "textfile";
  }

  return null;
}

export function contentTypeFor(kind: FileKind, file: File): string {
  if (file.type) return file.type;
  switch (kind) {
    case "pdf":
      return "application/pdf";
    case "image":
      return "image/png";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "textfile":
      return "text/plain";
  }
}
