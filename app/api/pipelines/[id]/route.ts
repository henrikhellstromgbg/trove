import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  await db
    .delete(schema.pipeline)
    .where(
      and(eq(schema.pipeline.id, id), eq(schema.pipeline.userId, userId))
    );

  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  let body: { enabled?: unknown };
  try {
    body = (await req.json()) as { enabled?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.enabled !== "boolean") {
    return NextResponse.json(
      { error: "enabled (boolean) is required" },
      { status: 400 }
    );
  }

  await db
    .update(schema.pipeline)
    .set({ enabled: body.enabled })
    .where(
      and(eq(schema.pipeline.id, id), eq(schema.pipeline.userId, userId))
    );

  return NextResponse.json({ ok: true });
}
