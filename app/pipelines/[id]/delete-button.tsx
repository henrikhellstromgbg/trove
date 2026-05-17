"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeletePipelineButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function remove() {
    if (busy) return;
    setBusy(true);

    const res = await fetch(`/api/pipelines/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/pipelines");
      router.refresh();
    } else {
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="text-xs text-black/40 hover:text-red-600 transition-colors"
      >
        delete pipeline
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-black/60">delete this pipeline?</span>
      <button
        onClick={remove}
        disabled={busy}
        className="rounded border border-red-600/30 px-2 py-0.5 text-red-700 hover:bg-red-50 disabled:opacity-30"
      >
        {busy ? "..." : "yes, delete"}
      </button>
      <button
        onClick={() => setConfirming(false)}
        className="text-black/40 hover:text-black"
      >
        cancel
      </button>
    </div>
  );
}
