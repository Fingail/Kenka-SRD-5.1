# Current DCDR5e tabletop handoff

The maintained DiceCloud + Dungeon Revealer runtime now lives in the separate
private [Fingail/DCDR5e](https://github.com/Fingail/DCDR5e) repository. Its reviewed
integration baseline is commit
[`682c8bc0cac39572580140da011bbc30998cf835`](https://github.com/Fingail/DCDR5e/commit/682c8bc0cac39572580140da011bbc30998cf835).
Access to that repository is required. The older tabletop adapters in this Kanka
fork remain an integration-history snapshot; current runtime changes are reviewed
and maintained in DCDR5e rather than mirrored here.

## Current integration

- Quest Builder browses all 317 offline SRD 5.1/2014 creature definitions and
  installs only selected missing types. Installed definitions are reused across
  games; choosing eight Kobolds prepares one definition, not eight definitions.
- Kanka quest reads use the current map image and distinct linked NPC resources.
  Explicit `dcdr.template`, `dcdr.rules` and `dcdr.template.ver` properties take
  precedence. Confirmed private local mappings are keyed by Kanka origin,
  campaign and entity IDs and pin the rules version and content hash. Exact-name
  proposals require GM confirmation; conflicts are not silently guessed away.
- Kanka quest access is read-only. Its built-in creature relationship IDs are not
  repurposed. Workshop character export is a separate, explicitly reviewed action
  limited to configured writable local campaigns.
- Launch creates an empty map and Add Creature resource list. The GM places NPCs
  and attaches Workshop PCs afterward. Map tools can add types during preparation
  without recreating the map or rewriting existing actors.
- Encounter templates launch fresh NPC copies at saved placements. Table-bound
  checkpoints preserve session state and create a safety save before restoration.
- DR retains map scaling, walls/doors, shared vision, discovery, traps, caches,
  targeting and tokens. DiceCloud owns character builds, sheets and native rolls.
  Unparsed attacks and advanced creature mechanics remain GM-managed.

## Operation

With the matched private state restored, use DCDR5e's own README and handoff:

```bash
python3 scripts/stack.py check
python3 scripts/stack.py status
python3 scripts/stack.py up
```

Run those commands from the DCDR5e checkout, not this Kanka checkout. Normal
operation uses DiceCloud, MongoDB and DR; the optional Quest Builder overlay adds
its provisioned map slots and a read-only private SRD-pack mount. Keep the Kanka
network/credential configuration on the server and preserve the private compiled
pack, native libraries, artwork and database/map/files volumes in backups. A bare
Git clone cannot recreate prepared private campaigns or libraries.

The local GM launcher is `http://127.0.0.1:18084/?workshop=1&action=quest`; Kanka
remains at `http://127.0.0.1:18081`. These are workstation URLs, not hosted services.
Do not run old and new tabletop stacks against the same live volumes concurrently.

## Validation and boundaries

DCDR5e commit `682c8bc` passed 343 native tests and live browser checks for the
317-entry catalog, stat-block preview, retained Kanka v1 identities, selective
Frog/Goblin v2 preparation, no-attack acceptance and exact-root reuse. The two
cold test definitions prepared in about 2.3 seconds on the extraction workstation.
A private synthetic mapping test verified source scope/hash persistence and
unchanged actor/table counts. Existing quests, maps and Kanka fields were kept.
These results describe DCDR5e, not a fresh deployment of this historical snapshot.

No credentials, generated stat-block packs, account data, campaign exports,
artwork or private state are included in this handoff. Kanka's upstream license
and Commons Clause remain unchanged; DCDR5e documents its own component licenses
and the SRD's CC BY 4.0 attribution separately.
