import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAdvancedActions, normalizeAdvancedActions } from './advanced-actions.mjs';
import { normalizeSheet, resolveRoll, projectToken } from './core.mjs';

const entry = `<div>Test Dragon<br>Challenge 17 (18,000 XP)<br>Amphibious. The dragon can breathe air and water.<br>Legendary Resistance (3/Day). If the dragon fails a saving throw, it can choose to succeed instead.<h3>Actions</h3>Multiattack. The dragon makes one bite and two claw attacks.<br>Bite. Melee Weapon Attack: +14 to hit, reach 10 ft., one target. Hit: 19 (2d10 + 8) piercing damage.<br>Frightful Presence. Each creature must succeed on a DC 21 Wisdom saving throw or become frightened.<br>Breath Weapons (Recharge 5–6). The dragon uses one of the following breath weapons.<br>Fire Breath. Each creature must make a DC 21 Dexterity saving throw, taking 66 (12d10) fire damage on a failed save, or half as much on success.<br>Weakening Breath. Each creature must succeed on a DC 21 Strength saving throw or have disadvantage for 1 minute.<br>Change Shape. The dragon magically polymorphs into another form.<h3>Legendary Actions</h3>The dragon can take 3 legendary actions at the end of another creature’s turn.<br>Detect. The dragon makes a Wisdom (Perception) check.<br>Tail Attack. The dragon makes a tail attack.<br>Wing Attack (Costs 2 Actions). Each creature must succeed on a DC 22 Dexterity saving throw or take 15 (2d6 + 8) bludgeoning damage and be knocked prone.</div><p><small>Source text omitted from action descriptions.</small></p>`;
const parsed = () => normalizeAdvancedActions(parseAdvancedActions(entry, [{ name: 'Bite' }]));
test('advanced action parser preserves traits, multiattack, breath weapons, transformation and legendary actions', () => {
  const actions = parsed();
  for (const id of ['trait-amphibious', 'trait-legendary-resistance', 'action-multiattack', 'action-frightful-presence', 'action-breath-weapons', 'action-fire-breath', 'action-weakening-breath', 'action-change-shape', 'legendary-overview', 'legendary-detect', 'legendary-tail-attack', 'legendary-wing-attack']) assert.ok(actions.some(a => a.id === id), id);
  assert.ok(!actions.some(a => a.name === 'Bite'));
  const fire = actions.find(a => a.id === 'action-fire-breath'); assert.equal(fire.rolls[0].formula, '12d10'); assert.deepEqual(fire.save, { dc: 21, ability: 'dex', half_on_success: true });
  const wing = actions.find(a => a.id === 'legendary-wing-attack'); assert.equal(wing.rolls[0].formula, '2d6+8'); assert.equal(wing.cost, 2);
  const recharge = actions.find(a => a.id === 'action-breath-weapons').rolls[0]; assert.equal(recharge.threshold, 5); assert.equal(recharge.formula, '1d6');
  assert.ok(actions.every(a => !a.description.includes('Source text')));
});
test('manual advanced rolls use server-defined dice and cannot change HP or expose an NPC sheet', () => {
  const token = { name: 'Dragon', token_id: 'npc', role: 'enemy', hp_current: 99, advanced_actions: parsed() };
  const fire = resolveRoll(token, { kind: 'advanced', action_id: 'action-fire-breath', roll_id: 'damage-1' }); assert.ok(fire.total >= 12 && fire.total <= 120); assert.equal(fire.dice.length, 12); assert.equal(fire.manual_resolution, true); assert.equal(token.hp_current, 99);
  const recharge = resolveRoll(token, { kind: 'advanced', action_id: 'action-breath-weapons', roll_id: 'recharge' }); assert.equal(recharge.recharge_ready, recharge.total >= 5);
  assert.equal(projectToken(token, 'player').advanced_actions, undefined);
  assert.throws(() => resolveRoll(token, { kind: 'advanced', action_id: 'forged', roll_id: 'damage-1' }));
  assert.throws(() => normalizeAdvancedActions([{ ...parsed()[0], rolls: [{ id: 'bad', label: 'Bad', formula: '1d20;evil()', kind: 'damage' }] }]));
});
