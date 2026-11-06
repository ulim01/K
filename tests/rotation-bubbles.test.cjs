const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../src/alignment.js'),G=require('../src/geometry.js'),C=require('../src/bubble-presets.js');
test('rotation snaps across zero, at standard angles, and to visible peers including perpendicular angles',()=>{
  const o={id:'a'},peer={id:'b',rotation:22.5};
  assert.equal(A.snapRotation(358.6,o,[]).rotation,360);
  assert.equal(A.snapRotation(-1.2,o,[]).rotation,0);
  assert.equal(A.snapRotation(43,o,[]).rotation,45);
  assert.equal(A.snapRotation(21.8,o,[peer]).rotation,22.5);
  assert.equal(A.snapRotation(111.5,o,[peer]).rotation,112.5);
  assert.equal(A.snapRotation(111.5,o,[peer]).guide.perpendicular,true);
  assert.equal(A.snapRotation(21.8,o,[{...peer,visible:false}]).guide,null);
  assert.equal(A.snapRotation(43,o,[],{enabled:false}).rotation,43);
  assert.equal(A.snapRotation(38,o,[],{enabled:false,forceStep:true}).rotation,45);
  assert.equal(A.angleDelta(179,-179),2);assert.equal(A.angleDelta(-179,179),-2);
});
test('both reference sheets have a complete numbered catalog with finite closed vector bodies',()=>{
  assert.equal(C.presets.length,44);
  for(const [sheet,count] of [[1,11],[2,33]]){
    const presets=C.presets.filter(p=>p.collection===sheet);assert.deepEqual(presets.map(p=>p.number),Array.from({length:count},(_,i)=>i+1));
    for(const p of presets){
      const outline=C.outline(p.id);assert.ok(outline.length>=4);assert.ok(outline.flat().every(v=>Number.isFinite(v)&&v>=0&&v<=1));
      const o={type:'bubble',shape:p.id,w:p.w,h:p.h,...p.defaults};
      for(const angle of [0,45,90,135,180,225,270,315]){
        const d=G.bubblePath({...o,tail:true,tailAngle:angle});assert.ok(d.startsWith('M')&&d.endsWith('Z'));assert.ok(!/NaN|undefined|Infinity/.test(d));
        const t=G.tailGeometry({...o,tailAngle:angle});assert.ok(Number.isFinite(t.start.x)&&t.start.edge!==undefined);
      }
    }
  }
});
test('linked ovals, linked boxes and melting bubbles each keep two independent text regions',()=>{
  for(const shape of ['sheet1-03','sheet2-17','sheet2-33']){
    const o={type:'bubble',shape,w:400,h:500},areas=G.textAreas(o);assert.equal(areas.length,2);
    assert.deepEqual(areas.map(a=>a.key),['text','text2']);assert.ok(areas[0].y<areas[1].y);
    assert.ok(areas.every(a=>a.x>=0&&a.y>=0&&a.x+a.w<=400.001&&a.y+a.h<=500.001));
  }
  assert.equal(G.textAreas({type:'text',w:200,h:100}).length,1);
  assert.equal(G.dottedTail({shape:'sheet2-32',tailStyle:'dots'}),true);
});
test('new bubble text and tail styles survive project/library validation and reject malformed data',()=>{
  const object={id:'b',type:'bubble',x:0,y:0,w:300,h:400,shape:'sheet1-03',text:'첫째',text2:'둘째',tailStyle:'solid'};
  const doc={format:'panel-studio',version:1,assets:{},pages:[{id:'p',width:800,height:1000,background:'#ffffff',objects:[object]}]};
  assert.equal(G.validateProject(doc).pages[0].objects[0].text2,'둘째');object.text2={};assert.throws(()=>G.validateProject(doc));
});
