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
});
export type PipelineSpec = z.infer<typeof PipelineSpecSchema>;

export type PipelineRunOutput =
  | { shape: "text"; text: string }
  | { shape: "summary_with_highlights"; summary: string; highlights: string[] }
  | { shape: "list"; items: string[] };
