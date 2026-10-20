import { language } from './i18n.js';
export function initStory(){
const canvas=document.querySelector('#portrait'),ctx=canvas.getContext('2d',{alpha:false});
const hero=document.querySelector('#hero'),dot=document.querySelector('#dot'),status=document.querySelector('#frame-status'),time=document.querySelector('#frame-time');
// The HTML poster remains visible until a decoded frame has actually been painted.
ctx.fillStyle='#faf5e9';ctx.fillRect(0,0,512,512);
let frames=[],index=0,goal=0,tx=0,ty=0,seconds=0,previous=0,ready=false,visible=true,departed=false,lastDraw=-1,sx=0,sy=0,selectionElapsed=0;

const text={ko:{done:'광고를 바라본 시간을 확인하세요.',front:'지금, 광고를 시청하고 있습니다.',away:'시선이 벗어나면 시간이 멈춥니다.',title:'시선이 머무는 순간,<br>데이터가 시작됩니다.',intro:'얼굴 중앙을 기준으로 마우스를 움직여 보세요.',label:'누적 시청 시간',unit:'초',note:'캐릭터 영상의 방향을 활용한 시연 · 실제 시청자 분석이 아닙니다.'},en:{done:'See how long the ad held attention.',front:'The ad is being watched now.',away:'Viewing time pauses when attention moves away.',title:'When attention stays,<br>data begins.',intro:'Move your pointer around the center of her face.',label:'Total viewing time',unit:'s',note:'Character animation demo · Not actual audience analysis.'}};
let copy=text[language]||text.ko;
function render(){copy=text[language]||text.ko;hero.querySelector('h1').innerHTML=copy.title;hero.querySelector('.intro').textContent=copy.intro;hero.querySelector('.note').textContent=copy.note;const label=time.parentElement;label.firstChild.textContent=copy.label;label.lastChild.textContent=' '+copy.unit;}
render();
const blobs=new Map(),cache=new Map(),decoding=new Map();const CACHE_LIMIT=64;
function blob(i){if(!blobs.has(i))blobs.set(i,fetch(frames[i].src).then(r=>{if(!r.ok)throw Error('Frame '+i);return r.blob()}).catch(e=>{blobs.delete(i);throw e}));return blobs.get(i)}
async function bitmap(i){if(cache.has(i))return cache.get(i);if(decoding.has(i))return decoding.get(i);const job=(async()=>{const b=await createImageBitmap(await blob(i));cache.set(i,b);while(cache.size>CACHE_LIMIT){const [key,old]=cache.entries().next().value;cache.delete(key);old.close()}return b})();decoding.set(i,job);try{return await job}finally{decoding.delete(i)}}
// Select in orientation space: never play unrelated intermediate video poses.
function candidates(x,y){return frames.map((p,i)=>({i,d:(p.x-x)**2+(p.y-y)**2+(i===index?0:.0003)})).filter(v=>frames[v.i].eligible!==false).sort((a,b)=>a.d-b.d)}
function choose(){const ranked=candidates(sx,sy);goal=ranked[0].i;for(const v of ranked.slice(0,12))bitmap(v.i).catch(()=>{});return goal}
function warm(){choose()}
// Neutral face center in the source image; keep the origin stable while the head turns.
// Account for object-fit:contain letterboxing and the responsive canvas position.
function faceOrigin(){const r=canvas.getBoundingClientRect();const size=Math.min(r.width,r.height);return {x:r.left+r.width/2,y:r.top+(r.height-size)/2+size*(180/512),radius:size*.65}}
function pointer(e){const o=faceOrigin();tx=Math.max(-1,Math.min(1,(e.clientX-o.x)/o.radius));ty=Math.max(-1,Math.min(1,(e.clientY-o.y)/o.radius));departed=scrollY>20;}
hero.addEventListener('pointermove',pointer,{passive:true});hero.addEventListener('pointerdown',pointer,{passive:true});hero.addEventListener('pointerleave',()=>{tx=ty=0;});hero.addEventListener('wheel',e=>{if(e.deltaY>0)departed=true},{passive:true});window.addEventListener('scroll',()=>{departed=scrollY>20},{passive:true});document.addEventListener('visibilitychange',()=>previous=0);new IntersectionObserver(([e])=>{visible=e.intersectionRatio>.55;previous=0},{threshold:[0,.55,1]}).observe(hero);
function draw(i){const b=cache.get(i);if(!b)return false;cache.delete(i);cache.set(i,b);ctx.drawImage(b,0,0,512,512);index=i;lastDraw=i;hero.classList.add('frame-ready');const p=frames[i];dot.setAttribute('cx',120+p.x*85);dot.setAttribute('cy',120+p.y*85);hero.dataset.frame=i;hero.dataset.pose=p.x.toFixed(2)+','+p.y.toFixed(2);return true;}
function syncData(){const values={'your-time':seconds.toFixed(1)+(language==='ko'?'초':' SEC'),'your-seconds':seconds.toFixed(1),'your-age':language==='ko'?'예시 · 30대':'Example · 30s','your-gender':language==='ko'?'예시 · 여성':'Example · female'};for(const [id,value] of Object.entries(values)){const el=document.getElementById(id);if(el)el.textContent=value;}}
function tick(now){requestAnimationFrame(tick);if(!ready||document.hidden||!visible){previous=0;return}const dt=previous?Math.min((now-previous)/1000,.05):0;previous=now;
 const ease=1-Math.exp(-dt*12);sx+=(tx-sx)*ease;sy+=(ty-sy)*ease;selectionElapsed+=dt;if(selectionElapsed>.016){choose();warm();selectionElapsed=0}
 // Orientation changes are smoothed; decoded nearest poses replace source-timeline playback.
 const next=goal;if(next!==lastDraw){if(cache.has(next))draw(next);else bitmap(next).catch(()=>{});}
 const p=frames[index],front=Math.hypot(p.x,p.y)<.16,viewing=front&&!departed;if(viewing)seconds+=dt;time.textContent=seconds.toFixed(1);syncData();status.textContent=departed?copy.done:front?copy.front:copy.away;document.querySelector('#zone').setAttribute('fill',viewing?'#cdebd9':'#e4d9f3');}
async function load(){try{const r=await fetch(new URL('./assets/simple-head/poses.json',import.meta.url));if(!r.ok)throw Error('poses');frames=(await r.json()).map(p=>({...p,src:new URL('./assets/simple-head/'+p.src,import.meta.url).href}));await bitmap(0);draw(0);ready=true;hero.dataset.frameCount=frames.length;warm();requestAnimationFrame(tick);let cursor=0;await Promise.all(Array.from({length:4},async()=>{while(cursor<frames.length){const i=cursor++;try{await blob(i)}catch{}}}));}catch(e){status.textContent=language==='ko'?'캐릭터를 불러오지 못했습니다. 새로고침해 주세요.':'Unable to load animation. Please reload.'}}
load();return {render};
}

