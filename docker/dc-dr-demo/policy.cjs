// SPDX-License-Identifier: GPL-3.0-only
// Shared policy used by the native DiceCloud bridge and focused tests.
const band = (hp, max) => hp > max / 2 ? 'green' : hp > max / 4 ? 'yellow' : 'red';
const health = (hp, max) => ({ color: band(hp,max), label: hp <= 0 ? 'Down' : band(hp,max)==='green' ? 'Good' : band(hp,max)==='yellow' ? 'Not Good' : 'Bad' });
const controls = (user, profile, gm) => gm || (profile.kind === 'pc' && profile.ownerId === user);
const canMove = (user, profile, state, gm) => gm || (controls(user,profile,false) && (!state.combat.active || (state.combat.phase==='playing' && state.combat.current === profile.creatureId)));
const needsApproval = (user, profile, state, gm, kind) => !gm && kind!=='initiative' && state.combat.active && (state.combat.phase!=='playing' || state.combat.current!==profile.creatureId);
const sortOrder = rows => [...rows].sort((a,b)=>b.total-a.total || b.dex-a.dex || a.creatureId.localeCompare(b.creatureId));
const deathRoll = (prior, natural, total) => {
 const d={successes:0,failures:0,stable:false,dead:false,...prior};
 if(d.dead||d.stable)return d;
 if(natural===20)return {successes:0,failures:0,stable:false,dead:false,revive:true};
 if(natural===1)d.failures+=2;else if(total>=10)d.successes++;else d.failures++;
 d.failures=Math.min(3,d.failures);d.successes=Math.min(3,d.successes);d.dead=d.failures>=3;d.stable=!d.dead&&d.successes>=3;return d;
};
module.exports={band,health,controls,canMove,needsApproval,sortOrder,deathRoll};
