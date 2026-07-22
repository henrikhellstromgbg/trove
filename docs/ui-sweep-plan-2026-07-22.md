# Trove UI sweep — staged plan (2026-07-22)

**Status line (who writes now):** Stage C shell adoption + Codex review corrections complete (Claude, 2026-07-22). Document is **Ready for Codex final approval and commit.** No agent currently editing. Next agent: claim by putting your name here before writing.

**One-writer-at-a-time rule:** exactly one agent writes this document at a time. The plan doc is the only interface between agents; no instruction lives only in a chat (AGENTS.md). Before you start writing, put your name in the status line above; when you finish a stage, add a handoff-log row and reset the status line. Commit at each completed and verified stage so the next agent starts from a clean tree.

**Governing contract:** [`DESIGN.md`](../DESIGN.md). When code and DESIGN.md disagree, fix both in the same round.

**Hard constraints (carry through every phase):**
- Small diffs, no features beyond the active phase.
- **Never touch the production database. Never push. Never deploy to prod.** Destructive steps are documented, not executed.
- Every project-owned query stays scoped by `user_id` + verified `project_id`. UI refactors must not loosen any existing scoping.
- **No new dependencies and no backend/behaviour changes.** Presentation only: routes, data flow, auth, and API contracts are unchanged.
- Preserve the current Figma-aligned visual direction (see below). This is a refinement, not a redesign.
- **Never stage or commit `.omx/` or `2026-05-22-081046-were-going-to-explore-and-define-a-new-product-c.txt`.**

**Visual direction to preserve (do not drift):**
- **Geist Sans / Geist Mono** only, wired through `next/font` (DESIGN.md §3).
- Neutral ink-on-near-white palette; **one warm red brand** (`--brand #E4130E`, reserved for brand/active/error) and **forest-green capture** (`--capture #477E23`, reserved for capture/drop, approval, and success). No other colour (DESIGN.md §2).
- English, sentence-case, minimal labels; nouns for pages, verbs for actions (DESIGN.md §12).
- Flat surfaces, hairline separation, max-8px radii, one permitted menu-pop shadow (DESIGN.md §5–6).

---

## Phase overview

| Phase | Title | State |
|-------|-------|-------|
| 0 | Documentation & inventory | **Completed** (2026-07-22) |
| 1 | Shell & shared primitives | **Ready for Codex final approval and commit** (Stage C shell adoption + review corrections complete) |
| 2 | Library / item sweep | Deferred |
| 3 | Ask / Digest sweep | Deferred |
| 4 | Sources / Pipelines sweep | Deferred |
| 5 | Settings split | Deferred |

Only Phase 0 and Phase 1 are specified in detail. Phases 2–5 are named so the shape is visible; each phase's scope is fixed only when the prior phase lands, not now.

---

## Phase 0 — Documentation & inventory ✅ completed 2026-07-22

**Delivered:**
- [`DESIGN.md`](../DESIGN.md) — canonical, enforceable design contract (palette/tokens, typography, spacing, radii, elevation, icons, motion, a11y, responsive shell, component rules, copy, anti-patterns, known tensions).
- This plan document.

**Read / inspected (targeted excerpts only):** `DESIGN.md`, git status, `app/sidebar.tsx`, `app/p/[slug]/layout.tsx`. Larger design docs (AGENTS.md, CLAUDE.md, architecture-v2.md, ui-layout-v2.md, the HTML wireframe) were deliberately **not** re-read this stage; their relevant decisions are pinned in DESIGN.md.

### Current implementation inventory

