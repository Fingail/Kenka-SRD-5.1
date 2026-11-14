// SPDX-License-Identifier: GPL-3.0-only
// Shared descriptions sit under the action heading; native result rows remain intact.
(()=>{
 function tokens(row,content,visible,names,hidden){
  const groups=window.diceLogLayout.groups(visible),shared=new Set(window.diceLogLayout.sharedDetails(visible));
  names.forEach((name,i)=>name.parentElement.classList.toggle('dice-log-shared-detail',shared.has(i)));
  for(const[index,group]of [...content.children].entries()){
   const indexes=groups[index]?.indexes||[],empty=indexes.length>0&&indexes.every(i=>hidden.has(i));group.classList.toggle('dice-log-empty-group',empty);
   const result=indexes.find(i=>!hidden.has(i)&&!shared.has(i)),hideTokens=empty||result===undefined;
   group.classList.toggle('dice-log-shared-only',hideTokens);
   for(const avatar of group.querySelectorAll('.content-target-ids .v-avatar'))avatar.classList.toggle('dice-log-repeated-target',hideTokens);
   // When a shared damage roll and an individual result share a native group,
   // align its one portrait with the individual result, below the shared roll.
   const right=group.querySelector('.content-target-ids');if(right){right.style.alignSelf='flex-start';right.style.paddingTop=result===undefined?'':Math.max(0,(names[result]?.parentElement.getBoundingClientRect().top||group.getBoundingClientRect().top)-group.getBoundingClientRect().top)+'px';}
  }
 }
 function format(){
  const cs=window.Meteor?.connection?._mongo_livedata_collections;if(!cs?.creatureProperties)return;
  const sources=new Map();
  for(const row of document.querySelectorAll('.stream-entry')){
   const vm=row.__vue__,model=vm?.model||cs.creatureLogs?.findOne({actionId:row.dataset.id}),content=row.querySelector('.log-content');if(!model?.content||!content)continue;
   if(!sources.has(model.creatureId))sources.set(model.creatureId,cs.creatureProperties.find({'root.id':model.creatureId,removed:{$ne:true}}).fetch());
   const plan=window.diceLogLayout.layout(model.content,sources.get(model.creatureId),!!vm?.showSilenced),names=[...content.querySelectorAll('.content-name')];let summary=row.querySelector(':scope>.dice-log-shared-description');
   row.classList.toggle('dice-log-condensed',!!plan);if(!plan){summary?.remove();for(const name of names)name.parentElement.classList.remove('dice-log-description-duplicate');for(const group of content.children)group.classList.remove('dice-log-empty-group');tokens(row,content,model.content.filter(c=>vm?.showSilenced||!c.silenced),names,new Set());continue;}
   const hidden=new Set(plan.hidden),source=plan.descriptionIndex===null?null:names[plan.descriptionIndex]?.parentElement.querySelector('.content-value'),signature=JSON.stringify([plan.title,plan.description,source?.innerHTML]);
   if(!summary){summary=document.createElement('section');summary.className='dice-log-shared-description';content.before(summary);}
   if(summary.dataset.signature!==signature){summary.dataset.signature=signature;summary.replaceChildren();const title=document.createElement('strong'),body=document.createElement('div');title.className='dice-log-action-title';title.textContent=plan.title;body.className='dice-log-action-description';if(source)for(const child of source.childNodes)body.append(child.cloneNode(true));else body.textContent=plan.description;summary.append(title,body);}
   names.forEach((name,i)=>name.parentElement.classList.toggle('dice-log-description-duplicate',hidden.has(i)));
   tokens(row,content,plan.visible,names,hidden);
  }
 }
 const style=document.createElement('style');style.textContent='.native-dr-tabletop .stream-entry .dice-log-shared-detail{width:100%}'+'.native-dr-tabletop .stream-entry .dice-log-shared-only>.content-target-ids{display:none!important}.native-dr-tabletop .stream-entry .dice-log-shared-only>.d-flex.flex-wrap{max-width:100%}'+'.dice-log-description-duplicate,.dice-log-empty-group,.dice-log-repeated-target{display:none!important}.dice-log-shared-description{margin:2px 8px 10px 8px;min-width:0;max-width:calc(100% - 16px);color:inherit;font:12px/1.4 system-ui}.dice-log-action-title{display:block;margin-bottom:5px;font-size:13px}.dice-log-action-description{white-space:pre-wrap;overflow-wrap:anywhere}.dice-log-action-description p:last-child{margin-bottom:0}.native-dr-tabletop .stream-entry .log-content>.d-flex{min-width:0;max-width:100%}.native-dr-tabletop .stream-entry .log-content>.d-flex>.d-flex.flex-wrap{flex:1 1 0;min-width:0;max-width:calc(100% - 44px)}.native-dr-tabletop .stream-entry .log-content .content-target-ids{flex:0 0 44px;min-width:44px;max-width:44px;align-items:center}.native-dr-tabletop .stream-entry .log-content .full-width{min-width:0;max-width:100%;overflow-wrap:anywhere}.native-dr-tabletop .stream-entry .log-content .content-value{max-width:100%;overflow-wrap:anywhere}.native-dr-tabletop .stream-entry .log-content pre{max-width:100%;overflow-x:auto}';document.head.append(style);
 window.diceFormatBattleLogs=format;
})();
