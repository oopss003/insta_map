import { language } from './i18n.js';
export function initStory(){
const canvas=document.querySelector('#portrait'),ctx=canvas.getContext('2d',{alpha:false});
const hero=document.querySelector('#hero'),dot=document.querySelector('#dot'),status=document.querySelector('#frame-status'),time=document.querySelector('#frame-time');
// The HTML poster remains visible until a decoded frame has actually been painted.
ctx.fillStyle='#faf5e9';ctx.fillRect(0,0,512,512);
let frames=[],index=0,goal=0,tx=0,ty=0,seconds=0,previous=0,ready=false,visible=true,departed=false,lastDraw=-1,sx=0,sy=0;

const text={ko:{done:'광고를 바라본 시간을 확인하세요.',front:'지금, 광고를 시청하고 있습니다.',away:'시선이 벗어나면 시간이 멈춥니다.',title:'시선이 머무는 순간,<br>데이터가 시작됩니다.',intro:'얼굴 중앙을 기준으로 마우스를 움직여 보세요.',label:'누적 시청 시간',unit:'초',note:'캐릭터 영상의 방향을 활용한 시연 · 실제 시청자 분석이 아닙니다.'},en:{done:'See how long the ad held attention.',front:'The ad is being watched now.',away:'Viewing time pauses when attention moves away.',title:'When attention stays,<br>data begins.',intro:'Move your pointer around the center of her face.',label:'Total viewing time',unit:'s',note:'Character animation demo · Not actual audience analysis.'}};
let copy=text[language]||text.ko;
function render(){copy=text[language]||text.ko;hero.querySelector('h1').innerHTML=copy.title;hero.querySelector('.intro').textContent=copy.intro;hero.querySelector('.note').textContent=copy.note;const label=time.parentElement;label.firstChild.textContent=copy.label;label.lastChild.textContent=' '+copy.unit;}
render();
// Decode each distinct pose once; never evict it during interaction.
const cache=new Map();
const bitmapSize=384;
async function prepare(i){
 const response=await fetch(frames[i].src);if(!response.ok)throw Error('Frame '+i);
 const bitmap=await createImageBitmap(await response.blob(),{resizeWidth:bitmapSize,resizeHeight:bitmapSize,resizeQuality:'high'});
 cache.set(i,bitmap);
}
function choose(){
 let best=index,distance=Infinity;
 for(const i of cache.keys()){
  const p=frames[i];
  const d=(p.x-sx)**2+(p.y-sy)**2+(i===index?0:.0003);
  if(d<distance){distance=d;best=i;}
 }
 goal=best;
}
// Neutral face center in the source image; keep the origin stable while the head turns.
// Account for object-fit:contain letterboxing and the responsive canvas position.
function faceOrigin(){
 const r=canvas.getBoundingClientRect(),size=Math.min(r.width,r.height),h=hero.getBoundingClientRect();
 const y=r.top+(r.height-size)/2+size*(180/512);
 return {x:r.left+r.width/2,y,radius:size*.65,
 up:Math.max(40,Math.min(size*.45,(y-Math.max(h.top,0))*.85)),
 down:Math.max(40,Math.min(size*.45,(Math.min(h.bottom,innerHeight)-y)*.85))};
}
function pointer(e){const o=faceOrigin(),dy=e.clientY-o.y;
 tx=Math.max(-1,Math.min(1,(e.clientX-o.x)/o.radius));
 ty=Math.max(-1,Math.min(1,dy/(dy<0?o.up:o.down)));departed=scrollY>20;
}
hero.addEventListener('pointermove',pointer,{passive:true});hero.addEventListener('pointerdown',pointer,{passive:true});hero.addEventListener('pointerleave',()=>{tx=ty=0;});hero.addEventListener('wheel',e=>{if(e.deltaY>0)departed=true},{passive:true});window.addEventListener('scroll',()=>{departed=scrollY>20},{passive:true});document.addEventListener('visibilitychange',()=>previous=0);new IntersectionObserver(([e])=>{visible=e.intersectionRatio>.55;previous=0},{threshold:[0,.55,1]}).observe(hero);
function draw(i){const b=cache.get(i);if(!b)return false;ctx.drawImage(b,0,0,512,512);index=i;lastDraw=i;hero.classList.add('frame-ready');const p=frames[i];dot.setAttribute('cx',120+p.x*85);dot.setAttribute('cy',120+p.y*85);hero.dataset.frame=i;hero.dataset.pose=p.x.toFixed(2)+','+p.y.toFixed(2);return true;}
function syncData(){const values={'your-time':seconds.toFixed(1)+(language==='ko'?'초':' SEC'),'your-seconds':seconds.toFixed(1),'your-age':language==='ko'?'예시 · 30대':'Example · 30s','your-gender':language==='ko'?'예시 · 여성':'Example · female'};for(const [id,value] of Object.entries(values)){const el=document.getElementById(id);if(el)el.textContent=value;}}
function tick(now){requestAnimationFrame(tick);if(!ready||document.hidden||!visible){previous=0;return}const dt=previous?Math.min((now-previous)/1000,.05):0;previous=now;
 const ease=1-Math.exp(-dt*24);sx+=(tx-sx)*ease;sy+=(ty-sy)*ease;choose();
 // Orientation changes are smoothed; decoded nearest poses replace source-timeline playback.
 const next=goal;if(next!==lastDraw){draw(next);}
 const p=frames[index],front=Math.hypot(p.x,p.y)<.16,viewing=front&&!departed;if(viewing)seconds+=dt;if(time.textContent!==seconds.toFixed(1)){time.textContent=seconds.toFixed(1);syncData();}status.textContent=departed?copy.done:front?copy.front:copy.away;document.querySelector('#zone').setAttribute('fill',viewing?'#cdebd9':'#e4d9f3');}
async function load(){try{
 const r=await fetch(new URL('./assets/simple-head/poses.json',import.meta.url));if(!r.ok)throw Error('poses');
 const unique=new Map();for(const p of await r.json()){const key=p.x+','+p.y;if(p.eligible!==false&&!unique.has(key))unique.set(key,p);}
 frames=[...unique.values()].map(p=>({...p,src:new URL('./assets/simple-head/'+p.src,import.meta.url).href}));
 await prepare(0);draw(0);hero.dataset.frameCount=frames.length;
 // Prioritize the full direction range while preparing the resident set.
 const seeds=new Set([0]);
 for(let y=-1;y<=1;y+=.5)for(let x=-1;x<=1;x+=.5){let best=0,d=Infinity;frames.forEach((p,i)=>{const n=(p.x-x)**2+(p.y-y)**2;if(n<d){d=n;best=i;}});seeds.add(best);}
 const order=[...seeds,...frames.map((_,i)=>i).filter(i=>!seeds.has(i))].filter(i=>i!==0);
 let cursor=0,failed=0;
 await Promise.all(Array.from({length:4},async()=>{while(cursor<order.length){const i=order[cursor++];try{await prepare(i)}catch{failed++;}hero.dataset.loadedFrames=cache.size;}}));
 // Keep the poster/neutral pose stable until the entire available set is decoded.
 ready=true;hero.dataset.loadState=failed?'partial':'ready';requestAnimationFrame(tick);
}catch(e){status.textContent=language==='ko'?'캐릭터를 불러오지 못했습니다. 새로고침해 주세요.':'Unable to load animation. Please reload.'}}
load();return {render};
}

