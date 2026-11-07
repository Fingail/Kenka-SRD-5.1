import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { Initiative } from './initiative.mjs';

function fixture(values = [20, 15, 10]) {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE encounters(id TEXT PRIMARY KEY,config TEXT); CREATE TABLE rolls(id TEXT PRIMARY KEY,fingerprint TEXT,encounter_id TEXT,visibility TEXT,result TEXT)');
  const getEncounter = id => JSON.parse(db.prepare('SELECT config FROM encounters WHERE id=?').get(id).config);
  const saveEncounter = e => db.prepare('INSERT OR REPLACE INTO encounters VALUES(?,?)').run(e.id, JSON.stringify(e));
  saveEncounter({ id: 'test', name: 'Test', status: 'ready', tokens: [
    { token_id: 'pc', name: 'Lux', role: 'pc', hp_current: 20, stats: { initiative: 4 } },
    { token_id: 'pc2', name: 'Friend', role: 'pc', hp_current: 20, stats: { initiative: 0 } },
    { token_id: 'npc', name: 'Bear', role: 'enemy', hp_current: 20, stats: { initiative: -1 } },
    { token_id: 'dead', name: 'Dead bear', role: 'enemy', hp_current: 0, stats: { initiative: 0 } },
  ] });
  const options = { db, getEncounter, saveEncounter, tokenFor: id => { const encounter = getEncounter('test'); return { encounter, token: encounter.tokens.find(t => t.token_id === id) }; }, random: (min, max) => { const value = values.shift(); assert.ok(value >= min && value < max, 'Unexpected roll'); return value; } };
  const tracker = new Initiative(options);
  const state = () => tracker.project(getEncounter('test'));
  const input = (action, tokenId) => ({ request_id: randomUUID(), action, session_id: state().session_id, expected_revision: state().revision, ...(tokenId ? { token_id: tokenId } : {}) });
  const command = (action, role = 'gm', tokenId) => tracker.command('test', input(action, tokenId), role);
  const request = () => tracker.request('pc', { request_id: randomUUID() }, 'player');
  const active = () => { request(); command('approve'); command('roll_npcs'); command('roll', 'player', 'pc'); command('roll', 'player', 'pc2'); };
  return { db, tracker, getEncounter, saveEncounter, state, command, input, request, active, options };
}
test('initiative waits for GM approval, queues PCs and NPCs, rolls once and sorts ties deterministically', () => {
  const f = fixture();
  f.request(); assert.equal(f.state().status, 'pending'); assert.equal(f.state().entries.length, 0);
  assert.throws(() => f.command('approve', 'player'), e => e.status === 403);
  assert.throws(() => f.command('roll', 'player', 'pc'), e => e.status === 409);
  f.command('approve'); assert.equal(f.state().entries.length, 3);
  assert.throws(() => f.command('roll_npcs', 'player'), e => e.status === 403);
  assert.throws(() => f.command('roll', 'player', 'npc'), e => e.status === 403);
  const roll = f.input('roll_npcs'); const rolled = f.tracker.command('test', roll, 'gm');
  assert.deepEqual(f.tracker.command('test', roll, 'gm'), rolled);
  assert.throws(() => f.command('roll', 'gm', 'npc'), e => e.status === 409);
  assert.equal(f.state().status, 'rolling'); f.command('roll', 'player', 'pc'); f.command('roll', 'player', 'pc2');
  assert.equal(f.state().status, 'active'); assert.deepEqual(f.state().order, ['pc', 'npc', 'pc2']);
  assert.equal(f.state().round, 1); assert.equal(f.db.prepare('SELECT COUNT(*) n FROM rolls').get().n, 3); f.db.close();
});
test('turn controls enforce role and active PC, resist replay/stale tabs, wrap rounds and survive handler reconstruction', () => {
  const f = fixture(); f.active();
  assert.throws(() => f.command('end_turn', 'player', 'pc2'), e => e.status === 403);
  assert.throws(() => f.command('advance', 'player'), e => e.status === 403);
  const end = f.input('end_turn', 'pc'); const next = f.tracker.command('test', end, 'player');
  assert.equal(next.current_token_id, 'npc'); assert.deepEqual(f.tracker.command('test', end, 'player'), next);
  assert.throws(() => f.tracker.command('test', { ...end, request_id: randomUUID() }, 'player'), e => e.status === 409);
  assert.throws(() => f.command('end_turn', 'player', 'npc'), e => e.status === 403);
  f.command('advance'); assert.equal(f.state().current_token_id, 'pc2'); f.command('end_turn', 'player', 'pc2');
  assert.equal(f.state().round, 2); assert.equal(f.state().current_token_id, 'pc');
  assert.deepEqual(new Initiative(f.options).project(f.getEncounter('test')), f.state()); f.db.close();
});
test('GM can end combat while pending or active; players cannot; later combat rejects old commands', () => {
  const f = fixture(); f.request();
  assert.throws(() => f.command('end_combat', 'player'), e => e.status === 403);
  f.command('end_combat'); assert.equal(f.state().status, 'ended');
  f.active(); const old = f.input('end_combat'); f.tracker.command('test', old, 'gm');
  assert.equal(f.state().current_token_id, null); f.request();
  assert.throws(() => f.tracker.command('test', { ...old, request_id: randomUUID() }, 'gm'), e => e.status === 409); f.db.close();
});
test('dead combatants are skipped while dying PCs keep their turns', () => {
  const f = fixture(); f.active();
  const e = f.getEncounter('test'); e.tokens.find(t => t.token_id === 'npc').hp_current = 0;
  e.tokens.find(t => t.token_id === 'pc2').hp_current = 0; f.saveEncounter(e);
  f.command('end_turn', 'player', 'pc'); assert.equal(f.state().current_token_id, 'pc2');
  assert.equal(f.state().entries.find(t => t.token_id === 'pc2').condition, 'dying'); f.db.close();
});
test('batch roll failure rolls back all results, logs and request record', () => {
  const f = fixture(); f.request(); f.command('approve');
  const state = f.state(); const id = `${state.session_id}:initiative:npc`;
  f.db.prepare('INSERT INTO rolls VALUES(?,?,?,?,?)').run(id, 'failure', 'test', 'gm', '{}');
  assert.throws(() => f.command('roll_npcs'));
  assert.equal(f.state().entries.find(e => e.token_id === 'npc').total, null);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM initiative_requests').get().n, 2); f.db.close();
});

