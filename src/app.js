/* Panel Studio — all editing and project storage stays on this device. */
(() => {
  'use strict';
  const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
  const {clamp,esc,num,bubblePath,polygonPath,tailGeometry,thoughtTail,dottedTail,textAreas,localPoint,wrapText,crops,imagePlacement,resizeImage,validateProject}=G;
  const uid=()=> 'p'+crypto.getRandomValues(new Uint32Array(2)).join('');
  const clone=o=>JSON.parse(JSON.stringify(o));
  const basicLabels={ellipse:'타원형',round:'둥근 사각형',cloud:'구름형',burst:'외침',thought:'생각',box:'사각형',whisper:'속삭임',caption:'내레이션'};
  const labels={...basicLabels,...Object.fromEntries(BubbleCatalog.presets.map(p=>[p.id,`${p.collection}-${String(p.number).padStart(2,'0')} · ${p.name}`]))};
  const cropLabels={rectangle:'사각형',trapezoid:'사다리꼴',parallelogram:'평행사변형',diamond:'마름모',triangle:'삼각형',hexagon:'육각형',ellipse:'타원',custom:'자유 다각형'};
  const typeLabels={bubble:'말풍선',sfx:'효과음',text:'텍스트',image:'이미지',shape:'컷',pen:'펜',effect:'효과선'};
  const fontNames={'Nanum Gothic':'나눔고딕','Nanum Myeongjo':'나눔명조','Black Han Sans':'검은고딕','Do Hyeon':'도현','Jua':'주아','Gowun Dodum':'고운돋움','Gowun Batang':'고운바탕','Nanum Pen Script':'나눔손글씨 펜','Nanum Brush Script':'나눔손글씨 붓','Gaegu':'개구','Gamja Flower':'감자꽃'};
  const sfxPresets=[['쾅!','Black Han Sans','#f18a45',-10],['두근','Jua','#dc7891',0],['슈우욱','Nanum Brush Script','#3c688c',-12],['반짝','Gaegu','#c4a44d',0],['와장창!','Do Hyeon','#334440',-9],['사아아…','Nanum Pen Script','#61886d',0],['쿵','Black Han Sans','#423f59',-5],['철컥','Do Hyeon','#6a7782',0],['또각','Gowun Batang','#66543f',0],['우당탕!','Jua','#d0703f',-5],['휘이잉','Nanum Brush Script','#5b8c99',-12],['찌릿!','Do Hyeon','#bca135',-8]];
  const measureCanvas=document.createElement('canvas'),measureCtx=measureCanvas.getContext('2d');
  let project,selected=null,tab='bubbles',view='page',tool='select',mode='normal',zoom=.5,showGrid=false,snap=true,preview=false;
  let history=[],historyIndex=-1,drag=null,space=false,clipboard=null,autosaveTimer,toastTimer,dbPromise,dirty=false,saveGeneration=0;
  let penColor='#253b30',penWidth=6,exporting=false,booting=true;
  let bubbleCollection='basic',rotationGuide=null;
  let guides=[],frameImportTarget=null,framePickerTarget=null,dropFrameId=null;
  let materialLibrary=MaterialLibrary.empty(),materialDirty=false,materialImageCategory='bubbles',materialToDelete=null,materialSaveGeneration=0,materialDraft=null;
  const fonts=[...(window.BUNDLED_FONTS||[])];
  const bundledFontNames=new Set(fonts.map(f=>f.name));
  const imageURLs=new Map(),renderedHTML=new WeakMap();
  function setRenderedHTML(el,html){if(renderedHTML.get(el)!==html){el.innerHTML=html;renderedHTML.set(el,html);}}
  function imageURL(id) {
    const a=project.assets[id],cached=imageURLs.get(id);if(cached?.src===a.src)return cached.url;
    if(cached)URL.revokeObjectURL(cached.url);
    const [header,data]=a.src.split(','),raw=atob(data),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
    const url=URL.createObjectURL(new Blob([bytes],{type:header.slice(5,header.indexOf(';'))}));imageURLs.set(id,{src:a.src,url});return url;
  }
  function clearImageURLs(){for(const {url} of imageURLs.values())URL.revokeObjectURL(url);imageURLs.clear();}
  const page=()=>project.pages.find(p=>p.id===project.activePage)||project.pages[0];
  const object=()=>page().objects.find(o=>o.id===selected);
  const hasImage=o=>Boolean(o&&(o.type==='image'||o.type==='shape')&&o.assetId&&project.assets[o.assetId]);
  function base(type,extra={}) {return {id:uid(),type,name:typeLabels[type],x:100,y:180,w:300,h:180,rotation:0,opacity:1,visible:true,locked:false,...extra};}
  function bubble(shape='ellipse',extra={}) {
    const preset=BubbleCatalog.get(shape);
    return base('bubble',{shape,fill:'#ffffff',stroke:'#243b31',strokeWidth:3,text:'여기에 대사를\n입력하세요.',font:'Nanum Gothic',fontSize:30,weight:400,color:'#23352f',align:'center',lineHeight:1.45,padding:25,tail:shape!=='caption',tailAngle:65,tailWidth:34,tailX:.92,tailY:1.5,bendX:0,bendY:0,...(preset?{w:preset.w,h:preset.h,name:preset.name,...preset.defaults,...(preset.regions?{text:'첫 번째 대사',text2:'두 번째 대사'}:{})}:{}),...extra});
  }
  function textObject(text='새로운 이야기',extra={}) {return base('text',{text,font:'Nanum Gothic',fontSize:48,weight:400,color:'#23352f',align:'left',lineHeight:1.4,padding:0,letterSpacing:0,w:560,h:150,...extra});}
  function newPage(width=900,height=1400) {return {id:uid(),name:'새 페이지',width,height,background:'#ffffff',objects:[]};}
  function freshProject() {
    const p=newPage();p.name='첫 번째 장면';
    return {format:'panel-studio',version:1,name:'나의 첫 번째 이야기',activePage:p.id,pages:[p],assets:{},fonts:[]};
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
    const ids=new Set(project.pages.flatMap(p=>p.objects.filter(hasImage).map(o=>o.assetId)));
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
  // Keep an imported font from replacing another project's or a bundled typeface.
  function resolveFontConflicts(doc,objects) {
    for(const name of new Set((doc.fonts||[]).map(f=>f.name))) {
      const incoming=doc.fonts.filter(f=>f.name===name),existing=fonts.filter(f=>f.name===name);
      if(existing.length&&incoming.some(f=>!existing.some(x=>(x.weight||400)===(f.weight||400)&&x.data===f.data))) {
        let renamed;do{renamed=name.slice(0,150)+' '+uid().slice(-7);}while(fonts.some(f=>f.name===renamed)||doc.fonts.some(f=>f.name===renamed));
        incoming.forEach(f=>f.name=renamed);objects.forEach(o=>{if(o.font===name)o.font=renamed;});
      }
    }
    return doc;
  }
  async function addFontFaces(list) {
    const added=list.filter(f=>!fonts.some(x=>x.name===f.name&&(x.weight||400)===(f.weight||400)&&x.data===f.data));
    await registerFonts(added);fonts.push(...added);
  }
  async function persistMaterials() {
    const generation=++materialSaveGeneration,saved=clone(materialLibrary);materialDirty=true;
    try {
      const db=await getDB();await new Promise((resolve,reject)=>{const t=db.transaction('documents','readwrite');t.objectStore('documents').put(saved,'materials');t.oncomplete=resolve;t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||Error('저장 취소'));});
      if(generation===materialSaveGeneration)materialDirty=false;return true;
    }catch(e){toast('내 소재를 기기에 저장하지 못했습니다. ‘내 소재 내보내기’로 파일을 보관하세요.');return false;}
  }
  function materialControlsHTML(category) {
    const label=category==='bubbles'?'말풍선':'효과음';
    return `<div class="material-actions"><button class="primary full" data-action="new-material-${category}">＋ 내 ${label} 만들기</button><div class="material-actions-row"><button data-action="save-material">선택한 소재 저장</button><button data-action="import-material-image">내 그림 불러오기</button></div></div>`;
  }
  function materialPreview(item) {
    const o={...item.template,x:0,y:0,rotation:0};
    if(o.type==='image')return `<img src="${esc(materialLibrary.assets[o.assetId].src)}" alt="" loading="lazy">`;
    const tail=o.type==='bubble'&&o.tail!==false&&o.shape!=='caption'?tailGeometry(o):null;
    const points=tail?[tail.start,tail.end,tail.tip,tail.control]:[],pad=Math.max(12,(o.strokeWidth||0)*2);
    const x=Math.min(0,...points.map(p=>p.x))-pad,y=Math.min(0,...points.map(p=>p.y))-pad;
    const w=Math.max(o.w,...points.map(p=>p.x))-x+pad,h=Math.max(o.h,...points.map(p=>p.y))-y+pad;
    return `<svg viewBox="${x} ${y} ${w} ${h}" aria-hidden="true">${objectSVG(o,false,'material-')}</svg>`;
  }
  function materialItemsHTML(category) {
    const items=materialLibrary.items.filter(i=>i.category===category),label=category==='bubbles'?'말풍선':'효과음';
    return `<div class="material-section-title">내 ${label} <span>${items.length}</span></div>`+(items.length?`<div class="material-grid">${items.map(item=>`<div class="material-card"><button class="material-item" data-add-material="${esc(item.id)}" title="${esc(item.name)} 추가">${materialPreview(item)}<span>${esc(item.name)}</span></button><button class="material-delete" data-delete-material="${esc(item.id)}" aria-label="${esc(item.name)} 소재 삭제">×</button></div>`).join('')}</div>`:`<p class="material-empty">나만의 ${label}을 만들어 보세요.<br>다른 프로젝트에서도 꺼내 쓸 수 있어요.</p>`);
  }
  function materialDialog(category,selectedObject=null) {
    const label=category==='bubbles'?'말풍선':'효과음';materialDraft=selectedObject?clone(selectedObject):null;
    const choices=Object.entries(labels).map(([value,label])=>`<option value="${value}">${label}</option>`).join('');
    const fontChoices=[...new Set(fonts.map(f=>f.name))].map(name=>`<option value="${esc(name)}" ${name==='Black Han Sans'?'selected':''}>${esc(fontNames[name]||name)}</option>`).join('');
    modal(selectedObject?'선택한 소재 저장':`내 ${label} 만들기`,`<p>${selectedObject?'현재 모양·크기·꼬리·글자 스타일을 함께 저장합니다.':'이름을 붙여 저장하면 왼쪽 내 소재에서 언제든 추가할 수 있어요.'}</p><label for="material-name">소재 이름</label><input id="material-name" maxlength="80" value="${esc(selectedObject?.name||'나만의 '+label)}"><label for="material-category">저장 위치</label><select id="material-category" ${selectedObject?.type==='image'?'':'disabled'}><option value="bubbles" ${category==='bubbles'?'selected':''}>내 말풍선</option><option value="sfx" ${category==='sfx'?'selected':''}>내 효과음</option></select>${selectedObject?'':category==='bubbles'?`<label for="material-shape">말풍선 모양</label><select id="material-shape">${choices}</select><label for="material-text">기본 대사</label><textarea id="material-text" rows="3" maxlength="20000">여기에 대사를 입력하세요.</textarea>`:`<label for="material-text">효과음 글자</label><textarea id="material-text" rows="2" maxlength="20000">두둥!</textarea><label for="material-font">글꼴</label><select id="material-font">${fontChoices}</select><label for="material-color">글자색</label><input class="material-color" id="material-color" type="color" value="#e5874b">`}<p class="material-preview-note">${selectedObject?.type==='image'?'그림 소재는 이미지로 편집됩니다. 대사는 상단 ‘텍스트만 추가’로 올려 보세요.':'캔버스에서 자유롭게 다듬은 뒤 ‘선택한 소재 저장’으로 새 버전도 만들 수 있어요.'}</p>`,`<button class="quiet" data-action="close-modal">취소</button><button class="primary" data-action="create-material">${selectedObject?'내 소재에 저장':'저장하고 캔버스에 추가'}</button>`);
    $('#material-name').focus();$('#material-name').select();
  }
  function saveSelectedMaterial() {
    const o=object();if(!o||!['bubble','sfx','text','image'].includes(o.type)){toast('저장할 말풍선, 텍스트, 효과음 또는 이미지를 먼저 선택하세요.');return;}
    materialDialog(o.type==='bubble'?'bubbles':o.type==='image'?(tab==='sfx'?'sfx':'bubbles'):'sfx',o);
  }
  async function createMaterial() {
    const name=$('#material-name').value.trim(),category=$('#material-category').value;
    if(!name){toast('소재 이름을 입력하세요.');$('#material-name').focus();return;}
    try {
      const addToCanvas=!materialDraft,template=materialDraft||(category==='bubbles'?bubble($('#material-shape').value,{text:$('#material-text').value,name}):textObject($('#material-text').value,{type:'sfx',name,font:$('#material-font').value,color:$('#material-color').value,fontSize:100,weight:700,w:500,h:200,align:'center',skew:0,textStroke:'#ffffff',textStrokeWidth:3}));
      const result=MaterialLibrary.add(materialLibrary,{category,name,template,asset:project.assets[template.assetId],fontFaces:fonts.filter(f=>!bundledFontNames.has(f.name))});
      materialLibrary=result.library;tab=category;$('#modal').close();renderLibrary();if(addToCanvas)addMaterial(result.item.id);
      if(await persistMaterials())toast('내 소재에 저장했습니다. 다른 프로젝트에서도 사용할 수 있어요.');
    }catch(e){toast('소재 저장 실패: '+e.message);}
  }
  function addMaterial(id) {
    const item=materialLibrary.items.find(i=>i.id===id);if(!item)return;
    const o={...clone(item.template),id:uid(),name:item.name,visible:true,locked:false};
    if(o.type==='image') {
      const asset=materialLibrary.assets[o.assetId];let stored=Object.values(project.assets).find(a=>a.src===asset.src);
      if(!stored){stored={...clone(asset),id:uid()};project.assets[stored.id]=stored;}o.assetId=stored.id;
    }
    addObject(place(o));
  }
  async function importMaterialImages(files) {
    const category=materialImageCategory;let count=0;
    for(const file of files)try {
      if(!/^image\/(png|jpeg|webp|gif|bmp)$/.test(file.type))throw Error('PNG, JPG, WEBP, GIF, BMP 이미지를 선택하세요.');
      if(file.size>50*1024*1024)throw Error('이미지 한 장은 50MB 이하로 선택하세요.');
      const src=await readData(file),im=await loadImage(src),width=im.naturalWidth,height=im.naturalHeight;
      if(width*height>120000000)throw Error('이미지가 너무 큽니다. 1억 2천만 픽셀 이하로 줄여 주세요.');
      const scale=Math.min(1,500/width,500/height),name=file.name.replace(/\.[^.]+$/,'').slice(0,80)||'내 그림';
      const asset={id:uid(),name,src,width,height},template=base('image',{name,w:Math.max(1,Math.round(width*scale)),h:Math.max(1,Math.round(height*scale)),assetId:asset.id,crop:'rectangle',points:clone(crops.rectangle),imageZoom:1,imageX:0,imageY:0,fade:0,fadeAngle:90,fadeStart:0,stroke:'#23352f',strokeWidth:0});
      materialLibrary=MaterialLibrary.add(materialLibrary,{category,name,template,asset}).library;count++;
    }catch(e){toast('그림 소재 추가 실패: '+e.message);}
    if(count){tab=category;renderLibrary();if(await persistMaterials())toast(`${count}개 그림을 내 소재에 저장했습니다. 눌러서 캔버스에 추가하세요.`);}
  }
  async function importMaterialLibrary(file) {
    try {
      if(file.size>512*1024*1024)throw Error('소재 파일은 512MB 이하만 열 수 있습니다.');
      const incoming=MaterialLibrary.validate(JSON.parse(await file.text()));resolveFontConflicts(incoming,incoming.items.map(i=>i.template));
      const result=MaterialLibrary.merge(materialLibrary,incoming);await addFontFaces(result.library.fonts);materialLibrary=result.library;
      if(!['bubbles','sfx'].includes(tab))tab='bubbles';renderLibrary();renderProperties();
      if(await persistMaterials())toast(`${result.count}개 소재를 불러왔습니다. 이미 있는 소재는 유지했습니다.`);
    }catch(e){toast('소재 열기 실패: '+e.message);}
  }
  async function exportMaterialLibrary() {
    try{if(await download(new Blob([JSON.stringify(materialLibrary)],{type:'application/json'}),'Panel-Studio-내-소재.panel-library.json'))toast('내 소재 파일을 저장했습니다. 그림과 추가 글꼴도 함께 보관됩니다.');}catch(e){toast('소재 내보내기 실패: '+e.message);}
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
  function outline(o) {return `fill="${o.transparent?'none':esc(o.fill||'#ffffff')}" stroke="${esc(o.stroke||'#23352f')}" stroke-width="${o.strokeWidth||0}" stroke-linejoin="${o.shape==='caption'?'miter':BubbleCatalog.get(o.shape)?.join||'round'}"`;}
  function clipShape(o) {return o.crop==='ellipse'?`<ellipse cx="${o.w/2}" cy="${o.h/2}" rx="${o.w/2}" ry="${o.h/2}"/>`:`<path d="${polygonPath(o.points||crops.rectangle,o.w,o.h)}"/>`;}
  function objectSVG(o,interactive=true,prefix='') {
    if(o.visible===false)return '';
    let inner='';const id=prefix+o.id;
    if(o.type==='bubble') {
      inner=`<path d="${bubblePath(o)}" ${outline(o)} ${o.shape==='whisper'?'stroke-dasharray="7 6"':''}/>`;
      if(dottedTail(o))inner+=thoughtTail(o).map(p=>`<ellipse cx="${p.x}" cy="${p.y}" rx="${p.rx}" ry="${p.ry}" ${outline(o)}/>`).join('');
      inner+=textAreas(o).map(a=>`<g data-dialogue="${a.key}" transform="translate(${a.x} ${a.y})">${textSVG({...o,w:a.w,h:a.h,text:o[a.key]||''})}</g>`).join('');
    } else if(o.type==='text'||o.type==='sfx') inner=textSVG(o);
    else if(hasImage(o)) {
      const a=project.assets[o.assetId];if(!a)return '';
      const {x:ix,y:iy,w:iw,h:ih}=imagePlacement(o,a);
      const angle=(o.fadeAngle||0)*Math.PI/180,dx=Math.cos(angle)*.5,dy=Math.sin(angle)*.5;
      const clipping=clipShape(o), strokeShape=clipping.replace('/>',` fill="none" stroke="${esc(o.stroke||'#23352f')}" stroke-width="${o.strokeWidth||0}" stroke-linejoin="round"/>`);
      inner=`<defs><clipPath id="clip-${id}">${clipping}</clipPath><linearGradient id="gradient-${id}" x1="${.5-dx}" y1="${.5-dy}" x2="${.5+dx}" y2="${.5+dy}"><stop offset="${o.fadeStart||0}" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="${1-(o.fade||0)}"/></linearGradient><mask id="mask-${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="${o.w}" height="${o.h}"><rect width="${o.w}" height="${o.h}" fill="url(#gradient-${id})"/></mask></defs><g clip-path="url(#clip-${id})">${o.type==='shape'&&!o.transparent?`<rect width="${o.w}" height="${o.h}" fill="${esc(o.fill||'#ffffff')}"/>`:''}<image href="${esc(interactive?imageURL(o.assetId):a.src)}" x="${num(ix)}" y="${num(iy)}" width="${num(iw)}" height="${num(ih)}" preserveAspectRatio="none" ${o.fade?`mask="url(#mask-${id})"`:''}/></g>${strokeShape}`;
    } else if(o.type==='shape') {
      inner=o.crop==='ellipse'?`<ellipse cx="${o.w/2}" cy="${o.h/2}" rx="${o.w/2}" ry="${o.h/2}" ${outline(o)}/>`:`<path d="${polygonPath(o.points||crops.rectangle,o.w,o.h)}" ${outline(o)}/>`;
      if(interactive&&!preview){const size=Math.min(16/zoom,o.w/14,o.h/8);inner+=`<g class="frame-placeholder" pointer-events="none"><text x="${o.w/2}" y="${o.h/2-size*.4}" text-anchor="middle" font-size="${size*1.7}" fill="#91aa8c">＋</text><text x="${o.w/2}" y="${o.h/2+size*1.2}" text-anchor="middle" font-size="${size}" fill="#7c9175">이미지를 끌어 놓으세요</text></g>`;}
    } else if(o.type==='pen') inner=`<path d="${(o.points||[]).map((p,i)=>`${i?'L':'M'}${num(p[0]*o.w)},${num(p[1]*o.h)}`).join(' ')}" fill="none" stroke="${esc(o.stroke)}" stroke-width="${o.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`;
    else if(o.type==='effect') {
      let seed=o.seed||123,rand=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
      for(let i=0;i<(o.density||60);i++) {
        if(o.effect==='speed'){const y=rand()*o.h;inner+=`<line x1="${rand()*o.w*.4}" y1="${y}" x2="${o.w}" y2="${y}" stroke="${esc(o.stroke)}" stroke-width="${(.3+rand())*o.strokeWidth}"/>`;}
        else {const a=i/(o.density||60)*Math.PI*2,innerR=.18+rand()*.15,x=Math.cos(a)*o.w,y=Math.sin(a)*o.h;inner+=`<path d="M${o.w/2+x},${o.h/2+y} L${o.w/2+x*innerR},${o.h/2+y*innerR} L${o.w/2+x+Math.sin(a)*o.strokeWidth*2},${o.h/2+y-Math.cos(a)*o.strokeWidth*2}Z" fill="${esc(o.stroke)}"/>`;}
      }
      inner=`<svg width="${o.w}" height="${o.h}" viewBox="0 0 ${o.w} ${o.h}" overflow="hidden">${inner}</svg>`;
    }
    if(interactive&&dropFrameId===o.id)inner+=`<g class="frame-drop-highlight" pointer-events="none">${clipShape(o).replace('/>',' fill="#8cc6aa" fill-opacity=".25" stroke="#2b8d68" stroke-width="3" vector-effect="non-scaling-stroke"/>')}</g>`;
    return `<g ${interactive?`class="object ${o.locked?'locked':''}" data-object="${esc(o.id)}"`:''} transform="translate(${num(o.x)} ${num(o.y)}) rotate(${num(o.rotation||0)} ${o.w/2} ${o.h/2})" opacity="${o.opacity??1}">${interactive?`<rect width="${o.w}" height="${o.h}" fill="transparent"/>`:''}${inner}</g>`;
  }
  function selectionSVG(o) {
    if(!o||preview)return '';
    const r=5/zoom,t=tailGeometry(o);
    let s=`<rect class="selection-box" width="${o.w}" height="${o.h}"/>`;
    if(!o.locked&&mode==='image-pan'&&hasImage(o)) {
      const b=imagePlacement(o,project.assets[o.assetId]);
      s=`<image class="content-ghost" href="${esc(imageURL(o.assetId))}" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" opacity=".16" pointer-events="none"/>`+s+`<rect class="content-bounds" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}"/>`;
      for(const [h,x,y] of [['nw',b.x,b.y],['ne',b.x+b.w,b.y],['se',b.x+b.w,b.y+b.h],['sw',b.x,b.y+b.h]])s+=`<rect class="handle content-handle" data-handle="content-${h}" x="${x-r}" y="${y-r}" width="${r*2}" height="${r*2}"/>`;
      return `<g class="selection-overlay content-selection" transform="translate(${o.x} ${o.y}) rotate(${o.rotation||0} ${o.w/2} ${o.h/2})">${s}</g>`;
    }
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
    return `<svg xmlns="http://www.w3.org/2000/svg" ${interactive?`class="page-canvas" data-page="${p.id}"`:''} width="${interactive?p.width*zoom:p.width}" height="${interactive?p.height*zoom:p.height}" viewBox="0 0 ${p.width} ${p.height}">${css}<defs><clipPath id="page-clip-${prefix}${p.id}"><rect width="${p.width}" height="${p.height}"/></clipPath></defs>${background?`<rect width="${p.width}" height="${p.height}" fill="${esc(p.background)}"/>`:''}<g clip-path="url(#page-clip-${prefix}${p.id})">${p.objects.map(o=>objectSVG(o,interactive,prefix)).join('')}</g>${grid}${interactive&&p.id===page().id?selectionSVG(object())+guidesSVG()+rotationGuideSVG():''}</svg>`;
  }
  function guidesSVG(){
    if(preview||!guides.length)return '';
    return `<g class="snap-guides" pointer-events="none">${guides.map(g=>{const x=g.axis==='x'?g.value:g.from-12/zoom,y=g.axis==='y'?g.value:g.from-12/zoom,x2=g.axis==='x'?g.value:g.to+12/zoom,y2=g.axis==='y'?g.value:g.to+12/zoom;return `<line data-guide-axis="${g.axis}" data-guide-source="${g.source}" x1="${x}" y1="${y}" x2="${x2}" y2="${y2}"/><circle cx="${x}" cy="${y}" r="${2.5/zoom}"/><circle cx="${x2}" cy="${y2}" r="${2.5/zoom}"/>`;}).join('')}</g>`;
  }
  function rotationGuideSVG(){
    const o=object();if(preview||!rotationGuide||!o)return '';
    const a=o.rotation*Math.PI/180,cx=o.x+o.w/2,cy=o.y+o.h/2,r=38/zoom,length=Math.max(o.w,o.h)*.7+24/zoom;
    const matched=rotationGuide.match,angle=Math.round(Alignment.displayAngle(o.rotation)*10)/10;
    const label=`${angle===360?0:angle}°${matched?matched.source==='object'?matched.perpendicular?' · 직각 맞춤':' · 평행 맞춤':' · 각도 맞춤':''}`;
    const hx=cx+Math.sin(a)*(o.h/2+25/zoom),hy=cy-Math.cos(a)*(o.h/2+25/zoom),width=(matched?132:70)/zoom;
    const line=(x,y,len,angle)=>`<line x1="${x-Math.cos(angle)*len}" y1="${y-Math.sin(angle)*len}" x2="${x+Math.cos(angle)*len}" y2="${y+Math.sin(angle)*len}"/>`;
    const other=matched?.objectId?page().objects.find(p=>p.id===matched.objectId):null;
    return `<g class="rotation-guide ${matched?'snapped':''}" data-angle-snapped="${Boolean(matched)}" data-angle-source="${matched?.source||'free'}" pointer-events="none"><circle class="angle-ring" cx="${cx}" cy="${cy}" r="${r}"/>${line(cx,cy,length,a)}${line(cx,cy,r+8/zoom,a+Math.PI/2)}${other?line(other.x+other.w/2,other.y+other.h/2,Math.max(other.w,other.h)*.6,(other.rotation||0)*Math.PI/180):''}<circle class="angle-center" cx="${cx}" cy="${cy}" r="${3/zoom}"/><g transform="translate(${hx+13/zoom} ${hy-12/zoom})"><rect width="${width}" height="${25/zoom}" rx="${5/zoom}"/><text x="${width/2}" y="${16/zoom}" text-anchor="middle" font-size="${11/zoom}">${label}</text></g></g>`;
  }
  function renderStage() {
    setRenderedHTML($('#stage'),(view==='page'?[page()]:project.pages).map(p=>`<div class="page-wrap ${p.id===page().id?'active':''}" data-caption="PAGE ${String(project.pages.indexOf(p)+1).padStart(2,'0')}  /  ${p.width} × ${p.height} PX">${pageSVG(p)}</div>`).join(''));
    $('#stage').classList.toggle('is-preview',preview);$('#stage').style.cursor=tool==='hand'||space?'grab':tool==='pen'?'crosshair':'';
  }
  function renderPages() {
    $('#page-count').textContent=String(project.pages.length).padStart(2,'0');
    $('#page-list').innerHTML=project.pages.map((p,i)=>`<button class="page-item ${page().id===p.id?'active':''}" data-page-select="${p.id}"><span class="page-icon">${String(i+1).padStart(2,'0')}</span><span><b>${esc(p.name)}</b><small>${p.width} × ${p.height} px</small></span><span class="page-menu">${i+1}</span></button>`).join('');
    const i=project.pages.indexOf(page());$('#page-status').textContent=`PAGE ${String(i+1).padStart(2,'0')}`;$('#dimensions').textContent=`${page().width} × ${page().height} px`;$('#page-position').textContent=`${i+1} / ${project.pages.length}`;$('#zoom-label').textContent=`${Math.round(zoom*100)}%`;
    $('#canvas-size-label').textContent=`${page().width} × ${page().height} px`;
  }
  function renderLayers() {
    $('#layer-count').textContent=page().objects.length;
    setRenderedHTML($('#layers'),[...page().objects].reverse().map(o=>`<div class="layer ${o.id===selected?'active':''} ${o.visible===false?'hidden':''}" data-layer="${o.id}"><span class="layer-type">${{bubble:'◯',text:'T',sfx:'팡',image:'▧',shape:'▱',pen:'✎',effect:'✴'}[o.type]}</span><span class="layer-name">${esc(o.name||typeLabels[o.type])}</span><button data-lock="${o.id}" class="${o.locked?'on':''}" aria-label="레이어 잠금">${o.locked?'▣':'▫'}</button><button data-visible="${o.id}" aria-label="레이어 표시">${o.visible===false?'○':'●'}</button></div>`).join(''));
  }
  function renderContext() {
    const o=object();
    $('#context-hint').textContent=preview?'완성된 장면을 확인하세요. 미리 보기를 다시 누르면 편집합니다.':tool==='pen'?'드래그하여 선을 그리세요. B: 펜 · V: 선택':mode==='tail'?'주황색 점으로 꼬리의 끝점·붙는 위치·휘어짐을 조절하세요.':mode==='crop'?'초록색 꼭짓점을 움직이세요. 테두리를 더블클릭하면 편집점이 추가됩니다.':mode==='image-pan'?'안쪽 이미지만 편집 중 · 드래그로 이동 · 초록 모서리로 크기 조절 · Esc: 컷 편집':o?`${typeLabels[o.type]} 선택됨 · 방향키로 이동 · Shift: 10px 이동`:'소재를 선택하면 캔버스에 추가됩니다. 이미지를 끌어 놓을 수도 있어요.';
    setRenderedHTML($('#context-actions'),o&&!preview?`${o.type==='bubble'&&o.shape!=='caption'?`<button data-action="tail-mode" class="${mode==='tail'?'active':''}">꼬리 편집</button>`:''}${['image','shape'].includes(o.type)?`<button data-action="crop-mode" class="${mode==='crop'?'active':''}">모양 편집</button>`:''}${hasImage(o)?`<button data-action="image-pan" class="${mode==='image-pan'?'active':''}">${mode==='image-pan'?'컷 편집으로':'안쪽 이미지 편집'}</button>`:o.type==='shape'?'<button data-action="frame-import">컷에 이미지 넣기</button>':''}`:'');
    $$('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));$$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
    $('#grid-button').classList.toggle('active',showGrid);$('#snap-button').classList.toggle('active',snap);$('#snap-button').setAttribute('aria-pressed',String(snap));$('#preview-button').textContent=preview?'편집으로':'미리 보기';
  }
  function render(){renderStage();renderPages();renderProperties();renderLayers();renderContext();updateHistoryButtons();$('#project-name').value=project.name;}
  function fit(){zoom=clamp(Math.min(($('#stage-viewport').clientWidth-100)/page().width,($('#stage-viewport').clientHeight-85)/page().height),.025,2);renderStage();renderPages();}
  function addObject(o){if(preview)preview=false;page().objects.push(o);selected=o.id;tool='select';mode=o.type==='bubble'&&o.shape!=='caption'&&o.tail!==false?'tail':'normal';commit();render();}
  function visibleCenter(){const v=$('#stage-viewport'),svg=$('.page-canvas[data-page="'+page().id+'"]');if(!svg)return {x:page().width/2,y:page().height/2};const b=v.getBoundingClientRect();return screenPoint(svg,b.left+v.clientWidth/2,b.top+v.clientHeight/2);}
  function place(o){const c=visibleCenter();o.x=Math.round(clamp(c.x-o.w/2,0,page().width-o.w));o.y=Math.round(clamp(c.y-o.h/2,0,page().height-o.h));return o;}
  function screenPoint(svg,x,y){return new DOMPoint(x,y).matrixTransform(svg.getScreenCTM().inverse());}
  const field=(label,key,value,min=-100000,max=100000,step=1)=>`<div class="prop-field"><label>${label}</label><input aria-label="${label}" data-prop="${key}" type="number" value="${num(value??0)}" min="${min}" max="${max}" step="${step}"></div>`;
  const range=(label,key,value,min,max,step=1,suffix='')=>`<div class="prop-row"><label>${label}</label><input aria-label="${label}" type="range" data-prop="${key}" value="${value}" min="${min}" max="${max}" step="${step}"><output>${num(value)}${suffix}</output></div>`;
  const color=(label,key,value)=>`<div class="prop-row"><label>${label}</label><div class="color-field"><input aria-label="${label}" type="color" data-prop="${key}" value="${esc(value||'#ffffff')}"><span>${esc(value||'#ffffff')}</span></div></div>`;
  const select=(key,value,options,label)=>`<select aria-label="${label||key}" data-prop="${key}">${Object.entries(options).map(([v,l])=>`<option value="${esc(v)}" ${String(v)===String(value)?'selected':''}>${esc(l)}</option>`).join('')}</select>`;
  const section=(title,body)=>`<section class="prop-section"><div class="prop-title">${title}</div>${body}</section>`;
  function imageProperties(o){return section(o.type==='shape'?'안쪽 이미지 위치·크기':'이미지 구도',range('이미지 크기','imageZoom',o.imageZoom||1,.1,20,.05,'×')+(o.type==='shape'?`<div class="prop-row">${field('이미지 X (px)','contentX',(o.imageX||0)*o.w,-100*o.w,100*o.w)}${field('이미지 Y (px)','contentY',(o.imageY||0)*o.h,-100*o.h,100*o.h)}</div>`:range('좌우 이동','imageX',o.imageX||0,-5,5,.01)+range('상하 이동','imageY',o.imageY||0,-5,5,.01))+`<button class="secondary full" data-action="image-pan">${mode==='image-pan'?'✓ 컷 편집으로':'안쪽 이미지 이동·크기'}</button><button class="quiet full" data-action="reset-image">컷에 가득 채우기 · 위치 초기화</button><p class="small">더블클릭으로 이미지 편집 · 초록 모서리로 크기 조절</p>`);}
  function frameProperties(o){
    return section('컷 안의 이미지',`<div class="frame-image-actions"><button class="primary full" data-action="frame-import">${hasImage(o)?'이미지 교체':'＋ 컷에 이미지 넣기'}</button><button class="secondary full" data-action="frame-choose-asset">프로젝트 이미지에서 선택</button>${hasImage(o)?'<button class="quiet full" data-action="frame-remove-image">컷에서 이미지만 빼기</button>':'<p class="small">이미지 파일을 컷 위에 끌어 놓아도 됩니다.</p>'}</div>`)+(hasImage(o)&&mode==='image-pan'?imageProperties(o):'')+section('컷 테두리',range('두께 (px)','strokeWidth',o.strokeWidth||0,0,100)+color('테두리 색','stroke',o.stroke));
  }
  function renderProperties() {
    const o=object();$('#selection-type').textContent=o?o.type.toUpperCase():'CANVAS';
    if(tool==='pen') {$('#properties').innerHTML=section('펜 설정',color('펜 색상','penColor',penColor)+range('선 굵기','penWidth',penWidth,1,100))+`<p class="empty-info">캔버스 위에 자유롭게 그리세요. 선 하나가 레이어 하나로 저장되어 이동·삭제·투명도 조절이 가능합니다.</p>`;return;}
    if(!o) {
      $('#properties').innerHTML=section('캔버스 설정',`<div class="prop-field"><label>페이지 이름</label><input data-page-prop="name" aria-label="페이지 이름" value="${esc(page().name)}" style="width:100%"></div><div class="prop-row" style="margin-top:12px">${field('가로 (px)','pageWidth',page().width,1,8000)}${field('세로 (px)','pageHeight',page().height,1,8000)}</div><button class="secondary full" data-action="resize-page">크기 적용</button><p class="small" style="margin-top:8px">페이지당 최대 8000 × 8000 px</p>`)+section('배경',color('배경색','pageBackground',page().background))+section('페이지 관리',`<div class="prop-row"><button class="secondary full" data-action="duplicate-page">페이지 복제</button><button class="quiet full danger" data-action="delete-page">삭제</button></div><div class="prop-row"><button class="quiet full" data-action="page-up">↑ 앞으로</button><button class="quiet full" data-action="page-down">↓ 뒤로</button></div>`)+`<div class="tip-card"><strong>당신의 이야기를 시작하세요</strong>왼쪽에서 소재를 추가하거나 이미지를 끌어 놓으세요.<br>클릭하여 선택 · 모서리로 크기 조절<br>마우스 휠: 스크롤 · Ctrl+휠: 확대</div>`;return;
    }
    let html=(o.type==='shape'?frameProperties(o):'')+section(o.type==='shape'?'컷 위치와 크기':'위치와 크기',`<input data-prop="name" aria-label="레이어 이름" value="${esc(o.name)}" style="width:100%;margin-bottom:12px"><div class="prop-row">${field('X','x',o.x)}${field('Y','y',o.y)}</div><div class="prop-row">${field('가로','w',o.w,1,16000)}${field('세로','h',o.h,1,16000)}</div><div class="prop-row">${field('회전 (°)','rotation',o.rotation,-360,360)}<button class="quiet" data-action="center">가운데 정렬</button></div>${range('불투명도','opacity',Math.round((o.opacity??1)*100),0,100,1,'%')}`);
    if(o.type==='bubble') html+=section('말풍선 모양',select('shape',o.shape,labels,'말풍선 모양')+`<div style="height:12px"></div>`+color('채우기','fill',o.fill)+color('외곽선','stroke',o.stroke)+range('선 굵기','strokeWidth',o.strokeWidth,0,30)+`<label class="check-row"><input type="checkbox" data-prop="transparent" ${o.transparent?'checked':''}>배경 투명하게</label>`)+(o.shape==='caption'?'':section('꼬리 조절',`<label class="check-row"><input type="checkbox" data-prop="tail" ${o.tail!==false?'checked':''}>꼬리 표시</label><button data-action="tail-mode" class="secondary full">${mode==='tail'?'꼬리 편집 마치기':'캔버스에서 꼬리 편집'}</button><div style="height:12px"></div>${range('붙는 각도','tailAngle',o.tailAngle,0,360,1,'°')}${range('꼬리 폭','tailWidth',o.tailWidth,5,180)}<p class="small">끝점은 자유롭게 이동할 수 있어요.<br>휘어짐 점을 움직여 곡선 꼬리를 만드세요.</p>`));
    if(['bubble','text','sfx'].includes(o.type)) {
      const available=Object.fromEntries([...new Set(fonts.map(f=>f.name))].map(n=>[n,fontNames[n]||n]));
      html+=section('텍스트',`${textAreas(o).length>1?'<label class="dialogue-label">첫 번째 대사</label>':''}<textarea data-prop="text" aria-label="텍스트 내용" rows="3" maxlength="20000">${esc(o.text)}</textarea>${textAreas(o).length>1?`<label class="dialogue-label">두 번째 대사</label><textarea data-prop="text2" aria-label="두 번째 대사" rows="3" maxlength="20000">${esc(o.text2||'')}</textarea>`:''}${textAlignButtons(o)}<div style="height:10px"></div>${select('font',o.font,available,'글꼴')}<div class="prop-row" style="margin-top:10px">${field('크기 (px)','fontSize',o.fontSize,4,1500)}<div class="prop-field"><label>굵기</label>${select('weight',o.weight||400,{100:'100 · 가늘게',300:'300 · 얇게',400:'400 · 보통',500:'500 · 중간',700:'700 · 굵게',800:'800 · 아주 굵게',900:'900 · 두껍게'},'글꼴 굵기')}</div></div>${color('글자색','color',o.color)}<div class="prop-row"><label class="check-row"><input type="checkbox" data-prop="italic" ${o.italic?'checked':''}>기울임</label></div>${range('행간','lineHeight',o.lineHeight||1.4,.7,3,.05)}${range('자간','letterSpacing',o.letterSpacing||0,-10,50,.5)}${range('안쪽 여백','padding',o.padding||0,0,150)}${color('글자 외곽선','textStroke',o.textStroke||'#ffffff')}${range('외곽선 굵기','textStrokeWidth',o.textStrokeWidth||0,0,30)}${o.type==='sfx'?range('기울이기','skew',o.skew||0,-40,40,1,'°'):''}<button class="quiet full" data-action="import-font">＋ 내 글꼴 추가 (TTF / OTF)</button><p class="small">굵기 파일이 없는 글꼴은 합성 굵기가 적용됩니다.</p>`);
    }
    if(o.type==='image'||o.type==='shape') {
      html+=section('자르기와 모양',select('crop',o.crop||'rectangle',cropLabels,'자르기 모양')+`<button class="secondary full" style="margin-top:10px" data-action="crop-mode">${mode==='crop'?'모양 편집 마치기':'꼭짓점 직접 편집'}</button><div class="prop-row" style="margin-top:8px"><button class="quiet full" data-action="add-point">＋ 편집점</button><button class="quiet full" data-action="remove-point">− 마지막 점</button></div>`);
      if(hasImage(o)) html+=(o.type==='shape'&&mode==='image-pan'?'':imageProperties(o))+section('투명 그라데이션',range('투명 강도','fade',Math.round((o.fade||0)*100),0,100,1,'%')+range('방향','fadeAngle',o.fadeAngle||0,0,360,1,'°')+range('시작 위치','fadeStart',Math.round((o.fadeStart||0)*100),0,95,1,'%')+`<p class="small">0° 오른쪽 · 90° 아래 · 180° 왼쪽 · 270° 위</p>`);
      html+=o.type==='shape'?section('컷 배경',color('채우기','fill',o.fill)+`<label class="check-row"><input type="checkbox" data-prop="transparent" ${o.transparent?'checked':''}>배경 투명하게</label>`):section('외곽선',color('선 색상','stroke',o.stroke)+range('선 굵기','strokeWidth',o.strokeWidth||0,0,60));
    }
    if(o.type==='pen'||o.type==='effect') html+=section('선 스타일',color('선 색상','stroke',o.stroke)+range('선 굵기','strokeWidth',o.strokeWidth,1,100)+(o.type==='effect'?range('선 개수','density',o.density||60,5,150):''));
    $('#properties').innerHTML=`${['bubble','sfx','text','image'].includes(o.type)?`<button class="save-material-button full" data-action="save-material">＋ ${o.type==='bubble'?'내 말풍선으로':o.type==='sfx'||o.type==='text'?'내 효과음으로':'내 소재로'} 저장</button>`:''}${o.locked?'<p class="empty-info">이 레이어는 잠겨 있습니다. 레이어 목록에서 잠금을 해제하세요.</p>':''}<fieldset ${o.locked?'disabled':''} style="border:0;padding:0;margin:0;min-width:0">${html}</fieldset>`;
  }
  function renderLibrary() {
    const names={bubbles:['말풍선','이야기에 목소리를 더해 보세요.'],sfx:['효과음','장면에 생동감을 더하는 한 글자.'],text:['텍스트','당신의 이야기를, 당신의 글씨로.'],images:['이미지','장면을 불러오고 자유롭게 다듬으세요.'],panels:['컷 · 효과','장면의 리듬과 속도를 만들어 보세요.']};
    $('#library-title').textContent=names[tab][0];$('#library-description').textContent=names[tab][1];$$('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
    let html='';
    if(tab==='bubbles')html=bubbleLibraryHTML();
    if(tab==='sfx') html=`<div class="preset-grid">${sfxPresets.map(([text,font,col,skew],i)=>`<button class="sfx-preset" data-add-sfx="${i}" style="font-family:'${font}';color:${col};font-size:${text.length>3?24:30}px">${text}</button>`).join('')}</div><div class="tip-card"><strong>나만의 효과음</strong>추가 후 글자, 글꼴, 색, 외곽선과 기울기를 모두 바꿀 수 있어요.</div>`;
    if(tab==='text')html=`<button class="text-preset" data-add-text="title" style="font-size:25px;font-weight:800">제목을 더하세요</button><button class="text-preset" data-add-text="body" style="font-size:14px">이야기를 써 내려가세요.</button><button class="text-preset" data-add-text="hand" style="font-family:'Nanum Pen Script';font-size:27px">마음을 담은 한 줄</button><div class="subheading">오프라인 한글 글꼴 ${new Set(fonts.map(f=>f.name)).size}종</div>${Object.entries(fontNames).map(([n,l])=>`<button class="text-preset" data-font-text="${n}" style="font-family:'${n}';font-size:18px">${l}</button>`).join('')}<button class="secondary full" style="margin-top:16px" data-action="import-font">＋ 내 글꼴 추가</button>`;
    if(tab==='images')html=`<button class="primary full" data-action="import-image">＋ 이미지 불러오기</button><p class="small" style="margin-top:10px">PNG · JPG · WEBP · GIF · BMP<br>여러 파일을 끌어 놓을 수도 있어요.</p><div class="tip-card"><strong>컷 안에 이미지 넣기</strong>컷 위에 이미지 파일을 끌어 놓거나, 컷을 선택하고 ‘컷에 이미지 넣기’를 누르세요.</div><div class="tip-card"><strong>이미지와 컷을 따로 조절</strong>컷을 더블클릭하면 안쪽 이미지의 위치와 크기를 바꿀 수 있어요. ‘컷 편집으로’로 돌아오면 컷 자체를 움직입니다.</div><button class="secondary full" data-tab="panels">컷 모양 고르기 ↗</button>`;
    if(tab==='panels')html=`<div class="preset-grid">${Object.entries(cropLabels).filter(([s])=>s!=='custom').map(([s,l])=>`<button class="preset" data-add-panel="${s}"><svg viewBox="0 0 110 75">${s==='ellipse'?'<ellipse cx="55" cy="37" rx="47" ry="29" fill="#f1f5ed" stroke="#53664e" stroke-width="3"/>':`<path d="${polygonPath(crops[s]||crops.rectangle,90,55)}" transform="translate(10 10)" fill="#f1f5ed" stroke="#53664e" stroke-width="3"/>`}</svg><span>${l}</span></button>`).join('')}</div><div class="tip-card"><strong>이미지가 들어가는 컷</strong>컷을 추가한 뒤 이미지 파일을 끌어 놓으세요. 더블클릭으로 안쪽 이미지만 이동·확대할 수 있어요.</div><div class="subheading">장면 효과</div><div class="preset-grid"><button class="preset" data-add-effect="focus"><span style="font-size:38px">✴</span><span>집중선</span></button><button class="preset" data-add-effect="speed"><span style="font-size:38px">≋</span><span>속도선</span></button></div><button class="secondary full" style="margin-top:12px" data-tool="pen">✎ 자유롭게 그리기</button>`;
    if(tab==='bubbles'||tab==='sfx')html=materialControlsHTML(tab)+materialItemsHTML(tab)+`<div class="subheading">${tab==='bubbles'?'말풍선 모음':'효과음'}</div>`+html+`<div class="material-backup"><button data-action="export-materials">내 소재 내보내기</button><button data-action="import-materials">소재 파일 불러오기</button></div>`;
    $('#library-content').innerHTML=html;$('#library-content').scrollTop=0;
  }
  function textAlignButtons(o){
    return `<div class="text-align-label">글자 정렬</div><div class="text-align-buttons" role="group" aria-label="텍스트 정렬">${[['left','왼쪽'],['center','중앙'],['right','오른쪽']].map(([align,label])=>`<button type="button" data-text-align="${align}" class="${(o.align||'center')===align?'active':''}" aria-label="${label} 정렬" aria-pressed="${(o.align||'center')===align}"><svg viewBox="0 0 20 16" aria-hidden="true"><path d="M1 2H19M${align==='left'?1:align==='center'?5:9} 6h10M1 10H19M${align==='left'?1:align==='center'?5:9} 14h10"/></svg><span>${label}</span></button>`).join('')}</div>`;
  }
  function bubbleThumbnail(o){
    const t=o.tail!==false&&o.shape!=='caption'?tailGeometry(o):null,points=t?[t.tip,t.control]:[],pad=Math.max(10,(o.strokeWidth||0)*2);
    const x=Math.min(0,...points.map(p=>p.x))-pad,y=Math.min(0,...points.map(p=>p.y))-pad,w=Math.max(o.w,...points.map(p=>p.x))-x+pad,h=Math.max(o.h,...points.map(p=>p.y))-y+pad;
    return `<svg viewBox="${x} ${y} ${w} ${h}" aria-hidden="true"><path d="${bubblePath(o)}" fill="white" stroke="#53664e" stroke-width="${Math.max(o.w,o.h)/85*1.5}" stroke-linejoin="${BubbleCatalog.get(o.shape)?.join||'round'}" ${o.shape==='whisper'?`stroke-dasharray="${o.w/25} ${o.w/30}"`:''}/>${dottedTail(o)?thoughtTail(o).map(p=>`<ellipse cx="${p.x}" cy="${p.y}" rx="${p.rx}" ry="${p.ry}" fill="white" stroke="#53664e" stroke-width="${Math.max(o.w,o.h)/85*1.5}"/>`).join(''):''}</svg>`;
  }
  function bubbleLibraryHTML(){
    const choices=[['basic','기본 · 8'],['1','모음 1 · 11'],['2','모음 2 · 33']];
    const items=bubbleCollection==='basic'?Object.entries(basicLabels).map(([id,name])=>({id,name})):BubbleCatalog.presets.filter(p=>String(p.collection)===bubbleCollection);
    return `<div class="bubble-collections" role="group" aria-label="말풍선 모음">${choices.map(([id,label])=>`<button data-bubble-collection="${id}" class="${bubbleCollection===id?'active':''}" aria-pressed="${bubbleCollection===id}">${label}</button>`).join('')}</div>${bubbleCollection!=='basic'?`<p class="catalog-note">참고 이미지 ${bubbleCollection}의 말풍선 · 이미지와 같은 번호로 찾으세요.</p>`:''}<div class="preset-grid reference-presets">${items.map(item=>`<button class="preset" data-add-bubble="${item.id}" title="${esc(item.name)}">${item.number?`<span class="preset-number">${String(item.number).padStart(2,'0')}</span>`:''}${bubbleThumbnail(bubble(item.id,{text:'',text2:''}))}<span>${esc(item.name)}</span></button>`).join('')}</div><div class="tip-card"><strong>↳ 꼬리도, 내 마음대로</strong>끝점·붙는 위치·휘어짐을 직접 조절하세요. 이어진 말풍선은 대사를 각각 입력할 수 있어요.</div>`;
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
      if(key==='contentX')o.imageX=value/o.w;else if(key==='contentY')o.imageY=value/o.h;else o[key]=value;
      if(key==='crop') {o.points=clone(crops[value]||o.points||crops.rectangle);if(o.type==='shape')o.shape=value;}
      if(key==='shape'){const p=BubbleCatalog.get(value);if(p){Object.assign(o,{tail:p.defaults.tail,tailStyle:p.defaults.tailStyle,tailAngle:p.defaults.tailAngle,tailX:p.defaults.tailX,tailY:p.defaults.tailY,tailWidth:p.defaults.tailWidth,bendX:0,bendY:0});if(p.regions&&o.text2===undefined)o.text2='두 번째 대사';}else delete o.tailStyle;if(value==='caption')o.tail=false;mode=o.tail!==false?'tail':'normal';}
    }
    const out=input.parentElement.querySelector('output');if(input.type==='range'&&out)out.textContent=input.value+(input.dataset.prop==='opacity'||input.dataset.prop==='fade'||input.dataset.prop==='fadeStart'?'%':'');
    const hex=input.parentElement.querySelector('span');if(input.type==='color'&&hex)hex.textContent=value;
    renderStage();renderLayers();if(final){commit();if(input.tagName==='SELECT'||input.type==='checkbox')renderProperties();renderContext();}
  }
  async function addImageAsset(a) {
    project.assets[a.id]=a;const width=Math.min(page().width*.8,a.width),height=width*a.height/a.width;
    addObject(place(base('image',{name:a.name,assetId:a.id,w:width,h:Math.min(height,16000),crop:'rectangle',points:clone(crops.rectangle),imageZoom:1,imageX:0,imageY:0,fade:0,fadeAngle:90,fadeStart:0,stroke:'#23352f',strokeWidth:0})));
  }
  function frameTarget(o){return {document:project,pageId:page().id,id:o.id};}
  function targetFrame(target){
    if(!target||target.document!==project)return null;
    const p=project.pages.find(p=>p.id===target.pageId),o=p?.objects.find(o=>o.id===target.id);
    return o?.type==='shape'&&!o.locked?o:null;
  }
  function requestFrameImage(o){
    if(o?.type!=='shape'||o.locked)return;
    frameImportTarget=frameTarget(o);$('#frame-image-input').click();
  }
  function fillFrame(target,asset){
    const o=targetFrame(target);if(!o){toast('이미지를 넣을 컷을 다시 선택하세요.');return;}
    project.assets[asset.id]=asset;Object.assign(o,{assetId:asset.id,imageZoom:1,imageX:0,imageY:0,fade:0,fadeAngle:90,fadeStart:0});
    project.activePage=target.pageId;selected=o.id;mode='image-pan';tool='select';preview=false;guides=[];commit();render();
    toast('컷 안에 넣었습니다. 드래그로 위치, 초록 모서리로 이미지 크기를 조절하세요.');
  }
  async function readImageAsset(file){
    if(!/^image\/(png|jpeg|webp|gif|bmp)$/.test(file.type))throw Error('PNG, JPG, WEBP, GIF, BMP 이미지를 선택하세요.');
    if(file.size>50*1024*1024)throw Error('이미지 한 장은 50MB 이하로 선택하세요.');
    const src=await readData(file),im=await loadImage(src);
    if(im.naturalWidth*im.naturalHeight>120000000)throw Error('이미지가 너무 큽니다. 1억 2천만 픽셀 이하로 줄여 주세요.');
    return {id:uid(),name:file.name,src,width:im.naturalWidth,height:im.naturalHeight};
  }
  async function importFrameImage(file,target){
    try{fillFrame(target,await readImageAsset(file));}catch(e){toast('컷 이미지 추가 실패: '+e.message);}
  }
  function chooseFrameAsset(o){
    if(o?.type!=='shape'||o.locked)return;framePickerTarget=frameTarget(o);
    const assets=Object.entries(portableProject().assets).map(([id,a])=>({...a,id}));
    modal('컷에 넣을 이미지 선택',`<p>프로젝트의 이미지를 복사해 이 컷에 넣습니다. 컷의 모양과 테두리는 유지됩니다.</p>${assets.length?`<div class="frame-asset-grid">${assets.map(a=>`<button data-frame-asset="${esc(a.id)}"><img src="${esc(a.src)}" alt=""><span>${esc(a.name||'이미지')}</span></button>`).join('')}</div>`:'<p class="empty-info">아직 프로젝트에 이미지가 없습니다. 새 이미지 파일을 불러오세요.</p>'}`,`<button class="quiet" data-action="close-modal">취소</button><button class="primary" data-action="frame-picker-import">새 이미지 불러오기</button>`);
  }
  function frameAtEvent(e){
    const svg=e.target.closest('.page-canvas');if(!svg||preview)return null;
    const p=project.pages.find(p=>p.id===svg.dataset.page),pos=screenPoint(svg,e.clientX,e.clientY);
    const o=[...p.objects].reverse().find(o=>o.type==='shape'&&o.visible!==false&&!o.locked&&G.containsPoint(o,pos));
    return o?{document:project,pageId:p.id,id:o.id}:null;
  }
  const readData=file=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(file);});
  const loadImage=src=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('이미지를 읽을 수 없습니다.'));im.src=src;});
  async function importImages(files) {
    for(const file of files)try {
      const doc=project,a=await readImageAsset(file);if(project!==doc)return;await addImageAsset(a);
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
  function canvasSizeDialog() {
    modal('캔버스 크기 변경',`<div class="canvas-modal-summary"><strong>${esc(page().name)}</strong><span>현재 ${page().width} × ${page().height} px · 이 페이지의 크기를 변경합니다.</span></div><label for="page-preset">크기 프리셋</label><select id="page-preset"><option value="${page().width},${page().height}">현재 크기</option><option value="800,1280">웹툰 · 800 × 1280</option><option value="900,1400">웹툰 · 900 × 1400</option><option value="1600,2400">고해상도 · 1600 × 2400</option><option value="2480,3508">A4 · 2480 × 3508</option><option value="1080,1080">정사각형 · 1080 × 1080</option><option value="8000,8000">최대 크기 · 8000 × 8000</option></select><div class="prop-row"><div class="prop-field"><label for="new-width">가로 (px)</label><input id="new-width" type="number" min="1" max="8000" value="${page().width}"></div><div class="prop-field"><label for="new-height">세로 (px)</label><input id="new-height" type="number" min="1" max="8000" value="${page().height}"></div></div><p>각 변 1–8000 px · 그림과 말풍선의 위치·크기는 유지됩니다.<br>캔버스 밖으로 나간 부분은 내보내기에 포함되지 않습니다.</p>`,`<button class="quiet" data-action="close-modal">취소</button><button class="primary" data-action="apply-canvas-size">크기 적용</button>`);
  }
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
      const doc=validateProject(JSON.parse(await file.text()));resolveFontConflicts(doc,doc.pages.flatMap(p=>p.objects));await addFontFaces(doc.fonts||[]);
      clearImageURLs();project=doc;project.fonts||=[];selected=null;mode='normal';history=[];historyIndex=-1;commit();renderLibrary();render();fit();toast('프로젝트를 불러왔습니다.');
    }catch(e){toast('열기 실패: '+e.message);}
  }
  function exportDialog(){modal('이야기를 세상 밖으로',`<p>완성된 장면을 원본 해상도로 저장하세요.<br>편집을 계속하려면 프로젝트 파일도 따로 보관해 주세요.</p><label for="export-scope">내보낼 범위</label><select id="export-scope"><option value="current">현재 페이지</option><option value="all">모든 페이지 · ZIP</option><option value="strip">세로로 이어진 한 장 · PNG</option></select><label for="export-format">파일 형식</label><select id="export-format"><option value="png">PNG · 무손실 이미지</option><option value="jpeg">JPG · 작은 파일</option><option value="svg">SVG · 벡터 + 원본 이미지</option></select><label for="export-scale">해상도</label><select id="export-scale"><option value="1">100% · 원본 크기</option><option value="0.5">50% · 미리 보기용</option><option value="0.25">25% · 작은 이미지</option></select><label class="check-row"><input type="checkbox" id="export-transparent" style="width:auto;margin:0">페이지 배경 투명하게 (PNG / SVG)</label><p class="notice small">세로 연결은 최대 높이 32,000px, 전체 1억 2천만 픽셀까지 가능합니다. 더 긴 작품은 모든 페이지 ZIP으로 저장하세요. SVG의 글꼴 표시는 여는 프로그램에 따라 달라질 수 있습니다.</p><div class="progress"><i id="export-progress"></i></div><p id="export-message" role="status"></p>`,`<button class="quiet" data-action="close-modal">취소</button><button class="primary" id="export-go" data-action="do-export">파일로 내보내기 ↗</button>`);}
  function paintImageCanvas(ctx,o,a,im,scale){
    const path=new Path2D();
    if(o.crop==='ellipse')path.ellipse(o.w/2,o.h/2,o.w/2,o.h/2,0,0,Math.PI*2);else path.addPath(new Path2D(polygonPath(o.points||crops.rectangle,o.w,o.h)));
    ctx.save();ctx.clip(path);if(o.type==='shape'&&!o.transparent){ctx.fillStyle=o.fill||'#ffffff';ctx.fillRect(0,0,o.w,o.h);}
    const {x:ix,y:iy,w:iw,h:ih}=imagePlacement(o,a);
    if(o.fade) {
      const layer=document.createElement('canvas'),factor=Math.min(scale,8000/o.w,8000/o.h);layer.width=Math.max(1,Math.ceil(o.w*factor));layer.height=Math.max(1,Math.ceil(o.h*factor));const lc=layer.getContext('2d');lc.scale(factor,factor);lc.drawImage(im,ix,iy,iw,ih);lc.globalCompositeOperation='destination-in';
      const rad=(o.fadeAngle||0)*Math.PI/180,dx=Math.cos(rad)*o.w/2,dy=Math.sin(rad)*o.h/2,g=lc.createLinearGradient(o.w/2-dx,o.h/2-dy,o.w/2+dx,o.h/2+dy);
      g.addColorStop(o.fadeStart||0,'rgba(0,0,0,1)');g.addColorStop(1,`rgba(0,0,0,${1-o.fade})`);lc.fillStyle=g;lc.fillRect(0,0,o.w,o.h);ctx.drawImage(layer,0,0,o.w,o.h);layer.width=1;layer.height=1;
    } else ctx.drawImage(im,ix,iy,iw,ih);
    ctx.restore();if(o.strokeWidth){ctx.lineJoin='round';ctx.strokeStyle=o.stroke;ctx.lineWidth=o.strokeWidth;ctx.stroke(path);}
  }
  function paintTextCanvas(ctx,o){
        ctx.save();ctx.transform(1,0,Math.tan((o.skew||0)*Math.PI/180),1,0,0);ctx.font=fontStyle(o);ctx.textBaseline='alphabetic';ctx.letterSpacing=(o.letterSpacing||0)+'px';
        const size=o.fontSize||30,pad=o.padding||0,align=o.align||'center',lh=size*(o.lineHeight||1.4);
        const lines=wrapText(o.text,Math.max(5,o.w-pad*2),size,s=>ctx.measureText(s).width),total=(lines.length-1)*lh+size;
        const x=align==='left'?pad:align==='right'?o.w-pad:o.w/2,y=(o.h-total)/2+size*.82;
        ctx.textAlign=align;ctx.fillStyle=o.color;ctx.lineJoin='round';ctx.strokeStyle=o.textStroke||'#ffffff';ctx.lineWidth=o.textStrokeWidth||0;
        lines.forEach((line,i)=>{if(o.textStrokeWidth)ctx.strokeText(line,x,y+i*lh);ctx.fillText(line,x,y+i*lh);});ctx.restore();
  }
  async function rasterize(p,scale=1,transparent=false) {
    await document.fonts.ready;
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(p.width*scale));canvas.height=Math.max(1,Math.round(p.height*scale));
    const ctx=canvas.getContext('2d');ctx.scale(scale,scale);if(!transparent){ctx.fillStyle=p.background;ctx.fillRect(0,0,p.width,p.height);}
    const paint=(path,o)=>{ctx.lineJoin=o.shape==='caption'?'miter':BubbleCatalog.get(o.shape)?.join||'round';ctx.miterLimit=4;if(!o.transparent){ctx.fillStyle=o.fill||'#ffffff';ctx.fill(path);}if(o.strokeWidth){ctx.strokeStyle=o.stroke;ctx.lineWidth=o.strokeWidth;ctx.stroke(path);}};
    for(const o of p.objects) {
      if(o.visible===false)continue;
      ctx.save();ctx.globalAlpha=o.opacity??1;ctx.translate(o.x+o.w/2,o.y+o.h/2);ctx.rotate((o.rotation||0)*Math.PI/180);ctx.translate(-o.w/2,-o.h/2);
      if(o.type==='bubble') {
        if(o.shape==='whisper')ctx.setLineDash([7,6]);paint(new Path2D(bubblePath(o)),o);ctx.setLineDash([]);
        if(dottedTail(o))for(const p of thoughtTail(o)){const path=new Path2D();path.ellipse(p.x,p.y,p.rx,p.ry,0,0,Math.PI*2);paint(path,o);}
      }
      if(['bubble','text','sfx'].includes(o.type)) {
        for(const area of textAreas(o)){ctx.save();ctx.translate(area.x,area.y);paintTextCanvas(ctx,{...o,w:area.w,h:area.h,text:o[area.key]||''});ctx.restore();}
      } else if(hasImage(o)) {
        const a=project.assets[o.assetId],im=await loadImage(a.src);
        if(o.type==='shape'&&(o.opacity??1)<1){
          const margin=(o.strokeWidth||0)/2+1,w=o.w+margin*2,h=o.h+margin*2,factor=Math.min(scale,8000/w,8000/h);
          const layer=document.createElement('canvas');layer.width=Math.max(1,Math.ceil(w*factor));layer.height=Math.max(1,Math.ceil(h*factor));
          const lc=layer.getContext('2d');lc.scale(layer.width/w,layer.height/h);lc.translate(margin,margin);paintImageCanvas(lc,o,a,im,factor);ctx.drawImage(layer,-margin,-margin,w,h);layer.width=1;layer.height=1;
        }else paintImageCanvas(ctx,o,a,im,scale);
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
    if(name==='frame-picker-import'){if(targetFrame(framePickerTarget)){frameImportTarget=framePickerTarget;$('#modal').close();$('#frame-image-input').click();}return;}
    if(name==='frame-import')return requestFrameImage(o);
    if(name==='frame-choose-asset')return chooseFrameAsset(o);
    if(name==='canvas-size')return canvasSizeDialog();
    if(name==='apply-canvas-size') {
      const w=+$('#new-width').value,h=+$('#new-height').value;
      if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w>8000||h>8000){toast('가로와 세로를 1–8000 사이의 정수로 입력하세요.');return;}
      page().width=w;page().height=h;$('#modal').close();commit();render();fit();return;
    }
    if(name==='new-material-bubbles'||name==='new-material-sfx')return materialDialog(name==='new-material-bubbles'?'bubbles':'sfx');
    if(name==='save-material')return saveSelectedMaterial();
    if(name==='create-material')return createMaterial();
    if(name==='import-material-image'){materialImageCategory=tab==='sfx'?'sfx':'bubbles';$('#material-image-input').click();return;}
    if(name==='import-materials'){$('#material-library-input').click();return;}
    if(name==='export-materials')return exportMaterialLibrary();
    if(name==='confirm-delete-material') {
      materialLibrary=MaterialLibrary.remove(materialLibrary,materialToDelete);materialToDelete=null;$('#modal').close();renderLibrary();
      if(await persistMaterials())toast('내 소재에서 삭제했습니다. 캔버스에 놓은 소재는 유지됩니다.');return;
    }
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
    if(name==='grid'){showGrid=!showGrid;renderStage();renderContext();return;}if(name==='snap'){snap=!snap;guides=[];renderStage();renderContext();return;}
    if(name==='preview'){preview=!preview;renderStage();renderContext();return;}
    if(name==='import-image'){if(o?.type==='shape'&&!o.locked)return requestFrameImage(o);$('#image-input').click();return;}if(name==='import-font'){$('#font-input').click();return;}
    if(name==='help')return modal('작업실 사용 가이드',`<p>모든 편집은 이 기기에서 처리됩니다. 먼저 왼쪽 소재를 추가하고, 오른쪽 속성에서 세밀하게 다듬어 보세요.</p>${[['선택 / 펜 / 화면 이동','V / B / H'],['드래그로 화면 이동','Space + 드래그'],['실행 취소 / 다시 실행','Ctrl+Z / Ctrl+Shift+Z'],['프로젝트 저장 / 열기','Ctrl+S / Ctrl+O'],['이미지 내보내기','Ctrl+E'],['복제 / 복사 / 붙여넣기','Ctrl+D / Ctrl+C / Ctrl+V'],['레이어 이동 / 빠른 이동','방향키 / Shift+방향키'],['비율 유지하여 크기 조절','Shift + 모서리 드래그'],['삭제 / 선택 해제','Delete / Esc'],['화면 확대·축소','Ctrl + 마우스 휠']].map(([a,b])=>`<div class="kbd-row"><span>${a}</span><span class="kbd">${b}</span></div>`).join('')}<p style="margin-top:18px"><b>캔버스 크기:</b> 상단 ‘캔버스 크기’에서 가로·세로를 변경합니다. 최대 8000 × 8000 px입니다.<br><b>텍스트만:</b> 상단 ‘텍스트만 추가’를 누르면 말풍선 없는 글자를 넣습니다. 오른쪽 ‘왼쪽 / 중앙 / 오른쪽’ 버튼으로 정렬합니다.<br><b>말풍선 모음:</b> 기본 8종과 참고 이미지의 모음 1(11종)·모음 2(33종)를 제공합니다. 이어진 말풍선은 첫 번째·두 번째 대사를 따로 입력합니다.<br><b>내 소재:</b> 말풍선·효과음 탭에서 직접 만들거나 선택한 소재를 저장하세요. ‘내 그림 불러오기’로 투명 PNG 등도 추가할 수 있습니다. 그림 소재는 이미지로 편집됩니다. 내 소재는 프로젝트와 별도로 이 기기에 보관됩니다. 다른 PC에서는 ‘내 소재 내보내기’와 ‘소재 파일 불러오기’를 사용하세요.<br><b>말풍선 꼬리:</b> 말풍선 선택 → 꼬리 편집 → 끝점·붙는 위치·휘어짐 점 드래그.<br><b>컷에 이미지:</b> 컷 위에 이미지 파일을 놓거나 컷 선택 후 ‘컷에 이미지 넣기’를 누르세요. 더블클릭으로 안쪽 이미지만 이동·확대하고 Esc로 컷 편집에 돌아갑니다. 테두리 두께는 오른쪽 ‘컷 테두리’에서 바꿉니다.<br><b>스냅 안내선:</b> 캔버스 중앙·가장자리와 다른 소재의 중심·가장자리에 자동 맞춤합니다. 상단 버튼으로 켜고 끄며 Alt를 누르면 잠시 해제됩니다. 회전 핸들은 15° 간격의 각도와 다른 소재에 평행·직각인 각도로 맞춰집니다. Shift+회전은 15° 단위로 고정합니다.<br><b>이미지:</b> 모양 편집으로 꼭짓점을 움직이고, 테두리를 더블클릭해 점을 추가하세요.<br><b>저장:</b> 자동 저장은 이 기기의 최근 작업 한 개를 보관합니다. 파일 보관·다른 PC 이동에는 ‘프로젝트 저장’을 사용하세요.<br><b>글꼴:</b> 11종의 기본 한글 글꼴과 TTF/OTF/WOFF 추가를 지원합니다. 글꼴 재배포는 해당 라이선스를 따라 주세요.<br><b>GIF:</b> 정지 이미지로 편집·내보내기됩니다.</p>`,`<button class="primary" data-action="close-modal">작업 시작</button>`);
    if(name==='duplicate')return duplicateObject();
    if(['bring-front','send-back','forward','backward'].includes(name))return reorder(name);
    if(!o||o.locked)return;
    if(name==='frame-remove-image'&&o.type==='shape'){delete o.assetId;delete o.imageZoom;delete o.imageX;delete o.imageY;delete o.fade;mode='normal';commit();render();return;}
    if(name==='delete'){page().objects=page().objects.filter(x=>x.id!==o.id);selected=null;mode='normal';commit();render();return;}
    if(name==='tail-mode'){if(o.shape==='caption'){toast('내레이션에는 꼬리가 없습니다. 다른 말풍선 모양을 선택하세요.');return;}o.tail=true;mode=mode==='tail'?'normal':'tail';commit();render();return;}
    if(name==='crop-mode'){if(o.crop==='ellipse'){o.crop='custom';o.points=Array.from({length:12},(_,i)=>[.5+Math.cos(i/12*Math.PI*2)*.5,.5+Math.sin(i/12*Math.PI*2)*.5]);commit();}mode=mode==='crop'?'normal':'crop';render();return;}
    if(name==='image-pan'){if(!hasImage(o))return;mode=mode==='image-pan'?'normal':'image-pan';guides=[];render();return;}
    if(name==='reset-image'){o.imageZoom=1;o.imageX=0;o.imageY=0;commit();render();return;}
    if(name==='add-point')return addPoint();
    if(name==='remove-point'){if(o.points?.length>3){o.points.pop();o.crop='custom';commit();render();}else toast('최소 3개의 꼭짓점이 필요합니다.');return;}
    if(name==='center'){o.x=(page().width-o.w)/2;o.y=(page().height-o.h)/2;commit();render();}
  }
  document.addEventListener('click',async e=>{
    const b=e.target.closest('button');if(b?.disabled)return;
    if(b?.dataset.bubbleCollection){if(['basic','1','2'].includes(b.dataset.bubbleCollection)){bubbleCollection=b.dataset.bubbleCollection;renderLibrary();}return;}
    if(b?.dataset.textAlign){const o=object();if(o&&!o.locked&&['bubble','text','sfx'].includes(o.type)&&['left','center','right'].includes(b.dataset.textAlign)){o.align=b.dataset.textAlign;commit();renderStage();renderProperties();}return;}
    if(b?.dataset.action){await action(b.dataset.action);return;}
    if(b?.dataset.tab){tab=b.dataset.tab;renderLibrary();return;}
    if(b?.dataset.tool){tool=b.dataset.tool;mode='normal';preview=false;renderContext();renderProperties();return;}
    if(b?.dataset.view){view=b.dataset.view;renderStage();renderContext();return;}
    if(b?.dataset.pageSelect){choosePage(b.dataset.pageSelect);return;}
    if(b?.dataset.addBubble){addObject(place(bubble(b.dataset.addBubble)));return;}
    if(b?.dataset.addMaterial){addMaterial(b.dataset.addMaterial);return;}
    if(b?.dataset.frameAsset){const a=project.assets[b.dataset.frameAsset];if(a){$('#modal').close();fillFrame(framePickerTarget,{...a,id:b.dataset.frameAsset});}return;}
    if(b?.dataset.deleteMaterial){const item=materialLibrary.items.find(i=>i.id===b.dataset.deleteMaterial);if(item){materialToDelete=item.id;confirmAction('내 소재 삭제',`‘${item.name}’을 내 소재에서 삭제합니다. 캔버스에 놓은 소재는 유지됩니다.`,'confirm-delete-material');}return;}
    if(b?.dataset.addSfx!==undefined){const [text,font,color,skew]=sfxPresets[+b.dataset.addSfx];addObject(place(textObject(text,{type:'sfx',name:text,font,color,fontSize:100,weight:700,w:Math.min(550,page().width*.7),h:210,skew,textStroke:'#ffffff',textStrokeWidth:3,align:'center'})));return;}
    if(b?.dataset.addText){const kind=b.dataset.addText;addObject(place(textObject(kind==='title'?'새로운 이야기':kind==='hand'?'마음을 담은 한 줄':'이곳에 이야기를 써 내려가세요.',{fontSize:kind==='title'?56:kind==='hand'?52:28,font:kind==='hand'?'Nanum Pen Script':'Nanum Gothic',weight:kind==='title'?700:400})));if(b.dataset.quickText){$('[data-prop="text"]')?.focus();$('[data-prop="text"]')?.select();}return;}
    if(b?.dataset.fontText){addObject(place(textObject(fontNames[b.dataset.fontText]||'새로운 이야기',{font:b.dataset.fontText})));return;}
    if(b?.dataset.addPanel){const crop=b.dataset.addPanel;addObject(place(base('shape',{crop,shape:crop,points:clone(crops[crop]||crops.rectangle),w:page().width*.7,h:page().width*.5,fill:'#ffffff',stroke:'#23352f',strokeWidth:5,transparent:false})));return;}
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
  $('#frame-image-input').addEventListener('change',async e=>{const target=frameImportTarget;frameImportTarget=null;if(e.target.files[0])await importFrameImage(e.target.files[0],target);e.target.value='';});
  $('#font-input').addEventListener('change',async e=>{await importFonts(e.target.files);e.target.value='';});
  $('#material-image-input').addEventListener('change',async e=>{await importMaterialImages(e.target.files);e.target.value='';});
  $('#material-library-input').addEventListener('change',async e=>{if(e.target.files[0])await importMaterialLibrary(e.target.files[0]);e.target.value='';});
  $('#project-input').addEventListener('change',async e=>{if(e.target.files[0])await openProject(e.target.files[0]);e.target.value='';});
  const viewport=$('#stage-viewport');
  viewport.addEventListener('pointerdown',e=>{
    if(e.button!==0&&e.button!==1)return;
    guides=[];rotationGuide=null;
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
    if(o&&!o.locked) {drag={kind:handle||((mode==='image-pan'&&hasImage(o))?'image-pan':'move'),id:o.id,page:pid,start:{x:pos.x,y:pos.y},before:clone(o),moved:false};if(handle==='rotate'){drag.lastAngle=Math.atan2(pos.y-o.y-o.h/2,pos.x-o.x-o.w/2)*180/Math.PI;drag.rawRotation=o.rotation||0;rotationGuide={match:null};}e.preventDefault();}
    renderStage();renderPages();renderProperties();renderLayers();renderContext();
  });
  document.addEventListener('pointermove',e=>{
    if(!drag)return;
    if(drag.kind==='pan'){viewport.scrollLeft=drag.scrollX-(e.clientX-drag.sx);viewport.scrollTop=drag.scrollY-(e.clientY-drag.sy);return;}
    const svg=$(`.page-canvas[data-page="${drag.page}"]`);if(!svg)return;
    const p=screenPoint(svg,e.clientX,e.clientY),o=object();if(!o)return;drag.moved=true;
    const b=drag.before,q=b?localPoint(b,p):p;
    guides=[];
    if(drag.kind==='pen'){const last=o.points.at(-1);if(Math.hypot(p.x-last[0]*o.w,p.y-last[1]*o.h)>1.5/zoom&&o.points.length<20000)o.points.push([p.x/o.w,p.y/o.h]);}
    else if(drag.kind==='move'){o.x=b.x+p.x-drag.start.x;o.y=b.y+p.y-drag.start.y;if(snap&&!e.altKey){const aligned=Alignment.snapMove(o,page().objects,page(),6/zoom);o.x=aligned.x;o.y=aligned.y;guides=aligned.guides;}}
    else if(drag.kind==='image-pan'){const start=localPoint(b,drag.start);o.imageX=clamp((b.imageX||0)+(q.x-start.x)/b.w,-100,100);o.imageY=clamp((b.imageY||0)+(q.y-start.y)/b.h,-100,100);}
    else if(drag.kind.startsWith('content-'))Object.assign(o,resizeImage(b,project.assets[b.assetId],drag.kind,q));
    else if(drag.kind==='tail-tip'){o.tailX=q.x/o.w;o.tailY=q.y/o.h;}
    else if(drag.kind==='tail-base'){o.tailAngle=(Math.atan2((q.y-o.h/2)/(o.h/2),(q.x-o.w/2)/(o.w/2))*180/Math.PI+360)%360;}
    else if(drag.kind==='tail-curve'){const t=tailGeometry(o);o.bendX=(q.x-(t.base.x+t.tip.x)/2)/o.w;o.bendY=(q.y-(t.base.y+t.tip.y)/2)/o.h;}
    else if(drag.kind.startsWith('point-')){o.points[+drag.kind.split('-')[1]]=[clamp(q.x/o.w,0,1),clamp(q.y/o.h,0,1)];o.crop='custom';}
    else if(drag.kind==='rotate'){
      const angle=Math.atan2(p.y-b.y-b.h/2,p.x-b.x-b.w/2)*180/Math.PI;drag.rawRotation+=Alignment.angleDelta(drag.lastAngle,angle);drag.lastAngle=angle;
      const result=Alignment.snapRotation(drag.rawRotation,o,page().objects,{enabled:snap&&!e.altKey,forceStep:e.shiftKey});o.rotation=result.rotation;rotationGuide={match:result.guide};
    }
    else {
      const west=drag.kind.includes('w'),north=drag.kind.includes('n');let w=clamp(west?b.w-q.x:q.x,10,16000),h=clamp(north?b.h-q.y:q.y,10,16000);
      if(e.shiftKey){const factor=Math.max(w/b.w,h/b.h);w=clamp(b.w*factor,10,16000);h=clamp(b.h*factor,10,16000);}
      const ax=west?1:0,ay=north?1:0,a=b.rotation*Math.PI/180,dx=(ax-.5)*b.w,dy=(ay-.5)*b.h,anchorX=b.x+b.w/2+dx*Math.cos(a)-dy*Math.sin(a),anchorY=b.y+b.h/2+dx*Math.sin(a)+dy*Math.cos(a),ndx=(.5-ax)*w,ndy=(.5-ay)*h;
      o.w=w;o.h=h;o.x=anchorX+ndx*Math.cos(a)-ndy*Math.sin(a)-w/2;o.y=anchorY+ndx*Math.sin(a)+ndy*Math.cos(a)-h/2;
      if(snap&&!e.altKey){const aligned=Alignment.snapResize(b,o,drag.kind,page().objects,page(),6/zoom,e.shiftKey);Object.assign(o,{x:aligned.x,y:aligned.y,w:aligned.w,h:aligned.h});guides=aligned.guides;}
    }
    renderStage();
  });
  function finishDrag(cancel=false){if(!drag)return;
    guides=[];rotationGuide=null;
    if(drag.kind!=='pan') {
      const o=object();if(cancel&&o&&drag.before)Object.assign(o,drag.before);
      else if(o&&drag.kind==='pen'){if(o.points.length===1)o.points.push([o.points[0][0]+.001,o.points[0][1]+.001]);const pts=o.points.map(p=>[p[0]*o.w,p[1]*o.h]),xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]),pad=o.strokeWidth/2;const x=Math.min(...xs)-pad,y=Math.min(...ys)-pad,w=Math.max(2,Math.max(...xs)-x+pad),h=Math.max(2,Math.max(...ys)-y+pad);Object.assign(o,{x,y,w,h,points:pts.map(p=>[(p[0]-x)/w,(p[1]-y)/h])});}
      if(!cancel){if(o&&drag.kind==='rotate'&&drag.moved)o.rotation=num(Alignment.angleDelta(0,o.rotation));commit();}renderProperties();renderLayers();renderStage();
    }drag=null;
  }
  document.addEventListener('pointerup',()=>finishDrag());document.addEventListener('pointercancel',()=>finishDrag(true));
  viewport.addEventListener('dblclick',e=>{const o=object();if(!o||o.locked||preview)return;const svg=e.target.closest('.page-canvas');if(mode==='crop'&&svg){const p=localPoint(o,screenPoint(svg,e.clientX,e.clientY));addPoint([p.x/o.w,p.y/o.h]);}else if(hasImage(o)){mode=mode==='image-pan'?'normal':'image-pan';render();}else if(o.type==='shape')requestFrameImage(o);else if(['text','sfx','bubble'].includes(o.type)){$('[data-prop="text"]')?.focus();$('[data-prop="text"]')?.select();}});
  viewport.addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey){e.preventDefault();zoom=clamp(zoom*Math.exp(-e.deltaY*.002),.025,3);renderStage();renderPages();}},{passive:false});
  viewport.addEventListener('dragover',e=>{e.preventDefault();viewport.classList.add('drag-over');const target=frameAtEvent(e);if(dropFrameId!==(target?.id||null)){dropFrameId=target?.id||null;renderStage();}});
  viewport.addEventListener('dragleave',e=>{if(!viewport.contains(e.relatedTarget)){viewport.classList.remove('drag-over');dropFrameId=null;renderStage();}});
  viewport.addEventListener('drop',async e=>{e.preventDefault();const target=frameAtEvent(e),files=Array.from(e.dataTransfer.files);viewport.classList.remove('drag-over');dropFrameId=null;renderStage();if(target&&files.length){await importFrameImage(files[0],target);if(files.length>1)toast('첫 번째 이미지를 컷에 넣었습니다. 다른 이미지는 각각의 컷에 넣어 주세요.');}else await importImages(files);});
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
    if(key==='escape'){const editingImage=mode==='image-pan';finishDrag(true);if(!editingImage)selected=null;mode='normal';preview=false;guides=[];render();return;}
    if(key==='v'||key==='h'||key==='b'){tool={v:'select',h:'hand',b:'pen'}[key];mode='normal';renderContext();renderProperties();return;}
    if(key==='t'&&object()?.type==='bubble'){action('tail-mode');return;}
    if(key==='c'&&object()?.type==='image'){action('crop-mode');return;}
    const o=object();if(o&&!o.locked&&['arrowleft','arrowright','arrowup','arrowdown'].includes(key)){e.preventDefault();const d=e.shiftKey?10:1,dx=key==='arrowleft'?-d:key==='arrowright'?d:0,dy=key==='arrowup'?-d:key==='arrowdown'?d:0;if(mode==='image-pan'&&hasImage(o)){o.imageX=clamp((o.imageX||0)+dx/o.w,-100,100);o.imageY=clamp((o.imageY||0)+dy/o.h,-100,100);}else{o.x+=dx;o.y+=dy;}commit();renderStage();renderProperties();}
  });
  document.addEventListener('keyup',e=>{if(e.code==='Space')space=false;});window.addEventListener('blur',()=>{space=false;finishDrag();});
  window.addEventListener('beforeunload',e=>{if(dirty||materialDirty){if(dirty)saveLocal();if(materialDirty)persistMaterials();e.preventDefault();e.returnValue='';}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){if(dirty)saveLocal();if(materialDirty)persistMaterials();}});
  async function init() {
    project=freshProject();
    const readStored=async key=>{const db=await getDB();return new Promise((resolve,reject)=>{const r=db.transaction('documents').objectStore('documents').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});};
    try{const saved=await readStored('autosave');if(saved)project=validateProject(saved);}catch(e){console.warn('자동 저장 복원:',e.message);}
    project.fonts||=[];resolveFontConflicts(project,project.pages.flatMap(p=>p.objects));await addFontFaces(project.fonts);
    try{const saved=await readStored('materials');if(saved){materialLibrary=MaterialLibrary.validate(saved);resolveFontConflicts(materialLibrary,materialLibrary.items.map(i=>i.template));await addFontFaces(materialLibrary.fonts);}}catch(e){materialLibrary=MaterialLibrary.empty();toast('내 소재를 복원하지 못했습니다. 내보낸 소재 파일을 불러와 주세요.');}
    await registerFonts(fonts.filter(f=>bundledFontNames.has(f.name)));await document.fonts.ready;
    booting=false;commit();renderLibrary();render();fit();
    document.body.dataset.ready='true';
  }
  // Read-only state snapshots and rendering hooks for integration tests and tooling.
  window.PanelStudio={getProject:()=>clone(portableProject()),getSelection:()=>selected,getMaterials:()=>clone(materialLibrary),materialsSaved:()=>!materialDirty,renderPage:(index=0)=>rasterize(project.pages[index]),validateProject};
  init().catch(e=>{console.error(e);toast('작업실을 시작하지 못했습니다: '+e.message);});
})();
