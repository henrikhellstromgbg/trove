"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProject } from "@/app/project-context";
import { Button, InlineError, TextField, TextArea } from "@/components/ui";
import { requestJson } from "../request-json";
import {
  SOURCE_KIND_OPTIONS,
  isLocalSourceKind,
  type SourceKind,
} from "../source-display";
import {
  buildSourceRequestBody,
  sourcePrimaryFieldFilled,
  type SourceFormValues,
} from "./source-form-data";
import { ScheduleField } from "./schedule-field";
import {
  buildScheduleCron,
  DEFAULT_SCHEDULE,
  type ScheduleValue,
} from "./schedule-cron";

const DEFAULT_GLOBS_HINT = "**/*.pdf, **/*.txt, **/*.md, **/*.docx, **/*.xlsx, **/*.csv";

export function NewSourceForm() {
  const router = useRouter();
  const { project } = useProject();
  const [kind, setKind] = useState<SourceKind>("rss");
  const [name, setName] = useState("");
  const [feedUrl, setFeedUrl] = useState("");
  const [url, setUrl] = useState("");
  const [selector, setSelector] = useState("");
  const [followLinks, setFollowLinks] = useState(false);
  const [channelId, setChannelId] = useState("");
  const [mboxPath, setMboxPath] = useState("");
  const [senderAllow, setSenderAllow] = useState("");
  const [senderBlock, setSenderBlock] = useState("");
  const [promoBlocklist, setPromoBlocklist] = useState("");
  const [folderPath, setFolderPath] = useState("");
  const [globs, setGlobs] = useState("");
  const [schedule, setSchedule] = useState<ScheduleValue>(DEFAULT_SCHEDULE);
  const cron = buildScheduleCron(schedule);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>("");

  const values: SourceFormValues = {
    kind,
    name,
    feedUrl,
    url,
    selector,
    followLinks,
    channelId,
    mboxPath,
    senderAllow,
    senderBlock,
    promoBlocklist,
    folderPath,
    globs,
    cron,
  };
  const isLocal = isLocalSourceKind(kind);
  const canSubmit =
    name.trim().length > 0 && sourcePrimaryFieldFilled(values) && !busy;

  async function submit() {
    const n = name.trim();
    if (n.length === 0 || !sourcePrimaryFieldFilled(values) || busy) return;

    setBusy(true);
    setError("");

    const result = await requestJson<{ id: string }>("/api/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildSourceRequestBody(values, project.id)),
    });
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    router.push(`/p/${project.slug}/sources/${result.data.id}`);
  }

  return (
    <form
      className="flex w-full max-w-xl flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium text-[var(--color-text-primary)]">Kind</legend>
        <div role="group" aria-label="Source kind" className="flex flex-wrap gap-2">
          {SOURCE_KIND_OPTIONS.map((k) => {
            const active = kind === k.value;
            return (
              <Button
                key={k.value}
                type="button"
                size="sm"
                variant={active ? "primary" : "secondary"}
                aria-pressed={active}
                onClick={() => setKind(k.value)}
              >
                {k.label}
              </Button>
            );
          })}
        </div>
      </fieldset>

      <TextField
        id="source-name"
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="A blog, a newsletter, whatever it is"
      />

      {kind === "rss" ? (
        <TextField
          id="feed-url"
          label="Feed URL"
          value={feedUrl}
          onChange={(e) => setFeedUrl(e.target.value)}
          placeholder="https://example.com/feed.xml"
        />
      ) : null}

      {kind === "web_scrape" ? (
        <>
          <TextField
            id="page-url"
            label="Page URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/blog"
          />
          <TextField
            id="link-selector"
            label="Link selector, optional"
            description="A CSS selector for the links to follow. Leave empty to scan the whole page."
            value={selector}
            onChange={(e) => setSelector(e.target.value)}
            placeholder="article a, .post-list a"
            className="font-mono"
          />
          <label className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]">
            <input
              type="checkbox"
              checked={followLinks}
              onChange={(e) => setFollowLinks(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Follow links found on the page, capture new ones each sync
            </span>
          </label>
        </>
      ) : null}

      {kind === "slack_channel" ? (
        <TextField
          id="channel-id"
          label="Channel ID"
          description="The bot must already be invited to this channel."
          value={channelId}
          onChange={(e) => setChannelId(e.target.value)}
          placeholder="C0123456789"
          className="font-mono"
        />
      ) : null}

      {isLocal ? (
        <p className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-canvas)] px-3 py-2.5 text-sm leading-relaxed text-[var(--color-text-secondary)]">
          Runs on your Mac. The Trove desktop app reads this path and sends new
          items to your library. The path must be one you approved in the app.
        </p>
      ) : null}

      {kind === "mail_folder" ? (
        <>
          <TextField
            id="mbox-path"
            label="Mbox path"
            description="The full path to a .mbox file on your Mac. The desktop app can only read a path you approved."
            value={mboxPath}
            onChange={(e) => setMboxPath(e.target.value)}
            placeholder="~/Library/Mail/.../INBOX.mbox"
            className="font-mono"
          />
          <TextArea
            id="sender-allow"
            label="Only from, optional"
            description="One address or domain per line. Leave empty to take everything."
            value={senderAllow}
            onChange={(e) => setSenderAllow(e.target.value)}
            rows={2}
            placeholder="hello@acme.com"
            className="resize-y font-mono"
          />
          <TextArea
            id="sender-block"
            label="Never from, optional"
            description="One address or domain per line."
            value={senderBlock}
            onChange={(e) => setSenderBlock(e.target.value)}
            rows={2}
            placeholder="noreply@acme.com"
            className="resize-y font-mono"
          />
          <TextArea
            id="promo-blocklist"
            label="Drop as promo, optional"
            description="Words that mark a mail as promo, one per line."
            value={promoBlocklist}
            onChange={(e) => setPromoBlocklist(e.target.value)}
            rows={2}
            placeholder="unsubscribe, sale"
            className="resize-y font-mono"
          />
        </>
      ) : null}

      {kind === "folder_watch" ? (
        <>
          <TextField
            id="folder-path"
            label="Folder path"
            value={folderPath}
            onChange={(e) => setFolderPath(e.target.value)}
            placeholder="~/Documents/inbox"
            className="font-mono"
          />
          <TextArea
            id="globs"
            label="File patterns, optional"
            description={`One glob per line. Leave empty for the defaults: ${DEFAULT_GLOBS_HINT}`}
            value={globs}
            onChange={(e) => setGlobs(e.target.value)}
            rows={2}
            placeholder="**/*.pdf"
            className="resize-y font-mono"
          />
        </>
      ) : null}

      <ScheduleField value={schedule} onChange={setSchedule} />

      <div className="flex flex-col gap-3 border-t border-[var(--color-border-subtle)] pt-5">
        <InlineError message={error || null} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-[var(--color-text-secondary)]" aria-live="polite">
            {busy ? "Saving…" : "Ready when you are"}
          </span>
          <div className="shrink-0">
            <Button
              type="submit"
              disabled={!canSubmit}
              aria-busy={busy}
            >
              {busy ? "Saving…" : "Add source"}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
