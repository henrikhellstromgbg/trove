import { NextRequest, NextResponse } from "next/server";
import { schema } from "@/lib/db";
import { InvalidProjectError } from "@/lib/projects";
import { MAX_FILE_BYTES, classifyFile, isUrl } from "@/lib/capture";
import { captureDeps } from "./deps";

export async function POST(req: NextRequest) {
  const { userId } = await captureDeps.auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    return handleFile(req, userId);
  }
  return handleJson(req, userId);
}

async function handleJson(req: NextRequest, userId: string) {
  type CaptureBody = {
    type: "text" | "url";
    content: string;
    source?: string;
    projectId?: string;
  };

  let body: CaptureBody;
  try {
    body = (await req.json()) as CaptureBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.type !== "text" && body.type !== "url") {
    return NextResponse.json(
      { error: "type must be 'text' or 'url'" },
      { status: 400 }
    );
  }
  if (typeof body.content !== "string" || body.content.trim().length === 0) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }
  if (body.type === "url" && !isUrl(body.content)) {
    return NextResponse.json(
      { error: "content must be a valid http(s) URL" },
      { status: 400 }
    );
  }

  let projectId: string;
  try {
    projectId = await captureDeps.requireProjectId(userId, body.projectId);
  } catch (error) {
    if (error instanceof InvalidProjectError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const [item] = await captureDeps.db
    .insert(schema.item)
    .values({
      userId,
      projectId,
      type: body.type,
      rawText: body.type === "text" ? body.content : null,
      source: body.type === "url" ? body.content : body.source ?? null,
      status: "pending",
    })
    .returning({ id: schema.item.id });

  captureDeps.inngest.send({ name: "item/captured", data: { itemId: item.id } }).catch((e) =>
    console.warn("[inngest] send failed, item will be processed on next poll:", e?.message)
  );

  return NextResponse.json({ id: item.id, status: "pending" });
}

async function handleFile(req: NextRequest, userId: string) {
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

  const providedProjectId = form.get("projectId");
  let projectId: string;
  try {
    projectId = await captureDeps.requireProjectId(userId, providedProjectId);
  } catch (error) {
    if (error instanceof InvalidProjectError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const { key } = await captureDeps.storeUpload(
    file.name,
    Buffer.from(await file.arrayBuffer())
  );

  const [item] = await captureDeps.db
    .insert(schema.item)
    .values({
      userId,
      projectId,
      type: kind,
      blobUrl: key,
      source: file.name,
      status: "pending",
    })
    .returning({ id: schema.item.id });

  captureDeps.inngest.send({ name: "item/captured", data: { itemId: item.id } }).catch((e) =>
    console.warn("[inngest] send failed, item will be processed on next poll:", e?.message)
  );

  return NextResponse.json({ id: item.id, status: "pending", kind });
}
