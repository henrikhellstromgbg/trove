import { and, asc, eq, count, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Project } from "@/lib/db/schema";
import { nextRunFromCron } from "@/lib/pipelines/cron";
import { buildStarterPipelineTemplate } from "@/lib/pipelines/templates";

// Seed the per-project Friday weekly digest pipeline through the standard
// pipeline engine. Name "weekly-digest" is still relied on by the digest page.
async function seedWeeklyDigestPipeline(userId: string, projectId: string) {
  const template = buildStarterPipelineTemplate("weekly-summary");

  await db.insert(schema.pipeline).values({
    userId,
    projectId,
    templateKey: template.id,
    name: template.pipelineName,
    description: template.description,
    spec: template.spec,
    cron: template.spec.cron,
    enabled: true,
    nextRunAt: nextRunFromCron(template.spec.cron),
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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class InvalidProjectError extends Error {
  constructor(message = "Invalid projectId") {
    super(message);
    this.name = "InvalidProjectError";
  }
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

// UUID text is case-insensitive; normalize before any string comparison.
export function normalizeUuid(value: string): string {
  return value.toLowerCase();
}

export type ProjectOwnershipRow = { id: string; userId: string };

// The single ownership decision point, pure so tests can feed it real rows.
// Removing either comparison must fail the isolation tests.
export function verifyProjectOwnership(
  userId: string,
  provided: string,
  row: ProjectOwnershipRow | undefined
): string {
  if (!row) throw new InvalidProjectError();
  if (row.userId !== userId) throw new InvalidProjectError();
  if (normalizeUuid(row.id) !== normalizeUuid(provided)) {
    throw new InvalidProjectError();
  }
  return row.id;
}

// An omitted project id uses the user's inbox. An explicitly supplied id must
// be a valid UUID owned by the user and never silently falls back. The row is
// fetched by id alone; ownership is decided in verifyProjectOwnership.
export async function requireProjectId(
  userId: string,
  provided?: unknown
): Promise<string> {
  if (provided == null) return getDefaultProjectId(userId);
  if (!isUuid(provided)) throw new InvalidProjectError();

  const rows = await db
    .select({ id: schema.project.id, userId: schema.project.userId })
    .from(schema.project)
    .where(eq(schema.project.id, normalizeUuid(provided)))
    .limit(1);
  return verifyProjectOwnership(userId, provided, rows[0]);
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
  reviewPending: number; // items held for review
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
    reviewRow,
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
    db
      .select({ c: count() })
      .from(schema.item)
      .where(
        and(
          eq(schema.item.userId, userId),
          eq(schema.item.projectId, projectId),
          eq(schema.item.status, "review")
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
    reviewPending: reviewRow[0]?.c ?? 0,
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
