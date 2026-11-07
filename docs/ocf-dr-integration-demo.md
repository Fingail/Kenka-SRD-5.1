# Basic OCF / Dungeon Revealer integration demo

The basic integration is running. Kanka stays at <http://127.0.0.1:18081>, and DR at <http://127.0.0.1:18083/dm>. The OCF handler is private on the Docker network; browsers reach it through DR's same-origin `/ocf-api` proxy.

## Try the demo

1. Sign in to DR as GM using the existing private `storage/app/dungeon-revealer-demo/access.json` credentials.
2. Open <http://127.0.0.1:18083/dm?ocf_encounter=kanka-2-quest-3536>. This explicitly loads **OCF — Test Quest**, avoiding DR's remembered old map.
3. **OCF encounters** is at the top left. The shared combat log is docked on the right, filling the viewport height with a 12px inset. Select a native map token to open/update the single docked character sheet, or use **Characters** in the log header. There is no separate Stats & rolls button.
4. The sheet shows HP, AC, movement, initiative and OCF-calculated ability modifiers. Ability buttons make standalone rolls; **Initiative** requests a shared combat queue for GM approval. An **Attack** button starts the guided interaction described below. Server results and GM decisions are saved in the shared combat log.
5. Open the player page in a private browser window with the player password. Shared players can view/roll Lux; the bear's combat sheet and unrelated private rolls are GM-only, while attack outcomes are shared in the log.

Reload an existing tab once after an update. DR's upstream static middleware originally cached the unversioned bridge script for a year, which could preserve the old layout. The adapter now serves page/launcher HTML and bridge JavaScript with `no-store`, and puts a content hash in the script URL so even a previously cached copy is bypassed. `X-OCF-UI-Version` identifies the served version for diagnostics. The patched native module also has its own import-map URL. The toolbar chooser is an independent way to open a linked sheet.

## Combat log and floating character sheet

The shared combat log is visible by default, docked along the right side for the full screen height. It follows the selected encounter with GM/player visibility filtering and updates independently of the sheet. **Characters** provides an encounter roster when a map token is not convenient to select.

Selecting a native token opens or replaces the single character sheet. GM and player sheets start docked above the log. Closing a sheet resets its next opening to this shared default; selecting a token reopens a closed sheet and expands a minimized panel. Pop it out to drag its title bar or use the resize handle. Repeatedly selecting the same token preserves inputs and the current interaction. Its right-facing chevron docks it above the log. The header's left-facing character-sheet chevron detaches it again. Detaching/redocking moves the existing DOM, preserving selected targets, open details, roll modes and pending input.

The combat log has its own left-facing popout chevron. Its floating header has a right-facing return chevron to dock it again. The main down chevron collapses the right panel to its compact header; the up chevron restores it. Detached panels remain visible. Closing a sheet leaves the log available, and the turn tracker stays at bottom left. Floating panels remain inside the page.

## Guided attacks

Click **Attack**, then choose another target in the same encounter (or a GM-defined object). The handler rolls against recorded AC and, on a hit, rolls and applies damage immediately for both PC and NPC attackers. On-turn attacks need no GM damage approval step. Out-of-turn player actions wait for DM approval before any dice are rolled. Natural 1 misses; natural 20 hits and doubles damage dice without doubling flat modifiers. Temporary HP absorbs damage first, and HP cannot go below zero.

The sheet walks through target, attack result, damage result, automatic application and HP outcome. **End turn** sits beside **Attack again** and **Heal again**, enabled only when the displayed character has the active turn. Players can end a PC turn; the GM can end PC or NPC turns. The GM sees exact target HP; players see only qualitative health in the same location. NPC sheets and action controls remain GM-only; resolved attack results are shared in the log. Death and destruction notices appear immediately after lethal damage.

The attack result, HP/condition changes and combat log commit in one SQLite transaction. A repeated request returns its saved roll without applying damage again, including after restart. Source refresh blocks combat mutations while preparation runs and preserves runtime state. Range, cover, resistance, opportunity attacks and special features remain GM-adjudicated; there is no damage-undo interface. On upgrade, any legacy unapproved attacks are marked cancelled without applying their proposed damage.

