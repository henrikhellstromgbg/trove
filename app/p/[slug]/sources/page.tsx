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
    <section className="relative mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 pb-16 pt-16 md:px-10">
      <header className="flex items-end justify-between gap-6">
        <div className="flex flex-col gap-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-faint">
            Sources
          </p>
          <h1 className="text-3xl font-medium tracking-tight text-ink md:text-4xl">
            What keeps filling it.
          </h1>
          <p className="mt-1 max-w-xl text-sm text-ink-dim">
            trove polls these on a schedule and drops new items straight into the pile.
          </p>
        </div>
        <Link
          href={`${base}/sources/new`}
          className="shrink-0 rounded-lg border border-line-strong bg-paper px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-ink"
        >
          new source
        </Link>
      </header>

      {sources.length === 0 ? (
        <p className="font-mono text-sm text-ink-faint">nothing feeding in yet.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-paper shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <ul>
            {sources.map((s) => (
              <li key={s.id} className="border-b border-line last:border-b-0">
                <Link
                  href={`${base}/sources/${s.id}`}
                  className="group grid grid-cols-[8rem,1fr,auto] items-baseline gap-6 px-6 py-5 transition-colors hover:bg-ink/[0.015]"
                >
                  <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
                    {s.kind}
                  </span>
                  <div className="flex flex-col gap-1">
                    <span className="text-lg font-medium tracking-tight text-ink">
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
                        ? "text-brand"
                        : s.enabled
                        ? "text-ink-dim"
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
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
