import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { get } from "@vercel/blob";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

// Legacy items live in the old public store (plain fetch works). New
// uploads go to the private store and need an authenticated get().
const PRIVATE_HOST_MARKER = ".private.blob.vercel-storage.com";

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

  const filename = (item.source ?? "file").replace(/"/g, "");

  if (item.blobUrl.includes(PRIVATE_HOST_MARKER)) {
    const result = await get(item.blobUrl, {
      access: "private",
      token: process.env.PRIVATE_BLOB_READ_WRITE_TOKEN,
    });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return new NextResponse(result.stream, {
      headers: {
        "Content-Type": result.blob.contentType,
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
  }

  const upstream = await fetch(item.blobUrl);
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
