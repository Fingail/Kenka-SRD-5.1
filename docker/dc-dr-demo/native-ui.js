// SPDX-License-Identifier: GPL-3.0-only
// Embed only a DR map; preserve DiceCloud's native tabletop, controls and logs.
(()=>{
 const route='__TABLETOP_ROUTE__';let config=null,frame=null,path='',busy=false;
 function component(){const e=document.querySelector('.tabletop');const v=e?.__vue__;if(v&&'activeCreatureId'in v)return v;const visit=v=>{if(!v)return null;if(v.$el===e&&'activeCreatureId'in v)return v;for(const c of v.$children||[]){const found=visit(c);if(found)return found;}return null;};return visit(document.querySelector('#app')?.__vue__);}
 function initialize(){if(frame?.contentWindow&&config)frame.contentWindow.postMessage({type:'dice-map:init',password:config.password,role:config.role},config.origin);}
 window.addEventListener('message',e=>{if(!config||e.origin!==config.origin||e.source!==frame?.contentWindow)return;if(e.data?.type==='dice-map:ready')initialize();if(e.data?.type==='dice-map:select'){const p=config.profiles.find(p=>p.tokenId===e.data.tokenId),v=component();if(!p||!v)return;if(v.activeActionId){if(v.targets.includes(p.creatureId))v.untarget(p.creatureId);else if(v.moreTargets)v.targets.push(p.creatureId);}else{v.activeCreatureId=p.creatureId;v.targets=[];}}});
 async function attach(){if(busy)return;const current=location.pathname;if(!current.startsWith('/tabletop/')){document.body.classList.remove('native-dr-tabletop');document.documentElement.classList.remove('native-dr-tabletop');config=null;frame=null;path='';return;}busy=true;try{
  if(path!==current){document.body.classList.remove('native-dr-tabletop');document.documentElement.classList.remove('native-dr-tabletop');config=null;frame=null;path=current;}
  if(!config){const token=localStorage.getItem('Meteor.loginToken');if(!token)return;const r=await fetch(route+'/api/map',{headers:{Authorization:'Bearer '+token}});if(!r.ok)return;const c=await r.json();if(current!=='/tabletop/'+c.tabletopId)return;config=c;}
  const area=document.querySelector('.tabletop .play-area');if(!area)return;document.body.classList.add('native-dr-tabletop');document.documentElement.classList.add('native-dr-tabletop');if(frame?.isConnected)return;component()?.$store.commit('setDrawer',false);
  if(!document.getElementById('native-dr-style')){const s=document.createElement('style');s.id='native-dr-style';s.textContent=`
html.native-dr-tabletop{overflow:hidden!important;scrollbar-gutter:auto!important}
.native-dr-tabletop .tabletop .play-area{position:fixed!important;z-index:0!important;inset:0!important;width:100vw!important;height:100vh!important;border-radius:0;overflow:hidden}
.native-dr-tabletop .tabletop>.container{position:relative;z-index:2;pointer-events:none;background:transparent}
.native-dr-tabletop .tabletop .initiative-row{pointer-events:none;max-width:calc(100vw - min(430px,40vw) - 24px)}
.native-dr-tabletop .tabletop .initiative-row>*{pointer-events:auto}
.native-dr-tabletop .tabletop .initiative-row>.v-btn{background:#303030;color:#eee!important;box-shadow:0 2px 8px #0003}
.native-dr-tabletop .tabletop .initiative-row>.v-btn .v-icon{color:#eee!important}
.native-dr-tabletop .tabletop>.container>.d-flex.align-stretch{position:fixed;right:0;top:0;bottom:0;width:min(430px,40vw);z-index:4;pointer-events:none;max-height:none!important;margin-top:0!important}
.native-dr-tabletop .tabletop>.container>.d-flex.align-stretch>.pl-4{pointer-events:auto;background:#303030;color:#eee;border-radius:0;box-shadow:-4px 0 20px #0003;padding:8px!important;align-self:stretch;flex:1;min-height:0;height:100%;max-height:100%}
.native-dr-tabletop .tabletop>.container>.d-flex.align-stretch>.pl-4 .stream-entry{background:#383838}
.native-dr-tabletop .tabletop>.container>.d-flex.align-stretch>.pl-4 .theme--light,.native-dr-tabletop .tabletop>.container>.d-flex.align-stretch>.pl-4 .v-list-item__title,.native-dr-tabletop .tabletop>.container>.d-flex.align-stretch>.pl-4 .v-list-item__subtitle{color:#eee!important}
.native-dr-tabletop .tabletop .v-footer{z-index:3;left:12px!important;right:calc(min(430px,40vw) + 12px)!important;bottom:12px!important;pointer-events:none}
.native-dr-tabletop .tabletop .selected-creature-bar{pointer-events:auto;filter:drop-shadow(0 3px 8px #0004)}
.native-dr-tabletop .native-kanka-map-link{position:absolute;top:185px;left:12px;z-index:2;background:#fff;padding:3px 7px;border-radius:4px;font:12px sans-serif}
`;document.head.append(s);}
  frame=document.createElement('iframe');frame.id='native-dr-map';frame.title='Renovar — Dungeon Revealer map';Object.assign(frame.style,{width:'100%',height:'100%',border:'0'});frame.src=config.url;frame.onload=initialize;area.append(frame);
  const link=document.createElement('a');link.className='native-kanka-map-link';link.href=config.kanka.questUrl;link.textContent='Kanka quest';link.target='_blank';link.rel='noopener';area.append(link);
 }finally{busy=false;}}
 setInterval(()=>attach().catch(()=>{}),500);
})();
