import { randomInt, timingSafeEqual } from 'node:crypto';
import { loadRuleset, computeSheet } from '@opencharacter/engine';
import srd from '@opencharacter/5e-srd-5.1';
import { normalizeExtended, rollD20 } from './extended-sheet.mjs';

export function check(condition, message, status = 400) {
  if (!condition) throw Object.assign(new Error(message), { status });
}
export function sameSecret(a, b) {
  const x = Buffer.from(a || ''), y = Buffer.from(b || '');
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y);
}
const loaded = loadRuleset([srd]);
check(loaded.ok, 'Unable to load the pinned SRD 5.1 pack.', 500);
const abilityKeys = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
export function normalizeSheet(input, entity) {
  check(input.schema === 'kanka-combat-sheet/1' && input.edition === '5e-2014', 'Unsupported sheet format/edition.');
  check(input.source?.entity_id === entity.id && input.source?.campaign_id === entity.campaign_id, 'Sheet source identity mismatch.');
  const stats = input.stats;
  check(stats && Object.keys(stats).every(key => ['ac', 'hp_max', 'initiative', 'speed_ft', 'proficiency_bonus', 'abilities', 'climb_speed_ft'].includes(key)), 'Unsupported fields in basic stats.');
  check(stats && Number.isInteger(stats.ac) && stats.ac >= 0 && stats.ac <= 100, 'Invalid armor class.');
  check(Number.isInteger(stats.hp_max) && stats.hp_max > 0 && stats.hp_max <= 100000, 'Invalid maximum HP.');
  check(Number.isInteger(stats.initiative) && Math.abs(stats.initiative) <= 100, 'Invalid initiative.');
  check(Number.isInteger(stats.speed_ft) && stats.speed_ft >= 0 && stats.speed_ft <= 10000, 'Invalid movement.');
  check(stats.climb_speed_ft === undefined || (Number.isInteger(stats.climb_speed_ft) && stats.climb_speed_ft >= 0 && stats.climb_speed_ft <= 10000), 'Invalid climb speed.');
  check(stats.proficiency_bonus == null || (Number.isInteger(stats.proficiency_bonus) && stats.proficiency_bonus >= 0 && stats.proficiency_bonus <= 20), 'Invalid proficiency bonus.');
  check(stats.abilities && Object.keys(stats.abilities).every(key => abilityKeys.includes(key)), 'Unsupported ability fields.');
  const values = {};
  for (const key of abilityKeys) {
    const score = stats.abilities?.[key];
    check(Number.isInteger(score) && score >= 1 && score <= 40, `Invalid ${key} score.`);
    values[`5e-srd-5.1:abilities.${key}.base`] = score;
  }
  // Only use OCF for the basic ability modifiers here. Recorded AC/attack totals
  // deliberately bypass build/feature recalculation for this first-round scope.
  const sheet = computeSheet(loaded.ruleset, {
    specVersion: '0.4.0', id: `kanka-${entity.campaign_id}-${entity.id}`,
    packs: [{ id: '5e-srd-5.1', version: '0.4.0' }], values,
  });
  const modifiers = Object.fromEntries(abilityKeys.map(key => [key, sheet.values[`5e-srd-5.1:abilities.${key}.mod`]?.value]));
  check(Object.values(modifiers).every(Number.isInteger), 'OCF could not compute ability modifiers.');
  check(abilityKeys.every(key => modifiers[key] === Math.floor((stats.abilities[key] - 10) / 2)), 'OCF result conflicts with the basic ability scores.');
  check(Array.isArray(input.attacks) && input.attacks.length <= 30, 'Invalid attacks.');
  const ids = new Set();
  const attacks = input.attacks.map(action => {
    check(typeof action.id === 'string' && /^[a-z0-9_-]{1,64}$/i.test(action.id) && !ids.has(action.id), 'Invalid/duplicate action ID.');
    ids.add(action.id);
    check(typeof action.name === 'string' && action.name.length <= 100, 'Invalid attack name.');
    check(Number.isInteger(action.attack_bonus) && Math.abs(action.attack_bonus) <= 100, 'Invalid attack bonus.');
    parseDice(action.damage);
    check(typeof action.damage_type === 'string' && action.damage_type.length <= 40, 'Invalid damage type.');
    check(action.is_equipped === undefined || typeof action.is_equipped === 'boolean', 'Invalid equipment flag.');
    check(action.selected_for_basic_test === undefined || typeof action.selected_for_basic_test === 'boolean', 'Invalid test-selection flag.');
    check(action.inventory_entry_id === undefined || (Number.isSafeInteger(action.inventory_entry_id) && action.inventory_entry_id > 0), 'Invalid inventory reference.');
    return { id: action.id, name: action.name, attack_bonus: action.attack_bonus, damage: action.damage.replaceAll(' ', ''), damage_type: action.damage_type,
      ...(action.is_equipped === undefined ? {} : { is_equipped: action.is_equipped }),
      ...(action.selected_for_basic_test === undefined ? {} : { selected_for_basic_test: action.selected_for_basic_test }),
      ...(action.inventory_entry_id === undefined ? {} : { inventory_entry_id: action.inventory_entry_id }) };
  });
  return { name: entity.name, source: input.source, stats, modifiers, attacks, ...normalizeExtended(input),
    source_url: `http://127.0.0.1:18081/w/${entity.campaign_id}/entities/${entity.id}` };
}
export function parseDice(formula) {
  check(typeof formula === 'string' && formula.length <= 32, 'Invalid dice expression.');
  const match = /^(\d{1,2})d(\d{1,3})([+-]\d{1,3})?$/.exec(formula.replaceAll(' ', ''));
  check(match, 'Use NdS with an optional flat modifier.');
  const count = Number(match[1]), sides = Number(match[2]), modifier = Number(match[3] || 0);
  check(count >= 1 && count <= 30 && sides >= 2 && sides <= 100, 'Dice limits exceeded.');
  return { count, sides, modifier };
}
export function rollDice(formula, random = randomInt) {
  const { count, sides, modifier } = parseDice(formula);
  const dice = Array.from({ length: count }, () => random(1, sides + 1));
  return { formula: formula.replaceAll(' ', ''), dice, modifier, total: dice.reduce((a, b) => a + b, modifier) };
}
export function allowed(token, role) { return role === 'gm' || token.role === 'pc'; }
export function projectToken(token, role) {
  if (!allowed(token, role)) return { token_id: token.token_id, name: token.name, role: token.role, restricted: true };
  return { ...token, restricted: false };
}
export function resolveRoll(token, input) {
  if (input.kind === 'advanced') {
    const action = token.advanced_actions?.find(a => a.id === input.action_id), roll = action?.rolls.find(r => r.id === input.roll_id);
    check(action && roll, 'Unknown advanced action roll.');
    const result = rollDice(roll.formula);
    const ready = roll.kind === 'recharge' ? result.total >= roll.threshold : undefined;
    return { ...result, label: `${action.name} — ${roll.label}${ready === undefined ? '' : ready ? ' (recharge ready)' : ' (not recharged)'} — manual resolution`, manual_resolution: true, action_id: action.id, ...(ready === undefined ? {} : { recharge_ready: ready }), ...(roll.damage_type ? { damage_type: roll.damage_type } : {}) };
  }
  if (input.kind === 'attack' || input.kind === 'damage') {
    const attack = token.attacks.find(action => action.id === input.action_id);
    check(attack, 'Unknown attack.');
    const enabled = attack.is_equipped !== false || attack.selected_for_basic_test === true;
    check(enabled, 'This attack is not equipped.');
    const result = input.kind === 'attack' ? rollD20(attack.attack_bonus, input.mode || 'normal') : rollDice(attack.damage);
    return { ...result, label: `${attack.name} — ${input.kind}`, damage_type: input.kind === 'damage' ? attack.damage_type : null };
  }
  let modifier, label;
  if (input.kind === 'ability') { modifier = token.modifiers[input.ability]; label = `${input.ability?.toUpperCase()} check`; }
  else if (input.kind === 'save') { modifier = (token.saving_throws || token.modifiers)[input.ability]; label = `${input.ability?.toUpperCase()} saving throw`; }
  else if (input.kind === 'skill') { const skill = token.skills?.find(item => item.id === input.skill_id); check(skill, 'Unknown skill.'); modifier = skill.bonus; label = skill.name; }
  else if (input.kind === 'tool') {
    check(token.proficiencies?.tools?.includes(input.tool), 'Unknown tool proficiency.');
    check(Number.isInteger(token.modifiers[input.ability]) && Number.isInteger(token.stats.proficiency_bonus), 'Choose an ability for the tool check.');
    modifier = token.modifiers[input.ability] + token.stats.proficiency_bonus; label = `${input.tool} (${input.ability.toUpperCase()})`;
  } else if (input.kind === 'initiative') { modifier = token.stats.initiative; label = 'Initiative'; }
  else check(false, 'Unsupported roll.');
  check(Number.isInteger(modifier), 'Unknown ability or bonus.');
  return { ...rollD20(modifier, input.mode || 'normal'), label };
}
