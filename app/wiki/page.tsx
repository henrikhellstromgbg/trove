import { auth } from "@clerk/nextjs/server";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";

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

  return (
    <main className="flex flex-1 flex-col items-center gap-10 px-6 py-10">
      <div className="flex w-full max-w-2xl flex-col gap-2">
        <h1 className="text-2xl">Wiki</h1>
        <p className="text-sm text-black/60">
          auto-generated from your saved items, refreshed nightly
        </p>
      </div>

      <div className="flex w-full max-w-2xl flex-col gap-10">
        {topics.length === 0 ? (
          <p className="text-sm text-black/40">
            no topics yet. capture more items and check back tomorrow.
          </p>
        ) : (
          topics.map((topic) => {
            const items = (topic.itemIds ?? [])
              .map((id) => itemById.get(id))
              .filter(
                (i): i is { id: string; title: string | null; source: string | null } =>
                  Boolean(i)
              );

            return (
              <section key={topic.id} className="flex flex-col gap-3">
                <h2 className="text-xl">{topic.name}</h2>
                {topic.summary ? (
                  <p className="text-sm text-black/70">{topic.summary}</p>
                ) : null}
                <ul className="flex flex-col gap-1">
                  {items.map((it) => (
                    <li key={it.id} className="text-sm text-black/60">
                      {it.title ?? it.source ?? "(untitled)"}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </div>
    </main>
  );
}
