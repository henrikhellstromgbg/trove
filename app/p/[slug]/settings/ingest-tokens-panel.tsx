"use client";

import { useEffect, useState } from "react";
import { useProject } from "@/app/project-context";
import {
  Button,
  DataList,
  DataRow,
  EmptyState,
  InlineError,
  Select,
  TextField,
} from "@/app/components/ui";

type TokenRow = {
  id: string;
  label: string | null;
  projectId: string | null;
  createdAt: string;
  revokedAt: string | null;
};

type CreatedToken = {
  token: string;
  id: string;
  projectId: string | null;
  label: string | null;
  createdAt: string;
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB");
}

export function IngestTokensPanel() {
  const { project, projects } = useProject();
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [lockProjectId, setLockProjectId] = useState<string>(project.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [justCreated, setJustCreated] = useState<CreatedToken | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLockProjectId(project.id);
  }, [project.id]);

  useEffect(() => {
    let alive = true;

    fetch("/api/ingest-tokens")
      .then((r) => (r.ok ? r.json() : { tokens: [] }))
      .then((data: { tokens?: TokenRow[] }) => {
        if (alive) setTokens(data.tokens ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  function projectName(projectId: string | null): string {
    if (!projectId) return "any project";
    return projects.find((p) => p.id === projectId)?.name ?? "unknown project";
  }

  async function create() {
    if (busy) return;

    setBusy(true);
    setError("");
    setCopied(false);

    try {
      const res = await fetch("/api/ingest-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim() || null,
          projectId: lockProjectId || null,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as
        | CreatedToken
        | { error?: string };

      if (!res.ok) {
        setError((data as { error?: string }).error ?? `error ${res.status}`);
        return;
      }

      const created = data as CreatedToken;
      setJustCreated(created);
      setTokens((prev) => [
        {
          id: created.id,
          label: created.label,
          projectId: created.projectId,
          createdAt: created.createdAt,
          revokedAt: null,
        },
        ...prev,
      ]);
      setLabel("");
    } finally {
      setBusy(false);
    }
  }

  async function copyToken() {
    if (!justCreated) return;
    try {
      await navigator.clipboard.writeText(justCreated.token);
      setCopied(true);
    } catch {
      // Clipboard can be blocked; the token stays visible to copy by hand.
    }
  }

  async function revoke(id: string) {
    const res = await fetch(`/api/ingest-tokens/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    const { revokedAt } = await res.json();
    setTokens((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, revokedAt: revokedAt ?? new Date().toISOString() } : t
      )
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 border border-line bg-paper p-6">
        <TextField
          id="token-label"
          label="Label, optional"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="my mac, the studio imac, whatever helps you remember"
          containerClassName="gap-2"
          className="bg-transparent text-base"
        />

        <Select
          id="token-scope"
          label="Scope"
          value={lockProjectId}
          onChange={(e) => setLockProjectId(e.target.value)}
          containerClassName="gap-2"
        >
          <option value="">Any project (unlocked)</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              Only {p.name}
            </option>
          ))}
        </Select>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-4">
          <p className="text-sm text-ink-dim">
            {busy ? "Issuing..." : error || "Shown once, so keep it safe."}
          </p>
          <Button onClick={create} disabled={busy}>
            Issue token
          </Button>
        </div>

        <InlineError message={error} />
      </div>

      {justCreated ? (
        <div className="flex flex-col gap-3 border border-capture/40 bg-capture/[0.06] p-4">
          <p className="text-sm font-medium text-ink-dim">
            New token. Copy it now, you will not see it again.
          </p>
          <code className="block break-all font-mono text-sm text-ink">
            {justCreated.token}
          </code>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={copyToken}>
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setJustCreated(null);
                setCopied(false);
              }}
            >
              Done
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        <h3 className="text-base font-medium text-ink">Your tokens</h3>
        {loading ? (
          <p className="text-sm text-ink-faint">Loading...</p>
        ) : tokens.length === 0 ? (
          <EmptyState message="No tokens yet." />
        ) : (
          <DataList>
            {tokens.map((t) => {
              const revoked = t.revokedAt != null;
              return (
                <DataRow
                  key={t.id}
                  leading={
                    <span className="font-mono text-xs text-ink-faint">
                      {fmtDate(t.createdAt)}
                    </span>
                  }
                  trailing={
                    revoked ? (
                      <span className="text-xs font-medium text-ink-ghost">
                        revoked
                      </span>
                    ) : (
                      <Button
                        variant="destructive"
                        onClick={() => revoke(t.id)}
                        className="px-3 py-1.5 text-xs"
                      >
                        Revoke
                      </Button>
                    )
                  }
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <span
                      className={`truncate text-sm ${revoked ? "text-ink-faint line-through" : "text-ink"}`}
                    >
                      {t.label || "Unlabelled token"}
                    </span>
                    <span className="text-xs text-ink-faint">
                      {projectName(t.projectId)} · issued {fmtDate(t.createdAt)}
                      {revoked ? " · revoked" : ""}
                    </span>
                  </div>
                </DataRow>
              );
            })}
          </DataList>
        )}
      </div>
    </div>
  );
}
