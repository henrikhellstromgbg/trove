import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ArrowLeft, Launch } from "@carbon/icons-react";
import { db, schema } from "@/lib/db";
import { getProjectBySlug, listProjects } from "@/lib/projects";
import { itemOriginalUrl } from "@/lib/item-url";
import { ItemActions } from "./item-actions";

const STATUS_CLASS: Record<string, string> = {
  ready: "text-ink-dim",
  processing: "text-ink-faint",
  pending: "text-ink-faint",
  failed: "text-brand",
};

const MAX_RAW = 8000;

function isUrl(s: string | null): s is string {
  return !!s && /^https?:\/\//i.test(s);
}

export default async function ItemDetail({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) return null;

  const { slug, id } = await params;
  const project = await getProjectBySlug(userId, slug);
  if (!project) notFound();

  const [item] = await db
    .select()
    .from(schema.item)
    .where(
      and(
        eq(schema.item.id, id),
        eq(schema.item.userId, userId),
        eq(schema.item.projectId, project.id)
      )
    )
    .limit(1);

  if (!item) notFound();

  const otherProjects = (await listProjects(userId))
    .filter((p) => p.id !== project.id)
    .map((p) => ({ id: p.id, name: p.name, slug: p.slug }));

  const title = item.title ?? item.source ?? "(untitled)";
  const statusClass = STATUS_CLASS[item.status] ?? "text-ink-dim";
  const added = item.capturedAt.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const externalUrl = isUrl(item.source) ? item.source : null;
  const originalUrl = itemOriginalUrl(item);
  let originalLabel = "open original";
  if (externalUrl) {
    try {
      originalLabel = new URL(externalUrl).host;
    } catch {
      originalLabel = "open original";
    }
  }

  const rawText = item.rawText ?? null;
  const rawTruncated = !!rawText && rawText.length > MAX_RAW;
  const rawShown = rawTruncated ? rawText!.slice(0, MAX_RAW) : rawText;

  return (
    <section className="relative mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 pb-16 pt-16 md:px-10">
      <Link
        href={`/p/${slug}/library`}
        className="inline-flex w-fit items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-faint transition-colors hover:text-ink focus:text-ink outline-none"
      >
        <ArrowLeft size={16} />
        back to library
      </Link>

      <header className="flex flex-col gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-faint">
          {item.type}
          {" · "}
          <span className={statusClass}>{item.status}</span>
        </p>
        <h1 className="text-3xl font-medium tracking-tight text-ink">{title}</h1>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[12px] text-ink-faint">
          <span>Added {added}</span>
          {item.source ? (
            <span className="min-w-0 truncate">Source: {item.source}</span>
          ) : null}
        </div>

        {originalUrl ? (
          <a
            href={originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-2 rounded-lg border border-line-strong bg-paper px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-ink focus:border-ink outline-none"
          >
            <Launch size={16} />
            {externalUrl ? originalLabel : "open original"}
          </a>
        ) : null}
      </header>

      <ItemActions
        slug={slug}
        projectId={project.id}
        itemId={item.id}
        initialTitle={item.title}
        initialTags={item.tags ?? []}
        status={item.status}
        otherProjects={otherProjects}
      />

      {item.status === "failed" ? (
        <p className="font-mono text-sm text-brand">processing failed for this item.</p>
      ) : null}

      {item.tags?.length ? (
        <div className="flex flex-wrap gap-2">
          {item.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-line px-2.5 py-1 font-mono text-[11px] text-ink-dim"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      {item.summary ? (
        <p className="text-base leading-relaxed text-ink">{item.summary}</p>
      ) : null}

      {rawShown ? (
        <div className="flex flex-col gap-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-faint">
            content
          </p>
          <div className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-2xl border border-line bg-paper p-5 text-sm leading-relaxed text-ink-dim">
            {rawShown}
            {rawTruncated ? (
              <p className="mt-4 font-mono text-[11px] text-ink-faint">
                truncated
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {!item.summary && !rawText ? (
        <p className="font-mono text-sm text-ink-faint">nothing extracted yet</p>
      ) : null}
    </section>
  );
}
