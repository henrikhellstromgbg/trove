"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Add } from "@carbon/icons-react";
import { useProject } from "./project-context";
import { CaptureForm } from "./capture-form";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui";

// Ambient capture (option B). Drop a file anywhere in the app and it is
// captured straight away — no page to visit. The dedicated form (URL/text
// paste, manual attach) opens as a modal from the sidebar "Capture" button,
// which dispatches "trove:open-capture".
export function CaptureOverlay() {
  const { project } = useProject();
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [flash, setFlash] = useState<string>("");
  const [, startTransition] = useTransition();

  // Modal open via the sidebar button. Radix Dialog owns focus trap, focus
  // return, Escape and scroll lock once open, so nothing else to wire here.
  useEffect(() => {
    function onOpen() {
      setModalOpen(true);
    }
    window.addEventListener("trove:open-capture", onOpen);
    return () => window.removeEventListener("trove:open-capture", onOpen);
  }, []);

  const uploadFile = useCallback(
    async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      form.append("projectId", project.id);
      setFlash(`capturing ${file.name}…`);
      const res = await fetch("/api/ingest", { method: "POST", body: form });
      if (res.ok) {
        setFlash(`captured ${file.name} into ${project.name}`);
        startTransition(() => router.refresh());
      } else {
        const err = await res.json().catch(() => ({}));
        setFlash(`error: ${err.error ?? res.status}`);
      }
      setTimeout(() => setFlash(""), 2600);
    },
    [project.id, project.name, router]
  );

  // Ambient drag-and-drop anywhere on the window.
  useEffect(() => {
    let depth = 0;
    function hasFiles(e: DragEvent) {
      return Array.from(e.dataTransfer?.types ?? []).includes("Files");
    }
    function onEnter(e: DragEvent) {
      if (!hasFiles(e)) return;
      depth += 1;
      setDragging(true);
    }
    function onOver(e: DragEvent) {
      if (hasFiles(e)) e.preventDefault();
    }
    function onLeave() {
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    }
    function onDrop(e: DragEvent) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      // Modal has its own drop handling; don't double-capture.
      if (modalOpen) return;
      const file = e.dataTransfer?.files?.[0];
      if (file) uploadFile(file);
    }
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [modalOpen, uploadFile]);

  return (
    <>
      {/* ambient drop hint */}
      {dragging && !modalOpen ? (
        <div className="pointer-events-none fixed inset-3 z-50 flex items-center justify-center rounded-3xl border-2 border-dashed border-[var(--color-status-success-border)] bg-[var(--color-canvas)]/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 text-[var(--color-status-success-text)]">
            <Add size={40} />
            <p className="font-mono text-sm">drop into {project.name}</p>
          </div>
        </div>
      ) : null}

      {/* capture confirmation flash */}
      {flash ? (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-5 py-2.5 font-mono text-sm text-[var(--color-text-primary)] shadow-[0_8px_32px_-12px_rgba(0,0,0,0.25)]">
          {flash}
        </div>
      ) : null}

      {/* dedicated capture modal (URL / text / attach). The mono title line is
          visual chrome; the Dialog's own title is kept for screen readers. */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="top-16 max-h-[calc(100dvh-6rem)] w-full max-w-2xl translate-y-0 overflow-y-auto rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-0">
          <DialogTitle className="sr-only">Capture into {project.name}</DialogTitle>
          <p className="px-5 pr-14 pt-5 font-mono text-sm text-[var(--color-text-tertiary)] sm:px-8 sm:pr-14">
            capture into <span className="text-[var(--color-brand)]">{project.name}</span>
          </p>
          <CaptureForm />
        </DialogContent>
      </Dialog>
    </>
  );
}
