import { storeUpload } from "@/lib/files";
import { db } from "@/lib/db";
import { inngest } from "@/lib/inngest/client";
import { resolveIngestAuth } from "@/lib/ingest-auth";
import { requireProjectId } from "@/lib/projects";
import { loadActiveReviewRuleConfig } from "@/lib/sources/sync";
import type { ReviewRuleConfig } from "@/lib/sources/review-rules";

export const ingestDeps = {
  storeUpload,
  db,
  inngest,
  resolveIngestAuth,
  requireProjectId,
  loadReviewRuleConfig: (
    projectId: string,
    sourceId: string
  ): Promise<ReviewRuleConfig | null> =>
    loadActiveReviewRuleConfig(db, sourceId, projectId),
};
