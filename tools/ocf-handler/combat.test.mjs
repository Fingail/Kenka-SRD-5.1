import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lifeState, damageState, deathSave, heal, seedDemoInventory, healthBand, encounterTargets } from './vitals.mjs';
import { Combat, resolveAttack, applyDamage } from './combat.mjs';

const fighter = () => ({ token_id: 'fighter', name: 'Test fighter', role: 'pc', stats: { ac: 17, hp_max: 20 }, hp_current: 20, hp_temporary: 0, attacks: [{ id: 'sword', name: 'Sword', attack_bonus: 5, damage: '1d8+3', damage_type: 'slashing' }] });
const target = () => ({ token_id: 'target', name: 'Test target', role: 'enemy', stats: { ac: 17, hp_max: 30 }, hp_current: 30, hp_temporary: 3 });
function sequence(...values) { return (min, max) => { const value = values.shift(); assert.ok(value >= min && value < max); return value; }; }
function fixture(random = sequence(12, 4)) {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE encounters(id TEXT PRIMARY KEY,config TEXT); CREATE TABLE rolls(id TEXT PRIMARY KEY,fingerprint TEXT,encounter_id TEXT,visibility TEXT,result TEXT);');
  const getEncounter = id => { const row = db.prepare('SELECT config FROM encounters WHERE id=?').get(id); return row && JSON.parse(row.config); };
  const saveEncounter = encounter => db.prepare('INSERT OR REPLACE INTO encounters VALUES(?,?)').run(encounter.id, JSON.stringify(encounter));
  saveEncounter({ id: 'test', status: 'ready', revision: 1, tokens: [fighter(), target()] });
  const tokenFor = id => { const encounter = getEncounter('test'); return { encounter, token: encounter.tokens.find(token => token.token_id === id) }; };
  return { db, getEncounter, saveEncounter, combat: new Combat({ db, getEncounter, saveEncounter, tokenFor, random }) };
}
test('attacks meet AC, natural 1 always misses, natural 20 doubles dice but not modifiers', () => {
  const hit = resolveAttack(fighter(), target(), 'sword', sequence(12, 4)); assert.equal(hit.hit, true); assert.equal(hit.damage.total, 7);
  const powerful = fighter(); powerful.attacks[0].attack_bonus = 100;
  const miss = resolveAttack(powerful, target(), 'sword', sequence(1)); assert.equal(miss.hit, false); assert.equal(miss.damage, null);
  const critical = resolveAttack(fighter(), target(), 'sword', sequence(20, 4, 6));
  assert.equal(critical.critical, true); assert.equal(critical.damage.formula, '2d8+3'); assert.equal(critical.damage.total, 13);
});
test('damage absorbs temporary HP first and never creates negative HP', () => {
  assert.deepEqual(applyDamage(target(), 7), { hp_before: 30, hp_after: 26, temp_before: 3, temp_after: 0, damage_rolled: 7, absorbed_by_temp: 3 });
  assert.equal(applyDamage(target(), 100).hp_after, 0);
});
test('PC attacks apply immediately, return no target HP to players and replay without duplicate damage', () => {
  const { combat, getEncounter, db } = fixture();
  const input = { request_id: randomUUID(), action_id: 'sword', target_token_id: 'target' };
  const created = combat.create('fighter', input, 'player');
  assert.equal(created.status, 'applied'); assert.equal(created.automatic, true);
  assert.equal(created.target_ac, undefined); assert.equal(created.hp_change, undefined);
  assert.equal(getEncounter('test').tokens[1].hp_current, 26);
  assert.deepEqual(combat.create('fighter', input, 'player'), created);
  assert.equal(getEncounter('test').tokens[1].hp_current, 26);
  assert.equal(combat.get(created.id, 'gm').hp_change.hp_after, 26); db.close();
});
test('a miss needs no approval and changes no HP', () => {
  const { combat, getEncounter, db } = fixture(sequence(1));
  const action = combat.create('fighter', { request_id: randomUUID(), action_id: 'sword', target_token_id: 'target' }, 'player');
  assert.equal(action.status, 'missed'); assert.equal(getEncounter('test').tokens[1].hp_current, 30); db.close();
});
test('invalid targets and forged attack fields fail before rolling', () => {
  const { combat, db } = fixture(() => { throw new Error('Should not roll'); });
  assert.throws(() => combat.create('fighter', { request_id: randomUUID(), action_id: 'sword', target_token_id: 'outside' }, 'player'), error => error.status === 400);
  assert.throws(() => combat.create('fighter', { request_id: randomUUID(), action_id: 'sword', target_token_id: 'target', damage: 999 }, 'player'), error => error.status === 400);
  assert.throws(() => combat.create('target', { request_id: randomUUID(), action_id: 'bite', target_token_id: 'fighter' }, 'player'), error => error.status === 403);
  db.close();
});
test('a failed automatic PC attack log rolls back damage and attack state together', () => {
  const { combat, getEncounter, db } = fixture();
  const input = { request_id: randomUUID(), action_id: 'sword', target_token_id: 'target' };
  db.prepare('INSERT INTO rolls VALUES(?,?,?,?,?)').run(input.request_id + ':decision', 'forced-failure', 'test', 'public', '{}');
  assert.throws(() => combat.create('fighter', input, 'player'));
  assert.equal(getEncounter('test').tokens[1].hp_current, 30);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM attacks').get().n, 0); db.close();
});
test('automatic attack state survives reopening without applying HP twice', () => {
  const directory = mkdtempSync(join(tmpdir(), 'ocf-combat-'));
  let connection;
  try {
    const first = fixture();
    const action = first.combat.create('fighter', { request_id: randomUUID(), action_id: 'sword', target_token_id: 'target' }, 'player');
    // Copy the complete persisted state into a fresh on-disk database, then reopen
    // it twice to test the same recovery boundary used by handler restarts.
    connection = new DatabaseSync(join(directory, 'combat.sqlite'));
    connection.exec('CREATE TABLE encounters(id TEXT PRIMARY KEY,config TEXT); CREATE TABLE rolls(id TEXT PRIMARY KEY,fingerprint TEXT,encounter_id TEXT,visibility TEXT,result TEXT);');
    const connectCombat = () => {
      const getEncounter = id => JSON.parse(connection.prepare('SELECT config FROM encounters WHERE id=?').get(id).config);
      const saveEncounter = encounter => connection.prepare('UPDATE encounters SET config=? WHERE id=?').run(JSON.stringify(encounter), encounter.id);
      return { getEncounter, combat: new Combat({ db: connection, getEncounter, saveEncounter, tokenFor: () => { throw Error('Replaying should not roll again'); } }) };
    };
    connectCombat();
    for (const table of ['encounters', 'rolls', 'attacks']) {
      const columns = first.db.prepare(`PRAGMA table_info(${table})`).all().map(column => column.name);
      const insert = connection.prepare(`INSERT INTO ${table}(${columns.join(',')}) VALUES(${columns.map(() => '?').join(',')})`);
      for (const row of first.db.prepare(`SELECT * FROM ${table}`).all()) insert.run(...columns.map(key => row[key]));
    }
    first.db.close(); connection.close();
    connection = new DatabaseSync(join(directory, 'combat.sqlite'));
    let resumed = connectCombat();
    assert.equal(resumed.combat.get(action.id, 'player').status, 'applied');
    assert.equal(resumed.getEncounter('test').tokens[1].hp_current, 26);
    const decision = { request_id: randomUUID(), approve: true };
    const approved = resumed.combat.decide(action.id, decision, 'gm');
    connection.close(); connection = new DatabaseSync(join(directory, 'combat.sqlite')); resumed = connectCombat();
    assert.deepEqual(resumed.combat.decide(action.id, decision, 'gm'), approved);
    assert.equal(resumed.getEncounter('test').tokens[1].hp_current, 26);
  } finally { connection?.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('lethal NPC damage immediately publishes death without an approval step', () => {
  const { combat, getEncounter, saveEncounter, db } = fixture(sequence(12, 4));
  const e = getEncounter('test'); e.tokens[1].hp_current = 1; e.tokens[1].hp_temporary = 0; saveEncounter(e);
  const attack = combat.create('fighter', { request_id: randomUUID(), action_id: 'sword', target_token_id: 'target' }, 'player');
  assert.equal(attack.status, 'applied'); assert.equal(attack.target_state, 'dead'); assert.match(attack.outcome_notice, /dead/);
  assert.equal(lifeState(getEncounter('test').tokens[1]), 'dead'); db.close();
});
test('legacy pending attacks are cancelled without applying old damage', () => {
  const { combat, getEncounter, db } = fixture();
  const id = randomUUID(); db.prepare('INSERT INTO attacks VALUES(?,?,?,?,?,?,?)').run(id, 'legacy', 'test', 'fighter', 'public', 'awaiting_approval', JSON.stringify({ id, status: 'awaiting_approval' }));
  combat.retirePending(); assert.equal(combat.raw(id).status, 'cancelled'); assert.equal(getEncounter('test').tokens[1].hp_current, 30); db.close();
});
test('2014 PC zero HP, massive damage, damage while dying, stable reset and critical failures', () => {
  const pc = fighter(); pc.hp_current = 0; damageState(pc, { hp_before: 20, damage_rolled: 20, absorbed_by_temp: 0 });
  assert.equal(pc.life_state, 'dying'); assert.deepEqual(pc.death_saves, { successes: 0, failures: 0 });
  damageState(pc, { hp_before: 0, damage_rolled: 1, absorbed_by_temp: 0 }, true); assert.equal(pc.death_saves.failures, 2);
  damageState(pc, { hp_before: 0, damage_rolled: 1, absorbed_by_temp: 0 }); assert.equal(pc.life_state, 'dead');
  const massive = fighter(); massive.hp_current = 0; damageState(massive, { hp_before: 20, damage_rolled: 40, absorbed_by_temp: 0 }); assert.equal(massive.life_state, 'dead');
  const stable = fighter(); stable.hp_current = 0; stable.life_state = 'stable'; stable.death_saves = { successes: 0, failures: 0 };
  damageState(stable, { hp_before: 0, damage_rolled: 1, absorbed_by_temp: 0 }); assert.equal(stable.life_state, 'dying'); assert.equal(stable.death_saves.failures, 1);
});
test('death saves: 1 two failures, 10 success, three successes stable, 20 restores HP, three failures death', () => {
  const pc = fighter(); pc.hp_current = 0;
  deathSave(pc, 1); assert.equal(pc.death_saves.failures, 2);
  deathSave(pc, 10); deathSave(pc, 19); deathSave(pc, 10);
  assert.equal(pc.life_state, 'stable'); assert.deepEqual(pc.death_saves, { successes: 0, failures: 0 });
  assert.throws(() => deathSave(pc, 20), /dying/);
  pc.life_state = 'dying'; deathSave(pc, 20); assert.equal(pc.hp_current, 1); assert.equal(pc.life_state, 'alive');
  pc.hp_current = 0; pc.life_state = 'dying'; deathSave(pc, 1); deathSave(pc, 9); assert.equal(pc.life_state, 'dead');
});
test('manual death save is permission checked, persistent, replay safe and requires zero HP', () => {
  const { combat, getEncounter, saveEncounter, db } = fixture(sequence(10));
  assert.throws(() => combat.utility('fighter', { request_id: randomUUID() }, 'player', 'death_save'), /dying/);
  const e = getEncounter('test'); e.tokens[0].hp_current = 0; saveEncounter(e);
  const request = { request_id: randomUUID() };
  const result = combat.utility('fighter', request, 'player', 'death_save'); assert.equal(result.death_saves.successes, 1);
  assert.deepEqual(combat.utility('fighter', request, 'player', 'death_save'), result);
  assert.equal(getEncounter('test').tokens[0].death_saves.successes, 1);
  assert.throws(() => combat.utility('target', { request_id: randomUUID() }, 'player', 'death_save'), e => e.status === 403); db.close();
});
test('finite potion heals, resets death saves and consumes once; standard heal requires explicit demo revival', () => {
  const { combat, getEncounter, saveEncounter, db } = fixture(sequence(4, 4));
  const e = getEncounter('test'); e.tokens[0].entity_id = -1; e.tokens[0].inventory = [{ id: 'potion-healing', quantity: 1 }];
  e.tokens[1].role = 'pc'; e.tokens[1].hp_current = 0; e.tokens[1].death_saves = { successes: 1, failures: 2 }; saveEncounter(e);
  const request = { request_id: randomUUID(), item_id: 'potion-healing', target_token_id: 'target' };
  const result = combat.utility('fighter', request, 'player', 'healing'); assert.equal(result.total, 10); assert.equal(result.hp_change.hp_after, 10);
  assert.deepEqual(combat.utility('fighter', request, 'player', 'healing'), result);
  const updated = getEncounter('test'); assert.deepEqual(updated.tokens[1].death_saves, { successes: 0, failures: 0 }); assert.equal(updated.tokens[1].life_state, 'alive');
  seedDemoInventory(updated.tokens[0]); assert.equal(updated.tokens[0].inventory[0].quantity, 0);
  assert.throws(() => combat.utility('fighter', { ...request, request_id: randomUUID() }, 'player', 'healing'), /No healing potions/);
  const pc = fighter(); assert.equal(heal(pc, 10).hp_after, 20); pc.life_state = 'dead'; assert.throws(() => heal(pc, 10), /revive/); db.close();
});
test('object targets need GM stats and are destroyed immediately on a lethal hit', () => {
  const { combat, getEncounter, db } = fixture(sequence(12, 4));
  const input = { request_id: randomUUID(), name: 'Wooden door', ac: 10, hp: 5 };
  assert.throws(() => combat.addObject('fighter', input, 'player'), e => e.status === 403);
  const object = combat.addObject('fighter', input, 'gm'); assert.deepEqual(combat.addObject('fighter', input, 'gm'), object);
  const attack = combat.create('fighter', { request_id: randomUUID(), action_id: 'sword', target_token_id: object.token_id }, 'player');
  assert.equal(getEncounter('test').objects[0].hp_current, 0);
  const result = combat.decide(attack.id, { request_id: randomUUID(), approve: true }, 'gm');
  assert.equal(result.target_state, 'destroyed'); assert.equal(getEncounter('test').objects[0].hp_current, 0); db.close();
});

test('HP colors change at exactly 50% and 25%, without exposing HP totals', () => {
  const token = { stats: { hp_max: 100 }, hp_current: 51 };
  assert.equal(healthBand(token).band, 'green');
  token.hp_current = 50; assert.equal(healthBand(token).band, 'yellow');
  token.hp_current = 26; assert.equal(healthBand(token).band, 'yellow');
  token.hp_current = 25; assert.equal(healthBand(token).band, 'red');
  token.hp_current = 0; assert.equal(healthBand(token).band, 'red');
  assert.deepEqual(Object.keys(healthBand(token)), ['band', 'label']);
});
test('GM-controlled NPC attack applies immediately, replays once and cannot be launched by players', () => {
  const { combat, getEncounter, saveEncounter, db } = fixture(sequence(12, 8));
  const e = getEncounter('test'); e.tokens[1].attacks = [{ id: 'bite', name: 'Bite', attack_bonus: 100, damage: '1d8+3', damage_type: 'piercing' }]; saveEncounter(e);
  const input = { request_id: randomUUID(), action_id: 'bite', target_token_id: 'fighter' };
  assert.throws(() => combat.create('target', input, 'player'), error => error.status === 403);
  const result = combat.create('target', input, 'gm');
  assert.equal(result.status, 'applied'); assert.equal(result.automatic, true); assert.equal(result.hp_change.hp_after, 9);
  assert.equal(result.damage_health.band, 'yellow'); assert.equal(result.current_target_health.band, 'yellow');
  assert.deepEqual(combat.create('target', input, 'gm'), result);
  assert.equal(getEncounter('test').tokens[0].hp_current, 9);
  assert.equal(combat.list('gm').filter(a => a.status === 'awaiting_approval').length, 0);
  assert.throws(() => combat.get(result.id, 'player'), error => error.status === 403); db.close();
});
test('an NPC auto-hit rolls back HP and attack together when event logging fails', () => {
  const { combat, getEncounter, saveEncounter, db } = fixture(sequence(12, 8));
  const e = getEncounter('test'); e.tokens[1].attacks = [{ id: 'bite', name: 'Bite', attack_bonus: 100, damage: '1d8+3', damage_type: 'piercing' }]; saveEncounter(e);
  const input = { request_id: randomUUID(), action_id: 'bite', target_token_id: 'fighter' };
  db.prepare('INSERT INTO rolls VALUES(?,?,?,?,?)').run(input.request_id + ':decision', 'failure', 'test', 'gm', '{}');
  assert.throws(() => combat.create('target', input, 'gm'));
  assert.equal(getEncounter('test').tokens[0].hp_current, 20);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM attacks').get().n, 0); db.close();
});

test('GM sees exact current target HP; players receive only health bands for NPC and PC targets', () => {
  const { combat, getEncounter, saveEncounter, db } = fixture(sequence(12, 4));
  const attack = combat.create('fighter', { request_id: randomUUID(), action_id: 'sword', target_token_id: 'target' }, 'player');
  assert.equal(attack.target_hp, undefined); assert.equal(attack.current_target_health.label, 'Good');
  assert.deepEqual(combat.get(attack.id, 'gm').target_hp, { current: 26, maximum: 30 });
  combat.decide(attack.id, { request_id: randomUUID(), approve: true }, 'gm');
  assert.deepEqual(combat.get(attack.id, 'gm').target_hp, { current: 26, maximum: 30 });
  assert.equal(combat.get(attack.id, 'player').hp_change, undefined);
  const encounter = getEncounter('test'); encounter.tokens[1].role = 'pc'; saveEncounter(encounter);
  const raw = combat.raw(attack.id); raw.target_role = 'pc';
  assert.equal(combat.project(raw, 'player').hp_change, undefined);
  assert.equal(combat.project(raw, 'player').target_hp, undefined); db.close();
});

test('Lux demo potion supply stays unlimited across uses, retries and seeding', () => {
  const { combat, getEncounter, saveEncounter, db } = fixture(sequence(4, 4, 2, 2));
  const e = getEncounter('test'); e.tokens[0].entity_id = 3463; seedDemoInventory(e.tokens[0]); saveEncounter(e);
  const request = { request_id: randomUUID(), item_id: 'potion-healing', target_token_id: 'fighter' };
  const first = combat.utility('fighter', request, 'player', 'healing'); assert.equal(first.unlimited, true); assert.equal(first.remaining, null);
  assert.deepEqual(combat.utility('fighter', request, 'player', 'healing'), first);
  const second = combat.utility('fighter', { ...request, request_id: randomUUID() }, 'player', 'healing'); assert.equal(second.unlimited, true);
  const token = getEncounter('test').tokens[0]; seedDemoInventory(token);
  assert.equal(token.inventory.length, 1); assert.equal(token.inventory[0].unlimited, true); assert.equal(token.inventory[0].quantity, 1); db.close();
});

test('Colossus Slayer is optional, requires an already wounded creature, consumes once per turn and doubles critical dice', () => {
  const f = fixture(sequence(12, 4, 5, 20, 4, 4, 3, 3));
  const e = f.getEncounter('test'); e.tokens[0].features = [{ id: 'colossus', rule: 'colossus_slayer', name: 'Colossus Slayer' }];
  e.initiative = { session_id: 'session', status: 'active', turn_number: 1 }; f.saveEncounter(e);
  const request = { request_id: randomUUID(), action_id: 'sword', target_token_id: 'target', bonus_ids: ['colossus'] };
  assert.throws(() => f.combat.create('fighter', request, 'player'), /already below/);
  e.tokens[1].hp_current = 29; e.tokens[1].hp_temporary = 0; f.saveEncounter(e);
  const first = f.combat.create('fighter', request, 'player'); assert.equal(first.damage.total, 12); assert.equal(first.damage.components[0].dice.length, 1);
  assert.deepEqual(f.combat.create('fighter', request, 'player'), first);
  assert.throws(() => f.combat.create('fighter', { ...request, request_id: randomUUID() }, 'player'), /already been used/);
  const next = f.getEncounter('test'); next.initiative.turn_number = 2; f.saveEncounter(next);
  const critical = f.combat.create('fighter', { ...request, request_id: randomUUID() }, 'player'); assert.equal(critical.critical, true); assert.equal(critical.damage.components[1].dice.length, 2); f.db.close();
});

test('demo healing targets all creatures including zero-HP NPCs and PCs, with no object targets', () => {
  const f=fixture(sequence(4,4,2,2));const e=f.getEncounter('test');e.tokens[0].inventory=[{id:'potion-healing',quantity:2}];
  e.tokens[1].hp_current=0;e.tokens[1].life_state='dead';e.tokens.push({token_id:'pc-dead',name:'Fallen PC',role:'pc',hp_current:0,life_state:'dead',stats:{hp_max:20},death_saves:{successes:0,failures:3}});e.objects=[{token_id:'door',role:'object',hp_current:0}];f.saveEncounter(e);
  assert.deepEqual(encounterTargets(e,'fighter',true).map(t=>t.token_id),['fighter','target','pc-dead']);
  assert.ok(!encounterTargets(e,'fighter',false).some(t=>t.token_id==='target'));
  const revived=f.combat.utility('fighter',{request_id:randomUUID(),item_id:'potion-healing',target_token_id:'target'},'player','healing');
  assert.equal(revived.target_state,'alive');assert.equal(f.getEncounter('test').tokens[1].hp_current,10);
  f.combat.utility('fighter',{request_id:randomUUID(),item_id:'potion-healing',target_token_id:'pc-dead'},'player','healing');
  const pc=f.getEncounter('test').tokens.find(t=>t.token_id==='pc-dead');assert.equal(pc.hp_current,6);assert.equal(pc.life_state,'alive');assert.equal(pc.death_saves.failures,0);f.db.close();
});
test('GM can administer a demo potion to its zero-HP owner; players cannot self-administer while unconscious', () => {
  const f=fixture(sequence(4,4));const e=f.getEncounter('test');e.tokens[0].hp_current=0;e.tokens[0].life_state='dead';e.tokens[0].inventory=[{id:'potion-healing',quantity:0,unlimited:true}];f.saveEncounter(e);
  const input={request_id:randomUUID(),item_id:'potion-healing',target_token_id:'fighter'};
  assert.throws(()=>f.combat.utility('fighter',input,'player','healing'),/unconscious/);
  const r=f.combat.utility('fighter',input,'gm','healing');assert.equal(r.hp_change.hp_after,10);assert.equal(r.target_state,'alive');f.db.close();
});
