# Combat integration fit: PlanarAlly, Cauldron and Dungeon Revealer

Assessment date: 2026-11-06. Target: GM-reviewed, read-only imports from **local Renovar (campaign 2)**; assigned player characters; a 2014 5e combat sidebar; persistent rolls and combat interactions. Kanka retains the character sources, rules and lore. Campaign 1 remains unchanged.

Follow-up: a [Dungeon Revealer demo](dungeon-revealer-demo.md) was subsequently deployed at the user's request. Native DM/player authentication, shared map/tokens and server dice processing were verified, including map persistence and chat loss across restart. No character integration has been implemented.

## Recommendation

**Keep PlanarAlly as the implementation baseline. Cauldron is worth a short competing prototype; Dungeon Revealer is a weaker fit for this scope.** This is an engineering assessment from inspected source and documentation, supplemented by protocol tests of PlanarAlly and the subsequent Dungeon Revealer demo. Cauldron has not been deployed here.

Cauldron provides more ready-made d20 combat behavior than the current PlanarAlly demo, but it still needs a fuller structured character model, the requested sidebar, a Kanka adapter and verified durable event handling. There is insufficient evidence to promise a lower total implementation cost. Dungeon Revealer offers an accessible internal GraphQL interface, but its player identity, character control and chat persistence require more foundational changes.

| Requirement | PlanarAlly v2026.2 | Cauldron v4.1 | Dungeon Revealer v1.17.1 / inspected master |
| --- | --- | --- | --- |
| Private hosting and public source | Yes; running official pinned container | Yes; PHP/MySQL plus separate websocket server | Yes; documented Docker deployment |
| Individual player accounts and ownership | Existing accounts and shape ownership, tested in demo | User-owned characters and adventure membership exist | DM/player shared passwords; session users rather than the required durable character-assignment model |
| Combat fields | Trackers and custom data, extensible sheet work | Built-in HP, AC, initiative, weapon roll definitions and D&D rule modules | Generic tokens and roll chat; no structured PC sheet found in inspected schema |
| 5e character sidebar | Custom implementation; settings-tab mod hooks are not an established permanent sidebar API | Custom implementation; existing character records are compact and may link to external/PDF sheets | Custom sheet, data model and sidebar required |
| Integration interface | Internal HTTP/Socket.IO and experimental client mod API | Internal PHP controllers/models and websocket protocol; no documented stable external character API found | Internal GraphQL mutations/subscriptions, useful for an adapter |
| Durable combat history | New server event store required | Existing chat/journal UI is useful, but required server durability/structured audit semantics unverified | Inspected chat uses a bounded in-memory array; persistent history requires new storage |
| Fit for this project | Best balance with the already working demo | Credible alternative for basic combat; merits a focused spike | Better suited to lightweight maps, reveal and ad hoc rolls |

## Cauldron: strengths and remaining work

