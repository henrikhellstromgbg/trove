"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useProject } from "@/app/project-context";

const CRON_PRESETS = [
  { label: "every hour", value: "0 * * * *" },
  { label: "every 6 hours", value: "0 */6 * * *" },
  { label: "daily at 8am", value: "0 8 * * *" },
];

export function NewSourceForm() {
  const router = useRouter();
  const { project } = useProject();
  const [name, setName] = useState("");
  const [feedUrl, setFeedUrl] = useState("");
  const [cron, setCron] = useState(CRON_PRESETS[0].value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>("");

  async function submit() {
    const n = name.trim();
    const url = feedUrl.trim();
    if (n.length === 0 || url.length === 0 || busy) return;

    setBusy(true);
    setError("");

    const res = await fetch("/api/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "rss",
        name: n,
        feedUrl: url,
        cron,
        projectId: project.id,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setError(err.error ?? `error ${res.status}`);
      setBusy(false);
      return;
    }

    const { id } = await res.json();
    router.push(`/p/${project.slug}/sources/${id}`);
  }

  return (
    <div className="glass flex max-w-xl flex-col gap-5 rounded-3xl p-6 md:p-8">
      <label className="flex flex-col gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
          name
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="a blog, a newsletter, whatever it is"
          className="bg-transparent font-display text-xl text-ink placeholder:text-ink-faint"
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
          feed url
        </span>
        <input
          value={feedUrl}
          onChange={(e) => setFeedUrl(e.target.value)}
          placeholder="https://example.com/feed.xml"
          className="bg-transparent font-display text-xl text-ink placeholder:text-ink-faint"
        />
      </label>

      <div className="flex flex-col gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
          check
        </span>
        <div className="flex flex-wrap gap-2">
          {CRON_PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => setCron(p.value)}
              className={`rounded-full border px-3 py-1.5 text-xs uppercase tracking-wider transition-colors ${
                cron === p.value
                  ? "border-ink bg-ink text-canvas"
                  : "border-line text-ink-dim hover:border-line-strong"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-line pt-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
          {busy ? "saving" : error || "ready when you are"}
        </span>
        <motion.button
          onClick={submit}
          whileTap={{ scale: 0.97 }}
          className="rounded-full border border-line-strong bg-neutral-50 px-4 py-2 text-xs font-medium uppercase tracking-wider text-ink transition-colors hover:bg-neutral-100 hover:border-ink"
        >
          add source
        </motion.button>
      </div>
    </div>
  );
}
