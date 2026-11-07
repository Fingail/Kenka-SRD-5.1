// SPDX-License-Identifier: GPL-3.0-only
// Loaded in the pinned Meteor server bundle. Gameplay delegates to DiceCloud's
// native action engine and property persistence; no OpenCharacter runtime.
const sharedCollections=new Map();
module.exports = function (mRequire, globals) {
 const fs=require("fs"),path=process.env.DC_DR_CONFIG;
 if(!path||!fs.existsSync(path))return;
 const primary=JSON.parse(fs.readFileSync(path,"utf8"));
 for(const cfg of [primary,...(primary.additionalConfigs||[]).filter(p=>fs.existsSync(p)).map(p=>JSON.parse(fs.readFileSync(p,"utf8")))])register(mRequire,globals,cfg);
};
function register(mRequire,globals,cfg){
const {Meteor,Package,Mongo,EJSON,Random}=globals;
Meteor.startup(async function () {
 const fs=require('fs');
 const route=cfg.route||'/dc-dr';
 const db=name=>{if(!sharedCollections.has(name))sharedCollections.set(name,new Mongo.Collection(name));return sharedCollections.get(name);};
 const policy=require('/opt/dc-dr-assets/policy.cjs');
 const http=require('http'),crypto=require('crypto');
 const JsonRoutes=Package['simple:json-routes'].JsonRoutes;
 const {Accounts}=Package['accounts-base'];
 let C=mRequire('/imports/api/creature/creatures/Creatures.ts').default;
 let P=mRequire('/imports/api/creature/creatureProperties/CreatureProperties.ts').default;
 let V=mRequire('/imports/api/creature/creatures/CreatureVariables.ts').default;
 let T=mRequire('/imports/api/tabletop/Tabletops.ts').default;
 let Logs=mRequire('/imports/api/creature/log/CreatureLogs.js').default;
 let EA=mRequire('/imports/api/engine/action/EngineActions.ts').default;
 const apply=mRequire('/imports/api/engine/action/functions/applyAction.ts').default;
 const write=mRequire('/imports/api/engine/action/functions/writeActionResults.ts').default;
 const compute=mRequire('/imports/api/engine/computeCreature.ts').default;
 const roller=mRequire('/imports/api/engine/action/functions/userInput/getDeterministicDiceRoller.ts').default;
 const {renewDocIds,rebuildNestedSets}=mRequire('/imports/api/parenting/parentingFunctions.ts');
 const nativeInsert=mRequire('/imports/api/creature/creatureProperties/methods/insertProperty.js').default;
 let R=db('dcDrRooms');
 let Runs=db('dcDrRuns');
 let Events=db('dcDrEvents');
 let Effects=db('dcDrEffects');
 let Requests=db('dcDrRequests');
 const Fiber=require('/opt/dicecloud/programs/server/node_modules/fibers');
 const native=fn=>new Promise((resolve,reject)=>{const run=()=>{try{Promise.resolve(fn()).then(resolve,reject);}catch(e){reject(e);}};if(Fiber.current)run();else Fiber(run).run();});
 const collection=target=>new Proxy(target,{get(object,key){const value=object[key];if(['findOneAsync','insertAsync','updateAsync','removeAsync','upsertAsync'].includes(key))return (...args)=>native(()=>value.apply(object,args));if(key==='find')return (...args)=>{const cursor=value.apply(object,args);return new Proxy(cursor,{get(c,k){if(k==='fetchAsync')return ()=>native(()=>c.fetch());const v=c[k];return typeof v==='function'?v.bind(c):v;}});};return typeof value==='function'?value.bind(object):value;}});
 C=collection(C);P=collection(P);V=collection(V);T=collection(T);Logs=collection(Logs);EA=collection(EA);R=collection(R);Runs=collection(Runs);Events=collection(Events);Effects=collection(Effects);Requests=collection(Requests);
 const Users=collection(Meteor.users);
 const clone=x=>EJSON.clone(x);
 const bad=(message,status=400)=>{const e=new Error(message);e.status=status;throw e;};
 const signed=n=>n>=0?'+'+n:String(n);
 const saveFor=b=>{const tag=(b.tags||[]).find(x=>/^dcdr-save:/.test(x));if(!tag)return null;const fields=tag.split(':');return {ability:fields[1],dc:Number(fields[2]),endsOnSuccess:(b.tags||[]).includes('dcdr-end-on-success'),timing:(b.tags||[]).includes('dcdr-end-turn')?'end of turn':'manual'};};
 const liveBuffs=rows=>{const map=new Map(rows.map(r=>[r._id,r]));return rows.filter(r=>{if(r.type!=='buff'||r.inactive||/^(Introduction to|Assign Stats)/i.test(r.name||''))return false;let parent=map.get(r.parentId),seen=new Set();while(parent&&!seen.has(parent._id)){seen.add(parent._id);if(['action','spell','branch','savingThrow','damage'].includes(parent.type))return false;parent=map.get(parent.parentId);}return true;});};
 const asNumber=x=>typeof x==='number'?x:undefined;
 let busy=false;
 async function serial(fn){if(busy)bad('Another action is resolving; retry shortly.',409);busy=true;try{return await fn();}finally{busy=false;}}
 function dr(path,method='GET',data){return new Promise((resolve,reject)=>{const body=data===undefined?undefined:JSON.stringify(data);const u=new URL(path,cfg.drBase);const r=http.request(u,{method,headers:{Authorization:'Bearer '+cfg.drGMPassword,...(body?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}:{})}},res=>{let b='';res.on('data',x=>b+=x);res.on('end',()=>{if(res.statusCode>=400)return reject(new Error('Map request failed ('+res.statusCode+')'));try{resolve(b?JSON.parse(b):{});}catch{resolve({});}});});r.setTimeout(15000,()=>r.destroy(new Error('Map request timeout')));r.on('error',reject);r.end(body);});}
 async function rawDR(path,body){return new Promise((resolve,reject)=>{const u=new URL(path,cfg.drBase);const r=http.request(u,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+cfg.drGMPassword,...(body===undefined?{}:{'Content-Type':'text/plain;charset=UTF-8'})}},res=>{let text='';res.on('data',x=>text+=x);res.on('end',()=>res.statusCode<400?resolve(text):reject(Error('Map socket failed')));});r.on('error',reject);r.setTimeout(10000,()=>r.destroy(Error('Map socket timeout')));r.end(body);});}
 async function mapMutation(operation,variables){const route='/api/socket.io/?EIO=4&transport=polling';const opening=await rawDR(route);const endpoint=route+'&sid='+encodeURIComponent(JSON.parse(opening.slice(1)).sid);let seq=1;
  async function receive(){const rows=[];for(const part of (await rawDR(endpoint)).split('\x1e'))if(part==='2')await rawDR(endpoint,'3');else if(part.startsWith('42'))rows.push(JSON.parse(part.slice(2)));return rows;}
  try{await rawDR(endpoint,'40');await receive();await rawDR(endpoint,'42'+JSON.stringify(['authenticate',{password:cfg.drGMPassword,desiredRole:'admin'}]));await receive();await rawDR(endpoint,'42'+JSON.stringify(['@graphql/execute',{id:seq,operation,variables}]));for(let i=0;i<5;i++)for(const [name,result]of await receive())if(name==='@graphql/result'&&result.id===seq){if(result.errors)bad('Map operation failed',502);return result.data;}bad('Map operation timed out',502);}finally{await rawDR(endpoint,'41').catch(()=>{});}
 }
 async function props(id){return P.find({'root.id':id,removed:{$ne:true}},{sort:{left:1}}).fetchAsync();}
 const a=(p,key)=>p.find(x=>x.type==='attribute'&&x.variableName===key&&!x.inactive);
 const hp=p=>a(p,'hitPoints');
 async function add(owner,root,property,parent){return native(()=>nativeInsert._execute({userId:owner},{creatureProperty:property,parentRef:{collection:parent?'creatureProperties':'creatures',id:parent||root}}));}
 async function event(room,type,data={}){await Events.insertAsync({roomId:room._id,type,at:new Date(),...data});}
 async function save(room){room.revision++;await R.updateAsync(room._id,{$set:{profiles:room.profiles,combat:room.combat,revision:room.revision,dead:room.dead||{},deaths:room.deaths||{}}});}
 async function defenses(profile,id){const rows=await props(id);for(const [key,value]of [['immunities',0],['resistances',0.5],['vulnerabilities',2]])for(const type of profile.template.damage_traits&&profile.template.damage_traits[key]||[]){const name=type+' '+key;if(!rows.some(p=>p.type==='damageMultiplier'&&p.name===name))await add(cfg.gmUserId,id,{type:'damageMultiplier',name,damageTypes:[type],value});}}
 async function advanced(profile,id){
    const existingNames=new Set((await props(id)).filter(p=>p.type==='action').map(p=>p.name));
    for(const effect of profile.template.advanced_actions||[]){
     if(existingNames.has(effect.name))continue;
     const damage=(effect.rolls||[]).find(r=>r.kind==='damage');
     const ability=effect.save&&({str:'strength',dex:'dexterity',con:'constitution',int:'intelligence',wis:'wisdom',cha:'charisma'})[effect.save.ability];
     const aid=await add(cfg.gmUserId,id,{type:'action',name:effect.name,actionType:effect.category==='legendary'?'free':'action',target:effect.area?'multipleTargets':effect.name==='Multiattack'?'singleTarget':'self',description:{text:(effect.description||'')+(effect.area?' Area: '+effect.area.size_ft+' ft '+effect.area.shape+'. Select all affected targets; geometry is GM-adjudicated.':'')}});
     if(effect.name==='Multiattack'&&/one with its bite and two with its claws/i.test(effect.description||'')){
      for(const name of ['Bite','Claw','Claw']){const attack=(profile.template.attacks||[]).find(a=>a.name.toLowerCase()===name.toLowerCase());if(attack){const attackId=await add(cfg.gmUserId,id,{type:'action',name:attack.name,actionType:'attack',target:'singleTarget',attackRoll:{calculation:String(attack.attack_bonus)}},aid);await add(cfg.gmUserId,id,{type:'damage',name:attack.name+' damage',damageType:attack.damage_type,amount:{calculation:attack.damage},target:'target'},attackId);}}
     }
     if(damage){const d={type:'damage',name:effect.name+' damage',damageType:damage.damage_type||'fire',amount:{calculation:damage.formula},target:'target'};if(effect.save)d.save={stat:ability+'Save',dc:{calculation:String(effect.save.dc)},...(!effect.save.half_on_success?{damageFunction:{calculation:'0'}}:{})};await add(cfg.gmUserId,id,d,aid);}
     else if(effect.save){const saveId=await add(cfg.gmUserId,id,{type:'savingThrow',name:effect.name+' save',stat:ability+'Save',dc:{calculation:String(effect.save.dc)},target:'target'},aid);const branch=await add(cfg.gmUserId,id,{type:'branch',branchType:'failedSave'},saveId);const buff=await add(cfg.gmUserId,id,{type:'buff',name:effect.name,target:'target',tags:['dcdr-save:'+ability+':'+effect.save.dc,'dcdr-end-turn','dcdr-end-on-success','dcdr-origin:'+id],description:{text:effect.description||''}},branch);if(/Weakening Breath/i.test(effect.name))await add(cfg.gmUserId,id,{type:'effect',name:'Weakening: Strength disadvantage',operation:'disadvantage',stats:['strength','strengthSave','athletics']},buff);}
     for(const roll of effect.rolls||[])if(roll.kind==='recharge')await add(cfg.gmUserId,id,{type:'roll',name:roll.label,variableName:'recharge'+effect.id.replace(/[^A-Za-z0-9]/g,''),roll:{calculation:roll.formula}},aid);
    }

 }
 async function seed(){
  let room=await R.findOneAsync(cfg.instance);if(room){if(!room.schemaVersion||room.schemaVersion<2){for(const p of room.profiles.filter(x=>x.kind!=='pc')){const source=cfg.profiles.find(x=>x.tokenId===p.tokenId);await advanced(source,p.creatureId);await native(()=>compute(p.creatureId));}room.schemaVersion=2;room.revision++;await R.updateAsync(room._id,{$set:{schemaVersion:2,revision:room.revision}});}if(room.schemaVersion<3){for(const p of room.profiles.filter(p=>p.kind==='npc')){for(const buff of (await props(p.creatureId)).filter(x=>x.type==='buff'&&(x.tags||[]).some(t=>t.startsWith('dcdr-save:'))))await P.updateAsync(buff._id,{$addToSet:{tags:'dcdr-origin:'+p.creatureId},$set:{dirty:true}});await native(()=>compute(p.creatureId));}room.schemaVersion=3;room.revision++;await R.updateAsync(room._id,{$set:{schemaVersion:3,revision:room.revision}});}if(room.schemaVersion<4){for(const p of room.profiles.filter(x=>x.kind==='npc')){await defenses(cfg.profiles.find(x=>x.tokenId===p.tokenId),p.creatureId);await native(()=>compute(p.creatureId));}room.schemaVersion=4;room.revision++;await R.updateAsync(room._id,{$set:{schemaVersion:4,revision:room.revision}});}return room;}
  let player=await Users.findOneAsync({username:cfg.player.username});
  if(!player){const id=await native(()=>Accounts.createUser(cfg.player));player=await Users.findOneAsync(id);}
  const tid=await T.insertAsync({name:cfg.name||'DiceCloud × Dungeon Revealer — Renovar demo',owner:cfg.gmUserId,gameMasters:[cfg.gmUserId],players:[player._id],spectators:[],initiative:{active:false,roundNumber:0}});
  room={_id:cfg.instance,tabletopId:tid,playerId:player._id,revision:1,combat:{active:false,phase:'idle',turn:0,round:0,current:null,rolls:[],order:[]},profiles:[],deaths:{},dead:{}};
  for(const profile of cfg.profiles){
   let id;
   if(profile.kind==='pc'){
    const original=await C.findOneAsync(cfg.sourceLuxId);if(!original)bad('Source character missing');
    const doc=clone(original);delete doc._id;delete doc.computeVersion;doc.name=profile.name+(cfg.characterSuffix||' — DC/DR demo');doc.owner=player._id;doc.writers=[cfg.gmUserId];doc.readers=[];doc.public=false;doc.tabletopId=tid;doc.dirty=true;
    id=await C.insertAsync(doc);
    const nodes=clone(await props(original._id));
    await native(()=>renewDocIds({docArray:nodes}));
    for(const node of nodes){node.root={collection:'creatures',id};node.dirty=true;await P.insertAsync(node);}
   }else{
    id=await C.insertAsync({name:profile.name,type:'npc',owner:cfg.gmUserId,writers:[],readers:cfg.mode==='native'?[player._id]:[],public:false,tabletopId:tid,settings:{},dirty:true,allowedLibraries:[],allowedLibraryCollections:[]});
    const s=profile.template.stats;
    for(const [key,name]of Object.entries({str:'strength',dex:'dexterity',con:'constitution',int:'intelligence',wis:'wisdom',cha:'charisma'}))await add(cfg.gmUserId,id,{type:'attribute',name:name[0].toUpperCase()+name.slice(1),variableName:name,attributeType:'ability',baseValue:{calculation:String(s.abilities[key])}});
    for(const [key,name,type,value]of [['hitPoints','Hit points','healthBar',s.hp_max],['armor','Armor class','stat',s.ac],['speed','Speed','stat',s.speed_ft],['proficiencyBonus','Proficiency bonus','modifier',s.proficiency_bonus||2]])await add(cfg.gmUserId,id,{type:'attribute',name,variableName:key,attributeType:type,baseValue:{calculation:String(value)}});
    await add(cfg.gmUserId,id,{type:'skill',name:'Initiative',variableName:'initiative',skillType:'skill',ability:'dexterity'});
    for(const [key,name]of Object.entries({str:'strength',dex:'dexterity',con:'constitution',int:'intelligence',wis:'wisdom',cha:'charisma'})){
     const bonus=profile.template.saving_throws&&profile.template.saving_throws[key];
     const base=Math.floor((s.abilities[key]-10)/2);
     const sk=await add(cfg.gmUserId,id,{type:'skill',name:name+' save',variableName:name+'Save',skillType:'save',ability:name});
     if(bonus!==undefined&&bonus!==base)await add(cfg.gmUserId,id,{type:'effect',name:'Recorded save bonus',stats:[name+'Save'],operation:'add',amount:{calculation:String(bonus-base)}},sk);
    }
    for(const attack of profile.template.attacks||[]){const aid=await add(cfg.gmUserId,id,{type:'action',name:attack.name,actionType:'attack',target:'singleTarget',attackRoll:{calculation:String(attack.attack_bonus)}});await add(cfg.gmUserId,id,{type:'damage',name:attack.name+' damage',damageType:attack.damage_type,amount:{calculation:attack.damage},target:'target'},aid);}
    await defenses(profile,id);await advanced(profile,id);
   }
   await native(()=>rebuildNestedSets(P,id));await native(()=>compute(id));
   room.profiles.push({...profile,template:undefined,creatureId:id,ownerId:profile.kind==='pc'?player._id:cfg.gmUserId});
  }
  const pc=room.profiles.find(p=>p.kind==='pc');
  if(cfg.mode!=='native'){
  const potion=await add(player._id,pc.creatureId,{type:'action',name:'Potion of Healing (demo ∞)',actionType:'action',target:'singleTarget',summary:{text:'Demo supply. Heal any selected creature, including one at zero HP.'}});
  await add(player._id,pc.creatureId,{type:'damage',name:'Potion healing',damageType:'healing',amount:{calculation:'2d4+2'},target:'target'},potion);
  await native(()=>compute(pc.creatureId));
  }
  room.schemaVersion=4;await R.insertAsync(room);await event(room,'notice',{text:'Separate demo created. DiceCloud owns combat; the copied DR scene owns map state.'});return room;
 }
 if(cfg.mode==='native'){
  const ready=seed().then(async room=>{
   // Imported flat attacks need DiceCloud's native On Hit branch. Preserve
   // existing library branches; this is a one-time property-graph conversion.
   for(const p of room.profiles){const rows=await props(p.creatureId);for(const attack of rows.filter(x=>x.type==='action'&&x.attackRoll&&x.attackRoll.calculation)){
    const children=rows.filter(x=>x.parentId===attack._id&&x.type==='damage');if(!children.length)continue;
    const branch=await add(p.ownerId,p.creatureId,{type:'branch',name:'On hit',branchType:'hit'},attack._id);
    await P.updateAsync({_id:{$in:children.map(x=>x._id)}},{$set:{parentId:branch,dirty:true}},{multi:true});
   }await native(()=>rebuildNestedSets(P,p.creatureId));await native(()=>compute(p.creatureId));}
   return room;
  });require('/opt/dc-dr-assets/native-tabletop.cjs')({Meteor,Package,cfg,ready,context,combatDeps:{C,P,T,EA,Logs,props,native,apply,write,roller,Random,collection,db,liveBuffs}});return;
 }
 for(const method of ['actions.insertAction','actions.runAction']){
  const original=Meteor.server.method_handlers[method];
  if(original)Meteor.server.method_handlers[method]=async function(args){
   const actor=method==='actions.insertAction'?args.action&&args.action.creatureId:(await EA.findOneAsync(args.actionId)||{}).creatureId;
   const room=await R.findOneAsync(cfg.instance);
   if(room&&room.profiles.some(p=>p.creatureId===actor))throw new Meteor.Error('dc-dr-action-required','Use the integrated encounter controls for these demo creatures.');
   return original.call(this,args);
  };
 }
 // The integrated view uses its filtered HTTP projection. Do not expose native
 // tabletop logs/properties to its players through an alternate DDP subscription.
 const tabletopPublication=Meteor.server.publish_handlers.tabletop;
 if(tabletopPublication)Meteor.server.publish_handlers.tabletop=function(id){const room=R.findOne(cfg.instance);if(room&&id===room.tabletopId){const table=T.findOne(id);if(!table||!(table.owner===this.userId||table.gameMasters.includes(this.userId))){this.ready();return;}}return tabletopPublication.call(this,id);};
 const ready=seed().then(room=>{console.log('DC/DR native bridge ready.');return room;}).catch(e=>{console.error('DC/DR setup failed:',e.stack||e.message);return null;});
 async function context(req){
  const token=(req.headers.authorization||'').replace(/^Bearer /,'');if(!token)bad('Sign in to DiceCloud.',401);
  const hash=Accounts._hashLoginToken(token);const user=await Users.findOneAsync({'services.resume.loginTokens.hashedToken':hash});if(!user)bad('DiceCloud session expired.',401);
  const entry=(user.services.resume.loginTokens||[]).find(x=>x.hashedToken===hash);if(!entry||new Date(entry.when).getTime()+90*86400000<Date.now())bad('DiceCloud session expired.',401);
  const room=await R.findOneAsync(cfg.instance);if(!room)bad('Demo is preparing.',503);
  const table=await T.findOneAsync(room.tabletopId);const gm=table.gameMasters.includes(user._id)||table.owner===user._id;
  if(!gm&&!table.players.includes(user._id))bad('This account is not a demo participant.',403);
  return {userId:user._id,gm,room,table};
 }
 function profile(ctx,id){const p=ctx.room.profiles.find(x=>x.creatureId===id);if(!p||(!ctx.gm&&!p.visible))bad('Combatant not available.',404);return p;}
 function control(ctx,p){if(!policy.controls(ctx.userId,p,ctx.gm))bad('You do not control this creature.',403);}
 async function summary(ctx,p){
  const ps=await props(p.creatureId),h=hp(ps);if(!h)bad('Missing native hit points.',500);
  const own=policy.controls(ctx.userId,p,ctx.gm),health=policy.health(h.value,h.total);
  const effects=await Effects.find({roomId:ctx.room._id,creatureId:p.creatureId}).fetchAsync();
  const buffs=liveBuffs(ps).map(x=>({id:x._id,name:x.name,save:(effects.find(e=>e.buffId===x._id)||{}).save||saveFor(x),description:own?(x.description&&x.description.text||''):undefined}));
  const saved=ctx.room.deaths[p.creatureId]||{};
  const result={id:p.creatureId,tokenId:p.tokenId,name:p.name,kind:p.kind,sourceUrl:p.sourceUrl,own,health,effects:buffs,down:h.value<=0,dead:!!ctx.room.dead[p.creatureId]||!!saved.dead||(p.kind==='object'&&h.value<=0),canMove:policy.canMove(ctx.userId,p,ctx.room,ctx.gm)&&(ctx.gm||h.value>0),death:own?saved:undefined};
  if(own){result.hp=h.value;result.hpMax=h.total;result.ac=a(ps,'armor')&&a(ps,'armor').value;result.speed=a(ps,'speed')&&a(ps,'speed').value;
   result.abilities=ps.filter(x=>x.type==='attribute'&&x.attributeType==='ability'&&!x.inactive).map(x=>({variable:x.variableName,name:x.name,value:x.value,modifier:x.modifier}));
   result.skills=ps.filter(x=>x.type==='skill'&&!x.inactive).map(x=>({variable:x.variableName,name:x.name,value:x.value,ability:x.ability,type:x.skillType}));
   result.actions=ps.filter(x=>['action','spell','roll'].includes(x.type)&&!x.inactive&&x.actionType!=='event').map(x=>({id:x._id,name:x.name,type:x.type,target:x.target,actionType:x.actionType,bonus:x.attackRoll&&x.attackRoll.value,summary:x.summary&&(x.summary.value||x.summary.text),description:x.description&&(x.description.value||x.description.text),parentId:x.parentId}));
   result.inventory=ps.filter(x=>x.type==='item'&&!x.inactive).map(x=>({id:x._id,name:x.name,quantity:x.quantity,equipped:x.equipped,description:x.description&&x.description.text}));
   result.features=ps.filter(x=>['feature','note'].includes(x.type)&&!x.inactive).map(x=>({id:x._id,name:x.name,description:x.description&&x.description.text}));
  }
  return result;
 }
 function publicEvent(e,ctx){if(e.privateGM&&!ctx.gm)return null;if(e.type==='native')return {...e,entries:(e.entries||[]).filter(x=>!(/Health bar|Hit points.*set|set from/i.test((x.name||'')+' '+(x.value||'')))&&(ctx.gm||!/Error/i.test(x.name||''))),health:(e.health||[]).map(h=>ctx.gm||ctx.room.profiles.find(p=>p.creatureId===h.id&&p.ownerId===ctx.userId)?h:{id:h.id,name:h.name,color:h.color,label:h.label})};return e;}
 async function state(ctx){const list=[];for(const p of ctx.room.profiles)if(ctx.gm||p.visible)list.push(await summary(ctx,p));const logs=await Events.find({roomId:ctx.room._id},{sort:{at:-1},limit:100}).fetchAsync();const requests=await Requests.find({roomId:ctx.room._id,status:'pending',...(ctx.gm?{}:{userId:ctx.userId})}).fetchAsync();return {revision:ctx.room.revision,tabletopId:ctx.room.tabletopId,role:ctx.gm?'gm':'player',userId:ctx.userId,combat:ctx.room.combat,creatures:list,events:logs.reverse().map(e=>publicEvent(e,ctx)).filter(Boolean),pendingActions:(await Runs.find({roomId:ctx.room._id,userId:ctx.userId,status:'input'}).fetchAsync()).map(r=>({id:r._id,prompt:r.prompt,input:r.input})),requests:requests.map(x=>({id:x._id,actorId:x.input.actorId,kind:x.input.kind,propertyId:x.input.propertyId,status:x.status})),dr:{origin:cfg.drPublic,url:cfg.drPublic+(ctx.gm?'/dm':''),password:ctx.gm?cfg.drGMPassword:cfg.drPlayerPassword,mapId:cfg.mapId},name:cfg.name||'DiceCloud × DR',kanka:cfg.kanka,mode:cfg.mode||'demo',warnings:['Map distance/line of sight and unsupported feature mechanics remain GM-adjudicated.']};}
 function validateTargets(ctx,targets){if(!Array.isArray(targets)||targets.length>40||targets.some(x=>typeof x!=='string'))bad('Invalid targets');targets.forEach(id=>profile(ctx,id));return [...new Set(targets)];}
 const logsOf=action=>[].concat(...(action.results||[]).map(r=>[].concat(...(r.mutations||[]).map(m=>(m.contents||[]).map(c=>({...c,targetIds:m.targetIds}))))));
 const rollDetails=action=>{const entries=logsOf(action);const value=entries.map(x=>x.value||'').find(x=>/1d20/.test(x)&&/\*\*(-?\d+)\*\*/.test(x))||'';const m=/\*\*(-?\d+)\*\*/.exec(value);const dice=/1d20\s*\[([^\]]+)\]/.exec(value);const natural=dice&&dice[1].replace(/~~[^~]+~~/g,'').match(/\d+/);return {total:m?Number(m[1]):undefined,natural:natural?Number(natural[0]):undefined};};
 async function sourceHash(actor,targets){const ids=[...new Set([actor,...targets])].sort(),data=[];for(const id of ids)data.push([id,await props(id)]);return crypto.createHash('sha256').update(EJSON.stringify(data)).digest('hex');}
 async function nativeAction(ctx,input,options={}){
  const p=profile(ctx,input.actorId);control(ctx,p);
  const targets=validateTargets(ctx,input.targetIds||[]);let task;
  const ps=await props(p.creatureId);
  if(!ctx.gm&&hp(ps).value<=0&&!['death_save','effect_save'].includes(input.kind))bad('This PC is at zero HP. Use death saves or have another creature heal them.');
  if(['check','initiative','death_save','effect_save'].includes(input.kind)){
   let skill=input.kind==='initiative'?'initiative':input.kind==='death_save'?'deathSave':input.skill;
   let ability=input.ability,dc=null;
   if(input.kind==='effect_save'){const buff=ps.find(x=>x._id===input.effectId);const effect=await Effects.findOneAsync({buffId:input.effectId,creatureId:p.creatureId});const save=effect&&effect.save||buff&&saveFor(buff);if(!save)bad('This effect has no save.');if(!ctx.gm&&!options.approved&&ctx.room.combat.active&&save.timing!=='manual'&&save.lastTurn===(ctx.room.combat.session||'manual')+':'+(ctx.room.combat.turn||0))bad('This effect save was already rolled this turn.',409);skill=save.ability+'Save';ability=save.ability;dc=save.dc;}
   if(skill&&!ps.some(x=>x.type==='skill'&&x.variableName===skill))bad('Unknown skill.');
   if(!ability&&skill){const prop=ps.find(x=>x.variableName===skill);ability=prop&&prop.ability;}
   if(ability&&!ps.some(x=>x.type==='attribute'&&x.variableName===ability&&x.attributeType==='ability'))bad('Unknown ability.');
   task={subtaskFn:'check',targetIds:[p.creatureId],advantage:(ps.find(x=>x.variableName===skill)||{}).advantage||(ps.find(x=>x.variableName===ability)||{}).advantage||0,skillVariableName:skill,abilityVariableName:ability,dc};
  }else if(input.kind==='hp'){
   if(!ctx.gm)bad('Only GM can adjust HP.',403);const h=hp(ps);if(!Number.isInteger(input.hp)||input.hp<0||input.hp>h.total)bad('HP out of range');task={subtaskFn:'damageProp',targetIds:[p.creatureId],params:{title:'GM HP adjustment',operation:'set',value:input.hp,targetProp:h}};
  }else{
   const prop=ps.find(x=>x._id===input.propertyId&&['action','spell','roll'].includes(x.type)&&!x.inactive);if(!prop)bad('Unknown active DiceCloud action.');
   const healing=ps.some(x=>x.type==='damage'&&x.damageType==='healing'&&x.left>prop.left&&x.right<prop.right);if(healing)for(const target of targets){const candidate=profile(ctx,target);if(candidate.kind==='object')bad('Objects cannot drink a healing potion.');if(candidate.kind==='pc'&&(ctx.room.deaths[target]||{}).dead)bad('A dead PC needs resurrection or a GM correction.');}
   if(prop.target!=='self'&&prop.type!=='roll'&&!targets.length)bad('Select a target.');
   if(prop.target==='singleTarget'&&targets.length>1)bad('Choose one target.');
   task={prop:clone(prop),targetIds:targets};
  }
  const id=Random.id();const action={_id:id,creatureId:p.creatureId,tabletopId:ctx.room.tabletopId,task,results:[],taskCount:0};
  await EA.insertAsync(action);
  const run={_id:input.requestId,roomId:ctx.room._id,userId:ctx.userId,input:clone(input),actionId:id,revision:ctx.room.revision,status:'running',decisions:[],sourceHash:await sourceHash(p.creatureId,targets),createdAt:new Date()};await Runs.insertAsync(run);
  return continueAction(ctx,run);
 }
 async function continueAction(ctx,run){
  if(run.status==='done')return run.result;
  if(run.userId!==ctx.userId&&!ctx.gm)bad('Not your action',403);
  if(run.sourceHash&&run.sourceHash!==await sourceHash(run.input.actorId,run.input.targetIds||[]))bad('Native character data changed; start a new action.',409);
  if(run.revision!==ctx.room.revision)bad('The encounter changed while choosing options. Start a new action.',409);
  const original=await EA.findOneAsync(run.actionId);if(!original)bad('Action no longer pending',409);
  const action=clone(original);let index=0;const droll=roller(action._id);const choices=run.decisions||[];
  function ask(kind,details){if(index<choices.length){const choice=choices[index++];return choice;}throw {dcPrompt:true,kind,details};}
  const acting=await props(run.input.actorId);const weakened=liveBuffs(acting).some(x=>/Weakening Breath/i.test(x.name||''));const sourceProp=acting.find(x=>x._id===run.input.propertyId);const strengthAttack=sourceProp&&sourceProp.attackRoll&&(/strength/.test(sourceProp.attackRoll.calculation||'')||/^(Ram|Handaxe)( |$)/i.test(sourceProp.name||''));
  const provider={targetIds:async()=>run.input.targetIds||[],rollDice:droll,advantage:async suggested=>{if(weakened&&strengthAttack)suggested=suggested===1?0:-1;const requested=Number(run.input.mode||0);return requested&&suggested&&requested!==suggested?0:requested||suggested||0;},check:async suggestion=>({...suggestion,advantage:Number(run.input.mode||0)&&suggestion.advantage&&Number(run.input.mode)!==suggestion.advantage?0:Number(run.input.mode||0)||suggestion.advantage||0}),choose:async(options,quantity)=>{const selected=ask('choose',{options:options.map(o=>({id:o._id,name:o.name||o._id})),quantity});if(!Array.isArray(selected)||selected.some(x=>!options.some(o=>o._id===x)))bad('Invalid choice');return selected;}};
  try{await native(()=>apply(action,provider,{simulate:true}));}
  catch(e){if(e.dcPrompt){await Runs.updateAsync(run._id,{$set:{status:'input',prompt:e}});return {status:'input',id:run._id,prompt:e};}await EA.removeAsync(run.actionId);await Runs.updateAsync(run._id,{$set:{status:'failed',error:String(e.message||e)}});throw e;}
  const errors=logsOf(action).filter(x=>x.name==='Error');if(errors.length){await EA.removeAsync(run.actionId);bad('Native DiceCloud action needs review: '+errors.map(x=>x.value).join('; '),422);}
  const before={};for(const p of ctx.room.profiles){const h=hp(await props(p.creatureId));before[p.creatureId]=h.value;}
  // Apply exactly the simulated native mutation graph; dice and checks were evaluated by DiceCloud.
  await native(()=>write(action));
  for(const result of action.results)for(const mutation of result.mutations||[])for(const buff of mutation.inserts||[]){if(buff.type!=='buff')continue;const origin=(buff.tags||[]).find(t=>t.startsWith('dcdr-origin:'));if(!origin)continue;const rows=await props(buff.root.id);for(const old of rows.filter(x=>x.type==='buff'&&x._id!==buff._id&&x.name===buff.name&&(x.tags||[]).includes(origin)))await removeEffect(buff.root.id,old._id);}

  const health=[];for(const p of ctx.room.profiles){await native(()=>compute(p.creatureId));const h=hp(await props(p.creatureId));if(h.value!==before[p.creatureId]||(run.input.kind==='action'&&(run.input.targetIds||[]).includes(p.creatureId))){const b=policy.health(h.value,h.total);health.push({id:p.creatureId,name:p.name,hp:h.value,max:h.total,...b});if(h.value>0){delete ctx.room.dead[p.creatureId];delete ctx.room.deaths[p.creatureId];}else if(before[p.creatureId]>0){ctx.room.deaths[p.creatureId]=p.kind==='pc'?{successes:0,failures:0,stable:false,dead:false}:{};}}}
  const contents=logsOf(action);for(const p of ctx.room.profiles.filter(p=>p.kind==='pc'&&before[p.creatureId]<=0)){const damaged=contents.some(c=>(c.targetIds||[]).includes(p.creatureId)&&c.name==='Damage');if(damaged){const d=ctx.room.deaths[p.creatureId]||{successes:0,failures:0};d.failures=Math.min(3,(d.failures||0)+(contents.some(c=>/Critical Hit/.test(c.name||''))?2:1));d.stable=false;d.dead=d.failures>=3;ctx.room.deaths[p.creatureId]=d;}}
  const detail=rollDetails(action);
  if(run.input.kind==='initiative'){
   if(!ctx.room.combat.active||ctx.room.combat.phase!=='rolling')bad('Initiative is no longer open.',409);
   const pp=await props(run.input.actorId);ctx.room.combat.rolls=ctx.room.combat.rolls.filter(x=>x.creatureId!==run.input.actorId);ctx.room.combat.rolls.push({creatureId:run.input.actorId,total:detail.total,dex:a(pp,'dexterity').value});
  }
  if(run.input.kind==='death_save'){
   const p=profile(ctx,run.input.actorId);if(p.kind!=='pc'||before[p.creatureId]>0)bad('Death saves require a PC at zero HP.');
   const ds=policy.deathRoll(ctx.room.deaths[p.creatureId],detail.natural,detail.total);ds.lastTurn=(ctx.room.combat.session||'manual')+':'+(ctx.room.combat.turn||0);ctx.room.deaths[p.creatureId]=ds;
   if(ds.revive){const h=hp(await props(p.creatureId));await P.updateAsync(h._id,{$set:{damage:h.total-1,value:1,dirty:true}});await native(()=>compute(p.creatureId));health.push({id:p.creatureId,name:p.name,hp:1,max:h.total,...policy.health(1,h.total)});}
  }
  if(run.input.kind==='effect_save'){
   const buff=(await props(run.input.actorId)).find(x=>x._id===run.input.effectId);const effect=await Effects.findOneAsync({buffId:run.input.effectId,creatureId:run.input.actorId});const save=effect&&effect.save||buff&&saveFor(buff);if(save&&detail.total>=save.dc&&save.endsOnSuccess){await removeEffect(run.input.actorId,run.input.effectId);}else if(save){await Effects.upsertAsync({buffId:run.input.effectId},{$set:{roomId:ctx.room._id,creatureId:run.input.actorId,buffId:run.input.effectId,save:{...save,lastTurn:(ctx.room.combat.session||'manual')+':'+(ctx.room.combat.turn||0)}}});}
  }
  await event(ctx.room,'native',{actorId:run.input.actorId,actorName:profile(ctx,run.input.actorId).name,entries:logsOf(action),health,requestId:run._id});
  await save(ctx.room);const result={status:'done',id:run._id,roll:detail,health};await Runs.updateAsync(run._id,{$set:{status:'done',result}});await synchronize(ctx.room);return result;
 }
 async function removeEffect(id,effectId){const rows=await props(id);if(!rows.some(x=>x._id===effectId))bad('Effect not found');const ids=new Set([effectId]);let prior=-1;while(prior!==ids.size){prior=ids.size;for(const row of rows)if(ids.has(row.parentId))ids.add(row._id);}await P.updateAsync({_id:{$in:[...ids]},'root.id':id},{$set:{removed:true,dirty:true}},{multi:true});await Effects.removeAsync({buffId:effectId});await native(()=>compute(id));}

 async function synchronize(room){for(const p of room.profiles){const h=hp(await props(p.creatureId));try{await dr('/api/map/'+cfg.mapId+'/token/'+p.tokenId,'PATCH',{rotation:h.value<=0?90:0});}catch(e){console.error('DC/DR map status pending:',e.message);}}}
 async function dispatch(ctx,op,input){
  if(op==='state')return state(ctx);if(op==='location')return {tabletopId:ctx.room.tabletopId,url:cfg.dcPublic+route+'/'};
  if(op==='move'){const p=ctx.room.profiles.find(x=>x.tokenId===input.tokenId);if(!p||input.mapId!==cfg.mapId||!policy.canMove(ctx.userId,p,ctx.room,ctx.gm)||(!ctx.gm&&hp(await props(p.creatureId)).value<=0))bad('Movement is limited to your active PC turn.',403);return {allowed:true};}
  if(op==='action'){
   if(typeof input.requestId!=='string'||!/^[a-f0-9-]{36}$/.test(input.requestId))bad('An operation UUID is required.');
   const prior=await Runs.findOneAsync(input.requestId);if(prior){if(prior.roomId!==ctx.room._id)bad('Action not found',404);if(prior.userId!==ctx.userId||JSON.stringify(prior.input)!==JSON.stringify(input))bad('Request ID reused with different input',409);return prior.status==='done'?prior.result:prior.status==='input'?{status:'input',id:prior._id,prompt:prior.prompt}:bad('Action already in progress',409);}
   const existing=await Requests.findOneAsync(input.requestId);if(existing&&existing.roomId!==ctx.room._id)bad('Request not found',404);if(existing)return {status:existing.status,id:existing._id};
   const p=profile(ctx,input.actorId);control(ctx,p);
   if(input.kind==='initiative'&&(!ctx.room.combat.active||ctx.room.combat.phase!=='rolling'))bad('Start combat before rolling initiative.',409);
   if(input.kind==='death_save'&&!ctx.gm&&ctx.room.combat.active&&(ctx.room.deaths[p.creatureId]||{}).lastTurn===(ctx.room.combat.session||'manual')+':'+(ctx.room.combat.turn||0))bad('Death save already rolled this turn.',409);
   if(input.kind==='death_save'&&(ctx.room.deaths[p.creatureId]||{}).stable)bad('This PC is stable; no death save is needed.');
   if(input.kind==='death_save'&&(ctx.room.deaths[p.creatureId]||{}).dead)bad('This PC is dead.');
   if(input.kind==='initiative'&&ctx.room.combat.rolls.some(x=>x.creatureId===input.actorId))bad('Initiative already rolled.',409);
   if(input.kind==='death_save'&&(p.kind!=='pc'||hp(await props(p.creatureId)).value>0))bad('PC must be at zero HP.');
   if(policy.needsApproval(ctx.userId,p,ctx.room,ctx.gm,input.kind)){await Requests.insertAsync({_id:input.requestId,roomId:ctx.room._id,userId:ctx.userId,input,status:'pending'});return {status:'pending',id:input.requestId};}
   return nativeAction(ctx,input);
  }
  if(op==='continue'){if(typeof input.id!=='string'||!/^[a-f0-9-]{36}$/.test(input.id))bad('Invalid action ID');const run=await Runs.findOneAsync(input.id);if(!run||run.roomId!==ctx.room._id||run.userId!==ctx.userId)bad('Action not found',404);if(run.status==='done')return run.result;run.decisions.push(input.choice);await Runs.updateAsync(run._id,{$set:{decisions:run.decisions}});return continueAction(ctx,run);}
  if(op==='approval'){
   if(!ctx.gm)bad('GM only',403);if(typeof input.id!=='string'||!/^[a-f0-9-]{36}$/.test(input.id))bad('Invalid request ID');const request=await Requests.findOneAsync(input.id);if(!request||request.roomId!==ctx.room._id||request.status!=='pending')bad('Request is no longer pending',409);
   if(input.approve){const actorCtx={...ctx,userId:request.userId,gm:false};const result=await nativeAction(actorCtx,request.input,{approved:true});await Requests.updateAsync(request._id,{$set:{status:'approved',result}});return result;}await Requests.updateAsync(request._id,{$set:{status:'rejected'}});return {status:'rejected'};
  }
  if(op==='object'){
   if(!ctx.gm)bad('GM only',403);if(typeof input.name!=='string'||!input.name.trim()||input.name.length>80||!Number.isInteger(input.hp)||input.hp<1||input.hp>10000||!Number.isInteger(input.ac)||input.ac<0||input.ac>40)bad('Object needs a name, HP and AC.');
   const before=await dr('/api/map/'+cfg.mapId),known=new Set(before.data.tokens.map(t=>t.id));
   await mapMutation('mutation($i:MapTokenAddManyInput!){mapTokenAddMany(input:$i)}',{i:{mapId:cfg.mapId,tokens:[{x:500,y:500,color:'#a16207',label:input.name,radius:35,isVisibleForPlayers:true,isMovableByPlayers:false,isLocked:false}]}});
   const after=await dr('/api/map/'+cfg.mapId);const added=after.data.tokens.filter(t=>!known.has(t.id));if(added.length!==1)bad('Concurrent map change; review newly created object.',409);
   const id=await C.insertAsync({name:input.name,type:'npc',owner:ctx.userId,writers:[],readers:[],public:false,tabletopId:ctx.room.tabletopId,settings:{},allowedLibraries:[],allowedLibraryCollections:[],dirty:true});
   for(const [key,name,type,value]of [['hitPoints','Hit points','healthBar',input.hp],['armor','Armor class','stat',input.ac]])await add(ctx.userId,id,{type:'attribute',name,variableName:key,attributeType:type,baseValue:{calculation:String(value)}});
   await native(()=>compute(id));ctx.room.profiles.push({name:input.name,creatureId:id,tokenId:added[0].id,kind:'object',ownerId:ctx.userId,visible:true});await save(ctx.room);await event(ctx.room,'notice',{text:input.name+' added as an attackable object.'});return {status:'done',id};
  }
  if(op==='combat'){
   if(input.command==='start'){if(!ctx.gm)bad('GM only',403);if(ctx.room.combat.active)bad('End the current combat before starting a fresh initiative.',409);ctx.room.combat={active:true,phase:'rolling',session:Random.id(),turn:0,round:1,current:null,rolls:[],order:[]};}
   else if(input.command==='npc_rolls'){if(!ctx.gm)bad('GM only',403);for(const p of ctx.room.profiles.filter(x=>x.kind==='npc'&&!ctx.room.combat.rolls.some(r=>r.creatureId===x.creatureId))){if(hp(await props(p.creatureId)).value<=0)continue;await nativeAction(ctx,{kind:'initiative',actorId:p.creatureId,targetIds:[],requestId:crypto.randomUUID()});}return {status:'done'};}
   else if(input.command==='begin'){if(!ctx.gm)bad('GM only',403);if(!ctx.room.combat.rolls.length)bad('Roll initiative first.');for(const p of ctx.room.profiles){if(p.kind==='object')continue;if(p.kind!=='pc'&&hp(await props(p.creatureId)).value<=0)continue;if(!ctx.room.combat.rolls.some(r=>r.creatureId===p.creatureId))bad(p.name+' still needs initiative.');}ctx.room.combat.order=policy.sortOrder(ctx.room.combat.rolls).map(x=>x.creatureId);ctx.room.combat.phase='playing';ctx.room.combat.current=ctx.room.combat.order[0];}
   else if(input.command==='end'){if(!ctx.gm)bad('GM only',403);ctx.room.combat={active:false,phase:'idle',round:0,current:null,rolls:[],order:[]};}
   else if(input.command==='next'){const current=profile(ctx,ctx.room.combat.current);control(ctx,current);if(!ctx.gm&&current.kind!=='pc')bad('GM advances NPC turns.',403);if(!ctx.gm){const rows=await props(current.creatureId),meta=await Effects.find({creatureId:current.creatureId}).fetchAsync();for(const buff of liveBuffs(rows)){const save=(meta.find(e=>e.buffId===buff._id)||{}).save||saveFor(buff);if(save&&save.timing==='end of turn'&&save.lastTurn!==(ctx.room.combat.session||'manual')+':'+(ctx.room.combat.turn||0))bad('Resolve end-of-turn saving throws before ending your turn.',409);}}const order=ctx.room.combat.order;let index=order.indexOf(current.creatureId);for(let n=0;n<order.length;n++){index=(index+1)%order.length;if(index===0)ctx.room.combat.round++;const p=ctx.room.profiles.find(p=>p.creatureId===order[index]);if(!p)bad('Initiative participant missing.',409);if(p.kind==='pc'||hp(await props(p.creatureId)).value>0){ctx.room.combat.current=p.creatureId;ctx.room.combat.turn=(ctx.room.combat.turn||0)+1;break;}}}
   else bad('Unknown combat command');await save(ctx.room);await T.updateAsync(ctx.room.tabletopId,{$set:{initiative:{active:ctx.room.combat.active,roundNumber:ctx.room.combat.round,activeCreature:ctx.room.combat.current||undefined}}});await event(ctx.room,'turn',{text:ctx.room.combat.active?'Turn: '+(ctx.room.profiles.find(p=>p.creatureId===ctx.room.combat.current)||{}).name:'Combat ended; initiative cleared.'});return {status:'done'};
  }
  if(op==='effect'){
   if(!ctx.gm)bad('GM only',403);const p=profile(ctx,input.actorId);
   if(input.remove){await removeEffect(p.creatureId,input.remove);}
   else{if(input.ability&&(!['strength','dexterity','constitution','intelligence','wisdom','charisma'].includes(input.ability)||!Number.isInteger(input.dc)||input.dc<1||input.dc>40))bad('Invalid save');if(typeof input.name!=='string'||!input.name.trim()||input.name.length>100)bad('Effect name required');const id=await add(p.ownerId,p.creatureId,{type:'buff',name:input.name,description:{text:String(input.description||'').slice(0,2000)}});if(input.ability){if(!['strength','dexterity','constitution','intelligence','wisdom','charisma'].includes(input.ability)||!Number.isInteger(input.dc)||input.dc<1||input.dc>40)bad('Invalid save');await Effects.insertAsync({roomId:ctx.room._id,creatureId:p.creatureId,buffId:id,save:{ability:input.ability,dc:input.dc,endsOnSuccess:input.endsOnSuccess!==false,timing:input.timing||'manual'}});}await native(()=>compute(p.creatureId));}
   await save(ctx.room);return {status:'done'};
  }
  if(op==='death_confirm'){if(!ctx.gm)bad('GM only',403);const p=profile(ctx,input.actorId);if(p.kind!=='npc'||hp(await props(p.creatureId)).value>0)bad('NPC must be at zero HP.');ctx.room.dead[p.creatureId]=true;await save(ctx.room);await event(ctx.room,'notice',{text:p.name+' is dead (GM confirmed).'});return {status:'done'};}
  bad('Unknown operation',404);
 }
 async function handler(req,res,op){try{if(!await ready)bad('Demo setup failed; inspect local service logs.',503);const origin=req.headers.origin;if(origin&&origin!==cfg.dcPublic&&origin!==cfg.drPublic)bad('Origin not permitted',403);const ctx=await context(req);const body=req.body||{};const result=op==='state'||op==='move'||op==='location'?await dispatch(ctx,op,body):await serial(()=>dispatch(ctx,op,body));if(result&&result.health&&!ctx.gm)result.health=result.health.map(h=>ctx.room.profiles.some(p=>p.creatureId===h.id&&p.ownerId===ctx.userId)?h:{id:h.id,name:h.name,color:h.color,label:h.label});JsonRoutes.sendResult(res,{data:result});}catch(e){JsonRoutes.sendResult(res,{code:e.status||400,data:{error:String(e.message||e)}});}}
 const WebApp=Package.webapp.WebApp;
 Package.webapp.WebAppInternals.registerBoilerplateDataCallback('dc-dr-nav-'+cfg.instance,(request,data)=>{data.dynamicHead=(data.dynamicHead||'')+'<script src="'+route+'/nav.js" defer></script>';return true;});
 WebApp.rawConnectHandlers.use(function(req,res,next){
  const path=req.url.split('?')[0];if(path!==route&&!path.startsWith(route+'/'))return next();
  if(path===route){res.statusCode=302;res.setHeader('Location',route+'/');return res.end();}
  if(req.method==='GET'&&(path===route+'/'||path===route+'/client.js'||path===route+'/nav.js')){res.setHeader('Content-Type',path.endsWith('.js')?'application/javascript':'text/html;charset=utf-8');res.setHeader('Cache-Control','no-store');return res.end(fs.readFileSync('/opt/dc-dr-assets/'+(path.endsWith('nav.js')?'nav.js':path.endsWith('.js')?'client.js':'index.html'),'utf8').split('/dc-dr/').join(route+'/'));}
  const op=path.replace(route+'/api/','');
  if(!['state','move','location','action','continue','approval','combat','effect','death_confirm','object'].includes(op)){res.statusCode=404;return res.end();}
  if(req.method!== ((op==='state'||op==='location')?'GET':'POST')){res.statusCode=405;return res.end();}
  if(req.method==='GET')return handler(req,res,op);
  let body='';req.on('data',part=>{body+=part;if(Buffer.byteLength(body)>32768)req.destroy();});req.on('end',()=>{try{req.body=JSON.parse(body||'{}');}catch{res.statusCode=400;return res.end(JSON.stringify({error:'Invalid JSON'}));}handler(req,res,op);});
 });

 setInterval(()=>{R.findOneAsync(cfg.instance).then(room=>room&&synchronize(room)).catch(()=>{});},15000);
});

};
