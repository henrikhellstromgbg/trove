import { auth } from "@clerk/nextjs/server";
import { requireProjectId } from "@/lib/projects";
import {
  createIngestToken,
  listIngestTokens,
  revokeIngestToken,
} from "@/lib/ingest-tokens";

export const ingestTokenRouteDeps = {
  auth,
  requireProjectId,
  createIngestToken,
  listIngestTokens,
  revokeIngestToken,
};
