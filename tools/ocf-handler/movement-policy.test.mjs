import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenCanMove, movementPolicy, movementAllowed } from './movement-policy.mjs';
test('PC movement follows the active turn; GM, free play and ended combat retain normal native permissions',()=>{
  const pc={token_id:'pc',role:'pc',hp_current:10}, other={...pc,token_id:'other'},npc={token_id:'npc',role:'enemy',hp_current:10};
  const encounter={map:{id:'map'},tokens:[pc,other,npc],initiative:{status:'active',current_token_id:'pc'}};
  assert.equal(tokenCanMove(encounter,pc,'player'),true);assert.equal(tokenCanMove(encounter,other,'player'),false);assert.equal(tokenCanMove(encounter,npc,'player'),false);
  assert.equal(tokenCanMove(encounter,other,'gm'),true);assert.equal(tokenCanMove(encounter,{...pc,hp_current:0},'player'),false);
  assert.equal(movementAllowed([encounter],'map','unknown','player'),false);assert.equal(movementAllowed([encounter],'other-map','unknown','player'),true);
  assert.deepEqual(movementPolicy([encounter],'player').tokens,{pc:true,other:false,npc:false});
  encounter.initiative.status='rolling';assert.equal(tokenCanMove(encounter,pc,'player'),false);
  encounter.initiative.status='ended';assert.equal(tokenCanMove(encounter,other,'player'),true);
  delete encounter.initiative;assert.equal(tokenCanMove(encounter,other,'player'),true);
});
