(function (root) {
  'use strict';
  const catalog=typeof module!=='undefined'?require('./bubble-presets.js'):root.BubbleCatalog;
  const clamp = (n, min, max) => Math.min(max, Math.max(min, Number.isFinite(+n) ? +n : min));
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num = n => Math.round(n * 1000) / 1000;
  const point = p => `${num(p.x)},${num(p.y)}`;
  function perimeter(shape, w, h, a) {
    if(catalog.get(shape)){const p=catalog.intersection(shape,a);if(p)return {...p,x:p.x*w,y:p.y*h};}
    let x, y;
    const c = Math.cos(a), s = Math.sin(a);
    if (shape === 'caption') {
      const radius=1/Math.max(Math.abs(c),Math.abs(s)); x=c*radius; y=s*radius;
    } else if (['round','box'].includes(shape)) {
      const power = shape === 'round' ? .42 : .13;
      x = Math.sign(c) * Math.abs(c) ** power; y = Math.sign(s) * Math.abs(s) ** power;
    } else if (shape === 'cloud') {
      // The outer edge of eight overlapping circular lobes makes broad, soft puffs.
      let radius=.72;
      for(let i=0;i<8;i++) {
        const angle=i*Math.PI/4, cx=.64*Math.cos(angle), cy=.64*Math.sin(angle);
        const projection=cx*c+cy*s, discriminant=.36**2-(cx*cx+cy*cy-projection*projection);
        if(discriminant>=0)radius=Math.max(radius,projection+Math.sqrt(discriminant));
      }
      x=c*radius; y=s*radius;
    } else if (shape === 'burst') {
      const wave = Math.abs(((a / (Math.PI * 2) * 18) % 1 + 1) % 1 - .5) * 2;
      const r = .8 + .2 * wave; x = c * r; y = s * r;
    } else { x = c; y = s; }
    return {x:w / 2 + x * w / 2,y:h / 2 + y * h / 2};
  }
  function tailGeometry(o) {
    const a = (o.tailAngle ?? 65) * Math.PI / 180;
    const delta = clamp((o.tailWidth ?? 36) / ((o.w + o.h) / 2), .025, .8);
    const start = perimeter(o.shape, o.w, o.h, a + delta);
    const end = perimeter(o.shape, o.w, o.h, a - delta);
    const base = {x:(start.x+end.x)/2,y:(start.y+end.y)/2};
    const tip = {x:(o.tailX ?? .95)*o.w,y:(o.tailY ?? 1.55)*o.h};
    const control = {x:(base.x+tip.x)/2+(o.bendX||0)*o.w,y:(base.y+tip.y)/2+(o.bendY||0)*o.h};
    return {a,delta,start,end,base,tip,control};
  }
  function bubblePath(o) {
    if(o.shape==='caption')return `M0,0 L${num(o.w)},0 L${num(o.w)},${num(o.h)} L0,${num(o.h)} Z`;
    const tail = o.tail !== false && o.shape !== 'caption' && !dottedTail(o);
    const t=tailGeometry(o), steps=o.shape==='burst'?288:192;
    const custom=catalog.outline(o.shape);
    if(custom){
      let d='';
      if(tail&&t.start.edge!==undefined&&t.end.edge!==undefined){
        d='M'+point(t.start);let count=(t.end.edge-t.start.edge+custom.length)%custom.length;
        if(!count&&t.end.t<=t.start.t)count=custom.length;
        for(let i=1;i<=count;i++){const p=custom[(t.start.edge+i)%custom.length];d+=' L'+point({x:p[0]*o.w,y:p[1]*o.h});}
        d+=' L'+point(t.end)+tailCurves(t);
      }else d=custom.map((p,i)=>(i?' L':'M')+point({x:p[0]*o.w,y:p[1]*o.h})).join('');
      return d+' Z';
    }
    const a0=tail?t.a+t.delta:0, length=tail?Math.PI*2-t.delta*2:Math.PI*2;
    let d='';
    for(let i=0;i<=steps;i++) {
      const p=perimeter(o.shape,o.w,o.h,a0+length*i/steps);
      d+=(i?' L':'M')+point(p);
    }
    if(tail)d+=tailCurves(t);
    return d+' Z';
  }
  function tailCurves(t){
    const v={x:(t.end.x-t.start.x)*.24,y:(t.end.y-t.start.y)*.24};
    return ` Q${point({x:t.control.x+v.x,y:t.control.y+v.y})} ${point(t.tip)} Q${point({x:t.control.x-v.x,y:t.control.y-v.y})} ${point(t.start)}`;
  }
  function dottedTail(o){return o.shape==='thought'||o.tailStyle==='dots';}
  function textAreas(o){
    const regions=o.type==='bubble'?catalog.get(o.shape)?.regions:null;
    return (regions||[[0,0,1,1]]).map((r,i)=>({x:r[0]*o.w,y:r[1]*o.h,w:r[2]*o.w,h:r[3]*o.h,key:i?'text2':'text'}));
  }
  function thoughtTail(o) {
    if(o.tail===false)return [];
    const t=tailGeometry(o);
    return [1,2,3].map(i=>{
      const f=i/3,u=1-f,r=(4-i)*Math.max(1.25,(o.tailWidth||34)/8);
      return {x:u*u*t.base.x+2*u*f*t.control.x+f*f*t.tip.x,y:u*u*t.base.y+2*u*f*t.control.y+f*f*t.tip.y,rx:r,ry:r*.78};
    });
  }
  function polygonPath(points,w,h) {return points.map((p,i)=>`${i?'L':'M'}${num(p[0]*w)},${num(p[1]*h)}`).join(' ')+' Z';}
  const crops={rectangle:[[0,0],[1,0],[1,1],[0,1]],trapezoid:[[.16,0],[.84,0],[1,1],[0,1]],parallelogram:[[.2,0],[1,0],[.8,1],[0,1]],diamond:[[.5,0],[1,.5],[.5,1],[0,.5]],triangle:[[.5,0],[1,1],[0,1]],hexagon:[[.25,0],[.75,0],[1,.5],[.75,1],[.25,1],[0,.5]]};
  function wrapText(text,width,fontSize,measure) {
    const lines=[];
    for(const paragraph of String(text).split('\n')) {
      let line='';
      for(const c of Array.from(paragraph)) {
        if(line && measure(line+c)>width) {lines.push(line);line=c;} else line+=c;
      }
      lines.push(line);
    }
    return lines;
  }
  function localPoint(o,p) {
    const a=-(o.rotation||0)*Math.PI/180, dx=p.x-o.x-o.w/2,dy=p.y-o.y-o.h/2;
    return {x:dx*Math.cos(a)-dy*Math.sin(a)+o.w/2,y:dx*Math.sin(a)+dy*Math.cos(a)+o.h/2};
  }
  function imagePlacement(o,asset){
    const scale=Math.max(o.w/asset.width,o.h/asset.height)*(o.imageZoom||1),w=asset.width*scale,h=asset.height*scale;
    return {x:(o.w-w)/2+(o.imageX||0)*o.w,y:(o.h-h)/2+(o.imageY||0)*o.h,w,h};
  }
  function containsPoint(o,p){
    const q=localPoint(o,p),x=q.x/o.w,y=q.y/o.h;
    if(o.crop==='ellipse')return ((x-.5)*2)**2+((y-.5)*2)**2<=1;
    const pts=o.points||crops.rectangle;let inside=false;
    for(let i=0,j=pts.length-1;i<pts.length;j=i++){
      const [xi,yi]=pts[i],[xj,yj]=pts[j];
      if(Math.abs((x-xi)*(yj-yi)-(y-yi)*(xj-xi))<1e-8&&x>=Math.min(xi,xj)&&x<=Math.max(xi,xj)&&y>=Math.min(yi,yj)&&y<=Math.max(yi,yj))return true;
      if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;
    }
    return inside;
  }
  function resizeImage(o,asset,handle,p){
    const b=imagePlacement(o,asset),west=handle.endsWith('nw')||handle.endsWith('sw'),north=handle.endsWith('nw')||handle.endsWith('ne');
    const ax=b.x+(west?b.w:0),ay=b.y+(north?b.h:0),vx=(west?-1:1)*b.w,vy=(north?-1:1)*b.h;
    const factor=((p.x-ax)*vx+(p.y-ay)*vy)/(vx*vx+vy*vy),imageZoom=clamp((o.imageZoom||1)*factor,.1,20);
    const scale=imageZoom/(o.imageZoom||1),w=b.w*scale,h=b.h*scale,x=ax-(west?w:0),y=ay-(north?h:0);
    return {imageZoom,imageX:clamp((x-(o.w-w)/2)/o.w,-100,100),imageY:clamp((y-(o.h-h)/2)/o.h,-100,100)};
  }
  function validateProject(p) {
    if(!p || p.format!=='panel-studio' || p.version!==1 || !Array.isArray(p.pages) || !p.pages.length || p.pages.length>200) throw Error('Panel Studio 프로젝트 파일이 아닙니다. (최대 200페이지)');
    const ids=new Set(),types=['bubble','text','sfx','image','shape','pen','effect'];
    for(const page of p.pages) {
      if(!page || !Number.isInteger(page.width)||!Number.isInteger(page.height)||page.width<1||page.height<1||page.width>8000||page.height>8000||!Array.isArray(page.objects)||page.objects.length>3000) throw Error('페이지 크기 또는 레이어 수가 올바르지 않습니다.');
      if(typeof page.id!=='string'||!/^[\w-]{1,80}$/.test(page.id)||ids.has(page.id)) throw Error('페이지 ID가 올바르지 않습니다.');
      ids.add(page.id);
      if(!/^#[\da-f]{6}$/i.test(page.background)) throw Error('배경색이 올바르지 않습니다.');
      for(const o of page.objects) {
        if(!o||!types.includes(o.type)||typeof o.id!=='string'||!/^[\w-]{1,80}$/.test(o.id)||ids.has(o.id)) throw Error('레이어 형식이 올바르지 않습니다.');
        ids.add(o.id);
        for(const k of ['x','y','w','h']) if(!Number.isFinite(o[k])||Math.abs(o[k])>100000) throw Error('레이어 좌표가 올바르지 않습니다.');
        if(o.w<1||o.h<1) throw Error('레이어 크기가 올바르지 않습니다.');
        for(const key of ['text','text2'])if(o[key]!==undefined && (typeof o[key]!=='string'||o[key].length>20000)) throw Error('텍스트가 올바르지 않습니다.');
        if(o.tailStyle!==undefined&&!['solid','dots'].includes(o.tailStyle))throw Error('말풍선 꼬리 형식이 올바르지 않습니다.');
        for(const k of ['font','name','shape','crop','align','effect'])if(o[k]!==undefined&&(typeof o[k]!=='string'||o[k].length>200))throw Error('레이어 이름 또는 스타일이 올바르지 않습니다.');
        for(const k of ['fill','stroke','color','textStroke']) if(o[k]&&!/^#[\da-f]{6}$/i.test(o[k])) throw Error('레이어 색상이 올바르지 않습니다.');
        const bounds={rotation:[-36000,36000],opacity:[0,1],strokeWidth:[0,200],fontSize:[1,1500],weight:[100,900],lineHeight:[.5,4],letterSpacing:[-50,200],textStrokeWidth:[0,100],padding:[0,2000],tailX:[-100,100],tailY:[-100,100],bendX:[-100,100],bendY:[-100,100],tailAngle:[-36000,36000],tailWidth:[1,2000],imageZoom:[.1,20],imageX:[-100,100],imageY:[-100,100],fade:[0,1],fadeAngle:[-36000,36000],fadeStart:[0,.99],skew:[-60,60],density:[5,150],seed:[0,100000]};
        for(const [key,[lo,hi]] of Object.entries(bounds)) if(o[key]!==undefined&&(!Number.isFinite(o[key])||o[key]<lo||o[key]>hi)) throw Error(`레이어 속성이 올바르지 않습니다: ${key}`);
        if(o.points && (!Array.isArray(o.points)||o.points.length>20000||o.points.some(a=>!Array.isArray(a)||a.length!==2||a.some(n=>!Number.isFinite(n)||Math.abs(n)>100)))) throw Error('편집점 데이터가 올바르지 않습니다.');
      }
    }
    if(!p.assets||typeof p.assets!=='object'||Array.isArray(p.assets)) throw Error('이미지 정보가 없습니다.');
    for(const [id,a] of Object.entries(p.assets)) {
      if(!/^[\w-]{1,80}$/.test(id)||!a||typeof a.src!=='string'||!/^data:image\/(png|jpeg|webp|gif|bmp);base64,[\w+/=]+$/.test(a.src)||!Number.isFinite(a.width)||!Number.isFinite(a.height)||a.width<1||a.height<1) throw Error('이미지 데이터가 올바르지 않습니다.');
    }
    for(const page of p.pages) for(const o of page.objects) if((o.type==='image'||(o.type==='shape'&&o.assetId!==undefined))&&(typeof o.assetId!=='string'||!Object.hasOwn(p.assets,o.assetId))) throw Error('이미지 파일이 누락되었습니다.');
    if(p.fonts && (!Array.isArray(p.fonts)||p.fonts.length>100||p.fonts.some(f=>!f||typeof f.name!=='string'||typeof f.data!=='string'||!/^data:(font\/[\w.-]+|application\/[\w.-]+);base64,[\w+/=]+$/.test(f.data)))) throw Error('글꼴 데이터가 올바르지 않습니다.');
    for(const f of p.fonts||[])if(!f.name.trim()||f.name.length>200||(f.weight!==undefined&&(!Number.isFinite(f.weight)||f.weight<100||f.weight>900)))throw Error('글꼴 이름 또는 굵기가 올바르지 않습니다.');
    return p;
  }
  const api={clamp,esc,num,point,perimeter,tailGeometry,thoughtTail,dottedTail,textAreas,bubblePath,polygonPath,crops,wrapText,localPoint,imagePlacement,resizeImage,containsPoint,validateProject};
  if(typeof module!=='undefined') module.exports=api; else root.G=api;
})(typeof window!=='undefined'?window:globalThis);
