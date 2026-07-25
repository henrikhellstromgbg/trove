import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ArrowLeft, Launch } from "@/components/icons";
import { db, schema } from "@/lib/db";
import { getProjectBySlug, listProjects } from "@/lib/projects";
import { itemOriginalUrl } from "@/lib/item-url";
import { statusLabel } from "@/lib/status-label";
import {
  PageFrame,
  PageHeader,
  SectionHeader,
  StatusIndicator,
  type Status,
} from "@/components/ui";
import { ItemActions } from "./item-actions";

const MAX_RAW = 8000;

function isUrl(value: string | null): value is string {
  return !!value && /^https?:\/\//i.test(value);
}

function statusTone(status: string): Status {
  if (status === "ready") return "success";
  if (status === "failed") return "error";
  return "paused";
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
        eq(schema.item.projectId, project.id),
      ),
    )
    .limit(1);

  if (!item) notFound();

  const otherProjects = (await listProjects(userId))
    .filter((p) => p.id !== project.id)
    .map((p) => ({ id: p.id, name: p.name, slug: p.slug }));

  const title = item.title ?? item.source ?? "Untitled item";
  const added = item.capturedAt.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const originalUrl = itemOriginalUrl(item);
  const rawText =
    item.rawText == null
      ? null
      : item.rawText.length > MAX_RAW
        ? item.rawText.slice(0, MAX_RAW)
        : item.rawText;
  const sourceLabel = isUrl(item.source)
    ? (() => {
        try {
          return new URL(item.source).host;
        } catch {
          return item.source;
        }
      })()
    : item.source;

  return (
    <PageFrame maxWidth="5xl">
      <Link
        href={`/p/${slug}/library`}
        className="inline-flex w-fit items-center gap-1.5 text-sm text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)] focus:text-[var(--color-text-primary)]"
      >
        <ArrowLeft size={16} />
        Back to library
      </Link>

      <PageHeader
        title={title}
        description={
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[var(--color-text-secondary)]">
            <span>{item.type}</span>
            <StatusIndicator
              status={statusTone(item.status)}
              label={statusLabel(item.status)}
            />
            <span>Added {added}</span>
            {sourceLabel ? <span>Source: {sourceLabel}</span> : null}
          </div>
        }
        action={
          originalUrl ? (
            <a
              href={originalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-border-strong)]"
            >
              <Launch size={16} />
              Open original
            </a>
          ) : null
        }
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-8">
          <ItemActions
            slug={slug}
            projectId={project.id}
            itemId={item.id}
            initialTitle={item.title}
            initialTags={item.tags ?? []}
            status={item.status}
            otherProjects={otherProjects}
          />

          {item.summary ? (
            <section className="flex flex-col gap-3">
              <SectionHeader title="Summary" />
              <p className="text-base leading-relaxed text-[var(--color-text-primary)]">{item.summary}</p>
            </section>
          ) : null}

          <section className="flex flex-col gap-3">
            <SectionHeader title="Raw content" />
            {rawText ? (
              <>
                <div className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                  {rawText}
                </div>
                {item.rawText && item.rawText.length > MAX_RAW ? (
                  <p className="text-sm text-[var(--color-text-tertiary)]">
                    Showing the first {MAX_RAW.toLocaleString("en-GB")} characters.
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-[var(--color-text-tertiary)]">Nothing extracted yet.</p>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-6">
          {item.tags?.length ? (
            <section className="flex flex-col gap-3">
              <SectionHeader title="Tags" />
              <ul className="flex flex-wrap gap-2">
                {item.tags.map((tag) => (
                  <li
                    key={tag}
                    className="rounded-full border border-[var(--color-border-subtle)] px-2.5 py-1 text-sm text-[var(--color-text-secondary)]"
                  >
                    {tag}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {item.status === "failed" ? (
            <p className="text-sm text-[var(--color-brand)]">Processing failed for this item.</p>
          ) : null}
        </div>
      </div>
    </PageFrame>
  );
}
