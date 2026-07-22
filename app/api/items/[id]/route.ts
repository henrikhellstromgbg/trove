import { NextRequest, NextResponse } from "next/server";
import { InvalidProjectError } from "@/lib/projects";
import {
  InvalidItemError,
  InvalidItemStateError,
  requireExplicitProjectId,
} from "@/lib/review-or-deletion/contracts";
import { itemRouteDeps } from "../deps";

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { userId } = await itemRouteDeps.auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let projectId: string;
  try {
    projectId = await requireExplicitProjectId(
      userId,
      req.nextUrl.searchParams.get("projectId") ?? undefined,
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
    const result = await itemRouteDeps.permanentlyDeleteItem(userId, projectId, id);
    return NextResponse.json({
      ok: true,
      itemId: result.itemId,
      markerWritten: result.markerWritten,
      blobDeleted: result.blobDeleted,
    });
  } catch (error) {
    if (error instanceof InvalidItemError || error instanceof InvalidItemStateError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}

// Rename (title) and/or retag (tags) an item. projectId travels in the body,
// matching the review/trash POST routes.
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { userId } = await itemRouteDeps.auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { projectId?: unknown; title?: unknown; tags?: unknown };
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
    const item = await itemRouteDeps.editItem(userId, projectId, id, {
      title: body.title,
      tags: body.tags,
    });
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    if (error instanceof InvalidItemError || error instanceof InvalidItemStateError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
