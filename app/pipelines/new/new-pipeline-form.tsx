"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const EXAMPLES = [
  "every sunday at 9am, summarize my newsletters from the past week with three highlights",
  "every morning, list new articles I tagged 'design' yesterday",
  "monthly on the first, write a paragraph summary of everything I saved that month",
];

type CompiledSpec = {
  name: string;
  cron: string;
  filter: Record<string, unknown>;
  prompt: string;
  outputShape: string;
};

export function NewPipelineForm() {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>("");

  async function submit() {
    const value = description.trim();
    if (value.length < 10 || busy) return;

    setBusy(true);
    setError("");

    const res = await fetch("/api/pipelines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: value }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setError(err.error ?? `error ${res.status}`);
      setBusy(false);
      return;
    }

    const { id } = await res.json();
    router.push(`/pipelines/${id}`);
  }

  return (
    <div className="flex w-full max-w-2xl flex-col gap-4">
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
        }}
        placeholder="Describe your pipeline. ⌘↩ to save."
        className="min-h-[120px] resize-y rounded-md border border-black/10 p-3 text-sm outline-none focus:border-black/30"
      />

      <div className="flex flex-col gap-2 text-xs text-black/50">
        <span>Examples</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => setDescription(ex)}
            className="text-left text-black/60 hover:text-black"
            disabled={busy}
          >
            {ex}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs text-black/50">
        <span>{busy ? "compiling..." : error}</span>
        <button
          onClick={submit}
          disabled={description.trim().length < 10 || busy}
          className="rounded-md border border-black/10 px-3 py-1.5 text-xs hover:border-black/30 disabled:opacity-30"
        >
          compile and save
        </button>
      </div>
    </div>
  );
}
