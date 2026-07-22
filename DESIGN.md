# DESIGN.md — Trove design contract

Canonical, enforceable description of Trove's visual direction. Pinned from Henrik's Figma sketches (2026-07-20, "Clean Geist direction"). The authoritative source of truth for tokens is `app/globals.css`; this document explains and constrains their use. When code and this contract disagree, fix both in the same round (AGENTS.md).

This is a contract, not a mood board. Every rule here is meant to be checkable in a diff.

---

## 1. Principles

- Quiet, editorial, dense. Content is the interface; chrome recedes.
- One warm red accent. Everything else is ink on near-white paper.
- Flat surfaces separated by hairlines, not shadows, gradients or glass.
- Restraint over decoration. If an element does not carry information or an action, it does not exist.

---

## 2. Palette / tokens

Defined in `app/globals.css` under `:root` and mapped to Tailwind via `@theme inline`. Use the token, never a raw hex, in application code.

| Token | Value | Tailwind class | Use |
|-------|-------|----------------|-----|
| `--canvas` | `#FCFCFC` | `bg-canvas` | App background |
| `--canvas-deep` | `#F4F4F3` | `bg-canvas-deep` | Recessed wells, subtle fills |
| `--paper` | `#FFFFFF` | `bg-paper` | Raised surfaces (cards, menus, inputs) |
| `--ink` | `#111111` | `text-ink` | Primary text, solid buttons |
| `--ink-dim` | `#444444` | `text-ink-dim` | Secondary text |
| `--ink-faint` | `#666666` | `text-ink-faint` | Tertiary text, metadata |
| `--ink-ghost` | `#A3A3A3` | `text-ink-ghost` | Disabled, placeholder-weight |
| `--silver` | `#666666` | `text-silver` | Alias of ink-faint |
| `--brand` | `#E4130E` | `text-brand` / `bg-brand` | Warm red: logo, active project, alert counts, error state |
| `--capture` | `#477E23` | `text-capture` | Forest green: capture / drop, approval, success states |
| `--ember` | `#E4130E` | `text-ember` | Legacy alias of brand; do not use in new code |
| `--line` | `rgba(0,0,0,0.08)` | `border-line` | Default hairline |
| `--line-strong` | `rgba(0,0,0,0.14)` | `border-line-strong` | Emphasised hairline, hover borders |

Colour rules:
- **Brand red is reserved.** Logo, active project marker, alert/error counts, error text. Not a general accent, never a large fill, never body text.
- **Capture green is reserved** for capture/drop, approval, and success states. Not a general accent, and never a large fill.
- Selection is `rgba(228,19,14,0.14)` (brand at 14%) — already global, do not override.
- No other colours. No blues, no status rainbow. Active reads as ink-dim; paused reads as ink-ghost; approval/success read as capture green; error reads as brand.

---

## 3. Typography

Two families only, both wired through `next/font`:
- **Geist Sans** — `--font-sans` / `--font-display` (`font-display` utility). Everything.
- **Geist Mono** — `--font-mono` (`font-mono` utility). Counts, numbers, short machine-ish labels only.

Target letter-spacing is **normal (`0`)** at every size — do not add `tracking-tight` or other negative tracking, globally or per element. Global settings to keep: `font-feature-settings: "ss01","ss02"`, antialiased. `.font-display` keeps `font-weight:400`. Phase 1 neutralised both root and `.font-display` letter-spacing to `0`; there is no outstanding negative-tracking debt in `app/globals.css`.

Type scale (target after the sweep):
- Page title: **24px** (`text-2xl`) on mobile → **28–32px** on `md` (e.g. `md:text-[30px]`), `font-medium`, normal tracking. **Not** 20/24px, and **not** `text-4xl` or larger.
- Section title: `text-base font-medium`.
- Body: `text-sm` / `text-[15px]` at `text-ink` or `text-ink-dim`.
- Metadata / counts: `text-xs` or mono `text-xs`, `text-ink-faint`.
- Minimum readable size in normal flow: `text-xs` (12px). `text-[10px]` is disallowed for new work (see anti-patterns).

