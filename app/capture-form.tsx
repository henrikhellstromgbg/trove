"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";

export function CaptureForm() {
  const [value, setValue] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>("");
  const [pending, startTransition] = useTransition();
  const [isDragging, setIsDragging] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  async function submit() {
    if (file) {
      setStatus("uploading");
      const form = new FormData();
      form.append("file", file);

      const res = await fetch("/api/capture", { method: "POST", body: form });
      if (res.ok) {
        setFile(null);
        setStatus("saved");
        startTransition(() => router.refresh());
      } else {
        const err = await res.json().catch(() => ({}));
        setStatus(`error: ${err.error ?? res.status}`);
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
      }),
    });

    if (res.ok) {
      setValue("");
      setStatus("saved");
      startTransition(() => router.refresh());
    } else {
      const err = await res.json().catch(() => ({}));
      setStatus(`error: ${err.error ?? res.status}`);
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

  const dropTone = isDragging ? "border-black/40 bg-black/[0.02]" : "border-black/10";

  return (
    <div
      className={`flex w-full max-w-xl flex-col gap-2 rounded-md border ${dropTone} p-3 transition-colors`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
        }}
        placeholder={
          file
            ? "File ready below. Click capture to upload."
            : "Paste a link, type anything, or drop a file (PDF, image, doc, sheet, text). ⌘↩ to save."
        }
        disabled={!!file}
        className="min-h-[100px] resize-y rounded-md bg-transparent p-1 text-sm outline-none disabled:opacity-40"
      />

      {file ? (
        <div className="flex items-center justify-between rounded bg-black/[0.04] px-2 py-1 text-xs">
          <span className="truncate">{file.name}</span>
          <button
            onClick={() => {
              setFile(null);
              setStatus("");
            }}
            className="ml-2 text-black/40 hover:text-black"
            aria-label="remove file"
          >
            ×
          </button>
        </div>
      ) : null}

      <div className="flex items-center justify-between text-xs text-black/50">
        <span>{pending ? "refreshing" : status}</span>
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
            className="rounded-md border border-black/10 px-3 py-1 text-xs hover:border-black/30"
          >
            file
          </button>
          <button
            onClick={submit}
            disabled={!file && value.trim().length === 0}
            className="rounded-md border border-black/10 px-3 py-1 text-xs hover:border-black/30 disabled:opacity-30"
          >
            capture
          </button>
        </div>
      </div>
    </div>
  );
}
