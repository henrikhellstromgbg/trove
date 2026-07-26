# Multi-file capture and duplicate feedback — 2026-07-26

Status: Codex — notification clarity follow-up complete, verified

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

- File selection, paste, and modal drag/drop now append every provided file to
  a removable queue. The project-wide ambient drop target on every project page
  sends the complete dropped file list through the same batch uploader.
- Capture uploads the queue sequentially with `Uploading n/total` progress;
  failed files remain queued for retry.
- A filename already attached to any item in the same owned project returns
  HTTP 409 with `File already exists` before storage or ingestion side effects.
- Mixed batches summarize saved files, existing files, and per-file errors.
- Both the capture modal and global project overlay use the same tested batch
  uploader and the same `/api/ingest` duplicate response.

## Verification evidence

- Focused capture/API tests: 47/47 pass, including preservation of every file
  from the project-wide ambient drop target.
- Full test suite: 238/238 pass.
- TypeScript and changed-file lint: pass.
- Production build: pass, with only the existing middleware deprecation and
  broad NFT tracing warnings.
- The local route responds, but command-line UI smoke is stopped by Clerk's
  expected signed-out development-browser guard; no persisted files were added
  during verification.

## Notification clarity follow-up

Replace the global one-line pill with the existing token-aware `Alert` surface:

1. Pair every state with the design-system icon and semantic status color.
2. Separate the short outcome title from filenames and explanatory detail.
3. Keep long duplicate batches compact by showing a bounded filename summary.
4. Preserve progress, success, duplicate, partial-success, and error states.

### Notification result

- The global pill is replaced by the existing `Alert` component with a status
  icon, semantic color, emphasized left border, title, and description.
- Duplicate-only batches use a warning state; completed batches use success;
  failures use error; in-flight progress uses information styling.
- Filename detail is limited to four names plus an `and N more` summary.
- Focused notification tests: 5/5 pass.
- Full test suite: 240/240 pass.
- TypeScript, changed-file lint, and production build: pass.
- Full design-check still reports 11 pre-existing violations in
  `app/sidebar.tsx`; neither changed file has a design-check violation.
