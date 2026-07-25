---
name: ux-patterns
description: "Decision rules for interaction form. Consult BEFORE building any new view, flow, or overlay, and before adding any form. Answers one question: what shape should this interaction take (page, modal, drawer, popover, inline), and which control fits the data. Does not cover visual styling (RULES.md), component construction (new-component), or contrast (checks)."
---

# UX patterns

Choose the interaction shape before writing markup. Use only components listed
in `components/ui/README.md`. Names in this skill are public exports; the
entrypoint map at the end resolves every name to a real file. If no rule covers
the case, stop and ask.

## U1. Surface choice

Walk top to bottom. First match wins.

- Destructive or irreversible confirmation: `AlertDialog`.
- Blocking decision that must interrupt all other work: `Dialog`.
- More than about five fields, a multi-step task, or a destination users return
  to, share, or bookmark: its own page with `PageFrame` and `PageHeader`.
- Dense details or editing that must preserve the underlying page: `Sheet` on
  desktop and `Drawer` on mobile.
- Light contextual details or controls: `Popover` on desktop and `Drawer`
  on mobile.
- Short self-contained task with one clear end: `Dialog`, one level deep.
- Supplementary preview available by hover and focus: `HoverCard`. Required
  information must remain visible without hover.
- Default: prefer the page or non-blocking surface. A modal exists to prevent
  mistakes, not to save layout space.

A modal never opens another modal. Close or complete the first task before
starting the second.

## U2. Control choice by data

- Fewer than five fixed choices: `RadioGroup`, or `ToggleGroup` when each
  short option works as a segmented control.
- Five or more fixed choices: `Select` or `NativeSelect`.
- Large known set where the user can name the target: `Combobox`.
- Independent boolean choice or row selection: `Checkbox`.
- Immediate on or off setting: `Switch`. Do not use it for a choice that
  still needs a Save action.
- Bounded numeric value where relative position matters: `Slider`.
- Exact or free numeric value: labelled `Input`.
- Date entered faster by typing: labelled `Input` with a permanent format
  hint. Date chosen spatially: `DatePicker` or `DateRangePicker`.
- Files: `FileUpload`, with accepted types, limits, progress, errors, and
  removal stated outside placeholder text.
- One-time code: `InputOTP` with a visible label and recovery path.

Creation and selection never share a picker. A final "Create" menu item may
open a page or `Dialog`, but the picker itself only selects existing values.

## U3. Action hierarchy

- Use exactly one filled primary `Button` per page, panel, or dialog.
- Use secondary buttons for alternatives and ghost buttons for low-emphasis
  actions. A destructive confirmation pairs one destructive action with a
  neutral cancel.
- Use `ButtonGroup` only when actions are tightly related. It does not make
  several actions primary.
- Icon-only buttons need an accessible name and are tertiary by default.
- Reuse the same verb through trigger, confirmation, progress, and success
  feedback.

## U4. Lists, tables, and cards

Choose by the relationship between records, not visual preference.

- Use `Table` when users compare the same attributes across rows and column
  headers carry meaning.
- Use `DataTable` when tabular data also needs client-side sorting, filtering,
  row selection, or pagination.
- Use `DataList` and `DataRow` for repeated records whose content does not
  align into meaningful columns.
- Use `Item` for richer list content with media, description, and an action
  slot. Use `Attachment` for file-specific records.
- Use `Card` for a bounded summary or group that can stand alone. Do not wrap
  every page section in a card.
- Make the row or card the link only when it has one dominant destination.
  When multiple actions exist, keep the container static and expose named
  buttons or a `DropdownMenu`.
- Preserve the component's slots and internal spacing. Views do not rebuild row
  or card internals with local flex and gap classes.

## U5. Navigation and location

- Global or product-area navigation: responsive `Sidebar`.
- Grouped site destinations: `NavigationMenu`.
- Peer destinations or views: `Tabs`. Use link mode when the URL should own
  state; use button mode for panels within the current interaction.
- Hierarchical location: `Breadcrumb`, after the primary navigation, not as a
  replacement for it.
- Discrete result pages: `Pagination`. Keep filters and sort in the URL and
  reset to page one when either changes.
- Persistent application command categories: `Menubar`. Ordinary page
  actions belong in buttons or `DropdownMenu`, not a menubar.
- Never hide the current location. Mark it in navigation and expose it to
  assistive technology.

## U6. Search, filter, and sort

- Search is a labelled `Input` or `InputGroup`. Submit explicitly when the
  query is expensive; otherwise debounce and announce the updated result count.
