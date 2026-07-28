import { and, asc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { isUuid } from "@/lib/projects";

export type Citation = {
  n: number;
  itemId: string;
  title: string;
  source: string | null;
};

export type AnswerMessage = {
  role: string;
  content: string;
  citations: unknown;
  createdAt: Date;
};

export type AnswerRevision = {
  question: string;
  answer: string;
  citations: Citation[];
  createdAt: Date;
};

export type AnswerPage = {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  question: string | null;
  answer: string | null;
  citations: Citation[];
  activity: AnswerRevision[];
};

export type AnswerSummary = Pick<
  AnswerPage,
  "id" | "title" | "createdAt" | "updatedAt" | "answer" | "citations"
>;

function citationsOf(value: unknown): Citation[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is Citation => {
    if (!entry || typeof entry !== "object") return false;
    const citation = entry as Partial<Citation>;
    return (
      typeof citation.n === "number" &&
      typeof citation.itemId === "string" &&
      typeof citation.title === "string" &&
      (typeof citation.source === "string" || citation.source === null)
    );
  });
}

export function projectAnswer(
  conversation: { id: string; title: string | null; createdAt: Date },
  messages: AnswerMessage[]
): AnswerPage {
  const ordered = [...messages].sort(
    (left, right) => left.createdAt.getTime() - right.createdAt.getTime()
  );
  const revisions: AnswerRevision[] = [];
  let pendingQuestion: AnswerMessage | null = null;

  for (const message of ordered) {
    if (message.role === "user") {
      pendingQuestion = message;
    } else if (message.role === "assistant" && pendingQuestion) {
      revisions.push({
        question: pendingQuestion.content,
        answer: message.content,
        citations: citationsOf(message.citations),
        createdAt: message.createdAt,
      });
      pendingQuestion = null;
    }
  }

  const canonical = revisions.at(-1) ?? null;
  const latestMessage = ordered.at(-1);
  const firstQuestion = ordered.find((message) => message.role === "user");
  return {
    id: conversation.id,
    title:
      conversation.title?.trim() ||
      revisions[0]?.question ||
      firstQuestion?.content ||
      "Untitled answer",
    createdAt: conversation.createdAt,
    updatedAt: latestMessage?.createdAt ?? conversation.createdAt,
    question: canonical?.question ?? null,
    answer: canonical?.answer ?? null,
    citations: canonical?.citations ?? [],
    activity: revisions.slice(0, -1),
  };
}

async function ownedConversations(userId: string, projectId: string, answerId?: string) {
  return db
    .select({
      id: schema.conversation.id,
      title: schema.conversation.title,
      createdAt: schema.conversation.createdAt,
    })
    .from(schema.conversation)
    .where(
      and(
        eq(schema.conversation.userId, userId),
        eq(schema.conversation.projectId, projectId),
        ...(answerId ? [eq(schema.conversation.id, answerId)] : [])
      )
    )
    .orderBy(asc(schema.conversation.createdAt));
}

async function messagesFor(answerIds: string[]) {
  if (answerIds.length === 0) return [];
  return db
    .select({
      conversationId: schema.message.conversationId,
      role: schema.message.role,
      content: schema.message.content,
      citations: schema.message.citations,
      createdAt: schema.message.createdAt,
    })
    .from(schema.message)
    .where(inArray(schema.message.conversationId, answerIds))
    .orderBy(asc(schema.message.createdAt));
}

export async function listAnswers(
  userId: string,
  projectId: string
): Promise<AnswerSummary[]> {
  const conversations = await ownedConversations(userId, projectId);
  const messages = await messagesFor(conversations.map((item) => item.id));
  const grouped = new Map<string, AnswerMessage[]>();
  for (const message of messages) {
    const existing = grouped.get(message.conversationId) ?? [];
    existing.push(message);
    grouped.set(message.conversationId, existing);
  }
  return conversations
    .map((conversation) => projectAnswer(conversation, grouped.get(conversation.id) ?? []))
    .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
}

export async function getAnswer(
  userId: string,
  projectId: string,
  answerId: unknown
): Promise<AnswerPage | null> {
  if (!isUuid(answerId)) return null;
  const conversations = await ownedConversations(userId, projectId, answerId);
  const conversation = conversations[0];
  if (!conversation) return null;
  const messages = await messagesFor([conversation.id]);
  return projectAnswer(conversation, messages);
}
