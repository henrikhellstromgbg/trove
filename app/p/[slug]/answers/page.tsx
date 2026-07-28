import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { PageFrame, PageHeader } from "@/components/ui";
import { listAnswers } from "@/lib/answers";
import { getProjectBySlug } from "@/lib/projects";
import { AnswersList } from "./answers-list";

export default async function AnswersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { userId } = await auth();
  if (!userId) return null;
  const { slug } = await params;
  const project = await getProjectBySlug(userId, slug);
  if (!project) notFound();
  const answers = await listAnswers(userId, project.id);

  return (
    <PageFrame maxWidth="4xl">
      <PageHeader
        title="Answers"
        description={`Saved Ask sessions in ${project.name}.`}
      />
      <AnswersList
        slug={project.slug}
        projectId={project.id}
        answers={answers.map((answer) => ({
          id: answer.id,
          title: answer.title,
          updatedAt: answer.updatedAt.toISOString(),
          sourceCount: answer.citations.length,
        }))}
      />
    </PageFrame>
  );
}
