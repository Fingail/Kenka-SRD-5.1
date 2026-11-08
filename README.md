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

## Keep a clean SRD library

Campaign 1 remains the clean rules reference. Create an independent working campaign before adding campaign-specific lore:

```bash
vendor/bin/sail php docker/local/copy-srd.php "My campaign"
vendor/bin/sail artisan setup:meilisearch --no-interaction
```

The copy includes custom categories, native child records, properties, feature/spell attachments, relationships, pantheon memberships, tags and sidebar links. Its entry IDs and internal links are remapped. Generic icon files are shared. Keep the worker running to finish search indexing. Source-to-copy mappings stay in ignored `storage/app/campaign-copies/`. Private campaign snapshots and imported lore are not part of this repository.

## Dungeon Revealer combat integration

The optional [DR/OCF encounter integration](docs/ocf-dr-integration-demo.md) reads GM-prepared characters, creatures and a quest from local Kanka. Kanka retains lore, rules and notes; the handler stores encounter HP, inventory use, effects, initiative and roll history in its own SQLite volume. Runtime Kanka access is **GET-only** and never writes combat results back.

Start Kanka, create a working campaign and a view-only API token, then launch the separate demo:

```bash
# First launch only: enter the token without storing it in shell history.
read -r -s -p "Local Kanka API token: " OCF_KANKA_TOKEN
export OCF_KANKA_TOKEN
python3 docker/dungeon-revealer/launch-integration.py
unset OCF_KANKA_TOKEN
```

Open **http://127.0.0.1:18083/dm** as GM, **http://127.0.0.1:18083/** as player, or **http://127.0.0.1:18083/ocf-api/ui** to prepare/refresh a quest. Generated access details are in ignored `storage/app/dungeon-revealer-demo/access.json`; the API token stays in ignored `storage/app/ocf-authoring/handler-config.json`. Later launches reuse those files.

The prototype currently allowlists **campaign 2**. Prepare its participant sheets and quest using the [input contract](docs/kanka-encounter-input-format.md); private workstation campaigns, maps, portraits and character exports are not bundled. PC definitions support reviewed JSON overrides; NPCs use Kanka properties/SRD compilation. Source refresh preserves runtime state.

The integration provides:

- One docked character sheet above the right-side combat log, independent popout controls, and token selection that reopens a closed sheet for both roles.
- Targeted attacks, damage, healing, death saves, zero-HP token rotation, and GM-selected multi-target/save-based actions.
- Shared initiative, player End turn, GM turn advancement, automatic GM selection of the next NPC, and a fresh roll queue for each battle.
- Out-of-turn player rolls requiring DM approval and server-enforced player movement limited to the active PC.
- Persistent named/custom effects, effect-save buttons with configured recovery on success, and GM effect controls.
- Shared NPC attack/AoE results with dice badges, red/green natural d20 results, damage colors and health-after-action labels. Exact NPC HP and unrelated private rolls remain GM-only.
- Small token names with health-colored backgrounds and separate colored effect labels beneath them.

The handler uses pinned Open Character packages for supported calculations; it is not a complete 5e rules engine. Range, movement budgets, concentration, duration expiry and unsupported condition mechanics require GM adjudication. Native DR accounts use shared GM/player credentials, without individual character ownership. See [operations and verification](docs/ocf-dr-integration-demo.md) and [engineering handoff](engineering%20handoff.md).

## Native DiceCloud tabletop

