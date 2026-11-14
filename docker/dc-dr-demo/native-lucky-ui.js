// SPDX-License-Identifier: GPL-3.0-only
// One server-owned choice, mirrored to the eligible PC and GM, before posting.
(()=>{
 const dialogs=new Map(),completed=new Map(),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const el=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 const api=(op,input)=>window.diceLuckyApi(op,input);
 function finish(entry,prompt){entry.prompt=prompt;entry.finished=true;clearInterval(entry.poll);clearInterval(entry.clock);if(entry.dialog.open)entry.dialog.close();entry.dialog.remove();}
 async function choose(entry,op,input={}){if(entry.finished||entry.busy)return;entry.busy=true;try{update(entry,(await api(op,{promptId:entry.id,...input})).prompt);}catch(error){entry.error.textContent=error.message;}finally{entry.busy=false;}}
 function button(entry,label,op,input){const b=el('button',label);b.type='button';b.onclick=()=>choose(entry,op,input);return b;}
 function update(entry,prompt){
  entry.prompt=prompt;entry.skew=prompt.serverTime-Date.now();if(prompt.status!=='pending'){finish(entry,prompt);return;}
  const signature=JSON.stringify([prompt.original,prompt.context,prompt.candidates,prompt.spent]);if(signature===entry.signature)return;entry.signature=signature;entry.body.replaceChildren();
  const title=prompt.kind==='attack'?'Attack':prompt.kind==='save'?'Saving throw':'Ability check',modifier=prompt.context.modifier||0;entry.body.append(el('p',title+' · '+prompt.actorName+' · Original d20: '+prompt.original[0].join(', ')+' · Modifier '+(modifier>=0?'+':'')+modifier+(Number.isFinite(prompt.context.dc)?' · DC '+prompt.context.dc:'')));
  if(prompt.spent){entry.body.append(el('p','Additional d20: '+prompt.spent.extra+' · One use has been spent.'));for(const[choice,value]of [...prompt.spent.original[0],prompt.spent.extra].entries())entry.body.append(button(entry,(choice===prompt.spent.original[0].length?'Use new':'Keep original')+' d20 '+value,'lucky-prompt-choice',{choice}));}
  else{entry.body.append(button(entry,'Keep roll','lucky-prompt-keep'));for(const source of prompt.candidates)entry.body.append(button(entry,'Reroll — '+source.actorName+' · '+source.name+' ('+source.remaining+')','lucky-prompt-spend',{resourceId:source.id}));}
 }
 function show(prompt){
  if(!prompt?.canDecide)return;let entry=dialogs.get(prompt.id);if(entry){if(!entry.finished)update(entry,prompt);return;}
  if(prompt.status!=='pending')return;
  const d=el('dialog');d.className='dice-combat-dialog dice-shared-lucky';d.setAttribute('aria-label','Roll preview — Lucky');d.dataset.promptId=prompt.id;const header=el('header'),title=el('strong','Roll preview — Lucky'),close=el('button','×');close.type='button';close.setAttribute('aria-label','Keep original and close Lucky');header.append(title,close);const body=el('section'),countdown=el('p'),error=el('p');countdown.setAttribute('aria-live','polite');error.setAttribute('role','status');d.append(header,body,countdown,el('p','Player and GM share this choice. First confirmation applies. Timeout keeps the original roll; a requested reroll still costs one use.'),error);document.body.append(d);entry={id:prompt.id,dialog:d,body,countdown,error,prompt,busy:false,finished:false};dialogs.set(prompt.id,entry);
  close.onclick=()=>choose(entry,'lucky-prompt-keep');d.addEventListener('cancel',event=>{event.preventDefault();choose(entry,'lucky-prompt-keep');});
  entry.clock=setInterval(()=>{if(entry.finished)return;const remaining=Math.max(0,Math.ceil((entry.prompt.deadline-Date.now()-(entry.skew||0))/1000));entry.countdown.textContent=remaining+'s remaining';},200);
  let polling=false;entry.poll=setInterval(async()=>{if(polling||entry.busy||entry.finished)return;polling=true;try{update(entry,(await api('lucky-prompt-state',{promptId:entry.id})).prompt);}catch(e){entry.error.textContent=e.message;}finally{polling=false;}},450);
  update(entry,prompt);d.showModal();
 }
 window.diceRenderLuckyPrompts=prompts=>{for(const prompt of prompts)show(prompt);};
 window.diceSharedLuckyPreview=async data=>{
  const {actionId,dice,raw,context,index}=data;if(!document.body.classList.contains('native-dr-tabletop')||!['attack','check','save'].includes(context?.kind)||dice.length!==1||dice[0].diceSize!==20)return raw;
  const key=actionId+':'+index;if(completed.has(key))return structuredClone(completed.get(key));
  const opened=await api('lucky-open',{actionId,index,decisions:structuredClone(data.decisions||[])});if(!opened.prompt)return raw;const id=opened.prompt.id;show(opened.prompt);
  for(;;){
   if(!document.body.classList.contains('native-dr-tabletop')||data.requiresDialog&&!window.diceLuckyDialogPresent(actionId)){await api('lucky-prompt-cancel',{promptId:id}).catch(()=>{});throw Error('The action was cancelled before its Lucky choice.');}
   const prompt=(await api('lucky-prompt-state',{promptId:id})).prompt;show(prompt);
   if(prompt.status==='selected'){completed.set(key,prompt.dice);if(completed.size>500)completed.delete(completed.keys().next().value);return structuredClone(prompt.dice);}
   if(prompt.status==='cancelled')throw Error('This Lucky roll was cancelled.');await sleep(450);
  }
 };
 const style=el('style');style.textContent='.dice-shared-lucky{max-width:min(520px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto;background:#303030;color:#eee;font:12px/1.4 system-ui}.dice-shared-lucky>header{display:flex;justify-content:space-between;align-items:center;gap:10px}.dice-shared-lucky button{background:#414141;color:#eee;border:1px solid #777;border-radius:4px;padding:5px 8px;margin:3px;font:inherit;cursor:pointer}.dice-shared-lucky section p{margin:9px 0}.dice-shared-lucky [role=status]{color:#f1a29a}';document.head.append(style);
})();
