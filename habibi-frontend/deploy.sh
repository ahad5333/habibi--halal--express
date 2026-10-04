#!/usr/bin/env bash
# Atomic frontend deploy — no broken window
# Usage: bash deploy.sh

set -e

REMOTE="habibi-server"
REMOTE_DIR="/var/www/habibi/habibi-frontend/dist"
LOCAL_DIST="$(dirname "$0")/dist"
SITE_URL="https://habibihe.com"
# Steps that report a failure and carry on (so one bad file doesn't abandon
# the rest) bump this; the script exits non-zero at the end if it's set.
FAILURES=0
# How long an old build's asset files stick around after being superseded.
# Vite's content-hashed filenames mean a file's name only changes when its
# content does, so old and new files never collide -- this used to delete
# the previous build's files within seconds of a deploy (swap-then-cleanup),
# which meant a customer who already had the site open, then navigated to a
# route they hadn't loaded yet, could hit a "failed to fetch dynamically
# imported module" error if that chunk's old filename was already gone.
#
# SECURITY CONSEQUENCE, worth knowing before you need it: because superseded
# chunks are kept for this long, removing a secret from the source and
# redeploying does NOT stop it being served. The old chunk still answers 200
# until it ages out. This is not hypothetical -- VITE_KITCHEN_TOKEN was found
# in 38 historical chunks on 2026-09-12, still fetchable by anyone, after it
# had been removed from the build.
#
# If a secret ever ships in a bundle again, do all three:
#   1. invalidate it at the source (rotate/remove the server-side value), then
#   2. remove it from the app and redeploy, then
#   3. delete the old chunks immediately rather than waiting out the retention:
#        printf '%s' 'THE_LEAKED_VALUE' > /tmp/tok
#        grep -rlF -f /tmp/tok /var/www/habibi/habibi-frontend/dist/assets | xargs rm -f
#        rm -f /tmp/tok
# Step 1 is the one that actually protects you; 2 and 3 stop it spreading further.
ASSET_RETENTION_DAYS=14

echo "▶ Building..."
cd "$(dirname "$0")"
npm run build

# Makes the main CSS bundle non-render-blocking (see the script itself for
# why: it's why the boot loading screen couldn't paint until this 188KB file
# had downloaded). Rewrites dist/index.html only, after the build -- the
# build's own output is untouched. Fails the deploy rather than uploading a
# guess if Vite's HTML output ever changes shape.
echo "▶ Deferring the main stylesheet..."
node scripts/defer-main-css.cjs

echo "▶ Uploading new assets to staging folder..."
ssh "$REMOTE" "rm -rf ${REMOTE_DIR}/assets_new"
scp -r "${LOCAL_DIST}/assets" "${REMOTE}:${REMOTE_DIR}/assets_new"

echo "▶ Merging new assets (old ones kept for ${ASSET_RETENTION_DAYS} days)..."
# Reports what the prune did, so the asset folder can't quietly grow without
# anyone noticing -- previously it ran silently and nobody knew whether it was
# working or how much was accumulating.
ssh "$REMOTE" "
  mkdir -p ${REMOTE_DIR}/assets
  cp -rf ${REMOTE_DIR}/assets_new/. ${REMOTE_DIR}/assets/
  rm -rf ${REMOTE_DIR}/assets_new
  STALE=\$(find ${REMOTE_DIR}/assets -type f -mtime +${ASSET_RETENTION_DAYS} | wc -l)
  find ${REMOTE_DIR}/assets -type f -mtime +${ASSET_RETENTION_DAYS} -delete
  echo \"  pruned \$STALE file(s) older than ${ASSET_RETENTION_DAYS} days; \$(ls ${REMOTE_DIR}/assets | wc -l) remain (\$(du -sh ${REMOTE_DIR}/assets | cut -f1))\"
"

echo "▶ Uploading index.html..."
scp "${LOCAL_DIST}/index.html" "${REMOTE}:${REMOTE_DIR}/index.html"

# Root-level files from public/ (manifest.json, sw.js, offline.html,
# firebase-messaging-sw.js, robots.txt, the PWA icons...). This script only
# ever handled assets/ + index.html + images/, so anything sitting at the root
# of dist/ silently never deployed -- the ones already live got there by hand
# at some point, and a later edit to any of them would not have shipped.
# Found while adding sw.js, which would have been built locally and simply
# never existed in production. Small and few, so they upload unconditionally.
echo "▶ Uploading root files (manifest, service workers, icons)..."
ROOT_FILES=$(find "${LOCAL_DIST}" -maxdepth 1 -type f ! -name 'index.html' 2>/dev/null)
if [ -n "$ROOT_FILES" ]; then
  # An `scp ... && echo` chain is exempt from `set -e`: a failed upload here
  # used to fall through silently and the deploy still ended in success.
  # shellcheck disable=SC2086
  if scp $ROOT_FILES "${REMOTE}:${REMOTE_DIR}/"; then
    echo "  uploaded: $(echo "$ROOT_FILES" | wc -l | tr -d ' ') file(s)"
  else
    echo "  ⚠ FAILED to upload root files"
    FAILURES=$((FAILURES + 1))
  fi
else
  echo "  none"
fi

