import { redirect, notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getProjectBySlug, listProjects } from "@/lib/projects";
import { ProjectProvider } from "@/app/project-context";
import { Sidebar } from "@/app/sidebar";
import { AskOverlay } from "@/app/ask-overlay";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const { slug } = await params;
  const project = await getProjectBySlug(userId, slug);
  if (!project) notFound();

  const projects = await listProjects(userId);

  return (
    <ProjectProvider project={project} projects={projects}>
      <Sidebar />
      <AskOverlay projectId={project.id} />
      <main className="ml-60 min-h-screen">{children}</main>
    </ProjectProvider>
  );
}
