---
name: new-component
description: The required process for adding a new component to the design system. Use whenever a needed component does not exist in components/ui/, or when the user asks to create a new reusable component.
---

# New component process

A new component is a last resort. Follow these gates in order.

## Gate 1: composition check

Can existing components in `components/ui/` be composed to solve this?
Check the full inventory in `components/ui/` and the patterns in `examples/`.
If composition works, do that instead and stop here.

## Gate 2: confirm with the human

State: what is needed, why composition fails, and what the component's API
would be (props, variants, states). Wait for approval. Do not build first
and ask after.

## Gate 3: build to system standard

- Location: `components/ui/<name>.tsx`. Nowhere else.
- Base on the closest Radix primitive if one exists.
- Styling: semantic tokens only, cva for variants, `cn()` for class merging.
- Follow the structure of an existing similar component (read `button.tsx` or `form-field.tsx` as reference).
- Implement every relevant state: hover, focus-visible, active, disabled, loading, error, empty.
- Accessibility: label wiring, aria attributes, keyboard support, 44px touch target, focus ring via the global `:focus-visible` (never suppress it).
- Icons from `components/icons.ts` (Carbon) only.

## Gate 4: verify and document

1. `npm run design-check` must pass.
2. If the component introduces a new color pairing: `npm run contrast-check` must pass.
3. Add a usage example to the relevant file in `examples/`.
4. Add the component to the inventory table in `components/ui/README.md`.

## Gate 5: sync back

If the component is generally useful (not project-specific), note it for
sync back to the base-ds repo so future projects get it. Tell the human:
"This belongs in base-ds, copy `components/ui/<name>.tsx` there."
