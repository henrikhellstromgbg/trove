"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "@carbon/icons-react";

export type Row = {
  id: string;
  title: string | null;
  type: string;
  source: string | null;
  status: string;
  capturedAt: string;
};

type SortKey = "added-desc" | "added-asc" | "title-asc" | "type-asc";

const STATUS_CLASS: Record<string, string> = {
  ready: "text-ink-dim",
  processing: "text-ink-faint",
  pending: "text-ink-faint",
  failed: "text-brand",
};

const GRID = "grid grid-cols-[1fr_5rem_10rem_8rem_6rem] gap-4";

function isUrl(s: string | null): s is string {
  return !!s && /^https?:\/\//i.test(s);
}

function name(r: Row): string {
  return r.title ?? r.source ?? "(untitled)";
}

function sourceLabel(r: Row): string {
  if (!r.source) return "—";
  if (isUrl(r.source)) {
    try {
      return new URL(r.source).host;
    } catch {
      return r.source;
    }
  }
  return r.source;
}

function addedLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const CONTROL =
  "rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink transition-colors focus:border-line-strong hover:border-line-strong outline-none";

export function LibraryTable({
  slug,
  items,
  limited = false,
}: {
  slug: string;
  items: Row[];
  limited?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState<SortKey>("added-desc");

  const types = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) set.add(it.type);
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = items.filter((r) => {
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (q) {
        const hay = `${r.title ?? ""} ${r.source ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const sorted = [...rows];
    switch (sort) {
      case "added-asc":
        sorted.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
        break;
      case "title-asc":
        sorted.sort((a, b) =>
          name(a).localeCompare(name(b), undefined, { sensitivity: "base" })
        );
        break;
      case "type-asc":
        sorted.sort((a, b) => a.type.localeCompare(b.type));
        break;
      case "added-desc":
      default:
        sorted.sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
        break;
    }
    return sorted;
  }, [items, query, typeFilter, statusFilter, sort]);

  function clearFilters() {
    setQuery("");
    setTypeFilter("all");
    setStatusFilter("all");
    setSort("added-desc");
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={limited ? "Search newest 200 items" : "Search title or source"}
            aria-label={limited ? "Search newest 200 library items" : "Search library"}
            className={`${CONTROL} w-full pl-9`}
          />
        </div>

        <label className="sr-only" htmlFor="type-filter">
          Type
        </label>
        <select
          id="type-filter"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className={CONTROL}
        >
          <option value="all">All types</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <label className="sr-only" htmlFor="status-filter">
          Status
        </label>
        <select
          id="status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={CONTROL}
        >
          <option value="all">All statuses</option>
          <option value="ready">Ready</option>
          <option value="processing">Processing</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>

        <label className="sr-only" htmlFor="sort">
          Sort
        </label>
        <select
          id="sort"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className={CONTROL}
        >
          <option value="added-desc">Added newest</option>
          <option value="added-asc">Added oldest</option>
          <option value="title-asc">Title A to Z</option>
          <option value="type-asc">Type</option>
        </select>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-start gap-2 py-6">
          <p className="font-mono text-sm text-ink-faint">no matches</p>
          <button
            type="button"
            onClick={clearFilters}
            className="text-sm font-medium text-ink underline underline-offset-2 transition-colors hover:text-brand focus:text-brand outline-none"
          >
            clear filters
          </button>
        </div>
      ) : (
        <>
          <ul className="flex flex-col md:hidden">
            {filtered.map((r) => (
              <li key={r.id} className="border-b border-line last:border-b-0">
                <Link
                  href={`/p/${slug}/library/${r.id}`}
                  className="flex flex-col gap-2 px-1 py-4 outline-none transition-colors hover:bg-ink/[0.015] focus:bg-ink/[0.03]"
                >
                  <span className="min-w-0 break-words text-sm font-medium text-ink">
                    {name(r)}
                  </span>
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-ink-faint">
                    <span className="uppercase">{r.type}</span>
                    <span className="max-w-full truncate">{sourceLabel(r)}</span>
                    <span>{addedLabel(r.capturedAt)}</span>
                    <span className={STATUS_CLASS[r.status] ?? "text-ink-dim"}>
                      {r.status}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto md:block">
            <div className="min-w-[720px]">
              {/* header */}
              <div
                className={`${GRID} border-b border-line px-4 py-3 text-sm font-medium text-ink`}
              >
                <span>Title</span>
                <span>Type</span>
                <span>Source</span>
                <span>Added</span>
                <span>Status</span>
              </div>
              {/* rows */}
              <ul>
                {filtered.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/p/${slug}/library/${r.id}`}
                      className={`${GRID} items-baseline border-b border-line px-4 py-3 transition-colors last:border-b-0 hover:bg-ink/[0.015] focus:bg-ink/[0.03] outline-none`}
                    >
                      <span className="min-w-0 truncate text-sm text-ink">
                        {name(r)}
                      </span>
                      <span className="min-w-0 truncate font-mono text-[12px] uppercase text-ink-faint">
                        {r.type}
                      </span>
                      <span className="min-w-0 truncate font-mono text-[12px] text-ink-faint">
                        {sourceLabel(r)}
                      </span>
                      <span className="min-w-0 truncate font-mono text-[12px] text-ink-faint">
                        {addedLabel(r.capturedAt)}
                      </span>
                      <span
                        className={`min-w-0 truncate font-mono text-[12px] ${
                          STATUS_CLASS[r.status] ?? "text-ink-dim"
                        }`}
                      >
                        {r.status}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
