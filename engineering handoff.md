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

Retired locally in favor of the [DiceCloud demo](docs/dicecloud-demo.md). PCGen character/configuration files and a backup remain in ignored storage; the container, image and downloaded runtime were cleaned up. The launcher/export code below remains historical and requires reinstalling PCGen. Both demos use port 18084 and must not be started together without changing a port.

`python3 docker/pcgen-demo/launch.py` verifies/extracts an official pinned Linux portable archive and launches one separate Webtop container at **https://127.0.0.1:18084**. A local self-signed certificate and generated HTTP-basic credentials protect the loopback endpoint. Read access locally from ignored `storage/app/pcgen-demo/access.json`. Both the PCGen nightly and desktop image are pinned; no host Java is installed. Native GUI software rendering is selected for compatibility.

PCGen's application/runtime mount is read-only. Preferences, source selections, character saves and exports persist in ignored `storage/app/pcgen-demo/config/`; character/export folders are `config/Documents/PCGen/characters` and `config/Documents/PCGen/exports`. The launcher preserves existing data and credentials. Normal Kanka/DR startup does not launch PCGen, and no Kanka token is mounted into its container. See [demo walkthrough and operations](docs/pcgen-demo.md).

Choose the upstream 5e SRD source and evaluate a disposable SRD character before attempting campaign-specific builds. The selected release is a nightly and its 5e dataset is beta. PCGen code/data/runtime and Webtop retain separate licensing; download artifacts are never committed.

`tools/ocf-handler/export-kanka.py` is the read-only authoring hook. It fetches Kanka definitions, bounded collections and linked ability/item records, then invokes `compile-export.mjs` in the existing handler container to validate battle JSON. It writes native PCGen drafts/private data packs and a distinct authoring JSON under `/config/Documents/PCGen/characters/{questname_####}/`. Reviewed exports are not overwritten. The current native progression mapping covers single-class Ranger/Hunter/Archery; creatures use reference snapshots. Unknown choices are null plus review flags. Historical HP allocations use placeholders and an aggregate/CON adjustment, which must be reconciled with the placeholders as one operation. Current scores already include historical ASIs/racial choices. Advancing in PCGen does not update Kanka or DR. See the [export contract and limits](docs/pcgen-character-export.md). The separate encounter snapshot exporter deduplicates by campaign/entity and stores quantities in its manifest, excluding runtime combat state.

## DiceCloud evaluation

`python3 docker/dicecloud-demo/launch.py` builds a pinned upstream checkout and starts two services at HTTP loopback port 18084: DiceCloud and an internal MongoDB. The account/library database and uploaded files use separate named volumes. Existing local Mailpit is attached under the `mailpit` alias for captured account email. Account/database secrets and seed IDs remain in ignored storage; the app has no Kanka token or campaign mounts.

The build retains Meteor 2.16/Node 14, pins compatible Sharp/encoding dependencies, and links Meteor's relative upload locations into `/data/files`. An exact-match server-bundle patch repairs upstream library-copy root/parent assignment; the patch also applies to the original source module. MongoDB uses an authenticated single-node replica set and oplog connection for reactive updates. This is a local old-runtime evaluation; a public deployment needs its own runtime/security review. Preserve upstream GPL notices. The browser setup uses native validated methods to create a private synthetic Fighter and a small SRD 5.1 library, then tests native advancement to level 2 with HP recalculation. It is intentionally limited to Fighter 1–5 and selected choices, with fixed-average HP. A separate hosted SRD test import now contains 10,182 schema-validated nodes in 21 private libraries (main plus referenced dependency subtrees). Legacy ancestry is converted to nested sets, IDs/formula references are remapped, and hosted sharing/ownership is replaced with the local owner. Thirty-six retired target IDs have private reviewed replacements; the Power Word Stun Mystic Arcanum threshold still needs manual adjudication. All references resolve. The single-source wrapper removes only 1,298 redundant `showSRD`/`!showPHB` gates. Other prerequisites remain; upstream picker code consumes asynchronous parser results synchronously, so some conditional choices need Show All/manual eligibility review until a client compatibility fix is implemented. `resolve-library.mjs`, `convert-library.py` and the backed-up one-shot `import-library.py` preserve source data/repair manifests privately. The server-bundle patch now also preserves each reified reference's parent and adds the missing computed constant value schema so source-gated choices work; use the rebuilt image. The pinned REST endpoint can lag during bulk edits, so tests read live published properties and verify persisted stats separately; resolve that behavior before using REST for a future OCF adapter. The imported test character exercises native character creation and advancement separately from the original demo. Renovar import and Kanka/OCF conversion are not enabled. Operations and limits are documented in [docs/dicecloud-demo.md](docs/dicecloud-demo.md).

