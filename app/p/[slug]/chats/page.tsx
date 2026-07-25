import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { and, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/lib/db";
import { getProjectBySlug } from "@/lib/projects";
import { PageFrame, PageHeader } from "@/components/ui";
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
    <PageFrame maxWidth="4xl">
      <PageHeader
        title="Chats"
        description={`${conversations.length} saved conversations in ${project.name}.`}
        action={
          <Link
            href={`${base}/ask`}
            className="inline-flex items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-border-strong)]"
          >
            New chat
          </Link>
        }
      />

      <ChatArchive
        slug={project.slug}
        projectId={project.id}
        conversations={conversations.map((c) => ({
          id: c.id,
          title: c.title,
          createdAt: c.createdAt.toISOString(),
        }))}
      />
    </PageFrame>
  );
}
