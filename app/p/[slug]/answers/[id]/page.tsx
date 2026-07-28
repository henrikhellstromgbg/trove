import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { DataList, DataRow, PageFrame, PageHeader, SectionHeader } from "@/components/ui";
import { getAnswer } from "@/lib/answers";
import { getProjectBySlug } from "@/lib/projects";
import { AnswerDeleteButton } from "./answer-delete-button";

function hostOf(source: string | null) {
  if (!source || !/^https?:\/\//i.test(source)) return null;
  try {
    return new URL(source).host;
  } catch {
    return null;
  }
}

export default async function AnswerPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { userId } = await auth();
  if (!userId) return null;
  const { slug, id } = await params;
  const project = await getProjectBySlug(userId, slug);
  if (!project) notFound();
  const answer = await getAnswer(userId, project.id, id);
  if (!answer) notFound();

  const revisions = [
    ...answer.activity,
    ...(answer.question && answer.answer
      ? [{ question: answer.question, answer: answer.answer }]
      : []),
  ];

  const sources = answer.citations.length === 0 ? (
    <p className="text-sm text-[var(--color-text-tertiary)]">No sources saved with this answer.</p>
  ) : (
    <DataList>
      {answer.citations.map((citation) => (
        <DataRow
          key={`${citation.n}-${citation.itemId}`}
          href={`/p/${project.slug}/library/${citation.itemId}`}
          selectLabel={`Open cited item ${citation.title}`}
          leading={<span className="font-mono text-sm text-[var(--color-text-tertiary)]">{String(citation.n).padStart(2, "0")}</span>}
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm">{citation.title}</span>
            {hostOf(citation.source) ? <span className="text-sm text-[var(--color-text-tertiary)]">{hostOf(citation.source)}</span> : null}
          </div>
        </DataRow>
      ))}
    </DataList>
  );

  return (
    <>
      <div className="xl:pr-[24rem]">
        <PageFrame maxWidth="none" fillViewport>
          <PageHeader
            title={answer.title}
            description={`Updated ${answer.updatedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`}
            action={<AnswerDeleteButton id={answer.id} projectId={project.id} slug={project.slug} />}
          />

          <div className="flex min-h-[60dvh] min-w-0 flex-1 flex-col gap-4">
            <SectionHeader title="Work log" />
            <div className="relative ml-2 flex flex-1 flex-col border-l border-[var(--color-border-subtle)] pl-5">
              {revisions.length > 0 ? (
                <ol className="flex flex-col gap-8">
                  {revisions.map((revision, index) => {
                    const isCurrent = index === revisions.length - 1;

                    return (
                      <li key={`${index}-${revision.question}`} className="relative flex flex-col gap-3">
                        <span className="absolute -left-[1.55rem] top-4 size-2 rounded-[var(--radius-full)] bg-[var(--color-border-strong)]" />
                        <div className="rounded-[var(--radius-md)] bg-[var(--color-surface)] px-3 py-2.5 shadow-[var(--shadow-sm)]">
                          <p className="text-base leading-relaxed text-[var(--color-text-primary)]">{revision.question}</p>
                        </div>
                        <div className="relative flex flex-col gap-3 py-2">
                          <span className="absolute -left-[1.55rem] top-3 size-2 rounded-[var(--radius-full)] bg-[var(--color-border-strong)]" />
                          <SectionHeader title="Answer" />
                          <p className="whitespace-pre-wrap text-pretty text-base leading-relaxed text-[var(--color-text-primary)]">
                            {revision.answer}
                          </p>
                        </div>
                        <p className="text-sm text-[var(--color-text-tertiary)]">
                          {isCurrent && answer.citations.length > 0
                            ? `Answer updated · ${answer.citations.length} sources`
                            : "Answer updated"}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="text-base text-[var(--color-text-tertiary)]">This answer has not completed yet.</p>
              )}

              <aside className="mt-8 border-t border-[var(--color-border-subtle)] pt-5 xl:hidden">
                <SectionHeader title={`Based on ${answer.citations.length} sources`} />
                <div className="mt-4">{sources}</div>
              </aside>
            </div>
          </div>
        </PageFrame>
      </div>

      <aside className="fixed right-0 top-0 z-[var(--z-raised)] hidden h-[100dvh] w-96 min-w-0 flex-col overflow-y-auto border-l border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-6 xl:flex">
        <div className="border-b border-[var(--color-border-subtle)] pb-4">
          <SectionHeader title={`Based on ${answer.citations.length} sources`} />
        </div>
        <div className="pt-5">{sources}</div>
      </aside>
    </>
  );
}
