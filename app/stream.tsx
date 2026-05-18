"use client";

import { motion } from "motion/react";
import type { Item } from "@/lib/db/schema";

const TYPE_GLYPH: Record<string, string> = {
  text: "txt",
  url: "url",
  pdf: "pdf",
  image: "img",
  audio: "aud",
  docx: "doc",
  xlsx: "xls",
  textfile: "txt",
};

function preview(item: Item): string {
  if (item.title) return item.title;
  if (item.rawText) return item.rawText.slice(0, 160);
  if (item.source) return item.source;
  return "(empty)";
}

export function Stream({ items }: { items: Item[] }) {
  if (items.length === 0) {
    return (
      <div className="glass-soft rounded-3xl px-8 py-10">
        <p className="font-display text-2xl italic text-ink-faint">
          nothing captured yet. begin above.
        </p>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-3xl tracking-tight">stream</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
          most recent {items.length}
        </span>
      </div>

      <ul className="flex flex-col">
        {items.map((item, i) => (
          <motion.li
            key={item.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.5,
              delay: Math.min(i * 0.03, 0.4),
              ease: [0.22, 0.61, 0.36, 1],
            }}
            className="group flex items-start gap-6 border-b border-line py-5 last:border-b-0"
          >
            <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint w-10 shrink-0">
              {TYPE_GLYPH[item.type] ?? item.type}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="font-display text-xl leading-snug text-ink line-clamp-2 break-words">
                {preview(item)}
              </p>
              {item.source && item.title ? (
                <p className="truncate font-mono text-[11px] text-ink-faint">
                  {item.source}
                </p>
              ) : null}
            </div>
            <span
              className={`mt-1 font-mono text-[10px] uppercase tracking-[0.22em] shrink-0 ${
                item.status === "ready"
                  ? "text-silver"
                  : item.status === "processing"
                  ? "text-ember"
                  : "text-ink-faint"
              }`}
            >
              {item.status}
            </span>
          </motion.li>
        ))}
      </ul>
    </section>
  );
}
