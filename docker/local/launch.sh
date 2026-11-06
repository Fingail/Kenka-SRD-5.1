#!/usr/bin/env bash
set -euo pipefail
umask 077
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.."
export COMPOSE_FILE=compose.local.yaml
if [[ -n "${KENKA_PROJECT:-}" ]]; then export COMPOSE_PROJECT_NAME="$KENKA_PROJECT"; fi
mkdir -p storage/app storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs bootstrap/cache
if [[ "${1:-}" != "--no-build" ]]; then
    docker compose build laravel.test minio
fi
docker compose run --rm --no-deps --user "$(id -u):$(id -g)" --entrypoint php \
    -e LOCAL_HTTP_PORT="${KENKA_HTTP_PORT:-18081}" -e LOCAL_PROJECT="${KENKA_PROJECT:-kenka-srd-51}" \
    laravel.test docker/local/generate-env.php
docker compose up -d mariadb redis minio meilisearch thumbor thumbor-nginx mailpit
if [[ ! -f vendor/autoload.php ]]; then
    docker compose run --rm --no-deps laravel.test composer install --no-interaction --prefer-dist
fi
docker compose up -d laravel.test
vendor/bin/sail artisan kanka:install --no-interaction > storage/app/install.log 2>&1
vendor/bin/sail php docker/local/init-storage.php
vendor/bin/sail php docker/local/setup-owner.php
vendor/bin/sail yarn install --frozen-lockfile
docker compose --profile build run --rm builder
vendor/bin/sail php docker/local/seed-srd-world.php
vendor/bin/sail php docker/local/prepare-import.php
for batch in base objects remaining; do
    vendor/bin/sail artisan local:import-srd "storage/app/srd-${batch}-batch.json"
    cp storage/app/srd-import-report.json "storage/app/srd-${batch}-report.json"
done
vendor/bin/sail php docker/local/group-srd-objects.php
vendor/bin/sail php docker/local/apply-srd-icons.php > storage/app/srd-icons-report.json
vendor/bin/sail artisan setup:meilisearch --no-interaction
docker compose up -d worker
vendor/bin/sail php docker/local/audit-srd-links.php
printf '\nKenka-SRD-5.1 is ready. Open the URL in storage/app/local-access.json.\n'
printf 'Your generated owner email/password are in that private file; never commit or share it.\n'
