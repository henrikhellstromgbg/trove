import { auth } from "@clerk/nextjs/server";
import { requireProjectId } from "@/lib/projects";
import { createSource, listSources } from "@/lib/sources/store";

export const sourceDeps = {
  auth,
  requireProjectId,
  listSources,
  createSource,
};
