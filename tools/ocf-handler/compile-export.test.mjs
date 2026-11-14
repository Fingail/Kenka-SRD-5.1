import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileExport } from './compile-export.mjs';
const input = () => {
  const sheet = { schema: 'kanka-combat-sheet/1', edition: '5e-2014', source: { campaign_id: 2, entity_id: 7 }, stats: { ac: 12, hp_max: 20, initiative: 2, speed_ft: 30, abilities: { str: 10, dex: 14, con: 12, int: 10, wis: 12, cha: 10 } }, attacks: [{ id: 'bow', name: 'Bow', attack_bonus: 4, damage: '1d8+2', damage_type: 'piercing' }] };
  return { entity: { id: 7, campaign_id: 2, type: 'character', name: 'Test ranger' }, attributes: [{ name: 'OCF Combat Sheet v1', value: JSON.stringify(sheet) }, { name: 'Armor class', value: '15' }, { name: 'Speed', value: '35 ft' }], posts: [] };
};
test('fresh scalar properties override baseline totals without encounter state or source mutation', () => {
  const data = input(), before = structuredClone(data);
  data.hp_current = 1; data.active_effects = ['poisoned'];
  const sheet = compileExport(data);
  assert.equal(sheet.stats.ac, 15); assert.equal(sheet.stats.speed_ft, 35);
  assert.equal(sheet.hp_current, undefined); assert.equal(sheet.active_effects, undefined);
  assert.deepEqual(data.attributes, before.attributes);
});
test('recorded combat article preserves saves, disputed skills, attacks and baseline equipment flags', () => {
  const data = input();
  data.posts.push({ name: 'Combat, skills, and proficiencies', entry: '<p>Saving throws: STR +0; DEX +4; CON +1; INT +0; WIS +1; CHA +0.</p><p>Sheet skills: Perception +5; Performance +0. Marked proficiencies: Perception.</p><p>Attacks: Bow +6, 1d8 + 2 piercing; Ram +2, 1d4 + 0 bludgeoning.</p>' });
  data.posts.push({ name: 'Source review and unresolved selections', entry: 'Unresolved '.repeat(200) });
  const sheet = compileExport(data);
  assert.equal(sheet.saving_throws.dex, 4); assert.equal(sheet.skills[0].bonus, 5);
  assert.equal(sheet.skills[1].bonus, 0); assert.equal(sheet.skills[1].proficient, false);
  assert.equal(sheet.attacks.length, 2); assert.equal(sheet.attacks[0].attack_bonus, 6);
  assert.ok(sheet.review_notes.every(note => note.length <= 200));
});
test('export rejects stale source identity and ambiguous combat articles', () => {
  const data = input(); data.entity.id = 8;
  assert.throws(() => compileExport(data), /identity mismatch/);
  const other = input(); other.posts = [1, 2].map(id => ({ id, name: 'Combat, skills, and proficiencies' }));
  assert.throws(() => compileExport(other), /Ambiguous combat article/);
});
