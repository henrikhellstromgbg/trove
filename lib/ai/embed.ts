import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });
const MODEL = "gemini-embedding-001";
export const EMBEDDING_DIMENSIONS = 768;

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const response = await ai.models.embedContent({
    model: MODEL,
    contents: texts,
    config: { outputDimensionality: EMBEDDING_DIMENSIONS },
  });

  if (!response.embeddings) {
    throw new Error("embedTexts: no embeddings returned");
  }
  return response.embeddings.map((e) => {
    if (!e.values) throw new Error("embedTexts: missing values on embedding");
    return e.values;
  });
}

export async function embedQuery(text: string): Promise<number[]> {
  const [vec] = await embedTexts([text]);
  return vec;
}
