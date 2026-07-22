# Trove architecture review and fix plan, 2026-07-21

Status: **Approved by Codex final review.** All five review points are resolved. Independent code review: `APPROVE`. Architecture status: `CLEAR`. The existing db:push database and prod remain untouched.

## Codex final approval, 2026-07-21

Final verification: `pnpm test` passes 35/35, `pnpm lint` has zero errors (three unrelated pre-existing warnings), `git diff --check` passes, and `pnpm build` passes with network access. The strengthened migration verifier and its reported disposable-database run were reviewed; that temporary container was no longer running during final approval, so the live migration was not run a third time. No scoped findings remain.

## Codex final review, 2026-07-21

Independent review result: `REQUEST CHANGES`; architecture status: `WATCH`.

1. **Strengthen the isolation tests.** The current route tests replace `requireProjectId` with a mock that throws, so they prove the HTTP error mapping but not that the real helper rejects a foreign project. The two source tests also return an empty result from a mock that ignores the actual SQL predicates, so they would pass even if the `user_id` or `project_id` filter disappeared. Add integration tests against a temporary database, or refactor the validation into testable functions that receive real project/source rows and explicitly compare both owner and project. The tests must fail if either ownership filter is removed.
2. **Normalize UUIDs before enforcing the token lock.** `providedProjectId !== lockedProjectId` is case-sensitive even though UUID text is case-insensitive. Resolve or normalize both valid UUIDs before comparison, and add JSON plus multipart tests using an uppercase/mixed-case representation of the locked project id.
3. **Make the migration verifier compare actual default expressions.** Its schema-to-snapshot check currently compares only whether a default exists. Compare normalized default values from `schema.ts` to the snapshot as well, then retain the live-schema comparison. Otherwise matching mistakes in the SQL and snapshot can pass while differing from `schema.ts`.
4. **Update stale status text.** `docs/architecture-v2.md` still says Ask may search account-wide and that fresh migration execution is pending. `CLAUDE.md` also says the disposable-database run is pending. Update those statements to the verified current state.
5. **Mark the old production backfill helper as partial and unsafe to run alone.** `scripts/backfill-projects.ts` omits sources, token constraints and vector reconciliation. Do not expand or run the production reconciliation in this round, but add a clear warning at the top pointing to this document and stating that the script is not the complete db:push reconciliation path.

Fresh verification performed by Codex final review: `pnpm test` passes 23/23, `pnpm lint` has zero errors (three unrelated warnings), `git diff --check` passes, and `pnpm build` passes with network access. The disposable migration database was no longer running, so the earlier live migration result could not be independently rerun; the checked-in verifier and migration were reviewed statically.

### Resolutions, 2026-07-21

All five points fixed:

1. **Real ownership checks, tested with real rows.** Validation is refactored into pure functions: `verifyProjectOwnership` in `lib/projects.ts` (row fetched by id alone, owner and id compared in the function) and `verifySourceOwnership` + `enforceTokenLock` in new `lib/ingest-validation.ts` (source row fetched by id alone, owner AND project compared in the function). The route tests now feed REAL foreign-owner and wrong-project rows through these helpers instead of empty mock results, plus 10 direct unit tests. Mutation-verified: removing the project owner comparison fails 6 tests, removing the source owner comparison fails 3 tests.
2. **UUID normalization.** `normalizeUuid` (lowercase) is applied in `verifyProjectOwnership`, `verifySourceOwnership` and `enforceTokenLock`, and `requireProjectId` normalizes before the db lookup. New JSON + multipart tests prove a locked token accepts its own project id in uppercase and lands the item in the locked project.
3. **Verifier compares actual defaults.** `schemaDefaultToString` renders each `schema.ts` column default (SQL expressions via `PgDialect.sqlToQuery`, strings quoted, booleans/objects serialized) and the schema-to-snapshot check now compares normalized default values, not just existence. The live-schema default comparison is retained.
4. **Stale status text updated.** `docs/architecture-v2.md` now states Ask requires an owned projectId (no user-wide retrieval) and that the fresh migration path has been executed and verified via `pnpm db:verify-fresh`. `CLAUDE.md` build state says the disposable-database run is done and only prod reconciliation/baselining remains.
5. **Backfill helper marked partial.** `scripts/backfill-projects.ts` has a warning header stating it is not the complete db:push reconciliation path (omits sources, token FK change, vector reconciliation) and pointing to this document's reconciliation section. Nothing was expanded or run against prod.

