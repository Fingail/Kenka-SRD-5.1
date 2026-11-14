import { createHash } from 'node:crypto';
import { check, normalizeSheet } from './core.mjs';
export class SheetImports {
  constructor({ db, tokenFor, saveEncounter, isPreparing = () => false }) {
    Object.assign(this, { db, tokenFor, saveEncounter, isPreparing });
    db.exec('CREATE TABLE IF NOT EXISTS sheet_imports(id TEXT PRIMARY KEY,fingerprint TEXT NOT NULL,encounter_id TEXT NOT NULL,result TEXT NOT NULL)');
  }
  import(tokenId, input, role) {
    check(role === 'gm', 'Only the GM can import statblocks.', 403);
    check(Object.keys(input).every(k => ['request_id', 'sheet', 'expected_revision'].includes(k)) && typeof input.request_id === 'string' && /^[a-f0-9-]{36}$/.test(input.request_id), 'Invalid import request.');
    const fingerprint = createHash('sha256').update(JSON.stringify({ tokenId, input })).digest('hex');
    const { encounter, token } = this.tokenFor(tokenId);
    check(token.role === 'pc', 'NPC definitions use their Kanka combat sheet or other properties; JSON imports are for PCs.', 409);
    const prior = this.db.prepare('SELECT * FROM sheet_imports WHERE id=?').get(input.request_id);
    if (prior) { check(prior.fingerprint === fingerprint, 'Request ID already used.', 409); return JSON.parse(prior.result); }
    check(!this.isPreparing() && encounter.status === 'ready' && encounter.revision === input.expected_revision, 'Encounter changed; reload before importing.', 409);
    const profile = normalizeSheet(input.sheet, { id: token.entity_id, campaign_id: 2, name: token.name });
    check(profile.stats.hp_max >= token.hp_current, 'Reduce current HP before importing a smaller HP maximum.', 409);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (const key of ['saving_throws', 'skills', 'proficiencies', 'features', 'review_notes', 'advanced_actions', 'damage_traits']) delete token[key];
      Object.assign(token, profile, { sheet_origin: 'Imported PC JSON' });
      encounter.sheet_overrides ||= {}; encounter.sheet_overrides[token.entity_id] = { sheet: input.sheet, imported_at: new Date().toISOString() };
      encounter.revision += 1; this.saveEncounter(encounter);
      const result = { token_id: tokenId, name: token.name, revision: encounter.revision, attacks: profile.attacks.length, skills: profile.skills?.length || 0 };
      this.db.prepare('INSERT INTO sheet_imports VALUES(?,?,?,?)').run(input.request_id, fingerprint, encounter.id, JSON.stringify(result));
      this.db.exec('COMMIT'); return result;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
}
