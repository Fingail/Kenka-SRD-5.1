// HP is authoritative in the handler. Reconcile its zero-HP marker into DR's
// persisted token rotation, independently of the attack transaction/network.
export class TokenStatusSync {
  constructor({ listEncounters, client, db, markers = new Map(), recoveries = new Set(), isPreparing = () => false, onError = () => {} }) {
    Object.assign(this, { listEncounters, client, db, markers, recoveries, isPreparing, onError });
    if (db) db.exec('CREATE TABLE IF NOT EXISTS token_death_rotation(map_id TEXT,token_id TEXT,original_rotation REAL NOT NULL,PRIMARY KEY(map_id,token_id))');
    if (db) db.exec('CREATE TABLE IF NOT EXISTS token_rotation_recovery(map_id TEXT,token_id TEXT,PRIMARY KEY(map_id,token_id))');
    this.running = false;
  }
  original(mapId, tokenId) { return this.db ? this.db.prepare('SELECT original_rotation FROM token_death_rotation WHERE map_id=? AND token_id=?').get(mapId,tokenId)?.original_rotation : this.markers.get(mapId + ':' + tokenId); }
  remember(mapId, tokenId, rotation) { if (this.db) this.db.prepare('INSERT OR IGNORE INTO token_death_rotation VALUES(?,?,?)').run(mapId,tokenId,rotation); else this.markers.set(mapId + ':' + tokenId,rotation); }
  forget(mapId, tokenId) { if (this.db) this.db.prepare('DELETE FROM token_death_rotation WHERE map_id=? AND token_id=?').run(mapId,tokenId); else this.markers.delete(mapId + ':' + tokenId); }
  scheduleRecovery(mapId, tokenId) { if (this.db) this.db.prepare('INSERT OR IGNORE INTO token_rotation_recovery VALUES(?,?)').run(mapId,tokenId); else this.recoveries.add(mapId + ':' + tokenId); }
  recovering(mapId, tokenId) { return this.db ? !!this.db.prepare('SELECT token_id FROM token_rotation_recovery WHERE map_id=? AND token_id=?').get(mapId,tokenId) : this.recoveries.has(mapId + ':' + tokenId); }
  finishRecovery(mapId, tokenId) { if (this.db) this.db.prepare('DELETE FROM token_rotation_recovery WHERE map_id=? AND token_id=?').run(mapId,tokenId); else this.recoveries.delete(mapId + ':' + tokenId); }
  async sync() {
    if (this.running || this.isPreparing()) return;
    this.running = true;
    try {
      const maps = new Map();
      for (const encounter of this.listEncounters()) {
        if (encounter.status !== 'ready' || !encounter.map?.id) continue;
        for (const token of encounter.tokens) {
          if (token.role === 'object' || !Number.isFinite(token.hp_current)) continue;
          const down = token.hp_current <= 0;
          if (!down && this.original(encounter.map.id, token.token_id) === undefined && !this.recovering(encounter.map.id,token.token_id)) continue;
          if (!maps.has(encounter.map.id)) maps.set(encounter.map.id, new Map());
          maps.get(encounter.map.id).set(token.token_id, down);
        }
      }
      for (const [mapId, ids] of maps) {
        try {
          const map = (await (await this.client.http(`/api/map/${encodeURIComponent(mapId)}`)).json()).data;
          for (const token of map.tokens) {
            if (!ids.has(token.id)) continue;
            const down = ids.get(token.id);
            let original = this.original(mapId, token.id);
            if (down && original === undefined) { original = Number.isFinite(token.rotation) && Math.abs(token.rotation - 90) > 2 ? token.rotation : 0; this.remember(mapId,token.id,original); }
            if (!down && original === undefined) original = Number.isFinite(token.rotation) && Math.abs(token.rotation - 90) > 2 ? token.rotation : 0;
            if (!down && Math.abs(original - 90) <= 2) original = 0;
            const rotation = down ? 90 : original;
            if (token.rotation !== rotation) await this.client.http(`/api/map/${encodeURIComponent(mapId)}/token/${encodeURIComponent(token.id)}`, {
              method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rotation }),
            });
            if (!down) { this.forget(mapId,token.id); this.finishRecovery(mapId,token.id); }
          }
        } catch (error) { this.onError(error); }
      }
    } catch (error) { this.onError(error); }
    finally { this.running = false; }
  }
}
