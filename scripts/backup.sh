#!/usr/bin/env bash
# Nightly database dump (kept 14) and weekly photo archive (kept 4).
#   scripts/backup.sh              database; photos too on Sundays
#   scripts/backup.sh --uploads    database and photos now
set -euo pipefail
source "$(dirname "$0")/lib.sh"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/wolfcar}"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
stamp=$(date +%Y%m%d-%H%M)

db_file="$BACKUP_DIR/db-$stamp.dump"
dc exec -T db pg_dump -U wolfcar -d wolfcar --format=custom > "$db_file.part"
mv "$db_file.part" "$db_file"
echo "database: $db_file ($(du -h "$db_file" | cut -f1))"

if [[ "${1:-}" == "--uploads" || "$(date +%u)" == "7" ]]; then
  up_file="$BACKUP_DIR/uploads-$(date +%Y%m%d).tgz"
  docker run --rm -v wolfcar-prod_uploads:/uploads:ro -v "$BACKUP_DIR":/backup alpine \
    tar czf "/backup/$(basename "$up_file")" -C /uploads .
  echo "photos:   $up_file ($(du -h "$up_file" | cut -f1))"
fi

ls -1t "$BACKUP_DIR"/db-*.dump 2>/dev/null | tail -n +15 | xargs -r rm -f
ls -1t "$BACKUP_DIR"/uploads-*.tgz 2>/dev/null | tail -n +5 | xargs -r rm -f