Resolved-library smoke test passed on the rebuilt demo: synthetic Human Fighter/Acolyte with Archery advanced to Fighter 2 via the native picker. MongoDB independently confirms level 2 and HP 20/20; live stats also give STR 16, DEX 15, CON 14, AC 12 unarmored, speed 30, proficiency +2. Other build slots remain available for user testing. Five converter tests pass, all 10,182 library nodes persist, and there are zero dangling reference targets. Private browser results/screenshot and database backup stay in ignored storage. The original small Fighter demo is preserved; Kanka/DR campaign data was not written.

The private Kanka-to-DiceCloud test now has `docker/dicecloud-demo/prepare-kanka-import.py` (allowlisted local GETs + OCF validation) and `import-kanka-ranger.mjs` (narrow Ranger 4/Hunter/Satyr native build). Campaign snapshots, generated race text, actor IDs, walkthroughs and verification artifacts remain ignored. The bridge builds a separate character through native levels 1–4, creates a private reusable Satyr race library, imports source equipment/features, preserves current totals without reapplying ancestry/ASI bonuses and records unresolved historical choices. Native checks cover 18 skills, six saves, four attack bonuses, spellcasting and core stats; Mongo independently confirms saved level/stats/inventory. Source hashing prevents silent refresh over reviewed advancement. This does not enable DiceCloud-to-Kanka or OCF combat-state writes. Non-SRD combat automation remains partial; source descriptions and review flags are retained. The public projection now includes quoted point-buy `values`; both local definitions were repaired from full public documents, with a sixth converter regression check. See the DiceCloud operations document for the workflow and limits.

A future-design assessment for DiceCloud-authoritative publication is recorded in `docs/dicecloud-demo.md`: create a separate local **Dice** copy of the clean SRD campaign, retain a full native authoring snapshot/envelope and compile the existing DR combat JSON, copy uploaded image bytes into Kanka, resolve canonical rules links and preserve owned-item state, and publish only on Save to OCF. This remains planned. Before implementation, parameterize campaign-2 assumptions in the handler/PC importer, introduce installation/campaign/character identity mappings, and add a consistent DiceCloud export for computed values/media with permission checks. Keep encounter runtime state independent and use revisioned, duplicate-safe publication; do not overwrite campaign lore or the clean SRD source. The current native import test and private Satyr library are separate from outbound publication.


## Native DiceCloud / DR encounter demo

The optional [native integration](docs/dicecloud-dr-demo.md) launches with `python3 docker/dc-dr-demo/launch.py`. Entry is `http://127.0.0.1:18084/dc-dr/`; combine `compose.dicecloud-demo.yaml` and `compose.dc-dr-demo.yaml` under project `kenka-dicecloud-demo`. A separate DR v1.17.1 service/volume on port 18085 receives a one-time read-only source-volume copy. Prepared native Lux is cloned; NPCs are seeded into DiceCloud from one-time GET-only source definitions. Original Kanka campaigns, source character and port-18083 DR/OCF scene are preserved. Preparation currently requires existing private fixture artifacts and the compiler container; normal gameplay does not call OCF. This is not yet a portable generic quest importer.

DiceCloud's native property graph, computation/action engine and MongoDB own HP and mechanical state. `dcDrRooms`, `dcDrRuns`, `dcDrEvents`, `dcDrRequests` and `dcDrEffects` add encounter coordination, replay/revision checks, sanitized player logs, approvals and save metadata. The server uses Meteor fibers explicitly around native engine calls. The optional guarded compiled-bundle patch repairs native save/damage/defense execution and tabletop permissions. Native DDP action entrypoints for cloned demo actors require the encounter controls; other actors remain normal. DR authenticates DiceCloud movement permission server-side, while existing pinned frontend hooks provide selection, label color and token rotation. Do not replace this with client-trusted HP or a second dice engine.

