import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { listProjects, createProject } from "@/lib/projects";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const projects = await listProjects(userId);
  return NextResponse.json({ projects });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { name?: unknown; kind?: unknown; color?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length === 0) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  const kind = body.kind === "client" ? "client" : "personal";
  const color = typeof body.color === "string" ? body.color : null;

  const project = await createProject(userId, name, kind, color);
  return NextResponse.json({ project });
}
