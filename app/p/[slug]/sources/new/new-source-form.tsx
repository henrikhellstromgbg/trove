"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProject } from "@/app/project-context";
import {
  Button,
  InlineError,
  TextField,
  TextArea,
  Select,
  cx,
} from "@/app/components/ui";

const CRON_PRESETS = [
  { label: "Every hour", value: "0 * * * *" },
  { label: "Every 6 hours", value: "0 */6 * * *" },
  { label: "Daily at 8am", value: "0 8 * * *" },
];

const KINDS = [
  { value: "rss", label: "RSS feed" },
  { value: "web_scrape", label: "Web page" },
  { value: "slack_channel", label: "Slack channel" },
  { value: "mail_folder", label: "Mail folder" },
  { value: "folder_watch", label: "Watched folder" },
] as const;

type Kind = (typeof KINDS)[number]["value"];

// Local kinds run on the user's Mac through the desktop daemon, not on the
// server. Creating one here just registers it; the daemon fetches its approved
// list from /api/sources/local and does the actual reading.
const LOCAL_KINDS: readonly Kind[] = ["mail_folder", "folder_watch"];

// The list config fields (sender allow/block, globs) are arrays server-side.
// Let people type one per line or comma-separated, then normalise.
function parseList(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/[\n,]/)
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    ),
  ];
}

const DEFAULT_GLOBS_HINT = "**/*.pdf, **/*.txt, **/*.md, **/*.docx, **/*.xlsx, **/*.csv";

export function NewSourceForm() {
  const router = useRouter();
  const { project } = useProject();
  const [kind, setKind] = useState<Kind>("rss");
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
  const [cron, setCron] = useState(CRON_PRESETS[0].value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>("");

  const isLocal = LOCAL_KINDS.includes(kind);

  function primaryFieldFilled() {
    if (kind === "rss") return feedUrl.trim().length > 0;
    if (kind === "web_scrape") return url.trim().length > 0;
    if (kind === "slack_channel") return channelId.trim().length > 0;
    if (kind === "mail_folder") return mboxPath.trim().length > 0;
    if (kind === "folder_watch") return folderPath.trim().length > 0;
    return false;
  }

  const canSubmit = name.trim().length > 0 && primaryFieldFilled() && !busy;

  async function submit() {
    const n = name.trim();
    if (n.length === 0 || !primaryFieldFilled() || busy) return;

    setBusy(true);
    setError("");

    const body: Record<string, unknown> = {
      kind,
      name: n,
      projectId: project.id,
    };
    // Cloud sources sync on a cron the server runs. Local sources are polled by
    // the desktop daemon on its own timer, so we leave cron at its default.
    if (!isLocal) body.cron = cron;
    if (kind === "rss") body.feedUrl = feedUrl.trim();
    if (kind === "web_scrape") {
      body.url = url.trim();
      if (selector.trim()) body.selector = selector.trim();
      body.followLinks = followLinks;
    }
    if (kind === "slack_channel") body.channelId = channelId.trim();
    if (kind === "mail_folder") {
      body.mboxPath = mboxPath.trim();
      body.senderAllow = parseList(senderAllow);
      body.senderBlock = parseList(senderBlock);
      body.promoBlocklist = parseList(promoBlocklist);
    }
    if (kind === "folder_watch") {
      body.folderPath = folderPath.trim();
      const globList = parseList(globs);
      if (globList.length > 0) body.globs = globList;
    }

    const res = await fetch("/api/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setError(err.error ?? `error ${res.status}`);
      setBusy(false);
      return;
    }

    const { id } = await res.json();
    router.push(`/p/${project.slug}/sources/${id}`);
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
        <legend className="mb-2 text-sm font-medium text-ink">Kind</legend>
        <div role="group" aria-label="Source kind" className="flex flex-wrap gap-2">
          {KINDS.map((k) => {
            const active = kind === k.value;
            return (
              <button
                key={k.value}
                type="button"
                aria-pressed={active}
                onClick={() => setKind(k.value)}
                className={cx(
                  "rounded-lg border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-dim focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
                  active
                    ? "border-ink bg-ink text-canvas"
                    : "border-line text-ink-dim hover:border-line-strong"
                )}
              >
                {k.label}
              </button>
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
            value={selector}
            onChange={(e) => setSelector(e.target.value)}
            placeholder="e.g. article a, .post-list a"
            className="font-mono"
          />
          <label className="flex items-start gap-2 text-sm text-ink-dim">
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
          value={channelId}
          onChange={(e) => setChannelId(e.target.value)}
          placeholder="C0123456789"
          className="font-mono"
          aria-describedby="channel-id-note"
        />
      ) : null}
      {kind === "slack_channel" ? (
        <p id="channel-id-note" className="-mt-4 text-xs text-ink-faint">
          The bot must already be invited to this channel.
        </p>
      ) : null}

      {isLocal ? (
        <p className="rounded-lg border border-line bg-canvas px-3 py-2.5 text-xs leading-relaxed text-ink-dim">
          Runs on your Mac. The Trove desktop app reads this path and sends new
          items to your library. The path must be one you approved in the app.
        </p>
      ) : null}

      {kind === "mail_folder" ? (
        <>
          <TextField
            id="mbox-path"
            label="Mbox path"
            value={mboxPath}
            onChange={(e) => setMboxPath(e.target.value)}
            placeholder="~/Library/Mail/.../INBOX.mbox"
            className="font-mono"
          />
          <TextArea
            id="sender-allow"
            label="Only from, optional"
            value={senderAllow}
            onChange={(e) => setSenderAllow(e.target.value)}
            rows={2}
            placeholder="one address or domain per line"
            className="resize-y font-mono"
            aria-describedby="sender-allow-note"
          />
          <p id="sender-allow-note" className="-mt-4 text-xs text-ink-faint">
            Leave empty to take everything.
          </p>
          <TextArea
            id="sender-block"
            label="Never from, optional"
            value={senderBlock}
            onChange={(e) => setSenderBlock(e.target.value)}
            rows={2}
            placeholder="one address or domain per line"
            className="resize-y font-mono"
          />
          <TextArea
            id="promo-blocklist"
            label="Drop as promo, optional"
            value={promoBlocklist}
            onChange={(e) => setPromoBlocklist(e.target.value)}
            rows={2}
            placeholder="words that mark a mail as promo, e.g. unsubscribe, sale"
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
            value={globs}
            onChange={(e) => setGlobs(e.target.value)}
            rows={2}
            placeholder={DEFAULT_GLOBS_HINT}
            className="resize-y font-mono"
            aria-describedby="globs-note"
          />
          <p id="globs-note" className="-mt-4 text-xs text-ink-faint">
            Leave empty for the defaults shown above.
          </p>
        </>
      ) : null}

      {!isLocal ? (
        <Select
          id="schedule"
          label="Check"
          value={cron}
          onChange={(e) => setCron(e.target.value)}
        >
          {CRON_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </Select>
      ) : null}

      <div className="flex flex-col gap-3 border-t border-line pt-5">
        <InlineError message={error || null} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-ink-dim" aria-live="polite">
            {busy ? "Saving…" : "Ready when you are"}
          </span>
          <Button
            type="submit"
            disabled={!canSubmit}
            aria-busy={busy}
            className="shrink-0"
          >
            {busy ? "Saving…" : "Add source"}
          </Button>
        </div>
      </div>
    </form>
  );
}
