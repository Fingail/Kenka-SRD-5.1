# Dungeon Revealer demonstration

The current optional DR deployment includes the OCF encounter handler. Use the [current launch, access and verification guide](ocf-dr-integration-demo.md) and the README instructions. The older standalone-only walkthrough below is historical and is not the fresh-install launch path.


DM view: <http://127.0.0.1:18083/dm>. Player view: <http://127.0.0.1:18083>.

**Current deployment:** [basic OCF integration](ocf-dr-integration-demo.md) is enabled. The active **OCF — Test Quest** scene contains Lux and Black Bear on the Renovar map, with a new stats/attack popup. Open <http://127.0.0.1:18083/dm?ocf_encounter=kanka-2-quest-3536> after GM sign-in, or use **OCF encounters** in the map toolbar. Earlier demo maps remain available. The historical standalone setup below predates the integration; use `python3 docker/dungeon-revealer/launch-integration.py` for current startup.

Use the respective passwords in ignored `storage/app/dungeon-revealer-demo/access.json`. This application uses shared DM/player passwords, not individual account logins. Open the player view in a private window or another browser profile to compare permissions. You may also choose a display name in chat.

## Retained standalone demonstration maps

The active **Renovar — World Map** contains a private copy of local Renovar's player-facing world map and six character images: Lux, Vidar Blüd, Ryden True, Elira in summer, Lysanda in winter and Edric Garren. Lux uses the existing transparent token; the others use their source portraits. Lux is movable by players; the others are GM-controlled. Their placement along the upper map area is for demonstration and does not establish story locations. No character statistics or abilities were imported. There is no individual assignment to Lux: everyone with the player password has the application's shared player access.

The original synthetic two-room **Encounter Demo** map remains in the map library, with Hero, Guide and two enemies.

If the DM view still shows that older map, open the map library, select **Renovar — World Map**, and click **Load Map**. The DM's loaded map is remembered separately in browser `localStorage` (`loadedMapId`); changing the server's live player map does not change an already selected DM map. Refreshing alone preserves that old selection. The player view follows the shared live map instead.

Try moving Lux, panning/zooming, editing token settings from the DM view, and hiding/revealing part of the map with the fog tools. Use the DM's publish/send control to share updated fog with players. The world map starts fully revealed, with no combat grid.

Open chat and send `Attack: [1d20+5]` or `Damage: [1d8+3]`. Single brackets invoke server-side dice rolls. The prepared tokens are generic; they have no imported 5e character sheets or combat resources.

Authenticated HTTP and Socket.IO/GraphQL checks verified DM/player access, shared map and tokens, server-generated dice results, rejection of unauthenticated map access, and rejection of player changes to DM map settings. Restart checks verified that the map/tokens persist and dice chat history does not. A visual browser walkthrough remains for the user.

These earlier map/portrait copies were made from local Renovar using a read-only database transaction and contained no character statistics or private notes. The newer OCF scene separately reads the explicitly authored JSON sheet properties through the API. Runtime access does not write back to Kanka. The old media-copy mappings stay under ignored `storage/app/vtt-renovar-media/`. PlanarAlly remains independent at <http://127.0.0.1:18082>.

## Launch and shutdown

Run from the application directory:

```bash
python3 docker/dungeon-revealer/launch-integration.py
docker compose -p kenka-dungeon-revealer-demo -f compose.dungeon-revealer-demo.yaml ps
docker compose -p kenka-dungeon-revealer-demo -f compose.dungeon-revealer-demo.yaml stop
```

The preparation command preserves existing passwords. On a fresh workstation it creates random private credentials; the database starts empty and the GM uploads a map in the browser. The prepared workstation's test scene is runtime state, not a committed seed. Re-running preparation does not modify saved maps.

Always include the explicit project name: the Kanka `.env` defines its own Compose project. Only one additional container starts, bound to loopback port 18083, with its own persistent data volume. Do not remove the volume during ordinary shutdown. No Kanka database access or shared network is configured.

Back up `/usr/src/app/data` while the demo container is stopped, or use an equivalent consistent volume snapshot. It includes uploaded maps, JSON settings and the application's SQLite data. It does not include the in-memory chat. A private workstation snapshot is stored at `storage/app/dungeon-revealer-demo/backup/`; it must stay outside public Git history.

The official Docker Hub image is pinned to **v1.17.1**, digest `sha256:234c13f650e977f6f3a344d9265eef979da59da8a572629db88b5cb448417797`. The newer GHCR address rejected the pull during setup; the release's documented Docker Hub image succeeded. [Release and Docker instructions](https://github.com/dungeon-revealer/dungeon-revealer/releases/tag/v1.17.1), [source](https://github.com/dungeon-revealer/dungeon-revealer/tree/v1.17.1).

See the [combat fit assessment](vtt-combat-fit-assessment.md) and [proposed integration contract](planarally-combat-integration-plan.md) for the capabilities that would need to be added before using this demo for assigned-character combat.

The [character manager/code assessment](character-manager-options.md) considers a separate 2014 5e engine or manager between read-only Kanka imports and Dungeon Revealer, with OCF and DiceCloud as the initial candidates.

The current [quest-driven Kanka–OCF–DR deployment plan](kanka-ocf-dungeon-revealer-plan.md) has the GM prepare sheets and a quest linking resources in Kanka. A small handler accepts the quest URL, reads and validates those inputs, prepares the encounter and launches DR into the correct map. The handler stores runtime state/history and offers reviewed refreshes of Kanka edits. It remains a proposal; this demo has manual map/token copies only.
