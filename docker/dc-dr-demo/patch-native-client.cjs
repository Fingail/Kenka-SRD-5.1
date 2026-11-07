// SPDX-License-Identifier: GPL-3.0-only
// Pause the native action before simulation/dice while turn approval is pending.
const fs=require('fs'),path=require('path').join(process.argv[2],'imports/client/ui/creature/actions/doAction.ts');let text=fs.readFileSync(path,'utf8');
const before='  // Create the action\n  const actionId = insertAction.call({';
const after="  // Optional tabletop turn coordinator; native dialogs and engine still resolve the action.\n  if (Meteor.isClient && (window as any).diceCombatGate) {\n    await (window as any).diceCombatGate({ creatureId, task });\n  }\n"+before;
if(text.includes('await (window as any).diceCombatGate'))process.exit(0);
if(text.split(before).length!==2)throw Error('Unknown pinned native action entrypoint');fs.writeFileSync(path,text.replace(before,after));
