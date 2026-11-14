// Small SRD 5.1 evaluation library, not a complete 5e implementation.
// Rules attribution: https://dnd.wizards.com/resources/systems-reference-document
// SRD 5.1 is CC BY 4.0: https://creativecommons.org/licenses/by/4.0/
export function demoNodes() {
  const nodes = [];
  const add = (key, parent, data) => nodes.push({ key, parent, data });
  const description = text => ({ text });
  add('base', null, { type: 'folder', name: '2014 SRD — advancement demo', fillSlots: true, libraryTags: ['base'], description: description('Small evaluation library: Fighter levels 1–5, selected build choices and calculated stats. Not the complete SRD. Demo ability scores are fixed training values; no campaign character is imported.') });
  const scores = { strength: 15, dexterity: 14, constitution: 13, intelligence: 10, wisdom: 12, charisma: 8 };
  for (const [name, score] of Object.entries(scores)) {
    add(name, 'base', { type: 'attribute', name: name[0].toUpperCase() + name.slice(1), variableName: name, attributeType: 'ability', baseValue: { calculation: String(score) } });
    add(name + 'Save', 'base', { type: 'skill', name: name[0].toUpperCase() + name.slice(1) + ' save', variableName: name + 'Save', skillType: 'save', ability: name, ...(['strength', 'constitution'].includes(name) ? { baseProficiency: 1 } : {}) });
  }
  for (const [key, name, kind, formula] of [
    ['proficiencyBonus', 'Proficiency bonus', 'modifier', 'floor((level-1)/4)+2'],
    ['hitPoints', 'Hit points', 'healthBar', '10+(fighter.level-1)*6+fighter.level*constitution.modifier'],
    ['armorClass', 'Armor class', 'stat', '10+dexterity.modifier'],
    ['speed', 'Speed (feet)', 'stat', '30'],
    ['initiative', 'Initiative', 'modifier', 'dexterity.modifier'],
  ]) add(key, 'base', { type: 'attribute', name, variableName: key, attributeType: kind, baseValue: { calculation: formula } });
  add('bow', 'base', { type: 'skill', name: 'Longbow attack', variableName: 'bow', skillType: 'weapon', ability: 'dexterity', baseProficiency: 1 });
  add('fighter', 'base', { type: 'class', name: 'Fighter', variableName: 'fighter', description: description('Use Level Up to add the next class level. This demo uses average HP after first level; test class features and build choices through level 5.') });
  add('fighter1', 'fighter', { type: 'classLevel', name: 'Fighter 1', variableName: 'fighter', level: 1 });
  add('style', 'fighter1', { type: 'propertySlot', name: 'Fighting style', slotTags: ['fighter-style'], quantityExpected: { calculation: '1' } });
  add('secondWind', 'fighter1', { type: 'attribute', name: 'Second Wind uses', variableName: 'secondWind', attributeType: 'resource', baseValue: { calculation: '1' }, description: description('Bonus action: recover 1d10 + fighter level HP. Recover the use after a short or long rest; healing is manual in this evaluation library.') });
  for (let level = 2; level <= 5; level++) {
    add('fighter' + level, null, { type: 'classLevel', name: 'Fighter ' + level, variableName: 'fighter', level, fillSlots: true, libraryTags: ['fighter'] });
  }
  add('actionSurge', 'fighter2', { type: 'attribute', name: 'Action Surge uses', variableName: 'actionSurge', attributeType: 'resource', baseValue: { calculation: '1' }, description: description('Take one additional action on your turn. Recover the use after a short or long rest. Track expenditure manually.') });
  add('archetype', 'fighter3', { type: 'propertySlot', name: 'Martial archetype', slotTags: ['fighter-archetype'], quantityExpected: { calculation: '1' } });
  add('asi', 'fighter4', { type: 'propertySlot', name: 'Ability score improvement', slotTags: ['demo-asi'], quantityExpected: { calculation: '1' }, description: description('This demo offers the +2-to-one-score option. The alternative +1 to two scores and feats are not included.') });
  add('extraAttack', 'fighter5', { type: 'feature', name: 'Extra Attack', description: description('When taking the Attack action, make two attacks instead of one. Combat execution is outside this advancement demo.') });
  for (const name of ['Archery', 'Defense', 'Dueling', 'Great Weapon Fighting', 'Protection', 'Two-Weapon Fighting']) {
    add('style-' + name, null, { type: 'feature', name, fillSlots: true, libraryTags: ['fighter-style'], description: description(name === 'Archery' ? 'Gain +2 on ranged weapon attack rolls. The demo Longbow attack is adjusted automatically.' : 'SRD fighting style reference; situational effects are adjudicated manually in this small demo.') });
  }
  add('archeryBonus', 'style-Archery', { type: 'effect', name: 'Archery', operation: 'add', stats: ['bow'], amount: { calculation: '2' } });
  add('champion', null, { type: 'feature', name: 'Champion', fillSlots: true, libraryTags: ['fighter-archetype'] });
  add('improvedCritical', 'champion', { type: 'feature', name: 'Improved Critical', description: description('Weapon attacks score a critical hit on a natural 19 or 20. Automatic critical resolution is outside this demo.') });
  for (const name of Object.keys(scores)) {
    add('asi-' + name, null, { type: 'feature', name: '+2 ' + name, fillSlots: true, libraryTags: ['demo-asi'], slotFillerCondition: name + ' <= 18', description: description('Increase this ability by 2, up to a score of 20.') });
    add('asiEffect-' + name, 'asi-' + name, { type: 'effect', name: '+2 ' + name, operation: 'add', stats: [name], amount: { calculation: '2' } });
  }
  return nodes;
}