The official source describes a self-hostable JavaScript/PHP/MySQL application. The v4.1 tag is dated July 2026, and the release notes include improved token handover and additional rules support. This is materially more recent upstream activity than the inspected Dungeon Revealer branch. [Source](https://gitlab.com/hsleisink/cauldron), [release notes](https://gitlab.com/hsleisink/cauldron/-/blob/v4.1/ChangeLog), [tags](https://gitlab.com/hsleisink/cauldron/-/tags).

The inspected `libraries/rule_systems/dnd5.php` enables HP, AC, a combat tracker, spell effect areas and named D&D conditions. Its database includes user-owned characters, adventure membership, character weapon roll definitions and portrait/top-down tokens. Those are useful foundations for importing selected Renovar characters. [D&D rule module](https://gitlab.com/hsleisink/cauldron/-/blob/v4.1/libraries/rule_systems/dnd5.php), [database schema](https://gitlab.com/hsleisink/cauldron/-/blob/v4.1/database/mysql.sql).

However, the character model has name, HP/damage, AC, initiative and a few custom numeric fields, with optional PDF/URL sheet references. Weapon entries are names and dice expressions. It is not an existing complete structured 5e sheet with ability scores, skills, proficiency, prepared spells, slots and class-resource semantics. The older Cauldron20 character guide broadly agrees with that limited model, but the inspected v4.1 source is the stronger evidence. [Character model](https://gitlab.com/hsleisink/cauldron/-/blob/v4.1/models/character.php), [character guide](https://extension.cauldron-vtt.net/guide/characters).

There is a useful extension precedent: Cauldron20 integrates D&D Beyond character information through a browser extension. That demonstrates external-sheet interaction, but it is not a Kanka connector or evidence of a supported server import API. For our design, add authenticated import endpoints to a fork rather than automating forms or distributing Kanka credentials to browsers. [Cauldron20 source](https://github.com/Jamster3000/cauldron20).

Do not treat `/history` as proof of a persistent multiplayer combat log. The inspected v4.1 `public/js/adventure.js` labels it **input history** and stores it in browser `localStorage`. An adventure journal and visible dice chat are separate features; neither establishes the requested authoritative roll/state transaction history. Server-side roll generation, restart persistence and private-roll delivery need a runtime test. The separate websocket daemon was not fully inspected: GitLab began returning HTTP 429 during source retrieval. [Client source](https://gitlab.com/hsleisink/cauldron/-/blob/v4.1/public/js/adventure.js).

Self-hosting is supported, but deployment needs packaging work here. Upstream installation calls for a PHP webserver with MySQLi, GD and XML/XSL, MySQL storage, and the websocket server distributed in `extra/cauldrond.tar.gz`. I did not find a ready Compose deployment in the inspected project root. This is more setup work than the existing one-container PlanarAlly demo. PHP overlap with Kanka helps familiarity, but Cauldron uses Banshee rather than Laravel. [Installation instructions](https://gitlab.com/hsleisink/cauldron/-/blob/v4.1/INSTALL).

**Where Cauldron could win:** a deliberately simpler first version consisting of assigned characters, HP/AC, initiative, named weapon rolls and a link to the Kanka sheet. Its combat modules could reduce custom feature work. For the full requested abilities/resources sidebar and reliable combat log, that advantage remains unproven.

## Dungeon Revealer: strengths and remaining work

Dungeon Revealer supports self-hosting, maps, tokens, dice chat and notes, with documented Docker images. The inspected code exposes GraphQL queries, mutations and subscriptions for chat and token operations. It also processes dice expressions on the server, making it a better foundation for trusted roll calculation than merely accepting a client's total. These are useful technical strengths. [Repository and hosting instructions](https://github.com/dungeon-revealer/dungeon-revealer), [GraphQL schema](https://github.com/dungeon-revealer/dungeon-revealer/blob/master/type-definitions.graphql), [server chat processing](https://github.com/dungeon-revealer/dungeon-revealer/blob/master/server/chat.ts).

Its permission model is the larger mismatch. Deployment uses `DM_PASSWORD` and `PC_PASSWORD`; chat identities/session users do not by themselves provide durable account ownership of imported characters. The token schema has an `isMovableByPlayers` flag rather than a per-character assigned-player roster. A reliable implementation would need durable users, per-character access rules and mutations enforcing them. [Authentication documentation](https://github.com/dungeon-revealer/dungeon-revealer#prebuilt-app), [token schema](https://github.com/dungeon-revealer/dungeon-revealer/blob/master/type-definitions.graphql).

The inspected chat implementation initializes an in-memory message array, bounds its size and publishes updates. It does not supply a durable combat-event store across process restarts. No full 5e character profile or ability/resource model was found in the inspected schema. A GraphQL interface improves adapter development, but it does not remove those missing application features. [Chat storage](https://github.com/dungeon-revealer/dungeon-revealer/blob/master/server/chat.ts).

Maintenance is another planning consideration: GitHub's API reported the latest release as **v1.17.1, 2022-02-20**, and the latest master commit as **2023-03-17**, when checked for this assessment. This does not prove the project is abandoned, but an implementation should budget for dependency and runtime compatibility review. [Latest release](https://github.com/dungeon-revealer/dungeon-revealer/releases/tag/v1.17.1), [inspected master commit](https://github.com/dungeon-revealer/dungeon-revealer/commit/2fab4fdb19d3c3a8865f96c5172805325ab8bb7c).

**Where Dungeon Revealer could win:** a reduced shared tabletop with map reveal, generic tokens and roll macros, where the group accepts shared access and reads full character sheets in Kanka. That does not match the newly requested assigned-character combat UI.

## What would justify switching

Use the same vendor-neutral `CombatProfile` import contract described in the [combat plan](planarally-combat-integration-plan.md). The read-only Kanka normalizer is needed for any VTT, so it should not depend on PlanarAlly token formats.

A Cauldron comparison spike should prove:

1. A reproducible container deployment, separate GM and player accounts, restart/save and websocket connections.
2. One reviewed read-only Renovar character import, image and one weapon attack, with no source changes.
3. GM assignment/handover to a player, correct token control and private NPC fields absent from unauthorized responses.
4. One sidebar section populated from the normalized profile, rather than a PDF/external sheet.
5. A roll resolved by the server and a shared result that survives application/daemon restart; if unsupported, identify the exact additional backend work.

Allocate **4–8 engineering hours for that investigation**, not as a guaranteed finished deployment. Prefer switching only if it demonstrates less work for the required sidebar/log and equivalent permission handling. Otherwise keep the PlanarAlly plan's **40–66 hour** pilot estimate; this assessment does not establish a justified lower estimate for Cauldron or Dungeon Revealer.

All comparison imports must remain read-only to local Renovar. No new VTT container or live Kanka integration was started during this assessment. The existing PlanarAlly demo remains running.

## Source boundaries

The inspected license files identify PlanarAlly as MIT, Cauldron with the GPL version 2 text, and Dungeon Revealer as ISC. Keep any VTT fork separate, retain its notices and do not copy its implementation into the Kanka fork. Communicate through the reviewed import contract; Kanka's existing license terms remain in place. [PlanarAlly license](https://github.com/Kruptein/PlanarAlly/blob/v2026.2/LICENSE), [Cauldron license](https://gitlab.com/hsleisink/cauldron/-/blob/v4.1/LICENSE), [Dungeon Revealer license](https://github.com/dungeon-revealer/dungeon-revealer/blob/master/LICENSE).
