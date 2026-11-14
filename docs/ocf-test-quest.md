# Private pilot quest compatibility

The workstation used a private campaign-2 quest as the integration pilot. It links characters/creatures using typed mentions and an explicitly selected world map. Its source records, portraits, normalized exports, credentials, snapshot hashes and native token mappings are runtime data and are not shipped in this repository.

The public implementation includes a compatibility reader for that input style, documented alongside the preferred [quest/sheet contract](kanka-encounter-input-format.md). The handler uses GET-only Kanka requests, explicit map identity and stable per-instance participant IDs. Repeated creature mentions expand into separate tokens. A world-overview image is not assigned a combat-distance scale.

For a fresh installation, prepare a working campaign 2, add a quest/map and participant sheets, then use the launcher. The existing workstation IDs used by live/browser checks do not constitute a public seed. Use the reusable [empty combat-sheet template](../data/ocf/combat-sheet.v1.template.json) and reviewed actions for your own fixtures. Existing HP, inventory, conditions and equipment flags must not be changed to make a check pass.

The [current demo guide](ocf-dr-integration-demo.md) describes deployed combat controls, effect saves, visibility, turn permissions and verification. Earlier plans describe design intent, not a claim that every proposed refresh/UI feature is implemented.
