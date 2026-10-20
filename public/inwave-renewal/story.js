import { language } from './i18n.js';

export function initStory() {
  const hero = document.querySelector('#hero');
  const video = document.querySelector('#head-video');
  const dot = document.querySelector('#direction-dot');
  const play = document.querySelector('#gaze-play');
  let ready=false, running=false, finished=false, started=false, viewing=false;
  let seconds=0, previous=0, raf=0, scrollStart=0, renderedLanguage='', stateKey='';
  let automatic=false, queue=[], chosen='front', direction={x:0,y:0};
  // Calibrated against the actual generated video, not prompt timestamps.
  const samples=[[0,0,0],[1.25,0,0],[1.5,-28,0],[2,-70,0],[2.8,-70,0],[3.25,-12,0],[3.5,0,0],[4.4,0,0],[4.8,50,0],[5.15,70,0],[6,70,0],[6.3,28,0],[6.5,0,0],[6.75,0,-35],[7,0,-70],[9,0,-70],[9.25,0,-45],[9.55,0,0],[9.8,0,35],[10,0,65],[11.25,0,65],[11.5,0,35],[11.8,0,0],[15.05,0,0]];
  const segments={left:{start:1.1,peak:2.5,end:3.65},right:{start:4.2,peak:5.5,end:6.5},up:{start:6.5,peak:8.2,end:9.55},down:{start:9.55,peak:10.8,end:11.9}};
  function sample(t){
    let i=1;while(i<samples.length&&samples[i][0]<t)i++;
    if(i>=samples.length)return {x:0,y:0};
    const a=samples[i-1],b=samples[i],p=Math.max(0,Math.min(1,(t-a[0])/(b[0]-a[0])));
    return {x:a[1]+(b[1]-a[1])*p,y:a[2]+(b[2]-a[2])*p};
  }
  const text = {
    ko: { title: '시선이 머무는 순간,<br>데이터가 시작됩니다.', description: '광고를 송출한 횟수를 넘어,<br>실제로 바라본 시간을 확인하세요.', direction: '정면 주시 방향', legend: '중앙 영역 · 정면', waiting: '시선이 머무는 순간을 기다립니다.', watching: '지금, 광고를 시청하고 있습니다.', away: '시선이 벗어나면, 시간도 멈춥니다.', paused: '시청 시간 측정을 잠시 멈췄습니다.', done: '광고를 바라본 시간을 확인하세요.', time: '누적 시청 시간', unit: '초', note: '캐릭터 동작에 맞춘 시청 감지 예시 · 실제 AI 분석이 아닙니다.', badge: '시청 감지 예시', start: '자동 시연 시작 ↗', resume: '자동 시연 계속 ↗', pause: '일시정지', reset: '다시 보기 ↺', more: '내 시청 데이터 보기 ↓', loading: '준비 중…', error: '이미지를 불러오지 못했습니다. 새로고침해 주세요.' },
    en: { title: 'When attention stays,<br>the data begins.', description: 'Beyond ads delivered.<br>See the time actually spent watching.', direction: 'FACE DIRECTION', legend: 'Center zone · facing forward', waiting: 'Waiting for a moment of attention.', watching: 'Your ad is being viewed now.', away: 'Looking away pauses the timer.', paused: 'Viewing measurement is paused.', done: 'See the time spent viewing the ad.', time: 'Total viewing time', unit: 'SEC', note: 'Character animation demo · Not actual AI analysis.', badge: 'Viewing detection demo', start: 'Start demo ↗', resume: 'Continue demo ↗', pause: 'Pause', reset: 'Replay ↺', more: 'See my viewing data ↓', loading: 'Loading…', error: 'Unable to load the character. Please reload.' }
  };
  function render() {
    const c = text[language];
    if (renderedLanguage !== language) {
      hero.querySelector('h1').innerHTML = c.title;
      hero.querySelector('.gaze-description').innerHTML = c.description;
      document.querySelector('#direction-label').textContent = c.direction;
      document.querySelector('#chart-legend').textContent = c.legend;
      document.querySelector('#time-label').textContent = c.time;
      document.querySelector('#time-unit').textContent = c.unit;
      document.querySelector('#gaze-note').textContent = c.note;
      document.querySelector('#pose-label').textContent = c.badge;
      document.querySelector('#gaze-reset').textContent = c.reset;
      document.querySelector('#gaze-more').textContent = c.more;
      renderedLanguage = language; stateKey = '';
    }
    const labels = language === 'ko' ? {left:'← 왼쪽',right:'오른쪽 →',up:'↑ 위',down:'↓ 아래',front:'정면'} : {left:'← Left',right:'Right →',up:'↑ Up',down:'↓ Down',front:'Front'};
    hero.querySelectorAll('[data-look]').forEach(button => {button.textContent=labels[button.dataset.look];button.disabled=!ready;});
    play.textContent = !ready ? c.loading : running ? c.pause : started && !finished ? c.resume : c.start;
    const state = finished ? 'done' : !started ? 'waiting' : !running ? 'paused' : viewing ? 'watching' : 'away';
    if (state !== stateKey) { document.querySelector('#gaze-status').textContent = c[state]; stateKey = state; }
    hero.classList.toggle('is-viewing', running && viewing);
    const attention = Math.round(100 * Math.max(0, 1 - Math.hypot(direction.x,direction.y) / 70)) + '%';
    const values = { 'hero-time': seconds.toFixed(1), 'your-time': seconds.toFixed(1) + (language === 'ko' ? '초' : ' SEC'), 'your-seconds': seconds.toFixed(1), 'your-attention': attention, 'your-age': language === 'ko' ? '예시 · 30대' : 'Example · 30s', 'your-gender': language === 'ko' ? '예시 · 여성' : 'Example · female' };
    for (const [id,value] of Object.entries(values)) { const el = document.getElementById(id); if(el && el.textContent !== value) el.textContent = value; }
  }

  function updatePose(){
    if(video.seeking)return;
    direction=sample(video.currentTime);
    dot.setAttribute('cx',String(120+direction.x));dot.setAttribute('cy',String(120+direction.y));
    viewing=Math.hypot(direction.x,direction.y)<=12;
    hero.dataset.direction=Math.abs(direction.x)>12?(direction.x<0?'left':'right'):Math.abs(direction.y)>12?(direction.y<0?'up':'down'):'front';
  }
  function safePlay(){video.play().catch(()=>{pause();document.querySelector('#gaze-status').textContent=text[language].error;});}
  function nextSegment(){if(queue.length){video.currentTime=queue[0].start;safePlay();}}
  function tick(now){
    raf=0;if(!running||document.hidden)return;
    const dt=previous?Math.min((now-previous)/1000,.1):0;previous=now;
    updatePose();
    if(viewing&&!video.seeking&&(video.paused||video.readyState>=3))seconds+=dt;
    if(!automatic&&queue.length&&!video.seeking&&video.currentTime>=queue[0].end){
      const end=queue[0].end;queue.shift();
      if(queue.length)nextSegment();else{video.pause();video.currentTime=chosen==='front'?.04:end;}
    }
    render();raf=requestAnimationFrame(tick);
  }
  function startClock(){started=true;finished=false;running=true;scrollStart=window.scrollY;previous=0;render();if(!raf)raf=requestAnimationFrame(tick);}
  function choose(key){
    if(!ready)return;
    automatic=false;chosen=key;queue=[];
    const t=video.currentTime,current=Object.values(segments).find(s=>t>=s.start&&t<s.end);
    if(current&&Math.hypot(direction.x,direction.y)>12)queue.push({start:t,end:current.end});
    if(key!=='front')queue.push({start:segments[key].start,end:segments[key].peak});
    if(queue.length)nextSegment();else{video.pause();video.currentTime=.04;}
    startClock();
  }
  function begin(){if(!ready)return;automatic=true;queue=[];safePlay();startClock();}
  function pause(finalize=false){running=false;finished ||= finalize;video.pause();cancelAnimationFrame(raf);raf=0;previous=0;render();}
  function reset(){pause();seconds=0;started=false;finished=false;automatic=false;queue=[];chosen='front';if(ready)video.currentTime=.04;render();}
  play.addEventListener('click',()=>running?pause():begin());
  hero.querySelectorAll('[data-look]').forEach(button=>button.addEventListener('click',()=>choose(button.dataset.look)));
  document.querySelector('#gaze-reset').addEventListener('click',reset);
  document.querySelector('#gaze-more').addEventListener('click',()=>pause(true));
  window.addEventListener('scroll',()=>{if(running&&window.scrollY>scrollStart+8)pause(true);},{passive:true});
  hero.addEventListener('wheel',event=>{if(running&&!event.ctrlKey&&event.deltaY>0)pause(true);},{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&running)pause();});
  new IntersectionObserver(([entry])=>{if(!entry.isIntersecting&&running)pause(true);}).observe(hero);
  video.addEventListener('ended',()=>{if(automatic&&running){video.currentTime=.04;safePlay();}});
  video.addEventListener('seeked',()=>{updatePose();previous=0;render();});
  function onReady(){if(ready)return;ready=true;video.currentTime=.04;play.disabled=false;updatePose();render();}
  video.addEventListener('loadeddata',onReady,{once:true});
  if(video.readyState>=2)onReady();
  video.addEventListener('error',()=>{pause();document.querySelector('#gaze-status').textContent=text[language].error;});
  render();return {render};
}
