"use client";

import { useState } from "react";
import Link from "next/link";
import { TrashCan } from "@carbon/icons-react";
import { EmptyState } from "@/components/ui";

type Row = {
  id: string;
  title: string | null;
  createdAt: string;
};

type Group = { label: string; rows: Row[] };

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function groupByDay(rows: Row[]): Group[] {
  const today = startOfDay(new Date());
  const yesterday = today - 86_400_000;
  const buckets: Record<string, Row[]> = { today: [], yesterday: [], earlier: [] };
  for (const row of rows) {
    const day = startOfDay(new Date(row.createdAt));
    if (day >= today) buckets.today.push(row);
    else if (day >= yesterday) buckets.yesterday.push(row);
    else buckets.earlier.push(row);
  }
  return [
    { label: "Today", rows: buckets.today },
    { label: "Yesterday", rows: buckets.yesterday },
    { label: "Earlier", rows: buckets.earlier },
  ].filter((g) => g.rows.length > 0);
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
}

export function ChatArchive({
  slug,
  projectId,
  conversations,
}: {
  slug: string;
  projectId: string;
  conversations: Row[];
}) {
  const [rows, setRows] = useState<Row[]>(conversations);

  async function remove(id: string) {
    const res = await fetch(
      `/api/ask?conversationId=${encodeURIComponent(id)}&projectId=${encodeURIComponent(projectId)}`,
      { method: "DELETE" }
    );
    // A 404 means it is already gone; drop it locally either way.
    if (res.ok || res.status === 404) {
      setRows((prev) => prev.filter((r) => r.id !== id));
    }
  }

  if (rows.length === 0) {
    return (
      <EmptyState message="No conversations yet. Ask something and it will be saved here." />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {groupByDay(rows).map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <span className="mb-1 text-sm font-medium text-[var(--color-text-tertiary)]">
            {group.label}
          </span>
          <ul className="flex flex-col">
            {group.rows.map((row) => (
              <li
                key={row.id}
                className="group flex items-center gap-3 border-b border-[var(--color-border-subtle)] last:border-b-0"
              >
                <Link
                  href={`/p/${slug}/ask?conversation=${row.id}`}
                  className="flex min-w-0 flex-1 items-baseline justify-between gap-4 py-4 transition-colors"
                >
                  <span className="min-w-0 truncate text-base text-[var(--color-text-primary)] transition-colors group-hover:text-[var(--color-brand)]">
                    {row.title?.trim() || "Untitled"}
                  </span>
                  <span className="shrink-0 font-mono text-sm text-[var(--color-text-tertiary)]">
                    {timeLabel(row.createdAt)}
                  </span>
                </Link>
                <button
                  onClick={() => remove(row.id)}
                  aria-label="delete conversation"
                  className="shrink-0 rounded-md p-1.5 text-[var(--color-text-tertiary)] opacity-0 transition-opacity hover:text-[var(--color-brand)] focus:opacity-100 group-hover:opacity-100"
                >
                  <TrashCan size={16} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
