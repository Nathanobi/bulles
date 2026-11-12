/* Bulles d'idées : application (canvas, physique, interface, synchronisation optionnelle) */
(()=>{
'use strict';
const FONT='"Bricolage Grotesque","DM Sans",system-ui,sans-serif', TAU=Math.PI*2;
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
const $=s=>document.querySelector(s);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rnd=(a,b)=>a+Math.random()*(b-a);
const lsGet=k=>{try{return localStorage.getItem(k)}catch(e){return null}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};
const cv=$('#cv'), ctx=cv.getContext('2d');
let DPR=1,VW=800,VH=600,T=0,fontEpoch=0;
const TOPM=64,BOTM=88;

/* ================= réglages ================= */
const DEF={bg:'#04050a',bubble:'#0e1018',text:'#e7eaf5',star:'#ffffff',rim:'rainbow',rimHue:215,rimSat:52,rimLight:66,rimWidth:2,rimSpeed:.5,
  bounce:.85,wall:.75,wallGap:6,friction:.45,drift:.7,pull:.12,throwK:1,slosh:.9,dragPush:false,starDensity:1,twinkle:1,parallax:1,fontScale:1};
const SCHEMA=[
 {sec:'Couleurs',items:[
  {k:'bg',t:'color',l:'Fond'},{k:'bubble',t:'color',l:'Bulles'},{k:'text',t:'color',l:'Texte'},{k:'star',t:'color',l:'Étoiles'},
  {k:'rim',t:'select',l:'Contour',o:[['rainbow','Arc-en-ciel doux'],['solid','Couleur unie'],['none','Discret']]},
  {k:'rimHue',t:'range',min:0,max:360,step:1,l:'Teinte du contour uni'},
  {k:'rimSat',t:'range',min:15,max:90,step:1,l:'Intensité du contour',u:'%'},
  {k:'rimLight',t:'range',min:40,max:85,step:1,l:'Luminosité du contour',u:'%'},
  {k:'rimWidth',t:'range',min:1,max:4,step:.5,l:'Épaisseur du contour',u:' px'},
  {k:'rimSpeed',t:'range',min:0,max:2,step:.1,l:'Rotation du contour'}]},
 {sec:'Mouvement',items:[
  {k:'bounce',t:'range',min:0,max:1,step:.05,l:'Rebond entre bulles'},
  {k:'wall',t:'range',min:0,max:1,step:.05,l:'Rebond sur les bords'},
  {k:'wallGap',t:'range',min:0,max:30,step:1,l:'Marge au bord',u:' px'},
  {k:'friction',t:'range',min:0,max:1,step:.05,l:'Frottement'},
  {k:'drift',t:'range',min:0,max:2,step:.05,l:'Agitation'},
  {k:'pull',t:'range',min:0,max:1,step:.05,l:'Attraction vers le centre'},
  {k:'throwK',t:'range',min:0,max:2,step:.1,l:'Force du lancer'},
  {k:'slosh',t:'range',min:0,max:1.5,step:.05,l:'Ballottement des sous-bulles'},
  {k:'dragPush',t:'check',l:'Repousser les autres bulles en glissant'}]},
 {sec:'Ciel',items:[
  {k:'starDensity',t:'range',min:0,max:2,step:.1,l:'Nombre d\'étoiles'},
  {k:'twinkle',t:'range',min:0,max:2,step:.1,l:'Scintillement'},
  {k:'parallax',t:'range',min:0,max:2,step:.1,l:'Profondeur au zoom et au déplacement'}]},
 {sec:'Texte',items:[{k:'fontScale',t:'range',min:.8,max:1.4,step:.05,l:'Taille du texte'}]}
];
const PRESETS=[
 ['Nuit',{bg:'#04050a',bubble:'#0e1018',text:'#e7eaf5',star:'#ffffff',rim:'rainbow'}],
 ['Minuit bleu',{bg:'#030614',bubble:'#0a1024',text:'#dfe8ff',star:'#cfe0ff',rim:'solid',rimHue:212}],
 ['Aurore',{bg:'#050709',bubble:'#0b1211',text:'#e4f5ee',star:'#e8fff6',rim:'solid',rimHue:160}],
 ['Graphite',{bg:'#0a0a0c',bubble:'#16171b',text:'#ececf0',star:'#9a9aa6',rim:'none'}]
];
let opts=Object.assign({},DEF);
function cleanOpts(d){
  const o={};if(!d||typeof d!=='object')return o;
  for(const k in DEF){
    if(!(k in d))continue;const v=d[k];
    if(typeof DEF[k]==='boolean'){if(typeof v==='boolean')o[k]=v}
    else if(typeof DEF[k]==='number'){if(typeof v==='number'&&isFinite(v)){const it=SCHEMA.flatMap(s=>s.items).find(i=>i.k===k);o[k]=it?clamp(v,it.min,it.max):v}}
    else if(k==='rim'){if(['rainbow','solid','none'].includes(v))o[k]=v}
    else if(/^#[0-9a-f]{6}$/i.test(v))o[k]=v;
  }return o;
}
try{const s=lsGet('bulles.opts');if(s)Object.assign(opts,cleanOpts(JSON.parse(s)))}catch(e){}
const hex2rgb=h=>{const m=/^#?([0-9a-f]{6})$/i.exec(h||'');const v=m?parseInt(m[1],16):0;return[(v>>16)&255,(v>>8)&255,v&255]};
const lift=(rgb,a)=>`rgb(${rgb.map(c=>Math.round(c+(255-c)*a)).join(',')})`;

/* ================= données ================= */
const nodes=new Map();let tops=[];let sel=null,hover=null;
let canWrite=true,loaded=false,mode='connecting',coll=null,optRef=null,dlCap=null,seqN=0;
const dirty=new Set(),dels=new Set();
/* Arène = zone visible (en unités du monde) : elle grandit quand on dézoome et suit la fenêtre */
const arena={cx:0,cy:0,hw:450,hh:280};
function uid(){return 'n'+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
function mk(p){return{id:p.id||uid(),n:p.n||'',c:p.c||'',p:p.p||null,h:Number.isFinite(p.h)?p.h:null,o:Number.isFinite(p.o)?p.o:Date.now()+(seqN++),
  x:0,y:0,vx:0,vy:0,r:4,tr:40,kids:[],par:null,phase:rnd(0,TAU),hue0:rnd(0,360),_placed:false,_pp:undefined,_wk:'',_wl:[]}}
const docOf=n=>({n:n.n,c:n.c,p:n.p||null,h:n.h,o:n.o});
function rebuild(){
  for(const n of nodes.values()){n.kids=[];n.par=null}
  for(const n of nodes.values()){let cur=n.p&&nodes.get(n.p),st=0;while(cur&&st++<nodes.size+1){if(cur===n){n.p=null;break}cur=cur.p&&nodes.get(cur.p)}}
  for(const n of nodes.values()){const pp=n.p&&nodes.get(n.p);if(pp&&pp!==n){n.par=pp;pp.kids.push(n)}}
  tops=[...nodes.values()].filter(n=>!n.par);
  const by=(a,b)=>a.o-b.o||(a.id<b.id?-1:1);tops.sort(by);for(const n of nodes.values())n.kids.sort(by);
  for(const n of nodes.values()){
    if(n._pp!==undefined&&n._pp!==n.p)n._placed=false;n._pp=n.p;
    if(!n._placed){
      n._placed=true;n.vx=rnd(-20,20);n.vy=rnd(-20,20);
      if(n.par){const a=rnd(0,TAU),d=rnd(0,Math.max(10,n.par.tr*.35));n.x=Math.cos(a)*d;n.y=Math.sin(a)*d}
      else{const m=Math.min(arena.hw,arena.hh)*.5;n.x=arena.cx+rnd(-m,m);n.y=arena.cy+rnd(-m,m)}
    }
  }
}
function worldOf(n){let x=n.x,y=n.y,p=n.par;while(p){x+=p.x;y+=p.y;p=p.par}return[x,y]}
const isAnc=(a,n)=>{for(let c=n.par;c;c=c.par)if(c===a)return true;return false};
const depthOf=n=>{let d=0;for(let c=n.par;c;c=c.par)d++;return d};
function subtree(n,out=[]){out.push(n);for(const k of n.kids)subtree(k,out);return out}
function pick(wx,wy,ex){
  const rec=(list,ox,oy)=>{for(let i=list.length-1;i>=0;i--){const n=list[i];if(n===ex)continue;const cx=ox+n.x,cy=oy+n.y;
    if(Math.hypot(wx-cx,wy-cy)<=n.r)return rec(n.kids,cx,cy)||n}return null};
  return rec(tops,0,0);
}

/* ================= enregistrement et synchronisation ================= */
const ST={connecting:['Connexion…','warn'],synced:['Synchronisé','ok'],saving:['Enregistrement…','warn'],local:['Local à cet appareil',''],
  error:['Hors ligne, nouvel essai…','bad'],slow:['Connexion lente…','warn'],ro:['Lecture seule','']};
let stKey='';
function setStatus(k){if(k===stKey)return;stKey=k;const s=$('#status');s.dataset.s=ST[k][1];s.title=ST[k][0];s.setAttribute('aria-label',ST[k][0]);s.querySelector('b').textContent=ST[k][0];updSyncNote()}
let flushing=false,flushT=0,inflight=null;
function markDirty(id){if(!canWrite)return;dels.delete(id);dirty.add(id);queueFlush()}
function markDel(id){if(!canWrite)return;dirty.delete(id);dels.add(id);queueFlush()}
function queueFlush(){clearTimeout(flushT);if(mode==='db')setStatus('saving');flushT=setTimeout(flush,450)}
function saveLocal(){lsSet('bulles.local',JSON.stringify([...nodes.values()].map(n=>({id:n.id,...docOf(n)}))))}
async function flush(){
  if(flushing)return;flushing=true;let retry=false;
  try{
    while(dirty.size||dels.size){
      if(mode!=='db'){saveLocal();dirty.clear();dels.clear();break}
      if(dirty.size){const id=dirty.values().next().value;dirty.delete(id);const n=nodes.get(id);inflight={id,del:false};if(n)await coll.doc(id).set(docOf(n))}
      else{const id=dels.values().next().value;inflight={id,del:true};await coll.doc(id).delete();dels.delete(id)}
      inflight=null;
    }
    setStatus(mode==='db'?'synced':'local');
  }catch(err){
    const code=err&&err.code;
    if(code==='invalid_argument'||code==='revoked'||code==='not_granted'){dirty.clear();dels.clear();canWrite=false;applyWriteState();setStatus('ro')}
    else if(code==='quota_exceeded'){dirty.clear();dels.clear();setStatus('synced');toast('Limite de stockage atteinte : supprime des bulles')}
    else{if(inflight){(inflight.del?dels:dirty).add(inflight.id)}setStatus('error');retry=true}
    inflight=null;
  }finally{flushing=false;if(retry)setTimeout(queueFlush,5000);else if(dirty.size||dels.size)queueFlush()}
}
const str=(v,m)=>typeof v==='string'?v.slice(0,m):'';
function onNodes(snap){
  let changed=false;
  for(const ch of snap.docChanges()){
    const id=ch.doc.id;
    if(ch.type==='removed'){if(dirty.has(id))continue;if(nodes.delete(id)){changed=true;if(sel&&sel.id===id)sel=null}continue}
    if(dirty.has(id)||dels.has(id))continue;
    const d=ch.doc.data()||{};
    const f={n:str(d.n,120),c:str(d.c,2000),p:typeof d.p==='string'?d.p:null,h:Number.isFinite(d.h)?d.h:null,o:Number.isFinite(d.o)?d.o:0};
    let n=nodes.get(id);
    if(!n){nodes.set(id,mk({id,...f}));changed=true}
    else if(n.n!==f.n||n.c!==f.c||n.p!==f.p||n.h!==f.h||n.o!==f.o){Object.assign(n,f);changed=true}
  }
  if(changed){rebuild();updatePanel();updTarget()}
  if(!snap.metadata.fromCache){clearTimeout(slowT);if(!dirty.size&&!dels.size&&!flushing)setStatus(canWrite?'synced':'ro')}
  if(!loaded){loaded=true}
  updEmpty();
}
let slowT=0,lastLocalOpt=0,optT=0;
function onOpts(snap){
  if(!snap.exists||Date.now()-lastLocalOpt<2500)return;
  const d=snap.data()||{};applyOpts(cleanOpts(d.o),true);
}
function applyOpts(p,remote){
  const dens=opts.starDensity;Object.assign(opts,p);
  document.body.style.background=opts.bg;document.documentElement.style.background=opts.bg;
  if(dens!==opts.starDensity)mkStars();
  invalidateText();syncDrawer();
  lsSet('bulles.opts',JSON.stringify(opts));
  if(!remote){lastLocalOpt=Date.now();clearTimeout(optT);optT=setTimeout(saveOpts,800)}
}
async function saveOpts(){if(mode!=='db'||!optRef||!canWrite)return;try{await optRef.set({o:opts,t:Date.now()})}catch(e){}}
const invalidateText=()=>{for(const n of nodes.values())n._wk=''};
function loadLocal(){
  let arr=null;try{arr=JSON.parse(lsGet('bulles.local')||'null')}catch(e){}
  if(!Array.isArray(arr)||!arr.length){
    const b=Date.now();
    arr=[{id:'souche',n:'Souche',c:'Exemple : renomme ou supprime ces bulles quand tu veux.',p:null,h:null,o:b},
      {id:'poulet',n:'poulet',c:'achète un poulet frais de la région pour vendredi soir',p:'souche',h:null,o:b+1},
      {id:'lait',n:'lait',c:'',p:'souche',h:null,o:b+2},{id:'plombier',n:'appeler le plombier',c:'',p:'souche',h:null,o:b+3}];
  }
  for(const d of arr){if(d&&typeof d.id==='string')nodes.set(d.id,mk({id:d.id,n:str(d.n,120),c:str(d.c,2000),p:typeof d.p==='string'?d.p:null,h:Number.isFinite(d.h)?d.h:null,o:d.o}))}
  rebuild();
}
async function initSync(){
  let db=null;
  try{if(window.claude&&window.claude.use)db=await window.claude.use('db')}catch(e){}
  try{if(window.claude&&window.claude.use)dlCap=await window.claude.use('downloads')}catch(e){}
  if(!db){mode='local';loadLocal();loaded=true;setStatus('local');updEmpty();updTarget();return}
  mode='db';coll=db.collection('bulles');optRef=db.doc('reglages/principal');
  try{const u=await window.claude.use('user');const c=u?await u.can('data.write'):null;canWrite=c!==false}catch(e){}
  applyWriteState();
  if(!canWrite)setStatus('ro');
  slowT=setTimeout(()=>{if(!loaded||stKey==='connecting')setStatus('slow')},10000);
  coll.onSnapshot(onNodes,e=>{setStatus('error')});
  optRef.onSnapshot(onOpts,()=>{});
}

/* ================= actions ================= */
function addNode(name,parent){const n=mk({n:name,p:parent?parent.id:null});n._pp=n.p;nodes.set(n.id,n);rebuild();markDirty(n.id);updEmpty();return n}
function reparent(n,np){
  const[wx,wy]=worldOf(n);n.p=np?np.id:null;n._pp=n.p;rebuild();
  const[ox,oy]=np?worldOf(np):[0,0];n.x=wx-ox;n.y=wy-oy;n._placed=true;markDirty(n.id);
}
function wrapNode(n,name){
  const g=mk({n:name,p:n.p});g._pp=g.p;g._placed=true;g.x=n.x;g.y=n.y;g.r=n.r*1.3;g.vx=n.vx;g.vy=n.vy;nodes.set(g.id,g);
  n.p=g.id;n._pp=g.id;n.x=0;n.y=0;n.vx=n.vy=0;n._placed=true;rebuild();markDirty(g.id);markDirty(n.id);return g;
}
function moveOut(n){
  const P=n.par;if(!P)return;const G=P.par,a=rnd(0,TAU),d=P.r+n.r+16;
  n.p=G?G.id:null;n._pp=n.p;rebuild();n.x=P.x+Math.cos(a)*d;n.y=P.y+Math.sin(a)*d;n._placed=true;n.vx=Math.cos(a)*60;n.vy=Math.sin(a)*60;markDirty(n.id);
}
function deleteNode(n,keep){
  if(keep){for(const k of [...n.kids])reparent(k,n.par)}
  const all=keep?[n]:subtree(n);
  for(const m of all){nodes.delete(m.id);markDel(m.id)}
  if(sel&&!nodes.has(sel.id))sel=null;
  rebuild();updatePanel();updTarget();updEmpty();
}

/* ================= physique ================= */
const drag={active:false,node:null,ox:0,oy:0,px:0,py:0,target:null,origPar:null,hist:[]};
function calcT(n){
  if(!n.kids.length){n.tr=clamp(34+Math.sqrt(n.n.length)*8.5,42,104)}
  else{let s=0;for(const k of n.kids){calcT(k);s+=k.tr*k.tr}n.tr=Math.max(66,Math.sqrt(s/.5)+18)}
}
function collide(list){
  const e=opts.bounce;
  for(let i=0;i<list.length;i++){const a=list[i];
    for(let j=i+1;j<list.length;j++){const b=list[j];
      let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);const min=a.r+b.r+2;
      if(d>=min)continue;
      if(d<.001){const t=rnd(0,TAU);dx=Math.cos(t);dy=Math.sin(t);d=1}
      const nx=dx/d,ny=dy/d,ov=min-d;
      const da=drag.active&&a===drag.node,db=drag.active&&b===drag.node;
      if((da||db)&&!opts.dragPush)continue; /* la bulle tenue traverse les autres : plus facile de la ranger dans une bulle */
      const wa=da?0:1/(a.r*a.r),wb=db?0:1/(b.r*b.r),ws=wa+wb;if(!ws)continue;
      a.x-=nx*ov*wa/ws;a.y-=ny*ov*wa/ws;b.x+=nx*ov*wb/ws;b.y+=ny*ov*wb/ws;
      const rv=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
      if(rv<0){const imp=-(1+e)*rv/ws;a.vx-=imp*wa*nx;a.vy-=imp*wa*ny;b.vx+=imp*wb*nx;b.vy+=imp*wb*ny}
    }}
}
/* Bord : un petit dépassement rebondit comme avant. Au-delà de SOFT px, la bulle est propulsée vers l'intérieur,
   d'autant plus fort qu'elle dépasse (plus de téléportation). (nx,ny) = normale vers l'intérieur. */
const SOFT=8,KPROP=60;
function propel(n,nx,ny,pen,dt){
  if(pen<=SOFT)return false;
  n.vx+=nx*(pen-SOFT)*KPROP*dt;n.vy+=ny*(pen-SOFT)*KPROP*dt;
  const vo=-(n.vx*nx+n.vy*ny);
  if(vo>0){const d=vo*(1-Math.exp(-(1-opts.wall)*10*dt));n.vx+=nx*d;n.vy+=ny*d}
  return true;
}
function walls(list,C,dt){
  const O=opts,m=O.wallGap;
  for(const n of list){
    if(drag.active&&n===drag.node)continue;
    if(C){
      const lim=C.r-n.r-m,d=Math.hypot(n.x,n.y);
      if(lim<=1){n.x*=.9;n.y*=.9;continue}
      if(d>lim){const nx=n.x/d,ny=n.y/d;
        if(!propel(n,-nx,-ny,d-lim,dt)){n.x=nx*lim;n.y=ny*lim;const vn=n.vx*nx+n.vy*ny;if(vn>0){n.vx-=(1+O.wall)*vn*nx;n.vy-=(1+O.wall)*vn*ny}}}
    }else{
      const x0=arena.cx-arena.hw+n.r+m,x1=arena.cx+arena.hw-n.r-m,y0=arena.cy-arena.hh+n.r+m,y1=arena.cy+arena.hh-n.r-m;
      if(n.x<x0){if(!propel(n,1,0,x0-n.x,dt)){n.x=x0;if(n.vx<0)n.vx*=-O.wall}}
      else if(n.x>x1){if(!propel(n,-1,0,n.x-x1,dt)){n.x=x1;if(n.vx>0)n.vx*=-O.wall}}
      if(n.y<y0){if(!propel(n,0,1,y0-n.y,dt)){n.y=y0;if(n.vy<0)n.vy*=-O.wall}}
      else if(n.y>y1){if(!propel(n,0,-1,n.y-y1,dt)){n.y=y1;if(n.vy>0)n.vy*=-O.wall}}
    }
  }
}
function simList(list,C,dt){
  const O=opts,damp=Math.exp(-(.15+O.friction*2.6)*dt),dr=O.drift*(RM?.25:1),k=1-Math.exp(-dt*7);
  const cx=C?0:arena.cx,cy=C?0:arena.cy;
  /* inertie : quand la bulle parent accélère (glissée, secouée, rebondie), les sous-bulles prennent du retard et ballottent dedans */
  if(C){
    const dg=drag.active&&C===drag.node,vx=dg?C.dvx:C.vx,vy=dg?C.dvy:C.vy;
    if(C._pvx!==undefined&&O.slosh>0){
      const ax=clamp(vx-C._pvx,-500,500)*O.slosh,ay=clamp(vy-C._pvy,-500,500)*O.slosh;
      for(const q of list){q.vx-=ax;q.vy-=ay}
    }
    C._pvx=vx;C._pvy=vy;
  }
  for(const n of list){
    n.r+=(n.tr-n.r)*k;
    if(drag.active&&n===drag.node)continue;
    n.vx+=(Math.random()-.5)*dr*900*dt;n.vy+=(Math.random()-.5)*dr*900*dt;
    n.vx+=(cx-n.x)*O.pull*dt*1.2;n.vy+=(cy-n.y)*O.pull*dt*1.2;
    n.vx*=damp;n.vy*=damp;
    const sp=Math.hypot(n.vx,n.vy);if(sp>1600){n.vx*=1600/sp;n.vy*=1600/sp}
    n.x+=n.vx*dt;n.y+=n.vy*dt;
  }
  collide(list);walls(list,C,dt);
  for(const n of list)if(n.kids.length)simList(n.kids,n,dt);
}
const cam={z:1,ox:0,oy:0};let autoCam=true;
function update(dt){
  let need=0,maxR=0;
  for(const t of tops){calcT(t);need+=Math.PI*t.tr*t.tr*2.8;maxR=Math.max(maxR,t.tr)}
  const uh=Math.max(200,VH-TOPM-BOTM);
  /* zoom qui fait tenir toutes les bulles à l'écran */
  const zFit=clamp(Math.min(1,Math.sqrt(VW*uh/Math.max(1,need)),Math.min(VW,uh)/(2.3*Math.max(1,maxR))),.12,1);
  /* arène = fenêtre visible, au moins aussi grande que l'écran à zoom 1 ; elle suit la vue en douceur */
  const vcx=(VW/2-cam.ox)/cam.z,vcy=(TOPM+uh/2-cam.oy)/cam.z,ga=1-Math.exp(-dt*(autoCam?8:1.5));
  arena.cx+=(vcx-arena.cx)*ga;arena.cy+=(vcy-arena.cy)*ga;
  const sc=Math.min(1,cam.z);arena.hw=VW/sc/2;arena.hh=uh/sc/2;
  if(drag.active){
    const n=drag.node;const[ox,oy]=n.par?worldOf(n.par):[0,0];
    const tx=drag.px+drag.ox-ox,ty=drag.py+drag.oy-oy,e=1-Math.exp(-dt*30),px0=n.x,py0=n.y;
    n.x+=(tx-n.x)*e;n.y+=(ty-n.y)*e;n.vx=n.vy=0;n.dvx=(n.x-px0)/dt;n.dvy=(n.y-py0)/dt;
    drag.hist.push([T,n.x,n.y]);if(drag.hist.length>12)drag.hist.shift();
    drag.target=pick(drag.px,drag.py,n);updHint();
  }
  for(let s=0;s<2;s++)simList(tops,null,dt/2);
  if(autoCam){
    const f=1-Math.exp(-dt*4);
    cam.z+=(zFit-cam.z)*f;cam.ox+=(VW/2-cam.ox)*f;cam.oy+=(TOPM+uh/2-cam.oy)*f;
  }
}

/* ================= glisser-déposer ================= */
function beginDrag(n,wx,wy){
  const[nx,ny]=worldOf(n);Object.assign(drag,{active:true,node:n,ox:nx-wx,oy:ny-wy,px:wx,py:wy,origPar:n.par,target:n.par,hist:[]});
  cv.style.cursor='grabbing';hideTip();wrapPopHide();
}
function abortDrag(){if(drag.active){drag.node.dvx=drag.node.dvy=0;drag.active=false;drag.node=null;cv.style.cursor='';updHint()}}
function endDrag(){
  const n=drag.node,T0=drag.target,P=drag.origPar;drag.active=false;cv.style.cursor='';
  let vx=0,vy=0;const h=drag.hist;
  if(h.length>2){const last=h[h.length-1];let old=h[0];for(const s of h)if(last[0]-s[0]<=.09){old=s;break}
    const dt=last[0]-old[0];if(dt>.02){vx=(last[1]-old[1])/dt*opts.throwK;vy=(last[2]-old[2])/dt*opts.throwK}}
  const sp=Math.hypot(vx,vy);if(sp>1400){vx*=1400/sp;vy*=1400/sp}
  drag.node=null;n.dvx=n.dvy=0;
  if(!canWrite||T0===P){n.vx=vx;n.vy=vy;updHint();return}
  if(T0&&!isAnc(T0,n)){reparent(n,T0);n.vx=vx*.5;n.vy=vy*.5;toast('Rangé dans « '+short(T0.n)+' »')}
  else{reparent(n,T0);n.vx=vx*.5;n.vy=vy*.5;showWrapPop(n,P)}
  updPanelCrumb();updTarget();updHint();
}
const short=(s,m=22)=>{s=s||'…';return s.length>m?s.slice(0,m-1)+'…':s};
function updHint(){
  const h=$('#hint');let t,live=false;
  if(drag.active){
    live=true;const T0=drag.target,P=drag.origPar;
    if(!canWrite)t='Lecture seule : tu peux jouer avec les bulles, pas les ranger';
    else if(T0===P)t='Relâche pour laisser la bulle ici';
    else if(T0&&!isAnc(T0,drag.node))t='Relâche pour ranger dans « '+short(T0.n)+' »';
    else t='Relâche pour sortir de « '+short(P&&P.n)+' »';
  }else t='Glisse une bulle pour la ranger. Sors-la de sa bulle pour créer un groupe.';
  if(h.textContent!==t)h.textContent=t;h.classList.toggle('live',live);
}

/* ================= pointeur ================= */
const pts=new Map();let press=null,pan=null,pinch=null,lastTap={t:0,id:null,x:0,y:0};
const cvXY=e=>{const r=cv.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top]};
const toWorld=(x,y)=>[(x-cam.ox)/cam.z,(y-cam.oy)/cam.z];
const toScreen=(wx,wy)=>[wx*cam.z+cam.ox,wy*cam.z+cam.oy];
cv.addEventListener('pointerdown',e=>{
  if(e.pointerType==='mouse'&&e.button!==0)return;
  hideTip();const[x,y]=cvXY(e);pts.set(e.pointerId,{x,y});
  try{cv.setPointerCapture(e.pointerId)}catch(_){}
  if(pts.size===2){abortDrag();press=null;pan=null;startPinch();return}
  if(pts.size>2)return;
  wrapPopHide();cv.focus({preventScroll:true});
  const[wx,wy]=toWorld(x,y);press={id:e.pointerId,hit:pick(wx,wy,null),x,y,wx,wy,moved:false};
});
cv.addEventListener('pointermove',e=>{
  const[x,y]=cvXY(e);const p=pts.get(e.pointerId);if(p){p.x=x;p.y=y}
  if(pinch){updatePinch();return}
  if(press&&press.id===e.pointerId){
    if(!press.moved&&Math.hypot(x-press.x,y-press.y)>6){
      press.moved=true;
      if(press.hit)beginDrag(press.hit,press.wx,press.wy);else{pan={x:press.x,y:press.y,ox:cam.ox,oy:cam.oy};autoCam=false}
    }
    if(drag.active){const w=toWorld(x,y);drag.px=w[0];drag.py=w[1]}
    else if(pan){cam.ox=pan.ox+(x-pan.x);cam.oy=pan.oy+(y-pan.y)}
    return;
  }
  if(!press&&e.pointerType==='mouse')hoverAt(x,y);
});
function endPointer(e,cancel){
  pts.delete(e.pointerId);
  if(pinch){if(pts.size<2)pinch=null;return}
  if(!press||press.id!==e.pointerId)return;
  const pr=press;press=null;
  if(drag.active){cancel?abortDrag():endDrag();return}
  if(pan){pan=null;return}
  if(!pr.moved&&!cancel)onTap(pr);
}
cv.addEventListener('pointerup',e=>endPointer(e,false));
cv.addEventListener('pointercancel',e=>endPointer(e,true));
cv.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse'&&!press){hover=null;hideTip();cv.style.cursor=''}});
cv.addEventListener('contextmenu',e=>e.preventDefault());
cv.addEventListener('wheel',e=>{
  e.preventDefault();const[x,y]=cvXY(e),w=toWorld(x,y);
  const z=clamp(cam.z*Math.exp(-e.deltaY*(e.ctrlKey?.01:.0016)),.12,5);cam.z=z;cam.ox=x-w[0]*z;cam.oy=y-w[1]*z;autoCam=false;
},{passive:false});
function startPinch(){const[a,b]=[...pts.values()];autoCam=false;
  const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;pinch={d:Math.hypot(a.x-b.x,a.y-b.y)||1,z:cam.z,w:toWorld(mx,my)}}
function updatePinch(){const v=[...pts.values()];if(v.length<2)return;const[a,b]=v;
  const d=Math.hypot(a.x-b.x,a.y-b.y)||1,mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
  cam.z=clamp(pinch.z*d/pinch.d,.12,5);cam.ox=mx-pinch.w[0]*cam.z;cam.oy=my-pinch.w[1]*cam.z}
function zoomBy(f){const x=VW/2,y=VH/2,w=toWorld(x,y),z=clamp(cam.z*f,.12,5);cam.z=z;cam.ox=x-w[0]*z;cam.oy=y-w[1]*z;autoCam=false}
$('#zIn').onclick=()=>zoomBy(1.3);$('#zOut').onclick=()=>zoomBy(1/1.3);$('#zFit').onclick=()=>{autoCam=true};
function onTap(pr){
  const hit=pr.hit,now=performance.now();
  const dbl=now-lastTap.t<340&&lastTap.id===(hit?hit.id:null)&&Math.hypot(pr.x-lastTap.x,pr.y-lastTap.y)<30;
  lastTap={t:now,id:hit?hit.id:null,x:pr.x,y:pr.y};
  if(hit){
    select(hit);
    if(dbl&&canWrite){
      if(hit.kids.length){
        const nn=addNode('Nouvelle bulle',hit);const[hx,hy]=worldOf(hit);nn.x=pr.wx-hx;nn.y=pr.wy-hy;nn._placed=true;select(nn)
      }
      focusName();
    }
  }else{
    if(dbl&&canWrite){const nn=addNode('Nouvelle bulle',null);nn.x=pr.wx;nn.y=pr.wy;nn._placed=true;select(nn);focusName()}
    else select(null);
  }
}
function focusName(){const i=$('#pn');setTimeout(()=>{i.focus();i.select()},30)}
function hoverAt(x,y){
  const[wx,wy]=toWorld(x,y);hover=pick(wx,wy,null);cv.style.cursor=hover?'grab':'';
  const tip=$('#tip');
  if(hover&&(hover.c||hover.n.length>22)){
    tip.hidden=false;tip.innerHTML='';const b=document.createElement('b');b.textContent=hover.n||'…';tip.append(b);
    if(hover.c){const s=document.createElement('span');s.textContent=hover.c.length>220?hover.c.slice(0,219)+'…':hover.c;tip.append(s)}
    tip.style.left=Math.min(x+16,VW-tip.offsetWidth-8)+'px';tip.style.top=Math.min(y+18,VH-tip.offsetHeight-8)+'px';
  }else tip.hidden=true;
}
function hideTip(){$('#tip').hidden=true}

/* ================= interface ================= */
const el={panel:$('#panel'),pn:$('#pn'),pc:$('#pc'),crumb:$('#crumb'),sw:$('#sw'),wrapRow:$('#wrapRow'),delRow:$('#delRow'),drawer:$('#drawer'),target:$('#target'),add:$('#add')};
let toastT=0;
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('on'),2600)}
function updEmpty(){$('#empty').hidden=!(loaded&&nodes.size===0)}
function select(n){sel=n;hideDelRow();el.wrapRow.hidden=true;if(n){closeDrawer();closePlan()}wrapPopHide();updatePanel();updTarget()}
function crumbOf(n){const a=[];for(let c=n;c;c=c.par)a.unshift(c.n||'…');return a.join('  ›  ')}
function updPanelCrumb(){if(sel)el.crumb.textContent=crumbOf(sel)}
function updatePanel(){
  if(!sel||!nodes.has(sel.id)){sel=null;el.panel.hidden=true;return}
  el.panel.hidden=false;updPanelCrumb();
  if(document.activeElement!==el.pn)el.pn.value=sel.n;
  if(document.activeElement!==el.pc)el.pc.value=sel.c;
  for(const b of el.sw.children)b.setAttribute('aria-pressed',String((b.dataset.h===''&&sel.h==null)||(b.dataset.h!==''&&Number(b.dataset.h)===sel.h)));
  const ro=!canWrite;el.pn.readOnly=ro;el.pc.readOnly=ro;
  for(const id of['aKid','aWrap','aOut','aDel'])$('#'+id).disabled=ro;
  $('#aOut').disabled=ro||!sel.par;
}
function applyWriteState(){updatePanel();el.add.disabled=!canWrite;$('#adder button.primary').disabled=!canWrite;el.add.placeholder=canWrite?'Nouvelle note…':'Lecture seule'}
function updTarget(){
  const t=sel||tops[0]||null;
  el.target.innerHTML='dans <b></b>';el.target.querySelector('b').textContent=t?'« '+short(t.n,16)+' »':'la souche';
  el.target.title=sel?'Cliquer pour revenir à la bulle souche':'Sélectionne une bulle pour y ajouter';
}
el.target.onclick=()=>{if(sel)select(null)};
$('#adder').addEventListener('submit',e=>{
  e.preventDefault();if(!canWrite)return;const v=el.add.value.trim().slice(0,120);if(!v)return;
  let t=sel||tops[0]||null;if(!t)t=addNode('Souche',null);
  addNode(v,t);el.add.value='';updTarget();
});
el.pn.addEventListener('input',()=>{if(!sel||!canWrite)return;sel.n=el.pn.value.slice(0,120);sel._wk='';updPanelCrumb();updTarget();markDirty(sel.id)});
el.pc.addEventListener('input',()=>{if(!sel||!canWrite)return;sel.c=el.pc.value.slice(0,2000);markDirty(sel.id)});
el.pn.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();el.pn.blur()}});
$('#pClose').onclick=()=>select(null);
$('#aKid').onclick=()=>{if(!sel)return;const k=addNode('Nouvelle bulle',sel);select(k);focusName()};
$('#aOut').onclick=()=>{if(sel&&sel.par){moveOut(sel);updPanelCrumb();updTarget();toast('Bulle sortie')}};
$('#aWrap').onclick=()=>{hideDelRow();el.wrapRow.hidden=!el.wrapRow.hidden;if(!el.wrapRow.hidden){$('#wn').value='';$('#wn').focus()}};
el.wrapRow.addEventListener('submit',e=>{
  e.preventDefault();const v=$('#wn').value.trim();if(!v||!sel)return;
  const g=wrapNode(sel,v.slice(0,120));el.wrapRow.hidden=true;toast('Groupe « '+short(v)+' » créé');select(g);
});
function hideDelRow(){el.delRow.hidden=true}
$('#aDel').onclick=()=>{
  if(!sel)return;el.wrapRow.hidden=true;const n=sel,box=$('#delBtns');box.innerHTML='';
  const cnt=subtree(n).length-1;
  $('#delTxt').textContent=cnt?'Supprimer « '+short(n.n)+' » qui contient '+cnt+(cnt>1?' bulles ?':' bulle ?'):'Supprimer « '+short(n.n)+' » ?';
  const mkb=(t,cls,f)=>{const b=document.createElement('button');b.type='button';b.className='btn '+cls;b.textContent=t;b.onclick=f;box.append(b)};
  if(cnt){mkb('Tout supprimer','danger',()=>deleteNode(n,false));mkb('Garder le contenu','',()=>deleteNode(n,true))}
  else mkb('Supprimer','danger',()=>deleteNode(n,false));
  mkb('Annuler','',hideDelRow);el.delRow.hidden=false;
};
/* fenêtre « Regrouper ? » après une sortie */
let wrapFor=null;
function showWrapPop(n,from){
  wrapFor=n;const p=$('#wrapPop');$('#wpTxt').textContent='« '+short(n.n)+' » est sorti de « '+short(from&&from.n)+' ». Le regrouper dans une nouvelle bulle ?';
  $('#wp').value='';p.hidden=false;
  const[wx,wy]=worldOf(n),[sx,sy]=toScreen(wx,wy),sr=n.r*cam.z;
  if(VW<=760){p.style.left='';p.style.top=''}   /* petit écran : la fenêtre se cale au-dessus de la barre de saisie (voir le CSS) */
  else{let x=clamp(sx-145,8,VW-298),y=sy+sr+12;if(y+p.offsetHeight>VH-BOTM+10)y=Math.max(TOPM,sy-sr-12-p.offsetHeight);
    p.style.left=x+'px';p.style.top=y+'px'}setTimeout(()=>$('#wp').focus({preventScroll:true}),30);
}
function wrapPopHide(){wrapFor=null;$('#wrapPop').hidden=true}
$('#wrapPop').addEventListener('submit',e=>{
  e.preventDefault();const v=$('#wp').value.trim();const n=wrapFor;if(!v||!n||!nodes.has(n.id))return;
  wrapNode(n,v.slice(0,120));wrapPopHide();toast('Groupe « '+short(v)+' » créé');updTarget();
});
$('#wpNo').onclick=wrapPopHide;
/* couleurs de contour par bulle */
(()=>{
  const mkS=(h)=>{const b=document.createElement('button');b.type='button';b.dataset.h=h===null?'':String(h);
    b.setAttribute('aria-label',h===null?'Contour arc-en-ciel':'Contour teinte '+h);
    b.style.background=h===null?'conic-gradient(hsl(0 60% 66%),hsl(60 60% 66%),hsl(120 60% 66%),hsl(180 60% 66%),hsl(240 60% 66%),hsl(300 60% 66%),hsl(360 60% 66%))':`hsl(${h} 58% 64%)`;
    b.onclick=()=>{if(!sel||!canWrite)return;sel.h=h;markDirty(sel.id);updatePanel()};el.sw.append(b)};
  mkS(null);[0,30,55,130,175,215,265,320].forEach(mkS);
})();
/* réglages */
function buildDrawer(){
  const box=$('#opts');
  for(const s of SCHEMA){
    const sec=document.createElement('div');sec.className='sec';const l=document.createElement('span');l.className='lbl';l.textContent=s.sec;sec.append(l);
    for(const it of s.items){
      const w=document.createElement('div');w.className='opt'+(it.t==='color'||it.t==='check'?' color':'');
      const id='o_'+it.k;const lab=document.createElement('label');lab.htmlFor=id;
      const top=document.createElement('div');top.className='top';const sp=document.createElement('span');sp.textContent=it.l;top.append(sp);
      let inp;
      if(it.t==='select'){inp=document.createElement('select');for(const[v,t]of it.o){const o=document.createElement('option');o.value=v;o.textContent=t;inp.append(o)}}
      else{inp=document.createElement('input');inp.type=it.t;if(it.t==='range'){inp.min=it.min;inp.max=it.max;inp.step=it.step;const out=document.createElement('output');out.id=id+'_v';top.append(out)}}
      inp.id=id;inp.dataset.k=it.k;
      inp.addEventListener('input',()=>{const v=it.t==='range'?Number(inp.value):it.t==='check'?inp.checked:inp.value;applyOpts({[it.k]:v},false)});
      lab.append(top);w.append(lab,inp);
      sec.append(w);
    }
    box.append(sec);
  }
  const pr=$('#presets');
  for(const[name,p]of PRESETS){const b=document.createElement('button');b.type='button';b.className='btn';b.textContent=name;b.onclick=()=>applyOpts(p,false);pr.append(b)}
}
function syncDrawer(){
  for(const s of SCHEMA)for(const it of s.items){
    const inp=$('#o_'+it.k);if(!inp)continue;
    if(it.t==='check')inp.checked=!!opts[it.k];else if(document.activeElement!==inp)inp.value=opts[it.k];
    const out=$('#o_'+it.k+'_v');if(out)out.textContent=(Math.round(opts[it.k]*100)/100)+(it.u||'');
  }
}
function updSyncNote(){
  const n=$('#syncNote');if(!n)return;
  n.textContent=mode==='db'?'Tes bulles, leur rangement, les commentaires et les réglages se synchronisent en direct. Ouvre ce même lien sur ton téléphone, avec le même compte Claude. La position des bulles à l\'écran reste propre à chaque appareil.'
   :'La synchronisation n\'est pas disponible ici : les bulles restent enregistrées sur cet appareil.';
}
function openDrawer(){select(null);closePlan();el.drawer.hidden=false;$('#optBtn').setAttribute('aria-expanded','true');syncDrawer()}
function closeDrawer(){el.drawer.hidden=true;$('#optBtn').setAttribute('aria-expanded','false')}
$('#optBtn').onclick=()=>el.drawer.hidden?openDrawer():closeDrawer();
$('#dClose').onclick=closeDrawer;
$('#resetOpts').onclick=()=>applyOpts(DEF,false);
/* enregistrer un fichier : capacité « downloads » dans Claude, lien de téléchargement classique sinon (GitHub Pages, etc.) */
async function saveFile(filename,data,mime){
  if(dlCap){
    try{await dlCap.save({filename,data});return true}
    catch(err){if(err&&err.code==='declined')return false;throw err}
  }
  const url=URL.createObjectURL(new Blob([data],{type:mime||'text/plain'}));
  const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),4000);return true;
}
$('#exBtn').onclick=async()=>{
  const data=JSON.stringify({app:'bulles-d-idees',v:1,exportedAt:new Date().toISOString(),nodes:[...nodes.values()].map(n=>({id:n.id,...docOf(n)}))},null,1);
  try{if(await saveFile('bulles-'+new Date().toISOString().slice(0,10)+'.json',data,'application/json'))toast('Sauvegarde prête')}
  catch(err){toast('Sauvegarde impossible ici')}
};
/* plan en texte */
function planText(){
  const fmt=$('#plFmt').value,com=$('#plCom').checked;
  const cm=n=>n.c.replace(/\s+/g,' ').trim(),nm=n=>n.n||'(sans nom)';
  if(!tops.length)return'(aucune bulle)';
  const out=[];
  if(fmt==='md'){
    const rec=(n,d)=>{const p='  '.repeat(d);out.push(p+'- '+nm(n));if(com&&n.c)out.push(p+'  > '+cm(n));for(const k of n.kids)rec(k,d+1)};
    for(const t of tops)rec(t,0);
  }else{
    const rec=(n,pre,last,root)=>{
      out.push(root?nm(n):pre+(last?'└─ ':'├─ ')+nm(n));
      const base=root?'':pre+(last?'   ':'│  ');
      if(com&&n.c)out.push(base+(n.kids.length?'│  ':'   ')+'↳ '+cm(n));
      n.kids.forEach((k,i)=>rec(k,base,i===n.kids.length-1,false));
    };
    tops.forEach((t,i)=>{if(i)out.push('');rec(t,'',true,true)});
  }
  return out.join('\n');
}
let planOn=false,planLast='';
function updPlan(){if(!planOn)return;const t=planText();if(t!==planLast){planLast=t;$('#plTxt').textContent=t}}
function openPlan(){select(null);closeDrawer();planOn=true;$('#plan').hidden=false;$('#planBtn').setAttribute('aria-expanded','true');planLast='';updPlan()}
function closePlan(){planOn=false;$('#plan').hidden=true;$('#planBtn').setAttribute('aria-expanded','false')}
$('#planBtn').onclick=()=>planOn?closePlan():openPlan();
$('#plClose').onclick=closePlan;
$('#plFmt').onchange=$('#plCom').onchange=()=>{planLast='';updPlan()};
setInterval(updPlan,700);
$('#plCopy').onclick=async()=>{
  const t=planText();
  try{await navigator.clipboard.writeText(t);toast('Plan copié')}
  catch(e){const r=document.createRange();r.selectNodeContents($('#plTxt'));const s=getSelection();s.removeAllRanges();s.addRange(r);toast('Plan sélectionné : copie-le avec Ctrl+C')}
};
$('#plSave').onclick=async()=>{
  const md=$('#plFmt').value==='md';
  try{if(await saveFile('plan-bulles'+(md?'.md':'.txt'),planText(),'text/plain'))toast('Plan enregistré')}catch(e){toast('Enregistrement impossible ici')}
};
/* clavier mobile : l'interface se cale sur la zone réellement visible */
(()=>{
  const vv=window.visualViewport,ui=$('#ui');if(!vv)return;
  const fit=()=>{const top=Math.max(0,vv.offsetTop),bot=Math.max(0,window.innerHeight-vv.height-vv.offsetTop);
    ui.style.top=top+'px';ui.style.bottom=bot+'px'};
  vv.addEventListener('resize',fit);vv.addEventListener('scroll',fit);fit();
  document.addEventListener('focusin',e=>{
    if(e.target.matches('input,textarea,select')&&e.target.closest('.sheet,#wrapPop'))
      setTimeout(()=>{try{e.target.scrollIntoView({block:'nearest',behavior:'smooth'})}catch(_){}},280);
  });
})();
$('#imBtn').onclick=()=>{if(canWrite)$('#imFile').click();else toast('Lecture seule')};
$('#imFile').addEventListener('change',async e=>{
  const f=e.target.files&&e.target.files[0];e.target.value='';if(!f)return;
  try{
    const j=JSON.parse(await f.text());const arr=Array.isArray(j)?j:j.nodes;if(!Array.isArray(arr))throw 0;let c=0;
    for(const d of arr.slice(0,3000)){
      if(!d||typeof d.id!=='string'||!/^[A-Za-z0-9_-]{1,60}$/.test(d.id))continue;
      const f2={n:str(d.n,120),c:str(d.c,2000),p:typeof d.p==='string'&&/^[A-Za-z0-9_-]{1,60}$/.test(d.p)?d.p:null,h:Number.isFinite(d.h)?d.h:null,o:Number.isFinite(d.o)?d.o:Date.now()+c};
      let n=nodes.get(d.id);if(n)Object.assign(n,f);else{n=mk({id:d.id,...f});nodes.set(d.id,n)}markDirty(d.id);c++;
    }
    rebuild();updatePanel();updTarget();updEmpty();toast(c+' bulles importées');
  }catch(err){toast('Fichier non reconnu')}
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){wrapPopHide();closeDrawer();closePlan();if(!el.delRow.hidden)hideDelRow();else if(document.activeElement&&/INPUT|TEXTAREA/.test(document.activeElement.tagName))document.activeElement.blur();else select(null)}
  else if((e.key==='Delete')&&sel&&canWrite&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))$('#aDel').click();
});

