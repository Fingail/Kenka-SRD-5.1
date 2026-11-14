import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSheet, parseDice, rollDice, resolveRoll, projectToken, sameSecret } from './core.mjs';

const entity = { id: 7, campaign_id: 2, name: 'Synthetic ranger' };
const basic = () => ({ schema: 'kanka-combat-sheet/1', edition: '5e-2014', source: { campaign_id: 2, entity_id: 7 }, stats: {
  ac: 17, hp_max: 36, initiative: 4, speed_ft: 35, abilities: { str: 14, dex: 18, con: 14, int: 10, wis: 12, cha: 7 },
}, attacks: [{ id: 'bow', name: 'Bow', attack_bonus: 8, damage: '1d8+4', damage_type: 'piercing' }] });

test('OCF computes ability modifiers while reviewed AC and attack totals survive unchanged', () => {
  const sheet = normalizeSheet(basic(), entity);
  assert.deepEqual(sheet.modifiers, { str: 2, dex: 4, con: 2, int: 0, wis: 1, cha: -2 });
  assert.equal(sheet.stats.ac, 17); assert.equal(sheet.attacks[0].attack_bonus, 8);
});
test('wrong identities, editions, malformed scores and duplicate actions are rejected', () => {
  const wrong = basic(); wrong.source.entity_id = 8; assert.throws(() => normalizeSheet(wrong, entity));
  const newer = basic(); newer.edition = '5e-2024'; assert.throws(() => normalizeSheet(newer, entity));
  const missing = basic(); delete missing.stats.abilities.dex; assert.throws(() => normalizeSheet(missing, entity));
  const duplicate = basic(); duplicate.attacks.push(duplicate.attacks[0]); assert.throws(() => normalizeSheet(duplicate, entity));
  const extra = basic(); extra.stats.private_note = 'GM-only'; assert.throws(() => normalizeSheet(extra, entity));
  const flag = basic(); flag.attacks[0].is_equipped = 'false'; assert.throws(() => normalizeSheet(flag, entity));
  const notes = basic(); notes.attacks[0].private_note = 'GM-only'; assert.equal(normalizeSheet(notes, entity).attacks[0].private_note, undefined);
});
test('dice evaluation is bounded, never executable and preserves individual dice', () => {
  for (const bad of ['0d6', '99d100', '1d999', '1d20;process.exit()', '1d20+1d6', 'NaN']) assert.throws(() => parseDice(bad));
  assert.deepEqual(rollDice('2d4+2', (min, max) => max - 1), { formula: '2d4+2', dice: [4, 4], modifier: 2, total: 10 });
});
test('NPC projection contains no private sheet and shared players cannot roll disabled equipment', () => {
  const sheet = { ...normalizeSheet(basic(), entity), role: 'enemy', token_id: 'abc', hp_current: 36 };
  assert.deepEqual(projectToken(sheet, 'player'), { token_id: 'abc', name: 'Synthetic ranger', role: 'enemy', restricted: true });
  assert.equal(projectToken(sheet, 'gm').stats.ac, 17);
  sheet.attacks[0].is_equipped = false;
  assert.throws(() => resolveRoll(sheet, { kind: 'attack', action_id: 'bow' }));
  sheet.attacks[0].selected_for_basic_test = true;
  assert.equal(resolveRoll(sheet, { kind: 'attack', action_id: 'bow' }).modifier, 8);
  assert.throws(() => resolveRoll(sheet, { kind: 'spell' }));
});
test('secrets reject missing, unequal and wrong-length values', () => {
  assert.equal(sameSecret('', ''), false); assert.equal(sameSecret('one', 'two'), false);
  assert.equal(sameSecret('correct', 'correct'), true); assert.equal(sameSecret('short', 'longer'), false);
});
