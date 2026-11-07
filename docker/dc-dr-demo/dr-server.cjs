// SPDX-License-Identifier: GPL-3.0-only
// Map-only DR adapter. Native DiceCloud owns authorization and combat state.
const http=require('http'),fs=require('fs');
const express=require('/usr/src/app/node_modules/express');
const {bootstrapServer}=require('/usr/src/app/server-build/server');
const {getEnv}=require('/usr/src/app/server-build/env');
bootstrapServer(getEnv(process.env)).then(({app,httpServer})=>{
 const router=express.Router();const reply=(res,status,data)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};const serve=(res,type,path)=>{res.setHeader('Content-Type',type);res.setHeader('Cache-Control','no-store');res.end(fs.readFileSync(path));};
 router.patch('/api/map/:mapId/token/:tokenId',express.json({limit:'16kb'}),async(req,res,next)=>{
  const credential=(req.headers.authorization||'').replace(/^Bearer /,'')||new URL(req.originalUrl,'http://local').searchParams.get('authorization');
  if(credential===process.env.DM_PASSWORD)return next();
  if(credential!==process.env.PC_PASSWORD)return reply(res,401,{error:{message:'DR authentication required'}});
  if(Object.keys(req.body||{}).some(k=>!['x','y'].includes(k))||['x','y'].some(k=>req.body[k]!==undefined&&(!Number.isFinite(req.body[k])||Math.abs(req.body[k])>10000000)))return reply(res,403,{error:{message:'Players may only move their own token.'}});
  try{
   const status=await new Promise((resolve,reject)=>{const body=JSON.stringify({mapId:req.params.mapId,tokenId:req.params.tokenId});const r=http.request(new URL((process.env.DC_DR_ROUTE||'/dc-dr')+'/api/move','http://dicecloud:3000'),{method:'POST',headers:{Authorization:'Bearer '+(req.headers['x-dicecloud-token']||''),'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}},s=>{s.resume();resolve(s.statusCode);});r.setTimeout(5000,()=>r.destroy(Error('Permission timeout')));r.on('error',reject);r.end(body);});
   if(status>=200&&status<300)return next();return reply(res,status,{error:{message:'Move only your PC on its active turn.'}});
  }catch{return reply(res,503,{error:{message:'DiceCloud movement authorization unavailable.'}});}
 });
 router.get('/dc-dr-map-bridge.js',(req,res)=>{res.setHeader('Content-Type','application/javascript');res.setHeader('Cache-Control','no-store');res.end(fs.readFileSync('/usr/src/app/dc-dr-map-bridge.js','utf8').split('__DC_DR_ROUTE__').join(process.env.DC_DR_ROUTE||'/dc-dr'));});
 router.get(['/','/dm'],(req,res)=>serve(res,'text/html;charset=utf-8','/usr/src/app/build/index.html'));
 app.use(router);app._router.stack.unshift(app._router.stack.pop());httpServer.listen(Number(process.env.PORT||3000),'0.0.0.0');
}).catch(e=>{console.error(e.message);process.exit(1);});
