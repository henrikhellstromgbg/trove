import { randomBytes } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { hashIngestToken } from "@/lib/ingest-auth";
import { isUuid, normalizeUuid } from "@/lib/projects";

// Issue and revoke ingest tokens from the product. Tokens are stored only as a
// sha256 hash; the plaintext is returned exactly once at creation. Project
// ownership for a project-locked token is verified by the caller (the route)
// before it reaches createIngestToken, mirroring how createSource trusts an
// already-resolved projectId.

export class InvalidIngestTokenError extends Error {
  constructor(message = "Invalid tokenId") {
    super(message);
    this.name = "InvalidIngestTokenError";
  }
}

export type CreatedIngestToken = {
  token: string; // plaintext, shown once
  id: string;
  projectId: string | null;
  label: string | null;
  createdAt: Date;
};

export type IngestTokenSummary = {
  id: string;
  label: string | null;
  projectId: string | null;
  createdAt: Date;
  revokedAt: Date | null;
};

export const ingestTokenDeps = {
  db,
  now: () => new Date(),
  generateToken: () => `trove_${randomBytes(32).toString("base64url")}`,
};

export async function createIngestToken(
  userId: string,
  input: { projectId: string | null; label?: string | null }
): Promise<CreatedIngestToken> {
  const token = ingestTokenDeps.generateToken();

  const [row] = await ingestTokenDeps.db
    .insert(schema.ingestToken)
    .values({
      userId,
      tokenHash: hashIngestToken(token),
      projectId: input.projectId,
      label: input.label ?? null,
    })
    .returning({
      id: schema.ingestToken.id,
      projectId: schema.ingestToken.projectId,
      label: schema.ingestToken.label,
      createdAt: schema.ingestToken.createdAt,
    });

  return {
    token,
    id: row.id,
    projectId: row.projectId,
    label: row.label,
    createdAt: row.createdAt,
  };
}

export async function listIngestTokens(
  userId: string
): Promise<IngestTokenSummary[]> {
  return ingestTokenDeps.db
    .select({
      id: schema.ingestToken.id,
      label: schema.ingestToken.label,
      projectId: schema.ingestToken.projectId,
      createdAt: schema.ingestToken.createdAt,
      revokedAt: schema.ingestToken.revokedAt,
    })
    .from(schema.ingestToken)
    .where(eq(schema.ingestToken.userId, userId))
    .orderBy(desc(schema.ingestToken.createdAt));
}

export async function revokeIngestToken(
  userId: string,
  tokenId: unknown
): Promise<{ id: string; revokedAt: Date }> {
  if (!isUuid(tokenId)) throw new InvalidIngestTokenError();

  const rows = await ingestTokenDeps.db
    .select({
      id: schema.ingestToken.id,
      userId: schema.ingestToken.userId,
      revokedAt: schema.ingestToken.revokedAt,
    })
    .from(schema.ingestToken)
    .where(eq(schema.ingestToken.id, normalizeUuid(tokenId)))
    .limit(1);

  const row = rows[0];
  // Ownership is compared here so a foreign token can never be revoked.
  if (!row || row.userId !== userId) throw new InvalidIngestTokenError();
  if (row.revokedAt) return { id: row.id, revokedAt: row.revokedAt };

  const [updated] = await ingestTokenDeps.db
    .update(schema.ingestToken)
    .set({ revokedAt: ingestTokenDeps.now() })
    .where(
      and(
        eq(schema.ingestToken.id, row.id),
        eq(schema.ingestToken.userId, userId)
      )
    )
    .returning({
      id: schema.ingestToken.id,
      revokedAt: schema.ingestToken.revokedAt,
    });

  return { id: updated.id, revokedAt: updated.revokedAt as Date };
}