test('additive roster refresh queues new NPCs while preserving the existing turn and round', async () => {
  const { enrollNewParticipants } = await import('./initiative.mjs'); const f = fixture([20, 15, 10, 8]); f.active();
  const e = f.getEncounter('test'); e.tokens.push({ token_id: 'new', name: 'Kobold 1', role: 'enemy', hp_current: 5, stats: { initiative: 2 } });
  assert.equal(enrollNewParticipants(e), 1); assert.equal(e.initiative.status, 'rolling'); f.saveEncounter(e);
  f.command('roll_npcs'); assert.equal(f.state().status, 'active'); assert.equal(f.state().current_token_id, 'pc'); assert.equal(f.state().round, 1); assert.equal(f.state().order.length, 4); f.db.close();
});

test('ending combat clears turn order and new battles queue fresh initiative rolls', () => {
  const f=fixture([20,15,10,3,4,5]);f.active();
  const oldSession=f.state().session_id,old=f.input('end_turn','pc');
  const ended=f.command('end_combat');
  assert.deepEqual(ended.entries,[]);assert.deepEqual(ended.order,[]);assert.equal(ended.round,0);assert.equal(ended.turn_number,0);assert.equal(ended.current_token_id,null);
  f.request();assert.notEqual(f.state().session_id,oldSession);f.command('approve');
  assert.equal(f.state().status,'rolling');assert.ok(f.state().entries.every(entry=>entry.total===null));
  assert.throws(()=>f.tracker.command('test',old,'player'),e=>e.status===409);
  f.command('roll_npcs');f.command('roll','player','pc');f.command('roll','player','pc2');
  assert.equal(f.state().round,1);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM rolls').get().n,6);f.db.close();
});
