import { auth } from "@clerk/nextjs/server";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { WikiBoard } from "./wiki-board";

export default async function WikiPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const topics = await db
    .select()
    .from(schema.topic)
    .where(eq(schema.topic.userId, userId))
    .orderBy(sql`coalesce(array_length(${schema.topic.itemIds}, 1), 0) desc`);

  const allItemIds = Array.from(
    new Set(topics.flatMap((t) => t.itemIds ?? []))
  );

  const itemRows = allItemIds.length
    ? await db
        .select({
          id: schema.item.id,
          title: schema.item.title,
          source: schema.item.source,
        })
        .from(schema.item)
        .where(eq(schema.item.userId, userId))
    : [];

  const itemById = new Map(itemRows.map((i) => [i.id, i]));

  const enriched = topics.map((t) => ({
    id: t.id,
    name: t.name,
    summary: t.summary,
    items: (t.itemIds ?? [])
      .map((id) => itemById.get(id))
      .filter(
        (i): i is { id: string; title: string | null; source: string | null } =>
          Boolean(i)
      ),
  }));

  return (
    <section className="relative flex flex-col gap-14 px-6 pb-12 pt-16 md:px-12 md:pt-24 lg:px-20">
      <header className="flex flex-col gap-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-faint">
          wiki, auto stitched nightly
        </p>
        <h1 className="font-display text-5xl leading-[1.02] tracking-tight md:text-7xl">
          what you keep returning to.
        </h1>
        <p className="max-w-xl text-base text-ink-dim">
          topics drift up from your archive on their own. no folders, no filing.
        </p>
      </header>

      {enriched.length === 0 ? (
        <p className="font-display text-2xl italic text-ink-faint">
          no topics yet. capture more and check back tomorrow.
        </p>
      ) : (
        <WikiBoard topics={enriched} />
      )}
    </section>
  );
}
