# base-ds adoption — Trove

Record of adopting the base-ds design system into Trove. Scenario 2, existing
project with a design worth keeping.

## Phase 1 — install (done, 2026-07-24)

- Ran `../base-ds/scripts/adopt.sh` against this repo. Non-destructive, zero conflicts.
- Copied `tokens/`, `design-rules/RULES.md`, three skills, `scripts/design-check.mjs`,
  `scripts/contrast-check.mjs`, `tools/generate-scales.mjs`.
- Added npm scripts `design-check`, `contrast-check`, `verify-scales`.
- Appended a marked base-ds section to `CLAUDE.md` and `AGENTS.md`.
- Installed check deps with pnpm: `apca-w3`, `colorparsley`, `culori` (`typescript` already present).
- Wired the token layer into `app/globals.css`, order primitives -> semantic -> theme.
- Verified: `globals.css` compiles through Trove's own Tailwind pipeline.

Note on cascade: the token files are unlayered `:root` rules, so they win over
Trove's `@theme` layer for any colliding name. The only collisions are
`--color-canvas` (sub-perceptible shift) and `--font-sans` (Phase 2 restores Geist).
`semantic.css` also adds a global `:focus-visible` ring; Trove previously had
`outline: none` on inputs. That ring is new and intentional (a11y).

## Phase 2 — audit (done, 2026-07-24)

### theme.css (filled)

Trove is a red-forward, near-monochrome brand on warm-neutral surfaces,
Geist sans + mono. One red accent. Capture green retired into status-success.

- Brand red `#E4130E` -> `oklch(0.582 0.232 29.1)`. White text on it is APCA |Lc| 76.
- Light mode brand pairs: all pass.
- Dark mode: Trove is light-only today. Dark brand is a soft light red
  `oklch(0.88 0.09 29.1)` with dark text, the standard way to keep a saturated
  brand readable on dark surfaces. Values exist only so the APCA matrix verifies.

### APCA result

- `npm run contrast-check`: all 46 rendered brand pairs pass (light + dark).
- `npm run verify-scales`: all 114 base pairs pass.
- Pairings that fail a RULES.md tier: none.

### Surfaces / type / spacing comparison (for Phase 3)

| Aspect | Trove now | base-ds | Verdict |
|---|---|---|---|
| canvas | `#FCFCFC` L0.99 neutral | gray-50 L0.985 hue260 c0.005 | imperceptible, lossless |
| paper/surface | `#FFFFFF` L1.0 | white L1.0 | match |
| canvas-deep | `#F4F4F3` L0.967 | surface-sunken L0.967 | match |
| primary text | ink `#111` L0.178 | gray-950 L0.137 | base-ds slightly higher contrast |
| radii | Tailwind defaults | sm6 / md8 / lg12 | minor remap in Phase 3 |
| spacing | 4px scale | 4px scale | match |

Surfaces are effectively neutral in both systems (base-ds chroma 0.005 is
near-zero), so migrating Trove views onto `--color-*` is essentially lossless.

### Rule-violation preview (Phase 3 work, not fixed here)

- `text-xs` (sub-14px, violates N2): 65 occurrences across views. Largest chunk.
- `uppercase` (violates N1): 5 occurrences.
- Inline color literals in tsx: only 3 lines. Colors are already mostly tokenized.

### Flags to resolve before Phase 3

1. **No root `components/ui`.** `adopt.sh` does not copy the component library.
   Trove keeps its own components under `app/components/ui/` (tabs, status-indicator, ...).
   base-ds ships 9: alert, badge, button, card, dialog, empty-state, form-field,
   skeleton, table. Decide: bring base-ds components in, or migrate Trove's
   existing ones onto base-ds patterns. This is the Phase 3 setup decision.
2. **Brand red ≈ danger red.** Brand hue 29 sits next to the system's error hue 25.
   Primary and destructive buttons will look nearly identical. Tokens are separate
   (`--color-primary` vs `--color-status-error`), so it is a distinguishability
   concern, not a contrast one. Lean on shape/label/icon, not color alone.
3. **Capture green.** Retired into status-success for approve/success. The
   capture/drop-zone affordance still uses green today; that is a component
   decision for Phase 3 (keep as a functional one-off, or restyle).

## Phase 3 — migration (in progress, 2026-07-24)

Confirmed with Henrik (gate 2 batch):
- **Primary button = ink**, not red. `theme.css` now: `--brand-primary` ink
  (#111, lightening hover to #444), `--brand-accent` red #E4130E. Red is accent
  and brand only, never a filled button surface. contrast-check green.
- **StatusIndicator**: keep the light coloured-text label (rebuilt on tokens),
  not a filled Badge.
- **Select**: Radix Select (new dep `@radix-ui/react-select`).
- **Tabs / AlertDialog / DataList**: keep existing Trove APIs, rebuild on the
  base-ds pattern (Tabs on Radix Tabs, AlertDialog on Radix AlertDialog with
  ConfirmDialog's API, DataList/DataRow retokened).

Foundation: base-ds nine + `lib/cn.ts` + `components/icons.ts` in root
`components/ui/`, zero new violations. Deps added: radix slot/dialog/select,
cva, clsx, tailwind-merge.

New components to build in root components/ui: status-indicator, data-list,
tabs, alert-dialog, select. Then migrate 29 views, retire `app/components/ui`.

## Phase 3 — complete (2026-07-24)

All 29 views migrated onto root `components/ui`; `app/components/ui` deleted.

- **theme.css**: ink primary (#111, lightening hover), red accent #E4130E, Geist. 46 brand pairs pass APCA.
- **New components** (root `components/ui`): status-indicator, data-list, tabs,
  alert-dialog (Radix AlertDialog, ConfirmDialog API), select (Radix). Plus
  base-ds-backed adapters (icon-button, form-controls, inline-error, compact
  empty-state) and layout (page-frame/header/section-header), all on tokens.
- **Views**: import path swapped to `@/components/ui`; ~410 legacy colour
  utilities remapped to `var(--color-*)`; text-xs and sub-14px sizes → 14px;
  uppercase / wide-tracking / em-dashes removed; outline suppression dropped so
  the global :focus-visible ring shows.
- **globals.css**: legacy hex `:root` + `@theme inline` colours removed; only
  fonts mapped; base rules retokened; unused glass/hairline/aurora helpers gone.
- **Gates**: design-check PASS, contrast-check PASS, verify-scales PASS,
  tsc 0 errors, 220/220 tests, production build OK.

### Deviations / things to eyeball in review
1. **Primary buttons** now use base-ds default size (44px min touch target, A3),
   slightly taller than before.
2. **Destructive buttons** (base-ds `destructive`) render as filled red, where
   Trove previously used ghost red text. Confirm dialogs use filled red confirm.
3. **Tabs** kept Trove's manual roving-tabindex implementation (retokened), not
   Radix Tabs — Radix's coupled Root/List/Content cannot model link-nav tabs or
   externally-rendered panels.
4. **StatusIndicator** `review` shares the error red (as before); reds use the
   darker --color-status-*-text so labels clear the 75 APCA tier.
5. **email.ts** exempted in design-check (email HTML cannot use CSS vars / rem).
6. **Translucent canvas** utilities (bg-canvas/70 etc.) kept their opacity via
   arbitrary values; verify sticky headers still read right.
