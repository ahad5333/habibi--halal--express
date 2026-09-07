#!/usr/bin/env bash
# Nightly Postgres backup for Habibi Halal Express.
#
# The database runs locally on this droplet (DB_HOST=localhost) rather than as
# a managed database, so nothing was snapshotting it -- a disk failure would
# have taken every order, customer, loyalty balance and gift card with it.
# Gift cards in particular represent money customers have already paid.
#
# Reads credentials from the app's own .env so they can never drift apart.
# Keeps RETENTION_DAYS of dumps and deletes older ones.
#
# IMPORTANT: these dumps live on the same droplet as the database. That covers
# accidental deletion, a bad migration, or table corruption -- it does NOT
# cover losing the droplet itself. Offsite copies still need setting up.

set -uo pipefail

ENV_FILE="/var/www/habibi/habibi-backend/.env"
BACKUP_DIR="/var/backups/habibi-db"
RETENTION_DAYS=14
LOG="/var/log/habibi-db-backup.log"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG"; }

# Pull only the DB_* values, tolerating optional quotes, without sourcing the
# whole file (it contains keys with characters bash would try to interpret).
getval() {
  sed -n "s/^$1=//p" "$ENV_FILE" | head -1 | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"
}

DB_HOST="$(getval DB_HOST)"
DB_PORT="$(getval DB_PORT)"
DB_NAME="$(getval DB_NAME)"
DB_USER="$(getval DB_USER)"
DB_PASSWORD="$(getval DB_PASSWORD)"

if [ -z "$DB_NAME" ] || [ -z "$DB_USER" ]; then
  log "ABORT: could not read DB credentials from $ENV_FILE"
  exit 1
fi

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

STAMP="$(date '+%Y%m%d-%H%M%S')"
OUT="$BACKUP_DIR/habibi-${STAMP}.sql.gz"

export PGPASSWORD="$DB_PASSWORD"
if pg_dump -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "$DB_USER" \
     --no-owner --no-privileges "$DB_NAME" 2>>"$LOG" | gzip -9 > "$OUT"; then
  unset PGPASSWORD
  SIZE=$(du -h "$OUT" | cut -f1)

  # A dump that "succeeded" but is truncated is worse than no dump, because it
  # looks like protection. Verify the gzip stream is intact and the SQL ends
  # with pg_dump's own completion marker before trusting it.
  if ! gzip -t "$OUT" 2>>"$LOG"; then
    log "FAIL: $OUT is not a valid gzip archive - removing"
    rm -f "$OUT"
    exit 1
  fi
  if ! zcat "$OUT" | tail -5 | grep -q "PostgreSQL database dump complete"; then
    log "FAIL: $OUT is truncated (no completion marker) - removing"
    rm -f "$OUT"
    exit 1
  fi

  chmod 600 "$OUT"
  log "OK: $OUT ($SIZE)"
else
  unset PGPASSWORD
  log "FAIL: pg_dump errored, see above"
  rm -f "$OUT"
  exit 1
fi

DELETED=$(find "$BACKUP_DIR" -name 'habibi-*.sql.gz' -mtime +$RETENTION_DAYS -print -delete | wc -l)
[ "$DELETED" -gt 0 ] && log "pruned $DELETED backup(s) older than ${RETENTION_DAYS}d"

log "total backups on disk: $(find "$BACKUP_DIR" -name 'habibi-*.sql.gz' | wc -l)"
exit 0
