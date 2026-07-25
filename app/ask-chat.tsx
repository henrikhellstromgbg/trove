"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, ChevronDown, ChevronUp } from "@carbon/icons-react";
import { drainNdjson, parseNdjsonRecord } from "@/lib/ndjson";
import {
  Button,
  DataList,
  DataRow,
  IconButton,
  PageFrame,
  PageHeader,
  SectionHeader,
} from "@/components/ui";

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
  const [conversationId, setConversationId] = useState<string | null>(null);

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
        body: JSON.stringify({ question: q, projectId, conversationId }),
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
            id?: string;
          };
          if (msg.type === "conversation" && msg.id) {
            setConversationId(msg.id);
            const url = new URL(window.location.href);
            url.searchParams.delete("q");
            url.searchParams.set("conversation", msg.id);
            window.history.replaceState(null, "", url);
          } else if (msg.type === "citations") {
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
  }, [conversationId, patchMessage, projectId]);

  // Auto-submit from the home launcher: read ?q= once on mount. Reading
  // window.location.search here avoids the useSearchParams Suspense rule.
  useEffect(() => {
    if (autoSubmitted.current) return;
    autoSubmitted.current = true;
    const params = new URLSearchParams(window.location.search);
    const savedConversationId = params.get("conversation");
    if (savedConversationId) {
      fetch(
        `/api/ask?projectId=${encodeURIComponent(projectId)}&conversationId=${encodeURIComponent(savedConversationId)}`
      )
        .then(async (res) => {
          if (!res.ok) throw new Error("conversation load failed");
          return res.json() as Promise<{
            conversationId: string;
            messages: Array<{
              role: string;
              content: string;
              citations: Citation[] | null;
            }>;
          }>;
        })
        .then((data) => {
          const restored: ChatMessage[] = [];
          for (const message of data.messages) {
            if (message.role === "user") {
              restored.push({
                question: message.content,
                answer: "",
                citations: [],
                loading: false,
                error: null,
              });
            } else if (message.role === "assistant" && restored.length > 0) {
              const current = restored[restored.length - 1];
              current.answer = message.content;
              current.citations = message.citations ?? [];
            }
          }
          setConversationId(data.conversationId);
          setMessages(restored);
        })
        .catch(() => {
          setMessages([
            {
              question: "Saved conversation",
              answer: "",
              citations: [],
              loading: false,
              error: "The saved conversation could not be loaded.",
            },
          ]);
        });
      return;
    }
    const q = params.get("q");
    if (q && q.trim()) submit(q);
  }, [projectId, submit]);

  const canSend = input.trim().length > 0 && !isBusy;

  return (
    <PageFrame maxWidth="5xl" className="min-h-[calc(100dvh-3.5rem)] md:min-h-[100dvh]">
      <PageHeader
        title={`Ask in ${projectName}`}
        description="Project-scoped answers with citations and saved conversations."
      />

      <div className="grid min-h-0 gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <SectionHeader title="Conversation" />
          <div
            ref={transcriptRef}
            className="flex min-h-[20rem] flex-1 flex-col overflow-y-auto border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5"
          >
            {messages.length === 0 ? (
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  {STARTERS.map((s) => (
                    <Button
                      key={s}
                      onClick={() => submit(s)}
                      variant="secondary"
                      className="justify-start text-left"
                    >
                      {s}
                    </Button>
                  ))}
                </div>
                <p className="text-sm text-[var(--color-text-tertiary)]">
                  Start with a question or pick a common prompt.
                </p>
              </div>
            ) : (
              <DataList className="flex flex-col gap-5 divide-y-0">
                {messages.map((m, i) => (
                  <DataRow
                    key={i}
                    leading={
                      <span className="font-mono text-sm text-[var(--color-text-tertiary)]">
                        {i === messages.length - 1 && m.loading ? "now" : "message"}
                      </span>
                    }
                    className="items-start py-0"
                  >
                    <div className="flex min-w-0 flex-col gap-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-[var(--color-text-primary)]">You</span>
                        <p className="text-base text-[var(--color-text-primary)]">{m.question}</p>
                      </div>
                      {m.error ? (
                        <p className="text-sm text-[var(--color-accent)]">{m.error}</p>
                      ) : (
                        <p className="whitespace-pre-wrap text-base leading-relaxed text-[var(--color-text-primary)]">
                          {m.answer}
                          {m.loading && !m.answer ? (
                            <span className="text-[var(--color-text-tertiary)]">thinking…</span>
                          ) : null}
                        </p>
                      )}
                    </div>
                  </DataRow>
                ))}
              </DataList>
            )}
          </div>

          <div className="border-t border-[var(--color-border-subtle)] pt-4">
            <div className="relative border border-[var(--color-border-subtle)] bg-[var(--color-surface)] focus-within:border-[var(--color-border)]">
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
                className="w-full resize-none bg-transparent px-4 py-3.5 pr-14 text-base text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]"
              />
              <IconButton
                onClick={() => submit(input)}
                disabled={!canSend}
                label="Send question"
                className="absolute right-3 top-3 bg-[var(--color-primary)] text-[var(--color-text-inverse)] hover:bg-[var(--color-primary-hover)] hover:text-[var(--color-text-inverse)] disabled:opacity-30"
              >
                <ArrowUp size={18} />
              </IconButton>
            </div>
          </div>

          <div className="md:hidden">
            <Button
              onClick={() => setSourcesOpen((v) => !v)}
              variant="secondary"
              className="w-full justify-between"
            >
              <span>Files that are relevant</span>
              {sourcesOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </Button>
            {sourcesOpen ? (
              <div className="mt-3 max-h-56 overflow-y-auto">
                <SourcesList citations={citations} slug={slug} />
              </div>
            ) : null}
          </div>
        </div>

        <aside className="hidden min-w-0 flex-col gap-4 border-l border-[var(--color-border-subtle)] pl-8 lg:flex">
          <SectionHeader title="Files that are relevant" />
          <div className="flex-1 overflow-y-auto">
            <SourcesList citations={citations} slug={slug} />
          </div>
        </aside>
      </div>
    </PageFrame>
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
      <p className="text-sm text-[var(--color-text-tertiary)]">
        No sources yet.
      </p>
    );
  }

  return (
    <DataList className="flex flex-col divide-y-0">
      {citations.map((c) => {
        const host = hostOf(c.source);
        return (
          <DataRow
            key={c.n}
            href={`/p/${slug}/library/${c.itemId}`}
            selectLabel={`Open cited item ${c.title}`}
            leading={
              <span className="font-mono text-sm text-[var(--color-text-tertiary)]">
                {String(c.n).padStart(2, "0")}
              </span>
            }
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-sm text-[var(--color-text-primary)]">{c.title}</span>
              {host ? <span className="text-sm text-[var(--color-text-tertiary)]">{host}</span> : null}
            </div>
          </DataRow>
        );
      })}
    </DataList>
  );
}
