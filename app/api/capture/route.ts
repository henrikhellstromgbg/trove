import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@/lib/db";
import { inngest } from "@/lib/inngest/client";

type CaptureBody = {
  type: "text" | "url";
  content: string;
  source?: string;
};

function isUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CaptureBody;
  try {
    body = (await req.json()) as CaptureBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.type !== "text" && body.type !== "url") {
    return NextResponse.json({ error: "type must be 'text' or 'url'" }, { status: 400 });
  }

  if (typeof body.content !== "string" || body.content.trim().length === 0) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  if (body.type === "url" && !isUrl(body.content)) {
    return NextResponse.json({ error: "content must be a valid http(s) URL" }, { status: 400 });
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

  await inngest.send({
    name: "item/captured",
    data: { itemId: item.id },
  });

  return NextResponse.json({ id: item.id, status: "pending" });
}
