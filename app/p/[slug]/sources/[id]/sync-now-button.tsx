"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SyncNowButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>("");

  async function run() {
    if (busy) return;
    setBusy(true);
    setError("");

    const res = await fetch(`/api/sources/${id}/sync`, { method: "POST" });
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
        className="rounded-full border border-line-strong bg-neutral-50 px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-ink transition-colors hover:bg-neutral-100 hover:border-ink"
      >
        {busy ? "syncing" : "sync now"}
      </button>
      {error ? <span className="text-ember">{error}</span> : null}
    </div>
  );
}
