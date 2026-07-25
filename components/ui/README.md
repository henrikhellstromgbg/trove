# Component inventory

Every TypeScript entrypoint in this directory is available for composition.
Import each entrypoint through `@/components/ui/<entrypoint>`. The exact public
exports are recorded in `design-system/registry.json`, which is the
machine-readable contract checked by `scripts/registry-contract.test.mjs`.

`Available` means the source file exists and is registered. It does not waive
the usage rules in `design-rules/RULES.md`. Views must compose these components
instead of restyling their internals or inventing local replacements.

## Forms and inputs

| Entrypoint | Status | Intended use |
|---|---|---|
| `button` | Available | Primary, secondary, tertiary, destructive, icon, and loading actions |
| `button-group` | Available | Visually joined actions or an action with adjacent context |
| `checkbox` | Available | Independent boolean choice or row selection |
| `combobox` | Available | Searchable selection from a large known set, including multi-value chips |
| `field` | Available | Composable field groups, descriptions, and errors |
| `file-upload` | Available | Labelled drag, drop, and file chooser input with error wiring |
| `form-field` | Available | Required label, hint, input, textarea, and error wiring for ordinary forms |
| `form-controls` | Available | Trove compatibility adapters for labelled text and textarea fields |
| `input` | Available | Standalone text-like input primitive when `FormField` is composed separately |
| `icon-button` | Available | Trove compatibility adapter for accessible icon-only actions |
| `inline-error` | Available | Trove compatibility adapter for standalone recoverable errors |
| `input-group` | Available | Input with a prefix, suffix, button, or supporting text |
| `input-otp` | Available | One-time code entry |
| `label` | Available | Standalone accessible label primitive |
| `native-select` | Available | Native platform select where browser behavior is preferred |
| `radio-group` | Available | One choice from fewer than five visible options |
| `select` | Available | One choice from five or more fixed options |
| `slider` | Available | Bounded numeric value where relative position matters |
| `switch` | Available | Immediate on or off setting |
| `textarea` | Available | Standalone multiline input primitive |
| `toggle` | Available | Pressed or unpressed action state |
| `toggle-group` | Available | Segmented single-choice or multi-choice controls |
| `date-picker` | Available | Calendar-backed single date or date range selection |

## Pages, layout, and disclosure

| Entrypoint | Status | Intended use |
|---|---|---|
| `accordion` | Available | Multiple disclosure sections where more than one may be useful |
| `aspect-ratio` | Available | Stable media proportions |
| `card` | Available | A bounded content group, never a default wrapper for every section |
| `collapsible` | Available | One optional disclosure region |
| `direction` | Available | Text direction context for bidirectional interfaces |
| `page-frame` | Available | Standard page width, gutters, and vertical rhythm |
| `page-header` | Available | Page title, description, and one action slot |
| `resizable` | Available | User-adjustable adjacent panels |
| `scroll-area` | Available | Constrained custom scroll region |
| `section-header` | Available | Section title and optional action slot |
| `separator` | Available | Semantic or visual separation between related groups |

## Overlays and menus

| Entrypoint | Status | Intended use |
|---|---|---|
| `alert-dialog` | Available | Confirmation guard for destructive or irreversible actions |
| `command` | Available | Searchable command palette, commonly hosted by its provided dialog |
| `context-menu` | Available | Pointer context actions that also have a discoverable alternative |
| `dialog` | Available | Blocking decision or short self-contained task |
| `drawer` | Available | Mobile details or task surface anchored to a screen edge |
| `dropdown-menu` | Available | Compact secondary action menu |
| `hover-card` | Available | Supplementary preview, never required information |
| `menubar` | Available | Desktop-style persistent application command menus |
| `popover` | Available | Light contextual details or controls on desktop |
| `sheet` | Available | Non-blocking desktop side panel that preserves page context |
| `tooltip` | Available | Brief supplementary label or explanation, never essential content |

## Navigation

| Entrypoint | Status | Intended use |
|---|---|---|
| `breadcrumb` | Available | Location within a hierarchy |
| `carousel` | Available | Sequential browseable media or content items |
| `navigation-menu` | Available | Site or product navigation with grouped destinations |
| `pagination` | Available | Navigation across discrete result pages |
| `sidebar` | Available | Responsive application navigation and grouped destinations |
| `tabs` | Available | Peer views in link mode or accessible button mode |

## Data, content, and messaging

| Entrypoint | Status | Intended use |
|---|---|---|
| `attachment` | Available | File or media attachment with metadata and actions |
| `avatar` | Available | Person or entity identity, including groups and status badge |
| `avatar-group` | Available | Compact collection of people with an overflow count |
| `bubble` | Available | Compact conversational or annotation content |
| `chart` | Available | Token-aware Recharts container, tooltip, legend, and styles |
| `data-list` | Available | Repeated non-tabular records with the row layout owned by `DataRow` |
| `data-table` | Available | Sortable, filterable, selectable, and paginated tabular data |
| `item` | Available | Rich list or menu-like item with media, content, and actions slots |
| `message` | Available | Structured message with avatar, header, body, and footer |
| `message-scroller` | Available | Scroll and visibility behavior for a sequence of messages |
| `table` | Available | Truly tabular data with comparable columns and headers |

## Feedback and status

| Entrypoint | Status | Intended use |
|---|---|---|
| `alert` | Available | Persistent inline page or form message |
| `async-state` | Available | Exhaustive loading, error, empty, and ready rendering |
| `badge` | Available | Compact categorical or status chip |
| `empty` | Available | Composable empty-content structure |
| `empty-state` | Available | Opinionated empty collection with one clear next action |
| `marker` | Available | Labelled visual marker with token-owned variants |
| `progress` | Available | Determinate task or multi-step progress |
| `skeleton` | Available | Layout-preserving loading placeholder |
| `sonner` | Available | `Toaster` host for transient success or informational events |
| `spinner` | Available | Compact indeterminate progress inside an existing surface |
| `status-indicator` | Available | Dense text status with icon or count support |

## Utility and media

| Entrypoint | Status | Intended use |
|---|---|---|
| `calendar` | Available | Calendar grid and day selection, usually paired with a labelled field |
| `kbd` | Available | Keyboard key or shortcut notation |
| `typography` | Available | System heading, text, link, and inline code primitives |

## Tabs: link mode and button mode

`tabs.tsx` intentionally supports two patterns behind one style contract:

- Link mode uses `href`; the URL owns state and browser back and forward keep
  working.
- Button mode uses `tabId`, `panelId`, and `onSelect`; it implements roving
  focus, Arrow, Home, End, `aria-selected`, and `aria-controls` for externally
  rendered panels.

Use a URL when a tab represents a destination or a shareable view. Use button
mode only when the panels are part of the current interaction and routing adds
no value.
