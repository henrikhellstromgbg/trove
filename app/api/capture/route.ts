import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { put } from "@vercel/blob";
import { db, schema } from "@/lib/db";
import { inngest } from "@/lib/inngest/client";

const MAX_FILE_BYTES = 32 * 1024 * 1024;

type FileKind = "pdf" | "image" | "docx" | "xlsx" | "textfile";

function isUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function classifyFile(file: File): FileKind | null {
  const name = file.name.toLowerCase();
  const mime = (file.type || "").toLowerCase();

  if (mime === "application/pdf" || name.endsWith(".pdf")) return "pdf";

  if (mime === "image/jpeg" || /\.(jpe?g)$/.test(name)) return "image";
  if (mime === "image/png" || name.endsWith(".png")) return "image";
  if (mime === "image/gif" || name.endsWith(".gif")) return "image";
  if (mime === "image/webp" || name.endsWith(".webp")) return "image";

  if (name.endsWith(".docx") || mime.includes("wordprocessingml")) return "docx";
  if (name.endsWith(".xlsx") || mime.includes("spreadsheetml")) return "xlsx";

  if (
    mime.startsWith("text/") ||
    mime === "application/json" ||
    /\.(txt|md|markdown|csv|tsv|json|html|xml|log|yaml|yml)$/.test(name)
  ) {
    return "textfile";
  }

  return null;
}

function contentTypeFor(kind: FileKind, file: File): string {
  if (file.type) return file.type;
  switch (kind) {
    case "pdf":
      return "application/pdf";
    case "image":
      return "image/png";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "textfile":
      return "text/plain";
  }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
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
  type CaptureBody = { type: "text" | "url"; content: string; source?: string };

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

  const [item] = await db
    .insert(schema.item)
    .values({
      userId,
      type: body.type,
      rawText: body.type === "text" ? body.content : null,
      source: body.type === "url" ? body.content : body.source ?? null,
      status: "pending",
    })
    .returning({ id: schema.item.id });

  inngest.send({ name: "item/captured", data: { itemId: item.id } }).catch((e) =>
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

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const blobKey = `${kind}/${userId}/${Date.now()}-${safeName}`;

  const blob = await put(blobKey, file, {
    access: "public",
    contentType: contentTypeFor(kind, file),
  });

  const [item] = await db
    .insert(schema.item)
    .values({
      userId,
      type: kind,
      blobUrl: blob.url,
      source: file.name,
      status: "pending",
    })
    .returning({ id: schema.item.id });

  inngest.send({ name: "item/captured", data: { itemId: item.id } }).catch((e) =>
    console.warn("[inngest] send failed, item will be processed on next poll:", e?.message)
  );

  return NextResponse.json({ id: item.id, status: "pending", kind });
}
