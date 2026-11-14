import { check, rollDice } from './core.mjs';
import { normalizeAdvancedActions } from './advanced-actions.mjs';
export const abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
export const skillAbilities = { acrobatics: 'dex', animal_handling: 'wis', arcana: 'int', athletics: 'str', deception: 'cha', history: 'int', insight: 'wis', intimidation: 'cha', investigation: 'int', medicine: 'wis', nature: 'int', perception: 'wis', performance: 'cha', persuasion: 'cha', religion: 'int', sleight_of_hand: 'dex', stealth: 'dex', survival: 'wis' };
const strings = (value, label, max = 50) => { check(Array.isArray(value) && value.length <= max && value.every(x => typeof x === 'string' && x.length <= 200), 'Invalid ' + label); return value; };
export function normalizeExtended(input) {
  const output = {};
  if (input.saving_throws !== undefined) {
    check(input.saving_throws && Object.keys(input.saving_throws).every(k => abilities.includes(k)), 'Invalid saving throws.');
    check(abilities.every(k => Number.isInteger(input.saving_throws[k]) && Math.abs(input.saving_throws[k]) <= 100), 'All six saving throw bonuses are required.');
    output.saving_throws = { ...input.saving_throws };
  }
  if (input.skills !== undefined) {
    check(Array.isArray(input.skills) && input.skills.length <= 18, 'Invalid skills.'); const ids = new Set();
    output.skills = input.skills.map(item => {
      check(skillAbilities[item.id] && !ids.has(item.id) && item.ability === skillAbilities[item.id], 'Invalid or duplicate skill.'); ids.add(item.id);
      check(Number.isInteger(item.bonus) && Math.abs(item.bonus) <= 100 && typeof item.name === 'string' && item.name.length <= 100, 'Invalid skill bonus/name.');
      check(item.proficient === undefined || typeof item.proficient === 'boolean', 'Invalid skill proficiency.');
      check(item.note === undefined || typeof item.note === 'string' && item.note.length <= 1000, 'Invalid skill note.');
      return { id: item.id, name: item.name, ability: item.ability, bonus: item.bonus, proficient: item.proficient === true, ...(item.note ? { note: item.note } : {}) };
    });
  }
  if (input.proficiencies !== undefined) {
    check(input.proficiencies && Object.keys(input.proficiencies).every(k => ['armor', 'weapons', 'tools', 'languages', 'saving_throws'].includes(k)), 'Invalid proficiencies.');
    output.proficiencies = Object.fromEntries(Object.entries(input.proficiencies).map(([key, value]) => [key, strings(value, key)]));
  }
  if (input.features !== undefined) {
    check(Array.isArray(input.features) && input.features.length <= 30, 'Invalid features.'); const ids = new Set();
    output.features = input.features.map(item => {
      check(typeof item.id === 'string' && /^[a-z0-9_-]{1,64}$/.test(item.id) && !ids.has(item.id), 'Invalid feature ID.'); ids.add(item.id);
      check(typeof item.name === 'string' && item.name.length <= 100 && typeof item.description === 'string' && item.description.length <= 2000, 'Invalid feature description.');
      check(['reference', 'colossus_slayer'].includes(item.rule), 'Unsupported special attack rule.');
      check(item.source_entity_id === undefined || Number.isSafeInteger(item.source_entity_id) && item.source_entity_id > 0, 'Invalid feature source.');
      return { id: item.id, name: item.name, description: item.description, rule: item.rule, ...(item.source_entity_id ? { source_entity_id: item.source_entity_id } : {}) };
    });
  }
  if (input.damage_traits !== undefined) {
    check(input.damage_traits && Object.keys(input.damage_traits).every(k => ['immunities', 'resistances', 'vulnerabilities', 'manual'].includes(k)), 'Invalid damage traits.');
    const types = ['acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder'];
    output.damage_traits = Object.fromEntries(Object.entries(input.damage_traits).map(([k,v]) => { strings(v, k, 20); check(k === 'manual' || v.every(t => types.includes(t)), 'Unsupported damage type.'); return [k,v]; }));
  }
  if (input.review_notes !== undefined) output.review_notes = strings(input.review_notes, 'review notes', 20);
  if (input.advanced_actions !== undefined) output.advanced_actions = normalizeAdvancedActions(input.advanced_actions);
  return output;
}
export function rollD20(modifier, mode = 'normal', random) {
  check(['normal', 'advantage', 'disadvantage'].includes(mode), 'Unsupported roll mode.');
  const rolled = rollDice(`${mode === 'normal' ? 1 : 2}d20`, random);
  const natural = mode === 'advantage' ? Math.max(...rolled.dice) : mode === 'disadvantage' ? Math.min(...rolled.dice) : rolled.dice[0];
  return { formula: `1d20${modifier < 0 ? '' : '+'}${modifier}`, dice: rolled.dice, modifier, total: natural + modifier, natural, mode };
}
