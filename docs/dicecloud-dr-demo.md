# DiceCloud + Dungeon Revealer evaluation

**Current deployment:** use the [native DiceCloud interface](#native-dicecloud-interface-current-demo). The custom `/dc-dr/` and earlier `/kanka-tabletop/` shells described below are retained as historical documentation and are disabled in the active configuration.

Open **http://127.0.0.1:18084/dc-dr/**. Use the existing local DiceCloud GM account; its credentials remain in ignored `storage/app/dicecloud-demo/access.json`. A separate player account is recorded in ignored `storage/app/dc-dr-demo/access.json`. Use a second browser profile for the player.

```bash
python3 docker/dc-dr-demo/launch.py
```

This is an optional extension to the existing DiceCloud deployment, with a separate DR map service on loopback port **18085**. Normal Kanka startup does not launch either demo. The original DR/OCF encounter remains at port 18083 for comparison.

## Architecture and isolation

DiceCloud owns native character properties, computed statistics, action resolution, HP, inventory and action logs. An authenticated server extension adds encounter membership, initiative, out-of-turn requests, effect-save metadata and sanitized shared events to the same MongoDB. The copied DR service handles the map, fog, tokens and movement. A browser shell embeds that map and supplies the sheet/log/turn controls. Gameplay does not call the OCF handler or use its combat engine/SQLite state.

Initial preparation requires this workstation's prepared DiceCloud Lux import and original Renovar DR scene, the existing Kanka read configuration, and the OCF compiler container. It reads three NPC definitions once through the existing allowlisted Kanka client. It copies the original DR volume with the source mounted read-only, clones the native DiceCloud Lux character and creates separate native NPC actors. Subsequent starts reuse the private configuration and seeded room; they do not reimport Kanka or overwrite the scene. This is a prepared-fixture demo, not yet a general quest importer.

The roster contains Lux, Black Bear, Adult Gold Dragon and eight separate Kobolds. A demonstration crate exercises object targeting. Original source characters, Kanka campaigns and the original DR volume are not updated. The proposed **Dice** Kanka campaign and Save-to-OCF publisher remain future work.

## Demo walkthrough

1. Sign in as GM, select a map token or choose **Characters**. The single sheet docks on the right, with the shared combat log below it. Sheet and log can independently pop out, move, resize and dock again. Closing the sheet and selecting a token reopens it.
2. Expand an attack and choose **Use**. Select targets from the dialog or map. Native DiceCloud resolves attacks, saves and damage. Use **Attack again**, **Heal again** or **End turn** from the result dialog. Lux has an explicitly named unlimited demo healing-potion action; ordinary copied inventory remains separate.
3. Choose **Start combat**. Players roll their own initiative; the GM can roll individual NPCs or all NPCs and then begin turns. The tracker supports minimizing, sheet selection, round order and clearing combat. Advancing onto an NPC selects its sheet and token for the GM.
4. Player out-of-turn rolls enter the GM request queue. Player token movement is restricted to the controlled character's turn during combat; the map server enforces this independently of the browser. GM movement and normal NPC attacks do not need approval.
5. At zero HP, tokens rotate 90 degrees. Healing a non-dead creature restores it and its rotation. PCs have death saving throws; NPC zero-HP notifications offer GM death confirmation. GM HP corrections remain available.
6. Try the dragon's multi-target Fire Breath and Weakening Breath. Each affected creature gets native save resolution; fire immunity is applied. Weakening creates a native disadvantage buff and an ending-save button. The GM can add other named conditions with a save DC, timing and end-on-success setting.

Sheets include ability checks, saving throws, skills, native actions, equipped inventory and feature/review text. Shared events include attacker/target names, roll badges, damage and health after the action. Natural 1 and 20 badges are red/green. GMs see exact HP; other players see NPC health bands **Good**, **Not Good**, **Bad** with green/yellow/red backgrounds. NPC raw properties and internal HP-adjustment details are excluded from player responses.

## Runtime patches and permissions

`docker/dc-dr-demo/patch-native.cjs` applies guarded fixes to the exact pinned DiceCloud server bundle: tabletop GM/edit permission predicates, player creature-publication filtering, native damage-save execution, per-target saves, damage defenses and damage-total logging. The image loads the extension only when `DC_DR_CONFIG` is set by the overlay. Existing library-copy/computed-constant fixes remain in the base image.

The extension authenticates real DiceCloud resume tokens and checks actor control and room membership on every request. Only the demo actors' native DDP action entrypoints are routed through the integrated controls, preventing a direct native-sheet action from bypassing turn approval. Other DiceCloud characters remain unaffected. Server-generated roll IDs, replay-safe request IDs and revision/property checks protect action submission and continuation. Shared DR passwords are transport roles, not authority to move another player's character; movement also requires the authenticated DiceCloud token.

`dr-server.cjs` and copied version-pinned frontend overlays adapt DR v1.17.1. Some retained internal UI hooks are named `ocf:*`; they are selection/rendering hooks and do not call the OCF service. URLs/origin checks currently target the documented localhost ports. Remote deployment needs configurable origins, HTTPS and proper deployment authentication; this is a local demo on the pinned older Meteor/Node runtime.

## Persistence, operations and validation

Use the combined Compose files when restarting the integration:

```bash
docker compose -p kenka-dicecloud-demo -f compose.dicecloud-demo.yaml -f compose.dc-dr-demo.yaml up -d --wait
docker compose -p kenka-dicecloud-demo -f compose.dicecloud-demo.yaml -f compose.dc-dr-demo.yaml stop
```

Back up the DiceCloud database/files volumes, `kenka-dicecloud-demo_dc-dr-data`, and matching private environment/configuration directories. Do not use `down -v`. Launching only the base DiceCloud compose configuration disables the extension until the integration overlay is restored; data remains persisted. Backend source changes need a DiceCloud restart; guarded bundle patches require rebuilding with the integration launcher. Map-server changes need its service restarted. Browser assets are served without caching.

```bash
vendor/bin/sail node --test docker/dc-dr-demo/policy.test.cjs
python3 docker/dc-dr-demo/check.py
python3 docker/dc-dr-demo/check.py --browser
```

The API test uses the cloned demo actors, resets their HP, clears its test effects and ends combat; it leaves a demonstration crate and action history. Do not run it during play. It checks native attacks/replay safety, NPC privacy, zero-HP healing/rotation, initiative, approval/movement enforcement, effect and death saves, multi-target breath, fire immunity and object attacks. The browser test uses separate GM/player sessions and checks the actual map canvas/token selection, attack dialog, dock/popout controls, tracker minimizing and player privacy. Reports/screenshots remain in ignored `storage/app/dc-dr-demo/`.

## Current limits

Range, line of sight and cone/area placement are chosen by the GM on the map; selecting multiple targets does not calculate geometry. Generic named conditions are markers unless a native property implements their mechanical effect. Weakening Breath's Strength disadvantage is implemented; complete frightened/prone behavior, duration expiry, concentration, recharge/legendary budgets, every spell and every once-per-turn class feature are not fully automated or verified. Reference-only actions remain visible as descriptions. Complex native choices may require a prompted branch selection.

The native library and imported historical character still have the review flags documented in [DiceCloud evaluation](dicecloud-demo.md). This demo does not resolve missing historical build choices, reconstruct advancement from flat NPC statistics, publish changes to Kanka or replace the original OCF runtime. Native DiceCloud computation is the authority here; the earlier derived combat-JSON/SQLite plan remains an alternative for the OCF demo.

The extension directory is explicitly **GPL-3.0-only**, with its full license in `docker/dc-dr-demo/LICENSE`. Preserve upstream DiceCloud and DR notices and the SRD attribution in [LICENSING.md](../LICENSING.md). Private campaign content and downloaded community libraries are not included in the repository.


## Focused Kanka tabletop

**http://127.0.0.1:18084/kanka-tabletop/** opens the new **Renovar — Kanka tabletop**. It also appears in the native DiceCloud tabletop list; selecting that entry opens the focused view. It reuses local DiceCloud accounts, its existing MongoDB and uploaded files, with a distinct tabletop/room and fresh native combatant copies. Its separate DR service binds loopback port **18086** and persists in `kenka-dicecloud-demo_kanka-tabletop-data`. Kanka quest and character/creature links are available from the battle interface. Native DR chat/sidebar and token-properties editing are hidden in this map-only presentation. Map/fog/grid tools remain available.

```bash
python3 docker/dc-dr-demo/launch-tabletop.py
python3 docker/dc-dr-demo/check.py --tabletop
python3 docker/dc-dr-demo/check.py --tabletop --browser
```

Preparation reads the local Kanka quest and NPC definitions using the existing allowlisted GET-only client/compiler, clones the already reviewed native Lux build and copies the original DR map volume read-only. This still requires the prepared workstation fixtures described above; it is not an arbitrary quest importer. Kanka remains read-only. Character advancements and subsequent source edits do not automatically refresh this saved encounter.

The launcher combines `compose.dicecloud-demo.yaml`, `compose.dc-dr-demo.yaml` and `compose.kanka-tabletop.yaml`, without rebuilding the already tested image. Include all three files for routine restarts. The older integration launcher includes the new overlay automatically once its private configuration exists. The base launcher alone disables integrated routes; the bridge ignores an additional configuration that is not mounted. Private configuration, quest snapshot and access-file pointers live in ignored `storage/app/kanka-tabletop/`. GM/player accounts are the existing demo accounts; no extra login is required.

The bridge registers each configured tabletop under its own route, shares collection handles, and scopes action replay, action continuation and approvals to the requested room. Each map server sends player movement checks to its matching room. API validation confirms distinct tabletop/actor IDs and map origins, unchanged original encounter revision after new-table tests, and rejected cross-table action replay. Browser checks cover the native-list redirect, Kanka link, hidden duplicate DR chat, token selection, battles, popouts and player privacy. Policy and feature limits are the same as the native demo above. Add the new map volume and private configuration to backups.


## Native DiceCloud interface — current demo

Open **http://127.0.0.1:18084/kanka-tabletop/**; it redirects to the native **Renovar — Native DiceCloud tabletop** entry. Sign in with the existing local DiceCloud GM or player account. This is the original DiceCloud tabletop UI, with creature cards, the bottom selected-character action bar, native targeting/advantage/action dialogs and the native shared roll log. The small `native-ui.js` adapter makes DR fill the viewport and forwards token selection into the native component. Native character cards and the bottom action bar float above the map. The dark grey combat feed fills the screen height on the right; the native menu button uses the same dark grey with a light icon. The navigation drawer starts closed and remains accessible through DiceCloud’s menu button; empty overlay space passes pointer input through to the map. DR's duplicate chat/sidebar and token-properties editor remain hidden.

```bash
python3 docker/dc-dr-demo/launch-tabletop.py
python3 docker/dc-dr-demo/check.py --native
```

The launcher hashes the mounted map/UI adapter files into a private `client-version.env` and sets Meteor’s `AUTOUPDATE_VERSION`. Layout changes therefore notify already-open tabs through Meteor’s native reload mechanism; the injected script URL also includes that version. Run the launcher after changing these mounted scripts. `check.py --live-layout` holds an authenticated tab open across a launch in a second terminal and verifies automatic reload, preserved login and full-viewport map bounds. It reads the encounter without changing combat data.

The deployment uses the existing DiceCloud/MongoDB services and the map service at loopback port 18086. `DC_DR_CONFIG` now selects private `storage/app/kanka-tabletop/native-config.json`, mode `native`. The earlier custom room/action/approval routes, player-publication override and HP/rotation synchronization loop are not registered. The new native initiative coordinator described below wraps native DDP calls only for turn authorization. The old port-18085 map service is stopped by the launcher. Existing custom-room records and code are preserved for reference, not used by this table.

Initial preparation reuses the reviewed Kanka-derived encounter inputs and clones fresh native actors: Lux, bear, dragon and eight Kobolds. No unlimited demo potion action is added. Private, tracked PC death saves use the native check engine and the card dialog described below. Initiative and turn coordination now use the native extension described below. Imported attack damage is placed under DiceCloud's native **On hit** branches, preserving existing library branches. Native actions use the app's standard `actions.insertAction`/`actions.runAction` methods and native logs/properties. Existing pinned upstream compatibility fixes remain; no new parallel combat engine is introduced.

`native-tabletop.cjs` seeds the prepared data, authenticates map access, serves the embedding script, redirects the friendly entry URL and registers the native initiative coordinator. `/api/map` returns permitted map role/credentials and token-to-creature mappings, not combat state. The DR adapter now checks the native coordinator for player movement permissions while retaining DR role/movable-token settings. The native sharing model exposes NPC read data to the demo player for client action evaluation; GM ownership still controls editing. The former custom NPC health privacy layer does not apply; turn approvals now use the native coordinator described below.

The browser check verifies eleven native cards, GM/player access, native selection/action/target/roll dialogs, damage consistent with hit/miss, native shared log, the embedded map, and absence of the old custom controls and unlimited potion action. Screenshots/results are private `native-gm.png`, `native-player.png` and `native-result.json`. The test restores the bear's HP through the normal DiceCloud property method. Other advanced actions/spells are not fully validated in the native UI; use this as an interface evaluation rather than a feature-parity build.

Kanka remains read-only; reimport/refresh and outbound publication remain future work. Persistence/backups still include MongoDB/files, the port-18086 DR volume and matching private configuration. Use all three Compose files for restarts; `launch-tabletop.py` is the preferred entrypoint. The extension retains its directory-local GPL-3.0-only license.


## Initiative and turns in the native interface

The native tabletop now adds coordination features around DiceCloud's existing dice dialogs and action engine. Each native character card has a capital **I**. Clicking a controlled character's **I** requests initiative and lights the GM's **I** in the combat-feed header. The GM opens that header button, chooses both PCs and NPCs, and approves. Zero-HP NPCs cannot be enrolled; PCs remain available for initiative/death-save turns. The GM may approve and immediately roll the selected NPCs, or approve first and use individual NPC buttons or the NPC-roll selection dialog. Each queued PC's **I** lights up for its player. GMs may roll queued PCs as well.

All initiative dice use DiceCloud's native check engine and write native roll logs. Once everyone selected has rolled, combat starts automatically on the highest initiative. Order sorts by total, then initiative modifier and stable name/ID. The tracker highlights the active character, shows the round, opens characters from the list, and can be minimized with a chevron. The GM advances NPC turns and can override PC advancement. Players get **End turn** on their own active turn. Advancing to an NPC selects that character and its map token for the GM. Dead/zero-HP NPCs are skipped. **End combat** clears order, rolls and pending approvals; another battle requires a fresh request and new rolls.

During rolling/active combat, player actions outside their turn pause for GM approval before native action simulation or dice dialogs open. The GM's Requests button lights up; approval allows that one native action, while rejection/cancellation performs no action. Native freeform character-log rolls also pass through the approval gate. GM actions remain unrestricted. Server wrappers recheck authorization on native DDP methods so calling them directly cannot bypass the gate. A small version-pinned `doAction.ts` hook is compiled into DiceCloud's client; the existing engine still handles rolls, targets, damage and effects.

Player movement is limited to their own living PC and, during combat, to that PC's turn. The map refreshes its movement policy, and the DR REST route verifies the authenticated DiceCloud permission on every player move. GM movement bypasses the turn gate. Outside combat, owned living-PC movement is free, subject to DR movable/locked flags. Distance/speed budgets remain manual.

The left navigation button uses a hamburger. The combat feed header has a separate pop-out/dock chevron; the floating feed can be dragged by its header and resized. The feed starts docked and dark grey. These controls preserve the full-screen map and native character/action UI.

`native-combat.cjs` persists coordination in `nativeCombatState`, `nativeCombatRequests` and `nativeCombatPermits` in the existing MongoDB. HP and mechanical results remain native DiceCloud data. Kanka stays read-only. Rebuild using `python3 docker/dc-dr-demo/launch.py` after changing the compiled client hook; ordinary mounted coordinator/UI changes use `launch-tabletop.py`. The map service now shares the adapter version environment so its permission checks restart with server updates.

Run `python3 docker/dc-dr-demo/check.py --native-combat` when the demo is idle. The GM/player flow selects a subset, rolls initiative, verifies automatic combat start and approval before native dice, rejects a direct DDP bypass, checks blocked/allowed movement and NPC auto-selection, clears combat, and starts a fresh request. It uses a no-target native action and does not damage actors. Reports/screenshots remain private. Do not run coordination checks during play.


The pinned upstream offline worker cached live JSON independently of HTTP cache headers. The native deployment serves `native-service-worker.js` at `/sw.js`: authenticated requests, all API routes and mounted integration assets bypass its cache; old MSW caches are removed on activation, while normal public asset/offline behavior is retained. Combat/map reads also use network-only fetches with unique request URLs while an older worker is being replaced. The coordinator requests a worker update on load and refreshes immediately when a tab regains focus. The browser regression verifies that no API responses remain in the worker cache.


### Floating windows, map tools and direct targeting

Turn order floats over the map. Drag its dotted header grip to reposition it, resize its lower corner, or use the chevron to minimize it. Position is remembered in the browser. The combat feed independently pops out/docks and collapses/reopens. GM visibility tools sit above drawing and map/layer tools on the right; their popouts and form fields use the same dark grey scheme. A pinned feed leaves space for tools and open settings.

During native target selection, click a map token or a top character card. Eligible cards show a reticle; selected cards and token labels highlight the target. Single-target actions continue through DiceCloud automatically; multiple-target actions retain the native Continue button. Token dragging pauses during target selection.

Map labels and cards use Good green (>50% HP), Not Good yellow (>25–50%), Bad red (>0–25%) and Down dark red (zero/negative HP), plus matching native condition chips. Down tokens rotate 90 degrees; healing restores upright. Native action logs show health after resolution and highlight hit/miss, natural 20 green and natural 1 red. Existing historical logs retain their original information.

The prepared map starts with its 50px grid enabled for GM and players. Small/Medium tokens are one cell, Large two, Huge three and Gargantuan four; Tiny tokens are half a cell. This migration runs once, preserving later manual sizes/settings. New token defaults are 50px with compact labels.

Run `python3 docker/dc-dr-demo/check.py --native-layout` for layout/target-adapter checks that leave native combat stats and turn order unchanged. Run `vendor/bin/sail node --test docker/dc-dr-demo/token-status.test.cjs docker/dc-dr-demo/token-poses.test.cjs` for focused health/rotation tests.


### Conditions, saves and recurring damage

Each named effect appears once per character. Reapplication consolidates the native buff and its modifiers rather than stacking a duplicate. Different conditions remain independent. Saveable effects have a highlighted status badge. Clicking the status opens that character's draggable, resizable floating window with the effect description, ability/DC, timing and **Roll save** button. Timed saves roll automatically at the specified start or end of turn; the effect window opens only when its badge is clicked. A successful save ends the effect when its rule says so; otherwise the condition remains. Each timed save resolves once per turn; End turn resolves due end-of-turn effects before advancement. Clicking a status opens its details without rolling. Out-of-turn player rolls request GM approval before any dice, with one approval per effect roll.

Explicit ongoing damage resolves through DiceCloud, retaining its damage types, resistances/immunities and HP updates. Start/end-turn damage runs at the prescribed turn boundary; damage tied to a save follows that result, including half/no damage when specified. Logs show the result and health afterwards. Weakening Breath itself deals no ongoing damage. Effects without reliable save/damage metadata remain displayed and require source clarification before automation.

Focused checks: `vendor/bin/sail node --test docker/dc-dr-demo/native-effects.test.cjs docker/dc-dr-demo/native-effects-coordinator.test.cjs` and `python3 docker/dc-dr-demo/check.py --native-layout`. The latter verifies prompts with browser-only fixtures; it does not roll saves or apply damage to the running encounter.


### Floating character sheets and inventory

Click a top-bar character portrait or the selected bottom-bar portrait to open its condensed sheet. Each sheet stays pinned to that character; several can remain open while you select other tokens. Drag the header or resize the corner. The sheet shows current combat stats, ability checks, saving throws, skills/tools, native actions, spells, resources and feature descriptions. Features with defined native actions expose them; passive features remain references. The combat feed uses the same compact text sizing.

Click **Inventory** to show the attached inventory. Its chevron detaches the panel; **Attach inventory** docks it again. Equip/unequip and available item-use actions use DiceCloud's own methods and permissions. Items with no defined use action remain references. Players may inspect shared NPC sheets but can act only for characters they control. Out-of-turn rolls retain GM approval; spells retain native slot selection and targeting.

Run `python3 docker/dc-dr-demo/check.py --native-sheet` for the sheet browser checks and `vendor/bin/sail node --test docker/dc-dr-demo/native-sheet-data.test.cjs` for data mapping. The browser check makes one harmless ability roll and verifies unchanged HP, inventory and combat turns.


During active combat, the top bar names the current character and highlights a PC's turn and portrait card. The controlling player sees **Your turn**. **End turn** sits above the expanded turn-order list and enables only for that player's active PC; the GM sees **Next turn** for NPCs. Due turn saves resolve automatically before advancement. End combat clears the current-turn indicators.


The effect window closes after its roll resolves; the combat feed retains the result. Native save-bearing damage (such as Fire Breath) now uses the same corrected shared source in browser and server. Rebuild without interrupting the running table using `python3 docker/dicecloud-demo/launch.py --build-only`, then deploy with `python3 docker/dc-dr-demo/launch-tabletop.py`. `python3 docker/dc-dr-demo/check.py --native-saves` checks multi-target saves and damage using disposable characters outside the encounter.


Refresh top-bar, selected-character and avatar images from local Kanka with `python3 docker/dc-dr-demo/sync-native-portraits.py`. It uses character/creature images first and linked race artwork when a character has no usable image. Map token artwork stays unchanged. Kanka's local media service supplies the images; source records are read-only. Plans and verification screenshots remain private.


For local artwork, run `python3 docker/dc-dr-demo/set-local-portraits.py BEAR.jpg DRAGON.jpg KOBOLD.jpg --bear-avatar BEAR_TOKEN.png --dragon-avatar DRAGON_TOKEN.png --kobold-avatar KOBOLD_TOKEN.png`. Full-size images become portraits and round images become small avatars. Add `--map-tokens` to apply the round art to the corresponding map tokens as well, preserving their positions, sizes, rotations and visibility. This mapping covers the bear, gold dragon and all kobold instances. Private overrides persist and take priority over later Kanka portrait refreshes.


The bottom of each editable floating sheet has a collapsed **Dice roller** dropdown: choose counts of d4/d6/d8/d10/d12/d20/d100, enter a signed whole-number modifier and roll again as needed. The arrow opens the same controls in a draggable/resizable window. Up to 100 dice can be rolled at once. **Whisper GM** at the top of the sheet or in the roller applies to custom rolls and native sheet actions; private results appear in the GM whisper area of the feed, visible only to the controlling player and GM. Out-of-turn rolls still require GM approval. The legacy free-text terminal refuses private rolls and directs users to these controls. Automatic timed effect rolls remain shared.

Actual HP may fall below zero; the coloured health bar remains, while healthy cards omit the Good text badge. At zero or below, controlled PC cards expose **Death saves**, opening a manual floating dialog. It tracks successes/failures, natural 1 double failures, natural 20 recovery to 1 HP, stabilization and death; results always whisper to GM regardless of the checkbox. Combat allows one death save per turn. A player must resolve their pending death save before ending that turn; the GM may advance deliberately. Healing above zero resets the counters. Further damage while down adds a failure (two for a logged critical hit); massive damage and unsupported healing/resurrection rulings remain subject to GM review. Manual HP edits are observed as HP changes, without inferring an attack's critical state.

Run the native-effects coordinator/policy suites through Sail and `python3 docker/dc-dr-demo/check.py --native-layout` for isolated browser fixtures covering the roller, checkbox, private feed badges, negative-HP dialog and repeat-roll guard without modifying the running encounter.


The sheet's **Resources** section shows remaining uses. **−/+** remain only for resources not yet connected to gameplay; hit dice, spell slots, Lucky and Favored Foe use their integrated controls. Hit dice retain **Roll & heal**, spending one die and applying native recovery with Constitution. Resource reset and short-rest timing remain GM-adjudicated.

Library onboarding controls (for example **Proceed to Sources**, tutorial stages and `tutorialStatus`/`jonStatus` utility counters) are excluded from tabletop sheets. They belong to character setup. The tabletop rejects their execution on the server, including stale sheet actions, using the stored property ancestry or counter-adjustment subtree. Native tutorial messages such as “Utility damaged −1 tutorialStatus” describe an internal navigation counter, not HP damage.

The sheet has a shared **Use Lucky** checkbox, off by default and editable by the character controller or GM. Only checked characters offer Lucky. Eligible manual native attacks, ability checks and saving throws then pause at **Roll preview — Lucky** before their outcome is calculated or posted. Both the eligible PC and GM receive the same choice, including a PC saving throw initiated by an NPC action; the first confirmed choice applies. After 30 seconds the original roll is kept without spending a new point. Disabling the checkbox also closes an unneeded pending choice. **Keep roll** spends nothing. **Reroll** spends one Luck point immediately, then lets you choose an original d20 or the additional d20. Keeping an original die after asking for the extra die still costs the point. Damage, hit dice, initiative and free-form custom dice do not offer Lucky. A resource with explicit `dcdr-reroll:attack,check,save` tags can expose the same resource-backed choice for those categories. Existing Whisper GM and action approval apply. Death saves also prepare a private preview and commit only after this choice; repeated previews reuse the same pending die. Automatic timed condition/concentration saves remain automatic.

Characters with **Favored Foe** get **Mark target with Favored Foe** in the native attack dialog. A miss spends nothing. On a hit, marking spends one use and adds source concentration and target-mark badges. The first qualifying damaging hit on each of the source's own turns adds the recorded Ranger-level bonus die (d4/d6/d8), doubled for a critical hit, through native damage/resistance handling. Existing marks apply without another use. Concentration saves follow damage, separately per attack hit; unconsciousness, expiration, removing the mark/concentration badge or a newly cast concentration spell ends the mark. In combat duration follows ten rounds; outside combat it uses one minute. Range, other concentration interactions and resource recovery remain GM-managed. Bonuses are separate native damage applications, including their native rounding behavior.

Cards size to their visible badges, with no empty status strip; the colored health bar stays visible.

The demo Adult Gold Dragon has an unlimited **Demo: Heal all** action in its sheet and native action controls. It shows a **120-foot-radius circle**, like Frightful Presence, and includes the dragon as a valid recipient. The GM uses **Use selected**, reviews the group and continues through the native target dialog. Only those selected encounter creatures are restored to their own maximum HP, including zero and negative HP, and have their applied conditions/buffs and attached modifiers cleared. An empty selection affects nobody. Character features, racial/class modifiers outside applied buffs, initiative, consumable resources and equipment are preserved. Native HP-set and removal mutations produce one healing log (or follow the actor's Whisper GM setting); recovery clears death-save state and restores token orientation. Player requests cannot invoke the effect. This is a local demo convenience, separate from the SRD dragon stat block and Kanka records.


## Map tools: ruler and shared area templates

The native tabletop has a **Map tools** panel on the right, beside the combat feed. The feed-header button, independent upper-right **Map tools** button and panel chevron open/collapse it. The independent opener remains available with the combat feed collapsed. [Open Map tools directly](http://127.0.0.1:18084/kanka-tabletop/?mapTools=1) forces the panel open even when its saved preference is closed. On narrow screens it temporarily covers the feed. DR's rail, flyouts and dialogs use the same compact dark grey styling. **Advanced DR controls** reveals less-used map/media/note/sharing controls; core fog, drawing, grid and live/send controls remain available.

Choose Ruler, Circle, Cone, Line or Square / cube footprint, set dimensions in feet, then **Place new**. Drag to set length/direction/radius; a click places an area at its configured size. Snapping follows the native DR grid and offsets. Select a placed shape and choose **Edit on map** to move it or drag its white size/end handle. Use numeric fields and **Update** for precise changes. Cancel or Escape exits editing; hold Alt to pan while using a tool. Normal token interaction resumes outside editing.

Each active DR map has its own **Feet / square** setting, initially **5**, editable only by the GM. Rulers offer grid distance (diagonals count as one square) or straight-line distance. Circles use radius; cone far-edge width equals length; lines have separate width; cubes use a two-dimensional square footprint. Scale changes recalculate footprints without moving tokens.

Placed templates share with players by default; the GM can make a template private. Players manage their own templates, and the GM can manage all. Selection and unfinished previews are local; placed edits synchronize through authenticated polling. DR token visibility flags filter player target projections. Shapes and scales persist in MongoDB's `nativeMapVectors`, keyed by tabletop and active DR map ID, and are covered by the existing Mongo-volume backup.

**Target preview** uses token centers. GM checkboxes include/exclude creatures, and **Reset overrides** restores geometric selection. Open a DiceCloud action's target-selection step, then click **Use targets in action**. DiceCloud retains target limits, permissions, turn rules, saves, damage and confirmation; choosing an area does not execute an attack. Walls/LOS, elevation and token-base intersection remain GM-adjudicated. Animated graphics are deferred.

Dragon **Fire Breath** and **Weakening Breath** target dialogs show a temporary cone using the action's recorded range (60 feet for the demo Adult Gold Dragon). The preview points toward the mouse over the map immediately, rotating around the dragon's token center while keeping its length fixed and using the map's feet-per-square calibration. **Aim cone** resumes mouse-follow aiming after a direction is locked. Covered token centers are highlighted, with the source excluded. **Left click** on the map freezes the direction without selecting or moving a token; **Aim cone** resumes following. **Use selected** also locks the direction and replaces the attack dialog's targets with the cone selection; GM target-preview overrides can include/exclude creatures before using it again. Selection waits for native Vue updates between creatures so a multi-target action keeps the whole group. Continue through the native dialog for saves, effects and damage. The cone remains visible through resolution and disappears when the action dialog closes; it does not create a saved map template. The preview is local to the acting browser. Other breath shapes and animation are not inferred.

Run `python3 docker/dc-dr-demo/check.py --native-breath` for the real Fire/Weakening Breath dialog checks (map aiming, fixed length, multi-target selection, GM override and cleanup). The check opens and cancels actions without rolling, spending resources or dealing damage.

Recorded radius effects and spells use the same action-area controls. **Frightful Presence** shows a **120-foot-radius circle** centered on the dragon, excluding its own token. **Use selected** fills the native target dialog; the GM reviews awareness, immunity and creatures chosen before continuing. Self-centered auras follow the caster. Radius spells centered on a point get **Place circle**, which changes the center while retaining the recorded radius. Spell casting range alone is never treated as a radius. Point areas may include the caster; caster exclusion is inferred only from explicit effect wording or Frightful Presence. Cast range, walls, sight, vertical distance and immunity remain subject to GM review.

Applicable sheet actions, spells and features have a **Show area / Hide area** toggle with an accessible pressed state, providing a read-only map preview without casting or spending a slot. Recorded source-based cone and line previews follow the mouse by default, including with Map tools collapsed; their recorded length and line width stay fixed. Moving over controls does not re-aim them. **Left click** freezes the preview without selecting/moving a token; **Aim cone/line** resumes following. **Use selected** also locks the direction before transferring targets. **Hide preview** clears it. **Cancel action** closes a target dialog without resolving it and releases map targeting. These previews are local, temporary two-dimensional footprints; they do not apply conditions or create saved templates. Run `python3 docker/dc-dr-demo/check.py --native-radius` for Frightful Presence selection, sheet preview, point-spell placement and cancellation checks; the test blocks attack commits and leaves encounter HP, effects, resources and turns unchanged.

Native action dialogs float over the map, drag by their header and resize from their corner. Their height stays inside the viewport: long multi-target results scroll internally while **Done** remains visible at the bottom. The header **×** closes the dialog. Embedded DR dialogs also have bounded scrolling and draggable headings where provided. Sheet buttons keep their click when another panel is in front; clicking a control no longer reparents the sheet between pointer-down and click.

The dragon's **Wing Attack** excludes the dragon and uses its recorded **10-foot range between token edges**, accounting for the dragon's Huge token and the target footprint. Its circle outline extends from the dragon's token boundary; overlapping target tokens are eligible. Other area previews retain their existing token-center convention. The legendary **Tail Attack** references the recorded Tail attack, prompts for one creature and uses **+14 to hit, 2d8+8 bludgeoning** with damage on a hit. Startup repairs the prior self-targeted placeholder without duplicating its damage branch. Legendary action budgets and optional movement remain GM-managed. Run `python3 docker/dc-dr-demo/check.py --native-dragon-targets` for selection and property-graph checks without rolling or dealing damage.

`vector-geometry.cjs` shares calculations between server and browser. `native-vectors.cjs` handles authenticated persistence, scale and GM overrides; `native-vector-ui.js` hosts the panel; `native-vector-map.js` renders SVG in DR. A guarded pinned-bundle hook exposes native image/camera transforms for pan/zoom alignment. No new services or image/content packages are required.

Validation: run `vendor/bin/sail node --test docker/dc-dr-demo/vector-geometry.test.cjs docker/dc-dr-demo/native-vectors.test.cjs` and `python3 docker/dc-dr-demo/check.py --vectors`. Six focused tests and the two-client browser acceptance passed: all five tools, independent map scales, shared edits, player scale denial, ownership/hidden-target filtering, GM overrides, edit handles, native target transfer, pan/zoom alignment and reload persistence. Combat HP stayed unchanged. Test annotations are removed and scale restored afterward. Results/screenshots remain in ignored `storage/app/kanka-tabletop/`.

AoE action descriptions appear once beneath the heading in the combat feed. Attack previews retain the original native dialog layout. The redundant header roster is hidden; native portraits remain alongside grouped results, and the roller’s portrait remains beside the log header. Existing logs are formatted for display without rewriting their stored results.

Native combat logs allow up to 4,096 result entries so multi-target attacks can record every saving throw and damage result. The native write wrapper validates the assembled log before HP/property writes or pending-action removal, preventing the former 32-entry rejection from applying damage without a log. Native log mutations also honor each result’s recipient instead of attaching later saves to the first target.
