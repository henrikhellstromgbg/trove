"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";

type WikiTopic = {
  id: string;
  name: string;
  summary: string | null;
  items: { id: string; title: string | null; source: string | null }[];
};

export function WikiBoard({ topics }: { topics: WikiTopic[] }) {
  const [active, setActive] = useState<string | null>(topics[0]?.id ?? null);
  const focused = topics.find((t) => t.id === active) ?? topics[0];

  return (
    <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr,2fr]">
      <ul className="flex flex-col gap-3">
        {topics.map((t) => {
          const isActive = t.id === active;
          const count = t.items.length;
          return (
            <li key={t.id}>
              <button
                onClick={() => setActive(t.id)}
                className="group flex w-full items-baseline justify-between gap-4 border-b border-line py-3 text-left"
              >
                <span
                  className={`font-display text-2xl leading-tight tracking-tight transition-colors duration-500 md:text-3xl ${
                    isActive ? "text-ink" : "text-ink-faint group-hover:text-ink-dim"
                  }`}
                >
                  {t.name}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-ghost">
                  {String(count).padStart(2, "0")}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <AnimatePresence mode="wait">
        {focused ? (
          <motion.article
            key={focused.id}
            initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
            transition={{ duration: 0.5, ease: [0.22, 0.61, 0.36, 1] }}
            className="glass flex flex-col gap-6 rounded-3xl p-8 md:p-10"
          >
            <h2 className="font-display text-4xl leading-tight tracking-tight md:text-5xl">
              {focused.name}
            </h2>
            {focused.summary ? (
              <p className="font-display text-xl italic leading-snug text-ink-dim">
                {focused.summary}
              </p>
            ) : null}
            <ul className="flex flex-col">
              {focused.items.map((it) => (
                <li
                  key={it.id}
                  className="border-b border-line py-3 last:border-b-0"
                >
                  <p className="text-base text-ink">
                    {it.title ?? it.source ?? "(untitled)"}
                  </p>
                  {it.source && it.title ? (
                    <p className="mt-0.5 truncate font-mono text-[11px] text-ink-faint">
                      {it.source}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </motion.article>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
