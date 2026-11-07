// SPDX-License-Identifier: GPL-3.0-only
import {chromium} from '/work/node_modules/playwright/index.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const access=JSON.parse(readFileSync('/gm-access.json')),cfg=JSON.parse(readFileSync('/test-data/native-config.json'));
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--ignore-gpu-blocklist','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1700,height:1100}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(cfg.dcPublic);await page.waitForFunction(()=>window.Meteor?.status()?.connected,undefined,{timeout:60000});
 await page.evaluate(a=>new Promise((resolve,reject)=>Meteor.loginWithPassword(a.username,a.password,e=>e?reject(Error(e.reason||e.message)):resolve())),access);
 await page.goto(cfg.dcPublic+cfg.route+'/');await page.waitForURL(/\/tabletop\//);
 await page.locator('.tabletop-creature-card').first().waitFor({timeout:60000});
 assert.equal(await page.locator('.tabletop-creature-card').count(),11);
 await page.frameLocator('#native-dr-map').locator('canvas').first().waitFor({timeout:60000});
 assert.equal(await page.locator('#sheetHost,#tracker,#logHost').count(),0);
 const mapBounds=await page.locator('#native-dr-map').boundingBox();assert.equal(mapBounds.x,0);assert.equal(mapBounds.y,0);assert.equal(mapBounds.width,1700);assert.equal(mapBounds.height,1100);
 await page.locator('.tabletop-creature-card').filter({hasText:'Lux'}).click();
 await page.locator('.selected-creature-bar').waitFor();
 const data=await page.evaluate(()=>{const c=Meteor.connection._mongo_livedata_collections;return {creatures:c.creatures.find({tabletopId:location.pathname.split('/').pop()}).fetch(),props:c.creatureProperties.find({removed:{$ne:true}}).fetch()};});
 const pc=data.creatures.find(c=>c.name.startsWith('Lux')),bear=data.creatures.find(c=>c.name==='Black Bear');const ram=data.props.find(p=>p.root?.id===pc._id&&p.type==='action'&&p.name==='Ram');assert.ok(ram);
 assert.equal(data.props.some(p=>p.root?.id===pc._id&&p.name==='Potion of Healing (demo ∞)'),false);
 const bearHP=data.props.find(p=>p.root?.id===bear._id&&p.variableName==='hitPoints');assert.ok(bearHP);
 const call=(method,args)=>page.evaluate(({method,args})=>new Promise((resolve,reject)=>Meteor.call(method,args,(e,v)=>e?reject(Error(e.reason||e.message)):resolve(v))),{method,args});
 await call('creatureProperties.update',{_id:bearHP._id,path:['damage'],value:0});await page.waitForFunction(id=>{const p=Meteor.connection._mongo_livedata_collections.creatureProperties.findOne(id);return p.damage===0&&p.value===p.total;},bearHP._id,{timeout:30000});
 const previousLogs=await page.locator('.stream-entry').count();
 const hpBefore=await page.evaluate(id=>Meteor.connection._mongo_livedata_collections.creatureProperties.findOne(id).value,bearHP._id);

 await page.locator(`.selected-creature-bar [data-id="${ram._id}"]`).click();
 await page.locator('[data-id="tabletop-action-card"]').waitFor();
 await page.locator('[data-id="tabletop-action-card"] [data-id="do-action-button"]').click();
 await page.locator('.choice-input').waitFor();
 await page.locator('.tabletop-creature-card.dice-available-target').filter({has:page.getByText('Black Bear',{exact:true})}).click();
 const roll=page.locator('#roll-hex');await roll.waitFor();await roll.click();
 await page.getByRole('button',{name:'Done',exact:true}).waitFor({timeout:30000});await page.getByRole('button',{name:'Done',exact:true}).click();
 await page.waitForFunction(n=>document.querySelectorAll('.stream-entry').length>n,previousLogs,{timeout:30000});
 await page.waitForTimeout(1000);
 const logs=await page.locator('.stream-entry').allTextContents();const attackLog=logs.find(t=>/Ram|Horn strike/.test(t));assert.ok(attackLog,'Native log missing attack');const hpAfter=await page.evaluate(id=>Meteor.connection._mongo_livedata_collections.creatureProperties.findOne(id).value,bearHP._id);if(/Miss!/.test(attackLog))assert.equal(hpAfter,hpBefore,'Native miss applied damage');else assert.ok(hpAfter<hpBefore,'Native hit applied no damage');await call('creatureProperties.update',{_id:bearHP._id,path:['damage'],value:0});
 assert.deepEqual(errors,[]);
 await page.screenshot({path:'/test-data/native-gm.png',fullPage:true});
 const nativeUrl=page.url();const playerPage=await browser.newPage({viewport:{width:1700,height:1100}});playerPage.on('pageerror',e=>errors.push(e.message));await playerPage.goto(cfg.dcPublic);await playerPage.waitForFunction(()=>window.Meteor?.status()?.connected);await playerPage.evaluate(a=>new Promise((resolve,reject)=>Meteor.loginWithPassword(a.username,a.password,e=>e?reject(Error(e.reason||e.message)):resolve())),cfg.player);await playerPage.goto(nativeUrl);await playerPage.locator('.tabletop-creature-card').first().waitFor();assert.equal(await playerPage.locator('.tabletop-creature-card').count(),11);await playerPage.frameLocator('#native-dr-map').locator('canvas').first().waitFor({timeout:60000});await playerPage.locator('.tabletop-creature-card').filter({hasText:'Lux'}).click();await playerPage.locator('.selected-creature-bar').waitFor();assert.equal(await playerPage.locator('#sheetHost,#tracker,#logHost').count(),0);assert.deepEqual(errors,[]);await playerPage.screenshot({path:'/test-data/native-player.png',fullPage:true});

 writeFileSync('/test-data/native-result.json',JSON.stringify({passed:true,url:page.url(),native_cards:11,player_access:true,native_action_dialog:true,native_roll_log:true,damage_matches_hit:true,dr_map:true,full_screen_map:true,custom_controls:false,errors},null,2),{mode:0o600});
 console.log('Native DiceCloud tabletop browser check passed.');
}catch(e){for(const p of browser.contexts().flatMap(c=>c.pages())){await p.screenshot({path:'/test-data/native-failure.png',fullPage:true}).catch(()=>{});console.log((await p.locator('body').innerText()).slice(-4000));}throw e;}finally{await browser.close();}
