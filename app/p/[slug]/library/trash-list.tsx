"use client";

import { useState } from "react";
import { motion } from "motion/react";

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
  projectId,
  items,
}: {
  projectId: string;
  items: TrashRow[];
}) {
  const [rows, setRows] = useState<TrashRow[]>(items);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  // Permanent delete is irreversible, so it takes a second click to confirm.
  const [confirming, setConfirming] = useState<string | null>(null);

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
    }
  }

  async function purge(id: string) {
    if (busy[id]) return;
    setBusy((b) => ({ ...b, [id]: true }));
    const res = await fetch(
      `/api/items/${id}?projectId=${encodeURIComponent(projectId)}`,
      { method: "DELETE" }
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
      <p className="font-mono text-sm text-ink-faint">
        trash is empty. items you remove land here first, then clear on their own.
      </p>
    );
  }

  return (
    <ul className="flex flex-col">
      {rows.map((r) => {
        const deleting = r.status === "deleting";
        return (
          <li
            key={r.id}
            className="flex items-center justify-between gap-4 border-b border-line py-4 last:border-b-0"
          >
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
                <span>{r.type}</span>
                <span>·</span>
                <span>{deleting ? "deleting" : `clears ${fmtDate(r.deleteAfterAt)}`}</span>
              </div>
              <span className="truncate text-base font-medium text-ink-dim">
                {r.title ?? r.source ?? "(untitled)"}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {deleting ? (
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-ghost">
                  in progress
                </span>
              ) : confirming === r.id ? (
                <>
                  <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-brand">
                    delete for good?
                  </span>
                  <motion.button
                    onClick={() => purge(r.id)}
                    whileTap={{ scale: 0.97 }}
                    disabled={busy[r.id]}
                    className="rounded-lg border border-brand/60 px-3 py-1.5 text-xs font-medium text-brand transition-colors hover:border-brand disabled:opacity-40"
                  >
                    yes, delete
                  </motion.button>
                  <button
                    onClick={() => setConfirming(null)}
                    className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink-dim transition-colors hover:border-line-strong hover:text-ink"
                  >
                    keep
                  </button>
                </>
              ) : (
                <>
                  <motion.button
                    onClick={() => restore(r.id)}
                    whileTap={{ scale: 0.97 }}
                    disabled={busy[r.id]}
                    className="rounded-lg border border-line-strong bg-paper px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-ink disabled:opacity-40"
                  >
                    restore
                  </motion.button>
                  <button
                    onClick={() => setConfirming(r.id)}
                    disabled={busy[r.id]}
                    className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink-dim transition-colors hover:border-brand/60 hover:text-brand disabled:opacity-40"
                  >
                    delete
                  </button>
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
