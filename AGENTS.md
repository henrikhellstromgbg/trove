# AGENTS.md, Trove

Read `CLAUDE.md` for stack, schema, conventions and build state. It is the single project reference for both Claude and Codex.

## Shared build plans

One plan document per work round in `docs/` (format: `docs/review-fix-plan-2026-07-21.md`). The plan doc is the only interface between agents; no instruction may exist only in a chat. One agent writes at a time; the status line at the top says who. Commit at each completed and verified stage so the next agent starts from a clean tree.

## Delegation

Standing permission: delegate mechanical work (searches, test runs, log reading, bulk edits) to a low-effort model. Prefer Codex native subagents for this. A headless `codex exec --profile cheap` is the manual alternative; that profile lives in a separate file, `~/.codex/cheap.config.toml`. Reviews and security-sensitive code always run on the strong models.

## Hard rules

- Never touch the production database. Destructive steps are documented, not executed.
- Every project-owned content query scopes by user_id and verified project_id, directly or through a verified owning relation. Global authentication resources are resolved first and must establish the project boundary before project-owned content is accessed.
- Small diffs, no features beyond the active plan.
- Code and docs must not disagree; fix both in the same round.
