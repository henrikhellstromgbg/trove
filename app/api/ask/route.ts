import { auth } from "@clerk/nextjs/server";
import { eq, cosineDistance } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { db, schema } from "@/lib/db";
import { embedQuery } from "@/lib/ai/embed";

const anthropic = new Anthropic();

const SYSTEM_PROMPT = `You answer questions using ONLY the user's own saved content, which is provided as numbered sources.

Rules:
- Cite every factual claim inline with [N] referring to the source number.
- If the sources don't contain a clear answer, say "I don't have anything saved on that yet." and stop.
- Be concise. One or two sentences is usually enough.
- Never speculate or use outside knowledge. The user's own notes are the only ground truth.`;

type AskBody = { question?: string };

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: AskBody;
  try {
    body = (await req.json()) as AskBody;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const question = body.question?.trim();
  if (!question) {
    return Response.json({ error: "question required" }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (msg: object) => {
        controller.enqueue(encoder.encode(JSON.stringify(msg) + "\n"));
      };

      try {
        const queryVec = await embedQuery(question);
        const distance = cosineDistance(schema.chunk.embedding, queryVec);

        const matches = await db
          .select({
            chunkText: schema.chunk.text,
            itemId: schema.chunk.itemId,
            title: schema.item.title,
            source: schema.item.source,
          })
          .from(schema.chunk)
          .innerJoin(schema.item, eq(schema.chunk.itemId, schema.item.id))
          .where(eq(schema.chunk.userId, userId))
          .orderBy(distance)
          .limit(8);

        const citations = matches.map((m, i) => ({
          n: i + 1,
          itemId: m.itemId,
          title: m.title ?? "Untitled",
          source: m.source,
        }));
        send({ type: "citations", items: citations });

        if (matches.length === 0) {
          send({
            type: "text",
            text: "I don't have anything saved on that yet.",
          });
          send({ type: "done" });
          controller.close();
          return;
        }

        const context = matches
          .map((m, i) => `[${i + 1}] ${m.title ?? "Untitled"}\n${m.chunkText}`)
          .join("\n\n---\n\n");

        const claudeStream = anthropic.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: `Sources:\n\n${context}\n\nQuestion: ${question}`,
            },
          ],
        });

        claudeStream.on("text", (delta) => {
          send({ type: "text", text: delta });
        });

        await claudeStream.finalMessage();
      } catch (err) {
        send({
          type: "error",
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }

      send({ type: "done" });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
    },
  });
}
