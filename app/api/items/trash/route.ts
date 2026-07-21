import { NextRequest, NextResponse } from "next/server";
import { InvalidProjectError } from "@/lib/projects";
import {
  InvalidItemError,
  InvalidItemStateError,
  requireExplicitProjectId,
} from "@/lib/review-or-deletion/contracts";
import { itemRouteDeps } from "../deps";

export async function GET(req: NextRequest) {
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

  const items = await itemRouteDeps.listTrashItems(userId, projectId);
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const { userId } = await itemRouteDeps.auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { projectId?: unknown; itemId?: unknown };
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

  try {
    const result = await itemRouteDeps.moveItemToTrash(userId, projectId, body.itemId);
    return NextResponse.json({ ok: true, item: result.item });
  } catch (error) {
    if (error instanceof InvalidItemError || error instanceof InvalidItemStateError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
