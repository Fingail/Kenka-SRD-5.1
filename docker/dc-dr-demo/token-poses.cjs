// SPDX-License-Identifier: GPL-3.0-only
// Persist only the visual down/upright transition; never change native HP.
module.exports=({get,put,rotate,onError})=>{
 let busy=false;
 return async(tabletopId,actors)=>{
  if(busy)return;busy=true;
  try{for(const actor of actors){
   if(!actor.tokenId||!Number.isFinite(actor.hp))continue;
   const id=tabletopId+':'+actor.tokenId,previous=await get(id),down=actor.hp<=0;
   if(previous&&previous.down===down)continue;
   if(down||previous&&previous.down)await rotate(actor.tokenId,down?90:0);
   await put(id,{tabletopId,tokenId:actor.tokenId,down});
  }}catch(error){onError(error);}finally{busy=false;}
 };
};
