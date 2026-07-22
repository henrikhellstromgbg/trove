const SLACK_API = "https://slack.com/api";

export type SlackMessage = {
  externalId: string; // message ts, unique within a channel
  text: string;
  postedAt: Date;
  threadTs?: string; // set on replies, so provenance can note the parent thread
};

export type SlackHistoryResult = {
  messages: SlackMessage[];
  latestTs: string | null;
};

type SlackApiMessage = {
  ts: string;
  text?: string;
  subtype?: string;
  bot_id?: string;
  thread_ts?: string;
  reply_count?: number;
};

type SlackApiResponse = {
  ok: boolean;
  error?: string;
  messages?: SlackApiMessage[];
};

function slackToken(): string {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    throw new Error("SLACK_BOT_TOKEN is not configured");
  }
  return token;
}

async function slackGet(
  method: string,
  params: URLSearchParams,
  token: string
): Promise<SlackApiMessage[]> {
  const res = await fetch(`${SLACK_API}/${method}?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await res.json()) as SlackApiResponse;
  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error ?? "unknown"}`);
  }
  return data.messages ?? [];
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
// under any thread parent in that window. Skips subtyped messages (joins,
// edits, deletes) and bot posts for this cut. Shared files are not yet
// captured, see docs/architecture-v2.md.
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
  const threadParents: string[] = [];

  for (const m of raw) {
    if (!latestTs || parseFloat(m.ts) > parseFloat(latestTs)) latestTs = m.ts;
    // A thread parent carries a reply_count; collect it so its replies are
    // pulled after the top-level pass.
    if (m.reply_count && m.reply_count > 0) threadParents.push(m.ts);
    const capturable = toCapturable(m);
    if (capturable) messages.push(capturable);
  }

  for (const threadTs of threadParents) {
    const replies = await fetchThreadReplies(channelId, threadTs, oldest, token);
    for (const m of replies) {
      if (!latestTs || parseFloat(m.ts) > parseFloat(latestTs)) latestTs = m.ts;
      const capturable = toCapturable(m, threadTs);
      if (capturable) messages.push(capturable);
    }
  }

  // Slack returns newest-first; oldest-first keeps capturedAt ordering sane.
  // Sort the combined history+replies set by ts so interleaved threads stay
  // chronological.
  messages.sort((a, b) => parseFloat(a.externalId) - parseFloat(b.externalId));

  return { messages, latestTs };
}
