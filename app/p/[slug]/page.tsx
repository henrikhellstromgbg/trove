import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { and, eq, desc, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/lib/db";
import { getProjectBySlug, getProjectCounts } from "@/lib/projects";
import { WEEKLY_DIGEST_TEMPLATE_ID } from "@/lib/pipelines/templates";
import { DashboardAsk } from "@/app/dashboard-ask";

function Panel({
  title,
  href,
  children,
}: {
  title: string;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-paper p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
          {title}
        </h2>
        {href ? (
          <Link
            href={href}
            className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint transition-colors hover:text-ink"
          >
            all
          </Link>
        ) : null}
      </div>
      {children}
    </div>
  );
}

type DigestOutput = {
  summary?: string;
  highlights?: string[];
  forgotten?: { title?: string | null } | null;
};

// Short glyphs so the type never collides with the name in the tight panel.
const TYPE_GLYPH: Record<string, string> = {
  text: "txt",
  url: "url",
  pdf: "pdf",
  image: "img",
  docx: "doc",
  xlsx: "xls",
  textfile: "txt",
};

export default async function ProjectDashboard({
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

  const [counts, recent, processingItems, digestRun] = await Promise.all([
    getProjectCounts(userId, project.id),
    db
      .select()
      .from(schema.item)
      .where(and(eq(schema.item.userId, userId), eq(schema.item.projectId, project.id)))
      .orderBy(desc(schema.item.capturedAt))
      .limit(6),
    db
      .select({
        id: schema.item.id,
        title: schema.item.title,
        source: schema.item.source,
        status: schema.item.status,
      })
      .from(schema.item)
      .where(
        and(
          eq(schema.item.userId, userId),
          eq(schema.item.projectId, project.id),
          inArray(schema.item.status, ["pending", "processing"])
        )
      )
      .orderBy(desc(schema.item.capturedAt))
      .limit(5),
    db
      .select({ output: schema.pipelineRun.output, completedAt: schema.pipelineRun.completedAt })
      .from(schema.pipelineRun)
      .innerJoin(schema.pipeline, eq(schema.pipelineRun.pipelineId, schema.pipeline.id))
      .where(
        and(
          eq(schema.pipeline.userId, userId),
          eq(schema.pipeline.projectId, project.id),
          eq(schema.pipeline.templateKey, WEEKLY_DIGEST_TEMPLATE_ID),
          eq(schema.pipelineRun.status, "completed")
        )
      )
      .orderBy(desc(schema.pipelineRun.completedAt))
      .limit(1),
  ]);

  const digest = (digestRun[0]?.output ?? null) as DigestOutput | null;

  function label(it: { title: string | null; source: string | null }): string {
    return it.title ?? it.source ?? "(untitled)";
  }

  return (
    <section className="relative mx-auto flex w-full max-w-4xl flex-col gap-10 px-6 pb-16 pt-16 md:px-10">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-faint">
          {project.name}
        </p>
        <h1 className="text-3xl font-medium tracking-tight text-ink md:text-4xl">
          What do you want to know?
        </h1>
      </header>

      <DashboardAsk slug={project.slug} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Processing — the old Ingestions, now status not a destination */}
        <Panel title="Processing">
          {counts.processing === 0 ? (
            <p className="text-sm text-ink-faint">nothing in flight.</p>
          ) : (
            <>
              <p className="text-sm text-ink-dim">
                <span className="font-mono text-brand">{counts.processing}</span> in flight
              </p>
              <ul className="flex flex-col gap-1">
                {processingItems.map((it) => (
                  <li key={it.id} className="flex items-center gap-2 text-sm text-ink">
                    <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-ink-ghost" />
                    <span className="truncate">{label(it)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Panel>

        {/* Just captured */}
        <Panel title="Just captured" href={`${base}/library`}>
          {recent.length === 0 ? (
            <p className="text-sm text-ink-faint">nothing yet. drop something.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {recent.slice(0, 5).map((it) => (
                <li key={it.id} className="flex items-center gap-3 text-sm text-ink">
                  <span className="w-7 shrink-0 font-mono text-[10px] uppercase text-ink-faint">
                    {TYPE_GLYPH[it.type] ?? it.type}
                  </span>
                  <span className="truncate">{label(it)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Sources health */}
        <Panel title="Sources health" href={`${base}/sources`}>
          {counts.sources === 0 ? (
            <p className="text-sm text-ink-faint">no sources yet.</p>
          ) : (
            <p className="text-sm text-ink-dim">
              <span className="font-mono">{counts.sources - counts.sourceErrors}</span> ok
              {counts.sourceErrors > 0 ? (
                <>
                  {" · "}
                  <span className="font-mono text-brand">{counts.sourceErrors} error</span>
                </>
              ) : null}
            </p>
          )}
        </Panel>

        {/* Latest digest */}
        <Panel title="Latest digest" href={`${base}/digest`}>
          {!digest ? (
            <p className="text-sm text-ink-faint">no digest yet. runs weekly.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              <p className="line-clamp-2 text-sm text-ink">{digest.summary ?? "—"}</p>
              <p className="font-mono text-[11px] text-ink-faint">
                {digest.highlights?.length ?? 0} highlights
                {digest.forgotten?.title ? " · 1 forgotten pick" : ""}
              </p>
            </div>
          )}
        </Panel>
      </div>
    </section>
  );
}
