// SPDX-License-Identifier: GPL-3.0-only
// Resolve legendary references against the creature's recorded basic attacks.
function linkedAttack(effect,attacks){if(!/^Tail Attack$/i.test(effect.name||'')||!/makes? (?:a |one )?tail attack/i.test(effect.description||''))return null;return (attacks||[]).find(a=>/^Tail$/i.test(a.name||''))||null;}
function hasDamage(rows,parentId){const map=new Map(rows.map(p=>[p._id,p]));return rows.some(p=>{if(p.type!=='damage'||p.removed)return false;let parent=map.get(p.parentId);const seen=new Set();while(parent&&!seen.has(parent._id)){if(parent._id===parentId)return true;seen.add(parent._id);parent=map.get(parent.parentId);}return false;});}
module.exports={linkedAttack,hasDamage};
