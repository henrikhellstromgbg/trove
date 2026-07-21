import { NewSourceForm } from "./new-source-form";

export default function NewSourcePage() {
  return (
    <section className="relative mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 pb-16 pt-16 md:px-10">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-faint">
          new source
        </p>
        <h1 className="text-3xl font-medium tracking-tight text-ink md:text-4xl">
          Point it at a feed.
        </h1>
        <p className="mt-1 max-w-xl text-sm text-ink-dim">
          rss for now. trove checks it hourly and pulls in anything new.
        </p>
      </header>
      <NewSourceForm />
    </section>
  );
}
