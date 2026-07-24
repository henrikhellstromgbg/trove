# CLAUDE.md, Trove

Project-scoped personal knowledge base for people drowning in inputs. Capture files, text, URLs and recurring sources, ask with citations, and create recurring pipeline reports. A Tauri menu bar app is the local capture runtime over a Next.js backend.

Audience is designers, freelancers, indie operators, researchers. Not "normal people."

## Stack

- Next.js 16 (App Router, Turbopack), TypeScript, Tailwind 4
- Local SQLite in a single file (`data/trove.db`, gitignored) via libSQL (`@libsql/client`)
- Drizzle ORM (libSQL driver), drizzle-kit for migrations
- Full-text search via FTS5 (`item_fts` virtual table + triggers); vector search is brute-force cosine in JS (`lib/db/vector.ts`, embeddings stored as Float32 blobs), no pgvector/ANN index
- Clerk for auth (email magic links)
- Inngest for background jobs and crons (runs locally against the local DB)
- Private Vercel Blob storage for uploaded files
- Anthropic Claude: Sonnet 4.6 for answers, Haiku 4.5 for extract/enrich
- Gemini gemini-embedding-001 for embeddings (768 dims)
- Tauri 2 for the partial macOS menu bar shell
- Local-first: libSQL is a native file driver, so the app runs on your machine (`next dev`/`next start`), not on Vercel serverless. Migrated off Neon Postgres 2026-07-24.

## Folder structure

```
trove/
├── app/                       Next.js app router
│   ├── layout.tsx             ClerkProvider, header
│   ├── page.tsx               Home, shows userId once signed in
│   ├── sign-in/[[...sign-in]]/page.tsx
│   ├── sign-up/[[...sign-up]]/page.tsx
│   └── globals.css
├── lib/
│   └── db/
│       ├── schema.ts          Drizzle schema, 16 tables
│       ├── index.ts           Drizzle client (libSQL, sets PRAGMA foreign_keys/WAL)
│       ├── migrate.ts         Migration runner, then sets up FTS5
│       └── migrations/        Generated SQL
├── middleware.ts              Clerk middleware; ingest and Inngest have route-specific auth
├── drizzle.config.ts          Loads .env.local explicitly
├── .env.local                 Real keys (gitignored)
└── .env.local.example         Placeholders for all env vars
```

## Database schema

Sixteen tables in `lib/db/schema.ts`. `project` is the hard knowledge boundary. Every query must validate `user_id` and scope to a verified `project_id`, directly or through an owning relation.

| Table          | Purpose |
|----------------|---------|
| `project`      | Hard container for all knowledge, sources, conversations and pipelines. |
| `source`       | Project-owned recurring input. RSS, web scrape and Slack poll are implemented. |
| `connected_account` | User-owned connection metadata; OAuth and credential storage remain. |
| `source_rule`  | Versioned selection and review rules for a source. |
| `source_run`   | One source sync attempt with cursor and outcome. |
| `original_record` | Immutable source payload versions linked to imported items. |
| `ingest_token` | Revocable token for local and server callers of `/api/ingest`. |
| `item`         | One captured thing (text, url, pdf or image). Status flows pending to processing to ready. |
| `review_decision` | Audit row for approve or reject decisions. |
| `deletion_marker` | Prevents a permanently deleted source record from being imported again. |
| `chunk`        | Text chunk of an item with a 768-dim embedding stored as a Float32 `blob`. Ranked by brute-force cosine in JS. Powers retrieval. |
| `conversation` | Chat thread against the corpus. |
| `message`      | One message in a conversation, with `citations` JSONB array of item ids. |
| `pipeline`     | User-defined recurring job. Stores `description` (English), `spec` (compiled plan), `cron`. |
| `pipeline_run` | One execution of a pipeline with output JSONB and status. |
| `topic`        | Auto-wiki cluster. Holds an array of item ids, a generated name and summary. |

## Environment variables

All in `.env.local`. Placeholders live in `.env.local.example`.

```
TROVE_DB_URL                       libSQL URL, optional (defaults to file:./data/trove.db)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY  Clerk
CLERK_SECRET_KEY                   Clerk
ANTHROPIC_API_KEY                  Claude for answer, extract, enrich
GEMINI_API_KEY                     Embeddings only
INNGEST_EVENT_KEY                  Inngest (week 1)
INNGEST_SIGNING_KEY                Inngest (week 1)
PRIVATE_BLOB_READ_WRITE_TOKEN      Private Vercel Blob store
RESEND_API_KEY                     Optional pipeline email delivery
SLACK_BOT_TOKEN                    Optional Slack poll source
```

## Scripts

```
pnpm dev          Next.js dev server on :3000
pnpm build        Next.js production build
pnpm db:generate  drizzle-kit generate, creates SQL from schema
pnpm db:migrate   tsx lib/db/migrate.ts, applies migrations then sets up FTS5 (item_fts + triggers)
pnpm db:push      drizzle-kit push, skips migration files (dev only)
pnpm db:studio    drizzle-kit studio, web UI on the DB
```

## Conventions and gotchas

**Env loading.** Next.js loads `.env.local` automatically for `next dev`. Anything else (drizzle-kit, tsx scripts) needs explicit loading. Pattern:

```ts
import { config } from "dotenv";
config({ path: ".env.local" });
```

Already done in `drizzle.config.ts` and `lib/db/migrate.ts`.

**SQLite type mapping (libSQL + Drizzle).** `uuid` → text PK (`crypto.randomUUID()`); `jsonb` → `text({ mode: "json" })`; `timestamptz` → `integer({ mode: "timestamp_ms" })` (unix epoch ms, Drizzle maps it to/from `Date`); `text[]` → JSON array in a text column; `boolean` → `integer` boolean; `vector(768)` → `blob` Float32 buffer (encode/decode in `lib/db/vector.ts`). Foreign keys are only enforced because `lib/db/index.ts` sets `PRAGMA foreign_keys = ON` per connection.

