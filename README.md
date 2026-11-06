# Kenka-SRD-5.1

A local, container-based fork of [Kanka](https://github.com/owlchester/kanka) with a prepared **2014 fifth-edition SRD 5.1** rules library. Based on upstream tag **3.17**, commit `cf968d129247af92418e3ecb111904e5165464c0`.

The initial setup creates a private **5e Rules — SRD 5.1** campaign with **1,584 reference entries**, searchable properties, class spell lists, attached features, race and language hierarchies, deity/pantheon memberships, and a 20-link rules sidebar. All 317 SRD creatures are included. This is a reference library, not an automated rules engine.

## Launch with Docker

Requirements: Docker Engine with Compose v2, Bash, Git, and permission to run Docker as your workstation user. No host PHP, Composer, Node, or database installation is required. Allow roughly 4 GiB for normal runtime and additional memory for the one-time frontend/MinIO builds; the asset builder has a 4 GiB limit.

```bash
git clone https://github.com/Fingail/Kenka-SRD-5.1.git
cd Kenka-SRD-5.1
bash docker/local/launch.sh
```

The first run builds the application and MinIO images, installs locked dependencies, generates fresh credentials, initializes storage/database, compiles assets, and imports the prepared SRD batches directly inside the app container. Initial image/dependency builds take most of the time; importing the rules takes seconds to minutes. Search indexing finishes asynchronously through the worker.

Open **http://127.0.0.1:18081**. Read your generated owner email and password locally from **`storage/app/local-access.json`**. That file, `.env`, OAuth keys, runtime reports, and backups are ignored by Git. There are no shared default login credentials.

The launch script can be rerun: matching SRD records are reused; edited or conflicting records stop the import. It preserves existing `.env` and owner access files. The included base initializer requires a fresh database or its existing campaign 1; importing into arbitrary campaigns is not implemented.

After first setup, normal start/stop is:

```bash
docker compose -f compose.local.yaml up -d
docker compose -f compose.local.yaml down
```

Do not add `--volumes` to a normal shutdown. See [Docker operations](docs/local-docker.md) for backups, service configuration and troubleshooting.

## Default services

All ten local runtime services start by default, including mail capture and realtime updates:

| Service | Purpose |
| --- | --- |
| `laravel.test` | PHP 8.5 / Laravel app, HTTP on 18081 |
| `mariadb` | Application and audit databases |
| `redis` | Cache, queues and sessions support |
| `worker` | Background work and search indexing |
| `meilisearch` | Full-text search |
| `minio` | Local object storage; ports 19000/19001 |
| `thumbor`, `thumbor-nginx` | Image thumbnails; port 18889 |
| `mailpit` | Local SMTP capture and mail viewer; port 18025 |
| `reverb` | Realtime WebSocket updates; port 18080 |

Database, Redis and search ports are not published. Published service ports bind to **127.0.0.1**. Mailpit captures application email locally; view it at **http://127.0.0.1:18025**. Reverb handles realtime updates. The asset builder (`build`) runs once and exits. SMTP delivery to external recipients requires a separately configured mail provider.

## Changes from upstream

- Reproducible slim workstation containers, source-built MinIO and local storage initialization.
- Opt-in advanced campaign/user features restricted to `APP_ENV=local`; local API and MCP on the same host as the app. Authentication and campaign permissions still apply.
- Direct SRD importer with persistent source keys, hashes, conflict guards, per-record transactions, complete content/property readback and explicit relationship linking.
- SRD categories, sidebar, properties and searchable spell/creature/equipment data, with source-page attribution.
- Common versus Unique object groups, 14 creature types, 8 spell schools and 15 equipment families.
- 44 shared free RPG Awesome icons, free Font Awesome navigation fallbacks, and a compact GitHub/licensing footer.
- Integer queue visibility timeouts for compatibility with Carbon date arithmetic.
- Fresh random installation credentials; no personal accounts, hosted API tokens, campaign exports, live database dumps or artwork uploads are published.

The local feature switch does not include paid marketplace content, Font Awesome Pro assets, external subscription services, billing, social logins or Discord setup. The default stack is intended for a single local workstation; public/LAN hosting requires a separate deployment design.

## Engineering and licensing

Read [engineering handoff.md](engineering%20handoff.md) for architecture, known limits, validation and follow-up work. [Prepared data details](data/srd5.1/README.md) describe category counts and import constraints.

Kanka is **source available**, with its original [LICENSE](LICENSE), including the Commons Clause, preserved. The rules data uses **CC BY 4.0**; icons and dependencies have separate licenses. See [LICENSING.md](LICENSING.md) for attribution and third-party notices. This fork is not affiliated with or endorsed by Wizards of the Coast or Owlchester.
