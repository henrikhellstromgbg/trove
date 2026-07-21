"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp } from "@carbon/icons-react";

// The dashboard hero is now a launcher, not a full chat. Asking here hands
// the question off to the dedicated Ask workspace at /p/[slug]/ask, which
// streams the answer and shows the sources panel. Keeps the home page calm
// and status-first while still letting you start a question from the top.
export function DashboardAsk({ slug }: { slug: string }) {
  const [question, setQuestion] = useState("");
  const router = useRouter();
  const base = `/p/${slug}`;

  function go() {
    const q = question.trim();
    router.push(q ? `${base}/ask?q=${encodeURIComponent(q)}` : `${base}/ask`);
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-paper px-5 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-colors focus-within:border-line-strong">
      <input
        type="text"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            go();
          }
        }}
        placeholder="ask anything in this project…"
        className="flex-1 bg-transparent text-lg text-ink outline-none placeholder:text-ink-faint"
      />
      <button
        onClick={go}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink text-canvas transition-opacity hover:opacity-90"
        aria-label="ask"
      >
        <ArrowUp size={18} />
      </button>
    </div>
  );
}
