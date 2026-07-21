import { auth } from "@clerk/nextjs/server";
import { and, eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/lib/db";
import { getProjectBySlug, getProjectCounts } from "@/lib/projects";
import { LibraryTable, type Row } from "@/app/library-table";

export default async function LibraryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { userId } = await auth();
  if (!userId) return null;

  const { slug } = await params;
  const project = await getProjectBySlug(userId, slug);
  if (!project) notFound();

  const [items, counts] = await Promise.all([
    db
      .select()
      .from(schema.item)
      .where(
        and(eq(schema.item.userId, userId), eq(schema.item.projectId, project.id))
      )
      .orderBy(desc(schema.item.capturedAt))
      .limit(200),
    getProjectCounts(userId, project.id),
  ]);

  const rows: Row[] = items.map((it) => ({
    id: it.id,
    title: it.title,
    type: it.type,
    source: it.source,
    status: it.status,
    capturedAt: it.capturedAt.toISOString(),
  }));

  return (
    <section className="relative mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 pb-16 pt-16 md:px-10">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-faint">
          library · {counts.items} in {project.name}
        </p>
        <h1 className="text-3xl font-medium tracking-tight text-ink md:text-4xl">
          Everything you kept.
        </h1>
      </header>

      {items.length === 0 ? (
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
