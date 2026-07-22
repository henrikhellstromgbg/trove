import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { getProjectBySlug } from "@/lib/projects";
import { AskWorkspace } from "@/app/ask-workspace";

export default async function AskPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { userId } = await auth();
  if (!userId) return null;

  const { slug } = await params;
  const project = await getProjectBySlug(userId, slug);
  if (!project) notFound();

  return (
    <AskWorkspace
      projectId={project.id}
      slug={project.slug}
      projectName={project.name}
    />
  );
}
