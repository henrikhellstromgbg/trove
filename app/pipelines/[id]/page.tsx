import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { PipelineSpec, PipelineRunOutput } from "@/lib/pipelines/types";
import { DeletePipelineButton } from "./delete-button";

export default async function PipelineDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) return null;

  const { id } = await params;

  const [pipeline] = await db
    .select()
    .from(schema.pipeline)
    .where(
      and(eq(schema.pipeline.id, id), eq(schema.pipeline.userId, userId))
    )
    .limit(1);

  if (!pipeline) {
    return (
      <main className="flex flex-1 flex-col items-center gap-4 px-6 py-10">
        <p className="text-sm text-black/40">Pipeline not found.</p>
        <Link href="/pipelines" className="text-sm underline">
          back to pipelines
        </Link>
      </main>
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
    <main className="flex flex-1 flex-col items-center gap-10 px-6 py-10">
      <div className="flex w-full max-w-2xl flex-col gap-2">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-2xl">{pipeline.name}</h1>
          <Link href="/pipelines" className="text-sm text-black/50 hover:text-black">
            all pipelines
          </Link>
        </div>
        <p className="text-sm text-black/60">{pipeline.description}</p>
      </div>

      <section className="flex w-full max-w-2xl flex-col gap-3 rounded-md border border-black/5 px-4 py-3 text-sm">
        <h2 className="text-xs uppercase tracking-wider text-black/40">Spec</h2>
        <div className="flex flex-col gap-1 font-mono text-xs text-black/60">
          <div>name: {spec.name}</div>
          <div>cron: {spec.cron}</div>
          <div>output: {spec.outputShape}</div>
          {spec.filter && Object.keys(spec.filter).length > 0 ? (
            <div>filter: {JSON.stringify(spec.filter)}</div>
          ) : (
            <div>filter: none</div>
          )}
          {pipeline.nextRunAt ? (
            <div>next: {pipeline.nextRunAt.toISOString()}</div>
          ) : null}
          {pipeline.lastRunAt ? (
            <div>last: {pipeline.lastRunAt.toISOString()}</div>
          ) : null}
        </div>
        <details className="text-xs text-black/60">
          <summary className="cursor-pointer text-black/40">prompt</summary>
          <pre className="mt-2 whitespace-pre-wrap font-mono">{spec.prompt}</pre>
        </details>
      </section>

      <section className="flex w-full max-w-2xl flex-col gap-3">
        <h2 className="text-xs uppercase tracking-wider text-black/40">
          Recent runs
        </h2>
        {runs.length === 0 ? (
          <p className="text-sm text-black/40">
            No runs yet. The pipeline will fire at the next scheduled time.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {runs.map((run) => (
              <li
                key={run.id}
                className="flex flex-col gap-2 rounded-md border border-black/5 px-3 py-2"
              >
                <div className="flex items-center justify-between text-xs text-black/40">
                  <span>
                    {(run.completedAt ?? run.startedAt).toLocaleString("en-GB")}
                  </span>
                  <span>{run.status}</span>
                </div>
                <RunOutput output={run.output as PipelineRunOutput | null} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex w-full max-w-2xl">
        <DeletePipelineButton id={pipeline.id} />
      </div>
    </main>
  );
}

function RunOutput({ output }: { output: PipelineRunOutput | null }) {
  if (!output) return <p className="text-sm text-black/40">(no output)</p>;

  if (output.shape === "text") {
    return (
      <p className="whitespace-pre-wrap text-sm text-black/70">{output.text}</p>
    );
  }

  if (output.shape === "summary_with_highlights") {
    return (
      <div className="flex flex-col gap-2 text-sm text-black/70">
        <p className="whitespace-pre-wrap">{output.summary}</p>
        {output.highlights.length > 0 ? (
          <ul className="flex flex-col gap-1 pl-3 text-black/60">
            {output.highlights.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-1 text-sm text-black/70">
      {output.items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}
