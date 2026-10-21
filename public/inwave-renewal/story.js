import { language } from './i18n.js';
import { createWavyVideo } from './wavy-video-restored.js?v=wavy-restored-1';
export function initStory(){
const video=document.querySelector('#portrait');
const hero=document.querySelector('#hero'),dot=document.querySelector('#dot'),status=document.querySelector('#frame-status'),time=document.querySelector('#frame-time'),zone=document.querySelector('#zone');
let seconds=0,previous=0,visible=true,departed=scrollY>20;
const text={ko:{done:'광고를 바라본 시간을 확인하세요.',front:'지금, 광고를 시청하고 있습니다.',away:'시선이 벗어나면 시간이 멈춥니다.',title:'시선이 머무는 순간,<br>데이터가 시작됩니다.',intro:'얼굴을 기준으로 마우스를 좌우로 움직여 보세요.',label:'누적 시청 시간',unit:'초',note:'캐릭터 영상의 방향을 활용한 시연 · 실제 시청자 분석이 아닙니다.'},en:{done:'See how long the ad held attention.',front:'The ad is being watched now.',away:'Viewing time pauses when attention moves away.',title:'When attention stays,<br>data begins.',intro:'Move your pointer left or right around Wavy’s face.',label:'Total viewing time',unit:'s',note:'Character animation demo · Not actual audience analysis.'}};
let copy=text[language]||text.ko;
function render(){copy=text[language]||text.ko;hero.querySelector('h1').innerHTML=copy.title;hero.querySelector('.intro').textContent=copy.intro;hero.querySelector('.note').textContent=copy.note;const label=time.parentElement;label.firstChild.textContent=copy.label;label.lastChild.textContent=' '+copy.unit;}
render();

const motion=matchMedia('(prefers-reduced-motion: reduce)');
const rig=createWavyVideo(video,{left:1.5,center:.04,right:6.2,rightCenter:7.1},motion);
function origin(){
 const r=video.getBoundingClientRect(),scale=Math.min(r.width/600,r.height/900),w=600*scale,h=900*scale;
 return {x:r.left+(r.width-w)/2+w*.505,y:r.top+(r.height-h)/2+h*.215,radius:Math.max(w*.58,1)};
}
function pointer(e){const o=origin(),x=Math.max(-1,Math.min(1,(e.clientX-o.x)/o.radius));rig.look(x,Math.abs(x)<.08?'eye-contact':'tracking');}
hero.addEventListener('pointermove',pointer,{passive:true});
hero.addEventListener('pointerdown',pointer,{passive:true});
hero.addEventListener('pointerleave',()=>rig.look(0,'idle'));
hero.addEventListener('wheel',e=>{if(e.deltaY>0)departed=true},{passive:true});
window.addEventListener('scroll',()=>{departed=scrollY>20;},{passive:true});
document.addEventListener('visibilitychange',()=>previous=0);
new IntersectionObserver(([e])=>{visible=e.intersectionRatio>.55;previous=0;},{threshold:[0,.55,1]}).observe(hero);
video.addEventListener('seeked',()=>{hero.dataset.lookX=video.dataset.lookX||'0';hero.dataset.player='wavy-video';});
function syncData(){for(const [id,value] of Object.entries({'your-time':seconds.toFixed(1)+(language==='ko'?'초':' SEC'),'your-seconds':seconds.toFixed(1),'your-age':language==='ko'?'예시 · 30대':'Example · 30s','your-gender':language==='ko'?'예시 · 여성':'Example · female'})){const el=document.getElementById(id);if(el)el.textContent=value;}}
function tick(now){
 requestAnimationFrame(tick);
 if(document.hidden||!visible){previous=0;return;}
 const dt=previous?Math.min((now-previous)/1000,.05):0;previous=now;
 const ready=video.readyState>=2&&video.dataset.lookX!==undefined;
 const x=Number(video.dataset.lookX||0),front=ready&&!video.seeking&&Math.abs(x)<.16,viewing=front&&!departed;
 dot.setAttribute('cx',120+x*85);dot.setAttribute('cy',120);
 if(viewing)seconds+=dt;
 if(time.textContent!==seconds.toFixed(1)){time.textContent=seconds.toFixed(1);syncData();}
 status.textContent=departed?copy.done:!ready?(language==='ko'?'캐릭터를 준비하고 있습니다.':'Preparing the character.'):front?copy.front:copy.away;
 zone.setAttribute('fill',viewing?'#cdebd9':'#e4d9f3');
}
requestAnimationFrame(tick);return {render};
}
