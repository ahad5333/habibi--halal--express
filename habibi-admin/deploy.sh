#!/usr/bin/env bash
# Atomic admin deploy -- built HERE, then shipped.
#
# This used to run `git pull && npm install && npm run build` over ssh on the
# droplet itself. That box has 1 vCPU, ~2 GB of RAM and no swap, and it is the
# same box PM2 serves the live backend from. A vite build peaks well above what
# is free there, and the OOM killer does not check whether the process it reaps
# happens to be production. Building locally and shipping the result costs the
# server nothing but a file copy.
#
# Mirrors habibi-frontend/deploy.sh, which has always worked this way.
# Usage: bash deploy.sh
set -e

REMOTE="habibi-server"
REMOTE_ADMIN="/var/www/habibi/habibi-admin"
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE"

# Shared guards (see ops/deploy-guards.sh): each was a manual checklist line.
source ../ops/deploy-guards.sh
guard_clean_tree habibi-admin

# Vite bakes VITE_* vars into the bundle at build time, and the only copy of the
# production values lives on the server (there is no .env.production in the
# repo -- it is gitignored). Building here without it would silently fall back
# to the local dev .env and ship an admin panel pointed at localhost.
#
# So: fetch it for the build, delete it afterwards. The server stays the single
# source of truth, this machine keeps no copy, and the values are never printed.
ENV_FILE="$HERE/.env.production"
FETCHED=""
if [ -f "$ENV_FILE" ]; then
  echo "▶ Using the .env.production already here"
else
  echo "▶ Fetching production env from the server (contents not shown)..."
  scp -q "${REMOTE}:${REMOTE_ADMIN}/.env.production" "$ENV_FILE"
  FETCHED=1
fi
cleanup() { [ -n "$FETCHED" ] && rm -f "$ENV_FILE"; }
trap cleanup EXIT

# A build with no API URL produces a panel that quietly talks to the wrong host
# and looks fine until someone tries to use it. Check the key is there and
# non-empty without echoing what it is.
if ! grep -q '^VITE_API_URL=.\+' "$ENV_FILE"; then
  echo "  !! .env.production has no VITE_API_URL -- refusing to build"
  exit 1
fi

# Same check as the website deploy: a phone/desktop rule cancelled by a
# later rule builds fine and only shows up as a broken layout.
echo "▶ Checking CSS for cancelled @media overrides..."
node scripts/check-dead-media.cjs

guard_vite_secrets .

echo "▶ Building locally..."
npm run build
[ -f dist/index.html ] || { echo "  !! build produced no dist/index.html -- stopping"; exit 1; }
guard_dist_secrets dist

echo "▶ Uploading to a staging folder (live dist untouched)..."
ssh "$REMOTE" "rm -rf '${REMOTE_ADMIN}/dist_new'" < /dev/null
scp -rq dist "${REMOTE}:${REMOTE_ADMIN}/dist_new"

# scp has exited 0 on a partial upload in this project before -- that is exactly
# how a half-deployed site happens. Check the far end, not the exit code, and do
# it BEFORE anything is swapped in.
echo "▶ Verifying the upload..."
LOCAL_N=$(find dist -type f | wc -l | tr -d ' ')
REMOTE_N=$(ssh "$REMOTE" "find '${REMOTE_ADMIN}/dist_new' -type f | wc -l" < /dev/null | tr -d ' \r')
LOCAL_H=$(sha256sum dist/index.html | cut -d' ' -f1)
REMOTE_H=$(ssh "$REMOTE" "sha256sum '${REMOTE_ADMIN}/dist_new/index.html' | cut -d' ' -f1" < /dev/null | tr -d ' \r')
echo "  files local/remote : ${LOCAL_N}/${REMOTE_N}"
echo "  index.html local   : ${LOCAL_H:0:16}"
echo "  index.html remote  : ${REMOTE_H:0:16}"
if [ "$LOCAL_N" != "$REMOTE_N" ]; then
  echo "  !! file count differs -- NOT swapping. The live panel is untouched."
  exit 1
fi
if [ "$LOCAL_H" != "$REMOTE_H" ]; then
  echo "  !! index.html hash differs -- NOT swapping. The live panel is untouched."
  exit 1
fi

# The previous build is kept as dist_old rather than deleted, so a bad deploy is
# one command to undo instead of a rebuild.
echo "▶ Atomic swap..."
ssh "$REMOTE" "
  set -e
  cd '${REMOTE_ADMIN}'
  rm -rf dist_old
  if [ -d dist ]; then mv dist dist_old; fi
  mv dist_new dist
" < /dev/null

echo "▶ Confirming what is live now..."
LIVE_H=$(ssh "$REMOTE" "sha256sum '${REMOTE_ADMIN}/dist/index.html' | cut -d' ' -f1" < /dev/null | tr -d ' \r')
if [ "$LIVE_H" != "$LOCAL_H" ]; then
  echo "  !! live index.html does not match what was built -- investigate before trusting this deploy"
  exit 1
fi
echo "  live matches the local build"
echo
echo "✓ Deploy complete"
echo "  roll back with: ssh ${REMOTE} \"cd ${REMOTE_ADMIN} && rm -rf dist && mv dist_old dist\""
