"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";

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

  const btn =
    "rounded-lg border border-line px-3 py-1.5 text-xs uppercase tracking-wider text-ink-dim transition-colors hover:border-line-strong hover:text-ink disabled:opacity-40";

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-line bg-paper p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setMode(mode === "rename" ? null : "rename")} className={btn}>
          rename
        </button>
        <button onClick={() => setMode(mode === "tags" ? null : "tags")} className={btn}>
          tags
        </button>
        {canReprocess ? (
          <button onClick={reprocess} disabled={busy} className={btn}>
            reprocess
          </button>
        ) : null}
        {otherProjects.length > 0 ? (
          <button onClick={() => setMode(mode === "move" ? null : "move")} className={btn}>
            move
          </button>
        ) : null}
        <button
          onClick={trash}
          disabled={busy}
          className="ml-auto rounded-lg border border-line px-3 py-1.5 text-xs uppercase tracking-wider text-ink-dim transition-colors hover:border-brand/60 hover:text-brand disabled:opacity-40"
        >
          trash
        </button>
      </div>

      {mode === "rename" ? (
        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
            title
          </span>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-transparent text-lg text-ink placeholder:text-ink-faint"
          />
          <div className="flex justify-end">
            <motion.button
              onClick={() => patch({ title })}
              whileTap={{ scale: 0.97 }}
              disabled={busy}
              className="rounded-lg border border-line-strong bg-paper px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-ink disabled:opacity-40"
            >
              save
            </motion.button>
          </div>
        </div>
      ) : null}

      {mode === "tags" ? (
        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
            tags, comma separated
          </span>
          <input
            autoFocus
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="research, to-read, pricing"
            className="bg-transparent font-mono text-sm text-ink placeholder:text-ink-faint"
          />
          <div className="flex justify-end">
            <motion.button
              onClick={() => patch({ tags: parseTags(tags) })}
              whileTap={{ scale: 0.97 }}
              disabled={busy}
              className="rounded-lg border border-line-strong bg-paper px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-ink disabled:opacity-40"
            >
              save
            </motion.button>
          </div>
        </div>
      ) : null}

      {mode === "move" ? (
        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
            move to project
          </span>
          <select
            value={dest}
            onChange={(e) => setDest(e.target.value)}
            className="rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink"
          >
            {otherProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-ink-faint">
            a captured item moves; one that came from a source is copied instead, so the source keeps its own.
          </p>
          <div className="flex justify-end">
            <motion.button
              onClick={move}
              whileTap={{ scale: 0.97 }}
              disabled={busy}
              className="rounded-lg border border-line-strong bg-paper px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-ink disabled:opacity-40"
            >
              move here
            </motion.button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="border-t border-line pt-3 text-xs text-brand">{error}</p>
      ) : null}
    </div>
  );
}
