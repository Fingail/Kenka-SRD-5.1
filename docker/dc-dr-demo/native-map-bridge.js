// SPDX-License-Identifier: GPL-3.0-only
// Native DR selection and authenticated movement policy; no dice or HP engine.
(()=>{
 const origin='http://127.0.0.1:18084';let policy={moves:[]},token='';
 const original=window.fetch;window.fetch=function(input,options={}){const url=new URL(typeof input==='string'?input:input.url,location.href);if(url.origin===location.origin&&url.pathname.startsWith('/api/')){options={...options,headers:new Headers(options.headers||(typeof input==='object'?input.headers:undefined))};if(token)options.headers.set('X-DiceCloud-Token',token);}return original.call(this,input,options);};
 window.ocfCanMoveToken=id=>policy.moves.includes(id);
 window.addEventListener('message',e=>{if(e.source===parent&&e.origin===origin&&e.data?.type==='dice-map:policy'){policy=e.data;token=e.data.diceToken||'';window.dispatchEvent(new Event('ocf:turn'));return;}if(e.source===parent&&e.origin===origin&&e.data?.type==='dice-map:select-token'){window.ocfPendingTokenSelection=e.data.tokenId;window.dispatchEvent(new CustomEvent('ocf:select-token',{detail:{tokenId:e.data.tokenId}}));return;}if(e.source!==parent||e.origin!==origin||e.data?.type!=='dice-map:init')return;const key=e.data.role==='gm'?'dmPassword':'pcPassword',value=JSON.stringify(e.data.password);if(localStorage.getItem(key)!==value){localStorage.setItem(key,value);location.replace(e.data.role==='gm'?'/dm':'/');}});
 window.addEventListener('ocf:token',e=>parent.postMessage({type:'dice-map:select',tokenId:e.detail?.tokenId},origin));
 if(parent!==window)parent.postMessage({type:'dice-map:ready'},origin);
})();