Implemented/tested coverage includes attacks/checks/saves, repeat attacks/healing, object targets, multi-target breath, native fire immunity and Weakening disadvantage, initiative/end-turn/end-combat, out-of-turn approval, player movement restrictions, zero-HP rotation/recovery, death saves and NPC death confirmation, saveable effects, sanitized shared logs and independent dock/popout controls. API checks mutate only demo fixtures and restore HP/end combat. GM/player browser checks exercise map canvas selection and UI. Commands and private artifacts are documented in the operations guide; do not commit snapshots, credentials or screenshots.

Back up MongoDB/files, copied DR volume and matching ignored configuration. Integration source is GPL-3.0-only with a directory-local full license, explicitly excepted from the repository's default terms. Loopback ports and an older pinned Meteor/Node runtime remain deliberate demo constraints. Range/LOS/AoE geometry, duration/concentration, advanced action budgets and comprehensive condition/class-feature automation need further work. The separate Save-to-OCF/Kanka publisher and Dice campaign remain unimplemented; earlier SQLite/flat-combat-JSON design is retained for the original OCF path, not this native runtime.


### Focused Renovar tabletop

`python3 docker/dc-dr-demo/launch-tabletop.py` creates/starts the separate **Renovar — Kanka tabletop** at `/kanka-tabletop/` on port 18084. Add `compose.kanka-tabletop.yaml` to the existing two-file integration deployment; its map-only DR service uses port 18086 and `kenka-dicecloud-demo_kanka-tabletop-data`. Private configuration/source snapshots stay under `storage/app/kanka-tabletop/`. Initial preparation reads the Kanka quest/NPC data without writes, clones the reviewed native PC and source map, and creates an independent native tabletop/encounter. Source reimport/refresh remains explicit future work.

The native bridge now registers multiple private configurations with distinct routes and reused Mongo collection handles. Replay/continuation/approval checks include room ownership; map movement checks target the proper route. Each native tabletop entry redirects to its own integration view. The focused DR overlay hides its chat/sidebar and token-properties panel so sheets/logs use DiceCloud controls. Advancing a player turn handles hidden NPC participants internally instead of applying player visibility to the next actor lookup. API tests with `--tabletop` verify separate actors/maps, original-room revision preservation and cross-table replay rejection; browser tests check native navigation, Kanka links and the map-only presentation. Original integration/browser checks continue to pass.


### Native interface replaces the custom shell

The active `/kanka-tabletop/` entry now redirects into DiceCloud's native tabletop UI. `prepare-native.py` selects a new private native-mode configuration/room and clones the encounter without the infinite-potion demo action. The native-mode startup path seeds data and registers only `native-tabletop.cjs`; it returns before custom action/approval routes, DDP blockers, custom publication filters, synchronization timers or the custom UI are installed. A one-time native property-graph conversion places direct attack damage under On Hit branches. Existing native library branches are preserved.

`native-ui.js` embeds the DR map in the native empty map component and forwards token selection; DiceCloud owns all controls, targeting, action dialogs, computation and logs. `native-map-bridge.js` supplies only DR role authentication and selection, with standard DR movement rather than the previous turn gate. NPC read sharing supports native client evaluation. The old port-18085 map is stopped; records/code remain for reference. `check.py --native` verifies GM/player access, native controls/logs, hit/miss damage behavior and absence of custom controls. The old custom-browser/API checks target the historical configuration and should not be used against this native deployment. See the updated native-interface operations section.

The native map now fills the viewport behind DiceCloud’s creature cards and action bar, with a full-height dark grey combat feed on the right and a matching menu button. Navigation starts closed through the native store mutation; the menu remains usable. Scoped page classes prevent the overlay layout leaking to other routes, and empty overlay areas pass pointer events to DR. The browser check verifies viewport map bounds and native GM/player action flow.

Mounted native UI changes are now included in Meteor’s deployment version. `prepare-native.py` hashes the map/UI adapter files into ignored `client-version.env`; the compose overlay supplies `AUTOUPDATE_VERSION`, and the boilerplate script URL carries that version. This fixes existing tabs retaining an older adapter despite no-cache script responses. Run the launcher to deliver changes. The read-only `--live-layout` browser check kept one authenticated tab open across deployment, verified automatic reload to full-viewport bounds, and preserved its URL/login.


