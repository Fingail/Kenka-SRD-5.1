// SPDX-License-Identifier: GPL-3.0-only
// Guarded source fixes shared by native client simulation and server resolution.
const fs=require('fs'),path=require('path'),root=process.argv[2];
function edit(file,patches){const target=path.join(root,file);let text=fs.readFileSync(target,'utf8');for(const [before,after]of patches){if(text.includes(after))continue;if(text.split(before).length!==2)throw Error('Unknown pinned native source: '+file+' / '+before.slice(0,65));text=text.replace(before,after);}fs.writeFileSync(target,text);}
const before='  // Create the action\n  const actionId = insertAction.call({';
edit('imports/client/ui/creature/actions/doAction.ts',[[before,"  // Optional tabletop turn coordinator; native dialogs and engine still resolve the action.\n  if (Meteor.isClient && (window as any).diceCombatGate) {\n    await (window as any).diceCombatGate({ creatureId, task });\n  }\n"+before]]);
edit('imports/api/engine/action/applyProperties/applyDamageProperty.ts',[
 ["import { getPropertiesOfType } from '/imports/api/engine/loadCreatures';","import { getPropertiesOfType, getVariables } from '/imports/api/engine/loadCreatures';"],
 [`saveProp = {
      node: {
        ...prop.save,
        name: prop.save.stat,
        silent: prop.silent,
      },
      children: [],
    }`,`saveProp = {
      ...prop.save,
      _id: prop._id + '-save', root: prop.root, type: 'savingThrow', target: 'target',
      name: prop.save.stat, silent: prop.silent,
    }`],
 ['prop: saveProp,\n          targetIds: task.targetIds,','prop: saveProp,\n          targetIds: [target],'],
 ["getConstantValueFromScope('~saveSucceeded', scope)","getConstantValueFromScope('~saveSucceeded', await getEffectiveActionScope(action))"],
 ['      await applySavingThrowProperty(saveProp, action, result, inputProvider);','      // The task below owns the no-target saving throw.'],
 ['damageToApply = applyDamageMultipliers({\n        target,','damageToApply = applyDamageMultipliers({\n        target: { variables: getVariables(target) },'],
 ['const totalDamage = amount;',`const totalDamage = amount;
  result.appendLog({name: damageType === 'healing' ? 'Healing total' : 'Damage total', value: '**' + amount + '** ' + damageType, inline: true}, [targetId]);`],
]);
edit('imports/api/engine/action/applyProperties/applySavingThrowProperty.ts',[
 ["    recalculateCalculation(prop.dc, action, 'reduce', inputProvider);","    await recalculateCalculation(prop.dc, action, 'reduce', inputProvider);"],
]);
