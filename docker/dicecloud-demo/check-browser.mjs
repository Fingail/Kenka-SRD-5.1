import { chromium } from '/work/node_modules/playwright/index.mjs';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import { demoNodes } from './demo-data.mjs';

const access = JSON.parse(readFileSync('/demo-data/access.json', 'utf8'));
const statePath = '/demo-data/seed-state.json';
const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : { nodes: {} };
const save = () => writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 });
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await page.goto(access.url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.Meteor?.status()?.connected, { timeout: 60000 });
  await page.evaluate(a => new Promise((resolve, reject) => {
    const done = e => e ? reject(new Error(e.reason || e.message)) : resolve();
    if (a.account_created) Meteor.loginWithPassword(a.username, a.password, done);
    else Accounts.createUser({ username: a.username, email: a.email, password: a.password }, done);
  }), access);
  access.account_created = true;
  writeFileSync('/demo-data/access.json', JSON.stringify(access, null, 2) + '\n', { mode: 0o600 });
  const call = (method, args) => page.evaluate(({ method, args }) => new Promise((resolve, reject) => Meteor.call(method, args, (e, result) => e ? reject(new Error(e.reason || e.message)) : resolve(result))), { method, args });
  if (!state.libraryId) {
    state.libraryId = await call('libraries.insert', { name: '2014 SRD — local evaluation', description: 'Minimal Fighter 1–5 advancement demo. This work includes SRD 5.1 material by Wizards of the Coast LLC, licensed CC BY 4.0. https://dnd.wizards.com/resources/systems-reference-document', public: false, readers: [], writers: [] });
    save();
  }
  await call('users.subscribeToLibrary', { libraryId: state.libraryId, subscribe: true });
  for (const node of demoNodes()) {
    if (state.nodes[node.key]) continue;
    await page.waitForTimeout(1150); // Respect DiceCloud's native library insertion limit.
    state.nodes[node.key] = await call('libraryNodes.insert', { libraryNode: node.data, parentRef: node.parent ? { collection: 'libraryNodes', id: state.nodes[node.parent] } : { collection: 'libraries', id: state.libraryId } });
    save();
  }
  if (!state.characterId) {
    state.characterId = await call('creatures.insertCreature', { name: 'SRD Fighter — Demo', gender: '', alignment: '', startingLevel: 1, allowedLibraries: [state.libraryId], allowedLibraryCollections: [] });
    save();
  }
  const character = () => page.evaluate(async id => {
    const response = await fetch('/api/creature/' + id, { headers: { Authorization: 'Bearer ' + localStorage.getItem('Meteor.loginToken') } });
    if (!response.ok) throw new Error('Character read failed (' + response.status + ').');
    const data = await response.json(); return data.data || data;
  }, state.characterId);
  let data = await character();
  // Remove only duplicate copies of this setup's own ruleset from the demo actor.
  // This also repairs a setup interrupted while an earlier server cache was stale.
  const bases = data.creatureProperties.filter(p => p.type === 'folder' && p.name === '2014 SRD — advancement demo');
  for (const duplicate of bases.slice(1)) {
    await call('creatureProperties.softRemove', { _id: duplicate._id });
    await page.waitForTimeout(1200);
  }
  data = await character();
  if (!data.creatureProperties.some(p => p.type === 'attribute')) {
    const slot = data.creatureProperties.find(p => p.type === 'propertySlot' && p.name === 'Ruleset');
    await call('creatureProperties.insertPropertyFromLibraryNode', { nodeIds: [state.nodes.base], parentRef: { collection: 'creatureProperties', id: slot._id } });
    await page.waitForTimeout(2000);
    for (let attempt = 0; attempt < 30; attempt++) {
      data = await character();
      if (data.creatureProperties.filter(p => p.type === 'attribute').length >= 6) break;
      await page.waitForTimeout(500);
    }
  }
  assert.ok(data.creatureProperties.filter(p => p.type === 'attribute').length >= 6, 'Demo ruleset did not populate character attributes.');
  await page.goto(access.url + '/character/' + state.characterId, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  data = await character();
  assert.equal(data.creatureProperties.filter(p => p.type === 'class').length, 1, 'Expected one demo class.');
  const stat = (data, name) => data.creatureProperties.find(p => p.variableName === name && p.type === 'attribute');
  assert.equal(stat(data, 'strength').value, 15);
  if (!state.level_up_verified) {
    const fighter = data.creatureProperties.find(p => p.type === 'class');
    if (fighter.level < 2) {
      await page.getByRole('tab', { name: 'Build', exact: true }).click();
      await page.getByRole('button', { name: 'Level Up', exact: true }).first().click();
      const panel = page.locator(`[data-id="${state.nodes.fighter2}"]`);
      await panel.locator('.v-input--selection-controls__ripple').click();
      assert.equal(await panel.getByRole('checkbox').isChecked(), true);
      await page.getByRole('button', { name: 'Insert', exact: true }).click();
      await page.waitForTimeout(1500);
    }
    for (let attempt = 0; attempt < 30; attempt++) {
      data = await character();
      if (data.creatureProperties.find(p => p.type === 'class')?.level === 2 && stat(data, 'hitPoints')?.value === 18) break;
      await page.waitForTimeout(500);
    }
    assert.equal(data.creatureProperties.find(p => p.type === 'class').level, 2);
    assert.equal(stat(data, 'hitPoints').value, 18);
    state.level_up_verified = true;
    save();
  }
  await page.getByRole('tab', { name: 'Stats', exact: true }).click();
  const body = await page.locator('body').innerText();
  assert.match(body, /SRD Fighter/);
  await page.screenshot({ path: '/demo-data/dicecloud-demo.png', fullPage: true });
  writeFileSync('/demo-data/browser-result.json', JSON.stringify({ passed: true, character_url: access.url + '/character/' + state.characterId, library_nodes: Object.keys(state.nodes).length, level_up_verified: state.level_up_verified }, null, 2) + '\n');
  console.log('DiceCloud browser login, library, populated stats and native level-up checks passed.');
} catch (error) {
  const safe = String(error.message).replaceAll(access.password, '[redacted]');
  console.error(safe);
  writeFileSync('/demo-data/browser-result.json', JSON.stringify({ passed: false, error: safe }, null, 2) + '\n');
  for (const context of browser.contexts()) for (const page of context.pages()) await page.screenshot({ path: '/demo-data/failure.png', timeout: 5000 }).catch(() => {});
  throw new Error('DiceCloud browser setup failed; inspect the private demo artifacts.');
} finally {
  await browser.close();
}
