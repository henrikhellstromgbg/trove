import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { and, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/lib/db";
import { getProjectBySlug } from "@/lib/projects";
import {
  DataList,
  DataRow,
  EmptyState,
  PageFrame,
  PageHeader,
  StatusIndicator,
} from "@/app/components/ui";

export default async function PipelinesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { userId } = await auth();
  if (!userId) return null;

  const { slug } = await params;
  const project = await getProjectBySlug(userId, slug);
  if (!project) notFound();

  const pipelines = await db
    .select()
    .from(schema.pipeline)
    .where(
      and(
        eq(schema.pipeline.userId, userId),
        eq(schema.pipeline.projectId, project.id)
      )
    )
    .orderBy(desc(schema.pipeline.createdAt));

  const base = `/p/${project.slug}`;

  return (
    <PageFrame maxWidth="5xl">
      <PageHeader
        title="Pipelines"
        description="Standing instructions that run on a schedule."
        action={
          <Link
            href={`${base}/pipelines/new`}
            className="inline-flex items-center justify-center rounded-lg border border-line-strong bg-paper px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-ink"
          >
            new pipeline
          </Link>
        }
      />

      {pipelines.length === 0 ? (
        <EmptyState message="Nothing on a schedule yet." />
      ) : (
        <DataList>
          {pipelines.map((pipeline) => (
            <DataRow
              key={pipeline.id}
              href={`${base}/pipelines/${pipeline.id}`}
              selectLabel={`Open pipeline ${pipeline.name}`}
              leading={
                <span className="font-mono text-xs text-ink-faint">
                  {pipeline.cron ?? "manual"}
                </span>
              }
              trailing={
                <StatusIndicator
                  status={pipeline.enabled ? "active" : "paused"}
                  label={pipeline.enabled ? "active" : "paused"}
                />
              }
            >
              <div className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-base font-medium text-ink">
                  {pipeline.name}
                </span>
                <span className="line-clamp-2 text-sm text-ink-dim">
                  {pipeline.description}
                </span>
              </div>
            </DataRow>
          ))}
        </DataList>
      )}
    </PageFrame>
  );
}
