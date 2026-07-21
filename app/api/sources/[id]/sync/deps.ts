import { auth } from "@clerk/nextjs/server";
import { requireProjectId } from "@/lib/projects";
import { getOwnedSource } from "@/lib/sources/store";
import { runSourceSync } from "@/lib/sources/sync";

export const sourceSyncDeps = {
  auth,
  requireProjectId,
  getOwnedSource,
  runSourceSync,
};
