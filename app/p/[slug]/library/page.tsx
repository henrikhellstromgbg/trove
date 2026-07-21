import { auth } from "@clerk/nextjs/server";
import { and, eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/lib/db";
import { getProjectBySlug } from "@/lib/projects";
import { Stream } from "@/app/stream";

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

  const items = await db
    .select()
    .from(schema.item)
    .where(
      and(eq(schema.item.userId, userId), eq(schema.item.projectId, project.id))
    )
    .orderBy(desc(schema.item.capturedAt))
    .limit(100);

  return (
    <section className="relative mx-auto flex w-full max-w-4xl flex-col gap-10 px-6 pb-16 pt-16 md:px-10">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-faint">
          library · {items.length} in {project.name}
        </p>
        <h1 className="text-3xl font-medium tracking-tight text-ink md:text-4xl">
          Everything you kept.
        </h1>
      </header>

      <Stream items={items} />
    </section>
  );
}
