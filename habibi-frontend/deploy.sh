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

# public/images/ (391MB, ~1000 files) is a direct copy into dist/images/ but
# was never synced by this script at all -- it only ever handled assets/ +
# index.html, so any newly-added image silently 404'd in production despite
# building fine locally (found via /images/collab/*.svg). Too large to
# scp -r wholesale on every deploy, and rsync isn't available on this
# machine (only on the server) -- so diff local vs. remote file *paths*
# and upload only what's new. Path-only (not content-hash) is a deliberate
# fit for this project's convention of giving changed images new filenames
# (e.g. "-v2", "-fixed") rather than overwriting existing ones in place.
echo "▶ Syncing new images..."
LOCAL_IMG_LIST=$(mktemp)
REMOTE_IMG_LIST=$(mktemp)
find "${LOCAL_DIST}/images" -type f 2>/dev/null | sed "s|^${LOCAL_DIST}/||" | sort > "$LOCAL_IMG_LIST"
ssh "$REMOTE" "find '${REMOTE_DIR}/images' -type f 2>/dev/null | sed 's|^${REMOTE_DIR}/||'" | sort > "$REMOTE_IMG_LIST"
NEW_IMAGES=$(comm -23 "$LOCAL_IMG_LIST" "$REMOTE_IMG_LIST")
if [ -n "$NEW_IMAGES" ]; then
  # `ssh`/`scp` inside this loop must have stdin redirected from /dev/null --
  # ssh reads its own stdin by default, and without this it silently steals
  # bytes from the very pipe `read -r rel` is consuming, causing lines (i.e.
  # whole images) to be randomly skipped with no error whenever more than
  # one new image is uploaded in the same deploy.
  #
  # Piping into the while loop (`echo "$NEW_IMAGES" | while ...`) runs the
  # loop in a subshell -- with `set -e` active, one transient ssh/scp
  # failure (e.g. a dropped connection) silently kills that subshell mid-
  # loop, abandoning every image after the failed one with NO error and NO
  # indication anything was skipped. The final count below was also always
  # just the *intended* list length, not actual successes, so a partial
  # failure like this reported "uploaded 4 new image(s)" even when only 1
  # actually made it to the server (found 2026-08-30: 3 of 4 new payment
  # logos silently 404'd in production despite this exact message).
  # A here-string (`<<<`) keeps the loop in the current shell instead of a
  # subshell, and wrapping each upload in its own `if` stops a single
  # failure from tripping `set -e` -- so one bad upload is reported and
  # skipped, not allowed to silently swallow every image queued after it.
  UPLOAD_OK=0
  UPLOAD_FAILED=0
  while IFS= read -r rel; do
    if ssh "$REMOTE" "mkdir -p \"\$(dirname '${REMOTE_DIR}/${rel}')\"" < /dev/null \
       && scp "${LOCAL_DIST}/${rel}" "${REMOTE}:${REMOTE_DIR}/${rel}" < /dev/null; then
      UPLOAD_OK=$((UPLOAD_OK + 1))
    else
      UPLOAD_FAILED=$((UPLOAD_FAILED + 1))
      echo "  ⚠ FAILED to upload: $rel"
    fi
  done <<< "$NEW_IMAGES"
  echo "  uploaded $UPLOAD_OK new image(s)"
  if [ "$UPLOAD_FAILED" -gt 0 ]; then
    echo "  ⚠ $UPLOAD_FAILED image(s) failed -- re-run deploy.sh to retry, or upload manually"
  fi
else
  echo "  no new images"
fi
rm -f "$LOCAL_IMG_LIST" "$REMOTE_IMG_LIST"

echo "▶ Cleaning up old assets..."
ssh "$REMOTE" "rm -rf ${REMOTE_DIR}/assets_old"

echo "✓ Deploy complete"
