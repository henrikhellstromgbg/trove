#!/usr/bin/env bash
# Test the prod-DB reconciliation MECHANISM against throwaway local databases in
# the dev Docker Postgres. Never touches prod. Proves: a database that has an
# early schema but NO drizzle journal (the db:push situation), once baselined and
# forward-migrated, converges to exactly the same schema as a fresh full migrate.
set -euo pipefail

cd ~/sites/trove
PG="docker exec -i trove-pg psql -U trove -v ON_ERROR_STOP=1"
WS="localhost:54444/v1"
BASE_URL="postgres://trove:trove@trove-pg:5432"

TARGET_DB="recon_target"   # empty -> full db:migrate (canonical target)
SIM_DB="recon_sim"         # early schema, no journal -> baseline -> migrate

echo "== drop & recreate throwaway databases =="
for db in "$TARGET_DB" "$SIM_DB"; do
  docker exec -i trove-pg psql -U trove -d postgres -v ON_ERROR_STOP=1 \
    -c "DROP DATABASE IF EXISTS $db WITH (FORCE);" \
    -c "CREATE DATABASE $db;" >/dev/null
done

echo "== TARGET: full db:migrate (0000..0006) =="
DATABASE_URL="$BASE_URL/$TARGET_DB" DATABASE_WS_PROXY="$WS" \
  npx tsx lib/db/migrate.ts >/dev/null
echo "   done"

echo "== SIM: apply ONLY 0000+0001 SQL (simulates early db:push, no journal) =="
$PG -d "$SIM_DB" -c "CREATE EXTENSION IF NOT EXISTS vector;" >/dev/null
# Strip drizzle's --> statement-breakpoint markers; psql runs the rest.
for f in 0000_parallel_praxagora 0001_secret_violations; do
  sed 's/--> statement-breakpoint//g' "lib/db/migrations/${f}.sql" | $PG -d "$SIM_DB" >/dev/null
done
echo "   0000+0001 applied, no drizzle journal present"

echo "== SIM: confirm a forward migrate WITHOUT baselining would try to re-run 0000 (expected failure) =="
if DATABASE_URL="$BASE_URL/$SIM_DB" DATABASE_WS_PROXY="$WS" \
     npx tsx lib/db/migrate.ts >/tmp/recon_nobaseline.log 2>&1; then
  echo "   !! UNEXPECTED: migrate without baseline succeeded (should have collided)"; exit 1
else
  echo "   as expected, un-baselined migrate fails (would collide on existing objects)"
fi

echo "== SIM: baseline 0000+0001 into the drizzle journal =="
DATABASE_URL="$BASE_URL/$SIM_DB" DATABASE_WS_PROXY="$WS" \
  npx tsx scripts/baseline-migrations.ts --through 0001_secret_violations \
  --confirm-database "$SIM_DB"

echo "== SIM: forward migrate (should apply only 0002..0006) =="
DATABASE_URL="$BASE_URL/$SIM_DB" DATABASE_WS_PROXY="$WS" \
  npx tsx lib/db/migrate.ts >/dev/null
echo "   done"

echo "== compare schemas (columns, constraints, indexes) =="
SNAP_SQL="
SELECT 'col', table_schema, table_name, column_name, data_type, is_nullable, coalesce(column_default,'')
  FROM information_schema.columns WHERE table_schema='public'
UNION ALL
SELECT 'con', tc.table_schema, tc.table_name, tc.constraint_type, tc.constraint_name, '', ''
  FROM information_schema.table_constraints tc WHERE tc.table_schema='public'
    AND NOT (tc.constraint_type='CHECK' AND tc.constraint_name ~ '_not_null\$')
UNION ALL
SELECT 'idx', schemaname, tablename, indexname, indexdef, '', ''
  FROM pg_indexes WHERE schemaname='public'
ORDER BY 1,2,3,4,5;
"
docker exec -i trove-pg psql -U trove -d "$TARGET_DB" -At -F '|' -c "$SNAP_SQL" > /tmp/recon_target.snap
docker exec -i trove-pg psql -U trove -d "$SIM_DB"    -At -F '|' -c "$SNAP_SQL" > /tmp/recon_sim.snap

echo "   target: $(wc -l < /tmp/recon_target.snap) schema rows"
echo "   sim   : $(wc -l < /tmp/recon_sim.snap) schema rows"

if diff -u /tmp/recon_target.snap /tmp/recon_sim.snap > /tmp/recon_diff.txt; then
  echo ""
  echo "PASS: baselined+forward-migrated schema is IDENTICAL to a fresh full migrate."
else
  echo ""
  echo "FAIL: schemas differ:"; cat /tmp/recon_diff.txt; exit 1
fi

echo "== journal contents in SIM (should list all 7 migrations) =="
docker exec -i trove-pg psql -U trove -d "$SIM_DB" -At -F '|' \
  -c 'SELECT id, left(hash,12), created_at FROM "drizzle"."__drizzle_migrations" ORDER BY created_at;'

echo "== cleanup =="
for db in "$TARGET_DB" "$SIM_DB"; do
  docker exec -i trove-pg psql -U trove -d postgres -c "DROP DATABASE IF EXISTS $db WITH (FORCE);" >/dev/null
done
echo "done."