Weights: `400` and `500` (`font-medium`) only. No bold, no light.

---

## 4. Spacing

8px base rhythm. Prefer Tailwind steps `1, 1.5, 2, 3, 4, 6, 8` (4–32px). Section gaps `gap-6`/`gap-8`. Page gutters `px-6 md:px-10`. Do not invent arbitrary spacing (`px-[13px]`) when a scale step fits.

Content width: reading/list pages cap at `max-w-4xl`; wide tables at `max-w-5xl`. Center with `mx-auto`.

---

## 5. Radii

- Ordinary corners: **max 8px** (`rounded-lg` = 8px, `rounded-md` = 6px, `rounded` = 4px).
- Pills / fully round: `rounded-full` for avatars, dots, small toggles only.
- No superellipse / squircle. No `12.5px` or other bespoke radii (that is the wireframe tool's chrome, not ours).

---

## 6. Elevation & surfaces

- Separation is by **hairline** (`border-line`, `border-line-strong`), not shadow.
- One shadow is permitted: the project-switcher / menu pop, `shadow-[0_8px_32px_-12px_rgba(0,0,0,0.18)]`. Do not add others.
- Fills: `bg-paper` for raised, `bg-canvas-deep` for recessed, `bg-ink/[0.03]`–`bg-ink/[0.05]` for hover/active tints.
- **No glass.** `.glass` / `.glass-soft` exist in globals.css as legacy and are frozen — no new call sites, remove on touch.

---

## 7. Icons

- **Carbon (`@carbon/icons-react`) only.** No emoji, no other icon set, no inline decorative SVG except the one existing account glyph.
- Default size `18` in nav/rows, `16` in dense controls, `20` in the mobile bar. `className="shrink-0"`; colour via `text-ink-dim` (default) or `text-ink` (active).
- Icons in repeating rows sit in fixed-width slots (`shrink-0`); never rely on `gap` alone to align columns.

---

## 8. Motion

- Duration **120–180ms**. Existing shell uses `duration-200` (transform) and motion/react `0.18`; keep within band, prefer 150ms for new work.
- Animate `opacity` and `transform` only. No animated `width`/`height`/`top` for layout.
- Easing: default ease / ease-out. Nothing bouncy.
- **Reduced motion:** honour `prefers-reduced-motion`. Motion is enhancement; every state must be reachable and legible with animation disabled. New animated components gate non-essential motion behind the query.

---

## 9. Accessibility

- Contrast: body text meets WCAG AA on canvas/paper. `ink-ghost` is for non-essential/disabled only, never for text that must be read.
- Every interactive element is a real `button`/`a`/input, keyboard reachable, with a visible focus state and an accessible name (`aria-label` on icon-only controls).
- Overlays/drawers: focus trap on open (see `app/focus-trap.ts`), Escape closes and restores focus to the trigger, `inert` + `aria-hidden` when hidden. The sidebar already does this — match it.
- Live regions for async status (sync/run results, inline errors) so changes are announced.
- Target ≥ 44px effective hit area on touch.

---

## 10. Responsive shell

- Two breakpoints matter: base (mobile) and `md` (≥768px).
- **Desktop (`md`):** fixed 280px left sidebar (`w-[280px] border-r border-line`), main content offset `md:ml-[280px]`.
- **Mobile:** sidebar becomes a drawer; fixed `h-14` top bar with logo, project name, menu trigger. Main content `pt-14`. Drawer slides via `transition-transform`, backdrop dims, focus trapped.
- Content columns cap at `max-w-4xl`/`max-w-5xl` regardless of viewport.

---

## 11. Component rules

Until Phase 1 lands the shared primitives, screens are bespoke; after, they compose from `PageFrame, PageHeader, SectionHeader, Button, IconButton, Tabs, StatusIndicator, DataList/DataRow, EmptyState, InlineError, ConfirmDialog` and common form fields. Rules that hold either way:

- **Buttons:** two weights. Primary = `bg-ink text-canvas`; secondary = `border border-line-strong bg-paper text-ink hover:border-ink`. Both `rounded-lg px-4 py-2 text-sm font-medium`. Destructive uses text/`text-brand`, never a red fill. No third button style.
- **Lists over cards.** Default to hairline-separated rows (`border-b border-line last:border-b-0`), not boxed cards. A "card" is at most one hairline border + `bg-paper`; never nest one card inside another.
- **Tabs:** inline text tabs; active is ink, inactive is ink-dim. (The current library pills — filled `bg-ink` pills with `uppercase tracking-wider` — are legacy and get replaced by the `Tabs` primitive.)
- **Status:** word + colour, no badge chrome by default. active→ink-dim, paused→ink-ghost, approved/success→capture green, error→brand, review-pending→brand count.
- **Empty states:** one line of plain sentence-case text, optionally one action. Dashed-border empty blocks are acceptable but must stay quiet (`border-line`, ink-dim text). No illustrations.
- **Forms:** label above field; field is `bg-paper` or transparent with a hairline; one column; inline error text in brand below the field.
- **Counts:** mono, `fmt()` with `sv-SE` space thousands separator (already in the sidebar). Keep that one helper.

---

## 12. Copy

English, sentence case, minimal and plain. Trove's audience is designers/operators, not "normal people" — say what a thing is.

- Labels are nouns: "Sources", "Library", "Pipelines". Actions are verbs: "New source", "Run now", "Delete".
- **No whimsy in structural copy.** Page titles name the page. Replace lines like "Everything you kept." / "What keeps filling it." / "nothing feeding in yet." with plain equivalents ("Library", "Sources", "No sources yet.") as screens are swept.
- One idea per line. No exclamation marks in chrome. No title case, ever.
- Follow Henrik's copy rules in the root CLAUDE.md: short sentences, no corporate softeners, no dashes (use a comma or rewrite), don't assume things about the user.

---

## 13. Anti-patterns (hard no)

These are forbidden in new and swept code. Existing instances are debt to remove, not precedent to copy.

1. **New glass.** No `backdrop-filter`, no `.glass`/`.glass-soft` on new elements.
2. **Nested cards.** No card inside a card; no bordered box inside a bordered box.
3. **Decorative containers.** No wrapper that exists only to add a border, tint or shadow around content that reads fine on canvas.
4. **Giant headings.** No `text-4xl` (or larger) page titles. Page titles top out at 32px on desktop, 24px (`text-2xl`) on mobile.
5. **Tracked uppercase metadata.** No `uppercase tracking-[0.2em+]` eyebrow labels, and no `text-[10px]` micro-labels. The current `font-mono text-[10px] uppercase tracking-[0.28em]` eyebrows (library, sources, sidebar project label) are the canonical example of what to remove.
6. **Colour outside the system.** No hex literals in components, no palette beyond the tokens, brand red never used decoratively.
7. **Shadows for separation.** Use hairlines. The single menu-pop shadow is the only exception.
8. **Non-Carbon icons / emoji as UI.**
9. **Bouncy or layout-animating motion**, and any motion that ignores `prefers-reduced-motion`.

---

## 14. Known tensions to resolve during the sweep

- **Resolved in Phase 1:** the sidebar project label used the tracked-uppercase micro-label pattern (`font-mono text-[10px] uppercase tracking-[0.18em]`) that §13.5 forbids. It is now restyled to plain `text-xs text-ink-faint`.
- **Deferred:** Library tab pills and the `text-3xl/4xl` page titles across Library/Sources/etc. still violate §11 and §13.4; they remain scheduled for replacement by the `Tabs`/`PageHeader` primitives in a later phase.

---

_Maintained under the UI sweep. Changes to this contract go through the active plan doc in `docs/` and are made by one agent at a time._
