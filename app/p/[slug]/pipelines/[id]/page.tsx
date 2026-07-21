import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { and, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/lib/db";
import { getProjectBySlug } from "@/lib/projects";
import type { PipelineSpec, PipelineRunOutput } from "@/lib/pipelines/types";
import { DeletePipelineButton } from "./delete-button";
import { RunNowButton } from "./run-now-button";

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
        eq(schema.pipeline.projectId, project.id)
      )
    )
    .limit(1);

  if (!pipeline) {
    return (
      <section className="relative mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 pb-16 pt-16 md:px-10">
        <p className="font-mono text-sm text-ink-faint">pipeline not found.</p>
        <Link
          href={`${base}/pipelines`}
          className="self-start font-mono text-[10px] uppercase tracking-[0.22em] text-ink-dim transition-colors hover:text-ink"
        >
          back to pipelines
        </Link>
      </section>
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
    <section className="relative mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 pb-16 pt-16 md:px-10">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-faint">
            pipeline · {spec.cron}
          </p>
          <Link
            href={`${base}/pipelines`}
            className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint transition-colors hover:text-ink"
          >
            all pipelines
          </Link>
        </div>
        <h1 className="text-3xl font-medium tracking-tight text-ink md:text-4xl">
          {pipeline.name}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-dim">
          {pipeline.description}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr,1fr]">
        <section className="flex flex-col gap-4">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-faint">
            recent runs
          </h2>
          {runs.length === 0 ? (
            <p className="font-mono text-sm text-ink-faint">
              no runs yet. the pipeline will fire at the next scheduled time.
            </p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-line bg-paper shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              <ul>
                {runs.map((run) => (
                  <li
                    key={run.id}
                    className="flex flex-col gap-3 border-b border-line px-6 py-5 last:border-b-0"
                  >
                    <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
                      <span>
                        {(run.completedAt ?? run.startedAt).toLocaleString("en-GB")}
                      </span>
                      <span
                        className={
                          run.status === "completed"
                            ? "text-ink-dim"
                            : run.status === "running"
                            ? "text-brand"
                            : "text-ink-ghost"
                        }
                      >
                        {run.status}
                      </span>
                    </div>
                    <RunOutput output={run.output as PipelineRunOutput | null} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-2 flex items-center justify-between">
            <RunNowButton id={pipeline.id} />
            <DeletePipelineButton id={pipeline.id} />
          </div>
        </section>

        <aside className="flex flex-col gap-4 self-start rounded-2xl border border-line bg-paper p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-faint">
            spec
          </h2>
          <dl className="flex flex-col gap-2 font-mono text-[11px] text-ink-dim">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-ghost">name</dt>
              <dd>{spec.name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-ghost">cron</dt>
              <dd>{spec.cron}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-ghost">output</dt>
              <dd>{spec.outputShape}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-ghost">filter</dt>
              <dd className="truncate text-right">
                {spec.filter && Object.keys(spec.filter).length > 0
                  ? JSON.stringify(spec.filter)
                  : "none"}
              </dd>
            </div>
            {pipeline.nextRunAt ? (
              <div className="flex justify-between gap-4">
                <dt className="text-ink-ghost">next</dt>
                <dd>{pipeline.nextRunAt.toISOString().slice(0, 16)}z</dd>
              </div>
            ) : null}
            {pipeline.lastRunAt ? (
              <div className="flex justify-between gap-4">
                <dt className="text-ink-ghost">last</dt>
                <dd>{pipeline.lastRunAt.toISOString().slice(0, 16)}z</dd>
              </div>
            ) : null}
          </dl>
          <details className="border-t border-line pt-3 font-mono text-[11px] text-ink-dim">
            <summary className="cursor-pointer text-ink-ghost">prompt</summary>
            <pre className="mt-2 whitespace-pre-wrap text-ink-dim">{spec.prompt}</pre>
          </details>
        </aside>
      </div>
    </section>
  );
}

function RunOutput({ output }: { output: PipelineRunOutput | null }) {
  if (!output)
    return <p className="font-mono text-sm text-ink-faint">(no output)</p>;

  return (
    <div className="flex flex-col gap-3">
      <RunOutputBody output={output} />
      {output.forgotten ? (
        <div className="mt-1 border-l-2 border-brand/40 pl-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-brand">
            forgotten
          </p>
          <p className="text-ink-dim">
            {output.forgotten.title ?? "(untitled)"}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function RunOutputBody({ output }: { output: PipelineRunOutput }) {
  if (output.shape === "text") {
    return (
      <p className="whitespace-pre-wrap text-base leading-relaxed text-ink">
        {output.text}
      </p>
    );
  }

  if (output.shape === "summary_with_highlights") {
    return (
      <div className="flex flex-col gap-3">
        <p className="whitespace-pre-wrap text-base leading-relaxed text-ink">
          {output.summary}
        </p>
        {output.highlights.length > 0 ? (
          <ul className="flex flex-col gap-1 pl-3 text-sm text-ink-dim">
            {output.highlights.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-1 text-sm text-ink-dim">
      {output.items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}
