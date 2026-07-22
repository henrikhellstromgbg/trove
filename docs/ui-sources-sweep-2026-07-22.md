# Sources UI sweep - resumable plan (2026-07-22)

**Status:** S4 code QA and corrective final review completed and independently approved. Authenticated visual evidence remains pending browser availability.

**Purpose:** Bring the complete Sources journey in line with the canonical wireframes while preserving Trove's current visual language and all existing behavior.

**Governing files:**
- `DESIGN.md` controls visual decisions.
- `docs/ui-layout-v2.md` controls product structure and workflow.
- `docs/trove-project-flow-architecture.html` is the detailed wireframe reference.
- `docs/ui-sweep-plan-2026-07-22.md` defines the shared shell and primitives already delivered in `ace2dbc`.

## Working protocol

- One writer at a time. Claude implements; Codex reviews and verifies.
- Every stage starts in a fresh Claude context. Do not use one long session or depend on `/compact`.
- Read only this plan, `DESIGN.md`, the active stage's files, and small targeted wireframe excerpts.
- Before editing, change the status line to `Sx in progress - Claude`.
- When a stage is finished, record exact files, validation run, unresolved risks, and `Ready for Codex review`.
- If Claude hits a session limit before handoff, stop writing. Codex inspects the partial diff and records the exact restart point here.
- Commit only after Codex review and green validation. One verified stage per commit.
- Never touch production, push, deploy, or stage `.omx/` or `2026-05-22-081046-were-going-to-explore-and-define-a-new-product-c.txt`.

## Locked product rules

- Sources are project scoped. Existing ownership filters and `projectId` API contracts stay intact.
- Source kinds remain: RSS, web page, Slack channel, mail folder, and watched folder.
- RSS/web/Slack run in the cloud. Mail folder/watched folder run through the desktop app.
- A source list row shows name, kind, runtime, health, last sync, and imported-item count when available.
- Source setup stays one route and changes fields based on kind. No fake connection or preview step is added.
- Source detail shows status, recent items, latest runs, Run now for cloud sources, and deletion.
- Current deletion stops/removes the source and keeps imported material. The wireframe's alternative "move all imported material to Trash" is not supported by the current API and is explicitly deferred.
- Generic YouTube transcription is not part of Trove Sources.
- No new dependency, route, API, database schema, or unrelated page migration.

## Visual target

- Keep the existing shell, Geist typography, neutral palette, red active/error, and green success.
- Use `PageFrame`, `PageHeader`, `SectionHeader`, `DataList`, `DataRow`, `StatusIndicator`, `EmptyState`, `InlineError`, `Button`, `Tabs`, form fields, and `ConfirmDialog` where they genuinely fit.
- Page titles: 24px mobile, 28-32px desktop. Minimal English labels.
- Dense unframed layouts with hairline-separated rows. No giant editorial headings, tracked uppercase eyebrows, large decorative cards, nested cards, glass, or radii over 8px.
- Desktop first, but every stage must remain usable at 390px width.

## Stage S1 - Sources list

**Write scope:**
- `app/p/[slug]/sources/page.tsx`
- focused tests only if query/view behavior changes
- this plan's status and handoff log

**Deliver:**
- Replace the editorial heading and prose with `PageFrame` + `PageHeader` titled `Sources`.
- Keep `New source` as the clear header action.
- Replace bespoke list markup with a dense source list using the shared primitives.
- Each populated row shows source name, human-readable kind, cloud/Desktop runtime, active/paused/error status, last-sync time, and imported-item count.
- Any item-count query must remain explicitly scoped by both `userId` and verified `project.id`.
- Empty state is plain: `No sources yet.` plus one `New source` action. No decorative empty card.
- Preserve existing route, ordering, auth, project lookup, and links.

**Acceptance:**
- No `text-3xl`, `text-4xl`, `text-[10px]`, uppercase tracking, glass, shadow, or `rounded-2xl` in the touched page.
- Long names and status metadata do not collide at desktop or 390px.
- Typecheck, focused lint, tests, and build pass.
- Stop after the list. Do not touch New source or Source detail.

## Stage S2 - New source