**Shell (`app/sidebar.tsx`, `app/p/[slug]/layout.tsx`):**
- **Desktop sidebar:** fixed left rail `w-[280px]`, `border-r border-line`, `h-[100dvh]`, `px-5 py-6`.
- **Main content offset:** `main` uses `md:ml-[280px] md:pt-0` on desktop.
- **Mobile drawer:** fixed `h-14` top bar (logo, active project name, menu trigger) with `md:hidden`; main content `pt-14` on mobile; the same rail slides in as a drawer via `transition-transform duration-200`, backdrop dims, focus trapped, `inert`/`aria-hidden` when closed, Escape restores focus. **This a11y behaviour already meets the bar and is preserved as-is.**
- **Project switcher:** button showing the active project, opening a popup (`shadow-[0_8px_32px_-12px_rgba(0,0,0,0.18)]` — the one sanctioned shadow) listing `projects` and an inline "+ new project" create form. Carries a `font-mono text-[10px] uppercase tracking-…` "Project" eyebrow — the anti-pattern flagged in DESIGN.md §14.
- **Nav destinations present:** Ask (own workspace), Chat archive, Library, Topics, Sources, Pipelines. Per-segment counts via `CountFor` / `ProjectCounts`.
- **Capture:** a separate action (`openCapture`, dispatches the `trove:open-capture` CustomEvent), **not** a nav route.
- **Bottom block:** Settings link, then the account row (`user.fullName` / primary email) with **Log out**.

**Primitive layer:**
- **None exists.** No `app/components/`, no `app/ui/`, no `lib/ui/`. Every screen is bespoke inline JSX. Standing up the shared layer is the entire premise of Phase 1.

**Repeating inline patterns observed (become primitives):**
- Page skeleton: `mx-auto max-w-{4xl|5xl} px-6 md:px-10 …` frame + mono-uppercase eyebrow + `text-3xl md:text-4xl` h1 + optional subtitle + optional bordered action. → `PageFrame` + `PageHeader`.
- List rows: `<ul>` of `<li className="border-b border-line last:border-b-0">` wrapping a grid link with hover tint. → `DataList` / `DataRow`.
- Library tab pills (`?view=` all/review/trash): filled `bg-ink` active pill, `uppercase tracking-wider`. → `Tabs`.
- Status labels: `font-mono text-[10px] uppercase tracking-…`, colour by state. → `StatusIndicator`.
- Empty states: lowercase mono sentences. → `EmptyState` (plain sentence case).

**Anti-patterns already in the tree** (debt per DESIGN.md §13, remove on touch, do not copy): tracked-uppercase `text-[10px]` eyebrows (library, sources, sidebar project label), `text-3xl/4xl` page titles, whimsical structural copy.

---

## Phase 1 — Shell & shared primitives 🟢 Stage C complete, ready for Codex final approval and commit

**Goal:** stand up the shared primitive layer and adopt it in the shell only, with zero change to routes, data, auth, scoping, or behaviour. Broad screen migration is Phase 2+.

### 1a. Primitives to build

Location: `app/components/ui/` (flat, one file per primitive, named exports). All styling from DESIGN.md tokens/classes; no new tokens without a DESIGN.md change in the same commit. No new npm dependencies.

| Primitive | Responsibility | Replaces (inline pattern) |
|-----------|----------------|---------------------------|
| `PageFrame` | Centered column, gutters, vertical rhythm (`mx-auto max-w-4xl/5xl px-6 md:px-10 py-…`), `maxWidth` prop | the `<section className="mx-auto max-w-…">` wrapper |
| `PageHeader` | Title (24px `text-2xl` → 28–32px `md:text-[30px]`, `font-medium`, normal tracking; no `tracking-tight`), optional description, optional trailing action slot | eyebrow + `h1` + subtitle + action |
| `SectionHeader` | `text-base font-medium` section label + optional action | inline section headings |
| `Button` | Primary (`bg-ink text-canvas`) / secondary (hairline) / destructive (`text-brand`, no fill), `rounded-lg px-4 py-2 text-sm font-medium`, disabled state | bespoke inline `<Link>`/`<button>` |
| `IconButton` | Square icon-only control, `aria-label` required, hover tint | inline icon buttons (menu, close) |
| `Tabs` | Inline text tabs, active=ink / inactive=ink-dim, `?view=` or state driven | library filled pills |
| `StatusIndicator` | Word + colour by state (active→ink-dim, paused→ink-ghost, approved/success→capture green, error→brand, review→brand count) | mono-uppercase status labels |
| `DataList` / `DataRow` | Hairline-separated list; row with fixed-width slots + hover tint | `<ul><li border-b>` + grid link |
| `EmptyState` | One plain sentence-case line + optional single action | lowercase mono empties |
| `InlineError` | Brand-coloured inline error text in a live region | scattered inline error text |
| `ConfirmDialog` | Focus-trapped confirm overlay, Escape closes + restores focus, primary/destructive | ad-hoc delete/confirm buttons |
| common form fields | `TextField`, `TextArea`, `Select`, `FieldLabel`, `FieldError` — label-above, hairline, single column, inline brand error | inline form markup |

