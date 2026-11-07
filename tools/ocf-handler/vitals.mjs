import { check } from './core.mjs';

export const lifeState = token => token.life_state || (token.hp_current > 0 ? 'alive' : token.role === 'pc' ? 'dying' : token.role === 'object' ? 'destroyed' : 'dead');
export const lifeNotice = token => `${token.name}: ${({ alive: 'alive', dying: 'unconscious — death saves required', stable: 'stable and unconscious', dead: 'dead', destroyed: 'destroyed' })[lifeState(token)]}`;
export function damageState(target, change, critical = false) {
  const state = target.life_state || (change.hp_before > 0 ? 'alive' : target.role === 'pc' ? 'dying' : target.role === 'object' ? 'destroyed' : 'dead'), suffered = change.damage_rolled - change.absorbed_by_temp;
  if (state === 'dead' || state === 'destroyed' || suffered <= 0) return;
  if (target.hp_current > 0) { target.life_state = 'alive'; return; }
  if (target.role !== 'pc') { target.life_state = target.role === 'object' ? 'destroyed' : 'dead'; return; }
  const remaining = suffered - change.hp_before;
  if (remaining >= target.stats.hp_max) { target.life_state = 'dead'; return; }
  if (change.hp_before > 0) { target.death_saves = { successes: 0, failures: 0 }; target.life_state = 'dying'; return; }
  const saves = target.death_saves || { successes: 0, failures: 0 };
  if (state === 'stable') { saves.successes = 0; saves.failures = 0; }
  saves.failures = Math.min(3, saves.failures + (critical ? 2 : 1));
  target.death_saves = saves; target.life_state = saves.failures >= 3 ? 'dead' : 'dying';
}
export function deathSave(token, natural) {
  check(token.role === 'pc' && token.hp_current === 0 && lifeState(token) === 'dying', 'Death saves require a dying player character at 0 HP.', 409);
  const saves = token.death_saves || { successes: 0, failures: 0 };
  if (natural === 20) { token.hp_current = 1; token.life_state = 'alive'; token.death_saves = { successes: 0, failures: 0 }; return; }
  if (natural >= 10) saves.successes += 1;
  else saves.failures += natural === 1 ? 2 : 1;
  saves.successes = Math.min(3, saves.successes); saves.failures = Math.min(3, saves.failures);
  token.life_state = saves.failures >= 3 ? 'dead' : saves.successes >= 3 ? 'stable' : 'dying';
  token.death_saves = token.life_state === 'stable' ? { successes: 0, failures: 0 } : saves;
}
export function heal(token, amount, { reviveZero = false } = {}) {
  check(!['dead', 'destroyed'].includes(lifeState(token)) || (reviveZero && token.role !== 'object' && token.hp_current <= 0), 'Healing cannot revive the dead or repair an object.', 409);
  check(token.role !== 'object', 'Choose a creature for healing.');
  const before = token.hp_current;
  token.hp_current = Math.min(token.stats.hp_max, Math.max(0, before) + amount);
  if (token.hp_current > 0) { token.life_state = 'alive'; token.death_saves = { successes: 0, failures: 0 }; }
  return { hp_before: before, hp_after: token.hp_current, healing_rolled: amount, healing_applied: token.hp_current - before };
}
export function seedDemoInventory(token) {
  // Encounter-local demo override; never write it back to Kanka inventory.
  if (token.entity_id === 3463) {
    token.inventory ||= [];
    let potion = token.inventory.find(item => item.id === 'potion-healing');
    if (!potion) { potion = { id: 'potion-healing', name: 'Potion of healing', quantity: 1, healing: '2d4+2' }; token.inventory.push(potion); }
    potion.unlimited = true; token.demo_potion_seeded = true;
  }
  return token;
}

export function healthBand(token) {
  const ratio = token.stats.hp_max > 0 ? token.hp_current / token.stats.hp_max : 0;
  const band = ratio > 0.5 ? 'green' : ratio > 0.25 ? 'yellow' : 'red';
  return { band, label: band === 'green' ? 'Good' : band === 'yellow' ? 'Not Good' : 'Bad' };
}

export function encounterTargets(encounter, actorId, healing = false) {
  const creatures = encounter.tokens.filter(token => token.role !== 'object');
  if (healing) return creatures; // Demo potions may revive any zero-HP creature.
  return [...creatures, ...(encounter.objects || [])].filter(token => token.token_id !== actorId && !['dead', 'destroyed'].includes(lifeState(token)));
}
