import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { and, count, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/lib/db";
import { getProjectBySlug } from "@/lib/projects";
import {
  PageFrame,
  PageHeader,
  DataList,
  DataRow,
  EmptyState,
  StatusIndicator,
  type Status,
} from "@/app/components/ui";

const KIND_LABELS: Record<string, string> = {
  rss: "RSS",
  web_scrape: "Web page",
  slack_channel: "Slack channel",
  mail_folder: "Mail folder",
  folder_watch: "Watched folder",
  youtube_channel: "YouTube channel",
};

function kindLabel(kind: string) {
  return KIND_LABELS[kind] ?? kind;
}

function runtimeLabel(runtime: string) {
  return runtime === "cloud" ? "Cloud" : "Desktop";
}

function sourceStatus(source: { enabled: boolean; lastStatus: string | null }): {
  status: Status;
  label: string;
} {
  if (source.lastStatus === "error") return { status: "error", label: "Error" };
  if (!source.enabled) return { status: "paused", label: "Paused" };
  return { status: "active", label: "Active" };
}

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

  const itemCountRows = await db
    .select({ sourceId: schema.item.sourceId, c: count() })
    .from(schema.item)
    .where(
      and(
        eq(schema.item.userId, userId),
        eq(schema.item.projectId, project.id)
      )
    )
    .groupBy(schema.item.sourceId);

  const itemCounts = new Map<string, number>();
  for (const row of itemCountRows) {
    if (row.sourceId) itemCounts.set(row.sourceId, row.c);
  }

  const base = `/p/${project.slug}`;

  return (
    <PageFrame>
      <PageHeader
        title="Sources"
        action={
          <Link
            href={`${base}/sources/new`}
            className="inline-flex items-center justify-center rounded-lg border border-line-strong bg-paper px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-ink"
          >
            New source
          </Link>
        }
      />

      {sources.length === 0 ? (
        <EmptyState message="No sources yet." />
      ) : (
        <DataList>
          {sources.map((s) => {
            const { status, label } = sourceStatus(s);
            const itemCount = itemCounts.get(s.id) ?? 0;
            return (
              <DataRow
                key={s.id}
                href={`${base}/sources/${s.id}`}
                selectLabel={`View ${s.name}`}
              >
                <div className="flex flex-col gap-1 pr-4">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <span className="min-w-0 truncate font-medium text-ink">
                      {s.name}
                    </span>
                    <StatusIndicator status={status} label={label} />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-dim">
                    <span>{kindLabel(s.kind)}</span>
                    <span>{runtimeLabel(s.runtime)}</span>
                    <span>
                      {s.lastSyncAt
                        ? `Last synced ${s.lastSyncAt.toLocaleString("en-GB")}`
                        : "Not synced yet"}
                    </span>
                    <span>
                      {itemCount} item{itemCount === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
              </DataRow>
            );
          })}
        </DataList>
      )}
    </PageFrame>
  );
}
