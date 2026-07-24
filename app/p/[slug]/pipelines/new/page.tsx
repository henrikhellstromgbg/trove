import { NewPipelineForm } from "./new-pipeline-form";
import { TemplatePicker } from "./template-picker";
import { PageFrame, PageHeader, SectionHeader } from "@/app/components/ui";

export default function NewPipelinePage() {
  return (
    <PageFrame maxWidth="5xl">
      <PageHeader
        title="New pipeline"
        description="Install a template or write one in plain words."
      />

      <SectionHeader title="Templates" />
      <TemplatePicker />

      <SectionHeader title="Custom pipeline" />
      <NewPipelineForm />
    </PageFrame>
  );
}
