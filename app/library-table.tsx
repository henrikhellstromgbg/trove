"use client";

import { useMemo, useState } from "react";
import { Search } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { DataList, DataRow } from "@/components/ui/data-list";
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
              placeholder={limited ? "Search newest 200 items" : "Search title or source"}
              aria-label={limited ? "Search newest 200 library items" : "Search library"}
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
      )}
    </div>
  );
}
