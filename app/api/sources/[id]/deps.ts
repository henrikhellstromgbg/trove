import { auth } from "@clerk/nextjs/server";
import { requireProjectId } from "@/lib/projects";
import {
  deleteSource,
  getSourceDetail,
  setSourceEnabled,
} from "@/lib/sources/store";

export const sourceDetailDeps = {
  auth,
  requireProjectId,
  getSourceDetail,
  deleteSource,
  setSourceEnabled,
};