The current encounter uses local [Test Quest](http://127.0.0.1:18081/w/2/entities/3536), Lux, Black Bear and the explicitly selected Renovar world map. Fresh demo HP is a setup policy, not an assertion about ongoing campaign HP. The quest now also includes an Adult Gold Dragon and eight independent kobolds. It uses the world's overview image without a combat-distance grid. The earlier synthetic and Renovar demonstration maps remain in DR's library; PlanarAlly is unchanged.

## Prepare and refresh

Open <http://127.0.0.1:18083/ocf-api/ui> after signing in as GM. Paste the quest entity URL and provide map entity ID `3431` because this test quest has no map link. Click **Prepare / refresh from Kanka**, then **Open prepared encounter in Dungeon Revealer**.

The handler reads each selected entity's multiline **OCF Combat Sheet v1** property, lookup key **`ocf_combat_v1`**, through the Kanka API. Lux and Black Bear already have it. Update that JSON manually in Kanka and refresh to load new stats/attacks. Runtime source access is GET-only; refresh never writes to Kanka.

Preparation reuses the scene/token mappings and content-addressed image assets. Refresh preserves current HP, token placement, fog and roll history. This basic demo applies validated sheet changes directly; a staged field-level diff and maximum-HP reconciliation interface are not implemented. Additive roster changes are supported; removing existing combatants is refused rather than silently deleting them. The pilot accepts role-linked Quest Elements or, for the existing quest, direct typed character/creature mentions. It does not crawl other relationships.

Permanent sheets live in Kanka. Handler SQLite stores their compiled snapshots, encounter mapping and persistent rolls. OCF 0.4.0/SRD 5.1 computes the ability modifiers; AC, HP and attack totals are preserved from the approved sheet without class/feature recalculation. Lux's longbow is explicitly selected for this test despite its unchanged unequipped inventory flag.

## Extended statblocks and the expanded quest

Definition policy is based on encounter role:

- **PC:** imported JSON is authoritative when available. Keep **OCF Combat Sheet v1** on the PC as its baseline; it is used when no import exists and is never deleted or rewritten by the handler.
- **NPC/ally:** prefer **OCF Combat Sheet v1** from Kanka; otherwise compile other supported Kanka properties and basic entry attacks. Local JSON imports are blocked for NPCs and any old override is ignored. No SRD marker is required for this property-based fallback. The dragon and kobolds already use it.
- **Runtime status:** HP, temporary HP, death saves, inventory usage, initiative and feature use stay in handler SQLite, independent of either definition source.

The GM sees the active definition source on the sheet. JSON import is offered only on PCs. Updating Kanka's PC baseline does not replace an active imported JSON definition; reimport the desired file to update the PC.


The GM's sheet has **Import statblock JSON** for reviewed PC exports. Import validates source identity and current encounter revision, compiles the profile and saves a local override. It preserves current/temp HP, inventory, token identity, effects and initiative. Kanka is never written. Future source refresh uses that explicit override; importing a basic JSON replaces extension fields. Private campaign-specific extraction helpers and exports are not included in the public repository.

The extended schema retains `kanka-combat-sheet/1` for backward compatibility and adds optional `saving_throws` (all six recorded totals), `skills` (named IDs, ability and recorded bonus), `proficiencies`, `features` and `review_notes`. Unknown rule names, duplicate skills, incorrect ability mappings and invalid bonuses are rejected. The sheet provides ability checks, saves, skill checks and tool checks with a selectable governing ability. A normal/advantage/disadvantage selector applies to these rolls and targeted attacks. Advantage/disadvantage keeps both d20s, selects one and adds the modifier once.

Preserve printed skill/save totals and unresolved build choices rather than silently recomputing them. Colossus Slayer is an optional supported attack feature: its server checks require a wounded target, active initiative and an unused feature for that turn; a hit consumes the use and criticals double its extra dice. Other features can remain descriptive references. Importing a definition never rewrites Kanka equipment flags or refills runtime resources.

Quest text now accepts quantities such as `8x [creature:2096]` or `8× [creature:2096]`. Each instance gets a stable key, numbered name, unique token, independent HP and initiative. The current saved quest has **Lux, Black Bear, Adult Gold Dragon and eight kobolds** (11 total). NPCs without a dedicated combat property can compile basic AC, HP, abilities, saves and ordinary weapon attacks from their other Kanka properties and entries. Complex actions and situational rules remain manual, including dragon breath/legendary actions and kobold Pack Tactics/Sunlight Sensitivity. The handler does not fetch external rules.

Additive refresh preserves old token positions/HP and places new instances in free map space. Counts can grow to 40 participants, at most 20 in a quantity expression; removals still require a separate encounter. If combat is active, new participants queue for initiative and the existing round/current turn resumes after those rolls, using the old initiative totals. An ended combat remains ended; request initiative to enroll the new roster.

## Deployment and files

Start from the application directory, with Kanka already running:

```bash
python3 docker/dungeon-revealer/launch-integration.py
docker compose -p kenka-dungeon-revealer-demo -f compose.dungeon-revealer-demo.yaml ps
```

The launcher prepares credentials and the version-checked frontend overlay, installs runtime handler packages through Sail if missing, and starts two containers: the pinned upstream DR image with a small mounted server/client adapter, and the pinned Node 24 handler image. It connects Kanka's web app and MinIO to `kenka-ocf-sources` for source reads/artwork; databases and unrelated Kanka services are not connected to that network. Re-run the launcher if the Kanka app/MinIO containers were recreated.

| Path | Purpose |
| --- | --- |
| `tools/ocf-handler/` | Basic sheet normalization, pinned OCF packages, server dice, SQLite event log, launcher UI and popup |
| `docker/dungeon-revealer/ocf-server.cjs` | Same-origin proxy inserted ahead of DR's body parser/SPA routes |
| `docker/dungeon-revealer/prepare-overlay.py` | Connects native token selection to the sheet in the exact v1.17.1 shared bundle and injects the bridge; unknown bundle patterns fail |
| `storage/app/ocf-authoring/handler-config.json` | Private server-only Kanka API configuration, mode 0600 |
| `storage/app/dungeon-revealer-demo/overlay/` | Generated modified upstream frontend files, ignored by Git |
| Named volume `ocf-handler-data` in the dedicated Compose project | SQLite encounter/config/history state at `/data/encounters.sqlite` |

The prototype uses the existing local access token in private server configuration. The client only makes allowlisted campaign-2 GET requests, but that token itself has the existing local account's broader privileges. Use a dedicated view-only account/token before broader deployment. DR passwords remain its native shared-role credentials; there are no individual player identities in this initial demo.

The API normalizer rejects missing/duplicate sheet fields, mismatched source identities, unsupported editions, malformed stats/actions and unbounded dice formulas. Browser clients submit action/target IDs and a request UUID, not their own totals or damage. Reusing a request UUID returns the saved result; using it for another action fails. NPC attack/AoE results are projected into shared combat cards without exact NPC HP, AC, sheet data or private GM notes. Combat results are displayed in the shared log on the right, separately from native DR chat. They survive a handler restart; native DR chat still does not.

Spells, special features, automatic multiattack, unrecorded skill/proficiency derivation, action economy and individual character grants are outside this basic implementation. Authorized guided attacks apply damage immediately; there is no general HP editor or damage-undo workflow yet. Only one encounter can be the native DR live map at a time.

## Shared attack results and health colors

The player log includes resolved NPC attacks and area actions. Each combat card names the attacker, action and targets, shows attack/save dice and totals, shared damage dice, and each target's total applied damage (or a miss/manual-resolution notice). One card replaces the older separate attack/damage/application messages. Existing saved attacks are projected on read, so NPC results become visible without replaying attacks or changing HP.

Damage and card accents use the target's result health: green above 50%, yellow above 25% through 50%, red at 25% or less. Combat-log results retain **Health after action: Good / Not Good / Bad**, plus outcome/death notices. Current-health badges are omitted from the log. Older area actions without a saved result band do not invent historical health. NPC sheets, unrelated private checks/recharge rolls, AC, private GM notes and exact NPC HP are excluded from player responses. GM cards also show recorded HP before/after damage.

Dice results in the combat log use individual die badges and a total badge. Natural d20 results of 1 are red and 20 are green. Advantage/disadvantage discards are faded and struck through; the total badge follows the kept die. Damage dice/totals stay neutral, and this styling does not change hit/save rules.

## Map token labels

Token names use a smaller font with health-colored backgrounds: green above 50% HP, yellow above 25% through 50%, and red at 25% or less. Contrasting text keeps each name readable. Effects appear beneath the name as separate smaller labels with their own text/background colors: purple for Weakening Breath/custom or mental effects, olive for poison, red for disabling effects, amber for movement/exhaustion effects and teal for invisibility. Labels update through the existing policy poll; NPC HP numbers are never exposed. These are render-only changes, preserving native token names, art, coordinates and movement flags.

## Conditions and custom effects

A sheet's **Active effects** section lists condition names, notes, duration reminders and sources. Every effect with a stored saving throw has a **Roll ABILITY save (DC N)** button. The GM can **Add effect** using suggested 5e conditions or a custom name, and **Remove NAME** when it ends. Players see their effects but cannot add/remove them. Public effect names also appear on native token labels, in the turn tracker and in combat-log results.

For save-based actions, **Effect on failed save (optional)** sets the condition or custom effect to record on failed targets only. Blank means none. **Weakening Breath** defaults to its named effect, with the local SRD source's disadvantage reminder, one-minute duration and end-of-turn repeat-save reminder. Successful targets receive no effect. Other spells/effects can use the same field or the sheet's manual controls.

The save button uses the stored ability, DC and configured mode, logs dice and success/failure, and removes only that effect when **End effect on successful save** is enabled. Failure leaves it active. Weakening Breath defaults to an end-of-turn Strength save that ends the effect on success, including its disadvantage on Strength saves. Advantage cancels disadvantage. Legacy effects with a save also receive buttons; unknown success rules keep the effect for DM adjudication.

GM effect authoring includes save ability/DC, start/end/manual timing, mode and the end-on-success checkbox. Start/end-turn saves are limited to one attempt per effect per PC turn, with a GM override; manually triggered saves can repeat. Out-of-turn player saves use the existing DM approval queue before rolling. The GM still manages turn timing, immunity/concentration, duration and unrelated rule modifiers; these are not inferred from arbitrary condition text. Existing turn/roll permissions still apply. Effects survive handler restarts and source refresh; replaying the same action cannot add duplicates. No Kanka data is written.

## Out-of-turn roll approval and movement

During active combat, player character-sheet rolls and combat actions are immediate only on that PC's turn. An out-of-turn ability/save/skill/tool roll, attack, potion or death save opens **DM approval required**. No dice, HP or inventory changes occur while waiting. The GM receives **Roll requests** beside **OCF encounters**, with an automatic review dialog and **Approve roll** / **Reject roll** controls. Approval rolls/resolves the original player request; rejection or player cancellation leaves combat state unchanged. Normal initiative rolls remain available to queued participants, and GM rolls remain unrestricted. While initiative is rolling, other player rolls require approval.

Requests persist in handler SQLite. Retries reuse the original UUID, approval cannot execute a request twice, and ending/changing combat cancels pending requests. Existing target, equipment, death-state and inventory validation runs on approval. Native DR chat dice are separate from character-bound sheet actions; use the sheet for managed encounter rolls.

Player token dragging is limited to the active living PC during combat. Movement is blocked while initiative is rolling, and free movement resumes after combat subject to DR's existing visibility, movable and locked flags. The native drag control follows a polled movement policy; the REST token-update route checks the handler again for every player request. GM access bypasses the turn gate. Policy failures pause player movement rather than allowing it. No persistent native token flags are rewritten, and speed/distance budgets remain manual on the unscaled world map.

Run `docker compose -p kenka-dungeon-revealer-demo -f compose.dungeon-revealer-demo.yaml exec -T ocf-handler node movement-check.mjs` to verify native enforcement with a disposable off-map token. It verifies rejection without position changes, active-turn movement, GM override and free movement after combat, then removes its own token and handler record.

## Shared initiative and turn tracker

1. A GM or player clicks **Initiative** on a character sheet. This requests combat, without rolling before approval. The tracker appears at the bottom left and the GM chooses **Approve initiative** or rejects the request.
2. Approval queues each living PC and NPC in the prepared encounter. PC clients see **Roll initiative: NAME** buttons. The GM gets an **NPC initiative** dialog for individual rolls or **Roll all NPCs**; the GM can also roll queued PCs. Dead NPCs are excluded; unconscious PCs remain eligible for death-save turns. All initiative results are logged publicly.
3. Once all queued participants have rolled, combat starts in descending initiative order. Equal totals use initiative modifier, then name/token ID for a stable ordering. The current participant is first and highlighted; advancing rotates the list and increments the round when it wraps.
4. The GM uses **Advance NPC turn** for each NPC, with a PC advancement override. Whenever a turn passes to an NPC in the selected encounter, including after player **End turn**, the GM automatically selects its native token and opens its sheet. Manual sheet selection stays in place until the turn changes again. Player clients show **Your turn: NAME** and **End turn** only while a PC is current. Dead combatants are skipped on advancement; dying PCs still receive turns and a link to their death-save sheet.
5. **End combat** is available to the GM during approval, rolling or active combat. It clears the turn order and removes the tracker for everyone. Combat history remains in the log. Another sheet's **Initiative** button requests a new battle with GM approval and fresh initiative rolls; previous totals are not reused.

Each browser can minimize or expand the tracker with the small upper-right chevron whenever desired, independently of other users. Its choice persists across polling and reloads. The collapsed tracker contains only **Turn: NAME** and the chevron (or **Turn:** when there is no current combatant). Clicking a character name in the header or turn order opens its sheet, under existing role permissions. The panel is anchored 12px above the bottom-left edge, grows upward and scrolls internally on long rosters; it remains separate from the full-height combat log on the right.

Initiative, round and turn state are persisted in encounter SQLite and preserved by Kanka sheet refresh. Commands use request UUIDs, combat session IDs and turn revisions; retrying or clicking from a stale tab cannot roll twice or skip an extra turn. The handler remains read-only toward Kanka. Attacks are still available outside the active turn for demo flexibility; action economy is not enforced. DR's shared player password allows any player session to roll or end any PC's turn; individual character ownership awaits individual authentication.

## Health colors and field contrast

NPC attacks remain GM-controlled. Every hit applies damage immediately; retries return the same saved result. NPC attack dice, totals, targets and resulting health are visible in the shared combat log; NPC sheets and unrelated standalone rolls remain private.

The attack walkthrough displays current target HP (current/maximum) for the GM, and **Health: Good**, **Health: Not Good**, or **Health: Bad** for players in the same position. The text and border use matching green/yellow/red colors: green above 50%, yellow above 25% through 50%, red at 25% or below (including zero). Damage uses the same palette for the resulting HP band after application. The box follows current target health as the sheet polls, while a resolved damage roll preserves its outcome band. Player attack responses reveal qualitative health without target HP totals, including when the target is a PC. The damage outcome uses the same GM/player display policy; the threshold legend is not shown in the walkthrough. Item/object detail inputs use dark text on white backgrounds.

### NPC property fallback

Required scalar properties: **Armor class/AC**, **HP maximum/hp_max/hit_points**, **Speed/speed_ft**, and all six ability scores (**STR/Strength**, etc.). Names are case-insensitive and ignore spaces/underscores. Missing or ambiguous required fields fail preparation rather than inventing statistics. **Initiative** is optional and defaults to the Dexterity modifier; **Proficiency bonus** is optional.

Optional structured properties **Attacks**, **Saving throws**, **Skills**, **Proficiencies**, **Features** and **Advanced actions** accept the corresponding JSON arrays/objects from the combat-sheet schema. `ocf_attacks`, `ocf_saving_throws`, `ocf_skills`, `ocf_proficiencies` and `ocf_features` API keys are also accepted. These override parsed entry values. **Saving throws** and **Skills** also accept signed, comma-separated lists such as `Dex +8, Con +13` or `Perception +14, Stealth +8`, as used by the existing dragon. Individual **DEX save/Dexterity saving throw** and **Perception/Skill Perception** properties can supply recorded bonuses. Basic SRD-style weapon actions, saves and skills in the entry remain supported. An NPC with no supported attack data gets a sheet without attack buttons; its review note explains how to add an Attacks property. Full **OCF Combat Sheet v1**, when present, remains authoritative and must validate on its own.

## Advanced actions, targets and areas of effect

NPCs retain named traits/actions from Kanka entries, including multiattack, breath weapons, save-based effects, transformations, legendary actions and reactions. The Adult Gold Dragon has twelve advanced/trait entries alongside its ordinary Bite/Claw/Tail attacks. Full **OCF Combat Sheet v1** may provide `advanced_actions`; otherwise NPC entry text supplies it. **Advanced actions** / `ocf_advanced_actions` JSON can override parsing in the property fallback.

The GM selects **Choose targets: Fire Breath** (or another save/damage action), checks the affected creatures and chooses a save mode for each. Friendly NPCs/PCs remain selectable; selecting a caster or a creature outside the encounter is rejected. No target is selected by default. **Roll saves & apply selected damage** rolls each damage component once for the whole area, resolves separate recorded saving throws, and applies full/half/zero damage according to the source rule. All target HP changes, dice, results and history commit atomically. Request replay returns the saved result without repeating saves or damage. Only the GM executes targeted advanced actions. Their damage dice, target saves and applied damage are shared; exact HP and private rule notes remain GM-only.

The dragon's Fire Breath shows a **60 ft cone**, DC 21 DEX and half damage on success; Weakening Breath shows a **60 ft cone**, DC 21 STR; Wing Attack shows a **10 ft radius**, DC 22 DEX and no damage on success. The Renovar overview has no feet-to-pixels scale: the GM determines membership, facing, distance, cover and eligibility manually. There is no automatic geometric hit test or drawn scaled template yet. Multiattack and Tail Attack link to the existing single-target weapon attack controls; Detect links to Perception +14.

Known unconditional `damage_traits` immunities/resistances/vulnerabilities adjust advanced damage after save reductions. NPC traits can come from explicit JSON or existing Damage immunities/resistances/vulnerabilities properties. Qualified/unrecognized defenses keep that target's HP manual, with an explanation. The GM can also check **Resolve HP manually (rule exception)** for legendary resistance or other adjudication. Unconscious zero-HP PCs automatically fail STR/DEX saves. Other saves use recorded modifiers and per-target normal/advantage/disadvantage; saving throw natural 1/20 has no automatic success/failure rule here.

Conditions, repeated saves, durations, immunity windows, legendary action budgets, legendary resistance choices/uses, transformation, breath availability and recharge timing remain GM-managed. A save-only action records target outcomes without applying conditions. Recharge buttons roll **1d6** and report ready/not recharged; they do not spend or replenish a tracked breath resource. Fire Breath rolls **12d10**, Wing Attack **2d6+8**. Attack panel titles use **[name] Attack**.

`advanced_actions` is an optional array of `{id, name, category, description, rolls, save?, cost?, area?}`. Area metadata is `{shape: cone|radius|line, size_ft}` and save metadata includes `half_on_success`. `advanced-effects.mjs` handles targeted interactions; `advanced-actions.mjs` handles source parsing/validation. Clients submit selected IDs and save modes, never dice totals, DCs or HP amounts. Advanced damage supports known defenses; conditional rules and ordinary attack resistance adjudication remain manual.

## Zero HP, death saves, objects and healing

Applied damage that reduces an NPC to 0 HP kills it. The death notice appears immediately in the attack walkthrough and the target sheet. Object targets use the same workflow and become destroyed. HP is clamped to zero.

All PC/NPC tokens at **0 HP or below** rotate to **90°** in native DR, including on lethal area damage. `token-status.mjs` reconciles the handler's persistent HP into DR's persistent rotation field, retries failures and never repeatedly adds rotation. It preserves position, artwork and labels. The prior orientation is stored in `token_death_rotation`; healing above zero (including a natural-20 death save) restores it. Persistent recovery requests also repair legacy near-90° rotations without a saved marker when a potion is administered. A rotated PC still uses normal dying/stable/dead logic rather than being declared dead. Objects are excluded.

PCs at zero become unconscious and dying unless excess damage meets their maximum HP, causing instant death. The sheet exposes a manual **Death save (d20)** button while dying; it does not advance turns automatically. Under the [2014 rules](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/combat), 10+ is a success, natural 1 adds two failures and natural 20 restores 1 HP. Three successes stabilize and reset the counters; three failures mean death. Damage at zero adds one failure (two on a critical) and ends stability. Healing restores consciousness and resets counters. Demo potions explicitly override normal revival restrictions: zero-HP PCs/NPCs can be restored, including those marked dead. Stabilization checks, recovery after 1d4 hours, unconscious-target advantage/proximity criticals remain manual. The initiative tracker provides manual turn advancement; death saves are still explicitly rolled.

Lux receives an **unlimited demo supply of healing potions**, rolling 2d4+2 per use. **Use potion of healing** opens the creature target chooser, including Lux himself. It applies immediately without GM approval, caps HP at maximum, and logs the result. Lux's control shows **∞** and does not decrement; other characters' finite potion supplies still decrement. Player self-use requires consciousness; the GM may administer demo potions to an unconscious owner. All encounter PCs/NPCs, including zero-HP/dead creatures, appear in the healing target list; objects do not. Revival clears the death state and death-save counters. NPC HP remains private in public healing results. This demo override is stored only in the handler and survives source refresh and service restart. Permanent Kanka inventory is unchanged.

Select an attack, then **Attack object**. The GM can define the object's name, AC and HP; players can attack existing objects. Objects are persistent encounter targets, without additional DR map tokens. Material immunities, damage thresholds, range and cover require GM adjudication. Object damage also applies immediately. Death saves and potion uses use transactional request IDs so retries cannot repeat a roll or consume another potion. Refresh preserves conditions, death-save counts, inventory and objects alongside HP.

## Verification

Run focused engine/security tests through Sail and live API checks against this workstation:

```bash
vendor/bin/sail npm --prefix tools/ocf-handler test
python3 docker/dungeon-revealer/check-integration.py
```

The live checks cover duplicate-safe preparation, selected source-property hashes before/after, role filtering, forbidden source origins, server roll ranges, replay deduplication, forged result rejection, private history and the live map. Private verification output is under `storage/app/ocf-authoring/`.

Run `python3 docker/dungeon-revealer/check-browser.py` for Chromium UI verification. It creates temporary synthetic combatants in the handler, tests the full-height right log, single default docked sheet, automatic token selection, independent sheet/log popout and reunion, dragging, minimization, retained form state and control placement, target selection, immediate PC/NPC attacks and exactly-once HP deduction, plus manual death saves, immediate potion healing, NPC death confirmation and object destruction, plus shared initiative approval/queues, individual and batch NPC rolls, turn advancement, round wrapping, independent minimize/expand, sheet End turn controls, clearing ended trackers and fresh-battle initiative queues, tracker sheet links, compact chevrons and advanced multi-target save/damage resolution, then removes its test records. It never attacks Lux or Black Bear or changes their live HP for testing. Native token selection, player redaction, quest refresh and map launch are also exercised. Playwright v1.65.0 is a development dependency; its browser container is temporary. Screenshots/reports stay under ignored `storage/app/ocf-authoring/browser/`.

Back up both DR's data volume and the handler's SQLite volume, plus private configuration. Stop these two services for a consistent complete snapshot; do not remove volumes during normal shutdown. Restart preserves mappings and event history. To remove the dedicated stack entirely, first detach Kanka app/MinIO from its source network, then remove only this Compose project; do not prune shared Kanka volumes or networks.

See [source field format](kanka-encounter-input-format.md) and the [broader deployment plan](kanka-ocf-dungeon-revealer-plan.md) for deferred features. Preserve the engine's Apache-2.0 notices, SRD CC-BY attribution, upstream DR ISC license and private artwork provenance.

For native zero-HP rotation/recovery verification, run `docker compose -p kenka-dungeon-revealer-demo -f compose.dungeon-revealer-demo.yaml exec -T ocf-handler node death-rotation-check.mjs`. It uses hidden disposable native tokens and temporary handler records, verifies ordinary/area damage and healing orientation, and removes only its own tokens/records. Campaign HP and token positions are not changed by the test.
