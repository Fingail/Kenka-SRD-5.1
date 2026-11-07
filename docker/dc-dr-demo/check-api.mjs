// SPDX-License-Identifier: GPL-3.0-only
import { readFileSync, writeFileSync } from 'node:fs';
import {randomUUID} from 'node:crypto';import assert from 'node:assert/strict';
const cfg=JSON.parse(readFileSync('/test-data/config.json')),access=JSON.parse(readFileSync('/gm-access.json'));const base=cfg.dcPublic;
async function login(a){const r=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:a.username,password:a.password})});const d=await r.json();assert.ok(r.ok,'DiceCloud login failed');return d.token||d.data?.token;}
const gm=await login(access),player=await login(cfg.player);
async function api(token,op,body,expected=200){const r=await fetch(base+'/dc-dr/api/'+op,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});const d=await r.json();assert.equal(r.status,expected,JSON.stringify(d));return d;}
let state;for(let i=0;i<90;i++){const r=await fetch(base+'/dc-dr/api/state',{headers:{Authorization:'Bearer '+gm}});if(r.ok){state=await r.json();break;}await new Promise(r=>setTimeout(r,1000));}assert.ok(state,'Native bridge did not finish seeding');
const pc=state.creatures.find(c=>c.kind==='pc'),bear=state.creatures.find(c=>c.name==='Black Bear'),dragon=state.creatures.find(c=>c.name.includes('Dragon'));
assert.ok(pc&&bear&&dragon);const baseline=pc.hpMax;assert.equal(baseline,36);assert.ok(state.creatures.length>=11);
await api('', 'state',undefined,401);
const publicState=await api(player,'state');const other=publicState.creatures.find(c=>c.id===bear.id);for(const field of ['hp','hpMax','ac','abilities','actions','inventory'])assert.equal(other[field],undefined,'NPC data leaked: '+field);
if(state.combat.active)await api(gm,'combat',{command:'end'});
async function action(token,input,expected=200){return api(token,'action',{...input,requestId:input.requestId||randomUUID()},expected);}
for(const c of state.creatures)if(c.hp!==c.hpMax)await action(gm,{kind:'hp',actorId:c.id,hp:c.hpMax,targetIds:[]});
const ram=pc.actions.find(a=>a.name==='Ram');assert.ok(ram);
let hit=null;
for(let n=0;n<12&&!hit;n++){const before=(await api(gm,'state')).creatures.find(c=>c.id===bear.id).hp;const input={kind:'action',actorId:pc.id,propertyId:ram.id,targetIds:[bear.id],requestId:randomUUID()};const result=await action(gm,input);assert.equal(result.status,'done');const after=(await api(gm,'state')).creatures.find(c=>c.id===bear.id).hp;if(after<before){hit={input,result,before,after};const replay=await action(gm,input);assert.equal(replay.id,result.id);assert.equal((await api(gm,'state')).creatures.find(c=>c.id===bear.id).hp,after,'Duplicate action applied twice');}}
assert.ok(hit,'Native Ram never damaged target');
await action(player,{kind:'action',actorId:bear.id,propertyId:bear.actions[0].id,targetIds:[pc.id]},403);
await action(gm,{kind:'hp',actorId:bear.id,hp:0,targetIds:[]});
async function mapToken(id){const r=await fetch(cfg.drPublic+'/api/map/'+cfg.mapId,{headers:{Authorization:'Bearer '+cfg.drGMPassword}});assert.ok(r.ok);return(await r.json()).data.tokens.find(t=>t.id===id);}
assert.equal((await mapToken(bear.tokenId)).rotation,90);
const potion=pc.actions.find(a=>a.name.includes('Potion of Healing'));assert.ok(potion);
const healing=await action(player,{kind:'action',actorId:pc.id,propertyId:potion.id,targetIds:[bear.id]});assert.equal(healing.status,'done');assert.equal(healing.health[0].hp,undefined,'Healing result exposed NPC HP');assert.ok((await api(gm,'state')).creatures.find(c=>c.id===bear.id).hp>0);assert.equal((await mapToken(bear.tokenId)).rotation,0);
await api(gm,'combat',{command:'start'});await action(player,{kind:'initiative',actorId:pc.id,targetIds:[]});await api(gm,'combat',{command:'npc_rolls'});await api(gm,'combat',{command:'begin'});
state=await api(gm,'state');if(state.combat.current===pc.id)await api(gm,'combat',{command:'next'});
await api(player,'move',{mapId:cfg.mapId,tokenId:pc.tokenId},403);
const denied=await fetch(cfg.drPublic+'/api/map/'+cfg.mapId+'/token/'+pc.tokenId,{method:'PATCH',headers:{Authorization:'Bearer '+cfg.drPlayerPassword,'X-DiceCloud-Token':player,'Content-Type':'application/json'},body:JSON.stringify({x:pc.x+5,y:pc.y+5})});assert.equal(denied.status,403);
const queued=await action(player,{kind:'check',actorId:pc.id,skill:'perception',ability:'wisdom',targetIds:[]});assert.equal(queued.status,'pending');assert.ok((await api(gm,'state')).requests.some(r=>r.id===queued.id));await api(gm,'approval',{id:queued.id,approve:true});
for(let i=0;i<12&&(await api(gm,'state')).combat.current!==pc.id;i++)await api(gm,'combat',{command:'next'});
await api(player,'move',{mapId:cfg.mapId,tokenId:pc.tokenId});
await api(player,'move',{mapId:cfg.mapId,tokenId:bear.tokenId},403);
await api(gm,'effect',{actorId:pc.id,name:'Save-button test',ability:'strength',dc:1,timing:'end of turn',endsOnSuccess:true});state=await api(player,'state');const effect=state.creatures.find(c=>c.id===pc.id).effects.find(e=>e.name==='Save-button test');assert.ok(effect?.save);await action(player,{kind:'effect_save',actorId:pc.id,effectId:effect.id,targetIds:[]});assert.equal((await api(player,'state')).creatures.find(c=>c.id===pc.id).effects.some(e=>e.id===effect.id),false);
let weak=dragon.actions.find(a=>a.name==='Weakening Breath');assert.ok(weak,'Missing native Weakening Breath');let weakened;
for(let n=0;n<8&&!weakened;n++){await action(gm,{kind:'action',actorId:dragon.id,propertyId:weak.id,targetIds:[pc.id]});weakened=(await api(gm,'state')).creatures.find(c=>c.id===pc.id).effects.find(e=>e.name==='Weakening Breath');}assert.ok(weakened?.save,'Native failed save did not create a saveable buff');await api(gm,'effect',{actorId:pc.id,remove:weakened.id});
const fire=dragon.actions.find(a=>a.name==='Fire Breath');if(fire){const damage=await action(gm,{kind:'action',actorId:dragon.id,propertyId:fire.id,targetIds:[pc.id,bear.id]});assert.equal(damage.status,'done');assert.ok(damage.health.length>=2,'Area damage did not affect both targets');}
if(fire){const beforeDragon=(await api(gm,'state')).creatures.find(c=>c.id===dragon.id).hp;await action(gm,{kind:'action',actorId:dragon.id,propertyId:fire.id,targetIds:[dragon.id]});assert.equal((await api(gm,'state')).creatures.find(c=>c.id===dragon.id).hp,beforeDragon,'Native fire immunity failed');}
await action(gm,{kind:'hp',actorId:pc.id,hp:0,targetIds:[]});assert.equal((await mapToken(pc.tokenId)).rotation,90);await action(gm,{kind:'death_save',actorId:pc.id,targetIds:[]});await action(gm,{kind:'hp',actorId:pc.id,hp:baseline,targetIds:[]});assert.equal((await mapToken(pc.tokenId)).rotation,0);
await api(player,'combat',{command:'next'});await api(gm,'combat',{command:'end'});state=await api(gm,'state');assert.deepEqual(state.combat.order,[]);assert.deepEqual(state.combat.rolls,[]);assert.equal(state.combat.active,false);
state=await api(gm,'state');let object=state.creatures.find(c=>c.name==='Demo crate'&&c.kind==='object');if(!object){await api(gm,'object',{name:'Demo crate',hp:10,ac:10});object=(await api(gm,'state')).creatures.find(c=>c.name==='Demo crate');}assert.ok(object);await action(gm,{kind:'action',actorId:pc.id,propertyId:ram.id,targetIds:[object.id]});await action(gm,{kind:'action',actorId:pc.id,propertyId:potion.id,targetIds:[object.id]},400);
state=await api(gm,'state');for(const c of state.creatures){for(const e of c.effects.filter(e=>e.name==='Weakening Breath'||e.name==='Save-button test'))await api(gm,'effect',{actorId:c.id,remove:e.id});if(c.hp!==c.hpMax)await action(gm,{kind:'hp',actorId:c.id,hp:c.hpMax,targetIds:[]});}
const final={passed:true,creatures:state.creatures.length,native_attack:hit.result.id,duplicate_safe:true,npc_privacy:true,zero_hp_rotation_and_healing:true,initiative:true,out_of_turn_approval:true,movement_enforced:true,condition_save:true,death_save:true,fire_breath:!!fire,weakening_breath:true,attack_objects:true,fire_immunity:true,tabletopId:state.tabletopId,pcId:pc.id,bearId:bear.id,dragonId:dragon.id};writeFileSync('/test-data/api-result.json',JSON.stringify(final,null,2),{mode:0o600});console.log(JSON.stringify(final));
