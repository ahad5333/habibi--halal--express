#!/usr/bin/env bash
# Checks shared by the three deploy scripts. Each one used to be a line on the
# deploy checklist that a person had to remember; now the deploy runs it.
#
# Usage (from a deploy script):
#   source "<repo>/ops/deploy-guards.sh"
#   guard_clean_tree habibi-frontend      # stop on uncommitted changes in that folder
#   guard_vite_secrets .                  # stop if a VITE_ var looks like a secret
#   guard_dist_secrets dist               # stop if the build contains a server secret
#   smoke_site https://habibihe.com dist  # after a website deploy: can customers order?
#
# Each guard prints a short line and returns non-zero on failure, so `set -e`
# in the caller stops the deploy.

GUARD_REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# The build packs the whole folder, half-finished edits included, so a deploy
# could ship code nobody committed or reviewed. ALLOW_DIRTY=1 overrides it, for
# the rare deliberate case (say so in the commit that follows).
guard_clean_tree() {
  local dir="$1"
  echo "▶ Checking for uncommitted changes in ${dir}..."
  local dirty
  dirty=$(git -C "$GUARD_REPO_ROOT" status --porcelain -- "$dir")
  if [ -z "$dirty" ]; then
    echo "  clean"
    return 0
  fi
  if [ "${ALLOW_DIRTY:-}" = "1" ]; then
    echo "  ⚠ uncommitted changes present, deploying anyway (ALLOW_DIRTY=1):"
    echo "$dirty" | sed 's/^/     /'
    return 0
  fi
  echo "  !! uncommitted changes -- NOT deploying. These would ship unreviewed:"
  echo "$dirty" | sed 's/^/     /'
  echo "     Commit your own files and stash the rest, then re-run."
  echo "     (ALLOW_DIRTY=1 bash deploy.sh to override deliberately.)"
  return 1
}

# Every VITE_* value is baked into JavaScript that every visitor downloads
# (VITE_KITCHEN_TOKEN leaked this way). Checks the NAMES in the env files Vite
# loads for a production build; values are never printed. The allow-list is
# keys that are public by design (browser API keys restricted by domain,
# analytics ids, the PayPal client id, the Firebase web config).
guard_vite_secrets() {
  local dir="$1"
  echo "▶ Checking VITE_ variables for secrets..."
  local allowed='^VITE_(API_URL|FRONTEND_URL|PAYPAL_CLIENT_ID|GOOGLE_MAPS_KEY|GA_MEASUREMENT_ID|FB_PIXEL_ID|FIREBASE_[A-Z_]+)$'
  local suspicious='SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE|CREDENTIAL|ACCESS_KEY|WEBHOOK|SIGNING'
  local bad="" f name
  for f in "$dir/.env" "$dir/.env.local" "$dir/.env.production" "$dir/.env.production.local"; do
    [ -f "$f" ] || continue
    while IFS= read -r name; do
      [[ "$name" =~ $allowed ]] && continue
      if echo "$name" | grep -qE "$suspicious"; then
        bad="${bad}     ${name} (in $(basename "$f"))"$'\n'
      fi
    done < <(grep -oE '^[[:space:]]*VITE_[A-Za-z0-9_]+' "$f" | sed 's/^[[:space:]]*//')
  done
  if [ -n "$bad" ]; then
    echo "  !! these would be readable by every visitor -- NOT deploying:"
    printf '%s' "$bad"
    echo "     Move the value to the backend .env and fetch what the page needs from the API."
    return 1
  fi
  echo "  none look secret"
}

# Belt and braces for the check above: the shapes real server secrets take,
# searched in the built files themselves (catches a secret pasted into source
# code, which no env-name check can see).
guard_dist_secrets() {
  local dist="$1"
  echo "▶ Scanning the build for server secrets..."
  # Square access token, Stripe/live secret keys, SendGrid key, ZeptoMail
  # token, private key blocks.
  local pattern='EAAA[A-Za-z0-9_-]{40,}|sk_live_[A-Za-z0-9]{10,}|SG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}|Zoho-enczapikey|-----BEGIN [A-Z ]*PRIVATE KEY-----'
  local hits
  hits=$(grep -rlE "$pattern" "$dist" 2>/dev/null || true)
  if [ -n "$hits" ]; then
    echo "  !! a server secret appears in the build -- NOT deploying:"
    echo "$hits" | sed 's/^/     /'
    return 1
  fi
  echo "  nothing secret-shaped found"
}

# After a website deploy: the checks a person would do by hand to know
# customers can still order. Read-only -- it never creates a cart or an order.
smoke_site() {
  local site="$1" dist="$2" fails=0 code body
  echo "▶ Checking customers can still order..."

  body=$(curl -fsS --max-time 20 "$site/api/menus" 2>/dev/null || true)
  if echo "$body" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const a=JSON.parse(d);const ok=a.filter(i=>i.is_available!==false&&Number(i.price)>0).length;console.log("  menu: "+a.length+" items, "+ok+" orderable");process.exit(ok>0?0:1)})' 2>/dev/null; then :; else
    echo "  ⚠ menu API returned nothing orderable"; fails=$((fails + 1)); fi

  body=$(curl -fsS --max-time 20 "$site/api/locations" 2>/dev/null || true)
  if echo "$body" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const n=JSON.parse(d).filter(l=>l.is_active&&l.accepting_orders).length;console.log("  stores taking orders: "+n);process.exit(n>0?0:1)})' 2>/dev/null; then :; else
    echo "  ⚠ no store is taking orders"; fails=$((fails + 1)); fi

  body=$(curl -fsS --max-time 20 "$site/api/payments/card/config" 2>/dev/null || true)
  if echo "$body" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const c=JSON.parse(d);const ok=c.provider&&c.applicationId&&c.locationId;console.log("  card payments: "+(c.provider||"none")+" / "+(c.environment||"?"));process.exit(ok?0:1)})' 2>/dev/null; then :; else
    echo "  ⚠ card payment config is missing -- the payment step would be blank"; fails=$((fails + 1)); fi

  code=$(curl -s -o /dev/null --max-time 20 -w '%{http_code}' "https://web.squarecdn.com/v1/square.js")
  [ "$code" = "200" ] || { echo "  ⚠ Square's card SDK answered $code"; fails=$((fails + 1)); }

  # Checkout is lazy-loaded, so the homepage check doesn't cover its files.
  local chunk
  for chunk in $(cd "$dist" && ls assets/Checkout-*.js assets/Checkout-*.css 2>/dev/null); do
    code=$(curl -s -o /dev/null --max-time 20 -w '%{http_code}' "$site/$chunk")
    [ "$code" = "200" ] || { echo "  ⚠ /$chunk answered $code"; fails=$((fails + 1)); }
  done
  code=$(curl -s -o /dev/null --max-time 20 -w '%{http_code}' "$site/checkout")
  [ "$code" = "200" ] || { echo "  ⚠ /checkout answered $code"; fails=$((fails + 1)); }

  if [ "$fails" -eq 0 ]; then
    echo "  checkout files, menu, stores and card payments all answer"
    return 0
  fi
  return 1
}
