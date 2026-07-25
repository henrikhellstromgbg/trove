"use client";

import { useEffect, useRef, useState, type ElementType } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useUser, useClerk } from "@clerk/nextjs";
import {
  Add,
  Archive,
  Chat,
  ChevronDown,
  Close,
  DataShare,
  DocumentDownload,
  Download,
  Earth,
  FlowConnection,
  Folder,
  Menu,
  Settings,
  UserAvatar,
} from "@/components/icons";
import { useProject } from "./project-context";
import { trapFocus } from "./focus-trap";
import {
  Button,
  IconButton,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  TextField,
  FieldLabel,
} from "@/components/ui";

// Numbers render with a space thousands separator, matching the sketch
// ("16 789"). sv-SE locale gives exactly that.
function fmt(n: number): string {
  return n.toLocaleString("sv-SE");
}

type Destination = {
  seg: string;
  label: string;
  Icon: ElementType;
};

const DESTINATIONS: Destination[] = [
  { seg: "library", label: "Library", Icon: Folder },
  { seg: "topics", label: "Wiki", Icon: Earth },
  { seg: "sources", label: "Sources", Icon: DataShare },
  { seg: "pipelines", label: "Pipelines", Icon: FlowConnection },
  { seg: "ingestions", label: "Ingestions", Icon: DocumentDownload },
];

