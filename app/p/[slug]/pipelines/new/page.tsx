import { NewPipelineForm } from "./new-pipeline-form";
import { TemplatePicker } from "./template-picker";

export default function NewPipelinePage() {
  return (
    <section className="relative mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 pb-16 pt-16 md:px-10">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-faint">
          new pipeline
        </p>
        <h1 className="text-3xl font-medium tracking-tight text-ink md:text-4xl">
          Start from a template.
        </h1>
        <p className="mt-1 max-w-xl text-sm text-ink-dim">
          two ready-made schedules to install in a click, or write your own below.
        </p>
      </header>

      <TemplatePicker />

      <div className="flex items-center gap-4">
        <span className="h-px flex-1 bg-line" />
        <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-faint">
          or, in plain words
        </span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <NewPipelineForm />
    </section>
  );
}