### Native initiative, approvals and movement

The current native DiceCloud UI adds `native-combat.cjs` and `native-combat-ui.js` for initiative/turn coordination. Capital-I buttons on each native creature card request combat, then light for queued rolls. The GM chooses both PCs and NPCs, rolls NPCs individually/in batches and explicitly clicks Begin combat. The tracker has manual GM advancement, player End turn, NPC auto-selection, minimization and End combat clearing all rolls/order. Native checks produce initiative totals/logs; the coordinator stores no HP or alternative attack formulas.

The pinned client hook pauses `doAction.ts` before insertion/simulation for turn approval. Server DDP wrappers bind the original Meteor invocation before awaiting, preserving fibers, method randomness and native validation; native insert/run calls cannot bypass turn permission. A session/actor/task-bound one-use approval is consumed at insertion and bound to the native action. Native freeform log rolls use a narrowly scoped client connection wrapper and the same server approval check. The old combat engine remains unused. Movement policy is supplied to the DR iframe and checked on the map REST server using the real DiceCloud token; GM controls bypass turn limits, player moves outside combat remain owned-character-only. Combat state/requests/permits persist in nativeCombatState/nativeCombatRequests/nativeCombatPermits within MongoDB.

The combat feed header provides a draggable/resizable pop-out and docking chevron. Navigation uses the native hamburger while retaining Vue drawer controls. Adapter hashes now cover the coordinator and client hook; the map service shares the version environment so changed movement guards restart too. Rebuild with docker/dc-dr-demo/launch.py after compiled hook changes. The focused --native-combat check exercises GM/player queues, manual begin, approval before native dialogs, direct DDP bypass denial, movement enforcement and end/reset without damaging actors. Kanka remains read-only.

The upstream MSW V0.3 worker cached API JSON despite no-store headers, causing a GM browser to retain idle state after another client requested initiative. The native raw handler now serves a patched worker at /sw.js; it bypasses all API/authenticated requests and mounted adapter assets, respects private/no-store responses and removes legacy MSW caches on activation. Combat/map reads additionally use no-store plus unique URLs during worker replacement. Focus refresh and worker update are explicit. Keep this override when deploying the native interface; otherwise cross-client state and role responses can remain stale. The browser check verifies absence of cached API entries.


### Native map layout, targeting and health indicators

The native tracker is a floating, draggable/resizable window. Its grip saves a viewport-clamped browser-local position; minimization preserves that position. The combat feed independently collapses/reopens or floats/docks. GM map tools form a dark right-hand rail: visibility above drawing tools, followed by map/layer controls. Popovers share dark text/form styling and publish their width so a pinned feed leaves clearance.

Direct target selection delegates map-token and top-card clicks to DiceCloud TargetsInput.selectCreature while its native target step is active. The original list is replaced by a small prompt; native single/multiple-target behaviour and continuation remain authoritative. Targeting blocks dragging until selection ends. Reticles/selected labels reflect native selections; no alternate action engine is introduced.

Shared token-status.cjs supplies Good (>50%), Not Good (>25%), Bad (>0%) and Down colours plus native condition chips for cards/map labels. Native logs highlight natural 20 green, natural 1 red and hit/miss. The native action wrapper appends target HP snapshots after resolution; historical logs without snapshots do not invent historical HP. token-poses.cjs persists only visual down state in nativeTokenPoses and retries map writes: zero/negative HP rotates 90 degrees, healing restores upright, including after restart.

map-defaults.py reads Kanka size attributes once, records private preparation metadata and enables the existing 50px grid for GM/players. Medium/Small tokens are 50px, Tiny25, Large100, Huge150 and Gargantuan200. Subsequent manual map changes are preserved. New DR token defaults are 50px and labels are compact; pinned prepared frontend patches include versioned import-map URLs.

Run check.py --native-layout for read-only GM layout, adapter targeting, floating tracker, map defaults, shared status and synthetic log-colour checks. It uses browser-only fixtures and does not damage actors or alter combat order. Four focused token-status/token-poses unit tests cover health boundaries, condition palettes, zero HP, healing after restart and write retry. Private reports/screenshots stay ignored. Kanka remains GET-only.


