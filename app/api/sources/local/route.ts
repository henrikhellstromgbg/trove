import { NextRequest, NextResponse } from "next/server";
import { toLocalSourcePayload } from "@/lib/sources/contracts";
import { localSourceRouteDeps } from "./deps";

// Server-driven registry for the local daemon. Token-authenticated (the daemon
// is a server-to-server caller); a project-locked token sees only its project's
// local sources. The response is flattened to match the daemon's registry shape.
//
// Default (the daemon's timer poll) returns only sources due now and advances
// each one's nextRunAt, so per-source cron actually governs when a local source
// runs. `?all=1` (the tray "Sync now") returns every enabled local source
// without touching the schedule, so a manual sync always forces a run.
export async function GET(req: NextRequest) {
  const auth = await localSourceRouteDeps.resolveIngestAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const forceAll = req.nextUrl.searchParams.get("all") === "1";

  const rows = forceAll
    ? await localSourceRouteDeps.listLocalSourcesForToken(
        auth.userId,
        auth.lockedProjectId
      )
    : await localSourceRouteDeps.claimDueLocalSources(
        auth.userId,
        auth.lockedProjectId
      );

  return NextResponse.json({ sources: rows.map(toLocalSourcePayload) });
}
