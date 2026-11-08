// SPDX-License-Identifier: GPL-3.0-only
// Exact pin guards: correct native role checks, restrict tabletop property exposure,
// and register the optional bridge without adding public APIs to a normal launch.
const fs=require('fs'),path=process.argv[2];let text=fs.readFileSync(path,'utf8');
for(const [before,after]of [
 ['if (tabletop.gameMasters.includes(userId)) {','if (!tabletop.gameMasters.includes(userId)) {'],
 ['if (tabletop.owner !== userId && tabletop.gameMasters.includes(userId)) {','if (tabletop.owner !== userId && !tabletop.gameMasters.includes(userId)) {'],
 ['const creatureIds = creatureSummariesCursor.map(c => c._id);', 'const creatureIds = creatureSummariesCursor.fetch().filter(c => tabletop.owner === userId || tabletop.gameMasters.includes(userId) || c.owner === userId || (c.readers || []).includes(userId) || (c.writers || []).includes(userId)).map(c => c._id);']
]){if(text.split(before).length!==2)throw Error('Unknown pinned tabletop layout: '+before);text=text.replace(before,after);}
// Shared source patches run before compilation, fixing both client and server.
if (!/saveProp\s*=\s*_objectSpread[\s\S]{0,700}type:\s*['"]savingThrow/.test(text))throw Error('Shared native save source patch missing from compiled server');
text+='\nif (process.env.DC_DR_CONFIG) Npm.require("/opt/dc-dr-assets/native-server.cjs")(require, {Meteor,Package,Mongo,EJSON,Random});\n';fs.writeFileSync(path,text);
