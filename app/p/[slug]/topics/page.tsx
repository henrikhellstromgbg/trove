import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/lib/db";
import { getProjectBySlug, getProjectCounts } from "@/lib/projects";
import { EmptyState, PageFrame, PageHeader } from "@/components/ui";

export default async function TopicsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { userId } = await auth();
  if (!userId) return null;

  const { slug } = await params;
  const project = await getProjectBySlug(userId, slug);
  if (!project) notFound();

  const [topics, counts] = await Promise.all([
    db
      .select()
      .from(schema.topic)
      .where(
        and(
          eq(schema.topic.userId, userId),
          eq(schema.topic.projectId, project.id)
        )
      )
      .orderBy(desc(schema.topic.generatedAt)),
    getProjectCounts(userId, project.id),
  ]);

  // Resolve every referenced item title in one query, then map per topic.
  // Items that were moved, trashed or deleted since the last clustering simply
  // drop out — the topic keeps only what still exists in this project.
  const allItemIds = [
    ...new Set(topics.flatMap((t) => t.itemIds ?? [])),
  ];
  const items = allItemIds.length
    ? await db
        .select({
          id: schema.item.id,
          title: schema.item.title,
          source: schema.item.source,
        })
        .from(schema.item)
        .where(
          and(
            eq(schema.item.userId, userId),
            eq(schema.item.projectId, project.id),
            inArray(schema.item.id, allItemIds)
          )
        )
    : [];
  const titleById = new Map(items.map((it) => [it.id, it.title ?? it.source ?? "(Untitled)"]));

  const base = `/p/${project.slug}`;

  return (
    <PageFrame maxWidth="4xl">
      <PageHeader
        title="Topics"
        description={`${counts.topics} clusters in ${project.name}. Trove groups related captures each night.`}
      />

      {topics.length === 0 ? (
        <EmptyState message="Nothing clustered yet. Topics form overnight once a few related captures pile up." />
      ) : (
        <ul className="flex flex-col gap-4">
          {topics.map((topic) => {
            const present = (topic.itemIds ?? [])
              .map((id) => ({ id, title: titleById.get(id) }))
              .filter((entry): entry is { id: string; title: string } =>
                entry.title !== undefined
              );
            return (
              <li
                key={topic.id}
                className="flex flex-col gap-3 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-6"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="text-base font-medium text-[var(--color-text-primary)]">
                    {topic.name}
                  </h2>
                  <span className="shrink-0 text-sm text-[var(--color-text-tertiary)]">
                    {present.length} {present.length === 1 ? "item" : "items"}
                  </span>
                </div>
                {topic.summary ? (
                  <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
                    {topic.summary}
                  </p>
                ) : null}
                {present.length > 0 ? (
                  <ul className="flex flex-col gap-1 border-t border-[var(--color-border-subtle)] pt-3">
                    {present.map((entry) => (
                      <li key={entry.id}>
                        <Link
                          href={`${base}/library/${entry.id}`}
                          className="block truncate text-sm text-[var(--color-text-secondary)] underline-offset-2 transition-colors hover:text-[var(--color-brand)] hover:underline"
                        >
                          {entry.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </PageFrame>
  );
}
