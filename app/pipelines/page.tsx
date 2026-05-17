import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export default async function PipelinesPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const pipelines = await db
    .select()
    .from(schema.pipeline)
    .where(eq(schema.pipeline.userId, userId))
    .orderBy(desc(schema.pipeline.createdAt));

  return (
    <main className="flex flex-1 flex-col items-center gap-10 px-6 py-10">
      <div className="flex w-full max-w-2xl items-baseline justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl">Pipelines</h1>
          <p className="text-sm text-black/60">
            Recurring jobs that run over your saved items.
          </p>
        </div>
        <Link
          href="/pipelines/new"
          className="rounded-md border border-black/10 px-3 py-1.5 text-sm hover:border-black/30"
        >
          new pipeline
        </Link>
      </div>

      <ul className="flex w-full max-w-2xl flex-col gap-3">
        {pipelines.length === 0 ? (
          <li className="text-sm text-black/40">
            No pipelines yet. Create one to summarize your items on a schedule.
          </li>
        ) : (
          pipelines.map((p) => (
            <li key={p.id}>
              <Link
                href={`/pipelines/${p.id}`}
                className="flex flex-col gap-1 rounded-md border border-black/5 px-3 py-2 hover:border-black/20 transition-colors"
              >
                <div className="flex items-center justify-between text-xs text-black/40">
                  <span>{p.cron ?? ""}</span>
                  <span>{p.enabled ? "enabled" : "paused"}</span>
                </div>
                <div className="text-sm">{p.name}</div>
                <div className="text-xs text-black/50 line-clamp-2">
                  {p.description}
                </div>
              </Link>
            </li>
          ))
        )}
      </ul>
    </main>
  );
}
