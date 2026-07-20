"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useProject } from "./project-context";
import { UserMenu } from "./user-menu";

const NAV = [
  { seg: "", label: "capture" },
  { seg: "wiki", label: "wiki" },
  { seg: "sources", label: "sources" },
  { seg: "pipelines", label: "pipelines" },
  { seg: "digest", label: "digest" },
];

export function Sidebar() {
  const { project, projects } = useProject();
  const pathname = usePathname();
  const router = useRouter();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"personal" | "client">("personal");
  const [busy, setBusy] = useState(false);

  const base = `/p/${project.slug}`;

  function hrefFor(seg: string) {
    return seg ? `${base}/${seg}` : base;
  }

  function isActive(seg: string) {
    const href = hrefFor(seg);
    return seg ? pathname.startsWith(href) : pathname === base;
  }

  async function create() {
    const n = name.trim();
    if (n.length === 0 || busy) return;
    setBusy(true);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: n, kind }),
    });
    setBusy(false);
    if (res.ok) {
      const { project: created } = await res.json();
      setName("");
      setCreating(false);
      setSwitcherOpen(false);
      router.push(`/p/${created.slug}`);
    }
  }

  return (
    <aside className="fixed left-0 top-0 z-30 flex h-screen w-60 flex-col border-r border-line px-4 py-5">
      <Link href={base} className="mb-6 flex items-center px-2">
        <img src="/logo.svg" alt="Trove" className="h-6 w-auto" />
      </Link>

      {/* project switcher */}
      <div className="relative mb-6">
        <button
          onClick={() => setSwitcherOpen((o) => !o)}
          className="flex w-full items-center justify-between rounded-xl border border-line px-3 py-2 text-left transition-colors hover:border-line-strong"
        >
          <span className="flex items-center gap-2 truncate">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: project.color ?? "var(--color-ink-faint, #999)" }}
            />
            <span className="truncate text-sm text-ink">{project.name}</span>
          </span>
          <span className="font-mono text-[10px] text-ink-faint">▾</span>
        </button>

        <AnimatePresence>
          {switcherOpen ? (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="absolute left-0 right-0 top-full z-40 mt-1 rounded-xl border border-line bg-canvas p-1 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.18)]"
            >
              <ul className="flex flex-col">
                {projects.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/p/${p.slug}`}
                      onClick={() => setSwitcherOpen(false)}
                      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-ink/[0.04] ${
                        p.id === project.id ? "text-ink" : "text-ink-dim"
                      }`}
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: p.color ?? "var(--color-ink-faint, #999)" }}
                      />
                      <span className="truncate">{p.name}</span>
                      {p.id === project.id ? (
                        <span className="ml-auto font-mono text-[10px] text-ink-faint">·</span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>

              <div className="mt-1 border-t border-line pt-1">
                {creating ? (
                  <div className="flex flex-col gap-2 p-2">
                    <input
                      autoFocus
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") create();
                      }}
                      placeholder="project name"
                      className="w-full bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
                    />
                    <div className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider">
                      {(["personal", "client"] as const).map((k) => (
                        <button
                          key={k}
                          onClick={() => setKind(k)}
                          className={`rounded px-2 py-1 ${
                            kind === k ? "bg-ink text-canvas" : "text-ink-faint"
                          }`}
                        >
                          {k}
                        </button>
                      ))}
                      <button
                        onClick={create}
                        disabled={busy}
                        className="ml-auto rounded px-2 py-1 text-ink hover:text-ink disabled:opacity-40"
                      >
                        {busy ? "…" : "create"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setCreating(true)}
                    className="w-full rounded-lg px-2 py-1.5 text-left text-sm text-ink-dim transition-colors hover:bg-ink/[0.04] hover:text-ink"
                  >
                    + new project
                  </button>
                )}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* nav */}
      <nav className="flex flex-col gap-0.5">
        {NAV.map((n) => (
          <Link
            key={n.seg}
            href={hrefFor(n.seg)}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
              isActive(n.seg)
                ? "bg-ink/[0.05] text-ink"
                : "text-ink-faint hover:text-ink-dim"
            }`}
          >
            {n.label}
          </Link>
        ))}
      </nav>

      <div className="mt-auto flex items-center px-2">
        <UserMenu />
      </div>
    </aside>
  );
}
