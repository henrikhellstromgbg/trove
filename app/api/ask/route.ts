import { and, asc, cosineDistance, desc, eq } from "drizzle-orm";
import { schema } from "@/lib/db";
import { MODELS } from "@/lib/ai/models";
import { InvalidProjectError, isUuid } from "@/lib/projects";
import { askDeps } from "./deps";

const SYSTEM_PROMPT = `You answer questions using ONLY the user's own saved content, which is provided as numbered sources.

Rules:
- Cite every factual claim inline with [N] referring to the source number.
- If the sources don't contain a clear answer, say "I don't have anything saved on that yet." and stop.
- Be concise. One or two sentences is usually enough.
- Never speculate or use outside knowledge. The user's own notes are the only ground truth.`;

type AskBody = {
  question?: string;
  projectId?: string;
  conversationId?: string;
};

type ConversationOwnershipRow = {
  id: string;
  userId: string;
  projectId: string;
};

type AskFailureCode =
  | "ASK_EMBEDDING_FAILED"
  | "ASK_RETRIEVAL_FAILED"
  | "ASK_GENERATION_FAILED"
  | "ASK_PERSISTENCE_FAILED";

const ASK_FAILURE_MESSAGE = "Unable to answer right now. Try again.";

export function verifyConversationOwnership(
  userId: string,
  projectId: string,
  conversationId: string,
  row: ConversationOwnershipRow | undefined
): string | null {
  if (
    !row ||
    row.userId !== userId ||
    row.projectId.toLowerCase() !== projectId.toLowerCase() ||
    row.id.toLowerCase() !== conversationId.toLowerCase()
  ) {
    return null;
  }
  return row.id;
}

export function buildPriorQuestionContext(
  messages: Array<{ role: string; content: string }>
): string {
  return messages
    .filter((message) => message.role === "user")
    .slice(-10)
    .map((message) => `Earlier question: ${message.content}`)
    .join("\n");
}

async function requireConversation(
  userId: string,
  projectId: string,
  conversationId: unknown
) {
  if (!isUuid(conversationId)) return null;
  const rows = await askDeps.db
    .select({
      id: schema.conversation.id,
      userId: schema.conversation.userId,
      projectId: schema.conversation.projectId,
    })
    .from(schema.conversation)
    .where(
      and(
        eq(schema.conversation.id, conversationId),
        eq(schema.conversation.userId, userId),
        eq(schema.conversation.projectId, projectId)
      )
    )
    .limit(1);
  return verifyConversationOwnership(userId, projectId, conversationId, rows[0]);
}

async function resolveProject(userId: string, providedProjectId: unknown) {
  if (providedProjectId == null) {
    throw new InvalidProjectError("projectId required");
  }
  return askDeps.requireProjectId(userId, providedProjectId);
}

