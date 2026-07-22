import { NextRequest, NextResponse } from "next/server";
import { InvalidProjectError } from "@/lib/projects";
import { ingestTokenRouteDeps } from "./deps";

// Browser-only (Clerk) management surface for ingest tokens. The tokens
// themselves authenticate the local daemon and other server callers; they are
// minted and revoked here. The plaintext token is returned once, on create.
export async function GET() {
  const { userId } = await ingestTokenRouteDeps.auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tokens = await ingestTokenRouteDeps.listIngestTokens(userId);
  return NextResponse.json({ tokens });
}

export async function POST(req: NextRequest) {
  const { userId } = await ingestTokenRouteDeps.auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { projectId?: unknown; label?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.label != null && typeof body.label !== "string") {
    return NextResponse.json({ error: "label must be a string" }, { status: 400 });
  }

  let projectId: string | null = null;
  if (body.projectId != null && body.projectId !== "") {
    try {
      // A supplied project must exist and be owned; an invalid id is 400, never
      // a silent unlocked token.
      projectId = await ingestTokenRouteDeps.requireProjectId(userId, body.projectId);
    } catch (error) {
      if (error instanceof InvalidProjectError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }
  }

  const created = await ingestTokenRouteDeps.createIngestToken(userId, {
    projectId,
    label: typeof body.label === "string" ? body.label : null,
  });

  return NextResponse.json({
    token: created.token,
    id: created.id,
    projectId: created.projectId,
    label: created.label,
    createdAt: created.createdAt,
  });
}
