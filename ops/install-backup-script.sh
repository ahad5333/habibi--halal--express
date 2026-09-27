#!/usr/bin/env bash
# Install ops/habibi-db-backup.sh as the script cron actually runs.
#
# Why this exists: cron runs /usr/local/bin/habibi-db-backup.sh, which is a
# COPY. On 2026-09-13 someone fixed a real bug in that copy (the dump's
# completion marker was looked for in the last 5 lines, and pg_dump can emit
# more than that -- so a good backup could be judged truncated and DELETED).
# The fix never came back to the repo, so for two weeks the version under
# version control was stale and editing it protected nothing. Found 2026-09-27.
#
# Cron is deliberately NOT pointed at the repo copy: that script runs as root,
# and sourcing a root cron job straight out of a git working tree would mean
# anyone who can push to the repo controls a root job. The installed copy stays
# root-only (700), and this script is how it gets there.
#
# Usage:
#   bash install-backup-script.sh --check    report drift, change nothing
#   bash install-backup-script.sh            install if it differs
#   bash install-backup-script.sh --force    reinstall even if identical
set -e

REMOTE="habibi-server"
TARGET="/usr/local/bin/habibi-db-backup.sh"
HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="$HERE/habibi-db-backup.sh"

MODE="${1:-install}"
[ -f "$SRC" ] || { echo "  !! $SRC not found"; exit 1; }

# Ship LF, always. core.autocrlf is true on the Windows dev machine, so a plain
# `git checkout` of this file produces CRLF in the working tree -- and bash on
# the server fails on the first \r. Uploading the working copy verbatim would
# install a root cron script that cannot run. Normalising here also means the
# hash comparison below is comparing like with like, whatever anyone's git
# config or editor does. Confirmed the hard way 2026-09-27.
NORM="$(mktemp)"
trap 'rm -f "$NORM"' EXIT
tr -d '\r' < "$SRC" > "$NORM"

# Never ship a script that cannot parse -- this one runs unattended as root.
bash -n "$NORM" || { echo "  !! $SRC has a syntax error -- refusing to install"; exit 1; }

LOCAL_H=$(sha256sum "$NORM" | cut -d' ' -f1)
REMOTE_H=$(ssh "$REMOTE" "sha256sum '$TARGET' 2>/dev/null | cut -d' ' -f1" < /dev/null | tr -d ' \r')

echo "  repo      : ${LOCAL_H:0:24}"
echo "  installed : ${REMOTE_H:0:24}${REMOTE_H:+}"
[ -n "$REMOTE_H" ] || echo "              (not installed yet)"

if [ "$LOCAL_H" = "$REMOTE_H" ]; then
  if [ "$MODE" != "--force" ]; then
    echo "  in sync -- nothing to do"
    exit 0
  fi
  echo "  in sync, but --force given"
elif [ "$MODE" = "--check" ]; then
  echo "  !! DRIFT: what runs nightly is not what is in the repo"
  echo "     run without --check to install the repo version"
  exit 1
fi

[ "$MODE" = "--check" ] && exit 0

echo "▶ Uploading..."
scp -q "$NORM" "${REMOTE}:/tmp/habibi-db-backup.new"

echo "▶ Checking it parses on the server, then installing root-only..."
ssh "$REMOTE" "
  set -e
  bash -n /tmp/habibi-db-backup.new
  install -m 700 -o root -g root /tmp/habibi-db-backup.new '$TARGET'
  rm -f /tmp/habibi-db-backup.new
" < /dev/null

INSTALLED_H=$(ssh "$REMOTE" "sha256sum '$TARGET' | cut -d' ' -f1" < /dev/null | tr -d ' \r')
if [ "$INSTALLED_H" != "$LOCAL_H" ]; then
  echo "  !! installed copy does not match the repo -- investigate"
  exit 1
fi

echo "  installed and verified: ${INSTALLED_H:0:24}"
echo "▶ What cron runs:"
ssh "$REMOTE" "crontab -l 2>/dev/null | grep habibi-db-backup || echo '  !! no crontab entry found -- the script is installed but nothing calls it'" < /dev/null
echo
echo "✓ Done"
