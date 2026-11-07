# Engineering handoff — Kenka-SRD-5.1

## Objective and baseline

Provide a containerized local Kanka with a reproducible, licensed 2014 SRD 5.1 reference campaign. Upstream baseline: `owlchester/kanka`, tag `3.17`, commit `cf968d129247af92418e3ecb111904e5165464c0`. Preserve the upstream LICENSE, including its Commons Clause; see LICENSING.md for the separately licensed rules and icon data.

This repository includes application changes and seed manifests, not a copy of a person's account or live workstation. Do not import hosted campaigns, third-party adventures or Monster Manual text as part of the base setup.

## Architecture

PHP 8.5, Laravel 13, Vue/Vite, MariaDB 11.4, Redis 7.4, Meilisearch 1.12.0, source-built MinIO, Thumbor and Nginx. See `compose.local.yaml`. The PHP image includes Node 24 and Composer 2 for reproducible setup. Base image digests and the MinIO release tag are in the Dockerfiles.

Ten containers run by default, including Mailpit for SMTP capture and Reverb for live updates. Only the one-time frontend builder uses the `build` profile. Default mail uses SMTP to Mailpit; broadcasting uses Reverb. Server publishing targets Docker hostname reverb:8080 while browser clients use the published loopback port. Published ports bind to loopback; database/cache/search are not exposed.

The app source is bind-mounted. Composer/Yarn dependencies and frontend assets are installed/built locally, not committed. Docker named volumes hold persistent state. Avoid `down --volumes` during routine maintenance.

## Setup path

`docker/local/launch.sh` builds images, generates an ignored `.env` and owner access file, initializes schema/Passport/storage, compiles frontend assets, creates campaign/modules/sidebar, imports the three data batches, applies grouping/icons, and queues one search rebuild. `generate-env.php` uses random secrets and fresh owner identity; it does not overwrite an existing configuration.

`seed-srd-world.php` uses native campaign/entity creation services, reserves attribution entity 1 and overview entity 2, and adds the eight custom modules and 20 sidebar bookmarks. The packaged data therefore supports a fresh database or its existing campaign 1. Arbitrary destination campaigns and remote import are intentionally not implemented.

`prepare-import.php` copies public manifests to runtime storage with the configured local origin. `LocalOwner` finds the owner through the ignored access file rather than a hardcoded identity.

## Import implementation

`LocalSrdImporter` creates native child models for standard modules and base entities for custom modules. Console and queue execution skip many ordinary web observers, so the importer explicitly performs mention mapping and linking. Preserve this behavior when adding import paths.

Each record carries hidden `_srd_key` and `_srd_hash` properties. A per-record transaction makes reruns resumable. Matching records are reused; changed source hashes or edited destination text/name/module stop with a conflict. These guards do not overwrite local edits. Readback verifies full entry text and each prepared property. Failed runs may leave earlier committed records; correct the cause and resume.

`LocalSrdLinker` attaches spells/features through native entity abilities, links subclasses to classes, sets same-module parents, inherits base-race abilities into subraces, creates language/source relations and uses native Character/Organisation child IDs for pantheon membership. Confusing native child IDs and global entity IDs is a significant correctness risk.

Search synchronization is suspended during bulk creation. Rebuild once through `setup:meilisearch`; the ordinary worker drains the queue. Native creation can still dispatch other queue jobs. Redis visibility timeouts are cast to integers for Carbon compatibility and exceed the ordinary worker timeout.

## Content and UI

1,584 SRD records: 319 spells, 317 creatures, 468 items, 15 conditions, 17 rules articles and 448 remaining category records. Exact counts and source checksums are in `data/srd5.1/`. Do not treat missing SRD options as parser omissions without checking the official PDF: the SRD has only Acolyte and Grappler, for example.

Races: nine roots plus four subraces. Languages: 18 roots plus four Primordial dialects. Nested grids show roots until the user opens children. The 18 planar records include broad categories and regions, not 18 individually detailed planes.

The Feats bookmark uses exact `type=Feat!` matching (`type=Feat%21` in URLs), because a substring match also includes Feature. Preserve exact filtering when editing sidebar links.

