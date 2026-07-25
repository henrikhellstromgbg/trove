# base-ds agent pilot, Library controls

Status: Codex owns this experimental round.

## Goal

Test whether an implementation agent using the current base-ds registry,
design rules, and UX-pattern skill improves a real Trove surface without
changing behavior.

## Scope

- Work only in the isolated `experiment/base-ds-library-pilot` worktree.
- Refactor `app/library-table.tsx` to registered controls.
- Reuse `InputGroup`, `NativeSelect`, `Label`, `Button`, `DataList`, and
  `DataRow`; do not create a component or add a dependency.
- Preserve filtering, sorting, links, status labels, limited-search copy, and
  the distinct no-match state.
- Do not touch the database or Trove's real `feat/v2-hygiene` worktree.

## Acceptance criteria

- Remove the direct Carbon import, raw input, raw selects, local `CONTROL`
  styling, and the `Button` class override from `library-table.tsx`.
- Keep visible, connected labels for search, type, status, and sort.
- The current base-ds checker reports no finding in `library-table.tsx`.
- Trove business tests, TypeScript, contrast, scales, and production build pass.

## Stages

1. Record baseline and design contract. Complete.
2. Run one bounded implementation agent against Library controls. In progress.
3. Review the diff and compare checker output. Pending.
4. Run the full verification suite and report whether the pilot improved the surface. Pending.
