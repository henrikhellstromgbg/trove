"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProject } from "./project-context";

export function CaptureForm() {
  const { project } = useProject();
  const [value, setValue] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>("");
  const [pending, startTransition] = useTransition();
  const [isDragging, setIsDragging] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

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
    if (file) {
      setStatus("uploading");
      const form = new FormData();
      form.append("file", file);
      form.append("projectId", project.id);

      const res = await fetch("/api/capture", { method: "POST", body: form });
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

    const trimmed = value.trim();
    if (trimmed.length === 0) return;

    const looksLikeUrl = /^https?:\/\//i.test(trimmed);
    setStatus("saving");

    const res = await fetch("/api/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: looksLikeUrl ? "url" : "text",
        content: trimmed,
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

  const ready = !!file || value.trim().length > 0;

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`relative flex w-full flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-colors ${
        isDragging ? "ring-1 ring-silver/60" : ""
      }`}
    >
      {isDragging ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-canvas/50 backdrop-blur-sm">
          <p className="text-lg text-ink-dim">release to keep</p>
        </div>
      ) : null}

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
            : "paste a link, type a thought, drop a file. nothing is too small."
        }
        disabled={!!file}
        rows={4}
        className="min-h-[160px] resize-none bg-transparent px-8 pb-2 pt-8 text-lg leading-snug text-ink placeholder:text-ink-faint disabled:opacity-40"
      />

      {file ? (
        <div className="mx-8 mt-1 flex items-center justify-between rounded-2xl border border-line bg-canvas/40 px-4 py-3 font-mono text-[11px] text-ink-dim">
          <span className="truncate">{file.name}</span>
          <button
            onClick={() => {
              setFile(null);
              setStatus("");
            }}
            className="ml-3 text-ink-faint hover:text-ink"
            aria-label="remove file"
          >
            remove
          </button>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-4 px-8 py-5">
        <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
          <span className={status === "saved" ? "text-silver" : ""}>
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
            className="rounded-lg border border-line-strong px-4 py-2 text-sm font-medium text-ink-dim transition-colors hover:border-ink hover:text-ink"
          >
            attach
          </button>
          <button
            onClick={submit}
            className="rounded-lg border border-line-strong bg-paper px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-ink"
          >
            capture
          </button>
        </div>
      </div>
    </div>
  );
}