Common/Unique object classification is independent of magic rarity. There are 467 Common object records and one Unique artifact, Orb of Dragonkind. Three new tag roots organize 14 creature types, eight spell schools and 15 equipment families. With their 37 children and the two object tags, there are 42 tags.

The setup renders 44 shared RPG Awesome glyphs to 256px PNGs in local object storage and assigns them to SRD entries. These are category images, not individual portraits. It preserves unrelated existing art; better-fitting replacements can be applied deliberately. Icons are separate display metadata and must not alter source entries or source hashes.

The free Font Awesome stylesheet supplies missing regular/Pro-style navigation glyphs without paid assets. It is included only where no kit is configured. The local footer contains GitHub and licensing links; the original upstream footer remains available outside the single-host mode.

## Local feature switch

`config/selfhost.php` gates advanced features and single-host routing by `APP_ENV=local`. Modified model concerns expose local advanced campaign/user capabilities. The route provider maps the authenticated API to `/api/1.0` on the same host; ACL and Passport authentication remain in place. MCP is enabled locally. This does not provide hosted subscriptions, paid content, billing integrations or Font Awesome Pro assets.

## Verification and development

Follow AGENTS.md. Use Sail for PHP, Composer, Artisan and Yarn once installed. Before changes:

```bash
vendor/bin/sail artisan test --compact tests/Feature/LocalSrdImporterTest.php tests/Feature/LocalSrdLinkerTest.php tests/Feature/SelfHostedFeaturesTest.php
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse app/Services/LocalSrdImporter.php app/Services/LocalSrdLinker.php app/Services/LocalOwner.php app/Console/Commands/Local/ImportSrdCommand.php --no-progress
vendor/bin/sail php docker/local/audit-srd-links.php
```

Initial verification: six focused tests, 27 assertions; focused PHPStan passes. The full imported local base passes 1,745 relationship checks, complete prepared content/property readback, category-grid checks and sample HTTP thumbnails. A repeat remaining import creates zero records and reuses all 448. Live UI checks cover 55 navigation glyphs against the bundled font and required assets, plus allowed footer links. An isolated installation on alternate ports was also exercised with the already-built app/MinIO images: locked dependencies were installed, assets built, all 1,584 records imported, search populated, and the original eight-service default started. A subsequent update enables Mailpit and Reverb by default, bringing the runtime to ten services. Verification captured an SMTP message in Mailpit and received a server-published event through a subscribed WebSocket client (HTTP 101 handshake). The broadcasting config now includes a Reverb connection with separate internal publish and public browser addresses. A second launch reused all records without duplication. This caught and fixed required BookmarkCache initialization and standalone-helper error exit handling. The new MinIO Dockerfile also retains its license in the final image. These are targeted checks, not a claim that the entire upstream test suite passes.

## Privacy and release hygiene

Never commit `.env`, PAT files, owner logins, OAuth/private keys, database dumps, storage, backups, installation logs or local campaign exports. `.gitignore` and `.dockerignore` exclude runtime material. Public manifests contain SRD reference text and deterministic source keys only. Host-specific reports remain outside the repository.

Before publication, compare staged content against actual local credential values without printing those values. Inspect the staged file list and newly authored history; use explicit staging rather than adding the entire workstation directory. The current installation's generated frontend manifest is a runtime artifact and is not part of this release's source changes. Rebuild assets on a new checkout.

## Follow-up work

- Expand semantic cross-references for item/spell, condition/effect and planar mentions; current full text is retained, but these are not all native relationships.
- A future Monster Manual (2014) import needs an authorized local source, its own source/license classification and deduplication against SRD creatures. No MM import is included.
- Add stronger parser/table regression fixtures before regenerating source batches. Current immutable prepared data comes from the official 403-page PDF; it includes normalized layout and shared passages.
- Rehearse restoring a backup into an isolated project. Public/LAN deployment, TLS, service hardening and immutable app-image packaging are separate engineering tasks.
- Audit dependency/image updates before changing pinned releases. MinIO is built from source because the previously expected public prebuilt images were unavailable.

## Local premium settings

`/settings/premium` renders a local feature-status view when the local advanced flag is enabled. The hosted allocation page assumes a CampaignBoost exists for a premium campaign; that is not true for local feature grants and previously caused a null-reference HTTP 500. The local view lists the user’s own campaigns and describes external service boundaries without creating subscription or boost records. `LocalPremiumPageTest` exercises the authenticated route with zero allocations.

