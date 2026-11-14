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
// Eligible d20s carry explicit rule context through simulation and replay.
edit('imports/api/engine/action/functions/userInput/InputProvider.ts',[[
 '    dice: { number: number, diceSize: number }[]\n  ): Promise<number[][]>;',
 '    dice: { number: number, diceSize: number }[], context?: any\n  ): Promise<number[][]>;'
]]);
edit('imports/api/engine/action/functions/userInput/getDeterministicDiceRoller.ts',[
 ['): (dice: { number: number, diceSize: number }[]) => Promise<number[][]> {','): (dice: { number: number, diceSize: number }[], context?: any) => Promise<number[][]> {'],
 ['  return (dice) => {','  let rollIndex = 0;\n  return (dice, context) => {'],
 ['    return Promise.resolve(results);',`    const index = rollIndex++;
    const hook = Meteor.isClient ? (window as any).diceLuckyRoll : (globalThis as any).diceLuckyRoll;
    return Promise.resolve(hook ? hook(actionId, dice, results, context, index) : results);`],
]);
edit('imports/api/engine/action/functions/userInput/getReplayChoicesInputProvider.ts',[
 ['    rollDice(dice) {','    rollDice(dice, context) {'],
 ['      return dRoller(dice);','      return dRoller(dice, context);'],
]);
edit('imports/client/ui/creature/actions/ActionDialog.vue',[
 ['    async rollDice(dice) {','    async rollDice(dice, context) {'],
 ['return Promise.resolve(this.deterministicDiceRoller(dice));','return Promise.resolve(this.deterministicDiceRoller(dice, context));'],
]);
// All three native advantage paths receive the same eligibility metadata.
function diceContexts(file,receiver,context){const target=path.join(root,file);let text=fs.readFileSync(target,'utf8');for(const n of [1,2]){const before=`${receiver}.rollDice([{ number: ${n}, diceSize: 20 }])`,after=`${receiver}.rollDice([{ number: ${n}, diceSize: 20 }], ${context})`;if(!text.includes(after)){if(!text.includes(before))throw Error('Missing native d20 call: '+file);text=text.split(before).join(after);}}fs.writeFileSync(target,text);}
diceContexts('imports/api/engine/action/tasks/applyCheckTask.ts','userInput',"{kind: checkParams.skillVariableName === 'initiative' ? 'initiative' : skill?.skillType === 'save' || /Save$/.test(checkParams.skillVariableName || '') ? 'save' : 'check', creatureId: targetId, modifier: totalModifier, dc: dc, advantage}");
diceContexts('imports/api/engine/action/applyProperties/applySavingThrowProperty.ts','inputProvider',"{kind: 'save', creatureId: targetId, modifier: rollModifier, dc, advantage: save.advantage || 0}");
edit('imports/api/engine/action/applyProperties/applyActionProperty.ts',[
 ['async function rollAttack(attack, scope: any, resultPushScope, userInput: InputProvider) {','async function rollAttack(attack, scope: any, resultPushScope, userInput: InputProvider, rollContext: any) {'],
]);
// Two separate attack callers: with a target and without one.
{const file='imports/api/engine/action/applyProperties/applyActionProperty.ts',target=path.join(root,file);let text=fs.readFileSync(target,'utf8');const before='await rollAttack(attack, scope, taskResult.pushScope, userInput);';if(text.includes(before)){if(text.split(before).length!==3)throw Error('Unexpected native attack callers');text=text.replace(before,"await rollAttack(attack, scope, taskResult.pushScope, userInput, {kind: 'attack', creatureId: action.creatureId, targetId});");text=text.replace(before,"await rollAttack(attack, scope, taskResult.pushScope, userInput, {kind: 'attack', creatureId: action.creatureId});");fs.writeFileSync(target,text);}}
diceContexts('imports/api/engine/action/applyProperties/applyActionProperty.ts','userInput',"{...rollContext, modifier: attack.value, advantage}");
