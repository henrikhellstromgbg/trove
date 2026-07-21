export function drainNdjson(buffer: string, flush = false) {
  const parts = buffer.split("\n");
  const remainder = flush ? "" : parts.pop() ?? "";
  const records = parts.map((part) => part.trim()).filter(Boolean);

  return { records, remainder };
}

export function parseNdjsonRecord(record: string) {
  try {
    return { ok: true as const, value: JSON.parse(record) as unknown };
  } catch {
    return { ok: false as const };
  }
}
