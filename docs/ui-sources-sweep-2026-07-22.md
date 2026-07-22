# Sources UI sweep - resumable plan (2026-07-22)

**Status:** S1 completed and verified. Ready for S2; no agent is currently writing.

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
