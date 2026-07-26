# Multi-file capture and duplicate feedback — 2026-07-26

Status: Codex — implementation complete, verified

## Goal

Improve manual file capture without changing the ingestion pipeline:

1. Selecting, pasting, or dropping multiple files queues every file.
2. Capture uploads the queued files sequentially and reports batch progress.
3. Re-uploading the same filename into the same project returns a clear
   `File already exists` result before another blob or item is created.
4. Source-driven idempotency by `sourceId` + `externalId` remains unchanged.

## Verification

- API regression test proves project-scoped manual duplicate detection happens
  before file storage, item insertion, or event emission.
- Batch upload tests prove every file is submitted and duplicate/error outcomes
  are preserved for the UI.
- Full tests, TypeScript, changed-file lint, and production build pass.

## Stop condition

Stop when multi-file selection/drop reaches the existing ingest endpoint one
file at a time, duplicate filenames receive explicit feedback, and all checks
are green.

## Result

- File selection, paste, and drag/drop now append every provided file to a
  removable queue.
- Capture uploads the queue sequentially with `Uploading n/total` progress;
  failed files remain queued for retry.
- A filename already attached to any item in the same owned project returns
  HTTP 409 with `File already exists` before storage or ingestion side effects.
- Mixed batches summarize saved files, existing files, and per-file errors.

## Verification evidence

- Focused capture/API tests: 46/46 pass.
- Full test suite: 237/237 pass.
- TypeScript and changed-file lint: pass.
- Production build: pass, with only the existing middleware deprecation and
  broad NFT tracing warnings.
- The local route responds, but command-line UI smoke is stopped by Clerk's
  expected signed-out development-browser guard; no persisted files were added
  during verification.
