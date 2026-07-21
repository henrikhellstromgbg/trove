import { and, asc, eq, count, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Project } from "@/lib/db/schema";
import { nextRunFromCron } from "@/lib/pipelines/cron";
import type { PipelineSpec } from "@/lib/pipelines/types";

const WEEKLY_DIGEST_CRON = "0 9 * * 0";

// Seed a per-project weekly digest pipeline, run through the standard
// pipeline engine (lib/pipelines/run.ts) via the run-due-pipelines cron.
// Name "weekly-digest" is relied on by app/p/[slug]/digest/page.tsx.
async function seedWeeklyDigestPipeline(userId: string, projectId: string) {
  const spec: PipelineSpec = {
    name: "weekly-digest",
    cron: WEEKLY_DIGEST_CRON,
    filter: { capturedWithinDays: 7 },
    prompt:
      "Below is a list of items you saved this past week, with titles and short summaries. Write a JSON object reflecting on what you saved.\n\n{items}",
    outputShape: "summary_with_highlights",
    deliverByEmail: true,
    retrieval: false,
    includeForgotten: true,
  };

  await db.insert(schema.pipeline).values({
    userId,
    projectId,
    name: spec.name,
    description: "weekly summary of what you saved, plus one forgotten item",
    spec,
    cron: spec.cron,
    enabled: true,
    nextRunAt: nextRunFromCron(spec.cron),
  });
}

// Resolve the user's default "inbox" project, creating it if missing.
// Idempotent under the unique (user_id, slug) index.
export async function getDefaultProjectId(userId: string): Promise<string> {
  const existing = await db
    .select({ id: schema.project.id })
    .from(schema.project)
    .where(and(eq(schema.project.userId, userId), eq(schema.project.slug, "inbox")))
    .limit(1);
  if (existing[0]) return existing[0].id;

  const [created] = await db
    .insert(schema.project)
    .values({ userId, name: "inbox", slug: "inbox", kind: "personal" })
    .onConflictDoNothing()
    .returning({ id: schema.project.id });
  if (created) {
    await seedWeeklyDigestPipeline(userId, created.id);
    return created.id;
  }

  const again = await db
    .select({ id: schema.project.id })
    .from(schema.project)
    .where(and(eq(schema.project.userId, userId), eq(schema.project.slug, "inbox")))
    .limit(1);
  return again[0].id;
}

// All of a user's projects, oldest first, with the default inbox guaranteed.
export async function listProjects(userId: string): Promise<Project[]> {
  await getDefaultProjectId(userId);
  return db
    .select()
    .from(schema.project)
    .where(eq(schema.project.userId, userId))
    .orderBy(asc(schema.project.createdAt));
}

// Validate an optional caller-supplied project id against the owner, falling
// back to the default inbox project. Used by capture and pipeline creation.
export async function resolveProjectId(
  userId: string,
  provided?: string | null
): Promise<string> {
  if (provided) {
    const rows = await db
      .select({ id: schema.project.id })
      .from(schema.project)
      .where(and(eq(schema.project.id, provided), eq(schema.project.userId, userId)))
      .limit(1);
    if (rows[0]) return rows[0].id;
  }
  return getDefaultProjectId(userId);
}

// One project by slug, scoped to the owner. Null if not found or not theirs.
export async function getProjectBySlug(
  userId: string,
  slug: string
): Promise<Project | null> {
  const rows = await db
    .select()
    .from(schema.project)
    .where(and(eq(schema.project.userId, userId), eq(schema.project.slug, slug)))
    .limit(1);
  return rows[0] ?? null;
}

// Sidebar/dashboard badge counts, all scoped to one project. Cheap count
// queries run in parallel. "processing" is the in-flight ingestion queue
// (anything not yet ready or failed), surfaced as the Processing panel.
export type ProjectCounts = {
  items: number; // Library
  topics: number; // Wiki
  sources: number; // Sources total
  sourceErrors: number; // red alert on Sources
  pipelinesActive: number; // "N active"
  processing: number; // in-flight ingestions
};

export async function getProjectCounts(
  userId: string,
  projectId: string
): Promise<ProjectCounts> {
  const [
    itemsRow,
    topicsRow,
    sourcesRow,
    sourceErrorsRow,
    pipelinesRow,
    processingRow,
  ] = await Promise.all([
    db
      .select({ c: count() })
      .from(schema.item)
      .where(and(eq(schema.item.userId, userId), eq(schema.item.projectId, projectId))),
    db
      .select({ c: count() })
      .from(schema.topic)
      .where(and(eq(schema.topic.userId, userId), eq(schema.topic.projectId, projectId))),
    db
      .select({ c: count() })
      .from(schema.source)
      .where(and(eq(schema.source.userId, userId), eq(schema.source.projectId, projectId))),
    db
      .select({ c: count() })
      .from(schema.source)
      .where(
        and(
          eq(schema.source.userId, userId),
          eq(schema.source.projectId, projectId),
          eq(schema.source.lastStatus, "error")
        )
      ),
    db
      .select({ c: count() })
      .from(schema.pipeline)
      .where(
        and(
          eq(schema.pipeline.userId, userId),
          eq(schema.pipeline.projectId, projectId),
          eq(schema.pipeline.enabled, true)
        )
      ),
    db
      .select({ c: count() })
      .from(schema.item)
      .where(
        and(
          eq(schema.item.userId, userId),
          eq(schema.item.projectId, projectId),
          inArray(schema.item.status, ["pending", "processing"])
        )
      ),
  ]);

  return {
    items: itemsRow[0]?.c ?? 0,
    topics: topicsRow[0]?.c ?? 0,
    sources: sourcesRow[0]?.c ?? 0,
    sourceErrors: sourceErrorsRow[0]?.c ?? 0,
    pipelinesActive: pipelinesRow[0]?.c ?? 0,
    processing: processingRow[0]?.c ?? 0,
  };
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

// Create a project with a unique slug per user, suffixing on collision.
export async function createProject(
  userId: string,
  name: string,
  kind: "personal" | "client",
  color?: string | null
): Promise<Project> {
  const base = slugify(name) || "project";

  const taken = new Set(
    (
      await db
        .select({ slug: schema.project.slug })
        .from(schema.project)
        .where(eq(schema.project.userId, userId))
    ).map((r) => r.slug)
  );

  let slug = base;
  let n = 2;
  while (taken.has(slug)) slug = `${base}-${n++}`;

  const [row] = await db
    .insert(schema.project)
    .values({ userId, name, slug, kind, color: color ?? null })
    .returning();
  await seedWeeklyDigestPipeline(userId, row.id);
  return row;
}
