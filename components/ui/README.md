# Component inventory

Status: `done` = built and pattern-verified. `todo` = generate with Claude Code
using the new-component skill, based on the shadcn/ui equivalent adapted to
RULES.md (the `done` components define the pattern to follow).

When a `todo` component is built, flip its status here.

## Forms

| Component | Status | Notes |
|---|---|---|
| Button (incl. icon size) | done | Reference component, read first |
| Label | done | in form-field.tsx |
| Input | done | in form-field.tsx |
| Textarea | done | in form-field.tsx |
| FormField | done | Required wrapper for all inputs |
| Select | todo | Radix Select |
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
| AlertDialog | todo | Radix AlertDialog, destructive confirmations |
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
| Tabs | todo | Radix Tabs |
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

## Data

| Component | Status | Notes |
|---|---|---|
| Table | done | |
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
