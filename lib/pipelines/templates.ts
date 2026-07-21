import { PipelineSpecSchema, type PipelineSpec } from "./types";

export const STARTER_PIPELINE_TEMPLATE_IDS = [
  "morning-brief",
  "weekly-summary",
] as const;

export type StarterPipelineTemplateId =
  (typeof STARTER_PIPELINE_TEMPLATE_IDS)[number];

type StarterPipelineTemplateDefinition = {
  id: StarterPipelineTemplateId;
  title: string;
  pipelineName: string;
  description: string;
  cron: string;
  defaultDeliverByEmail: boolean;
  filter: PipelineSpec["filter"];
  prompt: string;
  outputShape: PipelineSpec["outputShape"];
  retrieval: boolean;
  retrievalQuery?: string;
  includeForgotten?: boolean;
};

const STARTER_PIPELINE_TEMPLATES: Record<
  StarterPipelineTemplateId,
  StarterPipelineTemplateDefinition
> = {
  "morning-brief": {
    id: "morning-brief",
    title: "Morning brief",
    pipelineName: "morning-brief",
    description: "weekday morning brief of what landed in the project over the last day",
    cron: "0 8 * * 1-5",
    defaultDeliverByEmail: false,
    filter: { capturedWithinDays: 1 },
    prompt:
      "Below is a list of items captured in the last day, with titles and short summaries. Write a JSON object for a morning brief that explains what changed, the main themes, and what deserves first attention.\n\n{items}",
    outputShape: "summary_with_highlights",
    retrieval: false,
  },
  "weekly-summary": {
    id: "weekly-summary",
    title: "Friday weekly summary",
    pipelineName: "weekly-digest",
    description: "friday weekly summary of what you saved, plus one forgotten item",
    cron: "0 15 * * 5",
    defaultDeliverByEmail: true,
    filter: { capturedWithinDays: 7 },
    prompt:
      "Below is a list of items you saved this past week, with titles and short summaries. Write a JSON object for a Friday weekly summary reflecting on what you saved.\n\n{items}",
    outputShape: "summary_with_highlights",
    retrieval: false,
    includeForgotten: true,
  },
};

export type StarterPipelineTemplateSummary = {
  id: StarterPipelineTemplateId;
  title: string;
  pipelineName: string;
  description: string;
  cron: string;
  defaultDeliverByEmail: boolean;
};

export type StarterPipelineTemplateBuild = StarterPipelineTemplateSummary & {
  spec: PipelineSpec;
};

export function isStarterPipelineTemplateId(
  value: unknown
): value is StarterPipelineTemplateId {
  return (
    typeof value === "string" &&
    STARTER_PIPELINE_TEMPLATE_IDS.includes(value as StarterPipelineTemplateId)
  );
}

export function listStarterPipelineTemplates(): StarterPipelineTemplateSummary[] {
  return STARTER_PIPELINE_TEMPLATE_IDS.map((id) => {
    const template = STARTER_PIPELINE_TEMPLATES[id];
    return {
      id: template.id,
      title: template.title,
      pipelineName: template.pipelineName,
      description: template.description,
      cron: template.cron,
      defaultDeliverByEmail: template.defaultDeliverByEmail,
    };
  });
}

export function buildStarterPipelineTemplate(
  id: StarterPipelineTemplateId,
  options: { deliverByEmail?: boolean } = {}
): StarterPipelineTemplateBuild {
  const template = STARTER_PIPELINE_TEMPLATES[id];
  const deliverByEmail =
    options.deliverByEmail ?? template.defaultDeliverByEmail;

  const spec = PipelineSpecSchema.parse({
    name: template.pipelineName,
    cron: template.cron,
    filter: template.filter,
    prompt: template.prompt,
    outputShape: template.outputShape,
    deliverByEmail,
    retrieval: template.retrieval,
    retrievalQuery: template.retrievalQuery,
    includeForgotten: template.includeForgotten ?? false,
  });

  return {
    id: template.id,
    title: template.title,
    pipelineName: template.pipelineName,
    description: template.description,
    cron: template.cron,
    defaultDeliverByEmail: template.defaultDeliverByEmail,
    spec,
  };
}

export const STARTER_PIPELINE_NAMES = listStarterPipelineTemplates().map(
  (template) => template.pipelineName
);
