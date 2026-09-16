import { t } from "./i18n.js";

// Only verified, supplied on-site footage may be configured in this manifest.
// Null src entries intentionally make no network request: missing media is not
// replaced with stock footage, fabricated locations, or broken video URLs.
export async function initRealSpace() {
  const section = document.querySelector("#real-space");
  const video = document.querySelector("#space-video");
  const empty = document.querySelector("#space-empty");
  const selectors = document.querySelector(".space-selectors");
  const play = document.querySelector("#space-play");
  const caption = document.querySelector("#space-current");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let clips = [],
    selected = 0,
    inView = false,
    userPaused = false;
  const saveData = !!navigator.connection?.saveData;
  video.autoplay = !reduced.matches && !saveData;
  function label(index) {
    return t("scene") + " " + String(index + 1).padStart(2, "0");
  }
  function renderLabels() {
    caption.textContent = label(selected);
    play.textContent = video.paused ? t("play") : t("pause");
    video.setAttribute("aria-label", t("videoLabel") + " — " + label(selected));
    [...selectors.children].forEach((button, index) => {
      button.innerHTML =
        '<span class="scene-number">' +
        String(index + 1).padStart(2, "0") +
        "</span><span>" +
        label(index) +
        "</span><small>" +
        (clips[index].src ? "MP4" : t("videoPending")) +
        "</small>";
      button.setAttribute("aria-pressed", String(index === selected));
    });
  }
  async function maybePlay(manual = false) {
    if (!clips[selected]?.src || !inView || document.hidden) return;
    if (!manual && (reduced.matches || saveData || userPaused)) return;
    try {
      await video.play();
    } catch {
      /* Autoplay policy: keep the explicit play control available. */
    }
    renderLabels();
  }
  function loadSelected() {
    const clip = clips[selected];
    if (!clip?.src || !inView) return;
    const source = new URL(clip.src, new URL("./", import.meta.url)).href;
    if (video.src !== source) {
      video.src = source;
      video.preload = saveData ? "none" : "metadata";
      if (clip.poster)
        video.poster = new URL(clip.poster, import.meta.url).href;
      else video.removeAttribute("poster");
      video.load();
    }
    maybePlay();
  }
  function select(index) {
    selected = index;
    userPaused = false;
    video.pause();
    const available = !!clips[index].src;
    video.hidden = !available;
    empty.hidden = available;
    play.hidden = !available;
    if (!available) {
      video.removeAttribute("src");
      video.load();
    }
    empty.querySelector(".space-index").textContent = String(
      index + 1,
    ).padStart(2, "0");
    renderLabels();
    loadSelected();
  }
  video.addEventListener("play", renderLabels);
  video.addEventListener("pause", renderLabels);
  video.addEventListener("error", () => {
    video.hidden = true;
    empty.hidden = false;
    play.hidden = true;
  });
  play.addEventListener("click", () => {
    if (video.paused) {
      userPaused = false;
      maybePlay(true);
    } else {
      userPaused = true;
      video.pause();
    }
    renderLabels();
  });
  new IntersectionObserver(
    (entries) => {
      inView = entries[0].isIntersecting;
      if (inView) loadSelected();
      else video.pause();
    },
    { threshold: 0.12 },
  ).observe(section);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) video.pause();
    else maybePlay();
  });
  reduced.addEventListener("change", () => {
    video.autoplay = !reduced.matches && !saveData;
    if (reduced.matches) video.pause();
    else maybePlay();
  });
  document.addEventListener("inwave:language", renderLabels);
  try {
    const response = await fetch(
      new URL("./videos/manifest.json", import.meta.url),
    );
    if (!response.ok) throw new Error("Video manifest unavailable");
    const data = await response.json();
    clips = data.clips;
    clips.forEach((clip, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.addEventListener("click", () => select(index));
      button.addEventListener("keydown", (event) => {
        const next =
          event.key === "ArrowRight"
            ? (index + 1) % clips.length
            : event.key === "ArrowLeft"
              ? (index + clips.length - 1) % clips.length
              : null;
        if (next !== null) {
          event.preventDefault();
          selectors.children[next].focus();
          select(next);
        }
      });
      selectors.append(button);
    });
    select(0);
  } catch {
    empty.hidden = false;
    video.hidden = true;
    play.hidden = true;
  }
}