**FTS5 lives outside Drizzle.** drizzle-kit can't express the `item_fts` virtual table or its triggers, so they're created idempotently by `applyFullTextSearch` in `lib/db/fts.ts`, called at the end of `db:migrate`. Search goes through `searchItems` in `lib/db/search.ts` (bm25 rank + `snippet()` highlight), scoped to a project + user. The old pg migrations are kept for reference in `lib/db/migrations-pg-archive/`.

**Vector search is brute-force.** No ANN index. `rankByEmbedding` (`lib/db/vector.ts`) loads a project's candidate chunks and ranks by cosine in JS. Fine at personal scale; revisit if the corpus grows past ~100k chunks.

**pnpm 11 build approval.** pnpm 11 blocks postinstall scripts by default. When installs warn `[ERR_PNPM_IGNORED_BUILDS]`, run `pnpm approve-builds --all` once. So far we've approved `sharp`, `unrs-resolver`, `esbuild` variants, and `@clerk/shared`.

**Clerk v7 control components.** `SignedIn` and `SignedOut` are gone. Use `<Show when="signed-in">` and `<Show when="signed-out">` from `@clerk/nextjs`. Note the kebab-case condition strings.

**Project scoping.** Every DB query must validate `userId = currentUserId` and the active project. Do not accept an item, source or pipeline id without verifying that it belongs to the same user and project. No cross-project reads, ever.

**Migration safety.** SQLite is a local file. `pnpm db:migrate` applies the generated migrations then sets up FTS5 against `data/trove.db` (or `TROVE_DB_URL`). To start over, delete `data/trove.db` and re-run migrate. The old Postgres prod-reconciliation runbook (`docs/prod-db-reconciliation-runbook.md`, `scripts/baseline-migrations.ts`, `scripts/test-reconciliation.sh`) is **obsolete** as of the 2026-07-24 SQLite migration — Neon/Postgres is no longer used. The pre-migration pg SQL is archived under `lib/db/migrations-pg-archive/`.

**Naming.** Tables and columns are snake_case in SQL, camelCase in TypeScript via Drizzle. Schema names are singular nouns. Sources import material. Pipelines read a project's library and create recurring results. Never call a source selection rule a pipeline.

## Product boundary

- Project is the only hard content boundary in v2. The longer-term product plan's `Case` maps to Project for now.
- Current core: project navigation, Capture, Library, Ask, RSS/web/Slack sources, user-defined pipelines and seeded weekly Digest.
- Next core: one ingest path, strict project isolation, Morning brief and Friday weekly summary templates, connected accounts, source runs/originals, mail, watched folders, review and trash.
- Later: more specialized pipeline/source templates, generic YouTube transcription, shared projects, vertical packs, voice notes and browser extensions.
- Tactical Athlete's specialized long-podcast mining remains a project-specific tool outside Trove Core.

## Build state

| Step | State | Notes |
|------|-------|-------|
| Scaffold Next.js 16 | Done | App Router, Tailwind, Turbopack, dev server returns HTTP 200 |
| SQLite (libSQL) + Drizzle | Done | Local file `data/trove.db`. Fresh migration `0000` builds the full schema; `db:migrate` then sets up FTS5. Brute-force JS vector search replaces pgvector. Migrated off Neon 2026-07-24. |
| Clerk auth | Done | Protects application routes; `/api/ingest` supports its own Clerk/token auth. |
| Capture + private Vercel Blob | Done | Browser still uses legacy `/api/capture`; migration to `/api/ingest` remains. |
| Inngest + ingest worker | Done | Extraction, chunking, embedding, enrichment, topic clustering, source sync and due pipelines exist. |
| Ask retrieval | Done | Streams project-scoped cited answers and requires an owned project id; conversation persistence remains. |
| Topic clustering | Done | Nightly project-scoped clustering plus a read-only browsing route at `/p/[slug]/topics` (cards with name, summary and grouped items). |
| Sources | Partial | RSS, web and Slack poll exist. Mail, watched folders, connected accounts and source runs remain. |
| User-defined pipelines | Done | Plain-language compile, scheduling, run-now, pause, history, email and Digest exist. |
| Web UI | Partial | Ask, Library, Sources and Pipelines exist. Item detail, review, trash and Trove settings are planned. |
| Tauri 2 shell | Partial | Tray, hotkey and drag-drop capture POST through `/api/ingest` with a project id. Local `mail_folder` (mbox) and `folder_watch` runtimes read only registry-approved paths, checkpoint locally for idempotence, and post with the ingest token and per-source project id. A background timer runs the sync on an interval, and the daemon fetches its approved registry from the server (local-file fallback). Setup UI and signing remain. |
| Sign, notarize, DMG | Pending | Apple Developer Program signup needed first |

## Reference architecture

`https://github.com/AsyncFuncAI/deepwiki-open` (MIT). Same pipeline shape: corpus to embed to cluster to generate. Port pattern, not their Python.

## Agent workflow

Claude and Codex share build plans through one plan document per work round in `docs/` (see `docs/review-fix-plan-2026-07-21.md` for the format). One agent writes at a time; the status line says who. Commit at each completed and verified stage. Never mix unrelated work in one commit.

Standing permission: delegate mechanical work (searches, test runs, log reading, bulk edits) to a low-effort model. Claude Code uses the `grunt` subagent. Codex primarily uses its native subagents; a headless `codex exec --profile cheap` (loading the separate `~/.codex/cheap.config.toml`) is the manual alternative. Reviews and security-sensitive code always stay on the strong models.