export async function GET(req: Request) {
  const { userId } = await askDeps.auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  let projectId: string;
  try {
    projectId = await resolveProject(userId, url.searchParams.get("projectId"));
  } catch (error) {
    if (error instanceof InvalidProjectError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const providedConversationId = url.searchParams.get("conversationId");
  if (providedConversationId) {
    const conversationId = await requireConversation(
      userId,
      projectId,
      providedConversationId
    );
    if (!conversationId) {
      return Response.json({ error: "Invalid conversationId" }, { status: 400 });
    }
    const messages = await askDeps.db
      .select({
        role: schema.message.role,
        content: schema.message.content,
        citations: schema.message.citations,
      })
      .from(schema.message)
      .where(eq(schema.message.conversationId, conversationId))
      .orderBy(asc(schema.message.createdAt));
    return Response.json({ conversationId, messages });
  }

  const conversations = await askDeps.db
    .select({
      id: schema.conversation.id,
      title: schema.conversation.title,
      createdAt: schema.conversation.createdAt,
    })
    .from(schema.conversation)
    .where(
      and(
        eq(schema.conversation.userId, userId),
        eq(schema.conversation.projectId, projectId)
      )
    )
    .orderBy(desc(schema.conversation.createdAt))
    .limit(20);
  return Response.json({ conversations });
}

export async function POST(req: Request) {
  const { userId } = await askDeps.auth();
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
  let projectId: string;
  try {
    projectId = await resolveProject(userId, body.projectId);
  } catch (error) {
    if (error instanceof InvalidProjectError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  let conversationId: string;
  let priorMessages: Array<{ role: string; content: string }> = [];
  if (body.conversationId != null) {
    const existingId = await requireConversation(
      userId,
      projectId,
      body.conversationId
    );
    if (!existingId) {
      return Response.json({ error: "Invalid conversationId" }, { status: 400 });
    }
    conversationId = existingId;
    priorMessages = await askDeps.db
      .select({ role: schema.message.role, content: schema.message.content })
      .from(schema.message)
      .where(eq(schema.message.conversationId, conversationId))
      .orderBy(desc(schema.message.createdAt))
      .limit(20);
    priorMessages.reverse();
  } else {
    const [conversation] = await askDeps.db
      .insert(schema.conversation)
      .values({
        userId,
        projectId,
        title: question.slice(0, 120),
      })
      .returning({ id: schema.conversation.id });
    conversationId = conversation.id;
  }

  await askDeps.db.insert(schema.message).values({
    conversationId,
    role: "user",
    content: question,
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (msg: object) => {
        controller.enqueue(encoder.encode(JSON.stringify(msg) + "\n"));
      };

      let failureCode: AskFailureCode = "ASK_EMBEDDING_FAILED";

      try {
        send({ type: "conversation", id: conversationId });
        const queryVec = await askDeps.embedQuery(question);
        failureCode = "ASK_RETRIEVAL_FAILED";
        const distance = cosineDistance(schema.chunk.embedding, queryVec);

        const matches = await askDeps.db
          .select({
            chunkText: schema.chunk.text,
            itemId: schema.chunk.itemId,
            title: schema.item.title,
            source: schema.item.source,
          })
          .from(schema.chunk)
          .innerJoin(schema.item, eq(schema.chunk.itemId, schema.item.id))
          .where(
            and(
              eq(schema.chunk.userId, userId),
              eq(schema.chunk.projectId, projectId),
              eq(schema.item.status, "ready")
            )
          )
          .orderBy(distance)
          .limit(12);

        type GroupedItem = {
          n: number;
          itemId: string;
          title: string;
          source: string | null;
          chunks: string[];
        };
        const grouped = new Map<string, GroupedItem>();
        for (const m of matches) {
          const existing = grouped.get(m.itemId);
          if (existing) {
            existing.chunks.push(m.chunkText);
          } else {
            grouped.set(m.itemId, {
              n: grouped.size + 1,
              itemId: m.itemId,
              title: m.title ?? "Untitled",
              source: m.source,
              chunks: [m.chunkText],
            });
          }
        }
        const items = Array.from(grouped.values());

        const citations = items.map(({ n, itemId, title, source }) => ({
          n,
          itemId,
          title,
          source,
        }));
        send({ type: "citations", items: citations });

        if (items.length === 0) {
          const answer = "I don't have anything saved on that yet.";
          send({
            type: "text",
            text: answer,
          });
          await askDeps.db.insert(schema.message).values({
            conversationId,
            role: "assistant",
            content: answer,
            citations,
          });
          send({ type: "done" });
          controller.close();
          return;
        }

        const context = items
          .map((it) => `[${it.n}] ${it.title}\n${it.chunks.join("\n\n")}`)
          .join("\n\n---\n\n");
        const priorQuestions = buildPriorQuestionContext(priorMessages);
        let answer = "";

        failureCode = "ASK_GENERATION_FAILED";
        const claudeStream = askDeps.anthropic.messages.stream({
          model: MODELS.answer,
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: `${
                priorQuestions
                  ? `Earlier user questions for conversational intent only. They are not factual sources:\n${priorQuestions}\n\n`
                  : ""
              }Sources:\n\n${context}\n\nQuestion: ${question}`,
            },
          ],
        });

        claudeStream.on("text", (delta) => {
          answer += delta;
          send({ type: "text", text: delta });
        });

        await claudeStream.finalMessage();
        failureCode = "ASK_PERSISTENCE_FAILED";
        await askDeps.db.insert(schema.message).values({
          conversationId,
          role: "assistant",
          content: answer,
          citations,
        });
      } catch {
        send({
          type: "error",
          code: failureCode,
          error: ASK_FAILURE_MESSAGE,
          retryable: true,
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
