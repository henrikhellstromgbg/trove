# Trove architecture v2

Status: proposal, 2026-07-20. Supersedes the single-bucket model in the root CLAUDE.md. Nothing here is built yet. This doc is the plan we build against.

## Why this rewrite

v0.1 is one shared bucket. Every item, chunk, topic and pipeline hangs off a Clerk `user_id` and nothing else. That was right for a personal notes app. It is wrong for where Trove is going.

Three things changed the requirements:

1. **Multiple projects.** Tactical Athlete intel, sportscience, nutrition, and separate freelance client corpora. These must not bleed into each other. A freelance client's material has to sit behind a hard wall.
2. **Real ingestion, not just manual capture.** The Intel folder on the desktop already does the thing Trove wants to be: it scans Apple Mail newsletters, mines 13 YouTube channels nightly, and watches a folder for dropped PDFs, all into one searchable `kb.json`. Trove should absorb that pattern and generalise it.
3. **Product path plus dogfood.** Trove stays the engine we test on ourselves first. The architecture has to be honest about what runs in the cloud and what runs on the Mac, so the same design serves both a hosted product and a local power user.

Decisions taken for this version:

- Projects are **hard containers**, not soft tag groupings.
- Local sources reuse the **existing Python** as a local daemon that posts into Trove, before anything moves into the Tauri app.
- Source families to build: **mail, YouTube, folder watch plus drop, then Slack and web scrapers.**
- The left sidebar replaces the top nav. Structure now, visual design later.

## The one constraint that shapes everything

Trove runs on Vercel. Inngest runs in the cloud. That environment can reach anything on the internet and nothing on your Mac.

- Cloud **can** do: web scraping, RSS, YouTube transcripts, Slack API, URL capture, all extraction, embedding, enrichment, clustering, chat, pipelines, email.
- Cloud **cannot** do: read `~/Library/Mail/.../Newsletters.mbox`, watch a local folder, see a file dropped on a desktop icon.

The Intel pipeline works only because it runs locally under launchd, reading local paths. So Trove needs two ingestion surfaces that meet at a single seam:

```
   INTERNET SOURCES                         LOCAL SOURCES
   (run in the cloud)                       (run on your Mac)

   web scrape, RSS                          Apple Mail mbox
   YouTube transcripts                      watched folder
   Slack API                                drag and drop desktop
        │                                        │
        │  emit item/captured                    │  POST with ingest token
        ▼                                        ▼
   ┌──────────────────────────────────────────────────────┐
   │            capture ingest API  (the seam)             │
   │  POST /api/ingest   { projectId, sourceId, payload }  │
   └──────────────────────────────────────────────────────┘
        │
        ▼
   item (pending) → extract → chunk → embed → enrich → ready
        │
        ▼
   retrieval · wiki · pipelines · chat, all scoped to a project
```

Everything upstream speaks one API. A browser drop, a Tauri watcher, the Python daemon, a Slack webhook, a scraper worker: all of them create a `pending` item and let the same downstream pipeline take over. This seam is the most important thing in the rewrite. Build it first and build it well.

## Core model change: projects as hard containers

Today's `space` table is a soft grouping. Its own UI copy says "items can live in many spaces at once." We repurpose it into a hard container and rename the concept to **project**.

A `project` owns everything: sources, items, chunks, conversations, messages, pipelines, topics. Every row that today carries only `user_id` gains a `project_id`. Every query scopes by `(user_id, project_id)`. No cross-project reads, the same rule the root CLAUDE.md already states for `user_id`, now one level finer.

Soft tag grouping does not disappear, it moves down a level. Within a project you can still tag and filter. If we want collections later, they are a within-project feature, never a wall between clients.

### Schema deltas

New table:

```
project
  id           uuid pk
  user_id      text            Clerk user id, owner
  name         text            "tactical athlete intel", "client: acme"
  slug         text            url safe, unique per user
  kind         text            "personal" | "client"
  color        text            optional accent
  archived     boolean         default false
  created_at   timestamptz
```

Add `project_id uuid not null references project(id)` to: `item`, `chunk`, `conversation`, `pipeline`, `topic`. Add a `(user_id, project_id)` index to each. `message` inherits scope through its conversation, no direct column needed.

Retire `space`. Its data (a handful of tag groupings) migrates into projects or is dropped. Low cost, the table is barely used.

### Migration path

