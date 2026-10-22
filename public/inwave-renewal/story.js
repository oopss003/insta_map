import { language } from './i18n.js';
import { createHeadOrbit, pointerFromFace } from './head-orbit.js?v=head-orbit-v1';
export function initStory(){
const video=document.querySelector('#portrait');
const hero=document.querySelector('#hero'),dot=document.querySelector('#dot'),status=document.querySelector('#frame-status'),time=document.querySelector('#frame-time'),zone=document.querySelector('#zone');
let seconds=0,previous=0,visible=true,departed=scrollY>20;
const text={ko:{done:'광고를 바라본 시간을 확인하세요.',front:'지금, 광고를 시청하고 있습니다.',away:'시선이 벗어나면 시간이 멈춥니다.',title:'시선이 머무는 순간,<br>데이터가 시작됩니다.',intro:'얼굴 주변으로 마우스를 둥글게 움직여 보세요.',label:'누적 시청 시간',unit:'초',note:'캐릭터 영상의 방향을 활용한 시연 · 실제 시청자 분석이 아닙니다.'},en:{done:'See how long the ad held attention.',front:'The ad is being watched now.',away:'Viewing time pauses when attention moves away.',title:'When attention stays,<br>data begins.',intro:'Move your pointer in a circle around her face.',label:'Total viewing time',unit:'s',note:'Character animation demo · Not actual audience analysis.'}};
let copy=text[language]||text.ko;
function render(){copy=text[language]||text.ko;hero.querySelector('h1').innerHTML=copy.title;hero.querySelector('.intro').textContent=copy.intro;hero.querySelector('.note').textContent=copy.note;const label=time.parentElement;label.firstChild.textContent=copy.label;label.lastChild.textContent=' '+copy.unit;}
render();

const motion=matchMedia('(prefers-reduced-motion: reduce)');
// Calibrated from the actual video, not the requested generation timestamps.
// Neutral is frame 0. Frames 1..219 trace a closed orbit; 219 repeats frame 1.
const orbit={center:0,fps:24,anchors:[[0,1],[45,37],[90,67],[135,91],[180,115],[225,145],[270,163],[315,187],[352,211],[360,219]].map(([degrees,frame])=>[degrees*Math.PI/180,frame/24])};
const rig=createHeadOrbit(video,orbit,motion);
function origin(){
 const r=video.getBoundingClientRect(),scale=Math.min(r.width/1440,r.height/1440),size=1440*scale;
 return {x:r.left+(r.width-size)/2+size*.5,y:r.top+(r.height-size)/2+size*.52,size};
}
function pointer(e){
 const r=hero.getBoundingClientRect();
 const p=pointerFromFace(e.clientX,e.clientY,origin(),{left:Math.max(0,r.left),right:Math.min(innerWidth,r.right),top:Math.max(0,r.top),bottom:Math.min(innerHeight,r.bottom)});
 rig.look(p.x,p.y);
}
hero.addEventListener('pointermove',pointer,{passive:true});
hero.addEventListener('pointerdown',pointer,{passive:true});
hero.addEventListener('pointerleave',()=>rig.look(0,0,false));
hero.addEventListener('wheel',e=>{if(e.deltaY>0)departed=true},{passive:true});
window.addEventListener('scroll',()=>{departed=scrollY>20;},{passive:true});
document.addEventListener('visibilitychange',()=>previous=0);
new IntersectionObserver(([e])=>{visible=e.intersectionRatio>.55;previous=0;},{threshold:[0,.55,1]}).observe(hero);
video.addEventListener('seeked',()=>{hero.dataset.lookX=video.dataset.lookX||'0';hero.dataset.lookY=video.dataset.lookY||'0';hero.dataset.player='head-orbit-v1';});
function syncData(){for(const [id,value] of Object.entries({'your-time':seconds.toFixed(1)+(language==='ko'?'초':' SEC'),'your-seconds':seconds.toFixed(1),'your-age':language==='ko'?'예시 · 30대':'Example · 30s','your-gender':language==='ko'?'예시 · 여성':'Example · female'})){const el=document.getElementById(id);if(el)el.textContent=value;}}
function tick(now){
 requestAnimationFrame(tick);
 if(document.hidden||!visible){previous=0;return;}
 const dt=previous?Math.min((now-previous)/1000,.05):0;previous=now;
 const ready=video.dataset.state==='ready';
 const x=Number(video.dataset.lookX||0),y=Number(video.dataset.lookY||0),front=ready&&!video.seeking&&Math.hypot(x,y)<.16,viewing=front&&!departed;
 dot.setAttribute('cx',120+x*85);dot.setAttribute('cy',120+y*85);
 if(viewing)seconds+=dt;
 if(time.textContent!==seconds.toFixed(1)){time.textContent=seconds.toFixed(1);syncData();}
 status.textContent=video.dataset.state==='error'?(language==='ko'?'캐릭터 영상을 불러오지 못했습니다. 새로고침해 주세요.':'Unable to load the character. Please reload.'):departed?copy.done:!ready?(language==='ko'?'캐릭터를 준비하고 있습니다.':'Preparing the character.'):front?copy.front:copy.away;
 zone.setAttribute('fill',viewing?'#cdebd9':'#e4d9f3');
}
requestAnimationFrame(tick);return {render};
}