**Write scope:**
- `app/p/[slug]/sources/new/page.tsx`
- `app/p/[slug]/sources/new/new-source-form.tsx`
- focused UI tests
- this plan's status and handoff log

**Deliver:**
- Use `PageFrame` + `PageHeader` titled `New source` with a simple back link.
- Remove the large card and editorial copy. The form is an unframed, constrained single column.
- Source kind is an accessible segmented/radio choice with sentence-case labels and `aria-pressed` or native radio semantics.
- Use common field primitives for name and kind-specific fields.
- Keep all current payload construction and source-kind behavior exactly intact.
- Cloud sources show schedule choices. Local sources show a short Desktop-app note and no server schedule.
- Error uses `InlineError`; submit uses `Button`; busy/disabled state is explicit.
- No motion dependency usage in the form.

**Acceptance:**
- RSS, web page, Slack, mail folder, and watched folder still submit the same payloads as before.
- Keyboard operation and accessible labels are complete.
- Mobile controls wrap without clipping.
- Typecheck, focused lint, tests, and build pass.
- Stop before Source detail.

## Stage S3 - Source detail

**Write scope:**
- `app/p/[slug]/sources/[id]/page.tsx`
- `app/p/[slug]/sources/[id]/sync-now-button.tsx`
- `app/p/[slug]/sources/[id]/delete-button.tsx`
- focused UI tests
- this plan's status and handoff log

**Deliver:**
- Use the shared page/header/section/list/status primitives.
- Header shows source name, kind, runtime, schedule, and back navigation without an eyebrow.
- Present health and timing as a compact metadata band/list, not a decorative status card.
- Recent items and run history use dense rows with clear success/error states.
- Cloud sources have `Run now`; local sources explain that sync comes from the Desktop app.
- Replace inline deletion confirmation with `ConfirmDialog`.
- Deletion copy must explicitly say imported items stay in the Library. Do not show the unsupported Trash-all option.
- Preserve all existing queries, limits, project ownership filters, and API calls.

**Acceptance:**
- Not-found, empty-items, empty-runs, busy, sync-error, and delete-confirm states are covered.
- No invented edit action, source-rule editor, or unsupported deletion mode.
- Typecheck, focused lint, tests, and build pass.

## Stage S4 - Integrated Sources QA

**Write scope:** fixes only in S1-S3 files, tests, and this plan.

**Checks:**
- Signed-in desktop screenshots: empty/populated list, each New source kind, healthy/error source detail, delete dialog.
- Signed-in mobile screenshots at 390x844 for list, form, detail, and dialog.
- Keyboard: header action, source rows, kind selector, fields, Run now, dialog focus trap/Escape/focus restore.
- No horizontal overflow, clipped labels, overlapping metadata, or layout shift.
- `pnpm exec tsc --noEmit`, `pnpm test`, `pnpm lint`, and `pnpm build` all pass.
- Compare the final screens against both `DESIGN.md` and the Sources wireframes before marking complete.

## Handoff log

