"use client";

import { useState } from "react";
import Link from "next/link";
import { TrashCan } from "@/components/icons";
import { Button, ConfirmDialog, DataList, DataRow, EmptyState, IconButton, InlineError } from "@/components/ui";

type AnswerRow = {
  id: string;
  title: string;
  updatedAt: string;
  sourceCount: number;
};

export function AnswersList({
  slug,
  projectId,
  answers,
}: {
  slug: string;
  projectId: string;
  answers: AnswerRow[];
}) {
  const [rows, setRows] = useState(answers);
  const [deleting, setDeleting] = useState<AnswerRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function remove() {
    if (!deleting || busy) return;
    setBusy(true);
    const response = await fetch(
      `/api/answers/${encodeURIComponent(deleting.id)}?projectId=${encodeURIComponent(projectId)}`,
      { method: "DELETE" }
    );
    if (response.ok || response.status === 404) {
      setRows((current) => current.filter((row) => row.id !== deleting.id));
      setDeleting(null);
    } else {
      setDeleteError("The answer could not be deleted. Try again.");
    }
    setBusy(false);
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        message="No answers yet. Your Ask sessions will appear here automatically."
        action={
          <Button asChild variant="secondary">
            <Link href={`/p/${slug}`}>Go to Ask</Link>
          </Button>
        }
      />
    );
  }

  return (
    <>
      <DataList>
        {rows.map((row) => (
          <DataRow
            key={row.id}
            href={`/p/${slug}/answers/${row.id}`}
            selectLabel={`Open answer ${row.title}`}
            trailing={
              <IconButton
                onClick={() => {
                  setDeleteError(null);
                  setDeleting(row);
                }}
                label={`Delete ${row.title}`}
              >
                <TrashCan size={16} />
              </IconButton>
            }
          >
            <div className="flex min-w-0 items-baseline justify-between gap-4 py-1">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-base text-[var(--color-text-primary)]">{row.title}</span>
                <span className="text-sm text-[var(--color-text-tertiary)]">Based on {row.sourceCount} sources</span>
              </div>
              <time className="shrink-0 font-mono text-sm text-[var(--color-text-tertiary)]" dateTime={row.updatedAt}>
                {new Date(row.updatedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
              </time>
            </div>
          </DataRow>
        ))}
      </DataList>
      <ConfirmDialog
        open={deleting != null}
        title="Delete answer?"
        description={
          <div className="flex flex-col gap-2">
            <span>This removes the answer and its activity from the project.</span>
            <InlineError message={deleteError} />
          </div>
        }
        confirmLabel={busy ? "Deleting…" : "Delete"}
        cancelLabel="Cancel"
        destructive
        confirmDisabled={busy}
        onCancel={() => {
          setDeleteError(null);
          setDeleting(null);
        }}
        onConfirm={remove}
      />
    </>
  );
}
