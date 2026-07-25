import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { and, eq, desc, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/lib/db";
import { getProjectBySlug, getProjectCounts } from "@/lib/projects";
import { WEEKLY_DIGEST_TEMPLATE_ID } from "@/lib/pipelines/templates";
import { AskChat } from "@/app/ask-chat";
import { SectionHeader } from "@/components/ui";

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
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5">
      <SectionHeader
        title={title}
        action={
          href ? (
            <Link
              href={href}
              className="text-sm text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
            >
              View all
            </Link>
          ) : undefined
        }
      />
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
    return it.title ?? it.source ?? "(Untitled)";
  }

  const overview = (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Processing — the old Ingestions, now status not a destination */}
        <Panel title="Processing">
          {counts.processing === 0 ? (
            <p className="text-sm text-[var(--color-text-tertiary)]">Nothing in flight.</p>
          ) : (
            <>
              <p className="text-sm text-[var(--color-text-secondary)]">
                <span className="font-mono text-[var(--color-brand)]">{counts.processing}</span> in flight
              </p>
              <ul className="flex flex-col gap-1">
                {processingItems.map((it) => (
                  <li key={it.id} className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
                    <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[var(--color-surface-active)]" />
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
            <p className="text-sm text-[var(--color-text-tertiary)]">Nothing yet. Drop something in.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {recent.slice(0, 5).map((it) => (
                <li key={it.id} className="flex items-center gap-3 text-sm text-[var(--color-text-primary)]">
                  <span className="w-7 shrink-0 font-mono text-sm text-[var(--color-text-tertiary)]">
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
            <p className="text-sm text-[var(--color-text-tertiary)]">No sources yet.</p>
          ) : (
            <p className="text-sm text-[var(--color-text-secondary)]">
              <span className="font-mono">{counts.sources - counts.sourceErrors}</span> OK
              {counts.sourceErrors > 0 ? (
                <>
                  {" · "}
                  <span className="font-mono text-[var(--color-brand)]">{counts.sourceErrors} error</span>
                </>
              ) : null}
            </p>
          )}
        </Panel>

        {/* Latest digest */}
        <Panel title="Latest digest" href={`${base}/digest`}>
          {!digest ? (
            <p className="text-sm text-[var(--color-text-tertiary)]">No digest yet. Runs weekly.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              <p className="line-clamp-2 text-sm text-[var(--color-text-primary)]">{digest.summary ?? "No summary yet"}</p>
              <p className="font-mono text-sm text-[var(--color-text-tertiary)]">
                {digest.highlights?.length ?? 0} highlights
                {digest.forgotten?.title ? " · 1 forgotten pick" : ""}
              </p>
            </div>
          )}
        </Panel>
      </div>
  );

  return (
    <AskChat
      projectId={project.id}
      slug={project.slug}
      projectName={project.name}
      overview={overview}
    />
  );
}
