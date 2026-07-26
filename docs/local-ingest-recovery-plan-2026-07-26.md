# Local ingest recovery plan — 2026-07-26

Status: Codex — implementation complete, verified

## Goal

Make local file ingestion reliable when Trove uses SQLite and Inngest in development:

1. `pnpm dev` starts both Next.js and the Inngest dev server.
2. Existing items stranded in `pending` are re-emitted automatically after Inngest starts.
3. Duplicate `item/captured` events cannot run the same item concurrently.
4. No production database is touched and no runtime dependency is added.

## Verification

- Focused tests for pending-item recovery and duplicate-event claiming.
- Full typecheck, test suite, lint, and production build.
- Local smoke check: Next.js and Inngest listen on ports 3000 and 8288, then existing pending items leave `pending`.

## Stop condition

Stop when the code and documentation agree, automated checks prove the queue contracts, and the pinned CLI/start flags are verified. Do not consume the user's persisted queue during verification because doing so invokes paid external AI APIs; queue consumption begins when the user next runs `pnpm dev`.

## Result

- `pnpm dev` now supervises Next.js and a pinned Inngest dev server; `ingest-item` is capped at four concurrent runs.
- `recover-pending-items` re-emits up to 100 oldest pending items each minute.
- `ingest-item` atomically claims only `pending` rows, preventing duplicate delivery from creating duplicate chunks.
- Added three SQLite-backed regression tests for claiming, state exclusion, ordering, and batching.

## Verification evidence

- TypeScript: pass (`pnpm exec tsc --noEmit`).
- Focused tests: 49/49 pass.
- Full tests: 229/229 pass.
- Changed-file lint: pass.
- Production build: pass.
- Inngest CLI 1.38.1 and the configured `dev -u` / `--queue-workers` flags: verified from the installed CLI help.
- Full repository lint remains blocked by five pre-existing errors in unrelated UI/design-system files; no changed file has a lint finding.
- Live recovery completed against the local SQLite database: all 20 persisted items reached `ready`, with 234 chunks and no `pending` or `processing` rows remaining.

## Runtime correction

The first live run showed that Inngest CLI 1.38.1 accepted jobs but left them in
`QUEUED` when started with the global `--queue-workers 4` override. The override
was removed, leaving the CLI executor pool at its supported default.

The next live run consumed the pending queue but exposed Gemini's free-tier limit
of 100 embedding inputs per minute. `ingest-item` now runs with `concurrency: 1`
and a smoothed `throttle` of two starts per minute. Exhausted retries transition
`processing` items to `failed`, so external API failures cannot strand the UI.

Five old runs that had exhausted retries before throttling were verified to have
zero chunks, reset to `pending`, and successfully recovered through the throttled
queue. Final checks: 230/230 tests pass, changed-file lint and TypeScript pass,
and the production build passes.
