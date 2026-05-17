# CLAUDE.md, Trove

Personal knowledge base for people drowning in inputs. Drop anything in, ask it anything later, with auto-generated topic pages and one weekly digest pipeline. v0.1 ships as a signed Mac menu bar app over a Next.js backend.

Audience is designers, freelancers, indie operators, researchers. Not "normal people."

## Stack

- Next.js 16 (App Router, Turbopack), TypeScript, Tailwind 4
- Neon Postgres with pgvector
- Drizzle ORM (Neon serverless driver), drizzle-kit for migrations
- Clerk for auth (email magic links)
- Inngest for background jobs and crons (planned)
- Vercel Blob for file storage (planned)
- Anthropic Claude: Sonnet 4.6 for answers, Haiku 4.5 for extract/enrich
- OpenAI text-embedding-3-small for embeddings (1536 dims)
- Tauri 2 for the macOS menu bar shell (planned, week 2)
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
│       ├── schema.ts          Drizzle schema, 7 tables
│       ├── index.ts           Drizzle client (Neon serverless + ws polyfill)
│       ├── migrate.ts         Migration runner, enables pgvector
│       └── migrations/        Generated SQL
├── middleware.ts              Clerk middleware, protects everything except sign-in, sign-up, /api/inngest
├── drizzle.config.ts          Loads .env.local explicitly
├── .env.local                 Real keys (gitignored)
└── .env.local.example         Placeholders for all env vars
```

## Database schema

Seven tables in `lib/db/schema.ts`. All keyed by `user_id` (Clerk user id, stored as text). Every query must filter by `user_id`.

| Table          | Purpose |
|----------------|---------|
| `item`         | One captured thing (text, url, pdf, image, audio). Status flows pending to processing to ready. |
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
BLOB_READ_WRITE_TOKEN              Vercel Blob (week 1)
```

## Scripts

```
pnpm dev          Next.js dev server on :3000
pnpm build        Next.js production build
pnpm db:generate  drizzle-kit generate, creates SQL from schema
pnpm db:migrate   tsx lib/db/migrate.ts, enables pgvector then applies migrations
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

**User scoping.** Every DB query must include `where userId = currentUserId`. Items, chunks, conversations, pipelines, topics, all of it. No cross-tenant reads, ever.

**Naming.** Tables and columns are snake_case in SQL, camelCase in TypeScript via Drizzle. Schema names: `item`, `chunk`, `conversation`, `message`, `pipeline`, `pipeline_run`, `topic`. Singular nouns.

## v0.1 scope

Reference in user memory under `project-trove`. Summary:

- Capture: drop to icon, ⌃⇧Space ask window
- Recall: chat answers with citations
- Auto-wiki view: nightly clustering job, browseable topic pages
- One pipeline: weekly digest of saved items, with a "forgotten" serendipity pick
- Tauri 2 Mac menu bar shell, signed and notarized DMG
- Hotkey is ⌃⇧Space (not ⌘⇧Space, that collides with macOS character viewer)

Deferred to v0.2: user-defined pipelines, email-in, voice notes, Safari share extension.

## Build state

| Step | State | Notes |
|------|-------|-------|
| Scaffold Next.js 16 | Done | App Router, Tailwind, Turbopack, dev server returns HTTP 200 |
| Neon + Drizzle + pgvector | Done | Schema applied, pgvector extension enabled |
| Clerk auth | Code complete | Awaiting Clerk dashboard setup and keys in .env.local |
| /api/capture + Vercel Blob | Pending | |
| Inngest + ingest worker | Pending | |
| /api/ask retrieval | Pending | |
| Auto-wiki clustering | Pending | |
| Weekly digest pipeline | Pending | |
| Minimal web UI | Pending | |
| Tauri 2 shell | Pending | |
| Sign, notarize, DMG | Pending | Apple Developer Program signup needed first |

## Reference architecture

`https://github.com/AsyncFuncAI/deepwiki-open` (MIT). Same pipeline shape: corpus to embed to cluster to generate. Port pattern, not their Python.
