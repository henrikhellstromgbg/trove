"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProject } from "@/app/project-context";

export function DeleteSourceButton({ id }: { id: string }) {
  const router = useRouter();
  const { project } = useProject();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function remove() {
    if (busy) return;
    setBusy(true);

    const res = await fetch(`/api/sources/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push(`/p/${project.slug}/sources`);
      router.refresh();
    } else {
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint hover:text-ember"
      >
        delete source
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.22em]">
      <span className="text-ink-dim">remove this source?</span>
      <button
        onClick={remove}
        disabled={busy}
        className="rounded-full border border-ember/40 px-3 py-1 text-ember hover:bg-ember/10 disabled:opacity-30"
      >
        {busy ? "removing" : "yes"}
      </button>
      <button
        onClick={() => setConfirming(false)}
        className="text-ink-faint hover:text-ink"
      >
        cancel
      </button>
    </div>
  );
}
