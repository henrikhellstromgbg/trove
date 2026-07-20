import { config } from "dotenv";
config({ path: ".env.local" });

import { randomBytes } from "crypto";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { eq, and } from "drizzle-orm";
import ws from "ws";
import * as schema from "../lib/db/schema";
import { hashIngestToken } from "../lib/ingest-auth";

neonConfig.webSocketConstructor = ws;

function arg(name: string): string | null {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
}

async function main() {
  const userId = arg("user");
  const projectSlug = arg("project");
  const label = arg("label");

  if (!userId) {
    console.log("Usage: pnpm tsx scripts/create-ingest-token.ts --user <clerkUserId> [--project <slug>] [--label <text>]");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle({ client: pool, schema });

  let projectId: string | null = null;
  if (projectSlug) {
    const rows = await db
      .select({ id: schema.project.id })
      .from(schema.project)
      .where(and(eq(schema.project.userId, userId), eq(schema.project.slug, projectSlug)))
      .limit(1);
    if (!rows[0]) {
      console.error(`No project with slug "${projectSlug}" for user ${userId}`);
      await pool.end();
      process.exit(1);
    }
    projectId = rows[0].id;
  }

  const token = `trove_${randomBytes(32).toString("base64url")}`;
  const tokenHash = hashIngestToken(token);

  await db.insert(schema.ingestToken).values({
    userId,
    tokenHash,
    projectId,
    label,
  });

  console.log("Ingest token created. This is shown once, store it now:");
  console.log("");
  console.log(token);
  console.log("");
  console.log(`  user:    ${userId}`);
  console.log(`  project: ${projectSlug ?? "(none — falls back to inbox per request)"}`);
  console.log(`  label:   ${label ?? "(none)"}`);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
