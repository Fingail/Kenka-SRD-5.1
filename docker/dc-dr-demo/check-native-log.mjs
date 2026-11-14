// SPDX-License-Identifier: GPL-3.0-only
// Read-only historical logs and cloned native preview; no encounter actions.
import {chromium} from '/work/node_modules/playwright/index.mjs';
import {readFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
const cfg=JSON.parse(readFileSync('/test-data/native-config.json')),access=JSON.parse(readFileSync('/gm-access.json'));
const browser=await chromium.launch({headless:true});
async function session(credentials){const page=await browser.newPage({viewport:{width:1700,height:1100}});await page.goto(cfg.dcPublic);await page.waitForFunction(()=>window.Meteor?.status()?.connected);await page.evaluate(a=>new Promise((ok,no)=>Meteor.loginWithPassword(a.username,a.password,e=>e?no(Error(e.reason)):ok())),credentials);await page.goto(cfg.dcPublic+cfg.route+'/');await page.waitForFunction(()=>window.diceNativeCombatState?.()?.actors.length&&window.diceFloatingSheets&&window.diceSharedLuckyPreview);return page;}
try{
 const page=await session(access);
 if(existsSync('/test-data/fire-breath-log-recovery.json')){const recovery=JSON.parse(readFileSync('/test-data/fire-breath-log-recovery.json'));
 await page.waitForFunction(id=>!!Meteor.connection._mongo_livedata_collections.creatureLogs.findOne({actionId:id}),recovery.recoveryId);
 await page.locator('.stream-entry[data-id="'+recovery.recoveryId+'"]').waitFor();
 const restored=await page.evaluate(id=>{const log=Meteor.connection._mongo_livedata_collections.creatureLogs.findOne({actionId:id});const targets=log.content[0].targetIds;return {entries:log.content.length,targets:targets.length,saveTargets:log.content.filter(c=>c.name==='Failed save'||c.name==='Successful save').map(c=>c.targetIds[0]),visible:!!document.querySelector('.stream-entry[data-id="'+id+'"]')};},recovery.recoveryId);
 assert.equal(restored.entries,35);assert.equal(restored.targets,8);assert.equal(new Set(restored.saveTargets).size,8);assert.equal(restored.visible,true);const shared=await page.evaluate(id=>{window.diceFormatBattleLogs();const row=document.querySelector('.stream-entry[data-id="'+id+'"]'),name=[...row.querySelectorAll('.content-name')].find(n=>n.textContent.trim()==='Damage'),item=name.parentElement,group=item.parentElement.parentElement,rail=group.querySelector('.content-target-ids');return {sharedMarked:item.classList.contains('dice-log-shared-detail'),portraitBelowShared:!rail||getComputedStyle(rail).display==='none'||rail.getBoundingClientRect().top+parseFloat(rail.style.paddingTop||0)>=item.getBoundingClientRect().bottom-5};},recovery.recoveryId);assert.equal(shared.sharedMarked,true);assert.equal(shared.portraitBelowShared,true);console.log('Recovered Fire Breath visible; shared damage dice have no adjacent tokens.');}
 await page.waitForFunction(()=>[...document.querySelectorAll('.stream-entry')].some(e=>e.querySelector('.dice-log-action-title')?.textContent==='Frightful Presence'));
 const result=await page.evaluate(()=>{
  const row=[...document.querySelectorAll('.stream-entry')].find(e=>e.querySelector('.dice-log-action-title')?.textContent==='Frightful Presence');
  const model=row.__vue__?.model||Meteor.connection._mongo_livedata_collections.creatureLogs.findOne({actionId:row.dataset.id});
  const dialog=document.createElement('section');dialog.className='action-dialog';dialog.style.cssText='position:fixed;left:20px;top:50px;width:650px;height:80vh;overflow:auto;background:#303030;z-index:99999';const preview=document.createElement('div');preview.className='log-preview';const copy=row.cloneNode(true);copy.classList.remove('stream-entry','dice-log-condensed');copy.querySelector(':scope>.dice-log-shared-description')?.remove();for(const e of copy.querySelectorAll('.dice-log-description-duplicate,.dice-log-empty-group,.dice-log-repeated-target'))e.classList.remove('dice-log-description-duplicate','dice-log-empty-group','dice-log-repeated-target');for(const e of copy.querySelectorAll('.content-target-ids')){e.style.alignSelf='';e.style.paddingTop='';}copy.__vue__={model};preview.append(copy);dialog.append(preview);document.body.append(dialog);window.diceFormatBattleLogs();
  const check=root=>({customTokens:root.querySelectorAll('.dice-log-result-tokens').length,nativeTokens:[...root.querySelectorAll('.content-target-ids .v-avatar')].filter(e=>e.getClientRects().length).length,headerPortrait:!!root.querySelector(':scope>.v-list-item .v-avatar')&&getComputedStyle(root.querySelector(':scope>.v-list-item .v-avatar')).display!=='none',summaries:root.querySelectorAll(':scope>.dice-log-shared-description').length});const out={battleLog:check(row),attackPreview:check(copy)};dialog.remove();return out;
 });
 for(const data of Object.values(result)){assert.equal(data.customTokens,0);assert.ok(data.nativeTokens>0);assert.equal(data.headerPortrait,true);}
 assert.equal(result.battleLog.summaries,1);assert.equal(result.attackPreview.summaries,0);console.log(JSON.stringify(result));
}finally{await browser.close();}
