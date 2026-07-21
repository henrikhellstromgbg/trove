import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_FOLDER_WATCH_GLOBS,
  buildSourceConfig,
  runtimeForSourceKind,
} from "@/lib/sources/contracts";
import { buildNewsletterMailIngestDraft } from "@/lib/sources/mail";
import {
  advanceFolderWatchCheckpoint,
  readFolderWatchCheckpoint,
  selectFolderWatchFiles,
} from "@/lib/sources/folder-watch";

test("mail_folder config validation trims sender lists and keeps only path metadata", () => {
  const result = buildSourceConfig("mail_folder", {
    mboxPath: "  ~/Library/Mail/Newsletters.mbox  ",
    senderAllow: [" brief@trove.dev ", "", "brief@trove.dev"],
    senderBlock: [" ads@example.com "],
    promoBlocklist: [" View in browser ", "unsubscribe"],
  });

  assert.deepEqual(result, {
    config: {
      mboxPath: "~/Library/Mail/Newsletters.mbox",
      senderAllow: ["brief@trove.dev"],
      senderBlock: ["ads@example.com"],
      promoBlocklist: ["View in browser", "unsubscribe"],
    },
  });
});

test("folder_watch config validation defaults useful globs when omitted", () => {
  const result = buildSourceConfig("folder_watch", {
    folderPath: " /Users/me/Intel Drop ",
  });

  assert.deepEqual(result, {
    config: {
      folderPath: "/Users/me/Intel Drop",
      globs: [...DEFAULT_FOLDER_WATCH_GLOBS],
    },
  });
});

test("local source kinds map to local runtime", () => {
  assert.equal(runtimeForSourceKind("mail_folder"), "local");
  assert.equal(runtimeForSourceKind("folder_watch"), "local");
});

test("newsletter mail draft uses explicit externalId and strips promo boilerplate", () => {
  const draft = buildNewsletterMailIngestDraft(
    {
      messageId: "<message-123@example.com>",
      subject: " Morning brief ",
      from: '"Trove Brief" <brief@trove.dev>',
      receivedAt: "2026-07-21T10:30:00.000Z",
      text: "Lead insight\nView in browser\nUnsubscribe\nSecond insight",
    },
    { promoBlocklist: ["view in browser"] }
  );

  assert.equal(draft.externalId, "message-123@example.com");
  assert.equal(draft.type, "text");
  assert.equal(draft.source, "Morning brief");
  assert.equal(draft.capturedAt, "2026-07-21T10:30:00.000Z");
  assert.match(draft.text, /^Subject: Morning brief\nFrom: Trove Brief <brief@trove\.dev>\n\n/);
  assert.ok(draft.text.includes("Lead insight"));
  assert.ok(draft.text.includes("Second insight"));
  assert.ok(!draft.text.toLowerCase().includes("unsubscribe"));
  assert.ok(!draft.text.toLowerCase().includes("view in browser"));
});

test("folder watch selection filters unchanged files and advances checkpoint after ingest", () => {
  const selected = selectFolderWatchFiles(
    { globs: ["**/*.pdf", "*.txt"] },
    [
      {
        path: "/watch/brief.pdf",
        relativePath: "brief.pdf",
        size: 120,
        modifiedAt: "2026-07-21T09:00:00.000Z",
      },
      {
        path: "/watch/notes.txt",
        relativePath: "notes.txt",
        size: 20,
        modifiedAt: "2026-07-21T09:05:00.000Z",
      },
      {
        path: "/watch/sub/scan.pdf",
        relativePath: "sub/scan.pdf",
        size: 220,
        modifiedAt: "2026-07-21T09:10:00.000Z",
      },
      {
        path: "/watch/ignore.png",
        relativePath: "ignore.png",
        size: 55,
        modifiedAt: "2026-07-21T09:15:00.000Z",
      },
    ],
    {
      version: 1,
      files: {
        "brief.pdf": {
          modifiedAt: "2026-07-21T09:00:00.000Z",
          size: 120,
          externalId: "brief.pdf:120:2026-07-21T09:00:00.000Z",
        },
      },
    }
  );

  assert.deepEqual(
    selected.map((file) => file.relativePath),
    ["notes.txt", "sub/scan.pdf"]
  );
  assert.deepEqual(
    selected.map((file) => file.externalId),
    [
      "notes.txt:20:2026-07-21T09:05:00.000Z",
      "sub/scan.pdf:220:2026-07-21T09:10:00.000Z",
    ]
  );

  const checkpoint = advanceFolderWatchCheckpoint(
    readFolderWatchCheckpoint(null),
    selected
  );

  assert.deepEqual(checkpoint, {
    version: 1,
    files: {
      "notes.txt": {
        modifiedAt: "2026-07-21T09:05:00.000Z",
        size: 20,
        externalId: "notes.txt:20:2026-07-21T09:05:00.000Z",
      },
      "sub/scan.pdf": {
        modifiedAt: "2026-07-21T09:10:00.000Z",
        size: 220,
        externalId: "sub/scan.pdf:220:2026-07-21T09:10:00.000Z",
      },
    },
  });
});
