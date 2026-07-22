const SLACK_API = "https://slack.com/api";

export type SlackMessage = {
  externalId: string; // message ts, unique within a channel
  text: string;
  postedAt: Date;
  threadTs?: string; // set on replies, so provenance can note the parent thread
};

// A file shared in a channel. externalId is the Slack file id, unique and
// stable, so item dedup works the same way it does for messages.
export type SlackFile = {
  externalId: string;
  name: string;
  mimeType: string;
  urlPrivate: string;
  size: number;
  postedAt: Date;
  threadTs?: string;
};

export type SlackHistoryResult = {
  messages: SlackMessage[];
  files: SlackFile[];
  latestTs: string | null;
};

type SlackApiFile = {
  id: string;
  name?: string;
  title?: string;
  mimetype?: string;
  url_private?: string;
  size?: number;
};

type SlackApiMessage = {
  ts: string;
  text?: string;
  subtype?: string;
  bot_id?: string;
  thread_ts?: string;
  reply_count?: number;
  files?: SlackApiFile[];
};

type SlackApiResponse = {
  ok: boolean;
  error?: string;
  messages?: SlackApiMessage[];
  has_more?: boolean;
  response_metadata?: { next_cursor?: string };
};

// Safety bound on cursor pagination so a pathological response can't loop
// forever; at 200/page this is 4000 messages per method call. Hitting it is
// logged, never silent.
const MAX_SLACK_PAGES = 20;

function slackToken(): string {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    throw new Error("SLACK_BOT_TOKEN is not configured");
  }
  return token;
}

async function slackGetPage(
  method: string,
  params: URLSearchParams,
  token: string
): Promise<{ messages: SlackApiMessage[]; nextCursor?: string }> {
  const res = await fetch(`${SLACK_API}/${method}?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await res.json()) as SlackApiResponse;
  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error ?? "unknown"}`);
  }
  const nextCursor =
    data.has_more && data.response_metadata?.next_cursor
      ? data.response_metadata.next_cursor
      : undefined;
  return { messages: data.messages ?? [], nextCursor };
}

// Follow cursor pagination to completion (or the page cap). The first call
// carries oldest/ts; subsequent calls carry only the cursor (Slack encodes the
// window in it), so oldest is dropped once paging begins.
async function slackGet(
  method: string,
  baseParams: URLSearchParams,
  token: string
): Promise<SlackApiMessage[]> {
  const all: SlackApiMessage[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < MAX_SLACK_PAGES; page++) {
    const params = new URLSearchParams(baseParams);
    if (cursor) {
      params.set("cursor", cursor);
      params.delete("oldest");
    }
    const { messages, nextCursor } = await slackGetPage(method, params, token);
    all.push(...messages);
    if (!nextCursor) return all;
    cursor = nextCursor;
  }

  console.warn(
    `slack ${method}: stopped at ${MAX_SLACK_PAGES} pages; older messages this window were not fetched`
  );
  return all;
}

// A capturable message is real user text, not a join/edit/delete subtype or a
// bot post. Returns null when it should be skipped.
function toCapturable(
  m: SlackApiMessage,
  threadTs?: string
): SlackMessage | null {
  if (m.subtype || m.bot_id) return null;
  const text = m.text?.trim();
  if (!text) return null;
  return {
    externalId: m.ts,
    text,
    postedAt: new Date(parseFloat(m.ts) * 1000),
    ...(threadTs ? { threadTs } : {}),
  };
}

// Pull the shareable files off a message. A file needs an id and a private URL
// to be downloadable; tombstoned/deleted files (which drop url_private) are
// skipped.
function collectFiles(m: SlackApiMessage, threadTs?: string): SlackFile[] {
  if (!m.files || m.files.length === 0) return [];
  const postedAt = new Date(parseFloat(m.ts) * 1000);
  const out: SlackFile[] = [];
  for (const f of m.files) {
    if (!f.id || !f.url_private) continue;
    out.push({
      externalId: f.id,
      name: f.name ?? f.title ?? f.id,
      mimeType: f.mimetype ?? "",
      urlPrivate: f.url_private,
      size: f.size ?? 0,
      postedAt,
      ...(threadTs ? { threadTs } : {}),
    });
  }
  return out;
}

// Download a shared file's bytes. url_private requires the bot token, so this
// must not be a plain fetch. Callers cap size before invoking.
export async function downloadSlackFile(urlPrivate: string): Promise<Buffer> {
  const token = slackToken();
  const res = await fetch(urlPrivate, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Slack file download failed: HTTP ${res.status}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

// Fetch the replies under one thread parent, excluding the parent itself (it is
// already captured from history). externalId dedup at persist covers the
// inclusive-boundary overlap, so no strict oldest filtering is needed here.
async function fetchThreadReplies(
  channelId: string,
  threadTs: string,
  oldest: string | undefined,
  token: string
): Promise<SlackApiMessage[]> {
  const params = new URLSearchParams({
    channel: channelId,
    ts: threadTs,
    limit: "200",
  });
  if (oldest) params.set("oldest", oldest);
  const replies = await slackGet("conversations.replies", params, token);
  return replies.filter((m) => m.ts !== threadTs);
}

// Poll mode: conversations.history since the stored cursor, plus the replies
// under any thread parent in that window, plus any files shared in those
// messages. Skips subtyped messages (joins, edits, deletes) and bot posts.
export async function fetchSlackMessages(
  channelId: string,
  oldest: string | undefined
): Promise<SlackHistoryResult> {
  const token = slackToken();

  const params = new URLSearchParams({ channel: channelId, limit: "200" });
  if (oldest) params.set("oldest", oldest);
  const raw = await slackGet("conversations.history", params, token);

  let latestTs: string | null = null;
  const messages: SlackMessage[] = [];
  const files: SlackFile[] = [];
  const threadParents: string[] = [];

  for (const m of raw) {
    if (!latestTs || parseFloat(m.ts) > parseFloat(latestTs)) latestTs = m.ts;
    // A thread parent carries a reply_count; collect it so its replies are
    // pulled after the top-level pass.
    if (m.reply_count && m.reply_count > 0) threadParents.push(m.ts);
    const capturable = toCapturable(m);
    if (capturable) messages.push(capturable);
    files.push(...collectFiles(m));
  }

  for (const threadTs of threadParents) {
    const replies = await fetchThreadReplies(channelId, threadTs, oldest, token);
    for (const m of replies) {
      if (!latestTs || parseFloat(m.ts) > parseFloat(latestTs)) latestTs = m.ts;
      const capturable = toCapturable(m, threadTs);
      if (capturable) messages.push(capturable);
      files.push(...collectFiles(m, threadTs));
    }
  }

  // Slack returns newest-first; oldest-first keeps capturedAt ordering sane.
  // Sort the combined history+replies set by ts so interleaved threads stay
  // chronological.
  messages.sort((a, b) => parseFloat(a.externalId) - parseFloat(b.externalId));

  return { messages, files, latestTs };
}
