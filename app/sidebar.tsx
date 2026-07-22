"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useUser, useClerk } from "@clerk/nextjs";
import {
  Chat,
  Catalog,
  DataShare,
  FlowConnection,
  Download,
  Settings,
  ChevronDown,
  Menu,
  Close,
  type CarbonIconType,
} from "@carbon/icons-react";
import { useProject } from "./project-context";
import { trapFocus } from "./focus-trap";
import type { ProjectCounts } from "@/lib/projects";

// Numbers render with a space thousands separator, matching the sketch
// ("16 789"). sv-SE locale gives exactly that.
function fmt(n: number): string {
  return n.toLocaleString("sv-SE");
}

type Destination = {
  seg: string;
  label: string;
  Icon: CarbonIconType;
};

const DESTINATIONS: Destination[] = [
  { seg: "library", label: "Library", Icon: Catalog },
  { seg: "sources", label: "Sources", Icon: DataShare },
  { seg: "pipelines", label: "Pipelines", Icon: FlowConnection },
];

function CountFor({ seg, counts }: { seg: string; counts: ProjectCounts }) {
  const cls = "font-mono text-xs text-ink-faint";
  if (seg === "library")
    return counts.items ? <span className={cls}>{fmt(counts.items)}</span> : null;
  if (seg === "pipelines")
    return counts.pipelinesActive ? (
      <span className={cls}>{counts.pipelinesActive} active</span>
    ) : null;
  if (seg === "sources")
    return (
      <span className={cls}>
        {counts.sources > 0 ? fmt(counts.sources) : null}
        {counts.sourceErrors > 0 ? (
          <span className="ml-1.5 text-brand">({counts.sourceErrors})</span>
        ) : null}
      </span>
    );
  return null;
}

