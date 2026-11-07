// SPDX-License-Identifier: GPL-3.0-only
(() => {
 const parentOrigin='http://127.0.0.1:18084';let data=null,token='',lastToken='',lastTime=0;
 const send=payload=>{if(window.parent!==window)window.parent.postMessage(payload,parentOrigin);};
 window.addEventListener('message',event=>{
  if(event.origin!==parentOrigin||event.source!==window.parent||event.data?.type!=='dc-dr:init')return;
  data=event.data;token=data.diceToken;
  const key=data.role==='gm'?'dmPassword':'pcPassword',value=JSON.stringify(data.drPassword);
  if(localStorage.getItem(key)!==value){localStorage.setItem(key,value);location.replace(data.role==='gm'?'/dm':'/');return;}
  window.dispatchEvent(new Event('ocf:turn'));
  if(data.selectTokenId){window.ocfPendingTokenSelection=data.selectTokenId;window.dispatchEvent(new CustomEvent('ocf:select-token',{detail:{tokenId:data.selectTokenId}}));}
 });
 const original=window.fetch;window.fetch=function(input,options={}){const url=new URL(typeof input==='string'?input:input.url,location.href);if(url.origin===location.origin&&url.pathname.startsWith('/api/')){options={...options,headers:new Headers(options.headers||input.headers||{})};if(token)options.headers.set('X-DiceCloud-Token',token);}return original.call(this,input,options);};
 window.ocfCanMoveToken=id=>!!data?.creatures.find(c=>c.tokenId===id)?.canMove;
 window.ocfTokenEffects=id=>data?.creatures.find(c=>c.tokenId===id)?.effects||[];
 window.ocfTokenHealthStyle=id=>{const color=data?.creatures.find(c=>c.tokenId===id)?.health.color;return color==='red'?{background:'#991b1b',color:'#fff'}:color==='yellow'?{background:'#facc15',color:'#172235'}:{background:'#166534',color:'#fff'};};
 window.ocfEffectStyle=name=>/dead|unconscious|down/i.test(name)?{background:'#991b1b',color:'#fff'}:{background:'#5b21b6',color:'#fff'};
 window.addEventListener('ocf:token',event=>{const id=event.detail?.tokenId,now=Date.now();if(id===lastToken&&now-lastTime<150)return;lastToken=id;lastTime=now;send({type:'dc-dr:select',tokenId:id});});
 send({type:'dc-dr:ready'});
 if(window.parent!==window)return;
 const banner=document.createElement('a');banner.href=parentOrigin+'__DC_DR_ROUTE__/';banner.textContent='DiceCloud encounter';Object.assign(banner.style,{position:'fixed',left:'80px',top:'12px',zIndex:3000,background:'#13243b',color:'#fff',padding:'8px',borderRadius:'6px',font:'14px system-ui'});document.body.append(banner);
})();
