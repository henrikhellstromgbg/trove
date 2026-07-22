import { NextRequest, NextResponse } from "next/server";
import { InvalidProjectError } from "@/lib/projects";
import {
  InvalidItemError,
  InvalidItemStateError,
  requireExplicitProjectId,
} from "@/lib/review-or-deletion/contracts";
import { itemRouteDeps } from "../../deps";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { userId } = await itemRouteDeps.auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { projectId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let projectId: string;
  try {
    projectId = await requireExplicitProjectId(
      userId,
      body.projectId,
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
    const item = await itemRouteDeps.reprocessItem(userId, projectId, id);
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    if (error instanceof InvalidItemError || error instanceof InvalidItemStateError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
