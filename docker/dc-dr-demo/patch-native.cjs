// SPDX-License-Identifier: GPL-3.0-only
// Exact pin guards: correct native role checks, restrict tabletop property exposure,
// and register the optional bridge without adding public APIs to a normal launch.
const fs=require('fs'),path=process.argv[2];let text=fs.readFileSync(path,'utf8');
for(const [before,after]of [
 ['if (tabletop.gameMasters.includes(userId)) {','if (!tabletop.gameMasters.includes(userId)) {'],
 ['if (tabletop.owner !== userId && tabletop.gameMasters.includes(userId)) {','if (tabletop.owner !== userId && !tabletop.gameMasters.includes(userId)) {'],
 ['const creatureIds = creatureSummariesCursor.map(c => c._id);', 'const creatureIds = creatureSummariesCursor.fetch().filter(c => tabletop.owner === userId || tabletop.gameMasters.includes(userId) || c.owner === userId || (c.readers || []).includes(userId) || (c.writers || []).includes(userId)).map(c => c._id);']
]){if(text.split(before).length!==2)throw Error('Unknown pinned tabletop layout: '+before);text=text.replace(before,after);}
const saveShape = `saveProp = {
        node: _objectSpread(_objectSpread({}, prop.save), {}, {
          name: prop.save.stat,
          silent: prop.silent
        }),
        children: []
      };`;
const saveShapeFixed = `saveProp = Object.assign({}, prop.save, {
        _id: prop._id + '-save', root: prop.root, type: 'savingThrow', target: 'target',
        name: prop.save.stat, silent: prop.silent
      });`;
if(text.split(saveShape).length!==2)throw Error('Unknown native damage/save adapter');text=text.replace(saveShape,saveShapeFixed);
const targetPattern=/prop: saveProp,\s+targetIds: task\.targetIds/;
if((text.match(new RegExp(targetPattern.source,'g'))||[]).length!==2)throw Error('Unknown native save target layout');
// Only the first call is inside the per-target loop. The second is the no-target logging case.
text=text.replace(targetPattern,'prop: saveProp, targetIds: [target]');
for(const [before,after] of [
 ["getConstantValueFromScope('~saveSucceeded', scope)", "getConstantValueFromScope('~saveSucceeded', Promise.await(getEffectiveActionScope(action)))"],
 ["Promise.await(applySavingThrowProperty(saveProp, action, result, inputProvider));", "/* No duplicate save: the task below owns the no-target case. */"],
 ["recalculateCalculation(prop.dc, action, 'reduce', inputProvider);", "Promise.await(recalculateCalculation(prop.dc, action, 'reduce', inputProvider));"]
]){if(text.split(before).length!==2)throw Error('Unknown native save layout: '+before);text=text.replace(before,after);}
for(const [before,after]of [
 ['const totalDamage = amount;', `const totalDamage = amount;
    result.appendLog({name: damageType === 'healing' ? 'Healing total' : 'Damage total', value: '**' + amount + '** ' + damageType, inline: true}, [targetId]);`],
 ['damageToApply = applyDamageMultipliers({\n          target,', 'damageToApply = applyDamageMultipliers({\n          target: {variables: require("/imports/api/engine/loadCreatures.ts").getVariables(target)},']
]){if(text.split(before).length!==2)throw Error('Unknown native damage total/defense layout');text=text.replace(before,after);}
text+='\nif (process.env.DC_DR_CONFIG) Npm.require("/opt/dc-dr-assets/native-server.cjs")(require, {Meteor,Package,Mongo,EJSON,Random});\n';fs.writeFileSync(path,text);
