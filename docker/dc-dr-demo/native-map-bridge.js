// SPDX-License-Identifier: GPL-3.0-only
// Native DR selection and authenticated movement policy; no dice or HP engine.
(()=>{
 const origin='http://127.0.0.1:18084';let policy={moves:[]},token='',targeting={active:false,available:[],selected:[]};
 const original=window.fetch;window.fetch=function(input,options={}){const url=new URL(typeof input==='string'?input:input.url,location.href);if(url.origin===location.origin&&url.pathname.startsWith('/api/')){options={...options,headers:new Headers(options.headers||(typeof input==='object'?input.headers:undefined))};if(token)options.headers.set('X-DiceCloud-Token',token);}return original.call(this,input,options);};
 window.ocfCanMoveToken=id=>!targeting.active&&policy.moves.includes(id);
 const status=id=>(policy.statuses||[]).find(a=>a.tokenId===id);
 window.ocfTokenHealthStyle=id=>status(id)?.health||{background:'#626262',color:'#fff'};
 window.ocfTokenEffects=id=>{const a=status(id);if(!a)return [];const labels=[{id:'health-'+id,name:a.health.label,...a.health},...(a.effects||[])];if(targeting.selected.includes(id))labels.unshift({id:'target-'+id,name:'⌖ Target',background:'#237a3b',color:'#fff'});if(a.hp<=0&&!labels.some(e=>/dead|unconscious/i.test(e.name)))labels.push({id:'down-'+id,name:a.kind==='npc'?'Dead':'Unconscious',background:'#782a32',color:'#fff'});return labels;};
 window.ocfEffectStyle=name=>{for(const a of policy.statuses||[])for(const e of window.ocfTokenEffects(a.tokenId))if(e.name===name)return {background:e.background,color:e.color};return {background:'#6b4ba5',color:'#fff'};};
 const colours=document.createElement('style');colours.textContent=`
.dice-native-targeting canvas{cursor:crosshair!important}
.ehs5tfu5,.ehs5tfu4,.ehs5tfu0{background:#303030!important;border-color:#777!important;box-shadow:0 3px 12px #0005}
.ehs5tfu5{border:1px solid #777;box-sizing:border-box}
.ehs5tfu2,.ehs5tfu2>*,.ehs5tfu0{color:#eee!important}
.ehs5tfu2 svg{color:#eee!important;stroke:#eee!important}
.ehs5tfu2{border-radius:4px}.ehs5tfu2:hover{background:#454545!important}
.ehs5tfu3[data-dice-active=true]>.ehs5tfu2{background:#455446!important;box-shadow:inset 2px 0 #83d69a}
.ehs5tfu1{background:#383838!important;color:#eee!important;border:1px solid #777;box-shadow:0 4px 18px #0007}
.ehs5tfu1,.ehs5tfu1 label,.ehs5tfu1 p,.ehs5tfu1 span,.ehs5tfu1 h1,.ehs5tfu1 h2,.ehs5tfu1 h3{color:#eee!important}
.ehs5tfu1 button,.ehs5tfu1 input,.ehs5tfu1 select,.ehs5tfu1 textarea{background:#303030!important;color:#eee!important;border-color:#777!important;color-scheme:dark}
.ehs5tfu1 button:hover{background:#484848!important}.ehs5tfu1 input::placeholder,.ehs5tfu1 textarea::placeholder{color:#aaa!important}
.ehs5tfu1 a{color:#9ac5ef!important}.ehs5tfu1 input[type=checkbox],.ehs5tfu1 input[type=range]{accent-color:#83b890}

.native-gm-map .dice-map-layer-stack{position:fixed!important;right:12px!important;left:auto!important;bottom:12px!important;top:auto!important;width:70px!important;display:flex!important;flex-direction:column!important;gap:8px!important;transform:none!important;z-index:2000}
.native-gm-map .dice-map-layer-stack>.efq21yu0{margin:0!important}
.native-gm-map .dice-map-layer-stack .ehs5tfu5,.native-gm-map .dice-map-layer-stack .ehs5tfu4{width:70px!important;height:auto!important;display:flex!important;flex-direction:column!important;padding:0!important;margin:0!important;box-sizing:border-box}
.native-gm-map .dice-map-layer-stack .ehs5tfu3{width:68px!important;min-width:0!important;flex:none!important;padding:0!important;height:48px!important}
.native-gm-map .dice-map-layer-stack .ehs5tfu2{height:48px!important}
.native-gm-map .dice-map-draw-tools{position:fixed!important;right:12px!important;left:auto!important;top:auto!important;bottom:calc(var(--dice-layer-height,400px) + 20px)!important;width:70px!important;max-height:calc(100vh - var(--dice-layer-height,400px) - 32px);height:auto!important;overflow:auto;display:flex!important;flex-direction:column!important;transform:none!important;z-index:2000}
.native-gm-map .dice-map-draw-tools .ehs5tfu0{width:68px;height:32px;min-height:32px;order:0}
.native-gm-map .dice-map-draw-tools .ehs5tfu4{width:68px;padding:0!important;margin:0!important;flex:none}
.native-gm-map .dice-map-draw-tools .ehs5tfu3{padding:0!important;height:44px;min-height:44px}
.native-gm-map .dice-map-draw-tools .ehs5tfu2{height:44px!important}
.native-gm-map .dice-map-visibility-group{order:1}.native-gm-map .dice-map-drawing-group{order:2}
.native-gm-map .dice-map-layer-stack .ehs5tfu1,.native-gm-map .dice-map-draw-tools .ehs5tfu1{position:fixed!important;left:auto!important;right:94px!important;bottom:auto!important;top:var(--dice-popup-top,80px)!important;max-height:calc(100vh - 24px);overflow:auto}

`;document.head.append(colours);
 let lastTools='';
 function decorateTools(){const grid=[...document.querySelectorAll('.ehs5tfu2')].find(e=>e.textContent.trim()==='Grid'),stack=grid?.closest('.efq21yu1');if(stack){stack.classList.add('dice-map-layer-stack');document.documentElement.style.setProperty('--dice-layer-height',stack.getBoundingClientRect().height+'px');}const move=[...document.querySelectorAll('.ehs5tfu2')].find(e=>e.textContent.trim()==='Move'),draw=move?.closest('.ehs5tfu5');if(draw){draw.classList.add('dice-map-draw-tools');move.closest('.ehs5tfu4')?.classList.add('dice-map-drawing-group');for(const b of draw.querySelectorAll('.ehs5tfu2'))if(['Reveal','Shroud','Shroud All','Clear All'].includes(b.textContent.trim()))b.closest('.ehs5tfu4')?.classList.add('dice-map-visibility-group');}for(const popup of document.querySelectorAll('.dice-map-layer-stack .ehs5tfu1,.dice-map-draw-tools .ehs5tfu1')){const anchor=popup.closest('.ehs5tfu3')?.getBoundingClientRect(),height=popup.getBoundingClientRect().height;popup.style.setProperty('--dice-popup-top',Math.max(12,Math.min(anchor?.top||80,innerHeight-height-12))+'px');}for(const li of document.querySelectorAll('.ehs5tfu3')){const b=li.querySelector('button');li.dataset.diceActive=String(!!b&&getComputedStyle(b).filter!=='none'&&!b.matches(':hover'));}const popups=[...document.querySelectorAll('.dice-map-layer-stack .ehs5tfu1,.dice-map-draw-tools .ehs5tfu1')].map(e=>e.getBoundingClientRect()).filter(r=>r.width&&r.height),modals=[...document.querySelectorAll('[role=dialog],[aria-modal=true]')].some(e=>{const r=e.getBoundingClientRect();return r.width&&r.height;});const clearance=Math.max(88,...popups.map(r=>innerWidth-r.left+12)),message=JSON.stringify({clearance,modal:modals});if(message!==lastTools){lastTools=message;if(parent!==window)parent.postMessage({type:'dice-map:tools',clearance,modal:modals},origin);}}
 new MutationObserver(decorateTools).observe(document.body,{childList:true,subtree:true});setInterval(decorateTools,700);decorateTools();

 window.addEventListener('message',e=>{if(e.source===parent&&e.origin===origin&&e.data?.type==='dice-map:targeting'){targeting=e.data;window.diceNativeTargeting=targeting.active;document.body.classList.toggle('dice-native-targeting',targeting.active);window.dispatchEvent(new Event('ocf:turn'));return;}if(e.source===parent&&e.origin===origin&&e.data?.type==='dice-map:policy'){policy=e.data;token=e.data.diceToken||'';window.dispatchEvent(new Event('ocf:turn'));return;}if(e.source===parent&&e.origin===origin&&e.data?.type==='dice-map:select-token'){window.ocfPendingTokenSelection=e.data.tokenId;window.dispatchEvent(new CustomEvent('ocf:select-token',{detail:{tokenId:e.data.tokenId}}));return;}if(e.source!==parent||e.origin!==origin||e.data?.type!=='dice-map:init')return;document.body.classList.toggle('native-gm-map',e.data.role==='gm');decorateTools();const key=e.data.role==='gm'?'dmPassword':'pcPassword',value=JSON.stringify(e.data.password);if(localStorage.getItem(key)!==value){localStorage.setItem(key,value);location.replace(e.data.role==='gm'?'/dm':'/');}});
 window.addEventListener('ocf:token',e=>parent.postMessage({type:'dice-map:select',tokenId:e.detail?.tokenId},origin));
 if(parent!==window)parent.postMessage({type:'dice-map:ready'},origin);
})();