Rerun after the fixes: `pnpm test` 35/35 pass (23 original + 12 new), `pnpm lint` 0 errors (3 pre-existing warnings), `pnpm build` passes, and `pnpm db:verify-fresh` against a fresh disposable `pgvector/pgvector:pg17` container passed with the stricter default comparison: 10 tables, 88 columns, 11 foreign keys, 11 indexes. Prod untouched.

## Final status, 2026-07-21

### Changed files in this effort

Code:

- `lib/projects.ts` — `InvalidProjectError`, `requireProjectId` (explicit id must exist and be owned, invalid UUID rejected), `defaultProjectId` for omitted id. Silent fallback removed.
- `lib/ingest-auth.ts` — token project is a hard lock (`lockedProjectId`), never a default.
- `app/api/ingest/route.ts` + `app/api/ingest/deps.ts` — sourceId ownership and project-membership validation, 403 on locked-token project mismatch, all validation before Blob `put()` and Inngest, dedup after validation.
- `app/api/capture/route.ts` + `app/api/capture/deps.ts` — same validate-before-upload order.
- `app/api/ask/route.ts` + `app/api/ask/deps.ts` — projectId required and ownership-verified, 400 otherwise. No account-wide search remains.
- `app/api/sources/route.ts`, `app/api/pipelines/route.ts` — translate `InvalidProjectError` to 400.
- `lib/db/schema.ts` — `source.projectId` notNull, `ingest_token.projectId` onDelete cascade with the never-unlocked invariant documented, `drop` removed from kind comment.
- `lib/db/migrations/0001_secret_violations.sql` + `meta/0001_snapshot.json` + `meta/_journal.json` — new 0001 delta, hand-corrected to create `source` with NOT NULL directly, no backfill (fresh-database path only).
- `lib/ingest-validation.ts` — pure source ownership and token-lock validation with normalized UUID comparisons.
- `tests/api-isolation.test.ts` — 35 isolation and validation tests, including JSON and multipart.
- `scripts/verify-fresh-migrations.ts` — reproducible migration verification (`pnpm db:verify-fresh`), plus three corrections found during the live run: order-insensitive column comparison, boolean snapshot defaults, Postgres `text[]` string form parsed.
- `scripts/backfill-projects.ts` — explicitly marked as a partial helper that is unsafe to use as the complete prod reconciliation.
- `package.json` — `test` and `db:verify-fresh` scripts.

Docs:

- `docs/architecture-v2.md` — review moved before mail, persist-Ask-conversations build step, move/copy semantics, token scope decided, [id]-endpoint user-scoping marked as remaining work, "deferred to later" section (source_rule, token UI, Slack teamId/mode, upload progress).
- `docs/ui-layout-v2.md` — move/copy semantics consistent with architecture-v2.
- `CLAUDE.md` — `audio` type removed, digest cron mismatch noted, baselining referenced.
- `docs/review-fix-plan-2026-07-21.md` — this plan.

The working tree also contains earlier uncommitted UI work (`app/sidebar.tsx`, `app/capture-form.tsx`, `app/dashboard-ask.tsx`, `app/ask-chat.tsx`, `app/library-table.tsx`, `app/p/[slug]/ask/`, `app/p/[slug]/library/[id]/` and related pages) that is NOT part of this plan and should be committed separately.

### Test result

`pnpm test`: 35/35 pass, 0 fail, 0 skipped. Covers invalid/foreign/malformed projectId on capture, ingest and ask; real project and source ownership comparisons; foreign and wrong-project sourceId; case-insensitive locked-token matching and 403 on actual mismatch; unlocked token choosing an owned project; and that rejected file requests call neither Blob `put()` nor `inngest.send()`. JSON and multipart both covered.

### Build result

`pnpm build`: passes (full Next.js production build with network; the earlier failure was only the Codex sandbox blocking the `next/font` Geist fetch).

### Migration verification

