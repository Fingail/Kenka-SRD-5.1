import { check, parseDice } from './core.mjs';
const categories = ['trait', 'action', 'legendary', 'reaction', 'bonus'];
const idFor = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64);
const plain = value => value.replace(/<br\s*\/?\s*>|<\/p>|<\/h\d>/gi, ' ').replace(/<[^>]*>/g, ' ').replaceAll('&nbsp;', ' ').replaceAll('−', '-').replace(/\s+/g, ' ').trim();

export function parseAdvancedActions(entry, attacks = []) {
  const body = String(entry || '').split(/<p>\s*<small>/i)[0];
  const chunks = body.split(/<h[1-6][^>]*>\s*(Actions|Legendary Actions|Reactions|Bonus Actions)\s*<\/h[1-6]>/i);
  const sections = [{ category: 'trait', text: plain(chunks[0]).replace(/^.*?\bChallenge\s+.*?\bXP\)\s*/i, '') }];
  const groups = { actions: 'action', 'legendary actions': 'legendary', reactions: 'reaction', 'bonus actions': 'bonus' };
  for (let i = 1; i + 1 < chunks.length; i += 2) sections.push({ category: groups[chunks[i].toLowerCase()], text: plain(chunks[i + 1]) });
  const result = [];
  // Title-case names followed by a period distinguish headings from wrapped prose.
  const heading = /(?:^|(?<=[.!?])\s+)([A-Z][A-Za-z’'\-]*(?:\s+(?:of|with|the|a|[A-Z][A-Za-z’'\-]*)){0,7})(?:\s*\(([^)]{1,80})\))?\.\s+/g;
  for (const section of sections) {
    const matches = [...section.text.matchAll(heading)];
    if (section.category === 'legendary' && matches.length && matches[0].index > 0) result.push({ id: 'legendary-overview', name: 'Legendary action rules', category: 'legendary', description: section.text.slice(0, matches[0].index).trim(), rolls: [] });
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i], baseName = match[1], modifier = match[2];
      if (section.category === 'action' && attacks.some(a => a.name.toLowerCase() === baseName.toLowerCase())) continue;
      const name = baseName + (modifier ? ` (${modifier})` : '');
      const description = section.text.slice(match.index + match[0].length, matches[i + 1]?.index ?? section.text.length).trim();
      if (!description) continue;
      const rolls = [];
      for (const die of description.matchAll(/\b(\d{1,2}d\d{1,3}(?:\s*[+-]\s*\d+)?)\)?\s+(\w+)\s+damage\b/gi)) {
        const formula = die[1].replaceAll(' ', ''); parseDice(formula);
        rolls.push({ id: `damage-${rolls.length + 1}`, label: `${die[2]} damage`, formula, kind: 'damage', damage_type: die[2].toLowerCase() });
      }
      const recharge = /Recharge\s+(\d)\s*[-–—]\s*6/i.exec(modifier || '');
      if (recharge) rolls.push({ id: 'recharge', label: 'Recharge', formula: '1d6', kind: 'recharge', threshold: Number(recharge[1]) });
      const save = /DC\s+(\d+)\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+saving throw/i.exec(description);
      const cone = /(\d+)\s*[-‐‑‒–—]*\s*foot cone/i.exec(description);
      const radius = /within\s+(\d+)\s+(?:feet|ft\.?)\s+of (?:the|this)/i.exec(description);
      const area = cone ? { shape: 'cone', size_ft: Number(cone[1]) } : radius ? { shape: 'radius', size_ft: Number(radius[1]) } : null;
      const cost = /Costs?\s+(\d+)\s+Actions?/i.exec(modifier || '');
      result.push({ id: idFor(section.category + '-' + baseName), name, category: section.category, description, rolls,
        ...(save ? { save: { dc: Number(save[1]), ability: save[2].slice(0, 3).toLowerCase(), half_on_success: /half as much(?: damage)? on (?:a )?success/i.test(description) } } : {}), ...(cost ? { cost: Number(cost[1]) } : {}), ...(area ? { area } : {}) });
    }
  }
  return result;
}
export function normalizeAdvancedActions(input) {
  check(Array.isArray(input) && input.length <= 60, 'Invalid advanced actions.'); const ids = new Set();
  return input.map(action => {
    check(action && typeof action.id === 'string' && /^[a-z0-9_-]{1,64}$/.test(action.id) && !ids.has(action.id), 'Invalid/duplicate advanced action ID.'); ids.add(action.id);
    check(typeof action.name === 'string' && action.name.length <= 180 && categories.includes(action.category) && typeof action.description === 'string' && action.description.length <= 6000, 'Invalid advanced action text/category.');
    check(Array.isArray(action.rolls) && action.rolls.length <= 10, 'Invalid advanced action dice.'); const rollIds = new Set();
    const rolls = action.rolls.map(roll => {
      check(roll && typeof roll.id === 'string' && /^[a-z0-9_-]{1,64}$/.test(roll.id) && !rollIds.has(roll.id), 'Invalid advanced roll ID.'); rollIds.add(roll.id);
      check(typeof roll.label === 'string' && roll.label.length <= 100 && ['damage', 'recharge'].includes(roll.kind), 'Invalid advanced roll.'); parseDice(roll.formula);
      check(roll.kind !== 'recharge' || (roll.formula === '1d6' && Number.isInteger(roll.threshold) && roll.threshold >= 1 && roll.threshold <= 6), 'Invalid recharge rule.');
      check(roll.damage_type === undefined || typeof roll.damage_type === 'string' && roll.damage_type.length <= 40, 'Invalid advanced damage type.');
      return { id: roll.id, label: roll.label, kind: roll.kind, formula: roll.formula, ...(roll.kind === 'recharge' ? { threshold: roll.threshold } : {}), ...(roll.damage_type ? { damage_type: roll.damage_type } : {}) };
    });
    if (action.save) check(Number.isInteger(action.save.dc) && action.save.dc >= 1 && action.save.dc <= 40 && ['str', 'dex', 'con', 'int', 'wis', 'cha'].includes(action.save.ability), 'Invalid action save.');
    if (action.save) check(action.save.half_on_success === undefined || typeof action.save.half_on_success === 'boolean', 'Invalid save damage rule.');
    if (action.area) check(['cone', 'radius', 'line'].includes(action.area.shape) && Number.isInteger(action.area.size_ft) && action.area.size_ft > 0 && action.area.size_ft <= 10000, 'Invalid area of effect.');
    check(action.cost === undefined || Number.isInteger(action.cost) && action.cost >= 1 && action.cost <= 10, 'Invalid action cost.');
    return { id: action.id, name: action.name, description: action.description, category: action.category, rolls, ...(action.save ? { save: { dc: action.save.dc, ability: action.save.ability, half_on_success: action.save.half_on_success === true } } : {}), ...(action.cost ? { cost: action.cost } : {}), ...(action.area ? { area: { shape: action.area.shape, size_ft: action.area.size_ft } } : {}), resolution: 'targeted-damage-manual-effects' };
  });
}
