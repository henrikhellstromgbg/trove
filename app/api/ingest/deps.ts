import { put } from "@vercel/blob";
import { db } from "@/lib/db";
import { inngest } from "@/lib/inngest/client";
import { resolveIngestAuth } from "@/lib/ingest-auth";
import { requireProjectId } from "@/lib/projects";

export const ingestDeps = { put, db, inngest, resolveIngestAuth, requireProjectId };
