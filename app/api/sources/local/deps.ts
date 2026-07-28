import { resolveIngestAuth } from "@/lib/ingest-auth";
import {
  claimDueLocalSources,
  listLocalSourcesForToken,
} from "@/lib/sources/store";

export const localSourceRouteDeps = {
  resolveIngestAuth,
  claimDueLocalSources,
  listLocalSourcesForToken,
};
