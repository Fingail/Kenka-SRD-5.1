import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { AdvancedEffects } from './advanced-effects.mjs';
function fixture(values = [6, 5, 12, 1]) {
  const db=new DatabaseSync(':memory:'); db.exec('CREATE TABLE encounters(id TEXT PRIMARY KEY,config TEXT); CREATE TABLE rolls(id TEXT PRIMARY KEY,fingerprint TEXT,encounter_id TEXT,visibility TEXT,result TEXT)');
  const saveEncounter=e=>db.prepare('INSERT OR REPLACE INTO encounters VALUES(?,?)').run(e.id,JSON.stringify(e));
  const get=()=>JSON.parse(db.prepare('SELECT config FROM encounters').get().config);
  const action={id:'fire',name:'Fire Breath',description:'DC 10 Dexterity; half on success.',area:{shape:'cone',size_ft:60},save:{dc:10,ability:'dex',half_on_success:true},rolls:[{id:'damage',kind:'damage',formula:'2d6',damage_type:'fire'}]};
  saveEncounter({id:'test',status:'ready',tokens:[{token_id:'caster',name:'Dragon',role:'enemy',hp_current:100,advanced_actions:[action]},{token_id:'pc',name:'PC',role:'pc',hp_current:20,hp_temporary:0,stats:{hp_max:20},saving_throws:{dex:2}},{token_id:'npc',name:'NPC',role:'enemy',hp_current:10,hp_temporary:0,stats:{hp_max:10},saving_throws:{dex:0}}]});
  const engine=new AdvancedEffects({db,saveEncounter,tokenFor:()=>{const encounter=get();return{encounter,token:encounter.tokens[0]};},random:(min,max)=>{const v=values.shift();assert.ok(v>=min&&v<max);return v;}});
  const input=()=>({request_id:randomUUID(),action_id:'fire',targets:[{token_id:'pc',mode:'normal'},{token_id:'npc',mode:'normal'}]});
  return{db,get,saveEncounter,engine,input};
}
test('AoE rolls damage once, separate saves, half on success, death on failure, and replays without duplicate HP',()=>{
  const f=fixture(), input=f.input(); const r=f.engine.create('caster',input,'gm');
  assert.equal(r.damage[0].total,11);assert.equal(r.targets[0].save_success,true);assert.equal(r.targets[0].damage_total,5);assert.equal(r.targets[0].hp_change.hp_after,15);
  assert.equal(r.targets[1].save_success,false);assert.equal(r.targets[1].hp_change.hp_after,0);assert.match(r.targets[1].outcome_notice,/dead/);
  assert.deepEqual(f.engine.create('caster',input,'gm'),r);assert.equal(f.get().tokens[0].hp_current,100);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM advanced_effects').get().n,1);f.db.close();
});
test('known immunity/resistance apply after saves; qualified defenses remain manual',()=>{
  const f=fixture(), e=f.get();e.tokens[1].damage_traits={immunities:['fire']};e.tokens[2].damage_traits={resistances:['fire']};f.saveEncounter(e);
  const r=f.engine.create('caster',f.input(),'gm');assert.equal(r.targets[0].damage_total,0);assert.equal(r.targets[1].damage_total,5);f.db.close();
  const manual=fixture(), m=manual.get();m.tokens[0].advanced_actions[0].save.half_on_success=false;m.tokens[1].damage_traits={manual:['Conditional resistance']};manual.saveEncounter(m);
  const result=manual.engine.create('caster',manual.input(),'gm');assert.equal(result.targets[0].hp_applied,false);assert.equal(manual.get().tokens[1].hp_current,20);manual.db.close();
});
test('invalid/duplicate/outside targets and unauthorized execution fail before rolls',()=>{
  const f=fixture([]);assert.throws(()=>f.engine.create('caster',f.input(),'player'),e=>e.status===403);
  assert.throws(()=>f.engine.create('caster',{...f.input(),targets:[{token_id:'outside'}]},'gm'));
  assert.throws(()=>f.engine.create('caster',{...f.input(),targets:[{token_id:'pc'},{token_id:'pc'}]},'gm'));
  assert.throws(()=>f.engine.create('caster',{...f.input(),targets:[{token_id:'caster'}]},'gm'));f.db.close();
});
test('a logging failure rolls back every target HP and the advanced interaction',()=>{
  const f=fixture(),input=f.input();f.db.prepare('INSERT INTO rolls VALUES(?,?,?,?,?)').run(input.request_id+':outcome','fail','test','gm','{}');
  assert.throws(()=>f.engine.create('caster',input,'gm'));assert.equal(f.get().tokens[1].hp_current,20);assert.equal(f.get().tokens[2].hp_current,10);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM advanced_effects').get().n,0);f.db.close();
});

test('unconscious PCs automatically fail STR/DEX saves; manual HP choice supports GM rule exceptions',()=>{
  const f=fixture([6,5,1]), e=f.get();e.tokens[1].hp_current=0;e.tokens[1].life_state='dying';f.saveEncounter(e);
  const r=f.engine.create('caster',f.input(),'gm');assert.equal(r.targets[0].save.automatic_failure,true);assert.equal(r.targets[0].save_success,false);assert.equal(f.get().tokens[1].death_saves.failures,1);f.db.close();
  const g=fixture(), input=g.input();input.targets[0].manual_hp=true;const manual=g.engine.create('caster',input,'gm');assert.equal(manual.targets[0].hp_applied,false);assert.equal(g.get().tokens[1].hp_current,20);g.db.close();
});
