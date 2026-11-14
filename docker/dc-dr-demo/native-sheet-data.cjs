// SPDX-License-Identifier: GPL-3.0-only
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.diceSheetData=factory();})(typeof window==='object'?window:globalThis,()=>{
 const active=p=>!p.removed&&!p.inactive&&!p.disabled&&!p.overridden;
 // Library onboarding uses native adjustments to advance utility counters. Those
 // are build navigation, not character abilities, even if imported as actions.
 const setupStat=name=>['tutorialStatus','jonStatus'].includes(name);
 function setupProperty(prop,rows){
  if(!prop)return false;
  const byId=new Map(rows.map(p=>[p._id,p])),setupNode=p=>setupStat(p.variableName)||setupStat(p.stat)||(p.type==='propertySlot'&&/^(Tutorial|Select a Topic)$/i.test(p.name||''))||/^(Introduction to DiceCloud(?: V2)?|Tutorial Stage \d+)$/i.test(p.name||'');
  let current=prop;const seen=new Set();
  while(current&&!seen.has(current._id)){seen.add(current._id);if(setupNode(current))return true;current=byId.get(current.parentId);}
  // Some imported actions have lost their tutorial parent, but retain the
  // adjustment subtree that identifies their purpose.
  if(['action','spell','roll'].includes(prop.type)&&prop._id){const children=new Set([prop._id]);let size;do{size=children.size;for(const child of rows)if(child.parentId&&children.has(child.parentId)){if(setupNode(child))return true;children.add(child._id);}}while(children.size!==size);}
  return false;
 }
 function summarize(rows){const all=rows.filter(p=>active(p)&&!setupProperty(p,rows)),byId=new Map(rows.map(p=>[p._id,p]));const executable=p=>{if(!['action','spell','roll'].includes(p.type)||(p.tags||[]).includes('dcdr-hit-die-helper'))return false;let parent=byId.get(p.parentId),seen=new Set();while(parent&&!seen.has(parent._id)){seen.add(parent._id);if(['action','spell','roll'].includes(parent.type))return false;parent=byId.get(parent.parentId);}return true;};
  const actions=all.filter(executable),features=all.filter(p=>p.type==='feature'),items=all.filter(p=>p.type==='item');
  return {abilities:all.filter(p=>p.type==='attribute'&&p.attributeType==='ability'),saves:all.filter(p=>p.type==='skill'&&p.skillType==='save'),skills:all.filter(p=>p.type==='skill'&&['skill','check','tool'].includes(p.skillType)),proficiencies:all.filter(p=>p.type==='skill'&&['weapon','armor','language'].includes(p.skillType)),stats:all.filter(p=>p.type==='attribute'&&['stat','healthBar','resource','spellSlot','hitDice'].includes(p.attributeType)),actions:actions.filter(p=>p.type!=='spell'),spells:actions.filter(p=>p.type==='spell'),features,items,itemActions:item=>{const children=actions.filter(p=>{let parent=byId.get(p.parentId),seen=new Set();while(parent&&!seen.has(parent._id)){if(parent._id===item._id)return true;seen.add(parent._id);parent=byId.get(parent.parentId);}return false;});if(children.length)return children;const matches=actions.filter(p=>String(item.name||'').trim()&&p.type!=='spell'&&String(p.name||'').trim().toLowerCase()===String(item.name||'').trim().toLowerCase());return matches.length===1?matches:[];},featureActions:feature=>actions.filter(p=>{let parent=byId.get(p.parentId),seen=new Set();while(parent&&!seen.has(parent._id)){if(parent._id===feature._id)return true;seen.add(parent._id);parent=byId.get(parent.parentId);}return false;})};
 }
 function checkTask(prop,rows,id){const skill=prop.type==='skill',ability=skill?rows.find(p=>p.type==='attribute'&&p.variableName===prop.ability&&active(p)):prop;return {subtaskFn:'check',prop:structuredClone(prop),targetIds:[id],skillVariableName:skill?prop.variableName:undefined,abilityVariableName:ability?.variableName,advantage:prop.advantage||ability?.advantage||0,dc:null};}
 function integratedResource(p,rows){if(['hitDice','spellSlot'].includes(p.attributeType))return true;if((p.tags||[]).some(t=>t.startsWith('dcdr-reroll:')))return true;if(p.variableName==='favoredFoeUses'&&rows.some(f=>active(f)&&f.type==='feature'&&/^Favored Foe$/i.test(f.name||'')))return true;if(p.variableName==='luckPoints'&&rows.some(f=>active(f)&&f.type==='feature'&&/^Lucky$/i.test(f.name||'')))return true;return !!p.variableName&&rows.some(a=>active(a)&&['action','spell'].includes(a.type)&&(a.resources?.attributesConsumed||[]).some(r=>r.variableName===p.variableName));}
 return {active,setupProperty,summarize,checkTask,integratedResource};
});
