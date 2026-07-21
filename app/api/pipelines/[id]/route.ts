import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { schema } from "@/lib/db";
import { InvalidProjectError } from "@/lib/projects";
import {
  buildPipelinePatchUpdate,
  loadOwnedPipeline,
  parsePipelinePatchBody,
  pipelineApiDeps,
  requireOwnedProjectId,
} from "@/lib/pipelines/api";

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { userId } = await pipelineApiDeps.auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  let projectId: string;
  try {
    projectId = await requireOwnedProjectId(
      userId,
      req.nextUrl.searchParams.get("projectId") ?? undefined,
      pipelineApiDeps.requireProjectId
    );
  } catch (error) {
    if (error instanceof InvalidProjectError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const existing = await loadOwnedPipeline(
    id,
    userId,
    projectId,
    pipelineApiDeps.db
  );
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await pipelineApiDeps.db
    .delete(schema.pipeline)
    .where(
      and(
        eq(schema.pipeline.id, id),
        eq(schema.pipeline.userId, userId),
        eq(schema.pipeline.projectId, projectId)
      )
    );

  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { userId } = await pipelineApiDeps.auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parsePipelinePatchBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  let projectId: string;
  try {
    projectId = await requireOwnedProjectId(
      userId,
      parsed.value.projectId,
      pipelineApiDeps.requireProjectId
    );
  } catch (error) {
    if (error instanceof InvalidProjectError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const existing = await loadOwnedPipeline(
    id,
    userId,
    projectId,
    pipelineApiDeps.db
  );
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const update = buildPipelinePatchUpdate(
    existing,
    parsed.value,
    pipelineApiDeps.now()
  );
  if (!update.ok) {
    return NextResponse.json(
      { error: update.error },
      { status: update.status }
    );
  }

  await pipelineApiDeps.db
    .update(schema.pipeline)
    .set(update.value)
    .where(
      and(
        eq(schema.pipeline.id, id),
        eq(schema.pipeline.userId, userId),
        eq(schema.pipeline.projectId, projectId)
      )
    );

  return NextResponse.json({ ok: true });
}
