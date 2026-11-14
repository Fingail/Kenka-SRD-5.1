// SPDX-License-Identifier: GPL-3.0-only
// Demo radius recovery uses native HP-set tasks and clears applied buffs only.
const tag='dcdr-demo-heal-all';
const available=p=>p?.type==='action'&&(p.tags||[]).includes(tag)&&!p.removed&&!p.inactive&&!p.disabled&&!p.overridden;
const property=()=>({type:'action',name:'Demo: Heal all',actionType:'free',target:'multipleTargets',tags:[tag],description:{text:'GM demo tool. Choose creatures within 120 feet of the dragon, including the dragon. Restore selected creatures to maximum HP, including zero or negative HP, and remove all applied conditions and buffs. Area: 120 ft radius. Use selected in the radius target dialog. Unlimited uses. Character features, resource counts, equipment and initiative are preserved.'}});
function targets(action,decisions,allowed){const ids=action.task?.targetIds?.length?action.task.targetIds:decisions?.[0];if(!Array.isArray(ids)||ids.some(id=>typeof id!=='string'||!allowed.includes(id)))throw Error('Choose encounter creatures in the radius target dialog.');return [...new Set(ids)];}
function clearEffects(properties,effects=[]){const ids=new Set(effects.map(p=>p._id));let size;do{size=ids.size;for(const p of properties)if(p.parentId&&ids.has(p.parentId))ids.add(p._id);}while(size!==ids.size);return properties.filter(p=>ids.has(p._id)&&!p.removed).map(p=>({propId:p._id,type:p.type,set:{removed:true,dirty:true}}));}
function plan(entries){return entries.flatMap(({actor,properties})=>{
 const hp=properties.find(p=>p.type==='attribute'&&p.variableName==='hitPoints'&&!p.removed&&!p.inactive&&!p.disabled&&!p.overridden);
 if(!hp||!Number.isFinite(hp.value)||!Number.isFinite(hp.total)||hp.total<=0)return [];
 return [{id:actor.id,name:actor.name,before:hp.value,maximum:hp.total,task:{subtaskFn:'damageProp',targetIds:[actor.id],params:{title:'Healing — '+actor.name,operation:'set',value:hp.total,targetProp:{...hp}}}}];
});}
async function batch(action,entries,{clone,apply,sourceName}){
 const plans=plan(entries);
 const result={...clone(action),results:[],taskCount:0},unexpected=async()=>{throw Error('Demo healing must not request dice or choices.');},provider={rollDice:unexpected,targetIds:unexpected,advantage:unexpected,check:unexpected,nextStep:async()=>{},choose:unexpected};
 result.results.push({mutations:[{targetIds:plans.map(p=>p.id),updates:[],contents:[{name:'Demo: Heal all',value:sourceName+' restores '+plans.length+' selected creatures to maximum HP and clears applied effects.',targetIds:plans.map(p=>p.id)}]}]});
 for(const entry of entries){const updates=clearEffects(entry.properties,entry.effects);if(updates.length)result.results.push({mutations:[{targetIds:[entry.actor.id],updates,contents:[{name:'Effects cleared — '+entry.actor.name,value:(entry.effects||[]).map(p=>p.name).join(', '),targetIds:[entry.actor.id]}]}]});}
 for(const entry of plans){result.task=entry.task;delete result._isSimulation;delete result._stepThrough;await apply(result,provider);}
 return result;
}
module.exports={tag,available,property,targets,clearEffects,plan,batch};
