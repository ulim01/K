const test=require('node:test');
const assert=require('node:assert/strict');
const G=require('../src/geometry.js');
test('a curved tail stays part of the balloon outline on every side',()=>{
  for(const shape of ['ellipse','round','cloud','burst','box','thought','whisper','caption'])for(let angle=0;angle<360;angle+=15){
    const path=G.bubblePath({shape,w:320,h:180,tail:true,tailAngle:angle,tailWidth:45,tailX:-.3,tailY:1.8,bendX:.4,bendY:-.2});
    assert.ok(path.startsWith('M')&&path.endsWith('Z'));assert.ok(!/NaN|Infinity|undefined/.test(path));
    if(!['caption','thought'].includes(shape))assert.equal((path.match(/ Q/g)||[]).length,2);
  }
});
test('rotated object coordinates map back to local editing points',()=>{
  const o={x:100,y:200,w:400,h:200,rotation:90};
  const p=G.localPoint(o,{x:300,y:100});assert.ok(Math.abs(p.x)<1e-9);assert.ok(Math.abs(p.y-100)<1e-9);
});
test('Korean text wraps by Unicode characters and keeps blank lines',()=>{
  assert.deepEqual(G.wrapText('웹툰을만들어요\n\n두근!',30,10,s=>Array.from(s).length*10),['웹툰을','만들어','요','','두근!']);
});
const valid=()=>({format:'panel-studio',version:1,assets:{},pages:[{id:'page1',width:8000,height:8000,background:'#ffffff',objects:[]}]});
test('8000 × 8000 pages are accepted, oversized pages are rejected',()=>{
  assert.equal(G.validateProject(valid()).pages[0].width,8000);const p=valid();p.pages[0].height=8001;assert.throws(()=>G.validateProject(p));
  const small=valid();small.pages[0].width=1;small.pages[0].height=1;assert.equal(G.validateProject(small).pages[0].width,1);
});
test('invalid projects cannot inject remote assets, markup, or invalid coordinates',()=>{
  const p=valid();p.pages[0].objects=[{id:'a1',type:'bubble',x:0,y:0,w:100,h:100,fill:'red" onload="alert(1)'}];assert.throws(()=>G.validateProject(p));
  const q=valid();q.assets.a1={src:'https://example.com/private.png',width:10,height:10};assert.throws(()=>G.validateProject(q));
  const r=valid();r.pages[0].objects=[{id:'a1',type:'text',x:0,y:0,w:100,h:100,fontSize:NaN}];assert.throws(()=>G.validateProject(r));
});
test('arbitrary polygon clipping preserves all vertices',()=>{
  const d=G.polygonPath([[.1,0],[1,.2],[.8,1],[0,.9]],100,200);assert.equal(d,'M10,0 L100,40 L80,200 L0,180 Z');
});
