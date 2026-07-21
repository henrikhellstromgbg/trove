import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { schema } from "@/lib/db";
import { InvalidProjectError } from "@/lib/projects";
import { nextRunFromCron } from "@/lib/pipelines/cron";
import { PipelineSpecSchema, runStatusForOutput } from "@/lib/pipelines/types";
import {
  loadOwnedPipeline,
  pipelineApiDeps,
  requireOwnedProjectId,
} from "@/lib/pipelines/api";

export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { userId } = await pipelineApiDeps.auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  let requestBody: { projectId?: unknown } | null = null;
  if (req.headers.get("content-type")?.includes("application/json")) {
    try {
      requestBody = (await req.json()) as { projectId?: unknown };
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
  }

  let projectId: string;
  try {
    projectId = await requireOwnedProjectId(
      userId,
      req.nextUrl.searchParams.get("projectId") ?? requestBody?.projectId,
      pipelineApiDeps.requireProjectId
    );
  } catch (error) {
    if (error instanceof InvalidProjectError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const pipeline = await loadOwnedPipeline(
    id,
    userId,
    projectId,
    pipelineApiDeps.db
  );

  if (!pipeline) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const parsed = PipelineSpecSchema.safeParse(pipeline.spec);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid spec" }, { status: 422 });
  }
  const spec = parsed.data;

  try {
    const output = await pipelineApiDeps.runPipelineSpec(
      userId,
      pipeline.projectId,
      spec
    );

    await pipelineApiDeps.db.insert(schema.pipelineRun).values({
      pipelineId: pipeline.id,
      userId,
      status: runStatusForOutput(output),
      output,
      completedAt: pipelineApiDeps.now(),
    });

    const now = pipelineApiDeps.now();
    await pipelineApiDeps.db
      .update(schema.pipeline)
      .set({
        lastRunAt: now,
        nextRunAt: nextRunFromCron(spec.cron, now),
      })
      .where(
        and(
          eq(schema.pipeline.id, pipeline.id),
          eq(schema.pipeline.userId, userId),
          eq(schema.pipeline.projectId, projectId)
        )
      );

    return NextResponse.json({ ok: true, output });
  } catch (err) {
    await pipelineApiDeps.db.insert(schema.pipelineRun).values({
      pipelineId: pipeline.id,
      userId,
      status: "failed",
      output: { error: err instanceof Error ? err.message : "unknown" },
      completedAt: pipelineApiDeps.now(),
    });
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 }
    );
  }
}
