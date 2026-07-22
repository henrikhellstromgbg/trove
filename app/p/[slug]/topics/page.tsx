import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/lib/db";
import { getProjectBySlug, getProjectCounts } from "@/lib/projects";

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
  const titleById = new Map(items.map((it) => [it.id, it.title ?? it.source ?? "(untitled)"]));

  const base = `/p/${project.slug}`;

  return (
    <section className="relative mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 pb-16 pt-16 md:px-10">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-faint">
          topics · {counts.topics} in {project.name}
        </p>
        <h1 className="text-3xl font-medium tracking-tight text-ink md:text-4xl">
          What connects.
        </h1>
        <p className="mt-1 max-w-xl text-sm text-ink-dim">
          trove clusters what you save each night. these are the threads it found.
        </p>
      </header>

      {topics.length === 0 ? (
        <p className="font-mono text-sm text-ink-faint">
          nothing clustered yet. topics form overnight once a few related things pile up.
        </p>
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
                className="flex flex-col gap-3 rounded-2xl border border-line bg-paper p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="text-lg font-medium tracking-tight text-ink">
                    {topic.name}
                  </h2>
                  <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
                    {present.length} {present.length === 1 ? "item" : "items"}
                  </span>
                </div>
                {topic.summary ? (
                  <p className="text-sm leading-relaxed text-ink-dim">
                    {topic.summary}
                  </p>
                ) : null}
                {present.length > 0 ? (
                  <ul className="flex flex-col gap-1 border-t border-line pt-3">
                    {present.map((entry) => (
                      <li key={entry.id}>
                        <Link
                          href={`${base}/library/${entry.id}`}
                          className="block truncate text-sm text-ink-dim underline-offset-2 transition-colors hover:text-brand hover:underline"
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
    </section>
  );
}
