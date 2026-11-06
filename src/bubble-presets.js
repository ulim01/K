(function(root){
  'use strict';
  // Editable vector contours, drawn to match the silhouettes in the two reference sheets.
  // Coordinates use a 100 × 100 body; tails and dialogue remain separate editable data.
  const ellipse=()=>Array.from({length:160},(_,i)=>{const a=i*Math.PI/80;return [50+50*Math.cos(a),50+50*Math.sin(a)];});
  function path(start,segments){
    const points=[start];let p=start;
    for(const seg of segments){
      const kind=seg[0],end=seg.slice(-2),steps=kind==='L'?1:24;
      for(let i=1;i<=steps;i++){const t=i/steps,u=1-t;points.push(kind==='L'?end:kind==='Q'?[u*u*p[0]+2*u*t*seg[1]+t*t*end[0],u*u*p[1]+2*u*t*seg[2]+t*t*end[1]]:[u**3*p[0]+3*u*u*t*seg[1]+3*u*t*t*seg[3]+t**3*end[0],u**3*p[1]+3*u*u*t*seg[2]+3*u*t*t*seg[4]+t**3*end[1]]);}
      p=end;
    }
    return points;
  }
  function smooth(knots,tension=.7){
    const out=[];
    for(let i=0;i<knots.length;i++){
      const a=knots[(i-1+knots.length)%knots.length],b=knots[i],c=knots[(i+1)%knots.length],d=knots[(i+2)%knots.length];
      out.push(...path(b,[['C',b[0]+(c[0]-a[0])*tension/6,b[1]+(c[1]-a[1])*tension/6,c[0]-(d[0]-b[0])*tension/6,c[1]-(d[1]-b[1])*tension/6,...c]]).slice(0,-1));
    }
    return out;
  }
  function burst(vertices,depth=.65){
    const segments=vertices.map((a,i)=>{const b=vertices[(i+1)%vertices.length],k=Array.isArray(depth)?depth[i%depth.length]:depth;return ['Q',50+((a[0]+b[0])/2-50)*k,50+((a[1]+b[1])/2-50)*k,...b];});
    return path(vertices[0],segments);
  }
  function scallop(seed=1,power=.7,amount=.035,count=10){
    const body=a=>[Math.sign(Math.cos(a))*Math.abs(Math.cos(a))**power,Math.sign(Math.sin(a))*Math.abs(Math.sin(a))**power];
    return Array.from({length:320},(_,i)=>{const a=i*Math.PI/160,p=body(a),before=body(a-.0001),after=body(a+.0001),dx=after[0]-before[0],dy=after[1]-before[1],length=Math.hypot(dx,dy),wave=amount*(Math.sin(count*a+seed)+.35*Math.sin((count+3)*a+seed*.7));return [50+48*(p[0]+wave*dy/length),50+48*(p[1]-wave*dx/length)];});
  }
  function normalize(points){
    const p=points.filter((v,i)=>!i||Math.hypot(v[0]-points[i-1][0],v[1]-points[i-1][1])>1e-8);
    if(Math.hypot(p[0][0]-p.at(-1)[0],p[0][1]-p.at(-1)[1])<1e-8)p.pop();
    const xs=p.map(v=>v[0]),ys=p.map(v=>v[1]),xmin=Math.min(...xs),ymin=Math.min(...ys),w=Math.max(...xs)-xmin,h=Math.max(...ys)-ymin;
    const result=p.map(v=>[(v[0]-xmin)/w,(v[1]-ymin)/h]);
    const area=result.reduce((sum,a,i)=>{const b=result[(i+1)%result.length];return sum+a[0]*b[1]-a[1]*b[0];},0);
    return area<0?result.reverse():result;
  }
  const bodies={
    oval:ellipse(),rect:[[0,0],[100,0],[100,100],[0,100]],
    doubleOval:path([48,0],[['C',85,0,108,17,85,43],['C',114,62,103,100,54,100],['C',7,100,-9,72,22,48],['C',-15,29,0,0,48,0]]),
    longShout:burst([[0,61],[40,0],[72,5],[100,27],[94,58],[80,76],[31,100]],[.68,.6,.7,.45,.65,.75,.65]),
    crispShout:burst([[0,48],[7,24],[20,20],[23,1],[48,0],[77,2],[80,22],[96,20],[92,42],[100,48],[94,70],[95,82],[76,84],[72,96],[51,100],[38,93],[22,97],[17,79],[4,78]],[.76,.97,.7,.8,.7,.8]),
    diagonalShout:path([0,78],[['Q',40,36,29,33],['Q',63,21,73,0],['Q',71,11,74,15],['Q',82,24,93,17],['Q',80,52,100,63],['Q',70,81,73,96],['Q',39,91,29,100],['Q',19,77,0,78]]),
    wideShout:burst([[0,40],[20,13],[42,0],[50,5],[75,2],[100,25],[96,47],[100,56],[93,58],[96,77],[86,79],[82,89],[60,92],[48,100],[20,98],[14,82],[5,79]],[.78,.9,.82,.7,.72,.4,.99]),
    bigShout:burst([[0,58],[9,39],[8,15],[24,13],[40,0],[66,11],[84,10],[96,39],[100,48],[92,71],[92,84],[76,83],[62,100],[48,89],[36,99],[28,85],[10,87]],[.85,.94,.75,.65,.7,.72,.98,.87]),
    flatShout:burst([[0,52],[12,40],[20,0],[34,10],[65,5],[70,28],[100,37],[94,65],[96,78],[80,87],[75,100],[55,92],[42,100],[26,90],[14,98]],[.88,.88,.65,.75,.8,.9,.5,.86,.96,.8]),
    tallRagged:burst([[3,23],[13,20],[14,10],[23,12],[31,5],[42,8],[55,0],[61,13],[72,14],[75,23],[87,25],[91,32],[88,38],[94,46],[91,55],[100,59],[94,68],[95,79],[83,83],[81,94],[69,97],[62,100],[53,96],[43,100],[36,96],[28,100],[22,88],[14,90],[18,84],[10,82],[11,73],[2,70],[8,59],[0,55],[7,45],[0,40],[10,32]],[.97,.94,.88,.9,.96,.85]),
    softBox:scallop(1,.82,.035,15),
    handBox:path([0,31],[['Q',11,17,17,5],['Q',35,9,62,0],['Q',76,14,90,17],['Q',89,37,96,54],['Q',85,62,85,78],['Q',69,80,65,91],['Q',45,85,26,100],['Q',16,80,2,67],['Q',2,49,0,31]]),
    naturalRound:scallop(3,.86,.05,9),
    trapezoid:[[0,0],[100,0],[76,100],[23,100]],
    reverseTrapezoid:[[17,0],[82,0],[100,100],[0,100]],
    looseRound:smooth([[0,44],[10,15],[26,7],[49,0],[77,6],[96,28],[100,56],[87,86],[60,100],[35,98],[12,89]],.8),
    roughRound:scallop(4,.91,.025,10),
    longLoose:smooth([[0,36],[9,8],[32,3],[52,6],[77,0],[94,3],[100,24],[99,61],[93,74],[76,82],[48,99],[21,100],[10,90]],.75),
    starEight:burst([[0,39],[18,14],[39,0],[62,11],[85,10],[100,35],[89,61],[95,82],[69,85],[53,100],[38,85],[8,87]],[.72,.65,.72,.75,.7,.65]),
    tallCloud:scallop(7,.82,.09,8),
    linkedBoxes:[[0,0],[61,0],[61,43],[100,43],[100,100],[39,100],[39,57],[0,57]],
    puffyBox:scallop(11,.78,.065,11),
    ruffledCircle:path([50,0],[['C',64,-1,76,4,81,10],['L',79,4],['C',97,16,100,33,96,47],['L',100,42],['C',100,62,86,87,73,90],['L',78,90],['C',56,108,29,102,20,83],['L',20,92],['C',2,79,-3,53,4,39],['L',0,42],['C',7,20,22,1,39,2],['L',35,0],['Q',42,1,50,0]]),
    tallShout:burst([[0,76],[10,41],[32,0],[51,12],[76,3],[72,24],[100,36],[84,59],[84,91],[66,88],[46,100],[23,94]],[.74,.9,.56,.8,.85,.7]),
    slantedShout:burst([[0,77],[10,47],[58,0],[66,19],[87,8],[85,37],[100,45],[92,57],[98,75],[69,78],[47,100],[24,87]],[.88,.95,.65,.66,.9,.75]),
    tiredBlob:smooth([[1,37],[8,10],[26,7],[47,0],[72,1],[95,17],[99,39],[95,58],[100,76],[85,95],[63,100],[41,98],[19,88],[8,66],[0,57]],.7),
    angledRound:smooth([[0,40],[7,24],[16,16],[29,13],[41,3],[68,0],[86,12],[99,31],[100,56],[91,74],[75,90],[52,100],[30,92],[13,79],[3,61]],.3),
    fourShout:burst([[0,7],[36,8],[67,0],[80,29],[100,50],[84,73],[82,100],[45,94],[7,100],[16,70],[0,53]],[.66,.65,.75,.9,.8,.6]),
    bean:smooth([[0,38],[11,9],[35,0],[65,4],[88,20],[87,44],[100,63],[88,81],[72,96],[43,100],[22,91],[13,74],[3,60]],.85),
    sixShout:burst([[0,26],[21,2],[48,0],[76,5],[100,31],[88,57],[100,73],[77,76],[63,100],[40,94],[27,98],[12,75],[1,72]],[.63,.6,.65,.7,.7,.8]),
    bannerShout:burst([[0,13],[43,8],[76,0],[85,18],[100,23],[93,56],[100,81],[75,80],[57,100],[37,83],[0,97],[11,60]],[.52,.63,.84,.8,.75,.75,.6]),
    tallNatural:scallop(13,1,.045,9),
    tallBanner:burst([[0,18],[12,0],[29,6],[51,0],[72,7],[94,4],[97,27],[91,47],[100,69],[90,83],[91,100],[62,96],[38,100],[22,94],[4,93],[9,68]],[.8,.86,.7,.75,.8,.8]),
    leaningShout:burst([[0,24],[15,17],[17,0],[44,9],[65,2],[73,23],[80,39],[100,52],[89,74],[96,100],[63,92],[44,95],[22,89],[7,89],[13,64]],[.74,.9,.72,.85,.87,.8]),
    hourglass:path([27,0],[['C',42,0,55,5,67,1],['C',87,-6,102,11,100,32],['C',99,43,89,47,93,61],['C',105,83,101,101,79,100],['C',60,97,44,99,31,100],['C',7,100,-3,78,5,55],['C',11,43,-2,31,0,18],['C',0,4,12,-1,27,0]]),
    thoughtCloud:scallop(5,.85,.055,10),
    meltingDouble:path([34,0],[['C',44,-3,47,7,55,6],['C',74,7,85,26,73,36],['C',68,45,76,45,80,52],['C',84,59,98,66,96,77],['C',103,91,84,97,72,95],['C',64,106,43,99,42,86],['C',36,80,43,65,36,60],['C',27,54,12,55,8,43],['C',-5,34,-3,19,12,14],['C',13,3,23,2,34,0]])
  };
  const se={tail:true,tailAngle:55,tailX:.96,tailY:1.22,tailWidth:28};
  const ne={tail:true,tailAngle:310,tailX:1.05,tailY:-.16,tailWidth:27};
  const none={tail:false};
  const presets=[];
  function add(collection,number,name,body,w,h,defaults=none,regions=null){
    const id=`sheet${collection}-${String(number).padStart(2,'0')}`;
    presets.push({id,collection,number,name,body,w,h,defaults:{tailStyle:'solid',tailAngle:65,tailX:.92,tailY:1.2,tailWidth:28,bendX:0,bendY:0,fontSize:28,padding:22,...defaults},regions,join:['rect','trapezoid','reverseTrapezoid','linkedBoxes'].includes(body)?'miter':'round'});
  }
  add(1,1,'가로 타원','oval',420,225,{...se,tailAngle:67,tailX:.79,tailY:1.09,tailWidth:23});
  add(1,2,'둥근 대화','oval',285,235,{...se,tailX:.89,tailY:1.08,tailWidth:23});
  add(1,3,'이어진 두 대사','doubleOval',360,430,{...se,tailAngle:64,tailX:.78,tailY:1.09,fontSize:26},[[.08,.03,.84,.39],[.09,.55,.83,.38]]);
  add(1,4,'넓게 터지는 외침','longShout',480,240,{tail:false,fontSize:32,weight:700});
  add(1,5,'촘촘한 외침','crispShout',390,265,{tail:false,fontSize:32,weight:700});
  add(1,6,'비스듬한 외침','diagonalShout',310,350,{tail:false,fontSize:31,weight:700,padding:40});
  add(1,7,'가로로 긴 외침','wideShout',450,230,{tail:false,fontSize:32,weight:700});
  add(1,8,'크게 울리는 외침','bigShout',450,300,{tail:false,fontSize:32,weight:700});
  add(1,9,'납작한 외침','flatShout',460,220,{tail:false,fontSize:30,weight:700});
  add(1,10,'세로 거친 외침','tallRagged',280,430,{tail:false,fontSize:30,weight:700,padding:36});
  add(1,11,'잔물결 사각','softBox',370,290);
  add(2,1,'둥근 꼬리 말풍선','oval',270,250,se);
  add(2,2,'왼쪽 꼬리 타원','oval',390,220,{...se,tailAngle:133,tailX:.1,tailY:1.26});
  add(2,3,'위쪽 꼬리 타원','oval',390,220,ne);
  add(2,4,'아래 꼬리 사각','rect',330,220,{...se,tailAngle:111,tailX:.29,tailY:1.35});
  add(2,5,'위 꼬리 사각','rect',330,220,{...ne,tailAngle:280,tailX:.65,tailY:-.3});
  add(2,6,'세로 타원','oval',180,370,{...ne,tailAngle:300,tailX:.89,tailY:-.12,padding:18});
  add(2,7,'손그림 사각','handBox',340,280);
  add(2,8,'자연스러운 둥근형','naturalRound',295,290);
  add(2,9,'좁아지는 사다리꼴','trapezoid',370,250,{tail:false,padding:42});
  add(2,10,'꼬리 사다리꼴','reverseTrapezoid',360,260,{...se,tailAngle:72,tailX:.65,tailY:1.32});
  add(2,11,'손그림 대화','looseRound',300,285,{...se,tailAngle:47,tailX:1.03,tailY:1.2});
  add(2,12,'위로 향한 손그림','roughRound',300,285,{...ne,tailAngle:228,tailX:.12,tailY:-.2});
  add(2,13,'길게 이어지는 한마디','longLoose',480,175,{...se,tailAngle:56,tailX:.88,tailY:1.35,padding:18});
  add(2,14,'날카로운 외침','starEight',310,310,{tail:false,fontSize:32,weight:700,padding:35});
  add(2,15,'세로 구름 대화','tallCloud',170,390,{...se,tailAngle:70,tailX:1.06,tailY:1.13,padding:18});
  add(2,16,'세로 사각 대화','rect',245,360,{...se,tailAngle:120,tailX:.13,tailY:1.26});
  add(2,17,'이어진 사각 대사','linkedBoxes',410,330,{tail:false,fontSize:26,padding:12},[[.02,.02,.57,.5],[.41,.46,.57,.52]]);
  add(2,18,'몽글몽글 사각','puffyBox',330,315);
  add(2,19,'소용돌이 둥근형','ruffledCircle',300,300);
  add(2,20,'길쭉한 외침','tallShout',230,330,{tail:false,fontSize:30,weight:700,padding:35});
  add(2,21,'기울어진 외침','slantedShout',400,265,{tail:false,fontSize:31,weight:700,padding:45});
  add(2,22,'축 처진 둥근형','tiredBlob',300,300);
  add(2,23,'각진 손그림','angledRound',305,285);
  add(2,24,'네 귀퉁이 외침','fourShout',310,300,{tail:false,fontSize:32,weight:700,padding:35});
  add(2,25,'비대칭 물방울','bean',370,320);
  add(2,26,'힘 있는 외침','sixShout',390,330,{tail:false,fontSize:32,weight:700,padding:38});
  add(2,27,'가로 현수막 외침','bannerShout',440,275,{tail:false,fontSize:30,weight:700,padding:42});
  add(2,28,'세로 자연형','tallNatural',270,375);
  add(2,29,'세로 현수막 외침','tallBanner',290,390,{tail:false,fontSize:28,weight:700,padding:32});
  add(2,30,'기울어진 세로 외침','leaningShout',300,410,{tail:false,fontSize:28,weight:700,padding:38});
  add(2,31,'부드러운 세로형','hourglass',290,370);
  add(2,32,'구름 생각 말풍선','thoughtCloud',290,300,{tail:true,tailStyle:'dots',tailAngle:101,tailX:.38,tailY:1.28,tailWidth:27});
  add(2,33,'녹아내리는 두 대사','meltingDouble',340,360,{tail:false,fontSize:25,padding:12},[[.02,.07,.7,.39],[.43,.63,.54,.3]]);
  const outlines=Object.fromEntries(Object.entries(bodies).map(([key,points])=>[key,normalize(points)]));
  const byId=Object.fromEntries(presets.map(p=>[p.id,p]));
  const get=id=>byId[id]||null;
  const outline=id=>{const p=get(id);return p?outlines[p.body]:null;};
  function intersection(id,angle){
    const poly=outline(id),dx=Math.cos(angle),dy=Math.sin(angle);let best=null;
    if(!poly)return null;
    for(let i=0;i<poly.length;i++){
      const a=poly[i],b=poly[(i+1)%poly.length],ex=b[0]-a[0],ey=b[1]-a[1],den=dx*ey-dy*ex;
      if(Math.abs(den)<1e-10)continue;
      const ax=a[0]-.5,ay=a[1]-.5,r=(ax*ey-ay*ex)/den,t=(ax*dy-ay*dx)/den;
      if(r>=0&&t>=-1e-8&&t<=1+1e-8&&(!best||r>best.r))best={x:.5+r*dx,y:.5+r*dy,edge:i,t:Math.max(0,Math.min(1,t)),r};
    }
    return best;
  }
  const api={presets,get,outline,intersection};
  if(typeof module!=='undefined')module.exports=api;else root.BubbleCatalog=api;
})(typeof window!=='undefined'?window:globalThis);
