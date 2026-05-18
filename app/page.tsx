import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { eq, desc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { CaptureForm } from "./capture-form";
import { Stream } from "./stream";

export default async function Home() {
  const { userId } = await auth();
  if (!userId) {
    return (
      <section className="relative flex min-h-screen flex-col justify-center px-10 py-20 md:px-20">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-faint">
          trove, a calmer archive
        </p>
        <h1 className="mt-6 font-display text-6xl leading-[1.02] tracking-tight md:text-8xl">
          drop anything in.
          <br />
          ask it anything later.
        </h1>
        <p className="mt-8 max-w-lg text-base text-ink-dim">
          a knowledge base for people drowning in inputs. one place for the
          links, the pdfs, the half thoughts. sign in to begin.
        </p>
        <div className="mt-10 flex items-center gap-4">
          <Link
            href="/sign-in"
            className="rounded-full bg-ink px-5 py-2 text-sm text-canvas"
          >
            sign in
          </Link>
          <Link
            href="/sign-up"
            className="rounded-full border border-line-strong px-5 py-2 text-sm text-ink-dim hover:border-ink hover:text-ink"
          >
            create account
          </Link>
        </div>
      </section>
    );
  }

  const items = await db
    .select()
    .from(schema.item)
    .where(eq(schema.item.userId, userId))
    .orderBy(desc(schema.item.capturedAt))
    .limit(24);

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <section className="relative mx-auto flex w-full max-w-3xl flex-col gap-12 px-6 pb-12 pt-32 md:px-10">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-faint">
          {today} · {items.length} of yours
        </p>
        <h1 className="font-display text-5xl font-light leading-none tracking-tight text-ink-ghost sm:text-6xl md:text-7xl lg:text-8xl">
          today
        </h1>
      </header>

      <CaptureForm />

      <Stream items={items} />
    </section>
  );
}
