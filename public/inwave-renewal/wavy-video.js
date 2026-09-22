// A paused video is a continuous pose library. Only one seek may be in flight.
export function createWavyVideo(
  video,
  { left, center, right, rightCenter },
  motion,
) {
  let target = center;
  let desired = 0;
  let current = 0;
  let ready = false;
  let failed = false;
  let frame = 0;
  let watchdog = 0;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  function fail() {
    failed = true;
    ready = false;
    clearTimeout(watchdog);
    cancelAnimationFrame(frame);
    video.classList.remove("is-ready");
  }
  function seek() {
    frame = 0;
    if (!ready || failed || video.seeking || document.hidden) return;
    current += (desired - current) * 0.25;
    if (Math.abs(desired - current) < 0.005) current = desired;
    target =
      current < -0.005
        ? 0.5 + (left - 0.5) * -current
        : current > 0.005
          ? rightCenter + (right - rightCenter) * current
          : center;
    video.dataset.targetTime = target.toFixed(3);
    const next = target;
    if (Math.abs(next - video.currentTime) < 1 / 48) {
      if (current !== desired) schedule();
      return;
    }
    try {
      video.currentTime = clamp(next, 0, video.duration - 0.04);
      clearTimeout(watchdog);
      watchdog = setTimeout(fail, 5000);
    } catch {
      fail();
    }
  }
  function schedule() {
    if (!frame && !failed) frame = requestAnimationFrame(seek);
  }
  function initialize() {
    if (
      !Number.isFinite(video.duration) ||
      Math.max(left, center, right) >= video.duration
    )
      return fail();
    ready = true;
    video.currentTime = center;
  }
  video.addEventListener("loadeddata", initialize, {once:true});
  video.addEventListener("seeked", () => {
    clearTimeout(watchdog);
    if (failed) return;
    video.classList.toggle("is-ready", !motion.matches);
    schedule();
  });
  video.addEventListener("error", fail);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      desired = 0;
      target = center;
      cancelAnimationFrame(frame);
      frame = 0;
    } else schedule();
  });
  motion.addEventListener("change", () => {
    video.classList.toggle("is-ready", ready && !failed && !motion.matches);
    desired = 0;
    target = center;
    schedule();
  });
  if (video.readyState >= 2) initialize();
  return {
    look(x, state) {
      const amount =
        state === "tracking" && !motion.matches ? clamp(x, -1, 1) : 0;
      desired = amount;
      if (state === "eye-contact" || state === "idle") current = 0;
      video.dataset.targetTime = target.toFixed(3);
      schedule();
    },
  };
}
