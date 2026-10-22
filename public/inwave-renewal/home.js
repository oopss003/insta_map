import { initSiteUI } from "./site-ui.js?v=local-ad-20261022";
const ui = initSiteUI();
function legacyRoute() {
  if (
    ["#your-data", "#dashboard", "#technology", "#attention"].includes(
      location.hash,
    )
  )
    location.replace("/inwave-renewal/experience/" + location.hash);
}
legacyRoute();
window.addEventListener("hashchange", legacyRoute);
const video = document.querySelector("#site-tour"),
  control = document.querySelector("#tour-control");
const motion = matchMedia("(prefers-reduced-motion: reduce)");
let userPaused = false,
  inView = true,
  started = false,
  failed = false,
  pageLoaded = document.readyState === "complete";
function labels() {
  const en = ui.getLanguage() === "en";
  document.title = en
    ? "INWAVE — Your business, along everyday routes."
    : "INWAVE — 일상 가까이, 우리 가게를 꾸준히.";
  const label = failed
    ? en
      ? "Video unavailable"
      : "영상을 불러오지 못했습니다"
    : motion.matches
      ? en
        ? "Still image · reduced motion"
        : "정지 화면 · 동작 줄이기"
      : video.ended
        ? en
          ? "Replay video ↻"
          : "다시 보기 ↻"
        : video.paused
          ? en
            ? "Play video ▷"
            : "영상 재생 ▷"
          : en
            ? "Pause video Ⅱ"
            : "영상 일시정지 Ⅱ";
  control.textContent = label;
  control.setAttribute("aria-label", label);
  control.disabled = failed || motion.matches;
}
function scene() {
  const current = video.currentTime < 2 ? 0 : video.currentTime < 5 ? 1 : 2;
  document
    .querySelectorAll("[data-scene]")
    .forEach((el) =>
      el.classList.toggle("is-active", Number(el.dataset.scene) === current),
    );
}
async function play() {
  if (failed || motion.matches || document.hidden || !inView) return;
  if (!video.hasAttribute("src")) {
    video.src = video.dataset.src;
    video.load();
  }
  started = true;
  try {
    await video.play();
  } catch {
    /* The poster and play control remain available when autoplay is blocked. */
  }
  labels();
}
control.addEventListener("click", () => {
  if (video.paused || video.ended) {
    userPaused = false;
    if (video.ended) video.currentTime = 0;
    void play();
  } else {
    userPaused = true;
    video.pause();
  }
});
["play", "pause", "ended"].forEach((event) =>
  video.addEventListener(event, labels),
);
video.addEventListener("timeupdate", scene);
video.addEventListener("error", () => {
  failed = true;
  labels();
});
function canResume() {
  return started && !userPaused && !video.ended && !motion.matches;
}
new IntersectionObserver(
  ([entry]) => {
    inView = entry.isIntersecting && entry.intersectionRatio >= 0.2;
    if (!inView) video.pause();
    else if (
      canResume() ||
      (!started && pageLoaded && !navigator.connection?.saveData)
    )
      void play();
  },
  { threshold: 0.2 },
).observe(video);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) video.pause();
  else if (inView && canResume()) void play();
});
motion.addEventListener("change", () => {
  if (motion.matches) video.pause();
  labels();
});
document.addEventListener("inwave:locale", labels);
function start() {
  pageLoaded = true;
  if (!navigator.connection?.saveData) void play();
}
if (document.readyState === "complete") start();
else window.addEventListener("load", start, { once: true });
labels();