### Native effect consolidation and turn resolution

`native-effects.cjs` normalizes condition names and retains one active buff per name (highest save DC, newest equal-DC copy). The coordinator soft-removes duplicate buff subtrees and recomputes the native character; independent conditions remain. Existing duplicates are repaired on projection as well as after actions. `nativeEffectSaves` records per-character/effect/session/turn save and damage stamps, without storing alternative combat stats.

Effect rules come from explicit `dcdr-save:ability:dc`, `dcdr-start-turn`/`dcdr-end-turn` and `dcdr-end-on-success` tags, with conservative fallback to an explicit DC/ability and repeat-save wording in the description. Active PCs and GM-controlled NPCs get a highlighted plain status badge that opens effect details and a draggable, resizable floating character window containing the source description. Required timed saves prompt on the character's turn; attempting to end it reopens unresolved saves. Native checks use computed ability/skill/advantage. Success removes the entire native effect subtree only when the rule says it ends; failure retains it. Timed saves cannot be repeatedly rolled in the same turn. Out-of-turn player saves use a scoped, single-use GM approval before any native dice. Plain status badges open details on click/keyboard; there is no extra Save control over the badge. The roll button remains inside the character effect dialog.

Recurring damage requires an explicit turn-damage sentence or a `dcdr-recurring:` tag followed by JSON containing `formula`, `type`, `timing` (`start of turn`, `end of turn`, `manual`) and optional `save` (`none`, `negates`, `half`). Initial attack damage is not inferred as recurring. Unconditional damage resolves on entry/end of the affected turn; save-dependent damage resolves alongside the save. Temporary native damage properties are compiled, executed with the native dice/damage engine, then removed. Native resistance/immunity handling and HP persistence remain authoritative; logs append health snapshots and map poses synchronize from resulting HP. Ambiguous prose needs explicit metadata rather than invented automation.

Run the two native-effects unit/contract suites through Sail. Isolated collection/recording-engine tests cover actual coordinator removal, authorization, disadvantage/DC forwarding, failure/success, turn deduplication and damage dispatch/cleanup. The layout check uses intercepted browser-only turns/actions to verify badge highlighting, automatic prompts and result display without rolling against encounter actors. These fixtures do not establish full native engine coverage for arbitrary imported effect descriptions.


### Native ammunition import repair

`native-ammo.cjs` repairs unbound/stale arrow references when exactly one matching inventory item exists. It converts explicitly named arrow bundles (for example three Arrows (20) bundles) into individual arrows once, preserving subsequent expenditure and exhausted quantities. Native startup applies patches with the property's explicit schema type selector; without this, DiceCloud's polymorphic schema can strip item/action-specific fields. Longbow retains its native one-arrow-per-shot resource rule and normal exhaustion checks. Kanka and source characters remain unchanged. Focused tests cover bundle units, retries, spent ammo, missing supplies and ambiguous choices.


### Condensed floating character sheets

`native-sheet-ui.js` opens independent pinned sheets from the existing top-card portraits and selected bottom-bar portrait; no extra toolbar icon is inserted. Multiple draggable/resizable sheets remain attached to their character IDs as selection changes. Geometry persists per browser/character. Inventory starts collapsed, attaches alongside the sheet and detaches into its own floating window. Equipping/unequipping delegates to `creatureProperties.equip`; item use delegates to an existing native action, matched by ancestry or one exact unique name for flattened imports. Plain reference items do not acquire invented mechanics.

`native-sheet-data.cjs` derives abilities, saves, skills/tools, usable actions/spells, features, resource counters and proficiency/language references from active native properties. Nested action branches are excluded as independent actions to avoid bypassing parent costs. Read-only NPC sheets remain inspectable by players, with mutation controls disabled. Feature descendants expose their native actions; passive features retain their descriptions. The mounted UI inserts through `actions.insertAction` and opens DiceCloud's native ActionDialog only after the combat gate, preserving native targeting, advantage, dice, damage and shared logs. Check tasks retain their property context for the pinned native CheckInput. Spells open the native slot-selection dialog. Server DDP permissions/turn checks remain authoritative.