### 1b. Shell adoption (this phase)

- **Sidebar nav order is frozen as:** Ask, Chat archive, Library, Topics, Sources, Pipelines.
  - **Capture** stays a separate action below the divider (keep the `trove:open-capture` CustomEvent dispatch), **not** a nav destination.
  - **Settings** and the account / log-out block sit at the bottom.
  - **Digest is excluded** from the sidebar. The `/p/[slug]/digest` route stays as-is; it is simply not linked from nav.
  - **Review and Trash remain Library views** (`?view=review` / `?view=trash`), not separate nav destinations.
- Refactor the sidebar to consume `Button` / `IconButton` and nav-item styling where it removes duplication, and **resolve the project-label anti-pattern** (DESIGN.md §14): restyle the `font-mono text-[10px] uppercase tracking-…` "Project" label to plain `text-xs text-ink-faint`, or drop it.
- Do **not** restructure the drawer / focus-trap / `inert` behaviour — it already meets the a11y bar. Preserve it exactly.

### 1c. Explicitly NOT in Phase 1

- Migrating any screen body (Library, Sources, Pipelines, Topics, Ask, Chat archive, Settings) onto the primitives — that is Phase 2+.
- Copy rewrites beyond the single sidebar label above.
- Capture form / overlay internals and dialogs beyond building the `ConfirmDialog` primitive.
- Any new dependency, route, query, or backend behaviour.

### 1d. Acceptance criteria (Phase 1 done when all true)

- [x] `app/components/ui/` exists with every primitive in 1a, each exported and typed, each using only DESIGN.md tokens/classes (no raw hex, no `text-[10px]`, no `text-3xl+`, no glass).
- [x] Sidebar renders from the frozen nav order and adopts `Button`/`IconButton` where applicable; project-label anti-pattern resolved.
- [x] Capture stays a separate action; Digest stays unlinked; Review/Trash stay Library views.
- [ ] No route, data query, auth, scoping, or dependency change. Sidebar drawer a11y (focus trap, Escape, `inert`, restore focus) unchanged — code-level behavior is unchanged, but the manual keyboard check has not been performed. See the documented browser gap in 1g.
- [x] `pnpm build` passes; `pnpm test` passes.
- [x] No new `.glass`/`backdrop-filter`, no nested cards, no shadows beyond the one menu-pop.
- [x] DESIGN.md and code agree; any deviation fixed in both in the same commit.
- [x] Primitives are typed and exported. Only `Button`/`IconButton` (and any other shell primitive the sidebar genuinely uses) have a real shell call site; primitives for the deferred page bodies may ship typed-but-unused. Do **not** add fake call sites.

**Note:** the manual signed-in drawer keyboard/visual check above remains unchecked — it could not be performed in-session because the in-app browser had no signed-in project/source data to exercise. See the visual validation gap documented in 1g for what was and wasn't verified in its place.

### 1e. Stage B instruction (for the next agent)

> **Build the primitives in `app/components/ui/` only.** Do **not** migrate any page/screen body onto them yet (that is Phase 2+). Only `Button`/`IconButton` and any other primitives the shell genuinely uses need a real call site from the sidebar refactor in 1b; primitives built for deferred page bodies may ship typed and unused for now. **Do not commit** — leave the working tree for review. Keep the diff to the new `app/components/ui/` files plus the sidebar shell refactor. Update this doc's status line and handoff log when you finish. Never push, never deploy, never stage `.omx/` or the `2026-05-22-…txt` file.

### 1f. Stage C — shell adoption ✅ complete 2026-07-22

**Files:** `app/sidebar.tsx`, `app/globals.css`.

