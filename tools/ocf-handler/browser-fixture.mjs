// Disposable synthetic browser-test combatants. Never mutate campaign HP for tests.
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
const db = new DatabaseSync((process.env.OCF_DATA || '/data') + '/encounters.sqlite');
if (process.argv[2] === 'create') {
  const base = JSON.parse(db.prepare('SELECT config FROM encounters WHERE id=?').get('kanka-2-quest-3536').config);
  const id = 'ui-check-' + randomUUID(), short = id.slice(-6);
  const stats = { ac: 10, hp_max: 100, proficiency_bonus: 2, initiative: 0, speed_ft: 30, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } };
  const attacker = { saving_throws: { str: 0, dex: 2, con: 0, int: 0, wis: 0, cha: 0 }, skills: [{ id: 'perception', name: 'Perception', ability: 'wis', bonus: 5 }], proficiencies: { tools: ['Practice tools'] }, features: [{ id: 'colossus', name: 'Colossus Slayer', description: 'Synthetic special attack for browser verification.', rule: 'colossus_slayer' }], inventory: [{ id: 'potion-healing', quantity: 1 }], entity_id: -1, token_id: randomUUID(), name: `Practice fighter ${short}`, role: 'pc', stats, modifiers: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, hp_current: 100, hp_temporary: 0, source_url: 'about:blank', attacks: [{ id: 'practice', name: 'Practice strike', attack_bonus: 100, damage: '1d2+3', damage_type: 'bludgeoning' }] };
  const target = { ...attacker, entity_id: -2, token_id: randomUUID(), name: `Practice target ${short}`, role: 'enemy', advanced_actions: [{ id: 'test-fire', name: 'Fire Breath', category: 'action', description: 'Synthetic area damage; resolve targets and saves manually.', save: { dc: 10, ability: 'dex', half_on_success: true }, area: { shape: 'cone', size_ft: 60 }, resolution: 'manual', rolls: [{ id: 'damage', label: 'fire damage', formula: '2d6', kind: 'damage', damage_type: 'fire' }, { id: 'recharge', label: 'Recharge', formula: '1d6', kind: 'recharge', threshold: 5 }] }], attacks: [{ id: 'practice-bite', name: 'Practice bite', attack_bonus: 100, damage: '1d2+3', damage_type: 'piercing' }] };
  target.advanced_actions.push({id:'test-weakening',name:'Weakening Breath',category:'action',description:'Synthetic failed-save condition test.',save:{dc:100,ability:'str',half_on_success:false},rolls:[]});
  const dying = { ...attacker, entity_id: -3, token_id: randomUUID(), name: `Dying PC ${short}`, hp_current: 0, inventory: [], life_state: 'dying', death_saves: { successes: 0, failures: 0 } };
  const fragile = { ...target, entity_id: -4, token_id: randomUUID(), name: `Fragile NPC ${short}`, hp_current: 1 };
  const spare = { ...target, entity_id: -5, token_id: randomUUID(), name: `NPC scout ${short}`, inventory: [], attacks: [] };
  db.prepare('INSERT INTO encounters(id,config) VALUES(?,?)').run(id, JSON.stringify({ id, status: 'ready', name: `Temporary combat UI check ${short}`, revision: 1, map: base.map, tokens: [attacker, target, dying, fragile, spare], warnings: [], test_fixture: true }));
  console.log(JSON.stringify({ encounter_id: id, attacker_id: attacker.token_id, attacker_name: attacker.name, target_id: target.token_id, target_name: target.name, dying_id: dying.token_id, dying_name: dying.name, fragile_id: fragile.token_id, fragile_name: fragile.name, spare_id: spare.token_id, spare_name: spare.name }));
} else if (process.argv[2] === 'cleanup') {
  const id = process.argv[3];
  if (!/^ui-check-[a-f0-9-]{36}$/.test(id)) throw new Error('Refusing to remove a non-test encounter.');
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare("DELETE FROM combat_decisions WHERE json_extract(result,'$.encounter_id')=?").run(id);
    db.prepare('DELETE FROM attacks WHERE encounter_id=?').run(id);
    db.prepare('DELETE FROM combat_utilities WHERE encounter_id=?').run(id);
    db.prepare('DELETE FROM rolls WHERE encounter_id=?').run(id);
    db.prepare('DELETE FROM initiative_requests WHERE encounter_id=?').run(id);
    db.prepare('DELETE FROM turn_approvals WHERE encounter_id=?').run(id);
    db.prepare('DELETE FROM condition_requests WHERE encounter_id=?').run(id);
    db.prepare('DELETE FROM sheet_imports WHERE encounter_id=?').run(id);
    db.prepare('DELETE FROM advanced_effects WHERE encounter_id=?').run(id);
    const owned = db.prepare('SELECT config FROM encounters WHERE id=?').get(id);
    if (owned) { const fixture = JSON.parse(owned.config); for (const token of fixture.tokens) { db.prepare('DELETE FROM token_rotation_recovery WHERE map_id=? AND token_id=?').run(fixture.map.id, token.token_id); db.prepare('DELETE FROM token_death_rotation WHERE map_id=? AND token_id=?').run(fixture.map.id, token.token_id); } }
    db.prepare('DELETE FROM encounters WHERE id=?').run(id);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
} else throw new Error('Use create or cleanup TEST_ID.');
db.close();
