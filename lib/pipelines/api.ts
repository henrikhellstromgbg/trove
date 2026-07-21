import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import {
  InvalidProjectError,
  normalizeUuid,
  requireProjectId,
} from "@/lib/projects";
import { nextRunFromCron, isCronValid } from "./cron";
import { runPipelineSpec } from "./run";
import {
  PipelineFilterSchema,
  PipelineOutputShapeSchema,
  PipelineSpecSchema,
} from "./types";

const PipelinePatchBodySchema = z
  .object({
    projectId: z.unknown().optional(),
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().min(10).max(2000).optional(),
    cron: z.string().trim().min(7).max(60).optional(),
    filter: PipelineFilterSchema.optional(),
    prompt: z.string().trim().min(10).max(2000).optional(),
    outputShape: PipelineOutputShapeSchema.optional(),
    deliverByEmail: z.boolean().optional(),
    retrieval: z.boolean().optional(),
    retrievalQuery: z.string().trim().min(1).max(300).nullable().optional(),
    includeForgotten: z.boolean().optional(),
    enabled: z.boolean().optional(),
  })
  .strict();

const SPEC_PATCH_KEYS = [
  "name",
  "cron",
  "filter",
  "prompt",
  "outputShape",
  "deliverByEmail",
  "retrieval",
  "retrievalQuery",
  "includeForgotten",
] as const;

type PipelineRow = typeof schema.pipeline.$inferSelect;
type PipelinePatchBody = z.infer<typeof PipelinePatchBodySchema>;

export const pipelineApiDeps = {
  auth,
  db,
  requireProjectId,
  runPipelineSpec,
  now: () => new Date(),
};

export function parsePipelinePatchBody(body: unknown) {
  const parsed = PipelinePatchBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid request body",
    };
  }

  const hasUpdates =
    parsed.data.enabled !== undefined ||
    parsed.data.description !== undefined ||
    SPEC_PATCH_KEYS.some((key) => parsed.data[key] !== undefined);
  if (!hasUpdates) {
    return { ok: false as const, error: "At least one field must be updated" };
  }

  return { ok: true as const, value: parsed.data };
}

export async function requireOwnedProjectId(
  userId: string,
  projectId: unknown,
  requireProjectIdFn: typeof requireProjectId
) {
  if (projectId == null || projectId === "") {
    throw new InvalidProjectError("projectId is required");
  }
  return requireProjectIdFn(userId, projectId);
}

export async function loadOwnedPipeline(
  pipelineId: string,
  userId: string,
  projectId: string,
  database: typeof db
) {
  const rows = await database
    .select()
    .from(schema.pipeline)
    .where(eq(schema.pipeline.id, pipelineId))
    .limit(1);

  return verifyPipelineOwnership(userId, projectId, rows[0]);
}

export function verifyPipelineOwnership(
  userId: string,
  projectId: string,
  row: PipelineRow | undefined
) {
  if (!row) return null;
  if (row.userId !== userId) return null;
  if (normalizeUuid(row.projectId) !== normalizeUuid(projectId)) return null;
  return row;
}

export function buildPipelinePatchUpdate(
  pipeline: PipelineRow,
  patch: PipelinePatchBody,
  now: Date
) {
  const currentSpec = PipelineSpecSchema.safeParse(pipeline.spec);
  if (!currentSpec.success) {
    return { ok: false as const, status: 422, error: "invalid spec" };
  }

  const nextRetrieval = patch.retrieval ?? currentSpec.data.retrieval;
  if (!nextRetrieval && typeof patch.retrievalQuery === "string") {
    return {
      ok: false as const,
      status: 400,
      error: "retrievalQuery requires retrieval to be enabled",
    };
  }

  const nextSpecInput = {
    ...currentSpec.data,
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.cron !== undefined ? { cron: patch.cron } : {}),
    ...(patch.filter !== undefined ? { filter: patch.filter } : {}),
    ...(patch.prompt !== undefined ? { prompt: patch.prompt } : {}),
    ...(patch.outputShape !== undefined
      ? { outputShape: patch.outputShape }
      : {}),
    ...(patch.deliverByEmail !== undefined
      ? { deliverByEmail: patch.deliverByEmail }
      : {}),
    ...(patch.retrieval !== undefined ? { retrieval: patch.retrieval } : {}),
    ...(patch.includeForgotten !== undefined
      ? { includeForgotten: patch.includeForgotten }
      : {}),
    ...(patch.retrievalQuery !== undefined
      ? { retrievalQuery: patch.retrievalQuery ?? undefined }
      : {}),
  };

  if (!isCronValid(nextSpecInput.cron)) {
    return { ok: false as const, status: 400, error: "cron is invalid" };
  }

  if (!nextSpecInput.retrieval) {
    delete nextSpecInput.retrievalQuery;
  }

  const nextSpec = PipelineSpecSchema.safeParse(nextSpecInput);
  if (!nextSpec.success) {
    return {
      ok: false as const,
      status: 400,
      error: nextSpec.error.issues[0]?.message ?? "Invalid pipeline spec",
    };
  }

  const specChanged = SPEC_PATCH_KEYS.some((key) => patch[key] !== undefined);
  const cronChanged = patch.cron !== undefined && patch.cron !== pipeline.cron;

  const update: Record<string, unknown> = {};
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.enabled !== undefined) update.enabled = patch.enabled;

  if (specChanged) {
    update.spec = nextSpec.data;
    update.name = nextSpec.data.name;
    update.cron = nextSpec.data.cron;
  }

  if (cronChanged) {
    update.nextRunAt = nextRunFromCron(nextSpec.data.cron, now);
  }

  return { ok: true as const, value: update };
}
