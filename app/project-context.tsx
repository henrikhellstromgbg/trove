"use client";

import { createContext, useContext } from "react";
import type { Project } from "@/lib/db/schema";

type ProjectContextValue = {
  project: Project;
  projects: Project[];
};

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({
  project,
  projects,
  children,
}: ProjectContextValue & { children: React.ReactNode }) {
  return (
    <ProjectContext.Provider value={{ project, projects }}>
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
