import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { and, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/lib/db";
import { getProjectBySlug } from "@/lib/projects";
import {
  PageFrame,
  PageHeader,
  SectionHeader,
  DataList,
  DataRow,
  EmptyState,
  StatusIndicator,
  type Status,
} from "@/components/ui";
import { sourceKindLabel, sourceRuntimeLabel } from "../source-display";
import { DeleteSourceButton } from "./delete-button";
import { SyncNowButton } from "./sync-now-button";

function fmt(date: Date) {
  return date.toLocaleString("en-GB");
}

function sourceStatus(source: {
  enabled: boolean;
  lastStatus: string | null;
}): { status: Status; label: string } {
  if (!source.enabled) return { status: "paused", label: "Paused" };
  if (source.lastStatus === "error") return { status: "error", label: "Error" };
  return { status: "active", label: "Active" };
}

function itemStatus(status: string): { status: Status; label: string } {
  if (status === "failed") return { status: "error", label: "Failed" };
  if (status === "ready") return { status: "success", label: "Ready" };
  return { status: "paused", label: status };
}

function runStatus(status: string): { status: Status; label: string } {
  if (status === "error") return { status: "error", label: "Error" };
  if (status === "ok") return { status: "success", label: "OK" };
  return { status: "paused", label: status };
}

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
      <PageFrame>
        <EmptyState
          message="Source not found."
          action={
            <Link
              href={`${base}/sources`}
              className="text-sm text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
            >
              Back to sources
            </Link>
          }
        />
      </PageFrame>
    );
  }

  const [items, runs] = await Promise.all([
    db
      .select()
      .from(schema.item)
      .where(eq(schema.item.sourceId, source.id))
      .orderBy(desc(schema.item.capturedAt))
      .limit(20),
    db
      .select({
        id: schema.sourceRun.id,
        trigger: schema.sourceRun.trigger,
        status: schema.sourceRun.status,
        itemCount: schema.sourceRun.itemCount,
        error: schema.sourceRun.error,
        startedAt: schema.sourceRun.startedAt,
        completedAt: schema.sourceRun.completedAt,
      })
      .from(schema.sourceRun)
      .where(
        and(
          eq(schema.sourceRun.sourceId, source.id),
          eq(schema.sourceRun.userId, userId),
          eq(schema.sourceRun.projectId, project.id)
        )
      )
      .orderBy(desc(schema.sourceRun.startedAt))
      .limit(10),
  ]);

  const isLocal = source.runtime === "local";
  const config = source.config as {
    feedUrl?: string;
    url?: string;
    channelId?: string;
    mboxPath?: string;
    folderPath?: string;
  };
  const configSummary =
    config.feedUrl ??
    config.url ??
    config.mboxPath ??
    config.folderPath ??
    (config.channelId ? `channel ${config.channelId}` : null);

  const scheduleLabel = isLocal
    ? "Desktop app"
    : (source.cron ?? "Manual");
  const state = sourceStatus(source);

  return (
    <PageFrame>
      <div className="flex flex-col gap-4">
        <Link
          href={`${base}/sources`}
          className="self-start text-sm text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
        >
          ← All sources
        </Link>
        <PageHeader
          title={source.name}
          description={
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span>{sourceKindLabel(source.kind)}</span>
                <span aria-hidden>·</span>
                <span>{sourceRuntimeLabel(source.runtime)}</span>
                <span aria-hidden>·</span>
                <span>{scheduleLabel}</span>
              </div>
              {configSummary ? (
                <span className="truncate font-mono text-sm text-[var(--color-text-secondary)]">
                  {configSummary}
                </span>
              ) : null}
            </div>
          }
        />
      </div>

      <div className="flex flex-col gap-4 border-y border-[var(--color-border-subtle)] py-4 sm:flex-row sm:items-start sm:justify-between">
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 sm:flex sm:flex-wrap sm:gap-x-10">
          <div className="flex flex-col gap-0.5">
            <dt className="text-sm text-[var(--color-text-secondary)]">State</dt>
            <dd>
              <StatusIndicator status={state.status} label={state.label} />
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-sm text-[var(--color-text-secondary)]">Last sync</dt>
            <dd className="text-sm text-[var(--color-text-primary)]">
              {source.lastSyncAt ? fmt(source.lastSyncAt) : "Never"}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-sm text-[var(--color-text-secondary)]">Last status</dt>
            <dd
              className={
                source.lastStatus === "error"
                  ? "text-sm text-[var(--color-brand)]"
                  : "text-sm text-[var(--color-text-primary)]"
              }
            >
              {source.lastStatus ?? "Not run yet"}
            </dd>
          </div>
          {source.nextRunAt ? (
            <div className="flex flex-col gap-0.5">
              <dt className="text-sm text-[var(--color-text-secondary)]">Next run</dt>
              <dd className="text-sm text-[var(--color-text-primary)]">{fmt(source.nextRunAt)}</dd>
            </div>
          ) : null}
        </dl>
        <div className="shrink-0">
          {isLocal ? (
            <p className="max-w-xs text-sm text-[var(--color-text-secondary)]">
              Sync runs from the Trove Desktop app.
            </p>
          ) : (
            <SyncNowButton id={source.id} />
          )}
        </div>
      </div>

      {source.lastError ? (
        <p className="-mt-4 text-sm text-[var(--color-brand)]">{source.lastError}</p>
      ) : null}

      <section className="flex flex-col gap-4">
        <SectionHeader title="Recent items" />
        {items.length === 0 ? (
          <EmptyState message="No items pulled in yet." />
        ) : (
          <DataList>
            {items.map((it) => {
              const s = itemStatus(it.status);
              return (
                <DataRow
                  key={it.id}
                  trailing={<StatusIndicator status={s.status} label={s.label} />}
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate font-medium text-[var(--color-text-primary)]">
                      {it.title ?? it.source ?? "(untitled)"}
                    </span>
                    <span className="text-sm text-[var(--color-text-secondary)]">
                      {fmt(it.capturedAt)}
                    </span>
                  </div>
                </DataRow>
              );
            })}
          </DataList>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader title="Run history" />
        {runs.length === 0 ? (
          <EmptyState message="No runs yet." />
        ) : (
          <DataList>
            {runs.map((run) => {
              const s = runStatus(run.status);
              return (
                <DataRow
                  key={run.id}
                  trailing={<StatusIndicator status={s.status} label={s.label} />}
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      <span className="text-[var(--color-text-primary)]">{fmt(run.startedAt)}</span>
                      <span className="text-sm text-[var(--color-text-secondary)]">{run.trigger}</span>
                    </div>
                    <span className="text-sm text-[var(--color-text-secondary)]">
                      {run.itemCount} new{" "}
                      {run.itemCount === 1 ? "item" : "items"}
                    </span>
                    {run.error ? (
                      <span className="text-sm text-[var(--color-brand)]">{run.error}</span>
                    ) : null}
                  </div>
                </DataRow>
              );
            })}
          </DataList>
        )}
      </section>

      <div className="flex flex-col gap-3 border-t border-[var(--color-border-subtle)] pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-md text-sm text-[var(--color-text-secondary)]">
          Removing this source stops future syncs. Items already imported stay in
          your Library.
        </p>
        <DeleteSourceButton id={source.id} name={source.name} />
      </div>
    </PageFrame>
  );
}
