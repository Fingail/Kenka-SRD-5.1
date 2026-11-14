// SPDX-License-Identifier: GPL-3.0-only
const {test}=require('node:test'),assert=require('node:assert/strict'),install=require('./native-log-write.cjs');
function fixture(){let max=32,writes=0;const schema={extend(fields){max=fields.content.maxCount;},clean:doc=>({...doc,date:new Date()}),validate(doc){if(doc.content.length>max)throw Error('Too many log entries');if(!doc.creatureId)throw Error('Missing actor');}},Logs={simpleSchema:()=>schema},writeModule={default:async action=>{writes++;return action._id;}},deps={Logs,writeModule,toLog:m=>m.contents||[]};install(deps);return {deps,writeModule,writes:()=>writes};}
test('multi-target Fire Breath with more than 32 results persists all entries',async()=>{const f=fixture(),action={_id:'breath',creatureId:'dragon',tabletopId:'table',results:[{mutations:[{contents:Array.from({length:80},(_,i)=>({name:'Result '+i,targetIds:['target'+i]}))}]}]};assert.equal(await f.writeModule.default(action),'breath');assert.equal(f.writes(),1);assert.equal(action.results[0].mutations[0].contents.length,80);install(f.deps);assert.equal(await f.writeModule.default(action),'breath');assert.equal(f.writes(),2);});
test('oversized or invalid logs fail before native HP writes or action deletion',async()=>{
 const f=fixture(),huge={_id:'huge',creatureId:'dragon',results:[{mutations:[{contents:Array.from({length:4097},()=>({name:'Result'}))}]}]};
 for(const action of [{_id:'invalid',results:[]},huge])await assert.rejects(f.writeModule.default(action));
 assert.equal(f.writes(),0);
});

test('each target save and damage result retains its recipient without changing property mutations',()=>{
 class TaskResult{constructor(){this.mutations=[];}appendLog(content,targetIds){if(!this.mutations.length)this.mutations.push({targetIds,contents:[]});this.mutations.at(-1).contents.push(content);}}
 const f=fixture();install({...f.deps,Logs:{simpleSchema:f.deps.Logs.simpleSchema},TaskResult});
 const result=new TaskResult();result.mutations.push({targetIds:['pc'],updates:[{propId:'hp',inc:{damage:5}}],contents:[]});
 result.appendLog({name:'PC save'},['pc']);result.appendLog({name:'NPC save'},['npc']);result.appendLog({name:'NPC damage'},['npc']);
 assert.equal(result.mutations.length,2);assert.deepEqual(result.mutations[0].updates,[{propId:'hp',inc:{damage:5}}]);assert.deepEqual(result.mutations[1].targetIds,['npc']);assert.deepEqual(result.mutations[1].contents.map(c=>c.name),['NPC save','NPC damage']);
});
