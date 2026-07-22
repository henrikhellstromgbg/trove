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
  return classifyByNameAndType(file.name, file.type);
}

// Same rules as classifyFile, but from a name + MIME string, so non-File
// callers (e.g. a source sync downloading bytes) can classify too.
export function classifyByNameAndType(
  rawName: string,
  rawMime: string
): FileKind | null {
  const name = rawName.toLowerCase();
  const mime = (rawMime || "").toLowerCase();

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
  return contentTypeForKind(kind, file.type);
}

export function contentTypeForKind(kind: FileKind, mime: string): string {
  if (mime) return mime;
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