`pnpm db:verify-fresh` against a throwaway empty `pgvector/pgvector:pg17` container (Neon wsproxy in front for the serverless driver): **passed**. 0000 + 0001 applied in order; 10 tables, 88 columns, 11 foreign keys and 11 indexes match `schema.ts`, including both onDelete cascades, the HNSW opclass and `vector(768)`. The script refuses `DATABASE_URL` and non-empty databases. Prod untouched; baselining documented in the reconciliation section, not performed.

## Review findings, ranked

Review of docs (architecture-v2, ui-layout-v2, wireframe HTML, CLAUDE.md) against the actual code in `lib/`, `app/api/` and `app/p/[slug]/`.

### Critical

1. **Silent project fallback.** `resolveProjectId` in `lib/projects.ts` falls back to the default inbox when a provided projectId is invalid or belongs to another user. This violates the architecture rule "No API may silently fall back to a different project when an explicit project id is invalid" (architecture-v2.md line 75). Data can silently land in the wrong project.
2. **Unvalidated sourceId in `/api/ingest`.** The route accepts any sourceId/externalId without checking ownership or project membership. Cross-project corruption is possible, and the global unique index on `(source_id, external_id)` lets a caller probe or block another user's inserts.
3. **Stale migrations.** `lib/db/migrations/` has one file with 7 tables and `vector(1536)`. The schema has 10 tables and `vector(768)`. A fresh database cannot be built from migrations. Prod was created via `db:push` and has never run the migration path.

### High

4. **Ask is account-wide.** `/api/ask` treats projectId as optional and searches all the user's chunks across projects when omitted. The wireframe promises "Svar hämtas bara från detta projekt."
5. **Ingest token project is a default, not a lock.** The wireframe describes tokens as bound to a project. The code only uses the token's projectId as a fallback default. There is also no token issuance or revocation API or UI.
6. **Build order dependency error.** The build order puts review (step 6) after mail (step 5), but the mail setup flow's "lägg i granskningskön" branch requires the review queue.

### Medium

7. **No source_rule table**, `drop` source kind is documented but the code uses `sourceId null` for manual capture, and `source.project_id` is nullable while the doc says not null.
8. **Conversations never persisted.** `conversation` and `message` tables exist but Ask never writes them. Wireframes show follow-ups and "cited in 2 conversations." Not in any build phase.
9. **Move to project** is fully specified in ui-layout-v2 but absent from every build order. It is also the recovery path for finding 1.

### Low

10. Seeded weekly-digest runs Sunday 09:00, templates say Friday 15:00, and the digest page depends on the magic pipeline name `weekly-digest`.
11. Slack source config stores only channelId; doc says teamId + mode.
12. CLAUDE.md claims an `audio` item type that is unsupported.
13. Capture wireframe shows a progress percentage that has no backing.

### What checked out

Per-id routes check userId ownership, blob serving is authenticated with a documented legacy-public fallback, the UI passes projectId everywhere, and the wireframe status badges are mostly honest.

## Adjustments decided before implementation

Henrik's adjustments to the first draft:

1. Do not rewrite migration 0000. Generate and hand-review a 0001 delta. Verify 0000 + 0001 against a fresh temporary database. Never run migrations against the db:push-created prod database; compare schema, back up, and document safe baselining first.
2. Use a typed `InvalidProjectError` that all affected routes translate to HTTP 400. Invalid UUID format also gives 400.
3. Extra test cases: Ask with invalid or foreign projectId, locked token without projectId uses the locked project, unlocked token may choose a valid project, JSON and multipart for `/api/ingest`, invalid UUID formats.
4. Manual capture has `sourceId null`. Remove `drop` as a source kind from docs and schema comments.
5. Do not schedule "move to project" as implementation-ready yet. Document the semantics first: manual material can be moved, material from automatic sources is copied instead, since a source belongs to one project and a moved item would otherwise get a cross-project sourceId.
6. Note that item, source and pipeline `[id]` endpoints are still only user-scoped. Documented as remaining work; user-scoping is sufficient isolation until project sharing lands.

Codex review feedback, all accepted:

