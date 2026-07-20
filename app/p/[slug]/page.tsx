import { auth } from "@clerk/nextjs/server";
import { and, eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/lib/db";
import { getProjectBySlug } from "@/lib/projects";
import { CaptureForm } from "@/app/capture-form";
import { Stream } from "@/app/stream";

export default async function ProjectHome({
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
    .limit(24);

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <section className="relative mx-auto flex w-full max-w-3xl flex-col gap-12 px-6 pb-12 pt-32 md:px-10">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-faint">
          {today} · {items.length} in {project.name}
        </p>
        <h1 className="font-display text-5xl font-light leading-none tracking-tight text-ink-ghost sm:text-6xl md:text-7xl lg:text-8xl">
          today
        </h1>
      </header>

      <CaptureForm />

      <Stream items={items} />
    </section>
  );
}
