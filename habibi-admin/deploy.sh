#!/usr/bin/env bash
# Atomic admin deploy — built on the server itself (matches how this app has
# always been deployed, unlike habibi-frontend's local-build-then-scp) with
# npm install baked into the same sequence as the pull and build, so a newly
# added dependency (e.g. leaflet, added 2026-07-24) can never again sit
# uninstalled on the server while every subsequent build silently fails.
# Usage: bash deploy.sh

set -e

REMOTE="habibi-server"
REMOTE_ADMIN="/var/www/habibi/habibi-admin"

echo "▶ Pulling latest, installing dependencies, and building on the server..."
ssh "$REMOTE" "
  set -e
  cd '$REMOTE_ADMIN'
  git pull origin main
  npm install
  rm -rf dist_new
  npm run build -- --outDir dist_new
"

echo "▶ Atomic swap (zero downtime)..."
ssh "$REMOTE" "
  cd '$REMOTE_ADMIN'
  mv dist dist_old 2>/dev/null || true
  mv dist_new dist
  rm -rf dist_old
"

echo "✓ Deploy complete"
