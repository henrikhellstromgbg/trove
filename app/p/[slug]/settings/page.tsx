import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { getProjectBySlug } from "@/lib/projects";
import { IngestTokensPanel } from "./ingest-tokens-panel";
import { AccountButton } from "./account-button";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { userId } = await auth();
  if (!userId) return null;

  const { slug } = await params;
  const project = await getProjectBySlug(userId, slug);
  if (!project) notFound();

  return (
    <section className="relative mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 pb-16 pt-16 md:px-10">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-faint">
          Settings
        </p>
        <h1 className="text-3xl font-medium tracking-tight text-ink md:text-4xl">
          How trove connects.
        </h1>
        <p className="mt-1 max-w-xl text-sm text-ink-dim">
          Tokens for the desktop app, and your account. More lands here as it&apos;s built.
        </p>
      </header>

      <IngestTokensPanel />

      <div className="flex max-w-2xl flex-col gap-3 rounded-2xl border border-line bg-paper p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)] md:p-8">
        <h2 className="text-lg font-medium text-ink">Account</h2>
        <p className="text-sm text-ink-dim">
          Email, sign-in and security are handled by our auth provider.
        </p>
        <AccountButton />
      </div>
    </section>
  );
}
