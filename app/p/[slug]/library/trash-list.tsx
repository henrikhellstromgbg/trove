"use client";

import { useState } from "react";
import { motion } from "motion/react";
import {
  Button,
  ConfirmDialog,
  DataList,
  DataRow,
} from "@/components/ui";

export type TrashRow = {
  id: string;
  type: string;
  source: string | null;
  title: string | null;
  status: string;
  deleteAfterAt: string;
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB");
}

export function TrashList({
  slug,
  projectId,
  items,
  }: {
  slug: string;
  projectId: string;
  items: TrashRow[];
}) {
  const [rows, setRows] = useState<TrashRow[]>(items);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [confirming, setConfirming] = useState<TrashRow | null>(null);

  async function restore(id: string) {
    if (busy[id]) return;
    setBusy((b) => ({ ...b, [id]: true }));
    const res = await fetch(`/api/items/${id}/restore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
    if (res.ok) {
      setRows((prev) => prev.filter((r) => r.id !== id));
    } else {
      setBusy((b) => ({ ...b, [id]: false }));
      setConfirming(null);
    }
  }

  async function purge(id: string) {
    if (busy[id]) return;
    setBusy((b) => ({ ...b, [id]: true }));
    const res = await fetch(
      `/api/items/${id}?projectId=${encodeURIComponent(projectId)}`,
      { method: "DELETE" },
    );
    if (res.ok) {
      setRows((prev) => prev.filter((r) => r.id !== id));
    } else {
      setBusy((b) => ({ ...b, [id]: false }));
      setConfirming(null);
    }
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-[var(--color-text-tertiary)]">
        Trash is empty. Items you remove land here first, then clear on their own.
      </p>
    );
  }

  return (
    <>
      <DataList>
        {rows.map((r) => {
          const deleting = r.status === "deleting";
          return (
            <DataRow
              key={r.id}
              href={`/p/${slug}/library/${r.id}`}
              selectLabel={`Open ${r.title ?? r.source ?? "(untitled)"}`}
              leading={
                <span className="font-mono text-sm text-[var(--color-text-tertiary)]">
                  {r.type} · {deleting ? "deleting" : `clears ${fmtDate(r.deleteAfterAt)}`}
                </span>
              }
              trailing={
                <div className="flex items-center gap-2">
                  {deleting ? (
                    <span className="text-sm font-medium text-[var(--color-text-tertiary)]">
                      in progress
                    </span>
                  ) : (
                    <>
                      <motion.div whileTap={{ scale: 0.97 }}>
                        <Button
                          onClick={() => restore(r.id)}
                          disabled={busy[r.id]}
                          variant="secondary"
                          className="px-3 py-1.5 text-sm"
                        >
                          Restore
                        </Button>
                      </motion.div>
                      <Button
                        onClick={() => setConfirming(r)}
                        disabled={busy[r.id]}
                        variant="destructive"
                        className="px-3 py-1.5 text-sm"
                      >
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              }
            >
              <div className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-base font-medium text-[var(--color-text-secondary)]">
                  {r.title ?? r.source ?? "(untitled)"}
                </span>
              </div>
            </DataRow>
          );
        })}
      </DataList>
      <ConfirmDialog
        open={confirming !== null}
        title="Delete permanently?"
        description="This removes the item from trash and cannot be undone."
        confirmLabel={confirming && busy[confirming.id] ? "Deleting..." : "Delete"}
        cancelLabel="Keep"
        destructive
        confirmDisabled={confirming ? !!busy[confirming.id] : false}
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          if (confirming) void purge(confirming.id);
        }}
      />
    </>
  );
}
