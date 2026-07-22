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

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const response = await getAi().models.embedContent({
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
