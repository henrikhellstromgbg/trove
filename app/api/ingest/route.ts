import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { inngest } from "@/lib/inngest/client";
import { resolveProjectId } from "@/lib/projects";
import { resolveIngestAuth, IngestAuth } from "@/lib/ingest-auth";
import { MAX_FILE_BYTES, classifyFile, contentTypeFor, isUrl } from "@/lib/capture";

// The capture seam: one endpoint, two auth modes (Clerk session for the
// browser, ingest token for the local daemon and other server callers).
// See docs/architecture-v2.md.
export async function POST(req: NextRequest) {
  const ingestAuth = await resolveIngestAuth(req);
  if (!ingestAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    return handleFile(req, ingestAuth);
  }
  return handleJson(req, ingestAuth);
}

async function findDuplicate(
  userId: string,
  sourceId: string | null,
  externalId: string | null
) {
  if (!sourceId || !externalId) return null;
  const rows = await db
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

  const sourceId = body.sourceId ?? null;
  const externalId = body.externalId ?? null;

  const duplicate = await findDuplicate(ingestAuth.userId, sourceId, externalId);
  if (duplicate) {
    return NextResponse.json({
      id: duplicate.id,
      status: duplicate.status,
      duplicate: true,
    });
  }

  const projectId = await resolveProjectId(
    ingestAuth.userId,
    body.projectId ?? ingestAuth.defaultProjectId
  );

  const [item] = await db
    .insert(schema.item)
    .values({
      userId: ingestAuth.userId,
      projectId,
      sourceId,
      externalId,
      type: body.type,
      rawText: body.type === "text" ? body.text : null,
      source: body.type === "url" ? body.text : body.source ?? null,
      status: "pending",
      ...(body.capturedAt ? { capturedAt: new Date(body.capturedAt) } : {}),
    })
    .returning({ id: schema.item.id });

  inngest.send({ name: "item/captured", data: { itemId: item.id } }).catch((e) =>
    console.warn("[inngest] send failed, item will be processed on next poll:", e?.message)
  );

  return NextResponse.json({ id: item.id, status: "pending" });
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

  const sourceIdField = form.get("sourceId");
  const externalIdField = form.get("externalId");
  const sourceId = typeof sourceIdField === "string" && sourceIdField ? sourceIdField : null;
  const externalId =
    typeof externalIdField === "string" && externalIdField ? externalIdField : null;

  const duplicate = await findDuplicate(ingestAuth.userId, sourceId, externalId);
  if (duplicate) {
    return NextResponse.json({
      id: duplicate.id,
      status: duplicate.status,
      duplicate: true,
    });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const blobKey = `${kind}/${ingestAuth.userId}/${Date.now()}-${safeName}`;

  const blob = await put(blobKey, file, {
    access: "public",
    contentType: contentTypeFor(kind, file),
  });

  const projectIdField = form.get("projectId");
  const projectId = await resolveProjectId(
    ingestAuth.userId,
    (typeof projectIdField === "string" ? projectIdField : null) ??
      ingestAuth.defaultProjectId
  );

  const capturedAtField = form.get("capturedAt");

  const [item] = await db
    .insert(schema.item)
    .values({
      userId: ingestAuth.userId,
      projectId,
      sourceId,
      externalId,
      type: kind,
      blobUrl: blob.url,
      source: file.name,
      status: "pending",
      ...(typeof capturedAtField === "string" && capturedAtField
        ? { capturedAt: new Date(capturedAtField) }
        : {}),
    })
    .returning({ id: schema.item.id });

  inngest.send({ name: "item/captured", data: { itemId: item.id } }).catch((e) =>
    console.warn("[inngest] send failed, item will be processed on next poll:", e?.message)
  );

  return NextResponse.json({ id: item.id, status: "pending", kind });
}
