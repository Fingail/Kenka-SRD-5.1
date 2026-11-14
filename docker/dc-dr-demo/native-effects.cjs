// SPDX-License-Identifier: GPL-3.0-only
// Native conditions: one active copy, source-defined saves and recurring damage.
const abilities={str:'strength',strength:'strength',dex:'dexterity',dexterity:'dexterity',con:'constitution',constitution:'constitution',int:'intelligence',intelligence:'intelligence',wis:'wisdom',wisdom:'wisdom',cha:'charisma',charisma:'charisma'};
const identity=b=>String(b.name||'Condition').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
const textOf=b=>String(b.description?.text||b.description?.value||'').replace(/[‐‑–—]/g,'-');
const timingOf=text=>/start|beginning/i.test(text)?'start of turn':/end/i.test(text)?'end of turn':'manual';
function rules(b){
 const tags=b.tags||[],text=textOf(b),tag=tags.find(t=>t.startsWith('dcdr-save:'));
 let save=null;if(tag){const [,ability,dc]=tag.split(':');if(abilities[ability]&&Number.isFinite(Number(dc)))save={ability:abilities[ability],dc:Number(dc),endsOnSuccess:tags.includes('dcdr-end-on-success'),timing:tags.includes('dcdr-end-turn')?'end of turn':tags.includes('dcdr-start-turn')?'start of turn':'manual'};}
 // Infer only an explicit DC/ability, never a guessed DC or a generic attack's damage.
 if(!save){const match=/DC\s*(\d+)\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+saving throw/i.exec(text);if(match){const repeat=/(?:repeat|make|attempt)[^.]{0,120}saving throw[^.]*|(?:start|end|beginning) of[^.]{0,65}turn[^.]{0,100}saving throw[^.]*/ig;const parts=[...text.matchAll(repeat)].map(m=>m[0]).join(' ');save={ability:abilities[match[2].toLowerCase()],dc:Number(match[1]),timing:timingOf(parts),endsOnSuccess:/(?:end(?:ing|s)?|remov(?:e|ed|ing))[^.]{0,90}(?:success|succeed)|(?:success|succeed)[^.]{0,90}(?:end|remove|no longer)/i.test(text)};}}
 let damage=null;
 const explicit=tags.find(t=>t.startsWith('dcdr-recurring:'));
 if(explicit){try{const d=JSON.parse(explicit.slice('dcdr-recurring:'.length));if(typeof d.formula==='string'&&/^[\ddD+*()\s/-]+$/.test(d.formula)&&typeof d.type==='string'&&['start of turn','end of turn','manual'].includes(d.timing)&&['none','negates','half'].includes(d.save||'none'))damage={...d,save:d.save||'none'};}catch(_) {}}
 if(!damage){for(const sentence of text.split(/\.(?:\s|$)/)){const turn=/(start|beginning|end) of (?:each of )?(?:its|their|the (?:target|creature)'s|each) turns?/i.exec(sentence);const amount=/(?:takes?|taking|suffers?|suffering)\s+(?:\d+\s*\(\s*)?(\d+d\d+(?:\s*[+-]\s*\d+)?|\d+)\s*\)?\s+(acid|bludgeoning|cold|fire|force|lightning|necrotic|piercing|poison|psychic|radiant|slashing|thunder) damage/i.exec(sentence);if(!turn||!amount)continue;damage={formula:amount[1],type:amount[2].toLowerCase(),timing:timingOf(turn[1]),save:/half as much|half damage/i.test(sentence)?'half':/failed sav(?:e|ing throw)|on a failure|fails? (?:the |its )?(?:saving throw|save)/i.test(sentence)?'negates':'none'};break;}}
 return {save,damage};
}
function unique(buffs){const groups=new Map();for(const b of buffs){const key=identity(b),previous=groups.get(key);if(!previous||(rules(b).save?.dc||0)>=(rules(previous).save?.dc||0))groups.set(key,b);}return [...groups.values()];}
const stamp=(s,kind)=>s.phase==='active'?s.session+':'+s.turn+':'+kind:null;
const already=(meta,s,kind)=>!!stamp(s,kind)&&meta?.[kind]===stamp(s,kind);
const outcome=(total,save)=>({success:total>=save.dc,remove:total>=save.dc&&save.endsOnSuccess});
module.exports={identity,rules,unique,stamp,already,outcome};
