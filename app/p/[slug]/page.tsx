import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { getProjectBySlug } from "@/lib/projects";
import { AskChat } from "@/app/ask-chat";

export default async function ProjectDashboard({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { userId } = await auth();
  if (!userId) return null;

  const { slug } = await params;
  const project = await getProjectBySlug(userId, slug);
  if (!project) notFound();

  const query = await searchParams;
  const legacyAnswerId = query.conversation;
  if (typeof legacyAnswerId === "string" && legacyAnswerId) {
    redirect(`/p/${project.slug}/answers/${encodeURIComponent(legacyAnswerId)}`);
  }

  return (
    <AskChat
      projectId={project.id}
      slug={project.slug}
      projectName={project.name}
    />
  );
}