# public/.well-known/ -- Square's Apple Pay domain association file. It's a
# dot-folder, so the root-files step above never picks it up, and when the file
# is missing nginx answers that path with index.html and verification fails.
if [ -d "${LOCAL_DIST}/.well-known" ]; then
  echo "▶ Uploading .well-known/..."
  if ssh "$REMOTE" "mkdir -p '${REMOTE_DIR}/.well-known'" < /dev/null && \
     scp "${LOCAL_DIST}"/.well-known/* "${REMOTE}:${REMOTE_DIR}/.well-known/"; then
    echo "  uploaded: $(find "${LOCAL_DIST}/.well-known" -maxdepth 1 -type f | wc -l | tr -d ' ') file(s)"
  else
    echo "  ⚠ FAILED to upload .well-known/ (Apple Pay domain verification depends on it)"
    FAILURES=$((FAILURES + 1))
  fi
fi

# public/images/ (391MB, ~1000 files) is a direct copy into dist/images/ but
# was never synced by this script at all -- it only ever handled assets/ +
# index.html, so any newly-added image silently 404'd in production despite
# building fine locally (found via /images/collab/*.svg). Too large to
# scp -r wholesale on every deploy, and rsync isn't available on this
# machine (only on the server) -- so compare local vs. remote and upload
# only what's new or changed. It compares path + md5, not path alone: the
# path-only version silently never shipped an image replaced under the same
# filename, so production kept the old picture. Hashing ~1000 files costs
# about 10s on each side. Only uploads, never deletes from the server.
echo "▶ Syncing new and changed images..."
LOCAL_IMG_LIST=$(mktemp)
REMOTE_IMG_LIST=$(mktemp)
# md5sum prints "hash  path"; turn that into "path<TAB>hash" so both lists
# sort by path and a line differs whenever the content does.
(cd "${LOCAL_DIST}" && find images -type f -exec md5sum {} + 2>/dev/null) \
  | sed 's/^\([0-9a-f]*\) [ *]\(.*\)$/\2\t\1/' | sort > "$LOCAL_IMG_LIST"
ssh "$REMOTE" "cd '${REMOTE_DIR}' && find images -type f -exec md5sum {} + 2>/dev/null" \
  | sed 's/^\([0-9a-f]*\) [ *]\(.*\)$/\2\t\1/' | sort > "$REMOTE_IMG_LIST"
NEW_IMAGES=$(comm -23 "$LOCAL_IMG_LIST" "$REMOTE_IMG_LIST" | cut -f1)
CHANGED_COUNT=$(comm -23 "$LOCAL_IMG_LIST" "$REMOTE_IMG_LIST" | cut -f1 \
  | grep -cxFf <(cut -f1 "$REMOTE_IMG_LIST") || true)
if [ -n "$NEW_IMAGES" ]; then
  echo "  $(echo "$NEW_IMAGES" | wc -l | tr -d ' ') to upload (${CHANGED_COUNT} of them replace a different version already on the server)"
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
  echo "  uploaded $UPLOAD_OK image(s)"
  if [ "$UPLOAD_FAILED" -gt 0 ]; then
    echo "  ⚠ $UPLOAD_FAILED image(s) failed -- re-run deploy.sh to retry, or upload manually"
    FAILURES=$((FAILURES + 1))
  fi
else
  echo "  all images already up to date"
fi
rm -f "$LOCAL_IMG_LIST" "$REMOTE_IMG_LIST"

# Check the live site itself rather than trusting the uploads above. This
# script has printed success while the live site was still serving the
# previous build (2026-09-08, twice: "Connection reset by peer" mid-upload),
# and the next browser test then chased a bug that was really an undeployed
# fix. The live homepage must be byte-identical to the one just built, and
# every JS/CSS file it references must answer 200.
echo "▶ Verifying the live site..."
LOCAL_HASH=$(sha256sum "${LOCAL_DIST}/index.html" | cut -d' ' -f1)
LIVE_HASH=""
for attempt in 1 2 3; do
  LIVE_HASH=$(curl -fsS --max-time 20 "${SITE_URL}/?deploycheck=$(date +%s)" 2>/dev/null | sha256sum | cut -d' ' -f1)
  [ "$LIVE_HASH" = "$LOCAL_HASH" ] && break
  sleep 3
done
if [ "$LIVE_HASH" = "$LOCAL_HASH" ]; then
  echo "  index.html matches the build"
else
  echo "  ⚠ live index.html does NOT match the build -- the site is still serving something else"
  FAILURES=$((FAILURES + 1))
fi

MISSING=0
for asset in $(grep -o '/assets/[A-Za-z0-9._-]*\.\(js\|css\)' "${LOCAL_DIST}/index.html" | sort -u); do
  CODE=$(curl -s -o /dev/null --max-time 20 -w '%{http_code}' "${SITE_URL}${asset}")
  if [ "$CODE" != "200" ]; then
    echo "  ⚠ ${asset} answered ${CODE}"
    MISSING=$((MISSING + 1))
  fi
done
if [ "$MISSING" -eq 0 ]; then
  echo "  every file the homepage loads answers 200"
else
  FAILURES=$((FAILURES + 1))
fi

if [ "$FAILURES" -gt 0 ]; then
  echo "✗ Deploy NOT verified: $FAILURES problem(s) above. Re-run deploy.sh."
  exit 1
fi
echo "✓ Deploy complete and verified live"