1. Schema changes must land in `schema.ts` before the 0001 delta is generated, and the migration must backfill `source.project_id` before adding NOT NULL.
2. `ingest_token.projectId` uses `onDelete: "set null"`, which would silently unlock a project-bound token when its project is deleted. Change to `onDelete: "cascade"`.
3. Both file routes upload to Blob before project validation. Validate project, token and sourceId before `put()`. Tests must assert Blob and Inngest are not called on rejected requests.
4. The copy-vs-move semantics for automatic sources must update `ui-layout-v2.md` line 199 in the same pass, or the docs contradict each other.
5. "Matches schema.ts" needs a concrete verification method, not a judgment call.
6. Findings that are neither fixed nor scheduled must be listed as explicitly deferred so the plan is traceable.

Correction after the first Codex run (2026-07-21):

- The `source` table is first created in 0001 (0000 only has 7 tables and source is not one of them). A backfill of `source.project_id` therefore does not belong in the fresh-install migration; on a fresh database the table is empty when created. 0001 creates source with NOT NULL directly.
- Treat 0000 + 0001 strictly as the path for an empty database.
- The existing db:push-created database gets a separate, future reconciliation, documented in the next section. Nothing from it is run against prod now.

## Reconciliation for the existing db:push database (future, not run now)

> **Superseded by [`prod-db-reconciliation-runbook.md`](prod-db-reconciliation-runbook.md).**
> This outline predated migrations 0002–0006 and only covered baselining onto
> 0000 + 0001. The runbook extends it to the full 0000→0006 path, adds
> `scripts/baseline-migrations.ts` (with a prod guard), and the baseline-then-
> migrate mechanism is now tested to converge to a fresh migrate via
> `scripts/test-reconciliation.sh`. Use the runbook; the steps below remain as
> the original rationale.

The prod database was created with `pnpm db:push` and has never run the migration path. Before it can be baselined onto 0000 + 0001, run this reconciliation, in order, against a backup-verified copy first:

1. Take a backup and verify it restores.
2. Compare the prod schema against the result of 0000 + 0001 on a fresh database (information_schema + pg_indexes). Every difference must be explained before proceeding.
3. Create missing inbox projects for any user who has orphaned rows.
4. List all `source` rows with `project_id IS NULL`, backfill them to the owner's inbox project, and log every moved source id so the move is auditable.
5. Add NOT NULL to `source.project_id`.
6. Change the `ingest_token.project_id` foreign key from set null to cascade.
7. Handle old `vector(1536)` embeddings: the column type change to `vector(768)` cannot convert existing data. Decide per corpus: re-embed affected chunks, or truncate and reprocess the items. This must be an explicit step, never an implicit ALTER.
8. Only after all of the above match the fresh-install result: mark 0000 + 0001 as applied in the drizzle journal (baselining).

## Verification log, 2026-07-21

- Step 1 was verified in `lib/db/schema.ts`: `source.projectId` is not null, project-bound ingest tokens cascade on project deletion with the invariant documented, and manual capture is represented by `sourceId = null` rather than a `drop` source kind.
- Step 2 was statically verified: 0001 creates `project`, `source` and `ingest_token`, creates `source.project_id` as not null, adds the remaining project relations, changes the embedding to `vector(768)`, and contains no `INSERT` or `UPDATE` backfill.
- Reproducible live verification is checked in as `pnpm db:verify-fresh`. It refuses `DATABASE_URL`, refuses non-empty databases, runs 0000 + 0001 through the Drizzle migrator, compares the live tables, columns, nullability, defaults, foreign keys/on-delete actions, unique and ordinary indexes, HNSW opclass and vector dimensions against `schema.ts` through its generated snapshot.
- The live temporary-database run could not be performed in the Codex sandbox (no Postgres binaries, no Docker socket, no network). RESOLVED same day outside the sandbox: a throwaway `pgvector/pgvector:pg17` container behind Neon `wsproxy` was stood up, `pnpm db:verify-fresh` ran 0000 + 0001 against it and passed: 10 tables, 88 columns, 11 foreign keys, 11 indexes all match `schema.ts`. Three script corrections were needed and are checked in: column comparison is order-insensitive (ALTER-based deltas append columns, ordinal position carries no meaning), snapshot defaults may be booleans, and the Neon driver returns `text[]` as `{a,b}` strings which are now parsed before comparison. No command was run against the existing db:push-created database or production database.
- `pnpm build` could not complete in the Codex sandbox because `next/font` fetches Geist from Google Fonts. RESOLVED same day outside the sandbox: the full production build passes with network access. No font or UI changes were made.

