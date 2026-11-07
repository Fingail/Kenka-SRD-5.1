// SPDX-License-Identifier: GPL-3.0-only
// Repair imported arrow bundles and native action references without replenishing ammo.
module.exports=rows=>{
 const patches=new Map(),items=rows.filter(p=>p.type==='item'&&!p.removed),mark='dcdr-ammo-units-v1';
 const patch=id=>{if(!patches.has(id))patches.set(id,{id,set:{}});return patches.get(id);};
 for(const item of items){if(!/^arrows?(?:\s|$)/i.test(item.name||''))continue;const p=patch(item._id),tags=[...new Set([...(item.tags||[]),'arrow'])],bundle=/^arrows?\s*\((\d+)\)\s*$/i.exec(item.name||'');
  if(bundle&&Number.isFinite(item.quantity)){p.set.quantity=item.quantity*Number(bundle[1]);p.set.name='Arrows';if(!tags.includes(mark))tags.push(mark);if(item.description?.text)p.set['description.text']=item.description.text.replace('Quantity counts bundles, not individual arrows.','Combat inventory counts individual arrows. Imported from bundles of '+bundle[1]+'.');}
  if(JSON.stringify(tags)!==JSON.stringify(item.tags||[]))p.set.tags=tags;
 }
 for(const action of rows.filter(p=>p.type==='action'&&!p.removed))for(const [index,ammo]of (action.resources?.itemsConsumed||[]).entries()){
  if(ammo.tag!=='arrow'||items.some(p=>p._id===ammo.itemId))continue;
  const candidates=items.filter(p=>(p.tags||[]).includes('arrow')||/^arrows?(?:\s|$)/i.test(p.name||''));if(candidates.length!==1)continue;
  patch(action._id).set['resources.itemsConsumed.'+index+'.itemId']=candidates[0]._id;
 }
 return [...patches.values()].filter(p=>Object.keys(p.set).length);
};
