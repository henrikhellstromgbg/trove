import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { eq, desc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { CaptureForm } from "./capture-form";
import { AskForm } from "./ask-form";

export default async function Home() {
  const { userId } = await auth();
  if (!userId) return null;

  const items = await db
    .select()
    .from(schema.item)
    .where(eq(schema.item.userId, userId))
    .orderBy(desc(schema.item.capturedAt))
    .limit(20);

  return (
    <main className="flex flex-1 flex-col items-center gap-8 px-6 py-10">
      <div className="flex w-full max-w-xl flex-col gap-2">
        <h1 className="text-2xl">Trove</h1>
        <p className="text-sm text-black/60">
          Drop anything in. Ask it anything later.
        </p>
        <nav className="flex gap-4 text-sm text-black/60">
          <Link href="/wiki" className="hover:text-black">
            wiki
          </Link>
          <Link href="/digest" className="hover:text-black">
            digest
          </Link>
        </nav>
      </div>

      <CaptureForm />

      <AskForm />

      <ul className="flex w-full max-w-xl flex-col gap-2">
        {items.length === 0 ? (
          <li className="text-sm text-black/40">Nothing captured yet.</li>
        ) : (
          items.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-1 rounded-md border border-black/5 px-3 py-2"
            >
              <div className="flex items-center justify-between text-xs text-black/40">
                <span>{item.type}</span>
                <span>{item.status}</span>
              </div>
              <div className="truncate text-sm">
                {item.rawText?.slice(0, 120) ?? item.source ?? "(empty)"}
              </div>
            </li>
          ))
        )}
      </ul>
    </main>
  );
}
