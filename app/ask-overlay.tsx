"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

type Citation = {
  n: number;
  itemId: string;
  title: string;
  source: string | null;
};

export function AskOverlay({ projectId }: { projectId: string }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = document.activeElement;
      const inField =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      if (e.key === "/" && !inField) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
          else if (msg.type === "error")
            setAnswer((a) => a + `\n\n[error: ${msg.error}]`);
        } catch {
          // skip
        }
      }
    }

    setLoading(false);
  }

  function reset() {
    setAnswer("");
    setCitations([]);
    setQuestion("");
  }

  const hasResult = answer.length > 0 || citations.length > 0;

  return (
    <div className="fixed top-16 left-0 right-0 z-20">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 px-6 md:px-10">
        <div className="glass flex items-center gap-3 rounded-full px-6 py-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
            ask
          </span>
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
              if (e.key === "Escape") {
                if (hasResult) reset();
                inputRef.current?.blur();
              }
            }}
            placeholder="what would you like to find?"
            className="flex-1 bg-transparent text-base text-ink placeholder:text-ink-faint outline-none"
          />
          {loading ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
              thinking
            </span>
          ) : hasResult ? (
            <button
              onClick={reset}
              className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint hover:text-ink"
            >
              clear
            </button>
          ) : (
            <span className="rounded border border-line px-1.5 py-0.5 font-mono text-[10px] text-ink-faint">
              /
            </span>
          )}
        </div>

        <AnimatePresence>
          {hasResult || loading ? (
            <motion.div
              initial={{ opacity: 0, y: -8, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -8, filter: "blur(6px)" }}
              transition={{ duration: 0.4 }}
              className="rounded-3xl border border-line bg-white p-6 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.12)]"
            >
              <p className="whitespace-pre-wrap text-base leading-relaxed text-ink">
                {answer}
                {loading && !answer ? (
                  <span className="text-ink-faint">thinking...</span>
                ) : null}
              </p>
              {citations.length > 0 ? (
                <ol className="mt-4 flex flex-col gap-1.5 border-t border-line pt-3">
                  {citations.map((c) => (
                    <li
                      key={c.n}
                      className="flex items-baseline gap-3 text-sm text-ink-dim"
                    >
                      <span className="font-mono text-[10px] text-ink-faint">
                        {String(c.n).padStart(2, "0")}
                      </span>
                      <span className="truncate">{c.title}</span>
                    </li>
                  ))}
                </ol>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
