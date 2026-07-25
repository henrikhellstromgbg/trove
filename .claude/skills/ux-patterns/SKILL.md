---
name: ux-patterns
description: Decision rules for interaction form. Consult BEFORE building any new view, flow, or overlay, and before adding any form. Answers one question: what shape should this interaction take (page, modal, drawer, popover, inline), and which control fits the data. Does not cover visual styling (RULES.md), component construction (new-component), or contrast (checks).
---

# UX patterns

Rules for choosing the *form* of an interaction. The design decisions are
already made. Do not invent new patterns. If no rule covers the case, stop
and ask.

## U1. Surface choice: page, modal, drawer, sidepanel, popover

Walk top to bottom, first match wins.

- Destructive or irreversible action → **AlertDialog**. Never a bare
  button, never a toast-with-undo as the only guard.
- Blocking decision, needs immediate attention, nothing else may proceed
  → **Dialog (modal)**. This is the only justified full interruption.
- Task is complex: more than ~5 fields, multi-step, or deserves a URL
  (shareable, bookmarkable, a place the user returns to) → **own page**.
- User needs to see or reference the underlying screen while acting
  (compare, copy, keep context) → **drawer/sidepanel**, no backdrop.
- Details of a single list/table item, dense content → **sidepanel**
  (desktop) / **drawer** (mobile).
- Details of a single element, light content → **popover** (desktop) /
  **drawer** (mobile).
- Short self-contained task with a clear end (create one thing, rename,
  quick edit) → **Dialog (modal)**, max one level deep. A modal never
  opens another modal.
- Default when unsure → prefer the non-blocking option. Modals slow
  users down; that is their purpose. Use them to prevent mistakes, not
  for convenience.

## U2. Control choice by data

- Fewer than 5 fixed options → radio group or segmented control, not a
  select. The options should be visible without a click.
- 5+ options → select; with many options where the user knows the target
  (country, timezone) → combobox with type-ahead.
- Two states meaning on/off or yes/no → switch, not a select, not two
  radios.
- Numeric with a small sensible range → stepper; free numeric → input;
  bounded range where the exact value matters less than the position
  → slider.
- If typing is faster than picking (dates, expiry, search) → input with
  format hint, not cascading selects.

## U3. Action hierarchy

- Exactly one primary (filled) action per view or dialog. Everything
  else is secondary (outlined) or tertiary (text/ghost).
- Destructive confirm buttons are filled destructive, paired with a
  neutral cancel. Never two filled buttons side by side.
- Icon-only buttons require aria-label (A-rules) and are tertiary by
  default; they never carry the primary action of a view.

## U4. Error and message placement

- Field validation error → inline under the field, tied via
  aria-describedby. On submit with multiple errors → summary banner at
  top plus inline messages; focus moves to the summary.
- Page-level problem, user can continue → inline alert/banner in the
  content flow.
- Transient system event, no action needed → toast. Never put errors
  the user must act on in a toast.
- Blocking system state (update required, session ended) → modal.
- Empty collection → EmptyState component with one clear next action,
  never a blank surface.

## U5. Forms

- Label: short noun phrase, always visible. Sentence case (C-rules).
- Instructions and format hints live in the description slot under the
  label, permanently visible, linked via aria-describedby.
- Placeholder is never the only carrier of information needed to fill
  the field. Purely illustrative examples are allowed but optional by
  definition.
- Optional fields are marked "optional" in the label; required is the
  default and unmarked.
- One column. Group related fields with a group heading, not with
  layout tricks.

## U6. Creation and selection never mix

- A select/dropdown selects from an existing set. A creation flow never
  lives inside it. "New X" may appear as the last item, but it opens a
  Dialog or navigates to a page.
- Same for edit: editing an entity happens in a dialog or on a page,
  not inline inside the picker that chose it.

## Sources

Distilled from: Smashing Magazine "Modal vs. Separate Page: UX Decision
Tree" (Vitaly Friedman, 2026) and Ryan Neufeld's modal-vs-page framework;
Doctolib design system decision trees (overlay choice, error components);
Tess Gadd's dropdown UI cheatsheet; GOV.UK Design System patterns; NN/g
guidance on dialogs, placeholders, and confirmation; Carbon and Atlassian
message hierarchies. Rules are the distillate; consult sources only when
changing the rules, not when applying them.
