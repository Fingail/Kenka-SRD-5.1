// Disposable off-map native token: never move a campaign participant.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { DRClient } from './dr-client.mjs';
const db=new DatabaseSync((process.env.OCF_DATA||'/data')+'/encounters.sqlite');
const base=JSON.parse(db.prepare('SELECT config FROM encounters WHERE id=?').get('kanka-2-quest-3536').config);
const client=new DRClient(process.env.DR_URL||'http://dungeon-revealer:3000',process.env.DM_PASSWORD);
const id='movement-check-'+randomUUID();let owned=[];
const map=async()=>(await(await client.http('/api/map/'+base.map.id)).json()).data;
const save=e=>db.prepare('INSERT OR REPLACE INTO encounters VALUES(?,?)').run(id,JSON.stringify(e));
async function move(password,x){return fetch((process.env.DR_URL||'http://dungeon-revealer:3000')+'/api/map/'+base.map.id+'/token/'+owned[0].id,{method:'PATCH',headers:{Authorization:'Bearer '+password,'Content-Type':'application/json'},body:JSON.stringify({x,y:-10000})});}
try{
  await client.connect();const artwork=(await map()).tokens.find(t=>t.tokenImageId)?.tokenImageId;
  await client.gql('mutation($i:MapTokenAddManyInput!){mapTokenAddMany(input:$i)}',{i:{mapId:base.map.id,tokens:[{label:id,x:-10000,y:-10000,radius:1,color:'#123456',tokenImageId:artwork,isVisibleForPlayers:true,isMovableByPlayers:true,isLocked:false}]}});
  owned=(await map()).tokens.filter(t=>t.label===id);assert.equal(owned.length,1);
  const e={id,name:id,status:'ready',revision:1,map:base.map,test_fixture:true,tokens:[{token_id:owned[0].id,name:id,role:'pc',hp_current:10,stats:{hp_max:10}}],initiative:{session_id:randomUUID(),status:'active',current_token_id:'other'}};save(e);
  let response=await move(process.env.PC_PASSWORD,-10001);assert.equal(response.status,403,await response.text());assert.equal((await map()).tokens.find(t=>t.id===owned[0].id).x,-10000);
  e.initiative.current_token_id=owned[0].id;save(e);response=await move(process.env.PC_PASSWORD,-10002);assert.equal(response.ok,true,await response.text());assert.equal((await map()).tokens.find(t=>t.id===owned[0].id).x,-10002);
  e.initiative.status='rolling';save(e);response=await move(process.env.PC_PASSWORD,-10003);assert.equal(response.status,403,await response.text());
  response=await move(process.env.DM_PASSWORD,-10004);assert.equal(response.ok,true,await response.text());assert.equal((await map()).tokens.find(t=>t.id===owned[0].id).x,-10004);
  e.initiative.status='ended';save(e);response=await move(process.env.PC_PASSWORD,-10005);assert.equal(response.ok,true,await response.text());
  console.log('Native movement verified: out of turn and initiative queue blocked; active PC, GM override and post-combat movement allowed.');
}finally{
  db.prepare('DELETE FROM encounters WHERE id=?').run(id);
  try{const tokenIds=(await map()).tokens.filter(t=>t.label===id).map(t=>t.id);if(tokenIds.length)await client.gql('mutation($i:MapTokenRemoveManyInput!){mapTokenRemoveMany(input:$i)}',{i:{mapId:base.map.id,tokenIds}});}finally{await client.close();db.close();}
}
