"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProject } from "@/app/project-context";
import { Button, InlineError } from "@/app/components/ui";

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
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <Button
        variant="secondary"
        onClick={run}
        disabled={busy}
        aria-busy={busy}
      >
        {busy ? "Syncing…" : "Run now"}
      </Button>
      <InlineError message={error} />
    </div>
  );
}
