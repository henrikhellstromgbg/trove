"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Button, DataList, DataRow } from "@/components/ui";

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
      <p className="text-sm text-[var(--color-text-tertiary)]">
        Nothing waiting. Review rules hold matching items here before they reach the library.
      </p>
    );
  }

  return (
    <DataList>
      {rows.map((r) => (
        <DataRow
          key={r.id}
          href={`/p/${slug}/library/${r.id}`}
          selectLabel={`Open ${r.title ?? r.source ?? "(untitled)"}`}
          leading={
            <span className="font-mono text-sm text-[var(--color-text-tertiary)]">
              {r.type} · {fmtDate(r.capturedAt)}
            </span>
          }
          trailing={
            <div className="flex items-center gap-2">
              <motion.div whileTap={{ scale: 0.97 }}>
                <Button
                  onClick={() => decide(r.id, "approve")}
                  disabled={busy[r.id]}
                  variant="secondary"
                  className="px-3 py-1.5 text-sm"
                >
                  approve
                </Button>
              </motion.div>
              <Button
                onClick={() => decide(r.id, "reject")}
                disabled={busy[r.id]}
                variant="secondary"
                className="px-3 py-1.5 text-sm"
              >
                reject
              </Button>
            </div>
          }
          >
          <div className="flex min-w-0 flex-col gap-1">
            <span className="truncate text-base font-medium text-[var(--color-text-primary)] transition-colors">
              {r.title ?? r.source ?? "(untitled)"}
            </span>
            {r.summary ? (
              <p className="line-clamp-2 max-w-2xl text-sm text-[var(--color-text-secondary)]">
                {r.summary}
              </p>
            ) : null}
          </div>
        </DataRow>
      ))}
    </DataList>
  );
}
