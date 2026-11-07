# Proposed Kanka encounter input format

Status: basic attribute input implemented and exercised by the [OCF/DR demo](ocf-dr-integration-demo.md), 2026-11-06. The larger input contract below includes deferred features. Runtime Kanka API access is read-only.

The [selected pilot quest](ocf-test-quest.md) predates this format. Its private fixture uses direct typed mentions, known native properties and an explicit map override. This is a documented compatibility test, not an automatic fallback that silently treats all narrative links as combat participants.

## Authoring workflow

The GM prepares characters, creatures and a quest through Kanka's normal interface. The OCF handler uses read-only API requests to load those resources. It does not create or update Kanka entries, attachments, inventory or relationships.

Use existing Kanka features: **Quest Elements**, **attributes/properties**, **inventory** and **abilities**. The current sheet is one multiline block attribute named **OCF Combat Sheet v1**, with lookup key **`ocf_combat_v1`**. Its raw API `value` contains the complete basic JSON sheet; `type_id=2` provides a multiline editor. Native JSON file attachments are an optional future alternative, not the current loader input.

## Quest as encounter manifest

Create a quest and add the map and participants as linked **Quest Elements** with these proposed role values:

| Role | Linked resource | Meaning |
| --- | --- | --- |
| `ocf:map` | Map | The encounter's selected background map; exactly one initially |
| `ocf:pc` | Character | Player character; control comes from approved account assignment |
| `ocf:ally` | Character or creature | Friendly participant, initially controlled by the GM |
| `ocf:enemy` | Character or creature | Opponent, initially controlled by the GM |

Other quest links remain narrative references and do not spawn tokens. Do not scrape all links from the quest description, recursively import its relationships, or treat a character's presence as permission for a player to control it.

A linked participant defaults to **one instance**. Default positioning is a clearly identified staging arrangement, not an assertion about story locations. An optional quest attachment named **`encounter.v1.json`** supplies counts and placement options. It refers to quest-element IDs, so two differently configured groups may link to the same creature entry without identity collisions.

Proposed example, with synthetic IDs:

```json
{
  "schema": "kanka-encounter/1",
  "edition": "5e-2014",
  "elements": [
    { "quest_element_id": 101, "count": 1 },
    { "quest_element_id": 102, "count": 4 }
  ]
}
```

This file may later include validated initial placements and public labels. It cannot introduce unlinked participants, override source access controls or execute macros. With one map, ordinary role-linked participants and counts of one, no encounter JSON is necessary. Missing or ambiguous maps and invalid role/resource combinations are validation errors, not guesses.

## Character and creature sheets

Each imported participant has exactly one **OCF Combat Sheet v1** attribute, preferably with lookup key **`ocf_combat_v1`**. The handler identifies either that key or the canonical name and rejects duplicates. This is an adapter input, **not a claim that arbitrary JSON is a native OCF `CharacterFile`**. The handler validates it and computes the supported mechanics using the pinned engine/pack.

The reusable empty template is [combat-sheet.v1.template.json](../data/ocf/combat-sheet.v1.template.json). The explicit local authoring helper is [ocf-sheet-template.php](../docker/local/ocf-sheet-template.php); it generates the field from existing statistics, accepts a reviewed action fixture and refuses to overwrite an already edited sheet. It is separate from the GET-only runtime handler. Lux and Black Bear now have these fields and API round trips were checked.

For basic operation, edit the JSON field as the authoritative sheet. Editing an older standalone AC/HP property alone does not rewrite the JSON. Regeneration is an explicit authoring action; refreshing the runtime reads the canonical JSON rather than silently merging conflicting copies. Current HP is encounter state and does not belong in this template.

The structured sheet is the source of combat mechanics; ordinary prose remains descriptive. Keep additional mechanics in this file instead of spreading competing copies across descriptions and untyped properties. Existing human-readable properties can be displayed for comparison, but differing values must be reported rather than silently merged.

The format needs these groups:

| Group | Required information or behavior |
| --- | --- |
| Version and identity | Adapter schema, 2014 edition, source character/creature association; engine/pack mapping tracked by the handler |
| Build | Available race/class/level choices, ability scores, proficiencies and feature selections; unsupported campaign choices explicitly retained |
| Reviewed statistics | AC, maximum HP, speed, initiative, saves/skills and relevant overrides, with explanations where they differ from normal derivation |
| Inventory source | Declare whether native Kanka inventory or the sheet supplies equipment; do not implicitly merge both |
| Actions | Stable action keys, activation type, attack/damage/save parameters, limits, and optional links to the corresponding Kanka ability/item |
| Spellcasting/resources | Recorded casting ability, prepared/known selections, slot/resource maxima and supported recovery rules |
| Provenance | GM-reviewed overrides and explicit `manual`/`reference_only` markers for unsupported features |

An action can record a **native inventory-entry ID**, without confusing that row with an item entity ID. The basic loader currently reads the attack's equipment flags from the canonical JSON, not directly from the native Inventory tab. Automatic inventory-aware refresh is deferred; until then, update the JSON as well when changing which attacks are available. Lux's JSON explicitly marks the longbow as selected for this test. An ability reference alone does not supply an executable formula.

The exact field names and strict JSON Schema should be established in the compatibility phase. Prefer a compact adapter sheet over storing duplicate descriptions or entire rulebooks. For an already generated OCF character, a later version can support an explicitly tagged native OCF payload, but must validate its schema, pack versions and campaign extensions rather than mixing formats silently.

## Source revisions and updates

Identify the sheet by its attribute ID/key and value hash, not just the parent entity's `updated_at`. Hash selected source inputs, compiled values and map/token artwork independently. Kanka also returns a request-time `sync` value; that is not a source-content change.

When updating a sheet, the GM edits the canonical multiline attribute in Kanka. Multiple matching names/keys are an ambiguity error, not a newest-file selection. This is a manual Kanka operation, never handler writeback.

**Refresh from Kanka** re-reads the quest and the selected sheets/inventory/artwork and presents a diff. The handler retains its previous snapshot and runtime state until the GM applies the refresh. Preserve spent uses, current/temp HP, conditions, initiative, positions and fog. Changes to maxima or action definitions require reconciliation; neither attachment replacement nor refresh silently starts a rest, refills resources or changes an already recorded roll.

## Visibility and validation

Make source sheets available to the dedicated read-only API identity using Kanka's normal visibility rules. That identity's ability to read a GM-only sheet does not make the whole sheet available to players. The handler projects only the permitted fields and actions for each authenticated player.

Fetch assets only from configured Kanka/storage origins, without forwarding credentials to arbitrary URLs. Validate file size, JSON structure, edition, reference scope and allowed expressions. Treat all files and descriptions as data, not executable code. A private or unreadable linked resource must be reported to the GM, not bypassed through another endpoint.

No new campaign category or Kanka database migration is required for this input design. A future Kanka sheet editor or validated upload helper could make authoring easier; it is optional and not required by the read-only handler.
