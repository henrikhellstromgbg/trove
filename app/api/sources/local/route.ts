import { NextRequest, NextResponse } from "next/server";
import { toLocalSourcePayload } from "@/lib/sources/contracts";
import { localSourceRouteDeps } from "./deps";

// Server-driven registry for the local daemon. Token-authenticated (the daemon
// is a server-to-server caller); a project-locked token sees only its project's
// local sources. The response is flattened to match the daemon's registry shape.
export async function GET(req: NextRequest) {
  const auth = await localSourceRouteDeps.resolveIngestAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await localSourceRouteDeps.listLocalSourcesForToken(
    auth.userId,
    auth.lockedProjectId
  );

  return NextResponse.json({ sources: rows.map(toLocalSourcePayload) });
}
