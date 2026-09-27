#!/usr/bin/env bash
# Replaces the production database (and optionally the photos) from a backup.
#   scripts/restore.sh /var/backups/wolfcar/db-20260927-0000.dump [uploads.tgz]
set -euo pipefail
source "$(dirname "$0")/lib.sh"
DUMP="${1:?usage: scripts/restore.sh <db.dump> [uploads.tgz]}"
UPLOADS="${2:-}"
[[ -f "$DUMP" ]] || { echo "no such file: $DUMP" >&2; exit 1; }
[[ -z "$UPLOADS" || -f "$UPLOADS" ]] || { echo "no such file: $UPLOADS" >&2; exit 1; }

dc up -d db
dc stop web api
dc exec -T db pg_restore -U wolfcar -d wolfcar --clean --if-exists --no-owner --no-privileges < "$DUMP"

if [[ -n "$UPLOADS" ]]; then
  # node (uid 1000) owns /app/api/storage in the API image
  docker run --rm -i -v wolfcar-prod_uploads:/uploads alpine \
    sh -c 'rm -rf /uploads/* && tar xzf - -C /uploads && chown -R 1000:1000 /uploads' < "$UPLOADS"
fi

dc up -d
wait_healthy 240
echo "restored from $DUMP${UPLOADS:+ and $UPLOADS}"
