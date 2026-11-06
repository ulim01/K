const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../src/alignment.js'),G=require('../src/geometry.js');
const page={width:1000,height:800};
const item=(extra={})=>({id:'moving',type:'shape',x:100,y:120,w:200,h:100,rotation:0,...extra});
test('moving frames snap to page center and both page edges at screen-relative tolerance',()=>{
  let o=item({x:397,y:347});let r=A.snapMove(o,[],page,6);
  assert.equal(r.x,400);assert.equal(r.y,350);assert.equal(r.guides.length,2);
  assert.ok(r.guides.every(g=>g.source==='page'&&g.center));
  assert.equal(A.snapMove(item({x:4}),[],page,6).x,0);
  assert.equal(A.snapMove(item({x:797}),[],page,6).x,800);
  assert.equal(A.snapMove(item({x:393}),[],page,6).x,393);
  assert.equal(A.snapMove(item({x:393}),[],page,12).x,400);
});
test('image edges and centers are alignment targets, including locked objects but excluding hidden ones and self',()=>{
  const other=item({id:'image',type:'image',x:250,y:230,w:180,h:140,locked:true});
  const moving=item({x:247,y:500,w:40,h:80});
  assert.equal(A.snapMove(moving,[moving,other],page,6).x,250);
  assert.equal(A.snapMove(moving,[moving,{...other,visible:false}],page,6).x,247);
  assert.equal(A.snapMove(item({x:317,y:500,w:40}),[other],page,6).x,320);
  const r=A.snapMove(moving,[other],page,6);assert.equal(r.guides[0].objectId,'image');
});
test('rotated body centers and visible bounds align without counting speech tails',()=>{
  const o=item({type:'bubble',x:396,y:345,rotation:40,tailX:10,tailY:10});
  const r=A.snapMove(o,[],page,6);assert.equal(r.x,400);assert.equal(r.y,350);
  const b=A.bounds(item({rotation:90}));assert.ok(Math.abs(b.left-150)<1e-7);assert.ok(Math.abs(b.top-70)<1e-7);
});
test('resize snapping fixes the opposite corner and preserves Shift aspect ratio',()=>{
  const before=item(),candidate={...before,w:395,h:278};
  const r=A.snapResize(before,candidate,'se',[],page,6,false);
  assert.deepEqual([r.x,r.y,r.w,r.h],[100,120,400,280]);
  const ratio=A.snapResize(before,{...before,w:396,h:198},'se',[],page,6,true);
  assert.equal(ratio.w/ratio.h,2);assert.equal(ratio.w,400);
  const nw=A.snapResize(before,{...before,x:3,y:2,w:297,h:218},'nw',[],page,6);
  assert.equal(nw.x,0);assert.equal(nw.y,0);assert.equal(nw.x+nw.w,300);assert.equal(nw.y+nw.h,220);
  assert.deepEqual(A.snapResize({...before,rotation:20},{...candidate,rotation:20},'se',[],page,6).guides,[]);
});
test('internal image scaling holds its opposite corner and never changes the frame',()=>{
  const frame=item({assetId:'a',imageZoom:1,imageX:.1,imageY:-.2}),asset={width:400,height:400};
  const old=G.imagePlacement(frame,asset),before=structuredClone(frame);
  const change=G.resizeImage(frame,asset,'content-se',{x:old.x+old.w*1.5,y:old.y+old.h*1.5});
  const next=G.imagePlacement({...frame,...change},asset);
  assert.deepEqual(frame,before);assert.equal(change.imageZoom,1.5);assert.equal(next.x,old.x);assert.equal(next.y,old.y);
  assert.equal(next.w/next.h,asset.width/asset.height);
  const shrink=G.resizeImage(frame,asset,'content-nw',{x:old.x+old.w/2,y:old.y+old.h/2});
  const s=G.imagePlacement({...frame,...shrink},asset);assert.equal(s.x+s.w,old.x+old.w);assert.equal(s.y+s.h,old.y+old.h);
});
test('image drop hit testing respects rotated polygons and ellipse cutouts',()=>{
  const frame=item({x:0,y:0,w:200,h:200,crop:'trapezoid',points:G.crops.trapezoid});
  assert.equal(G.containsPoint(frame,{x:1,y:1}),false);assert.equal(G.containsPoint(frame,{x:100,y:100}),true);
  assert.equal(G.containsPoint({...frame,crop:'ellipse'},{x:5,y:5}),false);
  const r=item({rotation:90});assert.equal(G.containsPoint(r,{x:151,y:80}),true);assert.equal(G.containsPoint(r,{x:105,y:130}),false);
});
test('project validation retains image-filled cuts and rejects missing image data',()=>{
  const doc={format:'panel-studio',version:1,assets:{a:{src:'data:image/png;base64,aGVsbG8=',width:10,height:10}},pages:[{id:'p',...page,background:'#ffffff',objects:[item({assetId:'a',imageZoom:2,imageX:10,imageY:-2})]}]};
  assert.equal(G.validateProject(doc).pages[0].objects[0].assetId,'a');delete doc.assets.a;assert.throws(()=>G.validateProject(doc));
  delete doc.pages[0].objects[0].assetId;assert.equal(G.validateProject(doc).pages[0].objects[0].type,'shape');
});
