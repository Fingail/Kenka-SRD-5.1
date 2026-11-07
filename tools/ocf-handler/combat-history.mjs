import { healthBand, lifeState } from './vitals.mjs';

// Publish observed combat outcomes, never the GM's raw NPC sheet or HP records.
export function combatHistory(db, role, getEncounter) {
  const encounters=new Map(),attacks=new Map(),effects=new Map(),seen=new Set(),output=[];
  const encounter=id=>{if(!encounters.has(id))encounters.set(id,getEncounter(id));return encounters.get(id);};
  const load=(table,cache,id)=>{if(!cache.has(id)){const row=db.prepare(`SELECT result FROM ${table} WHERE id=?`).get(id);cache.set(id,row?JSON.parse(row.result):null);}return cache.get(id);};
  const participant=(encounterId,id,name)=>{
    const e=encounter(encounterId),token=[...(e?.tokens||[]),...(e?.objects||[])].find(t=>t.token_id===id);
    return {token_id:id,name,conditions:(token?.active_effects||[]).map(effect=>({id:effect.id,name:effect.name})),health:token?.stats?.hp_max>0?healthBand(token):null,life_state:token?lifeState(token):null};
  };
  const dice=roll=>roll?{formula:roll.formula,dice:roll.dice,total:roll.total,natural:roll.natural,mode:roll.mode,automatic_failure:roll.automatic_failure}:null;
  for(const raw of db.prepare('SELECT result FROM rolls ORDER BY rowid DESC LIMIT 200').all()) {
    const row=JSON.parse(raw.result),effectId=typeof row.id==='string'?row.id.split(':')[0]:null;
    const action=row.attack_id?load('attacks',attacks,row.attack_id):null;
    const effect=!action&&effectId?load('advanced_effects',effects,effectId):null;
    if(action) {
      if(!['applied','missed'].includes(action.status)||seen.has('attack:'+action.id))continue;
      seen.add('attack:'+action.id);
      const after=action.damage_health||action.target_health;
      output.push({id:action.id+':combat',encounter_id:action.encounter_id,token_id:action.attacker_token_id,name:action.attacker_name,kind:'combat_event',event_type:'attack',visibility:'public',created_at:action.decided_at||action.created_at,
        action_name:action.action_name,attacker:participant(action.encounter_id,action.attacker_token_id,action.attacker_name),attack:dice(action.attack),hit:action.hit,critical:action.critical,
        damage:action.damage?[{...dice(action.damage),damage_type:action.damage.damage_type}]:[],health:after,
        targets:[{...participant(action.encounter_id,action.target_token_id,action.target_name),after_health:after,...(role==='gm'&&action.hp_change?{gm_hp:{before:action.hp_change.hp_before,after:action.hp_change.hp_after}}:{}),damage_total:action.damage?.total||0,hp_applied:action.status==='applied',outcome_notice:action.outcome_notice}]});
    } else if(effect) {
      if(seen.has('effect:'+effect.id))continue;seen.add('effect:'+effect.id);
      output.push({id:effect.id+':combat',encounter_id:effect.encounter_id,token_id:effect.attacker_token_id,name:row.name,kind:'combat_event',event_type:'advanced',visibility:'public',created_at:effect.created_at,action_name:effect.action_name,
        attacker:participant(effect.encounter_id,effect.attacker_token_id,row.name),damage:effect.damage.map(d=>({...dice(d),damage_type:d.damage_type})),
        targets:effect.targets.map(t=>({...participant(effect.encounter_id,t.token_id,t.name),after_health:t.after_health||null,...(role==='gm'&&t.hp_change?{gm_hp:{before:t.hp_change.hp_before,after:t.hp_change.hp_after}}:{}),effects_applied:(t.applied_effects||[]).map(e=>({id:e.id,name:e.name,notes:e.notes,duration:e.duration})),save:dice(t.save),save_success:t.save_success,damage_total:t.damage_total,hp_applied:t.hp_applied,outcome_notice:t.outcome_notice}))});
    } else if(role==='gm'||row.visibility==='public') {
      if(['healing','death_save','condition_save'].includes(row.kind)&&row.target_token_id){const target=participant(row.encounter_id,row.target_token_id,row.target_name);output.push({...row,health:target.health,participants:[target]});}
      else output.push(row);
    }
    if(output.length>=50)break;
  }
  return output;
}
