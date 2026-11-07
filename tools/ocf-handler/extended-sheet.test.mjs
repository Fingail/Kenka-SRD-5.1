import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { normalizeSheet, resolveRoll } from './core.mjs';
import { normalizeExtended, rollD20 } from './extended-sheet.mjs';
import { parseMentions, expandParticipants, creatureSheet, npcPropertySheet, selectCombatDefinition } from './encounter-source.mjs';
import { SheetImports } from './sheet-import.mjs';
const sheet = () => ({ schema: 'kanka-combat-sheet/1', edition: '5e-2014', source: { campaign_id: 2, entity_id: 7 }, stats: { ac: 17, hp_max: 36, initiative: 4, speed_ft: 35, proficiency_bonus: 2, abilities: { str: 14, dex: 18, con: 14, int: 10, wis: 12, cha: 12 } }, attacks: [{ id: 'bow', name: 'Bow', attack_bonus: 8, damage: '1d8+4', damage_type: 'piercing' }], saving_throws: { str: 4, dex: 6, con: 2, int: 0, wis: 1, cha: 1 }, skills: [{ id: 'perception', name: 'Perception', ability: 'wis', bonus: 5 }, { id: 'performance', name: 'Performance', ability: 'cha', bonus: 1, note: 'Printed total retained; proficiency unresolved.' }], proficiencies: { tools: ['Thieves’ tools'] } });
test('recorded saves and skill totals survive normalization without inferring expertise or changing disputed values', () => {
  const token = normalizeSheet(sheet(), { campaign_id: 2, id: 7, name: 'Ranger' });
  assert.equal(resolveRoll(token, { kind: 'save', ability: 'dex' }).modifier, 6);
  assert.equal(resolveRoll(token, { kind: 'skill', skill_id: 'perception' }).modifier, 5);
  assert.equal(resolveRoll(token, { kind: 'skill', skill_id: 'performance' }).modifier, 1);
  assert.equal(resolveRoll(token, { kind: 'tool', tool: 'Thieves’ tools', ability: 'dex' }).modifier, 6);
  assert.equal(resolveRoll(token, { kind: 'tool', tool: 'Thieves’ tools', ability: 'int' }).modifier, 2);
  assert.throws(() => resolveRoll(token, { kind: 'skill', skill_id: 'forged' }));
  const bad = sheet(); bad.skills[0].ability = 'str'; assert.throws(() => normalizeExtended(bad));
  bad.skills = [sheet().skills[0], sheet().skills[0]]; assert.throws(() => normalizeExtended(bad));
});
test('advantage and disadvantage choose one d20, retaining all dice and a single modifier', () => {
  let dice = [2, 19]; const r = () => dice.shift();
  assert.deepEqual(rollD20(5, 'advantage', r), { formula: '1d20+5', dice: [2, 19], modifier: 5, total: 24, natural: 19, mode: 'advantage' });
  dice = [2, 19]; assert.equal(rollD20(-1, 'disadvantage', r).total, 1);
  assert.throws(() => rollD20(1, 'forged', r));
});
test('quest quantity notation creates stable independent kobold instances and enforces caps', () => {
  const rows = parseMentions('<p>[character:7] [creature:8] 8x [creature:9]</p>');
  const expanded = expandParticipants(rows); assert.equal(expanded.length, 10);
  assert.deepEqual(expanded.filter(x => x.entity_id === 9).map(x => x.instance_key), Array.from({ length: 8 }, (_, i) => `9#${i + 1}`));
  assert.throws(() => expandParticipants(parseMentions('99x [creature:9]')));
  assert.throws(() => expandParticipants(parseMentions('2x [character:7]')));
  assert.equal(parseMentions('8× [creature:9]')[0].count, 8);
});
test('basic SRD creature attacks come from Kanka fields and actions; no synthetic class stats are inferred', () => {
  const entity = { id: 9, campaign_id: 2, type: 'creature', child: { entry: '<h3>Actions</h3>Dagger. Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 4 (1d4 + 2) piercing damage.' } };
  const fields = { _srd_key: 'srd5.1:creature:Kobold', armor_class: '12', hit_points: '5 (2d6 - 2)', speed: '30 ft.', STR: '7', DEX: '15', CON: '9', INT: '8', WIS: '7', CHA: '8' };
  const result = creatureSheet(entity, Object.entries(fields).map(([name, value]) => ({ name, value })));
  assert.equal(result.attacks[0].name, 'Dagger'); assert.equal(result.attacks[0].attack_bonus, 4); assert.equal(result.attacks[0].damage, '1d4+2'); assert.equal(result.stats.hp_max, 5); assert.equal(result.stats.initiative, 2);
});
test('local sheet import validates identity/role/revision and preserves runtime HP, inventory and initiative', () => {
  const db = new DatabaseSync(':memory:'); db.exec('CREATE TABLE encounters(id TEXT PRIMARY KEY,config TEXT)');
  const e = { id: 'test', status: 'ready', revision: 1, initiative: { current_token_id: 'token', round: 2 }, tokens: [{ entity_id: 7, token_id: 'token', role: 'pc', name: 'Ranger', hp_current: 15, inventory: [{ id: 'potion-healing', unlimited: true }] }] };
  const get = () => JSON.parse(db.prepare('SELECT config FROM encounters').get().config);
  const saveEncounter = e => db.prepare('INSERT OR REPLACE INTO encounters VALUES(?,?)').run(e.id, JSON.stringify(e)); saveEncounter(e);
  const imports = new SheetImports({ db, saveEncounter, tokenFor: () => { const encounter = get(); return { encounter, token: encounter.tokens[0] }; } });
  const input = { request_id: randomUUID(), expected_revision: 1, sheet: sheet() };
  assert.throws(() => imports.import('token', input, 'player'), e => e.status === 403);
  const result = imports.import('token', input, 'gm'); assert.deepEqual(imports.import('token', input, 'gm'), result);
  assert.equal(get().tokens[0].hp_current, 15); assert.equal(get().tokens[0].inventory[0].unlimited, true); assert.equal(get().initiative.round, 2); assert.equal(get().tokens[0].skills.length, 2);
  assert.throws(() => imports.import('token', { ...input, request_id: randomUUID() }, 'gm'), e => e.status === 409);
  const npc = get(); npc.tokens[0].role = 'enemy'; saveEncounter(npc);
  assert.throws(() => imports.import('token', { ...input, request_id: randomUUID(), expected_revision: 2 }, 'gm'), e => e.status === 409); db.close();
});

