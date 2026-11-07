import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { Conditions } from './conditions.mjs';
import { AdvancedEffects } from './advanced-effects.mjs';
function fixture(values=[1,20]){
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE encounters(id TEXT PRIMARY KEY,config TEXT); CREATE TABLE rolls(id TEXT PRIMARY KEY,fingerprint TEXT,encounter_id TEXT,visibility TEXT,result TEXT)');
 const get=()=>JSON.parse(db.prepare('SELECT config FROM encounters').get().config),saveEncounter=e=>db.prepare('INSERT OR REPLACE INTO encounters VALUES(?,?)').run(e.id,JSON.stringify(e));
 saveEncounter({id:'test',status:'ready',tokens:[{token_id:'dragon',name:'Dragon',role:'enemy',hp_current:100,stats:{hp_max:100},advanced_actions:[{id:'weakening',name:'Weakening Breath',description:'Test source',category:'action',save:{dc:15,ability:'str'},rolls:[]}]},{token_id:'pc',name:'Lux',role:'pc',hp_current:20,stats:{hp_max:20},saving_throws:{str:2}},{token_id:'other',name:'Other',role:'enemy',hp_current:10,stats:{hp_max:10},saving_throws:{str:0}}]});
 const options={db,saveEncounter,tokenFor:id=>{const encounter=get();return{encounter,token:encounter.tokens.find(t=>t.token_id===id)};},random:()=>values.shift()};
 return{db,get,saveEncounter,conditions:new Conditions(options),advanced:new AdvancedEffects(options),options,input:()=>({request_id:randomUUID(),action_id:'weakening',targets:[{token_id:'pc',mode:'normal'},{token_id:'other',mode:'normal'}]})};
}
test('Weakening Breath records an effect only on failed saves without damage; replay does not duplicate it',()=>{
 const f=fixture(),input=f.input(),result=f.advanced.create('dragon',input,'gm');assert.equal(result.targets[0].save_success,false);assert.equal(result.targets[0].applied_effects[0].name,'Weakening Breath');assert.equal(result.targets[1].save_success,true);assert.equal(result.targets[1].applied_effects,undefined);assert.equal(f.get().tokens[1].hp_current,20);assert.equal(f.get().tokens[1].active_effects.length,1);assert.equal(f.get().tokens[2].active_effects,undefined);
 assert.deepEqual(f.advanced.create('dragon',input,'gm'),result);assert.equal(f.get().tokens[1].active_effects.length,1);f.db.close();
});
test('custom failed-save effects and explicit no-effect choice override the default',()=>{
 const f=fixture(),input={...f.input(),failed_save_effect:{name:'Frightened',notes:'Fear spell',duration:'Until the GM clears it'}};f.advanced.create('dragon',input,'gm');assert.equal(f.get().tokens[1].active_effects[0].name,'Frightened');f.db.close();
 const g=fixture();g.advanced.create('dragon',{...g.input(),failed_save_effect:null},'gm');assert.equal(g.get().tokens[1].active_effects,undefined);g.db.close();
});
test('GM can add and remove persistent effects, replay safely, and players cannot change them',()=>{
 const f=fixture();const add={request_id:randomUUID(),action:'add',effect:{name:'Poisoned',notes:'Disadvantage reminder',duration:'1 minute'}};
 assert.throws(()=>f.conditions.command('pc',add,'player'),e=>e.status===403);const result=f.conditions.command('pc',add,'gm');assert.deepEqual(f.conditions.command('pc',add,'gm'),result);
 const restored=new Conditions(f.options);assert.equal(f.get().tokens[1].active_effects.length,1);const remove={request_id:randomUUID(),action:'remove',effect_id:result.active_effects[0].id};assert.deepEqual(restored.command('pc',remove,'gm').active_effects,[]);assert.deepEqual(restored.command('pc',remove,'gm').active_effects,[]);assert.equal(f.get().tokens[1].hp_current,20);f.db.close();
});
test('effect mutation and its history record roll back together on a logging failure',()=>{
 const f=fixture(),id=randomUUID();f.db.prepare('INSERT INTO rolls VALUES(?,?,?,?,?)').run(id,'failure','test','public','{}');assert.throws(()=>f.conditions.command('pc',{request_id:id,action:'add',effect:{name:'Restrained'}},'gm'));assert.equal(f.get().tokens[1].active_effects,undefined);f.db.close();
});
