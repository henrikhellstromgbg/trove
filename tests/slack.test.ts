import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { downloadSlackFile, fetchSlackMessages } from "@/lib/sources/slack";

type FetchResponse = { ok: boolean; messages?: unknown[]; error?: string };

const originalFetch = globalThis.fetch;
const originalToken = process.env.SLACK_BOT_TOKEN;

beforeEach(() => {
  process.env.SLACK_BOT_TOKEN = "xoxb-test";
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalToken === undefined) delete process.env.SLACK_BOT_TOKEN;
  else process.env.SLACK_BOT_TOKEN = originalToken;
});

// Route each Slack API call to a canned response keyed by method, and record the
// URLs requested so we can assert the reply calls happened.
function mockSlack(byMethod: Record<string, FetchResponse>) {
  const calls: string[] = [];
  globalThis.fetch = (async (input: string) => {
    const url = String(input);
    calls.push(url);
    const method = url.includes("conversations.replies")
      ? "conversations.replies"
      : "conversations.history";
    const body = byMethod[method] ?? { ok: true, messages: [] };
    return { json: async () => body } as Response;
  }) as typeof fetch;
  return calls;
}

test("throws a clear error when the bot token is missing", async () => {
  delete process.env.SLACK_BOT_TOKEN;
  await assert.rejects(() => fetchSlackMessages("C1", undefined), /SLACK_BOT_TOKEN/);
});

test("follows cursor pagination across pages and drops oldest after page one", async () => {
  const urls: string[] = [];
  globalThis.fetch = (async (input: string) => {
    const url = String(input);
    urls.push(url);
    const body = url.includes("cursor=PAGE2")
      ? { ok: true, messages: [{ ts: "3.0", text: "third" }] }
      : {
          ok: true,
          messages: [
            { ts: "2.0", text: "second" },
            { ts: "1.0", text: "first" },
          ],
          has_more: true,
          response_metadata: { next_cursor: "PAGE2" },
        };
    return { json: async () => body } as Response;
  }) as typeof fetch;

  const { messages } = await fetchSlackMessages("C1", "0.5");

  assert.deepEqual(
    messages.map((m) => m.text),
    ["first", "second", "third"]
  );
  // Page 1 carries oldest; page 2 carries the cursor and no oldest.
  assert.equal(urls.length, 2);
  assert.ok(urls[0]!.includes("oldest=0.5"));
  assert.ok(urls[1]!.includes("cursor=PAGE2"));
  assert.ok(!urls[1]!.includes("oldest="));
});

test("surfaces a Slack API error instead of returning empty", async () => {
  mockSlack({ "conversations.history": { ok: false, error: "channel_not_found" } });
  await assert.rejects(() => fetchSlackMessages("C1", undefined), /channel_not_found/);
});

test("skips subtyped and bot messages and orders oldest-first", async () => {
  mockSlack({
    "conversations.history": {
      ok: true,
      messages: [
        { ts: "1721552402.000", text: "second" },
        { ts: "1721552401.000", text: "first" },
        { ts: "1721552403.000", text: "joined", subtype: "channel_join" },
        { ts: "1721552404.000", text: "beep", bot_id: "B1" },
        { ts: "1721552405.000", text: "   " },
      ],
    },
  });

  const { messages, latestTs } = await fetchSlackMessages("C1", undefined);
  assert.deepEqual(
    messages.map((m) => m.text),
    ["first", "second"]
  );
  // latestTs tracks the newest ts seen, including skipped ones.
  assert.equal(latestTs, "1721552405.000");
});

test("captures thread replies and tags them with their parent thread", async () => {
  const calls = mockSlack({
    "conversations.history": {
      ok: true,
      messages: [
        { ts: "100.000", text: "parent", thread_ts: "100.000", reply_count: 2 },
        { ts: "090.000", text: "standalone" },
      ],
    },
    "conversations.replies": {
      ok: true,
      messages: [
        { ts: "100.000", text: "parent", thread_ts: "100.000", reply_count: 2 },
        { ts: "101.000", text: "reply one", thread_ts: "100.000" },
        { ts: "102.000", text: "reply two", thread_ts: "100.000", subtype: "thread_broadcast" },
      ],
    },
  });

  const { messages } = await fetchSlackMessages("C1", undefined);

  // The replies call fired for the one thread parent.
  assert.equal(
    calls.filter((u) => u.includes("conversations.replies")).length,
    1
  );
  assert.ok(calls.some((u) => u.includes("ts=100.000")));

  const byText = Object.fromEntries(messages.map((m) => [m.text, m]));
  // Parent (from history) has no threadTs; the real reply is tagged; the
  // subtyped reply and the duplicate parent from the replies call are dropped.
  assert.equal(byText["parent"]?.threadTs, undefined);
  assert.equal(byText["reply one"]?.threadTs, "100.000");
  assert.equal(byText["reply two"], undefined);
  assert.deepEqual(
    messages.map((m) => m.text),
    ["standalone", "parent", "reply one"]
  );
});

test("extracts shared files and skips tombstoned files with no url_private", async () => {
  mockSlack({
    "conversations.history": {
      ok: true,
      messages: [
        {
          ts: "200.000",
          text: "here you go",
          files: [
            {
              id: "F1",
              name: "report.pdf",
              mimetype: "application/pdf",
              url_private: "https://files.slack.com/F1",
              size: 10,
            },
            { id: "F2", name: "deleted.pdf", mimetype: "application/pdf", size: 0 },
          ],
        },
      ],
    },
  });

  const { files } = await fetchSlackMessages("C1", undefined);
  assert.equal(files.length, 1);
  assert.equal(files[0]?.externalId, "F1");
  assert.equal(files[0]?.name, "report.pdf");
  assert.equal(files[0]?.urlPrivate, "https://files.slack.com/F1");
});

test("downloadSlackFile sends the bot token and returns bytes", async () => {
  let authHeader: string | undefined;
  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    authHeader = (init?.headers as Record<string, string>)?.Authorization;
    return {
      ok: true,
      arrayBuffer: async () => new TextEncoder().encode("filebytes").buffer,
    } as Response;
  }) as typeof fetch;

  const buffer = await downloadSlackFile("https://files.slack.com/F1");
  assert.equal(authHeader, "Bearer xoxb-test");
  assert.equal(buffer.toString(), "filebytes");
});

test("downloadSlackFile throws on a non-ok response", async () => {
  globalThis.fetch = (async () => ({ ok: false, status: 403 }) as Response) as typeof fetch;
  await assert.rejects(() => downloadSlackFile("https://files.slack.com/F1"), /HTTP 403/);
});
