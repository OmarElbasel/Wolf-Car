#!/usr/bin/env bash
# One-time: copy the local database and photos to the server and restore them.
# Run on the laptop, from the repo. Afterwards rotate credentials (DEPLOY.md).
#   scripts/migrate-data.sh [ssh-host]      default host: wolfcar
set -euo pipefail
HOST="${1:-wolfcar}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOCAL_DB="${LOCAL_DATABASE_URL:-postgresql://wolfcar:wolfcar@localhost:5432/wolfcar}"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

pg_dump --format=custom --no-owner --no-privileges "$LOCAL_DB" > "$tmp/db.dump"
tar czf "$tmp/uploads.tgz" -C "$ROOT/api/storage/uploads" .
echo "local: db $(du -h "$tmp/db.dump" | cut -f1), photos $(du -h "$tmp/uploads.tgz" | cut -f1)"

ssh "$HOST" 'mkdir -p /opt/wolfcar/incoming && chmod 700 /opt/wolfcar/incoming'
scp "$tmp/db.dump" "$tmp/uploads.tgz" "$HOST:/opt/wolfcar/incoming/"
ssh "$HOST" 'cd /opt/wolfcar/app && scripts/restore.sh /opt/wolfcar/incoming/db.dump /opt/wolfcar/incoming/uploads.tgz'
echo "done. Next: rotate credentials (see DEPLOY.md, 'After moving data')."
