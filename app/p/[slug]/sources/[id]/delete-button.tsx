"use client";

import { useReducer } from "react";
import { useRouter } from "next/navigation";
import { useProject } from "@/app/project-context";
import { Button, ConfirmDialog, InlineError } from "@/components/ui";
import { requestJson } from "../request-json";
import { deleteStateReducer, initialDeleteState } from "./delete-state";

/* design-check-exempt: Next.js requires this feature-specific client boundary outside the shared UI library. */
export function DeleteSourceButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const { project } = useProject();
  const [state, dispatch] = useReducer(deleteStateReducer, initialDeleteState);

  async function remove() {
    if (state.busy) return;
    dispatch({ type: "start" });

    const result = await requestJson(
      `/api/sources/${id}?projectId=${encodeURIComponent(project.id)}`,
      { method: "DELETE" }
    );
    if (result.ok) {
      dispatch({ type: "success" });
      router.push(`/p/${project.slug}/sources`);
      router.refresh();
    } else {
      dispatch({ type: "failure", error: result.error });
    }
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <Button variant="destructive" onClick={() => dispatch({ type: "open" })}>
        Delete source
      </Button>
      <ConfirmDialog
        open={state.open}
        title="Delete this source?"
        description={
          <div className="flex flex-col gap-2">
            <span>
              Removing {name ? <>&ldquo;{name}&rdquo;</> : "this source"} stops
              future syncs. Items already imported stay in your Library.
            </span>
            <InlineError message={state.error} />
          </div>
        }
        confirmLabel={state.busy ? "Deleting…" : "Delete source"}
        cancelLabel="Cancel"
        destructive
        confirmDisabled={state.busy}
        onConfirm={remove}
        onCancel={() => dispatch({ type: "cancel" })}
      />
    </div>
  );
}
