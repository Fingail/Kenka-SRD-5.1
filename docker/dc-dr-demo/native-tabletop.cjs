// SPDX-License-Identifier: GPL-3.0-only
// Presentation and map authentication only. DiceCloud's own DDP methods,
// publication, action dialogs and logs handle all gameplay.
module.exports=({Meteor,Package,cfg,ready,context})=>{
 const fs=require('fs'),route=cfg.route,clientVersion=encodeURIComponent(process.env.AUTOUPDATE_VERSION||'native');
 ready.catch(e=>console.error('Native tabletop preparation failed:',e.message));
 Package.webapp.WebAppInternals.registerBoilerplateDataCallback('native-dr-map',(req,data)=>{data.dynamicHead=(data.dynamicHead||'')+'<script src="'+route+'/native-ui.js?v='+clientVersion+'" defer></script>';return true;});
 Package.webapp.WebApp.rawConnectHandlers.use((req,res,next)=>{
  const path=req.url.split('?')[0];if(path!==route&&!path.startsWith(route+'/'))return next();
  const json=(status,value)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(value));};
  if(req.method!=='GET'){res.statusCode=405;return res.end();}
  if(path===route+'/native-ui.js'){res.setHeader('Content-Type','application/javascript');res.setHeader('Cache-Control','no-store');return res.end(fs.readFileSync('/opt/dc-dr-assets/native-ui.js','utf8').split('__TABLETOP_ROUTE__').join(route));}
  if(path!==route&&path!==route+'/'&&path!==route+'/api/map'){res.statusCode=404;return res.end();}
  ready.then(async room=>{
   if(path!==route+'/api/map'){res.statusCode=302;res.setHeader('Location','/tabletop/'+room.tabletopId);return res.end();}
   try{const ctx=await context(req);json(200,{tabletopId:room.tabletopId,role:ctx.gm?'gm':'player',url:cfg.drPublic+(ctx.gm?'/dm':''),origin:cfg.drPublic,password:ctx.gm?cfg.drGMPassword:cfg.drPlayerPassword,kanka:cfg.kanka,profiles:room.profiles.map(p=>({tokenId:p.tokenId,creatureId:p.creatureId,sourceUrl:p.sourceUrl}))});}catch(e){json(e.status||403,{error:e.message});}
  }).catch(()=>json(503,{error:'Native tabletop is preparing.'}));
 });
};
