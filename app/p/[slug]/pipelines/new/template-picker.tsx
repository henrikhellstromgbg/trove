"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useProject } from "@/app/project-context";

type Template = {
  id: string;
  title: string;
  pipelineName: string;
  description: string;
  cron: string;
  defaultDeliverByEmail: boolean;
  installed: boolean;
  installedPipelineId: string | null;
};

export function TemplatePicker() {
  const { project } = useProject();
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [email, setEmail] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    fetch(`/api/pipelines/templates?projectId=${encodeURIComponent(project.id)}`)
      .then((r) => (r.ok ? r.json() : { templates: [] }))
      .then((data: { templates?: Template[] }) => {
        if (!alive) return;
        const list = data.templates ?? [];
        setTemplates(list);
        setEmail(
          Object.fromEntries(list.map((t) => [t.id, t.defaultDeliverByEmail]))
        );
      })
      .catch(() => {
        if (alive) setTemplates([]);
      });
    return () => {
      alive = false;
    };
  }, [project.id]);

  async function install(templateId: string) {
    if (busyId) return;
    setBusyId(templateId);
    setError("");
    const res = await fetch("/api/pipelines/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateId,
        projectId: project.id,
        deliverByEmail: email[templateId] ?? false,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setError(err.error ?? `error ${res.status}`);
      setBusyId(null);
      return;
    }
    const { pipelineId } = await res.json();
    router.push(`/p/${project.slug}/pipelines/${pipelineId}`);
  }

  if (templates === null) {
    return (
      <p className="font-mono text-sm text-ink-faint">loading templates…</p>
    );
  }

  if (templates.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {templates.map((t) => (
          <div
            key={t.id}
            className="flex flex-col gap-3 rounded-2xl border border-line bg-paper p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-lg font-medium tracking-tight text-ink">
                {t.title}
              </h3>
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
                {t.cron}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-ink-dim">{t.description}</p>

            {t.installed ? (
              <div className="mt-1 flex items-center justify-between gap-3 border-t border-line pt-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
                  already added
                </span>
                {t.installedPipelineId ? (
                  <Link
                    href={`/p/${project.slug}/pipelines/${t.installedPipelineId}`}
                    className="text-xs text-ink-dim underline underline-offset-2 transition-colors hover:text-ink"
                  >
                    open it
                  </Link>
                ) : null}
              </div>
            ) : (
              <div className="mt-1 flex items-center justify-between gap-3 border-t border-line pt-3">
                <label className="flex items-center gap-2 text-xs text-ink-dim">
                  <input
                    type="checkbox"
                    checked={email[t.id] ?? false}
                    onChange={(e) =>
                      setEmail((prev) => ({ ...prev, [t.id]: e.target.checked }))
                    }
                  />
                  email me the result
                </label>
                <motion.button
                  onClick={() => install(t.id)}
                  whileTap={{ scale: 0.97 }}
                  disabled={busyId === t.id}
                  className="shrink-0 rounded-lg border border-line-strong bg-paper px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-ink disabled:opacity-40"
                >
                  {busyId === t.id ? "adding" : "add"}
                </motion.button>
              </div>
            )}
          </div>
        ))}
      </div>
      {error ? <p className="text-xs text-brand">{error}</p> : null}
    </div>
  );
}
