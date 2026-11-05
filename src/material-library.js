(function(root){
  'use strict';
  const geometry=typeof module!=='undefined'?require('./geometry.js'):root.G;
  const copy=value=>JSON.parse(JSON.stringify(value));
  const uid=()=> 'm'+globalThis.crypto.randomUUID().replaceAll('-','');
  const empty=()=>({format:'panel-studio-library',version:1,items:[],assets:{},fonts:[]});
  function validate(library){
    if(!library||library.format!=='panel-studio-library'||library.version!==1||!Array.isArray(library.items)||library.items.length>200||!Array.isArray(library.fonts))throw Error('올바른 내 소재 파일이 아닙니다. 소재는 최대 200개까지 저장할 수 있습니다.');
    const ids=new Set();
    for(const item of library.items){
      if(!item||typeof item.id!=='string'||!/^[\w-]{1,80}$/.test(item.id)||ids.has(item.id)||typeof item.name!=='string'||!item.name.trim()||item.name.length>80||!['bubbles','sfx'].includes(item.category))throw Error('소재 이름 또는 분류가 올바르지 않습니다.');
      ids.add(item.id);
      const allowed=item.category==='bubbles'?['bubble','image']:['sfx','text','image'];
      if(!item.template||!allowed.includes(item.template.type))throw Error('지원하지 않는 소재 형식입니다.');
    }
    geometry.validateProject({format:'panel-studio',version:1,assets:library.assets,fonts:library.fonts,pages:[{id:'material-library-page',width:8000,height:8000,background:'#ffffff',objects:library.items.map(item=>item.template)}]});
    return library;
  }
  function add(library,{category,name,template,asset,fontFaces=[],id=uid()}){
    const next=copy(library),o=copy(template);
    if(next.items.length>=200)throw Error('내 소재는 최대 200개입니다. 사용하지 않는 소재를 삭제한 뒤 추가하세요.');
    Object.assign(o,{id:uid(),x:0,y:0,visible:true,locked:false});
    if(category==='sfx'&&o.type==='text')o.type='sfx';
    if(o.type==='image'){
      if(!asset)throw Error('소재의 원본 이미지가 없습니다.');
      let stored=Object.values(next.assets).find(a=>a.src===asset.src);
      if(!stored){stored={...copy(asset),id:uid()};next.assets[stored.id]=stored;}
      o.assetId=stored.id;
    }
    for(const face of fontFaces.filter(f=>f.name===o.font)){
      const old=next.fonts.find(f=>f.name===face.name&&(f.weight||400)===(face.weight||400));
      if(old&&old.data!==face.data)throw Error('같은 이름의 다른 글꼴이 있습니다. 글꼴을 새 이름으로 추가하세요.');
      if(!old)next.fonts.push(copy(face));
    }
    const item={id,category,name:String(name).trim().slice(0,80),template:o};
    next.items.push(item);validate(next);return {library:next,item};
  }
  function remove(library,id){
    const next=copy(library);next.items=next.items.filter(item=>item.id!==id);
    const images=new Set(next.items.map(i=>i.template.assetId)),fonts=new Set(next.items.map(i=>i.template.font));
    next.assets=Object.fromEntries(Object.entries(next.assets).filter(([key])=>images.has(key)));
    next.fonts=next.fonts.filter(f=>fonts.has(f.name));return validate(next);
  }
  function merge(library,incoming){
    validate(incoming);let result=copy(library),count=0;
    for(const item of incoming.items){
      if(result.items.some(old=>old.id===item.id))continue;
      result=add(result,{...item,asset:incoming.assets[item.template.assetId],fontFaces:incoming.fonts}).library;count++;
    }
    return {library:result,count};
  }
  const api={empty,validate,add,remove,merge};
  if(typeof module!=='undefined')module.exports=api;else root.MaterialLibrary=api;
})(typeof window!=='undefined'?window:globalThis);
