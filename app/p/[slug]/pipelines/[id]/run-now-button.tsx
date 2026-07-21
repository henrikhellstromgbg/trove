"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RunNowButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>("");

  async function run() {
    if (busy) return;
    setBusy(true);
    setError("");

    const res = await fetch(`/api/pipelines/${id}/run`, { method: "POST" });
    if (res.ok) {
      router.refresh();
    } else {
      const err = await res.json().catch(() => ({}));
      setError(err.error ?? `error ${res.status}`);
    }
    setBusy(false);
  }

  return (
    <div className="flex items-center gap-4 font-mono text-[10px] uppercase tracking-[0.22em]">
      <button
        onClick={run}
        className="rounded-lg border border-line-strong bg-paper px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-ink"
      >
        {busy ? "running" : "run now"}
      </button>
      {error ? <span className="text-brand">{error}</span> : null}
    </div>
  );
}
