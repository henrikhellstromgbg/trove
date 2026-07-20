import { createHash } from "crypto";
import { auth } from "@clerk/nextjs/server";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export function hashIngestToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type IngestAuth = {
  userId: string;
  defaultProjectId: string | null;
};

// Browser callers use a Clerk session. The local daemon and other
// server-to-server callers use an ingest token in Authorization: Bearer,
// since they cannot complete a Clerk browser login.
export async function resolveIngestAuth(req: Request): Promise<IngestAuth | null> {
  const { userId } = await auth();
  if (userId) {
    return { userId, defaultProjectId: null };
  }

  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const tokenHash = hashIngestToken(match[1].trim());
  const rows = await db
    .select({
      userId: schema.ingestToken.userId,
      projectId: schema.ingestToken.projectId,
    })
    .from(schema.ingestToken)
    .where(
      and(
        eq(schema.ingestToken.tokenHash, tokenHash),
        isNull(schema.ingestToken.revokedAt)
      )
    )
    .limit(1);

  if (!rows[0]) return null;
  return { userId: rows[0].userId, defaultProjectId: rows[0].projectId };
}
