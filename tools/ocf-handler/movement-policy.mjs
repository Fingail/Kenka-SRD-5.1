import { healthBand } from './vitals.mjs';
const inCombat = encounter => ['rolling','active'].includes(encounter.initiative?.status);
export function tokenCanMove(encounter, token, role) {
  if(role==='gm'||!inCombat(encounter))return true;
  return token.role==='pc'&&token.hp_current>0&&encounter.initiative.status==='active'&&encounter.initiative.current_token_id===token.token_id;
}
export function movementPolicy(encounters, role) {
  return { health:Object.fromEntries(encounters.flatMap(e=>e.tokens.map(t=>[t.token_id,t.stats?.hp_max>0?healthBand(t):null]))),effects:Object.fromEntries(encounters.flatMap(e=>e.tokens.map(t=>[t.token_id,(t.active_effects||[]).map(effect=>({id:effect.id,name:effect.name}))]))),tokens:Object.fromEntries(encounters.flatMap(encounter=>encounter.tokens.map(token=>[token.token_id,tokenCanMove(encounter,token,role)]))) };
}
export function movementAllowed(encounters,mapId,tokenId,role) {
  if(role==='gm')return true;
  const maps=encounters.filter(encounter=>encounter.map?.id===mapId);
  const owner=maps.find(encounter=>encounter.tokens.some(token=>token.token_id===tokenId));
  if(owner)return tokenCanMove(owner,owner.tokens.find(token=>token.token_id===tokenId),role);
  return !maps.some(inCombat);
}
