# Local and live Kanka sync arrangements

Agreed workflow, updated 2026-11-06. This document governs manual Codex-assisted transfers. The included commands produce mapping plans; they do not implement an unattended two-way sync service.

## Campaigns and authority

- Local `http://127.0.0.1:18081/w/1` is **5e Rules — SRD 5.1**, the clean 2014 rules library. Keep it unchanged by campaign imports, deduplication and live sync.
- Local `http://127.0.0.1:18081/w/2` is **Renovar**, the working campaign with its own copy of the rules and campaign content. Local references resolve within this campaign.
- Live campaign `433129` is the campaign destination when an online export is requested. Campaign `412271` is a reference/download source. Do not write to that reference campaign as an incidental part of sync.
- Online writes are currently paused. Preparing a plan, changing local content or editing this document does not start a live export. Run transfers manually within the requested scope, using the API user's actual permissions.
- Keep the project in `/home/lo/Repo/kenka`; the application checkout is `local/app`.

## One local reference for each rules concept

Use the existing 5e entry in local Renovar whenever it represents the same concept. Avoid a second entry merely because that concept arrived from the live campaign. Preserve campaign lore, articles, properties, image credits, attachments and relevant relationships on the canonical entry, with their original visibility and provenance. Keep the main SRD rules text and source hashes intact.

| Category | Identity and distinction to preserve |
| --- | --- |
| Races and subraces | Match the actual race or variant. Elf is not High Elf, Wood Elf or Drow. Preserve races absent from the SRD. |
| Classes and subclasses | Match class/subclass and rules edition. A legacy Ability that serves as a class reference can point to the local Class category. |
| Backgrounds and feats | Reuse equivalent entries; retain campaign variants and options absent from SRD 5.1. |
| Features and senses | Match owner and meaning. The Darkvision spell is different from the Darkvision sense; class/race features with the same short name may differ. |
| Spells | Match the spell and rules edition; preserve distinct spells absent from this SRD library. |
| Equipment and magic items | Reuse generic rules templates. Keep named or modified possessions, ownership, quantity, charges, attunement, equipment state and acquisition notes distinct. |
| Creatures | Match the specific creature and edition. A species, creature group and named individual are different resources. |
| Conditions, hazards and diseases | Match the specific rules concept and version; retain distinct campaign effects. |
| Languages | Match the language; do not merge dialects, secret codes or unrelated features by name alone. |
| Planes | Reuse the same plane while preserving campaign cosmology as lore. Retain distinct settings, collections and locations. |
| Pantheons and deities | Match the actual pantheon/deity and identity; preserve setting-specific entities and memberships. |
| General rules | Match the same rule or chapter. A short topic is not automatically equivalent to an entire chapter. |

The same rule applies to later rules categories. The matching category describes meaning, even if local and live campaigns store that meaning in different Kanka modules.

Keep 2014 SRD 5.1 and 2024 material separate. Existing imported non-SRD material may remain, with its source and version identified; it must not silently replace 2014 rules. Do not download additional material as a side effect of deduplication.

Unique possessions stay as campaign entries linked to their base rules. Ordinary owned equipment can use a shared rules entry through its inventory row, preserving the owner, quantity and individual notes. Move those per-owner details with the inventory association, not into a public rules description.

## Download and import from live

1. Download the selected entry and, when requested, its linked resources. Save a private source snapshot before changing local content.
2. Check source read access and local destination access. Collect the destination inventory for each affected category; paginate it fully. A denied or incomplete result is not proof that an entry does not exist.
3. Resolve existing 5e matches before considering creation. Check category, edition, feature owner, variant and instance identity. Prefer stable SRD identity, then recorded mappings, then a unique exact name or approved alias within the correct category. Prefer the matching local 5e entry over a redundant campaign copy.
4. Store the live-to-local mapping even when reusing an existing entry. Multiple equivalent live entries may map to one local canonical entry.
5. Preserve campaign additions separately from immutable SRD text. Preserve private visibility; do not expose private notes through copied articles, properties, tags or relationships.
6. Create a campaign resource only when no equivalent entry exists. Ambiguous names, conflicting mechanics and inaccessible known targets require review instead of guessing or creating another duplicate.
7. Rewrite references and verify them before removing anything. Keep distinct or unresolved variants linked to their related rules instead of collapsing them.

## Export to live without the full 5e library

1. Start with the selected campaign entries and their required dependencies. Do not upload the entire local SRD library merely because those entries link to it.
2. Refresh the readable live inventory for affected categories and validate the saved mappings against the destination campaign. Prefer the existing matching Renovar resource. If no campaign resource exists but an equivalent live 5e resource does, reuse it.
3. Where neither exists, create the minimum needed campaign resource in the live campaign, carrying suitable source attribution. Confirm API create permission and module availability before sending a write. If live uses a different module for the concept, map it explicitly and retain the semantic category in private transfer metadata.
4. Record the returned live **entity ID** and **native child ID** separately. Rewrite references to the destination IDs; never copy local IDs into live relationships or inventory payloads.
5. Create missing dependencies first, then apply links, parent relationships, tags, attachments and native associations. Subsequent runs reuse the recorded and verified live resources.
6. Verify readback before recording the batch as complete. A timeout or uncertain response requires reconciliation against live state before retrying a create.

