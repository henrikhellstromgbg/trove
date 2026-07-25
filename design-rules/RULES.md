# Design rules

Single source of truth for all design rules. CLAUDE.md, AGENTS.md, and all
skills reference this file. Edit here, nowhere else.

Tags: `[lint]` = machine-enforced by `npm run design-check`. Untagged rules
are enforced by review (design-review skill).

How to add a rule: append one line to the correct section with the next
number. Done. It is immediately active in Claude Code, Codex, and reviews.

## Never

- N1: Never use `text-transform: uppercase` or the `uppercase` class, anywhere, including eyebrows, labels, buttons, and table headers `[lint]`
- N2: Never use font sizes below 14px. `text-xs` and arbitrary values like `text-[11px]` are banned `[lint]`
- N3: Never use em-dashes or en-dashes in UI copy or content. Use commas, colons, or rewrite `[lint]`
- N4: Never invent color values. No hex, rgb(), hsl(), oklch(), oklab(), color(), and no Tailwind palette utilities (text-white, bg-red-500, etc) in components or views. Semantic tokens only (`--color-*`) `[lint]`
- N5: Never create new components inside views/pages. Components live in `components/ui/` only. Missing something? See P1
- N6: Never use letter-spacing above 0 except `--tracking-tight` on headings `[lint]`
- N7: Never remove focus outlines without an equal or better replacement. `outline-none` without `focus-visible:` styling is banned `[lint]`
- N8: Never use placeholder text as a label. Every input has a visible `<Label>`
- N9: Never rely on color alone to convey state. Error/warning/success always pair color with icon and/or text
- N10: Never use `title` case in UI copy. Sentence case everywhere: buttons, headings, labels, menu items
- N11: Never use corporate filler copy ("Empower your workflow", "Seamlessly manage"). Plain verbs, specific nouns
- N12: Never add animation without checking `prefers-reduced-motion` (handled globally in semantic.css, do not add JS-driven animation that bypasses it)
- N13: Never use icons from any library except `@carbon/icons-react` `[lint]`
- N14: Never use `z-index` values outside the `--z-*` scale `[lint]`

## Always

- A1: Always sentence case in all UI copy, including buttons and headings
- A2: Always use semantic tokens for every color, spacing, radius, shadow, and motion value
- A3: Always give interactive elements a minimum 44x44px touch target (`--touch-target-min`)
- A4: Always connect inputs to labels (`htmlFor`/`id`) and errors via `aria-describedby` (FormField handles this, use it)
- A5: Always give icon-only buttons an `aria-label`
- A6: Always implement all states for interactive components: hover, focus-visible, active, disabled, and where relevant loading, error, empty
- A7: Always use existing components from `components/ui/`. Compose before creating
- A8: Always use `--duration-*` and `--ease-*` tokens for transitions
- A9: Always verify APCA contrast when introducing a new color pairing: `npm run contrast-check` (thresholds: Lc 90 primary text, 75 body text, 60 large/bold 24px+, 45 non-text UI)
- A10: Always name actions by what they do: "Save changes", not "Submit". Same verb through the whole flow (button "Publish" leads to toast "Published")
- A11: Always write error messages that say what went wrong and how to fix it. No apologies, no vagueness
- A12: Always support keyboard navigation: dialogs trap focus and return it on close, menus use arrow keys (Radix handles this, do not fight it)
- A13: Always use text-primary or text-secondary on hover/active surfaces. text-tertiary is meta-tier (hints, timestamps, placeholders) and only on static surfaces, never for body copy

## Process

- P1: Missing a component, token, or pattern? Stop. Ask the human. Do not improvise a one-off
- P2: New components go through the new-component skill: check composability first, build in `components/ui/`, add to examples, sync back to base-ds if generally useful
- P3: Before marking any view as done, run the design-review skill checklist and `npm run design-check`
- P4: Views are built ONLY from `components/ui/` plus layout primitives (div/flex/grid with token-based spacing)
