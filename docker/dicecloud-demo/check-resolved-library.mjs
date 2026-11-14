import { chromium } from '/work/node_modules/playwright/index.mjs';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';
const base = '/demo-data';
const access = JSON.parse(readFileSync(base + '/access.json'));
const imported = JSON.parse(readFileSync(base + '/converted-srd-library.json'));
const statePath = base + '/resolved-test-state.json';
let state = existsSync(statePath) ? JSON.parse(readFileSync(statePath)) : {};
const save = () => writeFileSync(statePath, JSON.stringify(state, null, 2), { mode: 0o600 });
const browser = await chromium.launch({ headless: true });
try {
 const page = await browser.newPage({ viewport: { width: 1500, height: 1050 } });
 await page.goto(access.url, { waitUntil: 'domcontentloaded' });
 await page.waitForFunction(() => window.Meteor?.status()?.connected, undefined, { timeout: 60000 });
 await page.evaluate(a => new Promise((r,j) => Meteor.loginWithPassword(a.username,a.password,e=>e?j(Error(e.reason||e.message)):r())),access);
 const call = (method,args) => page.evaluate(({method,args}) => new Promise((r,j)=>Meteor.call(method,args,(e,v)=>e?j(Error(e.reason||e.message)):r(v))),{method,args});
 await call('users.subscribeToLibrary', { libraryId: imported.mainLibraryId, subscribe: true });
 if(process.argv.includes('--reset') && state.characterId){await call('Creatures.methods.removeCreature',{charId:state.characterId});state={};save();}
 if (!state.characterId) {
  state.characterId = await call('creatures.insertCreature', { name: 'SRD Human Fighter — Library Test', gender:'',alignment:'',startingLevel:1,allowedLibraries:[imported.mainLibraryId],allowedLibraryCollections:[] });save();
 }
 await page.goto(access.url+'/character/'+state.characterId,{waitUntil:'domcontentloaded'});await page.waitForTimeout(3000);
 async function data() { return page.evaluate(id => {
  const c=Meteor.connection._mongo_livedata_collections;
  return {creatures:c.creatures.find({_id:id}).fetch(),creatureProperties:c.creatureProperties.find({'root.id':id,removed:{$ne:true}}).fetch()};
 },state.characterId); }
 async function waitFor(predicate) { let d;for(let i=0;i<60;i++){d=await data();if(predicate(d))return d;await page.waitForTimeout(500);}writeFileSync(base+'/resolved-character-inspection.json',JSON.stringify(d),{mode:0o600});await page.screenshot({path:base+'/resolved-library-test.png',fullPage:true});console.log((await page.locator('body').innerText()).slice(0,1800));throw Error('Computed character state did not settle'); }
 async function insert(sourceId, parentId) {await call('creatureProperties.insertPropertyFromLibraryNode',{nodeIds:[imported.idMap[sourceId]],parentRef:{collection:'creatureProperties',id:parentId}});await page.waitForTimeout(1500);}
 let d=await data();
 if(!state.baseInserted && d.creatureProperties.some(p=>p.type==='folder'&&p.name==='DiceCloud 5th Edition SRD')){state.baseInserted=true;save();}
 if(!state.baseInserted){const slot=d.creatureProperties.find(p=>p.type==='propertySlot'&&p.name==='Ruleset');assert.ok(slot);await insert('2Kpj3cBptjcLmZSXh',slot._id);state.baseInserted=true;save();}
 d=await waitFor(d=>d.creatureProperties.filter(p=>p.type==='attribute').length>=6);

 const fill = async (key, slotName, sourceId) => {
  if(state[key])return;
  d=await waitFor(d=>d.creatureProperties.some(p=>p.type==='propertySlot'&&p.name===slotName));const slot=d.creatureProperties.find(p=>p.type==='propertySlot'&&p.name===slotName);
  await insert(sourceId,slot._id);state[key]=true;save();
 };
 d=await data();for(const duplicate of d.creatureProperties.filter(p=>p.type==='constant'&&p.variableName==='showSRD').slice(1)){await call('creatureProperties.softRemove',{_id:duplicate._id});await page.waitForTimeout(500);}
 d=await data();const sourceFlag=d.creatureProperties.find(p=>p.type==='constant'&&p.variableName==='showSRD');assert.ok(sourceFlag);await call('creatureProperties.update',{_id:sourceFlag._id,path:['calculation'],value:'true'});await page.waitForTimeout(1000);
 await fill('array','Base Ability Scores','TXbG7NeARWjBBPutF');
 await fill('human','Race','pRh7EuozK5pfAYb3R');
 await fill('humanType','Human Type','ERjjYujjZCfy5RAPM');
 await fill('fighter','Starting Class','gWgREuvHsWGhPhpSY');
 await fill('background','Background','bkJKENg2YnYDL9RFf');

 await fill('style','Fighting Style','QperSdKXNgvXKobu6');
 d=await waitFor(d=>d.creatureProperties.some(p=>p.type==='class'&&p.level>=1));
 if(!state.scoresAssigned){
  for(const [name,score] of Object.entries({Strength:15,Dexterity:14,Constitution:13,Intelligence:12,Wisdom:10,Charisma:8})){
   const attr=d.creatureProperties.find(p=>p.type==='attribute'&&p.variableName==='unmodified'+name);assert.ok(attr,name+' base attribute');
   await call('creatureProperties.update',{_id:attr._id,path:['baseValue','calculation'],value:String(score)});await page.waitForTimeout(500);
  }
  const assignment=d.creatureProperties.find(p=>p.type==='buff'&&p.name==='Assign Stats');if(assignment)await call('creatureProperties.softRemove',{_id:assignment._id});
  state.scoresAssigned=true;save();
 }
 d=await waitFor(d=>d.creatureProperties.find(p=>p.type==='attribute'&&p.variableName==='strength')?.value===16);
 assert.equal(d.creatureProperties.filter(p=>p.type==='folder'&&p.name==='DiceCloud 5th Edition SRD').length,1);
 assert.equal(d.creatureProperties.filter(p=>p.type==='attribute'&&p.variableName==='strength').length,1);
 assert.equal(d.creatureProperties.find(p=>p.type==='attribute'&&p.variableName==='speed').value,30);
 if(!state.levelUpVerified){
  const fighter=d.creatureProperties.find(p=>p.type==='class'&&p.variableName==='fighter');
  if(fighter.level<2){
   await page.getByRole('tab',{name:'Build',exact:true}).click();
   await page.getByRole('button',{name:'Level Up',exact:true}).first().click();
   const panel=page.locator(`[data-id="${imported.idMap.e4mBxAPj4FFTyDjrG}"]`);
   await panel.locator('.v-input--selection-controls__ripple').click();
   await page.getByRole('button',{name:'Insert',exact:true}).click();
  }
  d=await waitFor(d=>d.creatureProperties.find(p=>p.type==='class'&&p.variableName==='fighter')?.level===2);
  state.levelUpVerified=true;save();
 }
 await page.getByRole('tab',{name:'Stats',exact:true}).click();
 d=await waitFor(d=>d.creatureProperties.find(p=>p.type==='attribute'&&p.variableName==='hitPoints')?.total===20);
 const ids=new Set(d.creatureProperties.map(p=>p._id));for(const p of d.creatureProperties)if(p.parentId&&p.parentId!==state.characterId)assert.ok(ids.has(p.parentId),'Detached character property '+p._id);
 const errors=d.creatureProperties.filter(p=>p.type==='reference'&&p.cache?.error);assert.deepEqual(errors,[],'Reference reification errors');
 const result={passed:true,character_url:access.url+'/character/'+state.characterId,library_url:access.url+'/library/'+imported.mainLibraryId,nodes:imported.nodes.length,level_up_verified:true,stats:Object.fromEntries(d.creatureProperties.filter(p=>p.type==='attribute'&&['strength','dexterity','constitution','speed','hitPoints','armor','proficiencyBonus'].includes(p.variableName)).map(p=>[p.variableName,p.value]))};
 writeFileSync(base+'/resolved-browser-result.json',JSON.stringify(result,null,2),{mode:0o600});console.log(JSON.stringify(result));

 writeFileSync(base+'/resolved-character-inspection.json',JSON.stringify(d),{mode:0o600});

 await page.screenshot({path:base+'/resolved-library-test.png',fullPage:true});
}catch(e){console.log((await browser.contexts()[0].pages()[0].locator('body').innerText()).slice(-6000));await browser.contexts()[0].pages()[0].screenshot({path:base+'/resolved-test-failure.png',fullPage:true});throw e;}finally{await browser.close();}
