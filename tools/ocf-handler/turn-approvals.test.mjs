import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { Combat } from './combat.mjs';
import { TurnApprovals, needsTurnApproval } from './turn-approvals.mjs';

function fixture() {
  const db=new DatabaseSync(':memory:');
  db.exec('CREATE TABLE encounters(id TEXT PRIMARY KEY,config TEXT); CREATE TABLE rolls(id TEXT PRIMARY KEY,fingerprint TEXT,encounter_id TEXT,visibility TEXT,result TEXT)');
  const getEncounter=id=>JSON.parse(db.prepare('SELECT config FROM encounters WHERE id=?').get(id).config);
  const saveEncounter=e=>db.prepare('INSERT OR REPLACE INTO encounters VALUES(?,?)').run(e.id,JSON.stringify(e));
  saveEncounter({id:'test',status:'ready',revision:1,tokens:[{token_id:'pc',name:'PC',role:'pc',hp_current:20,stats:{hp_max:20,ac:15},attacks:[{id:'sword',name:'Sword',attack_bonus:10,damage:'1d4',damage_type:'slashing'}],inventory:[{id:'potion-healing',quantity:1}]},{token_id:'npc',name:'NPC',role:'enemy',hp_current:20,stats:{hp_max:20,ac:10}}],initiative:{session_id:'battle',status:'active',current_token_id:'npc'}});
  const tokenFor=id=>{const encounter=getEncounter('test');return {encounter,token:encounter.tokens.find(t=>t.token_id===id)};};
  let dice=0;const combat=new Combat({db,getEncounter,saveEncounter,tokenFor,random:()=>{dice++;return 2;}});
  const options={db,tokenFor,getEncounter,execute:(kind,id,input,role)=>kind==='attack'?combat.create(id,input,role):combat.utility(id,input,role,kind),hasExecuted:(kind,id)=>Boolean(db.prepare('SELECT id FROM '+(kind==='attack'?'attacks':'combat_utilities')+' WHERE id=?').get(id))};
  const gate=new TurnApprovals(options),input={request_id:randomUUID(),action_id:'sword',target_token_id:'npc'};
  return {db,gate,options,input,getEncounter,saveEncounter,dice:()=>dice};
}
test('out-of-turn requests roll no dice or HP until DM approves; replay and repeated approval apply exactly once',()=>{
  const f=fixture();const pending=f.gate.run('attack','pc',f.input,'player');assert.equal(pending.approval_required,true);assert.equal(f.dice(),0);assert.equal(f.getEncounter('test').tokens[1].hp_current,20);
  assert.deepEqual(f.gate.run('attack','pc',f.input,'player'),pending);assert.equal(f.gate.list().length,1);
  assert.throws(()=>f.gate.decide(f.input.request_id,'approve','player'),e=>e.status===403);
  const approved=f.gate.decide(f.input.request_id,'approve','gm');assert.equal(approved.status,'approved');assert.equal(f.dice(),2);assert.equal(f.getEncounter('test').tokens[1].hp_current,18);assert.equal(approved.result.hp_change,undefined);
  assert.deepEqual(f.gate.decide(f.input.request_id,'approve','gm'),approved);assert.deepEqual(f.gate.run('attack','pc',f.input,'player'),approved.result);assert.equal(f.dice(),2);f.db.close();
});
test('rejection and player cancellation leave dice, HP and inventory unchanged',()=>{
  for(const decision of ['reject','cancel']){const f=fixture();const input={request_id:randomUUID(),item_id:'potion-healing',target_token_id:'pc'};
    f.gate.run('healing','pc',input,'player');const result=f.gate.decide(input.request_id,decision,decision==='cancel'?'player':'gm');assert.ok(['rejected','cancelled'].includes(result.status));assert.equal(f.dice(),0);assert.equal(f.getEncounter('test').tokens[0].inventory[0].quantity,1);f.db.close();}
});
test('queued requests survive reconstruction and cannot cross combat sessions or combat end',()=>{
  for(const change of ['ended','session']){const f=fixture();f.gate.run('attack','pc',f.input,'player');
    const state=f.getEncounter('test');if(change==='ended')state.initiative.status='ended';else state.initiative.session_id='new battle';f.saveEncounter(state);
    const restored=new TurnApprovals(f.options);assert.equal(restored.decide(f.input.request_id,'approve','gm').status,'cancelled');assert.equal(f.dice(),0);f.db.close();}
});
test('own turn, GM overrides and out-of-combat play remain immediate; rolls during initiative queuing require approval',()=>{
  const f=fixture();for(const status of [undefined,'pending','rolling','active','ended']){
    const encounter=f.getEncounter('test');encounter.initiative.status=status;
    assert.equal(needsTurnApproval(encounter,encounter.tokens[0],'player'),['rolling','active'].includes(status));assert.equal(needsTurnApproval(encounter,encounter.tokens[0],'gm'),false);
    encounter.initiative.current_token_id='pc';assert.equal(needsTurnApproval(encounter,encounter.tokens[0],'player'),status==='rolling');
  }
  const encounter=f.getEncounter('test');encounter.initiative.current_token_id='pc';f.saveEncounter(encounter);
  assert.equal(f.gate.run('attack','pc',f.input,'player').status,'applied');assert.equal(f.gate.list().length,0);f.db.close();
});
test('changed requests cannot reuse IDs; player cannot request NPC rolls; ended target validation still runs on approval',()=>{
  const f=fixture();f.gate.run('attack','pc',f.input,'player');assert.throws(()=>f.gate.run('attack','pc',{...f.input,action_id:'forged'},'player'),e=>e.status===409);
  assert.throws(()=>f.gate.run('attack','npc',f.input,'player'),e=>e.status===403);
  const encounter=f.getEncounter('test');encounter.tokens[1].hp_current=0;f.saveEncounter(encounter);
  assert.equal(f.gate.decide(f.input.request_id,'approve','gm').status,'failed');assert.equal(f.dice(),0);f.db.close();
});
