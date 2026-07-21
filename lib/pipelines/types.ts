import { z } from "zod";

export const itemTypes = [
  "text",
  "url",
  "pdf",
  "image",
  "docx",
  "xlsx",
  "textfile",
] as const;

export const PipelineFilterSchema = z.object({
  types: z.array(z.enum(itemTypes)).optional(),
  tagsAny: z.array(z.string().min(1).max(60)).max(10).optional(),
  capturedWithinDays: z.number().int().min(1).max(365).optional(),
  contains: z.string().min(1).max(120).optional(),
});
export type PipelineFilter = z.infer<typeof PipelineFilterSchema>;

export const PipelineOutputShapeSchema = z.enum([
  "text",
  "summary_with_highlights",
  "list",
]);
export type PipelineOutputShape = z.infer<typeof PipelineOutputShapeSchema>;

export const PipelineSpecSchema = z.object({
  name: z.string().min(1).max(120),
  cron: z.string().min(7).max(60),
  filter: PipelineFilterSchema,
  prompt: z.string().min(10).max(2000),
  outputShape: PipelineOutputShapeSchema,
  deliverByEmail: z.boolean().default(false),
  // When true, reason over full chunk text via vector retrieval instead of
  // just title/summary/tags. retrievalQuery defaults to `prompt` when unset.
  retrieval: z.boolean().default(false),
  retrievalQuery: z.string().min(1).max(300).optional(),
  // Attach one random item older than 30 days, for serendipity. Used by the
  // seeded weekly-digest pipeline; any pipeline can opt in.
  includeForgotten: z.boolean().default(false),
});
export type PipelineSpec = z.infer<typeof PipelineSpecSchema>;

export type PipelineForgotten = {
  itemId: string;
  title: string | null;
  summary: string | null;
} | null;

// Email delivery outcome, persisted with the run output so a failed send is
// recorded explicitly and never silently counted as a successful delivery.
export type PipelineDelivery = {
  attempted: boolean;
  status: "sent" | "failed" | "skipped";
  recipient: string | null;
  error?: string;
  at?: string;
};

export type PipelineRunOutput =
  | {
      shape: "text";
      text: string;
      forgotten?: PipelineForgotten;
      delivery?: PipelineDelivery;
    }
  | {
      shape: "summary_with_highlights";
      summary: string;
      highlights: string[];
      forgotten?: PipelineForgotten;
      delivery?: PipelineDelivery;
    }
  | {
      shape: "list";
      items: string[];
      forgotten?: PipelineForgotten;
      delivery?: PipelineDelivery;
    };

export const PIPELINE_RUN_COMPLETED = "completed";
export const PIPELINE_RUN_DELIVERY_ERROR = "completed_with_delivery_error";

// The report is always stored, so a run whose generation succeeded is
// "completed"; a failed email downgrades it to a distinct, non-silent status
// while keeping the report itself intact and visible.
export function runStatusForOutput(output: {
  delivery?: PipelineDelivery;
}): string {
  return output.delivery?.status === "failed"
    ? PIPELINE_RUN_DELIVERY_ERROR
    : PIPELINE_RUN_COMPLETED;
}