## Working campaign copies

`LocalCampaignCloneService` and `docker/local/copy-srd.php` create a separate working campaign from the clean SRD base. The CLI requires a new name and campaign 1 with the expected SRD title. Native child IDs, entity IDs, custom category IDs, parent links, attributes, tags, attached abilities, relations, deity memberships and bookmarks are copied/remapped inside a transaction. Generic icon storage paths are reused. The source entity fingerprint is checked and preserved in the private copy mapping. The focused clone test exercises child-ID separation, attached abilities, mention remapping and source preservation. Run search indexing after a copy. This helper is designed for the clean rules library; it is not a general migration of every possible campaign subsystem.

Private online campaign imports are separate operations and must preserve campaign-specific licensing and provenance. Native upstream import mappers need explicit console cache initialization and verification of associated data; for example, the Family mapper omits entity articles. Do not assume a successful mapper run proves content completeness.


## DR / OCF encounter integration

The optional `kenka-dungeon-revealer-demo` project runs two services: pinned Dungeon Revealer v1.17.1 on loopback port 18083 and a private Node 24 OCF handler. Start through `python3 docker/dungeon-revealer/launch-integration.py`; normal Kanka startup never launches a VTT. The helper prepares ignored credentials, installs locked handler dependencies, generates version-pinned DR overlays and connects only the Kanka app/media services to a source-read network. On first setup supply a view-only token in `OCF_KANKA_TOKEN`; later starts reuse private configuration.

Kanka is the lore/rules/identity source. The GM authors a quest linking a map and participants and adds structured `OCF Combat Sheet v1` properties, or uses supported NPC SRD/property compilation. Runtime requests are campaign-2 GETs only. The custom `kanka-combat-sheet/1` format is not a native OCF CharacterFile. PC JSON imports become explicit local overrides; NPCs retain their Kanka definitions. See [input contract](docs/kanka-encounter-input-format.md) and [current operations guide](docs/ocf-dr-integration-demo.md).

### Runtime state and permissions

Handler SQLite persists prepared definitions, source hashes, stable per-instance token IDs, current/temp HP, inventory use, effects, roll requests/results and initiative. Repeated creature mentions expand into distinct instances. Source refresh/import preserves live state and positions; source maxima/identity/revision conflicts are validated. Never reset live HP or refill resources to test an import. Campaign 1 remains the clean SRD library. Private campaign snapshots, art, generated sheets and fixture configurations are excluded from Git.

Shared-role DR credentials distinguish GM/player access; individual account-to-character grants remain deferred. Players can use PC sheets, while NPC sheets/actions and unrelated private rolls stay GM-only. The server applies attack/utility mutations atomically and deduplicates UUID retries. Own-turn player actions are immediate; out-of-turn player rolls/actions enter a persisted DM approval queue without rolling dice or changing HP. Rejected/cancelled requests leave state unchanged, and combat-session changes cancel pending requests. Approval executes with original player permissions and revalidates the action.

Player token PATCH requests pass through a server-side movement check: during combat only the active living PC can move; initiative queuing blocks player movement. Existing native visibility/movable/locked flags still apply. GM access bypasses the turn gate. Permission failures pause player movement. Do not toggle persistent native flags on each turn. The upstream DR adapter runs Node 16, so it uses `http.request`, not global fetch.

### Combat and sheet behavior

