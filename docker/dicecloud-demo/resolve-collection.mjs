// Anonymous, read-only public collection export. Keep downloaded content private.
import { chromium } from '/work/node_modules/playwright/index.mjs';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const base='/demo-data', collectionId=process.argv[2]||'jp6xTaHDZK4ELYzvN';
const fields=JSON.parse(readFileSync(new URL('./library-fields.json',import.meta.url)));
const path=base+'/collection-staging.json';
const state=existsSync(path)?JSON.parse(readFileSync(path)):{libraries:{},nodes:{},scanned:[]};
const save=()=>writeFileSync(path,JSON.stringify(state),{mode:0o600});
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage();
 await page.goto('https://dicecloud.com/library-collection/'+collectionId,{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>window.Meteor?.status()?.connected,undefined,{timeout:60000});
 async function fetch(kind,id){return page.evaluate(async({kind,id,fields})=>{
  const handles=[];
  const sub=(name,args)=>Promise.race([new Promise((resolve,reject)=>handles.push(Meteor.subscribe(name,...args,{onReady:resolve,onStop:e=>e&&reject(Error(e.reason||e.message))}))),new Promise((_,reject)=>setTimeout(()=>reject(Error('Publication timeout')),90000))]);
  try{const c=Meteor.connection._mongo_livedata_collections;
   if(kind==='collection'){await sub('libraryCollection',[id]);const doc=c.libraryCollections?.findOne(id);if(!doc?.public)throw Error('Collection is not public');return doc;}
   await sub('library',[id]);await sub('libraryNodes',[id,fields]);
   const library=c.libraries.findOne(id);if(!library?.public)throw Error('Library is not public: '+id);
   return {library,nodes:c.libraryNodes.find().fetch().filter(n=>(n.root?.id||n.ancestors?.[0]?.id)===id)};
  }finally{handles.forEach(h=>h.stop());}
 },{kind,id,fields});}
 // A supplied public-component manifest permits evaluating libraries when the
 // hosted collection publication requires login. It is labelled as such.
 state.collection=existsSync(base+'/component-manifest.json')?JSON.parse(readFileSync(base+'/component-manifest.json')):await fetch('collection',collectionId);save();
 console.log(JSON.stringify({collection:state.collection.name,libraries:state.collection.libraries}));
 for(let round=0;round<40;round++){
  const scanned=new Set(state.scanned),needed=new Set(state.collection.libraries);
  for(const n of Object.values(state.nodes))if(n.type==='reference'&&n.ref?.collection==='libraryNodes'&&!state.nodes[n.ref.id]&&n.cache?.library?.id)needed.add(n.cache.library.id);
  const todo=[...needed].filter(id=>!scanned.has(id));if(!todo.length)break;
  for(const id of todo){const result=await fetch('library',id);state.libraries[id]=result.library;for(const n of result.nodes)state.nodes[n._id]=n;state.scanned.push(id);save();console.log(JSON.stringify({library:result.library.name,nodes:result.nodes.length}));if(Object.keys(state.nodes).length>300000)throw Error('Node limit exceeded');await new Promise(r=>setTimeout(r,1000));}
 }
 const missing=Object.values(state.nodes).filter(n=>n.type==='reference'&&n.ref?.collection==='libraryNodes'&&!state.nodes[n.ref.id]);
 writeFileSync(base+'/collection-evaluation.json',JSON.stringify({name:state.collection.name,libraries:Object.values(state.libraries).map(l=>({id:l._id,name:l.name,nodes:Object.values(state.nodes).filter(n=>(n.root?.id||n.ancestors?.[0]?.id)===l._id).length})),nodes:Object.keys(state.nodes).length,missing:missing.map(n=>({id:n._id,ref:n.ref,cache:n.cache}))},null,2),{mode:0o600});
 console.log(JSON.stringify({nodes:Object.keys(state.nodes).length,libraries:Object.keys(state.libraries).length,unresolved:missing.length}));
}finally{await browser.close();}
