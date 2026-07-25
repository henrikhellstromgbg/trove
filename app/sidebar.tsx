"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useUser, useClerk } from "@clerk/nextjs";
import {
  Chat,
  Catalog,
  Categories,
  DataShare,
  FlowConnection,
  Download,
  Settings,
  Archive,
  ChevronDown,
  Menu,
  Close,
  UserAvatar,
  type CarbonIconType,
} from "@carbon/icons-react";
import { useProject } from "./project-context";
import { trapFocus } from "./focus-trap";
import { Button, IconButton, StatusIndicator } from "@/components/ui";
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
  { seg: "topics", label: "Topics", Icon: Categories },
  { seg: "sources", label: "Sources", Icon: DataShare },
  { seg: "pipelines", label: "Pipelines", Icon: FlowConnection },
];

function CountFor({ seg, counts }: { seg: string; counts: ProjectCounts }) {
  const cls = "font-mono text-sm text-[var(--color-text-tertiary)]";
  if (seg === "library")
    return (
      <span className="inline-flex items-center gap-2">
        {counts.items ? <span className={cls}>{fmt(counts.items)}</span> : null}
        {counts.reviewPending > 0 ? (
          <StatusIndicator
            status="review"
            label="to review"
            count={counts.reviewPending}
            className="text-sm"
          />
        ) : null}
      </span>
    );
  if (seg === "topics")
    return counts.topics ? <span className={cls}>{fmt(counts.topics)}</span> : null;
  if (seg === "pipelines")
    return counts.pipelinesActive ? (
      <StatusIndicator
        status="active"
        label="active"
        count={counts.pipelinesActive}
        className="text-sm"
      />
    ) : null;
  if (seg === "sources")
    return (
      <span className="inline-flex items-center gap-2">
        {counts.sources > 0 ? <span className={cls}>{fmt(counts.sources)}</span> : null}
        {counts.sourceErrors > 0 ? (
          <StatusIndicator
            status="error"
            label="errors"
            count={counts.sourceErrors}
            className="text-sm"
          />
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
  const prefersReducedMotion = useReducedMotion();

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
      <div
        className="fixed inset-x-0 top-0 z-30 grid h-14 items-center gap-3 border-b border-[var(--color-border-subtle)] bg-[var(--color-canvas)] px-4 md:hidden"
        style={{ gridTemplateColumns: "78px minmax(0,1fr) 78px" }}
      >
        <div className="flex items-center">
          <Link href={base} onClick={closeMobile} className="flex items-center">
            <Image src="/logo.svg" alt="Trove" width={78} height={20} priority />
          </Link>
        </div>
        <span className="min-w-0 truncate text-center text-sm font-medium text-[var(--color-accent)]">
          {project.name}
        </span>
        <div className="flex items-center justify-self-end">
          <IconButton
            ref={menuButtonRef}
            onClick={() => setMobileOpen(true)}
            label="Open menu"
            aria-expanded={mobileOpen}
            aria-controls="project-navigation"
          >
            <Menu size={20} />
          </IconButton>
        </div>
      </div>

      {/* backdrop under the open drawer, mobile only */}
      {mobileOpen ? (
        <button
          type="button"
          onClick={closeMobile}
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-[var(--color-overlay)] md:hidden"
        />
      ) : null}

      <aside
        id="project-navigation"
        inert={!desktopNav && !mobileOpen}
        aria-hidden={!desktopNav && !mobileOpen}
        className={`fixed left-0 top-0 z-40 flex h-[100dvh] w-[280px] flex-col overflow-y-auto border-r border-[var(--color-border-subtle)] bg-[var(--color-canvas)] px-5 py-6 transition-transform duration-150 md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* logo row — links home; close button on mobile */}
        <div className="mb-6 flex items-center justify-between px-1">
          <Link href={base} onClick={closeMobile} className="flex items-center">
            <Image src="/logo.svg" alt="Trove" width={78} height={20} priority />
          </Link>
          <IconButton
            ref={closeButtonRef}
            onClick={closeMobile}
            label="Close menu"
            className="md:hidden"
          >
            <Close size={18} />
          </IconButton>
        </div>

        {/* project switcher — always shows the active project */}
        <div className="relative mb-6">
          <button
            type="button"
            onClick={() => setSwitcherOpen((o) => !o)}
            className="flex w-full flex-col gap-0.5 rounded-lg border border-[var(--color-border-subtle)] px-3 py-2 text-left transition-colors hover:border-[var(--color-border)]"
            aria-expanded={switcherOpen}
            aria-controls="project-switcher-popup"
          >
            <span className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-tertiary)]">Project</span>
              <ChevronDown size={16} className="text-[var(--color-text-tertiary)]" />
            </span>
            <span className="truncate text-[15px] font-medium text-[var(--color-accent)]">
              {project.name}
            </span>
          </button>

          <AnimatePresence>
            {switcherOpen ? (
              <motion.div
                id="project-switcher-popup"
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 right-0 top-full z-40 mt-1 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-1 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.18)]"
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
                        className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-[var(--color-surface-hover)] ${
                          p.id === project.id ? "text-[var(--color-accent)]" : "text-[var(--color-text-secondary)]"
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

                <div className="mt-1 border-t border-[var(--color-border-subtle)] pt-1">
                  {creating ? (
                    <div className="flex flex-col gap-2 p-2">
                      <input
                        autoFocus
                        aria-label="Project name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") create();
                        }}
                        placeholder="project name"
                        className="w-full bg-transparent text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]"
                      />
                      <div className="flex items-center gap-1 font-mono text-sm">
                        {(["personal", "client"] as const).map((k) => (
                          <button
                            key={k}
                            type="button"
                            onClick={() => setKind(k)}
                            aria-pressed={kind === k}
                            className={`rounded px-2 py-1 ${
                              kind === k ? "bg-[var(--color-primary)] text-[var(--color-text-inverse)]" : "text-[var(--color-text-tertiary)]"
                            }`}
                          >
                            {k === "personal" ? "Personal" : "Client"}
                          </button>
                        ))}
                        <Button
                          variant="secondary"
                          onClick={create}
                          disabled={busy}
                          className="ml-auto"
                        >
                          {busy ? "…" : "Create"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setCreating(true)}
                      className="w-full rounded-md px-2 py-1.5 text-left text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
                    >
                      + New project
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
            aria-current={isActive("ask") ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[15px] transition-colors ${
              isActive("ask") ? "bg-[var(--color-surface-hover)] text-[var(--color-text-primary)]" : "text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
            }`}
          >
            <Chat size={18} className={`shrink-0 ${isActive("ask") ? "text-[var(--color-accent)]" : "text-[var(--color-text-secondary)]"}`} />
            <span className="min-w-0 truncate">Ask</span>
          </Link>
          <Link
            href={`${base}/chats`}
            onClick={closeMobile}
            aria-current={isActive("chats") ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[15px] transition-colors ${
              isActive("chats") ? "bg-[var(--color-surface-hover)] text-[var(--color-text-primary)]" : "text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
            }`}
          >
            <Archive size={18} className={`shrink-0 ${isActive("chats") ? "text-[var(--color-accent)]" : "text-[var(--color-text-secondary)]"}`} />
            <span className="min-w-0 truncate">Chat archive</span>
          </Link>
          {DESTINATIONS.map(({ seg, label, Icon }) => (
            <Link
              key={seg}
              href={`${base}/${seg}`}
              onClick={closeMobile}
              aria-current={isActive(seg) ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[15px] transition-colors ${
                isActive(seg) ? "bg-[var(--color-surface-hover)] text-[var(--color-text-primary)]" : "text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
              }`}
            >
              <Icon size={18} className={`shrink-0 ${isActive(seg) ? "text-[var(--color-accent)]" : "text-[var(--color-text-secondary)]"}`} />
              <span className="min-w-0 truncate">{label}</span>
              <span className="ml-auto shrink-0">
                <CountFor seg={seg} counts={counts} />
              </span>
            </Link>
          ))}
        </nav>

        {/* capture */}
        <div className="mt-6 flex flex-col gap-0.5 border-t border-[var(--color-border-subtle)] pt-6">
          <button
            type="button"
            onClick={openCapture}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-[15px] text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-hover)]"
          >
            <Download size={18} className="shrink-0 text-[var(--color-text-secondary)]" />
            <span className="min-w-0 truncate">Capture</span>
          </button>
        </div>

        {/* settings + account */}
        <div className="mt-auto flex flex-col gap-0.5 border-t border-[var(--color-border-subtle)] pt-6">
          <Link
            href={`${base}/settings`}
            onClick={closeMobile}
            aria-current={isActive("settings") ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[15px] transition-colors ${
              isActive("settings") ? "bg-[var(--color-surface-hover)] text-[var(--color-text-primary)]" : "text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
            }`}
          >
            <Settings size={18} className={`shrink-0 ${isActive("settings") ? "text-[var(--color-accent)]" : "text-[var(--color-text-secondary)]"}`} />
            <span className="min-w-0 truncate">Settings</span>
          </Link>

          <div className="flex items-start gap-3 px-3 pt-6">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-text-secondary)]">
              <UserAvatar size={14} />
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm text-[var(--color-text-primary)]">
                {user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? "Account"}
              </span>
              <button
                type="button"
                onClick={() => signOut()}
                className="self-start text-sm text-[var(--color-text-secondary)] underline underline-offset-2 transition-colors hover:text-[var(--color-text-primary)]"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
