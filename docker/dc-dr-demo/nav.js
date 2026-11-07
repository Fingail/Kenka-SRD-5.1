// SPDX-License-Identifier: GPL-3.0-only
// Link the native DiceCloud tabletop entry to its integrated map view.
(() => {
 let roomId=null,lastPath='';
 async function check(){const path=location.pathname;if(path===lastPath&&roomId)return;lastPath=path;const token=localStorage.getItem('Meteor.loginToken');if(!token)return;try{if(!roomId){const r=await fetch('/dc-dr/api/location',{headers:{Authorization:'Bearer '+token}});if(!r.ok)return;roomId=(await r.json()).tabletopId;}if(path==='/tabletop/'+roomId)location.replace('/dc-dr/');if(!document.getElementById('dc-dr-launch')){const a=document.createElement('a');a.id='dc-dr-launch';a.href='/dc-dr/';a.textContent='DC × DR encounter';Object.assign(a.style,{position:'fixed',bottom:'12px',left:'12px',zIndex:5000,background:'#173252',color:'#fff',padding:'7px 10px',borderRadius:'6px',font:'13px system-ui'});document.body.append(a);}}catch{}}
 setInterval(check,500);check();
})();
