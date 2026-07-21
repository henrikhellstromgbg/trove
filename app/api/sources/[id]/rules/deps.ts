import { auth } from "@clerk/nextjs/server";
import { requireProjectId } from "@/lib/projects";
import { addSourceRule } from "@/lib/sources/store";

export const sourceRuleDeps = {
  auth,
  requireProjectId,
  addSourceRule,
};
