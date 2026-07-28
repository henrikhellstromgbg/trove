"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUp, ChevronDown, ChevronUp } from "@/components/icons";
import { drainNdjson, parseNdjsonRecord } from "@/lib/ndjson";
import type { Citation } from "@/lib/answers";
import { Alert, Button, DataList, DataRow, PageFrame, PageHeader, SectionHeader } from "@/components/ui";

type Activity = { question: string; answer: string };

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
  const [answerId, setAnswerId] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [input, setInput] = useState("");
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [streamedAnswer, setStreamedAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const autoStarted = useRef(false);
  const prefersReducedMotion = useReducedMotion();

  const busy = pendingQuestion != null;
  const active = answerId != null || busy || answer.length > 0;

  const submit = useCallback(async (raw: string) => {
    const question = raw.trim();
    if (!question || busy) return;

    setPendingQuestion(question);
    setStreamedAnswer("");
    setError(null);
    setInput("");
    let nextAnswer = "";
    let nextCitations: Citation[] = [];
    let failed = false;

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, projectId, answerId }),
      });
      if (!response.ok || !response.body) {
        throw new Error(`Unable to answer (${response.status}). Try again.`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const consume = (line: string) => {
        if (!line.trim()) return;
        const parsed = parseNdjsonRecord(line);
        if (!parsed.ok) {
          failed = true;
          setError("The server returned an invalid response. Try again.");
          return;
        }
        const record = parsed.value as {
          type?: string;
          id?: string;
          text?: string;
          items?: Citation[];
          error?: string;
        };
        if ((record.type === "answer" || record.type === "conversation") && record.id) {
          setAnswerId(record.id);
          const url = new URL(window.location.href);
          url.searchParams.delete("q");
          url.searchParams.delete("conversation");
          url.searchParams.set("answer", record.id);
          window.history.replaceState(null, "", url);
        } else if (record.type === "citations") {
          nextCitations = record.items ?? [];
        } else if (record.type === "text" && record.text) {
          nextAnswer += record.text;
          setStreamedAnswer(nextAnswer);
        } else if (record.type === "error") {
          failed = true;
          setError(record.error ?? "Unable to answer right now. Try again.");
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const drained = drainNdjson(buffer);
        buffer = drained.remainder;
        drained.records.forEach(consume);
      }
      buffer += decoder.decode();
      drainNdjson(buffer, true).records.forEach(consume);

      if (!failed && nextAnswer) {
        if (answer && currentQuestion) {
          setActivity((previous) => [
            ...previous,
            { question: currentQuestion, answer },
          ]);
        }
        setCurrentQuestion(question);
        setAnswer(nextAnswer);
        setCitations(nextCitations);
      }
    } catch (cause) {
      failed = true;
      setError(cause instanceof Error ? cause.message : "Connection lost. Try again.");
    } finally {
      setPendingQuestion(null);
      if (failed) setStreamedAnswer("");
    }
  }, [answer, answerId, busy, currentQuestion, projectId]);

  useEffect(() => {
    if (autoStarted.current) return;
    autoStarted.current = true;
    const params = new URLSearchParams(window.location.search);
    const savedId = params.get("answer") ?? params.get("conversation");
    if (savedId) {
      fetch(`/api/answers/${encodeURIComponent(savedId)}?projectId=${encodeURIComponent(projectId)}`)
        .then(async (response) => {
          if (!response.ok) throw new Error();
          return response.json() as Promise<{
            answer: {
              id: string;
              question: string | null;
              answer: string | null;
              citations: Citation[];
              activity: Activity[];
            };
          }>;
        })
        .then(({ answer: saved }) => {
          setAnswerId(saved.id);
          setCurrentQuestion(saved.question);
          setAnswer(saved.answer ?? "");
          setCitations(saved.citations);
          setActivity(saved.activity);
          const url = new URL(window.location.href);
          url.searchParams.delete("conversation");
          url.searchParams.set("answer", saved.id);
          window.history.replaceState(null, "", url);
        })
        .catch(() => setError("The saved answer could not be loaded."));
      return;
    }
    const question = params.get("q");
    if (question?.trim()) queueMicrotask(() => void submit(question));
  }, [projectId, submit]);

  const sourceList = citations.length === 0 ? (
    <p className="text-sm text-[var(--color-text-tertiary)]">No sources yet.</p>
  ) : (
    <DataList>
      {citations.map((citation) => (
        <DataRow
          key={`${citation.n}-${citation.itemId}`}
          href={`/p/${slug}/library/${citation.itemId}`}
          selectLabel={`Open cited item ${citation.title}`}
          leading={<span className="font-mono text-sm text-[var(--color-text-tertiary)]">{String(citation.n).padStart(2, "0")}</span>}
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm">{citation.title}</span>
            {hostOf(citation.source) ? <span className="text-sm text-[var(--color-text-tertiary)]">{hostOf(citation.source)}</span> : null}
          </div>
        </DataRow>
      ))}
    </DataList>
  );

  const visibleAnswer = answer || streamedAnswer;
  const activeQuestion = pendingQuestion ?? currentQuestion;
  const completedRevisions = [
    ...activity,
    ...(busy && currentQuestion && currentQuestion !== pendingQuestion && answer
      ? [{ question: currentQuestion, answer }]
      : []),
  ];
  const currentStatus = busy
    ? answer
      ? "Updating the answer…"
      : "Reading your files…"
    : citations.length > 0
      ? `Answer updated · ${citations.length} sources`
      : "Answer updated";

  return (
    <>
      <div className="xl:pr-[24rem]">
        <PageFrame maxWidth="none" fillViewport>
          <PageHeader
            title={active ? "Working answer" : "What do you want to know?"}
            description={active ? "Auto-saved to Answers" : `Ask your files in ${projectName}.`}
            action={answerId && !busy ? (
              <Button asChild variant="secondary">
                <Link href={`/p/${slug}/answers/${answerId}`}>Done</Link>
              </Button>
            ) : undefined}
          />

          <div className="grid min-h-[60dvh] flex-1 gap-6">
            <div className="flex min-w-0 flex-col gap-6">
          <AnimatePresence initial={false}>
            {active ? (
              <motion.div
                key="work-log"
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="flex min-w-0 flex-1 flex-col gap-4"
              >
                <SectionHeader title="Work log" />
                <div className="relative ml-2 flex flex-1 flex-col border-l border-[var(--color-border-subtle)] pl-5 after:absolute after:-left-px after:top-full after:h-[var(--space-10)] after:w-px after:bg-[var(--color-border-subtle)]">
                  <ol className="flex flex-col gap-8">
                    {completedRevisions.map((revision, index) => (
                      <li key={`${index}-${revision.question}`} className="relative flex flex-col gap-3">
                        <span className="absolute -left-[1.55rem] top-4 size-2 rounded-[var(--radius-full)] bg-[var(--color-border-strong)]" />
                        <div className="rounded-[var(--radius-md)] bg-[var(--color-surface)] px-3 py-2.5 shadow-[var(--shadow-sm)]">
                          <p className="text-base leading-relaxed text-[var(--color-text-primary)]">{revision.question}</p>
                        </div>
                        <div className="relative flex flex-col gap-3 py-2">
                          <span className="absolute -left-[1.55rem] top-3 size-2 rounded-[var(--radius-full)] bg-[var(--color-border-strong)]" />
                          <SectionHeader title="Answer" />
                          <p className="whitespace-pre-wrap text-pretty text-base leading-relaxed text-[var(--color-text-primary)]">
                            {revision.answer}
                          </p>
                        </div>
                        <p className="text-sm text-[var(--color-text-tertiary)]">Answer updated</p>
                      </li>
                    ))}
                    {activeQuestion ? (
                      <li className="relative flex flex-col gap-2">
                        <span className={`absolute -left-[1.55rem] top-4 size-2 rounded-[var(--radius-full)] ${busy ? "bg-[var(--color-brand)]" : "bg-[var(--color-border-strong)]"}`} />
                        <div className="rounded-[var(--radius-md)] bg-[var(--color-surface)] px-3 py-2.5 shadow-[var(--shadow-sm)]">
                          <p className="text-base leading-relaxed text-[var(--color-text-primary)]">{activeQuestion}</p>
                        </div>
                        <p aria-live="polite" className="text-sm text-[var(--color-text-tertiary)]">{currentStatus}</p>
                      </li>
                    ) : null}
                  </ol>

                  <motion.section
                    aria-live="polite"
                    aria-busy={busy}
                    initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: prefersReducedMotion ? 0 : 0.26, ease: [0.16, 1, 0.3, 1] }}
                    className="relative mt-6 flex min-w-0 flex-col gap-4"
                  >
                    <span className="absolute -left-[1.55rem] top-2 size-2 rounded-[var(--radius-full)] bg-[var(--color-border-strong)]" />
                    <div className="flex items-center justify-between gap-4">
                      <SectionHeader title="Answer" />
                      <div className="xl:hidden">
                        <Button
                          onClick={() => setSourcesOpen((open) => !open)}
                          variant="secondary"
                          aria-expanded={sourcesOpen}
                        >
                          <span>{citations.length} sources</span>
                          {sourcesOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </Button>
                      </div>
                    </div>

                    {visibleAnswer ? (
                      <p className="whitespace-pre-wrap text-pretty text-base leading-relaxed text-[var(--color-text-primary)]">{visibleAnswer}</p>
                    ) : (
                      <p className="text-base text-[var(--color-text-tertiary)]">Reading your files…</p>
                    )}
                    {busy && answer ? <p className="text-sm text-[var(--color-text-tertiary)]">Updating the saved answer…</p> : null}

                    {sourcesOpen ? (
                      <div className="border-t border-[var(--color-border-subtle)] pt-5 xl:hidden">
                        {sourceList}
                      </div>
                    ) : null}
                  </motion.section>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty-work-log"
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="flex min-w-0 flex-1 flex-col gap-4"
              >
                <SectionHeader title="Work log" />
                <div className="relative ml-2 flex flex-1 border-l border-[var(--color-border-subtle)] after:absolute after:-left-px after:top-full after:h-[var(--space-10)] after:w-px after:bg-[var(--color-border-subtle)]" />
              </motion.div>
            )}
          </AnimatePresence>

          {error ? <Alert variant="error" title="Answer not updated">{error}</Alert> : null}

          <motion.div
            layout="position"
            transition={{ layout: { duration: prefersReducedMotion ? 0 : 0.26, ease: [0.16, 1, 0.3, 1] } }}
            className="sticky bottom-0 z-[var(--z-sticky)] mt-auto w-full bg-[var(--color-canvas)] py-4"
          >
            <label htmlFor="ask-question" className="sr-only">
              {active ? "Refine this answer" : "Your question"}
            </label>
            <div className="relative rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-md)] transition-colors duration-[var(--duration-fast)] focus-within:border-[var(--color-border-strong)]">
              <textarea
                id="ask-question"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    if (input.trim() && !busy) void submit(input);
                  }
                }}
                rows={2}
                placeholder={active ? "What should the answer clarify?" : "What are you looking for?"}
                className="w-full resize-none rounded-[var(--radius-lg)] bg-transparent px-4 py-4 pr-16 text-base text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]"
                style={{ outline: "none" }}
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                <Button
                  onClick={() => void submit(input)}
                  disabled={!input.trim() || busy}
                  aria-label={active ? "Refine answer" : "Ask question"}
                  size="icon"
                >
                  <ArrowUp size={18} />
                </Button>
              </div>
            </div>
          </motion.div>
            </div>
          </div>
        </PageFrame>
      </div>

      <motion.aside
        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.26, ease: [0.16, 1, 0.3, 1] }}
        className="fixed right-0 top-0 z-[var(--z-raised)] hidden h-[100dvh] w-96 min-w-0 flex-col overflow-y-auto border-l border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-6 xl:flex"
      >
        <div className="border-b border-[var(--color-border-subtle)] pb-4">
          <SectionHeader title={`Based on ${citations.length} sources`} />
        </div>
        <div className="pt-5">{sourceList}</div>
      </motion.aside>
    </>
  );
}
