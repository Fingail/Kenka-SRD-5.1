import http from 'node:http';
import { readFileSync, mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { check, sameSecret, normalizeSheet, projectToken as baseProjectToken, allowed, resolveRoll } from './core.mjs';
import { DRClient } from './dr-client.mjs';
import { TokenStatusSync } from './token-status.mjs';
import { AdvancedEffects } from './advanced-effects.mjs';
import { combatHistory } from './combat-history.mjs';
import { Conditions, effectSaveRule } from './conditions.mjs';
import { Combat } from './combat.mjs';
import { Initiative, enrollNewParticipants } from './initiative.mjs';
import { movementPolicy, movementAllowed } from './movement-policy.mjs';
import { TurnApprovals } from './turn-approvals.mjs';
import { SheetImports } from './sheet-import.mjs';
import { parseMentions, expandParticipants, selectCombatDefinition, newTokenPosition } from './encounter-source.mjs';
import { lifeState, seedDemoInventory, encounterTargets } from './vitals.mjs';

const settings = JSON.parse(readFileSync(process.env.OCF_CONFIG || '/run/secrets/ocf-config.json', 'utf8'));
const drBase = process.env.DR_URL || 'http://dungeon-revealer:3000';
const dataDirectory = process.env.OCF_DATA || '/data';
mkdirSync(dataDirectory, { recursive: true });
const db = new DatabaseSync(dataDirectory + '/encounters.sqlite');
db.exec(`PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS encounters(id TEXT PRIMARY KEY, config TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS rolls(id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, encounter_id TEXT NOT NULL, visibility TEXT NOT NULL, result TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS source_reads(id INTEGER PRIMARY KEY, path TEXT NOT NULL, created_at TEXT NOT NULL);`);
const hash = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
function getEncounter(id) { const row = db.prepare('SELECT config FROM encounters WHERE id=?').get(id); return row ? JSON.parse(row.config) : null; }
function saveEncounter(config) { db.prepare('INSERT INTO encounters(id,config) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET config=excluded.config').run(config.id, JSON.stringify(config)); }
function projectToken(token,role) {
  const value=baseProjectToken(token,role);
  if(!value.restricted)value.active_effects=(token.active_effects||[]).map(effect=>({...effect,save_rule:effectSaveRule(effect)}));
  return value;
}
function roleFor(request) {
  const bearer = /^Bearer (.+)$/.exec(request.headers.authorization || '')?.[1];
  if (sameSecret(bearer, process.env.DM_PASSWORD)) return 'gm';
  if (sameSecret(bearer, process.env.PC_PASSWORD)) return 'player';
  throw Object.assign(new Error('Sign in to Dungeon Revealer first.'), { status: 401 });
}
async function kanka(path) {
  check(/^\/campaigns\/2\/(entities\/\d+(\/(attributes|entity_assets))?)$/.test(path), 'Source API path not allowed.', 403);
  const response = await fetch(settings.kanka_internal + '/api/1.0' + path, {
    headers: { Authorization: `Bearer ${settings.kanka_token}`, Accept: 'application/json' }, signal: AbortSignal.timeout(20000),
  });
  db.prepare('INSERT INTO source_reads(path,created_at) VALUES(?,?)').run(path, new Date().toISOString());
  check(response.ok, `Kanka source read failed (${response.status}).`, 502);
  const result = await response.json();
  check(!result.links?.next, 'Paginated source data needs explicit pagination support before this encounter can load.');
  return result.data;
}
async function media(url) {
  const parsed = new URL(url);
  const replacement = settings.asset_origins[parsed.origin];
  check(replacement, 'Source artwork origin is not allowed.', 403);
  const response = await fetch(replacement + parsed.pathname + parsed.search, {
    headers: parsed.origin === settings.kanka_public ? { Authorization: `Bearer ${settings.kanka_token}` } : {},
    redirect: 'error', signal: AbortSignal.timeout(30000),
  });
  check(response.ok, `Source artwork unavailable (${response.status}).`, 502);
  const mime = (response.headers.get('content-type') || '').split(';')[0];
  const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[mime];
  check(extension, 'Unsupported artwork type.');
  const bytes = Buffer.from(await response.arrayBuffer());
  check(bytes.length > 0 && bytes.length <= 16000000, 'Artwork exceeds demo limits.');
  return { bytes, mime, extension, hash: hash(bytes) };
}
function transparentPng(width, height) {
  check(Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0 && width * height <= 16000000, 'Unsupported map dimensions.');
  function crc32(data) {
    let crc = 0xffffffff;
    for (const byte of data) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
    return (crc ^ 0xffffffff) >>> 0;
  }
  function chunk(type, bytes) {
    const name = Buffer.from(type), length = Buffer.alloc(4), crc = Buffer.alloc(4);
    length.writeUInt32BE(bytes.length); crc.writeUInt32BE(crc32(Buffer.concat([name, bytes])));
    return Buffer.concat([length, name, bytes, crc]);
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(Buffer.alloc((width * 4 + 1) * height))), chunk('IEND', Buffer.alloc(0))]);
}
let preparing = false;
async function prepare(input) {
  check(!preparing, 'Another preparation is running; retry shortly.', 409);
  preparing = true;
  const client = new DRClient(drBase, process.env.DM_PASSWORD);
  try {
    const url = new URL(input.quest_url);
    check(url.origin === settings.kanka_public, 'Use the configured local Kanka installation.');
    const match = /^\/w\/2\/entities\/(\d+)\/?$/.exec(url.pathname);
    check(match, 'Use a local campaign 2 quest entity URL.');
    const quest = await kanka('/campaigns/2/entities/' + match[1]);
    check(quest.type === 'quest', 'The selected entity is not a quest.');
    const child = quest.child;
    const id = `kanka-2-quest-${quest.id}`, prior = getEncounter(id);
    let participants = [], mapId;
    for (const element of child.elements || []) {
      if (element.role === 'ocf:map') { check(!mapId, 'Choose one map.'); mapId = element.entity_id; }
      else if (['ocf:pc', 'ocf:ally', 'ocf:enemy'].includes(element.role)) participants.push({ entity_id: element.entity_id, role: element.role.slice(4) });
    }
    const warnings = [];
    if (!participants.length) {
      participants = parseMentions(child.entry || '');
      warnings.push('Pilot compatibility: direct quest mentions supply the roster; character/creature roles are inferred for this test.');
    }
    participants = expandParticipants(participants);
    if (!mapId) { mapId = Number(input.map_entity_id); warnings.push('Map selected explicitly because the quest has no map link.'); }
    check(Number.isSafeInteger(mapId) && mapId > 0, 'Provide a map entity ID.');
    const mapEntity = await kanka('/campaigns/2/entities/' + mapId);
    check(mapEntity.type === 'map', 'Selected map source is not a map.');
    const profiles = [], profileCache = new Map();
    for (const participant of participants) {
      if (profileCache.has(participant.entity_id)) {
        const cached = profileCache.get(participant.entity_id); profiles.push({ ...participant, ...cached, name: participant.instance_count > 1 ? `${cached.name} ${participant.instance_ordinal}` : cached.name }); continue;
      }
      const entity = await kanka('/campaigns/2/entities/' + participant.entity_id);
      check(['character', 'creature'].includes(entity.type), 'Invalid participant type.');
      const attributes = await kanka('/campaigns/2/entities/' + entity.id + '/attributes');
      const definition = selectCombatDefinition(entity, attributes, participant.role, prior?.sheet_overrides?.[entity.id]?.sheet);
      const profile = { ...normalizeSheet(definition.sheet, entity), sheet_origin: definition.origin };
      const assets = await kanka('/campaigns/2/entities/' + entity.id + '/entity_assets');
      const token = assets.find(x => x.name === 'token_4.png');
      const artwork = await media(token?._url || entity.child.image_full || entity.child.image_thumb);
      profileCache.set(entity.id, { ...profile, artwork });
      profiles.push({ ...participant, ...profile, name: participant.instance_count > 1 ? `${profile.name} ${participant.instance_ordinal}` : profile.name, artwork });
      if (profile.attacks.some(x => x.is_equipped === false && x.selected_for_basic_test)) warnings.push(`${entity.name}: basic-test attack selected; Kanka equipment flags are unchanged.`);
    }
    const mapArtwork = await media(mapEntity.child.image_full);
    const fingerprint = hash({ quest: quest.id, map: { id: mapId, image: mapArtwork.hash }, profiles: profiles.map(({ artwork, ...profile }) => ({ ...profile, image: artwork.hash })) });
    if (prior?.status === 'ready') check(prior.tokens.every(token => profiles.some(profile => profile.instance_key === (token.instance_key || `${token.entity_id}#1`))), 'Removing existing combatants requires a new encounter; additive refresh is supported.', 409);
    await client.connect();
    let map = prior?.map;
    if (!map) {
      const upload = (await client.gql(`mutation($i:MapImageRequestUploadInput!){mapImageRequestUpload(input:$i){id uploadUrl}}`, { i: { sha256: mapArtwork.hash, extension: mapArtwork.extension } })).mapImageRequestUpload;
      await client.upload(upload.uploadUrl, mapArtwork.bytes, mapArtwork.mime);
      const created = (await client.gql(`mutation($i:MapCreateInput!){mapCreate(input:$i){__typename ... on MapCreateSuccess{createdMap{id title}} ... on MapCreateError{reason}}}`, { i: { mapImageUploadId: upload.id, title: `OCF — ${quest.name}` } })).mapCreate;
      check(created.createdMap, 'DR map creation failed.', 502);
      map = created.createdMap;
    } else if (prior.map_hash !== mapArtwork.hash) {
      const form = new FormData(); form.append('file', new Blob([mapArtwork.bytes], { type: mapArtwork.mime }), 'map.' + mapArtwork.extension);
      await client.http(`/api/map/${map.id}/map`, { method: 'POST', body: form });
    }
    const currentMap = await (await client.http(`/api/map/${map.id}`)).json();
    const draft = { id, name: quest.name, quest_url: url.href, map, map_hash: mapArtwork.hash, tokens: prior?.tokens || [], objects: prior?.objects || [], initiative: prior?.initiative, sheet_overrides: prior?.sheet_overrides, feature_uses: prior?.feature_uses, state_revision: prior?.state_revision || 0, revision: prior?.revision || 1, fingerprint: prior?.fingerprint, status: 'preparing', warnings };
    saveEncounter(draft);
    const tokens = [];
    for (let index = 0; index < profiles.length; index++) {
      const { artwork, ...profile } = profiles[index];
      const previous = prior?.tokens.find(x => (x.instance_key || `${x.entity_id}#1`) === profile.instance_key);
      let tokenId = previous?.token_id;
      const imageId = await client.image(artwork, profile.name);
      if (!tokenId || !currentMap.data.tokens.some(x => x.id === tokenId)) {
        const existing = new Set(currentMap.data.tokens.map(x => x.id));
        await client.gql(`mutation($i:MapTokenAddManyInput!){mapTokenAddMany(input:$i)}`, { i: { mapId: map.id, tokens: [{ ...newTokenPosition(currentMap.data.tokens, mapEntity.child.width, mapEntity.child.height), color: profile.role === 'pc' ? '#2563eb' : '#dc2626', label: profile.name, radius: 44, isVisibleForPlayers: true, isMovableByPlayers: profile.role === 'pc', isLocked: false, tokenImageId: imageId }] } });
        const fresh = (await (await client.http(`/api/map/${map.id}`)).json()).data.tokens;
        const added = fresh.filter(x => !existing.has(x.id));
        check(added.length === 1, 'Concurrent token changes: reload preparation before continuing.', 409);
        tokenId = added[0].id; currentMap.data.tokens = fresh;
      } else {
        await client.gql(`mutation($i:MapTokenUpdateManyInput!){mapTokenUpdateMany(input:$i)}`, { i: { mapId: map.id, tokenIds: [tokenId], properties: { tokenImageId: imageId } } });
        await client.http(`/api/map/${map.id}/token/${tokenId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label: profile.name }) });
      }
      tokens.push(seedDemoInventory({ ...profile, token_id: tokenId, hp_current: previous?.hp_current ?? profile.stats.hp_max, hp_temporary: previous?.hp_temporary ?? 0, life_state: previous?.life_state, death_saves: previous?.death_saves, active_effects: previous?.active_effects, inventory: previous?.inventory, demo_potion_seeded: previous?.demo_potion_seeded }));
      saveEncounter({ ...draft, tokens: [...tokens, ...(prior?.tokens || []).filter(x => !tokens.some(t => t.instance_key === (x.instance_key || `${x.entity_id}#1`)))] });
    }
    if (!prior || prior.status !== 'ready') {
      const form = new FormData(); form.append('file', new Blob([transparentPng(mapEntity.child.width, mapEntity.child.height)], { type: 'image/png' }), 'fog.png');
      await client.http(`/api/map/${map.id}/send`, { method: 'POST', body: form });
    }
    const config = { id, status: 'ready', name: quest.name, quest_url: url.href, map, map_hash: mapArtwork.hash, tokens, objects: prior?.objects || [], initiative: prior?.initiative, sheet_overrides: prior?.sheet_overrides, feature_uses: prior?.feature_uses, fingerprint, state_revision: prior?.state_revision || 0,
      revision: prior ? prior.revision + (prior.fingerprint === fingerprint ? 0 : 1) : 1,
      prepared_at: new Date().toISOString(), warnings, demo_hp_policy: 'New test instances start at recorded maximum HP; refresh preserves current HP.' };
    const added = enrollNewParticipants(config); if (added) warnings.push(`${added} new combatants queued for initiative. Existing rolls, current turn and round are preserved; roll the new entries to resume.`);
    saveEncounter(config);
    return config;
  } finally { preparing = false; await client.close(); }
}
async function body(request) {
  let result = ''; for await (const chunk of request) { result += chunk; check(Buffer.byteLength(result) <= 32768, 'Request too large.', 413); }
  try { return JSON.parse(result || '{}'); } catch { throw Object.assign(new Error('Invalid JSON body.'), { status: 400 }); }
}
function tokenFor(id) {
  for (const row of db.prepare('SELECT config FROM encounters').all()) {
    const encounter = JSON.parse(row.config), token = encounter.tokens.find(x => x.token_id === id);
    if (token) return { encounter, token };
  }
  throw Object.assign(new Error('This token has no linked combat sheet. Load a prepared OCF encounter.'), { status: 404 });
}
// Idempotent migration of the existing demo; never refill spent inventory.
for (const row of db.prepare('SELECT config FROM encounters').all()) { const encounter = JSON.parse(row.config); encounter.tokens.forEach(seedDemoInventory); saveEncounter(encounter); }
const combat = new Combat({ db, getEncounter, saveEncounter, tokenFor, isPreparing: () => preparing });
combat.retirePending();
const initiative = new Initiative({ db, getEncounter, saveEncounter, tokenFor, isPreparing: () => preparing });
const sheetImports = new SheetImports({ db, tokenFor, saveEncounter, isPreparing: () => preparing });
const conditions=new Conditions({db,tokenFor,saveEncounter,isPreparing:()=>preparing});
const advancedEffects = new AdvancedEffects({ db, tokenFor, saveEncounter, isPreparing: () => preparing });
const tokenStatus = new TokenStatusSync({ db,
  listEncounters: () => db.prepare('SELECT config FROM encounters').all().map(row => JSON.parse(row.config)),
  client: new DRClient(drBase, process.env.DM_PASSWORD), isPreparing: () => preparing,
  onError: error => console.error('Zero-HP token rotation sync: ' + error.message),
});
function executeRoll(kind,tokenId,input,role) {
  if(kind==='attack')return combat.create(tokenId,input,role);
  if(kind==='condition_save')return conditions.rollSave(tokenId,input,role);
  if(kind==='effect')return advancedEffects.create(tokenId,input,role);
  if(kind==='healing'||kind==='death_save')return combat.utility(tokenId,input,role,kind);
  check(kind==='roll','Unknown roll operation.');
      const { encounter, token } = tokenFor(tokenId); check(allowed(token, role), 'Only the GM can roll for this token.', 403);
      check(Object.keys(input).every(x => ['request_id', 'kind', 'action_id', 'ability', 'skill_id', 'tool', 'mode', 'roll_id'].includes(x)), 'Unexpected roll fields.');
      check(typeof input.request_id === 'string' && /^[a-f0-9-]{36}$/.test(input.request_id), 'A UUID request ID is required.');
      const fingerprint = hash({ role, token: token.token_id, input });
      const prior = db.prepare('SELECT * FROM rolls WHERE id=?').get(input.request_id);
      if (prior) { check(prior.fingerprint === fingerprint, 'Request ID already used for a different roll.', 409); return JSON.parse(prior.result); }
      check(!preparing && encounter.status==='ready','Wait until encounter preparation finishes.',409);
      const result = { id: input.request_id, encounter_id: encounter.id, profile_revision: encounter.revision, token_id: token.token_id, name: token.name, actor: role === 'gm' ? 'GM' : 'Player (shared demo access)', visibility: token.role === 'pc' ? 'public' : 'gm', created_at: new Date().toISOString(), ...resolveRoll(token, input) };
      db.prepare('INSERT INTO rolls(id,fingerprint,encounter_id,visibility,result) VALUES(?,?,?,?,?)').run(result.id, fingerprint, encounter.id, result.visibility, JSON.stringify(result));
      return result;
}
const turnApprovals=new TurnApprovals({db,tokenFor,getEncounter,execute:executeRoll,hasExecuted:(kind,id)=>{
  const table=({roll:'rolls',attack:'attacks',effect:'advanced_effects',healing:'combat_utilities',death_save:'combat_utilities',condition_save:'condition_requests'})[kind];
  return Boolean(table&&db.prepare(`SELECT id FROM ${table} WHERE id=?`).get(id));
}});
const rotationTimer = setInterval(() => tokenStatus.sync(), 2000); rotationTimer.unref();
void tokenStatus.sync();
const server = http.createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  const send = (data, status = 200) => { response.writeHead(status, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(data)); };
  try {
    const path = new URL(request.url, 'http://handler').pathname;
    if (path === '/health') return send({ ok: true, engine: 'OCF 0.4.0 / SRD 5.1', source_access: 'GET-only' });
    if (path === '/ui' && request.method === 'GET') { response.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' }); return response.end(readFileSync(new URL('./ui.html', import.meta.url))); }
    check(!request.headers.origin || request.headers.origin === settings.dr_public, 'Unexpected browser origin.', 403);
    const role = roleFor(request);
    if (path === '/prepare' && request.method === 'POST') {
      check(role === 'gm', 'Only the GM can prepare/refresh encounters.', 403);
      return send(await prepare(await body(request)));
    }
    if (path === '/encounters' && request.method === 'GET') return send(db.prepare('SELECT config FROM encounters').all().map(row => {
      const encounter = JSON.parse(row.config);
      return { id: encounter.id, status: encounter.status, name: encounter.name, map: encounter.map, revision: encounter.revision, tokens: encounter.tokens.map(x => projectToken(x, role)), warnings: role === 'gm' ? encounter.warnings : [] };
    }));
    const launch = /^\/launch\/([a-z0-9-]+)$/.exec(path);
    if (launch && request.method === 'POST') {
      const encounter = getEncounter(launch[1]); check(encounter, 'Unknown encounter.', 404);
      check(encounter.status === 'ready' && !preparing, 'Encounter preparation is not complete.', 409);
      const client = new DRClient(drBase, process.env.DM_PASSWORD);
      if (role === 'gm') await client.http('/api/active-map', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mapId: encounter.map.id }) });
      else {
        const active = (await (await client.http('/api/active-map')).json()).data.activeMap;
        check(active?.id === encounter.map.id, 'The GM has not activated this encounter.', 409);
      }
      return send({ encounter_id: encounter.id, map_id: encounter.map.id, role });
    }
    if(path==='/movement-policy'&&request.method==='GET')return send(movementPolicy(db.prepare('SELECT config FROM encounters').all().map(row=>JSON.parse(row.config)),role));
    if(path==='/movement/check'&&request.method==='POST') {
      const input=await body(request);check(typeof input.map_id==='string'&&typeof input.token_id==='string','Map and token IDs are required.');
      const permitted=movementAllowed(db.prepare('SELECT config FROM encounters').all().map(row=>JSON.parse(row.config)),input.map_id,input.token_id,role);
      check(permitted,'This PC can move only on its active combat turn.',403);return send({allowed:true});
    }
    if(path==='/roll-approvals'&&request.method==='GET')return send(turnApprovals.list());
    const rollApproval=/^\/roll-approvals\/([a-f0-9-]+)(\/decision)?$/.exec(path);
    if(rollApproval&&request.method==='GET'&&!rollApproval[2])return send(turnApprovals.get(rollApproval[1]));
    if(rollApproval&&request.method==='POST'&&rollApproval[2]) {
      const input=await body(request);check(Object.keys(input).every(key=>key==='decision'),'Unexpected decision fields.');
      const result=turnApprovals.decide(rollApproval[1],input.decision,role);
      if(result.status==='approved'&&result.result?.target_state==='alive'&&result.result.target_token_id) {
        const revived=tokenFor(result.result.target_token_id);if(revived.token.hp_current>0)tokenStatus.scheduleRecovery(revived.encounter.map.id,revived.token.token_id);
      }
      void tokenStatus.sync();return send(result);
    }
    if (path === '/initiative' && request.method === 'GET') return send(db.prepare('SELECT config FROM encounters').all().map(row => initiative.project(JSON.parse(row.config))).filter(Boolean));
    const initiativeRequest = /^\/tokens\/([a-f0-9-]+)\/initiative\/request$/.exec(path);
    if (initiativeRequest && request.method === 'POST') return send(initiative.request(initiativeRequest[1], await body(request), role));
    const initiativeCommand = /^\/initiative\/([a-z0-9-]+)\/command$/.exec(path);
    if (initiativeCommand && request.method === 'POST') return send(initiative.command(initiativeCommand[1], await body(request), role));
    const sheetImport = /^\/tokens\/([a-f0-9-]+)\/sheet$/.exec(path);
    if (sheetImport && request.method === 'POST') return send(sheetImports.import(sheetImport[1], await body(request), role));
    const tokenMatch = /^\/tokens\/([a-f0-9-]+)$/.exec(path);
    if (tokenMatch && request.method === 'GET') { const { encounter, token } = tokenFor(tokenMatch[1]); return send({ encounter_id: encounter.id, revision: encounter.revision, ...projectToken(token, role), combat_turn: encounter.initiative ? { session_id:encounter.initiative.session_id,status: encounter.initiative.status, turn_number: encounter.initiative.turn_number, current_token_id: encounter.initiative.current_token_id } : null }); }
    const targets = /^\/tokens\/([a-f0-9-]+)\/targets$/.exec(path);
    if (targets && request.method === 'GET') {
      const { encounter, token } = tokenFor(targets[1]); check(allowed(token, role), 'Only the GM controls this token.', 403);
      const healing = new URL(request.url, 'http://handler').searchParams.get('healing') === '1';
      return send(encounterTargets(encounter, token.token_id, healing).map(item => ({ token_id: item.token_id, name: item.name, role: item.role })));
    }
    const conditionSaveRoute=/^\/tokens\/([a-f0-9-]+)\/condition-save$/.exec(path);
    if(conditionSaveRoute&&request.method==='POST')return send(turnApprovals.run('condition_save',conditionSaveRoute[1],await body(request),role));
    const conditionRoute=/^\/tokens\/([a-f0-9-]+)\/conditions$/.exec(path);
    if(conditionRoute&&request.method==='POST')return send(conditions.command(conditionRoute[1],await body(request),role));
    const utilityRoute = /^\/tokens\/([a-f0-9-]+)\/(death-save|healing|objects)$/.exec(path);
    if (utilityRoute && request.method === 'POST') { const input=await body(request); const result=utilityRoute[2] === 'objects' ? combat.addObject(utilityRoute[1],input,role) : turnApprovals.run(utilityRoute[2] === 'death-save' ? 'death_save' : 'healing',utilityRoute[1],input,role); if (result.target_state === 'alive' && result.target_token_id) { const revived = tokenFor(result.target_token_id); if (revived.token.hp_current > 0) tokenStatus.scheduleRecovery(revived.encounter.map.id, revived.token.token_id); } void tokenStatus.sync(); return send(result); }
    const effectRoute = /^\/tokens\/([a-f0-9-]+)\/effects$/.exec(path);
    if (effectRoute && request.method === 'POST') { const result = turnApprovals.run('effect',effectRoute[1],await body(request),role); void tokenStatus.sync(); return send(result); }
    const attackRoute = /^\/tokens\/([a-f0-9-]+)\/attacks$/.exec(path);
    if (attackRoute && request.method === 'POST') { const result = turnApprovals.run('attack',attackRoute[1],await body(request),role); void tokenStatus.sync(); return send(result); }
    if (path === '/attacks' && request.method === 'GET') return send(combat.list(role));
    const actionRoute = /^\/attacks\/([a-f0-9-]+)$/.exec(path);
    if (actionRoute && request.method === 'GET') return send(combat.get(actionRoute[1], role));
    const decisionRoute = /^\/attacks\/([a-f0-9-]+)\/decision$/.exec(path);
    if (decisionRoute && request.method === 'POST') return send(combat.decide(decisionRoute[1], await body(request), role));
    const rolls = /^\/tokens\/([a-f0-9-]+)\/rolls$/.exec(path);
    if (rolls && request.method === 'POST') return send(turnApprovals.run('roll',rolls[1],await body(request),role));
    if (path === '/history' && request.method === 'GET') return send(combatHistory(db,role,getEncounter));
    throw Object.assign(new Error('Not found.'), { status: 404 });
  } catch (error) { send({ error: error.status ? error.message : 'Encounter operation failed. Check source sheets and handler logs.' }, error.status || 500); if (!error.status) console.error(error.message); }
});
server.listen(Number(process.env.PORT || 8080), '0.0.0.0');
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => { clearInterval(rotationTimer); server.close(() => { db.close(); process.exit(0); }); });
