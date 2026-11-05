const test=require('node:test');
const assert=require('node:assert/strict');
const L=require('../src/material-library.js');
const G=require('../src/geometry.js');
const bubble=()=>({id:'source',type:'bubble',x:123,y:456,w:300,h:180,shape:'thought',text:'생각 중',font:'My Font',fontSize:30,stroke:'#123456',strokeWidth:8,tailX:-.25,tailY:1.7,bendX:.3,rotation:17});
test('saved balloons keep editable style and tail independently of the canvas object',()=>{
  const source=bubble(),{library,item}=L.add(L.empty(),{name:'생각',category:'bubbles',template:source});
  assert.equal(item.template.x,0);assert.equal(item.template.y,0);
  assert.equal(item.template.tailX,-.25);assert.equal(item.template.rotation,17);
  assert.equal(item.template.strokeWidth,8);assert.notEqual(item.template.id,source.id);
  source.text='changed';assert.equal(item.template.text,'생각 중');
  assert.equal(L.merge(L.empty(),JSON.parse(JSON.stringify(library))).library.items[0].template.text,'생각 중');
  assert.equal(L.merge(library,library).count,0);
});
test('image and custom font assets travel with material backups and are pruned only when unused',()=>{
  const asset={id:'image1',src:'data:image/png;base64,aGVsbG8=',width:20,height:20};
  let lib=L.add(L.empty(),{name:'그림',category:'bubbles',template:{...bubble(),type:'image',assetId:'image1'},asset}).library;
  lib=L.add(lib,{name:'그림 복사',category:'sfx',template:{...bubble(),type:'image',assetId:'image1'},asset}).library;
  assert.equal(Object.keys(lib.assets).length,1);
  lib=L.add(lib,{name:'쿵!',category:'sfx',template:{...bubble(),type:'text',text:'쿵!'},fontFaces:[{name:'My Font',data:'data:font/ttf;base64,aGVsbG8=',weight:400}]}).library;
  assert.equal(lib.items[2].template.type,'sfx');assert.equal(lib.fonts.length,1);
  lib=L.merge(L.empty(),lib).library;assert.equal(Object.keys(lib.assets).length,1);assert.equal(lib.fonts.length,1);
  lib=L.remove(lib,lib.items[0].id);assert.equal(Object.keys(lib.assets).length,1);
  lib=L.remove(lib,lib.items[0].id);assert.equal(Object.keys(lib.assets).length,0);
  lib=L.remove(lib,lib.items[0].id);assert.equal(lib.fonts.length,0);
});
test('malformed libraries are rejected without changing saved materials',()=>{
  const lib=L.add(L.empty(),{name:'내 소재',category:'bubbles',template:bubble()}).library;
  for(const edit of [x=>x.items[0].id=undefined,x=>x.items[0].template.font={},x=>x.items[0].template.text=false,x=>x.items.push(x.items[0]),x=>x.items[0].template.type='script',x=>x.assets.bad={src:'https://example.com/a.png',width:20,height:20}]){
    const bad=structuredClone(lib);edit(bad);assert.throws(()=>L.merge(lib,bad));assert.equal(lib.items.length,1);
  }
  assert.throws(()=>L.add(lib,{name:'',category:'bubbles',template:bubble()}));
});
test('narration exports exact sharp corners and thought uses an ellipse with a curved, tapered circle trail',()=>{
  assert.equal(G.bubblePath({...bubble(),shape:'caption',tail:true}),'M0,0 L300,0 L300,180 L0,180 Z');
  const o=bubble();assert.equal(G.bubblePath(o),G.bubblePath({...o,shape:'ellipse',tail:false}));
  const circles=G.thoughtTail(o);assert.equal(circles.length,3);
  assert.ok(circles[0].rx>circles[1].rx&&circles[1].rx>circles[2].rx);
  assert.equal(circles[2].x,o.tailX*o.w);assert.equal(circles[2].y,o.tailY*o.h);
  assert.notDeepEqual(G.thoughtTail({...o,bendX:-.5})[0],circles[0]);
  assert.deepEqual(G.thoughtTail({...o,tail:false}),[]);
});
