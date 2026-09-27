#!/usr/bin/env bash
# Backend deploy: pull on the server, syntax-check what changed, then reload.
#
# Until now this lived nowhere -- the backend was deployed by typing `git pull`
# and `pm2 reload` by hand over ssh, which means the safe version of those steps
# (the guards below) existed only in whoever's memory ran it last.
#
# Three things this does that typing the commands does not:
#   1. Refuses to pull over uncommitted tracked changes on the server, instead
#      of silently clobbering or half-merging them.
#   2. Runs `node --check` on every backend .js file the pull changed, BEFORE
#      reloading. PM2 in cluster mode will happily reload into a syntax error
#      and take every worker down with it.
#   3. Reports each instance's status and restart count afterwards, so a crash
#      loop is visible here rather than discovered by a customer.
#
# Usage: bash deploy.sh [--dry-run]
#   --dry-run pulls and syntax-checks but does NOT reload. Safe to run anytime.
set -e

REMOTE="habibi-server"
DRY=""
if [ "$1" = "--dry-run" ]; then
  DRY="1"
  echo "▶ DRY RUN -- will pull and check, but not reload"
fi

# bash -s with a quoted heredoc: the remote block is sent over stdin verbatim,
# so nothing here is subject to two rounds of shell quoting.
ssh "$REMOTE" bash -s -- "$DRY" <<'REMOTE_SCRIPT'
set -e
DRY="$1"
cd /var/www/habibi

DIRTY=$(git status --porcelain --untracked-files=no)
if [ -n "$DIRTY" ]; then
  echo "  !! the server checkout has uncommitted tracked changes -- NOT deploying:"
  echo "$DIRTY" | sed 's/^/     /'
  echo "     commit, stash or revert them on the server, then re-run."
  exit 1
fi

BEFORE=$(git rev-parse HEAD)
echo "  before: $(git rev-parse --short HEAD)"
git pull --ff-only -q origin main
AFTER=$(git rev-parse HEAD)
echo "  after : $(git rev-parse --short HEAD)"

if [ "$BEFORE" = "$AFTER" ]; then
  echo "  nothing new to deploy"
fi

# Syntax-check every backend JS file this pull touched, before anything reloads.
CHANGED=$(git diff --name-only "$BEFORE" "$AFTER" -- habibi-backend | grep '\.js$' || true)
COUNT=$(printf '%s' "$CHANGED" | grep -c . || true)
for f in $CHANGED; do
  [ -f "$f" ] || continue   # deleted in this pull
  if ! node --check "$f"; then
    echo "  !! syntax error in $f -- NOT reloading."
    echo "     The code is already pulled, so fix it and redeploy; the running"
    echo "     workers are still on the old code and are still serving."
    exit 1
  fi
done
echo "  syntax check passed: ${COUNT} changed backend file(s)"

# Find the backend app by name rather than hardcoding it, so a rename doesn't
# turn this into a silent no-op.
APP=$(pm2 jlist | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const a=JSON.parse(d);const n=[...new Set(a.map(p=>p.name))].find(x=>/backend/i.test(x));console.log(n||"")})')
if [ -z "$APP" ]; then
  echo "  !! no backend process found in pm2 -- nothing to reload"
  exit 1
fi

if [ -n "$DRY" ]; then
  echo "  dry run: would reload pm2 app '$APP' -- stopping here"
  exit 0
fi

pm2 reload "$APP" --update-env >/dev/null && echo "  pm2 reload $APP: done"

# Give the workers long enough to either come up or start crash-looping.
sleep 8
pm2 jlist | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{
  const ps=JSON.parse(d).filter(p=>/backend/i.test(p.name));
  let bad=0;
  for(const p of ps){
    const s=p.pm2_env.status;
    if(s!=="online")bad++;
    console.log("  instance "+p.pm2_env.NODE_APP_INSTANCE+": "+s+", restarts "+p.pm2_env.restart_time);
  }
  if(bad){console.log("  !! "+bad+" instance(s) not online -- check: pm2 logs");process.exit(1);}
})'
REMOTE_SCRIPT

echo
echo "✓ Backend deploy complete"
