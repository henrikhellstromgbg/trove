import Link from "next/link";
import { PageFrame, PageHeader } from "@/components/ui";
import { NewSourceForm } from "./new-source-form";

export default async function NewSourcePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <PageFrame>
      <PageHeader
        title="New source"
        description={
          <Link
            href={`/p/${slug}/sources`}
            className="text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
          >
            ← Back to sources
          </Link>
        }
      />
      <NewSourceForm />
    </PageFrame>
  );
}
