import { NextRequest, NextResponse } from "next/server";
import { InvalidProjectError } from "@/lib/projects";
import {
  InvalidItemError,
  InvalidItemStateError,
  requireExplicitProjectId,
} from "@/lib/review-or-deletion/contracts";
import { SameProjectMoveError } from "@/lib/items/move";
import { itemRouteDeps } from "../../deps";

// Move a manual item, or copy a source-attributed one, into another project the
// user owns. The destination is required and explicit (no inbox default), and
// is validated as owned before the item is touched.
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { userId } = await itemRouteDeps.auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { toProjectId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let toProjectId: string;
  try {
    toProjectId = await requireExplicitProjectId(
      userId,
      body.toProjectId,
      itemRouteDeps.requireProjectId
    );
  } catch (error) {
    if (error instanceof InvalidProjectError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const { id } = await ctx.params;

  try {
    const result = await itemRouteDeps.moveItemToProject(userId, id, toProjectId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof InvalidItemError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof InvalidItemStateError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof SameProjectMoveError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
