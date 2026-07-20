import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { listProjects } from "@/lib/projects";

export default async function Home() {
  const { userId } = await auth();

  if (userId) {
    const projects = await listProjects(userId);
    redirect(`/p/${projects[0].slug}`);
  }

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
        a knowledge base for people drowning in inputs. one place for the links,
        the pdfs, the half thoughts. sign in to begin.
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
