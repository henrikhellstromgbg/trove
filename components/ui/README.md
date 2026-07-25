# Component inventory

Status: `done` = built and pattern-verified. `todo` = generate with Claude Code
using the new-component skill, based on the shadcn/ui equivalent adapted to
RULES.md (the `done` components define the pattern to follow).

When a `todo` component is built, flip its status here.

Every component follows the shadcn architecture (Radix primitive + cva + `cn`)
reskinned onto `--color-*` semantic tokens. Never `npx shadcn add`: its output
carries its own color scale and would reintroduce raw values. See the "Component
source" section in the root README.md.

## Forms

| Component | Status | Notes |
|---|---|---|
| Button (incl. icon size) | done | Reference component, read first |
| Label | done | in form-field.tsx |
| Input | done | in form-field.tsx |
| Textarea | done | in form-field.tsx |
| FormField | done | Required wrapper for all inputs |
| Select | done | Radix Select. Trigger matches Input; forwards FormField's id/aria/invalid |
| Combobox | todo | cmdk + Popover |
| Checkbox | todo | Radix Checkbox |
| RadioGroup | todo | Radix RadioGroup |
| Switch | todo | Radix Switch |
| Slider | todo | Radix Slider |
| DatePicker | todo | react-day-picker + Popover |
| Calendar | todo | react-day-picker |
| FileUpload | todo | custom, drag and drop + keyboard |
| InputOTP | todo | input-otp |

## Surfaces and layout

| Component | Status | Notes |
|---|---|---|
| Card | done | |
| PageFrame | todo | Centered page column, gutters and rhythm. Source material: Trove's `page-frame.tsx` |
| PageHeader | todo | Title, description, action slot. Source material: Trove's `page-header.tsx` |
| SectionHeader | todo | Section title plus action slot. Source material: Trove's `section-header.tsx` |
| Separator | todo | Radix Separator |
| AspectRatio | todo | Radix AspectRatio |
| ScrollArea | todo | Radix ScrollArea |
| Resizable | todo | react-resizable-panels |
| Collapsible | todo | Radix Collapsible |
| Accordion | todo | Radix Accordion |

## Overlay

| Component | Status | Notes |
|---|---|---|
| Dialog | done | |
| AlertDialog | done | Radix AlertDialog. The only correct guard for a destructive action |
| Sheet | todo | Dialog variant, side panel |
| Drawer | todo | vaul |
| Popover | todo | Radix Popover |
| Tooltip | todo | Radix Tooltip |
| HoverCard | todo | Radix HoverCard |
| DropdownMenu | todo | Radix DropdownMenu |
| ContextMenu | todo | Radix ContextMenu |
| Command | todo | cmdk palette |

## Navigation

| Component | Status | Notes |
|---|---|---|
| Tabs | done | Two modes, link and button. NOT Radix, see "Tabs: why not Radix" below |
| NavigationMenu | todo | Radix NavigationMenu |
| Breadcrumb | todo | |
| Pagination | todo | |
| Sidebar | todo | |

## Feedback

| Component | Status | Notes |
|---|---|---|
| Alert | done | |
| Badge | done | Status variants include icons (N9) |
| Toast | todo | sonner, styled with tokens |
| Progress | todo | Radix Progress |
| Spinner | todo | extract from Button loading state |
| Skeleton | done | |
| EmptyState | done | custom |
| StatusIndicator | done | Coloured-text status label for dense rows. Badge is the chip version |

## Data

| Component | Status | Notes |
|---|---|---|
| Table | done | |
| DataList | done | Row list for non-tabular content. Row owns its padding and layout (A15, A16) |
| DataTable | todo | TanStack Table on top of Table |
| Avatar | todo | Radix Avatar |
| AvatarGroup | todo | custom |
| Chart | todo | Recharts wrappers with token colors preapplied |

## Typography

| Component | Status | Notes |
|---|---|---|
| Heading | todo | |
| Text | todo | |
| InlineCode | todo | |
| Kbd | todo | |
| Link | todo | underline on hover minimum, uses --color-text-link |

## Tabs: why not Radix

Learned during the first real adoption. Radix Tabs owns the state *and* the
panels: `Content` must be a descendant of `Root`, and `Trigger` renders a
button. Two common cases fall outside that model, and both appear in almost
every real app:

- **Link tabs.** The tabs are navigation (`?view=archived`, `/settings/billing`)
  and the URL is the state. Radix renders triggers, not links, and does not
  drive routing. Forcing it means either losing the URL or shadowing Radix state
  with router state, which desyncs on back/forward.
- **Externally rendered panels.** The panel content lives elsewhere in the tree,
  is server-rendered, or is a sibling rather than a child. Radix `Content` has
  to sit inside `Root`, so this needs a portal or a rewrite of the page tree.

`tabs.tsx` covers both behind one API and one set of styles: pass `href` for
link mode, or `tabId`/`panelId` plus `onSelect` for button mode. Button mode
implements the tablist keyboard contract by hand (roving tabindex,
Arrow/Home/End, `aria-selected`, `aria-controls`).

Radix Tabs is still the right answer for a self-contained tab group that owns
its own panels and needs no URL. If you build that variant, add it beside this
one rather than replacing it, and note both modes here.
