import { NextRequest, NextResponse } from "next/server";
import { InvalidProjectError } from "@/lib/projects";
import {
  InvalidItemError,
  InvalidItemStateError,
  InvalidReviewDecisionError,
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

  const items = await itemRouteDeps.listReviewItems(userId, projectId);
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const { userId } = await itemRouteDeps.auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    projectId?: unknown;
    itemId?: unknown;
    decision?: unknown;
    note?: unknown;
  };
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

  if (body.note != null && typeof body.note !== "string") {
    return NextResponse.json({ error: "note must be a string" }, { status: 400 });
  }

  try {
    const result = await itemRouteDeps.applyReviewDecision(
      userId,
      projectId,
      body.itemId,
      body.decision,
      body.note ?? null
    );
    return NextResponse.json({
      ok: true,
      item: result.item,
      decision: {
        id: result.decision.id,
        decision: result.decision.decision,
        decidedAt: result.decision.decidedAt,
      },
    });
  } catch (error) {
    if (
      error instanceof InvalidItemError ||
      error instanceof InvalidItemStateError ||
      error instanceof InvalidReviewDecisionError
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
