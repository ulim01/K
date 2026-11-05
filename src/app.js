/* Panel Studio — all editing and project storage stays on this device. */
(() => {
  'use strict';
  const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
  const {clamp,esc,num,bubblePath,polygonPath,tailGeometry,localPoint,wrapText,crops,validateProject}=G;
  const uid=()=> 'p'+crypto.getRandomValues(new Uint32Array(2)).join('');
  const clone=o=>JSON.parse(JSON.stringify(o));
  const labels={ellipse:'타원형',round:'둥근 사각형',cloud:'구름형',burst:'외침',thought:'생각',box:'사각형',whisper:'속삭임',caption:'내레이션'};
  const cropLabels={rectangle:'사각형',trapezoid:'사다리꼴',parallelogram:'평행사변형',diamond:'마름모',triangle:'삼각형',hexagon:'육각형',ellipse:'타원',custom:'자유 다각형'};
  const typeLabels={bubble:'말풍선',sfx:'효과음',text:'텍스트',image:'이미지',shape:'컷',pen:'펜',effect:'효과선'};
  const fontNames={'Nanum Gothic':'나눔고딕','Nanum Myeongjo':'나눔명조','Black Han Sans':'검은고딕','Do Hyeon':'도현','Jua':'주아','Gowun Dodum':'고운돋움','Gowun Batang':'고운바탕','Nanum Pen Script':'나눔손글씨 펜','Nanum Brush Script':'나눔손글씨 붓','Gaegu':'개구','Gamja Flower':'감자꽃'};
  const sfxPresets=[['쾅!','Black Han Sans','#f18a45',-10],['두근','Jua','#dc7891',0],['슈우욱','Nanum Brush Script','#3c688c',-12],['반짝','Gaegu','#c4a44d',0],['와장창!','Do Hyeon','#334440',-9],['사아아…','Nanum Pen Script','#61886d',0],['쿵','Black Han Sans','#423f59',-5],['철컥','Do Hyeon','#6a7782',0],['또각','Gowun Batang','#66543f',0],['우당탕!','Jua','#d0703f',-5],['휘이잉','Nanum Brush Script','#5b8c99',-12],['찌릿!','Do Hyeon','#bca135',-8]];
  const measureCanvas=document.createElement('canvas'),measureCtx=measureCanvas.getContext('2d');
  let project,selected=null,tab='bubbles',view='page',tool='select',mode='normal',zoom=.5,showGrid=false,snap=false,preview=false;
  let history=[],historyIndex=-1,drag=null,space=false,clipboard=null,autosaveTimer,toastTimer,dbPromise,dirty=false,saveGeneration=0;
  let penColor='#253b30',penWidth=6,exporting=false,booting=true;
  const fonts=[...(window.BUNDLED_FONTS||[])];
  const bundledFontNames=new Set(fonts.map(f=>f.name));
  const imageURLs=new Map();
  function imageURL(id) {
    const a=project.assets[id],cached=imageURLs.get(id);if(cached?.src===a.src)return cached.url;
    if(cached)URL.revokeObjectURL(cached.url);
    const [header,data]=a.src.split(','),raw=atob(data),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
    const url=URL.createObjectURL(new Blob([bytes],{type:header.slice(5,header.indexOf(';'))}));imageURLs.set(id,{src:a.src,url});return url;
  }
  function clearImageURLs(){for(const {url} of imageURLs.values())URL.revokeObjectURL(url);imageURLs.clear();}
  const page=()=>project.pages.find(p=>p.id===project.activePage)||project.pages[0];
  const object=()=>page().objects.find(o=>o.id===selected);
  function base(type,extra={}) {return {id:uid(),type,name:typeLabels[type],x:100,y:180,w:300,h:180,rotation:0,opacity:1,visible:true,locked:false,...extra};}
  function bubble(shape='ellipse',extra={}) {return base('bubble',{shape,fill:'#ffffff',stroke:'#243b31',strokeWidth:3,text:'여기에 대사를\n입력하세요.',font:'Nanum Gothic',fontSize:30,weight:400,color:'#23352f',align:'center',lineHeight:1.45,padding:25,tail:shape!=='caption',tailAngle:65,tailWidth:34,tailX:.92,tailY:1.5,bendX:0,bendY:0,...extra});}
  function textObject(text='새로운 이야기',extra={}) {return base('text',{text,font:'Nanum Gothic',fontSize:48,weight:400,color:'#23352f',align:'left',lineHeight:1.4,padding:0,letterSpacing:0,w:560,h:150,...extra});}
  function newPage(width=900,height=1400) {return {id:uid(),name:'새 페이지',width,height,background:'#ffffff',objects:[]};}
  function freshProject(demo=false) {
    const p=newPage();p.name='첫 번째 장면';
    const doc={format:'panel-studio',version:1,name:demo?'어느 낯선 날의 이야기':'나의 첫 번째 이야기',activePage:p.id,pages:[p],assets:{},fonts:[]};
    if(demo&&window.DEMO_ASSETS?.length) {
      const a=window.DEMO_ASSETS.find(a=>a.id==='demo-90')||window.DEMO_ASSETS[0];doc.assets[a.id]=a;
      p.background='#fffef9';
      p.objects=[textObject('EPISODE 01  /  A NEW BEGINNING',{x:62,y:50,w:780,h:40,fontSize:18,letterSpacing:2,color:'#7d927c'}),textObject('어느 낯선 날의 이야기',{x:60,y:119,w:800,h:100,font:'Gowun Batang',fontSize:59,weight:700}),textObject('평범한 하루가, 특별한 한 장면이 되는 순간.',{x:64,y:231,w:770,h:45,fontSize:22,color:'#80907b'}),base('image',{x:55,y:330,w:790,h:650,assetId:a.id,name:'도시의 아침',crop:'rectangle',points:clone(crops.rectangle),imageZoom:1,imageX:0,imageY:0,stroke:'#324e40',strokeWidth:2,fade:0,fadeAngle:90,fadeStart:0}),bubble('ellipse',{x:450,y:395,w:340,h:175,text:'이곳에서,\n우리의 이야기가 시작돼.',fontSize:26,tailAngle:135,tailX:-.17,tailY:1.55,bendX:-.08,bendY:0,tailWidth:35}),textObject('사아아…',{type:'sfx',name:'사아아…',font:'Nanum Pen Script',x:95,y:790,w:500,h:150,fontSize:110,color:'#ffffff',rotation:-8}),textObject('아직 아무도 모르는 이야기.\n그 첫 페이지를, 지금 열어 볼까요?',{font:'Gowun Batang',x:85,y:1085,w:740,h:170,fontSize:30,align:'center',color:'#53674e',lineHeight:1.75}),textObject('01',{x:415,y:1310,w:70,h:35,fontSize:18,align:'center',color:'#8a9d83'})];
    }
    return doc;
  }
  function toast(message) {$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3800);}
  function snapshot(){return JSON.stringify({name:project.name,pages:project.pages,activePage:project.activePage});}
  function commit() {
    if(booting)return;
    const s=snapshot();if(history[historyIndex]===s)return;
    history=history.slice(0,historyIndex+1);history.push(s);
    while(history.length>80 || (history.length>2&&history.reduce((n,s)=>n+s.length,0)>16000000))history.shift();
    historyIndex=history.length-1;dirty=true;scheduleSave();updateHistoryButtons();
  }
  function undo(delta) {const i=historyIndex+delta;if(i<0||i>=history.length)return;historyIndex=i;Object.assign(project,JSON.parse(history[i]));selected=null;mode='normal';dirty=true;scheduleSave();render();}
  function updateHistoryButtons() {$('#undo').disabled=historyIndex<=0;$('#redo').disabled=historyIndex>=history.length-1;}
  function getDB() {
    if(!dbPromise) dbPromise=new Promise((resolve,reject)=>{const r=indexedDB.open('panel-studio',1);r.onupgradeneeded=()=>r.result.createObjectStore('documents');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    return dbPromise;
  }
  function portableProject() {
    const ids=new Set(project.pages.flatMap(p=>p.objects.filter(o=>o.type==='image').map(o=>o.assetId)));
    const usedFonts=new Set(project.pages.flatMap(p=>p.objects.map(o=>o.font)));
    return {...project,assets:Object.fromEntries([...ids].map(id=>[id,project.assets[id]])),fonts:fonts.filter(f=>!bundledFontNames.has(f.name)&&usedFonts.has(f.name))};
  }
  function scheduleSave(){clearTimeout(autosaveTimer);$('#save-state').textContent='● 저장 중…';autosaveTimer=setTimeout(saveLocal,700);}
  async function saveLocal() {
    const generation=++saveGeneration;
    try {const db=await getDB();await new Promise((resolve,reject)=>{const t=db.transaction('documents','readwrite');t.objectStore('documents').put(portableProject(),'autosave');t.oncomplete=resolve;t.onerror=()=>reject(t.error);});if(generation===saveGeneration){$('#save-state').textContent='● 이 기기에 저장됨';dirty=false;}}
    catch(e){$('#save-state').textContent='● 파일로 저장해 주세요';toast('자동 저장 공간을 사용할 수 없습니다. 프로젝트 저장으로 파일을 보관해 주세요.');}
  }
  async function registerFonts(list) {
    await Promise.all(list.map(async f=>{try{const face=new FontFace(f.name,`url(${f.data})`,{weight:String(f.weight||400)});await face.load();document.fonts.add(face);}catch(e){console.warn('글꼴을 읽을 수 없습니다:',f.name);}}));
  }
  function fontStyle(o) {return `${o.italic?'italic':'normal'} ${o.weight||400} ${o.fontSize||30}px "${(o.font||'Nanum Gothic').replace(/["\\]/g,'')}"`;}
  function textSVG(o) {
    if(!o.text)return '';
    const pad=o.padding||0,size=o.fontSize||30;
    measureCtx.font=fontStyle(o);
    const spacing=o.letterSpacing||0;
    const lines=wrapText(o.text,Math.max(5,o.w-pad*2),size,s=>measureCtx.measureText(s).width+Math.max(0,Array.from(s).length-1)*spacing);
    const lh=size*(o.lineHeight||1.4),total=(lines.length-1)*lh+size;
    const y=(o.h-total)/2+size*.82,align=o.align||'center',x=align==='left'?pad:align==='right'?o.w-pad:o.w/2;
    const textStroke=o.textStrokeWidth?`stroke="${esc(o.textStroke||'#ffffff')}" stroke-width="${o.textStrokeWidth}" paint-order="stroke fill" stroke-linejoin="round"`:'';
    return `<g transform="skewX(${num(o.skew||0)})"><text fill="${esc(o.color||'#23352f')}" font-family="${esc(o.font||'Nanum Gothic')}" font-size="${size}" font-weight="${o.weight||400}" font-style="${o.italic?'italic':'normal'}" letter-spacing="${spacing}" text-anchor="${align==='center'?'middle':align==='right'?'end':'start'}" ${textStroke}>${lines.map((line,i)=>`<tspan x="${num(x)}" y="${num(y+i*lh)}">${esc(line)||' '}</tspan>`).join('')}</text></g>`;
  }
  function outline(o) {return `fill="${o.transparent?'none':esc(o.fill||'#ffffff')}" stroke="${esc(o.stroke||'#23352f')}" stroke-width="${o.strokeWidth||0}" stroke-linejoin="round"`;}
  function clipShape(o) {return o.crop==='ellipse'?`<ellipse cx="${o.w/2}" cy="${o.h/2}" rx="${o.w/2}" ry="${o.h/2}"/>`:`<path d="${polygonPath(o.points||crops.rectangle,o.w,o.h)}"/>`;}
  function objectSVG(o,interactive=true,prefix='') {
    if(o.visible===false)return '';
    let inner='';const id=prefix+o.id;
    if(o.type==='bubble') {
      inner=`<path d="${bubblePath(o)}" ${outline(o)} ${o.shape==='whisper'?'stroke-dasharray="7 6"':''}/>`;
      if(o.shape==='thought'&&o.tail!==false) {const t=tailGeometry(o);for(let i=1;i<=3;i++){const f=i/3,x=t.base.x+(t.tip.x-t.base.x)*f,y=t.base.y+(t.tip.y-t.base.y)*f,r=(4-i)*Math.max(4,o.tailWidth/8);inner+=`<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r*.75}" ${outline(o)}/>`;}}
      inner+=textSVG(o);
    } else if(o.type==='text'||o.type==='sfx') inner=textSVG(o);
    else if(o.type==='image') {
      const a=project.assets[o.assetId];if(!a)return '';
      const cover=Math.max(o.w/a.width,o.h/a.height)*(o.imageZoom||1),iw=a.width*cover,ih=a.height*cover;
      const angle=(o.fadeAngle||0)*Math.PI/180,dx=Math.cos(angle)*.5,dy=Math.sin(angle)*.5;
      const clipping=clipShape(o), strokeShape=clipping.replace('/>',` fill="none" stroke="${esc(o.stroke||'#23352f')}" stroke-width="${o.strokeWidth||0}" stroke-linejoin="round"/>`);
      inner=`<defs><clipPath id="clip-${id}">${clipping}</clipPath><linearGradient id="gradient-${id}" x1="${.5-dx}" y1="${.5-dy}" x2="${.5+dx}" y2="${.5+dy}"><stop offset="${o.fadeStart||0}" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="${1-(o.fade||0)}"/></linearGradient><mask id="mask-${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="${o.w}" height="${o.h}"><rect width="${o.w}" height="${o.h}" fill="url(#gradient-${id})"/></mask></defs><g clip-path="url(#clip-${id})"><image href="${esc(interactive?imageURL(o.assetId):a.src)}" x="${num((o.w-iw)/2+(o.imageX||0)*o.w)}" y="${num((o.h-ih)/2+(o.imageY||0)*o.h)}" width="${num(iw)}" height="${num(ih)}" preserveAspectRatio="none" ${o.fade?`mask="url(#mask-${id})"`:''}/></g>${strokeShape}`;
    } else if(o.type==='shape') {
      inner=o.crop==='ellipse'?`<ellipse cx="${o.w/2}" cy="${o.h/2}" rx="${o.w/2}" ry="${o.h/2}" ${outline(o)}/>`:`<path d="${polygonPath(o.points||crops.rectangle,o.w,o.h)}" ${outline(o)}/>`;
    } else if(o.type==='pen') inner=`<path d="${(o.points||[]).map((p,i)=>`${i?'L':'M'}${num(p[0]*o.w)},${num(p[1]*o.h)}`).join(' ')}" fill="none" stroke="${esc(o.stroke)}" stroke-width="${o.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`;
    else if(o.type==='effect') {
      let seed=o.seed||123,rand=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
      for(let i=0;i<(o.density||60);i++) {
        if(o.effect==='speed'){const y=rand()*o.h;inner+=`<line x1="${rand()*o.w*.4}" y1="${y}" x2="${o.w}" y2="${y}" stroke="${esc(o.stroke)}" stroke-width="${(.3+rand())*o.strokeWidth}"/>`;}
        else {const a=i/(o.density||60)*Math.PI*2,innerR=.18+rand()*.15,x=Math.cos(a)*o.w,y=Math.sin(a)*o.h;inner+=`<path d="M${o.w/2+x},${o.h/2+y} L${o.w/2+x*innerR},${o.h/2+y*innerR} L${o.w/2+x+Math.sin(a)*o.strokeWidth*2},${o.h/2+y-Math.cos(a)*o.strokeWidth*2}Z" fill="${esc(o.stroke)}"/>`;}
      }
      inner=`<svg width="${o.w}" height="${o.h}" viewBox="0 0 ${o.w} ${o.h}" overflow="hidden">${inner}</svg>`;
    }
    return `<g ${interactive?`class="object ${o.locked?'locked':''}" data-object="${esc(o.id)}"`:''} transform="translate(${num(o.x)} ${num(o.y)}) rotate(${num(o.rotation||0)} ${o.w/2} ${o.h/2})" opacity="${o.opacity??1}">${interactive?`<rect width="${o.w}" height="${o.h}" fill="transparent"/>`:''}${inner}</g>`;
  }
  function selectionSVG(o) {
    if(!o||preview)return '';
    const r=5/zoom,t=tailGeometry(o);
    let s=`<rect class="selection-box" width="${o.w}" height="${o.h}"/>`;
    if(!o.locked) {
      for(const [h,x,y] of [['nw',0,0],['ne',o.w,0],['se',o.w,o.h],['sw',0,o.h]])s+=`<rect class="handle" data-handle="${h}" x="${x-r}" y="${y-r}" width="${r*2}" height="${r*2}"/>`;
      s+=`<path d="M${o.w/2},0 V${-25/zoom}" stroke="#df8658" stroke-width="${1/zoom}"/><circle class="handle rotation-handle" data-handle="rotate" cx="${o.w/2}" cy="${-25/zoom}" r="${r}"/>`;
      if(o.type==='bubble'&&mode==='tail'&&o.tail!==false&&o.shape!=='caption') {
        s+=`<path d="M${t.base.x},${t.base.y} Q${t.control.x},${t.control.y} ${t.tip.x},${t.tip.y}" fill="none" stroke="#e48053" stroke-dasharray="${4/zoom} ${4/zoom}" stroke-width="${1/zoom}"/>`;
        for(const [h,p,l] of [['tail-tip',t.tip,'끝점'],['tail-base',t.base,'붙는 위치'],['tail-curve',t.control,'휘어짐']])s+=`<circle class="tail-handle" data-handle="${h}" cx="${p.x}" cy="${p.y}" r="${r*1.2}"/><text x="${p.x+r*1.7}" y="${p.y-r*1.8}" font-size="${10/zoom}" fill="#b2653e" pointer-events="none">${l}</text>`;
      }
      if((o.type==='image'||o.type==='shape')&&mode==='crop'&&o.crop!=='ellipse') {
        s+=`<path d="${polygonPath(o.points||crops.rectangle,o.w,o.h)}" fill="none" stroke="#398b70" stroke-width="${1/zoom}" stroke-dasharray="${5/zoom} ${4/zoom}"/>`;
        (o.points||[]).forEach((p,i)=>s+=`<circle class="crop-handle" data-handle="point-${i}" cx="${p[0]*o.w}" cy="${p[1]*o.h}" r="${r*1.2}"/>`);
      }
    }
    return `<g class="selection-overlay" transform="translate(${o.x} ${o.y}) rotate(${o.rotation||0} ${o.w/2} ${o.h/2})">${s}</g>`;
  }
  function pageSVG(p,{interactive=true,embedFonts=false,background=true,prefix=''}={}) {
    const grid=interactive&&showGrid?`<defs><pattern id="grid-${p.id}" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M50 0H0V50" fill="none" stroke="#55705e" stroke-opacity=".2" stroke-width="1"/></pattern></defs><rect width="100%" height="100%" fill="url(#grid-${p.id})" pointer-events="none"/>`:'';
    const used=new Set(p.objects.filter(o=>o.visible!==false).map(o=>o.font));
    const css=embedFonts?`<defs><style>${fonts.filter(f=>used.has(f.name)).map(f=>`@font-face{font-family:'${esc(f.name.replace(/['\\]/g,''))}';font-weight:${f.weight||400};src:url(${f.data})}`).join('')}</style></defs>`:'';
    return `<svg xmlns="http://www.w3.org/2000/svg" ${interactive?`class="page-canvas" data-page="${p.id}"`:''} width="${interactive?p.width*zoom:p.width}" height="${interactive?p.height*zoom:p.height}" viewBox="0 0 ${p.width} ${p.height}">${css}<defs><clipPath id="page-clip-${prefix}${p.id}"><rect width="${p.width}" height="${p.height}"/></clipPath></defs>${background?`<rect width="${p.width}" height="${p.height}" fill="${esc(p.background)}"/>`:''}<g clip-path="url(#page-clip-${prefix}${p.id})">${p.objects.map(o=>objectSVG(o,interactive,prefix)).join('')}</g>${grid}${interactive&&p.id===page().id?selectionSVG(object()):''}</svg>`;
  }
  function renderStage() {
    $('#stage').innerHTML=(view==='page'?[page()]:project.pages).map(p=>`<div class="page-wrap ${p.id===page().id?'active':''}" data-caption="PAGE ${String(project.pages.indexOf(p)+1).padStart(2,'0')}  /  ${p.width} × ${p.height} PX">${pageSVG(p)}</div>`).join('');
    $('#stage').classList.toggle('is-preview',preview);$('#stage').style.cursor=tool==='hand'||space?'grab':tool==='pen'?'crosshair':'';
  }
  function renderPages() {
    $('#page-count').textContent=String(project.pages.length).padStart(2,'0');
    $('#page-list').innerHTML=project.pages.map((p,i)=>`<button class="page-item ${page().id===p.id?'active':''}" data-page-select="${p.id}"><span class="page-icon">${String(i+1).padStart(2,'0')}</span><span><b>${esc(p.name)}</b><small>${p.width} × ${p.height} px</small></span><span class="page-menu">${i+1}</span></button>`).join('');
    const i=project.pages.indexOf(page());$('#page-status').textContent=`PAGE ${String(i+1).padStart(2,'0')}`;$('#dimensions').textContent=`${page().width} × ${page().height} px`;$('#page-position').textContent=`${i+1} / ${project.pages.length}`;$('#zoom-label').textContent=`${Math.round(zoom*100)}%`;
  }
  function renderLayers() {
    $('#layer-count').textContent=page().objects.length;
    $('#layers').innerHTML=[...page().objects].reverse().map(o=>`<div class="layer ${o.id===selected?'active':''} ${o.visible===false?'hidden':''}" data-layer="${o.id}"><span class="layer-type">${{bubble:'◯',text:'T',sfx:'팡',image:'▧',shape:'▱',pen:'✎',effect:'✴'}[o.type]}</span><span class="layer-name">${esc(o.name||typeLabels[o.type])}</span><button data-lock="${o.id}" class="${o.locked?'on':''}" aria-label="레이어 잠금">${o.locked?'▣':'▫'}</button><button data-visible="${o.id}" aria-label="레이어 표시">${o.visible===false?'○':'●'}</button></div>`).join('');
  }
  function renderContext() {
    const o=object();
    $('#context-hint').textContent=preview?'완성된 장면을 확인하세요. 미리 보기를 다시 누르면 편집합니다.':tool==='pen'?'드래그하여 선을 그리세요. B: 펜 · V: 선택':mode==='tail'?'주황색 점으로 꼬리의 끝점·붙는 위치·휘어짐을 조절하세요.':mode==='crop'?'초록색 꼭짓점을 움직이세요. 테두리를 더블클릭하면 편집점이 추가됩니다.':mode==='image-pan'?'이미지 안쪽을 드래그해 구도를 조절하세요.':o?`${typeLabels[o.type]} 선택됨 · 방향키로 이동 · Shift: 10px 이동`:'소재를 선택하면 캔버스에 추가됩니다. 이미지를 끌어 놓을 수도 있어요.';
    $('#context-actions').innerHTML=o&&!preview?`${o.type==='bubble'?`<button data-action="tail-mode" class="${mode==='tail'?'active':''}">꼬리 편집</button>`:''}${['image','shape'].includes(o.type)?`<button data-action="crop-mode" class="${mode==='crop'?'active':''}">모양 편집</button>`:''}${o.type==='image'?`<button data-action="image-pan" class="${mode==='image-pan'?'active':''}">구도 이동</button>`:''}`:'';
    $$('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));$$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
    $('#grid-button').classList.toggle('active',showGrid);$('#snap-button').classList.toggle('active',snap);$('#preview-button').textContent=preview?'편집으로':'미리 보기';
  }
  function render(){renderStage();renderPages();renderProperties();renderLayers();renderContext();updateHistoryButtons();$('#project-name').value=project.name;}
  function fit(){zoom=clamp(Math.min(($('#stage-viewport').clientWidth-100)/page().width,($('#stage-viewport').clientHeight-85)/page().height),.025,2);renderStage();renderPages();}
  function addObject(o){if(preview)preview=false;page().objects.push(o);selected=o.id;tool='select';mode=o.type==='bubble'?'tail':'normal';commit();render();}
  function visibleCenter(){const v=$('#stage-viewport'),svg=$('.page-canvas[data-page="'+page().id+'"]');if(!svg)return {x:page().width/2,y:page().height/2};const b=v.getBoundingClientRect();return screenPoint(svg,b.left+v.clientWidth/2,b.top+v.clientHeight/2);}
  function place(o){const c=visibleCenter();o.x=Math.round(clamp(c.x-o.w/2,0,page().width-o.w));o.y=Math.round(clamp(c.y-o.h/2,0,page().height-o.h));return o;}
  function screenPoint(svg,x,y){return new DOMPoint(x,y).matrixTransform(svg.getScreenCTM().inverse());}
  const field=(label,key,value,min=-100000,max=100000,step=1)=>`<div class="prop-field"><label>${label}</label><input aria-label="${label}" data-prop="${key}" type="number" value="${num(value??0)}" min="${min}" max="${max}" step="${step}"></div>`;
  const range=(label,key,value,min,max,step=1,suffix='')=>`<div class="prop-row"><label>${label}</label><input aria-label="${label}" type="range" data-prop="${key}" value="${value}" min="${min}" max="${max}" step="${step}"><output>${num(value)}${suffix}</output></div>`;
  const color=(label,key,value)=>`<div class="prop-row"><label>${label}</label><div class="color-field"><input aria-label="${label}" type="color" data-prop="${key}" value="${esc(value||'#ffffff')}"><span>${esc(value||'#ffffff')}</span></div></div>`;
  const select=(key,value,options,label)=>`<select aria-label="${label||key}" data-prop="${key}">${Object.entries(options).map(([v,l])=>`<option value="${esc(v)}" ${String(v)===String(value)?'selected':''}>${esc(l)}</option>`).join('')}</select>`;
  const section=(title,body)=>`<section class="prop-section"><div class="prop-title">${title}</div>${body}</section>`;
  function renderProperties() {
    const o=object();$('#selection-type').textContent=o?o.type.toUpperCase():'CANVAS';
    if(tool==='pen') {$('#properties').innerHTML=section('펜 설정',color('펜 색상','penColor',penColor)+range('선 굵기','penWidth',penWidth,1,100))+`<p class="empty-info">캔버스 위에 자유롭게 그리세요. 선 하나가 레이어 하나로 저장되어 이동·삭제·투명도 조절이 가능합니다.</p>`;return;}
    if(!o) {
      $('#properties').innerHTML=section('캔버스 설정',`<div class="prop-field"><label>페이지 이름</label><input data-page-prop="name" aria-label="페이지 이름" value="${esc(page().name)}" style="width:100%"></div><div class="prop-row" style="margin-top:12px">${field('가로 (px)','pageWidth',page().width,1,8000)}${field('세로 (px)','pageHeight',page().height,1,8000)}</div><button class="secondary full" data-action="resize-page">크기 적용</button><p class="small" style="margin-top:8px">페이지당 최대 8000 × 8000 px</p>`)+section('배경',color('배경색','pageBackground',page().background))+section('페이지 관리',`<div class="prop-row"><button class="secondary full" data-action="duplicate-page">페이지 복제</button><button class="quiet full danger" data-action="delete-page">삭제</button></div><div class="prop-row"><button class="quiet full" data-action="page-up">↑ 앞으로</button><button class="quiet full" data-action="page-down">↓ 뒤로</button></div>`)+`<div class="tip-card"><strong>당신의 이야기를 시작하세요</strong>왼쪽에서 소재를 추가하거나 이미지를 끌어 놓으세요.<br>클릭하여 선택 · 모서리로 크기 조절<br>마우스 휠: 스크롤 · Ctrl+휠: 확대</div>`;return;
    }
    let html=section('위치와 크기',`<input data-prop="name" aria-label="레이어 이름" value="${esc(o.name)}" style="width:100%;margin-bottom:12px"><div class="prop-row">${field('X','x',o.x)}${field('Y','y',o.y)}</div><div class="prop-row">${field('가로','w',o.w,1,16000)}${field('세로','h',o.h,1,16000)}</div><div class="prop-row">${field('회전 (°)','rotation',o.rotation,-360,360)}<button class="quiet" data-action="center">가운데 정렬</button></div>${range('불투명도','opacity',Math.round((o.opacity??1)*100),0,100,1,'%')}`);
    if(o.type==='bubble') html+=section('말풍선 모양',select('shape',o.shape,labels,'말풍선 모양')+`<div style="height:12px"></div>`+color('채우기','fill',o.fill)+color('외곽선','stroke',o.stroke)+range('선 굵기','strokeWidth',o.strokeWidth,0,30)+`<label class="check-row"><input type="checkbox" data-prop="transparent" ${o.transparent?'checked':''}>배경 투명하게</label>`)+section('꼬리 조절',`<label class="check-row"><input type="checkbox" data-prop="tail" ${o.tail!==false?'checked':''}>꼬리 표시</label><button data-action="tail-mode" class="secondary full">${mode==='tail'?'꼬리 편집 마치기':'캔버스에서 꼬리 편집'}</button><div style="height:12px"></div>${range('붙는 각도','tailAngle',o.tailAngle,0,360,1,'°')}${range('꼬리 폭','tailWidth',o.tailWidth,5,180)}<p class="small">끝점은 자유롭게 이동할 수 있어요.<br>휘어짐 점을 움직여 곡선 꼬리를 만드세요.</p>`);
    if(['bubble','text','sfx'].includes(o.type)) {
      const available=Object.fromEntries([...new Set(fonts.map(f=>f.name))].map(n=>[n,fontNames[n]||n]));
      html+=section('텍스트',`<textarea data-prop="text" aria-label="텍스트 내용" rows="3" maxlength="20000">${esc(o.text)}</textarea><div style="height:10px"></div>${select('font',o.font,available,'글꼴')}<div class="prop-row" style="margin-top:10px">${field('크기 (px)','fontSize',o.fontSize,4,1500)}<div class="prop-field"><label>굵기</label>${select('weight',o.weight||400,{100:'100 · 가늘게',300:'300 · 얇게',400:'400 · 보통',500:'500 · 중간',700:'700 · 굵게',800:'800 · 아주 굵게',900:'900 · 두껍게'},'글꼴 굵기')}</div></div>${color('글자색','color',o.color)}<div class="prop-row">${select('align',o.align,{left:'왼쪽 정렬',center:'가운데 정렬',right:'오른쪽 정렬'},'텍스트 정렬')}<label class="check-row"><input type="checkbox" data-prop="italic" ${o.italic?'checked':''}>기울임</label></div>${range('행간','lineHeight',o.lineHeight||1.4,.7,3,.05)}${range('자간','letterSpacing',o.letterSpacing||0,-10,50,.5)}${range('안쪽 여백','padding',o.padding||0,0,150)}${color('글자 외곽선','textStroke',o.textStroke||'#ffffff')}${range('외곽선 굵기','textStrokeWidth',o.textStrokeWidth||0,0,30)}${o.type==='sfx'?range('기울이기','skew',o.skew||0,-40,40,1,'°'):''}<button class="quiet full" data-action="import-font">＋ 내 글꼴 추가 (TTF / OTF)</button><p class="small">굵기 파일이 없는 글꼴은 합성 굵기가 적용됩니다.</p>`);
    }
    if(o.type==='image'||o.type==='shape') {
      html+=section('자르기와 모양',select('crop',o.crop||'rectangle',cropLabels,'자르기 모양')+`<button class="secondary full" style="margin-top:10px" data-action="crop-mode">${mode==='crop'?'모양 편집 마치기':'꼭짓점 직접 편집'}</button><div class="prop-row" style="margin-top:8px"><button class="quiet full" data-action="add-point">＋ 편집점</button><button class="quiet full" data-action="remove-point">− 마지막 점</button></div>`);
      if(o.type==='image') html+=section('이미지 구도',range('확대','imageZoom',o.imageZoom||1,.2,5,.05,'×')+range('좌우 이동','imageX',o.imageX||0,-1,1,.01)+range('상하 이동','imageY',o.imageY||0,-1,1,.01)+`<button class="secondary full" data-action="image-pan">드래그로 구도 이동</button><button class="quiet full" data-action="reset-image">구도 초기화</button>`)+section('투명 그라데이션',range('투명 강도','fade',Math.round((o.fade||0)*100),0,100,1,'%')+range('방향','fadeAngle',o.fadeAngle||0,0,360,1,'°')+range('시작 위치','fadeStart',Math.round((o.fadeStart||0)*100),0,95,1,'%')+`<p class="small">0° 오른쪽 · 90° 아래 · 180° 왼쪽 · 270° 위</p>`);
      html+=section('외곽선',color('선 색상','stroke',o.stroke)+range('선 굵기','strokeWidth',o.strokeWidth||0,0,60)+(o.type==='shape'?color('채우기','fill',o.fill)+`<label class="check-row"><input type="checkbox" data-prop="transparent" ${o.transparent?'checked':''}>안쪽 투명하게</label>`:''));
    }
    if(o.type==='pen'||o.type==='effect') html+=section('선 스타일',color('선 색상','stroke',o.stroke)+range('선 굵기','strokeWidth',o.strokeWidth,1,100)+(o.type==='effect'?range('선 개수','density',o.density||60,5,150):''));
    $('#properties').innerHTML=`${o.locked?'<p class="empty-info">이 레이어는 잠겨 있습니다. 레이어 목록에서 잠금을 해제하세요.</p>':''}<fieldset ${o.locked?'disabled':''} style="border:0;padding:0;margin:0;min-width:0">${html}</fieldset>`;
  }
  function renderLibrary() {
    const names={bubbles:['말풍선','이야기에 목소리를 더해 보세요.'],sfx:['효과음','장면에 생동감을 더하는 한 글자.'],text:['텍스트','당신의 이야기를, 당신의 글씨로.'],images:['이미지','장면을 불러오고 자유롭게 다듬으세요.'],panels:['컷 · 효과','장면의 리듬과 속도를 만들어 보세요.']};
    $('#library-title').textContent=names[tab][0];$('#library-description').textContent=names[tab][1];$$('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
    let html='';
    if(tab==='bubbles') html=`<div class="preset-grid">${Object.entries(labels).map(([shape,label])=>{const b=bubble(shape,{w:110,h:65,tailWidth:13,tailX:.75,tailY:1.25,strokeWidth:2,text:''});return `<button class="preset" data-add-bubble="${shape}"><svg viewBox="-8 -4 130 98"><path d="${bubblePath(b)}" fill="#fff" stroke="#53664e" stroke-width="2" ${shape==='whisper'?'stroke-dasharray="4 3"':''}/>${shape==='thought'?'<ellipse cx="86" cy="73" rx="7" ry="5" fill="white" stroke="#53664e" stroke-width="2"/><circle cx="94" cy="83" r="3" fill="white" stroke="#53664e"/>':''}${shape==='burst'?'<text x="55" y="41" text-anchor="middle" font-size="20" fill="#53664e">!</text>':''}</svg><span>${label}</span></button>`;}).join('')}</div><div class="tip-card"><strong>↳ 꼬리도, 내 마음대로</strong>말풍선을 추가하고 ‘꼬리 편집’을 누르세요. 세 개의 점으로 위치와 곡선을 자유롭게 조절할 수 있어요.</div>`;
    if(tab==='sfx') html=`<div class="preset-grid">${sfxPresets.map(([text,font,col,skew],i)=>`<button class="sfx-preset" data-add-sfx="${i}" style="font-family:'${font}';color:${col};font-size:${text.length>3?24:30}px">${text}</button>`).join('')}</div><div class="tip-card"><strong>나만의 효과음</strong>추가 후 글자, 글꼴, 색, 외곽선과 기울기를 모두 바꿀 수 있어요.</div>`;
    if(tab==='text')html=`<button class="text-preset" data-add-text="title" style="font-size:25px;font-weight:800">제목을 더하세요</button><button class="text-preset" data-add-text="body" style="font-size:14px">이야기를 써 내려가세요.</button><button class="text-preset" data-add-text="hand" style="font-family:'Nanum Pen Script';font-size:27px">마음을 담은 한 줄</button><div class="subheading">오프라인 한글 글꼴 ${new Set(fonts.map(f=>f.name)).size}종</div>${Object.entries(fontNames).map(([n,l])=>`<button class="text-preset" data-font-text="${n}" style="font-family:'${n}';font-size:18px">${l}</button>`).join('')}<button class="secondary full" style="margin-top:16px" data-action="import-font">＋ 내 글꼴 추가</button>`;
    if(tab==='images')html=`<button class="primary full" data-action="import-image">＋ 이미지 불러오기</button><p class="small" style="margin-top:10px">PNG · JPG · WEBP · GIF · BMP<br>여러 파일을 끌어 놓을 수도 있어요.</p><div class="subheading">내 배경 라이브러리</div><div class="image-grid">${(window.DEMO_ASSETS||[]).map(a=>`<button class="image-card" data-demo-image="${a.id}"><img src="${a.src}" alt="${esc(a.name)}" loading="lazy"><span>${esc(a.name)}</span></button>`).join('')}</div><div class="tip-card"><strong>자유로운 컷 구성</strong>이미지를 추가한 뒤 모양 편집에서 사다리꼴, 평행사변형 또는 원하는 다각형으로 자르세요.</div>`;
    if(tab==='panels')html=`<div class="preset-grid">${Object.entries(cropLabels).filter(([s])=>s!=='custom').map(([s,l])=>`<button class="preset" data-add-panel="${s}"><svg viewBox="0 0 110 75">${s==='ellipse'?'<ellipse cx="55" cy="37" rx="47" ry="29" fill="#f1f5ed" stroke="#53664e" stroke-width="3"/>':`<path d="${polygonPath(crops[s]||crops.rectangle,90,55)}" transform="translate(10 10)" fill="#f1f5ed" stroke="#53664e" stroke-width="3"/>`}</svg><span>${l}</span></button>`).join('')}</div><div class="subheading">장면 효과</div><div class="preset-grid"><button class="preset" data-add-effect="focus"><span style="font-size:38px">✴</span><span>집중선</span></button><button class="preset" data-add-effect="speed"><span style="font-size:38px">≋</span><span>속도선</span></button></div><button class="secondary full" style="margin-top:12px" data-tool="pen">✎ 자유롭게 그리기</button>`;
    $('#library-content').innerHTML=html;
  }
  function updateProperty(input,final=false) {
    const key=input.dataset.prop;let value=input.type==='checkbox'?input.checked:input.type==='number'||input.type==='range'?clamp(input.value,+(input.min||-100000),+(input.max||100000)):input.value;
    if(['pageWidth','pageHeight'].includes(key))return;
    if(key==='penColor')penColor=value;else if(key==='penWidth')penWidth=value;
    else if(key==='pageBackground')page().background=value;
    else {
      const o=object();if(!o||o.locked)return;
      if(['opacity','fade','fadeStart'].includes(key))value/=100;
      if(key==='weight')value=Number(value);
      o[key]=value;
      if(key==='crop') {o.points=clone(crops[value]||o.points||crops.rectangle);if(o.type==='shape')o.shape=value;}
      if(key==='shape'&&value==='caption')o.tail=false;
    }
    const out=input.parentElement.querySelector('output');if(out)out.textContent=input.value+(input.dataset.prop==='opacity'||input.dataset.prop==='fade'||input.dataset.prop==='fadeStart'?'%':'');
    const hex=input.parentElement.querySelector('span');if(input.type==='color'&&hex)hex.textContent=value;
    renderStage();renderLayers();if(final){commit();if(input.tagName==='SELECT'||input.type==='checkbox')renderProperties();renderContext();}
  }
  async function addImageAsset(a) {
    project.assets[a.id]=a;const width=Math.min(page().width*.8,a.width),height=width*a.height/a.width;
    addObject(place(base('image',{name:a.name,assetId:a.id,w:width,h:Math.min(height,16000),crop:'rectangle',points:clone(crops.rectangle),imageZoom:1,imageX:0,imageY:0,fade:0,fadeAngle:90,fadeStart:0,stroke:'#23352f',strokeWidth:0})));
  }
  const readData=file=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(file);});
  const loadImage=src=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('이미지를 읽을 수 없습니다.'));im.src=src;});
  async function importImages(files) {
    for(const file of files)try {
      if(!/^image\/(png|jpeg|webp|gif|bmp)$/.test(file.type))throw Error('PNG, JPG, WEBP, GIF, BMP 이미지를 선택하세요.');
      if(file.size>50*1024*1024)throw Error('이미지 한 장은 50MB 이하로 선택하세요.');
      const src=await readData(file),im=await loadImage(src);
      if(im.naturalWidth*im.naturalHeight>120000000)throw Error('이미지가 너무 큽니다. 1억 2천만 픽셀 이하로 줄여 주세요.');
      await addImageAsset({id:uid(),name:file.name,src,width:im.naturalWidth,height:im.naturalHeight});
    }catch(e){toast(e.message);}
  }
  async function importFonts(files) {
    let added=0;
    for(const file of files)try {
      if(file.size>30*1024*1024)throw Error('글꼴 파일은 30MB 이하로 선택하세요.');
      const name=file.name.replace(/\.[^.]+$/,'').replace(/[^\w가-힣 -]/g,'').slice(0,70)+' '+uid().slice(-5);
      const data=(await readData(file)).replace(/^data:[^;]*;/,'data:font/ttf;');
      const face=new FontFace(name,`url(${data})`);await face.load();document.fonts.add(face);
      const f={name,data,weight:400};fonts.push(f);project.fonts.push(f);if(object()&&['text','sfx','bubble'].includes(object().type))object().font=name;added++;
    }catch(e){toast('글꼴 추가 실패: '+e.message);}
    if(added){commit();scheduleSave();render();if(tab==='text')renderLibrary();toast(`${added}개 글꼴을 추가했습니다. 프로젝트에 함께 저장됩니다.`);}
  }
  function modal(title,body,footer='') {$('#modal-content').innerHTML=`<div class="modal-head"><h2>${title}</h2><button data-action="close-modal" aria-label="닫기">×</button></div><div class="modal-body">${body}</div>${footer?`<div class="modal-footer">${footer}</div>`:''}`;if(!$('#modal').open)$('#modal').showModal();}
  function confirmAction(title,message,action) {modal(title,`<p>${esc(message)}</p>`,`<button class="quiet" data-action="close-modal">취소</button><button class="primary" data-action="${action}">계속하기</button>`);}
  function pageDialog(isNew=false) {modal(isNew?'새로운 이야기 시작':'페이지 추가',`<p>${isNew?'현재 작업은 프로젝트 파일로 저장해 두세요.':'새 페이지의 크기를 정하세요. 페이지마다 다른 크기를 사용할 수 있어요.'}</p>${isNew?'<label for="new-name">프로젝트 이름</label><input id="new-name" value="나의 첫 번째 이야기">':''}<label for="page-preset">캔버스 프리셋</label><select id="page-preset"><option value="900,1400">웹툰 · 900 × 1400</option><option value="800,1280">웹툰 · 800 × 1280</option><option value="1600,2400">고해상도 · 1600 × 2400</option><option value="2480,3508">A4 · 2480 × 3508</option><option value="1080,1080">정사각형 · 1080 × 1080</option><option value="8000,8000">최대 크기 · 8000 × 8000</option></select><div class="prop-row"><div class="prop-field"><label for="new-width">가로 (px)</label><input id="new-width" type="number" min="1" max="8000" value="${isNew?900:page().width}"></div><div class="prop-field"><label for="new-height">세로 (px)</label><input id="new-height" type="number" min="1" max="8000" value="${isNew?1400:page().height}"></div></div><p>각 변 1–8000 px · 크기는 나중에도 변경할 수 있습니다.</p>`,`<button class="quiet" data-action="close-modal">취소</button><button class="primary" data-action="${isNew?'create-project':'create-page'}">${isNew?'새 작업 시작':'페이지 추가'}</button>`);}
  function safeName(name){return String(name).replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/,'').slice(0,100)||'Panel Studio';}
  async function download(blob,name) {
    if(window.desktop)return window.desktop.saveFile(name,new Uint8Array(await blob.arrayBuffer()));
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),20000);return true;
  }
  async function saveProject(){try{const ok=await download(new Blob([JSON.stringify(portableProject())],{type:'application/json'}),safeName(project.name)+'.panel.json');if(ok){await saveLocal();toast('프로젝트를 저장했습니다. 이미지와 추가 글꼴도 함께 보관됩니다.');}}catch(e){toast('저장 실패: '+e.message);}}
  async function openProject(file) {
    try {
      if(file.size>512*1024*1024)throw Error('프로젝트 파일은 512MB 이하만 열 수 있습니다.');
      const doc=validateProject(JSON.parse(await file.text()));await registerFonts(doc.fonts||[]);
      for(const f of doc.fonts||[])if(!fonts.some(x=>x.name===f.name))fonts.push(f);
      clearImageURLs();project=doc;project.fonts||=[];selected=null;mode='normal';history=[];historyIndex=-1;commit();renderLibrary();render();fit();toast('프로젝트를 불러왔습니다.');
    }catch(e){toast('열기 실패: '+e.message);}
  }
  function exportDialog(){modal('이야기를 세상 밖으로',`<p>완성된 장면을 원본 해상도로 저장하세요.<br>편집을 계속하려면 프로젝트 파일도 따로 보관해 주세요.</p><label for="export-scope">내보낼 범위</label><select id="export-scope"><option value="current">현재 페이지</option><option value="all">모든 페이지 · ZIP</option><option value="strip">세로로 이어진 한 장 · PNG</option></select><label for="export-format">파일 형식</label><select id="export-format"><option value="png">PNG · 무손실 이미지</option><option value="jpeg">JPG · 작은 파일</option><option value="svg">SVG · 벡터 + 원본 이미지</option></select><label for="export-scale">해상도</label><select id="export-scale"><option value="1">100% · 원본 크기</option><option value="0.5">50% · 미리 보기용</option><option value="0.25">25% · 작은 이미지</option></select><label class="check-row"><input type="checkbox" id="export-transparent" style="width:auto;margin:0">페이지 배경 투명하게 (PNG / SVG)</label><p class="notice small">세로 연결은 최대 높이 32,000px, 전체 1억 2천만 픽셀까지 가능합니다. 더 긴 작품은 모든 페이지 ZIP으로 저장하세요. SVG의 글꼴 표시는 여는 프로그램에 따라 달라질 수 있습니다.</p><div class="progress"><i id="export-progress"></i></div><p id="export-message" role="status"></p>`,`<button class="quiet" data-action="close-modal">취소</button><button class="primary" id="export-go" data-action="do-export">파일로 내보내기 ↗</button>`);}
  async function rasterize(p,scale=1,transparent=false) {
    await document.fonts.ready;
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(p.width*scale));canvas.height=Math.max(1,Math.round(p.height*scale));
    const ctx=canvas.getContext('2d');ctx.scale(scale,scale);if(!transparent){ctx.fillStyle=p.background;ctx.fillRect(0,0,p.width,p.height);}
    const paint=(path,o)=>{ctx.lineJoin='round';if(!o.transparent){ctx.fillStyle=o.fill||'#ffffff';ctx.fill(path);}if(o.strokeWidth){ctx.strokeStyle=o.stroke;ctx.lineWidth=o.strokeWidth;ctx.stroke(path);}};
    for(const o of p.objects) {
      if(o.visible===false)continue;
      ctx.save();ctx.globalAlpha=o.opacity??1;ctx.translate(o.x+o.w/2,o.y+o.h/2);ctx.rotate((o.rotation||0)*Math.PI/180);ctx.translate(-o.w/2,-o.h/2);
      if(o.type==='bubble') {
        if(o.shape==='whisper')ctx.setLineDash([7,6]);paint(new Path2D(bubblePath(o)),o);ctx.setLineDash([]);
        if(o.shape==='thought'&&o.tail!==false){const t=tailGeometry(o);for(let i=1;i<=3;i++){const f=i/3,r=(4-i)*Math.max(4,o.tailWidth/8),path=new Path2D();path.ellipse(t.base.x+(t.tip.x-t.base.x)*f,t.base.y+(t.tip.y-t.base.y)*f,r,r*.75,0,0,Math.PI*2);paint(path,o);}}
      }
      if(['bubble','text','sfx'].includes(o.type)) {
        ctx.save();ctx.transform(1,0,Math.tan((o.skew||0)*Math.PI/180),1,0,0);ctx.font=fontStyle(o);ctx.textBaseline='alphabetic';ctx.letterSpacing=(o.letterSpacing||0)+'px';
        const size=o.fontSize||30,pad=o.padding||0,align=o.align||'center',lh=size*(o.lineHeight||1.4);
        const lines=wrapText(o.text,Math.max(5,o.w-pad*2),size,s=>ctx.measureText(s).width),total=(lines.length-1)*lh+size;
        const x=align==='left'?pad:align==='right'?o.w-pad:o.w/2,y=(o.h-total)/2+size*.82;
        ctx.textAlign=align;ctx.fillStyle=o.color;ctx.lineJoin='round';ctx.strokeStyle=o.textStroke||'#ffffff';ctx.lineWidth=o.textStrokeWidth||0;
        lines.forEach((line,i)=>{if(o.textStrokeWidth)ctx.strokeText(line,x,y+i*lh);ctx.fillText(line,x,y+i*lh);});ctx.restore();
      } else if(o.type==='image') {
        const a=project.assets[o.assetId],im=await loadImage(a.src),path=new Path2D();
        if(o.crop==='ellipse')path.ellipse(o.w/2,o.h/2,o.w/2,o.h/2,0,0,Math.PI*2);else path.addPath(new Path2D(polygonPath(o.points||crops.rectangle,o.w,o.h)));
        ctx.save();ctx.clip(path);
        const cover=Math.max(o.w/a.width,o.h/a.height)*(o.imageZoom||1),iw=a.width*cover,ih=a.height*cover,ix=(o.w-iw)/2+(o.imageX||0)*o.w,iy=(o.h-ih)/2+(o.imageY||0)*o.h;
        if(o.fade) {
          const layer=document.createElement('canvas'),factor=Math.min(scale,8000/o.w,8000/o.h);layer.width=Math.max(1,Math.ceil(o.w*factor));layer.height=Math.max(1,Math.ceil(o.h*factor));const lc=layer.getContext('2d');lc.scale(factor,factor);lc.drawImage(im,ix,iy,iw,ih);lc.globalCompositeOperation='destination-in';
          const rad=(o.fadeAngle||0)*Math.PI/180,dx=Math.cos(rad)*o.w/2,dy=Math.sin(rad)*o.h/2,g=lc.createLinearGradient(o.w/2-dx,o.h/2-dy,o.w/2+dx,o.h/2+dy);
          g.addColorStop(o.fadeStart||0,'rgba(0,0,0,1)');g.addColorStop(1,`rgba(0,0,0,${1-o.fade})`);lc.fillStyle=g;lc.fillRect(0,0,o.w,o.h);ctx.drawImage(layer,0,0,o.w,o.h);layer.width=1;layer.height=1;
        } else ctx.drawImage(im,ix,iy,iw,ih);
        ctx.restore();if(o.strokeWidth){ctx.lineJoin='round';ctx.strokeStyle=o.stroke;ctx.lineWidth=o.strokeWidth;ctx.stroke(path);}
      } else if(o.type==='shape') {
        const path=new Path2D();if(o.crop==='ellipse')path.ellipse(o.w/2,o.h/2,o.w/2,o.h/2,0,0,Math.PI*2);else path.addPath(new Path2D(polygonPath(o.points||crops.rectangle,o.w,o.h)));paint(path,o);
      } else if(o.type==='pen') {
        ctx.beginPath();(o.points||[]).forEach((p,i)=>i?ctx.lineTo(p[0]*o.w,p[1]*o.h):ctx.moveTo(p[0]*o.w,p[1]*o.h));ctx.strokeStyle=o.stroke;ctx.lineWidth=o.strokeWidth;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();
      } else if(o.type==='effect') {
        ctx.beginPath();ctx.rect(0,0,o.w,o.h);ctx.clip();ctx.strokeStyle=o.stroke;ctx.fillStyle=o.stroke;let seed=o.seed||123,rand=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
        for(let i=0;i<(o.density||60);i++){ctx.beginPath();if(o.effect==='speed'){const y=rand()*o.h;ctx.moveTo(rand()*o.w*.4,y);ctx.lineTo(o.w,y);ctx.lineWidth=(.3+rand())*o.strokeWidth;ctx.stroke();}else{const a=i/(o.density||60)*Math.PI*2,innerR=.18+rand()*.15,x=Math.cos(a)*o.w,y=Math.sin(a)*o.h;ctx.moveTo(o.w/2+x,o.h/2+y);ctx.lineTo(o.w/2+x*innerR,o.h/2+y*innerR);ctx.lineTo(o.w/2+x+Math.sin(a)*o.strokeWidth*2,o.h/2+y-Math.cos(a)*o.strokeWidth*2);ctx.closePath();ctx.fill();}}
      }
      ctx.restore();
    }
    return canvas;
  }
  const canvasBlob=(canvas,type='png')=>new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('이미지 생성에 실패했습니다.')),'image/'+type,.94));
  async function exportFiles() {
    if(exporting)return;exporting=true;$('#export-go').disabled=true;
    const scope=$('#export-scope').value,format=$('#export-format').value,scale=+$('#export-scale').value,transparent=$('#export-transparent').checked,targets=scope==='current'?[page()]:project.pages;
    try {
      const name=safeName(project.name);let blob,filename;
      if(scope==='strip') {
        const w=Math.max(1,Math.round(Math.max(...targets.map(p=>p.width))*scale)),h=targets.reduce((n,p)=>n+Math.max(1,Math.round(p.height*scale)),0);
        if(h>32000||w*h>120000000)throw Error('세로 연결 이미지가 너무 큽니다. 해상도를 낮추거나 모든 페이지 ZIP으로 저장하세요.');
        const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');let y=0;
        if(!transparent){ctx.fillStyle='#ffffff';ctx.fillRect(0,0,w,h);}
        for(let i=0;i<targets.length;i++){const c=await rasterize(targets[i],scale,transparent);ctx.drawImage(c,Math.round((w-c.width)/2),y);y+=c.height;c.width=1;c.height=1;$('#export-progress').style.width=(i+1)/targets.length*100+'%';}
        blob=await canvasBlob(canvas);canvas.width=1;canvas.height=1;filename=name+'-webtoon.png';
      } else {
        const zip=scope==='all'?new JSZip():null;
        for(let i=0;i<targets.length;i++) {
          const p=targets[i],index=String(project.pages.indexOf(p)+1).padStart(3,'0');$('#export-message').textContent=`${i+1} / ${targets.length} 페이지 생성 중…`;
          if(format==='svg')blob=new Blob([pageSVG(p,{interactive:false,embedFonts:true,background:!transparent,prefix:'export-'})],{type:'image/svg+xml'});
          else {const c=await rasterize(p,scale,transparent&&format==='png');blob=await canvasBlob(c,format);c.width=1;c.height=1;}
          filename=`${name}-${index}.${format==='jpeg'?'jpg':format}`;
          if(zip)zip.file(filename,blob);$('#export-progress').style.width=(i+1)/targets.length*100+'%';await new Promise(r=>setTimeout(r,0));
        }
        if(zip){blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:3}});filename=name+'-pages.zip';}
      }
      const saved=await download(blob,filename);$('#modal').close();toast(saved?'내보내기를 마쳤습니다.':'파일 저장을 취소했습니다.');
    }catch(e){$('#export-message').textContent=e.message;toast(e.message);}finally{exporting=false;if($('#export-go'))$('#export-go').disabled=false;}
  }
  function choosePage(id){project.activePage=id;selected=null;mode='normal';render();if(view==='scroll')$(`.page-canvas[data-page="${id}"]`)?.parentElement.scrollIntoView({block:'start'});}
  function duplicateObject(){const o=object();if(!o)return;const copy=clone(o);copy.id=uid();copy.x+=24;copy.y+=24;copy.name+=' 복사';copy.locked=false;addObject(copy);}
  function reorder(action){const o=object();if(!o||o.locked)return;const arr=page().objects,i=arr.indexOf(o);arr.splice(i,1);arr.splice(action==='bring-front'?arr.length:action==='send-back'?0:clamp(i+(action==='forward'?1:-1),0,arr.length),0,o);commit();render();}
  function addPoint(position=null){const o=object();if(!o||o.locked||!['image','shape'].includes(o.type))return;const pts=o.points||clone(crops.rectangle);if(pts.length>=64){toast('꼭짓점은 최대 64개까지 추가할 수 있습니다.');return;}let edge=0,best=position?Infinity:-1,pointToAdd;
    for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length],dx=b[0]-a[0],dy=b[1]-a[1],len=dx*dx+dy*dy;
      const t=position?clamp(((position[0]-a[0])*dx+(position[1]-a[1])*dy)/(len||1),0,1):.5,p=[a[0]+dx*t,a[1]+dy*t],d=position?(position[0]-p[0])**2+(position[1]-p[1])**2:len;
      if(position?d<best:d>best){edge=i;best=d;pointToAdd=p;}}
    pts.splice(edge+1,0,pointToAdd);o.points=pts;o.crop='custom';o.shape='custom';mode='crop';commit();render();
  }
  async function action(name) {
    const o=object();
    if(name==='close-modal'){if(!exporting)$('#modal').close();return;}
    if(name==='undo')return undo(-1);if(name==='redo')return undo(1);
    if(name==='save')return saveProject();if(name==='export')return exportDialog();if(name==='do-export')return exportFiles();
    if(name==='open')return confirmAction('프로젝트 열기','현재 작업을 파일로 저장했다면 새 프로젝트를 열어 주세요.','confirm-open');
    if(name==='confirm-open'){$('#modal').close();$('#project-input').click();return;}
    if(name==='new')return pageDialog(true);if(name==='add-page')return pageDialog(false);
    if(name==='create-page'||name==='create-project') {
      const w=+$('#new-width').value,h=+$('#new-height').value;if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w>8000||h>8000){toast('가로와 세로를 1–8000 사이의 정수로 입력하세요.');return;}
      if(name==='create-project'){clearImageURLs();project=freshProject();project.name=$('#new-name').value.trim()||'새로운 이야기';project.pages[0].width=w;project.pages[0].height=h;history=[];historyIndex=-1;}else {if(project.pages.length>=200){toast('프로젝트당 최대 200페이지입니다.');return;}const p=newPage(w,h);p.name=`장면 ${project.pages.length+1}`;project.pages.push(p);project.activePage=p.id;}
      selected=null;mode='normal';preview=false;$('#modal').close();commit();render();fit();return;
    }
    if(name==='resize-page') {const w=+$('[data-prop="pageWidth"]').value,h=+$('[data-prop="pageHeight"]').value;if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w>8000||h>8000){toast('각 변을 1–8000px 사이의 정수로 입력하세요.');return;}page().width=w;page().height=h;commit();render();fit();return;}
    if(name==='duplicate-page'){if(project.pages.length>=200){toast('프로젝트당 최대 200페이지입니다.');return;}const p=clone(page());p.id=uid();p.name+=' 복사';p.objects.forEach(o=>o.id=uid());project.pages.splice(project.pages.indexOf(page())+1,0,p);project.activePage=p.id;selected=null;commit();render();return;}
    if(name==='delete-page'){if(project.pages.length===1){toast('최소 한 페이지가 필요합니다.');return;}return confirmAction('페이지 삭제',`‘${page().name}’ 페이지를 삭제할까요? 실행 취소로 되돌릴 수 있습니다.`,'confirm-delete-page');}
    if(name==='confirm-delete-page'){const i=project.pages.indexOf(page());project.pages.splice(i,1);project.activePage=project.pages[Math.min(i,project.pages.length-1)].id;selected=null;$('#modal').close();commit();render();return;}
    if(name==='page-up'||name==='page-down'){const i=project.pages.indexOf(page()),j=i+(name==='page-up'?-1:1);if(j>=0&&j<project.pages.length){[project.pages[i],project.pages[j]]=[project.pages[j],project.pages[i]];commit();render();}return;}
    if(name==='previous-page'||name==='next-page'){const i=project.pages.indexOf(page())+(name==='previous-page'?-1:1);if(project.pages[i])choosePage(project.pages[i].id);return;}
    if(name==='fit')return fit();if(name==='zoom-in'||name==='zoom-out'){zoom=clamp(zoom*(name==='zoom-in'?1.2:1/1.2),.025,3);renderStage();renderPages();return;}
    if(name==='grid'){showGrid=!showGrid;renderStage();renderContext();return;}if(name==='snap'){snap=!snap;renderContext();return;}
    if(name==='preview'){preview=!preview;renderStage();renderContext();return;}
    if(name==='import-image'){$('#image-input').click();return;}if(name==='import-font'){$('#font-input').click();return;}
    if(name==='help')return modal('작업실 사용 가이드',`<p>모든 편집은 이 기기에서 처리됩니다. 먼저 왼쪽 소재를 추가하고, 오른쪽 속성에서 세밀하게 다듬어 보세요.</p>${[['선택 / 펜 / 화면 이동','V / B / H'],['드래그로 화면 이동','Space + 드래그'],['실행 취소 / 다시 실행','Ctrl+Z / Ctrl+Shift+Z'],['프로젝트 저장 / 열기','Ctrl+S / Ctrl+O'],['이미지 내보내기','Ctrl+E'],['복제 / 복사 / 붙여넣기','Ctrl+D / Ctrl+C / Ctrl+V'],['레이어 이동 / 빠른 이동','방향키 / Shift+방향키'],['비율 유지하여 크기 조절','Shift + 모서리 드래그'],['삭제 / 선택 해제','Delete / Esc'],['화면 확대·축소','Ctrl + 마우스 휠']].map(([a,b])=>`<div class="kbd-row"><span>${a}</span><span class="kbd">${b}</span></div>`).join('')}<p style="margin-top:18px"><b>말풍선 꼬리:</b> 말풍선 선택 → 꼬리 편집 → 끝점·붙는 위치·휘어짐 점 드래그.<br><b>이미지:</b> 모양 편집으로 꼭짓점을 움직이고, 테두리를 더블클릭해 점을 추가하세요. ‘구도 이동’은 잘린 영역 안의 사진만 이동합니다.<br><b>저장:</b> 자동 저장은 이 기기의 최근 작업 한 개를 보관합니다. 파일 보관·다른 PC 이동에는 ‘프로젝트 저장’을 사용하세요.<br><b>글꼴:</b> 11종의 기본 한글 글꼴과 TTF/OTF/WOFF 추가를 지원합니다. 글꼴 재배포는 해당 라이선스를 따라 주세요.<br><b>GIF:</b> 정지 이미지로 편집·내보내기됩니다.</p>`,`<button class="primary" data-action="close-modal">작업 시작</button>`);
    if(name==='duplicate')return duplicateObject();
    if(['bring-front','send-back','forward','backward'].includes(name))return reorder(name);
    if(!o||o.locked)return;
    if(name==='delete'){page().objects=page().objects.filter(x=>x.id!==o.id);selected=null;mode='normal';commit();render();return;}
    if(name==='tail-mode'){if(o.shape==='caption'){toast('내레이션에는 꼬리가 없습니다. 다른 말풍선 모양을 선택하세요.');return;}o.tail=true;mode=mode==='tail'?'normal':'tail';commit();render();return;}
    if(name==='crop-mode'){if(o.crop==='ellipse'){o.crop='custom';o.points=Array.from({length:12},(_,i)=>[.5+Math.cos(i/12*Math.PI*2)*.5,.5+Math.sin(i/12*Math.PI*2)*.5]);commit();}mode=mode==='crop'?'normal':'crop';render();return;}
    if(name==='image-pan'){mode=mode==='image-pan'?'normal':'image-pan';renderContext();return;}
    if(name==='reset-image'){o.imageZoom=1;o.imageX=0;o.imageY=0;commit();render();return;}
    if(name==='add-point')return addPoint();
    if(name==='remove-point'){if(o.points?.length>3){o.points.pop();o.crop='custom';commit();render();}else toast('최소 3개의 꼭짓점이 필요합니다.');return;}
    if(name==='center'){o.x=(page().width-o.w)/2;o.y=(page().height-o.h)/2;commit();render();}
  }
  document.addEventListener('click',async e=>{
    const b=e.target.closest('button');if(b?.disabled)return;
    if(b?.dataset.action){await action(b.dataset.action);return;}
    if(b?.dataset.tab){tab=b.dataset.tab;renderLibrary();return;}
    if(b?.dataset.tool){tool=b.dataset.tool;mode='normal';preview=false;renderContext();renderProperties();return;}
    if(b?.dataset.view){view=b.dataset.view;renderStage();renderContext();return;}
    if(b?.dataset.pageSelect){choosePage(b.dataset.pageSelect);return;}
    if(b?.dataset.addBubble){addObject(place(bubble(b.dataset.addBubble)));return;}
    if(b?.dataset.addSfx!==undefined){const [text,font,color,skew]=sfxPresets[+b.dataset.addSfx];addObject(place(textObject(text,{type:'sfx',name:text,font,color,fontSize:100,weight:700,w:Math.min(550,page().width*.7),h:210,skew,textStroke:'#ffffff',textStrokeWidth:3,align:'center'})));return;}
    if(b?.dataset.addText){const kind=b.dataset.addText;addObject(place(textObject(kind==='title'?'새로운 이야기':kind==='hand'?'마음을 담은 한 줄':'이곳에 이야기를 써 내려가세요.',{fontSize:kind==='title'?56:kind==='hand'?52:28,font:kind==='hand'?'Nanum Pen Script':'Nanum Gothic',weight:kind==='title'?700:400})));return;}
    if(b?.dataset.fontText){addObject(place(textObject(fontNames[b.dataset.fontText]||'새로운 이야기',{font:b.dataset.fontText})));return;}
    if(b?.dataset.demoImage){const a=window.DEMO_ASSETS.find(a=>a.id===b.dataset.demoImage);if(a)await addImageAsset(a);return;}
    if(b?.dataset.addPanel){const crop=b.dataset.addPanel;addObject(place(base('shape',{crop,shape:crop,points:clone(crops[crop]||crops.rectangle),w:page().width*.7,h:page().width*.5,fill:'#ffffff',stroke:'#23352f',strokeWidth:5,transparent:true})));return;}
    if(b?.dataset.addEffect){addObject(place(base('effect',{effect:b.dataset.addEffect,w:page().width*.9,h:page().width*.7,stroke:'#23352f',strokeWidth:3,density:60,seed:Math.floor(Math.random()*90000)+1})));return;}
    if(b?.dataset.lock){const o=page().objects.find(o=>o.id===b.dataset.lock);o.locked=!o.locked;commit();render();return;}
    if(b?.dataset.visible){const o=page().objects.find(o=>o.id===b.dataset.visible);o.visible=o.visible===false;commit();render();return;}
    const row=e.target.closest('[data-layer]');if(row){selected=row.dataset.layer;mode='normal';tool='select';render();}
  });
  $('#properties').addEventListener('input',e=>{if(e.target.dataset.prop&&e.target.type!=='checkbox'&&e.target.tagName!=='SELECT')updateProperty(e.target);});
  $('#properties').addEventListener('change',e=>{if(e.target.dataset.prop)updateProperty(e.target,true);if(e.target.dataset.pageProp){page().name=e.target.value||'페이지';commit();renderPages();}});
  $('#project-name').addEventListener('change',e=>{project.name=e.target.value.trim()||'새로운 이야기';commit();});
  $('#modal').addEventListener('change',e=>{if(e.target.id==='page-preset'){const [w,h]=e.target.value.split(',');$('#new-width').value=w;$('#new-height').value=h;}if(e.target.id==='export-scope'){$('#export-format').disabled=e.target.value==='strip';if(e.target.value==='strip')$('#export-format').value='png';}});
  $('#image-input').addEventListener('change',async e=>{await importImages(e.target.files);e.target.value='';});
  $('#font-input').addEventListener('change',async e=>{await importFonts(e.target.files);e.target.value='';});
  $('#project-input').addEventListener('change',async e=>{if(e.target.files[0])await openProject(e.target.files[0]);e.target.value='';});
  const viewport=$('#stage-viewport');
  viewport.addEventListener('pointerdown',e=>{
    if(e.button!==0&&e.button!==1)return;
    if(tool==='hand'||space||e.button===1){drag={kind:'pan',sx:e.clientX,sy:e.clientY,scrollX:viewport.scrollLeft,scrollY:viewport.scrollTop};e.preventDefault();return;}
    const svg=e.target.closest('.page-canvas');if(!svg||preview)return;
    const pid=svg.dataset.page;if(page().id!==pid){project.activePage=pid;selected=null;mode='normal';}
    const pos=screenPoint(svg,e.clientX,e.clientY);
    if(tool==='pen') {
      const o=base('pen',{name:'자유 선',x:0,y:0,w:page().width,h:page().height,points:[[pos.x/page().width,pos.y/page().height]],stroke:penColor,strokeWidth:penWidth});page().objects.push(o);selected=o.id;drag={kind:'pen',id:o.id,page:pid};renderStage();e.preventDefault();return;
    }
    const handle=e.target.closest('[data-handle]')?.dataset.handle,target=e.target.closest('[data-object]')?.dataset.object;
    if(!handle) {if(selected!==target)mode='normal';selected=target||null;}
    const o=object();
    if(o&&!o.locked) {drag={kind:handle||((mode==='image-pan'&&o.type==='image')?'image-pan':'move'),id:o.id,page:pid,start:{x:pos.x,y:pos.y},before:clone(o),moved:false};e.preventDefault();}
    renderStage();renderPages();renderProperties();renderLayers();renderContext();
  });
  document.addEventListener('pointermove',e=>{
    if(!drag)return;
    if(drag.kind==='pan'){viewport.scrollLeft=drag.scrollX-(e.clientX-drag.sx);viewport.scrollTop=drag.scrollY-(e.clientY-drag.sy);return;}
    const svg=$(`.page-canvas[data-page="${drag.page}"]`);if(!svg)return;
    const p=screenPoint(svg,e.clientX,e.clientY),o=object();if(!o)return;drag.moved=true;
    const b=drag.before,q=b?localPoint(b,p):p;
    if(drag.kind==='pen'){const last=o.points.at(-1);if(Math.hypot(p.x-last[0]*o.w,p.y-last[1]*o.h)>1.5/zoom&&o.points.length<20000)o.points.push([p.x/o.w,p.y/o.h]);}
    else if(drag.kind==='move'){o.x=b.x+p.x-drag.start.x;o.y=b.y+p.y-drag.start.y;if(snap){o.x=Math.round(o.x/10)*10;o.y=Math.round(o.y/10)*10;}}
    else if(drag.kind==='image-pan'){const start=localPoint(b,drag.start);o.imageX=clamp((b.imageX||0)+(q.x-start.x)/b.w,-10,10);o.imageY=clamp((b.imageY||0)+(q.y-start.y)/b.h,-10,10);}
    else if(drag.kind==='tail-tip'){o.tailX=q.x/o.w;o.tailY=q.y/o.h;}
    else if(drag.kind==='tail-base'){o.tailAngle=(Math.atan2((q.y-o.h/2)/(o.h/2),(q.x-o.w/2)/(o.w/2))*180/Math.PI+360)%360;}
    else if(drag.kind==='tail-curve'){const t=tailGeometry(o);o.bendX=(q.x-(t.base.x+t.tip.x)/2)/o.w;o.bendY=(q.y-(t.base.y+t.tip.y)/2)/o.h;}
    else if(drag.kind.startsWith('point-')){o.points[+drag.kind.split('-')[1]]=[clamp(q.x/o.w,0,1),clamp(q.y/o.h,0,1)];o.crop='custom';}
    else if(drag.kind==='rotate'){const angle=Math.atan2(p.y-b.y-b.h/2,p.x-b.x-b.w/2)-Math.atan2(drag.start.y-b.y-b.h/2,drag.start.x-b.x-b.w/2);o.rotation=b.rotation+angle*180/Math.PI;if(e.shiftKey)o.rotation=Math.round(o.rotation/15)*15;}
    else {
      const west=drag.kind.includes('w'),north=drag.kind.includes('n');let w=clamp(west?b.w-q.x:q.x,10,16000),h=clamp(north?b.h-q.y:q.y,10,16000);
      if(e.shiftKey){const factor=Math.max(w/b.w,h/b.h);w=clamp(b.w*factor,10,16000);h=clamp(b.h*factor,10,16000);}
      if(snap){w=Math.max(10,Math.round(w/10)*10);h=Math.max(10,Math.round(h/10)*10);}
      const ax=west?1:0,ay=north?1:0,a=b.rotation*Math.PI/180,dx=(ax-.5)*b.w,dy=(ay-.5)*b.h,anchorX=b.x+b.w/2+dx*Math.cos(a)-dy*Math.sin(a),anchorY=b.y+b.h/2+dx*Math.sin(a)+dy*Math.cos(a),ndx=(.5-ax)*w,ndy=(.5-ay)*h;
      o.w=w;o.h=h;o.x=anchorX+ndx*Math.cos(a)-ndy*Math.sin(a)-w/2;o.y=anchorY+ndx*Math.sin(a)+ndy*Math.cos(a)-h/2;
    }
    renderStage();
  });
  function finishDrag(cancel=false){if(!drag)return;
    if(drag.kind!=='pan') {
      const o=object();if(cancel&&o&&drag.before)Object.assign(o,drag.before);
      else if(o&&drag.kind==='pen'){if(o.points.length===1)o.points.push([o.points[0][0]+.001,o.points[0][1]+.001]);const pts=o.points.map(p=>[p[0]*o.w,p[1]*o.h]),xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]),pad=o.strokeWidth/2;const x=Math.min(...xs)-pad,y=Math.min(...ys)-pad,w=Math.max(2,Math.max(...xs)-x+pad),h=Math.max(2,Math.max(...ys)-y+pad);Object.assign(o,{x,y,w,h,points:pts.map(p=>[(p[0]-x)/w,(p[1]-y)/h])});}
      if(!cancel)commit();renderProperties();renderLayers();renderStage();
    }drag=null;
  }
  document.addEventListener('pointerup',()=>finishDrag());document.addEventListener('pointercancel',()=>finishDrag(true));
  viewport.addEventListener('dblclick',e=>{const o=object();if(!o||o.locked||preview)return;const svg=e.target.closest('.page-canvas');if(mode==='crop'&&svg){const p=localPoint(o,screenPoint(svg,e.clientX,e.clientY));addPoint([p.x/o.w,p.y/o.h]);}else if(['text','sfx','bubble'].includes(o.type)){$('[data-prop="text"]')?.focus();$('[data-prop="text"]')?.select();}});
  viewport.addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey){e.preventDefault();zoom=clamp(zoom*Math.exp(-e.deltaY*.002),.025,3);renderStage();renderPages();}},{passive:false});
  viewport.addEventListener('dragover',e=>{e.preventDefault();viewport.classList.add('drag-over');});viewport.addEventListener('dragleave',e=>{if(!viewport.contains(e.relatedTarget))viewport.classList.remove('drag-over');});viewport.addEventListener('drop',async e=>{e.preventDefault();viewport.classList.remove('drag-over');await importImages(e.dataTransfer.files);});
  document.addEventListener('keydown',e=>{
    const input=['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)||e.target.isContentEditable,mod=e.ctrlKey||e.metaKey,key=e.key.toLowerCase();
    if($('#modal').open)return;
    if(mod&&['s','o','e'].includes(key)){e.preventDefault();action({s:'save',o:'open',e:'export'}[key]);return;}
    if(input)return;
    if(e.code==='Space'){space=true;e.preventDefault();return;}
    if(mod&&key==='z'){e.preventDefault();undo(e.shiftKey?1:-1);return;}if(mod&&key==='y'){e.preventDefault();undo(1);return;}
    if(mod&&key==='d'){e.preventDefault();duplicateObject();return;}
    if(mod&&key==='c'&&object()){clipboard=clone(object());e.preventDefault();return;}
    if(mod&&key==='v'&&clipboard){const o=clone(clipboard);o.id=uid();o.x+=30;o.y+=30;o.locked=false;addObject(o);e.preventDefault();return;}
    if(key==='delete'||key==='backspace'){e.preventDefault();action('delete');return;}
    if(key==='escape'){finishDrag(true);selected=null;mode='normal';preview=false;render();return;}
    if(key==='v'||key==='h'||key==='b'){tool={v:'select',h:'hand',b:'pen'}[key];mode='normal';renderContext();renderProperties();return;}
    if(key==='t'&&object()?.type==='bubble'){action('tail-mode');return;}
    if(key==='c'&&object()?.type==='image'){action('crop-mode');return;}
    const o=object();if(o&&!o.locked&&['arrowleft','arrowright','arrowup','arrowdown'].includes(key)){e.preventDefault();const d=e.shiftKey?10:1;o.x+=key==='arrowleft'?-d:key==='arrowright'?d:0;o.y+=key==='arrowup'?-d:key==='arrowdown'?d:0;commit();renderStage();renderProperties();}
  });
  document.addEventListener('keyup',e=>{if(e.code==='Space')space=false;});window.addEventListener('blur',()=>{space=false;finishDrag();});
  window.addEventListener('beforeunload',e=>{if(dirty){saveLocal();e.preventDefault();e.returnValue='';}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&dirty)saveLocal();});
  async function init() {
    project=freshProject(true);
    try {const db=await getDB(),saved=await new Promise((resolve,reject)=>{const r=db.transaction('documents').objectStore('documents').get('autosave');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});if(saved)project=validateProject(saved);}catch(e){console.warn('자동 저장 복원:',e.message);}
    project.fonts||=[];fonts.push(...project.fonts);await registerFonts(fonts);await document.fonts.ready;
    booting=false;commit();renderLibrary();render();fit();
    document.body.dataset.ready='true';
  }
  // Read-only state snapshots and rendering hooks for integration tests and tooling.
  window.PanelStudio={getProject:()=>clone(portableProject()),getSelection:()=>selected,renderPage:(index=0)=>rasterize(project.pages[index]),validateProject};
  init().catch(e=>{console.error(e);toast('작업실을 시작하지 못했습니다: '+e.message);});
})();
