import { createHash, randomInt } from 'node:crypto';
import { allowed, check, parseDice, rollDice } from './core.mjs';
import { rollD20 } from './extended-sheet.mjs';
import { lifeState, lifeNotice, damageState, deathSave, heal, healthBand } from './vitals.mjs';

const uuid = value => typeof value === 'string' && /^[a-f0-9-]{36}$/.test(value);
const targetsOf = encounter => [...encounter.tokens, ...(encounter.objects || [])];
const fingerprint = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function resolveAttack(attacker, target, actionId, random = randomInt, options = {}) {
  const action = attacker.attacks.find(item => item.id === actionId);
  check(action, 'Unknown attack.');
  check(action.is_equipped !== false || action.selected_for_basic_test === true, 'This attack is not equipped.');
  const attack = rollD20(action.attack_bonus, options.mode || 'normal', random);
  const natural = attack.natural;
  const critical = natural === 20;
  const hit = critical || (natural !== 1 && attack.total >= target.stats.ac);
  let damage = null;
  if (hit) {
    const parsed = parseDice(action.damage);
    const count = parsed.count * (critical ? 2 : 1);
    const dice = Array.from({ length: count }, () => random(1, parsed.sides + 1));
    damage = {
      formula: `${count}d${parsed.sides}${parsed.modifier ? `${parsed.modifier > 0 ? '+' : ''}${parsed.modifier}` : ''}`,
      dice, modifier: parsed.modifier,
      total: Math.max(0, dice.reduce((sum, die) => sum + die, parsed.modifier)),
      damage_type: action.damage_type,
    };
  }
  return { action_id: action.id, action_name: action.name, attack, natural, hit, critical, damage };
}

export function applyDamage(target, amount) {
  check(Number.isSafeInteger(amount) && amount >= 0, 'Invalid damage.');
  const hpBefore = target.hp_current, tempBefore = target.hp_temporary || 0;
  check(Number.isSafeInteger(hpBefore) && hpBefore >= 0 && Number.isSafeInteger(tempBefore) && tempBefore >= 0, 'Target HP needs GM initialization.');
  const absorbed = Math.min(tempBefore, amount);
  return { hp_before: hpBefore, hp_after: Math.max(0, hpBefore - (amount - absorbed)), temp_before: tempBefore, temp_after: tempBefore - absorbed, damage_rolled: amount, absorbed_by_temp: absorbed };
}

