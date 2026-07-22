"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProject } from "@/app/project-context";
import { Button, InlineError } from "@/app/components/ui";
import { requestJson } from "../request-json";

export function SyncNowButton({ id }: { id: string }) {
  const router = useRouter();
  const { project } = useProject();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>("");

  async function run() {
    if (busy) return;
    setBusy(true);
    setError("");

    const result = await requestJson(
      `/api/sources/${id}/sync?projectId=${encodeURIComponent(project.id)}`,
      { method: "POST" }
    );
    setBusy(false);

    if (result.ok) {
      router.refresh();
    } else {
      setError(result.error);
    }
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
