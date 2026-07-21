"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProject } from "@/app/project-context";

export function SyncNowButton({ id }: { id: string }) {
  const router = useRouter();
  const { project } = useProject();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>("");

  async function run() {
    if (busy) return;
    setBusy(true);
    setError("");

    const res = await fetch(
      `/api/sources/${id}/sync?projectId=${encodeURIComponent(project.id)}`,
      { method: "POST" }
    );
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
        {busy ? "syncing" : "sync now"}
      </button>
      {error ? <span className="text-brand">{error}</span> : null}
    </div>
  );
}
