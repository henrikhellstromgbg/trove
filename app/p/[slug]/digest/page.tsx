import { auth } from "@clerk/nextjs/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/lib/db";
import { getProjectBySlug } from "@/lib/projects";
import {
  PIPELINE_RUN_COMPLETED,
  PIPELINE_RUN_DELIVERY_ERROR,
} from "@/lib/pipelines/types";
import { WEEKLY_DIGEST_TEMPLATE_ID } from "@/lib/pipelines/templates";

type DigestOutput = {
  summary?: string;
  highlights?: string[];
  forgotten?: {
    itemId: string;
    title: string | null;
    summary: string | null;
  } | null;
};

export default async function DigestPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { userId } = await auth();
  if (!userId) return null;

  const { slug } = await params;
  const project = await getProjectBySlug(userId, slug);
  if (!project) notFound();

  const rows = await db
    .select({
      runId: schema.pipelineRun.id,
      output: schema.pipelineRun.output,
      startedAt: schema.pipelineRun.startedAt,
      completedAt: schema.pipelineRun.completedAt,
    })
    .from(schema.pipelineRun)
    .innerJoin(
      schema.pipeline,
      eq(schema.pipelineRun.pipelineId, schema.pipeline.id)
    )
    .where(
      and(
        eq(schema.pipelineRun.userId, userId),
        eq(schema.pipeline.userId, userId),
        eq(schema.pipeline.projectId, project.id),
        eq(schema.pipeline.templateKey, WEEKLY_DIGEST_TEMPLATE_ID),
        // A digest whose email failed is still a completed report and must show.
        inArray(schema.pipelineRun.status, [
          PIPELINE_RUN_COMPLETED,
          PIPELINE_RUN_DELIVERY_ERROR,
        ])
      )
    )
    .orderBy(desc(schema.pipelineRun.startedAt))
    .limit(1);

  const run = rows[0];
  const output = run?.output as DigestOutput | null;

  const dateLabel = run
    ? (run.completedAt ?? run.startedAt).toLocaleDateString("en-GB", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <section className="relative flex flex-col gap-14 px-6 pb-12 pt-16 md:px-12 md:pt-24 lg:px-20">
      <header className="flex flex-col gap-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-faint">
          weekly digest {dateLabel ? `· ${dateLabel}` : ""}
        </p>
        <h1 className="font-display text-5xl leading-[1.02] tracking-tight md:text-7xl">
          the week, in slow focus.
        </h1>
      </header>

      {!run ? (
        <p className="max-w-xl font-display text-2xl italic text-ink-faint">
          no digest yet. one runs every sunday at 9am, once trove has things to
          chew on.
        </p>
      ) : (
        <DigestBody output={output} />
      )}
    </section>
  );
}

function DigestBody({ output }: { output: DigestOutput | null }) {
  const summary = output?.summary ?? "";
  const highlights = output?.highlights ?? [];
  const forgotten = output?.forgotten ?? null;

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[2fr,1fr]">
      <div className="flex flex-col gap-12">
        {summary ? (
          <section className="glass rounded-3xl p-8 md:p-10">
            <p className="font-display text-2xl leading-snug text-ink md:text-3xl">
              {summary}
            </p>
          </section>
        ) : null}

        {highlights.length > 0 ? (
          <section className="flex flex-col gap-4">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-faint">
              highlights
            </h2>
            <ol className="flex flex-col">
              {highlights.map((h, i) => (
                <li
                  key={i}
                  className="flex items-start gap-6 border-b border-line py-5 last:border-b-0"
                >
                  <span className="font-mono text-[11px] text-ink-ghost">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p className="flex-1 font-display text-xl leading-snug text-ink">
                    {h}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </div>

      {forgotten ? (
        <aside className="glass-soft flex flex-col gap-3 self-start rounded-3xl p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-ember">
            forgotten
          </p>
          <p className="font-display text-2xl italic leading-snug text-ink">
            {forgotten.title ?? "(untitled)"}
          </p>
          {forgotten.summary ? (
            <p className="text-sm leading-relaxed text-ink-dim">
              {forgotten.summary}
            </p>
          ) : null}
        </aside>
      ) : null}
    </div>
  );
}
