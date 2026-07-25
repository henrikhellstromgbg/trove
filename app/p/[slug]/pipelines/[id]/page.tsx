import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { and, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/lib/db";
import { getProjectBySlug } from "@/lib/projects";
import type { PipelineSpec, PipelineRunOutput } from "@/lib/pipelines/types";
import {
  DataList,
  DataRow,
  EmptyState,
  PageFrame,
  PageHeader,
  SectionHeader,
  StatusIndicator,
  type Status,
} from "@/components/ui";
import { statusLabel } from "@/lib/status-label";
import { DeletePipelineButton } from "./delete-button";
import { RunNowButton } from "./run-now-button";

function runStatus(status: string): Status {
  if (status === "completed") return "success";
  if (status === "running") return "active";
  return "paused";
}

export default async function PipelineDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) return null;

  const { slug, id } = await params;
  const project = await getProjectBySlug(userId, slug);
  if (!project) notFound();

  const base = `/p/${project.slug}`;

  const [pipeline] = await db
    .select()
    .from(schema.pipeline)
    .where(
      and(
        eq(schema.pipeline.id, id),
        eq(schema.pipeline.userId, userId),
        eq(schema.pipeline.projectId, project.id),
      ),
    )
    .limit(1);

  if (!pipeline) {
    return (
      <PageFrame maxWidth="5xl">
        <PageHeader title="Pipeline not found" />
        <EmptyState
          message="That pipeline no longer exists in this project."
          action={
            <Link
              href={`${base}/pipelines`}
              className="text-sm font-medium text-[var(--color-text-primary)] underline underline-offset-2 transition-colors hover:text-[var(--color-brand)]"
            >
              Back to pipelines
            </Link>
          }
        />
      </PageFrame>
    );
  }

  const runs = await db
    .select()
    .from(schema.pipelineRun)
    .where(eq(schema.pipelineRun.pipelineId, pipeline.id))
    .orderBy(desc(schema.pipelineRun.startedAt))
    .limit(10);

  const spec = pipeline.spec as PipelineSpec;

  return (
    <PageFrame maxWidth="5xl">
      <PageHeader
        title={pipeline.name}
        description={
          <span>
            {pipeline.description} · {spec.cron}
          </span>
        }
        action={
          <div className="flex items-center gap-3">
            <RunNowButton id={pipeline.id} />
            <DeletePipelineButton id={pipeline.id} />
          </div>
        }
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="flex flex-col gap-4">
          <SectionHeader title="Recent runs" />
          {runs.length === 0 ? (
            <EmptyState message="No runs yet. The pipeline will fire at the next scheduled time." />
          ) : (
            <DataList>
              {runs.map((run) => (
                <DataRow
                  key={run.id}
                  leading={
                    <span className="font-mono text-sm text-[var(--color-text-tertiary)]">
                      {(run.completedAt ?? run.startedAt).toLocaleString("en-GB")}
                    </span>
                  }
                  trailing={
                    <StatusIndicator
                      status={runStatus(run.status)}
                      label={statusLabel(run.status)}
                    />
                  }
                >
                  {renderRunOutput(run.output as PipelineRunOutput | null)}
                </DataRow>
              ))}
            </DataList>
          )}
        </section>

        <aside className="flex flex-col gap-4 self-start border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-6">
          <SectionHeader title="Spec" />
          <dl className="flex flex-col gap-2 text-sm text-[var(--color-text-secondary)]">
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--color-text-tertiary)]">Name</dt>
              <dd>{spec.name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--color-text-tertiary)]">Cron</dt>
              <dd>{spec.cron}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--color-text-tertiary)]">Output</dt>
              <dd>{spec.outputShape}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--color-text-tertiary)]">Filter</dt>
              <dd className="truncate text-right">
                {spec.filter && Object.keys(spec.filter).length > 0
                  ? JSON.stringify(spec.filter)
                  : "None"}
              </dd>
            </div>
            {pipeline.nextRunAt ? (
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--color-text-tertiary)]">Next</dt>
                <dd>{pipeline.nextRunAt.toISOString().slice(0, 16)}Z</dd>
              </div>
            ) : null}
            {pipeline.lastRunAt ? (
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--color-text-tertiary)]">Last</dt>
                <dd>{pipeline.lastRunAt.toISOString().slice(0, 16)}Z</dd>
              </div>
            ) : null}
          </dl>
          <details className="border-t border-[var(--color-border-subtle)] pt-3 text-sm text-[var(--color-text-secondary)]">
            <summary className="cursor-pointer text-[var(--color-text-tertiary)]">Prompt</summary>
            <pre className="mt-2 whitespace-pre-wrap text-[var(--color-text-secondary)]">{spec.prompt}</pre>
          </details>
        </aside>
      </div>
    </PageFrame>
  );
}

function renderRunOutput(output: PipelineRunOutput | null) {
  if (!output) {
    return <p className="text-sm text-[var(--color-text-tertiary)]">(No output)</p>;
  }

  // Failed runs store { error } instead of a shaped output.
  const maybeError = (output as { error?: string }).error;
  if (maybeError) {
    return <p className="text-sm text-[var(--color-brand)]">Error: {maybeError}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {renderRunOutputBody(output)}
      {output.forgotten ? (
        <div className="mt-1 border-l-2 border-[var(--color-brand)] pl-3">
          <p className="text-sm font-medium text-[var(--color-brand)]">Forgotten</p>
          <p className="text-[var(--color-text-secondary)]">
            {output.forgotten.title ?? "(Untitled)"}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function renderRunOutputBody(output: PipelineRunOutput) {
  if (output.shape === "text") {
    return (
      <p className="whitespace-pre-wrap text-base leading-relaxed text-[var(--color-text-primary)]">
        {output.text}
      </p>
    );
  }

  if (output.shape === "summary_with_highlights") {
    return (
      <div className="flex flex-col gap-3">
        <p className="whitespace-pre-wrap text-base leading-relaxed text-[var(--color-text-primary)]">
          {output.summary}
        </p>
        {output.highlights.length > 0 ? (
          <ul className="flex flex-col gap-1 pl-3 text-sm text-[var(--color-text-secondary)]">
            {output.highlights.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  if (output.shape === "list" && Array.isArray(output.items)) {
    return (
      <ul className="flex flex-col gap-1 text-sm text-[var(--color-text-secondary)]">
        {output.items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    );
  }

  return <p className="text-sm text-[var(--color-text-tertiary)]">(no output)</p>;
}
