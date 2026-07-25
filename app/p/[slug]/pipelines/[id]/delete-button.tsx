"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProject } from "@/app/project-context";
import { Button, ConfirmDialog } from "@/components/ui";

export function DeletePipelineButton({ id }: { id: string }) {
  const router = useRouter();
  const { project } = useProject();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  async function remove() {
    if (busy) return;
    setBusy(true);

    const res = await fetch(
      `/api/pipelines/${id}?projectId=${encodeURIComponent(project.id)}`,
      { method: "DELETE" },
    );
    if (res.ok) {
      router.push(`/p/${project.slug}/pipelines`);
      router.refresh();
    } else {
      setBusy(false);
      setOpen(false);
    }
  }

  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Delete
      </Button>
      <ConfirmDialog
        open={open}
        title="Delete pipeline?"
        description="This removes the pipeline from the project."
        confirmLabel={busy ? "Deleting..." : "Delete"}
        cancelLabel="Cancel"
        destructive
        confirmDisabled={busy}
        onCancel={() => setOpen(false)}
        onConfirm={remove}
      />
    </>
  );
}
