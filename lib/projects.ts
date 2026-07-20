import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

// Resolve the user's default "inbox" project, creating it if missing.
// Used until capture can target an explicit project chosen in the UI.
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
  if (created) return created.id;

  // Lost an insert race, the row now exists. Re-select.
  const again = await db
    .select({ id: schema.project.id })
    .from(schema.project)
    .where(and(eq(schema.project.userId, userId), eq(schema.project.slug, "inbox")))
    .limit(1);
  return again[0].id;
}
