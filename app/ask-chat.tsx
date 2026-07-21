"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, ChevronDown, ChevronUp } from "@carbon/icons-react";
import { drainNdjson, parseNdjsonRecord } from "@/lib/ndjson";

type Citation = {
  n: number;
  itemId: string;
  title: string;
  source: string | null;
};

type ChatMessage = {
  question: string;
  answer: string;
  citations: Citation[];
  loading: boolean;
  error: string | null;
};

const STARTERS = [
  "What did I capture recently?",
  "Summarise the key themes across my sources.",
  "What should I revisit that I might have forgotten?",
  "Which sources are most relevant to my current focus?",
];

function hostOf(source: string | null): string | null {
  if (!source || !/^https?:\/\//i.test(source)) return null;
  try {
    return new URL(source).host;
  } catch {
    return null;
  }
}

export function AskChat({
  projectId,
  slug,
  projectName,
}: {
  projectId: string;
  slug: string;
  projectName: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sourcesOpen, setSourcesOpen] = useState(false);

  const transcriptRef = useRef<HTMLDivElement>(null);
  const autoSubmitted = useRef(false);
  const messagesRef = useRef<ChatMessage[]>(messages);

  // Mirror the committed messages into a ref for submit() to read the latest
  // length/loading without a stale closure. Synced in an effect, never during
  // render (updating a ref in render is a react-hooks/refs violation).
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const lastMessage = messages[messages.length - 1] ?? null;
  const isBusy = lastMessage?.loading ?? false;
  const citations = lastMessage?.citations ?? [];

  // Keep the transcript pinned to the newest content as it streams.
  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const patchMessage = useCallback((index: number, patch: Partial<ChatMessage>) => {
    setMessages((prev) =>
      prev.map((m, i) => (i === index ? { ...m, ...patch } : m))
    );
  }, []);

  const submit = useCallback(async (raw: string) => {
    const q = raw.trim();
    if (!q || messagesRef.current[messagesRef.current.length - 1]?.loading) {
      return;
    }

    const index = messagesRef.current.length;
    setMessages((prev) => [
      ...prev,
      { question: q, answer: "", citations: [], loading: true, error: null },
    ]);
    setInput("");

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, projectId }),
      });

      if (!res.ok || !res.body) {
        patchMessage(index, {
          loading: false,
          error: `Something went wrong (${res.status}). Try again.`,
        });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const consumeLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        const parsed = parseNdjsonRecord(trimmed);
        if (parsed.ok) {
          const msg = parsed.value as {
            type?: string;
            items?: Citation[];
            text?: string;
            error?: string;
          };
          if (msg.type === "citations") {
            patchMessage(index, { citations: msg.items ?? [] });
          } else if (msg.type === "text" && msg.text) {
            const text = msg.text;
            setMessages((prev) =>
              prev.map((m, i) =>
                i === index ? { ...m, answer: m.answer + text } : m
              )
            );
          } else if (msg.type === "error") {
            patchMessage(index, { error: msg.error ?? "Stream error." });
          }
        } else {
          patchMessage(index, { error: "The server returned an invalid response." });
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const drained = drainNdjson(buffer);
        buffer = drained.remainder;
        drained.records.forEach(consumeLine);
      }
      buffer += decoder.decode();
      drainNdjson(buffer, true).records.forEach(consumeLine);

      patchMessage(index, { loading: false });
    } catch {
      patchMessage(index, {
        loading: false,
        error: "Connection lost. Try again.",
      });
    }
  }, [patchMessage, projectId]);

  // Auto-submit from the home launcher: read ?q= once on mount. Reading
  // window.location.search here avoids the useSearchParams Suspense rule.
  useEffect(() => {
    if (autoSubmitted.current) return;
    autoSubmitted.current = true;
    const q = new URLSearchParams(window.location.search).get("q");
    if (q && q.trim()) submit(q);
  }, [submit]);

  const canSend = input.trim().length > 0 && !isBusy;

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col md:h-[100dvh] md:flex-row">
      {/* Main answer column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div ref={transcriptRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-10 md:px-10">
            {messages.length === 0 ? (
              <div className="flex flex-col gap-6 pt-8">
                <h1 className="text-2xl font-medium text-ink">
                  Ask anything in {projectName}.
                </h1>
                <div className="flex flex-col gap-2">
                  {STARTERS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => submit(s)}
                      className="rounded-lg border border-line bg-paper px-4 py-2.5 text-left text-sm text-ink-dim transition-colors hover:border-line-strong hover:text-ink"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-faint">
                      you
                    </span>
                    <p className="text-base font-medium text-ink">
                      {m.question}
                    </p>
                  </div>
                  {m.error ? (
                    <p className="text-sm text-brand">{m.error}</p>
                  ) : (
                    <p className="whitespace-pre-wrap text-base leading-relaxed text-ink">
                      {m.answer}
                      {m.loading && !m.answer ? (
                        <span className="text-ink-faint">thinking…</span>
                      ) : null}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Mobile: collapsible sources panel */}
        <div className="border-t border-line md:hidden">
          <button
            type="button"
            onClick={() => setSourcesOpen((v) => !v)}
            className="flex w-full items-center justify-between px-6 py-3 transition-colors hover:bg-ink/[0.015]"
            aria-expanded={sourcesOpen}
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-faint">
              Files that are relevant
            </span>
            {sourcesOpen ? (
              <ChevronUp size={16} className="text-ink-faint" />
            ) : (
              <ChevronDown size={16} className="text-ink-faint" />
            )}
          </button>
          {sourcesOpen ? (
            <div className="max-h-56 overflow-y-auto px-6 pb-4">
              <SourcesList citations={citations} slug={slug} />
            </div>
          ) : null}
        </div>

        {/* Input dock */}
        <div className="px-6 pb-6 pt-2 md:px-10">
          <div className="mx-auto w-full max-w-2xl">
            <div className="relative rounded-2xl border border-line bg-paper focus-within:border-line-strong">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (canSend) submit(input);
                  }
                }}
                rows={3}
                placeholder="What are you looking for?"
                className="w-full resize-none bg-transparent px-4 py-3.5 pr-14 text-base text-ink outline-none placeholder:text-ink-faint"
              />
              <button
                type="button"
                onClick={() => submit(input)}
                disabled={!canSend}
                aria-label="Send question"
                className="absolute right-3 top-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink text-canvas transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 disabled:opacity-30"
              >
                <ArrowUp size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop: right sources panel */}
      <aside className="hidden w-80 flex-col border-l border-line md:flex">
        <div className="border-b border-line px-6 py-4">
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-faint">
            Files that are relevant
          </span>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <SourcesList citations={citations} slug={slug} />
        </div>
      </aside>
    </div>
  );
}

function SourcesList({
  citations,
  slug,
}: {
  citations: Citation[];
  slug: string;
}) {
  if (citations.length === 0) {
    return (
      <p className="font-mono text-[11px] lowercase tracking-wide text-ink-faint">
        no sources yet
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-4">
      {citations.map((c) => {
        const host = hostOf(c.source);
        return (
          <li key={c.n} className="flex items-baseline gap-3">
            <span className="font-mono text-[11px] text-ink-faint">
              {String(c.n).padStart(2, "0")}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <Link
                href={`/p/${slug}/library/${c.itemId}`}
                className="text-sm text-ink underline underline-offset-2 transition-colors hover:text-brand"
              >
                {c.title}
              </Link>
              {host ? (
                <span className="font-mono text-[11px] text-ink-faint">
                  {host}
                </span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
