// SPDX-License-Identifier: GPL-3.0-only
// Presentation only: never change stored action logs or per-target outcomes.
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.diceLogLayout=factory();})(typeof window==='object'?window:globalThis,()=>{
 const text=value=>String(value||'').normalize('NFKC').replace(/\s+/g,' ').trim();
 function groups(visible){const out=[];visible.forEach((c,i)=>{const previous=out[out.length-1],key=JSON.stringify(c.targetIds||[]);if(previous&&previous.key===key)previous.indexes.push(i);else out.push({key,targetIds:c.targetIds||[],indexes:[i]});});return out;}
 function sharedDetails(visible){
  const targets=new Set(visible.flatMap(c=>c.targetIds||[]));if(targets.size<2)return [];
  return visible.flatMap((c,i)=>(c.targetIds?.length>1||/^(Damage|Healing)( roll)?$/i.test(c.name||'')&&/\d+d\d+\s*\[/i.test(c.value||''))?[i]:[]);
 }
 function layout(content,properties=[],showSilenced=false){
  const visible=(content||[]).filter(c=>showSilenced||!c.silenced),actions=properties.filter(p=>['action','spell'].includes(p.type)),index=visible.findIndex(c=>actions.some(p=>text(p.name)===text(c.name))),titleIndex=index<0?0:index,title=visible[titleIndex]?.name;
  if(!title)return null;
  const same=visible.map((c,i)=>({c,i})).filter(({c})=>text(c.name)===text(title)),known=new Set(properties.filter(p=>text(p.name)===text(title)).flatMap(p=>[p.description?.value,p.description?.text]).filter(Boolean).map(text));
  const narrative=same.find(({c})=>c.value&&(known.has(text(c.value))||text(c.value).length>=80&&same.filter(({c:other})=>text(other.value)===text(c.value)).length>1)),source=actions.find(p=>text(p.name)===text(title)),description=narrative?.c.value||source?.description?.value||source?.description?.text;
  if(!description)return null;
  const hidden=same.filter(({c,i})=>text(c.value)===text(description)||i===titleIndex&&!c.value).map(({i})=>i);
  return {title,description,titleIndex,descriptionIndex:narrative?.i??null,hidden,visible,groups:groups(visible)};
 }
 return {layout,groups,sharedDetails};
});
