import { NewPipelineForm } from "./new-pipeline-form";

export default function NewPipelinePage() {
  return (
    <main className="flex flex-1 flex-col items-center gap-8 px-6 py-10">
      <div className="flex w-full max-w-2xl flex-col gap-2">
        <h1 className="text-2xl">New pipeline</h1>
        <p className="text-sm text-black/60">
          Describe a recurring job in plain English. Claude compiles it into a spec
          and it runs on schedule.
        </p>
      </div>

      <NewPipelineForm />
    </main>
  );
}
