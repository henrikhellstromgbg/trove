import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { requireProjectId } from "@/lib/projects";

export const pipelineTemplateDeps = { auth, db, requireProjectId };