1. Create `project`. Seed one project per user called "inbox" (or migrate each existing `space` to a project).
2. Backfill `project_id` on all existing rows to that default project.
3. Make `project_id` not null once backfilled.
4. Drop `space` and its API routes and the spaces rail.

Drizzle migration plus a one-off backfill script under `scripts/`. Run against Neon with `db:migrate`.

## Sources: ingestion as a first-class object

Right now ingestion is implicit: something calls `/api/capture`, an item appears. To support recurring, configured inputs we make the input itself a row.

```
source
  id            uuid pk
  user_id       text
  project_id    uuid references project(id)
  kind          text     drop | mail_folder | folder_watch |
                         youtube_channel | rss | web_scrape | slack_channel
  name          text     human label
  config        jsonb    kind specific, see below
  runtime       text     "cloud" | "local"    where sync executes
  enabled       boolean
  cron          text     null for event or manual sources
  cursor        jsonb    checkpoint, mirrors Intel's checkpoint.json
  last_sync_at  timestamptz
  last_status   text     ok | error | running
  last_error    text
  created_at    timestamptz
```

`config` by kind:

| kind             | runtime | config keys |
|------------------|---------|-------------|
| `drop`           | either  | none, items pushed ad hoc |
| `mail_folder`    | local   | `mboxPath`, `senderAllow[]`, `senderBlock[]`, `promoBlocklist[]` |
| `folder_watch`   | local   | `folderPath`, `globs[]` |
| `youtube_channel`| cloud   | `channelId`, `sinceDays` |
| `rss`            | cloud   | `feedUrl` |
| `web_scrape`     | cloud   | `url`, `selector`, `followLinks` |
| `slack_channel`  | cloud   | `teamId`, `channelId`, `mode` (events | poll) |

`item` gains `source_id uuid references source(id)` (nullable, since some items are hand captured with no source), plus a stable `external_id text` per source for dedup (mbox message id, YouTube video id, blob hash for files). Unique index on `(source_id, external_id)` kills duplicates cheaply, which is exactly what Intel does today with its dedup against `kb.json` and `raw/`.

### How each kind runs

- **Cloud sources** (`youtube_channel`, `rss`, `web_scrape`, `slack_channel`) are polled by an Inngest cron function `sync-due-sources`, same shape as today's `run-due-pipelines`. It loads enabled cloud sources whose `next_run` is due, calls a per-kind fetcher, and for each new external item emits `item/captured` with `projectId` and `sourceId`.
- **Local sources** (`mail_folder`, `folder_watch`, plus local `drop`) are driven by the local daemon on the Mac. The daemon reads the source config from Trove (or from a local mirror), reads the local files, and POSTs new items to the ingest API. The cloud never tries to touch local paths.

Slack `events` mode is the exception to polling: a Slack app posts to a webhook route which creates items directly. `poll` mode uses `conversations.history` on the cron, simpler to stand up first.

## The capture ingest API: the seam

One endpoint, two auth modes.

`POST /api/ingest`

- **Browser mode:** Clerk session, as `/api/capture` works today. Used by the drag and drop UI.
- **Agent mode:** a per-user **ingest token** in an `Authorization: Bearer` header. Used by the Python daemon, the Tauri app, and any server to server caller. Tokens live in a new `ingest_token` table (`user_id`, `token_hash`, `project_id` optional default, `created_at`, `revoked_at`). Never Clerk for non-browser callers, they cannot do a browser login.

Payload accepts either a file (multipart, as now) or structured text:

```
{
  projectId:  uuid,        required
  sourceId:   uuid | null, which source produced this
  externalId: string,      for dedup
  type:       "text" | "url" | "pdf" | "image" | "docx" | "xlsx" | "textfile"
  source:     string,      original filename or url or subject line
  text:       string,      for already-extracted content (mail body, transcript)
  file:       binary,      for files, goes to blob
  capturedAt: iso8601      optional, defaults now
}
```

The endpoint dedups on `(sourceId, externalId)`, writes the `item` as `pending`, uploads any file to blob, and emits `item/captured`. That is the entire seam. Everything else is downstream and unchanged in shape.

**Security note, blocking.** `/api/capture` today uploads with `access: "public"` (`app/api/capture/route.ts:144`). Anyone with the blob URL reads the file. Fine for your own notes, unacceptable once client freelance material enters. v2 uploads private and serves through signed URLs. This must land before any external project data touches Trove. It is called out again in the security section.

## Item lifecycle, unchanged in spirit

The current `ingestItem` Inngest function already does the right thing: mark processing, extract by type, chunk, embed with Gemini, enrich with Haiku, mark ready. v2 keeps it and adds:

