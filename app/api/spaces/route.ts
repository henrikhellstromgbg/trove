import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { name?: unknown; tags?: unknown };
  try {
    body = (await req.json()) as { name?: unknown; tags?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length === 0) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const tags = Array.isArray(body.tags)
    ? body.tags
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
    : [];

  const [row] = await db
    .insert(schema.space)
    .values({ userId, name, tags })
    .returning({ id: schema.space.id });

  return NextResponse.json({ id: row.id });
}
