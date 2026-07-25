---
name: a11y-audit
description: Accessibility audit of a view or flow. Use when the user asks for an accessibility check, a11y review, WCAG or APCA verification, or before shipping a new user-facing flow.
---

# Accessibility audit

## Automated pass

1. `npm run design-check` (catches N7 focus suppression, N2 font floor).
2. `npm run contrast-check` (APCA on theme brand pairs).
3. If Playwright with axe-core is set up in the project: run it against the target pages and triage every violation. If not set up, note that and rely on the manual pass.

## Manual pass, in this order

1. **Keyboard walk**: tab through the entire view. Every interactive element reachable, visible focus ring on each, logical order, no traps. Dialogs: focus moves in on open, returns to trigger on close, Escape closes.
2. **Labels and names**: every input has a visible label (N8), every icon-only button an aria-label (A5), every image meaningful alt or empty alt if decorative.
3. **Errors**: connected via aria-describedby (A4), announced (role=alert or aria-live on the error region), color plus icon/text (N9), message says how to recover (A11).
4. **Contrast beyond the theme pairs**: any NEW color combination introduced in this view must be checked against APCA. Thresholds: Lc 90 primary text, 75 body, 60 large/bold 24px+, 45 non-text UI. Use `node scripts/contrast-check.mjs` as reference for method, or compute the specific pair.
5. **Touch targets**: 44x44px minimum on all interactive elements (A3).
6. **Motion**: nothing animates for users with prefers-reduced-motion (global rule exists in semantic.css; verify no JS animation bypasses it, N12).
7. **Zoom**: layout usable at 200% browser zoom, no horizontal scroll at 400% on a 1280px viewport (WCAG reflow).
8. **Semantics**: headings form a hierarchy (one h1, no skipped levels), lists are lists, tables have th with scope.

## Report

List findings grouped by severity (blocker / should-fix / nice-to-have),
each with file:line and the fix. Apply fixes for everything mechanical;
flag judgment calls to the human.
