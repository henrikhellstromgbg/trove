# Backend phase, 2026-07-21

Status line (who writes now): **Claude — implementing.**

One work round, three separate and independently verified commits. No production database use, ever. No push.

## Part 1: Review rules at import

`source_rule` (ruleType `review`) exists but nothing consumes it. Make an active, version-bound, project-scoped review rule decide an imported item's initial status.

Model chosen (hold-then-process):

- A matching review rule sets the new item's status to `review` instead of `pending`. Review items are **not** emitted to the ingest worker, so they get no chunks and cannot surface in Ask (Ask already filters `status = ready`). Double guard: status and absence of chunks.
- On **approve**, the item goes to `pending` and `item/captured` is emitted, so the normal extract/chunk/embed pipeline runs and it becomes `ready`. On **reject**, it goes to trash (unchanged).
- Rule selection uses the highest-version enabled `review` rule for the source, scoped by `(projectId, sourceId)`, so rules are version-bound and project-scoped by construction.

Rule config (`lib/sources/review-rules.ts`):

```
{ mode: "all" | "match", contains: string[] }
```

`all` holds every imported item; `match` holds items whose source label or text contains any listed phrase (case-insensitive). `match` requires at least one phrase.

Touched: `lib/sources/review-rules.ts` (new, pure), `lib/sources/sync.ts` (route items in `persistSyncBatch`), `app/api/ingest/route.ts` + `deps.ts` (gate source-attributed ingest), `lib/review-or-deletion/contracts.ts` + `store.ts` (approve → pending + emit), `app/api/sources/[id]/rules/route.ts` (validate review config). Mutation-tolerant tests in `tests/review-rules.test.ts` and extensions to existing suites.

## Part 2: Local mail and folder runtime in Tauri

Implement `mail_folder` and `folder_watch` local execution in the Tauri shell, building on the existing `lib/sources/mail.ts` and `lib/sources/folder-watch.ts` contracts. Reads only explicitly approved local paths, posts through `/api/ingest` with the ingest token and an explicit projectId, uses checkpoints + externalId for idempotence. No local path or credential is sent to the cloud as content. No Gmail OAuth here.

## Part 3: Pipeline delivery status

The report is always stored in Trove. When email is used, persist recipient, delivery status and any error. A mail failure must never be counted as a fully successful delivery. Keep the run retryable and avoid duplicate reports.

## Verification per part

Focused tests, `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm lint`, `cargo fmt --all -- --check`, Rust tests with `CARGO_TARGET_DIR=/tmp/trove-desktop-target`, `pnpm build`, and fresh-migration verification only if the schema changes (it should not).
