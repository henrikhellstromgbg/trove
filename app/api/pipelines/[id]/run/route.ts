import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { runPipelineSpec } from "@/lib/pipelines/run";
import { nextRunFromCron } from "@/lib/pipelines/cron";
import { PipelineSpecSchema } from "@/lib/pipelines/types";

export const maxDuration = 60;

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const [pipeline] = await db
    .select()
    .from(schema.pipeline)
    .where(
      and(eq(schema.pipeline.id, id), eq(schema.pipeline.userId, userId))
    )
    .limit(1);

  if (!pipeline) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const parsed = PipelineSpecSchema.safeParse(pipeline.spec);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid spec" }, { status: 422 });
  }
  const spec = parsed.data;

  try {
    const output = await runPipelineSpec(userId, pipeline.projectId, spec);

    await db.insert(schema.pipelineRun).values({
      pipelineId: pipeline.id,
      userId,
      status: "completed",
      output,
      completedAt: new Date(),
    });

    await db
      .update(schema.pipeline)
      .set({
        lastRunAt: new Date(),
        nextRunAt: nextRunFromCron(spec.cron, new Date()),
      })
      .where(eq(schema.pipeline.id, pipeline.id));

    return NextResponse.json({ ok: true, output });
  } catch (err) {
    await db.insert(schema.pipelineRun).values({
      pipelineId: pipeline.id,
      userId,
      status: "failed",
      output: { error: err instanceof Error ? err.message : "unknown" },
      completedAt: new Date(),
    });
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 }
    );
  }
}
