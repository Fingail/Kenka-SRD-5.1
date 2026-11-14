import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';

const access = JSON.parse(readFileSync('/test-secrets/access.json', 'utf8'));
const fixture = JSON.parse(readFileSync('/test-secrets/ocf-browser-fixture.json', 'utf8'));
const base = 'http://127.0.0.1:18083';
const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
const sheet = page => page.getByRole('complementary', { name: 'Character sheet' });
async function api(page, path, role = 'gm', body) {
  const response = await page.request.fetch(base + '/ocf-api' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: 'Bearer ' + access[role === 'gm' ? 'dm_password' : 'player_password'], 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { data: body }),
  });
  assert.equal(response.ok(), true, await response.text());
  return response.json();
}
async function nativeClick(page,tokenId,role) {
  await page.locator('canvas').first().waitFor();await page.waitForTimeout(1800);
  const response=await page.request.get(base+'/api/active-map',{headers:{Authorization:'Bearer '+access[role==='gm'?'dm_password':'player_password']}});
  const token=(await response.json()).data.activeMap.tokens.find(t=>t.id===tokenId),canvas=await page.locator('canvas').first().boundingBox();
  const scale=Math.min(canvas.width*.95/1920,canvas.height*.95/1080);
  await page.mouse.click(canvas.x+(canvas.width-1920*scale)/2+token.x*scale,canvas.y+(canvas.height-1080*scale)/2+token.y*scale);
}
async function select(page, name) {
  const requestDialog=page.getByRole('dialog',{name:'Out-of-turn roll requests',exact:true});if(await requestDialog.isVisible())await requestDialog.getByRole('button',{name:'Close',exact:true}).click();
  const npcDialog=page.getByRole('dialog',{name:'NPC initiative',exact:true});
  if(await npcDialog.isVisible())await npcDialog.getByRole('button',{name:'Close',exact:true}).click();
  const panel=page.getByRole('region',{name:'Combat log panel',exact:true});
  const expand=panel.getByRole('button',{name:'Expand combat panel',exact:true});if(await expand.count())await expand.click();
  await panel.getByRole('button',{name:'Characters',exact:true}).click();
  await page.getByRole('dialog', { name: 'Encounter characters', exact: true }).getByRole('button', { name, exact: true }).click();
  await sheet(page).getByRole('heading', { name, exact: true }).waitFor();
}
try {
  const gm = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  await gm.addInitScript(({ origin, password }) => { if (location.origin === origin) localStorage.setItem('dmPassword', JSON.stringify(password)); }, { origin: base, password: access.dm_password });
  const page = await gm.newPage(); page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/dm?ocf_encounter=kanka-2-quest-3536'); await page.waitForURL(base + '/dm');
  const bridgeUrl = await page.locator('script[src*="/ocf-bridge.js"]').getAttribute('src');
  assert.match(bridgeUrl, /^\/ocf-bridge\.js\?v=[a-f0-9]{16}$/);
  const bridgeResponse = await page.request.get(base + bridgeUrl);
  assert.match(bridgeResponse.headers()['cache-control'], /no-store/);
  const documentResponse = await page.request.get(base + '/dm');
  assert.match(documentResponse.headers()['cache-control'], /no-store/);
  assert.equal(bridgeResponse.headers()['x-ocf-ui-version'], documentResponse.headers()['x-ocf-ui-version']);
  await page.getByRole('link', { name: 'OCF encounters', exact: true }).waitFor(); await page.waitForTimeout(2000);
  const top = await page.getByRole('link', { name: 'OCF encounters', exact: true }).boundingBox();
  assert.ok(top.x < 200 && top.y < 50);
  assert.equal(await page.getByRole('button',{name:'Stats & rolls',exact:true}).count(),0);
  const live = await page.request.get(base + '/api/active-map', { headers: { Authorization: 'Bearer ' + access.dm_password } });
  const map = (await live.json()).data.activeMap, lux = map.tokens.find(token => token.label === 'Lux');
  const canvas = await page.locator('canvas').first().boundingBox();
  const scale = Math.min(canvas.width * 0.95 / 1920, canvas.height * 0.95 / 1080);
  await page.mouse.click(canvas.x + (canvas.width - 1920 * scale) / 2 + lux.x * scale, canvas.y + (canvas.height - 1080 * scale) / 2 + lux.y * scale);
  await sheet(page).getByRole('heading',{name:'Lux',exact:true}).waitFor({timeout:10000});
  assert.equal(await page.locator('.ocf-token-button').count(),0);
  await sheet(page).getByText('AC: 17', { exact: true }).waitFor();
  await sheet(page).getByRole('button', { name: 'Use potion of healing (∞)', exact: true }).waitFor();
  await sheet(page).getByRole('button', { name: 'DEX save (+6)', exact: true }).waitFor();
  await sheet(page).getByRole('button', { name: 'Perception (+5)', exact: true }).waitFor();
  await sheet(page).getByRole('button', { name: 'Performance (+1)', exact: true }).waitFor();
  await sheet(page).getByRole('checkbox', { name: 'Longbow: include Colossus Slayer', exact: true }).waitFor();
  const bearNative=map.tokens.find(token=>token.label==='Black Bear');
  await page.evaluate(id=>window.dispatchEvent(new CustomEvent('ocf:select-token',{detail:{tokenId:id}})),bearNative.id);
  await sheet(page).getByRole('heading',{name:'Black Bear',exact:true}).waitFor();
  await page.evaluate(id=>window.dispatchEvent(new CustomEvent('ocf:select-token',{detail:{tokenId:id}})),lux.id);
  await sheet(page).getByRole('heading',{name:'Lux',exact:true}).waitFor();
  // Preview a label effect in this test browser only; no campaign token or sheet is changed.
  await page.evaluate(id=>{window.ocfLabelPreviewGetter=window.ocfTokenEffects;window.ocfTokenEffects=tokenId=>tokenId===id?[{id:'label-preview',name:'Weakening Breath'}]:window.ocfLabelPreviewGetter(tokenId);window.dispatchEvent(new Event('ocf:turn'));},lux.id);
  await page.waitForTimeout(500);await page.screenshot({path:'/artifacts/small-token-labels.png'});
  await page.evaluate(()=>{window.ocfTokenEffects=window.ocfLabelPreviewGetter;delete window.ocfLabelPreviewGetter;window.dispatchEvent(new Event('ocf:turn'));});
  const panel = page.getByRole('region', { name: 'Combat log panel', exact: true });
  const panelBox = await panel.boundingBox();
  assert.equal(Math.round(panelBox.x + panelBox.width), 1588);assert.equal(Math.round(panelBox.y),12);assert.equal(Math.round(panelBox.height),976);
  const log=page.getByRole('log',{name:'Shared combat log',exact:true});const logBox=await log.boundingBox();assert.ok(logBox.height>200);
  assert.equal(await sheet(page).evaluate(n=>n.classList.contains('ocf-sheet-detached')),false);
  await panel.getByRole('button',{name:'Pop out character sheet',exact:true}).click();
  await sheet(page).getByRole('combobox', { name: 'Roll mode', exact: true }).selectOption('advantage');
  assert.equal(await sheet(page).getByRole('button',{name:'Reunite character sheet with combat log',exact:true}).locator('path').getAttribute('d'),'M6 3L12 9L6 15');
  const beforeDrag=await sheet(page).boundingBox(), handle=await sheet(page).locator('.ocf-sheet-header h2').boundingBox();
  await page.mouse.move(handle.x+20,handle.y+10);await page.mouse.down();await page.mouse.move(handle.x-100,handle.y+50,{steps:6});await page.mouse.up();
  const afterDrag=await sheet(page).boundingBox();assert.ok(Math.abs(afterDrag.x-(beforeDrag.x-120))<3&&Math.abs(afterDrag.y-(beforeDrag.y+40))<3);
  await panel.getByRole('button',{name:'Minimize combat panel',exact:true}).click();assert.equal(await log.isVisible(),false);assert.equal(await sheet(page).isVisible(),true);
  await panel.getByRole('button',{name:'Expand combat panel',exact:true}).click();
  await sheet(page).getByRole('button',{name:'Reunite character sheet with combat log',exact:true}).click();
  assert.equal(await sheet(page).evaluate(n=>n.classList.contains('ocf-sheet-detached')),false);
  assert.equal(await sheet(page).getByRole('combobox',{name:'Roll mode',exact:true}).inputValue(),'advantage');
  const dockedSheet=await sheet(page).boundingBox(),dockedLog=await log.boundingBox();assert.ok(dockedLog.y>=dockedSheet.y);
  assert.equal(await panel.getByRole('button',{name:'Pop out character sheet',exact:true}).locator('path').getAttribute('d'),'M12 3L6 9L12 15');
  await panel.getByRole('button',{name:'Pop out character sheet',exact:true}).click();
  await panel.getByRole('button',{name:'Pop out combat log',exact:true}).click();
  const logWindow=page.getByRole('region',{name:'Combat log window',exact:true});
  assert.equal(await logWindow.evaluate(n=>n.classList.contains('ocf-log-detached')),true);
  await logWindow.getByRole('button',{name:'Reunite combat log',exact:true}).click();
  assert.ok((await log.boundingBox()).height>900);
  await sheet(page).getByRole('combobox',{name:'Roll mode',exact:true}).selectOption('normal');
  // Selecting a second token replaces the existing sheet; repeated selection preserves controls.
  await select(page,'Black Bear');assert.equal(await sheet(page).count(),1);
  await select(page,'Lux');assert.equal(await sheet(page).count(),1);
  await sheet(page).getByRole('combobox',{name:'Roll mode',exact:true}).selectOption('advantage');
  await page.evaluate(id=>window.dispatchEvent(new CustomEvent('ocf:token',{detail:{tokenId:id}})),lux.id);
  assert.equal(await sheet(page).getByRole('combobox',{name:'Roll mode',exact:true}).inputValue(),'advantage');
  await sheet(page).getByRole('combobox',{name:'Roll mode',exact:true}).selectOption('normal');
  await page.screenshot({ path: '/artifacts/right-sheet.png' });
  await sheet(page).getByRole('button', { name: 'Close sheet' }).click();
  await panel.getByRole('button',{name:'Minimize combat panel',exact:true}).click();
  await page.evaluate(id=>window.dispatchEvent(new CustomEvent('ocf:select-token',{detail:{tokenId:id}})),lux.id);
  await sheet(page).getByRole('heading',{name:'Lux',exact:true}).waitFor();assert.equal(await sheet(page).evaluate(n=>n.classList.contains('ocf-sheet-detached')),false);
  assert.equal(await panel.getAttribute('data-collapsed'),'false');await sheet(page).getByRole('button',{name:'Close sheet',exact:true}).click();
  await select(page, 'Black Bear'); await sheet(page).getByText('AC: 11', { exact: true }).waitFor();
  await sheet(page).getByRole('button', { name: 'Close sheet' }).click();
  await select(page, 'Adult Gold Dragon');
  const sourceActions = sheet(page).getByTestId('advanced-actions');
  await sourceActions.getByText('Action · Multiattack', { exact: true }).waitFor();
  await sourceActions.getByText('Action · Fire Breath', { exact: true }).waitFor();
  await sourceActions.getByText('Legendary · Wing Attack (Costs 2 Actions)', { exact: true }).waitFor();
  await sourceActions.locator('details[data-action="legendary-detect"] summary').click();
  await sourceActions.getByRole('button', { name: 'Roll Detect: Perception (+14)', exact: true }).waitFor();
  await sheet(page).getByRole('button', { name: 'Close sheet' }).click();
  await page.goto(base + '/ocf-api/ui');
  await page.getByRole('button', { name: 'Prepare / refresh from Kanka', exact: true }).click();
  await page.getByRole('link', { name: 'Open prepared encounter in Dungeon Revealer', exact: true }).waitFor({ timeout: 60000 });
  await page.getByRole('link', { name: 'Open prepared encounter in Dungeon Revealer', exact: true }).click(); await page.waitForURL(base + '/dm');
  await select(page, fixture.attacker_name);
  const pc = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  await pc.addInitScript(({ origin, password }) => { if (location.origin === origin) localStorage.setItem('pcPassword', JSON.stringify(password)); }, { origin: base, password: access.player_password });
  const player = await pc.newPage(); player.on('pageerror', error => errors.push(error.message)); await player.goto(base + '/');
  await nativeClick(player,lux.id,'player');
  await sheet(player).getByRole('heading',{name:'Lux',exact:true}).waitFor();await sheet(player).getByRole('button',{name:'Close sheet',exact:true}).click();
  await player.getByRole('button',{name:'Minimize combat panel',exact:true}).click();
  await nativeClick(player,lux.id,'player');
  await sheet(player).getByRole('heading',{name:'Lux',exact:true}).waitFor();assert.equal(await sheet(player).evaluate(n=>n.classList.contains('ocf-sheet-detached')),false);
  assert.equal(await player.getByRole('region',{name:'Combat log panel',exact:true}).getAttribute('data-collapsed'),'false');
  await select(player, fixture.attacker_name);
  const playerPanel=player.getByRole('region',{name:'Combat log panel',exact:true});
  assert.equal(await sheet(player).evaluate(n=>n.classList.contains('ocf-sheet-detached')),false);
  await playerPanel.getByRole('button',{name:'Pop out character sheet',exact:true}).click();
  await playerPanel.getByRole('button',{name:'Pop out combat log',exact:true}).click();
  await player.getByRole('button',{name:'Reunite combat log',exact:true}).click();
  assert.equal(await playerPanel.getByRole('log',{name:'Shared combat log',exact:true}).isVisible(),true);
  await sheet(player).getByRole('combobox', { name: 'Roll mode', exact: true }).selectOption('advantage');
  await sheet(player).getByRole('button', { name: 'Perception (+5)', exact: true }).click();
  await sheet(player).getByText(/^Perception \(advantage\):/).waitFor();
  let managedRoll = (await api(player, '/history', 'player')).find(r => r.token_id === fixture.attacker_id && r.label === 'Perception');
  assert.equal(managedRoll.mode, 'advantage'); assert.equal(managedRoll.dice.length, 2); assert.equal(managedRoll.modifier, 5);
  await sheet(player).getByRole('combobox', { name: 'Roll mode', exact: true }).selectOption('normal');
  await sheet(player).getByRole('button', { name: 'DEX save (+2)', exact: true }).click();
  await sheet(player).getByText(/^DEX saving throw:/).waitFor();
  managedRoll = (await api(player, '/history', 'player')).find(r => r.token_id === fixture.attacker_id && r.label === 'DEX saving throw'); assert.equal(managedRoll.modifier, 2);
  await sheet(player).getByRole('combobox', { name: 'Tool check ability', exact: true }).selectOption('int');
  await sheet(player).getByRole('button', { name: 'Practice tools', exact: true }).click();
  await sheet(player).getByText(/^Practice tools \(INT\):/).waitFor();
  managedRoll = (await api(player, '/history', 'player')).find(r => r.token_id === fixture.attacker_id && r.label === 'Practice tools (INT)'); assert.equal(managedRoll.modifier, 2);
  async function attackUntilHit() {
    let action;
    for (let attempt = 0; attempt < 12; attempt++) {
      const again = sheet(player).getByRole('button', { name: 'Attack again', exact: true });
      if (await again.count()) await again.click();
      else await sheet(player).getByRole('button', { name: 'Attack +100', exact: true }).click();
      await sheet(player).getByRole('button', { name: 'Target ' + fixture.target_name, exact: true }).click();
      await sheet(player).getByTestId('attack-outcome').waitFor();
      action = (await api(player, '/attacks', 'player')).find(item => item.encounter_id === fixture.encounter_id);
      assert.ok(action); assert.equal(action.target_ac, undefined); assert.equal(action.hp_change, undefined);
      if (action.hit) return action;
    }
    throw new Error('No hit in twelve practice rolls.');
  }
  const targetBefore = await api(page, '/tokens/' + fixture.target_id);
  const action = await attackUntilHit();
  await sheet(player).getByTestId('target-health').filter({ hasText: /^Health: Good$/ }).waitFor();
  assert.equal(action.status, 'applied');
  assert.equal(await sheet(player).getByRole('button', { name: 'Approve & apply damage' }).count(), 0);
  const targetAfter = await api(page, '/tokens/' + fixture.target_id);
  assert.equal(targetAfter.hp_current, targetBefore.hp_current - action.damage.total);
  await sheet(page).getByRole('button',{name:'Close sheet',exact:true}).click();
  await select(page,fixture.attacker_name);
  await sheet(page).getByTestId('target-health').filter({ hasText: `HP: ${targetAfter.hp_current}/${targetAfter.stats.hp_max}` }).waitFor();
  await api(player, `/tokens/${fixture.attacker_id}/attacks`, 'player', { request_id: action.id, action_id: 'practice', target_token_id: fixture.target_id, mode: 'normal', bonus_ids: [] });
  assert.equal((await api(page, '/tokens/' + fixture.target_id)).hp_current, targetAfter.hp_current);
  await page.screenshot({ path: '/artifacts/gm-automatic-combat.png' }); await player.screenshot({ path: '/artifacts/player-guided-combat.png' });
  await sheet(player).getByRole('button', { name: 'Close sheet' }).click();
  await select(player, 'Black Bear'); await sheet(player).getByText('This token’s combat sheet is GM-only.', { exact: true }).waitFor();
  assert.equal(await sheet(player).getByRole('button', { name: /Attack/ }).count(), 0);
  // Manual death save and targeted potion run as a player, on disposable PCs.
  await sheet(player).getByRole('button', { name: 'Close sheet' }).click();
  await select(player, fixture.dying_name);
  await sheet(player).getByRole('button', { name: 'Death save (d20)', exact: true }).click();
  await sheet(player).getByRole('heading', { name: 'Death saving throw' }).waitFor();
  const saved = await api(page, '/tokens/' + fixture.dying_id);
  assert.ok(['dying', 'alive'].includes(saved.life_state));
  await sheet(player).getByRole('button', { name: 'Close sheet' }).click(); await select(player, fixture.attacker_name);
  await sheet(player).getByRole('button', { name: 'Use potion of healing (1)', exact: true }).click();
  await sheet(player).getByRole('button', { name: 'Target ' + fixture.dying_name, exact: true }).click();
  await sheet(player).getByRole('heading', { name: 'Potion of healing' }).waitFor();
  await sheet(player).getByText('Potions remaining: 0.', { exact: true }).waitFor();
  assert.equal(await sheet(player).getByRole('button', { name: 'Heal again', exact: true }).isDisabled(), true);
  assert.equal((await api(page, '/tokens/' + fixture.dying_id)).life_state, 'alive');
  assert.equal((await api(page, '/tokens/' + fixture.attacker_id)).inventory[0].quantity, 0);
  await sheet(player).getByRole('button', { name: 'Use potion of healing (0)', exact: true }).waitFor();
  const healControls=sheet(player).getByRole('button',{name:'Heal again',exact:true}).locator('..');
  assert.equal(await healControls.getByRole('button',{name:'End turn',exact:true}).isDisabled(),true);
  // Lethal attacks publish death immediately.
  let lethal;
  for (let attempt = 0; attempt < 12; attempt++) {
    await sheet(player).getByRole('button', { name: 'Attack +100', exact: true }).click();
    await sheet(player).getByRole('button', { name: 'Target ' + fixture.fragile_name, exact: true }).click();
    await sheet(player).getByTestId('attack-outcome').waitFor();
    lethal = (await api(player, '/attacks', 'player')).find(a => a.target_token_id === fixture.fragile_id);
    if (lethal.hit) break;
  }
  assert.equal(lethal.status, 'applied');
  await sheet(page).getByRole('button',{name:'Close sheet',exact:true}).click();
  await select(page,fixture.attacker_name);
  await sheet(player).getByText(`${fixture.fragile_name}: dead`, { exact: true }).waitFor();
  await sheet(player).getByTestId('target-health').filter({ hasText: /^Health: Bad$/ }).waitFor();
  // Object definition and attack reuse the targeting/approval walkthrough.
  let objectAttack;
  await sheet(page).getByRole('button', { name: 'Attack +100', exact: true }).click();
  await sheet(page).getByRole('button', { name: 'Attack object', exact: true }).click();
  await sheet(page).getByRole('textbox', { name: 'Object name', exact: true }).fill('Practice door');
  await sheet(page).getByRole('spinbutton', { name: 'Object AC', exact: true }).fill('1');
  await sheet(page).getByRole('spinbutton', { name: 'Object HP', exact: true }).fill('1');
  const fieldStyle = await sheet(page).getByRole('textbox', { name: 'Object name', exact: true }).evaluate(el => ({ color: getComputedStyle(el).color, background: getComputedStyle(el).backgroundColor }));
  assert.equal(fieldStyle.color, 'rgb(23, 34, 53)'); assert.equal(fieldStyle.background, 'rgb(255, 255, 255)');
  await sheet(page).getByRole('button', { name: 'Add object & select target', exact: true }).click();
  for (let attempt = 0; attempt < 12; attempt++) {
    await sheet(page).getByRole('button', { name: 'Target Practice door', exact: true }).click();
    await sheet(page).getByTestId('attack-outcome').waitFor();
    objectAttack = (await api(page, '/attacks')).find(a => a.target_name === 'Practice door');
    if (objectAttack.hit) break;
    await sheet(page).getByRole('button', { name: 'Attack again', exact: true }).click();
  }
  await sheet(page).getByText('Practice door: destroyed', { exact: true }).waitFor();
  await page.screenshot({ path: '/artifacts/object-destruction.png' });
  assert.equal(await sheet(page).getByTestId('attack-walkthrough').getAttribute('data-health'), 'red');
  assert.equal(await sheet(page).locator('.ocf-steps > li').nth(2).getAttribute('class'), 'ocf-health-red');
  // NPC damage applies when the attack is rolled, with no second GM click.
  await sheet(page).getByRole('button', { name: 'Close sheet' }).click(); await select(page, fixture.target_name);
  const npcHpBeforeManual = (await api(page, '/tokens/' + fixture.target_id)).hp_current;
  const advanced = sheet(page).getByTestId('advanced-actions');
  await advanced.locator('details[data-action="test-fire"] summary').click();
  await advanced.getByRole('button', { name: 'Choose targets: Fire Breath', exact: true }).click();
  await sheet(page).getByText('Area: 60 ft cone.', { exact: true }).waitFor();
  await sheet(page).getByRole('checkbox', { name: 'Affect ' + fixture.attacker_name, exact: true }).check();
  await sheet(page).getByRole('checkbox', { name: 'Affect ' + fixture.spare_name, exact: true }).check();
  const effectResponse = page.waitForResponse(r => r.url().endsWith('/effects') && r.request().method() === 'POST');
  await sheet(page).getByRole('button', { name: 'Roll saves & apply selected damage', exact: true }).click();
  const effect = await (await effectResponse).json(); assert.equal(effect.targets.length, 2); assert.equal(effect.damage[0].dice.length, 2);
  await sheet(page).getByRole('heading', { name: 'Fire Breath Attack', exact: true }).waitFor();
  assert.equal((await api(page, '/tokens/' + fixture.target_id)).hp_current, npcHpBeforeManual);
  for (const target of effect.targets) assert.equal((await api(page, '/tokens/' + target.token_id)).hp_current, target.hp_change.hp_after);
  await api(page, `/tokens/${fixture.target_id}/effects`, 'gm', (await effectResponse).request().postDataJSON());
  for (const target of effect.targets) assert.equal((await api(page, '/tokens/' + target.token_id)).hp_current, target.hp_change.hp_after);
  const areaEvent=(await api(player,'/history','player')).find(r=>r.id===effect.id+':combat');
  assert.equal(areaEvent.damage[0].total,effect.damage[0].total);assert.equal(areaEvent.targets.length,2);assert.equal(JSON.stringify(areaEvent).includes('hp_change'),false);
  const playerArea=player.getByRole('log',{name:'Shared combat log',exact:true}).locator(`[data-log-id="${effect.id}:combat"]`);
  await playerArea.getByText(/Fire Breath/).waitFor();
  await playerArea.getByText(/Damage roll:/).waitFor();
  await advanced.getByRole('button', { name: 'Roll Fire Breath: Recharge (1d6)', exact: true }).click();
  await sheet(page).getByText(/^Fire Breath — Recharge/).first().waitFor();
  const pcBeforeNpc = await api(page, '/tokens/' + fixture.attacker_id);
  let npcAction;
  for (let attempt = 0; attempt < 12; attempt++) {
    await sheet(page).getByRole('button', { name: 'Attack +100', exact: true }).click();
    await sheet(page).getByRole('button', { name: 'Target ' + fixture.attacker_name, exact: true }).click();
    await sheet(page).getByTestId('attack-outcome').waitFor();
    npcAction = (await api(page, '/attacks')).find(a => a.attacker_token_id === fixture.target_id);
    if (npcAction.hit) break;
  }
  assert.equal(npcAction.automatic, true); assert.equal(npcAction.status, 'applied');
  assert.equal(await sheet(page).getByRole('button', { name: 'Approve & apply damage', exact: true }).count(), 0);
  assert.equal((await api(page, '/tokens/' + fixture.attacker_id)).hp_current, pcBeforeNpc.hp_current - npcAction.damage.total);
  assert.equal(await sheet(page).getByTestId('attack-walkthrough').getAttribute('data-health'), 'green');
  const npcEvent=(await api(player,'/history','player')).find(r=>r.id===npcAction.id+':combat');
  assert.equal(npcEvent.attack.total,npcAction.attack.total);assert.equal(npcEvent.targets[0].damage_total,npcAction.damage.total);assert.equal(JSON.stringify(npcEvent).includes('target_ac'),false);
  const playerNpc=player.getByRole('log',{name:'Shared combat log',exact:true}).locator(`[data-log-id="${npcAction.id}:combat"]`);
  await playerNpc.getByText(/Attack roll:/).waitFor();await playerNpc.getByTestId('combat-log-damage').waitFor();
  assert.match(await playerNpc.getByTestId('combat-log-damage').getAttribute('class'),/ocf-health-green/);
  await playerNpc.getByText('Health after action: Good',{exact:true}).waitFor();
  assert.equal(await player.getByRole('log',{name:'Shared combat log',exact:true}).getByText(/Health now:/).count(),0);
  await player.screenshot({path:'/artifacts/player-npc-combat-log.png'});
  await page.screenshot({ path: '/artifacts/npc-automatic-damage.png' });
  // Failed-save conditions persist, show to the affected player, and can be removed by the GM.
  const hpBeforeCondition=(await api(page,'/tokens/'+fixture.attacker_id)).hp_current;
  await sheet(page).getByTestId('advanced-actions').locator('details[data-action="test-weakening"] summary').click();
  await sheet(page).getByRole('button',{name:'Choose targets: Weakening Breath',exact:true}).click();
  assert.equal(await sheet(page).getByLabel('Effect on failed save (optional)',{exact:true}).inputValue(),'Weakening Breath');
  await sheet(page).getByRole('checkbox',{name:'Affect '+fixture.attacker_name,exact:true}).check();
  const conditionReply=page.waitForResponse(r=>r.url().endsWith('/effects')&&r.request().method()==='POST');
  await sheet(page).getByRole('button',{name:'Roll saves for selected targets',exact:true}).click();
  const conditionResult=await(await conditionReply).json();assert.equal(conditionResult.targets[0].save_success,false);assert.equal(conditionResult.targets[0].applied_effects[0].name,'Weakening Breath');
  assert.equal((await api(page,'/tokens/'+fixture.attacker_id)).hp_current,hpBeforeCondition);
  await sheet(player).getByTestId('active-effects').getByText('Weakening Breath',{exact:true}).waitFor();
  assert.equal(await sheet(player).getByRole('button',{name:'Add effect',exact:true}).count(),0);
  await player.waitForFunction(id=>window.ocfTokenEffects(id).some(e=>e.name==='Weakening Breath'),fixture.attacker_id);
  const repeatReply=player.waitForResponse(r=>r.url().endsWith('/condition-save')&&r.request().method()==='POST');
  await sheet(player).getByRole('button',{name:'Roll STR save (DC 100)',exact:true}).click();
  const failedRepeat=await(await repeatReply).json();assert.equal(failedRepeat.success,false);assert.equal(failedRepeat.ended,false);assert.equal(failedRepeat.dice.length,2);assert.equal(failedRepeat.mode,'disadvantage');
  await sheet(player).getByTestId('effect-save-result').filter({hasText:/effect remains/}).waitFor();
  await select(page,fixture.attacker_name);await sheet(page).getByRole('button',{name:'Remove Weakening Breath',exact:true}).click();
  await sheet(player).getByTestId('active-effects').getByText('Weakening Breath',{exact:true}).waitFor({state:'detached'});
  await sheet(page).getByRole('button',{name:'Add effect',exact:true}).click();
  const effectForm=page.getByRole('dialog',{name:'Add character effect',exact:true});await effectForm.getByLabel('Effect name',{exact:true}).fill('Poisoned');await effectForm.getByRole('textbox',{name:'Effect notes',exact:true}).fill('Synthetic condition reminder.');await effectForm.getByRole('textbox',{name:'Effect duration',exact:true}).fill('Until cleared');
  await effectForm.getByRole('checkbox',{name:'Configure saving throw',exact:true}).check();await effectForm.getByLabel('Effect save ability',{exact:true}).selectOption('con');await effectForm.getByLabel('Effect save DC',{exact:true}).fill('1');await effectForm.getByLabel('Effect save timing',{exact:true}).selectOption('end');await effectForm.getByRole('checkbox',{name:'End effect on successful save',exact:true}).check();await effectForm.getByRole('button',{name:'Apply effect',exact:true}).click();
  await sheet(player).getByTestId('active-effects').getByText('Poisoned',{exact:true}).waitFor();
  await sheet(player).getByRole('button',{name:'Roll CON save (DC 1)',exact:true}).click();
  await sheet(player).getByTestId('effect-save-result').filter({hasText:/effect ends/}).waitFor();
  await sheet(player).getByTestId('active-effects').getByText('Poisoned',{exact:true}).waitFor({state:'detached'});
  await sheet(page).getByRole('button',{name:'Remove Poisoned',exact:true}).waitFor({state:'detached'});
  // Shared initiative request → GM approval → PC queue and GM NPC rolls.
  const turnPanel = p => p.locator(`[data-testid="turn-tracker"][data-encounter="${fixture.encounter_id}"]`);
  await sheet(player).getByRole('button', { name: 'Initiative (+0)', exact: true }).click();
  await turnPanel(page).getByRole('button', { name: 'Approve initiative', exact: true }).waitFor();
  assert.equal(await turnPanel(player).getByRole('button', { name: 'Approve initiative', exact: true }).count(), 0);
  await turnPanel(page).getByRole('button', { name: 'Approve initiative', exact: true }).click();
  const npcRollDialog = page.getByRole('dialog', { name: 'NPC initiative', exact: true }); await npcRollDialog.waitFor();
  await turnPanel(player).getByRole('button', { name: 'Roll initiative: ' + fixture.attacker_name, exact: true }).waitFor();
  await turnPanel(player).getByRole('button', { name: 'Minimize turn tracker', exact: true }).click();
  assert.equal(await turnPanel(player).getByTestId('turn-tracker-body').isVisible(), false);
  assert.equal(await turnPanel(player).getByRole('button', { name: 'Expand turn tracker', exact: true }).textContent(), '');
  await npcRollDialog.getByRole('button', { name: 'Roll NPC: ' + fixture.target_name, exact: true }).click();
  await npcRollDialog.getByText(new RegExp(fixture.target_name + ': \\d+')).waitFor();
  await npcRollDialog.getByRole('button', { name: 'Roll all NPCs', exact: true }).click();
  await npcRollDialog.getByText('All NPCs rolled. Waiting for remaining PCs.', { exact: true }).waitFor();
  await npcRollDialog.getByRole('button', { name: 'Close', exact: true }).click();
  await player.waitForTimeout(1800); assert.equal(await turnPanel(player).getByTestId('turn-tracker-body').isVisible(), false);
  await turnPanel(player).getByRole('button', { name: 'Expand turn tracker', exact: true }).click();
  await turnPanel(player).getByRole('button', { name: 'Roll initiative: ' + fixture.attacker_name, exact: true }).click();
  await turnPanel(player).getByRole('button', { name: 'Roll initiative: ' + fixture.dying_name, exact: true }).click();
  const getInitiative = async () => (await api(page, '/initiative')).find(s => s.encounter_id === fixture.encounter_id);
  let init = await getInitiative(); assert.equal(init.status, 'active'); assert.equal(init.order.length, 4);
  const tracked = await turnPanel(page).boundingBox();
  assert.ok(Math.abs(tracked.y + tracked.height - 988) < 3);
  assert.ok(tracked.x < 200);
  // Exercise PC End turn and GM NPC advancement over a complete round, irrespective of dice order.
  for (let i = 0; i < init.order.length; i++) {
    init = await getInitiative(); const current = init.entries.find(e => e.token_id === init.current_token_id);
    if (current.role === 'pc') {
      await turnPanel(player).getByText('Your turn: ' + current.name, { exact: true }).waitFor();
      if(current.token_id===fixture.attacker_id){
        await select(player,current.name);const controls=sheet(player).getByRole('button',{name:'Attack again',exact:true}).locator('..');
        await controls.getByRole('button',{name:'End turn',exact:true}).click();
      }else await turnPanel(player).getByRole('button', { name: 'End turn', exact: true }).click();
    } else {
      assert.equal(await turnPanel(player).getByRole('button', { name: 'End turn', exact: true }).count(), 0);
      await turnPanel(page).getByRole('heading', { name: 'Turn: ' + current.name, exact: true }).waitFor();
      if(current.token_id===fixture.target_id){await select(page,current.name);await sheet(page).getByRole('button',{name:'End turn',exact:true}).click();}
      else await turnPanel(page).getByRole('button', { name: 'Advance NPC turn', exact: true }).click();
    }
    {const next=await getInitiative(),entry=next.entries.find(e=>e.token_id===next.current_token_id);if(entry?.role!=='pc')await sheet(page).getByRole('heading',{name:entry.name,exact:true}).waitFor();}
    await page.waitForTimeout(1800);
  }
  init = await getInitiative(); assert.equal(init.round, 2);
  await player.waitForTimeout(1800);
  for(const entry of init.entries){const token=await api(page,'/tokens/'+entry.token_id);const canMove=await player.evaluate(id=>window.ocfCanMoveToken(id),entry.token_id);assert.equal(canMove,entry.role==='pc'&&entry.token_id===init.current_token_id&&token.hp_current>0);}
  await page.screenshot({ path: '/artifacts/initiative-gm.png' }); await player.screenshot({ path: '/artifacts/initiative-player.png' });
  const currentEntry = init.entries.find(entry => entry.token_id === init.current_token_id);
  await turnPanel(page).locator(`li[data-token="${currentEntry.token_id}"]`).getByRole('button', { name: 'Open sheet: ' + currentEntry.name, exact: true }).click();
  await sheet(page).getByRole('heading', { name: currentEntry.name, exact: true }).waitFor();
  // The collapsed header preserves the current name and only a small chevron control.
  await turnPanel(page).getByRole('button', { name: 'Minimize turn tracker', exact: true }).click();
  await turnPanel(page).getByRole('heading', { name: 'Turn: ' + currentEntry.name, exact: true }).waitFor();
  assert.equal(await turnPanel(page).getByTestId('turn-tracker-body').isVisible(), false);
  await turnPanel(page).getByRole('button', { name: 'Open sheet: ' + currentEntry.name, exact: true }).click();
  await sheet(page).getByRole('heading', { name: currentEntry.name, exact: true }).waitFor();
  const chevron = await turnPanel(page).getByRole('button', { name: 'Expand turn tracker', exact: true }).boundingBox();
  const collapsedBox = await turnPanel(page).boundingBox(); assert.ok(chevron.width <= 24 && chevron.height <= 24 && collapsedBox.height <= 60);
  await turnPanel(page).getByRole('button', { name: 'Expand turn tracker', exact: true }).click();
  // An out-of-turn PC roll waits without producing dice; only the DM can approve it.
  while((await getInitiative()).current_token_id===fixture.attacker_id){const state=await getInitiative();await api(page,`/initiative/${fixture.encounter_id}/command`,'gm',{request_id:randomUUID(),session_id:state.session_id,expected_revision:state.revision,action:'advance'});}
  await select(player,fixture.attacker_name);
  await api(page,'/tokens/'+fixture.attacker_id+'/conditions','gm',{request_id:randomUUID(),action:'add',effect:{name:'Save exception check',notes:'Disposable effect',save_rule:{ability:'con',dc:1,timing:'end',ends_on_success:true,mode:'normal'}}});
  const saveReply=player.waitForResponse(r=>r.url().endsWith('/condition-save')&&r.request().method()==='POST');
  await sheet(player).getByRole('button',{name:'Roll CON save (DC 1)',exact:true}).click();
  const pendingSave=await(await saveReply).json();assert.equal(pendingSave.approval_required,true);assert.equal((await api(page,'/history')).some(r=>r.id===pendingSave.approval.id),false);
  await page.getByRole('dialog',{name:'Out-of-turn roll requests',exact:true}).locator(`[data-request="${pendingSave.approval.id}"]`).getByRole('button',{name:'Approve roll',exact:true}).click();
  await sheet(player).getByTestId('effect-save-result').filter({hasText:/effect ends/}).waitFor();
  assert.equal((await api(page,'/tokens/'+fixture.attacker_id)).active_effects.some(e=>e.name==='Save exception check'),false);
  const rollReply=player.waitForResponse(r=>r.url().endsWith('/rolls')&&r.request().method()==='POST');
  await sheet(player).getByRole('button',{name:'Perception (+5)',exact:true}).click();
  const pendingRoll=await(await rollReply).json();assert.equal(pendingRoll.approval_required,true);
  await player.getByRole('dialog',{name:'DM approval required',exact:true}).waitFor();
  assert.equal((await api(page,'/history')).some(r=>r.id===pendingRoll.approval.id),false);
  const requests=page.getByRole('dialog',{name:'Out-of-turn roll requests',exact:true});
  await requests.locator(`[data-request="${pendingRoll.approval.id}"]`).getByRole('button',{name:'Approve roll',exact:true}).click();
  await player.getByRole('dialog',{name:'DM approval required',exact:true}).waitFor({state:'detached'});
  await sheet(player).getByText(/^Perception:/).waitFor();
  assert.equal((await api(page,'/history')).filter(r=>r.id===pendingRoll.approval.id).length,1);
  // Rejection does not apply an out-of-turn attack or expose its outcome.
  const hpBeforeRejected=(await api(page,'/tokens/'+fixture.target_id)).hp_current;
  const attackReply=player.waitForResponse(r=>r.url().endsWith('/attacks')&&r.request().method()==='POST');
  await sheet(player).getByRole('button',{name:'Attack +100',exact:true}).click();
  await sheet(player).getByRole('button',{name:'Target '+fixture.target_name,exact:true}).click();
  const pendingAttack=await(await attackReply).json();assert.equal(pendingAttack.approval_required,true);
  await requests.locator(`[data-request="${pendingAttack.approval.id}"]`).getByRole('button',{name:'Reject roll',exact:true}).click();
  await player.getByRole('dialog',{name:'DM approval required',exact:true}).waitFor({state:'detached'});
  await sheet(player).getByText(/DM declined this out-of-turn roll/).waitFor();
  assert.equal((await api(page,'/tokens/'+fixture.target_id)).hp_current,hpBeforeRejected);
  while((await getInitiative()).current_token_id!==fixture.attacker_id){const state=await getInitiative();await api(page,`/initiative/${fixture.encounter_id}/command`,'gm',{request_id:randomUUID(),session_id:state.session_id,expected_revision:state.revision,action:'advance'});}
  await page.waitForTimeout(1800); // Both clients observe the API-driven turn changes.
  // Optional once-per-turn special damage is exercised only on disposable combatants.
  await player.evaluate(id => window.dispatchEvent(new CustomEvent('ocf:token', { detail: { tokenId: id } })), fixture.attacker_id);
  await sheet(player).getByRole('checkbox', { name: 'Practice strike: include Colossus Slayer', exact: true }).check();
  let special;
  for (let attempt = 0; attempt < 12; attempt++) {
    await sheet(player).getByRole('button', { name: 'Attack +100', exact: true }).click();
    await sheet(player).getByRole('button', { name: 'Target ' + fixture.target_name, exact: true }).click();
    await sheet(player).getByTestId('attack-outcome').waitFor();
    special = (await api(player, '/attacks', 'player')).find(a => a.attacker_token_id === fixture.attacker_id);
    if (special.hit) break;
  }
  assert.equal(special.bonus_name, 'Colossus Slayer'); assert.equal(special.damage.components.length, 2);
  // End combat removes both clients' trackers; another battle starts with a fresh queue.
  const priorSession=(await getInitiative()).session_id;
  await turnPanel(page).getByRole('button', { name: 'End combat', exact: true }).click();
  await turnPanel(page).waitFor({state:'detached'});await turnPanel(player).waitFor({state:'detached'});
  let ended=await getInitiative();assert.deepEqual(ended.entries,[]);assert.deepEqual(ended.order,[]);assert.equal(ended.round,0);
  await sheet(player).getByRole('button',{name:'Initiative (+0)',exact:true}).click();
  await turnPanel(page).getByRole('button',{name:'Approve initiative',exact:true}).click();
  const nextBattle=await getInitiative();assert.notEqual(nextBattle.session_id,priorSession);assert.equal(nextBattle.status,'rolling');assert.ok(nextBattle.entries.every(entry=>entry.total===null));
  await page.getByRole('dialog',{name:'NPC initiative',exact:true}).getByRole('button',{name:'Close',exact:true}).click();
  await turnPanel(page).getByRole('button',{name:'End combat',exact:true}).click();
  await turnPanel(page).waitFor({state:'detached'});await turnPanel(player).waitFor({state:'detached'});
  assert.deepEqual(errors, []);
  writeFileSync('/artifacts/browser-result.json', JSON.stringify({ passed: true, page_errors: errors, checks: ['full-height right combat log and bottom-left tracker', 'automatic native token selection', 'single default docked sheet', 'combat log popout and reunion', 'docked log below sheet', 'sheet popout and reunion', 'draggable sheet', 'independent panel minimization', 'form state survives docking', 'player popout/reunion', 'quest refresh/launch', 'target selection', 'attack and automatic damage', 'exactly-once HP change', 'player redaction', 'manual death save', 'targeted potion without approval', 'immediate NPC death notice', 'object creation and destruction', 'dark object fields', 'HP and damage color bands', 'NPC automatic damage', 'GM exact HP and player qualitative health', 'Lux unlimited demo potion control', 'initiative GM approval', 'individual and batch NPC initiative', 'PC roll queue', 'shared turn indicators', 'PC end turn', 'GM NPC advancement', 'round wrap', 'independent tracker minimize/expand', 'GM end combat clears both trackers', 'next battle queues fresh rolls', 'sheet attack/healing End turn controls', 'out-of-turn rolls wait for DM approval before dice', 'out-of-turn attack rejection preserves HP', 'player drag policy follows active PC', 'GM advance and PC end turn open the next NPC sheet', 'native token selection from encounter controls', 'popout chevron directions', 'tracker sheet links', 'compact chevron and visible current turn', 'Lux extended sheet controls', 'saving throws and skills', 'advantage dice selection', 'tool ability selection', 'Colossus Slayer special damage', 'dragon advanced action descriptions', 'Detect skill roll control', 'multi-target advanced damage and saves', 'shared AoE damage and replay safety', 'manual recharge rolls', 'NPC attacks and AoE results shared without private HP', 'damage and combatant health colors', 'failed-save effects and GM add/remove', 'player effect indicators', 'effect save buttons and automatic success removal', 'failed repeat saves keep effects', 'out-of-turn condition save approval', 'shared default dock and token reopens closed sheet', 'unrelated NPC roll privacy', 'small token labels with health backgrounds and separate effect labels'], attack_id: action.id }, null, 2));
  console.log('Browser checks passed: immediate attacks, role privacy, shared initiative, turn controls, tracker sheet links and chevrons.');
} catch (error) {
  const safe=message=>[access.dm_password,access.player_password].reduce((text,secret)=>secret?text.replaceAll(secret,'[redacted]'):text,String(message));
  console.error(safe(error.stack||error.message));
  for (const context of browser.contexts()) for (const page of context.pages()) await page.screenshot({ path: '/artifacts/failure.png', timeout: 5000 }).catch(() => {});
  throw new Error(safe(error.message));
} finally { await browser.close(); }