- carry `project_id` and `source_id` onto chunks and topics
- respect `text` payloads that arrive already extracted (mail bodies, transcripts) and skip the extract step
- dedup guard at the top, since the same item id is now reachable from retries and re-syncs

Extractors already cover pdf, image, docx, xlsx, textfile, url. The Intel Python has battle-tested logic for mail body cleaning and transcript normalisation. We port the cleaning rules, not the runtime.

## Local daemon: reuse the Python

The daemon is the fastest path to dogfooding and it reuses code that already works. It is a thin adaptation of the Intel scripts, not a rewrite.

What it is: a small Python process on the Mac, scheduled by launchd (the Intel YouTube miner already runs this way), that reads local sources and posts to `/api/ingest` with an ingest token.

Mapping from what exists today:

| Intel script                    | becomes source kind | change needed |
|---------------------------------|---------------------|---------------|
| `ingest_newsletters.py`         | `mail_folder`       | instead of writing `.txt` to `raw/`, POST body + subject as a `text` item |
| `youtube_transcript_miner.py`   | `youtube_channel`   | can stay local at first, later move to a cloud fetcher; POST transcript as `text` |
| `watch_kb.py`                   | `folder_watch`      | on new file, POST the file to `/api/ingest` |
| `sort_kb.py`, `process_kb.py`   | retired             | sorting, tagging, enrichment now happen in Trove's cloud pipeline |

Config lives in Trove (`source.config`) and the daemon reads it once per run, or we start even simpler with a local config file and graduate to server-driven config. Checkpoints move from `checkpoint.json` into `source.cursor`, so re-runs are idempotent across machines.

Net effect: the Intel pipeline stops being a separate island writing `kb.json` and becomes three Trove sources feeding one project. The desktop `intel/` folder can keep running until the daemon reaches parity, then retire.

## Mail architecture, two stages

- **Stage 1, local mbox, now.** Reuse `ingest_newsletters.py`. It already scans a curated `Newsletters.mbox`, applies a promo blocklist, decodes headers, dedups. Point it at `/api/ingest` instead of `raw/`. Ships this week, zero new external services.
- **Stage 2, cloud IMAP or Gmail, later.** For the product, and for pulling a client's shared mailbox, connect server-side over IMAP or the Gmail API and read a labelled folder. Works when the Mac is off. More setup (OAuth, token storage), so it waits until the local path proves the value.

Both write the same `text` items through the same seam. Sender filters and dedup rules are shared config on the `mail_folder` and future `imap` source kinds.

## Slack and scrapers

- **Slack.** A Slack app with `channels:history`, `groups:history`, `files:read`. Two modes: `poll` (cron calls `conversations.history` since cursor, simplest) and `events` (Events API webhook posts to `/api/slack/events`, lower latency). Each message or thread or shared file becomes an item. Start with `poll` on one channel, prove it, then add events. This is a clean cloud source, no local dependency.
- **RSS and web scrapers.** `rss` reads a feed and captures new entries as `url` items. `web_scrape` fetches a page, optionally follows links, and captures cleaned text. Both are cloud cron sources. The existing `extractFromUrl` already handles the fetch and clean, so `rss` is nearly free.

## Pipelines v2: synthesis, not ingestion

Sharpen the mental model. **Sources pull content in. Pipelines push results out.** They are different objects and should read as different objects in the UI.

The current pipeline engine stays: filter items, run one Haiku prompt, shape the output, optionally email, on a cron. Changes:

1. **Scope to a project.** A pipeline runs over one project's items, never across the wall.
2. **Optional retrieval.** Today pipelines see only title, summary and tags (`lib/pipelines/run.ts`). For real "ask the corpus" quality, a pipeline can opt into vector retrieval over `chunk`, so it reasons over full text, not just summaries. Add a `retrieval` flag and a query to the spec.
3. **Richer triggers, later.** Cron now. Add "on new item matching filter" as an event trigger once sources are in, so a pipeline can react to arrivals, not just wake on a clock.
4. **Answers model.** Keep Haiku for cheap digest and list shapes. Use a stronger model (Sonnet class) for the chat answer path and for retrieval-heavy pipelines. Reconcile model ids while here, see the config cleanup below.

The weekly digest becomes just one seeded pipeline per project, which is already how `weeklyDigest` half-works today.

## Inngest topology after v2

