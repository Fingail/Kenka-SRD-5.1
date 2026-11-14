// Read-only Kanka snapshot -> separate native DiceCloud Ranger advancement test.
// Source data and generated campaign properties stay under the private data mount.
import { chromium } from '/work/node_modules/playwright/index.mjs';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const dir = process.argv[2] || '/demo-data/lux';
const source = JSON.parse(readFileSync(dir + '/kanka-source.json'));
const sheet = JSON.parse(readFileSync(dir + '/battle-ready.json'));
const access = JSON.parse(readFileSync('/demo-data/access.json'));
const library = JSON.parse(readFileSync('/demo-data/converted-srd-library.json'));
const fields = Object.fromEntries(source.attributes.map(a => [a.name, a.value]));
assert.equal(fields.Class, 'Ranger'); assert.equal(Number(fields.Level), 4);
const stateFile = dir + '/dicecloud-state.json';
const state = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile)) : { steps: {}, log: [] };
assert.ok(!state.sourceEntityId || state.sourceEntityId === source.entity.id);
state.sourceEntityId = source.entity.id;
const sourceHash = createHash('sha256').update(JSON.stringify(source)).digest('hex');
assert.ok(!state.sourceHash || state.sourceHash === sourceHash, 'Source changed: use a fresh private directory to preserve existing advancement edits.');
state.sourceHash = sourceHash;
const save = () => writeFileSync(stateFile, JSON.stringify(state, null, 2), { mode: 0o600 });
save();
const plain = value => String(value || '').replace(/<[^>]*>/g, ' ').replaceAll('&nbsp;', ' ').replaceAll('&amp;', '&').replace(/\s+/g, ' ').trim();
const norm = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const browser = await chromium.launch({ headless: true });
try {
 const page = await browser.newPage({ viewport: { width: 1500, height: 1050 } });
 await page.goto(access.url, { waitUntil: 'domcontentloaded' });
 await page.waitForFunction(() => window.Meteor?.status()?.connected, undefined, { timeout: 60000 });
 await page.evaluate(a => new Promise((r,j) => Meteor.loginWithPassword(a.username,a.password,e=>e?j(Error(e.reason||e.message)):r())),access);
 const call = async (method,args) => { const result = await page.evaluate(({method,args})=>new Promise((r,j)=>Meteor.call(method,args,(e,v)=>e?j(Error(e.reason||e.message)):r(v))),{method,args});await page.waitForTimeout(method==='creatureProperties.update'?450:1100);return result; };
 if (!state.characterId) {
  state.characterId = await call('creatures.insertCreature', { name: source.entity.name + ' — Kanka advancement test', gender:'',alignment:fields.Alignment||'',startingLevel:4,allowedLibraries:[library.mainLibraryId],allowedLibraryCollections:[] }); save();
 }
 await page.goto(access.url+'/character/'+state.characterId,{waitUntil:'domcontentloaded'});
 const data = () => page.evaluate(id => {const c=Meteor.connection._mongo_livedata_collections;return c.creatureProperties.find({'root.id':id,removed:{$ne:true}}).fetch();},state.characterId);
 async function wait(test) {let p;for(let i=0;i<90;i++){p=await data();if(test(p))return p;await page.waitForTimeout(500);}writeFileSync(dir+'/failed-properties.json',JSON.stringify(p),{mode:0o600});throw Error('Character computation did not settle');}
 async function step(key,fn) {if(state.steps[key])return state.steps[key];const result=await fn();state.steps[key]=result||true;save();return result;}
 async function add(key,property,parentId) {return step(key,()=>call('creatureProperties.insert',{creatureProperty:property,parentRef:{collection:parentId?'creatureProperties':'creatures',id:parentId||state.characterId}}));}
 async function insert(key,nodeId,parentId) {return step(key,()=>call('creatureProperties.insertPropertyFromLibraryNode',{nodeIds:[library.idMap[nodeId]],parentRef:{collection:'creatureProperties',id:parentId}}));}
 async function fill(key,name,nodeId) {if(state.steps[key])return;const p=await wait(p=>p.some(x=>x.type==='propertySlot'&&x.name===name));await insert(key,nodeId,p.find(x=>x.type==='propertySlot'&&x.name===name)._id);}
 const update = (id,path,value)=>call('creatureProperties.update',{_id:id,path,value});
 const remove = id=>call('creatureProperties.softRemove',{_id:id});
 const attr = (p,name)=>p.find(x=>x.type==='attribute'&&x.variableName===name);
 await wait(p=>p.some(x=>x.variableName==='strength'));
 await fill('manualScores','Base Ability Scores','ddpe46kcRDTfgdyFm');
 await step('scores',async()=>{const p=await wait(p=>p.some(x=>x.type==='pointBuy'&&x.name==='Base Ability Scores'));const table=p.find(x=>x.type==='pointBuy'&&x.name==='Base Ability Scores');const names={str:'Strength',dex:'Dexterity',con:'Constitution',int:'Intelligence',wis:'Wisdom',cha:'Charisma'};await update(table._id,['values'],Object.entries(names).map(([key,name])=>({name,variableName:'unmodified'+name,value:sheet.stats.abilities[key]})));});
 const review = await add('review',{type:'note',name:'Import review — recorded totals and unresolved choices',description:{text:'Current Kanka ability scores include prior ancestry/ASI choices and are used without adding those bonuses again. Historical allocation and Lucky timing are unconfirmed; level-4 ASI stays a review placeholder. Average HP is used for this test path, not asserted as historical rolls. Known spells and Canny skill are unconfirmed. Recorded Perception +5 is preserved without selecting expertise. Performance +1 is preserved despite Reveler proficiency conflict. Remaining resource uses, glove attunement and historical choices require review. Source: '+access.url.replace(':18084',':18081')+'/w/2/entities/'+source.entity.id}});
 if(!state.satyrLibraryId){state.satyrLibraryId=await call('libraries.insert',{name:'Campaign races — Satyr',description:'Private reusable race template from campaign-owned Kanka records. Not part of the SRD; do not redistribute source text. Only recorded traits are implemented; ancestry ability-score allocation is not documented and is not inferred.',public:false,readers:[],writers:[]});state.satyrNodes={};save();}
 async function raceNode(key,parent,property){if(state.satyrNodes[key])return state.satyrNodes[key];const id=await call('libraryNodes.insert',{libraryNode:property,parentRef:parent?{collection:'libraryNodes',id:state.satyrNodes[parent]}:{collection:'libraries',id:state.satyrLibraryId}});state.satyrNodes[key]=id;save();return id;}
 await raceNode('satyr',null,{type:'folder',name:source.races[0]?.name||'Satyr',fillSlots:true,searchable:true,libraryTags:['LoV','race'],slotFillerType:'folder',description:{text:plain(source.races[0]?.entry)+' Campaign template: speed 35 ft; Ram, Mirthful Leaps and Reveler from the character records. Ability-score bonuses are not specified by these sources, so none are applied. Enter recorded scores or confirm ancestry allocation separately. Other unrecorded Satyr traits require review.'}});
 await raceNode('speed','satyr',{type:'effect',name:'Satyr speed',stats:['speed','unmodifiedSpeed'],operation:'base',amount:{calculation:'35'}});
 await raceNode('size','satyr',{type:'effect',name:'Medium size',stats:['unmodifiedCreatureSize'],operation:'base',amount:{calculation:'3'}});
 await raceNode('feyType','satyr',{type:'effect',name:'Fey creature type',stats:['creatureType'],operation:'base',amount:{calculation:'7'}});
 await raceNode('identity','satyr',{type:'constant',name:'Race',variableName:'race',calculation:JSON.stringify(source.races[0]?.name||'Satyr')});
 for(const name of ['Ram','Mirthful Leaps','Reveler']){const ability=source.abilities.find(a=>a.name===name);assert.ok(ability);await raceNode('trait-'+name,'satyr',{type:'feature',name,description:{text:plain(ability.entry)}});}
 await raceNode('revelerProficiency','trait-Reveler',{type:'proficiency',name:'Reveler proficiency',stats:['performance','persuasion'],value:1});
 await raceNode('instrument','trait-Reveler',{type:'propertySlot',name:'Reveler musical instrument',quantityExpected:{calculation:'1'},slotTags:['musicalInstrumentProficiency','LoV'],description:{text:'Choose one musical instrument proficiency; source ownership is separate.'}});
 await raceNode('ramAttack','trait-Ram',{type:'action',name:'Ram',actionType:'attack',target:'singleTarget',attackRoll:{calculation:'strength.modifier + proficiencyBonus'},summary:{text:'Horn strike; 1d4 + Strength modifier bludgeoning.'}});
 await raceNode('ramDamage','ramAttack',{type:'damage',name:'Ram damage',target:'target',damageType:'bludgeoning',amount:{calculation:'1d4 + strength.modifier'}});
 await raceNode('leapAction','trait-Mirthful Leaps',{type:'action',name:'Mirthful Leaps',actionType:'free',target:'self',summary:{text:'Add the d8 result in feet to a jump; spend movement normally.'}});
 await raceNode('leapRoll','leapAction',{type:'roll',name:'Extra jump distance (feet)',variableName:'mirthfulLeapDistance',roll:{calculation:'1d8'}});
 await step('satyrLibraryAllowed',()=>call('creatures.changeAllowedLibraries',{_id:state.characterId,allowedLibraries:[library.mainLibraryId,state.satyrLibraryId],allowedLibraryCollections:[]}));
 await call('users.subscribeToLibrary',{libraryId:state.satyrLibraryId,subscribe:true});
 await step('satyrLibraryRace',async()=>{if(state.steps.ancestry)await remove(state.steps.ancestry);const slot=(await data()).find(x=>x.type==='propertySlot'&&x.name==='Race');return call('creatureProperties.insertPropertyFromLibraryNode',{nodeIds:[state.satyrNodes.satyr],parentRef:{collection:'creatureProperties',id:slot._id}});});
 if(!(await data()).some(x=>x.type==='effect'&&x.name==='Fey creature type'))await add('linkedFeyType',{type:'effect',name:'Fey creature type',stats:['creatureType'],operation:'base',amount:{calculation:'7'}},state.steps.satyrLibraryRace);
 const bgSlot=(await data()).find(x=>x.type==='propertySlot'&&x.name==='Background');
 await add('background',{type:'feature',name:fields.Background,description:{text:'Recorded Kanka background. Skills, tools and Criminal Contact are preserved from the character record; no inferred additional proficiencies.'}},bgSlot._id);
 await fill('ranger1','Starting Class','ACzoNwsNjZqhPsJEW');
 async function snapshot(level) {if(state.log.some(x=>x.level===level))return;const p=await wait(p=>p.some(x=>x.type==='class'&&x.variableName==='ranger'&&x.level===level)&&attr(p,'hitPoints')?.total===12+(level-1)*8);if(!state.log.some(x=>x.level===level)){state.log.push({level,hp:attr(p,'hitPoints').total,scores:Object.fromEntries(['strength','dexterity','constitution','intelligence','wisdom','charisma'].map(n=>[n,attr(p,n)?.value]))});save();}}
 await snapshot(1);
 async function advance(level,nodeId) {
  if(state.steps['level'+level])return;
  await page.getByRole('tab',{name:'Build',exact:true}).click();
  const ranger=(await data()).find(x=>x.type==='class'&&x.variableName==='ranger');assert.equal(ranger.level,level-1);
  await page.getByRole('button',{name:'Level Up',exact:true}).first().click();
  const panel=page.locator(`[data-id="${library.idMap[nodeId]}"]`);await panel.locator('.v-input--selection-controls__ripple').click();await page.getByRole('button',{name:'Insert',exact:true}).click();
  await wait(p=>p.some(x=>x.type==='class'&&x.variableName==='ranger'&&x.level===level));state.steps['level'+level]=true;save();await snapshot(level);
 }
 await advance(2,'yjg9rMTHSq8tJtc7b');
 await fill('archery','Fighting Style','QperSdKXNgvXKobu6');
 await advance(3,'ZPk3jcRke5odyHSxG');

 await fill('hunter','Ranger Archetype','dSHx77o6DkXhLGvzx');
 await fill('colossus',"Hunter's Prey Choice",'cjYzpko5pfrbFrsEk');
 await fill('spellStructure',"Jon's Spell Slot Structure",'kcHSFYNSW9EMjLAFk');
 await advance(4,'rJ6XTLtFgBtDCo3eK');

 await fill('spellcastingType','[JSSS] Spellcasting Type','dH3BwGwGpd4FtT62E');
 const importedChoices=await add('importedChoices',{type:'folder',name:'Recorded Kanka choices — review history',description:{text:'Current features and proficiencies from Kanka. Historical feat/ASI and skill-source allocation are not reconstructed.'}});
 const replacements={'Deft Explorer':'Natural/Deft Explorer','Favored Foe':'Favored Enemy/Foe','Primal Awareness':'Primeval/Primal Awareness','Spellcasting Focus':'Level 2 Optional Ranger Features','Martial Versatility':'Level 4 Optional Ranger Features'};
 for(const ability of source.abilities){
  if(/^Reference\b/i.test(ability.assignment_note||'')||ability.type==='Spell')continue;
  const name=ability.name.replace(/^Ranger\s*[—–-]\s*/,'');
  if(['Archery','Fighting Style','Spellcasting',"Hunter’s Prey",'Colossus Slayer','Ram','Mirthful Leaps','Reveler'].includes(name))continue;
  let parent=importedChoices;
  if(replacements[name]){const p=await data();parent=p.find(x=>x.type==='propertySlot'&&x.name===replacements[name])?._id||parent;}
  await add('ability-'+ability.entity_id,{type:'feature',name,description:{text:plain(ability.entry)}},parent);
 }
 const p4=await data();const asi=p4.find(x=>x.type==='propertySlot'&&x.name==='Ability Score Improvement');
 await add('historicalAsi',{type:'feature',name:'Historical ASI / feat allocation — review required',description:{text:'No new bonuses are added: current Kanka scores already include past choices. Lucky is recorded separately; its acquisition timing and any prior ASIs are unconfirmed.'}},asi._id);
 const inst=p4.find(x=>x.type==='propertySlot'&&x.name==='Reveler musical instrument');await add('instrumentChoice',{type:'feature',name:'Viol proficiency (recorded)',description:{text:'Instrument proficiency from Kanka; does not assert instrument ownership.'}},inst._id);
 await add('luck',{type:'attribute',name:'Luck points',variableName:'luckPoints',attributeType:'resource',baseValue:{calculation:'3'},reset:'longRest'},importedChoices);
 await add('favoredFoeUses',{type:'attribute',name:'Favored Foe uses',variableName:'favoredFoeUses',attributeType:'resource',baseValue:{calculation:'proficiencyBonus'},reset:'longRest',description:{text:'Maximum from Kanka; remaining uses were unrecorded. Fresh test starts unused.'}},importedChoices);
 await add('proficiencies',{type:'note',name:'Recorded languages, tools and coins',description:{text:'Languages: '+fields.Languages+'\nTools: '+fields['Tool proficiencies']+'\nCoins: '+fields['Coin balance (true.pdf)']+'\nExisting skill totals are preserved; original class/background allocation is unconfirmed.'}},importedChoices);
 await add('spellsReview',{type:'note',name:'Known spell choices — review required',description:{text:'Do not treat linked references as selected spells. Unconfirmed references: '+source.abilities.filter(a=>/^Reference\b/i.test(a.assignment_note||'')).map(a=>a.name).join(', ')+'. Speak with Animals is separately granted by Primal Awareness.'}},importedChoices);
 const spellList=(await data()).find(x=>x.type==='spellList'&&x.name==='Ranger Spells');
 const speak=source.abilities.find(a=>a.name==='Speak with Animals');
 if(speak)await add('speakWithAnimals',{type:'spell',name:'Speak with Animals — Primal Awareness',level:1,school:'divination',actionType:'action',target:'self',castingTime:'1 action',duration:'10 minutes',alwaysPrepared:true,castWithoutSpellSlots:true,uses:{calculation:'1'},reset:'longRest',description:{text:plain(speak.entry)+' Granted independently of the unresolved known-spell choices; remaining free uses were not recorded.'}},spellList._id);
 await step('skillProficiencies',async()=>{const p=await data();for(const skill of sheet.skills||[]){const prop=p.find(x=>x.type==='skill'&&norm(x.variableName)===norm(skill.id));assert.ok(prop,'Missing skill '+skill.name);await update(prop._id,['baseProficiency'],skill.proficient?1:null);}});
 await wait(p=>p.find(x=>x.variableName==='stealth')?.value===6);
 for(const skill of sheet.skills||[]){const p=await data();const prop=p.find(x=>x.type==='skill'&&norm(x.variableName)===norm(skill.id));const key='skillAdjustment-'+skill.id;if(state.steps[key])continue;const delta=skill.bonus-prop.value;if(delta)await add(key,{type:'effect',name:'Recorded '+skill.name+' reconciliation — review required',stats:[prop.variableName],operation:'add',amount:{calculation:String(delta)},description:{text:'Preserves recorded Kanka bonus '+skill.bonus+' without inferring an unresolved proficiency/expertise selection. Remove this adjustment when the discrepancy is resolved.'}},importedChoices);else{state.steps[key]=true;save();}}
 const itemSlot=(await data()).find(x=>x.type==='propertySlot'&&x.name==='Items');
 for(const row of source.inventory){
  if(row.position==='Reference documents')continue;
  const key='inventory-'+row.item_id;const name=row.name||row.item.name;const n=norm(name);
  const native=n==='longbow'?'sEbWF5NAtDnT8q2eM':n==='shortsword'?'fw9Jv7kk3mexNRweT':n==='handaxe'?'oc64D3bg9PmmR7GRG':n.startsWith('studdedleather')?'mZ6kyGBPFw2QSrm7a':null;
  const equipped=(n.startsWith('studdedleather')&&name.includes('+1'))||['longbow','shortsword','handaxe'].includes(n);
  let id=state.steps[key];
  if(!id){if(native)id=await insert(key,native,itemSlot._id);else id=await add(key,{type:'item',name,quantity:row.amount,equipped:false,description:{text:plain(row.item.entry).slice(0,14000)+' '+plain(row.description)}},itemSlot._id);}
  await step(key+'-properties',async()=>{await update(id,['name'],name);await update(id,['quantity'],row.amount);await update(id,['equipped'],equipped);});
  if(n.startsWith('studdedleather')&&name.includes('+1'))await add(key+'-magic',{type:'effect',name:'+1 armor enchantment',stats:['armor'],operation:'add',amount:{calculation:'1'}},id);
 }
 let p=await wait(p=>attr(p,'armor')?.value===sheet.stats.ac&&attr(p,'hitPoints')?.total===sheet.stats.hp_max);
 const expected=Object.fromEntries(Object.entries({strength:sheet.stats.abilities.str,dexterity:sheet.stats.abilities.dex,constitution:sheet.stats.abilities.con,intelligence:sheet.stats.abilities.int,wisdom:sheet.stats.abilities.wis,charisma:sheet.stats.abilities.cha,armor:sheet.stats.ac,hitPoints:sheet.stats.hp_max,speed:sheet.stats.speed_ft,proficiencyBonus:sheet.stats.proficiency_bonus}));
 for(const [key,value]of Object.entries(expected))assert.equal(attr(p,key)?.value,value,key+' differs from Kanka');
 for(const skill of sheet.skills||[])assert.equal(p.find(x=>x.type==='skill'&&norm(x.variableName)===norm(skill.id))?.value,skill.bonus,skill.name);
 const abilityNames={str:'strength',dex:'dexterity',con:'constitution',int:'intelligence',wis:'wisdom',cha:'charisma'};
 for(const [key,bonus] of Object.entries(sheet.saving_throws||{}))assert.equal(p.find(x=>x.type==='skill'&&x.variableName===abilityNames[key]+'Save')?.value,bonus,key+' saving throw');
 for(const attack of sheet.attacks||[]){const action=p.find(x=>x.type==='action'&&norm(x.name)===norm(attack.name));assert.ok(action,'Missing attack '+attack.name);assert.equal(action.attackRoll?.value,attack.attack_bonus,attack.name+' attack');}
 assert.equal(attr(p,'slotLevel1')?.total,3);assert.equal(attr(p,'creatureType')?.value,7);
 const ids=new Set(p.map(x=>x._id));for(const x of p)if(x.parentId&&x.parentId!==state.characterId)assert.ok(ids.has(x.parentId),'Detached property '+x.name);
 assert.deepEqual(p.filter(x=>x.type==='reference'&&x.cache?.error),[]);
 const nativeSpells=p.find(x=>x.type==='spellList'&&x.name==='Ranger Spells');assert.equal(nativeSpells.dc.value,11);assert.equal(nativeSpells.attackRollBonus.value,3);
 const narrative='Kanka -> DiceCloud test walkthrough\n\n'+state.log.map(x=>'Ranger '+x.level+': '+x.hp+' maximum HP'+(x.level===2?'; Archery':x.level===3?'; Hunter and Colossus Slayer':x.level===4?'; historical ASI/feat remains review-only':'')).join('\n')+'\n\nAverage-HP test path matches the recorded 36 HP. Current total ability scores are retained at every stage because original ancestry/ASI allocation is unrecorded. Level-4 Lucky timing, Canny skill, Performance and known spells remain explicit review flags. Equipment is copied from Kanka; no OCF runtime/demo state is imported.';
 await add('walkthrough',{type:'note',name:'Advancement walkthrough — Kanka comparison',description:{text:narrative}},importedChoices);
 await page.getByRole('tab',{name:'Stats',exact:true}).click();await page.waitForTimeout(1500);
 p=await data();writeFileSync(dir+'/final-properties.json',JSON.stringify(p),{mode:0o600});writeFileSync(dir+'/advancement.md',narrative,{mode:0o600});
 const result={passed:true,character_url:access.url+'/character/'+state.characterId,satyr_library_url:access.url+'/library/'+state.satyrLibraryId,levels:state.log,stats:expected,skills_checked:sheet.skills.length,saving_throws_checked:Object.keys(sheet.saving_throws).length,attacks_checked:sheet.attacks.length,level1_spell_slots:attr(p,'slotLevel1').total,inventory_entries:source.inventory.filter(x=>x.position!=='Reference documents').length,review_required:['known spells','Canny choice','Performance discrepancy','historical ASI/Lucky timing','historical HP rolls','remaining resource uses/glove attunement']};writeFileSync(dir+'/result.json',JSON.stringify(result,null,2),{mode:0o600});console.log(JSON.stringify(result));
 await page.screenshot({path:dir+'/advancement.png',fullPage:true});
} catch(e) {await browser.contexts()[0]?.pages()[0]?.screenshot({path:dir+'/import-failure.png',fullPage:true});throw e;} finally {await browser.close();}
