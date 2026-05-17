"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function CaptureForm() {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<string>("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function submit() {
    const trimmed = value.trim();
    if (trimmed.length === 0) return;

    const isUrl = /^https?:\/\//i.test(trimmed);
    setStatus("saving");

    const res = await fetch("/api/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: isUrl ? "url" : "text",
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

  return (
    <div className="flex w-full max-w-xl flex-col gap-2">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
        }}
        placeholder="Paste a link, or type anything. ⌘↩ to save."
        className="min-h-[100px] resize-y rounded-md border border-black/10 p-3 text-sm outline-none focus:border-black/30"
      />
      <div className="flex items-center justify-between text-xs text-black/50">
        <span>{pending ? "refreshing" : status}</span>
        <button
          onClick={submit}
          disabled={value.trim().length === 0}
          className="rounded-md border border-black/10 px-3 py-1 text-xs hover:border-black/30 disabled:opacity-30"
        >
          capture
        </button>
      </div>
    </div>
  );
}
