// SPDX-License-Identifier: GPL-3.0-only
// Map embedding and turn authorization around DiceCloud's own DDP methods.
// Native action dialogs, dice, properties and logs still resolve gameplay.
module.exports=({Meteor,Package,cfg,ready,context,combatDeps})=>{
 const fs=require('fs'),route=cfg.route,clientVersion=encodeURIComponent(process.env.AUTOUPDATE_VERSION||'native');
 const workshop=require('/opt/dc-dr-assets/native-workshop.cjs')({cfg,ready,context,deps:combatDeps});
 const combat=require('/opt/dc-dr-assets/native-combat.cjs')({Meteor,cfg,ready,context,deps:combatDeps});
 const vectors=require('/opt/dc-dr-assets/native-vectors.cjs')({cfg,ready,context,deps:combatDeps});
 ready.catch(e=>console.error('Native tabletop preparation failed:',e.message));
 Package.webapp.WebAppInternals.registerBoilerplateDataCallback('native-dr-map',(req,data)=>{
  const files=['workshop-rules.js','workshop-ui.js','native-ui.js','vector-geometry.js','vector-ui.js','native-log-layout.js','native-log-ui.js','native-combat-ui.js','native-lucky-ui.js','native-sheet-data.js','native-sheet-ui.js'];
  data.dynamicHead=(data.dynamicHead||'')+files.map(name=>'<script src="'+route+'/'+name+'?v='+clientVersion+'" defer></script>').join('');return true;
 });
 Package.webapp.WebApp.rawConnectHandlers.use((req,res,next)=>{
  const path=req.url.split('?')[0];if(path==='/sw.js'){res.setHeader('Content-Type','application/javascript');res.setHeader('Cache-Control','no-store');res.setHeader('Service-Worker-Allowed','/');return res.end(fs.readFileSync('/opt/dc-dr-assets/native-service-worker.js','utf8'));}if(path!==route&&!path.startsWith(route+'/'))return next();
  const json=(status,value)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(value));};
  if(path===route+'/workshop'){res.statusCode=302;const character=new URL(req.url,'http://local').searchParams.get('character');res.setHeader('Location','/?workshop=1'+(character?'&character='+encodeURIComponent(character):''));return res.end();}
  if(path.startsWith(route+'/api/workshop/'))return workshop.handle(req,res,path.slice((route+'/api/workshop/').length));
  if(path.startsWith(route+'/api/combat/'))return combat.handle(req,res,path.slice((route+'/api/combat/').length));
  if(path.startsWith(route+'/api/vectors/'))return vectors.handle(req,res,path.slice((route+'/api/vectors/').length));
  if(req.method!=='GET'){res.statusCode=405;return res.end();}
  const scripts={'/native-lucky-ui.js':'native-lucky-ui.js','/native-log-layout.js':'native-log-layout.cjs','/native-log-ui.js':'native-log-ui.js','/vector-ui.js':'native-vector-ui.js','/vector-geometry.js':'vector-geometry.cjs','/workshop-ui.js':'native-workshop-ui.js','/workshop-rules.js':'native-workshop-rules.cjs','/native-ui.js':'native-ui.js','/native-combat-ui.js':'native-combat-ui.js','/native-sheet-data.js':'native-sheet-data.cjs','/native-sheet-ui.js':'native-sheet-ui.js'},script=scripts[path.slice(route.length)];if(script){res.setHeader('Content-Type','application/javascript');res.setHeader('Cache-Control','no-store');return res.end(fs.readFileSync('/opt/dc-dr-assets/'+script,'utf8').split('__TABLETOP_ROUTE__').join(route));}
  if(path!==route&&path!==route+'/'&&path!==route+'/api/map'){res.statusCode=404;return res.end();}
  ready.then(async room=>{
   if(path!==route+'/api/map'){res.statusCode=302;const mapTools=new URL(req.url,'http://local').searchParams.get('mapTools')==='1';res.setHeader('Location','/tabletop/'+room.tabletopId+(mapTools?'#map-tools':''));return res.end();}
   try{const ctx=await context(req);json(200,{tabletopId:room.tabletopId,role:ctx.gm?'gm':'player',url:cfg.drPublic+(ctx.gm?'/dm':''),origin:cfg.drPublic,password:ctx.gm?cfg.drGMPassword:cfg.drPlayerPassword,kanka:cfg.kanka,profiles:room.profiles.map(p=>({tokenId:p.tokenId,creatureId:p.creatureId,sourceUrl:p.sourceUrl}))});}catch(e){json(e.status||403,{error:e.message});}
  }).catch(()=>json(503,{error:'Native tabletop is preparing.'}));
 });
};
