"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useProject } from "@/app/project-context";

const CRON_PRESETS = [
  { label: "every hour", value: "0 * * * *" },
  { label: "every 6 hours", value: "0 */6 * * *" },
  { label: "daily at 8am", value: "0 8 * * *" },
];

const KINDS = [
  { value: "rss", label: "rss feed" },
  { value: "web_scrape", label: "web page" },
  { value: "slack_channel", label: "slack channel" },
  { value: "mail_folder", label: "mail folder" },
  { value: "folder_watch", label: "watched folder" },
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
    <div className="flex max-w-xl flex-col gap-5 rounded-2xl border border-line bg-paper p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)] md:p-8">
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
          kind
        </span>
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <button
              key={k.value}
              onClick={() => setKind(k.value)}
              className={`rounded-lg border px-3 py-1.5 text-xs uppercase tracking-wider transition-colors ${
                kind === k.value
                  ? "border-ink bg-ink text-canvas"
                  : "border-line text-ink-dim hover:border-line-strong"
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
          name
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="a blog, a newsletter, whatever it is"
          className="bg-transparent text-lg text-ink placeholder:text-ink-faint"
        />
      </label>

      {kind === "rss" ? (
        <label className="flex flex-col gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
            feed url
          </span>
          <input
            value={feedUrl}
            onChange={(e) => setFeedUrl(e.target.value)}
            placeholder="https://example.com/feed.xml"
            className="bg-transparent text-lg text-ink placeholder:text-ink-faint"
          />
        </label>
      ) : null}

      {kind === "web_scrape" ? (
        <>
          <label className="flex flex-col gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
              page url
            </span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/blog"
              className="bg-transparent text-lg text-ink placeholder:text-ink-faint"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
              link selector, optional
            </span>
            <input
              value={selector}
              onChange={(e) => setSelector(e.target.value)}
              placeholder="e.g. article a, .post-list a"
              className="bg-transparent font-mono text-sm text-ink placeholder:text-ink-faint"
            />
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={followLinks}
              onChange={(e) => setFollowLinks(e.target.checked)}
            />
            <span className="text-sm text-ink-dim">
              follow links found on the page, capture new ones each sync
            </span>
          </label>
        </>
      ) : null}

      {kind === "slack_channel" ? (
        <label className="flex flex-col gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
            channel id
          </span>
          <input
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
            placeholder="C0123456789"
            className="bg-transparent font-mono text-lg text-ink placeholder:text-ink-faint"
          />
          <span className="text-xs text-ink-faint">
            the bot must already be invited to this channel.
          </span>
        </label>
      ) : null}

      {isLocal ? (
        <p className="rounded-lg border border-line bg-canvas px-3 py-2.5 text-xs leading-relaxed text-ink-dim">
          runs on your mac. the trove desktop app reads this path and sends new
          items to your library. the path must be one you approved in the app.
        </p>
      ) : null}

      {kind === "mail_folder" ? (
        <>
          <label className="flex flex-col gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
              mbox path
            </span>
            <input
              value={mboxPath}
              onChange={(e) => setMboxPath(e.target.value)}
              placeholder="~/Library/Mail/.../INBOX.mbox"
              className="bg-transparent font-mono text-sm text-ink placeholder:text-ink-faint"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
              only from, optional
            </span>
            <textarea
              value={senderAllow}
              onChange={(e) => setSenderAllow(e.target.value)}
              rows={2}
              placeholder="one address or domain per line"
              className="resize-y bg-transparent font-mono text-sm text-ink placeholder:text-ink-faint"
            />
            <span className="text-xs text-ink-faint">
              leave empty to take everything.
            </span>
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
              never from, optional
            </span>
            <textarea
              value={senderBlock}
              onChange={(e) => setSenderBlock(e.target.value)}
              rows={2}
              placeholder="one address or domain per line"
              className="resize-y bg-transparent font-mono text-sm text-ink placeholder:text-ink-faint"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
              drop as promo, optional
            </span>
            <textarea
              value={promoBlocklist}
              onChange={(e) => setPromoBlocklist(e.target.value)}
              rows={2}
              placeholder="words that mark a mail as promo, e.g. unsubscribe, sale"
              className="resize-y bg-transparent font-mono text-sm text-ink placeholder:text-ink-faint"
            />
          </label>
        </>
      ) : null}

      {kind === "folder_watch" ? (
        <>
          <label className="flex flex-col gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
              folder path
            </span>
            <input
              value={folderPath}
              onChange={(e) => setFolderPath(e.target.value)}
              placeholder="~/Documents/inbox"
              className="bg-transparent font-mono text-sm text-ink placeholder:text-ink-faint"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
              file patterns, optional
            </span>
            <textarea
              value={globs}
              onChange={(e) => setGlobs(e.target.value)}
              rows={2}
              placeholder={DEFAULT_GLOBS_HINT}
              className="resize-y bg-transparent font-mono text-sm text-ink placeholder:text-ink-faint"
            />
            <span className="text-xs text-ink-faint">
              leave empty for the defaults shown above.
            </span>
          </label>
        </>
      ) : null}

      {!isLocal ? (
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
            check
          </span>
          <div className="flex flex-wrap gap-2">
            {CRON_PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => setCron(p.value)}
                className={`rounded-lg border px-3 py-1.5 text-xs uppercase tracking-wider transition-colors ${
                  cron === p.value
                    ? "border-ink bg-ink text-canvas"
                    : "border-line text-ink-dim hover:border-line-strong"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-4 border-t border-line pt-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
          {busy ? "saving" : error || "ready when you are"}
        </span>
        <motion.button
          onClick={submit}
          whileTap={{ scale: 0.97 }}
          className="shrink-0 rounded-lg border border-line-strong bg-paper px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-ink"
        >
          add source
        </motion.button>
      </div>
    </div>
  );
}
