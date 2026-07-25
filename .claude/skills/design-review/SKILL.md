---
name: design-review
description: Review a view or component against the design system rules before it is approved. Use when the user asks for a design review, before marking UI work as done, or when the user references rule numbers like N3 or A2.
---

# Design review

Review the specified files (or the files changed in this session) against
every rule in `design-rules/RULES.md`. That file is the checklist; do not
maintain a separate list here.

## Process

1. Run `npm run design-check` first. Report and fix all machine-caught violations.
2. Read `design-rules/RULES.md` and walk every rule (N*, A*, P*) against the code manually. The `[lint]` rules are already covered by step 1; focus manual attention on the untagged ones.
3. Pay extra attention to the rules machines cannot catch:
   - A6: are ALL states implemented (hover, focus-visible, active, disabled, loading, error, empty)?
   - N8/A4: does every input have a visible label, and are errors wired via aria-describedby?
   - N9: is any state communicated by color alone?
   - N10/A1: is all copy sentence case?
   - A10/A11: do actions say what they do, do errors say how to recover?
   - N5/A7/P4: were any components created outside components/ui/?
4. Check both light and dark mode if the change touches colors or surfaces.
5. Report findings as a list of rule violations by number, with file:line, then fix them.

## Output format

For each violation: `RULE-ID  file:line  what is wrong  how it was fixed`.
End with either "All rules pass" or the list of remaining open items that
need a human decision.
