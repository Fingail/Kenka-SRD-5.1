// SPDX-License-Identifier: GPL-3.0-only
// Native DR selection and authenticated movement policy; no dice or HP engine.
(()=>{
 const origin='http://127.0.0.1:18084';let policy={moves:[]},token='',targeting={active:false,available:[],selected:[]};
 const original=window.fetch;window.fetch=function(input,options={}){const url=new URL(typeof input==='string'?input:input.url,location.href);if(url.origin===location.origin&&url.pathname.startsWith('/api/')){options={...options,headers:new Headers(options.headers||(typeof input==='object'?input.headers:undefined))};if(token)options.headers.set('X-DiceCloud-Token',token);}return original.call(this,input,options);};
 window.ocfCanMoveToken=id=>!window.diceVectorEditing&&!targeting.active&&policy.moves.includes(id);
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




:is(.native-gm-map,.native-player-map) :is([role=dialog],[role=menu],.chakra-popover__content){background:#303030!important;color:#eee!important;border:1px solid #666!important;border-radius:6px!important;font:12px/1.4 system-ui!important}
:is(.native-gm-map,.native-player-map) [role=dialog]{max-height:calc(100vh - 24px)!important;max-width:calc(100vw - 24px)!important;overflow:auto!important;overscroll-behavior:contain}\n:is(.native-gm-map,.native-player-map) [role=dialog] :is(footer,.chakra-modal__footer){position:sticky;bottom:0;background:#303030;z-index:2}\n:is(.native-gm-map,.native-player-map) [role=dialog] :is(h1,h2,h3,p,label,span){color:#eee!important}
:is(.native-gm-map,.native-player-map) [role=dialog] :is(input,select,textarea,button){background:#383838!important;color:#eee!important;border-color:#666!important;border-radius:4px!important;font:12px system-ui!important}
:is(.native-gm-map,.native-player-map) [role=menuitem]{background:#303030!important;color:#eee!important}
:is(.native-gm-map,.native-player-map) [role=menuitem]:hover{background:#454545!important}

body:not(.dice-map-show-advanced) .dice-map-advanced-control{display:none!important}
.ehs5tfu5,.ehs5tfu4{border-radius:5px!important}
.ehs5tfu2{font:11px/1.2 system-ui!important;background:#303030!important}
.ehs5tfu2:hover{background:#454545!important}
.ehs5tfu1{font:12px/1.4 system-ui!important;border-radius:6px!important;padding:10px!important}
.ehs5tfu1 h1,.ehs5tfu1 h2,.ehs5tfu1 h3{font-size:13px!important;margin:4px 0 8px!important}
.ehs5tfu1 label,.ehs5tfu1 p{font:12px/1.4 system-ui!important}
.ehs5tfu1 button,.ehs5tfu1 input,.ehs5tfu1 select{font:12px system-ui!important;border:1px solid #666!important;border-radius:4px!important;padding:4px 6px!important;min-height:26px}
.native-player-map .dice-map-player-controls .ehs5tfu0,.native-gm-map .dice-map-draw-tools .ehs5tfu0{display:none!important}

.native-player-map .dice-map-player-controls-host{transform:none!important;will-change:auto!important}
.native-player-map .dice-map-player-controls{height:auto!important;position:fixed!important;right:12px!important;left:auto!important;bottom:12px!important;top:auto!important;width:70px!important;display:flex!important;flex-direction:column!important;transform:none!important;z-index:2000}
.native-player-map .dice-map-player-controls .ehs5tfu0{width:68px;height:28px;min-height:28px}
.native-player-map .dice-map-player-controls .ehs5tfu4{height:auto!important;flex:none!important;width:68px;display:flex!important;flex-direction:column!important;margin:0!important;padding:0!important}
.native-player-map .dice-map-player-controls .ehs5tfu3{width:68px;height:48px;padding:0!important;flex:none!important}
.native-player-map .dice-map-player-controls .ehs5tfu2{height:48px!important}
.native-player-map .dice-map-player-controls .ehs5tfu1{position:fixed!important;left:auto!important;right:94px!important;top:var(--dice-popup-top,80px)!important;bottom:auto!important;max-height:calc(100vh - 24px);overflow:auto}

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
 function floatingMapDialogs(){for(const dialog of document.querySelectorAll('[role=dialog]')){const heading=dialog.querySelector('h1,h2,h3,[role=heading]');if(!heading||heading.dataset.diceDragBound)continue;heading.dataset.diceDragBound='true';heading.style.cursor='move';heading.style.touchAction='none';let drag=null;heading.onpointerdown=e=>{if(e.button!==0||e.target.closest('button,input,a'))return;const r=dialog.getBoundingClientRect();dialog.style.setProperty('position','fixed','important');dialog.style.setProperty('transform','none','important');dialog.style.setProperty('left',r.x+'px','important');dialog.style.setProperty('top',r.y+'px','important');dialog.style.setProperty('margin','0','important');drag={x:e.clientX-r.x,y:e.clientY-r.y};heading.setPointerCapture(e.pointerId);e.preventDefault();};heading.onpointermove=e=>{if(!drag)return;const x=Math.max(8,Math.min(innerWidth-dialog.offsetWidth-8,e.clientX-drag.x)),y=Math.max(8,Math.min(innerHeight-120,e.clientY-drag.y));dialog.style.setProperty('left',x+'px','important');dialog.style.setProperty('top',y+'px','important');dialog.style.setProperty('max-height',(innerHeight-y-12)+'px','important');};heading.onpointerup=heading.onpointercancel=()=>drag=null;}}
 let lastTools='';
 function decorateTools(){floatingMapDialogs();for(const button of document.querySelectorAll('.ehs5tfu2'))button.closest('.ehs5tfu3')?.classList.toggle('dice-map-advanced-control',['Map Library','Media Library','Notes','Clipboard','Stop Sharing'].includes(button.textContent.trim()));if(document.body.classList.contains('native-player-map')){const controls=[...document.querySelectorAll('.ehs5tfu2')].find(e=>e.textContent.trim()==='Center Map')?.closest('.ehs5tfu5');controls?.classList.add('dice-map-player-controls');controls?.parentElement.classList.add('dice-map-player-controls-host');}const grid=[...document.querySelectorAll('.ehs5tfu2')].find(e=>e.textContent.trim()==='Grid'),stack=grid?.closest('.efq21yu1');if(stack){stack.classList.add('dice-map-layer-stack');document.documentElement.style.setProperty('--dice-layer-height',stack.getBoundingClientRect().height+'px');}const move=[...document.querySelectorAll('.ehs5tfu2')].find(e=>e.textContent.trim()==='Move'),draw=move?.closest('.ehs5tfu5');if(draw){draw.classList.add('dice-map-draw-tools');move.closest('.ehs5tfu4')?.classList.add('dice-map-drawing-group');for(const b of draw.querySelectorAll('.ehs5tfu2'))if(['Reveal','Shroud','Shroud All','Clear All'].includes(b.textContent.trim()))b.closest('.ehs5tfu4')?.classList.add('dice-map-visibility-group');}for(const popup of document.querySelectorAll('.dice-map-layer-stack .ehs5tfu1,.dice-map-draw-tools .ehs5tfu1,.dice-map-player-controls .ehs5tfu1')){const anchor=popup.closest('.ehs5tfu3')?.getBoundingClientRect(),height=popup.getBoundingClientRect().height;popup.style.setProperty('--dice-popup-top',Math.max(12,Math.min(anchor?.top||80,innerHeight-height-12))+'px');}for(const li of document.querySelectorAll('.ehs5tfu3')){const b=li.querySelector('button');li.dataset.diceActive=String(!!b&&(b.getAttribute('aria-pressed')==='true'||b.getAttribute('aria-checked')==='true'));}const popups=[...document.querySelectorAll('.dice-map-layer-stack .ehs5tfu1,.dice-map-draw-tools .ehs5tfu1,.dice-map-player-controls .ehs5tfu1')].map(e=>e.getBoundingClientRect()).filter(r=>r.width&&r.height),modals=[...document.querySelectorAll('[role=dialog],[aria-modal=true]')].some(e=>{const r=e.getBoundingClientRect();return r.width&&r.height;});const clearance=Math.max(88,...popups.map(r=>innerWidth-r.left+12)),message=JSON.stringify({clearance,modal:modals});if(message!==lastTools){lastTools=message;if(parent!==window)parent.postMessage({type:'dice-map:tools',clearance,modal:modals},origin);}}
 new MutationObserver(decorateTools).observe(document.body,{childList:true,subtree:true});setInterval(decorateTools,700);decorateTools();

 window.addEventListener('message',e=>{if(e.source===parent&&e.origin===origin&&e.data?.type==='dice-map:advanced'){document.body.classList.toggle('dice-map-show-advanced',!!e.data.enabled);decorateTools();return;}if(e.source===parent&&e.origin===origin&&e.data?.type==='dice-map:targeting'){targeting=e.data;window.diceNativeTargeting=targeting.active;document.body.classList.toggle('dice-native-targeting',targeting.active);window.dispatchEvent(new Event('ocf:turn'));return;}if(e.source===parent&&e.origin===origin&&e.data?.type==='dice-map:policy'){policy=e.data;token=e.data.diceToken||'';window.dispatchEvent(new Event('ocf:turn'));return;}if(e.source===parent&&e.origin===origin&&e.data?.type==='dice-map:select-token'){window.ocfPendingTokenSelection=e.data.tokenId;window.dispatchEvent(new CustomEvent('ocf:select-token',{detail:{tokenId:e.data.tokenId}}));return;}if(e.source!==parent||e.origin!==origin||e.data?.type!=='dice-map:init')return;document.body.classList.toggle('native-gm-map',e.data.role==='gm');document.body.classList.toggle('native-player-map',e.data.role==='player');decorateTools();const key=e.data.role==='gm'?'dmPassword':'pcPassword',value=JSON.stringify(e.data.password);if(localStorage.getItem(key)!==value){localStorage.setItem(key,value);location.replace(e.data.role==='gm'?'/dm':'/');}});
 window.addEventListener('ocf:token',e=>parent.postMessage({type:'dice-map:select',tokenId:e.detail?.tokenId},origin));
 const vectorLink=document.createElement('a');vectorLink.id='dice-map-vector-open';vectorLink.textContent='Map tools';vectorLink.href=origin+'__DC_DR_ROUTE__/?mapTools=1';vectorLink.target='_top';vectorLink.setAttribute('aria-label','Open integrated map tools');Object.assign(vectorLink.style,{position:'fixed',right:'12px',top:'12px',width:'70px',minHeight:'36px',display:'flex',alignItems:'center',justifyContent:'center',boxSizing:'border-box',padding:'5px',zIndex:'2100',background:'#303030',color:'#eee',border:'1px solid #666',borderRadius:'5px',font:'11px/1.2 system-ui',textDecoration:'none'});document.body.append(vectorLink);
 let vectorParentReady=false;window.addEventListener('message',e=>{if(e.source!==parent||e.origin!==origin||e.data?.type!=='dice-vector:state')return;vectorParentReady=true;vectorLink.style.display=e.data.panelOpen?'none':'flex';});vectorLink.onclick=e=>{if(parent!==window&&vectorParentReady){e.preventDefault();parent.postMessage({type:'dice-vector:open'},origin);}};
 const vectors=document.createElement('script');vectors.src='/dc-dr-vector-map.js?v='+encodeURIComponent(location.search||'vectors-v1');document.head.append(vectors);
 if(parent!==window)parent.postMessage({type:'dice-map:ready'},origin);
})();
