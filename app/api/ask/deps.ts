import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { embedQuery } from "@/lib/ai/embed";
import { requireProjectId } from "@/lib/projects";

export const askDeps = {
  auth,
  db,
  embedQuery,
  requireProjectId,
  anthropic: new Anthropic(),
};
