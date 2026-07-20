import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { and, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/lib/db";
import { getProjectBySlug } from "@/lib/projects";

export default async function SourcesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { userId } = await auth();
  if (!userId) return null;

  const { slug } = await params;
  const project = await getProjectBySlug(userId, slug);
  if (!project) notFound();

  const sources = await db
    .select()
    .from(schema.source)
    .where(
      and(
        eq(schema.source.userId, userId),
        eq(schema.source.projectId, project.id)
      )
    )
    .orderBy(desc(schema.source.createdAt));

  const base = `/p/${project.slug}`;

  return (
    <section className="relative flex flex-col gap-14 px-6 pb-12 pt-16 md:px-12 md:pt-24 lg:px-20">
      <header className="flex flex-col gap-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-faint">
          sources, feeds that flow in
        </p>
        <div className="flex items-end justify-between gap-6">
          <h1 className="font-display text-5xl leading-[1.02] tracking-tight md:text-7xl">
            what keeps filling it.
          </h1>
          <Link
            href={`${base}/sources/new`}
            className="shrink-0 rounded-full border border-line-strong bg-neutral-50 px-4 py-2 text-xs font-medium uppercase tracking-wider text-ink transition-colors hover:bg-neutral-100 hover:border-ink"
          >
            new source
          </Link>
        </div>
        <p className="max-w-xl text-base text-ink-dim">
          trove polls these on a schedule and drops new items straight into the pile.
        </p>
      </header>

      <ul className="flex flex-col">
        {sources.length === 0 ? (
          <li className="font-display text-2xl italic text-ink-faint">
            nothing feeding in yet.
          </li>
        ) : (
          sources.map((s) => (
            <li key={s.id} className="border-b border-line last:border-b-0">
              <Link
                href={`${base}/sources/${s.id}`}
                className="group grid grid-cols-[8rem,1fr,auto] items-baseline gap-6 py-6 transition-colors hover:bg-ink/[0.015]"
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
                  {s.kind}
                </span>
                <div className="flex flex-col gap-1">
                  <span className="font-display text-2xl tracking-tight text-ink md:text-3xl">
                    {s.name}
                  </span>
                  <span className="text-sm text-ink-dim line-clamp-1">
                    {s.lastSyncAt
                      ? `last synced ${s.lastSyncAt.toLocaleString("en-GB")}`
                      : "not synced yet"}
                  </span>
                </div>
                <span
                  className={`font-mono text-[10px] uppercase tracking-[0.22em] ${
                    s.lastStatus === "error"
                      ? "text-ember"
                      : s.enabled
                      ? "text-silver"
                      : "text-ink-ghost"
                  }`}
                >
                  {s.lastStatus === "error"
                    ? "error"
                    : s.enabled
                    ? "active"
                    : "paused"}
                </span>
              </Link>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
