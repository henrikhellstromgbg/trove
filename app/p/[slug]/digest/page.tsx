import { auth } from "@clerk/nextjs/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/lib/db";
import { getProjectBySlug } from "@/lib/projects";
import {
  EmptyState,
  PageFrame,
  PageHeader,
  SectionHeader,
  DataList,
  DataRow,
} from "@/app/components/ui";
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
      eq(schema.pipelineRun.pipelineId, schema.pipeline.id),
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
        ]),
      ),
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
    <PageFrame maxWidth="5xl">
      <PageHeader
        title="Digest"
        description={
          dateLabel ? (
            <span>Weekly digest for {dateLabel}.</span>
          ) : (
            <span>The weekly digest shows the latest completed report.</span>
          )
        }
      />

      {!run ? (
        <EmptyState message="No digest yet. One runs every Sunday at 09:00, once Trove has things to chew on." />
      ) : (
        <DigestBody output={output} />
      )}
    </PageFrame>
  );
}

function DigestBody({ output }: { output: DigestOutput | null }) {
  const summary = output?.summary ?? "";
  const highlights = output?.highlights ?? [];
  const forgotten = output?.forgotten ?? null;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex flex-col gap-8">
        {summary ? (
          <section className="flex flex-col gap-3">
            <SectionHeader title="Summary" />
            <div className="border border-line bg-paper p-6">
              <p className="text-2xl leading-snug text-ink md:text-[28px]">
                {summary}
              </p>
            </div>
          </section>
        ) : null}

        {highlights.length > 0 ? (
          <section className="flex flex-col gap-3">
            <SectionHeader title="Highlights" />
            <DataList>
              {highlights.map((highlight, index) => (
                <DataRow
                  key={index}
                  leading={
                    <span className="font-mono text-xs text-ink-faint">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  }
                >
                  <p className="text-base leading-relaxed text-ink">
                    {highlight}
                  </p>
                </DataRow>
              ))}
            </DataList>
          </section>
        ) : null}
      </div>

      {forgotten ? (
        <aside className="flex flex-col gap-3">
          <SectionHeader title="Forgotten" />
          <div className="border border-line bg-paper p-6">
            <p className="text-2xl italic leading-snug text-ink">
              {forgotten.title ?? "(untitled)"}
            </p>
            {forgotten.summary ? (
              <p className="mt-3 text-sm leading-relaxed text-ink-dim">
                {forgotten.summary}
              </p>
            ) : null}
          </div>
        </aside>
      ) : null}
    </div>
  );
}
