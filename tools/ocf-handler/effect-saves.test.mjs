import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { Conditions, effectSaveRule, effectSaveMode } from './conditions.mjs';
import { TurnApprovals } from './turn-approvals.mjs';
function fixture(values=[20,19],effect={name:'Weakening Breath',save:{ability:'str',dc:15}}){
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE encounters(id TEXT PRIMARY KEY,config TEXT); CREATE TABLE rolls(id TEXT PRIMARY KEY,fingerprint TEXT,encounter_id TEXT,visibility TEXT,result TEXT)');
 const getEncounter=id=>JSON.parse(db.prepare('SELECT config FROM encounters WHERE id=?').get(id).config),saveEncounter=e=>db.prepare('INSERT OR REPLACE INTO encounters VALUES(?,?)').run(e.id,JSON.stringify(e));
 saveEncounter({id:'test',status:'ready',tokens:[{token_id:'pc',name:'PC',role:'pc',hp_current:20,stats:{hp_max:20},saving_throws:{str:2,con:1,dex:2},active_effects:[{id:'effect',...effect},{id:'unrelated',name:'Other effect'}]},{token_id:'npc',name:'NPC',role:'enemy',hp_current:20,stats:{hp_max:20},saving_throws:{str:2},active_effects:[]}],initiative:{session_id:'battle',status:'active',current_token_id:'pc',turn_number:1}});
 let dice=0;const options={db,getEncounter,saveEncounter,tokenFor:id=>{const encounter=getEncounter('test');return{encounter,token:encounter.tokens.find(t=>t.token_id===id)};},random:(min,max)=>{dice++;const value=values.shift();assert.ok(value>=min&&value<max);return value;}};
 const conditions=new Conditions(options),input=()=>({request_id:randomUUID(),effect_id:'effect',mode:'normal'});
 return{db,options,getEncounter,saveEncounter,conditions,input,dice:()=>dice};
}
test('legacy Weakening Breath gets a repeat-save rule; successful disadvantage save clears only that effect and replays safely',()=>{
 const f=fixture(),input=f.input();assert.equal(effectSaveRule(f.getEncounter('test').tokens[0].active_effects[0]).ends_on_success,true);
 const result=f.conditions.rollSave('pc',input,'player');assert.deepEqual(result.dice,[20,19]);assert.equal(result.total,21);assert.equal(result.success,true);assert.equal(result.ended,true);assert.deepEqual(result.active_effects.map(e=>e.id),['unrelated']);assert.equal(f.getEncounter('test').tokens[0].hp_current,20);assert.deepEqual(f.conditions.rollSave('pc',input,'player'),result);assert.equal(f.dice(),2);f.db.close();
});
test('failed saves retain effects and new UUIDs cannot reroll on the same PC turn; GM and later turns can retry',()=>{
 const f=fixture([1,4,20,20]);const first=f.conditions.rollSave('pc',f.input(),'player');assert.equal(first.ended,false);assert.equal(f.getEncounter('test').tokens[0].active_effects.length,2);
 assert.throws(()=>f.conditions.rollSave('pc',f.input(),'player'),e=>e.status===409);
 const state=f.getEncounter('test');state.initiative.turn_number=2;f.saveEncounter(state);assert.equal(f.conditions.rollSave('pc',f.input(),'player').ended,true);f.db.close();
});
test('every stored save has a roll rule, but successful saves leave effects active unless ending is configured',()=>{
 const f=fixture([20],{name:'Mystery effect',save:{ability:'con',dc:10}});const rule=effectSaveRule(f.getEncounter('test').tokens[0].active_effects[0]);assert.equal(rule.ends_on_success,false);
 const result=f.conditions.rollSave('pc',f.input(),'player');assert.equal(result.success,true);assert.equal(result.ended,false);assert.equal(f.getEncounter('test').tokens[0].active_effects.length,2);assert.equal(effectSaveRule({name:'No save'}),null);f.db.close();
});
test('unconscious STR/DEX saves automatically fail; players cannot choose another DC or roll NPC saves',()=>{
 const f=fixture([]);let state=f.getEncounter('test');state.tokens[0].hp_current=0;f.saveEncounter(state);assert.equal(f.conditions.rollSave('pc',f.input(),'player').automatic_failure,true);assert.equal(f.dice(),0);
 assert.throws(()=>f.conditions.rollSave('pc',{...f.input(),dc:1},'player'),e=>e.status===400);assert.throws(()=>f.conditions.rollSave('npc',f.input(),'player'),e=>e.status===403);f.db.close();
});
test('save result, condition removal and history roll back together on failure; removed effects reject stale new requests',()=>{
 const f=fixture(),input=f.input();f.db.prepare('INSERT INTO rolls VALUES(?,?,?,?,?)').run(input.request_id,'failure','test','public','{}');assert.throws(()=>f.conditions.rollSave('pc',input,'player'));assert.equal(f.getEncounter('test').tokens[0].active_effects.length,2);f.db.close();
 const g=fixture();g.conditions.command('pc',{request_id:randomUUID(),action:'remove',effect_id:'effect'},'gm');assert.throws(()=>g.conditions.rollSave('pc',g.input(),'player'),e=>e.status===409);assert.equal(g.dice(),0);g.db.close();
});
test('out-of-turn effect saves wait for DM approval with no dice; approval executes once with the original permissions',()=>{
 const f=fixture();const state=f.getEncounter('test');state.initiative.current_token_id='npc';f.saveEncounter(state);
 const gate=new TurnApprovals({...f.options,execute:(kind,id,input,role)=>f.conditions.rollSave(id,input,role),hasExecuted:(kind,id)=>!!f.db.prepare('SELECT id FROM condition_requests WHERE id=?').get(id)});
 const input=f.input();assert.equal(gate.run('condition_save','pc',input,'player').approval_required,true);assert.equal(f.dice(),0);
 assert.equal(gate.decide(input.request_id,'approve','gm').result.ended,true);assert.equal(f.dice(),2);gate.decide(input.request_id,'approve','gm');assert.equal(f.dice(),2);f.db.close();
});
test('advantage cancels Weakening Breath disadvantage on Strength repeat saves',()=>{
 assert.equal(effectSaveMode({active_effects:[{name:'Weakening Breath'}]},{ability:'str',mode:'normal'},'advantage'),'normal');
});

test('manual-trigger saves can repeat within a turn; they are not restricted like start/end-turn saves',()=>{
 const f=fixture([20,10],{name:'Manual save trigger',save_rule:{ability:'con',dc:10,timing:'manual',ends_on_success:false,mode:'normal'}});
 assert.equal(f.conditions.rollSave('pc',f.input(),'player').success,true);assert.equal(f.conditions.rollSave('pc',f.input(),'player').success,true);assert.equal(f.dice(),2);f.db.close();
});
