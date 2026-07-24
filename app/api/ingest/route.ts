import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { schema } from "@/lib/db";
import { InvalidProjectError, isUuid } from "@/lib/projects";
import {
  InvalidSourceError,
  LockedProjectError,
  enforceTokenLock,
  verifySourceOwnership,
} from "@/lib/ingest-validation";
import { IngestAuth } from "@/lib/ingest-auth";
import { MAX_FILE_BYTES, classifyFile, isUrl } from "@/lib/capture";
import {
  DeletedExternalItemError,
  assertExternalItemNotDeleted,
} from "@/lib/review-or-deletion/import-guard";
import {
  importedItemStatus,
  type ReviewCandidate,
} from "@/lib/sources/review-rules";
import { ingestDeps } from "./deps";

// The capture seam: one endpoint, two auth modes (Clerk session for the
// browser, ingest token for the local daemon and other server callers).
// See docs/architecture-v2.md.
export async function POST(req: NextRequest) {
  const ingestAuth = await ingestDeps.resolveIngestAuth(req);
  if (!ingestAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      return await handleFile(req, ingestAuth);
    }
    return await handleJson(req, ingestAuth);
  } catch (error) {
    if (error instanceof LockedProjectError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof DeletedExternalItemError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof InvalidProjectError || error instanceof InvalidSourceError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}

async function resolveIngestProjectId(
  ingestAuth: IngestAuth,
  providedProjectId: unknown
): Promise<string> {
  enforceTokenLock(ingestAuth.lockedProjectId, providedProjectId);
  return ingestDeps.requireProjectId(
    ingestAuth.userId,
    ingestAuth.lockedProjectId ?? providedProjectId
  );
}

// The row is fetched by id alone; ownership and project membership are
// decided in verifySourceOwnership so tests can exercise the real check.
async function requireSource(
  userId: string,
  projectId: string,
  sourceId: unknown
): Promise<string | null> {
  if (sourceId == null || sourceId === "") return null;
  if (!isUuid(sourceId)) throw new InvalidSourceError();

  const rows = await ingestDeps.db
    .select({
      id: schema.source.id,
      userId: schema.source.userId,
      projectId: schema.source.projectId,
    })
    .from(schema.source)
    .where(eq(schema.source.id, sourceId))
    .limit(1);
  return verifySourceOwnership(userId, projectId, rows[0]);
}

// A source-attributed item is held for review when the source's active review
// rule matches. Held items are inserted as "review" and never emitted, so they
// gain no chunks and stay out of Ask until approved. Manual capture (no source)
// is never gated.
async function resolveInitialStatus(
  projectId: string,
  sourceId: string | null,
  candidate: ReviewCandidate
): Promise<"pending" | "review"> {
  if (!sourceId) return "pending";
  const config = await ingestDeps.loadReviewRuleConfig(projectId, sourceId);
  return importedItemStatus(config, candidate);
}

async function findDuplicate(
  userId: string,
  sourceId: string | null,
  externalId: string | null
) {
  if (!sourceId || !externalId) return null;
  const rows = await ingestDeps.db
    .select({ id: schema.item.id, status: schema.item.status })
    .from(schema.item)
    .where(
      and(
        eq(schema.item.userId, userId),
        eq(schema.item.sourceId, sourceId),
        eq(schema.item.externalId, externalId)
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

async function handleJson(req: NextRequest, ingestAuth: IngestAuth) {
  type IngestBody = {
    projectId?: string;
    sourceId?: string | null;
    externalId?: string | null;
    type: "text" | "url";
    source?: string;
    text: string;
    capturedAt?: string;
  };

  let body: IngestBody;
  try {
    body = (await req.json()) as IngestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.type !== "text" && body.type !== "url") {
    return NextResponse.json(
      { error: "type must be 'text' or 'url'" },
      { status: 400 }
    );
  }
  if (typeof body.text !== "string" || body.text.trim().length === 0) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  if (body.type === "url" && !isUrl(body.text)) {
    return NextResponse.json(
      { error: "text must be a valid http(s) URL when type is 'url'" },
      { status: 400 }
    );
  }

  const projectId = await resolveIngestProjectId(ingestAuth, body.projectId);
  const sourceId = await requireSource(
    ingestAuth.userId,
    projectId,
    body.sourceId
  );
  const externalId = body.externalId ?? null;
  await assertExternalItemNotDeleted(ingestDeps.db, projectId, sourceId, externalId);

  const duplicate = await findDuplicate(ingestAuth.userId, sourceId, externalId);
  if (duplicate) {
    return NextResponse.json({
      id: duplicate.id,
      status: duplicate.status,
      duplicate: true,
    });
  }

  const rawText = body.type === "text" ? body.text : null;
  const sourceLabel = body.type === "url" ? body.text : body.source ?? null;
  const status = await resolveInitialStatus(projectId, sourceId, {
    source: sourceLabel,
    text: rawText,
  });

  const [item] = await ingestDeps.db
    .insert(schema.item)
    .values({
      userId: ingestAuth.userId,
      projectId,
      sourceId,
      externalId,
      type: body.type,
      rawText,
      source: sourceLabel,
      status,
      ...(body.capturedAt ? { capturedAt: new Date(body.capturedAt) } : {}),
    })
    .returning({ id: schema.item.id });

  if (status === "pending") {
    ingestDeps.inngest.send({ name: "item/captured", data: { itemId: item.id } }).catch((e) =>
      console.warn("[inngest] send failed, item will be processed on next poll:", e?.message)
    );
  }

  return NextResponse.json({ id: item.id, status });
}

async function handleFile(req: NextRequest, ingestAuth: IngestAuth) {
  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: `file too large (max ${MAX_FILE_BYTES / 1024 / 1024}MB)` },
      { status: 413 }
    );
  }

  const kind = classifyFile(file);
  if (!kind) {
    return NextResponse.json(
      { error: `unsupported file type: ${file.type || file.name}` },
      { status: 400 }
    );
  }

  const projectId = await resolveIngestProjectId(
    ingestAuth,
    form.get("projectId")
  );
  const sourceIdField = form.get("sourceId");
  const externalIdField = form.get("externalId");
  const sourceId = await requireSource(
    ingestAuth.userId,
    projectId,
    sourceIdField
  );
  const externalId =
    typeof externalIdField === "string" && externalIdField ? externalIdField : null;
  await assertExternalItemNotDeleted(ingestDeps.db, projectId, sourceId, externalId);

  const duplicate = await findDuplicate(ingestAuth.userId, sourceId, externalId);
  if (duplicate) {
    return NextResponse.json({
      id: duplicate.id,
      status: duplicate.status,
      duplicate: true,
    });
  }

  const { key } = await ingestDeps.storeUpload(
    file.name,
    Buffer.from(await file.arrayBuffer())
  );

  const capturedAtField = form.get("capturedAt");
  const status = await resolveInitialStatus(projectId, sourceId, {
    source: file.name,
    text: null,
  });

  const [item] = await ingestDeps.db
    .insert(schema.item)
    .values({
      userId: ingestAuth.userId,
      projectId,
      sourceId,
      externalId,
      type: kind,
      blobUrl: key,
      source: file.name,
      status,
      ...(typeof capturedAtField === "string" && capturedAtField
        ? { capturedAt: new Date(capturedAtField) }
        : {}),
    })
    .returning({ id: schema.item.id });

  if (status === "pending") {
    ingestDeps.inngest.send({ name: "item/captured", data: { itemId: item.id } }).catch((e) =>
      console.warn("[inngest] send failed, item will be processed on next poll:", e?.message)
    );
  }

  return NextResponse.json({ id: item.id, status, kind });
}
