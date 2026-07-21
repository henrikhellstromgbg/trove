import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { and, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/lib/db";
import { getProjectBySlug } from "@/lib/projects";
import { DeleteSourceButton } from "./delete-button";
import { SyncNowButton } from "./sync-now-button";

export default async function SourceDetailPage({
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

  const [source] = await db
    .select()
    .from(schema.source)
    .where(
      and(
        eq(schema.source.id, id),
        eq(schema.source.userId, userId),
        eq(schema.source.projectId, project.id)
      )
    )
    .limit(1);

  if (!source) {
    return (
      <section className="relative mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 pb-16 pt-16 md:px-10">
        <p className="font-mono text-sm text-ink-faint">source not found.</p>
        <Link
          href={`${base}/sources`}
          className="self-start font-mono text-[10px] uppercase tracking-[0.22em] text-ink-dim transition-colors hover:text-ink"
        >
          back to sources
        </Link>
      </section>
    );
  }

  const items = await db
    .select()
    .from(schema.item)
    .where(eq(schema.item.sourceId, source.id))
    .orderBy(desc(schema.item.capturedAt))
    .limit(20);

  const config = source.config as {
    feedUrl?: string;
    url?: string;
    channelId?: string;
  };
  const configSummary = config.feedUrl ?? config.url ?? (config.channelId ? `channel ${config.channelId}` : null);

  return (
    <section className="relative mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 pb-16 pt-16 md:px-10">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-faint">
            source · {source.kind} · {source.cron ?? "manual"}
          </p>
          <Link
            href={`${base}/sources`}
            className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint transition-colors hover:text-ink"
          >
            all sources
          </Link>
        </div>
        <h1 className="text-3xl font-medium tracking-tight text-ink md:text-4xl">
          {source.name}
        </h1>
        {configSummary ? (
          <p className="mt-1 max-w-2xl truncate font-mono text-sm text-ink-dim">
            {configSummary}
          </p>
        ) : null}
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr,1fr]">
        <section className="flex flex-col gap-4">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-faint">
            recent items
          </h2>
          {items.length === 0 ? (
            <p className="font-mono text-sm text-ink-faint">
              nothing pulled in yet.
            </p>
          ) : (
            <ul>
              {items.map((it) => (
                  <li
                    key={it.id}
                    className="flex flex-col gap-1 border-b border-line px-6 py-4 last:border-b-0"
                  >
                    <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
                      <span>{it.capturedAt.toLocaleString("en-GB")}</span>
                      <span
                        className={
                          it.status === "ready"
                            ? "text-ink-dim"
                            : it.status === "failed"
                            ? "text-brand"
                            : "text-ink-ghost"
                        }
                      >
                        {it.status}
                      </span>
                    </div>
                    <span className="text-base font-medium text-ink">
                      {it.title ?? it.source ?? "(untitled)"}
                    </span>
                  </li>
                ))}
              </ul>
          )}

          <div className="mt-2 flex items-center justify-between">
            <SyncNowButton id={source.id} />
            <DeleteSourceButton id={source.id} />
          </div>
        </section>

        <aside className="flex flex-col gap-4 self-start rounded-2xl border border-line bg-paper p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-faint">
            status
          </h2>
          <dl className="flex flex-col gap-2 font-mono text-[11px] text-ink-dim">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-ghost">state</dt>
              <dd>{source.enabled ? "active" : "paused"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-ghost">last sync</dt>
              <dd>
                {source.lastSyncAt
                  ? source.lastSyncAt.toISOString().slice(0, 16) + "z"
                  : "never"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-ghost">last status</dt>
              <dd
                className={source.lastStatus === "error" ? "text-brand" : ""}
              >
                {source.lastStatus ?? "—"}
              </dd>
            </div>
            {source.nextRunAt ? (
              <div className="flex justify-between gap-4">
                <dt className="text-ink-ghost">next</dt>
                <dd>{source.nextRunAt.toISOString().slice(0, 16)}z</dd>
              </div>
            ) : null}
          </dl>
          {source.lastError ? (
            <p className="border-t border-line pt-3 text-xs text-brand">
              {source.lastError}
            </p>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