export function Sidebar() {
  const { project, projects, counts } = useProject();
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useUser();
  const { signOut } = useClerk();

  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"personal" | "client">("personal");
  const [busy, setBusy] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopNav, setDesktopNav] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const base = `/p/${project.slug}`;
  // Ask is the project home now, so it is active only on the exact home path
  // (startsWith would light it up on every sub-route).
  const askActive = pathname === base;

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
      setCreateOpen(false);
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
        className="fixed inset-x-0 top-0 z-[var(--z-sticky)] grid h-14 items-center gap-3 border-b border-[var(--color-border-subtle)] bg-[var(--color-canvas)] px-4 md:hidden"
        style={{ gridTemplateColumns: "78px minmax(0,1fr) 78px" }}
      >
        <div className="flex items-center">
          <Link href={base} onClick={closeMobile} className="flex items-center">
            <Image src="/logo.svg" alt="Trove" width={78} height={20} priority />
          </Link>
        </div>
        <span className="min-w-0 truncate text-center text-sm font-medium text-[var(--color-brand)]">
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
          className="fixed inset-0 z-[var(--z-overlay)] cursor-pointer bg-[var(--color-overlay)] md:hidden"
        />
      ) : null}

      <aside
        id="project-navigation"
        inert={!desktopNav && !mobileOpen}
        aria-hidden={!desktopNav && !mobileOpen}
        className={`fixed left-0 top-0 z-[var(--z-dialog)] flex h-[100dvh] w-[280px] flex-col overflow-y-auto border-r border-[var(--color-border-subtle)] bg-[var(--color-canvas)] px-5 py-5 transition-transform duration-150 md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* logo row — links home; close button on mobile */}
        <div className="mb-5 flex items-center justify-between px-1">
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

        {/* project switcher — the chevron opens a plain list of projects; New
            project is the last item and opens a dialog (U6: a picker selects,
            it never also creates). */}
        <div className="relative mb-4 grid">
          <Button
            variant="secondary"
            onClick={() => setSwitcherOpen((o) => !o)}
            aria-expanded={switcherOpen}
            aria-haspopup="menu"
            aria-controls="project-switcher-popup"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: project.color ?? "var(--color-ink-ghost)" }}
              />
              <span className="truncate text-[15px] font-medium text-[var(--color-brand)]">
                {project.name}
              </span>
            </span>
            <ChevronDown size={16} className="shrink-0 text-[var(--color-text-tertiary)]" />
          </Button>

          <AnimatePresence>
            {switcherOpen ? (
              <motion.div
                id="project-switcher-popup"
                role="menu"
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 right-0 top-full z-[var(--z-dropdown)] mt-1 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-1 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.18)]"
              >
                <ul className="flex flex-col">
                  {projects.map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/p/${p.slug}`}
                        role="menuitem"
                        onClick={() => {
                          setSwitcherOpen(false);
                          closeMobile();
                        }}
                        className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-[var(--color-surface-hover)] ${
                          p.id === project.id ? "text-[var(--color-brand)]" : "text-[var(--color-text-secondary)]"
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

                <div className="mt-1 grid border-t border-[var(--color-border-subtle)] pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSwitcherOpen(false);
                      setCreateOpen(true);
                    }}
                  >
                    <Add size={16} className="shrink-0" />
                    New project
                  </Button>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* create-project dialog, opened from the switcher's last item */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>New project</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-5">
              <TextField
                id="new-project-name"
                label="Project name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") create();
                }}
                placeholder="Acme retainer, personal research…"
              />
              <div className="flex flex-col gap-2">
                <FieldLabel htmlFor="new-project-kind">Kind</FieldLabel>
                <div id="new-project-kind" className="flex gap-2">
                  {(["personal", "client"] as const).map((k) => (
                    <Button
                      key={k}
                      type="button"
                      size="sm"
                      variant={kind === k ? "primary" : "secondary"}
                      aria-pressed={kind === k}
                      onClick={() => setKind(k)}
                    >
                      {k === "personal" ? "Personal" : "Client"}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button variant="primary" onClick={create} loading={busy} disabled={name.trim().length === 0}>
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* destinations */}
        <nav className="flex flex-col gap-px">
          {/* Ask is the project home */}
          <Link
            href={base}
            onClick={closeMobile}
            aria-current={askActive ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-1.5 text-[15px] transition-colors ${
              askActive ? "bg-[var(--color-surface-hover)] text-[var(--color-text-primary)]" : "text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
            }`}
          >
            <Chat size={18} className="shrink-0 text-[var(--color-text-secondary)]" />
            <span className="min-w-0 truncate">Ask</span>
          </Link>
          <Link
            href={`${base}/chats`}
            onClick={closeMobile}
            aria-current={isActive("chats") ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-1.5 text-[15px] transition-colors ${
              isActive("chats") ? "bg-[var(--color-surface-hover)] text-[var(--color-text-primary)]" : "text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
            }`}
          >
            <Archive size={18} className="shrink-0 text-[var(--color-text-secondary)]" />
            <span className="min-w-0 truncate">Chat archive</span>
          </Link>
          {DESTINATIONS.map(({ seg, label, Icon }) => {
            const countClassName = "font-mono tabular-nums text-sm text-[var(--color-text-tertiary)]";
            const count =
              seg === "library" ? (
                <span className="inline-flex items-center gap-2">
                  {counts.items ? <span className={countClassName}>{fmt(counts.items)}</span> : null}
                  {counts.reviewPending > 0 ? (
                    <span
                      className="font-mono tabular-nums text-sm text-[var(--color-status-error-text)]"
                      aria-label={`${fmt(counts.reviewPending)} items to review`}
                    >
                      ({fmt(counts.reviewPending)})
                    </span>
                  ) : null}
                </span>
              ) : seg === "topics" ? (
                counts.topics ? <span className={countClassName}>{fmt(counts.topics)}</span> : null
              ) : seg === "pipelines" ? (
                counts.pipelinesActive ? (
                  <span className={countClassName}>{fmt(counts.pipelinesActive)} active</span>
                ) : null
              ) : seg === "ingestions" ? (
                counts.processing > 0 ? (
                  <span
                    className="font-mono tabular-nums text-sm text-[var(--color-status-error-text)]"
                    aria-label={`${fmt(counts.processing)} items processing`}
                  >
                    ({fmt(counts.processing)})
                  </span>
                ) : null
              ) : (
                <span className="inline-flex items-center gap-2">
                  {counts.sources > 0 ? <span className={countClassName}>{fmt(counts.sources)}</span> : null}
                  {counts.sourceErrors > 0 ? (
                    <span
                      className="font-mono tabular-nums text-sm text-[var(--color-status-error-text)]"
                      aria-label={`${fmt(counts.sourceErrors)} source errors`}
                    >
                      ({fmt(counts.sourceErrors)})
                    </span>
                  ) : null}
                </span>
              );

            return (
              <Link
                key={seg}
                href={seg === "ingestions" ? `${base}#processing` : `${base}/${seg}`}
                onClick={closeMobile}
                aria-current={seg !== "ingestions" && isActive(seg) ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-1.5 text-[15px] transition-colors ${
                  isActive(seg) ? "bg-[var(--color-surface-hover)] text-[var(--color-text-primary)]" : "text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
                }`}
              >
                <Icon size={18} className="shrink-0 text-[var(--color-text-secondary)]" />
                <span className="min-w-0 truncate">{label}</span>
                <span className="ml-auto shrink-0">{count}</span>
              </Link>
            );
          })}
        </nav>

        {/* capture */}
        <div className="mt-4 flex flex-col items-center gap-px border-t border-[var(--color-border-subtle)] pt-4">
          <Button
            variant="ghost"
            onClick={openCapture}
          >
            <Download size={18} className="shrink-0 text-[var(--color-text-secondary)]" />
            <span className="min-w-0 truncate">Capture</span>
          </Button>
        </div>

        {/* settings + account */}
        <div className="mt-auto flex flex-col gap-px border-t border-[var(--color-border-subtle)] pt-4">
          <Link
            href={`${base}/settings`}
            onClick={closeMobile}
            aria-current={isActive("settings") ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-1.5 text-[15px] transition-colors ${
              isActive("settings") ? "bg-[var(--color-surface-hover)] text-[var(--color-text-primary)]" : "text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
            }`}
          >
            <Settings size={18} className="shrink-0 text-[var(--color-text-secondary)]" />
            <span className="min-w-0 truncate">Settings</span>
          </Link>

          <div className="flex items-start gap-3 px-3 pt-4">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-text-secondary)]">
              <UserAvatar size={14} />
            </div>
            <div className="flex min-w-0 flex-col items-start">
              <span className="truncate text-sm text-[var(--color-text-primary)]">
                {user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? "Account"}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => signOut()}
              >
                Log out
              </Button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
