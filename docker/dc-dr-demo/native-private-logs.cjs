// SPDX-License-Identifier: GPL-3.0-only
// Redirect before insertion: private results never enter public Meteor logs.
const registries=new WeakMap();
module.exports=logs=>{
 if(registries.has(logs))return registries.get(logs);
 const routes=new Map();
 for(const name of ['insert','insertAsync'])if(typeof logs[name]==='function'){
  const original=logs[name];logs[name]=function(doc,...args){const sink=doc.actionId&&routes.get(doc.actionId);return sink?sink(doc):original.call(this,doc,...args);};
 }
 const registry={async run(id,sink,fn){if(routes.has(id))throw Error('Action is already resolving.');routes.set(id,sink);try{return await fn();}finally{routes.delete(id);}}};
 registries.set(logs,registry);return registry;
};
