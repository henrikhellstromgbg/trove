"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProject } from "@/app/project-context";
import { Button, ConfirmDialog, InlineError } from "@/app/components/ui";

export function DeleteSourceButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const { project } = useProject();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>("");

  async function remove() {
    if (busy) return;
    setBusy(true);
    setError("");

    const res = await fetch(
      `/api/sources/${id}?projectId=${encodeURIComponent(project.id)}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      router.push(`/p/${project.slug}/sources`);
      router.refresh();
    } else {
      const err = await res.json().catch(() => ({}));
      setError(err.error ?? `error ${res.status}`);
      setBusy(false);
      setOpen(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Delete source
      </Button>
      <InlineError message={error} />
      <ConfirmDialog
        open={open}
        title="Delete this source?"
        description={
          <>
            Removing {name ? <>&ldquo;{name}&rdquo;</> : "this source"} stops
            future syncs. Items already imported stay in your Library.
          </>
        }
        confirmLabel={busy ? "Deleting…" : "Delete source"}
        cancelLabel="Cancel"
        destructive
        confirmDisabled={busy}
        onConfirm={remove}
        onCancel={() => {
          if (!busy) setOpen(false);
        }}
      />
    </div>
  );
}
