import { NewPipelineForm } from "./new-pipeline-form";

export default function NewPipelinePage() {
  return (
    <section className="relative mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 pb-16 pt-16 md:px-10">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-faint">
          new pipeline
        </p>
        <h1 className="text-3xl font-medium tracking-tight text-ink md:text-4xl">
          Tell it, in plain words.
        </h1>
        <p className="mt-1 max-w-xl text-sm text-ink-dim">
          claude compiles your sentence into a schedule, a filter and a prompt.
        </p>
      </header>
      <NewPipelineForm />
    </section>
  );
}
