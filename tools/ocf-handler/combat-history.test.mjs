import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { Combat } from './combat.mjs';
import { AdvancedEffects } from './advanced-effects.mjs';
import { combatHistory } from './combat-history.mjs';
function fixture(values=[12,4,12,4]) {
  const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE encounters(id TEXT PRIMARY KEY,config TEXT); CREATE TABLE rolls(id TEXT PRIMARY KEY,fingerprint TEXT,encounter_id TEXT,visibility TEXT,result TEXT)');
  const getEncounter=id=>JSON.parse(db.prepare('SELECT config FROM encounters WHERE id=?').get(id).config);
  const saveEncounter=e=>db.prepare('INSERT OR REPLACE INTO encounters VALUES(?,?)').run(e.id,JSON.stringify(e));
  const attack={id:'claw',name:'Claw',attack_bonus:5,damage:'1d8+3',damage_type:'slashing'};
  const action={id:'fire',name:'Fire Breath',description:'Secret GM reference',save:{dc:10,ability:'dex',half_on_success:true},rolls:[{id:'damage',kind:'damage',formula:'2d6',damage_type:'fire'}]};
  saveEncounter({id:'test',status:'ready',revision:1,tokens:[{token_id:'npc',name:'Dragon',role:'enemy',hp_current:100,stats:{hp_max:100,ac:19},attacks:[attack],advanced_actions:[action]},{token_id:'pc',name:'Lux',role:'pc',hp_current:55,stats:{hp_max:100,ac:10},saving_throws:{dex:2}},{token_id:'other',name:'Kobold',role:'enemy',hp_current:4,stats:{hp_max:20,ac:10},saving_throws:{dex:0}}]});
  const options={db,getEncounter,saveEncounter,tokenFor:id=>{const encounter=getEncounter('test');return {encounter,token:encounter.tokens.find(t=>t.token_id===id)};},random:(min,max)=>{const value=values.shift();assert.ok(value>=min&&value<max);return value;}};
  return {db,getEncounter,saveEncounter,combat:new Combat(options),effects:new AdvancedEffects(options),history:role=>combatHistory(db,role,getEncounter)};
}
function noPrivateFields(value){for(const [key,child] of Object.entries(value||{})){assert.equal(['hp_change','hp_current','hp_max','hp_after','hp_before','stats','target_ac','source_description','manual_defenses','dc'].includes(key),false,key);if(child&&typeof child==='object')noPrivateFields(child);}}
test('NPC attacks appear once with participants, attack/damage dice and safe health; NPC sheets remain private',()=>{
  const f=fixture();const action=f.combat.create('npc',{request_id:randomUUID(),action_id:'claw',target_token_id:'pc'},'gm');
  const rows=f.history('player');assert.equal(rows.length,1);const event=rows[0];assert.equal(event.event_type,'attack');assert.equal(event.attacker.name,'Dragon');assert.equal(event.targets[0].name,'Lux');assert.deepEqual(event.attack.dice,[12]);assert.equal(event.attack.total,17);assert.deepEqual(event.damage[0].dice,[4]);assert.equal(event.targets[0].damage_total,7);assert.equal(event.targets[0].after_health.band,'yellow');noPrivateFields(event);assert.equal(event.targets[0].gm_hp,undefined);assert.deepEqual(f.history('gm')[0].targets[0].gm_hp,{before:55,after:48});
  assert.throws(()=>f.combat.get(action.id,'player'),e=>e.status===403);
  const state=f.getEncounter('test');state.tokens[1].hp_current=100;f.saveEncounter(state);const refreshed=f.history('player')[0];assert.equal(refreshed.targets[0].health.band,'green');assert.equal(refreshed.targets[0].after_health.band,'yellow');f.db.close();
});
test('NPC misses disclose the attack roll, have zero damage and no fabricated damage roll',()=>{
  const f=fixture([1]);f.combat.create('npc',{request_id:randomUUID(),action_id:'claw',target_token_id:'pc'},'gm');const event=f.history('player')[0];assert.equal(event.hit,false);assert.deepEqual(event.damage,[]);assert.equal(event.targets[0].damage_total,0);assert.equal(f.getEncounter('test').tokens[1].hp_current,55);f.db.close();
});
test('AoE outcomes share dice, saves and per-target applied damage without leaking HP or GM notes',()=>{
  const f=fixture([6,5,12,1]);f.effects.create('npc',{request_id:randomUUID(),action_id:'fire',targets:[{token_id:'pc',mode:'normal'},{token_id:'other',mode:'normal'}]},'gm');
  const event=f.history('player')[0];assert.equal(event.event_type,'advanced');assert.equal(f.history('player').length,1);assert.equal(event.damage[0].total,11);assert.deepEqual(event.targets.map(t=>t.damage_total),[5,11]);assert.equal(event.targets[0].save.total,14);assert.equal(event.targets[1].after_health.band,'red');assert.match(event.targets[1].outcome_notice,/dead/);noPrivateFields(event);assert.equal(JSON.stringify(event).includes('Secret GM reference'),false);f.db.close();
});
test('private NPC standalone rolls remain private while historical NPC combat records are projected safely',()=>{
  const f=fixture();f.combat.create('npc',{request_id:randomUUID(),action_id:'claw',target_token_id:'other'},'gm');
  const row={id:randomUUID(),name:'Dragon',token_id:'npc',encounter_id:'test',visibility:'gm',label:'Secret recharge',formula:'1d6',dice:[6],total:6};f.db.prepare('INSERT INTO rolls VALUES(?,?,?,?,?)').run(row.id,'private','test','gm',JSON.stringify(row));
  const player=f.history('player');assert.equal(player.length,1);assert.equal(player[0].targets[0].health.band,'red');assert.ok(f.history('gm').some(r=>r.label==='Secret recharge'));noPrivateFields(player[0]);f.db.close();
});
