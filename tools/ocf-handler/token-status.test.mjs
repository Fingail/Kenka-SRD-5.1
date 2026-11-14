import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TokenStatusSync } from './token-status.mjs';
function fixture() {
  const tokens = [
    { token_id: 'dead', role: 'enemy', hp_current: 0 },
    { token_id: 'below', role: 'ally', hp_current: -2 },
    { token_id: 'live', role: 'enemy', hp_current: 1 },
    { token_id: 'pc', role: 'pc', hp_current: 0 },
    { token_id: 'object', role: 'object', hp_current: 0 },
    { token_id: 'unmapped', role: 'enemy', hp_current: 0 },
  ];
  const map = { tokens: tokens.filter(t => t.token_id !== 'unmapped').map(t => ({ id: t.token_id, rotation: 0, x: 120, y: 200, label: t.token_id })) };
  const patches = [], errors = [];
  const listEncounters = () => [{ id: 'encounter', status: 'ready', map: { id: 'map' }, tokens }];
  const client = { http: async (path, options) => {
    if (!options) return { json: async () => ({ data: map }) };
    const token = map.tokens.find(t => t.id === path.split('/').at(-1)); const props = JSON.parse(options.body);
    patches.push({ id: token.id, props }); Object.assign(token, props); return {};
  } };
  return { tokens, map, patches, errors, options: { listEncounters, client, markers: new Map(), recoveries: new Set(), onError: e => errors.push(e.message) } };
}
test('zero/below-zero PCs and NPCs rotate 90 degrees; living creatures, objects and positions are untouched', async () => {
  const f = fixture(); const sync = new TokenStatusSync(f.options); await sync.sync();
  assert.deepEqual(f.patches, [{ id: 'dead', props: { rotation: 90 } }, { id: 'below', props: { rotation: 90 } }, { id: 'pc', props: { rotation: 90 } }]);
  assert.ok(f.map.tokens.every(t => t.x === 120 && t.y === 200));
  await sync.sync(); assert.equal(f.patches.length, 3);
  await new TokenStatusSync(f.options).sync(); assert.equal(f.patches.length, 3); // persisted native orientation after handler reconstruction
});
test('native sync failures do not touch HP and are retried successfully', async () => {
  const f = fixture(); const native = f.options.client.http; let fail = true;
  f.options.client.http = (...args) => { if (fail) throw new Error('Unavailable'); return native(...args); };
  const sync = new TokenStatusSync(f.options); await sync.sync(); assert.equal(f.errors.length, 1); assert.equal(f.tokens[0].hp_current, 0);
  fail = false; await sync.sync(); assert.equal(f.patches.length, 3);
});
test('map reconciliation waits during preparation and never overlaps itself', async () => {
  const f = fixture(); let preparing = true; f.options.isPreparing = () => preparing;
  const sync = new TokenStatusSync(f.options); await sync.sync(); assert.equal(f.patches.length, 0);
  preparing = false; await Promise.all([sync.sync(), sync.sync()]); assert.equal(f.patches.length, 3);
});

test('healing restores the pre-death angle without moving the token or changing other markers', async () => {
  const f=fixture(); f.map.tokens.find(t=>t.id==='pc').rotation=25;
  await new TokenStatusSync(f.options).sync(); assert.equal(f.map.tokens.find(t=>t.id==='pc').rotation,90);
  f.tokens.find(t=>t.token_id==='pc').hp_current=5;
  await new TokenStatusSync(f.options).sync(); assert.equal(f.map.tokens.find(t=>t.id==='pc').rotation,25);
  assert.equal(f.map.tokens.find(t=>t.id==='dead').rotation,90);
  const count=f.patches.length; await new TokenStatusSync(f.options).sync(); assert.equal(f.patches.length,count);
});

test('healing repairs legacy near-sideways tokens without death markers and preserves other live angles', async()=>{
 const f=fixture();f.tokens.find(t=>t.token_id==='pc').hp_current=5;f.map.tokens.find(t=>t.id==='pc').rotation=89;f.map.tokens.find(t=>t.id==='live').rotation=25;
 const scheduled=new TokenStatusSync(f.options);scheduled.scheduleRecovery('map','pc');scheduled.scheduleRecovery('map','live');
 await new TokenStatusSync(f.options).sync();assert.equal(f.map.tokens.find(t=>t.id==='pc').rotation,0);assert.equal(f.map.tokens.find(t=>t.id==='live').rotation,25);assert.equal(f.options.recoveries.size,0);
});
