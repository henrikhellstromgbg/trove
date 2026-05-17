import { auth } from "@clerk/nextjs/server";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

type DigestOutput = {
  summary?: string;
  highlights?: string[];
  forgotten?: {
    itemId: string;
    title: string | null;
    summary: string | null;
  } | null;
};

export default async function DigestPage() {
  const { userId } = await auth();
  if (!userId) return null;

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
        eq(schema.pipeline.name, "weekly-digest"),
        eq(schema.pipelineRun.status, "completed")
      )
    )
    .orderBy(desc(schema.pipelineRun.startedAt))
    .limit(1);

  const run = rows[0];

  return (
    <main className="flex flex-1 flex-col items-center gap-10 px-6 py-10">
      <div className="flex w-full max-w-2xl flex-col gap-2">
        <h1 className="text-2xl">Weekly digest</h1>
        {run ? (
          <p className="text-sm text-black/60">
            {(run.completedAt ?? run.startedAt).toLocaleDateString("en-GB", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        ) : null}
      </div>

      {!run ? (
        <p className="w-full max-w-2xl text-sm text-black/40">
          no digest yet. one runs every sunday at 9am once you have items in trove.
        </p>
      ) : (
        <DigestBody output={run.output as DigestOutput | null} />
      )}
    </main>
  );
}

function DigestBody({ output }: { output: DigestOutput | null }) {
  const summary = output?.summary ?? "";
  const highlights = output?.highlights ?? [];
  const forgotten = output?.forgotten ?? null;

  return (
    <div className="flex w-full max-w-2xl flex-col gap-10">
      {summary ? (
        <section className="flex flex-col gap-3">
          <p className="text-sm text-black/70">{summary}</p>
        </section>
      ) : null}

      {highlights.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl">Highlights</h2>
          <ul className="flex flex-col gap-2">
            {highlights.map((h, i) => (
              <li key={i} className="text-sm text-black/70">
                {h}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {forgotten ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl">Forgotten</h2>
          <div className="flex flex-col gap-1 rounded-md border border-black/5 px-3 py-2">
            <div className="text-sm">
              {forgotten.title ?? "(untitled)"}
            </div>
            {forgotten.summary ? (
              <div className="text-sm text-black/60">{forgotten.summary}</div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
