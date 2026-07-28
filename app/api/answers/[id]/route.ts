import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getAnswer } from "@/lib/answers";
import { InvalidProjectError, isUuid, requireProjectId } from "@/lib/projects";

async function projectFor(userId: string, request: Request) {
  const projectId = new URL(request.url).searchParams.get("projectId");
  if (!projectId) throw new InvalidProjectError("projectId required");
  return requireProjectId(userId, projectId);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let projectId: string;
  try {
    projectId = await projectFor(userId, request);
  } catch (error) {
    if (error instanceof InvalidProjectError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const { id } = await params;
  const answer = await getAnswer(userId, projectId, id);
  if (!answer) return Response.json({ error: "Answer not found" }, { status: 404 });
  return Response.json({ answer });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let projectId: string;
  try {
    projectId = await projectFor(userId, request);
  } catch (error) {
    if (error instanceof InvalidProjectError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const { id } = await params;
  if (!isUuid(id)) {
    return Response.json({ error: "Answer not found" }, { status: 404 });
  }

  const owned = await db
    .select({ id: schema.conversation.id })
    .from(schema.conversation)
    .where(
      and(
        eq(schema.conversation.id, id),
        eq(schema.conversation.userId, userId),
        eq(schema.conversation.projectId, projectId)
      )
    )
    .limit(1);
  if (!owned[0]) {
    return Response.json({ error: "Answer not found" }, { status: 404 });
  }

  await db
    .delete(schema.conversation)
    .where(
      and(
        eq(schema.conversation.id, id),
        eq(schema.conversation.userId, userId),
        eq(schema.conversation.projectId, projectId)
      )
    );
  return Response.json({ ok: true, id });
}
