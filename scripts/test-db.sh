#!/usr/bin/env bash
# Builds a scratch database from the migrations and seed, then runs the SQL checks in supabase/tests.
# Needs a Postgres 15+ server and psql. Connection comes from the usual PG* variables, for example:
#   PGHOST=localhost PGPORT=5432 PGUSER=postgres PGPASSWORD=postgres npm run test:db
set -euo pipefail
cd "$(dirname "$0")/.."
DB="${TEST_DB:-bloodgrid_test}"
PSQL=(psql -v ON_ERROR_STOP=1 -q -X)

"${PSQL[@]}" -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null
"${PSQL[@]}" -d "$DB" -f supabase/tests/00_supabase_stub.sql
for f in supabase/migrations/*.sql; do
  "${PSQL[@]}" -d "$DB" -f "$f" || { echo "Migration failed: $f"; exit 1; }
done
"${PSQL[@]}" -d "$DB" -f supabase/seed.sql
for f in supabase/tests/[1-9]*.sql; do
  echo "Running $f"
  "${PSQL[@]}" -d "$DB" -f "$f"
done
