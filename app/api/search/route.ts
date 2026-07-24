import { InvalidProjectError } from "@/lib/projects";
import { searchDeps } from "./deps";

// GET /api/search?q=<text>&projectId=<uuid>
// Full-text search over the caller's items in one project. projectId is
// optional and falls back to the user's default project; either way it is
// ownership-checked before any content is read (no cross-project reads).
export async function GET(request: Request): Promise<Response> {
  const { userId } = await searchDeps.auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim();
  if (!query) {
    return Response.json({ error: "Missing query" }, { status: 400 });
  }

  let projectId: string;
  try {
    projectId = await searchDeps.requireProjectId(
      userId,
      url.searchParams.get("projectId") ?? undefined
    );
  } catch (error) {
    if (error instanceof InvalidProjectError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const results = await searchDeps.searchItems({ userId, projectId, query });
  return Response.json({ results });
}
