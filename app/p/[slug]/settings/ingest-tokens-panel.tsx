"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useProject } from "@/app/project-context";

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
  // Default to the current project: a daemon token that lands everything in one
  // project is the safe common case. Empty string means an unlocked token.
  const [lockProjectId, setLockProjectId] = useState<string>(project.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [justCreated, setJustCreated] = useState<CreatedToken | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/ingest-tokens")
      .then((r) => (r.ok ? r.json() : { tokens: [] }))
      .then((data) => {
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

    const res = await fetch("/api/ingest-tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: label.trim() || null,
        projectId: lockProjectId || null,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setError(err.error ?? `error ${res.status}`);
      setBusy(false);
      return;
    }

    const created: CreatedToken = await res.json();
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
    setBusy(false);
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
      prev.map((t) => (t.id === id ? { ...t, revokedAt: revokedAt ?? new Date().toISOString() } : t))
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-5 rounded-2xl border border-line bg-paper p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)] md:p-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium text-ink">Ingest tokens</h2>
        <p className="text-sm text-ink-dim">
          The desktop app and other server callers use these to send items into a
          project. Lock a token to one project, or leave it open to all of yours.
        </p>
      </div>

      {/* create */}
      <div className="flex flex-col gap-3 border-t border-line pt-5">
        <label className="flex flex-col gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
            label, optional
          </span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="my mac, the studio imac, whatever helps you remember"
            className="bg-transparent text-base text-ink placeholder:text-ink-faint"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
            scope
          </span>
          <select
            value={lockProjectId}
            onChange={(e) => setLockProjectId(e.target.value)}
            className="rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink"
          >
            <option value="">any project (unlocked)</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                only {p.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center justify-between gap-4">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
            {busy ? "issuing" : error || "shown once, so keep it safe"}
          </span>
          <motion.button
            onClick={create}
            whileTap={{ scale: 0.97 }}
            disabled={busy}
            className="shrink-0 rounded-lg border border-line-strong bg-paper px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-ink disabled:opacity-40"
          >
            issue token
          </motion.button>
        </div>
      </div>

      {/* the one-time reveal */}
      {justCreated ? (
        <div className="flex flex-col gap-2 rounded-xl border border-capture/40 bg-capture/[0.06] p-4">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-dim">
            new token · copy it now, you won&apos;t see it again
          </span>
          <code className="block break-all font-mono text-sm text-ink">
            {justCreated.token}
          </code>
          <div className="flex items-center gap-3">
            <button
              onClick={copyToken}
              className="rounded-lg border border-line-strong bg-paper px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-ink"
            >
              {copied ? "copied" : "copy"}
            </button>
            <button
              onClick={() => {
                setJustCreated(null);
                setCopied(false);
              }}
              className="text-xs text-ink-dim underline underline-offset-2 transition-colors hover:text-ink"
            >
              done
            </button>
          </div>
        </div>
      ) : null}

      {/* existing tokens */}
      <div className="flex flex-col gap-2 border-t border-line pt-5">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
          your tokens
        </span>
        {loading ? (
          <p className="font-mono text-sm text-ink-faint">loading…</p>
        ) : tokens.length === 0 ? (
          <p className="font-mono text-sm text-ink-faint">none yet.</p>
        ) : (
          <ul className="flex flex-col">
            {tokens.map((t) => {
              const revoked = t.revokedAt != null;
              return (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-4 border-b border-line py-3 last:border-b-0"
                >
                  <div className="flex min-w-0 flex-col">
                    <span
                      className={`truncate text-sm ${revoked ? "text-ink-faint line-through" : "text-ink"}`}
                    >
                      {t.label || "unlabelled token"}
                    </span>
                    <span className="font-mono text-xs text-ink-faint">
                      {projectName(t.projectId)} · issued {fmtDate(t.createdAt)}
                      {revoked ? " · revoked" : ""}
                    </span>
                  </div>
                  {revoked ? (
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-ghost">
                      revoked
                    </span>
                  ) : (
                    <button
                      onClick={() => revoke(t.id)}
                      className="shrink-0 text-xs text-brand underline underline-offset-2 transition-colors hover:text-ink"
                    >
                      revoke
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
