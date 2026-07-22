# Trove architecture v2

Status: living architecture, updated 2026-07-21. This document describes both the current implementation and the agreed target. Each section states what exists and what remains.

## Why this rewrite

The original v0.1 was one shared bucket. Trove now has projects in code, but the project boundary, migration history and import paths are not fully consistent yet.

Three things changed the requirements:

1. **Multiple projects.** Tactical Athlete intel, sportscience, nutrition, and separate freelance client corpora. These must not bleed into each other. A freelance client's material has to sit behind a hard wall.
2. **Real ingestion, not just manual capture.** The Intel folder on the desktop already does the thing Trove wants to be: it scans Apple Mail newsletters, mines 13 YouTube channels nightly, and watches a folder for dropped PDFs, all into one searchable `kb.json`. Trove should absorb that pattern and generalise it.
3. **Product path plus dogfood.** Trove stays the engine we test on ourselves first. The architecture has to be honest about what runs in the cloud and what runs on the Mac, so the same design serves both a hosted product and a local power user.

Decisions taken for this version:

- Projects are **hard containers**, not soft tag groupings.
- **Project** is the canonical product and data boundary. The longer-term product plan's `Case` maps to a Trove project for now; there is no separate workspace/case hierarchy in v2.
- **Sources import material. Pipelines read imported material and create recurring results.** A source rule is not a pipeline.
- The existing Tauri app is the preferred local runtime. Intel's Python scripts are reference implementations and may be used temporarily while equivalent local source support is completed.
- Stabilise the existing RSS, web and Slack sources. Build mail and watched folders next. Generic YouTube transcription comes later; Tactical Athlete's podcast mining remains outside Trove Core.
- The left sidebar and project-scoped routes exist and remain the navigation model.

### Current implementation status

| Area | Status | Notes |
|------|--------|-------|
| Projects and sidebar | Exists | Core content APIs validate an owned project explicitly. Project sharing is not built. |
| Capture, Library and Ask | Exists | Browser capture uses `/api/ingest`. Ask is project-scoped and now persists conversations, messages and citations. |
| Sources | Partial | RSS, web scrape and Slack poll exist. The Tauri app runs `mail_folder` (local mbox) and `folder_watch` locally: it reads only registry-approved paths, posts through `/api/ingest` with the ingest token and an explicit per-source projectId, and stays idempotent via local checkpoints + externalId. The daemon now fetches its approved registry from `GET /api/sources/local` (token-auth), falling back to the local file offline; ingest tokens are issued/revoked through `/api/ingest-tokens`. A background timer syncs the local sources on an interval (`TROVE_LOCAL_SYNC_INTERVAL_SECS`, default 300s), so runs no longer need a tray click. Product UI and cloud/Gmail fetchers remain. |
| Pipelines | Exists | List, plain-language creation, detail, pause, run-now, history, starter template API for Morning brief and Friday weekly summary, and seeded Friday weekly digest exist. |
| One ingest API | Exists | Browser capture and Tauri use `/api/ingest`; `/api/capture` remains temporarily as a compatibility route for older clients. |
| Private blobs | Exists | New uploads are private and served through an authenticated route. |
| Source runs and immutable originals | Exists | Source sync records runs and immutable original versions; local and Gmail runtimes remain. |
| Review, trash and deletion markers | Partial | Project-scoped routes support decisions, trash, restore and retryable permanent deletion. Deletion markers prevent same-source re-import. An active, version-bound, project-scoped review rule now routes matching items to `review` at import (both source sync and `/api/ingest`); held items are never emitted, so they gain no chunks and stay out of Ask until approval sends them back to `pending`. Product UI remains. |
| Account connections and settings | Partial | Account metadata and ownership exist. OAuth, credential storage and settings UI are not built. |

## The one constraint that shapes everything

Trove runs on Vercel. Inngest runs in the cloud. That environment can reach anything on the internet and nothing on your Mac.

- Cloud **can** do: web scraping, RSS, YouTube transcripts, Slack API, URL capture, all extraction, embedding, enrichment, clustering, chat, pipelines, email.
- Cloud **cannot** do: read `~/Library/Mail/.../Newsletters.mbox`, watch a local folder, see a file dropped on a desktop icon.

The Intel ingestion project works only because it runs locally under launchd and reads local paths. Trove therefore needs two ingestion surfaces that meet at one API:

```
   INTERNET SOURCES                         LOCAL SOURCES
   (run in the cloud)                       (run on your Mac)

   web scrape, RSS                          Apple Mail or local mailbox
   Slack API                                watched folder
                                            drag and drop desktop
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
   retrieval · topics · pipelines · chat, all scoped to a project
```

