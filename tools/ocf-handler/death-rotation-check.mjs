// Create hidden disposable native tokens; verify death rotation without attacking
// or moving any campaign combatant, then remove only our own records and tokens.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { DRClient } from './dr-client.mjs';
const db = new DatabaseSync((process.env.OCF_DATA || '/data') + '/encounters.sqlite');
const base = JSON.parse(db.prepare('SELECT config FROM encounters WHERE id=?').get('kanka-2-quest-3536').config);
const client = new DRClient(process.env.DR_URL || 'http://dungeon-revealer:3000', process.env.DM_PASSWORD);
const id = 'rotation-check-' + randomUUID(), labels = [id + '-npc', id + '-pc', id + '-area'];
let created = [];
const map = async () => (await (await client.http(`/api/map/${base.map.id}`)).json()).data;
async function attack(input, tokenId) {
  const response = await fetch(`http://127.0.0.1:8080/tokens/${tokenId}/attacks`, { method: 'POST', headers: { Authorization: 'Bearer ' + process.env.DM_PASSWORD, 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  assert.equal(response.ok, true, await response.clone().text()); return response.json();
}
try {
  const original = await map(); const artwork = original.tokens.find(t => t.tokenImageId)?.tokenImageId;
  assert.ok(artwork); await client.connect();
  await client.gql('mutation($i:MapTokenAddManyInput!){mapTokenAddMany(input:$i)}', { i: { mapId: base.map.id, tokens: labels.map((label, index) => ({ label, x: 100 + index * 70, y: 980, radius: 20, rotation: index === 0 ? 17 : 0, color: '#693ab7', tokenImageId: artwork, isVisibleForPlayers: false, isMovableByPlayers: false, isLocked: true })) } });
  created = (await map()).tokens.filter(t => labels.includes(t.label)); assert.equal(created.length, 3);
  const npc = created.find(t => t.label === labels[0]), pc = created.find(t => t.label === labels[1]), areaNpc = created.find(t => t.label === labels[2]);
  const attacker = { token_id: randomUUID(), name: 'Temporary rotation attacker', role: 'pc', hp_current: 100, stats: { ac: 20, hp_max: 100 }, inventory: [{ id: 'potion-healing', quantity: 1, unlimited: true }], advanced_actions: [{ id: 'area', name: 'Test burst', description: 'Synthetic targeted damage', rolls: [{ id: 'damage', kind: 'damage', formula: '1d2+3', damage_type: 'fire' }] }], attacks: [{ id: 'practice', name: 'Practice', attack_bonus: 100, damage: '1d2+3', damage_type: 'bludgeoning' }] };
  db.prepare('INSERT INTO encounters VALUES(?,?)').run(id, JSON.stringify({ id, name: id, revision: 1, status: 'ready', map: base.map, test_fixture: true, tokens: [attacker, { token_id: npc.id, name: labels[0], role: 'enemy', hp_current: 1, stats: { ac: 1, hp_max: 5 } }, { token_id: pc.id, name: labels[1], role: 'pc', hp_current: 0, stats: { ac: 10, hp_max: 10 } }, { token_id: areaNpc.id, name: labels[2], role: 'enemy', hp_current: 1, stats: { ac: 1, hp_max: 5 } }] }));
  let result, input;
  for (let n = 0; n < 12; n++) { input = { request_id: randomUUID(), action_id: 'practice', target_token_id: npc.id }; result = await attack(input, attacker.token_id); if (result.hit) break; }
  assert.equal(result.target_state, 'dead'); assert.equal(result.hp_change.hp_after, 0);
  let actual;
  for (let n = 0; n < 50; n++) { actual = await map(); if (actual.tokens.find(t => t.id === npc.id)?.rotation === 90) break; await new Promise(resolve => setTimeout(resolve, 100)); }
  const dead = actual.tokens.find(t => t.id === npc.id); assert.equal(dead.rotation, 90);
  assert.equal(dead.x, npc.x); assert.equal(dead.y, npc.y); assert.equal(dead.tokenImageId, npc.tokenImageId);
  assert.equal(actual.tokens.find(t => t.id === pc.id).rotation, 90);
  await attack(input, attacker.token_id); assert.equal((await map()).tokens.find(t => t.id === npc.id).rotation, 90);
  const current = JSON.parse(db.prepare('SELECT config FROM encounters WHERE id=?').get(id).config); assert.equal(current.tokens[1].hp_current, 0);
  const effectResponse = await fetch(`http://127.0.0.1:8080/tokens/${attacker.token_id}/effects`, { method: 'POST', headers: { Authorization: 'Bearer ' + process.env.DM_PASSWORD, 'Content-Type': 'application/json' }, body: JSON.stringify({ request_id: randomUUID(), action_id: 'area', targets: [{ token_id: areaNpc.id, mode: 'normal' }] }) });
  assert.equal(effectResponse.ok, true, await effectResponse.clone().text());
  for (let n=0;n<50;n++) { if ((await map()).tokens.find(t=>t.id===areaNpc.id).rotation===90) break; await new Promise(resolve=>setTimeout(resolve,100)); }
  assert.equal((await map()).tokens.find(t=>t.id===areaNpc.id).rotation,90);
  const healingResponse=await fetch(`http://127.0.0.1:8080/tokens/${attacker.token_id}/healing`, { method:'POST',headers:{Authorization:'Bearer '+process.env.DM_PASSWORD,'Content-Type':'application/json'},body:JSON.stringify({request_id:randomUUID(),item_id:'potion-healing',target_token_id:pc.id}) });
  assert.equal(healingResponse.ok,true,await healingResponse.clone().text());
  for(let n=0;n<50;n++){if((await map()).tokens.find(t=>t.id===pc.id).rotation===0)break;await new Promise(resolve=>setTimeout(resolve,100));}
  assert.equal((await map()).tokens.find(t=>t.id===pc.id).rotation,0);
  const npcHealing=await fetch(`http://127.0.0.1:8080/tokens/${attacker.token_id}/healing`, { method:'POST',headers:{Authorization:'Bearer '+process.env.DM_PASSWORD,'Content-Type':'application/json'},body:JSON.stringify({request_id:randomUUID(),item_id:'potion-healing',target_token_id:npc.id}) });
  assert.equal(npcHealing.ok,true,await npcHealing.clone().text());
  for(let n=0;n<50;n++){if((await map()).tokens.find(t=>t.id===npc.id).rotation===npc.rotation)break;await new Promise(resolve=>setTimeout(resolve,100));}
  assert.equal((await map()).tokens.find(t=>t.id===npc.id).rotation,npc.rotation);
  console.log('Native death rotation passed: lethal attack → NPC and PC at zero 90°, targeted area damage also rotates, healing revives zero-HP PCs/NPCs and restores upright; replay leaves 90°, positions/artwork unchanged.');
} finally {
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare("DELETE FROM combat_decisions WHERE json_extract(result,'$.encounter_id')=?").run(id);
    for (const table of ['attacks', 'rolls', 'advanced_effects', 'combat_utilities']) db.prepare(`DELETE FROM ${table} WHERE encounter_id=?`).run(id);
    for(const token of created) { db.prepare('DELETE FROM token_death_rotation WHERE map_id=? AND token_id=?').run(base.map.id,token.id); db.prepare('DELETE FROM token_rotation_recovery WHERE map_id=? AND token_id=?').run(base.map.id,token.id); }
    db.prepare('DELETE FROM encounters WHERE id=?').run(id); db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  try {
    // Re-read by unique labels as well, so cleanup covers a failed create response.
    const owned = (await map()).tokens.filter(t => labels.includes(t.label)).map(t => t.id);
    if (owned.length) await client.gql('mutation($i:MapTokenRemoveManyInput!){mapTokenRemoveMany(input:$i)}', { i: { mapId: base.map.id, tokenIds: owned } });
  } finally { await client.close(); db.close(); }
}
