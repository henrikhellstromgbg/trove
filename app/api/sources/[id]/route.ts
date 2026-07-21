import { NextRequest, NextResponse } from "next/server";
import { InvalidProjectError } from "@/lib/projects";
import {
  InvalidSourceError,
  SourceHasDeletionMarkersError,
} from "@/lib/sources/contracts";
import { sourceDetailDeps } from "./deps";

async function resolveProjectId(
  userId: string,
  provided: unknown
): Promise<string> {
  if (typeof provided !== "string" || provided === "") {
    throw new InvalidProjectError("projectId is required");
  }
  return sourceDetailDeps.requireProjectId(userId, provided);
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { userId } = await sourceDetailDeps.auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const projectIdParam = req.nextUrl.searchParams.get("projectId");

  try {
    const detail = await sourceDetailDeps.getSourceDetail(
      userId,
      id,
      await resolveProjectId(userId, projectIdParam)
    );
    return NextResponse.json(detail);
  } catch (error) {
    if (error instanceof InvalidProjectError || error instanceof InvalidSourceError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { userId } = await sourceDetailDeps.auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const projectIdParam = req.nextUrl.searchParams.get("projectId");

  try {
    await sourceDetailDeps.deleteSource(
      userId,
      id,
      await resolveProjectId(userId, projectIdParam)
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof SourceHasDeletionMarkersError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof InvalidProjectError || error instanceof InvalidSourceError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { userId } = await sourceDetailDeps.auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  let body: { enabled?: unknown; projectId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.enabled !== "boolean") {
    return NextResponse.json(
      { error: "enabled (boolean) is required" },
      { status: 400 }
    );
  }

  try {
    const source = await sourceDetailDeps.setSourceEnabled(
      userId,
      id,
      await resolveProjectId(
        userId,
        body.projectId
      ),
      body.enabled
    );
    return NextResponse.json({ source });
  } catch (error) {
    if (error instanceof InvalidProjectError || error instanceof InvalidSourceError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
