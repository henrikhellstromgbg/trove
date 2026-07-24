import { auth } from "@clerk/nextjs/server";
import { searchItems } from "@/lib/db/search";
import { requireProjectId } from "@/lib/projects";

// Injectable seam for tests (mirrors app/api/ask/deps.ts).
export const searchDeps = {
  auth,
  requireProjectId,
  searchItems,
};
