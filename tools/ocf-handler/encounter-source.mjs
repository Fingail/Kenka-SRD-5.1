import { check } from './core.mjs';
import { parseAdvancedActions } from './advanced-actions.mjs';
import { skillAbilities } from './extended-sheet.mjs';
export function parseMentions(entry) {
  const rows = [];
  for (const match of entry.replaceAll('&nbsp;', ' ').matchAll(/(?<![\w\d])(?:(\d{1,3})\s*[x×]\s*)?\[(character|creature):(\d+)(?:\|[^\]]*)?\]/gi)) rows.push({ entity_id: Number(match[3]), role: match[2].toLowerCase() === 'character' ? 'pc' : 'enemy', count: Number(match[1] || 1) });
  return rows;
}
export function expandParticipants(rows) {
  const totals = new Map(), ordinals = new Map();
  for (const row of rows) { const count = row.count ?? 1; check(Number.isSafeInteger(count) && count >= 1 && count <= 20, 'Creature quantity must be 1–20.'); check(row.role !== 'pc' || count === 1, 'Repeated PCs need distinct source characters.'); totals.set(row.entity_id, (totals.get(row.entity_id) || 0) + count); }
  const result = [];
  for (const row of rows) for (let i = 0; i < (row.count ?? 1); i++) { const ordinal = (ordinals.get(row.entity_id) || 0) + 1; ordinals.set(row.entity_id, ordinal); check(row.role !== 'pc' || ordinal === 1, 'Duplicate PC links.'); result.push({ entity_id: row.entity_id, role: row.role, instance_key: `${row.entity_id}#${ordinal}`, instance_ordinal: ordinal, instance_count: totals.get(row.entity_id) }); }
  check(result.length > 0 && result.length <= 40, 'Encounter needs 1–40 participants.'); return result;
}
const plain = html => html.replace(/<br\s*\/?\s*>|<\/h\d>/gi, '\n').replace(/<[^>]+>/g, ' ').replaceAll('&nbsp;', ' ').replaceAll('−', '-').replace(/\s+/g, ' ').trim();
export function creatureSheet(entity, attributes) {
  check(entity.type === 'creature', 'Select a creature.');
  check(attributes.some(a => a.name === '_srd_key' && a.value.startsWith('srd5.1:creature:')), 'Select local SRD data.');
  return npcPropertySheet(entity, attributes);
}
export function npcPropertySheet(entity, attributes) {
  const key = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const lookup = (aliases, required = false) => {
    const names = aliases.map(key), matches = attributes.filter(a => names.includes(key(a.name)) || names.includes(key(a.api_key)));
    check(matches.length <= 1, `Ambiguous NPC property ${aliases[0]}.`);
    check(!required || matches.length, `Missing NPC property ${aliases[0]}.`);
    return matches[0]?.value;
  };
  const number = (aliases, required = true) => {
    const value = lookup(aliases, required); if (value === undefined) return undefined;
    const match = /^\s*([+-]?\d+)/.exec(String(value)); check(match, `Invalid NPC property ${aliases[0]}.`); return Number(match[1]);
  };
  const json = aliases => { const value = lookup(aliases); if (value === undefined) return undefined; try { return JSON.parse(value); } catch { check(false, `Invalid JSON in NPC property ${aliases[0]}.`); } };
  const labels = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
  const abilities = Object.fromEntries(Object.entries(labels).map(([k, label]) => [k, number([k, label])]));
  const text = plain(entity.child?.entry || ''), saving_throws = Object.fromEntries(Object.entries(abilities).map(([k, v]) => [k, Math.floor((v - 10) / 2)]));
  const saves = /Saving Throws (.*?)(?:Skills|Damage|Senses|Languages|Challenge)/i.exec(text)?.[1] || '';
  for (const match of saves.matchAll(/\b(Str|Dex|Con|Int|Wis|Cha)\s+([+-]\d+)/g)) saving_throws[match[1].toLowerCase()] = Number(match[2]);
  const attacks = [];
  for (const match of (text.split(/\bActions\b/)[1] || text).matchAll(/([A-Z][A-Za-z '’\-]{0,45})\.\s*(?:Melee|Ranged)(?: or Ranged)? Weapon Attack:\s*([+-]\d+) to hit,.{0,200}?\bHit:\s*\d+\s*\((\d+d\d+(?:\s*[+-]\s*\d+)?)\)\s+(\w+) damage\./g)) {
    const name = match[1].trim(); attacks.push({ id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, attack_bonus: Number(match[2]), damage: match[3].replaceAll(' ', ''), damage_type: match[4] });
  }
  const recordedAttacks = json(['Attacks', 'Combat attacks', 'ocf_attacks']);
  if (recordedAttacks !== undefined) { check(Array.isArray(recordedAttacks), 'NPC Attacks must be a JSON array.'); attacks.splice(0, attacks.length, ...recordedAttacks); }
  const skills = [];
  const skillText = /Skills (.*?)(?:Damage|Senses|Languages|Challenge)/i.exec(text)?.[1] || '';
  for (const [id, ability] of Object.entries(skillAbilities)) { const name = id.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase()); const match = new RegExp(name + '\\s+([+-]\\d+)', 'i').exec(skillText); if (match) skills.push({ id, name, ability, bonus: Number(match[1]) }); }
  const bonusList = value => String(value).split(/[,;]/).map(part => { const match = /^\s*([a-z][a-z ]*?)\s*([+-]\d+)\s*$/i.exec(part); check(match, 'Invalid NPC bonus list. Use names and signed bonuses, separated by commas.'); return [match[1].trim(), Number(match[2])]; });
  const savesValue = lookup(['Saving throws', 'ocf_saving_throws']), skillsValue = lookup(['Skills', 'ocf_skills']);
  let recordedSaves, recordedSkills;
  if (savesValue !== undefined) {
    if (String(savesValue).trim().startsWith('{')) recordedSaves = { ...saving_throws, ...json(['Saving throws', 'ocf_saving_throws']) };
    else { recordedSaves = { ...saving_throws }; for (const [name, bonus] of bonusList(savesValue)) { const ability = Object.keys(labels).find(a => a === name.toLowerCase() || labels[a].toLowerCase() === name.toLowerCase()); check(ability, 'Unknown NPC saving throw ability.'); recordedSaves[ability] = bonus; } }
  }
  if (skillsValue !== undefined) {
    if (String(skillsValue).trim().startsWith('[')) recordedSkills = json(['Skills', 'ocf_skills']);
    else recordedSkills = bonusList(skillsValue).map(([name, bonus]) => { const id = name.toLowerCase().replaceAll(' ', '_'); check(skillAbilities[id], 'Unknown NPC skill.'); return { id, name, ability: skillAbilities[id], bonus }; });
  }
  for (const [ability, label] of Object.entries(labels)) {
    const value = number([`${ability} save`, `${label} saving throw`], false); if (value !== undefined) saving_throws[ability] = value;
  }
  if (recordedSkills === undefined) for (const [id, ability] of Object.entries(skillAbilities)) {
    const name = id.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
    const bonus = number([name, `Skill ${name}`], false); if (bonus !== undefined) { const index = skills.findIndex(skill => skill.id === id); if (index >= 0) skills.splice(index, 1); skills.push({ id, name, ability, bonus }); }
  }
  const stats = { ac: number(['Armor class', 'AC']), hp_max: number(['HP maximum', 'hp_max', 'hit_points', 'Hit points', 'Maximum HP']), initiative: number(['Initiative'], false) ?? Math.floor((abilities.dex - 10) / 2), speed_ft: number(['Speed', 'speed_ft', 'Walking speed']), abilities };
  const proficiency = number(['Proficiency bonus'], false); if (proficiency !== undefined) stats.proficiency_bonus = proficiency;
  const proficiencies = json(['Proficiencies', 'ocf_proficiencies']), features = json(['Features', 'ocf_features']);
  const damageTraits = damageTraitsFromProperties(attributes);
  return { schema: 'kanka-combat-sheet/1', edition: '5e-2014', source: { campaign_id: entity.campaign_id, entity_id: entity.id }, stats, damage_traits: damageTraits, saving_throws: recordedSaves ?? saving_throws, skills: recordedSkills ?? skills, attacks,
    advanced_actions: json(['Advanced actions', 'ocf_advanced_actions']) ?? parseAdvancedActions(entity.child?.entry, attacks),
    ...(proficiencies === undefined ? {} : { proficiencies }), ...(features === undefined ? {} : { features }),
    review_notes: ['Compiled from Kanka properties and entries. Targeted actions support saves/damage; conditions and situational rules remain GM-managed. Explicit properties override entry parsing.', ...(attacks.length ? [] : ['No supported attack data recorded; add an Attacks JSON property to enable targeted attacks.'])] };

}
export function damageTraitsFromProperties(attributes) {
  const key = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const get = aliases => { const names=aliases.map(key), found=attributes.filter(a => names.includes(key(a.name)) || names.includes(key(a.api_key))); check(found.length<=1,'Ambiguous damage defense property.'); return found[0]?.value; };
  const rawJson=get(['Damage traits','ocf_damage_traits']); let traits={};
  if (rawJson !== undefined) { try { traits=JSON.parse(rawJson); } catch { check(false,'Invalid Damage traits JSON.'); } check(traits && typeof traits==='object' && !Array.isArray(traits),'Damage traits must be an object.'); }
  const types=['acid','bludgeoning','cold','fire','force','lightning','necrotic','piercing','poison','psychic','radiant','slashing','thunder'];
  for (const kind of ['immunities','resistances','vulnerabilities']) {
    const raw=get([`Damage ${kind}`]); if (raw===undefined || traits[kind]!==undefined) continue;
    const parts=String(raw).toLowerCase().replace(/\band\b/g,',').split(/[,;]/).map(s=>s.trim()).filter(Boolean);
    if (parts.every(t=>types.includes(t))) traits[kind]=parts; else { traits.manual ||= []; traits.manual.push(String(raw).slice(0,200)); }
  }
  return traits;
}
export function newTokenPosition(tokens, width, height) {
  for (let y = Math.min(200, height / 4); y < height - 70; y += 180) for (let x = 200; x < width - 70; x += 220) if (tokens.every(t => Math.hypot(t.x - x, t.y - y) > (t.radius || 44) + 60)) return { x, y };
  return { x: width / 2, y: height / 2 };
}

// Definition storage depends on encounter role; PC baseline properties remain intact.
export function selectCombatDefinition(entity, attributes, role, importedSheet) {
  if (role === 'pc' && importedSheet) return { sheet: importedSheet, origin: 'Imported PC JSON' };
  const matches = attributes.filter(a => a.api_key === 'ocf_combat_v1' || a.name === 'OCF Combat Sheet v1');
  check(matches.length <= 1, `Ambiguous OCF Combat Sheet v1 properties on ${entity.name}.`);
  if (matches.length) {
    let sheet; try { sheet = JSON.parse(matches[0].value); } catch { check(false, `Invalid JSON sheet on ${entity.name}.`); }
    if (role !== 'pc' && sheet.advanced_actions === undefined) sheet = { ...sheet, advanced_actions: parseAdvancedActions(entity.child?.entry, sheet.attacks || []) };
    if (role !== 'pc' && sheet.damage_traits === undefined) sheet = { ...sheet, damage_traits: damageTraitsFromProperties(attributes) };
    return { sheet, origin: role === 'pc' ? 'Kanka PC baseline' : 'Kanka OCF Combat Sheet v1' };
  }
  check(role !== 'pc', `${entity.name}: provide imported PC JSON or a baseline OCF Combat Sheet v1 property.`);
  return { sheet: npcPropertySheet(entity, attributes), origin: 'Kanka properties and entry' };
}
