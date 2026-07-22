import { NextRequest, NextResponse } from "next/server";
import { InvalidIngestTokenError } from "@/lib/ingest-tokens";
import { ingestTokenRouteDeps } from "../deps";

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { userId } = await ingestTokenRouteDeps.auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  try {
    const result = await ingestTokenRouteDeps.revokeIngestToken(userId, id);
    return NextResponse.json({ ok: true, id: result.id, revokedAt: result.revokedAt });
  } catch (error) {
    if (error instanceof InvalidIngestTokenError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}