**Behavior changes (concise):**
- Nav remains semantic `Next` `Link`s and account/logout remains appropriate native markup; only the mobile menu/close controls use `IconButton`, and the project switcher's Create action uses `Button`. This is not a claim that all nav/account controls render through `Button`/`IconButton`.
- Project-label anti-pattern resolved: the `font-mono text-[10px] uppercase tracking-…` "Project" eyebrow is now plain `text-xs text-ink-faint`.
- Drawer focus-trap / `inert` / Escape-restore-focus behavior was **not** touched, per 1b.
- `app/globals.css`: root/`.font-display` letter-spacing neutralised to `0`, and a reduced-motion fallback was added; the legacy `.glass`/`.glass-soft` definitions were left untouched.

### 1g. Codex review corrections ✅ complete 2026-07-22

Applied on top of Stage C, no new files unless noted:
- **Tabs** — added keyboard support and `tabId`/`panelId` ARIA wiring (`aria-controls`/`id` pairing between tab and panel) on the button/state-driven branch.
- **DataRow** — enforced required accessible names on interactive rows and added a visible focus ring on the overlay control.
- **ConfirmDialog** — fixed initial focus and Cancel behavior when the destructive action is disabled, so focus no longer lands on a non-interactive control.
- **Button** — hardened the default `type` so it's always a safe, explicit `button`/`submit`/`reset` (no implicit form submission).
- **Mobile** — fixed short-viewport overflow in the drawer and centered the mobile top-bar grid to an equal 78px end column, not the shell background.
- **Lint** — replaced an empty interface flagged by lint with a type alias.
- **Tabs (responsive)** — added overflow handling so tabs degrade gracefully on narrow viewports instead of clipping.
- **Test harness** — added a descriptor-based Node 22 global patch/restore, not a pinned test runner.
- **New test file:** `tests/ui-primitives.test.ts` — four cases covering the corrected Tabs keyboard/ARIA behavior, DataRow accessible-name enforcement, and ConfirmDialog focus handling.

**Validation evidence (fresh, this session):**
- `pnpm exec tsc --noEmit` — **PASS**.
- `pnpm test` — **PASS**, 204/204.
- `pnpm lint` — **PASS**, 0 errors; 1 pre-existing/generated warning in `desktop/src-tauri/target` (Tauri build output, not source we own).
- `pnpm build` — **PASS**.

**Visual validation gap (only remaining review gap):** the in-app browser project/source list was empty in this session, so no screenshot or manual drawer-click test was possible. A local unauthenticated `curl` against `/p/inbox` reached the route and returned the expected inaccessible/404 state for a signed-out request — it did not exercise the signed-in UI. No Playwright or other new test dependency was added to work around this. The automated focus/keyboard tests in `tests/ui-primitives.test.ts` cover the new primitive behaviors in lieu of a manual browser pass.

**Prod / scope:** production database untouched, nothing pushed. `.omx/` and `2026-05-22-081046-…txt` remain untouched and untracked.

---

## Phases 2–5 — deferred (named, not scoped)

Scope is fixed only when the prior phase lands. Sketch only:

- **Phase 2 — Library / item sweep.** Migrate the Library list (incl. `?view=review` / `?view=trash`) and the item/detail views onto the primitives; replace tab pills with `Tabs` and `text-3xl/4xl` titles with `PageHeader`. One screen per commit.
- **Phase 3 — Ask / Digest sweep.** Ask workspace and the Digest screen onto the primitives (Digest stays route-only, unlinked from nav; swept when its screen is touched).
- **Phase 4 — Sources / Pipelines sweep.** Sources and Pipelines list/detail bodies onto primitives; new-source / new-pipeline forms and run/sync confirmations onto the form fields and `ConfirmDialog`.
- **Phase 5 — Settings split.** Break the Settings surface into its intended sections and migrate onto primitives; account/log-out block reconciled.

Each deferred phase inherits the same hard constraints, acceptance-criteria shape, and validation checklist as Phase 1.

---

## Validation checklist (run every phase before marking done)

