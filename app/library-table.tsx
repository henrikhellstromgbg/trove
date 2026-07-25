"use client";

import { useMemo, useState } from "react";
import { Search } from "@carbon/icons-react";
import {
  DataList,
  DataRow,
  StatusIndicator,
  type Status,
} from "@/components/ui";

export type Row = {
  id: string;
  title: string | null;
  type: string;
  source: string | null;
  status: string;
  capturedAt: string;
};

type SortKey = "added-desc" | "added-asc" | "title-asc" | "type-asc";

function isUrl(value: string | null): value is string {
  return !!value && /^https?:\/\//i.test(value);
}

function statusTone(status: string): Status {
  if (status === "ready") return "success";
  if (status === "failed") return "error";
  if (status === "processing") return "active";
  return "paused";
}

function name(row: Row): string {
  return row.title ?? row.source ?? "(untitled)";
}

function sourceLabel(row: Row): string {
  if (!row.source) return "None";
  if (isUrl(row.source)) {
    try {
      return new URL(row.source).host;
    } catch {
      return row.source;
    }
  }
  return row.source;
}

function addedLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const CONTROL =
  "rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-border)] focus:border-[var(--color-border)]";

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
    for (const item of items) set.add(item.type);
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = items.filter((row) => {
      if (typeFilter !== "all" && row.type !== typeFilter) return false;
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (q) {
        const hay = `${row.title ?? ""} ${row.source ?? ""}`.toLowerCase();
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
          name(a).localeCompare(name(b), undefined, { sensitivity: "base" }),
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
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]"
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
          {types.map((type) => (
            <option key={type} value={type}>
              {type}
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

      {filtered.length === 0 ? (
        <div className="flex flex-col items-start gap-2 py-6">
          <p className="text-sm text-[var(--color-text-tertiary)]">No matches.</p>
          <button
            type="button"
            onClick={clearFilters}
            className="text-sm font-medium text-[var(--color-text-primary)] underline underline-offset-2 transition-colors hover:text-[var(--color-brand)] focus:text-[var(--color-brand)]"
          >
            clear filters
          </button>
        </div>
      ) : (
        <DataList>
          {filtered.map((row) => (
            <DataRow
              key={row.id}
              href={`/p/${slug}/library/${row.id}`}
              selectLabel={`Open ${name(row)}`}
              trailing={
                <div className="flex flex-col items-end gap-1 text-right">
                  <span className="font-mono text-sm text-[var(--color-text-tertiary)]">
                    {addedLabel(row.capturedAt)}
                  </span>
                  <StatusIndicator
                    status={statusTone(row.status)}
                    label={row.status}
                  />
                </div>
              }
            >
              <div className="flex min-w-0 flex-col gap-1">
                <span className="min-w-0 truncate text-sm font-medium text-[var(--color-text-primary)]">
                  {name(row)}
                </span>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--color-text-secondary)]">
                  <span>{row.type}</span>
                  <span className="truncate">{sourceLabel(row)}</span>
                </div>
              </div>
            </DataRow>
          ))}
        </DataList>
      )}
    </div>
  );
}