Target state: everything upstream speaks one API. A browser drop, a Tauri watcher, a temporary Python process, a Slack webhook or a scraper worker creates a `pending` item and lets the same downstream ingestion worker take over. The word pipeline is reserved for recurring output jobs.

## Core model change: projects as hard containers

Today's `space` table is a soft grouping. Its own UI copy says "items can live in many spaces at once." We repurpose it into a hard container and rename the concept to **project**.

A `project` owns everything: sources, source rules, source runs, originals, items, chunks, conversations, messages, pipelines, pipeline runs, topics, review decisions and deletion markers. Every query scopes by `(user_id, project_id)` directly or through a verified owning relation. No API may silently fall back to a different project when an explicit project id is invalid.

Compatibility rule for current create routes: an omitted `projectId` uses the user's inbox project, while an explicitly supplied id must be a valid project owned by that user. Project-aware UI and new integrations always send the active project id; the omission fallback exists for older callers only and never overrides an explicit value.

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
  project_id    uuid not null references project(id)
  kind          text     mail_folder | folder_watch | rss |
                         web_scrape | slack_channel | youtube_channel
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
| `mail_folder`    | local   | `mboxPath`, `senderAllow[]`, `senderBlock[]`, `promoBlocklist[]` |
| `folder_watch`   | local   | `folderPath`, `globs[]` |
| `youtube_channel`| cloud   | `channelId`, `sinceDays` |
| `rss`            | cloud   | `feedUrl` |
| `web_scrape`     | cloud   | `url`, `selector`, `followLinks` |
| `slack_channel`  | cloud   | `teamId`, `channelId`, `mode` (events | poll) |

`item` has `source_id uuid references source(id)` (nullable for manual capture) plus a stable `external_id text` per source for dedup. Manual capture uses `source_id = null`; it is not a source kind. The API must verify that `source_id` belongs to the same user and project before accepting it. The unique index on `(source_id, external_id)` prevents duplicate source items.

The next source foundation adds three separate objects:

- `connected_account`: global OAuth or local connection owned by the account.
- `source_rule`: versioned project-owned selection and review rules.
- `source_run`: one sync attempt with counts, timestamps, cursor, status and error.

An immutable `original_record` stores the exact fetched payload and source metadata. The current `item` remains the processed knowledge record shown in Library.

### How each kind runs

- **Cloud sources** (`rss`, `web_scrape`, `slack_channel`, and later `youtube_channel`) are polled by the existing Inngest `sync-due-sources` function. It loads enabled cloud sources whose `next_run` is due, calls a per-kind fetcher, and emits `item/captured` for new external items.
- **Local sources** (`mail_folder` and `folder_watch`) are driven by the local daemon on the Mac. The daemon reads the source config from Trove (or from a local mirror), reads the local files, and POSTs new items to the ingest API. The cloud never tries to touch local paths.
- **Current local-runtime status:** the Tauri app implements the `mail_folder` (local mbox) and `folder_watch` runtimes. It fetches its approved registry from `GET /api/sources/local` using the ingest token, and falls back to a local file (`TROVE_LOCAL_SOURCES`, default `~/.config/trove/local-sources.json`) when the server is unreachable; either way it reads only the listed paths. It mirrors the TS folder-selection and newsletter-cleaning contracts in Rust, keeps per-source local checkpoints (`~/.config/trove/checkpoints/`) for idempotence, and POSTs new items through `/api/ingest` with the ingest token in the `Authorization` header and an explicit per-source projectId. Local filesystem paths and the token never appear in the request body. A background timer runs the sync on an interval (`TROVE_LOCAL_SYNC_INTERVAL_SECS`, default 300s, floored at 30s) with a shared in-flight guard so a slow run never overlaps the next tick or a manual tray click. After a source imports new items the daemon POSTs its advanced checkpoint to `POST /api/sources/local/cursor` (token-auth, project-scoped) as a best-effort write-back, so `source.cursor` persists server-side; a failed push only loses cross-machine resume, never local idempotence. On a machine with no local checkpoint for a source, the daemon seeds it from the server cursor returned in the registry (a local checkpoint file always wins), so a second machine resumes instead of re-importing. Cross-machine resume is closed; Gmail OAuth remains.

Slack `events` mode is the exception to polling: a Slack app posts to a webhook route which creates items directly. `poll` mode uses `conversations.history` on the cron, simpler to stand up first.

