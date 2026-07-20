const SLACK_API = "https://slack.com/api";

export type SlackMessage = {
  externalId: string; // message ts, unique within a channel
  text: string;
  postedAt: Date;
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
};

type SlackApiResponse = {
  ok: boolean;
  error?: string;
  messages?: SlackApiMessage[];
};

// Poll mode: conversations.history since the stored cursor. Skips subtyped
// messages (joins, edits, deletes) and bot posts for this first cut — thread
// replies and shared files are not yet captured, see docs/architecture-v2.md.
export async function fetchSlackMessages(
  channelId: string,
  oldest: string | undefined
): Promise<SlackHistoryResult> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    throw new Error("SLACK_BOT_TOKEN is not configured");
  }

  const params = new URLSearchParams({ channel: channelId, limit: "200" });
  if (oldest) params.set("oldest", oldest);

  const res = await fetch(`${SLACK_API}/conversations.history?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await res.json()) as SlackApiResponse;
  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error ?? "unknown"}`);
  }

  const raw = data.messages ?? [];
  let latestTs: string | null = null;
  const messages: SlackMessage[] = [];

  for (const m of raw) {
    if (!latestTs || parseFloat(m.ts) > parseFloat(latestTs)) latestTs = m.ts;
    if (m.subtype || m.bot_id) continue;
    const text = m.text?.trim();
    if (!text) continue;

    messages.push({
      externalId: m.ts,
      text,
      postedAt: new Date(parseFloat(m.ts) * 1000),
    });
  }

  // Slack returns newest-first; oldest-first keeps capturedAt ordering sane.
  messages.reverse();

  return { messages, latestTs };
}
