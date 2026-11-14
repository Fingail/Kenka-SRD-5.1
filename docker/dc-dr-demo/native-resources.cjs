// SPDX-License-Identifier: GPL-3.0-only
// Native resource tasks; no parallel inventory or healing state.
const eligible=p=>p&&p.type==='attribute'&&['resource','spellSlot','hitDice'].includes(p.attributeType)&&!p.removed&&!p.inactive&&!p.disabled&&!p.overridden&&!['deathSaveSuccesses','deathSaveFails'].includes(p.variableName);
function adjustment(p,id,delta){
 if(!eligible(p)||!Number.isFinite(p.value)||!Number.isFinite(p.total))throw Error('Resource is not available.');
 if(![-1,1].includes(delta))throw Error('Resource adjustment must be +1 or -1.');
 if(p.value+delta<0||p.value+delta>p.total)throw Error('Resource is at its limit.');
 return {subtaskFn:'damageProp',targetIds:[id],params:{title:p.name,operation:'increment',value:-delta,targetProp:p}};
}
function hitDie(p,rows){
 if(!eligible(p)||p.attributeType!=='hitDice'||p.value<1||!Number.isFinite(p.value)||!p.variableName||!/^d(4|6|8|10|12|20|100)$/.test(p.hitDiceSize||''))throw Error('No usable hit die is available.');
 const con=rows.find(x=>x.type==='attribute'&&x.variableName==='constitution'&&!x.inactive&&!x.removed),modifier=Number.isFinite(p.constitutionMod)?p.constitutionMod:con?.modifier;
 if(!Number.isFinite(modifier))throw Error('The Constitution modifier is missing.');
 if(!rows.some(x=>x.type==='attribute'&&x.variableName==='hitPoints'&&!x.inactive&&!x.removed))throw Error('Hit points are missing.');
 const formula='max(0, 1'+p.hitDiceSize+(modifier<0?' - ':' + ')+Math.abs(modifier)+')';
 return {action:{type:'action',name:'Spend '+p.hitDiceSize+' hit die',actionType:'action',target:'self',tags:['dcdr-hit-die-helper'],resources:{attributesConsumed:[{variableName:p.variableName,quantity:{calculation:'1'}}]}},healing:{type:'damage',name:'Hit die recovery',damageType:'healing',target:'self',amount:{calculation:formula}}};
}
module.exports={eligible,adjustment,hitDie};
