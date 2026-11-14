// SPDX-License-Identifier: GPL-3.0-only
// Live preferences + isolated two-browser Lucky UI. No native action is run.
import {chromium} from '/work/node_modules/playwright/index.mjs';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const cfg=JSON.parse(readFileSync('/test-data/native-config.json')),access=JSON.parse(readFileSync('/gm-access.json'));
const browser=await chromium.launch({headless:true});
let gm,player,id,original;
async function session(credentials){const page=await browser.newPage({viewport:{width:1700,height:1100}});await page.goto(cfg.dcPublic);await page.waitForFunction(()=>window.Meteor?.status()?.connected);await page.evaluate(a=>new Promise((ok,no)=>Meteor.loginWithPassword(a.username,a.password,e=>e?no(Error(e.reason)):ok())),credentials);await page.goto(cfg.dcPublic+cfg.route+'/');await page.waitForFunction(()=>window.diceNativeCombatState?.()?.actors.length&&window.diceFloatingSheets&&window.diceSharedLuckyPreview);return page;}
const snapshot=p=>p.evaluate(()=>window.diceNativeCombatState().actors.map(a=>[a.id,a.hp]));
try{
 gm=await session(access);console.log('GM ready');player=await session(cfg.player);console.log('Player ready');
 const lux=await gm.evaluate(()=>window.diceNativeCombatState().actors.find(a=>a.name.startsWith('Lux')));id=lux.id;original=lux.luckyEnabled;const before=await snapshot(gm);
 for(const p of [gm,player])await p.evaluate(id=>window.diceFloatingSheets.open(id),id);
 console.log('Sheets opened');const selector=`input[data-lucky-actor="${id}"]`;await gm.locator(selector).waitFor();await player.locator(selector).waitFor();
 assert.equal(await gm.locator(selector).isEnabled(),true);assert.equal(await player.locator(selector).isEnabled(),true);
 await gm.locator(selector).setChecked(!original);await player.waitForFunction(({id,value})=>document.querySelector(`input[data-lucky-actor="${id}"]`)?.checked===value,{id,value:!original});
 await player.locator(selector).setChecked(original);await gm.waitForFunction(({id,value})=>document.querySelector(`input[data-lucky-actor="${id}"]`)?.checked===value,{id,value:original});
 assert.deepEqual(await snapshot(gm),before);console.log('Shared preference passed');
 // Test both real rendered clients against one isolated prompt authority. This
 // exercises polling, first confirmation and resource buttons without spending
 // live luck points or inserting/running an encounter action.
 let prompt;
 const fresh=name=>prompt={id:name,status:'pending',deadline:Date.now()+30000,canDecide:true,actorId:id,actorName:'Lux',kind:'check',original:[[7]],context:{kind:'check',modifier:2},candidates:[{id:'test-resource',actorName:'Lux',name:'Luck points',remaining:3}],spent:null};
 for(const p of [gm,player]){
  await p.exposeFunction('__isolatedLuckyApi',async(op,input)=>{
   if(prompt.status==='pending'){
    if(Date.now()>=prompt.deadline){prompt.status='selected';prompt.dice=[[7]];prompt.timedOut=true;}
    else if(op==='lucky-prompt-keep'){prompt.status='selected';prompt.dice=[[7]];}
    else if(op==='lucky-prompt-spend')prompt.spent={original:[[7]],extra:18};
    else if(op==='lucky-prompt-choice'){prompt.status='selected';prompt.dice=[[input.choice===1?18:7]];}
   }
   return {prompt:{...prompt,serverTime:Date.now()}};
  });
  await p.evaluate(()=>{window.__realLuckyApi=window.diceLuckyApi;window.diceLuckyApi=(op,input)=>window.__isolatedLuckyApi(op,input);});
 }
 for(const [name,chooser,spend] of [['test-player-choice',player,false],['test-gm-choice',gm,true]]){
  console.log('Prompt '+name);fresh(name);for(const p of [gm,player])await p.evaluate(prompt=>window.diceRenderLuckyPrompts([prompt]),{...prompt,serverTime:Date.now()});
  for(const p of [gm,player])await p.locator(`dialog[data-prompt-id="${name}"]`).waitFor();
  const dialog=chooser.locator(`dialog[data-prompt-id="${name}"]`);
  if(spend){await dialog.getByRole('button',{name:/Reroll —/}).click();await dialog.getByRole('button',{name:'Use new d20 18',exact:true}).click();}else await dialog.getByRole('button',{name:'Keep roll',exact:true}).click();
  for(const p of [gm,player])await p.locator(`dialog[data-prompt-id="${name}"]`).waitFor({state:'detached'});
  assert.deepEqual(prompt.dice,[[spend?18:7]]);
 }
 fresh('test-timeout');prompt.deadline=Date.now()+1000;for(const p of [gm,player])await p.evaluate(prompt=>window.diceRenderLuckyPrompts([prompt]),{...prompt,serverTime:Date.now()});
 for(const p of [gm,player])await p.locator('dialog[data-prompt-id="test-timeout"]').waitFor({state:'detached'});
 assert.equal(prompt.timedOut,true);assert.equal(prompt.spent,null);
 // Historical native log presentation: no log writes or simulated attacks.
 const log=await gm.evaluate(()=>{window.diceFormatBattleLogs();const row=[...document.querySelectorAll('.stream-entry')].find(e=>e.querySelector('.dice-log-action-title')?.textContent==='Frightful Presence');if(!row)return null;return {summaries:row.querySelectorAll(':scope>.dice-log-shared-description').length,hiddenHeader:!!row.querySelector('.dice-log-empty-group'),outcomePortraits:[...row.querySelectorAll('.content-target-ids .v-avatar')].filter(e=>e.getClientRects().length).length};});
 if(log){assert.equal(log.summaries,1);assert.equal(log.hiddenHeader,true);assert.ok(log.outcomePortraits>0);}
 console.log(JSON.stringify({liveCheckboxShared:true,playerAndGmDialogs:true,firstConfirmation:true,rerollChoice:true,timeoutUi:true,hpUnchanged:true,historicalLog:log}));
}finally{
 if(gm&&id&&original!==undefined)await gm.evaluate(async({id,enabled})=>{if(window.__realLuckyApi)window.diceLuckyApi=window.__realLuckyApi;await window.diceSetLuckyEnabled(id,enabled);},{id,enabled:original}).catch(()=>{});
 await browser.close();
}
