// Read-only, anonymous hosted-library export; downloaded rules remain private.
import { chromium } from '/work/node_modules/playwright/index.mjs';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const base = '/demo-data';
const sourceId = process.argv[2] || 'hAQmc87ty6DbWwZ42';
const source = 'https://dicecloud.com/library/' + sourceId;
const fields = JSON.parse(readFileSync(new URL('./library-fields.json', import.meta.url)));
const stagingFile = base + '/public-library-staging.json';
const staging = existsSync(stagingFile)
  ? JSON.parse(readFileSync(stagingFile)) : { libraries: {}, nodes: {}, scanned: [] };
const { libraries, nodes } = staging;
const scanned = new Set(staging.scanned);
const repairFile = base + '/library-repairs.json';
const repairManifest = existsSync(repairFile) ? JSON.parse(readFileSync(repairFile)) : { repairs: [] };
const repairs = new Map(repairManifest.repairs.map(r => [r.old, r.new]));
const save = (path, data) => writeFileSync(path, JSON.stringify(data), { mode: 0o600 });

function closure() {
  const children = new Map();
  for (const n of Object.values(nodes)) {
    for (const a of n.ancestors || []) {
      if (!children.has(a.id)) children.set(a.id, []);
      children.get(a.id).push(n._id);
    }
  }
  const selected = new Set(Object.values(nodes).filter(n =>
    (n.root?.id || n.ancestors?.[0]?.id) === sourceId).map(n => n._id));
  const pending = [...selected];
  for (let i = 0; i < pending.length; i++) {
    const n = nodes[pending[i]];
    if (n.type !== 'reference' || n.ref?.collection !== 'libraryNodes') continue;
    const target = repairs.get(n.ref.id) || n.ref.id;
    if (!nodes[target]) continue;
    for (const id of [target, ...(children.get(target) || [])]) {
      if (!selected.has(id)) { selected.add(id); pending.push(id); }
    }
  }
  return selected;
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(source, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.Meteor?.status()?.connected, undefined, { timeout: 60000 });
  let todo = scanned.has(sourceId) ? [] : [sourceId];
  for (let round = 0; round < 30; round++) {
    for (const id of todo) {
      const result = await page.evaluate(async ({ id, fields }) => {
        const handles = [];
        const sub = (name, args) => Promise.race([
          new Promise((resolve, reject) => handles.push(Meteor.subscribe(name, ...args, {
            onReady: resolve, onStop: e => e && reject(Error(e.reason || e.message)),
          }))),
          new Promise((_, reject) => setTimeout(() => reject(Error('Publication timeout')), 90000)),
        ]);
        try {
          await sub('library', [id]);
          await sub('libraryNodes', [id, fields]);
          const c = Meteor.connection._mongo_livedata_collections;
          const library = c.libraries.findOne(id);
          if (!library?.public) throw Error('Source is not a public library');
          return { library, nodes: c.libraryNodes.find().fetch().filter(n =>
            (n.root?.id || n.ancestors?.[0]?.id) === id) };
        } finally { handles.forEach(h => h.stop()); }
      }, { id, fields });
      libraries[id] = result.library;
      for (const n of result.nodes) nodes[n._id] = n;
      scanned.add(id);
      if (Object.keys(nodes).length > 150000) throw Error('Staging size limit exceeded');
      save(stagingFile, { libraries, nodes, scanned: [...scanned] });
      console.log(JSON.stringify({ library: result.library.name, nodes: result.nodes.length }));
      await new Promise(resolve => setTimeout(resolve, 1600));
    }
    const selected = closure();
    todo = [...new Set([...selected].flatMap(id => {
      const n = nodes[id];
      if (n.type !== 'reference' || nodes[repairs.get(n.ref?.id) || n.ref?.id]) return [];
      return n.cache?.library?.id && !scanned.has(n.cache.library.id) ? [n.cache.library.id] : [];
    }))];
    if (todo.length) continue;
    const output = Object.fromEntries([...selected].map(id => [id, structuredClone(nodes[id])]));
    for (const n of Object.values(output)) {
      if (n.type !== 'reference' || !repairs.has(n.ref?.id)) continue;
      n.ref.id = repairs.get(n.ref.id);
      const target = output[n.ref.id];
      if (!target) throw Error('Repair target unavailable');
      const libId = target.root?.id || target.ancestors[0].id;
      n.cache = { node: Object.fromEntries(['type', 'name', 'level', 'value'].filter(k => k in target).map(k => [k, target[k]])), library: { id: libId, name: libraries[libId].name } };
    }
    for (const override of repairManifest.overrides || []) {
      if (!output[override.id]) throw Error('Reviewed override target unavailable');
      Object.assign(output[override.id], override.fields);
    }
    const missing = Object.values(output).filter(n => n.type === 'reference' &&
      n.ref?.collection === 'libraryNodes' && !output[n.ref.id]);
    const usedRoots = new Set(Object.values(output).map(n => n.root?.id || n.ancestors[0].id));
    save(base + '/resolved-srd-library.json', {
      source, libraries: Object.fromEntries([...usedRoots].map(id => [id, libraries[id]])),
      nodes: output, missing: missing.map(n => ({ id: n._id, ref: n.ref, cache: n.cache })),
      repairs: repairManifest.repairs, updated_at: new Date().toISOString(),
    });
    console.log(JSON.stringify({ nodes: selected.size, libraries: usedRoots.size, unresolved: missing.length }));
    if (missing.length) process.exitCode = 2;
    break;
  }
} finally { await browser.close(); }
