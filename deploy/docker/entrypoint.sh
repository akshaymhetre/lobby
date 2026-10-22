#!/bin/sh
# Lobby container entrypoint: bring the database schema up to date, then run the real command.
# migrate.mjs holds a Postgres advisory lock, so web, worker and seed-demo can all start at once.
# Set LOBBY_SKIP_MIGRATIONS=1 to skip (for example when you run migrations as a separate step).
set -eu

if [ "${LOBBY_SKIP_MIGRATIONS:-0}" != "1" ]; then
  node /opt/lobby/migrate/migrate.mjs
fi

exec "$@"
