# base-ds agent pilot, Library controls

Status: Complete — verified in the real `feat/v2-hygiene` worktree.

## Goal

Install the current base-ds registry and agent control plane in Trove, then
verify that an implementation agent can improve a real surface without
changing product behavior.

## Scope

- Validate first in the isolated `experiment/base-ds-library-pilot` worktree,
  then apply the verified result to `feat/v2-hygiene`.
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
2. Run one bounded implementation agent against Library controls. Complete.
3. Review the diff and compare checker output. Complete.
4. Install the 73 base-ds entrypoints and register Trove's 3 adapters. Complete.
5. Clear the legacy checker backlog and fix the nested `main` landmark. Complete.
6. Run the full verification suite and report whether the pilot improved the surface. Complete.

## Result

- Registry contract: 76 verified UI entrypoints (73 base-ds, 3 Trove adapters).
- Library raw controls: 7 to 0.
- Library checker findings: 2 to 0.
- Repository checker findings: 46 to 0, with documented exemptions printed.
- `--gray-25` is the light canvas primitive in both Trove and base-ds.
- The base-ds `DataRow` contract now protects trailing actions above its
  stretched row target with the tokenized `--z-raised` layer and a regression
  assertion.
- Product behavior retained: filtering, sorting, links, status labels,
  limited-search copy, and the distinct no-match state.
