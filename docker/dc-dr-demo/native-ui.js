// SPDX-License-Identifier: GPL-3.0-only
// Embed only a DR map; preserve DiceCloud's native tabletop, controls and logs.
(()=>{
 const route='__TABLETOP_ROUTE__';let config=null,frame=null,path='',busy=false;
 function component(){const e=document.querySelector('.tabletop');const v=e?.__vue__;if(v&&'activeCreatureId'in v)return v;const visit=v=>{if(!v)return null;if(v.$el===e&&'activeCreatureId'in v)return v;for(const c of v.$children||[]){const found=visit(c);if(found)return found;}return null;};return visit(document.querySelector('#app')?.__vue__);}
 function initialize(){if(frame?.contentWindow&&config)frame.contentWindow.postMessage({type:'dice-map:init',password:config.password,role:config.role},config.origin);}
 window.addEventListener('message',e=>{if(!config||e.origin!==config.origin||e.source!==frame?.contentWindow)return;if(e.data?.type==='dice-map:ready')initialize();if(e.data?.type==='dice-map:select'){const p=config.profiles.find(p=>p.tokenId===e.data.tokenId),v=component();if(!p||!v)return;if(v.activeActionId){if(v.targets.includes(p.creatureId))v.untarget(p.creatureId);else if(v.moreTargets)v.targets.push(p.creatureId);}else{v.activeCreatureId=p.creatureId;v.targets=[];}}});
 async function attach(){if(busy)return;const current=location.pathname;if(!current.startsWith('/tabletop/')){config=null;frame=null;path='';return;}busy=true;try{
  if(path!==current){config=null;frame=null;path=current;}
  if(!config){const token=localStorage.getItem('Meteor.loginToken');if(!token)return;const r=await fetch(route+'/api/map',{headers:{Authorization:'Bearer '+token}});if(!r.ok)return;const c=await r.json();if(current!=='/tabletop/'+c.tabletopId)return;config=c;}
  const area=document.querySelector('.tabletop .play-area');if(!area)return;area.style.setProperty('left',(document.querySelector('.tabletop').getBoundingClientRect().left+8)+'px','important');if(frame?.isConnected)return;
  if(!document.getElementById('native-dr-style')){const s=document.createElement('style');s.id='native-dr-style';s.textContent='.tabletop .play-area{z-index:0!important;top:265px!important;bottom:220px!important;right:455px!important;left:8px!important;border-radius:8px;overflow:hidden}.tabletop>.container{position:relative;z-index:2;pointer-events:none}.tabletop .initiative-row{pointer-events:auto}.tabletop>.container>.d-flex.align-stretch{position:fixed;right:8px;top:265px;bottom:220px;width:430px;pointer-events:auto;max-height:none!important;margin-top:0!important}.tabletop .v-footer{z-index:3}.native-kanka-map-link{position:absolute;top:5px;left:85px;z-index:2;background:#fff;padding:3px 7px;border-radius:4px;font:12px sans-serif}';document.head.append(s);}
  frame=document.createElement('iframe');frame.id='native-dr-map';frame.title='Renovar — Dungeon Revealer map';Object.assign(frame.style,{width:'100%',height:'100%',border:'0'});frame.src=config.url;frame.onload=initialize;area.append(frame);
  const link=document.createElement('a');link.className='native-kanka-map-link';link.href=config.kanka.questUrl;link.textContent='Kanka quest';link.target='_blank';link.rel='noopener';area.append(link);
 }finally{busy=false;}}
 setInterval(()=>attach().catch(()=>{}),500);
})();