`check.py --native-sheet` verifies both portrait entrypoints, multiple pinned windows, dragging, inventory detach/dock and permissions. One harmless GM Strength check uses native dialogs/engine and verifies unchanged encounter HP, inventory and turn state; spell selection is opened without casting. A blocked player gate fixture verifies no dice dialog opens before approval completes. Screenshots/reports remain private. Pure sheet-data tests cover grouping, nested actions, item mappings and native check parameters. The combat feed now uses matching 12px text, 13px headings, compact spacing and 11px dice badges, retaining existing health/outcome colours.


### Current-turn visibility

The expanded turn tracker places End turn above the order for PC turns (including the GM view), with Next turn for GM-controlled NPC turns. Player controls remain visible but disabled when the active actor is not their PC. Unresolved effect saves still reopen their existing floating window before advancement. Minimized trackers retain the character-name header and chevron. A top-bar status strip names the current actor; PC turns highlight the strip and PC card, with Your turn for the controlling player. Idle/end-combat clears these indicators. The read-only layout check intercepts browser-only states to verify PC/NPC transitions, role-specific button enablement and placement without advancing the live encounter.


### Shared native saving-throw engine fix

The pinned upstream damage-with-save adapter built a legacy `{node, children}` wrapper, but the current saving-throw function expects a flat property with `type: savingThrow`. The earlier compiled-server repair left browser simulation broken. `patch-native-client.cjs` now patches the shared TypeScript source before Meteor compilation, applying the same flat shape, per-target save invocation, awaited DC calculation, refreshed save outcome scope and actual defender variable lookup to both client and server. Damage-total log entries are also shared. `patch-native.cjs` keeps permission/bridge patches and verifies the compiled shared save fix rather than applying a separate engine transformation.

Build with `python3 docker/dicecloud-demo/launch.py --build-only`, then deploy via `launch-tabletop.py`. Build-only preserves the running containers while preparing the image. The patch contract test requires the prepared pinned source and checks guarded/idempotent replacements. `check.py --native-saves` creates and removes disposable non-campaign characters, executes real native client/server multi-target actions, and verifies one save per target, success half damage, failure full damage and immunity. It neither enrolls fixture characters in Renovar nor advances its combat. The layout check closes pre-existing windows only in its own browser before synthetic effects, allowing checks while another browser is playing. Effect windows now close after a resolved save; results stay in native combat logs.


### Kanka portrait refresh

`python3 docker/dc-dr-demo/sync-native-portraits.py` reads the current native roster's Kanka entities, validates locally hosted image URLs and applies only DiceCloud `picture`/`avatarPicture` through authenticated native methods. Character/creature artwork takes priority; characters without usable artwork fall back to the first linked race with a usable image. Missing artwork leaves the existing portrait intact. Kanka remains read-only. Images remain in Kanka's persistent local media storage; DiceCloud references those local URLs. No campaign art is checked into the repository.

The helper throttles native updates, checks image loading and selected-character rendering, and verifies that DR token image IDs are unchanged. It does not modify map tokens, combat state or character statistics. Private plans, before/after audit and screenshot are under `storage/app/kanka-tabletop/`. Rerun explicitly after changing Kanka art; this is not an automatic combat-time source sync.


### Local portrait and token overrides

`set-local-portraits.py` accepts bear, gold-dragon and kobold source images as positional arguments, plus optional `--bear-avatar`, `--dragon-avatar`, `--kobold-avatar` round-image paths. It stores unchanged PNG/JPEG bytes through DR's authenticated image-library upload, verifies the public file bytes, and records private per-token portrait/avatar overrides. Full-size images populate DiceCloud `picture`; round images populate `avatarPicture`. All matching Kobold instances share artwork while retaining separate IDs and stats. Kanka portrait refresh now respects usable local overrides before character and race artwork.

Map artwork updates require the explicit `--map-tokens` flag and use only `tokenImageId` mutations. The operation checks token geometry/visibility/rotation and writes private before/after audits. Without the flag it updates portraits only. Lux is outside these three creature mappings. Uploaded media lives in the existing persistent DR volume; override plans and user-supplied art stay out of git. Back up that volume with MongoDB and private override configuration.
