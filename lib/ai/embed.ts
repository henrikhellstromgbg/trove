import { GoogleGenAI } from "@google/genai";
import { MODELS } from "@/lib/ai/models";

let aiClient: GoogleGenAI | null = null;
function getAi(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set");
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

const MODEL = MODELS.embed;
export const EMBEDDING_DIMENSIONS = 768;

// Gemini's embedContent accepts a batch of `contents`, but only up to a
// per-request cap. A single knowledge-base item can chunk into hundreds of
// pieces (a long podcast transcript is ~350 chunks, the largest document ~800),
// and sending them all in one request returns a hard 400 that no retry can
// recover from. Batch below the cap so every item embeds regardless of size.
// 100 is a conservative count that also keeps the per-request token total well
// under model limits (each chunk is <=2000 chars, ~500 tokens). Adjustable.
export const EMBED_BATCH_SIZE = 100;

// One request to Gemini for an already-sized batch. Returns one vector per
// input text, in order. Isolated so embedTexts can inject a fake in tests.
async function embedBatch(texts: string[]): Promise<number[][]> {
  const response = await getAi().models.embedContent({
    model: MODEL,
    contents: texts,
    config: { outputDimensionality: EMBEDDING_DIMENSIONS },
  });

  if (!response.embeddings) {
    throw new Error("embedTexts: no embeddings returned");
  }
  if (response.embeddings.length !== texts.length) {
    throw new Error(
      `embedTexts: expected ${texts.length} embeddings, got ${response.embeddings.length}`
    );
  }
  return response.embeddings.map((e) => {
    if (!e.values) throw new Error("embedTexts: missing values on embedding");
    return e.values;
  });
}

// Embed any number of texts, splitting into EMBED_BATCH_SIZE requests and
// concatenating the results in the original order. `embedFn` is injectable so
// the batching contract can be tested without calling Gemini.
export async function embedTexts(
  texts: string[],
  embedFn: (batch: string[]) => Promise<number[][]> = embedBatch
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBED_BATCH_SIZE);
    const vectors = await embedFn(batch);
    out.push(...vectors);
  }
  return out;
}

export async function embedQuery(text: string): Promise<number[]> {
  const [vec] = await embedTexts([text]);
  return vec;
}
