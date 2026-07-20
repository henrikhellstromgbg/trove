import { NewSourceForm } from "./new-source-form";

export default function NewSourcePage() {
  return (
    <section className="relative flex flex-col gap-12 px-6 pb-12 pt-16 md:px-12 md:pt-24 lg:px-20">
      <header className="flex flex-col gap-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-faint">
          new source
        </p>
        <h1 className="font-display text-5xl leading-[1.02] tracking-tight md:text-7xl">
          point it at a feed.
        </h1>
        <p className="max-w-xl text-base text-ink-dim">
          rss for now. trove checks it hourly and pulls in anything new.
        </p>
      </header>
      <NewSourceForm />
    </section>
  );
}
