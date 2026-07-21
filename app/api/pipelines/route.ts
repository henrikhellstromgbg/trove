import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@/lib/db";
import { compilePipelineDescription } from "@/lib/pipelines/compile";
import { nextRunFromCron, isCronValid } from "@/lib/pipelines/cron";
import { InvalidProjectError, requireProjectId } from "@/lib/projects";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { description?: unknown; projectId?: unknown };
  try {
    body = (await req.json()) as { description?: unknown; projectId?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  if (description.length < 10) {
    return NextResponse.json(
      { error: "description must be at least 10 characters" },
      { status: 400 }
    );
  }

  let spec;
  try {
    spec = await compilePipelineDescription(description);
  } catch (err) {
    return NextResponse.json(
      {
        error: "could not compile pipeline. try rephrasing.",
        details: err instanceof Error ? err.message : "unknown",
      },
      { status: 422 }
    );
  }

  if (!isCronValid(spec.cron)) {
    return NextResponse.json(
      { error: "compiled cron is invalid", spec },
      { status: 422 }
    );
  }

  let projectId: string;
  try {
    projectId = await requireProjectId(userId, body.projectId);
  } catch (error) {
    if (error instanceof InvalidProjectError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const [row] = await db
    .insert(schema.pipeline)
    .values({
      userId,
      projectId,
      name: spec.name,
      description,
      spec,
      cron: spec.cron,
      enabled: true,
      nextRunAt: nextRunFromCron(spec.cron),
    })
    .returning({ id: schema.pipeline.id });

  return NextResponse.json({ id: row.id, spec });
}
