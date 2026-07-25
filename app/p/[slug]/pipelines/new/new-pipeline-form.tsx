"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProject } from "@/app/project-context";
import { Button, InlineError, TextArea } from "@/components/ui";

const EXAMPLES = [
  "every sunday at 9am, summarize my newsletters into three highlights",
  "every morning, list new articles I tagged 'design' yesterday",
  "monthly on first, write a short summary of everything I saved last month",
];

export function NewPipelineForm() {
  const router = useRouter();
  const { project } = useProject();
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    const value = description.trim();
    if (busy || value.length < 10) return;

    setBusy(true);
    setError("");

    try {
      const res = await fetch("/api/pipelines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: value, projectId: project.id }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error ?? `error ${res.status}`);
        return;
      }

      const data = (await res.json()) as { id: string };
      router.push(`/p/${project.slug}/pipelines/${data.id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <section className="flex flex-col gap-4 border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-6 md:p-8">
        <TextArea
          id="pipeline-description"
          label="Pipeline prompt"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
          }}
          placeholder="Describe what should happen and when."
          rows={9}
          className="min-h-[220px] resize-none border-0 bg-transparent p-0 text-base leading-relaxed text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus-visible:ring-0"
          containerClassName="gap-2"
        />

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border-subtle)] pt-4">
          <p className="font-mono text-sm text-[var(--color-text-tertiary)]">
            Press Cmd/Ctrl + Enter to save.
          </p>
          <Button onClick={submit} disabled={busy || description.trim().length < 10}>
            {busy ? "Saving" : "Save pipeline"}
          </Button>
        </div>

        <InlineError message={error} />
      </section>

      <aside className="flex flex-col gap-3">
        <p className="text-sm font-medium text-[var(--color-text-primary)]">Examples</p>
        <div className="flex flex-col gap-2">
          {EXAMPLES.map((example) => (
            <Button
              key={example}
              variant="secondary"
              onClick={() => setDescription(example)}
              className="justify-start px-4 py-3 text-left"
            >
              <span className="whitespace-normal text-sm leading-relaxed">
                {example}
              </span>
            </Button>
          ))}
        </div>
      </aside>
    </div>
  );
}