| function            | trigger              | change |
|---------------------|----------------------|--------|
| `ingest-item`       | event `item/captured`| carry project and source, honour pre-extracted text, dedup guard |
| `sync-due-sources`  | cron `*/10 * * * *`  | new. Polls due cloud sources, emits `item/captured` |
| `cluster-topics`    | cron `0 4 * * *`     | cluster per project, not per user |
| `run-due-pipelines` | cron `*/10 * * * *`  | scope by project, optional retrieval |
| `weekly-digest`     | cron `0 9 * * 0`     | fold into a per-project seeded pipeline |

Slack `events` mode adds a plain route (`/api/slack/events`), outside Inngest, that creates items directly.

## Config and model cleanup, while we are in here

- **Embeddings.** Reality is Gemini `gemini-embedding-001` at 768 dims (`lib/ai/embed.ts`), and the schema is `vector(768)`. The root CLAUDE.md still says "OpenAI text-embedding-3-small, 1536 dims." That line is wrong. Fix CLAUDE.md to match the code.
- **Answer and enrich models.** Functions use `claude-haiku-4-5`. CLAUDE.md says "Sonnet 4.6 for answers." Pick current ids (Sonnet class for answers, Haiku 4.5 for extract and enrich) and make CLAUDE.md and code agree.
- **Uncommitted work.** `app/api/ask/route.ts`, `app/ask-overlay.tsx`, `lib/ai/embed.ts` are modified and uncommitted. Commit or discard before starting v2 so we branch from a known state.

## Left sidebar shell, structure only

The top nav (`app/shell.tsx`, `MODULES` array) becomes a left sidebar. Visual design comes later, so build the structure and routing now and leave styling as a plain skeleton.

```
┌───────────────┬────────────────────────────────┐
│  Trove        │                                │
│               │                                │
│  [ project ▾] │        main view               │
│               │                                │
│  capture      │                                │
│  library      │                                │
│  wiki         │                                │
│  sources      │   ← new, manage connectors     │
│  pipelines    │                                │
│  ask          │                                │
│               │                                │
│  ─────────    │                                │
│  [ user ]     │                                │
└───────────────┴────────────────────────────────┘
```

- **Project switcher** at the top of the sidebar sets the active project. Active project id lives in the route (`/p/[projectSlug]/...`) so it is shareable and server-renderable, and in a small client context for the switcher. Prefer the route as source of truth, a lesson already learned about Next.js router cache freezing `useState`.
- **New "sources" section** is where you add and monitor connectors: last sync, item counts, errors. This is the surface the old Intel folder never had.
- Everything else (capture, library, wiki, pipelines, ask) is the existing modules, re-homed and project-scoped.

## Build order

Phased so each phase is shippable and dogfoodable on its own.

- **Phase 0, hygiene.** Commit or discard the three modified files. Fix the CLAUDE.md embedding and model lines. Flip blob uploads to private. Small, unblocks everything.
- **Phase 1, projects.** `project` table, backfill, `project_id` everywhere, scope all queries, retire `space`. Route becomes `/p/[slug]/...`. Sidebar skeleton with the project switcher.
- **Phase 2, the seam plus daemon.** `/api/ingest` with ingest tokens, `source` and `ingest_token` tables, the Python daemon posting `folder_watch` and `drop`. First real end to end: drop a PDF locally, it lands in a project.
- **Phase 3, mail.** Point `ingest_newsletters.py` at the seam as a `mail_folder` source. Now newsletters flow in without `kb.json`.
- **Phase 4, cloud sources.** `sync-due-sources`, then `youtube_channel` and `rss`. Retire the standalone Intel YouTube miner once at parity.
- **Phase 5, pipelines v2.** Project scope, optional retrieval, seed the per-project weekly digest.
- **Phase 6, Slack plus scrapers.** `slack_channel` poll then events, `web_scrape`. Then the sidebar visual pass once you send the design.

## Open questions, deferred

- **Item in two projects.** Hard walls say no. If a shared reference (one PDF, two clients) becomes a real need, add an explicit "copy to project" action rather than softening the wall.
- **Ingest token scope.** One token per user, or one per source or machine. Start with one per user, tighten if the daemon fleet grows.
- **Where source config lives.** Server-driven from day one, or local config file first. Simpler to start local and graduate.
- **YouTube runtime.** Keep local (reuse the miner) or move to a cloud fetcher. Local first, cloud when the daemon is a liability.
- **Tauri timing.** The daemon buys time. Fold local sources into the signed menu bar app when the product story needs one binary, not before.
