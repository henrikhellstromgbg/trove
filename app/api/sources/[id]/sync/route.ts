import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { syncSource, recordSyncResult } from "@/lib/sources/sync";

export const maxDuration = 60;

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const [source] = await db
    .select()
    .from(schema.source)
    .where(and(eq(schema.source.id, id), eq(schema.source.userId, userId)))
    .limit(1);

  if (!source) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const result = await syncSource(source);
  await recordSyncResult(source.id, result, source.cron);

  return NextResponse.json(result);
}
