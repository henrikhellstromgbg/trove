import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@/lib/db";
import { nextRunFromCron, isCronValid } from "@/lib/pipelines/cron";
import { resolveProjectId } from "@/lib/projects";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    kind?: unknown;
    name?: unknown;
    feedUrl?: unknown;
    cron?: unknown;
    projectId?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const kind = typeof body.kind === "string" ? body.kind : "";
  if (kind !== "rss") {
    return NextResponse.json(
      { error: `unsupported source kind "${kind}"` },
      { status: 400 }
    );
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length === 0) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const feedUrl = typeof body.feedUrl === "string" ? body.feedUrl.trim() : "";
  if (feedUrl.length === 0) {
    return NextResponse.json({ error: "feedUrl is required" }, { status: 400 });
  }

  const cron = typeof body.cron === "string" ? body.cron.trim() : "0 * * * *";
  if (!isCronValid(cron)) {
    return NextResponse.json({ error: "cron is invalid" }, { status: 400 });
  }

  const projectId = await resolveProjectId(
    userId,
    typeof body.projectId === "string" ? body.projectId : null
  );

  const [row] = await db
    .insert(schema.source)
    .values({
      userId,
      projectId,
      kind,
      name,
      config: { feedUrl },
      runtime: "cloud",
      cron,
      enabled: true,
      nextRunAt: nextRunFromCron(cron),
    })
    .returning({ id: schema.source.id });

  return NextResponse.json({ id: row.id });
}
