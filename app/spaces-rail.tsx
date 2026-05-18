"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import type { Space } from "@/lib/db/schema";

export function SpacesRail({ spaces }: { spaces: Space[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  async function create() {
    const n = name.trim();
    if (n.length === 0 || busy) return;
    setBusy(true);

    const tagList = tags
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    const res = await fetch("/api/spaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: n, tags: tagList }),
    });

    if (res.ok) {
      setName("");
      setTags("");
      setCreating(false);
      startTransition(() => router.refresh());
    }
    setBusy(false);
  }

  async function remove(id: string) {
    await fetch(`/api/spaces/${id}`, { method: "DELETE" });
    startTransition(() => router.refresh());
  }

  return (
    <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-2xl tracking-tight">spaces</h2>
        <button
          onClick={() => setCreating((c) => !c)}
          className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint hover:text-ink"
        >
          {creating ? "close" : "new"}
        </button>
      </div>

      <p className="font-mono text-[10px] leading-relaxed text-ink-ghost">
        soft groupings by tag. not folders. items can live in many spaces at once.
      </p>

      <AnimatePresence>
        {creating ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 0.61, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="glass-soft flex flex-col gap-2 rounded-2xl p-4">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="name"
                className="bg-transparent font-display text-xl italic text-ink placeholder:text-ink-faint"
              />
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="tags, comma separated"
                className="bg-transparent font-mono text-[11px] text-ink-dim placeholder:text-ink-faint"
              />
              <button
                onClick={create}
                className="mt-1 self-start rounded-full border border-line-strong bg-neutral-50 px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-ink transition-colors hover:bg-neutral-100 hover:border-ink"
              >
                {busy ? "saving" : "save"}
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <ul className="flex flex-col gap-1">
        <li className="font-display text-lg italic text-ink">all</li>
        {spaces.map((s) => (
          <li
            key={s.id}
            className="group flex items-center justify-between py-0.5"
          >
            <span className="font-display text-lg italic text-ink-dim group-hover:text-ink">
              {s.name}
            </span>
            <button
              onClick={() => remove(s.id)}
              className="opacity-0 transition-opacity group-hover:opacity-100 font-mono text-[10px] text-ink-faint hover:text-ember"
              aria-label={`delete space ${s.name}`}
            >
              ×
            </button>
          </li>
        ))}
        {spaces.length === 0 ? (
          <li className="font-mono text-[10px] text-ink-ghost">
            no spaces yet
          </li>
        ) : null}
      </ul>
    </aside>
  );
}
