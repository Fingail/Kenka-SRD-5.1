// SPDX-License-Identifier: GPL-3.0-only
// Native DR movement/selection. No combat engine, HP hooks or turn gate.
(()=>{
 const origin='http://127.0.0.1:18084';
 window.ocfCanMoveToken=()=>true;
 window.addEventListener('message',e=>{if(e.source!==parent||e.origin!==origin||e.data?.type!=='dice-map:init')return;const key=e.data.role==='gm'?'dmPassword':'pcPassword',value=JSON.stringify(e.data.password);if(localStorage.getItem(key)!==value){localStorage.setItem(key,value);location.replace(e.data.role==='gm'?'/dm':'/');}});
 window.addEventListener('ocf:token',e=>parent.postMessage({type:'dice-map:select',tokenId:e.detail?.tokenId},origin));
 if(parent!==window)parent.postMessage({type:'dice-map:ready'},origin);
})();
