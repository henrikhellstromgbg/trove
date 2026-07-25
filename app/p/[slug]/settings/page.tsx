import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { getProjectBySlug } from "@/lib/projects";
import {
  PageFrame,
  PageHeader,
  SectionHeader,
} from "@/components/ui";
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
    <PageFrame maxWidth="5xl">
      <PageHeader
        title="Settings"
        description={`Tokens for ${project.name} and your account.`}
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="flex flex-col gap-4">
          <SectionHeader title="Ingest tokens" />
          <IngestTokensPanel />
        </section>

        <section className="flex flex-col gap-4">
          <SectionHeader title="Account and security" />
          <div className="flex flex-col gap-4 border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-6">
            <p className="text-sm text-[var(--color-text-secondary)]">
              Email, sign-in, and security are handled by our auth provider.
            </p>
            <AccountButton />
          </div>
        </section>
      </div>
    </PageFrame>
  );
}
