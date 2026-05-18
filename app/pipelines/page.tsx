import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export default async function PipelinesPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const pipelines = await db
    .select()
    .from(schema.pipeline)
    .where(eq(schema.pipeline.userId, userId))
    .orderBy(desc(schema.pipeline.createdAt));

  return (
    <section className="relative flex flex-col gap-14 px-6 pb-12 pt-16 md:px-12 md:pt-24 lg:px-20">
      <header className="flex flex-col gap-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-faint">
          pipelines, recurring rituals
        </p>
        <div className="flex items-end justify-between gap-6">
          <h1 className="font-display text-5xl leading-[1.02] tracking-tight md:text-7xl">
            standing instructions.
          </h1>
          <Link
            href="/pipelines/new"
            className="shrink-0 rounded-full rounded-full border border-line-strong bg-neutral-50 px-4 py-2 text-xs font-medium uppercase tracking-wider text-ink transition-colors hover:bg-neutral-100 hover:border-ink"
          >
            new pipeline
          </Link>
        </div>
        <p className="max-w-xl text-base text-ink-dim">
          tell trove what to do, when to do it. it runs while you sleep.
        </p>
      </header>

      <ul className="flex flex-col">
        {pipelines.length === 0 ? (
          <li className="font-display text-2xl italic text-ink-faint">
            nothing on a schedule yet.
          </li>
        ) : (
          pipelines.map((p) => (
            <li key={p.id} className="border-b border-line last:border-b-0">
              <Link
                href={`/pipelines/${p.id}`}
                className="group grid grid-cols-[8rem,1fr,auto] items-baseline gap-6 py-6 transition-colors hover:bg-ink/[0.015]"
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
                  {p.cron ?? "manual"}
                </span>
                <div className="flex flex-col gap-1">
                  <span className="font-display text-2xl tracking-tight text-ink md:text-3xl">
                    {p.name}
                  </span>
                  <span className="text-sm text-ink-dim line-clamp-2">
                    {p.description}
                  </span>
                </div>
                <span
                  className={`font-mono text-[10px] uppercase tracking-[0.22em] ${
                    p.enabled ? "text-silver" : "text-ink-ghost"
                  }`}
                >
                  {p.enabled ? "active" : "paused"}
                </span>
              </Link>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
