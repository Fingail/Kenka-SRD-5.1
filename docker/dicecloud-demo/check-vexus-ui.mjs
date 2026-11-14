// Public tools only; test results and local login remain in ignored storage.
import {chromium} from '/work/node_modules/playwright/index.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const access=JSON.parse(readFileSync('/gm-access.json'));
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage({viewport:{width:1500,height:1050}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:18084/');await page.waitForFunction(()=>window.Meteor?.status()?.connected);
 await page.evaluate(a=>new Promise((ok,no)=>Meteor.loginWithPassword(a.username,a.password,e=>e?no(Error(e.reason)):ok())),access);
 await page.goto('http://127.0.0.1:18084/kanka-tabletop/workshop');
 await page.getByRole('button',{name:'Create character',exact:true}).click();
 await page.getByRole('textbox',{name:'Character name',exact:true}).fill('Vexus UI acceptance '+Date.now());
 await page.getByRole('button',{name:'Start draft',exact:true}).click();
 await page.getByRole('button',{name:'Choose Sources',exact:true}).waitFor({timeout:60000});
 await page.getByRole('button',{name:'Choose Background',exact:true}).click();
 const search=page.getByRole('textbox',{name:'Search choices',exact:true});await search.fill('Soldier');
 const soldier=page.getByRole('button',{name:'Select Soldier',exact:true});await soldier.waitFor();assert.equal(await soldier.isEnabled(),true);
 await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.getByRole('button',{name:'Choose Sources',exact:true}).click();
 await page.getByRole('textbox',{name:'Search choices',exact:true}).fill("Sword Coast Adventurer's Guide");
 await page.getByRole('button',{name:"Select Sword Coast Adventurer's Guide",exact:true}).click();
 await page.waitForFunction(()=>window.diceCharacterWorkshop.current()?.events.some(e=>e.type==='choice'&&e.slot==='Sources'));
 await page.getByRole('button',{name:'Choose Background',exact:true}).click();
 await page.getByRole('textbox',{name:'Search choices',exact:true}).fill('Far Traveler');
 const option=page.getByRole('button',{name:'Select Far Traveler',exact:true});await option.waitFor();assert.equal(await option.isEnabled(),true);
 await page.screenshot({path:'/demo-data/workshop-backgrounds.png',fullPage:true});
 assert.deepEqual(errors,[]);
 const result={passed:true,core_background_enabled:true,additional_source_selection:true,additional_background_enabled:true,draftId:await page.evaluate(()=>window.diceCharacterWorkshop.current().id),errors};
 writeFileSync('/demo-data/ui-test-result.json',JSON.stringify(result,null,2),{mode:0o600});console.log(JSON.stringify(result));
}finally{await browser.close();}
