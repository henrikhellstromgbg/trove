import { NextRequest, NextResponse } from "next/server";
import { InvalidProjectError } from "@/lib/projects";
import { InvalidSourceError } from "@/lib/sources/contracts";
import { sourceSyncDeps } from "./deps";

export const maxDuration = 60;

async function resolveProjectId(
  userId: string,
  provided: unknown
): Promise<string> {
  if (typeof provided !== "string" || provided === "") {
    throw new InvalidProjectError("projectId is required");
  }
  return sourceSyncDeps.requireProjectId(userId, provided);
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { userId } = await sourceSyncDeps.auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const projectIdParam = req.nextUrl.searchParams.get("projectId");

  try {
    const source = await sourceSyncDeps.getOwnedSource(
      userId,
      id,
      await resolveProjectId(userId, projectIdParam)
    );
    const result = await sourceSyncDeps.runSourceSync(source, "manual");
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof InvalidProjectError || error instanceof InvalidSourceError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
