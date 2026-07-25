"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { DataList, DataRow } from "@/components/ui/data-list";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/components/ui/pagination";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { StatusIndicator, type Status } from "@/components/ui/status-indicator";
import { statusLabel } from "@/lib/status-label";

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
  return row.title ?? row.source ?? "(Untitled)";
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

const PAGE_SIZE = 50;

// Page numbers to render, with "gap" markers where pages are elided. Always
// shows first, last, and the current page with a neighbour on each side.
function pageWindow(current: number, total: number): Array<number | "gap"> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const out: Array<number | "gap"> = [1];
  const from = Math.max(2, current - 1);
  const to = Math.min(total - 1, current + 1);
  if (from > 2) out.push("gap");
  for (let p = from; p <= to; p++) out.push(p);
  if (to < total - 1) out.push("gap");
  out.push(total);
  return out;
}

export function LibraryTable({
  slug,
  items,
}: {
  slug: string;
  items: Row[];
}) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState<SortKey>("added-desc");
  const [page, setPage] = useState(1);

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

  // Reset to the first page whenever the result set changes, so the user is
  // never stranded on a page that no longer exists (U8).
  useEffect(() => {
    setPage(1);
  }, [query, typeFilter, statusFilter, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(start, start + PAGE_SIZE);
  const rangeStart = filtered.length === 0 ? 0 : start + 1;
  const rangeEnd = start + pageRows.length;

  function clearFilters() {
    setQuery("");
    setTypeFilter("all");
    setStatusFilter("all");
    setSort("added-desc");
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
          <Label htmlFor="library-search">Search</Label>
          <InputGroup>
            <InputGroupAddon>
              <Search aria-hidden="true" size={16} />
            </InputGroupAddon>
            <InputGroupInput
              id="library-search"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title or source"
              aria-label="Search library"
            />
          </InputGroup>
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="type-filter">Type</Label>
          <NativeSelect
            id="type-filter"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <NativeSelectOption value="all">All types</NativeSelectOption>
            {types.map((type) => (
              <NativeSelectOption key={type} value={type}>
                {type}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="status-filter">Status</Label>
          <NativeSelect
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <NativeSelectOption value="all">All statuses</NativeSelectOption>
            <NativeSelectOption value="ready">Ready</NativeSelectOption>
            <NativeSelectOption value="processing">Processing</NativeSelectOption>
            <NativeSelectOption value="pending">Pending</NativeSelectOption>
            <NativeSelectOption value="failed">Failed</NativeSelectOption>
          </NativeSelect>
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="sort">Sort</Label>
          <NativeSelect
            id="sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            <NativeSelectOption value="added-desc">Added newest</NativeSelectOption>
            <NativeSelectOption value="added-asc">Added oldest</NativeSelectOption>
            <NativeSelectOption value="title-asc">Title A to Z</NativeSelectOption>
            <NativeSelectOption value="type-asc">Type</NativeSelectOption>
          </NativeSelect>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-start gap-2 py-6">
          <p className="text-sm text-[var(--color-text-tertiary)]">No matches.</p>
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>
      ) : (
        <>
          <p
            className="text-sm text-[var(--color-text-tertiary)]"
            aria-live="polite"
          >
            Showing {rangeStart.toLocaleString("en-GB")} to{" "}
            {rangeEnd.toLocaleString("en-GB")} of{" "}
            {filtered.length.toLocaleString("en-GB")}
          </p>

          <DataList>
            {pageRows.map((row) => (
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
                      label={statusLabel(row.status)}
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

          {pageCount > 1 ? (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <Button
                    variant="ghost"
                    size="md"
                    onClick={() => setPage(safePage - 1)}
                    disabled={safePage === 1}
                    aria-label="Go to previous page"
                  >
                    <ChevronLeft size={16} aria-hidden="true" />
                    <span className="hidden sm:block">Previous</span>
                  </Button>
                </PaginationItem>

                {pageWindow(safePage, pageCount).map((p, i) =>
                  p === "gap" ? (
                    <PaginationItem key={`gap-${i}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={p}>
                      <Button
                        variant={p === safePage ? "secondary" : "ghost"}
                        size="icon"
                        aria-label={`Go to page ${p}`}
                        aria-current={p === safePage ? "page" : undefined}
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </Button>
                    </PaginationItem>
                  ),
                )}

                <PaginationItem>
                  <Button
                    variant="ghost"
                    size="md"
                    onClick={() => setPage(safePage + 1)}
                    disabled={safePage === pageCount}
                    aria-label="Go to next page"
                  >
                    <span className="hidden sm:block">Next</span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </Button>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          ) : null}
        </>
      )}
    </div>
  );
}
