# CLAUDE.md, Trove

Project-scoped personal knowledge base for people drowning in inputs. Capture files, text, URLs and recurring sources, ask with citations, and create recurring pipeline reports. A Tauri menu bar app is the local capture runtime over a Next.js backend.

Audience is designers, freelancers, indie operators, researchers. Not "normal people."

## Stack

- Next.js 16 (App Router, Turbopack), TypeScript, Tailwind 4
- Neon Postgres with pgvector
- Drizzle ORM (Neon serverless driver), drizzle-kit for migrations
- Clerk for auth (email magic links)
- Inngest for background jobs and crons
- Private Vercel Blob storage for uploaded files
- Anthropic Claude: Sonnet 4.6 for answers, Haiku 4.5 for extract/enrich
- Gemini gemini-embedding-001 for embeddings (768 dims)
- Tauri 2 for the partial macOS menu bar shell
- Hosting on Vercel

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
│       ├── index.ts           Drizzle client (Neon serverless + ws polyfill)
│       ├── migrate.ts         Migration runner, enables pgvector
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
| `chunk`        | Text chunk of an item with `vector(768)` embedding. HNSW cosine index. Powers retrieval. |
| `conversation` | Chat thread against the corpus. |
| `message`      | One message in a conversation, with `citations` JSONB array of item ids. |
| `pipeline`     | User-defined recurring job. Stores `description` (English), `spec` (compiled plan), `cron`. |
| `pipeline_run` | One execution of a pipeline with output JSONB and status. |
| `topic`        | Auto-wiki cluster. Holds an array of item ids, a generated name and summary. |

## Environment variables

All in `.env.local`. Placeholders live in `.env.local.example`.

```
DATABASE_URL                       Neon pooled connection string
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
pnpm db:migrate   tsx lib/db/migrate.ts, enables pgvector then applies migrations
pnpm db:verify-fresh  applies 0000 + 0001 to a separate empty VERIFY_DATABASE_URL and compares it with schema.ts
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

**Neon serverless in Node.** The Neon driver uses WebSockets. Node has no built-in WebSocket, so we install `ws` and set `neonConfig.webSocketConstructor = ws`. Done in both `lib/db/migrate.ts` and `lib/db/index.ts`. On Vercel edge, WebSocket is native and the polyfill is skipped via `if (typeof WebSocket === "undefined")`.

**pnpm 11 build approval.** pnpm 11 blocks postinstall scripts by default. When installs warn `[ERR_PNPM_IGNORED_BUILDS]`, run `pnpm approve-builds --all` once. So far we've approved `sharp`, `unrs-resolver`, `esbuild` variants, and `@clerk/shared`.

**Clerk v7 control components.** `SignedIn` and `SignedOut` are gone. Use `<Show when="signed-in">` and `<Show when="signed-out">` from `@clerk/nextjs`. Note the kebab-case condition strings.

**Project scoping.** Every DB query must validate `userId = currentUserId` and the active project. Do not accept an item, source or pipeline id without verifying that it belongs to the same user and project. No cross-project reads, ever.

**Migration safety.** The migrations `0000`→`0006` are only the fresh-install path for an empty database. Never run them against the existing db:push-created production database as-is: with no journal the migrator restarts at `0000` and collides on existing objects. The backup-first, baseline-then-migrate reconciliation is documented and its mechanism is tested (converges to a fresh migrate) in [docs/prod-db-reconciliation-runbook.md](docs/prod-db-reconciliation-runbook.md) — use `scripts/baseline-migrations.ts` (records already-present migrations in the journal without running their SQL; refuses unless `--confirm-database` matches the target) and rehearse the whole thing on a restored copy before any production action. Prod is never touched directly.

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
| Neon + Drizzle + pgvector | Partial | Migrations 0000→0006 bring fresh installs to the current schema and vector(768); verified against a disposable database via `pnpm db:verify-fresh`. Prod (db:push-created) reconciliation is documented and its baseline-then-migrate mechanism is tested to converge (`docs/prod-db-reconciliation-runbook.md`, `scripts/baseline-migrations.ts`, `scripts/test-reconciliation.sh`); the prod cutover itself is not yet run. |
| Clerk auth | Done | Protects application routes; `/api/ingest` supports its own Clerk/token auth. |
| Capture + private Vercel Blob | Done | Browser still uses legacy `/api/capture`; migration to `/api/ingest` remains. |
| Inngest + ingest worker | Done | Extraction, chunking, embedding, enrichment, topic clustering, source sync and due pipelines exist. |
| Ask retrieval | Done | Streams project-scoped cited answers and requires an owned project id; conversation persistence remains. |
| Topic clustering | Backend only | Nightly project-scoped clustering exists; no current topic browsing route. |
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
