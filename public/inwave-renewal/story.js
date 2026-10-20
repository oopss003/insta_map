import { language } from './i18n.js';
export function initStory(){
const canvas=document.querySelector('#portrait'),ctx=canvas.getContext('2d',{alpha:false});
const hero=document.querySelector('#hero'),dot=document.querySelector('#dot'),status=document.querySelector('#frame-status'),time=document.querySelector('#frame-time');
const poster=new Image();poster.src=new URL('./assets/look-loop/poster.png',import.meta.url).href;poster.onload=()=>ctx.drawImage(poster,0,0,512,512);
let frames=[],index=0,goal=0,progress=0,tx=0,ty=0,seconds=0,previous=0,ready=false,busy=false,visible=true,departed=false,lastDraw=-1;

const text={ko:{done:'광고를 바라본 시간을 확인하세요.',front:'지금, 광고를 시청하고 있습니다.',away:'시선이 벗어나면 시간이 멈춥니다.',title:'시선이 머무는 순간,<br>데이터가 시작됩니다.',intro:'얼굴 중앙을 기준으로 마우스를 움직여 보세요.',label:'누적 시청 시간',unit:'초',note:'캐릭터 영상의 방향을 활용한 시연 · 실제 시청자 분석이 아닙니다.'},en:{done:'See how long the ad held attention.',front:'The ad is being watched now.',away:'Viewing time pauses when attention moves away.',title:'When attention stays,<br>data begins.',intro:'Move your pointer around the center of her face.',label:'Total viewing time',unit:'s',note:'Character animation demo · Not actual audience analysis.'}};
let copy=text[language]||text.ko;
function render(){copy=text[language]||text.ko;hero.querySelector('h1').innerHTML=copy.title;hero.querySelector('.intro').textContent=copy.intro;hero.querySelector('.note').textContent=copy.note;const label=time.parentElement;label.firstChild.textContent=copy.label;label.lastChild.textContent=' '+copy.unit;}
render();
const blobs=new Map(),cache=new Map();const CACHE_LIMIT=32;
async function bitmap(i){if(cache.has(i)){const b=cache.get(i);cache.delete(i);cache.set(i,b);return b}if(!blobs.has(i))blobs.set(i,fetch(frames[i].src).then(r=>{if(!r.ok)throw Error('Frame '+i);return r.blob()}));const b=await createImageBitmap(await blobs.get(i));if(cache.has(i)){b.close();return cache.get(i)}cache.set(i,b);while(cache.size>CACHE_LIMIT){const [key,old]=cache.entries().next().value;cache.delete(key);old.close()}return b}
function distance(a,b){const d=Math.abs(a-b);return Math.min(d,frames.length-d)}
function choose(){if(!ready)return;let best=Infinity;for(let i=0;i<frames.length;i++){const p=frames[i];if(p.eligible===false)continue;const err=(p.x-tx)**2+(p.y-ty)**2;const score=err+.012*distance(index,i)/frames.length;if(score<best){best=score;goal=i}}}
// Neutral face center in the source image; keep the origin stable while the head turns.
// Account for object-fit:contain letterboxing and the responsive canvas position.
function faceOrigin(){const r=canvas.getBoundingClientRect();const size=Math.min(r.width,r.height);return {x:r.left+r.width/2,y:r.top+(r.height-size)/2+size*(180/512),radius:size*.65}}
function pointer(e){const o=faceOrigin();tx=Math.max(-1,Math.min(1,(e.clientX-o.x)/o.radius));ty=Math.max(-1,Math.min(1,(e.clientY-o.y)/o.radius));departed=scrollY>20;choose()}
hero.addEventListener('pointermove',pointer,{passive:true});hero.addEventListener('pointerdown',pointer,{passive:true});hero.addEventListener('pointerleave',()=>{tx=ty=0;choose()});hero.addEventListener('wheel',e=>{if(e.deltaY>0)departed=true},{passive:true});window.addEventListener('scroll',()=>{departed=scrollY>20},{passive:true});document.addEventListener('visibilitychange',()=>previous=0);new IntersectionObserver(([e])=>{visible=e.intersectionRatio>.55;previous=0},{threshold:[0,.55,1]}).observe(hero);
async function draw(i){busy=true;try{const b=await bitmap(i);ctx.globalAlpha=1;ctx.clearRect(0,0,512,512);ctx.drawImage(b,0,0,512,512);index=i;lastDraw=i;const p=frames[i];dot.setAttribute('cx',120+p.x*85);dot.setAttribute('cy',120+p.y*85);hero.dataset.frame=i;hero.dataset.pose=p.x.toFixed(2)+','+p.y.toFixed(2)}catch(e){status.textContent='영상을 불러오지 못했습니다. 새로고침해 주세요.';ready=false}finally{busy=false}}
function tick(now){requestAnimationFrame(tick);if(!ready||document.hidden||!visible){previous=0;return}const dt=previous?Math.min((now-previous)/1000,.05):0;previous=now;let d=goal-progress;if(Math.abs(d)>frames.length/2)d-=Math.sign(d)*frames.length;const step=Math.sign(d)*Math.min(Math.abs(d),dt*(28+Math.min(90,Math.abs(d)*2)));progress=(progress+step+frames.length)%frames.length;const next=Math.round(progress)%frames.length;if(!busy&&next!==lastDraw)draw(next);const p=frames[index],front=Math.hypot(p.x,p.y)<.16;const viewing=front&&!departed&&!busy;if(viewing)seconds+=dt;time.textContent=seconds.toFixed(1);status.textContent=departed?copy.done:front?copy.front:copy.away;document.querySelector('#zone').setAttribute('fill',viewing?'#cdebd9':'#e4d9f3')}
async function load(){try{const r=await fetch(new URL('./assets/look-loop/poses.json',import.meta.url));if(!r.ok)throw Error('poses');frames=(await r.json()).map(p=>({...p,src:new URL('./assets/look-loop/'+p.src,import.meta.url).href}));ready=true;choose();progress=goal;await draw(goal);document.body.classList.add('ready');requestAnimationFrame(tick);let cursor=0;await Promise.all(Array.from({length:4},async()=>{while(cursor<frames.length){const i=cursor++;if(!blobs.has(i))blobs.set(i,fetch(frames[i].src).then(r=>{if(!r.ok)throw Error('frame');return r.blob()}));try{await blobs.get(i)}catch{blobs.delete(i)}}}));}catch(e){status.textContent='영상 준비 중입니다.'}

}
load();return {render};
}
