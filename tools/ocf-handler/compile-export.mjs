// Read-only authoring bridge: Kanka definitions in, validated combat JSON out.
import { pathToFileURL } from 'node:url';
import { check, normalizeSheet } from './core.mjs';
import { selectCombatDefinition } from './encounter-source.mjs';
import { skillAbilities } from './extended-sheet.mjs';

const text = value => String(value || '').replace(/<[^>]*>/g, ' ').replaceAll('&nbsp;', ' ').replace(/\s+/g, ' ').trim();
const slug = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export function compileExport({ entity, attributes, posts = [], abilities = [] }) {
  check(['character', 'creature'].includes(entity.type), 'Export a character or creature.');
  const role = entity.type === 'character' ? 'pc' : 'enemy';
  const baseline = selectCombatDefinition(entity, attributes, role).sheet;
  const sheet = structuredClone(baseline);
  const field = name => {
    const matches = attributes.filter(a => a.name.toLowerCase() === name.toLowerCase());
    check(matches.length <= 1, 'Ambiguous source property: ' + name);
    return matches[0]?.value;
  };
  const number = name => {
    const value = field(name); if (value === undefined) return undefined;
    const match = /^\s*([+-]?\d+)(?:\b|\s)/.exec(String(value));
    check(match, 'Invalid source property: ' + name); return Number(match[1]);
  };
  sheet.review_notes = [...(sheet.review_notes || [])];
  for (const [key, name] of Object.entries({ ac: 'Armor class', hp_max: 'HP maximum', initiative: 'Initiative', speed_ft: 'Speed', proficiency_bonus: 'Proficiency bonus' })) {
    const value = number(name); if (value !== undefined) sheet.stats[key] = value;
  }
  for (const [key, name] of Object.entries({ str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' })) {
    const value = number(name); if (value !== undefined) sheet.stats.abilities[key] = value;
  }
  const combatPosts = posts.filter(p => p.name === 'Combat, skills, and proficiencies');
  check(combatPosts.length <= 1, 'Ambiguous combat article.');
  if (combatPosts.length) {
    const article = text(combatPosts[0].entry);
    const saves = /Saving throws:\s*(.*?)(?:Sheet skills:|$)/i.exec(article)?.[1];
    if (saves) {
      sheet.saving_throws = Object.fromEntries(Object.keys(sheet.stats.abilities).map(key => {
        const match = new RegExp('\\b' + key + '\\s+([+-]\\d+)', 'i').exec(saves);
        check(match, 'Incomplete recorded saving throws.'); return [key, Number(match[1])];
      }));
    }
    const skills = /Sheet skills:\s*(.*?)(?:Marked proficiencies:|Attacks:|$)/i.exec(article)?.[1];
    const marked = /Marked proficiencies:\s*([^.]*)/i.exec(article)?.[1] || '';
    if (skills) sheet.skills = Object.entries(skillAbilities).flatMap(([id, ability]) => {
      const name = id.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
      const match = new RegExp('\\b' + name + '\\s+([+-]\\d+)', 'i').exec(skills);
      return match ? [{ id, name, ability, bonus: Number(match[1]), proficient: marked.toLowerCase().includes(name.toLowerCase()) }] : [];
    });
    const attacks = /Attacks:\s*(.*?)(?:Tools:|$)/i.exec(article)?.[1];
    if (attacks) {
      const prior = new Map(sheet.attacks.map(a => [slug(a.name), a]));
      const parsed = [...attacks.matchAll(/(?:^|;\s*)([A-Za-z '’-]+)\s+([+-]\d+)[^;]*?,\s*(\d+d\d+(?:\s*[+-]\s*\d+)?)\s+(\w+)\b/g)].map(m => {
        const name = m[1].trim(), id = slug(name);
        return { ...(prior.get(id) || {}), id, name, attack_bonus: Number(m[2]), damage: m[3].replaceAll(' ', ''), damage_type: m[4] };
      });
      check(parsed.length, 'Recorded attacks could not be parsed.');
      sheet.attacks = parsed;
    }
  }
  sheet.proficiencies ||= {};
  for (const [key, name] of Object.entries({ armor: 'Armor proficiencies', weapons: 'Weapon proficiencies', tools: 'Tool proficiencies', languages: 'Languages' })) {
    const value = field(name); if (value !== undefined) sheet.proficiencies[key] = value.split(';').map(s => s.trim()).filter(Boolean);
  }
  if (abilities.length) sheet.features = abilities.filter(a => !/^Reference\b/i.test(a.assignment_note || '') && a.type !== 'Spell').slice(0, 30).map(a => ({
    id: 'kanka-' + a.entity_id, name: a.name.slice(0, 100), source_entity_id: a.entity_id,
    rule: /Colossus Slayer/i.test(a.name) ? 'colossus_slayer' : 'reference',
    description: text(a.entry).slice(0, 2000) || 'See linked Kanka ability.',
  }));
  const review = posts.find(p => p.name === 'Source review and unresolved selections');
  if (review) {
    sheet.review_notes.push('Review source selections in Kanka: ' + text(review.entry).slice(0, 150));
    sheet.review_notes.push('REVIEW REQUIRED: unresolved source selections remain placeholders in the PCGen authoring sheet; recorded combat totals are preserved.');
  }
  sheet.review_notes.push('Exported from fresh Kanka reads. Current HP, effects, consumed resources and demo supplies are excluded.');
  sheet.review_notes = sheet.review_notes.slice(0, 20);
  normalizeSheet(sheet, entity); // Reject mismatched identities and unsupported combat fields.
  return sheet;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let input = ''; for await (const chunk of process.stdin) { input += chunk; check(input.length <= 4_000_000, 'Source export too large.'); }
  process.stdout.write(JSON.stringify(compileExport(JSON.parse(input)), null, 2) + '\n');
}