Open **[Renovar — Native DiceCloud tabletop](http://127.0.0.1:18084/kanka-tabletop/)**. This now uses DiceCloud's own creature cards, selected-character action bar, targeting dialogs, dice controls and roll log. A small adapter embeds the DR map; Kanka supplies read-only source data and the quest link. Launch with `python3 docker/dc-dr-demo/launch-tabletop.py` after the existing private fixtures are prepared.

The native interface now adds capital-I initiative requests, GM participant selection, queued PC/NPC rolls, an explicit Begin combat button and a shared turn tracker. Player out-of-turn actions require GM approval before dice open; movement is limited to the active PC. The feed has dock/pop-out and collapse/reopen chevrons; navigation uses a hamburger. Turn order floats over the map and can be dragged, minimized and resized. Native token/card health indicators share colours, zero-HP tokens rotate and recover upright when healed, and native roll logs highlight natural 1/20, hit/miss and health after actions. Map controls and their popouts use a dark grey right-hand rail. Select targets directly from map tokens or character cards. Duplicate conditions consolidate; highlighted status badges open floating character save windows, and source-defined recurring damage resolves through the native engine. Portraits in the top and bottom bars open condensed, pinned floating sheets with native checks, saves, actions, spells and feature references. Each sheet has a collapsible inventory that detaches, equips items and exposes defined use actions. The combat feed uses matching compact text. The top bar names and highlights the active PC, and End turn sits above turn order with ownership checks. The earlier custom combat shell and death workflow remain disabled. See [native tabletop operations](docs/dicecloud-dr-demo.md#native-dicecloud-interface-current-demo).

## DiceCloud character advancement demo

The current character-manager demo is [DiceCloud](docs/dicecloud-demo.md) at **http://127.0.0.1:18084**. Start it with `python3 docker/dicecloud-demo/launch.py`. It uses its own app/MongoDB containers, persistent volumes and local accounts; the private demo login is in ignored `storage/app/dicecloud-demo/access.json` after browser setup. The local test data includes a resolved hosted 2014 SRD library (10,182 entries with private dependency subtrees), alongside the small Fighter demo. Reviewed stale-reference repairs and native-schema validation prepare it for character creation and advancement testing. Outbound Kanka publication is not enabled. See the demo documentation for source limits, test results and conversion tools.


A private Kanka character test bridge also exercises native Ranger advancement and creates a reusable campaign Satyr library. It preserves unresolved source choices for review; campaign data stays local. See [import workflow and limits](docs/dicecloud-demo.md#private-kanka-ranger-advancement-test).

## Retired PCGen browser demo

PCGen is stopped and its container, image and downloaded runtime have been removed. Its generated characters/settings are preserved locally, including a backup under `storage/app/pcgen-demo/preserved/`. DiceCloud now uses its former port. The following launcher and export documentation is retained for a deliberate later evaluation; stop DiceCloud before reusing port 18084.

An optional, isolated PCGen desktop is available through a browser:

```bash
python3 docker/pcgen-demo/launch.py
```

Open **https://127.0.0.1:18084** and accept the local self-signed certificate. Read the generated username/password from ignored `storage/app/pcgen-demo/access.json`. The launcher verifies a pinned official Linux archive and starts one pinned Webtop container. Character files and exports persist under ignored `storage/app/pcgen-demo/config/Documents/PCGen/`. The [OCF export helper](docs/pcgen-character-export.md) reads Kanka to produce native character drafts/reference snapshots and separate battle JSON in quest folders. No Kanka token is mounted into PCGen, and exports never write back to Kanka or change live combat state.

The selected PCGen build is a **nightly demonstration build**. Choose its **5e / System Reference Document 5.1** source and create a disposable SRD character to evaluate editing and exports. See [PCGen demo instructions](docs/pcgen-demo.md) for persistence, stop/start, licensing and integration boundaries.

Both demos have dedicated Compose files and project names; the normal Kanka startup does not launch them. The optional [PlanarAlly comparison](docs/planarally-demo.md) is separate; MapTool has been retired.

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
- A local feature-status page at `/settings/premium`, without hosted subscription allocation requirements.
- Fresh random installation credentials; no personal accounts, hosted API tokens, campaign exports, live database dumps or artwork uploads are published.

The local feature switch does not include paid marketplace content, Font Awesome Pro assets, external subscription services, billing, social logins or Discord setup. The default stack is intended for a single local workstation; public/LAN hosting requires a separate deployment design.

## Engineering and licensing

Read [engineering handoff.md](engineering%20handoff.md) for architecture, known limits, validation and follow-up work. [Prepared data details](data/srd5.1/README.md) describe category counts and import constraints.

Kanka is **source available**, with its original [LICENSE](LICENSE), including the Commons Clause, preserved. The rules data uses **CC BY 4.0**; icons and dependencies have separate licenses. See [LICENSING.md](LICENSING.md) for attribution and third-party notices. This fork is not affiliated with or endorsed by Wizards of the Coast or Owlchester.
