import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { InvalidProjectError, requireProjectId } from "@/lib/projects";
import { contentTypeForKey, readUploadBuffer } from "@/lib/files";

export const itemBlobDeps = { auth, db, requireProjectId, readUploadBuffer };

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { userId } = await itemBlobDeps.auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const providedProjectId = req.nextUrl.searchParams.get("projectId");
  if (!providedProjectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  let projectId: string;
  try {
    projectId = await itemBlobDeps.requireProjectId(userId, providedProjectId);
  } catch (error) {
    if (error instanceof InvalidProjectError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const [item] = await itemBlobDeps.db
    .select({ blobUrl: schema.item.blobUrl, source: schema.item.source })
    .from(schema.item)
    .where(
      and(
        eq(schema.item.id, id),
        eq(schema.item.userId, userId),
        eq(schema.item.projectId, projectId)
      )
    )
    .limit(1);

  if (!item || !item.blobUrl) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const filename = (item.source ?? "file").replace(/"/g, "");

  // blobUrl now holds a local file key (see lib/files.ts); read it off disk.
  let buffer: Buffer;
  try {
    buffer = await itemBlobDeps.readUploadBuffer(item.blobUrl);
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentTypeForKey(item.blobUrl),
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
