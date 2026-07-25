"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp } from "@carbon/icons-react";
import { IconButton } from "@/components/ui";

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
    <div className="flex items-center gap-3 border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-5 py-4 transition-colors focus-within:border-[var(--color-border)]">
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
        placeholder="Ask anything in this project…"
        className="flex-1 bg-transparent text-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]"
      />
      <IconButton
        onClick={go}
        label="Ask"
        className="bg-[var(--color-action)] text-[var(--color-text-inverse)] hover:bg-[var(--color-action-hover)] hover:text-[var(--color-text-inverse)]"
      >
        <ArrowUp size={18} />
      </IconButton>
    </div>
  );
}