- [ ] `pnpm build` clean.
- [ ] `pnpm test` clean.
- [ ] Grep touched files for anti-patterns: `text-3xl`, `text-4xl`, `text-[10px]`, `tracking-[0.2`, `backdrop-filter`, `glass`, hex literals in `className`.
- [ ] No change to DB queries, route handlers, middleware, dependencies, or project scoping.
- [ ] Keyboard + screen-reader spot check on any touched interactive/overlay.
- [ ] DESIGN.md still matches the code; both updated together if not.
- [ ] `.omx/` and `2026-05-22-081046-…txt` are neither staged nor committed.
- [ ] Diff is small and scoped to the active phase only.

---

## Changed-files log

One row per stage. Records exactly which files each stage created or modified, so the next agent can diff cleanly.

| Date | Agent | Stage | Files changed |
|------|-------|-------|---------------|
| 2026-07-22 | Claude | A (Phase 0 docs) | `DESIGN.md` (created), `docs/ui-sweep-plan-2026-07-22.md` (created/refined). No application code touched. Nothing committed. |
| 2026-07-22 | Claude | A (contract correction) | `docs/ui-sweep-plan-2026-07-22.md` — corrected Stage A contract: heading sizes, normal letter spacing, green success/approval, no fake call sites. No application code touched. Nothing committed. |
| 2026-07-22 | Claude | B1 (primitives foundation) | Created `app/components/ui/class-names.ts`, `app/components/ui/button.tsx`, `app/components/ui/icon-button.tsx`, `app/components/ui/status-indicator.tsx`, `app/components/ui/empty-state.tsx`, `app/components/ui/inline-error.tsx`, `app/components/ui/form-fields.tsx`, `app/components/ui/index.ts`. No sidebar or page changes, no call sites wired yet. Nothing committed. |
| 2026-07-22 | Claude | B2 (remaining primitives) | Created `app/components/ui/page-frame.tsx`, `app/components/ui/page-header.tsx`, `app/components/ui/section-header.tsx`, `app/components/ui/tabs.tsx`, `app/components/ui/data-list.tsx`, `app/components/ui/confirm-dialog.tsx`; updated `app/components/ui/index.ts` to export all six. No sidebar or page changes, no call sites wired. Nothing committed. |
| 2026-07-22 | Claude | B2 review correction | Edited `app/components/ui/tabs.tsx`, `app/components/ui/data-list.tsx`, `app/components/ui/button.tsx`, `app/components/ui/index.ts`. No sidebar or page changes, no call sites wired. Nothing committed. |
| 2026-07-22 | Claude | C (shell adoption) | Edited `app/sidebar.tsx`, `app/globals.css` to adopt `Button`/`IconButton` and resolve the project-label anti-pattern. Nothing committed. |
| 2026-07-22 | Claude | C review corrections | Edited `app/components/ui/tabs.tsx`, `app/components/ui/data-list.tsx`, `app/components/ui/confirm-dialog.tsx`, `app/components/ui/button.tsx`, `app/sidebar.tsx`, `app/globals.css` for Codex findings (Tabs keyboard/ARIA, DataRow accessible names + focus ring, ConfirmDialog focus, Button safe type, mobile short-viewport overflow + centered grid, lint type alias, responsive tab overflow, Node 22 test harness); created `tests/ui-primitives.test.ts` (4 cases). Nothing committed. |

**Final Phase 1 changed-file list (as of this handoff):** `DESIGN.md`, `docs/ui-sweep-plan-2026-07-22.md`, `app/globals.css`, `app/sidebar.tsx`, `app/components/ui/class-names.ts`, `app/components/ui/button.tsx`, `app/components/ui/icon-button.tsx`, `app/components/ui/status-indicator.tsx`, `app/components/ui/empty-state.tsx`, `app/components/ui/inline-error.tsx`, `app/components/ui/form-fields.tsx`, `app/components/ui/page-frame.tsx`, `app/components/ui/page-header.tsx`, `app/components/ui/section-header.tsx`, `app/components/ui/tabs.tsx`, `app/components/ui/data-list.tsx`, `app/components/ui/confirm-dialog.tsx`, `app/components/ui/index.ts`, `tests/ui-primitives.test.ts`. Untouched/untracked and out of scope: `.omx/`, `2026-05-22-081046-were-going-to-explore-and-define-a-new-product-c.txt`.

