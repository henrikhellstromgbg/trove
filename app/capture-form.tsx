"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Add } from "@carbon/icons-react";
import { runOnce } from "@/lib/submission-lock";
import { useProject } from "./project-context";

export function CaptureForm() {
  const { project } = useProject();
  const [value, setValue] = useState("");
  const [file, setFile] = useState<File | null>(null);
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
      const f = e.clipboardData?.files?.[0];
      if (f) {
        e.preventDefault();
        setFile(f);
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
    if (!file && trimmed.length === 0) return;

    await runOnce(submittingRef, async () => {
      setSubmitting(true);
      try {
        if (file) {
          setStatus("uploading");
          const form = new FormData();
          form.append("file", file);
          form.append("projectId", project.id);

          const res = await fetch("/api/ingest", { method: "POST", body: form });
          if (res.ok) {
            setFile(null);
            setStatus("saved");
            startTransition(() => router.refresh());
          } else {
            const err = await res.json().catch(() => ({}));
            setStatus(`error ${err.error ?? res.status}`);
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
    const f = e.dataTransfer.files?.[0];
    if (f) {
      setFile(f);
      setValue("");
      setStatus("");
    }
  }

  const ready = !submitting && (!!file || value.trim().length > 0);

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`relative flex w-full flex-col overflow-hidden rounded-2xl border border-line bg-paper px-5 py-8 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-colors sm:px-8 sm:py-14 ${
        isDragging ? "ring-1 ring-capture/50" : ""
      }`}
    >
      {isDragging ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-canvas/60 backdrop-blur-sm">
          <p className="font-mono text-sm text-ink-dim">release to keep</p>
        </div>
      ) : null}

      {/* centered drop affordance: plus + mono headline + mono subline */}
      <div className="flex flex-col items-center text-center">
        <Add size={40} className="text-brand" />
        <p className="mt-6 max-w-xl font-mono text-[15px] font-semibold text-ink">
          PDF, DOCX, XLSX, JPG, PNG, TXT… anything really.
        </p>
        <p className="mt-2 max-w-2xl font-mono text-[13px] leading-relaxed text-ink-faint">
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
            file
              ? "a file is waiting. press capture."
              : "paste a link or type a thought, or just drop a file above."
          }
          disabled={!!file || submitting}
          rows={1}
          className="min-h-[52px] w-full resize-none rounded-lg border border-line-strong bg-canvas/30 px-4 py-3.5 text-base leading-snug text-ink transition-colors placeholder:text-ink-faint hover:border-ink/40 focus:border-ink focus:outline-none disabled:opacity-40"
        />

        {file ? (
          <div className="mt-3 flex items-center justify-between rounded-lg border border-line bg-canvas/40 px-4 py-3 font-mono text-[11px] text-ink-dim">
            <span className="truncate">{file.name}</span>
            <button
              onClick={() => {
                setFile(null);
                setStatus("");
              }}
              className="ml-3 text-ink-faint transition-colors hover:text-ink"
              aria-label="remove file"
            >
              remove
            </button>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
            <span className={status === "saved" ? "text-capture" : ""}>
              {pending ? "settling" : status || "ready"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.docx,.xlsx,.txt,.md,.markdown,.csv,.tsv,.json,.html,.xml,.log,.yaml,.yml"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setFile(f);
                  setValue("");
                  setStatus("");
                }
                e.target.value = "";
              }}
            />
            <button
              onClick={() => inputRef.current?.click()}
              disabled={submitting}
              className="rounded-lg border border-line-strong px-4 py-2 text-sm font-medium text-ink-dim transition-colors hover:border-ink hover:text-ink disabled:opacity-40"
            >
              attach
            </button>
            <button
              onClick={submit}
              disabled={!ready}
              className="rounded-lg border border-line-strong bg-paper px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-ink disabled:opacity-40 disabled:hover:border-line-strong"
            >
              capture
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
