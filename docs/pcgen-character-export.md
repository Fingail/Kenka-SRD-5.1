# Kanka character export for PCGen and combat

The OCF authoring helper reads local Kanka campaign 2 through the configured API token. It writes private files into the PCGen container's existing `/config` bind mount. It does not write Kanka, refresh a live DR encounter, or change combat state.

```bash
python3 tools/ocf-handler/export-kanka.py \
  --entity-url http://127.0.0.1:18081/w/2/entities/CHARACTER_ID \
  --quest-url http://127.0.0.1:18081/w/2/entities/QUEST_ID \
  --name character-slug
```

Kanka and the OCF handler must already run. PCGen's verified portable distribution must be installed by its demo launcher. The helper reads existing ignored handler credentials locally; no token goes into the command line or export files. Entity/quest URLs must match the configured Kanka origin and campaign. Pagination is bounded and checked before following links. API permissions remain those of the configured token.

Output goes to `/config/Documents/PCGen/characters/{questname_####}/{character-slug}/`. The host equivalent starts at `storage/app/pcgen-demo/config/Documents/PCGen/characters/`. All these files are ignored by Git. Existing exports are never overwritten: use a fresh slug for a later review rather than replacing an advanced character.

| File | Use |
| --- | --- |
| `character.pcg` | Native PCGen character build |
| `character-sheet.json` | `kanka-pcgen-character/1` authoring interchange, with source choices and explicit null placeholders |
| `battle-ready.json` | Validated `kanka-combat-sheet/1` encounter definition |
| `homebrew/` | Private PCGen data pack for imported campaign choices |
| `review.json` | Unresolved choices requiring review |
| `kanka-source.json` | Private source snapshot for provenance/review |
| `open-character.desktop` | Opens the character with isolated source preferences; a shortcut also appears on the demo desktop |

PCGen itself opens `.pcg`, not JSON. Its native build currently supports single-class Ranger characters, with the Hunter/Archery selections used by the pilot. Other class builds need explicit mappings. Native creature exports are reference snapshots rather than leveled PC builds; their recorded actions, saves, skills and traits remain in Description/Notes. Do not use those snapshots for character advancement.

The battle compiler starts from the Kanka OCF baseline or supported NPC properties. Fresh scalar attributes take precedence over older baseline totals. A named **Combat, skills, and proficiencies** article can supply recorded saves, skills and attacks. Explicit numeric totals survive even when their choice provenance is unresolved. Attached active abilities supply reference features; spell-reference links do not become selected known spells. The compiler validates source identity and the existing combat contract before writing files.

The native build preserves current ability scores without applying racial increases or earlier ASIs again. Its private pack removes the replaced ranger features, imports recorded campaign features and inventory, and leaves unknown spells/Canny/Performance resolution as review placeholders. Unsupported feature mechanics remain reference descriptions. Historical per-level HP rolls use zero placeholders plus a labeled aggregate adjustment that preserves the source maximum and retroactive Constitution changes. Historical ASI/feat allocation also requires review. These are editable review drafts: reconcile the flags before treating advancement as authoritative. Use the isolated per-character source preferences; this first private-pack implementation modifies the Ranger source and must not be combined with a different Ranger build that uses the original feature choices.

To export a deduplicated library from an already prepared encounter:

```bash
python3 docker/pcgen-demo/prepare-encounter.py --encounter-id kanka-2-quest-QUEST_ID
```

That snapshot helper exports prepared definitions, not a fresh Kanka refresh. `encounter.json` holds one definition per campaign/entity plus its quantity: eight Kobolds reference one Kobold stat block. Runtime HP, effects, death saves, token identifiers and demo potion supplies are excluded. `encounter.pcp` opens one representative of each definition through **File → Party → Open**. Native source packs must be loaded; use the generated desktop shortcut/source preferences. No extra container volume is needed.