---

## Handoff log

| Date | Agent | Phase | What landed |
|------|-------|-------|-------------|
| 2026-07-22 | Claude | 0 | Created `DESIGN.md` and this plan. Inventory verified against `app/sidebar.tsx` and `app/p/[slug]/layout.tsx`. No app code touched, nothing committed. Marked Phase 0 **Completed** and Phase 1 **Ready for Stage B**. |
| 2026-07-22 | Claude | B1 | Built the foundational `app/components/ui/` primitives only (`cx`, `Button`, `IconButton`, `StatusIndicator`, `EmptyState`, `InlineError`, `FieldLabel`/`FieldError`/`TextField`/`TextArea`/`Select`) plus a barrel `index.ts`. All typed named exports, DESIGN.md tokens only (no hex, no glass, no nested cards, max `rounded-lg`), no new dependency. Sidebar and pages untouched — no call sites wired yet, none faked. `pnpm exec tsc --noEmit` could not be run in this session (Bash permission for that command was denied); next agent or the user should run it before Stage B2 relies on these types. Nothing staged, nothing committed. Marked Stage B1 **Completed**, Phase 1 **Ready for Stage B2** (sidebar adoption). |
| 2026-07-22 | Claude | B2 | Built the remaining `app/components/ui/` primitives: `PageFrame` (maxWidth `4xl`/`5xl`, `mx-auto` gutters `px-6 md:px-10`, shell-safe `pt-16 pb-16 gap-8`), `PageHeader` (title `text-2xl md:text-[30px] font-medium`, normal tracking, no eyebrow, optional description + action slot, wraps to a column below `sm` to avoid overlap), `SectionHeader` (`text-base font-medium` + optional action), `Tabs` (inline text tabs; renders `nav`+`Link` with `aria-current="page"` when items carry `href`, or `role="tablist"`+`button role="tab" aria-selected` when driven by `onSelect`; active border-`ink`/inactive `ink-dim`, no filled pills, no uppercase), `DataList`/`DataRow` (`role="list"`/`listitem"`, `divide-y divide-line` hairline rows, fixed leading/trailing slots, interactive rows use a stretched absolute overlay `Link` or `button` so the row is clickable without nesting an interactive element inside another), and `ConfirmDialog` (client component; `role="alertdialog"`, `aria-labelledby`/`aria-describedby`, initial focus on the confirm button, `trapFocus` from `app/focus-trap.ts` on Tab, `Escape`/backdrop click call `onCancel`, previous focus restored on close, `document.body.style.overflow` locked while open, `Button`/`IconButton` with Carbon `Close`, `destructive` prop maps to the existing text-only destructive `Button` variant, single hairline `bg-paper` panel — no blur/shadow/nested card). Updated `app/components/ui/index.ts` to export all six (values + types). No sidebar or page changes; no call sites wired — these are typed-but-unused per the Stage B instruction, not faked. `pnpm exec tsc --noEmit` / `pnpm build` were not run in this session (headless Bash approval unavailable); Codex will typecheck next. Nothing staged, nothing committed. Marked Stage B2 **Completed**, Phase 1 **Ready for Stage C** (shell adoption). |