## Codex prompt

```
Uppdatera Trove (~/sites/trove) utifrån granskningen av architecture-v2 mot koden.
Gör stegen i exakt denna ordning. Inga nya funktioner utöver det som listas.
Små diffar, behåll befintlig kodstil. Skriv tester där det anges.

1. Schemaändringar först (lib/db/schema.ts) — REDAN UTFÖRT, verifiera bara
   a) source.projectId är notNull.
   b) ingestToken.projectId har onDelete "cascade" med regeln som kommentar:
      en projektlåst token får aldrig bli upplåst, den försvinner med
      projektet.
   c) "drop" är borttaget ur kind-kommentaren på source. Manuell capture
      har sourceId null och är ingen source-kind.

2. Databas-migrering 0001 — REDAN UTFÖRD OCH KORRIGERAD, verifiera bara
   0001_secret_violations.sql skapar project, source och ingest_token,
   lägger project_id på övriga tabeller och byter embedding till
   vector(768). source skapas med project_id NOT NULL direkt.
   VIKTIGT: 0000 + 0001 är vägen för en TOM databas. Ingen backfill hör
   hemma här, source skapas ju först i 0001. Lägg inte tillbaka någon
   INSERT eller UPDATE i migreringen.
   Verifiering, konkret metod, inte en bedömning:
   - skapa en helt tom tillfällig databas (Neon-branch eller lokal Postgres)
   - kör 0000 + 0001 i ordning via migreringsrunnern
   - läs tillbaka schemat (information_schema + pg_indexes) och jämför mot
     schema.ts: tabeller, kolumner, null-barhet, defaults, foreign keys med
     onDelete-beteende, unika index, HNSW-indexet och vector(768)
   - skriptet eller kommandona checkas in så verifieringen går att köra om
   Kör INGENTING mot den befintliga db:push-skapade databasen. Dess väg är
   reconciliation-proceduren i docs/review-fix-plan-2026-07-21.md
   (avsnittet "Reconciliation for the existing db:push database").
   Referera den från CLAUDE.md, utför den inte.

3. Ta bort tyst projekt-fallback (kritisk)
   Fil: lib/projects.ts (resolveProjectId) och alla anropare
   (app/api/capture, app/api/ingest, app/api/sources, app/api/pipelines).
   Regel enligt docs/architecture-v2.md rad 75: ett UTELÄMNAT projectId får
   falla tillbaka till inbox, men ett ANGIVET projectId som inte finns eller
   inte ägs av användaren ska ge fel, aldrig tyst hamna i inbox.
   Implementera med ett typat InvalidProjectError som kastas från
   requireProjectId(userId, provided). Alla berörda routes fångar det och
   översätter till HTTP 400. Ett ogiltigt UUID-format ska också ge 400,
   inte en databaskrasch. Utelämnat projectId går via defaultProjectId(userId).

4. Validera sourceId i /api/ingest (kritisk)
   Fil: app/api/ingest/route.ts.
   Om sourceId anges: verifiera att källan finns, ägs av samma userId OCH
   har samma projectId som det resolvade projektet. Annars 400.
   Ogiltigt UUID-format ger också 400. Flytta dedup-kollen (findDuplicate)
   till efter denna validering.

5. Validera före uppladdning (medel, gäller båda filrutterna)
   Filer: app/api/capture/route.ts och app/api/ingest/route.ts.
   I dag skrivs filen till Blob innan projektet valideras, så ett avvisat
   anrop lämnar en övergiven fil. Ordningen i filgrenen ska vara:
   auth → projekt → token-lås → sourceId → dedup → put() → insert → inngest.
   Inga Blob- eller Inngest-anrop får ske för ett anrop som avvisas.

6. Kräv projectId i /api/ask (hög)
   Fil: app/api/ask/route.ts. projectId blir obligatoriskt. 400 om det
   saknas, har ogiltigt format, inte finns eller inte ägs av användaren.
   Ingen användarövergripande sökning får finnas kvar. UI:t skickar redan
   projectId, så inga klientändringar ska behövas, men verifiera anroparen.

7. Lås ingest-token till projekt (hög)
   Fil: lib/ingest-auth.ts och app/api/ingest/route.ts.
   Semantik: en token med projectId är LÅST till det projektet. Om anropet
   anger ett annat projectId ska svaret bli 403. En token med projectId null
   får posta till alla användarens giltiga projekt. Cascade-regeln från
   steg 1b är en del av modellen: en låst token kan aldrig bli upplåst.
   Uppdatera kommentarer och docs/architecture-v2.md ("Ingest token scope"
   under öppna frågor).

8. Isoleringstester
   Välj testramverk om inget finns, enklast vitest mot route-handlers med
   mockad db, eller integrationstest mot en tillfällig databas.
   Täck minst, för BÅDE JSON och multipart där /api/ingest berörs:
   - capture/ingest med ogiltigt projectId ger 400, inget item skapas
   - capture/ingest med ogiltigt UUID-format ger 400
   - ingest med annan användares sourceId ger 400
   - ingest med egen källa i fel projekt ger 400
   - avvisade filanrop anropar varken Blob put() eller inngest.send()
   - ask utan projectId ger 400
   - ask med ogiltigt eller annan användares projectId ger 400
   - projektlåst token utan projectId i anropet landar i det låsta projektet
   - projektlåst token med annat projectId i anropet ger 403
   - olåst token med giltigt eget projectId landar i det projektet
   - om integrationstest: radering av tokenens projekt raderar tokenen
     (annars räcker cascade-regeln i schemat plus kommentaren)

9. Dokumentuppdateringar (efter kodfixarna)
   - docs/architecture-v2.md byggordning: flytta granskningskön (review)
     före mail, eftersom mail-flödets "lägg i granskningskön" kräver den.
     Alternativt notera uttryckligen att mail v1 saknar granskningsgrenen.
   - Lägg till "persist Ask conversations" som explicit byggsteg.
   - "Move to project" är INTE implementeringsklart. Dokumentera semantiken:
     manuellt material (sourceId null) kan flyttas rakt av, material från
     automatiska källor kopieras i stället, eftersom en source hör till ett
     projekt och ett flyttat item annars skulle få en cross-project
     sourceId. Uppdatera SAMTIDIGT docs/ui-layout-v2.md (avsnittet "What
     move does under the hood", rad ~199) som i dag säger att samma item
     alltid flyttas utan ny bearbetning. Båda dokumenten ska beskriva samma
     modell. Ingen kod för detta nu.
   - Ta bort "drop" som source-kind ur alla dokument, i linje med steg 1c.
   - Notera i architecture-v2.md att [id]-endpoints för item, source och
     pipeline i dag bara är user-scopade, inte projektscopade. Markera det
     uttryckligen som kvarvarande arbete tills projektdelning byggs.
   - CLAUDE.md: ta bort "audio" ur item-typerna, den stöds inte.
   - Notera att seedad weekly-digest kör söndag 09:00 medan mallarna anger
     fredag 15:00, och att digest-sidan beror på pipelinenamnet
     "weekly-digest". Ska förenas när mallväljaren byggs.
   - Lägg till avsnittet "Avgränsat till senare" i architecture-v2.md med
     fynden som medvetet INTE åtgärdas nu, så planen är spårbar:
     · source_rule-tabellen (regler ligger tills vidare i source.config)
     · tokenhantering i UI (skapa och återkalla ingest-tokens)
     · Slack-konfiguration (teamId och mode saknas, bara channelId lagras)
     · uppladdningsprocent i capture-wireframen (ingen backing finns)

Acceptanskriterier:
- Alla API-beteenden ovan bevisade med tester som går grönt.
- pnpm build går igenom.
- Verifieringen i steg 2 är körd mot en tom tillfällig databas och
  skriptet/kommandona är incheckade.
- Prod-databasen är orörd. Baselining är dokumenterad, inte utförd.
- Inga ändringar i UI-flöden eller nya produktytor.
- ui-layout-v2.md och architecture-v2.md säger samma sak om move.
Rör inte: pipelines-motorn, Inngest-funktionerna, Tauri-appen.
```
