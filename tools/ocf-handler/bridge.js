(() => {
  const style = document.createElement('style');
  style.textContent = `
    .ocf-token-button,.ocf-button{background:#243c65;color:#fff;border:1px solid #7b91b8;border-radius:6px;padding:8px 12px;cursor:pointer;font:14px system-ui}
    .ocf-token-button{width:100%;margin-bottom:8px}.ocf-button:disabled{opacity:.5;cursor:wait}
    .ocf-tools{position:fixed;left:80px;max-width:calc(100vw - 96px);z-index:1000;display:flex;gap:8px;flex-wrap:wrap}.ocf-top-tools{top:12px}.ocf-bottom-tools{bottom:12px;flex-direction:column;align-items:flex-start}
    .ocf-dialog{background:#172235;color:#f3f4f6;border:1px solid #63779c;border-radius:12px;padding:20px;width:430px;max-width:90vw;max-height:85vh;overflow:auto;font:14px/1.5 system-ui;box-shadow:0 8px 50px #0008}
    .ocf-dialog::backdrop{background:#0005}.ocf-dialog h2{font-size:22px;margin:0}.ocf-dialog h3{font-size:16px;margin:18px 0 8px}
    .ocf-combat-panel{position:fixed;right:12px;top:12px;bottom:12px;width:430px;max-width:calc(100vw - 24px);z-index:1500;background:#172235;color:#f3f4f6;border:1px solid #63779c;border-radius:12px;box-shadow:-8px 0 30px #0005;display:flex;flex-direction:column;overflow:hidden;font:14px/1.5 system-ui}.ocf-combat-panel[hidden]{display:none}.ocf-combat-header{display:flex;gap:8px;align-items:center;padding:10px 12px;border-bottom:1px solid #53617c}.ocf-combat-header h2{font-size:16px;margin:0;flex:1}.ocf-panel-chevron{flex:none;background:transparent;color:inherit;border:0;width:26px;height:26px;padding:0;display:grid;place-items:center;cursor:pointer}.ocf-panel-chevron:disabled{opacity:.4;cursor:default}.ocf-panel-chevron svg{width:18px;height:18px}.ocf-panel-chevron[hidden]{display:none} .ocf-combat-log{min-height:0;overflow:auto;padding:0 12px 8px;flex:1}.ocf-log-window{display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden}.ocf-log-header{display:flex;align-items:center;gap:8px;padding:8px 12px;border-top:1px solid #53617c}.ocf-log-header h3{flex:1;margin:0;font-size:14px}.ocf-log-header[hidden]{display:none}.ocf-sheet-host{flex:1;min-height:0;overflow:auto}.ocf-combat-panel[data-sheet="detached"] .ocf-sheet-host,.ocf-combat-panel[data-sheet="none"] .ocf-sheet-host{display:none}.ocf-combat-panel[data-collapsed="true"]{top:auto;bottom:12px}.ocf-combat-panel[data-collapsed="true"]>.ocf-sheet-host,.ocf-combat-panel[data-collapsed="true"]>.ocf-log-window{display:none}.ocf-combat-panel[data-log="detached"][data-sheet="detached"],.ocf-combat-panel[data-log="detached"][data-sheet="none"]{top:auto}.ocf-log-detached{position:fixed;box-sizing:border-box;right:460px;top:12px;width:430px;height:calc(100vh - 24px);max-width:calc(100vw - 24px);min-width:280px;min-height:180px;resize:both;z-index:1600;background:#172235;color:#f3f4f6;border:1px solid #63779c;border-radius:12px;box-shadow:0 8px 50px #0008;font:14px/1.5 system-ui}.ocf-log-detached .ocf-log-header{cursor:move;touch-action:none}

    .ocf-sheet{position:relative;box-sizing:border-box;width:100%;background:#172235;color:#f3f4f6;padding:16px;font:14px/1.5 system-ui}.ocf-sheet-header{display:flex;align-items:center;gap:8px;position:sticky;top:0;background:#172235;z-index:2;padding:8px 0;touch-action:none}.ocf-sheet-header h2{flex:1}.ocf-sheet-header .ocf-close{float:none}.ocf-sheet-detached{position:fixed;width:430px;max-width:calc(100vw - 24px);min-width:280px;min-height:200px;border:1px solid #63779c;border-radius:12px;box-shadow:0 8px 50px #0008;z-index:1600;overflow:auto;resize:both}.ocf-sheet-detached .ocf-sheet-header{cursor:move}
    .ocf-sheet h2{font-size:22px;margin:0}.ocf-sheet h3{font-size:16px;margin:18px 0 8px}.ocf-sheet a{color:#9fc5ff}.ocf-steps{padding-left:22px}.ocf-steps li{margin:12px 0}.ocf-flow{margin:16px 0;border:1px solid #839abf;border-radius:8px;padding:12px;background:#1f304b}.ocf-pending{background:#835d16}.ocf-good{color:#b2eabd}
    .ocf-sheet input,.ocf-sheet textarea,.ocf-sheet select,.ocf-dialog input,.ocf-dialog textarea,.ocf-dialog select,.ocf-launcher input{color:#172235!important;background:#fff!important;-webkit-text-fill-color:#172235;caret-color:#172235}
    .ocf-health-green{color:#a7efb0}.ocf-health-yellow{color:#ffe08a}.ocf-health-red{color:#ffaaaa}
    .ocf-flow[data-health="green"]{border-color:#69ca7a}.ocf-flow[data-health="yellow"]{border-color:#edc153}.ocf-flow[data-health="red"]{border-color:#ed7b7b}
    .ocf-turnorder{position:relative;width:330px;max-width:calc(100vw - 100px);box-sizing:border-box;padding:12px;background:#172235;color:#f3f4f6;border:1px solid #839abf;border-radius:8px;font:14px/1.4 system-ui}.ocf-turnorder-body{max-height:45vh;overflow:auto}.ocf-turnorder h3{margin:0 0 8px}.ocf-current-turn{background:#28513c;border-left:4px solid #9becad;padding:6px}.ocf-turnorder ol{padding-left:24px}.ocf-turnorder li{margin:6px 0}
    .ocf-turn-header{position:relative;display:flex;align-items:center;min-height:24px;padding-right:28px}.ocf-turn-header h3{margin:0}.ocf-chevron{position:absolute;right:0;top:0;width:24px;height:24px;padding:0;border:0;background:transparent;color:#f3f4f6;cursor:pointer;display:grid;place-items:center}.ocf-chevron svg{width:16px;height:16px}.ocf-turn-name{background:transparent;border:0;color:inherit;font:inherit;text-align:left;padding:0;cursor:pointer;text-decoration:underline;text-underline-offset:3px}.ocf-turnorder[data-collapsed="true"] .ocf-turnorder-body{display:none}.ocf-turnorder-body{margin-top:8px}
    .ocf-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0}.ocf-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.ocf-card{background:#233149;border-radius:6px;padding:9px}
    .ocf-muted{color:#b8c5dc}.ocf-error{color:#ffc4c4}.ocf-close{float:right}.ocf-dialog a{color:#9fc5ff}.ocf-log{border-top:1px solid #53617c;padding:8px 0}.ocf-small{font-size:12px}
    .ocf-log.ocf-combat-event{padding:12px;margin:10px 0;background:#1e2d43;border:1px solid #53617c;border-left:4px solid #84a5d7;border-radius:8px}.ocf-combat-event[data-health="green"]{border-left-color:#69ca7a}.ocf-combat-event[data-health="yellow"]{border-left-color:#edc153}.ocf-combat-event[data-health="red"]{border-left-color:#ed7b7b}.ocf-event-title{display:block;margin-bottom:8px}.ocf-damage{font-weight:700}.ocf-health-chip{display:inline-block;padding:3px 7px;margin:4px 4px 4px 0;border:1px solid currentColor;border-radius:6px;font-size:12px;background:#172235}.ocf-combat-target{margin-top:8px;padding-top:6px;border-top:1px solid #53617c}.ocf-combat-event p{margin:5px 0}
    .ocf-effect-badge{display:inline-block;color:#e4c7ff;border:1px solid #b486df;border-radius:6px;padding:3px 7px;margin:4px;background:#322344;font-size:12px}.ocf-active-effects .ocf-card{margin:8px 0}.ocf-active-effects h3{margin-top:12px}
    .ocf-dice-line{display:flex;flex-wrap:wrap;gap:4px;align-items:center}.ocf-dice-badge{display:inline-block;min-width:20px;padding:2px 6px;border:1px solid #8296b6;border-radius:5px;background:#293b55;color:#f3f4f6;font:600 12px/1.5 system-ui;text-align:center;font-variant-numeric:tabular-nums}.ocf-dice-total{margin-left:3px;border-width:2px}.ocf-natural-one{background:#7f1d1d;border-color:#f87171;color:#fee2e2}.ocf-natural-twenty{background:#14532d;border-color:#4ade80;color:#dcfce7}.ocf-die-discarded{opacity:.5;text-decoration:line-through}
    .ocf-launcher{font:16px/1.5 system-ui;max-width:850px;margin:40px auto;padding:24px;color:#18243a}.ocf-launcher input{padding:10px;width:100%;box-sizing:border-box;margin:5px 0 15px}.ocf-launcher label{display:block;font-weight:600}.ocf-launcher .ocf-card{background:#edf2f9}.ocf-launcher .ocf-error{color:#9b1528}
  `;
  document.head.append(style);
  const element = (tag, text, className) => {
    const node = document.createElement(tag); if (text !== undefined) node.textContent = text;
    if (className) node.className = className; return node;
  };
  const button = (text, run) => { const node = element('button', text, 'ocf-button'); node.type = 'button'; node.onclick = run; return node; };
  const attackTitle = name => { const type = name.replace(/\s*\([^)]*\)\s*$/, '').trim(); return /\battack$/i.test(type) ? type : type + ' Attack'; };
  const isGM = () => location.pathname.startsWith('/dm') || location.pathname.startsWith('/ocf-api/ui');
  async function api(path, options = {}) {
    let secret;
    try { secret = JSON.parse(localStorage.getItem(isGM() ? 'dmPassword' : 'pcPassword') || '""'); } catch { secret = ''; }
    const response = await fetch('/ocf-api' + path, { ...options, headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' }, cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'OCF request failed.');
    if(data.approval_required)return waitForRollApproval(data.approval);
    return data;
  }
  function dialog(title) {
    const node = element('dialog', undefined, 'ocf-dialog'); node.setAttribute('aria-label', title);
    const close = button('Close', () => node.close()); close.classList.add('ocf-close');
    node.append(close, element('h2', title)); document.body.append(node); node.showModal();
    node.addEventListener('close', () => node.remove()); return node;
  }
  const waitingRolls=new Map();
  async function waitForRollApproval(initial) {
    if(waitingRolls.has(initial.id))return waitingRolls.get(initial.id);
    const wait=(async()=>{
      let record=initial,node=null,finished=false;
      if(record.status==='pending') {
        node=dialog('DM approval required');
        node.append(element('p',`${record.name}: ${record.label}${record.target_name?' → '+record.target_name:''}`),element('p','Out of turn. Waiting for the DM; no dice or HP changes yet.','ocf-muted'));
        const cancel=node.querySelector('button');cancel.textContent='Cancel request';
        cancel.onclick=async()=>{cancel.disabled=true;try{record=await api('/roll-approvals/'+record.id+'/decision',{method:'POST',body:JSON.stringify({decision:'cancel'})});}catch(error){cancel.disabled=false;node.append(element('p',error.message,'ocf-error'));}};
        node.addEventListener('cancel',event=>{if(!finished){event.preventDefault();cancel.click();}});
      }
      try {
        while(record.status==='pending') {
          await new Promise(resolve=>setTimeout(resolve,750));
          record=await api('/roll-approvals/'+record.id);
        }
        if(record.status!=='approved')throw new Error(record.reason||'The roll request was not approved.');
        return record.result;
      }finally{finished=true;node?.close();}
    })();
    waitingRolls.set(initial.id,wait);try{return await wait;}finally{waitingRolls.delete(initial.id);}
  }
  function installRollApprovalControls(tools) {
    if(!isGM())return;
    let requests=[],review=null,signature='',refreshing=false;
    const seen=new Set();const trigger=button('Roll requests (0)',()=>{review?.close();review=dialog('Out-of-turn roll requests');render();});tools.append(trigger);
    function render() {
      if(!review?.isConnected)return;
      review.querySelector('[data-ocf-requests]')?.remove();const content=element('div');content.dataset.ocfRequests='true';review.append(content);
      if(!requests.length){content.append(element('p','No pending requests.'));return;}
      for(const request of requests) {
        const card=element('section',undefined,'ocf-card');card.dataset.request=request.id;
        card.append(element('h3',request.name+' — '+request.label),element('p',request.target_name?'Target: '+request.target_name:'Out-of-turn roll. No dice have been rolled.'));
        for(const [decision,label]of [['approve','Approve roll'],['reject','Reject roll']])card.append(button(label,async()=>{
          card.querySelectorAll('button').forEach(b=>b.disabled=true);
          try{const result=await api('/roll-approvals/'+request.id+'/decision',{method:'POST',body:JSON.stringify({decision})});if(result.status==='failed')card.append(element('p',result.reason,'ocf-error'));await refresh();await refreshCombatLog();}
          catch(error){card.append(element('p',error.message,'ocf-error'));card.querySelectorAll('button').forEach(b=>b.disabled=false);}
        }));content.append(card);
      }
    }
    async function refresh() {
      if(refreshing)return;refreshing=true;
      try{
        const rows=await api('/roll-approvals'),next=JSON.stringify(rows);trigger.textContent='Roll requests ('+rows.length+')';
        const unseen=rows.some(row=>!seen.has(row.id));rows.forEach(row=>seen.add(row.id));requests=rows;
        if(unseen&&!review?.isConnected){review=dialog('Out-of-turn roll requests');}
        if(next!==signature){signature=next;render();if(!rows.length)review?.close();}
      }catch{/* Preserve pending requests while reconnecting. */}finally{refreshing=false;}
    }
    refresh();setInterval(refresh,1500);
  }
  function effectEditor(parent,label,initial=null) {
    const name=element('input');name.setAttribute('aria-label',label);name.maxLength=100;name.value=initial?.name||'';
    const choices=element('datalist');choices.id='ocf-effects-'+crypto.randomUUID();
    for(const text of ['Weakening Breath','Blinded','Charmed','Deafened','Frightened','Grappled','Incapacitated','Invisible','Paralyzed','Petrified','Poisoned','Prone','Restrained','Stunned','Unconscious','Exhaustion']){const option=element('option');option.value=text;choices.append(option);}name.setAttribute('list',choices.id);
    const notes=element('textarea');notes.setAttribute('aria-label','Effect notes');notes.maxLength=1000;notes.value=initial?.notes||'';
    const duration=element('input');duration.setAttribute('aria-label','Effect duration');duration.maxLength=160;duration.value=initial?.duration||'';
    for(const [title,control]of [[label,name],['Effect notes',notes],['Effect duration',duration]]){const row=element('label',title,'ocf-row');row.append(control);parent.append(row);}parent.append(choices);
    const enabled=element('input');enabled.type='checkbox';enabled.checked=!!initial?.save_rule;enabled.setAttribute('aria-label','Configure saving throw');const toggle=element('label','Configure saving throw','ocf-row');toggle.prepend(enabled);parent.append(toggle);
    const saveFields=element('div');saveFields.hidden=!enabled.checked;parent.append(saveFields);enabled.onchange=()=>saveFields.hidden=!enabled.checked;
    const ability=element('select');ability.setAttribute('aria-label','Effect save ability');for(const key of ['str','dex','con','int','wis','cha']){const option=element('option',key.toUpperCase());option.value=key;ability.append(option);}ability.value=initial?.save_rule?.ability||'con';
    const dc=element('input');dc.type='number';dc.min=1;dc.max=100;dc.value=initial?.save_rule?.dc||10;dc.setAttribute('aria-label','Effect save DC');
    const timing=element('select');timing.setAttribute('aria-label','Effect save timing');for(const [value,text]of [['manual','When requested'],['start','Start of turn'],['end','End of turn']]){const option=element('option',text);option.value=value;timing.append(option);}timing.value=initial?.save_rule?.timing||'manual';
    const mode=element('select');mode.setAttribute('aria-label','Effect save mode');for(const value of ['normal','advantage','disadvantage']){const option=element('option',value);option.value=value;mode.append(option);}mode.value=initial?.save_rule?.mode||'normal';
    const ends=element('input');ends.type='checkbox';ends.checked=initial?.save_rule?.ends_on_success===true;ends.setAttribute('aria-label','End effect on successful save');
    for(const [title,control]of [['Save ability',ability],['Save DC',dc],['Save timing',timing],['Save mode',mode],['End effect on successful save',ends]]){const row=element('label',title,'ocf-row');row.append(control);saveFields.append(row);}
    name.addEventListener('input',()=>{if(initial?.name&&name.value!==initial.name&&notes.value===initial.notes){notes.value='';duration.value='';enabled.checked=false;saveFields.hidden=true;}});
    return ()=>name.value.trim()?{name:name.value.trim(),notes:notes.value,duration:duration.value,...(enabled.checked?{save_rule:{ability:ability.value,dc:Number(dc.value),timing:timing.value,mode:mode.value,ends_on_success:ends.checked}}:{})}:null;
  }

  function diceLine(label,roll,suffix='',allowNatural=true) {
    const line=element('p',undefined,'ocf-small ocf-dice-line');
    line.append(document.createTextNode(label+': '+(roll.formula||'')+(roll.mode&&roll.mode!=='normal'?' · '+roll.mode:'')+' '));
    if(roll.automatic_failure){line.append(element('span','Automatic failure','ocf-dice-badge ocf-natural-one'));return line;}
    const dice=roll.dice||[],d20=allowNatural&&!roll.damage_type&&/^\s*\d*d20\b/i.test(roll.formula||'');
    const natural=d20?(roll.natural??(roll.mode==='advantage'?Math.max(...dice):roll.mode==='disadvantage'?Math.min(...dice):dice[0])):null;
    const kept=d20&&['advantage','disadvantage'].includes(roll.mode)?dice.indexOf(natural):-1;
    const tone=value=>d20&&value===1?' ocf-natural-one':d20&&value===20?' ocf-natural-twenty':'';
    dice.forEach((value,index)=>{const badge=element('span',String(value),'ocf-dice-badge'+tone(value)+(kept>=0&&index!==kept?' ocf-die-discarded':''));badge.dataset.testid='rolled-die';badge.setAttribute('aria-label',`${d20?'d20':'Die'}: ${value}${kept>=0&&index!==kept?' (discarded)':''}`);badge.title=badge.getAttribute('aria-label');line.append(badge);});
    if(Number.isFinite(roll.total)){const total=element('span','Total '+roll.total,'ocf-dice-badge ocf-dice-total'+tone(natural));total.dataset.testid='roll-total';total.setAttribute('aria-label',`Total: ${roll.total}${d20?', natural '+natural:''}`);line.append(total);}
    if(suffix)line.append(document.createTextNode(' · '+suffix));return line;
  }
  function renderCombatEvent(roll) {
    const card=element('article',undefined,'ocf-log ocf-combat-event');card.dataset.logId=roll.id;
    const bands=roll.targets.map(t=>t.after_health?.band||t.health?.band).filter(Boolean);
    const band=bands.includes('red')?'red':bands.includes('yellow')?'yellow':bands.includes('green')?'green':null;
    if(band)card.dataset.health=band;
    card.append(element('strong',`${roll.attacker.name} → ${roll.targets.map(t=>t.name).join(', ')} · ${roll.action_name}`,'ocf-event-title'));
    if(roll.attack)card.append(diceLine('Attack roll',roll.attack,roll.hit?(roll.critical?'Critical hit':'Hit'):'Miss'));
    for(const damage of roll.damage)card.append(diceLine('Damage roll',damage,damage.damage_type,false));
    for(const effect of roll.attacker.conditions||[])card.append(element('span',effect.name,'ocf-effect-badge'));
    const types=[...new Set(roll.damage.map(d=>d.damage_type))].join(' + ');
    for(const target of roll.targets) {
      const row=element('section',undefined,'ocf-combat-target');row.dataset.combatTarget=target.token_id;row.append(element('strong',target.name));
      if(target.save)row.append(diceLine('Saving throw',target.save,target.save_success?'Success':'Failure'));
      const color=target.after_health?.band||target.health?.band;
      const damage=element('p',roll.event_type==='attack'&&!roll.hit?'No damage: miss.':target.hp_applied?`Total damage: ${target.damage_total}${types?' '+types:''} applied`:'Effect / HP resolved manually','ocf-damage'+(color?' ocf-health-'+color:''));damage.dataset.testid='combat-log-damage';row.append(damage);
      if(target.gm_hp)row.append(element('div',`HP: ${target.gm_hp.before} → ${target.gm_hp.after}`,'ocf-small'));
      if(target.after_health)row.append(element('div','Health after action: '+target.after_health.label,'ocf-small ocf-health-'+target.after_health.band));
      if(target.outcome_notice)row.append(element('div',target.outcome_notice,'ocf-small'));
      for(const effect of target.effects_applied||[])row.append(element('div','Effect applied: '+effect.name+(effect.duration?' · '+effect.duration:''),'ocf-effect-badge'));
      for(const effect of target.conditions||[])row.append(element('span',effect.name,'ocf-effect-badge'));card.append(row);
    }
    return card;
  }
  function renderHistory(container, rows) {
    container.replaceChildren();
    if (!rows.length) container.append(element('p', 'No managed rolls yet.', 'ocf-muted'));
    for (const roll of rows) {
      if(roll.kind==='combat_event'){container.append(renderCombatEvent(roll));continue;}
      const card = element('div', undefined, 'ocf-log');
      card.append(element('strong',`${roll.kind==='combat_update'?roll.label:roll.name+': '+roll.label}`));
      if(roll.kind==='combat_update')card.append(element('div',roll.formula==='Automatic attack'||roll.formula==='Automatic NPC attack'?'Applied automatically':roll.formula==='Advanced action'?'Resolved by GM':'Confirmed by GM','ocf-small ocf-muted'));
      else card.append(diceLine('Roll',roll,`${roll.actor}${roll.visibility==='gm'?' · GM only':''}`));
      if (roll.health) card.classList.add('ocf-health-' + roll.health.band);
      if (roll.outcome_notice) card.append(element('div', roll.outcome_notice, 'ocf-small'));
      container.append(card);
    }
  }
  let refreshInitiative = async () => {}, endSheetTurn = async () => {};
  let initiativeStates = [],movementReady=false,movementTokens={},tokenEffects={},tokenHealth={},movementSignature='';
  window.ocfTokenHealth=id=>tokenHealth[id]||null;
  window.ocfTokenHealthStyle=id=>({green:{background:'#166534',color:'#ffffff'},yellow:{background:'#facc15',color:'#172235'},red:{background:'#b42336',color:'#ffffff'}})[tokenHealth[id]?.band]||{background:'#ffffff',color:'#172235'};
  window.ocfEffectStyle=name=>{
    const value=String(name).toLowerCase();
    if(/poison/.test(value))return {background:'#365314',color:'#ecfccb'};
    if(/paraly|petrif|stun|incapacitat|unconscious/.test(value))return {background:'#7f1d1d',color:'#fee2e2'};
    if(/grappl|restrain|prone|exhaust/.test(value))return {background:'#78350f',color:'#fef3c7'};
    if(/invisib/.test(value))return {background:'#164e63',color:'#cffafe'};
    return {background:'#4c1d95',color:'#ede9fe'};
  };
  window.ocfTokenHealthColor=id=>({green:'#166534',yellow:'#925f00',red:'#b42336'})[tokenHealth[id]?.band]||'#172235';
  window.ocfTokenEffects=id=>tokenEffects[id]||[];
  window.ocfCanMoveToken=id=>isGM()||(movementReady&&(movementTokens[id]??true));
  function updateSheetTurnButtons() {
    for(const control of document.querySelectorAll('[data-ocf-end-turn]')) {
      const id=control.dataset.ocfEndTurn;
      const state=initiativeStates.find(state=>state.status==='active'&&state.current_token_id===id);
      const entry=state?.entries.find(entry=>entry.token_id===id);
      control.disabled=!state||(!isGM()&&entry?.role!=='pc');
      control.title=control.disabled?'Available on this character’s active turn':'End this character’s turn';
    }
  }
  function sheetTurnButton(id) {
    const control=button('End turn',async()=>{control.disabled=true;await endSheetTurn(id);updateSheetTurnButtons();});
    control.dataset.ocfEndTurn=id;return control;
  }
  let activeSheet = null, activeFlow = null, activeTokenId = null, sheetTimer = null;
  let combatPanel = null, combatLog = null, sheetHost = null, popoutButton = null, activeEncounterId = null, sheetDetached = false, floatingLayout = null, logSignature = '';
  let logWindow = null, logHeader = null, logDetached = false, logPopoutButton = null;
  function panelChevron(direction, label, run) {
    const control = button('', run); control.className='ocf-panel-chevron'; control.setAttribute('aria-label',label); control.title=label;
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 18 18');svg.setAttribute('aria-hidden','true');
    const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',({right:'M6 3L12 9L6 15',left:'M12 3L6 9L12 15',down:'M3 6L9 12L15 6',up:'M3 12L9 6L15 12'})[direction]);path.setAttribute('fill','none');path.setAttribute('stroke','currentColor');path.setAttribute('stroke-width','2');svg.append(path);control.append(svg);return control;
  }
  async function refreshCombatLog() {
    if (!combatLog) return; const scope=activeEncounterId;
    try { const rows=await api('/history'); if (scope===activeEncounterId) { const filtered=rows.filter(row=>!scope||row.encounter_id===scope), signature=JSON.stringify([scope,filtered]); if(signature!==logSignature){logSignature=signature;renderHistory(combatLog,filtered);} } } catch { /* Preserve the last authorized log while reconnecting. */ }
  }
  function setPanelCollapsed(collapsed) {
    combatPanel.dataset.collapsed=String(collapsed);
    const old=combatPanel.querySelector('.ocf-panel-collapse');
    const control=panelChevron(collapsed?'up':'down',collapsed?'Expand combat panel':'Minimize combat panel',()=>setPanelCollapsed(!collapsed));
    control.classList.add('ocf-panel-collapse');old.replaceWith(control);
  }
  function setLogDetached(detached) {
    logDetached=detached;combatPanel.dataset.log=detached?'detached':'docked';
    logWindow.classList.toggle('ocf-log-detached',detached);logHeader.hidden=!detached&&combatPanel.dataset.sheet!=='docked';
    logHeader.querySelector('button').hidden=!detached;logPopoutButton.disabled=detached;
    if(detached){document.body.append(logWindow);}else{logWindow.removeAttribute('style');combatPanel.append(logWindow);setPanelCollapsed(false);}
  }
  function ensureCombatPanel() {
    if (combatPanel) return;
    combatPanel=element('section',undefined,'ocf-combat-panel');combatPanel.setAttribute('aria-label','Combat log panel');combatPanel.dataset.sheet='none';combatPanel.dataset.log='docked';
    const header=element('header',undefined,'ocf-combat-header');header.append(element('h2','Combat log'),button('Characters',roster));
    popoutButton=panelChevron('left','Pop out character sheet',()=>setSheetDetached(true));popoutButton.disabled=true;
    logPopoutButton=panelChevron('left','Pop out combat log',()=>setLogDetached(true));
    const collapse=panelChevron('down','Minimize combat panel',()=>setPanelCollapsed(true));collapse.classList.add('ocf-panel-collapse');header.append(popoutButton,logPopoutButton,collapse);
    combatLog=element('div',undefined,'ocf-combat-log');combatLog.dataset.testid='shared-combat-log';combatLog.setAttribute('role','log');combatLog.setAttribute('aria-label','Shared combat log');
    logWindow=element('section',undefined,'ocf-log-window');logWindow.setAttribute('aria-label','Combat log window');
    logHeader=element('header',undefined,'ocf-log-header');logHeader.hidden=true;logHeader.append(element('h3','Shared combat log'),panelChevron('right','Reunite combat log',()=>setLogDetached(false)));logWindow.append(logHeader,combatLog);dragSheet(logHeader,logWindow,()=>logDetached);
    sheetHost=element('div',undefined,'ocf-sheet-host');combatPanel.append(header,sheetHost,logWindow);document.body.append(combatPanel);
    refreshCombatLog();setInterval(refreshCombatLog,1500);
  }
  function placeSheet() {
    if (!activeSheet) return;
    combatPanel.dataset.sheet=sheetDetached?'detached':'docked';
    logHeader.hidden=!logDetached&&sheetDetached;logHeader.querySelector('button').hidden=!logDetached;
    activeSheet.classList.toggle('ocf-sheet-detached',sheetDetached);activeSheet.ocfReturn.hidden=!sheetDetached;
    if (sheetDetached) {
      document.body.append(activeSheet);
      const rect=floatingLayout||{x:Math.max(12,innerWidth-900),y:60,width:430,height:innerHeight-110};
      const width=Math.min(rect.width,innerWidth-24),x=Math.max(12,Math.min(rect.x,innerWidth-width-12)),y=Math.max(12,Math.min(rect.y,innerHeight-220));
      Object.assign(activeSheet.style,{left:x+'px',top:y+'px',width:width+'px',height:Math.min(rect.height,innerHeight-y-12)+'px',maxHeight:(innerHeight-y-12)+'px'});
    } else { activeSheet.removeAttribute('style');sheetHost.append(activeSheet); }
    popoutButton.disabled=sheetDetached;
  }
  function setSheetDetached(detached) {
    if (!activeSheet) return;
    if (sheetDetached) { const rect=activeSheet.getBoundingClientRect();floatingLayout={x:rect.x,y:rect.y,width:rect.width,height:rect.height}; }
    sheetDetached=detached;if(!detached)setPanelCollapsed(false);placeSheet();
  }
  function dragSheet(header,node,isDetached=()=>sheetDetached) {
    header.addEventListener('pointerdown',event=>{
      if(!isDetached()||event.button!==0||event.target.closest('button,input,select,a'))return;
      event.preventDefault();event.stopPropagation();const rect=node.getBoundingClientRect(),dx=event.clientX-rect.x,dy=event.clientY-rect.y;
      header.setPointerCapture(event.pointerId);
      const move=e=>{const width=node.getBoundingClientRect().width,x=Math.max(8,Math.min(innerWidth-width-8,e.clientX-dx)),y=Math.max(8,Math.min(innerHeight-100,e.clientY-dy));Object.assign(node.style,{left:x+'px',top:y+'px',maxHeight:(innerHeight-y-8)+'px'});};
      const end=()=>{header.removeEventListener('pointermove',move);header.removeEventListener('pointerup',end);header.removeEventListener('pointercancel',end);const current=node.getBoundingClientRect();if(node===activeSheet)floatingLayout={x:current.x,y:current.y,width:current.width,height:current.height};};
      header.addEventListener('pointermove',move);header.addEventListener('pointerup',end);header.addEventListener('pointercancel',end);
    });
  }
  function closeSheet() {
    clearInterval(sheetTimer);activeSheet?.remove();activeSheet=null;activeFlow=null;activeTokenId=null;sheetDetached=false;popoutButton.disabled=true;combatPanel.dataset.sheet='none';logHeader.hidden=!logDetached;
  }
  async function showToken(id, resumeAttackId = null, force = false) {
    if(!id)return;
    if(activeSheet?.isConnected&&activeTokenId===id&&!force&&!resumeAttackId){if(!sheetDetached)setPanelCollapsed(false);return;}
    if (sheetTimer) clearInterval(sheetTimer);
    ensureCombatPanel();if(!sheetDetached)setPanelCollapsed(false);
    if (activeSheet && sheetDetached) { const rect=activeSheet.getBoundingClientRect();floatingLayout={x:rect.x,y:rect.y,width:rect.width,height:rect.height}; }
    activeSheet?.remove(); activeFlow = null;
    const node = element('aside', undefined, 'ocf-sheet'); node.setAttribute('role', 'complementary'); node.setAttribute('aria-label', 'Character sheet');
    activeSheet = node; activeTokenId = id;
    const close = button('×',closeSheet);close.setAttribute('aria-label','Close sheet');close.classList.add('ocf-close');
    const title = element('h2','Character sheet'),content=element('div','Loading…'),header=element('header',undefined,'ocf-sheet-header');
    const reunite=panelChevron('right','Reunite character sheet with combat log',()=>setSheetDetached(false));node.ocfReturn=reunite;
    header.append(title,reunite,close);node.append(header,content);dragSheet(header,node);placeSheet();
    try {
      const token = await api('/tokens/' + encodeURIComponent(id)); if (!node.isConnected) return; content.replaceChildren(); title.textContent = token.name;activeEncounterId=token.encounter_id;refreshCombatLog();
      if (token.restricted) { content.append(element('p', 'This token’s combat sheet is GM-only.', 'ocf-muted')); return; }
      content.append(element('p', '2014 5e · basic combat', 'ocf-muted'));
      const grid = element('div', undefined, 'ocf-grid'), hp = element('div', `HP: ${token.hp_current}/${token.stats.hp_max}`, 'ocf-card');
      hp.dataset.testid = 'current-hp'; grid.append(hp, element('div', `AC: ${token.stats.ac}`, 'ocf-card'), element('div', `Speed: ${token.stats.speed_ft} ft.`, 'ocf-card')); content.append(grid);
      if (token.stats.climb_speed_ft) content.append(element('p', `Climb: ${token.stats.climb_speed_ft} ft.`));
      const feedback = element('p', '', 'ocf-muted');
      const effectsPanel=element('section',undefined,'ocf-active-effects');effectsPanel.dataset.testid='active-effects';content.append(effectsPanel);let effectsSignature='';
      function renderEffects(current) {
        const effects=current.active_effects||[],signature=JSON.stringify([effects,current.combat_turn]);if(signature===effectsSignature)return;effectsSignature=signature;
        effectsPanel.replaceChildren(element('h3','Active effects'));
        if(!effects.length)effectsPanel.append(element('p','No active effects.','ocf-muted'));
        for(const effect of effects){const card=element('div',undefined,'ocf-card');card.dataset.effectId=effect.id;card.append(element('strong',effect.name,'ocf-effect-badge'));
          if(effect.notes)card.append(element('p',effect.notes,'ocf-small'));if(effect.duration)card.append(element('p','Duration: '+effect.duration,'ocf-small'));
          if(effect.source_name)card.append(element('p','Source: '+effect.source_name,'ocf-small ocf-muted'));
          const rule=effect.save_rule;
          if(rule){
            card.append(element('p',`Save: DC ${rule.dc} ${rule.ability.toUpperCase()} · ${rule.timing==='manual'?'when requested':rule.timing+' of turn'} · ${rule.ends_on_success?'ends on success':'DM resolves the outcome'}${rule.mode!=='normal'?' · '+rule.mode:''}`,'ocf-small'));
            let request=null;const save=button(`Roll ${rule.ability.toUpperCase()} save (DC ${rule.dc})`,async()=>{
              save.disabled=true;request ||= {request_id:crypto.randomUUID(),effect_id:effect.id,mode:rollMode.value};
              try{
                const result=await api('/tokens/'+encodeURIComponent(id)+'/condition-save',{method:'POST',body:JSON.stringify(request)});
                renderEffects(await api('/tokens/'+encodeURIComponent(id)));
                const message=`${result.effect_name}: ${result.automatic_failure?'automatic failure':`${result.formula} · ${result.mode} · dice [${result.dice.join(', ')}] = ${result.total} vs DC ${result.dc} — ${result.success?'Success':'Failure'}`} · ${result.ended?'effect ends':'effect remains'}.`;
                const outcome=element('p',message,result.ended?'ocf-good':'ocf-muted');outcome.dataset.testid='effect-save-result';effectsPanel.append(outcome);feedback.textContent=message;await refreshLog();
              }catch(error){feedback.textContent=error.message;save.disabled=false;save.textContent='Retry '+rule.ability.toUpperCase()+' save';}
            });
            const turn=current.combat_turn,key=rule.timing!=='manual'&&turn?.status==='active'&&turn.current_token_id===id?`${turn.session_id}:${turn.turn_number}:${id}`:null;
            save.disabled=!isGM()&&!!key&&effect.last_save?.turn_key===key;if(save.disabled)save.title='Already rolled this effect’s save this turn.';
            card.append(save);
          }
          if(isGM())card.append(button('Remove '+effect.name,async()=>{try{await api('/tokens/'+encodeURIComponent(id)+'/conditions',{method:'POST',body:JSON.stringify({request_id:crypto.randomUUID(),action:'remove',effect_id:effect.id})});renderEffects(await api('/tokens/'+encodeURIComponent(id)));await refreshLog();}catch(error){feedback.textContent=error.message;}}));effectsPanel.append(card);
        }
        if(isGM())effectsPanel.append(button('Add effect',()=>{const form=dialog('Add character effect'),value=effectEditor(form,'Effect name');form.append(element('p','Effect names and notes are visible to players. Configure a saving throw to add a roll button; enable ending on success only when the effect permits it. Duration and other rule modifiers remain GM-managed.','ocf-small ocf-muted'));const submit=button('Apply effect',async()=>{submit.disabled=true;try{await api('/tokens/'+encodeURIComponent(id)+'/conditions',{method:'POST',body:JSON.stringify({request_id:crypto.randomUUID(),action:'add',effect:value()})});form.close();renderEffects(await api('/tokens/'+encodeURIComponent(id)));await refreshLog();}catch(error){form.append(element('p',error.message,'ocf-error'));submit.disabled=false;}});form.append(submit);}));
      }
      renderEffects(token);
      const vitals = element('section'); vitals.dataset.testid = 'life-status'; content.append(vitals);
      let vitalsSignature = '';
      function stateOf(current) { return current.life_state || (current.hp_current > 0 ? 'alive' : current.role === 'pc' ? 'dying' : 'dead'); }
      function renderVitals(current) {
        const signature = JSON.stringify([current.hp_current, current.life_state, current.death_saves, current.inventory]);
        if (signature === vitalsSignature) return; vitalsSignature = signature;
        const state = stateOf(current), saves = current.death_saves || { successes: 0, failures: 0 };
        vitals.replaceChildren(element('h3', 'Condition & recovery'), element('strong', `Status: ${state}`));
        if (current.role === 'pc') {
          vitals.append(element('p', `Death saves: ${saves.successes}/3 successes · ${saves.failures}/3 failures`));
          vitals.append(element('p', state === 'dying' ? 'At the start of your turn, roll a death save: 10+ succeeds; 1 gives two failures; 20 restores 1 HP. Three failures mean death; three successes mean stable.' : state === 'stable' ? 'Stable and unconscious. No death saves needed; healing restores consciousness.' : state === 'dead' ? 'Dead. A demo healing potion can revive this character.' : 'Death saves become available when unconscious at 0 HP.', 'ocf-small ocf-muted'));
          const death = button('Death save (d20)', async () => {
            death.disabled = true; const request = { request_id: crypto.randomUUID() };
            const submit = async () => {
              try {
                const result = await api(`/tokens/${encodeURIComponent(id)}/death-save`, { method: 'POST', body: JSON.stringify(request) });
                activeFlow = null; delete flowArea.dataset.health; flowArea.hidden = false;
                flowArea.replaceChildren(element('h3', 'Death saving throw'), element('p', `1. Start of turn at 0 HP. 2. d20: ${result.total}.`), element('p', `3. ${result.outcome_notice}. Successes ${result.death_saves.successes}/3; failures ${result.death_saves.failures}/3. HP ${result.hp_current}.`));
                renderVitals(await api('/tokens/' + encodeURIComponent(id))); await refreshLog();
              } catch (error) { feedback.textContent = error.message; const retry = button('Retry death save request', submit); flowArea.hidden = false; flowArea.replaceChildren(retry); }
            }; await submit();
          }); death.disabled = state !== 'dying' || current.hp_current !== 0; vitals.append(death);
        }
        for (const item of current.inventory || []) if (item.id === 'potion-healing') {
          const potion = button(`Use potion of healing (${item.unlimited ? '∞' : item.quantity})`, () => chooseTarget({ id: item.id, name: 'Potion of healing' }, true));
          potion.disabled = (!item.unlimited && item.quantity <= 0) || (!isGM() && (state !== 'alive' || current.hp_current <= 0)); vitals.append(element('p', 'Potion: 2d4+2 HP, capped at maximum; target any creature. Demo potions revive zero-HP creatures. ' + (item.unlimited ? 'Unlimited demo supply.' : 'Consumes one potion.')), potion);
        }
      }
      async function refreshLog() { await refreshCombatLog(); }
      const rollMode = element('select'); rollMode.setAttribute('aria-label', 'Roll mode');
      for (const [value, label] of [['normal', 'Normal roll'], ['advantage', 'Advantage'], ['disadvantage', 'Disadvantage']]) { const option = element('option', label); option.value = value; rollMode.append(option); }
      const modeLabel = element('label', 'Roll mode ', 'ocf-row'); modeLabel.append(rollMode); content.append(modeLabel);
      const roll = async (input, trigger) => {
        trigger.disabled = true;
        try {
          const result = await api(`/tokens/${encodeURIComponent(id)}/rolls`, { method: 'POST', body: JSON.stringify({ ...input, mode: rollMode.value, request_id: crypto.randomUUID() }) });
          feedback.textContent = `${result.label}${result.mode && result.mode !== 'normal' ? ' (' + result.mode + ')' : ''}: ${result.formula} → [${result.dice.join(', ')}] = ${result.total}`; await refreshLog();
        } catch (error) { feedback.textContent = error.message; } finally { trigger.disabled = false; }
      };
      const initiative = button(`Initiative (${token.stats.initiative >= 0 ? '+' : ''}${token.stats.initiative})`, async () => {
        initiative.disabled = true; const request = { request_id: crypto.randomUUID() };
        try { await api(`/tokens/${encodeURIComponent(id)}/initiative/request`, { method: 'POST', body: JSON.stringify(request) }); feedback.textContent = 'Initiative requested. Waiting for GM approval; then all characters will be queued to roll.'; await refreshInitiative(); }
        catch (error) { feedback.textContent = error.message; } finally { initiative.disabled = false; }
      });
      content.append(initiative, element('h3', 'Ability checks'));
      const abilities = element('div', undefined, 'ocf-grid');
      for (const [key, score] of Object.entries(token.stats.abilities)) {
        const modifier = token.modifiers[key];
        const check = button(`${key.toUpperCase()} ${score} (${modifier >= 0 ? '+' : ''}${modifier})`, () => roll({ kind: 'ability', ability: key }, check)); abilities.append(check);
      }
      content.append(abilities, element('h3', 'Saving throws'));
      const saves = element('div', undefined, 'ocf-grid');
      for (const [ability, modifier] of Object.entries(token.saving_throws || token.modifiers)) {
        const save = button(`${ability.toUpperCase()} save (${modifier >= 0 ? '+' : ''}${modifier})`, () => roll({ kind: 'save', ability }, save)); saves.append(save);
      }
      content.append(saves);
      if (token.skills?.length) {
        content.append(element('h3', 'Skills')); const skills = element('div', undefined, 'ocf-grid'); skills.style.gridTemplateColumns = 'repeat(2,1fr)';
        for (const skill of token.skills) {
          const control = button(`${skill.name} (${skill.bonus >= 0 ? '+' : ''}${skill.bonus})`, () => roll({ kind: 'skill', skill_id: skill.id }, control));
          skills.append(control); if (skill.note) control.title = skill.note;
        }
        content.append(skills);
        for (const skill of token.skills.filter(item => item.note)) content.append(element('p', skill.name + ': ' + skill.note, 'ocf-small ocf-muted'));
      }
      if (token.proficiencies?.tools?.length) {
        content.append(element('h3', 'Tool checks'));
        const toolAbility = element('select'); toolAbility.setAttribute('aria-label', 'Tool check ability');
        for (const ability of Object.keys(token.modifiers)) { const option = element('option', ability.toUpperCase()); option.value = ability; toolAbility.append(option); } toolAbility.value = 'dex';
        const label = element('label', 'Ability chosen for this tool check ', 'ocf-row'); label.append(toolAbility); content.append(label);
        for (const tool of token.proficiencies.tools) { const control = button(tool, () => roll({ kind: 'tool', tool, ability: toolAbility.value }, control)); content.append(control); }
      }
      if (token.proficiencies) { content.append(element('h3', 'Proficiencies & languages')); for (const [key, values] of Object.entries(token.proficiencies)) content.append(element('p', `${key.replaceAll('_', ' ')}: ${values.join(', ')}`, 'ocf-small')); }
      if (token.features?.length) { content.append(element('h3', 'Special attacks & features')); for (const feature of token.features) { const card = element('div', undefined, 'ocf-card'); card.append(element('strong', feature.name), element('p', feature.description, 'ocf-small')); content.append(card); } }
      content.append(element('h3', 'Attacks'));
      const flowArea = element('section', undefined, 'ocf-flow'); flowArea.dataset.testid = 'attack-walkthrough'; flowArea.hidden = true;
      function renderFlow(action) {
        if (!node.isConnected) return;
        activeFlow = action; flowArea.hidden = false; flowArea.replaceChildren(element('h3', attackTitle(action.action_name)));
        const health = action.current_target_health || action.target_health;
        flowArea.dataset.health = health?.band || '';
        const healthLabel = band => ({ green: 'Good', yellow: 'Not Good', red: 'Bad' })[band];
        if (health) {
          const indicator = element('p', isGM() && action.target_hp ? `HP: ${action.target_hp.current}/${action.target_hp.maximum}` : `Health: ${healthLabel(health.band)}`, 'ocf-health-' + health.band);
          indicator.dataset.testid = 'target-health'; flowArea.append(indicator);
        }
        const steps = element('ol', undefined, 'ocf-steps');
        steps.append(element('li', `Target: ${action.target_name}`));
        steps.append(element('li', `Attack: ${action.attack.formula}${action.attack.mode && action.attack.mode !== 'normal' ? ' · ' + action.attack.mode : ''} · dice [${action.attack.dice.join(', ')}] = ${action.attack.total} — ${action.hit ? (action.critical ? 'Critical hit' : 'Hit') : 'Miss'}${isGM() ? ` (AC ${action.target_ac})` : ''}`));
        const damageLine = element('li', action.damage ? `Damage: ${action.damage.formula} · dice [${action.damage.dice.join(', ')}] = ${action.damage.total} ${action.damage.damage_type}` : 'No damage roll: attack missed.');
        const damageHealth = action.damage_health || health;
        if (damageHealth) damageLine.classList.add('ocf-health-' + damageHealth.band);
        steps.append(damageLine);
        if (action.damage && damageHealth) {
          const change = action.approval_preview || action.hp_change;
          damageLine.append(element('div', `${action.status === 'awaiting_approval' ? 'If approved' : 'After damage'}: ${isGM() && change ? `HP: ${change.hp_after}` : `Health: ${healthLabel(damageHealth.band)}`}`, 'ocf-small'));
        }
        const outcome = element('li');
        outcome.dataset.testid = 'attack-outcome';
        outcome.textContent = action.status === 'applied' ? (action.hp_change ? `Applied: ${action.target_name} HP ${action.hp_change.hp_before} → ${action.hp_change.hp_after}; temporary HP ${action.hp_change.temp_before} → ${action.hp_change.temp_after}.` : `Damage applied to ${action.target_name}.`) : 'Interaction finished; no HP deducted.';
        steps.append(outcome); flowArea.append(steps);
        if (action.outcome_notice) flowArea.append(element('strong', action.outcome_notice, ['dead', 'destroyed'].includes(action.target_state) ? 'ocf-error' : 'ocf-good'));
        if (action.target_state === 'dying' && (isGM() || action.target_role === 'pc')) flowArea.append(button('Open target death saves', () => showToken(action.target_token_id)));
        if (action.status !== 'awaiting_approval') {
          const definition = token.attacks.find(item => item.id === action.action_id);
          if (definition) {const controls=element('div',undefined,'ocf-row');controls.append(button('Attack again', () => chooseTarget(definition)),sheetTurnButton(id));flowArea.append(controls);updateSheetTurnButtons();}
        }
      }
      async function chooseTarget(action, healing = false, bonusIds = []) {
        activeFlow = null; delete flowArea.dataset.health; flowArea.hidden = false; flowArea.replaceChildren(element('h3', healing ? action.name : attackTitle(action.name)), element('p', healing ? '1. Choose any creature, including yourself or a zero-HP creature.' : '1. Choose a target.'));
        try {
          const targets = await api(`/tokens/${encodeURIComponent(id)}/targets${healing ? '?healing=1' : ''}`);
          if (!healing) {
            const object = button('Attack object', () => {
              const objects = targets.filter(target => target.role === 'object');
              flowArea.replaceChildren(element('h3', 'Attack an object'));
              for (const target of objects) addTarget(target);
              if (!isGM()) { flowArea.append(element('p', 'Ask the GM to add an object with its AC and HP.')); return; }
              const form = element('form'); const fields = {};
              for (const [key, label, value] of [['name', 'Object name', ''], ['ac', 'Object AC', '10'], ['hp', 'Object HP', '10']]) {
                const field = element('input'); field.name = key; field.required = true; field.value = value; field.setAttribute('aria-label', label);
                field.type = key === 'name' ? 'text' : 'number';
                if (key === 'name') field.maxLength = 100; else { field.min = 1; field.max = key === 'ac' ? 30 : 10000; }
                fields[key] = field; const row = element('label', label, 'ocf-row'); row.append(field); form.append(row);
              }
              const create = button('Add object & select target', () => form.requestSubmit()); form.append(create); flowArea.append(form);
              const requestId = crypto.randomUUID();
              form.onsubmit = async event => {
                event.preventDefault(); create.disabled = true;
                try {
                  const target = await api(`/tokens/${encodeURIComponent(id)}/objects`, { method: 'POST', body: JSON.stringify({ request_id: requestId, name: fields.name.value, ac: Number(fields.ac.value), hp: Number(fields.hp.value) }) });
                  flowArea.replaceChildren(element('h3', 'Object ready — choose to roll')); addTarget(target);
                } catch (error) { feedback.textContent = error.message; create.disabled = false; }
              };
            }); flowArea.append(object);
          }
          function addTarget(target) {
            const request = { request_id: crypto.randomUUID(), [healing ? 'item_id' : 'action_id']: action.id, target_token_id: target.token_id, ...(!healing ? { mode: rollMode.value, bonus_ids: bonusIds } : {}) };
            const trigger = button(`Target ${target.name}`, async () => {
              flowArea.querySelectorAll('button').forEach(item => { item.disabled = true; });
              feedback.textContent = `Rolling ${action.name} → ${target.name}…`;
              try {
                const result = await api(`/tokens/${encodeURIComponent(id)}/${healing ? 'healing' : 'attacks'}`, { method: 'POST', body: JSON.stringify(request) });
                feedback.textContent = '';
                if (healing) {
                  activeFlow = null; flowArea.replaceChildren(element('h3', 'Potion of healing'), element('p', `1. Target: ${result.target_name}`), element('p', `2. Healing: ${result.formula} · dice [${result.dice.join(', ')}] = ${result.total}`), element('p', result.hp_change ? `3. HP ${result.hp_change.hp_before} → ${result.hp_change.hp_after}. ${result.outcome_notice}.` : `3. Healing applied. ${result.outcome_notice}.`), element('p', `Potions remaining: ${result.unlimited ? '∞ (demo)' : result.remaining}.`));
                  const current = await api('/tokens/' + encodeURIComponent(id)); hp.textContent = `HP: ${current.hp_current}/${current.stats.hp_max}`; renderVitals(current);
                  const again = button('Heal again', () => chooseTarget(action, true));
                  again.disabled = (!result.unlimited && result.remaining <= 0) || (!isGM() && (current.hp_current <= 0 || stateOf(current) !== 'alive'));
                  const controls=element('div',undefined,'ocf-row');controls.append(again,sheetTurnButton(id));flowArea.append(controls);updateSheetTurnButtons();
                } else renderFlow(result); await refreshLog();
              } catch (error) { feedback.textContent = error.message + ' Retry uses the same request.'; flowArea.querySelectorAll('button').forEach(item => { item.disabled = false; }); }
            }); flowArea.append(trigger);
          }
          for (const target of targets) addTarget(target);
          if (!targets.length) flowArea.append(element('p', 'No other encounter tokens are available.'));
        } catch (error) { feedback.textContent = error.message; }
      }
      async function chooseAdvancedTargets(action) {
        activeFlow = null; delete flowArea.dataset.health; flowArea.hidden = false;
        flowArea.replaceChildren(element('h3', attackTitle(action.name)));
        flowArea.append(element('p', action.area ? `Area: ${action.area.size_ft} ft ${action.area.shape}.` : 'Select the affected creatures described in the action.'));
        flowArea.append(element('p', 'Select all affected creatures, including allies when applicable. This map has no combat scale; the GM determines distance, cone direction, cover and area membership.', 'ocf-small ocf-muted'));
        if (action.save) flowArea.append(element('p', `DC ${action.save.dc} ${action.save.ability.toUpperCase()} save${action.save.half_on_success ? ' · half damage on success' : ''}. Choose advantage/disadvantage separately for each target.`));
        flowArea.append(element('p', 'Damage and saves will roll once and HP will apply immediately. Conditions, durations, recharge and usage limits remain GM-managed.', 'ocf-small'));
        const fields = element('div'); fields.style.maxHeight = '320px'; fields.style.overflow = 'auto';
        try {
          const targets = (await api(`/tokens/${encodeURIComponent(id)}/targets`)).filter(t => t.role !== 'object');
          const choices = [];
          for (const target of targets) {
            const selected = element('input'); selected.type = 'checkbox'; selected.setAttribute('aria-label', 'Affect ' + target.name);
            const label = element('label', target.name, 'ocf-row'); label.prepend(selected);
            const mode = element('select'); mode.setAttribute('aria-label', 'Save mode: ' + target.name);
            for (const [value,text] of [['normal','Normal save'],['advantage','Advantage'],['disadvantage','Disadvantage']]) { const option = element('option',text); option.value=value; mode.append(option); }
            if (action.save) label.append(mode);
            const manual = element('input'); manual.type='checkbox'; manual.setAttribute('aria-label','Manual HP: '+target.name);
            const manualLabel = element('label','Resolve HP manually (rule exception)','ocf-small ocf-row'); manualLabel.prepend(manual);
            fields.append(label,manualLabel); choices.push({ target, selected, mode, manual });
          }
          const controls = element('div', undefined, 'ocf-row'); controls.append(button('Select all affected', () => choices.forEach(c => { c.selected.checked = true; })), button('Clear targets', () => choices.forEach(c => { c.selected.checked = false; })));
          flowArea.append(controls,fields);
          const failedEffect=action.save?effectEditor(flowArea,'Effect on failed save (optional)',/^Weakening Breath(?:\s*\([^)]*\))?$/i.test(action.name)?{name:'Weakening Breath',notes:'Disadvantage on Strength-based attack rolls, Strength checks, and Strength saving throws.',duration:'1 minute; repeat the Strength save at the end of each turn, ending on success.',save_rule:{ability:action.save.ability,dc:action.save.dc,timing:'end',ends_on_success:true,mode:'disadvantage'}}:{save_rule:{ability:action.save.ability,dc:action.save.dc,timing:'manual',ends_on_success:false,mode:'normal'}}):null;
          let input = null;
          const resolve = button(action.rolls.some(r => r.kind === 'damage') ? 'Roll saves & apply selected damage' : 'Roll saves for selected targets', async () => {
            const selected = choices.filter(c => c.selected.checked); if (!selected.length) { feedback.textContent = 'Select at least one affected creature.'; return; }
            input ||= { request_id: crypto.randomUUID(), action_id: action.id, ...(failedEffect?{failed_save_effect:failedEffect()}:{}),targets: selected.map(c => ({ token_id: c.target.token_id, mode: c.mode.value, ...(c.manual.checked ? { manual_hp:true } : {}) })) };
            flowArea.querySelectorAll('button,input,select').forEach(control => { control.disabled = true; });
            try {
              const result = await api(`/tokens/${encodeURIComponent(id)}/effects`, { method: 'POST', body: JSON.stringify(input) });
              flowArea.replaceChildren(element('h3', attackTitle(result.action_name)));
              for (const damage of result.damage) flowArea.append(element('p', `Shared damage: ${damage.formula} · dice [${damage.dice.join(', ')}] = ${damage.total} ${damage.damage_type}`));
              for (const target of result.targets) {
                const row = element('div', undefined, 'ocf-card'); row.dataset.target = target.token_id; row.append(element('strong',target.name));
                if (target.save?.automatic_failure) row.append(element('p','Automatic failure: unconscious STR/DEX saving throw.'));
                else if (target.save) row.append(element('p', `${target.save.mode}: ${target.save.formula} · dice [${target.save.dice.join(', ')}] = ${target.save.total} vs DC ${target.dc}: ${target.save_success ? 'success' : 'failure'}`));
                for(const effect of target.applied_effects||[])row.append(element('p','Effect applied: '+effect.name,'ocf-effect-badge'));
                row.append(element('p', target.hp_applied ? `${target.damage_total} damage applied · HP ${target.hp_change.hp_before} → ${target.hp_change.hp_after}. ${target.outcome_notice}` : target.manual_defenses.length ? 'Conditional defenses: resolve HP manually. ' + target.manual_defenses.join('; ') : target.applied_effects?.length?'Effect recorded on the target.':'No condition effect applied.'));
                flowArea.append(row);
              }
              flowArea.append(element('p','Active effects are tracked as reminders; the GM manages duration, repeat saves, rule modifiers, recharge and limited uses. Source: ' + result.source_description,'ocf-small ocf-muted'));
              feedback.textContent=''; await refreshLog();
            } catch (error) { feedback.textContent=error.message; resolve.disabled=false; resolve.textContent='Retry the same targets'; }
          }); flowArea.append(resolve); if (!targets.length) resolve.disabled=true;
          flowArea.scrollIntoView({ block:'start' });
        } catch (error) { feedback.textContent=error.message; }
      }
      for (const attack of token.attacks) {
        const card = element('div', undefined, 'ocf-card');
        card.append(element('strong', attack.name), element('div', `${attack.damage} ${attack.damage_type}`, 'ocf-muted'));
        const bonus = token.features?.find(feature => feature.rule === 'colossus_slayer');
        let includeBonus; if (bonus) {
          includeBonus = element('input'); includeBonus.type = 'checkbox'; includeBonus.setAttribute('aria-label', `${attack.name}: include Colossus Slayer`);
          const label = element('label', 'Colossus Slayer +1d8 (wounded creature, once/turn)', 'ocf-row ocf-small'); label.prepend(includeBonus); card.append(label);
        }
        card.append(button(`Attack ${attack.attack_bonus >= 0 ? '+' : ''}${attack.attack_bonus}`, () => chooseTarget(attack, false, includeBonus?.checked ? [bonus.id] : [])));
        content.append(card);
      }
      if (token.advanced_actions?.length) {
        const advanced = element('section'); advanced.dataset.testid = 'advanced-actions'; advanced.append(element('h3', 'Advanced actions & traits'));
        advanced.append(element('p', 'Choose affected creatures for damage/save actions. Choose an optional effect for failed saves. The GM manages area membership, duration, repeat saves, rule modifiers, recharge and limited uses.', 'ocf-small ocf-muted'));
        for (const action of token.advanced_actions) {
          const card = element('details', undefined, 'ocf-card'); card.dataset.action = action.id;
          card.append(element('summary', `${action.category[0].toUpperCase() + action.category.slice(1)} · ${action.name}`), element('p', action.description, 'ocf-small'));
          if (action.save) card.append(element('p', `DC ${action.save.dc} ${action.save.ability.toUpperCase()} save · resolved manually`, 'ocf-small'));
          const targeted = isGM() && (action.save || action.rolls.some(r => r.kind === 'damage'));
          if (targeted) card.append(button('Choose targets: ' + action.name, () => chooseAdvancedTargets(action)));
          for (const definition of action.rolls) {
            if (targeted && definition.kind === 'damage') continue;
            const control = button(`Roll ${action.name}: ${definition.label} (${definition.formula})`, () => roll({ kind: 'advanced', action_id: action.id, roll_id: definition.id }, control)); card.append(control);
          }
          if (/check/i.test(action.description)) for (const skill of (token.skills || []).filter(item => action.description.toLowerCase().includes(item.name.toLowerCase()))) { const control = button(`Roll ${action.name}: ${skill.name} (${skill.bonus >= 0 ? '+' : ''}${skill.bonus})`, () => roll({ kind: 'skill', skill_id: skill.id }, control)); card.append(control); }
          if (['Multiattack', 'Tail Attack'].includes(action.name)) for (const attack of token.attacks.filter(a => action.description.toLowerCase().includes(a.name.toLowerCase()))) card.append(button(`Use ${attack.name}`, () => chooseTarget(attack)));
          advanced.append(card);
        }
        content.append(advanced);
      }
      content.append(flowArea, feedback); renderVitals(token);
      const source = element('a', 'Open Kanka character/creature'); source.href = token.source_url; source.target = '_blank'; source.rel = 'noopener'; content.append(source);
      if (token.review_notes?.length) { const review = element('details'); review.append(element('summary', 'Source review notes')); for (const note of token.review_notes) review.append(element('p', note, 'ocf-small')); content.append(review); }
      if (isGM() && token.sheet_origin) content.append(element('p', 'Definition: ' + token.sheet_origin, 'ocf-small ocf-muted'));
      if (isGM() && token.role === 'pc') {
        const file = element('input'); file.type = 'file'; file.accept = '.json,application/json'; file.hidden = true;
        const importButton = button('Import statblock JSON', () => file.click());
        file.onchange = async () => {
          const chosen = file.files[0]; if (!chosen) return; importButton.disabled = true;
          try {
            if (chosen.size > 30000) throw new Error('Statblock is too large (30 KB maximum).');
            const sheet = JSON.parse(await chosen.text()), current = await api('/tokens/' + encodeURIComponent(id));
            await api(`/tokens/${encodeURIComponent(id)}/sheet`, { method: 'POST', body: JSON.stringify({ request_id: crypto.randomUUID(), sheet, expected_revision: current.revision }) });
            await showToken(id,null,true);
          } catch (error) { feedback.textContent = error.message; importButton.disabled = false; }
        }; content.append(importButton, file);
      }
      await refreshLog();
      const existing = resumeAttackId ? await api('/attacks/' + resumeAttackId) : (await api('/attacks')).find(action => action.attacker_token_id === id);
      if (existing) renderFlow(existing);
      if (!node.isConnected) return;
      sheetTimer = setInterval(async () => {
        if (!node.isConnected) return;
        try {
          const current = await api('/tokens/' + encodeURIComponent(id)); if (!node.isConnected) return;
          hp.textContent = `HP: ${current.hp_current}/${current.stats.hp_max}`; renderVitals(current);renderEffects(current);
          if (activeFlow) { const currentFlow = await api('/attacks/' + activeFlow.id); if (JSON.stringify(currentFlow) !== JSON.stringify(activeFlow)) renderFlow(currentFlow); }
        } catch { /* Keep the last confirmed state visible while reconnecting. */ }
      }, 1500);
    } catch (error) { content.textContent = error.message; content.className = 'ocf-error'; }
  }
  async function roster() {
    const node = dialog('Encounter characters');
    try {
      const encounters = await api('/encounters');
      for (const encounter of encounters) {
        node.append(element('h3', encounter.name));
        for (const token of encounter.tokens) node.append(button(token.name, () => { node.close(); showToken(token.token_id); }));
      }
      if (!encounters.length) node.append(element('p', 'Load the test quest in OCF encounters first.'));
    } catch (error) { node.append(element('p', error.message, 'ocf-error')); }
  }
  window.addEventListener('ocf:select-token',event=>{window.ocfPendingTokenSelection=event.detail?.tokenId;showToken(event.detail?.tokenId);},true);
  window.addEventListener('ocf:token', event => showToken(event.detail.tokenId));
  async function launcher() {
    const form = document.querySelector('#ocf-form'), output = document.querySelector('#ocf-output');
    form.addEventListener('submit', async event => {
      event.preventDefault(); const submit = form.querySelector('button'); submit.disabled = true; output.textContent = 'Reading Kanka and preparing the encounter…';
      try {
        const data = await api('/prepare', { method: 'POST', body: JSON.stringify({ quest_url: form.elements.quest.value, map_entity_id: Number(form.elements.map.value) }) });
        output.replaceChildren(element('h2', data.name), element('p', `${data.tokens.length} linked tokens · revision ${data.revision}. ${data.demo_hp_policy}`));
        for (const warning of data.warnings) output.append(element('p', warning));
        const link = element('a', 'Open prepared encounter in Dungeon Revealer', 'ocf-button'); link.href = '/dm?ocf_encounter=' + encodeURIComponent(data.id); output.append(link);
      } catch (error) { output.textContent = error.message; }
      finally { submit.disabled = false; }
    });
    try {
      for (const encounter of await api('/encounters')) {
        const link = element('a', `Open ${encounter.name}`, 'ocf-button'); link.href = '/dm?ocf_encounter=' + encodeURIComponent(encounter.id); output.append(link, element('p', `${encounter.tokens.length} participants`));
      }
    } catch { output.append(element('p', 'Sign in as GM in Dungeon Revealer, then return here.')); }
  }
  if (document.querySelector('#ocf-form')) launcher();
  else {
    const tools = element('div', undefined, 'ocf-tools ocf-top-tools');
    const link = element('a', 'OCF encounters', 'ocf-button'); link.href = '/ocf-api/ui';
    tools.append(link);installRollApprovalControls(tools);
    const bottom = element('div', undefined, 'ocf-tools ocf-bottom-tools');
    const turnArea = element('div');
    bottom.append(turnArea);document.body.append(tools,bottom);ensureCombatPanel();
    const minimized = new Map(), lastStatus = new Map(), seenNpcDialogs = new Set();
    let trackerSignature = '', trackerStates = [], npcDialog = null, npcContent = null, npcSession = null;
    let trackerFeedback = '';
    const collapsed = state => {
      const key = state.encounter_id + ':' + state.session_id;
      if (!minimized.has(key)) {
        let saved = null; try { saved = localStorage.getItem('ocf-tracker-minimized:' + key); } catch {}
        minimized.set(key, saved === null ? ['ended', 'rejected'].includes(state.status) : saved === 'true');
      }
      return minimized.get(key);
    };
    async function command(state, action, tokenId) {
      // Hold the same UUID for retry after a lost response; each UI action owns it.
      const input = { request_id: crypto.randomUUID(), session_id: state.session_id, expected_revision: state.revision, action, ...(tokenId ? { token_id: tokenId } : {}) };
      const send = async () => api(`/initiative/${state.encounter_id}/command`, { method: 'POST', body: JSON.stringify(input) });
      try { await send(); trackerFeedback = ''; }
      catch (error) {
        if (error instanceof TypeError) { try { await send(); trackerFeedback = ''; } catch (retryError) { trackerFeedback = retryError.message; } }
        else trackerFeedback = error.message;
      }
      await refreshInitiative();

    }
    endSheetTurn = async id => {
      const state=initiativeStates.find(state=>state.status==='active'&&state.current_token_id===id);
      if(state)await command(state,isGM()?'advance':'end_turn',id);
    };
    function npcRolls(state) {
      if (npcDialog?.isConnected && npcSession === state.session_id) return;
      npcDialog?.close(); npcDialog = dialog('NPC initiative'); npcSession = state.session_id;
      npcContent = element('div'); npcDialog.append(npcContent); renderNpcRolls(state);
    }
    function renderNpcRolls(state) {
      if (!npcDialog?.isConnected || npcSession !== state.session_id) return;
      if (state.status !== 'rolling') { npcDialog.close(); return; }
      npcContent.replaceChildren(element('p', 'Roll each NPC individually, or roll all remaining NPCs. PCs are queued in the turn tracker.'));
      const pending = state.entries.filter(entry => entry.role !== 'pc' && entry.total === null);
      if (pending.length) npcContent.append(button('Roll all NPCs', () => command(state, 'roll_npcs')));
      for (const entry of state.entries.filter(item => item.role !== 'pc')) {
        npcContent.append(entry.total === null ? button('Roll NPC: ' + entry.name, () => command(state, 'roll', entry.token_id)) : element('p', `${entry.name}: ${entry.total}`));
      }
      if (!pending.length) npcContent.append(element('p', 'All NPCs rolled. Waiting for remaining PCs.'));
      if (trackerFeedback) npcContent.append(element('p', trackerFeedback, 'ocf-error'));
    }
    function renderTrackers() {
      turnArea.replaceChildren();
      for (const state of trackerStates) {
        const key = state.encounter_id + ':' + state.session_id;
        const current = state.entries.find(entry => entry.token_id === state.current_token_id);
        const panel = element('section', undefined, 'ocf-turnorder'); panel.dataset.testid = 'turn-tracker'; panel.dataset.encounter = state.encounter_id;
        const heading = current ? `${!isGM() && current.role === 'pc' ? 'Your turn' : 'Turn'}: ${current.name}` : state.status === 'pending' ? 'Initiative: GM approval needed' : state.status === 'rolling' ? 'Initiative: waiting for rolls' : 'Combat ended';
        panel.dataset.collapsed = String(collapsed(state));
        const header = element('div', undefined, 'ocf-turn-header');
        const title = element('h3', current ? 'Turn: ' : (collapsed(state) ? 'Turn:' : heading));
        if (current) title.setAttribute('aria-label', 'Turn: ' + current.name);
        if (current) {
          const name = button(current.name, () => showToken(current.token_id)); name.className = 'ocf-turn-name'; name.setAttribute('aria-label', 'Open sheet: ' + current.name); title.append(name);
        }
        const toggle = button('', () => {
          minimized.set(key, !collapsed(state)); try { localStorage.setItem('ocf-tracker-minimized:' + key, String(minimized.get(key))); } catch {}
          renderTrackers();
        });
        toggle.className = 'ocf-chevron'; toggle.setAttribute('aria-label', collapsed(state) ? 'Expand turn tracker' : 'Minimize turn tracker'); toggle.title = toggle.getAttribute('aria-label'); toggle.setAttribute('aria-expanded', String(!collapsed(state)));
        // The panel grows upwards: up expands, down collapses.
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 16 16'); svg.setAttribute('aria-hidden', 'true');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', collapsed(state) ? 'M3 10L8 5L13 10' : 'M3 6L8 11L13 6'); path.setAttribute('fill', 'none'); path.setAttribute('stroke', 'currentColor'); path.setAttribute('stroke-width', '2'); svg.append(path); toggle.append(svg);
        header.append(title, toggle); panel.append(header);
        const body = element('div', undefined, 'ocf-turnorder-body'); body.hidden = collapsed(state); body.dataset.testid = 'turn-tracker-body';
        body.append(element('p', `${state.encounter_name}${state.round ? ' · Round ' + state.round : ''}`, 'ocf-small'));
        if (state.status === 'pending') {
          body.append(element('p', `Requested by ${state.requested_by}. Waiting for GM approval.`));
          if (isGM()) body.append(button('Approve initiative', () => command(state, 'approve')), button('Reject initiative', () => command(state, 'reject')));
        }
        if (state.status === 'rolling') {
          const queued = state.entries.filter(entry => entry.total === null);
          body.append(element('p', `${queued.length} characters still need initiative rolls.`));
          for (const entry of state.entries) {
            if (entry.total === null && entry.role === 'pc') body.append(button('Roll initiative: ' + entry.name, () => command(state, 'roll', entry.token_id)));
            else body.append(element('p', `${entry.name}: ${entry.total === null ? 'queued for GM' : entry.total}`));
          }
          if (isGM()) body.append(button('Roll NPC initiative', () => npcRolls(state)));
        }
        if (state.order.length) {
          const order = element('ol');
          const start = Math.max(0, state.order.indexOf(state.current_token_id));
          const ids = [...state.order.slice(start), ...state.order.slice(0, start)];
          for (const id of ids) {
            const entry = state.entries.find(item => item.token_id === id);
            const row = element('li', undefined, id === state.current_token_id ? 'ocf-current-turn' : '');
            const name = button(entry.name, () => showToken(entry.token_id)); name.className = 'ocf-turn-name'; name.setAttribute('aria-label', 'Open sheet: ' + entry.name);
            row.append(name, document.createTextNode(` · ${entry.total}${['dead', 'destroyed'].includes(entry.condition) ? ' · ' + entry.condition : ''}`));
            for(const effect of entry.effects||[])row.append(element('span',effect,'ocf-effect-badge'));
            row.dataset.token = id; order.append(row);
          }
          body.append(order);
        }
        if (state.status === 'active' && current) {
          if (!isGM() && current.role === 'pc') body.append(element('strong', 'Your turn: ' + current.name, 'ocf-good'));
          if (!isGM() && current.role === 'pc') body.append(button('End turn', () => command(state, 'end_turn', current.token_id)));
          if (isGM()) body.append(button(current.role === 'pc' ? 'Advance PC turn' : 'Advance NPC turn', () => command(state, 'advance')));
          if (current.condition === 'dying') body.append(button('Open death saves: ' + current.name, () => showToken(current.token_id)));
        }
        if (isGM() && ['pending', 'rolling', 'active'].includes(state.status)) body.append(button('End combat', () => command(state, 'end_combat')));
        if (trackerFeedback) body.append(element('p', trackerFeedback, 'ocf-error'));
        panel.append(body); turnArea.append(panel); renderNpcRolls(state);
      }
    }
    let refreshingInitiative = false;
    refreshInitiative = async () => {
      if (refreshingInitiative) return; refreshingInitiative = true;
      try {
        const [states,movement]=await Promise.all([api('/initiative'),api('/movement-policy')]);
        const nextMovement=JSON.stringify(movement);if(!movementReady||nextMovement!==movementSignature){movementReady=true;movementTokens=movement.tokens;tokenEffects=movement.effects||{};tokenHealth=movement.health||{};movementSignature=nextMovement;window.dispatchEvent(new Event('ocf:turn'));}
        const signature = JSON.stringify([states, trackerFeedback]);
        if (signature !== trackerSignature) {
          const previous=initiativeStates;
          trackerSignature = signature; initiativeStates = states;trackerStates = states.filter(state=>['pending','rolling','active'].includes(state.status));updateSheetTurnButtons();
          if(npcDialog?.isConnected&&!trackerStates.some(state=>state.status==='rolling'&&state.session_id===npcSession))npcDialog.close();
          for (const state of states) {
            if (['ended', 'rejected'].includes(state.status) && lastStatus.get(state.encounter_id) && lastStatus.get(state.encounter_id) !== state.status) {
              const key = state.encounter_id + ':' + state.session_id; minimized.set(key, true);
              try { localStorage.setItem('ocf-tracker-minimized:' + key, 'true'); } catch {}
            }
            lastStatus.set(state.encounter_id, state.status);
          }
          renderTrackers();
          if(isGM()) {
            const incoming=states.find(state=>{
              if(state.status!=='active'||(activeEncounterId&&state.encounter_id!==activeEncounterId))return false;
              const current=state.entries.find(entry=>entry.token_id===state.current_token_id);
              if(!current||current.role==='pc')return false;
              const prior=previous.find(old=>old.encounter_id===state.encounter_id);
              return prior?.status!=='active'||prior.session_id!==state.session_id||prior.current_token_id!==state.current_token_id||prior.turn_number!==state.turn_number;
            });
            if(incoming){await showToken(incoming.current_token_id);window.dispatchEvent(new CustomEvent('ocf:select-token',{detail:{tokenId:incoming.current_token_id}}));}
          }
          if (isGM()) {
            const pending = states.find(state => state.status === 'rolling' && !seenNpcDialogs.has(state.session_id));
            if (pending) { seenNpcDialogs.add(pending.session_id); npcRolls(pending); }
          }
        }
      } catch { if(movementReady){movementReady=false;window.dispatchEvent(new Event('ocf:turn'));} /* Retain the last tracker during reconnection. */ }
      finally { refreshingInitiative = false; }
    };
    refreshInitiative(); setInterval(refreshInitiative, 1500);
    const encounterId = new URLSearchParams(location.search).get('ocf_encounter');
    if (encounterId) api('/launch/' + encodeURIComponent(encounterId), { method: 'POST', body: '{}' }).then(result => {
      if (result.role === 'gm') localStorage.setItem('loadedMapId', JSON.stringify(result.map_id));
      location.replace(result.role === 'gm' ? '/dm' : '/');
    }).catch(error => { const node = dialog('Encounter launch'); node.append(element('p', error.message, 'ocf-error')); });
  }
})();
