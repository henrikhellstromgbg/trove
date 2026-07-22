import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { and, eq, desc, notInArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/lib/db";
import { getProjectBySlug, getProjectCounts } from "@/lib/projects";
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
  const tabs: { key: View; label: string; count: number | null }[] = [
    { key: "all", label: "all", count: null },
    { key: "review", label: "review", count: reviewItems.length },
    { key: "trash", label: "trash", count: trashItems.length },
  ];

  return (
    <section className="relative mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 pb-16 pt-16 md:px-10">
      <header className="flex flex-col gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-faint">
          library · {counts.items} in {project.name}
        </p>
        <h1 className="text-3xl font-medium tracking-tight text-ink md:text-4xl">
          Everything you kept.
        </h1>
        <nav className="mt-1 flex flex-wrap gap-2">
          {tabs.map((t) => {
            const active = t.key === view;
            return (
              <Link
                key={t.key}
                href={t.key === "all" ? base : `${base}?view=${t.key}`}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs uppercase tracking-wider transition-colors ${
                  active
                    ? "border-ink bg-ink text-canvas"
                    : "border-line text-ink-dim hover:border-line-strong"
                }`}
              >
                <span>{t.label}</span>
                {t.count ? (
                  <span
                    className={`font-mono ${active ? "text-canvas/70" : "text-ink-faint"}`}
                  >
                    {t.count}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </header>

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
        <p className="font-mono text-sm text-ink-faint">
          nothing captured yet. drop something anywhere to begin.
        </p>
      ) : (
        <>
          {counts.items > items.length ? (
            <p className="font-mono text-[11px] text-ink-faint">
              showing the newest {items.length} items
            </p>
          ) : null}
          <LibraryTable
            slug={project.slug}
            items={rows}
            limited={counts.items > items.length}
          />
        </>
      )}
    </section>
  );
}
