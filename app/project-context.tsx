"use client";

import { createContext, useContext } from "react";
import type { Project } from "@/lib/db/schema";
import type { ProjectCounts } from "@/lib/projects";

type ProjectContextValue = {
  project: Project;
  projects: Project[];
  counts: ProjectCounts;
};

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({
  project,
  projects,
  counts,
  children,
}: ProjectContextValue & { children: React.ReactNode }) {
  return (
    <ProjectContext.Provider value={{ project, projects, counts }}>
      {children}
    </ProjectContext.Provider>
  );
}

// Active project, resolved from the route. Throws if used outside a project layout.
export function useProject(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject must be used within a ProjectProvider");
  return ctx;
}
