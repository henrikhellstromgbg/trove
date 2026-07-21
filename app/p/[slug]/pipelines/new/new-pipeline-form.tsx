"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useProject } from "@/app/project-context";

const EXAMPLES = [
  "every sunday at 9am, summarize my newsletters from the past week with three highlights",
  "every morning, list new articles I tagged 'design' yesterday",
  "monthly on the first, write a paragraph summary of everything I saved that month",
];

export function NewPipelineForm() {
  const router = useRouter();
  const { project } = useProject();
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
      body: JSON.stringify({ description: value, projectId: project.id }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setError(err.error ?? `error ${res.status}`);
      setBusy(false);
      return;
    }

    const { id } = await res.json();
    router.push(`/p/${project.slug}/pipelines/${id}`);
  }

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[2fr,1fr]">
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-paper p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)] md:p-8">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
          }}
          placeholder="describe your pipeline. cmd return to save."
          className="min-h-[200px] resize-none bg-transparent text-lg leading-relaxed text-ink placeholder:text-ink-faint md:text-xl"
        />
        <div className="flex items-center justify-between gap-4 border-t border-line pt-4">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
            {busy ? "compiling" : error || "ready when you are"}
          </span>
          <motion.button
            onClick={submit}
            whileTap={{ scale: 0.97 }}
            className="shrink-0 rounded-lg border border-line-strong bg-paper px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-ink"
          >
            compile and save
          </motion.button>
        </div>
      </div>

      <aside className="flex flex-col gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-faint">
          patterns
        </p>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => setDescription(ex)}
            className="group rounded-2xl border border-line bg-paper p-4 text-left shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-colors hover:border-line-strong"
          >
            <p className="text-sm leading-relaxed text-ink-dim group-hover:text-ink">
              {ex}
            </p>
          </button>
        ))}
      </aside>
    </div>
  );
}
