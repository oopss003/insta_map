import { t } from "./i18n.js";

// Phase 1.2 intentionally supports one verified installation clip only.
// Keep data-src empty until the exact user-supplied MP4 is present in the repo;
// existing marketing/demo footage must not be substituted for installation proof.
export function initRealSpace() {
  const section = document.querySelector("#real-space");
  const video = document.querySelector("#space-video");
  const missing = document.querySelector("#space-missing");
  const play = document.querySelector("#space-play");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const saveData = Boolean(navigator.connection?.saveData);
  const source = video.dataset.src.trim();
  let inView = false;
  let userPaused = false;

  function renderControl() {
    play.textContent = video.paused ? t("play") : t("pause");
  }

  async function maybePlay(manual = false) {
    if (!source || !inView || document.hidden) return;
    if (!manual && (reduced.matches || saveData || userPaused)) return;
    try {
      await video.play();
    } catch {
      // Autoplay policies vary; the visible control remains available.
    }
    renderControl();
  }

  function loadVideo() {
    if (!source || video.src) return;
    video.src = new URL(source, import.meta.url).href;
    video.preload = saveData ? "none" : "metadata";
    video.load();
  }

  missing.hidden = Boolean(source);
  video.hidden = !source;
  play.hidden = !source;
  video.autoplay = Boolean(source) && !reduced.matches && !saveData;

  video.addEventListener("play", renderControl);
  video.addEventListener("pause", renderControl);
  video.addEventListener("error", () => {
    video.hidden = true;
    play.hidden = true;
    missing.hidden = false;
  });
  play.addEventListener("click", () => {
    if (video.paused) {
      userPaused = false;
      maybePlay(true);
    } else {
      userPaused = true;
      video.pause();
    }
    renderControl();
  });

  new IntersectionObserver(
    ([entry]) => {
      inView = entry.isIntersecting;
      if (inView) {
        loadVideo();
        maybePlay();
      } else {
        video.pause();
      }
    },
    { rootMargin: "320px 0px", threshold: 0.08 },
  ).observe(section);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) video.pause();
    else maybePlay();
  });
  reduced.addEventListener("change", () => {
    video.autoplay = Boolean(source) && !reduced.matches && !saveData;
    if (reduced.matches) video.pause();
    else maybePlay();
  });
  document.addEventListener("inwave:language", renderControl);
  renderControl();
}
