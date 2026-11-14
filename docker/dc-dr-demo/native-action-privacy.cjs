// SPDX-License-Identifier: GPL-3.0-only
// Action IDs seed native dice. Keep other players' action documents private,
// including through singleCharacter, even before a roll is committed.
module.exports=({Meteor,C,T,R,EA,cfg})=>{
 for(const name of ['tabletop','singleCharacter']){
  const original=Meteor.server.publish_handlers[name];if(!original)continue;
  Meteor.server.publish_handlers[name]=function(...args){
   const self=this,autorun=self.autorun;
   self.autorun=function(callback,...options){return autorun.call(self,function(...values){
    const cursors=callback.apply(this,values),room=R.findOne(cfg.instance);
    if(!room||!Array.isArray(cursors))return cursors;
    const table=T.findOne(room.tabletopId),gm=table&&(table.owner===self.userId||(table.gameMasters||[]).includes(self.userId));
    if(gm)return cursors;
    const allowed=C.find({tabletopId:room.tabletopId,$or:[{owner:self.userId},{writers:self.userId}]}).fetch().map(c=>c._id);
    return cursors.map(cursor=>{const d=cursor?._cursorDescription;if(d?.collectionName!=='actions')return cursor;return EA.find({$and:[d.selector,{$or:[{tabletopId:{$ne:room.tabletopId}},{creatureId:{$in:allowed}}]}]},d.options);});
   },...options);};
   try{return original.apply(self,args);}finally{self.autorun=autorun;}
  };
 }
};
