import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { and, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/lib/db";
import { getProjectBySlug } from "@/lib/projects";

export default async function PipelinesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { userId } = await auth();
  if (!userId) return null;

  const { slug } = await params;
  const project = await getProjectBySlug(userId, slug);
  if (!project) notFound();

  const pipelines = await db
    .select()
    .from(schema.pipeline)
    .where(
      and(
        eq(schema.pipeline.userId, userId),
        eq(schema.pipeline.projectId, project.id)
      )
    )
    .orderBy(desc(schema.pipeline.createdAt));

  const base = `/p/${project.slug}`;

  return (
    <section className="relative mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 pb-16 pt-16 md:px-10">
      <header className="flex items-end justify-between gap-6">
        <div className="flex flex-col gap-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-faint">
            Pipelines
          </p>
          <h1 className="text-3xl font-medium tracking-tight text-ink md:text-4xl">
            Standing instructions.
          </h1>
          <p className="mt-1 max-w-xl text-sm text-ink-dim">
            tell trove what to do, when to do it. it runs while you sleep.
          </p>
        </div>
        <Link
          href={`${base}/pipelines/new`}
          className="shrink-0 rounded-lg border border-line-strong bg-paper px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-ink"
        >
          new pipeline
        </Link>
      </header>

      {pipelines.length === 0 ? (
        <p className="font-mono text-sm text-ink-faint">
          nothing on a schedule yet.
        </p>
      ) : (
        <ul>
          {pipelines.map((p) => (
              <li key={p.id} className="border-b border-line last:border-b-0">
                <Link
                  href={`${base}/pipelines/${p.id}`}
                  className="group grid grid-cols-[8rem,1fr,auto] items-baseline gap-6 px-6 py-5 transition-colors hover:bg-ink/[0.015]"
                >
                  <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
                    {p.cron ?? "manual"}
                  </span>
                  <div className="flex flex-col gap-1">
                    <span className="text-lg font-medium tracking-tight text-ink">
                      {p.name}
                    </span>
                    <span className="text-sm text-ink-dim line-clamp-2">
                      {p.description}
                    </span>
                  </div>
                  <span
                    className={`font-mono text-[10px] uppercase tracking-[0.22em] ${
                      p.enabled ? "text-ink-dim" : "text-ink-ghost"
                    }`}
                  >
                    {p.enabled ? "active" : "paused"}
                  </span>
                </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
