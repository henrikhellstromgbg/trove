"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useProject } from "@/app/project-context";
import {
  Button,
  DataList,
  DataRow,
  EmptyState,
  InlineError,
  StatusIndicator,
} from "@/app/components/ui";
import { describeStarterPipelineSchedule } from "@/lib/pipelines/templates";

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

    async function load() {
      try {
        const res = await fetch(
          `/api/pipelines/templates?projectId=${encodeURIComponent(project.id)}`
        );
        const data = (await res.json().catch(() => ({}))) as {
          templates?: Template[];
        };
        if (!alive) return;

        const list = res.ok ? data.templates ?? [] : [];
        setTemplates(list);
        setEmail(
          Object.fromEntries(list.map((template) => [template.id, template.defaultDeliverByEmail])),
        );

        if (!res.ok) {
          setError((data as { error?: string }).error ?? `error ${res.status}`);
        }
      } catch {
        if (!alive) return;
        setTemplates([]);
        setError("could not load templates");
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [project.id]);

  async function install(templateId: string) {
    if (busyId) return;

    setBusyId(templateId);
    setError("");

    try {
      const res = await fetch("/api/pipelines/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          projectId: project.id,
          deliverByEmail: email[templateId] ?? false,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        pipelineId?: string;
      };

      if (!res.ok) {
        setError(data.error ?? `error ${res.status}`);
        return;
      }

      if (data.pipelineId) {
        router.push(`/p/${project.slug}/pipelines/${data.pipelineId}`);
      }
    } finally {
      setBusyId(null);
    }
  }

  if (templates === null) {
    return <p className="font-mono text-sm text-ink-faint">loading templates…</p>;
  }

  if (templates.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <EmptyState message="No starter templates available." />
        <InlineError message={error} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <DataList>
        {templates.map((template) => (
          <DataRow
            key={template.id}
            leading={
              <span
                className="text-xs font-medium text-ink-dim"
                title={template.cron}
              >
                {describeStarterPipelineSchedule(template.cron)}
              </span>
            }
            trailing={
              template.installed ? (
                <div className="flex items-center gap-3">
                  <StatusIndicator status="approved" label="added" />
                  {template.installedPipelineId ? (
                    <Link
                      href={`/p/${project.slug}/pipelines/${template.installedPipelineId}`}
                      className="text-xs font-medium text-ink-dim underline underline-offset-2 transition-colors hover:text-ink"
                    >
                      open
                    </Link>
                  ) : null}
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs text-ink-dim">
                    <input
                      type="checkbox"
                      checked={email[template.id] ?? false}
                      onChange={(event) =>
                        setEmail((prev) => ({
                          ...prev,
                          [template.id]: event.target.checked,
                        }))
                      }
                    />
                    email me result
                  </label>
                  <Button
                    variant="secondary"
                    onClick={() => install(template.id)}
                    disabled={busyId === template.id}
                    className="px-3 py-1.5 text-xs"
                  >
                    {busyId === template.id ? "adding" : "add"}
                  </Button>
                </div>
              )
            }
          >
            <div className="flex min-w-0 flex-col gap-1">
              <span className="truncate text-base font-medium text-ink">
                {template.title}
              </span>
              <span className="line-clamp-2 text-sm text-ink-dim">
                {template.description}
              </span>
              <span className="text-xs text-ink-faint">
                {template.pipelineName}
              </span>
            </div>
          </DataRow>
        ))}
      </DataList>

      <InlineError message={error} />
    </div>
  );
}
