import { auth } from "@clerk/nextjs/server";
import { and, eq, desc, notInArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/lib/db";
import { getProjectBySlug, getProjectCounts } from "@/lib/projects";
import {
  PageFrame,
  PageHeader,
  Tabs,
  EmptyState,
  type LinkTabItem,
} from "@/app/components/ui";
import {
  listReviewItems,
  listTrashItems,
} from "@/lib/review-or-deletion/store";
import { LibraryTable, type Row } from "@/app/library-table";
import { ReviewQueue } from "./review-queue";
import { TrashList } from "./trash-list";

// Statuses that live in their own views, kept out of the main library list.
const ASIDE_STATUSES = ["review", "trashed", "deleting"];

type View = "all" | "review" | "trash";

function parseView(value: string | undefined): View {
  return value === "review" || value === "trash" ? value : "all";
}

export default async function LibraryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) return null;

  const { slug } = await params;
  const view = parseView((await searchParams).view);
  const project = await getProjectBySlug(userId, slug);
  if (!project) notFound();

  const [items, counts, reviewItems, trashItems] = await Promise.all([
    db
      .select()
      .from(schema.item)
      .where(
        and(
          eq(schema.item.userId, userId),
          eq(schema.item.projectId, project.id),
          notInArray(schema.item.status, ASIDE_STATUSES)
        )
      )
      .orderBy(desc(schema.item.capturedAt))
      .limit(200),
    getProjectCounts(userId, project.id),
    listReviewItems(userId, project.id),
    listTrashItems(userId, project.id),
  ]);

  const rows: Row[] = items.map((it) => ({
    id: it.id,
    title: it.title,
    type: it.type,
    source: it.source,
    status: it.status,
    capturedAt: it.capturedAt.toISOString(),
  }));

  const base = `/p/${project.slug}/library`;
  const tabs: LinkTabItem[] = [
    { key: "all", label: "all", href: base },
    { key: "review", label: "review", href: `${base}?view=review`, count: reviewItems.length },
    { key: "trash", label: "trash", href: `${base}?view=trash`, count: trashItems.length },
  ];

  return (
    <PageFrame maxWidth="5xl">
      <PageHeader
        title="Library"
        description={
          <span>
            {counts.items} items in {project.name}. Review and trash are kept in
            their own views.
          </span>
        }
      />

      <Tabs
        label="Library views"
        activeKey={view}
        items={tabs}
        className="mt-1"
      />

      {view === "review" ? (
        <ReviewQueue
          slug={project.slug}
          projectId={project.id}
          items={reviewItems.map((it) => ({
            id: it.id,
            type: it.type,
            source: it.source,
            title: it.title,
            summary: it.summary,
            capturedAt: it.capturedAt.toISOString(),
          }))}
        />
      ) : view === "trash" ? (
        <TrashList
          slug={project.slug}
          projectId={project.id}
          items={trashItems.map((it) => ({
            id: it.id,
            type: it.type,
            source: it.source,
            title: it.title,
            status: it.status,
            deleteAfterAt: it.deleteAfterAt.toISOString(),
          }))}
        />
      ) : items.length === 0 ? (
        <EmptyState message="Nothing captured yet." />
      ) : (
        <>
          {counts.items > items.length ? (
            <p className="text-sm text-ink-faint">
              Showing the newest {items.length} items.
            </p>
          ) : null}
          <LibraryTable
            slug={project.slug}
            items={rows}
            limited={counts.items > items.length}
          />
        </>
      )}
    </PageFrame>
  );
}
