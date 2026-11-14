import { createHash, randomInt } from 'node:crypto';
import { check, allowed, rollDice } from './core.mjs';
import { lifeState } from './vitals.mjs';
const uuid = value => typeof value === 'string' && /^[a-f0-9-]{36}$/.test(value);
const eligible = token => !['dead', 'destroyed'].includes(lifeState(token));

export class Initiative {
  constructor({ db, getEncounter, saveEncounter, tokenFor, isPreparing = () => false, random = randomInt }) {
    Object.assign(this, { db, getEncounter, saveEncounter, tokenFor, isPreparing, random });
    db.exec('CREATE TABLE IF NOT EXISTS initiative_requests(id TEXT PRIMARY KEY,fingerprint TEXT NOT NULL,encounter_id TEXT NOT NULL,result TEXT NOT NULL)');
  }
  project(encounter) {
    const state = encounter.initiative;
    if (!state) return null;
    return { encounter_id: encounter.id, encounter_name: encounter.name, ...state,
      entries: state.entries.map(entry => ({ ...entry, effects: (encounter.tokens.find(t=>t.token_id===entry.token_id)?.active_effects||[]).map(effect=>effect.name), condition: lifeState(encounter.tokens.find(t => t.token_id === entry.token_id) || { hp_current: 0, role: 'enemy' }) })) };
  }
  mutate(encounter, input, role, operation, run) {
    check(uuid(input.request_id), 'A UUID request ID is required.');
    const fingerprint = createHash('sha256').update(JSON.stringify({ encounter: encounter.id, role, operation, input })).digest('hex');
    const prior = this.db.prepare('SELECT * FROM initiative_requests WHERE id=?').get(input.request_id);
    if (prior) { check(prior.fingerprint === fingerprint, 'Request ID already used.', 409); return JSON.parse(prior.result); }
    check(!this.isPreparing() && encounter.status === 'ready', 'Wait until encounter preparation finishes.', 409);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      run(); encounter.initiative.revision = (encounter.initiative.revision || 0) + 1;
      this.saveEncounter(encounter);
      const result = this.project(encounter);
      this.db.prepare('INSERT INTO initiative_requests VALUES(?,?,?,?)').run(input.request_id, fingerprint, encounter.id, JSON.stringify(result));
      this.db.exec('COMMIT'); return result;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  request(tokenId, input, role) {
    check(Object.keys(input).every(key => key === 'request_id'), 'Unexpected initiative request fields.');
    const { encounter, token } = this.tokenFor(tokenId);
    check(allowed(token, role), 'Only the GM can request initiative with an NPC.', 403);
    return this.mutate(encounter, input, role, 'request:' + tokenId, () => {
      check(!encounter.initiative || ['ended', 'rejected'].includes(encounter.initiative.status), 'Initiative has already been requested or started.', 409);
      encounter.initiative = { session_id: input.request_id, status: 'pending', requested_by: token.name, requested_token_id: tokenId, entries: [], order: [], round: 0, current_token_id: null, revision: encounter.initiative?.revision || 0 };
    });
  }
  roll(encounter, entry, role) {
    check(entry && entry.total === null, 'This character has already rolled or is not queued.', 409);
    const token = encounter.tokens.find(t => t.token_id === entry.token_id);
    const modifier = token.stats.initiative;
    check(Number.isSafeInteger(modifier), 'Initiative modifier is missing.');
    const result = rollDice(`1d20${modifier < 0 ? '' : '+'}${modifier}`, this.random);
    entry.total = result.total; entry.die = result.dice[0];
    const row = { id: `${encounter.initiative.session_id}:initiative:${token.token_id}`, encounter_id: encounter.id, token_id: token.token_id, name: token.name, actor: role === 'gm' ? 'GM' : 'Player (shared demo access)', visibility: 'public', created_at: new Date().toISOString(), label: 'Initiative', ...result };
    this.db.prepare('INSERT INTO rolls VALUES(?,?,?,?,?)').run(row.id, 'initiative', encounter.id, 'public', JSON.stringify(row));
  }
  startIfReady(encounter) {
    const state = encounter.initiative;
    if (state.entries.some(entry => entry.total === null)) return;
    const modifier = entry => encounter.tokens.find(t => t.token_id === entry.token_id).stats.initiative;
    state.order = [...state.entries].sort((a, b) => b.total - a.total || modifier(b) - modifier(a) || a.name.localeCompare(b.name) || a.token_id.localeCompare(b.token_id)).map(entry => entry.token_id);
    state.status = 'active'; state.round = state.resume?.round || 1; state.current_token_id = state.resume?.current_token_id || state.order[0]; state.turn_number = state.resume?.turn_number || 1; delete state.resume;
  }
  command(encounterId, input, role) {
    check(Object.keys(input).every(key => ['request_id', 'action', 'session_id', 'token_id', 'expected_revision'].includes(key)), 'Unexpected initiative command fields.');
    const encounter = this.getEncounter(encounterId); check(encounter?.initiative, 'No initiative request for this encounter.', 404);
    return this.mutate(encounter, input, role, 'command', () => {
      const state = encounter.initiative;
      check(state.session_id === input.session_id, 'This combat has changed. Refresh the tracker.', 409);
      const gm = () => check(role === 'gm', 'Only the GM can do this.', 403);
      if (input.action === 'approve') {
        gm(); check(state.status === 'pending', 'Initiative is no longer pending.', 409);
        state.entries = encounter.tokens.filter(eligible).map(token => ({ token_id: token.token_id, name: token.name, role: token.role, total: null }));
        check(state.entries.length > 0, 'No living participants.'); state.status = 'rolling';
      } else if (input.action === 'reject') {
        gm(); check(state.status === 'pending', 'Initiative is no longer pending.', 409); state.status = 'rejected';
      } else if (input.action === 'roll' || input.action === 'roll_npcs') {
        check(state.status === 'rolling', 'Initiative is not accepting rolls.', 409);
        if (input.action === 'roll_npcs') {
          gm(); const pending = state.entries.filter(e => e.role !== 'pc' && e.total === null);
          check(pending.length > 0, 'No NPC rolls remain.', 409); for (const entry of pending) this.roll(encounter, entry, role);
        } else {
          const entry = state.entries.find(e => e.token_id === input.token_id);
          check(entry && (role === 'gm' || entry.role === 'pc'), 'Only the GM rolls NPC initiative.', 403);
          this.roll(encounter, entry, role);
        }
        this.startIfReady(encounter);
      } else if (input.action === 'advance' || input.action === 'end_turn') {
        check(state.status === 'active', 'Combat is not active.', 409);
        check(state.revision === input.expected_revision, 'The turn has already advanced. Refresh the tracker.', 409);
        const entry = state.entries.find(e => e.token_id === state.current_token_id);
        if (input.action === 'advance') gm();
        else check(entry?.role === 'pc' && input.token_id === state.current_token_id && (role === 'gm' || role === 'player'), 'Only the active PC can end this turn.', 403);
        let index = state.order.indexOf(state.current_token_id), next = null;
        for (let count = 0; count < state.order.length; count++) {
          index += 1; if (index >= state.order.length) { index = 0; state.round += 1; }
          const candidate = encounter.tokens.find(t => t.token_id === state.order[index]);
          if (candidate && eligible(candidate)) { next = candidate.token_id; break; }
        }
        state.current_token_id = next; state.turn_number += 1;
        if (!next) state.status = 'ended';
      } else if (input.action === 'end_combat') {
        gm(); check(['pending', 'rolling', 'active'].includes(state.status), 'Combat has already ended.', 409);
        check(state.revision === input.expected_revision, 'The tracker has changed. Retry from the latest turn.', 409);
        state.status = 'ended'; state.current_token_id = null;
        state.entries = []; state.order = []; state.round = 0; state.turn_number = 0; delete state.resume;
      } else check(false, 'Unknown initiative command.');
    });
  }
}

export function enrollNewParticipants(encounter) {
  const state = encounter.initiative;
  if (!state || !['rolling', 'active'].includes(state.status)) return 0;
  const added = encounter.tokens.filter(token => eligible(token) && !state.entries.some(entry => entry.token_id === token.token_id));
  if (!added.length) return 0;
  if (state.status === 'active') state.resume = { round: state.round, current_token_id: state.current_token_id, turn_number: state.turn_number };
  state.entries.push(...added.map(token => ({ token_id: token.token_id, name: token.name, role: token.role, total: null })));
  state.status = 'rolling'; state.revision += 1; return added.length;
}