Local canonicalization does not delete corresponding live Renovar entries. Local deletion is not an instruction to propagate deletion online. On a later import, those live entries resolve back to their canonical local 5e entries.

## References, privacy and conflicts

Migrate entity mentions, typed mentions, local URLs, parent links, relationships, backlinks, bookmarks and relevant quest/timeline references. Also migrate native associations such as character races, ability assignments, inventory item IDs and location links. Categories stored as custom entities may have no native child ID. When a legacy Ability becomes a Class reference, update the mention category too; do not invent an ability ID for the custom Class.

Use campaign-scoped mappings for each environment. Numeric IDs can collide across installations. Preserve source IDs for provenance and round trips, but always use mapped destination IDs in actual links. Do not blindly reverse a many-to-one local mapping when exporting.

Downloads come first. Codex can then add notes and tags to discovered resources and prepare uploads of selected entries with the required linked items. Linked-resource inclusion is explicit on either side; discovery alone does not authorize exporting every discovered item.

Exclude Lux's private notes, dispatches and stats from shared online updates. Other private material, including private journals, requires an explicit private transfer with access verified at the destination. A relationship to a private entry must not reveal its contents through a public summary. Preserve API permissions and fail closed when access is denied. Do not send messages or start scheduled sync jobs.

Preserve both sides of conflicting edits and surface the conflict. Do not overwrite modified SRD entries or choose a rules variant silently. Keep hashes/source timestamps in private state for later comparison. Automated three-way content merging is not implemented.

## Removing local duplicates

Before removal, back up the local database and media; save the proposed mapping and source content. Preserve lore, articles, properties, images, attachments and visibility. Migrate all remaining references and confirm that associations retain their counts and per-owner fields. Keep stable import aliases so a later download does not recreate removed entries.

Move unused duplicates to recoverable Kanka trash. Do not purge media or permanently delete source rows as routine cleanup. Rebuild search and clear affected caches. Verify that lists and representative pages use the canonical entry and that the clean SRD campaign is unchanged.

The initial local cleanup removed 10 duplicate race entries and then 27 additional references across creatures, equipment, classes, a feature and planes. Distinct 2024 rules, senses, campaign variants and unique possessions remain separate. Campaign-specific migration reports and original content are private runtime data, not public repository content.

## Available planning hooks

`RulesTransferResolver` handles all semantic categories; `local:plan-rules-transfer` accepts a classified JSON manifest. Run it through Sail:

```bash
vendor/bin/sail artisan local:plan-rules-transfer import storage/app/transfer-plan-input.json
vendor/bin/sail artisan local:plan-rules-transfer export storage/app/transfer-plan-input.json
```

Minimal manifest shape, using illustrative IDs:

```json
{
  "source_campaign_id": 100,
  "destination_campaign_id": 200,
  "destination_complete": true,
  "sources": [
    {"entity_id": 10, "native_id": 7, "name": "Mace", "category": "equipment", "edition": "2014"}
  ],
  "destination": [
    {"entity_id": 20, "native_id": 9, "name": "Mace", "category": "equipment", "edition": "2014", "srd_key": "srd5.1:item:equipment:Mace"}
  ]
}
```

Rows may also carry `aliases`, `owner_key`, `variant_key`, `instance_key` and a campaign-scoped, validated `destination_entity_id`. Include the same identity fields on both sides. Classify source data before planning; the hook does not infer semantic identity or rules equivalence from arbitrary HTML. Use owner-qualified feature names and aliases. Resolve ambiguous candidates before writes.

The output proposes `reuse`, `create` or `conflict`, and reports zero writes. `create` is a plan, not a completed API request. The race-specific `local:plan-race-transfer` hook remains available for compatibility. The paused `tools/kanka-colab-integration` prototype downloads journals; it is not an implemented rules uploader. Connecting these plans to a generalized API write pipeline is future work, governed by the arrangements above.

Any VTT integration is limited to selected encounter tokens and gameplay statistics from read-only campaign 1. Lore, rules, notes and campaign records remain in Kanka. Encounter configurations and mappings live outside the SRD campaign entities, with no VTT writeback or live Kanka sync. The MapTool demo has been retired; its [historical proposal](docs/maptool-integration-plan.md) retains these requirements for future candidate evaluation. No VTT integration is currently deployed.

## Private state and handoff

Runtime state belongs under ignored `storage/app/`: `active-campaign.json` records the active environment, `renovar-local-state.json` records imported entity mappings and merge aliases, and `race-dedup/` and `rules-dedup/` contain migration snapshots and verification reports. Parent deployment backups are under `local/backups/`. These files can contain campaign content and must remain private.

Keep tokens, account credentials, environment files, signed URLs and private exports out of source control and this document. Keep the existing root hosted mapping separate from local mappings. Publishing the fork does not authorize publishing imported campaign lore or third-party artwork; retain source licensing and attribution for each transferred asset. See [LICENSING.md](LICENSING.md).
