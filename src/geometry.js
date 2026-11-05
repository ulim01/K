(function (root) {
  'use strict';
  const clamp = (n, min, max) => Math.min(max, Math.max(min, Number.isFinite(+n) ? +n : min));
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num = n => Math.round(n * 1000) / 1000;
  const point = p => `${num(p.x)},${num(p.y)}`;
  function perimeter(shape, w, h, a) {
    let x, y;
    const c = Math.cos(a), s = Math.sin(a);
    if (['round','box','caption'].includes(shape)) {
      const power = shape === 'round' ? .42 : .13;
      x = Math.sign(c) * Math.abs(c) ** power; y = Math.sign(s) * Math.abs(s) ** power;
    } else if (shape === 'cloud' || shape === 'thought') {
      const r = .94 + .06 * Math.cos(a * 12);
      x = c * r; y = s * r;
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
    const tail = o.tail !== false && o.shape !== 'caption' && o.shape !== 'thought';
    const t=tailGeometry(o), steps=o.shape==='burst'?288:192;
    const a0=tail?t.a+t.delta:0, length=tail?Math.PI*2-t.delta*2:Math.PI*2;
    let d='';
    for(let i=0;i<=steps;i++) {
      const p=perimeter(o.shape,o.w,o.h,a0+length*i/steps);
      d+=(i?' L':'M')+point(p);
    }
    if(tail) {
      const v={x:(t.end.x-t.start.x)*.24,y:(t.end.y-t.start.y)*.24};
      d+=` Q${point({x:t.control.x+v.x,y:t.control.y+v.y})} ${point(t.tip)} Q${point({x:t.control.x-v.x,y:t.control.y-v.y})} ${point(t.start)}`;
    }
    return d+' Z';
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
  function validateProject(p) {
    if(!p || p.format!=='panel-studio' || p.version!==1 || !Array.isArray(p.pages) || !p.pages.length || p.pages.length>200) throw Error('Panel Studio 프로젝트 파일이 아닙니다. (최대 200페이지)');
    const ids=new Set(),types=['bubble','text','sfx','image','shape','pen','effect'];
    for(const page of p.pages) {
      if(!page || !Number.isInteger(page.width)||!Number.isInteger(page.height)||page.width<1||page.height<1||page.width>8000||page.height>8000||!Array.isArray(page.objects)||page.objects.length>3000) throw Error('페이지 크기 또는 레이어 수가 올바르지 않습니다.');
      if(!/^[\w-]{1,80}$/.test(page.id)||ids.has(page.id)) throw Error('페이지 ID가 올바르지 않습니다.');
      ids.add(page.id);
      if(!/^#[\da-f]{6}$/i.test(page.background)) throw Error('배경색이 올바르지 않습니다.');
      for(const o of page.objects) {
        if(!o||!types.includes(o.type)||!/^[\w-]{1,80}$/.test(o.id)||ids.has(o.id)) throw Error('레이어 형식이 올바르지 않습니다.');
        ids.add(o.id);
        for(const k of ['x','y','w','h']) if(!Number.isFinite(o[k])||Math.abs(o[k])>100000) throw Error('레이어 좌표가 올바르지 않습니다.');
        if(o.w<1||o.h<1) throw Error('레이어 크기가 올바르지 않습니다.');
        if(o.text && (typeof o.text!=='string'||o.text.length>20000)) throw Error('텍스트가 너무 깁니다.');
        for(const k of ['fill','stroke','color','textStroke']) if(o[k]&&!/^#[\da-f]{6}$/i.test(o[k])) throw Error('레이어 색상이 올바르지 않습니다.');
        const bounds={rotation:[-36000,36000],opacity:[0,1],strokeWidth:[0,200],fontSize:[1,1500],weight:[100,900],lineHeight:[.5,4],letterSpacing:[-50,200],textStrokeWidth:[0,100],padding:[0,2000],tailX:[-100,100],tailY:[-100,100],bendX:[-100,100],bendY:[-100,100],tailAngle:[-36000,36000],tailWidth:[1,2000],imageZoom:[.1,20],imageX:[-10,10],imageY:[-10,10],fade:[0,1],fadeAngle:[-36000,36000],fadeStart:[0,.99],skew:[-60,60],density:[5,150],seed:[0,100000]};
        for(const [key,[lo,hi]] of Object.entries(bounds)) if(o[key]!==undefined&&(!Number.isFinite(o[key])||o[key]<lo||o[key]>hi)) throw Error(`레이어 속성이 올바르지 않습니다: ${key}`);
        if(o.points && (!Array.isArray(o.points)||o.points.length>20000||o.points.some(a=>!Array.isArray(a)||a.length!==2||a.some(n=>!Number.isFinite(n)||Math.abs(n)>100)))) throw Error('편집점 데이터가 올바르지 않습니다.');
      }
    }
    if(!p.assets||typeof p.assets!=='object'||Array.isArray(p.assets)) throw Error('이미지 정보가 없습니다.');
    for(const [id,a] of Object.entries(p.assets)) {
      if(!/^[\w-]{1,80}$/.test(id)||!a||typeof a.src!=='string'||!/^data:image\/(png|jpeg|webp|gif|bmp);base64,[\w+/=]+$/.test(a.src)||!Number.isFinite(a.width)||!Number.isFinite(a.height)||a.width<1||a.height<1) throw Error('이미지 데이터가 올바르지 않습니다.');
    }
    for(const page of p.pages) for(const o of page.objects) if(o.type==='image'&&!Object.hasOwn(p.assets,o.assetId)) throw Error('이미지 파일이 누락되었습니다.');
    if(p.fonts && (!Array.isArray(p.fonts)||p.fonts.length>100||p.fonts.some(f=>!f||typeof f.name!=='string'||typeof f.data!=='string'||!/^data:(font\/[\w.-]+|application\/[\w.-]+);base64,[\w+/=]+$/.test(f.data)))) throw Error('글꼴 데이터가 올바르지 않습니다.');
    return p;
  }
  const api={clamp,esc,num,point,perimeter,tailGeometry,bubblePath,polygonPath,crops,wrapText,localPoint,validateProject};
  if(typeof module!=='undefined') module.exports=api; else root.G=api;
})(typeof window!=='undefined'?window:globalThis);
