import { createHash, randomInt } from 'node:crypto';
import { check, rollDice } from './core.mjs';
import { rollD20 } from './extended-sheet.mjs';
import { attachCondition, conditionDefinition, defaultFailedSaveEffect } from './conditions.mjs';
import { applyDamage } from './combat.mjs';
import { damageState, lifeState, lifeNotice, healthBand } from './vitals.mjs';

export function adjustedDamage(amount, type, traits = {}) {
  if (traits.immunities?.includes(type)) return 0;
  if (traits.resistances?.includes(type)) amount = Math.floor(amount / 2);
  if (traits.vulnerabilities?.includes(type)) amount *= 2;
  return amount;
}
export class AdvancedEffects {
  constructor({ db, tokenFor, saveEncounter, isPreparing = () => false, random = randomInt }) {
    Object.assign(this, { db, tokenFor, saveEncounter, isPreparing, random });
    db.exec('CREATE TABLE IF NOT EXISTS advanced_effects(id TEXT PRIMARY KEY,fingerprint TEXT NOT NULL,encounter_id TEXT NOT NULL,result TEXT NOT NULL)');
  }
  create(attackerId, input, role) {
    check(role === 'gm', 'The GM selects affected creatures for advanced actions.', 403);
    check(Object.keys(input).every(k => ['request_id', 'action_id', 'targets','failed_save_effect'].includes(k)) && typeof input.request_id === 'string' && /^[a-f0-9-]{36}$/.test(input.request_id), 'Invalid advanced action request.');
    const fingerprint = createHash('sha256').update(JSON.stringify({ attackerId, input, role })).digest('hex');
    const prior = this.db.prepare('SELECT * FROM advanced_effects WHERE id=?').get(input.request_id);
    if (prior) { check(prior.fingerprint === fingerprint, 'Request ID already used.', 409); return JSON.parse(prior.result); }
    const { encounter, token: attacker } = this.tokenFor(attackerId);
    check(!this.isPreparing() && encounter.status === 'ready', 'Wait until encounter preparation finishes.', 409);
    check(attacker.hp_current > 0 && lifeState(attacker) === 'alive', 'Only conscious living creatures can use an advanced action.', 409);
    const action = attacker.advanced_actions?.find(a => a.id === input.action_id);
    check(action && (action.save || action.rolls.some(r => r.kind === 'damage')), 'Choose an action with damage or a saving throw.');
    check(Array.isArray(input.targets) && input.targets.length >= 1 && input.targets.length <= 40 && input.targets.every(t => t && typeof t === 'object') && new Set(input.targets.map(t => t.token_id)).size === input.targets.length, 'Choose 1–40 distinct affected creatures.');
    const targets = input.targets.map(selected => {
      check(selected && Object.keys(selected).every(k => ['token_id', 'mode', 'manual_hp'].includes(k)) && ['normal', 'advantage', 'disadvantage'].includes(selected.mode || 'normal'), 'Invalid target/save mode.');
      check(selected.manual_hp === undefined || typeof selected.manual_hp === 'boolean', 'Invalid manual HP choice.');
      const token = encounter.tokens.find(t => t.token_id === selected.token_id);
      check(token && token.token_id !== attackerId && token.role !== 'object' && !['dead', 'destroyed'].includes(lifeState(token)), 'Choose another living creature in this encounter.');
      if (action.save) check(Number.isInteger((token.saving_throws || token.modifiers)?.[action.save.ability]), 'Target saving throw is unavailable.');
      return { token, mode: selected.mode || 'normal', manual_hp: selected.manual_hp === true };
    });
    const effectDefinition=input.failed_save_effect===null?null:input.failed_save_effect===undefined?defaultFailedSaveEffect(action):conditionDefinition(input.failed_save_effect);
    check(!effectDefinition||action.save,'A failed-save effect needs a saving throw.');
    const damageDefinitions = action.rolls.filter(r => r.kind === 'damage');
    check(damageDefinitions.every(r => ['acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder'].includes(r.damage_type)), 'Damage type is missing; use a manual roll.');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const damage = damageDefinitions.map(d => ({ ...rollDice(d.formula, this.random), damage_type: d.damage_type }));
      const outcomes = targets.map(({ token, mode, manual_hp }) => {
        const automaticFailure = action.save && token.hp_current === 0 && token.role === 'pc' && ['str','dex'].includes(action.save.ability);
        const save = action.save ? (automaticFailure ? { formula: 'Automatic failure (unconscious)', dice: [], modifier: 0, total: null, mode: 'automatic', automatic_failure: true } : rollD20((token.saving_throws || token.modifiers)[action.save.ability], mode, this.random)) : null;
        const success = save ? !automaticFailure && save.total >= action.save.dc : false;
        const manualDefense = manual_hp || !!token.damage_traits?.manual?.length;
        const amount = damage.reduce((sum, d) => sum + adjustedDamage(success ? (action.save.half_on_success ? Math.floor(d.total / 2) : 0) : d.total, d.damage_type, token.damage_traits), 0);
        const result = { token_id: token.token_id, name: token.name, save, save_success: save ? success : null, dc: action.save?.dc, damage_total: amount, manual_defenses: manualDefense ? [...(token.damage_traits?.manual || []), ...(manual_hp ? ['GM selected manual HP resolution'] : [])] : [], hp_applied: damage.length > 0 && !manualDefense };
        if (result.hp_applied) {
          result.hp_change = applyDamage(token, amount); token.hp_current = result.hp_change.hp_after; token.hp_temporary = result.hp_change.temp_after;
          damageState(token, result.hp_change); result.outcome_notice = lifeNotice(token);
        }
        if(effectDefinition&&action.save&&!success){const effect=attachCondition(token,effectDefinition,input.request_id+':'+token.token_id,{source_token_id:attackerId,source_name:attacker.name,save:{...action.save}});result.applied_effects=[effect];}
        result.after_health = healthBand(token);
        return result;
      });
      encounter.state_revision = (encounter.state_revision || 0) + 1; this.saveEncounter(encounter);
      const result = { id: input.request_id, encounter_id: encounter.id, attacker_token_id: attackerId, action_name: action.name, source_description: action.description, area: action.area || null, save: action.save || null, damage, targets: outcomes, visibility: 'gm', manual_effects: true, created_at: new Date().toISOString() };
      this.db.prepare('INSERT INTO advanced_effects VALUES(?,?,?,?)').run(result.id, fingerprint, encounter.id, JSON.stringify(result));
      const log = (suffix, values) => {
        const row = { id: result.id + ':' + suffix, encounter_id: encounter.id, token_id: attackerId, name: attacker.name, actor: 'GM', visibility: 'gm', created_at: result.created_at, ...values };
        this.db.prepare('INSERT INTO rolls VALUES(?,?,?,?,?)').run(row.id, fingerprint, encounter.id, 'gm', JSON.stringify(row));
      };
      damage.forEach((d, i) => log('damage-' + i, { ...d, label: `${action.name} shared ${d.damage_type} damage` }));
      outcomes.forEach((target, i) => { if (target.save) log('save-' + i, { ...target.save, label: `${target.name}: ${action.name} save DC ${action.save.dc} — ${target.save_success ? 'success' : 'failure'}` }); });
      log('outcome', { kind: 'combat_update', formula: 'Advanced action', dice: [], total: damage.reduce((sum,d) => sum+d.total,0), label: `${action.name} → ${outcomes.map(t => `${t.name}: ${t.hp_applied ? `${t.damage_total} damage, HP ${t.hp_change.hp_after}` : 'manual effect/defenses'}`).join('; ')}. Conditions, durations and usage limits remain manual.` });
      this.db.exec('COMMIT'); return result;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
}