| 2026-07-22 | Claude | B2 review correction | Fixed three review findings against the B2 primitives, no new files, nothing committed: **(1) Tabs** — split `TabItem` into a discriminated union (`LinkTabItem`/`ButtonTabItem`) and `TabsProps` into `LinkTabsProps` (`items: LinkTabItem[]`, `onSelect?: never`) / `ButtonTabsProps` (`items: ButtonTabItem[]`, `onSelect` required), so mixed href/button items can no longer type-check and link items are never silently defaulted to `href="#"`; added standard roving-tabindex keyboard nav to the button/state-driven branch (`ArrowLeft`/`ArrowRight` wrap-around move + activate, `Home`/`End` jump to first/last), leaving the link-driven `nav`/`Link` branch as plain browser navigation. **(2) DataRow** — replaced the single `href?`/`onSelect?`/`selectLabel?` prop set with a discriminated union (`StaticDataRowProps` with all three forbidden, `LinkDataRowProps` with `href` + required `selectLabel`, `ButtonDataRowProps` with `onSelect` + required `selectLabel`), so an interactive row can no longer omit `selectLabel` and the overlay can no longer end up with no accessible name; the no-invalid-nested-interactivity overlay pattern (`absolute inset-0` `Link`/`button`, visible content outside it) is unchanged. **(3) Button** — added a `type = "button"` default so it's never an implicit submit inside a `<form>`, while `type="submit"`/`type="reset"` remain valid explicit overrides via the existing `ButtonHTMLAttributes`. Updated `app/components/ui/index.ts` to export the new `LinkTabItem`/`ButtonTabItem`/`LinkTabsProps`/`ButtonTabsProps` types (`TabItem`/`TabsProps`/`DataRowProps` names unchanged, now unions). No sidebar or page call sites, no DESIGN.md changes, no new dependencies. `pnpm build`/`pnpm exec tsc --noEmit` not run this session (Bash approval unavailable for that command); next agent should run it before Stage C relies on these types. Nothing staged, nothing committed. Stage B2 remains **Completed**, Phase 1 remains **Ready for Stage C** (shell adoption). |

_Add a row here and to the changed-files log when you finish a stage. Update the status line at the top before you start writing._

**Build-fix note (2026-07-22, Claude):** `tabs.tsx` build failure — custom `onSelect` was left in `...rest` and spread onto `<nav>`, colliding with DOM `onSelect`. Fixed by destructuring `onSelect` out before `rest` and using it only in the button branch; added `"use client"` (uses `useRef`/keyboard handlers). Not committed; Codex to rerun build.

| 2026-07-22 | Claude | C | Adopted the primitives in the shell (`app/sidebar.tsx`, `app/globals.css`): nav remains semantic `Next` `Link`s and account/logout remains appropriate native markup; only the mobile menu/close controls use `IconButton`, and the project switcher's Create action uses `Button` — not all nav/account controls. Frozen nav order and Capture/Digest/Review/Trash placement unchanged, project-label anti-pattern resolved to `text-xs text-ink-faint`, drawer focus-trap/`inert`/Escape behavior preserved exactly. `app/globals.css`: root/`.font-display` letter-spacing neutralised to `0` and a reduced-motion fallback added; legacy `.glass`/`.glass-soft` definitions left untouched. Then applied Codex's review corrections on top: Tabs keyboard nav plus `tabId`/`panelId` ARIA wiring; DataRow required accessible names and a visible focus ring; ConfirmDialog focus fix for the disabled/destructive Cancel case; `Button` safe default `type`; mobile short-viewport overflow fix and an equal 78px end-column mobile top-bar grid (not the shell background); an empty interface flagged by lint replaced with a type alias; responsive tab overflow handling; a descriptor-based Node 22 global patch/restore in the test harness (not a pinned test runner). Added `tests/ui-primitives.test.ts` (4 cases) covering the corrected Tabs/DataRow/ConfirmDialog behavior. Fresh validation this session: `pnpm exec tsc --noEmit` PASS, `pnpm test` PASS 204/204, `pnpm lint` PASS (0 errors, 1 pre-existing/generated warning under `desktop/src-tauri/target`), `pnpm build` PASS. Visual gap: the in-app browser project list was empty, so no screenshot/manual drawer click test was possible; an unauthenticated local `curl` to `/p/inbox` reached the expected inaccessible/404 state without a signed-in session; no Playwright or other dependency was added — this is the only remaining review gap, covered otherwise by the new automated tests. The manual signed-in drawer keyboard/visual check in the acceptance checklist is left unchecked for this reason. Prod untouched, nothing pushed, `.omx/` and the 2026-05-22 txt file untouched/untracked. Nothing committed — no commit hash exists yet. Marked Stage C **Completed**, Phase 1 **Ready for Codex final approval and commit**. Phase 2+ remains deferred. |
