import { resolveIngestAuth } from "@/lib/ingest-auth";
import { updateLocalSourceCursor } from "@/lib/sources/store";

export const localCursorRouteDeps = {
  resolveIngestAuth,
  updateLocalSourceCursor,
};
