#!/usr/bin/env bash
# Verifies a running Wolf Car deployment from the outside.
#   scripts/smoke.sh https://wolfcar.qa
# Exit 0 = every check passed. Used by deploy.sh; safe to run any time.
set -uo pipefail
BASE="${1:?usage: scripts/smoke.sh <base-url>}"
BASE="${BASE%/}"
failures=0

# check <label> <path> <expected-status> [content-type-prefix]
check() {
  local label="$1" path="$2" want="$3" ctype="${4:-}" out code type
  out=$(curl -sS -o /dev/null --max-time 20 -w '%{http_code} %{content_type}' "$BASE$path" 2>&1) || true
  code="${out%% *}"; type="${out#* }"
  if [[ "$code" == "$want" && ( -z "$ctype" || "$type" == "$ctype"* ) ]]; then
    echo "PASS  $label ($code)"
  else
    echo "FAIL  $label — expected $want${ctype:+ $ctype}, got: $out"
    failures=$((failures + 1))
  fi
}

check "home (en)"            /en          200 text/html
check "home (ar)"            /ar          200 text/html
check "catalog page"         /en/products 200 text/html
check "login page"           /en/login    200 text/html
check "api health"           /api/health  200 application/json
check "api docs are off"     /api/docs    404

categories=$(curl -sS --max-time 20 "$BASE/api/public/categories" 2>/dev/null || true)
image=$(grep -o '"/api/uploads/[^"]*"' <<<"$categories" | head -1 | tr -d '"')
if [[ -n "$image" ]]; then
  echo "PASS  catalog data (has images)"
  check "uploaded photo" "$image" 200 image/
else
  echo "FAIL  catalog data — no /api/uploads image in /api/public/categories"
  failures=$((failures + 1))
fi

if (( failures > 0 )); then echo "smoke test: $failures check(s) failed"; exit 1; fi
echo "smoke test: all checks passed"
