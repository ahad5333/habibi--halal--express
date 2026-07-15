#!/usr/bin/env bash
# Atomic frontend deploy — no broken window
# Usage: bash deploy.sh

set -e

REMOTE="habibi-server"
REMOTE_DIR="/var/www/habibi/habibi-frontend/dist"
LOCAL_DIST="$(dirname "$0")/dist"

echo "▶ Building..."
cd "$(dirname "$0")"
npm run build

echo "▶ Uploading new assets to staging folder..."
ssh "$REMOTE" "rm -rf ${REMOTE_DIR}/assets_new"
scp -r "${LOCAL_DIST}/assets" "${REMOTE}:${REMOTE_DIR}/assets_new"

echo "▶ Atomic swap (zero downtime)..."
ssh "$REMOTE" "
  mv ${REMOTE_DIR}/assets ${REMOTE_DIR}/assets_old 2>/dev/null || true
  mv ${REMOTE_DIR}/assets_new ${REMOTE_DIR}/assets
"

echo "▶ Uploading index.html..."
scp "${LOCAL_DIST}/index.html" "${REMOTE}:${REMOTE_DIR}/index.html"

echo "▶ Cleaning up old assets..."
ssh "$REMOTE" "rm -rf ${REMOTE_DIR}/assets_old"

echo "✓ Deploy complete"
