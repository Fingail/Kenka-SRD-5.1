// SPDX-License-Identifier: GPL-3.0-only
const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const create=require('./native-vectors.cjs');
test('shared vectors enforce roles, ownership, hidden targets, revisions and independent map scales',async()=>{
 const records=new Map(),maps={a:{id:'map-a',title:'First',grid:{columnWidth:50,columnHeight:50},tokens:[{id:'lux-token',x:0,y:0,radius:25,isVisibleForPlayers:true},{id:'secret-token',x:10,y:0,radius:50,isVisibleForPlayers:false}]},b:{id:'map-b',title:'Second',grid:{columnWidth:50,columnHeight:50},tokens:[]}};let active='a';
 const mapServer=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:{activeMap:maps[active]}}));});await new Promise(r=>mapServer.listen(0,'127.0.0.1',r));
 const states={findOneAsync:async id=>records.has(id)?structuredClone(records.get(id)):undefined,upsertAsync:async(id,u)=>{if(!records.has(id))records.set(id,structuredClone(u.$setOnInsert));},updateAsync:async(id,u)=>{records.set(id,{...records.get(id),...structuredClone(u.$set)});}};
 const room={tabletopId:'table',profiles:[{creatureId:'lux',tokenId:'lux-token',name:'Lux',visible:true},{creatureId:'secret',tokenId:'secret-token',name:'Secret monster',visible:false}]};
 const service=create({cfg:{dcPublic:'http://local',drBase:'http://127.0.0.1:'+mapServer.address().port,drGMPassword:'fixture'},ready:Promise.resolve(room),context:async req=>{const user=req.headers.authorization;if(!['gm','player'].includes(user)){const e=Error('Login required');e.status=401;throw e;}return {userId:user,gm:user==='gm',room};},deps:{db:()=>states,collection:x=>x,Random:{id:()=>Math.random().toString(36).slice(2)},C:{find:()=>({fetchAsync:async()=>[{_id:'lux',owner:'player',writers:[]},{_id:'secret',owner:'gm',writers:[]}]})}}});
 const server=http.createServer((req,res)=>service.handle(req,res,req.url.slice(1)));await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const api=async(role,op,body)=>{const r=await fetch(url+'/'+op,{method:op==='state'?'GET':'POST',headers:{Authorization:role,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json()};};
 try{
  assert.equal((await api('nobody','state')).status,401);let s=(await api('gm','state')).body;assert.equal(s.feetPerSquare,5);
  assert.equal((await api('player','scale',{mapId:s.mapId,revision:s.revision,feetPerSquare:10})).status,403);
  s=(await api('gm','scale',{mapId:s.mapId,revision:s.revision,feetPerSquare:10})).body;assert.equal(s.feetPerSquare,10);
  assert.equal((await api('gm','scale',{mapId:s.mapId,revision:0,feetPerSquare:5})).status,409);
  s=(await api('gm','save',{mapId:s.mapId,revision:s.revision,shape:{type:'circle',name:'Shared test',origin:{x:0,y:0},sizeFeet:15,widthFeet:5,shared:true}})).body;const id=s.shapes[0].id;assert.deepEqual(s.shapes[0].targetIds,['lux','secret']);
  let p=(await api('player','state')).body;assert.equal(p.tokens.length,1);assert.deepEqual(p.shapes[0].targetIds,['lux']);assert.equal(JSON.stringify(p).includes('secret'),false);assert.equal(p.shapes[0].own,false);
  assert.equal((await api('player','remove',{mapId:p.mapId,revision:p.revision,id})).status,403);
  assert.equal((await api('player','targets',{mapId:p.mapId,revision:p.revision,id,includedIds:[],excludedIds:['lux']})).status,403);
  s=(await api('gm','targets',{mapId:s.mapId,revision:s.revision,id,includedIds:[],excludedIds:['lux']})).body;assert.deepEqual(s.shapes[0].targetIds,['secret']);
  assert.equal((await api('gm','targets',{mapId:s.mapId,revision:s.revision,id,includedIds:['unknown'],excludedIds:[]})).status,422);
  assert.equal((await api('gm','save',{mapId:s.mapId,revision:s.revision,shape:{type:'circle',origin:{x:1e20,y:0}}})).status,422);
  s=(await api('gm','save',{mapId:s.mapId,revision:s.revision,shape:{type:'square',origin:{x:0,y:0},sizeFeet:20,shared:false}})).body;assert.equal((await api('player','state')).body.shapes.length,1);
  active='b';await new Promise(r=>setTimeout(r,270));let other=(await api('gm','state')).body;assert.equal(other.feetPerSquare,5);assert.equal(other.shapes.length,0);
  active='a';await new Promise(r=>setTimeout(r,270));s=(await api('gm','state')).body;assert.equal(s.feetPerSquare,10);assert.equal(s.shapes.length,2);
 }finally{await new Promise(r=>server.close(r));await new Promise(r=>mapServer.close(r));}
});
