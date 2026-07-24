import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import { join } from "node:path";

// Local-first file storage. Uploaded files live in one flat, human-browsable
// folder (data/files/, gitignored alongside the DB). Each file is named
// `{uuid}-{sanitized original name}` so Finder shows real filenames while the
// uuid prefix guarantees uniqueness. The db stores that name (the "key") in
// item.blobUrl; nothing here needs a URL or a network call.

// Resolved per call so TROVE_FILES_DIR can be overridden (tests, alt location).
export function filesDir(): string {
  return process.env.TROVE_FILES_DIR ?? "./data/files";
}

function sanitizeName(name: string): string {
  const cleaned = name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/^\.+/, "_") // never start with a dot (hidden / traversal)
    .slice(-200);
  return cleaned || "file";
}

// A key is a single path segment we generated. Reject anything that could climb
// out of FILES_DIR, even though keys only ever come from our own db.
function diskPath(key: string): string {
  if (!key || key.includes("/") || key.includes("\\") || key.includes("..")) {
    throw new Error(`Invalid file key: ${key}`);
  }
  return join(filesDir(), key);
}

export type StoredUpload = { key: string };

// Persist bytes and return the key to store in the db.
export async function storeUpload(
  originalName: string,
  data: Buffer | Uint8Array
): Promise<StoredUpload> {
  const key = `${crypto.randomUUID()}-${sanitizeName(originalName)}`;
  await mkdir(filesDir(), { recursive: true });
  await writeFile(diskPath(key), data);
  return { key };
}

export async function readUploadBuffer(key: string): Promise<Buffer> {
  return readFile(diskPath(key));
}

export async function readUploadText(key: string): Promise<string> {
  return (await readUploadBuffer(key)).toString("utf-8");
}

// Returns true if a file was removed, false if it was already gone.
export async function deleteUpload(key: string): Promise<boolean> {
  try {
    await unlink(diskPath(key));
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  txt: "text/plain; charset=utf-8",
  md: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  json: "application/json",
  yml: "text/plain; charset=utf-8",
  yaml: "text/plain; charset=utf-8",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

// Content-Type for the serve route, inferred from the filename extension (the
// original name is preserved in the key). Falls back to octet-stream.
export function contentTypeForKey(key: string): string {
  const ext = key.includes(".") ? key.split(".").pop()!.toLowerCase() : "";
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}