export class Combat {
  constructor({ db, getEncounter, saveEncounter, tokenFor, isPreparing = () => false, random = randomInt }) {
    Object.assign(this, { db, getEncounter, saveEncounter, tokenFor, isPreparing, random });
    db.exec(`CREATE TABLE IF NOT EXISTS attacks(id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, encounter_id TEXT NOT NULL, attacker_id TEXT NOT NULL, visibility TEXT NOT NULL, status TEXT NOT NULL, result TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS combat_utilities(id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, encounter_id TEXT NOT NULL, result TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS combat_decisions(id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, result TEXT NOT NULL);`);
  }
  retirePending() {
    this.transaction(() => {
      for (const row of this.db.prepare("SELECT id,result FROM attacks WHERE status='awaiting_approval'").all()) {
        const action = JSON.parse(row.result); action.status = 'cancelled';
        action.cancellation_reason = 'Approval workflow retired; damage was not applied. Roll a new attack.';
        this.db.prepare('UPDATE attacks SET status=?,result=? WHERE id=?').run(action.status, JSON.stringify(action), row.id);
      }
    });
  }
  transaction(run) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = run(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  history(action, suffix, values) {
    const result = { id: `${action.id}:${suffix}`, encounter_id: action.encounter_id, attack_id: action.id, token_id: action.attacker_token_id, name: action.attacker_name, actor: action.actor, visibility: action.visibility, created_at: new Date().toISOString(), ...values };
    this.db.prepare('INSERT INTO rolls(id,fingerprint,encounter_id,visibility,result) VALUES(?,?,?,?,?)').run(result.id, fingerprint(result), action.encounter_id, action.visibility, JSON.stringify(result));
  }
  raw(id) {
    const row = this.db.prepare('SELECT result FROM attacks WHERE id=?').get(id);
    check(row, 'Unknown attack interaction.', 404);
    return JSON.parse(row.result);
  }
  project(action, role) {
    check(role === 'gm' || action.visibility === 'public', 'This attack interaction is GM-only.', 403);
    const result = { ...action };
    const currentTarget = targetsOf(this.getEncounter(action.encounter_id)).find(token => token.token_id === action.target_token_id);
    if (currentTarget) {
      result.current_target_health = healthBand(currentTarget);
      if (role === 'gm') result.target_hp = { current: currentTarget.hp_current, maximum: currentTarget.stats.hp_max };
    }
    if (action.status === 'awaiting_approval' && currentTarget) {
      const preview = { ...currentTarget, hp_current: applyDamage(currentTarget, action.damage.total).hp_after };
      result.damage_health = healthBand(preview);
    }
    if (role !== 'gm') {
      delete result.target_ac;
      delete result.hp_change;
    } else if (action.status === 'awaiting_approval') {
      const target = targetsOf(this.getEncounter(action.encounter_id)).find(token => token.token_id === action.target_token_id);
      if (target) {
        result.approval_preview = applyDamage(target, action.damage.total);
        const preview = structuredClone(target); preview.hp_current = result.approval_preview.hp_after;
        damageState(preview, result.approval_preview, action.critical);
        result.approval_notice = lifeNotice(preview);
      }
    }
    return result;
  }
  get(id, role) { return this.project(this.raw(id), role); }
  list(role) {
    return this.db.prepare("SELECT result FROM attacks WHERE visibility='public' OR ?='gm' ORDER BY CASE WHEN status='awaiting_approval' THEN 0 ELSE 1 END, rowid DESC LIMIT 40").all(role).map(row => this.project(JSON.parse(row.result), role));
  }
  create(attackerId, input, role) {
    check(Object.keys(input).every(key => ['request_id', 'action_id', 'target_token_id', 'mode', 'bonus_ids'].includes(key)), 'Unexpected attack fields.');
    check(uuid(input.request_id), 'A UUID request ID is required.');
    const { encounter, token: attacker } = this.tokenFor(attackerId);
    check(allowed(attacker, role), 'Only the GM can attack with this token.', 403);
    const intent = fingerprint({ role, attackerId, input });
    const prior = this.db.prepare('SELECT * FROM attacks WHERE id=?').get(input.request_id);
    if (prior) { check(prior.fingerprint === intent, 'Request ID already used for another attack.', 409); return this.project(JSON.parse(prior.result), role); }
    check(!this.isPreparing() && encounter.status === 'ready', 'Wait until encounter preparation finishes.', 409);
    const target = targetsOf(encounter).find(token => token.token_id === input.target_token_id);
    check(attacker.hp_current > 0 && lifeState(attacker) === 'alive', 'Only a conscious living attacker can attack.', 409);
    check(target && target.token_id !== attacker.token_id, 'Choose another token in this encounter.');
    check(!['dead', 'destroyed'].includes(lifeState(target)), 'This target is already dead or destroyed.', 409);
    check(!this.db.prepare("SELECT id FROM attacks WHERE encounter_id=? AND attacker_id=? AND status='awaiting_approval'").get(encounter.id, attackerId), 'Finish the pending attack before starting another.', 409);
    check(input.mode === undefined || ['normal', 'advantage', 'disadvantage'].includes(input.mode), 'Invalid attack roll mode.');
    const bonusIds = input.bonus_ids || [];
    check(Array.isArray(bonusIds) && bonusIds.length <= 1 && new Set(bonusIds).size === bonusIds.length, 'Invalid bonus attacks.');
    const bonus = bonusIds.length ? attacker.features?.find(f => f.id === bonusIds[0] && f.rule === 'colossus_slayer') : null;
    check(!bonusIds.length || bonus, 'Unknown special attack.');
    const turn = encounter.initiative;
    const bonusKey = bonus ? `${turn?.session_id}:${turn?.turn_number}:${attackerId}:${bonus.id}` : null;
    if (bonus) {
      check(target.role !== 'object' && target.hp_current < target.stats.hp_max, 'Colossus Slayer requires a creature already below maximum HP.', 409);
      check(turn?.status === 'active' && turn.turn_number, 'Start initiative to track Colossus Slayer once per turn.', 409);
      check(!encounter.feature_uses?.[bonusKey], 'Colossus Slayer has already been used this turn.', 409);
    }
    const action = this.transaction(() => {
      const result = {
        id: input.request_id, encounter_id: encounter.id, profile_revision: encounter.revision,
        attacker_token_id: attacker.token_id, target_token_id: target.token_id,
        attacker_name: attacker.name, target_name: target.name, target_role: target.role,
        attacker_role: attacker.role,
        actor: role === 'gm' ? 'GM' : 'Player (shared demo access)',
        visibility: attacker.role === 'pc' ? 'public' : 'gm', target_ac: target.stats.ac,
        created_at: new Date().toISOString(), ...resolveAttack(attacker, target, input.action_id, this.random, input),
      };
      if (bonus && result.hit) {
        const extra = rollDice(result.critical ? '2d8' : '1d8', this.random);
        result.damage.components = [{ name: 'Base damage', ...result.damage, dice: [...result.damage.dice] }, { name: bonus.name, ...extra }];
        result.damage.formula += ' + ' + extra.formula; result.damage.dice.push(...extra.dice); result.damage.total += extra.total;
        encounter.feature_uses ||= {}; encounter.feature_uses[bonusKey] = result.id;
        result.bonus_name = bonus.name;
      }
      result.status = 'missed';
      result.target_health = healthBand(target);
      if (result.hit) result.damage_health = healthBand({ ...target, hp_current: applyDamage(target, result.damage.total).hp_after });
      if (result.hit) {
        this.applyHit(result, encounter, target);
        result.status = 'applied'; result.automatic = true;
        result.decided_at = new Date().toISOString(); result.decided_by = 'Automatic attack';
      }
      this.db.prepare('INSERT INTO attacks(id,fingerprint,encounter_id,attacker_id,visibility,status,result) VALUES(?,?,?,?,?,?,?)').run(result.id, intent, encounter.id, attackerId, result.visibility, result.status, JSON.stringify(result));
      this.history(result, 'attack', { ...result.attack, label: `${result.action_name} → ${target.name}: ${result.hit ? (result.critical ? 'critical hit' : 'hit') : 'miss'}` });
      if (result.damage) this.history(result, 'damage', { ...result.damage, label: `${result.action_name} damage → ${target.name} ${result.automatic ? '(applied automatically)' : '(awaiting GM approval)'}`, health: result.damage_health });
      if (result.automatic) this.history(result, 'decision', { kind: 'combat_update', dice: [], formula: 'Automatic attack', total: result.damage.total, health: result.damage_health, label: `Attack automatically applied ${result.damage.total} ${result.damage.damage_type} damage → ${target.name}. ${result.outcome_notice}` });
      return result;
    });
    return this.project(action, role);
  }
  applyHit(action, encounter, target) {
    action.hp_change = applyDamage(target, action.damage.total);
    target.hp_current = action.hp_change.hp_after; target.hp_temporary = action.hp_change.temp_after;
    damageState(target, action.hp_change, action.critical);
    action.target_state = lifeState(target); action.outcome_notice = lifeNotice(target);
    action.damage_health = healthBand(target);
    encounter.state_revision = (encounter.state_revision || 0) + 1; this.saveEncounter(encounter);
  }
  utility(tokenId, input, role, kind) {
    check(Object.keys(input).every(key => ['request_id', 'target_token_id', 'item_id'].includes(key)) && uuid(input.request_id), 'Invalid utility request.');
    const { encounter, token } = this.tokenFor(tokenId);
    check(allowed(token, role), 'Only the GM controls this token.', 403);
    const intent = fingerprint({ tokenId, input, role, kind });
    const prior = this.db.prepare('SELECT * FROM combat_utilities WHERE id=?').get(input.request_id);
    if (prior) { check(prior.fingerprint === intent, 'Request ID already used.', 409); return JSON.parse(prior.result); }
    check(!this.isPreparing() && encounter.status === 'ready', 'Wait until encounter preparation finishes.', 409);
    return this.transaction(() => {
      const result = { id: input.request_id, encounter_id: encounter.id, attacker_token_id: tokenId, attacker_name: token.name,
        actor: role === 'gm' ? 'GM' : 'Player (shared demo access)', visibility: token.role === 'pc' ? 'public' : 'gm', kind, created_at: new Date().toISOString() };
      if (kind === 'death_save') {
        check(!input.target_token_id && !input.item_id, 'Death saves do not take targets or items.');
        check(token.role === 'pc' && token.hp_current === 0 && lifeState(token) === 'dying', 'Death saves require a dying player character at 0 HP.', 409);
        const rolled = rollDice('1d20', this.random); const before = structuredClone(token.death_saves || { successes: 0, failures: 0 });
        deathSave(token, rolled.total);
        Object.assign(result, rolled, { label: `Death save → ${token.name}`, target_name: token.name, target_token_id: tokenId, saves_before: before, death_saves: token.death_saves, target_state: lifeState(token), outcome_notice: lifeNotice(token), hp_current: token.hp_current });
      } else if (kind === 'healing') {
        check(role === 'gm' || (token.hp_current > 0 && lifeState(token) === 'alive'), 'An unconscious creature needs the GM to administer its demo potion.', 409);
        const target = encounter.tokens.find(item => item.token_id === input.target_token_id);
        check(target, 'Choose a creature in this encounter.');
        const potion = token.inventory?.find(item => item.id === input.item_id && item.id === 'potion-healing');
        check(potion && (potion.unlimited === true || (Number.isSafeInteger(potion.quantity) && potion.quantity > 0)), 'No healing potions remaining.', 409);
        const rolled = rollDice('2d4+2', this.random);
        const change = heal(target, rolled.total, { reviveZero: true }); if (!potion.unlimited) potion.quantity -= 1;
        Object.assign(result, rolled, { label: `Potion of healing → ${target.name}`, target_name: target.name, target_token_id: target.token_id, target_state: lifeState(target), outcome_notice: lifeNotice(target), remaining: potion.unlimited ? null : potion.quantity, unlimited: potion.unlimited === true });
        // NPC HP stays GM-only even when healed by a player.
        if (target.role === 'pc') result.hp_change = change;
      } else check(false, 'Unsupported utility.');
      encounter.state_revision = (encounter.state_revision || 0) + 1; this.saveEncounter(encounter);
      this.db.prepare('INSERT INTO combat_utilities VALUES(?,?,?,?)').run(result.id, intent, encounter.id, JSON.stringify(result));
      this.history(result, kind, result);
      return result;
    });
  }
  addObject(tokenId, input, role) {
    check(role === 'gm', 'Only the GM can define object AC and HP.', 403);
    check(Object.keys(input).every(key => ['request_id', 'name', 'ac', 'hp'].includes(key)) && uuid(input.request_id), 'Invalid object request.');
    check(typeof input.name === 'string' && input.name.trim().length > 0 && input.name.length <= 100, 'Object name required (100 characters maximum).');
    check(Number.isSafeInteger(input.ac) && input.ac >= 1 && input.ac <= 30 && Number.isSafeInteger(input.hp) && input.hp >= 1 && input.hp <= 10000, 'Object needs AC 1–30 and HP 1–10000.');
    const { encounter } = this.tokenFor(tokenId), intent = fingerprint({ tokenId, input, role, kind: 'object' });
    const prior = this.db.prepare('SELECT * FROM combat_utilities WHERE id=?').get(input.request_id);
    if (prior) { check(prior.fingerprint === intent, 'Request ID already used.', 409); return JSON.parse(prior.result); }
    check(!this.isPreparing() && encounter.status === 'ready', 'Wait until encounter preparation finishes.', 409);
    check((encounter.objects || []).length < 50, 'Object limit reached.');
    return this.transaction(() => {
      const object = { token_id: input.request_id, name: input.name.trim(), role: 'object', stats: { ac: input.ac, hp_max: input.hp }, hp_current: input.hp, hp_temporary: 0, life_state: 'alive' };
      encounter.objects = [...(encounter.objects || []), object]; this.saveEncounter(encounter);
      this.db.prepare('INSERT INTO combat_utilities VALUES(?,?,?,?)').run(input.request_id, intent, encounter.id, JSON.stringify(object));
      return object;
    });
  }
  decide(id, input, role) {
    check(role === 'gm', 'Only the GM can approve or reject damage.', 403);
    check(Object.keys(input).every(key => ['request_id', 'approve'].includes(key)) && uuid(input.request_id) && typeof input.approve === 'boolean', 'Invalid GM decision.');
    const intent = fingerprint({ id, input });
    const duplicate = this.db.prepare('SELECT * FROM combat_decisions WHERE id=?').get(input.request_id);
    if (duplicate) { check(duplicate.fingerprint === intent, 'Decision request ID already used.', 409); return this.project(JSON.parse(duplicate.result), role); }
    check(!this.isPreparing(), 'Wait until encounter preparation finishes.', 409);
    const result = this.transaction(() => {
      const action = this.raw(id);
      if (action.status === (input.approve ? 'applied' : 'rejected')) return action;
      check(action.status === 'awaiting_approval', 'This interaction has already finished or missed.', 409);
      const encounter = this.getEncounter(action.encounter_id);
      check(encounter?.status === 'ready', 'Encounter is not ready.', 409);
      const target = targetsOf(encounter).find(token => token.token_id === action.target_token_id);
      check(target, 'Target no longer exists.', 409);
      if (input.approve) {
        this.applyHit(action, encounter, target);
      }
      action.status = input.approve ? 'applied' : 'rejected';
      action.decided_at = new Date().toISOString(); action.decided_by = 'GM';
      this.db.prepare('UPDATE attacks SET status=?,result=? WHERE id=?').run(action.status, JSON.stringify(action), id);
      this.db.prepare('INSERT INTO combat_decisions(id,fingerprint,result) VALUES(?,?,?)').run(input.request_id, intent, JSON.stringify(action));
      this.history(action, 'decision', {
        health: action.damage_health, kind: 'combat_update', actor: 'GM', dice: [], formula: 'GM decision', total: input.approve ? action.damage.total : 0,
        label: input.approve ? `GM approved ${action.damage.total} ${action.damage.damage_type} damage → ${target.name}. ${action.outcome_notice}` : `GM rejected damage → ${target.name}; HP unchanged`,
      });
      return action;
    });
    return this.project(result, role);
  }
}
