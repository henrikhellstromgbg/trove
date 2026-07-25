"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

type OtherProject = { id: string; name: string; slug: string };

type Mode = "rename" | "tags" | "move" | null;

export function ItemActions({
  slug,
  projectId,
  itemId,
  initialTitle,
  initialTags,
  status,
  otherProjects,
}: {
  slug: string;
  projectId: string;
  itemId: string;
  initialTitle: string | null;
  initialTags: string[];
  status: string;
  otherProjects: OtherProject[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [title, setTitle] = useState(initialTitle ?? "");
  const [tags, setTags] = useState(initialTags.join(", "));
  const [dest, setDest] = useState(otherProjects[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const canReprocess = status === "ready" || status === "failed";

  function parseTags(text: string): string[] {
    return [
      ...new Set(
        text
          .split(/[\n,]/)
          .map((t) => t.trim())
          .filter((t) => t.length > 0)
      ),
    ];
  }

  async function patch(patchBody: Record<string, unknown>) {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, ...patchBody }),
    });
    setBusy(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setError(err.error ?? `error ${res.status}`);
      return false;
    }
    setMode(null);
    router.refresh();
    return true;
  }

  async function reprocess() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/items/${itemId}/reprocess`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
    setBusy(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setError(err.error ?? `error ${res.status}`);
      return;
    }
    router.refresh();
  }

  async function move() {
    if (!dest) return;
    setBusy(true);
    setError("");
    const res = await fetch(`/api/items/${itemId}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toProjectId: dest }),
    });
    setBusy(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setError(err.error ?? `error ${res.status}`);
      return;
    }
    const result = await res.json();
    const destProject = otherProjects.find((p) => p.id === dest);
    // A manual item is moved (same id in the new project); a source item is
    // copied (a fresh id). Follow the item to wherever it now lives.
    const targetId = result.action === "copied" ? result.newItemId : itemId;
    if (destProject && targetId) {
      router.push(`/p/${destProject.slug}/library/${targetId}`);
    } else {
      router.refresh();
    }
  }

  async function trash() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/items/trash`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, itemId }),
    });
    setBusy(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setError(err.error ?? `error ${res.status}`);
      return;
    }
    router.push(`/p/${slug}/library?view=trash`);
  }

  return (
    <div className="flex flex-col gap-4 border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() => setMode(mode === "rename" ? null : "rename")}
          variant="secondary"
          className="px-3 py-1.5 text-sm"
        >
          Rename
        </Button>
        <Button
          onClick={() => setMode(mode === "tags" ? null : "tags")}
          variant="secondary"
          className="px-3 py-1.5 text-sm"
        >
          Tags
        </Button>
        {canReprocess ? (
          <Button onClick={reprocess} disabled={busy} variant="secondary" className="px-3 py-1.5 text-sm">
            Reprocess
          </Button>
        ) : null}
        {otherProjects.length > 0 ? (
          <Button
            onClick={() => setMode(mode === "move" ? null : "move")}
            variant="secondary"
            className="px-3 py-1.5 text-sm"
          >
            Move
          </Button>
        ) : null}
        <Button
          onClick={trash}
          disabled={busy}
          variant="destructive"
          className="ml-auto px-3 py-1.5 text-sm"
        >
          Trash
        </Button>
      </div>

      {mode === "rename" ? (
        <div className="flex flex-col gap-2 border-t border-[var(--color-border-subtle)] pt-4">
          <p className="text-sm font-medium text-[var(--color-text-tertiary)]">Title</p>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-transparent text-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]"
          />
          <div className="flex justify-end">
            <Button onClick={() => patch({ title })} disabled={busy} variant="secondary">
              Save
            </Button>
          </div>
        </div>
      ) : null}

      {mode === "tags" ? (
        <div className="flex flex-col gap-2 border-t border-[var(--color-border-subtle)] pt-4">
          <p className="text-sm font-medium text-[var(--color-text-tertiary)]">Tags, comma separated</p>
          <input
            autoFocus
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="research, to-read, pricing"
            className="bg-transparent font-mono text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]"
          />
          <div className="flex justify-end">
            <Button onClick={() => patch({ tags: parseTags(tags) })} disabled={busy} variant="secondary">
              Save
            </Button>
          </div>
        </div>
      ) : null}

      {mode === "move" ? (
        <div className="flex flex-col gap-2 border-t border-[var(--color-border-subtle)] pt-4">
          <p className="text-sm font-medium text-[var(--color-text-tertiary)]">Move to project</p>
          <select
            value={dest}
            onChange={(e) => setDest(e.target.value)}
            className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-canvas)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
          >
            {otherProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <p className="text-sm text-[var(--color-text-tertiary)]">
            a captured item moves; one that came from a source is copied instead, so the source keeps its own.
          </p>
          <div className="flex justify-end">
            <Button onClick={move} disabled={busy} variant="secondary">
              Move here
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="border-t border-[var(--color-border-subtle)] pt-3 text-sm text-[var(--color-accent)]">{error}</p>
      ) : null}
    </div>
  );
}
