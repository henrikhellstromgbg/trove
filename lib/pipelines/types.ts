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

export type PipelineRunOutput =
  | { shape: "text"; text: string; forgotten?: PipelineForgotten }
  | {
      shape: "summary_with_highlights";
      summary: string;
      highlights: string[];
      forgotten?: PipelineForgotten;
    }
  | { shape: "list"; items: string[]; forgotten?: PipelineForgotten };
