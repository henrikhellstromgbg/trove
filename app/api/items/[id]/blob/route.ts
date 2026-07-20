import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const [item] = await db
    .select({ blobUrl: schema.item.blobUrl, source: schema.item.source })
    .from(schema.item)
    .where(and(eq(schema.item.id, id), eq(schema.item.userId, userId)))
    .limit(1);

  if (!item || !item.blobUrl) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const upstream = await fetch(item.blobUrl);
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${(item.source ?? "file").replace(/"/g, "")}"`,
    },
  });
}
