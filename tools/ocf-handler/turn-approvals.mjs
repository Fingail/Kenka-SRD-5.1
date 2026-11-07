import { createHash } from 'node:crypto';
import { allowed, check } from './core.mjs';

export const needsTurnApproval = (encounter, token, role) => role === 'player' && ['rolling', 'active'].includes(encounter.initiative?.status) && (encounter.initiative.status !== 'active' || encounter.initiative.current_token_id !== token.token_id);

export class TurnApprovals {
  constructor({ db, tokenFor, getEncounter, execute, hasExecuted = () => false }) {
    Object.assign(this, { db, tokenFor, getEncounter, execute, hasExecuted });
    db.exec('CREATE TABLE IF NOT EXISTS turn_approvals(id TEXT PRIMARY KEY,fingerprint TEXT NOT NULL,encounter_id TEXT NOT NULL,status TEXT NOT NULL,record TEXT NOT NULL)');
  }
  save(record, fingerprint) {
    this.db.prepare('INSERT INTO turn_approvals VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,record=excluded.record').run(record.id,fingerprint,record.encounter_id,record.status,JSON.stringify(record));
    return record;
  }
  expire() {
    for(const row of this.db.prepare("SELECT * FROM turn_approvals WHERE status='pending'").all()) {
      const record=JSON.parse(row.record), encounter=this.getEncounter(record.encounter_id);
      if(!encounter || encounter.initiative?.session_id!==record.session_id || !['rolling','active'].includes(encounter.initiative?.status)) {
        record.status='cancelled';record.reason='Combat ended or changed. Start a new roll request.';this.save(record,row.fingerprint);
      }
    }
  }
  get(id) {
    this.expire();const row=this.db.prepare('SELECT record FROM turn_approvals WHERE id=?').get(id);
    check(row,'Unknown roll request.',404);return JSON.parse(row.record);
  }
  list() {
    this.expire();return this.db.prepare("SELECT record FROM turn_approvals WHERE status='pending' ORDER BY rowid").all().map(row=>JSON.parse(row.record));
  }
  run(kind, tokenId, input, role) {
    const {encounter,token}=this.tokenFor(tokenId);
    check(allowed(token,role),'Only the GM controls this token.',403);
    if(role==='gm')return this.execute(kind,tokenId,input,role);
    check(typeof input.request_id==='string' && /^[a-f0-9-]{36}$/.test(input.request_id),'A UUID request ID is required.');
    const fingerprint=createHash('sha256').update(JSON.stringify({kind,tokenId,input,role})).digest('hex');
    const prior=this.db.prepare('SELECT fingerprint FROM turn_approvals WHERE id=?').get(input.request_id);
    if(prior) {
      check(prior.fingerprint===fingerprint,'Request ID already used for a different roll.',409);
      const approval=this.get(input.request_id);return approval.status==='approved'?approval.result:{approval_required:true,approval};
    }
    if(this.hasExecuted(kind,input.request_id)||!needsTurnApproval(encounter,token,role))return this.execute(kind,tokenId,input,role);
    const label=kind==='roll' ? [input.kind,input.skill_id||input.ability||input.action_id||input.tool].filter(Boolean).join(': ') : kind==='attack' ? token.attacks?.find(a=>a.id===input.action_id)?.name||'Attack' : kind==='condition_save'?((token.active_effects||[]).find(e=>e.id===input.effect_id)?.name||'Effect')+' save' : kind==='healing'?'Potion of healing':kind==='death_save'?'Death saving throw':'Advanced action';
    const target=encounter.tokens.find(t=>t.token_id===input.target_token_id)||encounter.objects?.find(t=>t.token_id===input.target_token_id);
    const record={id:input.request_id,encounter_id:encounter.id,session_id:encounter.initiative.session_id,token_id:tokenId,name:token.name,label,target_name:target?.name,kind,input,status:'pending',created_at:new Date().toISOString()};
    this.save(record,fingerprint);return {approval_required:true,approval:record};
  }
  decide(id,decision,role) {
    check(['approve','reject','cancel'].includes(decision),'Unknown approval decision.');
    check(role==='gm'||decision==='cancel','Only the DM can approve or reject rolls.',403);
    const record=this.get(id);if(record.status!=='pending')return record;
    const fingerprint=this.db.prepare('SELECT fingerprint FROM turn_approvals WHERE id=?').get(id).fingerprint;
    if(decision!=='approve') {record.status=decision==='cancel'?'cancelled':'rejected';record.reason=decision==='cancel'?'Roll request cancelled.':'DM declined this out-of-turn roll.';}
    else {
      try {record.result=this.execute(record.kind,record.token_id,record.input,'player');record.status='approved';}
      catch(error) {if(!error.status)throw error;record.status='failed';record.reason=error.message;}
    }
    record.decided_at=new Date().toISOString();return this.save(record,fingerprint);
  }
}