export function Sidebar() {
  const { project, projects, counts } = useProject();
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useUser();
  const { signOut } = useClerk();

  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"personal" | "client">("personal");
  const [busy, setBusy] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopNav, setDesktopNav] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const base = `/p/${project.slug}`;
  const askHref = `${base}/ask`;

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const update = () => setDesktopNav(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    closeButtonRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Tab") {
        const navigation = document.getElementById("project-navigation");
        if (navigation) trapFocus(event, navigation);
      } else if (event.key === "Escape") {
        setMobileOpen(false);
        requestAnimationFrame(() => menuButtonRef.current?.focus());
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  function isActive(seg: string) {
    return pathname.startsWith(`${base}/${seg}`);
  }

  // Every in-drawer navigation closes the mobile drawer.
  function closeMobile() {
    const shouldRestoreFocus = mobileOpen;
    setMobileOpen(false);
    if (shouldRestoreFocus) requestAnimationFrame(() => menuButtonRef.current?.focus());
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
      closeMobile();
      router.push(`/p/${created.slug}`);
    }
  }

  function openCapture() {
    closeMobile();
    window.dispatchEvent(new CustomEvent("trove:open-capture"));
  }

  return (
    <>
      {/* mobile top bar — the drawer trigger */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-canvas px-4 md:hidden">
        <Link href={base} onClick={closeMobile} className="flex items-center">
          <Image src="/logo.svg" alt="Trove" width={78} height={20} priority />
        </Link>
        <span className="min-w-0 flex-1 truncate text-center text-sm font-medium text-brand">
          {project.name}
        </span>
        <button
          ref={menuButtonRef}
          onClick={() => setMobileOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-dim transition-colors hover:bg-ink/[0.04] hover:text-ink"
          aria-label="open menu"
          aria-expanded={mobileOpen}
          aria-controls="project-navigation"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* backdrop under the open drawer, mobile only */}
      {mobileOpen ? (
        <button
          onClick={closeMobile}
          aria-label="close menu"
          className="fixed inset-0 z-30 bg-ink/20 backdrop-blur-sm md:hidden"
        />
      ) : null}

      <aside
        id="project-navigation"
        inert={!desktopNav && !mobileOpen}
        aria-hidden={!desktopNav && !mobileOpen}
        className={`fixed left-0 top-0 z-40 flex h-[100dvh] w-[280px] flex-col border-r border-line bg-canvas px-5 py-6 transition-transform duration-200 md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* logo row — links home; close button on mobile */}
        <div className="mb-6 flex items-center justify-between px-1">
          <Link href={base} onClick={closeMobile} className="flex items-center">
            <Image src="/logo.svg" alt="Trove" width={78} height={20} priority />
          </Link>
          <button
            ref={closeButtonRef}
            onClick={closeMobile}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-ink/[0.04] hover:text-ink md:hidden"
            aria-label="close menu"
          >
            <Close size={18} />
          </button>
        </div>

        {/* project switcher — always shows the active project */}
        <div className="relative mb-6">
          <button
            onClick={() => setSwitcherOpen((o) => !o)}
            className="flex w-full flex-col gap-0.5 rounded-lg border border-line px-3 py-2 text-left transition-colors hover:border-line-strong"
            aria-expanded={switcherOpen}
          >
            <span className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
                Project
              </span>
              <ChevronDown size={16} className="text-ink-faint" />
            </span>
            <span className="truncate text-[15px] font-medium text-brand">
              {project.name}
            </span>
          </button>

          <AnimatePresence>
            {switcherOpen ? (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="absolute left-0 right-0 top-full z-40 mt-1 rounded-lg border border-line bg-paper p-1 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.18)]"
              >
                <ul className="flex flex-col">
                  {projects.map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/p/${p.slug}`}
                        onClick={() => {
                          setSwitcherOpen(false);
                          closeMobile();
                        }}
                        className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-ink/[0.04] ${
                          p.id === project.id ? "text-brand" : "text-ink-dim"
                        }`}
                      >
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: p.color ?? "var(--color-ink-ghost)" }}
                        />
                        <span className="truncate">{p.name}</span>
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
                      className="w-full rounded-md px-2 py-1.5 text-left text-sm text-ink-dim transition-colors hover:bg-ink/[0.04] hover:text-ink"
                    >
                      + new project
                    </button>
                  )}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* destinations */}
        <nav className="flex flex-col gap-0.5">
          {/* Ask is its own workspace now */}
          <Link
            href={askHref}
            onClick={closeMobile}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[15px] transition-colors ${
              isActive("ask") ? "bg-ink/[0.05] text-ink" : "text-ink hover:bg-ink/[0.03]"
            }`}
          >
            <Chat size={18} className="shrink-0 text-ink-dim" />
            <span>Ask</span>
          </Link>
          {DESTINATIONS.map(({ seg, label, Icon }) => (
            <Link
              key={seg}
              href={`${base}/${seg}`}
              onClick={closeMobile}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[15px] transition-colors ${
                isActive(seg) ? "bg-ink/[0.05] text-ink" : "text-ink hover:bg-ink/[0.03]"
              }`}
            >
              <Icon size={18} className="shrink-0 text-ink-dim" />
              <span>{label}</span>
              <span className="ml-auto">
                <CountFor seg={seg} counts={counts} />
              </span>
            </Link>
          ))}
        </nav>

        {/* actions */}
        <div className="mt-6 flex flex-col gap-0.5 border-t border-line pt-6">
          <button
            onClick={openCapture}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-[15px] text-ink transition-colors hover:bg-ink/[0.03]"
          >
            <Download size={18} className="shrink-0 text-ink-dim" />
            <span>Capture</span>
          </button>
          <Link
            href={`${base}/settings`}
            onClick={closeMobile}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[15px] transition-colors ${
              isActive("settings") ? "bg-ink/[0.05] text-ink" : "text-ink hover:bg-ink/[0.03]"
            }`}
          >
            <Settings size={18} className="shrink-0 text-ink-dim" />
            <span>Settings</span>
          </Link>
        </div>

        {/* user */}
        <div className="mt-auto flex items-start gap-3 px-3 pt-6">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line-strong text-ink-dim">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="3.5" />
              <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" />
            </svg>
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm text-ink">
              {user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? "Account"}
            </span>
            <button
              onClick={() => signOut()}
              className="self-start text-xs text-ink-dim underline underline-offset-2 transition-colors hover:text-ink"
            >
              Log out
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
