"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Close, Add } from "@carbon/icons-react";
import { useProject } from "./project-context";
import { CaptureForm } from "./capture-form";

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

  // Modal open via the sidebar button.
  useEffect(() => {
    function onOpen() {
      setModalOpen(true);
    }
    window.addEventListener("trove:open-capture", onOpen);
    return () => window.removeEventListener("trove:open-capture", onOpen);
  }, []);

  // Escape closes the modal.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setModalOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const uploadFile = useCallback(
    async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      form.append("projectId", project.id);
      setFlash(`capturing ${file.name}…`);
      const res = await fetch("/api/capture", { method: "POST", body: form });
      if (res.ok) {
        setFlash(`captured ${file.name}`);
        startTransition(() => router.refresh());
      } else {
        const err = await res.json().catch(() => ({}));
        setFlash(`error: ${err.error ?? res.status}`);
      }
      setTimeout(() => setFlash(""), 2600);
    },
    [project.id, router]
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
      <AnimatePresence>
        {dragging && !modalOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-3 z-50 flex items-center justify-center rounded-3xl border-2 border-dashed border-capture bg-canvas/70 backdrop-blur-sm"
          >
            <div className="flex flex-col items-center gap-3 text-capture">
              <Add size={40} />
              <p className="font-mono text-sm">drop to capture</p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* capture confirmation flash */}
      <AnimatePresence>
        {flash ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-line bg-paper px-5 py-2.5 font-mono text-xs text-ink shadow-[0_8px_32px_-12px_rgba(0,0,0,0.25)]"
          >
            {flash}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* dedicated capture modal (URL / text / attach) */}
      <AnimatePresence>
        {modalOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setModalOpen(false)}
            className="fixed inset-0 z-50 flex items-start justify-center bg-ink/20 px-6 pt-24 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl"
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
                  capture into {project.name}
                </p>
                <button
                  onClick={() => setModalOpen(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-line text-ink-dim transition-colors hover:border-ink hover:text-ink"
                  aria-label="close"
                >
                  <Close size={16} />
                </button>
              </div>
              <CaptureForm />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