- Use `Combobox` for searchable selection, not for free-text search results.
- Show common filters directly with `Select`, `Checkbox`, `RadioGroup`, or
  `ToggleGroup`. Put secondary filters in a `Popover` on desktop and
  `Drawer` on mobile.
- Represent applied filters as removable controls only when removal is clear
  and keyboard accessible. Always provide "Clear filters" when several can be
  active.
- Sort with one labelled `Select` or a clearly named `DropdownMenu`. State
  both field and direction, such as "Newest first".
- Keep query, filters, sort, and page in the URL for shareable result views.
  Preserve the query when filters change and reset pagination when the result
  set changes.
- A no-match state is not an empty collection state. Show the query or active
  filters and offer clear or edit actions.

## U7. Bulk actions

- Bulk mode starts with explicit row `Checkbox` controls and a labelled
  select-all checkbox. Selection must not depend on clicking the whole row.
- Show a persistent selection count and available actions after the first
  selection. Use visible `Button` actions for common operations and a
  `DropdownMenu` for secondary operations.
- State whether select all covers the current page or all matching results.
- Confirm destructive bulk actions with `AlertDialog` and include the count.
- Keep failed items selected, report partial success in an inline `Alert`, and
  provide a retry path. Do not report actionable failures only through a toast.
- Clear selection when the result-defining query or filters change.

## U8. Pagination and long collections

- Prefer `Pagination` for addressable result sets, auditing, and tasks where
  users need stable position.
- Preserve page size, query, filters, and sort while moving between pages.
- Disable unavailable previous and next actions without removing them.
- Show total or range context when known. Do not invent a total while loading.
- Use progressive loading only for browse-first content. Preserve focus and
  scroll position, announce appended results, and provide a reachable end.
- Virtualization is an implementation detail, not a substitute for loading,
  empty, error, selection, or keyboard states.

## U9. Responsive behavior

- Preserve task order and information hierarchy across breakpoints. Responsive
  design may move controls, but must not remove required actions or state.
- Convert desktop `Sheet` and `Popover` details to `Drawer` on mobile.
- Collapse secondary actions into `DropdownMenu`; keep the primary action
  visible.
- Tables may scroll horizontally inside `ScrollArea` when column comparison
  remains essential. If comparison is not essential, render the data as
  `DataList` or `Item` rather than visually stacking table cells.
- Keep search visible. Move secondary filters into a drawer and show the active
  filter count on its trigger.
- Touch targets, focus order, labels, and error associations remain unchanged.

## U10. Multi-step tasks

- A multi-step task gets its own URL-backed page. Use `Progress` for overall
  progress and a real heading for the current step.
- Keep one primary action, usually "Continue" until the final step. Place Back
  as secondary and preserve entered data.
- Validate the current step before advancing. Put field errors inline and focus
  an error summary when several fields fail.
- Let users return to completed steps when dependencies allow it. Explain why a
  future step is unavailable instead of presenting a dead control.
- Review irreversible effects in a final summary. Use `AlertDialog` only for
  the destructive confirmation itself, not as the multi-step container.
- Save drafts when interruption is costly and state when the draft was saved.

There is no separate Stepper component. Compose page headings, `Progress`,
and `Button` without inventing a view-local stepper.

## U11. Async and optimistic behavior

- Model loading, error, empty, and ready explicitly with `AsyncState`.
- Use `Skeleton` when the final layout is known, `Spinner` inside a compact
  action or unknown-size region, and `Progress` when completion is measurable.
- Keep previous data visible during refresh when it is still valid. Mark the
  refreshing control busy instead of replacing the whole page.
- Optimistic updates are suitable only when success is likely and rollback is
  clear. Update immediately, mark the affected item pending, then reconcile
  with the server result.
- On optimistic failure, restore the previous state, keep the user's context,
  and show an inline `Alert` with a retry action.
- Use the `Toaster` host for transient success or information that needs no
  action. Never put blocking or actionable errors only in a toast.
- Disable only the action currently in flight. Prevent duplicate submission
  without freezing unrelated navigation.

## U12. Permissions and unavailable actions

- Remove actions the user must never discover. Keep a visible disabled action
  only when understanding its existence helps, and explain how access is
  obtained in nearby text or a `Tooltip`.
- Do not use disabled controls as the only explanation. Disabled elements may
  not expose hover or focus content consistently.
- A page the user cannot access shows an inline `Alert` with a safe navigation
  path. Do not render sensitive content behind a visual overlay.
- Re-check permission on the server for every mutation. Hiding a button is not
  authorization.
