import { NextRequest, NextResponse } from "next/server";
import { InvalidSourceError } from "@/lib/sources/contracts";
import { localCursorRouteDeps } from "./deps";

// Cursor write-back for the local daemon. Token-authenticated (server-to-server);
// a project-locked token can only move a source in its own project. Persisting
// the cursor here lets local-runtime idempotence survive across machines.
export async function POST(req: NextRequest) {
  const auth = await localCursorRouteDeps.resolveIngestAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const sourceId =
    body && typeof body === "object" && "sourceId" in body
      ? (body as { sourceId: unknown }).sourceId
      : undefined;
  if (typeof sourceId !== "string" || sourceId.trim() === "") {
    return NextResponse.json({ error: "sourceId is required" }, { status: 400 });
  }

  const cursor =
    body && typeof body === "object" && "cursor" in body
      ? (body as { cursor: unknown }).cursor
      : undefined;
  if (cursor === undefined) {
    return NextResponse.json({ error: "cursor is required" }, { status: 400 });
  }

  try {
    const updated = await localCursorRouteDeps.updateLocalSourceCursor(
      auth.userId,
      sourceId,
      cursor,
      auth.lockedProjectId
    );
    return NextResponse.json({ id: updated.id, cursor: updated.cursor });
  } catch (err) {
    if (err instanceof InvalidSourceError) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }
    throw err;
  }
}