| Date | Stage | Agent | Result |
| --- | --- | --- | --- |
| 2026-07-22 | Plan | Codex | Split Sources into four fresh-context stages; documented existing behavior, visual target, validation, and unsupported delete-to-Trash branch. Ready for S1. |
| 2026-07-22 | S1 | Claude | Rewrote `app/p/[slug]/sources/page.tsx` to use `PageFrame` + `PageHeader` (title "Sources", "New source" link action), `DataList`/`DataRow` for a dense row list, and `StatusIndicator` for active/paused/error. Each row shows name, human kind label, Cloud/Desktop runtime, last-sync time, and imported-item count. Added an item-count aggregate query explicitly scoped by `eq(schema.item.userId, userId)` and `eq(schema.item.projectId, project.id)`, grouped by `sourceId`. Empty state uses `EmptyState` with "No sources yet." and no card; the header holds the sole "New source" link. Preserved auth, project lookup via `getProjectBySlug`, `orderBy(desc(createdAt))`, routes (`/p/[slug]/sources/new`, `/p/[slug]/sources/[id]`), and project/user scoping on both queries. Did not touch `sources/new` or `sources/[id]`. No new dependency, route, API, or schema change. **Validation gap:** headless permission mode denied `pnpm exec tsc --noEmit`, `pnpm exec eslint`, `pnpm test`, and `pnpm build` (all required approval that wasn't available in this session) — none were run. Manual read-through of the diff was done instead; Codex must run `pnpm exec tsc --noEmit`, focused lint, tests, and build before this stage can be marked green. Ready for Codex S1 review. |
| 2026-07-22 | S1 review | Codex | Verified project-scoped counts and corrected two review findings: removed the duplicate empty-state action so the header contains the single `New source` action, and moved the non-interactive status out of `DataRow.trailing` so the stretched row link has no dead click/tap area. `pnpm exec tsc --noEmit`, focused ESLint, all 204 tests, and `pnpm build` pass. Browser-backed screenshot QA was unavailable and remains scheduled for S4. S1 is complete and ready to commit as its own checkpoint. |
| 2026-07-22 | S2 start attempt | Claude | Fresh Opus session hit its account limit before reading or editing the stage files. No partial diff exists and no writer remains active. Restart S2 from the beginning after the 18:40 Europe/Stockholm reset, using only this plan and the committed S1 checkpoint `d773bb4`. |
| 2026-07-22 | S2 | Claude | **Files changed:** `app/p/[slug]/sources/new/page.tsx` (now an async server component reading `slug` from `params`, rendering `PageFrame` + `PageHeader` titled "New source" with a plain back `Link` to `/p/{slug}/sources` as the header description; removed the eyebrow, editorial title/subtitle, and the outer card) and `app/p/[slug]/sources/new/new-source-form.tsx` (unframed `max-w-xl` single-column `<form>`; kind selector is a `<fieldset>`/`role="group"` of `type="button"` toggles with `aria-pressed` and focus-visible rings, sentence-case labels RSS feed / Web page / Slack channel / Mail folder / Watched folder; name and kind-specific fields use `TextField`/`TextArea` primitives, schedule uses `Select` with sentence-case options Every hour / Every 6 hours / Daily at 8am; `InlineError` for errors; `Button` `type="submit"` with `disabled={!canSubmit}` and `aria-busy`; removed `motion/react`). **Behaviors preserved exactly:** all `useState` fields, `parseList` normalisation, `primaryFieldFilled` validation and the `submit()` guard, `LOCAL_KINDS` cloud/local split (local kinds show the Desktop-app note and send no `cron`; cloud kinds keep the same three cron preset values), request body field names/values, `POST /api/sources`, and the `router.push(/p/{slug}/sources/{id})` redirect. Added an explicit `canSubmit` to drive the button's disabled state without changing the underlying validation. Controls wrap via `flex-wrap` and remain keyboard-operable. No new dependency, route, API, schema, Source list, or Source detail change. **Validation gap:** Bash validation (`pnpm exec tsc --noEmit`, focused ESLint, `pnpm test`, `pnpm build`) was not run in this session — Codex must run typecheck, focused lint, tests, and build, plus the S4 keyboard/mobile screenshot QA. Ready for Codex S2 review. |
| 2026-07-22 | S2 review | Codex | Independent code review found no issues in payload preservation, submission semantics, accessibility, responsive wrapping, or shared primitive use. `pnpm exec tsc --noEmit`, focused ESLint, all 204 tests, and `pnpm build` pass. Browser-backed mobile and keyboard screenshot QA remains scheduled for S4. S2 is complete and ready to commit as its own checkpoint. |
| 2026-07-22 | S3 | Claude | **Files changed:** `app/p/[slug]/sources/[id]/page.tsx`, `app/p/[slug]/sources/[id]/sync-now-button.tsx`, `app/p/[slug]/sources/[id]/delete-button.tsx`. Rebuilt Source detail on shared primitives: `PageFrame` + `PageHeader` (title = source name; description = kind · Cloud/Desktop runtime · schedule with the config summary beneath) plus a plain `← All sources` back link — no eyebrow or editorial heading. Health/timing now render as a compact unframed `border-y` metadata band (`State` via `StatusIndicator`, `Last sync`, `Last status` with error color, `Next run` when present), replacing the decorative `rounded-2xl` status card; `lastError` shows below it. Recent items and run history use `DataList`/`DataRow` dense rows with `StatusIndicator` success/error states (item ready→success, failed→error; run ok→success, error→error; other→paused fallback showing the raw status). Cloud sources keep sync as a `Run now` `Button` (secondary, `aria-busy`, `InlineError`); local sources show "Sync runs from the Trove Desktop app." Empty states use `EmptyState` ("No items pulled in yet.", "No runs yet."); not-found now renders `PageFrame` + `EmptyState` with a back link. Delete replaced the inline yes/cancel with a `ConfirmDialog` (destructive, focus-trapped, Escape/focus-restore from the primitive); copy in both the footer line and dialog explicitly states imported items stay in the Library, and no Trash-all option is offered. **Behavior preserved:** all three queries unchanged (source lookup with `id`+`userId`+`projectId`, items `where sourceId` `orderBy capturedAt desc limit 20`, runs `where sourceId`+`userId`+`projectId` `orderBy startedAt desc limit 10`); `POST /api/sources/{id}/sync` and `DELETE /api/sources/{id}` with the same `projectId` query param; `router.refresh()` after sync and `router.push('/p/{slug}/sources') + refresh()` after delete; `notFound()` on missing project; local/cloud split via `runtime`; config summary precedence unchanged. Added `name` prop to `DeleteSourceButton` (dialog copy only) and surfaced sync/delete API errors via `InlineError` (new UI state, no endpoint/payload change). No new feature, dependency, route, API, schema, backend, Source list, or New source change. **Validation gap:** Bash validation (`pnpm exec tsc --noEmit`, focused ESLint, `pnpm test`, `pnpm build`) required approval unavailable in this session and was NOT run — Codex must run typecheck, focused lint, tests, and build, plus S4 keyboard/mobile/dialog screenshot QA. **Risks:** unverified typecheck; `itemStatus`/`runStatus` fallback renders unknown status strings verbatim as a neutral `paused` indicator; the `-mt-4` on `lastError` tightens spacing under the band and should be eyeballed at 390px. Ready for Codex S3 review. |
| 2026-07-22 | S3 review | Codex | Review found one state-semantics bug: a disabled source with a stale sync error displayed `State: Error` instead of `Paused`; the enabled/paused state now takes precedence while `Last status` continues to show the sync result. No other scoped issues were found. `pnpm exec tsc --noEmit`, focused ESLint, all 204 tests, and `pnpm build` pass after the fix. S3 is complete and ready to commit as its own checkpoint. |
| 2026-07-22 | S4 | Claude | Integrated QA across the six Sources files + directly-used `app/components/ui` primitives (`PageFrame`, `PageHeader`, `SectionHeader`, `DataList`/`DataRow`, `StatusIndicator`, `EmptyState`, `InlineError`, `Button`, `TextField`/`TextArea`/`Select`, `ConfirmDialog`). **One concrete issue found and fixed — status precedence inconsistency:** `app/p/[slug]/sources/page.tsx` `sourceStatus()` checked `lastStatus === "error"` *before* `!enabled`, so a disabled source carrying a stale `lastStatus="error"` rendered **Error** in the list while the same source rendered **Paused** on its detail page (`[id]/page.tsx` was corrected to paused-precedence during S3 review). Reordered the list helper to check `!enabled` first, matching the detail page and the S3-review-established semantics. **Exact change:** `app/p/[slug]/sources/page.tsx` only — swapped the order of the first two guards in `sourceStatus()` (paused now takes precedence over a stale error), no other lines touched. No test added: `sourceStatus` is an un-exported inline helper in an async server component that pulls Clerk/db at module load and cannot be imported into the existing backend-only Vitest suite without extracting it to a new module, which is outside the S1–S3 write scope; the fix is a pure two-guard reorder mirroring the already-reviewed detail-page logic. **Audit results (no other issues):** (1) Layout at 390px and desktop from class structure — list rows truncate the name (`min-w-0 truncate` under a `min-w-0` flex parent) with the status inline and metadata on a `flex-wrap` line; detail metadata band is `grid-cols-2` on mobile → `sm:flex flex-wrap`; the new-source kind selector and action row both `flex-wrap`; config summary truncates as a blockified flex child; no horizontal overflow, clipped labels, metadata/status collision, or layout shift detected in the markup. (2) Keyboard/a11y — header `New source`/back are real `Link`s; list rows use the `DataRow` stretched-overlay link with `selectLabel`; kind selector is `type="button"` toggles with `aria-pressed` inside a labelled `role="group"`; fields/select are native with `htmlFor` labels and `aria-describedby` notes; Run now and Delete are `Button`s with `aria-busy`/disabled; `ConfirmDialog` traps focus, closes on Escape, and restores focus via the primitive. (3) States — empty list (`No sources yet.`), not-found (`PageFrame` + `EmptyState` + back link), empty items/runs, busy (`aria-busy`, `Saving…`/`Syncing…`/`Deleting…`), and API errors via `InlineError` are all present. (4) No duplicate actions (single header `New source`, empty state carries none), no dead tap areas (non-interactive status sits in row `children`, not the overlay; static detail rows only use `trailing`), no unsupported delete-to-Trash option, and no changed API payloads/queries (`POST /api/sources`, `POST /api/sources/{id}/sync?projectId=`, `DELETE /api/sources/{id}?projectId=`, and all scoped drizzle selects unchanged). (5) No forbidden editorial styles — grep for `text-3xl\|text-4xl\|text-[10px]\|rounded-2xl\|shadow\|glass\|uppercase\|tracking-wide/wider/widest` across `app/p/[slug]/sources/` returns nothing. (6) Cross-screen consistency now aligned after the status-precedence fix; `KIND_LABELS` match between list and detail. **Validation gap:** headless permission mode denied `pnpm exec tsc --noEmit` (and by extension focused ESLint, `pnpm test`, `pnpm build`) in this session — none were run; the change is a pure two-line reorder with identical types. **Explicit evidence gap:** authenticated desktop/mobile (390×844) browser screenshots of empty/populated list, each New source kind, healthy/error detail, and the delete dialog, plus the interactive keyboard/focus-trap walkthrough, COULD NOT be produced because no browser session is available in this environment. Codex owns the final `pnpm exec tsc --noEmit` / focused ESLint / `pnpm test` / `pnpm build` run and this remaining screenshot/keyboard evidence gap. Ready for Codex S4 review. |
| 2026-07-22 | S4 review | Codex | Final independent review approved all six Sources files and the paused-before-stale-error consistency fix with no findings. `pnpm exec tsc --noEmit`, full `pnpm lint`, all 204 tests, and `pnpm build` pass; lint reports only one pre-existing warning in generated `desktop/src-tauri/target/.../__global-api-script.js`, with zero errors. Forbidden-style scan across the Sources routes is clean. The in-app browser reported no available browser, the local route requires a Clerk development-browser session, and Playwright is not installed; no dependency or auth bypass was added. Authenticated desktop/mobile screenshots and live keyboard walkthrough therefore remain an explicit evidence gap, not a code blocker or fabricated result. S1-S4 implementation and code-level QA are complete. |
| 2026-07-22 | Corrective final review | Codex + independent reviewers | A deeper double-check found three issues missed by the first S4 approval: `DataRow` could render block content inside a `span`, rejected create/sync/delete requests could leave controls busy (and failed deletion could close or become hard to recover), and the planned focused Sources tests were missing. Corrected the shared content wrappers, centralized request error handling and source display/form metadata, added a retryable delete-state reducer, bounded list count aggregation to the current source IDs, and parallelized the independent detail queries. Added focused payload, source-kind contract, request-failure, deletion-state, and block-child regression tests. Fresh verification passes: TypeScript, lint with zero errors and one pre-existing generated warning, 209/209 tests, production build, and the forbidden-style scan. Independent code review returned APPROVE with zero findings; independent architecture re-review returned CLEAR. Authenticated desktop/mobile screenshots and a live signed-in keyboard walkthrough remain the sole evidence gap. |
