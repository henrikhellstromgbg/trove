"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ConfirmDialog, InlineError } from "@/components/ui";

export function AnswerDeleteButton({ id, projectId, slug }: { id: string; projectId: string; slug: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (busy) return;
    setBusy(true);
    const response = await fetch(
      `/api/answers/${encodeURIComponent(id)}?projectId=${encodeURIComponent(projectId)}`,
      { method: "DELETE" }
    );
    if (response.ok || response.status === 404) {
      router.push(`/p/${slug}/answers`);
      router.refresh();
      return;
    }
    setBusy(false);
    setError("The answer could not be deleted. Try again.");
  }

  return (
    <>
      <Button
        variant="destructive"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        Delete
      </Button>
      <ConfirmDialog
        open={open}
        title="Delete answer?"
        description={
          <div className="flex flex-col gap-2">
            <span>This removes the answer and its activity from the project.</span>
            <InlineError message={error} />
          </div>
        }
        confirmLabel={busy ? "Deleting…" : "Delete"}
        cancelLabel="Cancel"
        destructive
        confirmDisabled={busy}
        onCancel={() => {
          setError(null);
          setOpen(false);
        }}
        onConfirm={remove}
      />
    </>
  );
}