- The same docked right-side sheet/log layout is the default for GM and player. Token selection opens/reopens one sheet, expands a minimized panel, and preserves controls on repeated same-token selection. Sheet/log can pop out independently. Closing a floating sheet resets its next opening to docked.
- Basic target selection resolves attacks, critical dice, temporary HP and damage. Objects, healing potions, player death saves and NPC death notices are supported. Demo potions can revive zero-HP creatures; unlimited supplies are explicit demo overrides, not Kanka inventory changes. Zero-HP native images rotate 90 degrees and restore their original rotation on recovery.
- Initiative requests require GM approval, queue PC/NPC rolls and sort the turn order. Players end PC turns; the GM advances NPCs/overrides PCs. GM polling automatically selects the next NPC, including after a PC ends their turn. End combat clears the tracker; the next battle queues fresh rolls.
- Named/custom effects persist on runtime tokens. Failed-save actions can mark selected effects, with a Weakening Breath preset. GM controls add/remove effects. Every effect with a configured or legacy stored save gets a save button. Stored ability/DC/mode drive the roll; configured success removal clears only that effect. Other success outcomes remain for GM adjudication. Start/end-turn saves are limited per PC turn with a GM override; manual triggers can repeat. Out-of-turn effect saves use the approval queue.
- The shared combat log projects resolved NPC attacks/area actions into safe cards: participants, attack/save/damage dice, totals, outcomes and saved health-after-action. Current-health notices are omitted. Only GM cards include exact HP; private NPC checks/recharge notes remain filtered. Die/total badges highlight natural d20 1/20 in red/green and identify discarded advantage/disadvantage dice. Dice colors do not change hit/save rules.
- Token names use small fonts and health-colored backgrounds; separate effect labels appear below with contrasting category colors. Policy data exposes qualitative bands only. Rendering never rewrites source token names, art or coordinates.

Spells are supported as described/targeted actions and effects where modeled, not a full spellcasting engine. Range, cover, distance budgets, concentration, duration expiry, condition immunity and unsupported modifiers remain GM-managed. The world-overview test map has no combat-distance scale. There is no general damage undo/HP editor or automatic rest/level-up system. Native DR chat dice remain separate from managed character-bound sheet rolls.

### Native overlay and caches

`prepare-overlay.py` patches exact pinned minified-module patterns and refuses unknown upstream layouts. Compose mounts the generated index/DM/shared/MapView overlays from ignored storage. They connect native token selection for both roles, delayed map initialization, turn-based drag controls and label rendering. Import-map versions bypass old native-module caches. HTML/bridge responses use no-store and content-hashed bridge URLs; reload existing tabs after updates. The text renderer positions backgrounds from measured text bounds for stacked labels. Review/retest all patterns when updating DR.

### Validation and public-release boundaries

Run handler tests with `docker compose -p kenka-dungeon-revealer-demo -f compose.dungeon-revealer-demo.yaml exec -T ocf-handler node --test`. `check-browser.py` exercises GM/player flows using disposable handler combatants and cleans its own records. `movement-check.mjs` and `death-rotation-check.mjs` use disposable native tokens and remove only their own tokens/records. Private campaign HP, positions and Kanka data must not be modified for verification. Some live checks require a locally prepared campaign/quest; those private fixtures are not shipped.

Keep `storage/app/local-access.json`, demo access files, handler configuration/PATs, source snapshots, native overlays, dependencies, SQLite volumes, screenshots and art out of Git. Preserve upstream DR ISC, Open Character Apache-2.0 and SRD CC-BY notices. The included Thumbor proxy adjustment routes imported WebP thumbnails alongside JPEG/PNG/GIF.

## Optional PCGen desktop demo

`python3 docker/pcgen-demo/launch.py` verifies/extracts an official pinned Linux portable archive and launches one separate Webtop container at **https://127.0.0.1:18084**. A local self-signed certificate and generated HTTP-basic credentials protect the loopback endpoint. Read access locally from ignored `storage/app/pcgen-demo/access.json`. Both the PCGen nightly and desktop image are pinned; no host Java is installed. Native GUI software rendering is selected for compatibility.

PCGen's application/runtime mount is read-only. Preferences, source selections, character saves and exports persist in ignored `storage/app/pcgen-demo/config/`; suggested character/export folders are `config/PCGen/characters` and `config/PCGen/exports`. The launcher preserves existing data and credentials. Normal Kanka/DR startup does not launch PCGen, and its network has no Kanka token or campaign-data mounts. No character migration or export adapter is enabled. See [demo walkthrough and operations](docs/pcgen-demo.md).

Choose the upstream 5e SRD source and evaluate a disposable SRD character before attempting campaign-specific builds. The selected release is a nightly and its 5e dataset is beta. PCGen code/data/runtime and Webtop retain separate licensing; download artifacts are never committed. A future export adapter should produce our validated sheet format with explicit Kanka identity while preserving combat runtime state.
