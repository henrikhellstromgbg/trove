# Production DB reconciliation runbook

Status: **mechanism tested locally, not yet run against prod.** Supersedes the
outline in `review-fix-plan-2026-07-21.md` ("Reconciliation for the existing
db:push database"), which predated migrations 0002–0006.

## The problem

The production database was created with `pnpm db:push` (drizzle-kit push), which
applies a schema directly and **records no migration history**. It has therefore
never run the migration path and its `drizzle.__drizzle_migrations` journal is
empty or absent. Meanwhile the code now expects the schema produced by migrations
`0000`→`0006`. The gap prod is missing (relative to whatever early schema it was
pushed at) includes:

| Migration | Adds |
|-----------|------|
| 0002 | `connected_account`, `original_record`, `source_rule`, `source_run` tables; `source.connected_account_id` |
| 0003 | `pipeline.template_key` |
| 0004 | (indexes / constraints) |
| 0005 | `deletion_marker`, `review_decision` tables; `item.trashed_at`, `item.restore_status` |
| 0006 | `deletion_marker.source_id` FK → `ON DELETE restrict` |

Running `db:migrate` against prod **as-is would fail or corrupt it**: with no
journal, the migrator starts at `0000` and tries to `CREATE TABLE` objects that
already exist. (This failure is reproduced deliberately in the test harness.)

The fix is **baselining**: record the migrations prod already contains in the
journal *without* executing their SQL, so a forward `db:migrate` applies only the
genuinely missing ones.

## Absolute rules

- **Never run anything against production directly.** Every step below runs
  against a **restored backup copy** first, and prod itself is only touched in the
  final cutover, inside a maintenance window, with a verified backup in hand.
- **Never run `db:push` again** anywhere near prod — it is what created this mess.
- The baseline script (`scripts/baseline-migrations.ts`) refuses to run unless
  `--confirm-database <name>` matches the database in `DATABASE_URL`, so it cannot
  be aimed at the wrong database by accident.

## Tools in this repo

- `scripts/baseline-migrations.ts` — records the given migrations in
  `drizzle.__drizzle_migrations` (real hashes + `created_at`, matching the
  migrator), never executing their SQL. `--through <tag|count|all>`,
  `--confirm-database <name>`, `--dry-run`.
- `lib/db/migrate.ts` (`pnpm db:migrate`) — the forward migrator; honours
  `DATABASE_WS_PROXY` for a local Postgres behind a Neon wsproxy.
- `pnpm db:verify-fresh` — builds a fresh DB from migrations and compares it to
  `schema.ts` (tables, columns, nullability, defaults, FKs/on-delete, indexes,
  HNSW opclass, `vector(768)`). The comparison target for "did we converge."
- `scripts/test-reconciliation.sh` — proves the mechanism on throwaway local
  databases (see below).

## The procedure

Run 1–8 against a **restored copy** of prod. Only after it passes, repeat the
data-affecting steps against prod during a maintenance window.

1. **Back up and verify the backup restores.** On Neon, create a branch from prod
   (instant copy-on-write) — that branch *is* the working copy for steps 2–9. Keep
   an independent `pg_dump` as well. Confirm the dump restores into an empty DB
   before proceeding.

2. **Capture prod's real schema — do not assume.** Introspect the copy
   (`information_schema.columns`, `table_constraints`, `pg_indexes`) and record it.
   The tables/columns prod actually has determine how far to baseline.

3. **Diff the copy against the migration baseline.** Compare the copy's schema to
   the schema produced by the migrations it should already contain (build that
   reference with `db:migrate` on an empty DB, or `db:verify-fresh`). **Every
   difference must be explained before proceeding.** Expected classes of drift:
   - *db:push naming drift* — push may have named constraints/indexes differently
     than the generated migrations. Rename on the copy to match the migration
     names, or the forward migrate's `ALTER`/`DROP CONSTRAINT` by name will miss.
   - *Missing objects* — anything from a later migration that push never created.
   - *`vector(1536)` embeddings* — see step 6.

4. **Backfill project isolation (data).** Create inbox projects for any user with
   orphaned rows. List every `source` with `project_id IS NULL`, backfill to the
   owner's inbox project, and **log every moved source id** so the move is
   auditable. `scripts/backfill-projects.ts` is a *partial* helper only (it omits
   sources, the token FK change and vector reconciliation) — do not treat it as the
   whole reconciliation.

5. **Tighten the constraints prod is missing.** `source.project_id` → `NOT NULL`
   (only after step 4 leaves none null); `ingest_token.project_id` FK → the current
   `ON DELETE` behaviour. These match what the later migrations assert.

6. **Handle `vector(1536)` → `vector(768)` explicitly.** The dimension change
   cannot convert existing embeddings. Decide **per corpus**: re-embed the affected
   chunks (preferred — Gemini `gemini-embedding-001`, 768 dims), or truncate the
   chunks and reprocess their items. This is an explicit, logged step — **never** an
   implicit `ALTER COLUMN TYPE`, which would silently drop or corrupt vectors.

7. **Baseline the journal.** Once the copy's schema matches the reference for the
   migrations it contains, record those migrations:
   ```
   DATABASE_URL=<copy> [DATABASE_WS_PROXY=…] \
     npx tsx scripts/baseline-migrations.ts \
       --through <last-migration-prod-already-has> \
       --confirm-database <copy-db-name> --dry-run   # review first
   ```
   Then drop `--dry-run` to write. Pick `--through` from step 2/3: the highest
   migration whose objects are already fully present and correct on the copy.

8. **Forward migrate and verify convergence.**
   ```
   DATABASE_URL=<copy> [DATABASE_WS_PROXY=…] pnpm db:migrate
   ```
   applies only the migrations after the baseline. Then confirm the copy now
   matches `schema.ts` — diff its introspected schema against a fresh `db:migrate`
   DB (the technique in `scripts/test-reconciliation.sh`), and spot-check data
   survived (row counts, a sampled item's chunks/embeddings).

9. **Cutover to prod.** Only after the copy passes 1–8 cleanly: schedule a
   maintenance window, take a fresh prod backup, and run the data-affecting steps
   (4–8) against prod with the exact commands rehearsed on the copy. Keep the move
   log. If anything deviates from the rehearsal, stop and restore.

## Mechanism test (done, reproducible)

`scripts/test-reconciliation.sh` runs against throwaway databases in the dev
Docker Postgres and never touches prod. It:

1. Builds `recon_target` with a full `db:migrate` (0000→0006) — the canonical target.
2. Builds `recon_sim` with **only 0000+0001 applied and no journal** — a stand-in
   for a db:push'd early prod.
3. Confirms an un-baselined `db:migrate` on `recon_sim` **fails** (collides on
   existing objects) — the exact prod danger.
4. Baselines 0000+0001, forward-migrates (applies only 0002→0006).
5. Diffs the two schemas (columns, constraints, indexes; Postgres-internal
   `*_not_null` check names excluded as OID noise).

Result: **the baselined + forward-migrated schema is identical (234 schema rows)
to a fresh full migrate**, and the journal ends with all seven migrations. This
proves the baseline-then-migrate mechanism converges; the drift, backfill and
vector steps above remain prod-data-specific and are rehearsed on the copy.

## What this does NOT cover

- The exact db:push naming drift on the real prod schema — unknowable until step 2
  introspects prod; the test simulates an early schema via the migration SQL, not a
  historical `db:push`.
- The re-embedding job for `vector(1536)` chunks (step 6) — a corpus-sized batch,
  scoped when prod is inspected.