/* ================= rendu ================= */
let stars=[],shoot=null,nextShoot=6;
function mkStars(){
  const N=Math.min(650,Math.round(VW*VH/4200*opts.starDensity));stars=[];
  for(let i=0;i<N;i++){const l=Math.random();stars.push({x:Math.random(),y:Math.random(),r:rnd(.35,1.25)*(l>.92?1.5:1),a:rnd(.25,.95),tw:rnd(.6,2.2),ph:rnd(0,TAU),l:.3+l*1.4,v:rnd(.4,1.6)})}
}
function drawStars(){
  const O=opts;ctx.fillStyle=O.star;
  const tw=RM?0:O.twinkle;
  for(const s of stars){
    let x=(s.x*VW+cam.ox*.03*s.l*O.parallax+(cam.z-1)*0)%VW,y=(s.y*VH+cam.oy*.03*s.l*O.parallax-(RM?0:T*s.v))%VH;
    if(x<0)x+=VW;if(y<0)y+=VH;
    const z=1+(cam.z-1)*.12*s.l*O.parallax;
    ctx.globalAlpha=clamp(s.a*(1-.4*tw+.4*tw*Math.sin(T*s.tw+s.ph)),0,1);
    if(s.r>1){ctx.beginPath();ctx.arc(x,y,s.r*z,0,TAU);ctx.fill()}else ctx.fillRect(x,y,s.r*2*z,s.r*2*z);
  }
  ctx.globalAlpha=1;
  if(!RM&&tw>0){
    if(!shoot&&T>nextShoot){shoot={x:rnd(.1,.9)*VW,y:rnd(0,.4)*VH,t:T,a:rnd(.4,.9)};nextShoot=T+rnd(9,20)}
    if(shoot){const u=(T-shoot.t)/1.1;if(u>1)shoot=null;else{
      const x=shoot.x+u*220,y=shoot.y+u*110,g=ctx.createLinearGradient(x,y,x-90,y-45);
      g.addColorStop(0,`rgba(255,255,255,${.8*(1-u)})`);g.addColorStop(1,'rgba(255,255,255,0)');
      ctx.strokeStyle=g;ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-90,y-45);ctx.stroke()}}
  }
}
function rimStyle(n,cx,cy,r){
  const O=opts;let stops;
  if(n.h!=null)stops=[[0,n.h-16],[.5,n.h+16],[1,n.h-16]];
  else if(O.rim==='solid')stops=[[0,O.rimHue],[1,O.rimHue]];
  else if(O.rim==='rainbow')stops=[0,1,2,3,4,5,6].map(i=>[i/6,n.hue0+i*60]);
  else return'rgba(255,255,255,.16)';
  const ang=RM?0:T*O.rimSpeed*.35+n.phase;
  const g=ctx.createConicGradient?ctx.createConicGradient(ang,cx,cy):ctx.createLinearGradient(cx-r,cy-r,cx+r,cy+r);
  for(const[p,h]of stops)g.addColorStop(p,`hsla(${((h%360)+360)%360},${O.rimSat}%,${O.rimLight}%,.92)`);
  return g;
}
function rr(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
function wrapLines(n,fs,maxW,maxL){
  const key=n.n+'|'+Math.round(fs*2)+'|'+Math.round(maxW)+'|'+fontEpoch+'|'+maxL;if(n._wk===key)return n._wl;
  ctx.font=`500 ${fs}px ${FONT}`;const words=n.n.split(/\s+/).filter(Boolean);let lines=[],cur='';
  const push=w=>{if(ctx.measureText(w).width<=maxW){lines.push(w);return}let s='';for(const ch of w){if(ctx.measureText(s+ch).width>maxW&&s){lines.push(s);s=ch}else s+=ch}if(s)lines.push(s)};
  for(const w of words){const t=cur?cur+' '+w:w;if(!cur||ctx.measureText(t).width<=maxW)cur=t;else{push(cur);cur=w}}
  if(cur)push(cur);
  if(lines.length>maxL){lines=lines.slice(0,maxL);let l=lines[maxL-1];while(l.length>1&&ctx.measureText(l+'…').width>maxW)l=l.slice(0,-1);lines[maxL-1]=l+'…'}
  n._wk=key;n._wl=lines;return lines;
}
let bubRGB=[14,16,24],txtRGB=[231,234,245];
function drawNode(n,ox,oy,depth,lifted){
  const O=opts,cx=ox+n.x,cy=oy+n.y,r=Math.max(1,n.r*(RM?1:1+.006*Math.sin(T*1.4+n.phase))),sr=r*cam.z;
  const sx=cx*cam.z+cam.ox,sy=cy*cam.z+cam.oy;
  if(sx+sr<0||sy+sr<0||sx-sr>VW||sy-sr>VH)return;
  const L=depth*.014,g=ctx.createRadialGradient(cx-r*.25,cy-r*.35,r*.05,cx,cy,r);
  g.addColorStop(0,lift(bubRGB,L+.06));g.addColorStop(1,lift(bubRGB,L));
  ctx.beginPath();ctx.arc(cx,cy,r,0,TAU);
  if(lifted){ctx.shadowColor='rgba(0,0,0,.7)';ctx.shadowBlur=26}
  ctx.fillStyle=g;ctx.fill();ctx.shadowBlur=0;
  const rs=rimStyle(n,cx,cy,r);ctx.strokeStyle=rs;
  ctx.globalAlpha=.1+(hover===n||lifted?.14:0);ctx.lineWidth=O.rimWidth*3.4;ctx.stroke();
  ctx.globalAlpha=1;ctx.lineWidth=O.rimWidth+(hover===n?.6:0);ctx.stroke();
  if(n===sel){ctx.save();ctx.setLineDash([7,7]);ctx.lineDashOffset=-T*14;ctx.strokeStyle='rgba(255,255,255,.6)';ctx.lineWidth=1.4;
    ctx.beginPath();ctx.arc(cx,cy,r+6,0,TAU);ctx.stroke();ctx.restore()}
  for(const k of n.kids){if(drag.active&&k===drag.node)continue;drawNode(k,cx,cy,depth+1,false)}
  const fs0=O.fontScale;
  if(!n.kids.length){
    if(sr>12){
      const fs=clamp(r*.34,11,20)*fs0,maxL=Math.max(1,Math.floor(r*1.45/(fs*1.2)));
      const name=n.n||'…';const lines=n.n?wrapLines(n,fs,r*1.55,maxL):['…'];
      ctx.font=`500 ${fs}px ${FONT}`;ctx.fillStyle=n.n?O.text:'rgba(255,255,255,.4)';ctx.textAlign='center';ctx.textBaseline='middle';
      const lh=fs*1.2,y0=cy-(lines.length-1)*lh/2;lines.forEach((l,i)=>ctx.fillText(l,cx,y0+i*lh));
    }
  }else if(sr>16){
    const fs=13*fs0;ctx.font=`600 ${fs}px ${FONT}`;const name=n.n||'…',cnt=' · '+n.kids.length;
    const w1=ctx.measureText(name).width,w2=ctx.measureText(cnt).width,pw=Math.min(w1+w2+22,r*1.7),ph=fs+12,px=cx-pw/2,py=cy-r-ph/2;
    rr(px,py,pw,ph,ph/2);ctx.fillStyle='rgba(5,6,10,.94)';ctx.fill();ctx.strokeStyle=rs;ctx.globalAlpha=.7;ctx.lineWidth=1.2;ctx.stroke();ctx.globalAlpha=1;
    ctx.save();rr(px,py,pw,ph,ph/2);ctx.clip();ctx.textAlign='left';ctx.textBaseline='middle';
    let tx=cx-(Math.min(w1+w2,pw-22))/2;ctx.fillStyle=O.text;ctx.fillText(name,tx,py+ph/2+.5);ctx.fillStyle='#8b92aa';ctx.fillText(cnt,tx+w1,py+ph/2+.5);ctx.restore();
  }
  if(n.c&&sr>14){
    const gx=cx+r*.74,gy=cy+r*.74;rr(gx-7,gy-6,14,11,3);ctx.fillStyle='rgba(5,6,10,.95)';ctx.fill();ctx.strokeStyle='rgba(255,255,255,.4)';ctx.lineWidth=1;ctx.stroke();
    ctx.beginPath();ctx.moveTo(gx-4,gy-2.5);ctx.lineTo(gx+4,gy-2.5);ctx.moveTo(gx-4,gy+.5);ctx.lineTo(gx+2,gy+.5);ctx.strokeStyle='rgba(255,255,255,.55)';ctx.stroke();
  }
}
function render(){
  ctx.setTransform(DPR,0,0,DPR,0,0);ctx.globalAlpha=1;
  const bg=hex2rgb(opts.bg);bubRGB=hex2rgb(opts.bubble);
  const vg=ctx.createRadialGradient(VW/2,VH*.45,10,VW/2,VH*.45,Math.max(VW,VH)*.75);
  vg.addColorStop(0,lift(bg,.035));vg.addColorStop(1,`rgb(${bg.join(',')})`);ctx.fillStyle=vg;ctx.fillRect(0,0,VW,VH);
  drawStars();
  ctx.save();ctx.translate(cam.ox,cam.oy);ctx.scale(cam.z,cam.z);
  for(const t of tops){if(drag.active&&t===drag.node)continue;drawNode(t,0,0,0,false)}
  if(drag.active){
    const tg=drag.target;
    if(tg&&tg!==drag.origPar){const[wx,wy]=worldOf(tg);ctx.beginPath();ctx.arc(wx,wy,tg.r+7,0,TAU);ctx.fillStyle='rgba(169,184,255,.07)';ctx.fill();
      ctx.strokeStyle='rgba(169,184,255,.85)';ctx.lineWidth=2;ctx.setLineDash([3,6]);ctx.lineCap='round';ctx.stroke();ctx.setLineDash([]);ctx.lineCap='butt'}
    const n=drag.node,[px,py]=n.par?worldOf(n.par):[0,0];drawNode(n,px,py,depthOf(n),true);
  }
  ctx.restore();
}
let last=0;
function frame(ts){
  requestAnimationFrame(frame);const dt=Math.min(.033,(ts-last)/1000||.016);last=ts;T=ts/1000;
  update(dt);render();
}
function resize(){
  DPR=Math.min(2,window.devicePixelRatio||1);VW=cv.clientWidth||800;VH=cv.clientHeight||600;
  cv.width=Math.round(VW*DPR);cv.height=Math.round(VH*DPR);mkStars();
}
new ResizeObserver(resize).observe(cv);

/* ================= démarrage ================= */
buildDrawer();applyOpts({},true);resize();
arena.hw=VW/2;arena.hh=Math.max(200,VH-TOPM-BOTM)/2;cam.z=1;cam.ox=VW/2;cam.oy=TOPM+arena.hh;
updHint();updTarget();updSyncNote();syncDrawer();
try{document.fonts.load('500 16px "Bricolage Grotesque"').then(()=>document.fonts.load('600 13px "Bricolage Grotesque"')).then(()=>{fontEpoch++})}catch(e){}
requestAnimationFrame(frame);
initSync();
})();
