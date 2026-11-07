# Native DiceCloud + Dungeon Revealer demo

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
