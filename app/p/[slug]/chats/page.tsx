import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { and, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/lib/db";
import { getProjectBySlug } from "@/lib/projects";
import { ChatArchive } from "./chat-archive";

export default async function ChatsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { userId } = await auth();
  if (!userId) return null;

  const { slug } = await params;
  const project = await getProjectBySlug(userId, slug);
  if (!project) notFound();

  const base = `/p/${project.slug}`;

  const conversations = await db
    .select({
      id: schema.conversation.id,
      title: schema.conversation.title,
      createdAt: schema.conversation.createdAt,
    })
    .from(schema.conversation)
    .where(
      and(
        eq(schema.conversation.userId, userId),
        eq(schema.conversation.projectId, project.id)
      )
    )
    .orderBy(desc(schema.conversation.createdAt));

  return (
    <section className="relative mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 pb-16 pt-16 md:px-10">
      <header className="flex items-end justify-between gap-6">
        <div className="flex flex-col gap-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-faint">
            chat archive · {conversations.length} in {project.name}
          </p>
          <h1 className="text-3xl font-medium tracking-tight text-ink md:text-4xl">
            Everything you asked.
          </h1>
        </div>
        <Link
          href={`${base}/ask`}
          className="shrink-0 rounded-lg border border-line-strong bg-paper px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-ink"
        >
          new chat
        </Link>
      </header>

      <ChatArchive
        slug={project.slug}
        projectId={project.id}
        conversations={conversations.map((c) => ({
          id: c.id,
          title: c.title,
          createdAt: c.createdAt.toISOString(),
        }))}
      />
    </section>
  );
}
