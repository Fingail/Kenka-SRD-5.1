// SPDX-License-Identifier: GPL-3.0-only
// Large AoE logs must validate before native persistence changes HP or removes
// the pending action. This also guards other schema failures from partial writes.
const installed=new WeakSet();
module.exports=({Logs,writeModule,toLog,TaskResult})=>{
 if(installed.has(Logs))return;
 const schema=Logs.simpleSchema();
 schema.extend({content:{type:Array,defaultValue:[],maxCount:4096}});
 // Native appendLog otherwise attaches every save to the first target's
 // mutation even when called with another target. Keep the specified recipient.
 if(TaskResult&&!TaskResult.prototype.__diceLogTargets){
  const append=TaskResult.prototype.appendLog;
  TaskResult.prototype.appendLog=function(content,targetIds){
   const last=this.mutations[this.mutations.length-1];
   if(last&&JSON.stringify(last.targetIds)!==JSON.stringify(targetIds))this.mutations.push({targetIds,contents:[]});
   return append.call(this,content,targetIds);
  };
  Object.defineProperty(TaskResult.prototype,'__diceLogTargets',{value:true});
 }
 const original=writeModule.default;
 writeModule.default=async function(action){
  const content=(action.results||[]).flatMap(r=>(r.mutations||[]).flatMap(toLog));
  const doc=schema.clean({content,creatureId:action.creatureId,tabletopId:action.tabletopId,actionId:action._id});
  schema.validate(doc);
  return original.call(this,action);
 };
 installed.add(Logs);
};
