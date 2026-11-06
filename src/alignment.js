(function(root){
  'use strict';
  // Use the rotated body bounds. Balloon tails do not shift the dialogue's center.
  function bounds(o){
    const a=(o.rotation||0)*Math.PI/180,c=Math.abs(Math.cos(a)),s=Math.abs(Math.sin(a));
    const w=o.w*c+o.h*s,h=o.w*s+o.h*c,cx=o.x+o.w/2,cy=o.y+o.h/2;
    return {left:cx-w/2,right:cx+w/2,top:cy-h/2,bottom:cy+h/2,cx,cy};
  }
  const axes={x:['left','cx','right'],y:['top','cy','bottom']};
  function targets(o,objects,page,axis){
    const size=axis==='x'?page.width:page.height;
    const list=[0,size/2,size].map((value,index)=>({value,index,source:'page',span:[0,axis==='x'?page.height:page.width]}));
    for(const other of objects){
      if(other.id===o.id||other.visible===false)continue;
      const b=bounds(other),span=axis==='x'?[b.top,b.bottom]:[b.left,b.right];
      axes[axis].forEach((key,index)=>list.push({value:b[key],index,source:'object',objectId:other.id,span}));
    }
    return list;
  }
  function nearest(values,list,tolerance){
    let best=null;
    for(const [index,value] of values.entries())for(const target of list){
      const delta=target.value-value,distance=Math.abs(delta);
      if(distance>tolerance)continue;
      const rank=(target.source==='page'&&target.index===1?0:1)+(index===target.index?0:2);
      if(!best||distance<best.distance-1e-7||(Math.abs(distance-best.distance)<1e-7&&rank<best.rank))best={delta,distance,rank,target,index};
    }
    return best;
  }
  function guide(axis,match,b){
    const span=axis==='x'?[b.top,b.bottom]:[b.left,b.right],t=match.target;
    return {axis,value:t.value,from:Math.min(t.span[0],span[0]),to:Math.max(t.span[1],span[1]),source:t.source,center:t.index===1,objectId:t.objectId};
  }
  function snapMove(o,objects,page,tolerance){
    const b=bounds(o),x=nearest(axes.x.map(k=>b[k]),targets(o,objects,page,'x'),tolerance),y=nearest(axes.y.map(k=>b[k]),targets(o,objects,page,'y'),tolerance);
    const result={x:o.x+(x?.delta||0),y:o.y+(y?.delta||0)},after=bounds({...o,...result});
    return {...result,guides:[x&&guide('x',x,after),y&&guide('y',y,after)].filter(Boolean)};
  }
  function snapResize(before,o,handle,objects,page,tolerance,keepAspect=false){
    if(Math.abs((o.rotation||0)%360)>1e-6)return {...o,guides:[]};
    const west=handle.includes('w'),north=handle.includes('n'),anchorX=west?before.x+before.w:before.x,anchorY=north?before.y+before.h:before.y;
    const edgeX=west?o.x:o.x+o.w,edgeY=north?o.y:o.y+o.h;
    const mx=nearest([edgeX],targets(o,objects,page,'x'),tolerance),my=nearest([edgeY],targets(o,objects,page,'y'),tolerance);
    let w=o.w+(mx?mx.delta*(west?-1:1):0),h=o.h+(my?my.delta*(north?-1:1):0);
    if(keepAspect){
      if(mx&&(!my||mx.distance<=my.distance))h=w*before.h/before.w;
      else if(my)w=h*before.w/before.h;
    }
    w=Math.max(10,Math.min(16000,w));h=Math.max(10,Math.min(16000,h));
    const result={...o,x:west?anchorX-w:anchorX,y:north?anchorY-h:anchorY,w,h},b=bounds(result),guides=[];
    if(mx&&Math.abs((west?result.x:result.x+w)-mx.target.value)<.01)guides.push(guide('x',mx,b));
    if(my&&Math.abs((north?result.y:result.y+h)-my.target.value)<.01)guides.push(guide('y',my,b));
    return {...result,guides};
  }
  const angleDelta=(from,to)=>((to-from+180)%360+360)%360-180;
  const displayAngle=angle=>((angle%360)+360)%360;
  function snapRotation(angle,o,objects,{enabled=true,forceStep=false,tolerance=3}={}){
    if(forceStep){const rotation=Math.round(angle/15)*15;return {rotation,guide:{source:'step',angle:displayAngle(rotation)}};}
    if(!enabled)return {rotation:angle,guide:null};
    const candidates=Array.from({length:24},(_,i)=>({angle:i*15,source:'step'}));
    for(const other of objects){
      if(other.id===o.id||other.visible===false)continue;
      for(const offset of [0,90,180,270])candidates.push({angle:displayAngle((other.rotation||0)+offset),source:'object',objectId:other.id,perpendicular:offset%180===90});
    }
    let best=null;
    for(const candidate of candidates){
      const delta=angleDelta(angle,candidate.angle),distance=Math.abs(delta);
      if(distance<=tolerance&&(!best||distance<best.distance-1e-7))best={...candidate,delta,distance};
    }
    return best?{rotation:best.angle+Math.round((angle-best.angle)/360)*360,guide:best}:{rotation:angle,guide:null};
  }
  const api={bounds,snapMove,snapResize,snapRotation,angleDelta,displayAngle};
  if(typeof module!=='undefined')module.exports=api;else root.Alignment=api;
})(typeof window!=='undefined'?window:globalThis);