## The capture ingest API: the seam

One endpoint, two auth modes.

`POST /api/ingest`

- **Browser mode:** Clerk session, as `/api/capture` works today. Used by the drag and drop UI.
- **Agent mode:** a per-user **ingest token** in an `Authorization: Bearer` header. Used by the Python daemon, the Tauri app, and any server to server caller. Tokens live in `ingest_token` (`user_id`, `token_hash`, optional `project_id` lock, `created_at`, `revoked_at`). A token with `project_id` is locked to that project: an omitted request `projectId` uses the lock and another project is rejected with 403. A token with `project_id = null` may select any valid project owned by the user. Deleting a locked project cascades to its tokens, so a locked token can never silently become unlocked. Never use Clerk for non-browser callers; they cannot complete a browser login.

Payload accepts either a file (multipart, as now) or structured text:

```
{
  projectId:  uuid,        required for new callers; legacy omission uses inbox or token lock
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

**Security status.** New uploads are private and files are served through an authenticated item route. Legacy public blob URLs may still exist and should be migrated or retired separately.

## Item lifecycle, unchanged in spirit

The current `ingestItem` Inngest function already does the right thing: mark processing, extract by type, chunk, embed with Gemini, enrich with Haiku, mark ready. v2 keeps it and adds:

- carry `project_id` and `source_id` onto chunks and topics
- respect `text` payloads that arrive already extracted (mail bodies, transcripts) and skip the extract step
- dedup guard at the top, since the same item id is now reachable from retries and re-syncs

Extractors already cover pdf, image, docx, xlsx, textfile, url. The Intel Python has battle-tested logic for mail body cleaning and transcript normalisation. We port the cleaning rules, not the runtime.

## Local runtime: Tauri app with temporary Python compatibility

The signed Tauri menu bar app is the intended local runtime. Intel's Python scripts remain useful reference implementations and can post through the same ingest contract during migration.

The local runtime reads configured local sources and posts files or extracted mail through `/api/ingest` with an ingest token and an explicit project id. It never posts a local path as if it were file content.

Mapping from what exists today:

| Intel script                    | becomes source kind | change needed |
|---------------------------------|---------------------|---------------|
| `ingest_newsletters.py`         | `mail_folder`       | instead of writing `.txt` to `raw/`, POST body + subject as a `text` item |
| `youtube_transcript_miner.py`   | project-specific tool | stays outside Trove Core; generic transcription can be added later |
| `watch_kb.py`                   | `folder_watch`      | on new file, POST the file to `/api/ingest` |
| `sort_kb.py`, `process_kb.py`   | retired             | sorting, tagging and enrichment move to Trove's ingestion worker |

Config lives in Trove (`source.config`) and the daemon reads it once per run, or we start even simpler with a local config file and graduate to server-driven config. Checkpoints move from `checkpoint.json` into `source.cursor`, so re-runs are idempotent across machines.

Net effect: Intel stops being a separate island writing `kb.json`. Its general mail and watched-folder patterns become Trove sources, while its specialized podcast mining can continue as a project-specific tool that posts selected results to Trove.

## Mail architecture

- **Gmail connection.** Connect once at account level, then let each project select its own label or folder, source rule and schedule.
- **Apple Mail or local mailbox.** The Tauri app reads locally permitted mail and posts selected messages through `/api/ingest`. The local mailbox path stays on the Mac.
- **Intel compatibility.** `ingest_newsletters.py` can temporarily prove the flow, but it is not the long-term product UI or runtime.

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

The weekly digest is already implemented as one seeded pipeline per project. It remains a normal pipeline rather than a separate subsystem. The seed now runs Friday at 15:00 to match the starter template, while the Digest page still depends on the seeded name `weekly-digest`. Remove the magic-name dependency when the template picker is built.

The first product templates are **Morning brief** at 08:00 UTC on weekdays and **Weekly summary** at 15:00 UTC on Friday. A project may install both. Each template creates an ordinary, independently editable pipeline with its own schedule, source scope, delivery and run history. The report is always stored in Trove. When email is selected the runner records the delivery outcome on the run output (recipient, `sent`/`failed`/`skipped`, error); a failed send never throws, so the report is preserved and the run is downgraded to `completed_with_delivery_error` instead of being silently counted as delivered. Email failure does not re-run generation, so retries never duplicate the report or the email. Plain-language custom creation remains available after the template picker. User-local scheduling requires a later timezone model.

## Inngest topology after v2

| function            | trigger              | change |
|---------------------|----------------------|--------|
| `ingest-item`       | event `item/captured`| carry project and source, honour pre-extracted text, dedup guard |
| `sync-due-sources`  | cron `*/10 * * * *`  | new. Polls due cloud sources, emits `item/captured` |
| `cluster-topics`    | cron `0 4 * * *`     | cluster per project, not per user |
| `run-due-pipelines` | cron `*/10 * * * *`  | scope by project, optional retrieval |

Slack `events` mode adds a plain route (`/api/slack/events`), outside Inngest, that creates items directly.

## Model configuration

- **Embeddings:** Gemini `gemini-embedding-001`, 768 dimensions.
- **Answers and pipeline compilation:** Claude Sonnet 4.6.
- **Extraction, enrichment and ordinary pipeline runs:** Claude Haiku 4.5.

The code, root `CLAUDE.md` and generated migrations `0000` through `0006` agree on these choices. The full fresh-database migration path has been executed and verified against a disposable empty database via `pnpm db:verify-fresh` (see `docs/review-fix-plan-2026-07-21.md`).

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
- Capture, Library, Sources, Pipelines, Digest and Ask are existing project surfaces. Topic clustering exists in the backend but has no current browsing route.

## Build order

Phased by dependency rather than by source type:

1. **Migration and isolation.** Generate real migrations for the current schema and 768-dimensional vectors. Backfill projects, make required project relations non-null, reject invalid project ids, validate source ownership and add isolation tests.
2. **One ingest path.** Move browser capture and Tauri from `/api/capture` to `/api/ingest`. Tauri sends real files with ingest token and explicit project. Remove `/api/capture` after clients have moved.
3. **Stabilise existing product.** Verify Capture, Library, Ask, RSS, web, Slack, Pipelines and Digest end to end. Add Morning brief and Friday weekly summary as starter templates on the existing pipeline engine. Keep private blob access and add focused ingestion and pipeline tests.
4. **Source foundation.** Backend complete: connected accounts, versioned source rules, source runs and immutable originals. Setup preview, health and retry UI remain.
5. **Review and deletion.** Backend complete: review decisions, project trash, restore, retryable permanent blob/artifact deletion, deletion markers, and review rules applied during import (source sync and `/api/ingest`) that hold matching items for approval. Product UI remains.
6. **Mail and watched folders.** Local mailbox (mbox) and watched-folder runtimes now run in the Tauri app on a background timer and post through `/api/ingest`, so review rules apply on arrival. Gmail OAuth and the setup/health UI remain.
7. **Persist Ask conversations.** Complete: Ask writes project-scoped threads and messages, including citations and follow-up intent.
8. **Later expansion.** Generic YouTube transcription, source templates, shared projects and vertical packs.

## Open questions, deferred

- **Move or copy across projects.** Manual material (`source_id = null`) can move by reassigning the item and chunks, then re-clustering topics. Material from an automatic source is copied instead, because a source belongs to exactly one project and moving the same item would create a cross-project `source_id`. The copied item belongs to the destination and is processed there; the original remains in its source project.
- **Ingest token granularity.** Project locking is defined. Whether users should issue one token per user, source or machine remains a product and operations choice.
- **Local source configuration cache.** The server owns the source configuration. Decide how much the Tauri app caches for offline resilience.
- **Generic YouTube runtime.** Decide cloud or local only when generic transcription becomes a core source. Tactical Athlete's specialized miner remains separate.
- **Tauri distribution.** Signing, notarization and update delivery remain product-release work after project-scoped ingest is correct.

## Avgränsat till senare

- Ingest-token skapas och återkallas via `/api/ingest-tokens`; en UI-yta för detta är inte byggd.
- Slack-konfigurationen lagrar `channelId`, `teamId` och `mode`; poll-synken bär nu alla tre vidare som proveniens i varje `original_record`. Events-läget levereras dock fortfarande via poll eftersom Events-webhooken inte är byggd.
- Slack-pollen fångar nu även trådsvar (`conversations.replies` per trådförälder i fönstret; svaren taggas med `threadTs`) och delade filer: stödda filtyper inom storleksgränsen laddas ned via `url_private` med bottoken, laddas upp till privat blob och blir fil-items (redan importerade fil-id:n hoppas över före uppladdning, så inga föräldralösa blobbar skapas). Oklassificerbara eller för stora filer loggas och hoppas över.
- Uppladdningsprocenten i capture-wireframen saknar teknisk backing.
- UI för review, trash, connected accounts och source rules är inte byggt trots att backendkontrakten finns.
