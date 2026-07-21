import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray, or } from "drizzle-orm";
import { schema } from "@/lib/db";
import { nextRunFromCron } from "@/lib/pipelines/cron";
import {
  buildStarterPipelineTemplate,
  isStarterPipelineTemplateId,
  listStarterPipelineTemplates,
  STARTER_PIPELINE_NAMES,
  STARTER_PIPELINE_TEMPLATE_IDS,
} from "@/lib/pipelines/templates";
import { InvalidProjectError } from "@/lib/projects";
import { pipelineTemplateDeps } from "./deps";

export async function GET(req: NextRequest) {
  const { userId } = await pipelineTemplateDeps.auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const providedProjectId = req.nextUrl.searchParams.get("projectId");
  if (!providedProjectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  let projectId: string;
  try {
    projectId = await pipelineTemplateDeps.requireProjectId(
      userId,
      providedProjectId
    );
  } catch (error) {
    if (error instanceof InvalidProjectError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const installedRows = await pipelineTemplateDeps.db
    .select({
      id: schema.pipeline.id,
      name: schema.pipeline.name,
      templateKey: schema.pipeline.templateKey,
    })
    .from(schema.pipeline)
    .where(
      and(
        eq(schema.pipeline.userId, userId),
        eq(schema.pipeline.projectId, projectId),
        or(
          inArray(schema.pipeline.templateKey, [...STARTER_PIPELINE_TEMPLATE_IDS]),
          inArray(schema.pipeline.name, STARTER_PIPELINE_NAMES)
        )
      )
    );

  const installedByKey = new Map(
    installedRows.map((row) => [row.templateKey ?? row.name, row.id] as const)
  );

  const templates = listStarterPipelineTemplates().map((template) => ({
    ...template,
    installed:
      installedByKey.has(template.id) ||
      installedByKey.has(template.pipelineName),
    installedPipelineId:
      installedByKey.get(template.id) ??
      installedByKey.get(template.pipelineName) ??
      null,
  }));

  return NextResponse.json({ templates });
}

export async function POST(req: NextRequest) {
  const { userId } = await pipelineTemplateDeps.auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    templateId?: unknown;
    projectId?: unknown;
    deliverByEmail?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isStarterPipelineTemplateId(body.templateId)) {
    return NextResponse.json(
      { error: "templateId must be one of: morning-brief, weekly-summary" },
      { status: 400 }
    );
  }

  if (
    body.deliverByEmail !== undefined &&
    typeof body.deliverByEmail !== "boolean"
  ) {
    return NextResponse.json(
      { error: "deliverByEmail must be a boolean when provided" },
      { status: 400 }
    );
  }

  if (body.projectId == null || body.projectId === "") {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  let projectId: string;
  try {
    projectId = await pipelineTemplateDeps.requireProjectId(
      userId,
      body.projectId
    );
  } catch (error) {
    if (error instanceof InvalidProjectError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const template = buildStarterPipelineTemplate(body.templateId, {
    deliverByEmail: body.deliverByEmail,
  });

  const existing = await pipelineTemplateDeps.db
    .select({ id: schema.pipeline.id })
    .from(schema.pipeline)
    .where(
      and(
        eq(schema.pipeline.userId, userId),
        eq(schema.pipeline.projectId, projectId),
        or(
          eq(schema.pipeline.templateKey, template.id),
          eq(schema.pipeline.name, template.pipelineName)
        )
      )
    )
    .limit(1);

  if (existing[0]) {
    return NextResponse.json({
      created: false,
      pipelineId: existing[0].id,
      template: {
        id: template.id,
        title: template.title,
        pipelineName: template.pipelineName,
      },
    });
  }

  const [row] = await pipelineTemplateDeps.db
    .insert(schema.pipeline)
    .values({
      userId,
      projectId,
      templateKey: template.id,
      name: template.pipelineName,
      description: template.description,
      spec: template.spec,
      cron: template.spec.cron,
      enabled: true,
      nextRunAt: nextRunFromCron(template.spec.cron),
    })
    .onConflictDoNothing()
    .returning({ id: schema.pipeline.id });

  if (!row) {
    const [concurrent] = await pipelineTemplateDeps.db
      .select({ id: schema.pipeline.id })
      .from(schema.pipeline)
      .where(
        and(
          eq(schema.pipeline.userId, userId),
          eq(schema.pipeline.projectId, projectId),
          eq(schema.pipeline.templateKey, template.id)
        )
      )
      .limit(1);
    if (!concurrent) {
      return NextResponse.json(
        { error: "template installation conflicted" },
        { status: 409 }
      );
    }
    return NextResponse.json({
      created: false,
      pipelineId: concurrent.id,
      template: {
        id: template.id,
        title: template.title,
        pipelineName: template.pipelineName,
      },
    });
  }

  return NextResponse.json(
    {
      created: true,
      pipelineId: row.id,
      template: {
        id: template.id,
        title: template.title,
        pipelineName: template.pipelineName,
      },
    },
    { status: 201 }
  );
}
