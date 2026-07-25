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
      <p className="font-mono text-sm text-[var(--color-text-tertiary)]">
        Trove, a calmer archive
      </p>
      <h1 className="mt-6 font-display text-6xl leading-[1.02] tracking-tight md:text-8xl">
        Drop anything in.
        <br />
        Ask it anything later.
      </h1>
      <p className="mt-8 max-w-lg text-base text-[var(--color-text-secondary)]">
        A knowledge base for people drowning in inputs. One place for the links,
        the PDFs, the half thoughts. Sign in to begin.
      </p>
      <div className="mt-10 flex items-center gap-4">
        <Link
          href="/sign-in"
          className="rounded-full bg-[var(--color-action)] px-5 py-2 text-sm text-[var(--color-text-inverse)]"
        >
          Sign in
        </Link>
        <Link
          href="/sign-up"
          className="rounded-full border border-[var(--color-border)] px-5 py-2 text-sm text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]"
        >
          Create account
        </Link>
      </div>
    </section>
  );
}
