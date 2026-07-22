"use client";

import { useEffect, useState } from "react";
import { TrashCan } from "@carbon/icons-react";

type ConversationRow = {
  id: string;
  title: string | null;
  createdAt: string;
};

type Group = { label: string; rows: ConversationRow[] };

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

// Bucket threads into today / yesterday / earlier by capture day.
function groupByDay(rows: ConversationRow[]): Group[] {
  const today = startOfDay(new Date());
  const yesterday = today - 86_400_000;
  const buckets: Record<string, ConversationRow[]> = {
    today: [],
    yesterday: [],
    earlier: [],
  };
  for (const row of rows) {
    const day = startOfDay(new Date(row.createdAt));
    if (day >= today) buckets.today.push(row);
    else if (day >= yesterday) buckets.yesterday.push(row);
    else buckets.earlier.push(row);
  }
  return [
    { label: "today", rows: buckets.today },
    { label: "yesterday", rows: buckets.yesterday },
    { label: "earlier", rows: buckets.earlier },
  ].filter((g) => g.rows.length > 0);
}

export function ConversationList({
  projectId,
  activeId,
  listVersion,
  onPick,
  onNew,
}: {
  projectId: string;
  activeId: string | null;
  listVersion: number;
  onPick: (id: string) => void;
  onNew: () => void;
}) {
  const [rows, setRows] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch(`/api/ask?projectId=${encodeURIComponent(projectId)}`)
      .then((r) => (r.ok ? r.json() : { conversations: [] }))
      .then((data: { conversations?: ConversationRow[] }) => {
        if (alive) setRows(data.conversations ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [projectId, listVersion]);

  async function remove(id: string) {
    const res = await fetch(
      `/api/ask?conversationId=${encodeURIComponent(id)}&projectId=${encodeURIComponent(projectId)}`,
      { method: "DELETE" }
    );
    // A 404 means it is already gone; drop it locally either way.
    if (res.ok || res.status === 404) {
      setRows((prev) => prev.filter((r) => r.id !== id));
      if (id === activeId) onNew();
    }
  }

  const groups = groupByDay(rows);

  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={onNew}
        className="w-full rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm font-medium text-ink transition-colors hover:border-ink"
      >
        + new chat
      </button>

      {loading ? (
        <p className="font-mono text-[11px] lowercase tracking-wide text-ink-faint">
          loading…
        </p>
      ) : rows.length === 0 ? (
        <p className="font-mono text-[11px] lowercase tracking-wide text-ink-faint">
          no conversations yet
        </p>
      ) : (
        groups.map((group) => (
          <div key={group.label} className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
              {group.label}
            </span>
            <ul className="flex flex-col">
              {group.rows.map((row) => {
                const active = row.id === activeId;
                return (
                  <li key={row.id} className="group flex items-center gap-1">
                    <button
                      onClick={() => onPick(row.id)}
                      className={`min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                        active
                          ? "bg-ink/[0.05] text-ink"
                          : "text-ink-dim hover:bg-ink/[0.03] hover:text-ink"
                      }`}
                    >
                      {row.title?.trim() || "untitled"}
                    </button>
                    <button
                      onClick={() => remove(row.id)}
                      aria-label="delete conversation"
                      className="shrink-0 rounded-md p-1.5 text-ink-faint opacity-0 transition-opacity hover:text-brand focus:opacity-100 group-hover:opacity-100"
                    >
                      <TrashCan size={14} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}
