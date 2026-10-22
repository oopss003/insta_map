const TAU = Math.PI * 2;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const wrap = a => (a % TAU + TAU) % TAU;

// Screen coordinates: up -> upper left -> left -> down -> right -> up.
export function directionFor(x, y) {
  return Math.hypot(x, y) < .2 ? null : wrap(Math.atan2(-x, -y));
}

export function pointerFromFace(clientX, clientY, face, bounds) {
  const dx = clientX - face.x, dy = clientY - face.y;
  const horizontal = dx < 0 ? face.x - bounds.left : bounds.right - face.x;
  const vertical = dy < 0 ? face.y - bounds.top : bounds.bottom - face.y;
  const rx = Math.max(32, Math.min(face.size * .5, horizontal * .85));
  const ry = Math.max(32, Math.min(face.size * .38, vertical * .85));
  const x = dx / rx, y = dy / ry, length = Math.max(1, Math.hypot(x, y));
  return {x: x / length, y: y / length};
}

export function timeForAngle(angle, anchors) {
  const a = wrap(angle);
  for (let i = 1; i < anchors.length; i++) {
    if (a <= anchors[i][0]) {
      const [a0, t0] = anchors[i - 1], [a1, t1] = anchors[i];
      return t0 + (t1 - t0) * (a - a0) / (a1 - a0);
    }
  }
  return anchors[anchors.length - 1][1];
}

export function poseForTime(t, {center, anchors, fps}) {
  if (Math.abs(t - center) <= .6 / fps) return {x: 0, y: 0};
  for (let i = 1; i < anchors.length; i++) {
    const [a0, t0] = anchors[i - 1], [a1, t1] = anchors[i];
    if (t <= t1 + .5 / fps) {
      const a = a0 + (a1 - a0) * clamp((t - t0) / (t1 - t0), 0, 1);
      return {x: -Math.sin(a), y: -Math.cos(a)};
    }
  }
  return {x: 0, y: -1};
}

// Keep only the newest pointer target; the decoder never gets overlapping seeks.
// One native video, with no crossfaded image layers.
export function createHeadOrbit(video, config, motion) {
  let desired = null, current = null, ready = false, failed = false;
  let frame = 0, watchdog = 0;
  const {center, fps = 24, anchors} = config;
  function fail() {
    failed = true; ready = false;
    clearTimeout(watchdog); cancelAnimationFrame(frame); frame = 0;
    video.classList.remove('is-ready'); video.dataset.state = 'error';
  }
  function schedule() {
    if (!frame && !failed && !document.hidden) frame = requestAnimationFrame(seek);
  }
  function seek() {
    frame = 0;
    if (!ready || failed || video.seeking || document.hidden) return;
    if (desired === null || current === null || motion.matches) current = desired;
    else {
      const delta = Math.atan2(Math.sin(desired - current), Math.cos(desired - current));
      current = Math.abs(delta) < .006 ? desired : wrap(current + delta * .5);
    }
    const rawTime = current === null ? center : timeForAngle(current, anchors);
    const next = clamp(Math.round(rawTime * fps) / fps, 0, video.duration - 1 / fps);
    video.dataset.targetTime = next.toFixed(4);
    if (Math.abs(next - video.currentTime) < .5 / fps) {
      if (current !== desired) schedule();
      return;
    }
    try {
      video.currentTime = next;
      clearTimeout(watchdog); watchdog = setTimeout(fail, 5000);
    } catch { fail(); }
  }
  function publish() {
    const p = poseForTime(video.currentTime, config);
    video.dataset.lookX = p.x.toFixed(4);
    video.dataset.lookY = p.y.toFixed(4);
    video.dataset.state = 'ready'; video.classList.add('is-ready');
  }
  function initialize() {
    if (ready || failed) return;
    if (!Number.isFinite(video.duration) || anchors.at(-1)[1] >= video.duration) return fail();
    ready = true;
    if (Math.abs(video.currentTime - center) < .5 / fps) {publish(); schedule();}
    else {video.currentTime = center; watchdog = setTimeout(fail, 5000);}
  }
  video.addEventListener('loadeddata', initialize, {once: true});
  video.addEventListener('seeked', () => {
    clearTimeout(watchdog); if (failed) return;
    publish(); schedule();
  });
  video.addEventListener('error', fail);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {cancelAnimationFrame(frame); frame = 0;} else schedule();
  });
  motion.addEventListener('change', schedule);
  if (video.readyState >= 2) initialize();
  return {look(x, y, active = true) {desired = active ? directionFor(x, y) : null; schedule();}};
}

