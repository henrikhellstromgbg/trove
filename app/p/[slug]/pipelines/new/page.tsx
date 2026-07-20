import { NewPipelineForm } from "./new-pipeline-form";

export default function NewPipelinePage() {
  return (
    <section className="relative flex flex-col gap-12 px-6 pb-12 pt-16 md:px-12 md:pt-24 lg:px-20">
      <header className="flex flex-col gap-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-faint">
          new pipeline
        </p>
        <h1 className="font-display text-5xl leading-[1.02] tracking-tight md:text-7xl">
          tell it, in plain words.
        </h1>
        <p className="max-w-xl text-base text-ink-dim">
          claude compiles your sentence into a schedule, a filter and a prompt.
        </p>
      </header>
      <NewPipelineForm />
    </section>
  );
}
