# Design

## Source of truth

- Status: Active
- Last refreshed: 2026-07-25
- Primary product surfaces: Capture, Library, Ask, Sources, Pipelines, Digest, Topics, Settings
- Evidence reviewed: `CLAUDE.md`, `AGENTS.md`, `docs/design-system-adoption-2026-07-24.md`, `design-rules/RULES.md`, `design-system/registry.json`, `components/ui/README.md`, `tokens/*.css`, and current application views
- Precedence: `design-rules/RULES.md` governs enforceable UI constraints, `design-system/registry.json` governs supported components and imports, and this file describes Trove's product-specific design direction.

## Brand

- Personality: Quiet, editorial, dense, and tool-like. Content is the interface and chrome recedes.
- Trust signals: Clear source attribution, explicit status, stable navigation, readable hierarchy, and restrained feedback.
- Avoid: Decorative containers, glass, gradients, oversized headings, novelty copy, status conveyed by color alone, and arbitrary one-off styling.

## Product goals

- Goals: Make captured knowledge easy to scan, filter, retrieve, and act on without losing project context.
- Non-goals: Social feeds, decorative dashboards, or a generalized enterprise workspace.
- Success signals: Users can locate an item quickly, understand its source and processing state, and move between capture, library, and retrieval without relearning controls.

## Personas and jobs

- Primary personas: Designers, freelancers, indie operators, and researchers managing high-volume inputs.
- User jobs: Capture material, inspect and filter a library, ask cited questions, manage recurring sources, and run recurring synthesis pipelines.
- Key contexts of use: Desktop-first focused work with a responsive mobile capture and review path.

## Information architecture

- Primary navigation: Persistent responsive product sidebar with visible current project and destination.
- Core routes/screens: Capture, Library, Ask, Sources, Pipelines, Digest, Topics, and Settings.
- Content hierarchy: Current project, page purpose, task controls, result state, then individual records and actions.

## Design principles

- Compose from the registered base-ds library before adding markup or styling.
- Prefer lists and tables over cards when records share structure.
- Keep one primary action per page or bounded task.
- Preserve URL-backed search, filter, sort, and pagination when state should be shareable.
- Tradeoff: Density is preferred, but never below the 14px type floor or the 44px touch-target minimum.

## Visual language

- Color: Semantic `--color-*` tokens only. Trove keeps a warm red brand identity, neutral ink action color, and semantic status colors.
- Typography: Geist Sans for interface text and Geist Mono only for compact numeric or machine-like values. Minimum 14px.
- Spacing/layout rhythm: Token-based spacing, quiet vertical rhythm, reading/list widths capped with `PageFrame`.
- Shape/radius/elevation: Small token radii, hairline separation, minimal shadow reserved for elevated overlays.
- Motion: Token durations and easing only, with global reduced-motion behavior preserved.
- Imagery/iconography: Carbon icons only through `@/components/icons`; icons support meaning and do not decorate empty space.

## Components

- Existing components to reuse: All entrypoints registered in `design-system/registry.json`, including `InputGroup`, `NativeSelect`, `DataList`, `DataRow`, `StatusIndicator`, `EmptyState`, `Button`, and responsive overlay/navigation primitives.
- New/changed components: None for the Library filter pilot. Missing patterns must follow the base-ds new-component process.
- Variants and states: Preserve loading, empty collection, no-match, error, ready, disabled, hover, active, and focus-visible behavior where applicable.
- Token/component ownership: Components own their internal classes and spacing. Views pass content and compose outer token-based layout only.

## Accessibility

- Target standard: WCAG 2.2 AA plus the APCA thresholds enforced by base-ds.
- Keyboard/focus behavior: Native or Radix keyboard semantics, visible focus, no hand-built clickable elements.
- Contrast/readability: 14px floor and semantic text tiers; status pairs icon or text with color.
- Screen-reader semantics: Visible labels for controls, descriptive names for icon-only actions, announced async result changes.
- Reduced motion and sensory considerations: Do not add JS motion that bypasses the global reduced-motion contract.

## Responsive behavior

- Supported breakpoints/devices: Mobile and desktop, with `md` as the primary layout transition.
- Layout adaptations: Keep search visible; secondary filters may move into a drawer on narrow screens when needed.
- Touch/hover differences: Preserve 44px touch targets, keyboard order, labels, and actions across breakpoints.

## Interaction states

- Loading: `Skeleton`, `Spinner`, `Progress`, or `AsyncState` based on known layout and duration.
- Empty: `EmptyState` with one concrete next action for an empty collection.
- Error: Inline `Alert` or field error with a recovery path.
- Success: Transient feedback only when no further action is needed.
- Disabled: Disable only the action in flight and explain unavailable actions when useful.
- Offline/slow network: Keep valid previous content visible and identify refreshing or failed regions locally.

## Content voice

- Tone: English, direct, specific, and calm.
- Terminology: Project, Library, Source, Pipeline, Capture, Ask, and Digest are stable product nouns.
- Microcopy rules: Sentence case, plain verbs, no exclamation marks, filler, title case, or dash punctuation.

## Implementation constraints

- Framework/styling system: Next.js 16, React 19, Tailwind 4, shadcn-owned source, Radix/Base UI primitives, and Carbon icons.
- Design-token constraints: `tokens/primitives.css` and `tokens/semantic.css` are immutable in Trove; only `tokens/theme.css` carries project brand overrides.
- Performance constraints: Client-side filtering remains bounded to the currently loaded Library rows; avoid new dependencies for the pilot.
- Compatibility constraints: Preserve Trove's existing component barrel adapters until views are migrated safely.
- Test/screenshot expectations: Run business tests, current base-ds design-check, TypeScript, contrast, scales, and production build. Visually inspect changed responsive states when the pilot moves beyond code-only validation.

## Open questions

- [ ] Decide whether Library filter and sort state should move into the URL when server-backed pagination replaces the current bounded client list.
- [ ] Decide whether the full Sidebar migration should preserve Trove's custom project-switcher composition or add a registered base-ds extension.
