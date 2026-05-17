"use client";

import { useState } from "react";

type Citation = {
  n: number;
  itemId: string;
  title: string;
  source: string | null;
};

export function AskForm() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [loading, setLoading] = useState(false);

  async function submit() {
    const q = question.trim();
    if (!q || loading) return;

    setLoading(true);
    setAnswer("");
    setCitations([]);

    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q }),
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

  const hasResult = answer.length > 0 || citations.length > 0;

  return (
    <div className="flex w-full max-w-xl flex-col gap-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Ask anything about what you've saved..."
          className="flex-1 rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
        />
        <button
          onClick={submit}
          disabled={!question.trim() || loading}
          className="rounded-md border border-black/10 px-3 py-2 text-sm hover:border-black/30 disabled:opacity-30"
        >
          {loading ? "..." : "ask"}
        </button>
      </div>

      {hasResult ? (
        <div className="flex flex-col gap-2 rounded-md border border-black/5 px-3 py-2 text-sm">
          <p className="whitespace-pre-wrap">
            {answer || (loading ? "thinking..." : "")}
          </p>
          {citations.length > 0 ? (
            <ul className="flex flex-col gap-0.5 text-xs text-black/50">
              {citations.map((c) => (
                <li key={c.n} className="truncate">
                  [{c.n}] {c.title}
                  {c.source ? `, ${c.source}` : ""}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
