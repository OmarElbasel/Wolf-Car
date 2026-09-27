#!/usr/bin/env bash
# Creates deploy/prod.env and deploy/api.prod.env from the templates with fresh
# secrets. Never overwrites an existing file (that would lock everyone out and
# orphan the database password).
#   scripts/make-env.sh [PUBLIC_URL]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PUBLIC_URL_ARG="${1:-}"

make_file() {
  local template="$1" target="$2"
  if [[ -f "$target" ]]; then echo "exists, left alone: $target"; return; fi
  cp "$template" "$target"
  chmod 600 "$target"
  echo "created: $target"
}

make_file "$ROOT/deploy/prod.env.example" "$ROOT/deploy/prod.env"
make_file "$ROOT/deploy/api.prod.env.example" "$ROOT/deploy/api.prod.env"

# Fill placeholders only where they are still present.
sed -i.bak "s|^POSTGRES_PASSWORD=__GENERATED__$|POSTGRES_PASSWORD=$(openssl rand -hex 24)|" "$ROOT/deploy/prod.env"
sed -i.bak "s|^JWT_ACCESS_SECRET=__GENERATED__$|JWT_ACCESS_SECRET=$(openssl rand -hex 48)|" "$ROOT/deploy/api.prod.env"
sed -i.bak "s|^TOTP_ENCRYPTION_KEY=__GENERATED__$|TOTP_ENCRYPTION_KEY=$(openssl rand -base64 32)|" "$ROOT/deploy/api.prod.env"
if [[ -n "$PUBLIC_URL_ARG" ]]; then
  sed -i.bak "s|^PUBLIC_URL=.*$|PUBLIC_URL=$PUBLIC_URL_ARG|" "$ROOT/deploy/prod.env"
fi
rm -f "$ROOT"/deploy/*.env.bak

if grep -q "__GENERATED__" "$ROOT/deploy/prod.env" "$ROOT/deploy/api.prod.env"; then
  echo "a placeholder was not replaced" >&2; exit 1
fi
