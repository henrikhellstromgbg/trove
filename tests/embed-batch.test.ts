import assert from "node:assert/strict";
import { test } from "node:test";
import { embedTexts, EMBED_BATCH_SIZE } from "@/lib/ai/embed";

// Verifies the Fix 1 batching contract without calling Gemini: no single
// request exceeds EMBED_BATCH_SIZE, and every input text gets exactly one
// embedding back, in order. The real per-batch request path is unchanged from
// the previously-working small-item path; only the batching around it is new.

// A fake low-level embed that records the batch sizes it saw and returns a
// deterministic vector encoding the text's identity, so order can be checked.
function makeFake() {
  const batchSizes: number[] = [];
  const embedFn = async (batch: string[]): Promise<number[][]> => {
    batchSizes.push(batch.length);
    return batch.map((t) => [Number(t.split("#")[1]), 0, 0]);
  };
  return { batchSizes, embedFn };
}

for (const n of [349, 818]) {
  test(`embedTexts batches ${n} chunks under the API cap and returns one vector each`, async () => {
    const texts = Array.from({ length: n }, (_, i) => `chunk#${i}`);
    const { batchSizes, embedFn } = makeFake();

    const vectors = await embedTexts(texts, embedFn);

    // Every chunk embedded, exactly once.
    assert.equal(vectors.length, n);
    // Order preserved (vector[0] encodes the original index).
    for (let i = 0; i < n; i++) assert.equal(vectors[i][0], i);
    // No request exceeded the cap.
    assert.ok(batchSizes.every((s) => s <= EMBED_BATCH_SIZE));
    // Batches sum to the whole input and match the expected split.
    assert.equal(
      batchSizes.reduce((a, b) => a + b, 0),
      n
    );
    assert.equal(batchSizes.length, Math.ceil(n / EMBED_BATCH_SIZE));
  });
}

test("embedTexts returns empty for empty input without calling the API", async () => {
  let called = false;
  const vectors = await embedTexts([], async () => {
    called = true;
    return [];
  });
  assert.deepEqual(vectors, []);
  assert.equal(called, false);
});
