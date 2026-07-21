import { redirect, notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getProjectBySlug, listProjects, getProjectCounts } from "@/lib/projects";
import { ProjectProvider } from "@/app/project-context";
import { Sidebar } from "@/app/sidebar";
import { CaptureOverlay } from "@/app/capture-overlay";

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

  const [projects, counts] = await Promise.all([
    listProjects(userId),
    getProjectCounts(userId, project.id),
  ]);

  return (
    <ProjectProvider project={project} projects={projects} counts={counts}>
      <Sidebar />
      <CaptureOverlay />
      <main className="ml-[280px] min-h-screen">{children}</main>
    </ProjectProvider>
  );
}
