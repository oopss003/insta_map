import { language } from './i18n.js';

export function initStory() {
  const hero = document.querySelector('#hero');
  const canvas = document.querySelector('#head-canvas');
  const context = canvas.getContext('2d');
  const dot = document.querySelector('#direction-dot');
  const play = document.querySelector('#gaze-play');
  let poses = [], running = false, finished = false, started = false;
  let elapsed = 0, seconds = 0, previous = 0, raf = 0, frameIndex = 0, scrollStart = 0;
  let viewing = false, renderedLanguage = '', stateKey = '';
  const text = {
    ko: { title: '시선이 머무는 순간,<br>데이터가 시작됩니다.', description: '광고를 송출한 횟수를 넘어,<br>실제로 바라본 시간을 확인하세요.', direction: '정면 주시 방향', legend: '중앙 영역 · 정면', waiting: '시선이 머무는 순간을 기다립니다.', watching: '지금, 광고를 시청하고 있습니다.', away: '시선이 벗어나면, 시간도 멈춥니다.', paused: '시청 시간 측정을 잠시 멈췄습니다.', done: '광고를 바라본 시간을 확인하세요.', time: '누적 시청 시간', unit: '초', note: '캐릭터 동작에 맞춘 시청 감지 예시 · 실제 AI 분석이 아닙니다.', badge: '시청 감지 예시', start: '시선 감지 체험하기 ↗', resume: '계속 보기 ↗', pause: '일시정지', reset: '다시 보기 ↺', more: '내 시청 데이터 보기 ↓', loading: '준비 중…', error: '이미지를 불러오지 못했습니다. 새로고침해 주세요.' },
    en: { title: 'When attention stays,<br>the data begins.', description: 'Beyond ads delivered.<br>See the time actually spent watching.', direction: 'FACE DIRECTION', legend: 'Center zone · facing forward', waiting: 'Waiting for a moment of attention.', watching: 'Your ad is being viewed now.', away: 'Looking away pauses the timer.', paused: 'Viewing measurement is paused.', done: 'See the time spent viewing the ad.', time: 'Total viewing time', unit: 'SEC', note: 'Character animation demo · Not actual AI analysis.', badge: 'Viewing detection demo', start: 'Try attention detection ↗', resume: 'Continue ↗', pause: 'Pause', reset: 'Replay ↺', more: 'See my viewing data ↓', loading: 'Loading…', error: 'Unable to load the character. Please reload.' }
  };
  // Each rendered pose has a matching illustrated yaw value, not a live gaze estimate.
  const keyYaw = [70,67,62,57,50,44,37,30,24,18,13,9,6,3,1,0,0];
  const yaw = Array.from({length:33}, (_,i) => i%2 ? (keyYaw[(i-1)/2]+keyYaw[(i+1)/2])/2 : keyYaw[i/2]);
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
    play.textContent = !poses.length ? c.loading : running ? c.pause : started && !finished ? c.resume : c.start;
    const state = finished ? 'done' : !started ? 'waiting' : !running ? 'paused' : viewing ? 'watching' : 'away';
    if (state !== stateKey) { document.querySelector('#gaze-status').textContent = c[state]; stateKey = state; }
    hero.classList.toggle('is-viewing', running && viewing);
    const attention = Math.round(100 * Math.max(0, 1 - yaw[frameIndex] / 70)) + '%';
    const values = { 'hero-time': seconds.toFixed(1), 'your-time': seconds.toFixed(1) + (language === 'ko' ? '초' : ' SEC'), 'your-seconds': seconds.toFixed(1), 'your-attention': attention, 'your-age': language === 'ko' ? '예시 · 30대' : 'Example · 30s', 'your-gender': language === 'ko' ? '예시 · 여성' : 'Example · female' };
    for (const [id,value] of Object.entries(values)) { const el = document.getElementById(id); if(el && el.textContent !== value) el.textContent = value; }
  }
  function draw(index) {
    frameIndex = index;
    context.clearRect(0,0,270,315);
    context.drawImage(poses[index],0,0,270,315);
    dot.setAttribute('cx', String(120 + yaw[index]));
    dot.setAttribute('cy', '120');
    viewing = yaw[index] <= 13;
    hero.dataset.pose = String(index);
  }
  // Hold sideways, turn to the ad, hold forward, then retrace the same poses.
  // No frame blending, independent video clock or discontinuous loop reset.
  function poseAt(t) {
    const phase = t % 8.8;
    if (phase < 1.2) return 0;
    if (phase < 2.8) return Math.min(32, Math.floor((phase - 1.2) * 20));
    if (phase < 6.2) return 32;
    if (phase < 7.8) return Math.max(0,32 - Math.floor((phase - 6.2) * 20));
    return 0;
  }
  function tick(now) {
    raf = 0;
    if (!running || document.hidden) return;
    const dt = previous ? Math.min((now - previous)/1000,.1) : 0;
    previous = now;
    if (viewing) seconds += dt;
    elapsed += dt;
    const index = poseAt(elapsed);
    if (index !== frameIndex) draw(index);
    render();
    raf = requestAnimationFrame(tick);
  }
  function pause(finalize = false) {
    running = false; finished ||= finalize;
    cancelAnimationFrame(raf); raf = 0; previous = 0; render();
  }
  function begin() {
    if (!poses.length) return;
    if (finished) reset();
    started = true; running = true; scrollStart = window.scrollY; previous = 0;
    render(); if (!raf) raf = requestAnimationFrame(tick);
  }
  function reset() {
    pause(); elapsed = 0; seconds = 0; started = false; finished = false;
    if (poses.length) draw(0); render();
  }
  play.addEventListener('click', () => running ? pause() : begin());
  document.querySelector('#gaze-reset').addEventListener('click', reset);
  document.querySelector('#gaze-more').addEventListener('click', () => pause(true));
  window.addEventListener('scroll', () => { if(running && window.scrollY > scrollStart + 8) pause(true); }, {passive:true});
  hero.addEventListener('wheel', event => { if(running && !event.ctrlKey && event.deltaY > 0) pause(true); }, {passive:true});
  document.addEventListener('visibilitychange', () => { if(document.hidden && running) pause(); });
  new IntersectionObserver(([entry]) => { if (!entry.isIntersecting && running) pause(true); }).observe(hero);
  Promise.all(Array.from({length: 4}, (_,i) => fetch(`./assets/head-poses/${i}.txt`).then(r => {if(!r.ok) throw Error('Media unavailable');return r.text();})))
    .then(parts => JSON.parse(parts.join('')))
    .then(async urls => { poses = await Promise.all(urls.map(async src => {const image=new Image();image.src=src;await image.decode();return image;}));draw(0);play.disabled=false;render(); })
    .catch(() => { document.querySelector('#gaze-status').textContent=text[language].error; });
  render();
  return {render};
}

