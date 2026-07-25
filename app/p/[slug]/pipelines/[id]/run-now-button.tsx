"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProject } from "@/app/project-context";
import { Button } from "@/components/ui";

export function RunNowButton({ id }: { id: string }) {
  const router = useRouter();
  const { project } = useProject();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>("");

  async function run() {
    if (busy) return;
    setBusy(true);
    setError("");

    const res = await fetch(`/api/pipelines/${id}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.id }),
    });
    if (res.ok) {
      router.refresh();
    } else {
      const err = await res.json().catch(() => ({}));
      setError(err.error ?? `error ${res.status}`);
    }
    setBusy(false);
  }

  return (
    <div className="flex items-center gap-4">
      <Button
        onClick={run}
        variant="secondary"
      >
        {busy ? "running" : "run now"}
      </Button>
      {error ? <span className="text-sm text-[var(--color-brand)]">{error}</span> : null}
    </div>
  );
}