test('PC JSON overrides a preserved Kanka baseline; NPCs use the baseline and ignore PC imports', () => {
  const entity = { id: 7, campaign_id: 2, name: 'Ranger', type: 'character' };
  const baseline = sheet(), imported = sheet(); imported.stats.ac = 18;
  const attributes = [{ name: 'OCF Combat Sheet v1', api_key: 'ocf_combat_v1', value: JSON.stringify(baseline) }];
  const before = JSON.stringify(attributes);
  assert.equal(selectCombatDefinition(entity, attributes, 'pc', imported).sheet.stats.ac, 18);
  assert.equal(selectCombatDefinition(entity, attributes, 'pc').origin, 'Kanka PC baseline');
  assert.equal(selectCombatDefinition(entity, attributes, 'enemy', imported).sheet.stats.ac, 17);
  assert.equal(selectCombatDefinition(entity, attributes, 'ally', imported).origin, 'Kanka OCF Combat Sheet v1');
  assert.equal(JSON.stringify(attributes), before);
  assert.throws(() => selectCombatDefinition(entity, [], 'pc'), /baseline/);
});

test('custom NPCs can compile ordinary Kanka properties without an SRD marker or OCF sheet', () => {
  const entity = { id: 9, campaign_id: 2, type: 'character', name: 'Guard', child: { entry: '' } };
  const fields = { AC: '14', 'HP maximum': '20', Speed: '30 ft.', Strength: '14', Dexterity: '12', Constitution: '12', Intelligence: '10', Wisdom: '10', Charisma: '10', 'Proficiency bonus': '+2', 'DEX save': '+3', 'Skill Perception': '+2', Attacks: JSON.stringify([{ id: 'spear', name: 'Spear', attack_bonus: 4, damage: '1d6+2', damage_type: 'piercing' }]) };
  const attributes = Object.entries(fields).map(([name, value]) => ({ name, value }));
  const result = selectCombatDefinition(entity, attributes, 'enemy'); const profile = normalizeSheet(result.sheet, entity);
  assert.equal(result.origin, 'Kanka properties and entry'); assert.equal(profile.stats.ac, 14); assert.equal(profile.saving_throws.dex, 3); assert.equal(profile.skills[0].bonus, 2); assert.equal(profile.attacks[0].name, 'Spear');
  assert.throws(() => npcPropertySheet(entity, [...attributes, { name: 'Armor class', value: '15' }]), /Ambiguous/);
  assert.throws(() => npcPropertySheet(entity, attributes.filter(a => a.name !== 'HP maximum')), /Missing/);
  assert.throws(() => npcPropertySheet(entity, attributes.map(a => a.name === 'Attacks' ? { ...a, value: 'not JSON' } : a)), /Invalid JSON/);
});

test('plain Kanka saving throw and skill properties preserve SRD-style recorded bonuses', () => {
  const entity = { id: 9, campaign_id: 2, type: 'creature', name: 'Dragon', child: { entry: '' } };
  const fields = { AC: '19', hp_max: '256', speed_ft: '40', STR: '27', DEX: '14', CON: '25', INT: '16', WIS: '15', CHA: '24', saving_throws: 'Dex +8, Con +13, Wis +8, Cha +13', skills: 'Insight +8, Perception +14, Persuasion +13, Stealth +8' };
  const attributes = Object.entries(fields).map(([name, value]) => ({ name, value }));
  const p = normalizeSheet(npcPropertySheet(entity, attributes), entity);
  assert.equal(p.saving_throws.dex, 8); assert.equal(p.saving_throws.con, 13); assert.equal(p.skills.find(s => s.id === 'perception').bonus, 14); assert.equal(p.stats.initiative, 2);
});
