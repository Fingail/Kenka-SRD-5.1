// SPDX-License-Identifier: GPL-3.0-only
// Map embedding and turn authorization around DiceCloud's own DDP methods.
// Native action dialogs, dice, properties and logs still resolve gameplay.
module.exports=({Meteor,Package,cfg,ready,context,combatDeps})=>{
 const fs=require('fs'),route=cfg.route,clientVersion=encodeURIComponent(process.env.AUTOUPDATE_VERSION||'native');
 const combat=require('/opt/dc-dr-assets/native-combat.cjs')({Meteor,cfg,ready,context,deps:combatDeps});
 ready.catch(e=>console.error('Native tabletop preparation failed:',e.message));
 Package.webapp.WebAppInternals.registerBoilerplateDataCallback('native-dr-map',(req,data)=>{data.dynamicHead=(data.dynamicHead||'')+'<script src="'+route+'/native-ui.js?v='+clientVersion+'" defer></script><script src="'+route+'/native-combat-ui.js?v='+clientVersion+'" defer></script><script src="'+route+'/native-sheet-data.js?v='+clientVersion+'" defer></script><script src="'+route+'/native-sheet-ui.js?v='+clientVersion+'" defer></script>';return true;});
 Package.webapp.WebApp.rawConnectHandlers.use((req,res,next)=>{
  const path=req.url.split('?')[0];if(path==='/sw.js'){res.setHeader('Content-Type','application/javascript');res.setHeader('Cache-Control','no-store');res.setHeader('Service-Worker-Allowed','/');return res.end(fs.readFileSync('/opt/dc-dr-assets/native-service-worker.js','utf8'));}if(path!==route&&!path.startsWith(route+'/'))return next();
  const json=(status,value)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(value));};
  if(path.startsWith(route+'/api/combat/'))return combat.handle(req,res,path.slice((route+'/api/combat/').length));
  if(req.method!=='GET'){res.statusCode=405;return res.end();}
  const scripts={'/native-ui.js':'native-ui.js','/native-combat-ui.js':'native-combat-ui.js','/native-sheet-data.js':'native-sheet-data.cjs','/native-sheet-ui.js':'native-sheet-ui.js'},script=scripts[path.slice(route.length)];if(script){res.setHeader('Content-Type','application/javascript');res.setHeader('Cache-Control','no-store');return res.end(fs.readFileSync('/opt/dc-dr-assets/'+script,'utf8').split('__TABLETOP_ROUTE__').join(route));}
  if(path!==route&&path!==route+'/'&&path!==route+'/api/map'){res.statusCode=404;return res.end();}
  ready.then(async room=>{
   if(path!==route+'/api/map'){res.statusCode=302;res.setHeader('Location','/tabletop/'+room.tabletopId);return res.end();}
   try{const ctx=await context(req);json(200,{tabletopId:room.tabletopId,role:ctx.gm?'gm':'player',url:cfg.drPublic+(ctx.gm?'/dm':''),origin:cfg.drPublic,password:ctx.gm?cfg.drGMPassword:cfg.drPlayerPassword,kanka:cfg.kanka,profiles:room.profiles.map(p=>({tokenId:p.tokenId,creatureId:p.creatureId,sourceUrl:p.sourceUrl}))});}catch(e){json(e.status||403,{error:e.message});}
  }).catch(()=>json(503,{error:'Native tabletop is preparing.'}));
 });
};
