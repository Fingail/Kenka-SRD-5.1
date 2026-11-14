import { createHash, randomInt } from 'node:crypto';
import { check, allowed } from './core.mjs';
import { rollD20 } from './extended-sheet.mjs';
import { lifeState } from './vitals.mjs';
export const conditionNames=['Blinded','Charmed','Deafened','Frightened','Grappled','Incapacitated','Invisible','Paralyzed','Petrified','Poisoned','Prone','Restrained','Stunned','Unconscious','Exhaustion'];
export function normalizeSaveRule(rule) {
  check(rule&&typeof rule==='object'&&Object.keys(rule).every(k=>['ability','dc','timing','ends_on_success','mode'].includes(k)),'Invalid effect save rule.');
  check(['str','dex','con','int','wis','cha'].includes(rule.ability)&&Number.isSafeInteger(rule.dc)&&rule.dc>=1&&rule.dc<=100,'Choose a save ability and DC (1–100).');
  check(['manual','start','end'].includes(rule.timing||'manual')&&['normal','advantage','disadvantage'].includes(rule.mode||'normal')&&typeof rule.ends_on_success==='boolean','Invalid save timing or success rule.');
  return {ability:rule.ability,dc:rule.dc,timing:rule.timing||'manual',ends_on_success:rule.ends_on_success,mode:rule.mode||'normal'};
}
export function effectSaveRule(effect) {
  if(effect.save_rule)return normalizeSaveRule(effect.save_rule);
  if(!effect.save)return null;
  const weakening=/^Weakening Breath$/i.test(effect.name);
  return normalizeSaveRule({ability:effect.save.ability,dc:effect.save.dc,timing:weakening?'end':'manual',ends_on_success:weakening,mode:weakening?'disadvantage':'normal'});
}
export function effectSaveMode(token,rule,requested='normal') {
  check(['normal','advantage','disadvantage'].includes(requested),'Invalid save roll mode.');
  const advantage=requested==='advantage'||rule.mode==='advantage';
  const disadvantage=requested==='disadvantage'||rule.mode==='disadvantage'||rule.ability==='str'&&token.active_effects?.some(effect=>/^Weakening Breath$/i.test(effect.name));
  return advantage&&disadvantage?'normal':advantage?'advantage':disadvantage?'disadvantage':'normal';
}
export function conditionDefinition(value) {
  check(value&&typeof value==='object'&&Object.keys(value).every(k=>['name','notes','duration','save_rule'].includes(k)),'Invalid condition effect.');
  check(typeof value.name==='string'&&value.name.trim().length>0&&value.name.length<=100,'Effect name is required (100 characters maximum).');
  check(value.notes===undefined||typeof value.notes==='string'&&value.notes.length<=1000,'Effect notes are too long.');
  check(value.duration===undefined||typeof value.duration==='string'&&value.duration.length<=160,'Effect duration is too long.');
  return {name:value.name.trim(),notes:value.notes||'',duration:value.duration||'',...(value.save_rule?{save_rule:normalizeSaveRule(value.save_rule)}:{})};
}
export function defaultFailedSaveEffect(action) {
  if(!/^Weakening Breath(?:\s*\([^)]*\))?$/i.test(action.name))return null;
  return {name:'Weakening Breath',notes:'Disadvantage on Strength-based attack rolls, Strength checks, and Strength saving throws.',duration:'1 minute; repeat the Strength save at the end of each turn, ending on success.',...(action.save?{save_rule:{ability:action.save.ability,dc:action.save.dc,timing:'end',ends_on_success:true,mode:'disadvantage'}}:{})};
}
export function attachCondition(token,definition,id,source={}) {
  token.active_effects ||= [];
  const existing=token.active_effects.find(e=>e.name===definition.name&&e.source_token_id===source.source_token_id);
  const effect={...definition,id:existing?.id||id,...source,applied_at:new Date().toISOString()};
  if(existing)token.active_effects[token.active_effects.indexOf(existing)]=effect;else {check(token.active_effects.length<30,'Too many active effects.',409);token.active_effects.push(effect);}
  return effect;
}
export class Conditions {
  constructor({db,tokenFor,saveEncounter,isPreparing=()=>false,random=randomInt}) {Object.assign(this,{db,tokenFor,saveEncounter,isPreparing,random});db.exec('CREATE TABLE IF NOT EXISTS condition_requests(id TEXT PRIMARY KEY,fingerprint TEXT NOT NULL,encounter_id TEXT NOT NULL,result TEXT NOT NULL)');}
  rollSave(tokenId,input,role) {
    check(input&&Object.keys(input).every(k=>['request_id','effect_id','mode'].includes(k))&&typeof input.request_id==='string'&&/^[a-f0-9-]{36}$/.test(input.request_id)&&typeof input.effect_id==='string','Invalid effect-save request.');
    const {encounter,token}=this.tokenFor(tokenId);check(allowed(token,role),'Only the GM can roll NPC effect saves.',403);
    const fingerprint=createHash('sha256').update(JSON.stringify({kind:'save',tokenId,input,role})).digest('hex');
    const prior=this.db.prepare('SELECT * FROM condition_requests WHERE id=?').get(input.request_id);if(prior){check(prior.fingerprint===fingerprint,'Request ID already used.',409);return JSON.parse(prior.result);}
    check(encounter.status==='ready'&&!this.isPreparing(),'Wait until encounter preparation finishes.',409);
    const effect=token.active_effects?.find(e=>e.id===input.effect_id);check(effect,'Effect is no longer active.',409);
    const rule=effectSaveRule(effect);check(rule,'This effect has no configured saving throw.');
    check(!['dead','destroyed'].includes(lifeState(token)),'A dead creature cannot roll an effect save.',409);
    const turn=encounter.initiative,turnKey=rule.timing!=='manual'&&turn?.status==='active'&&turn.current_token_id===tokenId?`${turn.session_id}:${turn.turn_number}:${tokenId}`:null;
    check(role==='gm'||!turnKey||effect.last_save?.turn_key!==turnKey,'This effect’s save was already rolled this turn.',409);
    const modifier=(token.saving_throws||token.modifiers)?.[rule.ability];check(Number.isSafeInteger(modifier),'This saving-throw bonus is unavailable.');
    const mode=effectSaveMode(token,rule,input.mode||'normal');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const automatic=token.hp_current===0&&['str','dex'].includes(rule.ability);
      const roll=automatic?{formula:'Automatic failure (unconscious)',dice:[],total:null,mode:'automatic',automatic_failure:true}:rollD20(modifier,mode,this.random);
      const success=!automatic&&roll.total>=rule.dc,ended=success&&rule.ends_on_success;
      if(ended)token.active_effects=token.active_effects.filter(e=>e.id!==effect.id);
      else effect.last_save={request_id:input.request_id,turn_key:turnKey,total:roll.total,success,mode:roll.mode,created_at:new Date().toISOString()};
      encounter.state_revision=(encounter.state_revision||0)+1;this.saveEncounter(encounter);
      const result={id:input.request_id,encounter_id:encounter.id,token_id:tokenId,name:token.name,effect_id:effect.id,effect_name:effect.name,ability:rule.ability,dc:rule.dc,timing:rule.timing,success,ended,...roll,active_effects:token.active_effects};
      const row={id:input.request_id,encounter_id:encounter.id,token_id:tokenId,name:token.name,target_token_id:tokenId,target_name:token.name,kind:'condition_save',label:`${effect.name}: ${rule.ability.toUpperCase()} save — ${success?'success':'failure'}; ${ended?'effect ends':'effect remains'}`,...roll,visibility:'public',actor:role==='gm'?'GM':'Player (shared demo access)',created_at:new Date().toISOString()};
      this.db.prepare('INSERT INTO rolls VALUES(?,?,?,?,?)').run(row.id,fingerprint,encounter.id,'public',JSON.stringify(row));
      this.db.prepare('INSERT INTO condition_requests VALUES(?,?,?,?)').run(input.request_id,fingerprint,encounter.id,JSON.stringify(result));
      this.db.exec('COMMIT');return result;
    }catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  command(tokenId,input,role) {
    check(role==='gm','Only the GM manages active effects.',403);
    check(input&&Object.keys(input).every(k=>['request_id','action','effect','effect_id'].includes(k))&&typeof input.request_id==='string'&&/^[a-f0-9-]{36}$/.test(input.request_id),'Invalid effect command.');
    const fingerprint=createHash('sha256').update(JSON.stringify({tokenId,input,role})).digest('hex');
    const prior=this.db.prepare('SELECT * FROM condition_requests WHERE id=?').get(input.request_id);if(prior){check(prior.fingerprint===fingerprint,'Request ID already used.',409);return JSON.parse(prior.result);}
    const {encounter,token}=this.tokenFor(tokenId);check(encounter.status==='ready'&&!this.isPreparing(),'Wait until encounter preparation finishes.',409);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      let effect;
      if(input.action==='add'){effect=attachCondition(token,conditionDefinition(input.effect),input.request_id,{source_name:'GM'});}
      else if(input.action==='remove'){check(typeof input.effect_id==='string','Choose an active effect.');effect=token.active_effects?.find(e=>e.id===input.effect_id);check(effect,'Effect is no longer active.',409);token.active_effects=token.active_effects.filter(e=>e.id!==effect.id);}
      else check(false,'Unknown effect command.');
      encounter.state_revision=(encounter.state_revision||0)+1;this.saveEncounter(encounter);
      const result={token_id:tokenId,active_effects:token.active_effects};
      const row={id:input.request_id,encounter_id:encounter.id,token_id:tokenId,name:token.name,kind:'combat_update',label:`${token.name}: ${input.action==='add'?'gains':'clears'} ${effect.name}`,formula:'Condition',dice:[],total:0,visibility:'public',actor:'GM',created_at:new Date().toISOString()};
      this.db.prepare('INSERT INTO rolls VALUES(?,?,?,?,?)').run(row.id,fingerprint,encounter.id,'public',JSON.stringify(row));
      this.db.prepare('INSERT INTO condition_requests VALUES(?,?,?,?)').run(input.request_id,fingerprint,encounter.id,JSON.stringify(result));
      this.db.exec('COMMIT');return result;
    }catch(error){this.db.exec('ROLLBACK');throw error;}
  }
}
