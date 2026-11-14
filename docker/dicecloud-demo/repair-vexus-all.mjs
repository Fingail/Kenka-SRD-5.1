// Apply the reviewed local source-bundle repair through owner-authenticated native methods.
import {chromium} from '/work/node_modules/playwright/index.mjs';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
const base='/demo-data',patch=JSON.parse(readFileSync(base+'/all-books-patch.json'));
const access=JSON.parse(readFileSync('/gm-access.json')),browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage();await page.goto('http://127.0.0.1:18084');
 await page.waitForFunction(()=>window.Meteor?.status()?.connected);
 await page.evaluate(a=>new Promise((ok,no)=>Meteor.loginWithPassword(a.username,a.password,e=>e?no(Error(e.reason||e.message)):ok())),access);
 const call=(method,args)=>page.evaluate(({method,args})=>new Promise((ok,no)=>Meteor.call(method,args,(e,v)=>e?no(Error(e.reason||e.message)):ok(v))),{method,args});
 await page.evaluate(id=>new Promise((ok,no)=>Meteor.subscribe('libraryNodes',id,['name','description','ref','parentId','slotFillerCondition','slotFillerConditionNote','fillSlots','libraryTags','root'],{onReady:ok,onStop:e=>e&&no(Error(e.reason||e.message))})),patch.rootId);
 const before=await page.evaluate(p=>{const c=Meteor.connection._mongo_livedata_collections.libraryNodes;return [p.bundleId,...p.removeIds,p.homebrewId].map(id=>c.findOne(id)).filter(Boolean);},patch);
 const bundle=before.find(n=>n._id===patch.bundleId);assert.ok(bundle);assert.ok(['# Bundle: All',patch.name].includes(bundle.name));
 for(const node of before.filter(n=>patch.removeIds.includes(n._id)))assert.equal(node.parentId,patch.bundleId);
 const backup=base+'/all-books-before.json';if(!existsSync(backup))writeFileSync(backup,JSON.stringify(before,null,2),{mode:0o600});
 // Keep the bundle unavailable until its excluded children have been removed.
 for(const id of patch.removeIds)if(before.some(n=>n._id===id))await call('libraryNodes.update',{_id:id,path:['removed'],value:true});
 for(const [path,value] of [[['name'],patch.name],[['description','text'],patch.description],[['slotFillerConditionNote'],null],[['slotFillerCondition'],null]])await call('libraryNodes.update',{_id:patch.bundleId,path,value});
 await page.waitForFunction(p=>{const c=Meteor.connection._mongo_livedata_collections.libraryNodes,n=c.findOne(p.bundleId);return n?.name===p.name&&!n.slotFillerCondition&&p.removeIds.every(id=>!c.findOne(id)||c.findOne(id).removed);},patch);
 assert.ok(await page.evaluate(id=>Meteor.connection._mongo_livedata_collections.libraryNodes.findOne(id),patch.homebrewId),'Standalone Homebrew source preserved');
 const api=(op,body={})=>page.evaluate(async({op,body})=>{const r=await fetch('/kanka-tabletop/api/workshop/'+op,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+localStorage.getItem('Meteor.loginToken')},body:JSON.stringify(body)}),v=await r.json();if(!r.ok)throw Error(v.error);return v;},{op,body});
 const home=await api('home'),original=home.characters.filter(c=>c.inTabletop||c.id===home.sourceLuxId);
 let draft=await api('start',{name:'Vexus — All installed books verification'});
 const sources=draft.slots.find(s=>s.name==='Sources'),options=await api('options',{draftId:draft.id,slotId:sources.id,search:'All installed'}),all=options.choices.find(c=>c.id===patch.bundleId);
 assert.ok(all?.eligible,'Repaired bundle is selectable');
 draft=await api('choose',{draftId:draft.id,revision:draft.revision,slotId:sources.id,nodeId:all.id});
 const bg=draft.slots.find(s=>s.name==='Background'),checks=[];
 for(const name of ["Acolyte (Baldur's Gate)",'Far Traveler','Astral Drifter','Feylost']){
  const choices=await api('options',{draftId:draft.id,slotId:bg.id,search:name}),option=choices.choices.find(c=>c.name===name);
  assert.ok(option?.eligible,'Book source enabled for '+name);checks.push(name);
 }
 const sourcesAfter=await api('options',{draftId:draft.id,slotId:sources.id,search:'Homebrew'});
 assert.ok(sourcesAfter.choices.some(c=>c.name==='!! Homebrew'&&c.eligible),'Homebrew remains separately selectable');
 assert.deepEqual((await api('home')).characters.filter(c=>c.inTabletop||c.id===home.sourceLuxId),original);
 const result={passed:true,bundleId:patch.bundleId,name:patch.name,draftId:draft.id,creatureId:draft.creatureId,backgroundsUnlocked:checks,standaloneHomebrew:true,originalAndLiveCharactersUnchanged:true};
 writeFileSync(base+'/all-books-repair-result.json',JSON.stringify(result,null,2),{mode:0o600});console.log(JSON.stringify(result));
}finally{await browser.close();}
