import { language } from './i18n.js';

export function initStory() {
  const hero = document.querySelector('#hero');
  const image = document.querySelector('#character-image');
  let media = null, turnTimer = 0;
  const next = document.querySelector('#story-next');
  const result = document.querySelector('.story-result');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let step = 0, seconds = 0, previousTime = 0, lastInput = -1000;
  let wheelAt = -1000, touchY = null, ignoreClick = 0, visible = true;
  let frame = 0, renderedLanguage = '';
  let measurementFinished = false, measurementScrollY = 0;
  function finishMeasurement() {
    if (step !== 3 || measurementFinished) return;
    measurementFinished = true;
    cancelAnimationFrame(frame);
    frame = 0;
    previousTime = 0;
    render();
  }
  const copy = {
    ko: {
      title: '광고를 바라본 순간,<br>데이터가 시작됩니다.',
      result: '광고를 봤다는 것,<br>이제 알 수 있습니다.',
      message: '인웨이브는 광고 시청을 감지하고,<br>시청 시간과 집중의 흐름을 데이터로 보여줍니다.',
      captions: ['평범한 길 위에서, 시선이 머무는 순간까지.', '걸음을 따라, 거리가 뒤로 흐릅니다.', '시선이 멈추고, 광고에 집중합니다.', '광고를 송출하는 순간을 넘어, 바라본 순간을 알다.'],
      buttons: ['걷기 시작하기 ↗', '광고 바라보기 ↗', '시청 데이터 보기 ↗', '다음 내용 보기 ↓'],
      skip: '건너뛰기', reset: '다시 보기 ↺', hint: '휠을 내리거나 화면을 탭해 보세요',
      detected: '● 광고 시청 감지', time: '시청 시간', attention: '정면 주시도', unit: '초',
      note: '인터랙티브 예시 · 실제 AI 분석이 아닙니다.', explore: '데이터 더 알아보기 ↓',
    },
    en: {
      title: 'The moment an ad is seen,<br>the data begins.',
      result: 'Know when your ad<br>is actually seen.',
      message: 'INWAVE detects ad viewing and turns<br>viewing time and attention into data.',
      captions: ['An ordinary street. A moment of attention.', 'Walking in place as the street moves behind.', 'A pause. A turn. Attention on the ad.', 'Beyond delivery. Understand the moment of attention.'],
      buttons: ['Start walking ↗', 'Look at the ad ↗', 'See viewing data ↗', 'Explore more ↓'],
      skip: 'Skip', reset: 'Replay ↺', hint: 'Scroll down or tap to continue',
      detected: '● VIEW DETECTED', time: 'Viewing time', attention: 'Frontal attention', unit: 'SEC',
      note: 'Interactive example · Not actual AI analysis.', explore: 'Explore the data ↓',
    },
  };
  function renderCopy() {
    const c = copy[language];
    hero.querySelector('h1').innerHTML = c.title;
    result.querySelector('h2').innerHTML = c.result;
    result.querySelector('.message').innerHTML = c.message;
    result.querySelector(':scope > small').textContent = c.note;
    result.querySelector('a').textContent = c.explore;
    hero.querySelector('.character > span').textContent = c.detected;
    hero.querySelector('.story-controls p').textContent = c.hint;
    document.querySelector('#story-skip').textContent = c.skip;
    document.querySelector('#story-reset').textContent = c.reset;
    const metrics = hero.querySelectorAll('.story-metrics > div');
    metrics[0].firstChild.textContent = c.time;
    metrics[1].firstChild.textContent = c.attention;
    metrics[0].querySelector('small').textContent = c.unit;
    document.querySelector('#story-caption').textContent = c.captions[step];
    next.textContent = c.buttons[step];
    renderedLanguage = language;
  }
  function render() {
    if (renderedLanguage !== language) renderCopy();
    const attention = Math.round(Math.min(seconds / 3.8, 1) * 92) + '%';
    const values = {
      'hero-time': seconds.toFixed(1), 'hero-attention': attention,
      'your-time': seconds.toFixed(1) + (language === 'ko' ? '초' : ' SEC'),
      'your-seconds': seconds.toFixed(1), 'your-attention': attention,
      'your-age': language === 'ko' ? '예시 · 30대' : 'Example · 30s',
      'your-gender': language === 'ko' ? '예시 · 여성' : 'Example · female',
    };
    for (const [id, value] of Object.entries(values)) {
      const node = document.getElementById(id);
      if (node && node.textContent !== value) node.textContent = value;
    }
  }
  new ResizeObserver(([entry]) => hero.style.setProperty('--street-width', (entry.contentRect.height * 1.5) + 'px')).observe(hero);
  function play() { playback(); }
  function playback() {
    clearTimeout(turnTimer);
    if (!media) return;
    const key = step === 0 ? 'idle' : step === 1 ? 'walk' : step === 2 ? 'turn' : 'focus';
    image.src = media[key];
    if (step === 2) turnTimer = setTimeout(() => { if(step === 2) image.src = media.focus; }, 3834);
  }
  Promise.all(Array.from({length: 10}, (_, i) => fetch(`./assets/story-media-v2/${i}.txt`).then(r => { if(!r.ok) throw Error('Media unavailable'); return r.text(); }))).then(parts => JSON.parse(parts.join(''))).then(async data => {
    media = data;
    const ready = new Image(); ready.src = media.idle; await ready.decode();
    hero.style.setProperty('--street-image', 'url("' + media.background + '")');
    hero.classList.add('media-ready');
    playback();
  }).catch(() => { document.querySelector('#story-caption').textContent = language === 'ko' ? '이미지를 불러오지 못했습니다. 새로고침해 주세요.' : 'Please reload to load the scene.'; });
  function setStep(value) {
    step = value;
    hero.dataset.step = String(step);
    document.querySelector('#story-step').textContent = `0${step + 1} / 04`;
    result.inert = step !== 3;
    if (step === 0) { seconds = 0; measurementFinished = false; }
    if (step === 3) measurementScrollY = window.scrollY;
    previousTime = 0;
    renderCopy();
    render();
    playback();
    start();
  }
  function advance() {
    if (step === 3) {
      finishMeasurement();
      document.querySelector('#your-data').scrollIntoView({ behavior: reduced.matches ? 'instant' : 'smooth' });
      return;
    }
    if (performance.now() - lastInput < 900) return;
    lastInput = performance.now();
    setStep(step + 1);
  }
  next.addEventListener('click', advance);
  hero.addEventListener('click', event => {
    if (performance.now() >= ignoreClick && !event.target.closest('button,a')) advance();
  });
  document.querySelector('#story-skip').onclick = () => setStep(3);
  document.querySelector('#story-reset').onclick = () => { lastInput = -1000; setStep(0); };
  // A continuous wheel/trackpad gesture advances only once, including inertia.
  hero.addEventListener('wheel', event => {
    if (event.ctrlKey || event.deltaY <= 0 || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    if (step === 3) { finishMeasurement(); return; }
    event.preventDefault();
    const now = performance.now(), fresh = now - wheelAt > 220;
    wheelAt = now;
    if (fresh && event.deltaY > 12) advance();
  }, { passive: false });
  hero.addEventListener('touchstart', event => { touchY = event.touches.length === 1 ? event.touches[0].clientY : null; }, { passive: true });
  hero.addEventListener('touchmove', event => {
    if (step < 3 && touchY !== null && touchY - event.touches[0].clientY > 10) event.preventDefault();
  }, { passive: false });
  hero.addEventListener('touchend', event => {
    if (touchY !== null && touchY - event.changedTouches[0].clientY > 40) {
      ignoreClick = performance.now() + 500;
      advance();
    }
    touchY = null;
  });
  hero.addEventListener('touchcancel', () => { touchY = null; });

  // Freeze the completed result until Replay, including when returning to the hero.
  hero.querySelectorAll('a').forEach(link => link.addEventListener('click', finishMeasurement));
  window.addEventListener('scroll', () => {
    if (step === 3 && window.scrollY > measurementScrollY + 8) finishMeasurement();
  }, { passive: true });

  function tick(now) {
    frame = 0;
    if (!visible || document.hidden || measurementFinished) return;
    const dt = previousTime ? Math.min((now - previousTime) / 1000, .05) : 0;
    previousTime = now;
    if (step === 3) { seconds = Math.min(12, seconds + dt); render(); }
    if (step !== 3 || seconds < 12) frame = requestAnimationFrame(tick);
  }
  function start() {
    if (!frame && visible && !document.hidden && !measurementFinished) frame = requestAnimationFrame(tick);
  }
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    previousTime = 0;
    if (!visible) { clearTimeout(turnTimer); if(media) image.src = step >= 2 ? media.focus : media.idle; } else { play(); start(); }
  }).observe(hero);
  document.addEventListener('visibilitychange', () => {
    previousTime = 0;
    if (document.hidden) { clearTimeout(turnTimer); if(media) image.src = step >= 2 ? media.focus : media.idle; } else { play(); start(); }
  });
  reduced.addEventListener('change', playback);
  setStep(0);
  return { render };
}
