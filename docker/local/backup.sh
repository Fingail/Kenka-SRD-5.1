#!/usr/bin/env bash
set -euo pipefail
umask 077
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.."
export COMPOSE_FILE=compose.local.yaml
backup_dir="backups/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$backup_dir"
docker compose exec -T mariadb sh -c \
    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mariadb-dump --user=root --single-transaction --databases kanka logs' \
    | gzip > "$backup_dir/database.sql.gz"
docker compose exec -T minio tar -C /data -czf - . > "$backup_dir/objects.tar.gz"
tar -czf "$backup_dir/private-config.tar.gz" .env storage/oauth-private.key storage/oauth-public.key storage/app/local-access.json
git rev-parse HEAD > "$backup_dir/revision.txt"
printf 'Private backup saved in %s\n' "$backup_dir"
