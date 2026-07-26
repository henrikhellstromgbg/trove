"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Add } from "@/components/icons";
import { useProject } from "./project-context";
import { CaptureForm } from "./capture-form";
import { Alert, Dialog, DialogContent, DialogTitle } from "@/components/ui";
import {
  buildCaptureUploadNotice,
  type CaptureUploadNotice,
  captureFilesFromList,
  uploadCaptureFiles,
} from "@/lib/capture-upload";

// Ambient capture (option B). Drop files anywhere in the app and they are
// captured straight away — no page to visit. The dedicated form (URL/text
// paste, manual attach) opens as a modal from the sidebar "Capture" button,
// which dispatches "trove:open-capture".
export function CaptureOverlay() {
  const { project } = useProject();
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<CaptureUploadNotice | null>(null);
  const [, startTransition] = useTransition();
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modal open via the sidebar button. Radix Dialog owns focus trap, focus
  // return, Escape and scroll lock once open, so nothing else to wire here.
  useEffect(() => {
    function onOpen() {
      setModalOpen(true);
    }
    window.addEventListener("trove:open-capture", onOpen);
    return () => window.removeEventListener("trove:open-capture", onOpen);
  }, []);

  useEffect(
    () => () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    },
    []
  );

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
      setNotice({
        variant: "info",
        title: files.length === 1 ? "Capturing file" : `Capturing ${files.length} files`,
        description: `0 of ${files.length} processed for ${project.name}.`,
      });
      const results = await uploadCaptureFiles(
        files,
        project.id,
        fetch,
        (completed, total) =>
          setNotice({
            variant: "info",
            title: total === 1 ? "Capturing file" : `Capturing ${total} files`,
            description: `${completed} of ${total} processed for ${project.name}.`,
          })
      );
      setNotice(buildCaptureUploadNotice(results, project.name));
      if (results.some((result) => result.outcome === "saved")) {
        startTransition(() => router.refresh());
      }
      noticeTimerRef.current = setTimeout(() => setNotice(null), 5200);
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
      const files = captureFilesFromList(e.dataTransfer?.files);
      if (files.length > 0) void uploadFiles(files);
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
  }, [modalOpen, uploadFiles]);

  return (
    <>
      {/* ambient drop hint */}
      {dragging && !modalOpen ? (
        <div className="pointer-events-none fixed inset-3 z-[var(--z-overlay)] flex items-center justify-center rounded-3xl border-2 border-dashed border-[var(--color-status-success-border)] bg-[var(--color-canvas)]/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 text-[var(--color-status-success-text)]">
            <Add size={40} />
            <p className="font-mono text-sm">Drop into {project.name}</p>
          </div>
        </div>
      ) : null}

      {/* capture confirmation flash */}
      {notice ? (
        <div className="fixed inset-x-[var(--space-4)] bottom-[var(--space-6)] z-[var(--z-toast)] mx-auto max-w-2xl">
          <Alert
            variant={notice.variant}
            title={notice.title}
            className="rounded-none border-l-4 shadow-[var(--shadow-lg)]"
          >
            <span className="text-pretty break-words">{notice.description}</span>
          </Alert>
        </div>
      ) : null}

      {/* dedicated capture modal (URL / text / attach). The mono title line is
          visual chrome; the Dialog's own title is kept for screen readers. */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="top-16 max-h-[calc(100dvh-6rem)] w-full max-w-2xl translate-y-0 overflow-y-auto rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-0">
          <DialogTitle className="sr-only">Capture into {project.name}</DialogTitle>
          <p className="px-5 pr-14 pt-5 font-mono text-sm text-[var(--color-text-tertiary)] sm:px-8 sm:pr-14">
            Capture into <span className="text-[var(--color-brand)]">{project.name}</span>
          </p>
          <CaptureForm />
        </DialogContent>
      </Dialog>
    </>
  );
}
