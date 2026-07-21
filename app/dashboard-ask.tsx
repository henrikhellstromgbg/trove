"use client";

import { useRef, useState } from "react";
import { ArrowRight, Send } from "@carbon/icons-react";

type Citation = {
  n: number;
  itemId: string;
  title: string;
  source: string | null;
};

// The dashboard hero. Ask is the home, not a nav item — this is the primary
// surface you land on. Streams from /api/ask, same protocol as the old
// floating overlay.
export function DashboardAsk({ projectId }: { projectId: string }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function submit() {
    const q = question.trim();
    if (!q || loading) return;

    setLoading(true);
    setAnswer("");
    setCitations([]);

    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q, projectId }),
    });

    if (!res.ok || !res.body) {
      setAnswer(`error ${res.status}`);
      setLoading(false);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let nl;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.type === "text") setAnswer((a) => a + msg.text);
          else if (msg.type === "citations") setCitations(msg.items);
          else if (msg.type === "error") setAnswer((a) => a + `\n\n[error: ${msg.error}]`);
        } catch {
          // skip
        }
      }
    }

    setLoading(false);
  }

  const hasResult = answer.length > 0 || citations.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-paper px-5 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] focus-within:border-line-strong">
        <input
          ref={inputRef}
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="ask anything in this project…"
          className="flex-1 bg-transparent text-lg text-ink placeholder:text-ink-faint outline-none"
        />
        <button
          onClick={submit}
          disabled={loading || question.trim().length === 0}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink text-canvas transition-opacity disabled:opacity-30"
          aria-label="ask"
        >
          {loading ? (
            <Send size={18} className="animate-pulse" />
          ) : (
            <ArrowRight size={18} />
          )}
        </button>
      </div>

      {hasResult || loading ? (
        <div className="rounded-2xl border border-line bg-paper p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <p className="whitespace-pre-wrap text-base leading-relaxed text-ink">
            {answer}
            {loading && !answer ? <span className="text-ink-faint">thinking…</span> : null}
          </p>
          {citations.length > 0 ? (
            <ol className="mt-4 flex flex-col gap-1.5 border-t border-line pt-3">
              {citations.map((c) => (
                <li key={c.n} className="flex items-baseline gap-3 text-sm text-ink-dim">
                  <span className="font-mono text-[10px] text-ink-faint">
                    {String(c.n).padStart(2, "0")}
                  </span>
                  <span className="truncate">{c.title}</span>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
