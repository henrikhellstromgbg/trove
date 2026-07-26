"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Add } from "@/components/icons";
import { runOnce } from "@/lib/submission-lock";
import { useProject } from "./project-context";
import { Button } from "@/components/ui";
import { statusLabel } from "@/lib/status-label";
import {
  formatCaptureUploadStatus,
  uploadCaptureFiles,
} from "@/lib/capture-upload";

export function CaptureForm() {
  const { project } = useProject();
  const [value, setValue] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<string>("");
  const [pending, startTransition] = useTransition();
  const [isDragging, setIsDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;
      const pastedFiles = Array.from(e.clipboardData?.files ?? []);
      if (pastedFiles.length > 0) {
        e.preventDefault();
        setFiles((current) => [...current, ...pastedFiles]);
        setValue("");
        setStatus("");
        return;
      }
      const text = e.clipboardData?.getData("text");
      if (text) {
        setValue((v) => (v ? v + "\n" + text : text));
        textRef.current?.focus();
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  async function submit() {
    const trimmed = value.trim();
    if (files.length === 0 && trimmed.length === 0) return;

    await runOnce(submittingRef, async () => {
      setSubmitting(true);
      try {
        if (files.length > 0) {
          const queuedFiles = files;
          setStatus(`Uploading 0/${queuedFiles.length}`);
          const results = await uploadCaptureFiles(
            queuedFiles,
            project.id,
            fetch,
            (completed, total) => setStatus(`Uploading ${completed}/${total}`)
          );
          setFiles(
            results
              .filter((result) => result.outcome === "error")
              .map((result) => result.file)
          );
          setStatus(formatCaptureUploadStatus(results));
          if (results.some((result) => result.outcome === "saved")) {
            startTransition(() => router.refresh());
          }
          return;
        }

        const looksLikeUrl = /^https?:\/\//i.test(trimmed);
        setStatus("saving");

        const res = await fetch("/api/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: looksLikeUrl ? "url" : "text",
            text: trimmed,
            projectId: project.id,
          }),
        });

        if (res.ok) {
          setValue("");
          setStatus("saved");
          startTransition(() => router.refresh());
        } else {
          const err = await res.json().catch(() => ({}));
          setStatus(`error ${err.error ?? res.status}`);
        }
      } catch {
        setStatus("connection error");
      } finally {
        setSubmitting(false);
      }
    });
  }

  function onDragOver(e: React.DragEvent) {
    if (e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
      setIsDragging(true);
    }
  }

  function onDragLeave() {
    setIsDragging(false);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files ?? []);
    if (droppedFiles.length > 0) {
      setFiles((current) => [...current, ...droppedFiles]);
      setValue("");
      setStatus("");
    }
  }

  const ready = !submitting && (files.length > 0 || value.trim().length > 0);
  const successfulStatus = status === "File saved" || /files saved$/.test(status);

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`relative flex w-full flex-col overflow-hidden px-5 pb-8 pt-4 transition-colors sm:px-8 sm:pb-14 sm:pt-6 ${
        isDragging ? "ring-1 ring-[var(--color-status-success)]" : ""
      }`}
    >
      {isDragging ? (
        <div className="pointer-events-none absolute inset-0 z-[var(--z-overlay)] flex items-center justify-center bg-[var(--color-canvas)]/60 backdrop-blur-sm">
          <p className="font-mono text-sm text-[var(--color-text-secondary)]">Release to keep</p>
        </div>
      ) : null}

      {/* centered drop affordance: plus + mono headline + mono subline */}
      <div className="flex flex-col items-center text-center">
        <Add size={40} className="text-[var(--color-brand)]" />
        <p className="mt-6 max-w-xl font-mono text-[15px] font-semibold text-[var(--color-text-primary)]">
          PDF, DOCX, XLSX, JPG, PNG, TXT… anything really.
        </p>
        <p className="mt-2 max-w-2xl font-mono text-sm leading-relaxed text-[var(--color-text-tertiary)]">
          Drop anything. I&apos;ll organize it, preserve the original, and make
          it searchable, browsable, and askable.
        </p>
      </div>

      {/* input */}
      <div className="mx-auto mt-8 w-full max-w-xl">
        <textarea
          ref={textRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
          }}
          placeholder={
            files.length > 0
              ? files.length === 1
                ? "A file is waiting. Press capture."
                : `${files.length} files are waiting. Press capture.`
              : "Paste a link or type a thought, or just drop a file above."
          }
          disabled={files.length > 0 || submitting}
          rows={1}
          className="min-h-[52px] w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-canvas)]/30 px-4 py-3.5 text-base leading-snug text-[var(--color-text-primary)] transition-colors placeholder:text-[var(--color-text-tertiary)] hover:border-[var(--color-border-strong)] focus:border-[var(--color-border-strong)] disabled:opacity-40"
        />

        {files.length > 0 ? (
          <div className="mt-3 divide-y divide-[var(--color-border-subtle)] overflow-hidden rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-canvas)]/40 font-mono text-sm text-[var(--color-text-secondary)]">
            {files.map((file, index) => (
              <div
                key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
                className="flex items-center justify-between px-4 py-3"
              >
                <span className="truncate">{file.name}</span>
                <div className="-mr-2 ml-3 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFiles((current) =>
                        current.filter((_, fileIndex) => fileIndex !== index)
                      );
                      setStatus("");
                    }}
                    aria-label={`Remove ${file.name}`}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 font-mono text-sm text-[var(--color-text-tertiary)]">
            <span className={successfulStatus ? "text-[var(--color-status-success-text)]" : ""}>
              {pending ? "Settling" : statusLabel(status) || "Ready"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.docx,.xlsx,.txt,.md,.markdown,.csv,.tsv,.json,.html,.xml,.log,.yaml,.yml"
              className="hidden"
              onChange={(e) => {
                const selectedFiles = Array.from(e.target.files ?? []);
                if (selectedFiles.length > 0) {
                  setFiles((current) => [...current, ...selectedFiles]);
                  setValue("");
                  setStatus("");
                }
                e.target.value = "";
              }}
            />
            <Button
              variant="secondary"
              onClick={() => inputRef.current?.click()}
              disabled={submitting}
            >
              Attach
            </Button>
            <Button
              variant="primary"
              onClick={submit}
              disabled={!ready}
            >
              Capture
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
