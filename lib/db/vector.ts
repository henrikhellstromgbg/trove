// Vector storage + brute-force similarity for SQLite.
//
// pgvector is gone. Embeddings are stored as a raw little-endian Float32 blob
// (see schema.ts `chunk.embedding`), and retrieval ranks candidates in JS with
// cosine similarity. At personal scale (thousands of chunks, even ~50k once the
// intel corpus lands) a full scan per query is a few milliseconds — no ANN
// index needed. Both retrieval call sites select their candidate rows through
// their own db handle (preserving dependency injection for tests) and rank them
// with `rankByEmbedding`, so the scoring math lives in exactly one place.

export function encodeEmbedding(vec: number[]): Buffer {
  const f32 = Float32Array.from(vec);
  return Buffer.from(f32.buffer, f32.byteOffset, f32.byteLength);
}

export function decodeEmbedding(value: unknown): number[] | null {
  if (value == null) return null;
  if (Array.isArray(value)) return value as number[];

  let u8: Uint8Array;
  if (value instanceof Uint8Array)
    u8 = value; // Node Buffer is a Uint8Array
  else if (value instanceof ArrayBuffer) u8 = new Uint8Array(value);
  else return null;

  // Copy into a fresh, 4-byte-aligned buffer. A Node Buffer can be a view at an
  // arbitrary offset into a shared pool, which the Float32Array view rejects.
  const aligned = new Uint8Array(u8.byteLength);
  aligned.set(u8);
  return Array.from(new Float32Array(aligned.buffer));
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// Rank candidate rows by cosine similarity of their `embedding` to `query` and
// return the top `limit`, with the raw embedding stripped off. Rows missing an
// embedding sort last but remain selectable, matching pgvector's NULLS-last
// ordering (and keeping lightweight test fixtures, which omit embeddings,
// working).
export function rankByEmbedding<T extends { embedding?: unknown }>(
  rows: T[],
  query: number[],
  limit: number
): Array<Omit<T, "embedding">> {
  const scored = rows.map((row) => {
    const emb = decodeEmbedding(row.embedding ?? null);
    const score = emb ? cosineSimilarity(query, emb) : -Infinity;
    const { embedding: _embedding, ...rest } = row;
    return { score, row: rest as Omit<T, "embedding"> };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.row);
}
