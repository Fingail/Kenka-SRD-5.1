# Docker workstation operations

Use the root README's `bash docker/local/launch.sh` for first setup. It generates secrets rather than using a committed account or password. Do not copy credentials from another installation.

## Start and stop

```bash
docker compose -f compose.local.yaml up -d
docker compose -f compose.local.yaml ps
docker compose -f compose.local.yaml down
```

Normal operation uses ten containers: app, MariaDB, Redis, worker, Meilisearch, MinIO, Thumbor, its Nginx proxy, Mailpit and Reverb. Services retain their data in named Docker volumes. The source directory is bind-mounted into the app. This is a workstation/developer layout, not an immutable production image.

Use `bash docker/local/launch.sh --no-build` only when the two local images already exist. It still installs dependencies and builds frontend assets. After dependency updates, rebuild through the normal launch or `docker compose -f compose.local.yaml build`.

## Mail and realtime

Mailpit and Reverb run by default. Mailpit captures application emails without sending them to external recipients. Read captured email at http://127.0.0.1:18025. Default SMTP settings are `MAIL_DRIVER=smtp`, `MAIL_MAILER=smtp`, `MAIL_HOST=mailpit`, and `MAIL_PORT=1025`.

Realtime broadcasting uses `BROADCAST_DRIVER=reverb`. Server-side publishing connects through `REVERB_PUBLISH_HOST=reverb` and `REVERB_PUBLISH_PORT=8080` inside Docker. Browser connections use `VITE_REVERB_HOST=127.0.0.1` and the published port, normally 18080. Keep generated Reverb app credentials consistent across services; do not replace them with shared defaults. Rebuild frontend assets after changing Vite configuration.

For installations created with the earlier log-only defaults, update the ignored `.env` to the values above, then run:

```bash
vendor/bin/sail artisan config:clear
docker compose -f compose.local.yaml up -d
docker compose -f compose.local.yaml restart laravel.test worker reverb
```

The launch script preserves existing `.env` files. Existing browser configuration only needs rebuilding if its Vite host, port, or public app key changed.

The asset builder is an ephemeral service:

```bash
docker compose -f compose.local.yaml --profile build run --rm builder
```

It has a larger memory limit than the app and is not started by a normal `up -d`.

## Ports

Default loopback ports: application 18081, MinIO API 19000 and console 19001, Thumbor 18889. Reverb 18080 and Mailpit 18025. MariaDB, Redis and Meilisearch remain inside the Docker network.

For a separate fresh installation, choose an unused HTTP port and project name before the first launch:

```bash
KENKA_PROJECT=my-srd KENKA_HTTP_PORT=20081 bash docker/local/launch.sh
```

The generator shifts the other loopback ports by the same offset and writes a distinct Docker network name. It leaves an existing `.env` unchanged. Subsequent commands read the project name and ports from that file. Do not rename a populated Docker project without planning its volumes.

## Maintenance

All normal PHP, Composer, Artisan and Yarn commands run through `vendor/bin/sail` once dependencies exist:

```bash
vendor/bin/sail artisan queue:failed
vendor/bin/sail artisan setup:meilisearch --no-interaction
vendor/bin/sail php docker/local/check-search.php
vendor/bin/sail php docker/local/audit-srd-links.php
vendor/bin/sail artisan test --compact tests/Feature/LocalSrdImporterTest.php tests/Feature/LocalSrdLinkerTest.php tests/Feature/SelfHostedFeaturesTest.php
```

The search rebuild queues work: leave the worker running until indexing finishes. Retry-after values must remain integers and exceed worker timeouts. A stopped worker can make search appear incomplete.

The installer writes potentially sensitive Passport output to ignored `storage/app/install.log`, rather than printing it. The local owner's generated login and API/MCP tokens are in ignored `storage/app/local-access.json` with mode 0600. Do not paste these files into issues or commit runtime storage. A lost access file must be recovered deliberately; rerunning setup is not a password-reset mechanism.

## Backups

```bash
bash docker/local/backup.sh
```

Backups contain credentials and private data. The script writes mode-restricted archives under ignored `backups/`: a transactional database dump, object-storage files and private configuration/keys. Store a copy separately if workstation loss must be covered. There is no automatic schedule.

For recovery, stop app/worker writes, restore the MariaDB dump and MinIO files into matching services, restore `.env` and Passport keys privately, then start the stack and rebuild search. Rehearse recovery in a separate Docker project before relying on a backup. Do not restore one installation's keys over a different active installation.

## Boundaries

The configuration binds exposed ports to localhost, permits local unsigned thumbnail requests, and serves public image buckets locally. It has no public TLS/reverse-proxy design or remote object-store access controls. Public repository visibility does not mean the running service is publicly accessible. External billing, social logins, Discord, analytics and paid assets remain unconfigured.
