// SPDX-License-Identifier: GPL-3.0-only
// Keep an already-open tab across deployment; no manual navigation/reload.
import {chromium} from '/work/node_modules/playwright/index.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const access=JSON.parse(readFileSync('/gm-access.json')),cfg=JSON.parse(readFileSync('/test-data/native-config.json'));
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--ignore-gpu-blocklist','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}});
 await page.goto(cfg.dcPublic);await page.waitForFunction(()=>window.Meteor?.status()?.connected);
 await page.evaluate(a=>new Promise((resolve,reject)=>Meteor.loginWithPassword(a.username,a.password,e=>e?reject(Error(e.reason||e.message)):resolve())),access);
 await page.goto(cfg.dcPublic+cfg.route+'/');await page.locator('#native-dr-map').waitFor({timeout:60000});await page.waitForTimeout(1000);
 const url=page.url();
 await page.evaluate(()=>{window.__staleLayoutCanary=true;document.getElementById('native-dr-style').textContent='.tabletop .play-area{position:fixed!important;left:260px!important;top:265px!important;right:455px!important;bottom:220px!important;width:auto!important;height:auto!important}';});
 const before=await page.locator('#native-dr-map').boundingBox();assert.ok(before.width<1600);
 await page.screenshot({path:'/test-data/layout-before-update.png'});
 console.log('Existing-tab update monitor ready.');
 await page.waitForFunction(()=>!window.__staleLayoutCanary&&window.Meteor?.userId()&&document.getElementById('native-dr-map')?.getBoundingClientRect().width===innerWidth,undefined,{timeout:180000});
 await page.frameLocator('#native-dr-map').locator('canvas').first().waitFor({timeout:60000});
 const after=await page.locator('#native-dr-map').boundingBox();assert.deepEqual(after,{x:0,y:0,width:1600,height:1000});assert.equal(page.url(),url);
 const feed=page.locator('.tabletop>.container>.d-flex.align-stretch>.pl-4');const feedBounds=await feed.boundingBox();assert.equal(feedBounds.y,0);assert.equal(feedBounds.width,430);assert.equal(feedBounds.x,1170);assert.equal(feedBounds.height,1000);assert.equal(await feed.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(48, 48, 48)');assert.equal(await page.locator('.initiative-row>.v-btn').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(48, 48, 48)');
 await page.screenshot({path:'/test-data/layout-after-update.png'});
 writeFileSync('/test-data/live-layout-result.json',JSON.stringify({passed:true,automatic_reload:true,full_height_feed:true,dark_grey_feed_and_menu:true,login_preserved:true,url,before,after},null,2),{mode:0o600});
 console.log('Existing tab automatically loaded the full-screen layout and kept its login.');
}finally{await browser.close();}