- If permission changes during a task, preserve non-sensitive input where safe
  and explain what changed and what the user can do next.

## U13. Onboarding and first use

- Use the real destination with contextual guidance whenever the user can learn
  by doing. Do not create a separate tour that teaches a different interface.
- Use `EmptyState` for an empty collection with one concrete first action.
- Use a page with `PageFrame`, `PageHeader`, and optionally `Card` for
  required setup or a multi-step onboarding task.
- Use `Popover` or `Tooltip` only for optional local guidance. Guidance
  must be dismissible and must not block the primary task.
- Let users skip optional onboarding and resume later. Persist completion per
  user rather than per browser viewport.
- Measure successful task completion, not tour completion.

## U14. Forms and messages

- Labels are short noun phrases, visible, and connected to their controls.
  Required is the default; mark optional fields in the label.
- Permanent instructions and format hints belong in the field description,
  connected through `aria-describedby`.
- Use one column and group related controls with `FieldSet` and `FieldLegend`.
- Put a field error beside its field. When several errors occur, add an inline
  `Alert` summary at the top and move focus to it.
- Use an inline `Alert` for page-level problems the user can recover from.
  Use `Toaster` only for transient events that need no action.
- Use `EmptyState` for an empty collection and a distinct no-match message for
  filtered or searched results.

## Component map

These mappings prevent pattern names from drifting away from the inventory.

| Pattern name | Import entrypoint |
|---|---|
| `AlertDialog` | `@/components/ui/alert-dialog` |
| `Alert` | `@/components/ui/alert` |
| `AsyncState` | `@/components/ui/async-state` |
| `Attachment` | `@/components/ui/attachment` |
| `Breadcrumb` | `@/components/ui/breadcrumb` |
| `ButtonGroup` | `@/components/ui/button-group` |
| `Button` | `@/components/ui/button` |
| `Card` | `@/components/ui/card` |
| `Checkbox` | `@/components/ui/checkbox` |
| `Combobox` | `@/components/ui/combobox` |
| `DataList`, `DataRow` | `@/components/ui/data-list` |
| `DataTable` | `@/components/ui/data-table` |
| `DatePicker`, `DateRangePicker` | `@/components/ui/date-picker` |
| `Dialog` | `@/components/ui/dialog` |
| `Drawer` | `@/components/ui/drawer` |
| `DropdownMenu` | `@/components/ui/dropdown-menu` |
| `EmptyState` | `@/components/ui/empty-state` |
| `FieldSet`, `FieldLegend` | `@/components/ui/field` |
| `FileUpload` | `@/components/ui/file-upload` |
| `FormField` | `@/components/ui/form-field` |
| `HoverCard` | `@/components/ui/hover-card` |
| `InputGroup` | `@/components/ui/input-group` |
| `InputOTP` | `@/components/ui/input-otp` |
| `Input` | `@/components/ui/input` or `@/components/ui/form-field` |
| `Item` | `@/components/ui/item` |
| `Menubar` | `@/components/ui/menubar` |
| `NativeSelect` | `@/components/ui/native-select` |
| `NavigationMenu` | `@/components/ui/navigation-menu` |
| `PageFrame` | `@/components/ui/page-frame` |
| `PageHeader` | `@/components/ui/page-header` |
| `Pagination` | `@/components/ui/pagination` |
| `Popover` | `@/components/ui/popover` |
| `Progress` | `@/components/ui/progress` |
| `RadioGroup` | `@/components/ui/radio-group` |
| `ScrollArea` | `@/components/ui/scroll-area` |
| `Select` | `@/components/ui/select` |
| `Sheet` | `@/components/ui/sheet` |
| `Sidebar` | `@/components/ui/sidebar` |
| `Skeleton` | `@/components/ui/skeleton` |
| `Slider` | `@/components/ui/slider` |
| `Spinner` | `@/components/ui/spinner` |
| `Switch` | `@/components/ui/switch` |
| `Table` | `@/components/ui/table` |
| `Tabs` | `@/components/ui/tabs` |
| `Toaster` | `@/components/ui/sonner` |
| `ToggleGroup` | `@/components/ui/toggle-group` |
| `Tooltip` | `@/components/ui/tooltip` |

## Sources

Distilled from GOV.UK Design System patterns, NN/g guidance on dialogs,
placeholders, forms, tables, onboarding, and responsive interaction, Carbon
and Atlassian message hierarchies, Doctolib overlay decision trees, Tess
Gadd's dropdown guidance, and modal versus page frameworks from Vitaly
Friedman and Ryan Neufeld. Consult sources when changing these rules, not when
applying them.
