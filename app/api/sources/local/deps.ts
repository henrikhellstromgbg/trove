import { resolveIngestAuth } from "@/lib/ingest-auth";
import { listLocalSourcesForToken } from "@/lib/sources/store";

export const localSourceRouteDeps = {
  resolveIngestAuth,
  listLocalSourcesForToken,
};
