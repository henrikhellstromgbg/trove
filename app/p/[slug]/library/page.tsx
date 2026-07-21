import { auth } from "@clerk/nextjs/server";
import { and, eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/lib/db";
import { getProjectBySlug } from "@/lib/projects";
import type { Item } from "@/lib/db/schema";

function isUrl(s: string | null): s is string {
  return !!s && /^https?:\/\//i.test(s);
}

function name(it: Item): string {
  return it.title ?? it.source ?? "(untitled)";
}

const STATUS_CLASS: Record<string, string> = {
  ready: "text-ink-dim",
  processing: "text-ink-faint",
  pending: "text-ink-faint",
  failed: "text-brand",
};

export default async function LibraryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { userId } = await auth();
  if (!userId) return null;

  const { slug } = await params;
  const project = await getProjectBySlug(userId, slug);
  if (!project) notFound();

  const items = await db
    .select()
    .from(schema.item)
    .where(
      and(eq(schema.item.userId, userId), eq(schema.item.projectId, project.id))
    )
    .orderBy(desc(schema.item.capturedAt))
    .limit(200);

  return (
    <section className="relative mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 pb-16 pt-16 md:px-10">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-faint">
          library · {items.length} in {project.name}
        </p>
        <h1 className="text-3xl font-medium tracking-tight text-ink md:text-4xl">
          Everything you kept.
        </h1>
      </header>

      {items.length === 0 ? (
        <p className="font-mono text-sm text-ink-faint">
          nothing captured yet. drop something anywhere to begin.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-paper shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              {/* header */}
              <div className="grid grid-cols-[4.5rem_1fr_9rem_6rem] gap-4 border-b border-line px-6 py-3 text-sm font-medium text-ink">
                <span>Type</span>
                <span>Name</span>
                <span>Captured</span>
                <span>Status</span>
              </div>
              {/* rows */}
              <ul>
                {items.map((it) => (
                  <li
                    key={it.id}
                    className="grid grid-cols-[4.5rem_1fr_9rem_6rem] items-baseline gap-4 border-b border-line px-6 py-3 font-mono text-[13px] last:border-b-0 hover:bg-ink/[0.015]"
                  >
                    <span className="uppercase text-ink-faint">{it.type}</span>
                    <span className="min-w-0 truncate">
                      {isUrl(it.source) ? (
                        <a
                          href={it.source}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-ink underline underline-offset-2 hover:text-brand"
                        >
                          {name(it)}
                        </a>
                      ) : (
                        <span className="text-ink">{name(it)}</span>
                      )}
                    </span>
                    <span className="text-ink-faint">
                      {it.capturedAt.toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    <span className={STATUS_CLASS[it.status] ?? "text-ink-dim"}>
                      {it.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
