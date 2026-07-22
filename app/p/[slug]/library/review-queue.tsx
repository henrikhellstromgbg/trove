"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";

export type ReviewRow = {
  id: string;
  type: string;
  source: string | null;
  title: string | null;
  summary: string | null;
  capturedAt: string;
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB");
}

export function ReviewQueue({
  slug,
  projectId,
  items,
}: {
  slug: string;
  projectId: string;
  items: ReviewRow[];
}) {
  const [rows, setRows] = useState<ReviewRow[]>(items);
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  async function decide(id: string, decision: "approve" | "reject") {
    if (busy[id]) return;
    setBusy((b) => ({ ...b, [id]: true }));
    const res = await fetch("/api/items/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, itemId: id, decision }),
    });
    if (res.ok) {
      setRows((prev) => prev.filter((r) => r.id !== id));
    } else {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  }

  if (rows.length === 0) {
    return (
      <p className="font-mono text-sm text-ink-faint">
        nothing waiting. review rules hold matching items here before they reach the library.
      </p>
    );
  }

  return (
    <ul className="flex flex-col">
      {rows.map((r) => (
        <li
          key={r.id}
          className="flex items-center justify-between gap-4 border-b border-line py-4 last:border-b-0"
        >
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
              <span>{r.type}</span>
              <span>·</span>
              <span>{fmtDate(r.capturedAt)}</span>
            </div>
            <Link
              href={`/p/${slug}/library/${r.id}`}
              className="truncate text-base font-medium text-ink transition-colors hover:text-brand"
            >
              {r.title ?? r.source ?? "(untitled)"}
            </Link>
            {r.summary ? (
              <p className="line-clamp-2 max-w-2xl text-sm text-ink-dim">{r.summary}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <motion.button
              onClick={() => decide(r.id, "approve")}
              whileTap={{ scale: 0.97 }}
              disabled={busy[r.id]}
              className="rounded-lg border border-capture/50 bg-capture/[0.06] px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-capture disabled:opacity-40"
            >
              approve
            </motion.button>
            <button
              onClick={() => decide(r.id, "reject")}
              disabled={busy[r.id]}
              className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink-dim transition-colors hover:border-line-strong hover:text-ink disabled:opacity-40"
            >
              reject
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
