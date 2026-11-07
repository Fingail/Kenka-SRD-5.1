// SPDX-License-Identifier: GPL-3.0-only
// Shared presentation data for native character cards and map token labels.
const health=(value,max)=>{
 if(!Number.isFinite(value)||!Number.isFinite(max)||max<=0)return {label:'Unknown',background:'#626262',color:'#fff'};
 if(value<=0)return {label:'Down',background:'#782a32',color:'#fff'};
 if(value>max/2)return {label:'Good',background:'#237a3b',color:'#fff'};
 if(value>max/4)return {label:'Not Good',background:'#d4a62a',color:'#1c2025'};
 return {label:'Bad',background:'#b83d37',color:'#fff'};
};
const condition=b=>{const name=b.name||'Condition';let background='#6b4ba5';if(/dead|unconscious/i.test(name))background='#782a32';else if(/poison/i.test(name))background='#687b31';else if(/prone|restrain|stun|paraly|exhaust/i.test(name))background='#a96922';else if(/invis/i.test(name))background='#247780';return {id:b._id,name,background,color:'#fff'};};
const healthPalette=Object.fromEntries([[20,20],[10,20],[5,20],[0,20],[undefined,20]].map(([value,max])=>{const s=health(value,max);return [s.label,s];}));
module.exports={health,condition,healthPalette};
