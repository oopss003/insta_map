import { platformScenarios } from "./scenarios.js";
import { t, language, initLanguage } from "./i18n.js";
import { initRealSpace } from "./real-space.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const motion = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const header = $("#header");
const menu = $("#navigation");
const menuToggle = $("#menu-toggle");
function closeMenu() {
  menu.classList.remove("open");
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", t("menuOpen"));
}
menuToggle.addEventListener("click", () => {
  const open = menu.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded", String(open));
  menuToggle.setAttribute("aria-label", open ? t("menuClose") : t("menuOpen"));
});
menu.addEventListener("click", (event) => {
  if (event.target.closest("a")) closeMenu();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && menu.classList.contains("open")) {
    closeMenu();
    menuToggle.focus();
  }
});
document.addEventListener("click", (event) => {
  if (!header.contains(event.target)) closeMenu();
});
const scrollHeader = () => header.classList.toggle("scrolled", scrollY > 20);
addEventListener("scroll", scrollHeader, { passive: true });
scrollHeader();

// Homepage UX demonstration only. No camera, face inference, biometric input,
// gender/age detection, or actual AI analysis occurs. Every metric is derived
// exclusively from pointer proximity (or an accessible keyboard equivalent).
const stage = $("#hero-stage");
const wavy = $(".hero-wavy");
const wavyHead = $(".wavy-head");
const wavyBody = $(".wavy-body");
const hero = $("#hero");
let targetX = 0,
  targetY = 0,
  x = 0,
  y = 0,
  engagement = 0,
  targetEngagement = 0;
let interacted = false,
  heroVisible = true,
  frameId = 0,
  previousTime = 0;
// One shared state feeds Hero and Your Data; no user profiling occurs.
const metricNodes = Object.fromEntries(
  [
    "hero-time",
    "hero-attention",
    "hero-gender",
    "hero-male",
    "hero-age",
    "hero-progress",
    "your-time",
    "your-attention",
    "your-age",
    "your-gender",
    "your-seconds",
  ].map((id) => [id, document.getElementById(id)]),
);
let lastMetricsKey = "";
function renderMetrics(progress) {
  const seconds = (progress * 3.8).toFixed(1),
    attention = Math.round(42 + progress * 50),
    female = Math.round(51 + progress * 40),
    male = 100 - female;
  const age =
    progress > 0.92
      ? t("approxAge")
      : "30–" + Math.round(50 - Math.min(progress / 0.7, 1) * 12) + t("years");
  const key = [language, seconds, attention, female, age].join("|");
  if (key === lastMetricsKey) return;
  lastMetricsKey = key;
  metricNodes["hero-time"].textContent = seconds;
  metricNodes["hero-attention"].textContent = attention + "%";
  metricNodes["hero-gender"].textContent = t("female") + " " + female + "%";
  metricNodes["hero-male"].textContent = t("male") + " " + male + "%";
  metricNodes["hero-age"].textContent = age;
  metricNodes["hero-progress"].style.width = progress * 100 + "%";
  metricNodes["your-seconds"].textContent = seconds;
  metricNodes["your-time"].textContent =
    seconds + (language === "ko" ? "초" : " SEC");
  metricNodes["your-attention"].textContent = attention + "%";
  metricNodes["your-age"].textContent = age;
  metricNodes["your-gender"].textContent = t("female") + " " + female + "%";
  stage.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
  stage.setAttribute(
    "aria-valuetext",
    t("engagement") +
      " " +
      Math.round(progress * 100) +
      "%, " +
      seconds +
      " " +
      t("seconds"),
  );
}
function firstInteraction() {
  if (interacted) return;
  interacted = true;
  stage.classList.add("has-interacted");
}
let stageRect = stage.getBoundingClientRect();
let rectFrame = 0;
function refreshStageRect() {
  if (rectFrame) return;
  rectFrame = requestAnimationFrame(() => {
    stageRect = stage.getBoundingClientRect();
    rectFrame = 0;
  });
}
addEventListener("scroll", refreshStageRect, { passive: true });
addEventListener("resize", refreshStageRect, { passive: true });
new ResizeObserver(refreshStageRect).observe(stage);
function move(clientX, clientY) {
  firstInteraction();
  const rect = stageRect;
  targetX = clamp(
    (clientX - rect.left - rect.width / 2) / (rect.width / 2),
    -1,
    1,
  );
  targetY = clamp(
    (clientY - rect.top - rect.height * 0.46) / (rect.height / 2),
    -1,
    1,
  );
  targetEngagement = clamp(1 - Math.hypot(targetX, targetY) / 1.1);
  if (targetEngagement > 0.97) targetEngagement = 1;
  startHero();
}
hero.addEventListener(
  "pointermove",
  (event) => move(event.clientX, event.clientY),
  { passive: true },
);
stage.addEventListener(
  "pointerdown",
  (event) => move(event.clientX, event.clientY),
  { passive: true },
);
stage.addEventListener(
  "touchmove",
  (event) => {
    if (event.touches[0])
      move(event.touches[0].clientX, event.touches[0].clientY);
  },
  { passive: true },
);
stage.addEventListener("keydown", (event) => {
  if (
    ![
      "ArrowUp",
      "ArrowRight",
      "ArrowDown",
      "ArrowLeft",
      "Home",
      "End",
    ].includes(event.key)
  )
    return;
  event.preventDefault();
  firstInteraction();
  targetEngagement =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? 1
        : clamp(
            targetEngagement +
              (["ArrowUp", "ArrowRight"].includes(event.key) ? 0.1 : -0.1),
          );
  targetX = (1 - targetEngagement) * 0.5;
  targetY = 0;
  startHero();
});
function heroFrame(now) {
  frameId = 0;
  if (!heroVisible || document.hidden) return;
  const dt = previousTime ? Math.min(now - previousTime, 50) : 16;
  previousTime = now;
  if (!interacted && !motion.matches) {
    targetX = Math.sin(now / 1900) * 0.07;
    targetY = Math.cos(now / 2400) * 0.04;
  }
  const smoothing = motion.matches ? 1 : 1 - Math.exp(-dt / 110);
  x += (targetX - x) * smoothing;
  y += (targetY - y) * smoothing;
  engagement += (targetEngagement - engagement) * smoothing;
  if (Math.abs(targetEngagement - engagement) < 0.001)
    engagement = targetEngagement;
  // The original official asset is masked into head/body layers; rotations stay subtle.
  const idleLift =
    !interacted && !motion.matches ? Math.sin(now / 1800) * 1.4 : 0;
  wavy.style.transform = motion.matches
    ? "none"
    : "translateY(" + idleLift + "px)";
  wavyHead.style.transform = motion.matches
    ? "none"
    : "translate(" +
      x * 4 +
      "px," +
      y * 2 +
      "px) rotateX(" +
      -y * 5 +
      "deg) rotateY(" +
      x * 9 +
      "deg) rotateZ(" +
      x * 2.5 +
      "deg)";
  wavyBody.style.transform = motion.matches
    ? "none"
    : "rotate(" + x * 0.35 + "deg)";
  renderMetrics(engagement);
  const moving =
    Math.abs(targetX - x) +
      Math.abs(targetY - y) +
      Math.abs(targetEngagement - engagement) >
    0.001;
  if ((!interacted && !motion.matches) || moving)
    frameId = requestAnimationFrame(heroFrame);
}
function startHero() {
  if (!frameId && heroVisible && !document.hidden) {
    previousTime = 0;
    frameId = requestAnimationFrame(heroFrame);
  }
}
new IntersectionObserver((entries) => {
  heroVisible = entries[0].isIntersecting;
  if (heroVisible) startHero();
  else {
    cancelAnimationFrame(frameId);
    frameId = 0;
  }
}).observe(hero);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    cancelAnimationFrame(frameId);
    frameId = 0;
  } else startHero();
});
motion.addEventListener("change", startHero);

// Reuses the existing homepage's requestAnimationFrame counter and one-shot
// IntersectionObserver pattern. Content is visible when JavaScript is disabled.
function animateValue(el) {
  const target = Number(el.dataset.count),
    decimals = Number(el.dataset.decimals || 0);
  if (motion.matches) {
    el.textContent = target.toFixed(decimals);
    return;
  }
  const started = performance.now();
  function frame(now) {
    const progress = clamp((now - started) / 850);
    el.textContent = (target * (1 - Math.pow(1 - progress, 3))).toFixed(
      decimals,
    );
    if (progress < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
document.documentElement.classList.add("motion-ready");
$$(".section h2, .section .section-statement").forEach((el) =>
  el.classList.add("reveal"),
);
const revealObserver = new IntersectionObserver(
  (entries) =>
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("visible");
      if (entry.target.hasAttribute("data-count")) animateValue(entry.target);
      revealObserver.unobserve(entry.target);
    }),
  { threshold: 0.12 },
);
$$(".section, .reveal, [data-count]").forEach((el) =>
  revealObserver.observe(el),
);

// Canvas backing stores are sized only after visibility or debounced resize.
// A deterministic PRNG keeps conceptual points stable across tab changes.
function randomGenerator(seed = 42) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
function canvasContext(canvas) {
  const width = canvas.clientWidth,
    height = canvas.clientHeight;
  if (!width || !height) return null;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width, height };
}
function grid(ctx, width, height, pad = 16) {
  ctx.strokeStyle = "rgba(23,23,23,.09)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 6; i++) {
    const xx = pad + ((width - pad * 2) * i) / 6,
      yy = pad + ((height - pad * 2) * i) / 6;
    ctx.beginPath();
    ctx.moveTo(xx, pad);
    ctx.lineTo(xx, height - pad);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pad, yy);
    ctx.lineTo(width - pad, yy);
    ctx.stroke();
  }
}
function drawAttention(canvas) {
  const setup = canvasContext(canvas);
  if (!setup) return;
  const { ctx, width, height } = setup;
  grid(ctx, width, height);
  const random = randomGenerator(79);
  // Conceptual correlation illustration, NOT fabricated measured observations.
  for (let i = 0; i < 230; i++) {
    const xx = random(),
      yy = clamp(xx * 0.63 + random() * 0.43 - 0.02, 0.04, 0.96);
    ctx.beginPath();
    ctx.arc(
      20 + xx * (width - 40),
      height - 22 - yy * (height - 65),
      2 + random() * 3,
      0,
      Math.PI * 2,
    );
    ctx.fillStyle =
      xx > 0.62 && yy > 0.58 ? "rgba(255,98,101,.7)" : "rgba(23,23,23,.25)";
    ctx.fill();
  }
}
// Adapted from drawAudiencePattern in the original homepage: the same scenario
// hours, density, gender ratios and age ranges, with deterministic jitter.
function drawAudiencePattern(canvas, pattern) {
  const setup = canvasContext(canvas);
  if (!setup) return;
  const { ctx, width, height } = setup,
    random = randomGenerator(121);
  grid(ctx, width, height, 20);
  pattern.hours.forEach((hour, index) => {
    for (let i = 0; i < pattern.density[index]; i++) {
      const male = random() < pattern.maleRatio,
        seed = random();
      const base =
        seed < 0.18
          ? 20 + random() * 8
          : seed < 0.58
            ? 28 + random() * 10
            : seed < 0.88
              ? 38 + random() * 12
              : 52 + random() * 16;
      const age = clamp(
        base + (random() - 0.5) * 10,
        pattern.ageRange.min,
        pattern.ageRange.max,
      );
      const next = pattern.hours[index + 1] ?? hour;
      const plottedHour = hour + random() * (next - hour);
      const xx = 25 + ((plottedHour - 8) / 12) * (width - 50);
      const yy =
        height -
        25 -
        ((age - pattern.ageRange.min) /
          (pattern.ageRange.max - pattern.ageRange.min)) *
          (height - 50);
      ctx.beginPath();
      ctx.arc(xx, yy, 1.5 + random() * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = male ? "rgba(23,23,23,.3)" : "rgba(255,98,101,.48)";
      ctx.fill();
    }
  });
  ctx.fillStyle = "#4B4B43";
  ctx.font = "11px Arial";
  ctx.fillText("08", 20, height - 4);
  ctx.fillText("20", width - 28, height - 4);
  ctx.fillText(String(pattern.ageRange.max), 0, 15);
  ctx.fillText(String(pattern.ageRange.min), 0, height - 25);
}
let currentScenario = 0,
  currentTab = "overview";
const descriptions = {
  overview: "오늘 광고의 핵심 반응을 한눈에 확인합니다.",
  audience: "연령과 성별에 따른 시청자 구성을 확인합니다.",
  attention: "시청시간과 정면 주시도를 함께 분석합니다.",
  time: "반응이 높은 시간대를 찾아냅니다.",
};
function renderScenario(index) {
  currentScenario = index;
  const scenario = platformScenarios[index];
  $("#scenario-label").textContent = t("scenario" + index);
  const kpis = [
    [t("visitors"), scenario.kpis.visitors.toLocaleString()],
    [t("viewers"), scenario.kpis.viewers.toLocaleString()],
    [
      t("duration"),
      scenario.kpis.dwell.replace("s", language === "ko" ? "초" : "s"),
    ],
    [t("frontal"), scenario.kpis.attention],
  ];
  $("#kpis").innerHTML = kpis
    .map(
      ([label, value]) =>
        `<div class="kpi"><span>${label}</span><strong>${value}</strong></div>`,
    )
    .join("");
  const max = Math.max(...scenario.dwell.map((d) => d.value));
  $("#dwell-bars").innerHTML = scenario.dwell
    .map(
      (d) =>
        `<div class="dwell-group ${d.highlight ? "highlight" : ""}"><strong>${d.value}</strong><i style="height:0"></i><span>${t(d.label)}</span></div>`,
    )
    .join("");
  requestAnimationFrame(() =>
    requestAnimationFrame(() =>
      $$("#dwell-bars i").forEach((el, i) => {
        el.style.height = `${(scenario.dwell[i].value / max) * 175}px`;
      }),
    ),
  );
  const maxAge = Math.max(...scenario.bars.map((b) => b.value));
  $("#age-bars").innerHTML = scenario.bars
    .map(
      (b) =>
        `<div class="bar-row"><span>${language === "ko" ? b.label : b.label.replace("대", "s")}</span><div class="bar-track"><i style="--value:${(b.value / maxAge) * 100}%"></i></div><strong>${b.value}</strong></div>`,
    )
    .join("");
  const p = scenario.audiencePattern;
  $("#gender-summary").innerHTML =
    `<div class="gender-total">${Math.round(p.femaleRatio * 100)}%<span>${t("female")}</span></div><div class="gender-total">${Math.round(p.maleRatio * 100)}%<span>${t("male")}</span></div><p class="data-note">${t("genderNote")}</p>`;
  const palette = ["#eee8d6", "#ffe993", "#ffd64a", "#ff6265", "#171717"];
  $("#heatmap").innerHTML = scenario.heatmap
    .map(
      (level, i) =>
        `<span class="heat-cell" style="background:${palette[level]}" role="img" aria-label="${t(
          "heatCell",
        )
          .replace("{n}", i + 1)
          .replace("{level}", level)}"></span>`,
    )
    .join("");
  $("#attention-dwell").textContent = scenario.kpis.dwell.replace(
    "s",
    language === "ko" ? "초" : "s",
  );
  $("#attention-score").textContent = scenario.kpis.attention;
  drawVisibleCharts();
}
function drawVisibleCharts() {
  drawAttention($("#attention-canvas"));
  if (currentTab === "attention") drawAttention($("#dashboard-scatter"));
  if (currentTab === "time")
    drawAudiencePattern(
      $("#audience-scatter"),
      platformScenarios[currentScenario].audiencePattern,
    );
}
function selectTab(name, focus = false) {
  currentTab = name;
  $$("[role=tab]").forEach((tab) => {
    const active = tab.dataset.tab === name;
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
    if (active && focus) tab.focus();
  });
  $$("[role=tabpanel]").forEach((panel) => {
    panel.hidden = panel.id !== `panel-${name}`;
  });
  $("#tab-description").textContent = t(
    name === "attention" ? "attentionTab" : name,
  );
  requestAnimationFrame(drawVisibleCharts);
}
$$("[role=tab]").forEach((tab, index) => {
  tab.addEventListener("click", () => selectTab(tab.dataset.tab));
  tab.addEventListener("keydown", (event) => {
    const tabs = $$("[role=tab]");
    let next;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    if (event.key === "ArrowLeft")
      next = (index + tabs.length - 1) % tabs.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = tabs.length - 1;
    if (next !== undefined) {
      event.preventDefault();
      selectTab(tabs[next].dataset.tab, true);
    }
  });
});
$("#scenario").addEventListener("change", (event) =>
  renderScenario(Number(event.target.value)),
);
document.addEventListener("inwave:language", () => {
  refreshStageRect();
  lastMetricsKey = "";
  renderMetrics(engagement);
  renderScenario(currentScenario);
  selectTab(currentTab);
  menuToggle.setAttribute(
    "aria-label",
    t(menu.classList.contains("open") ? "menuClose" : "menuOpen"),
  );
  stage.setAttribute("aria-label", t("stageLabel"));
  document
    .querySelectorAll("#partners img,#location-list img")
    .forEach((img, i) => {
      img.alt =
        t(img.closest("#partners") ? "partnerAlt" : "locationAlt") +
        " " +
        (Number(img.dataset.index) + 1);
    });
});
initLanguage();
initRealSpace();
let resizeTimer;
addEventListener(
  "resize",
  () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (innerWidth > 768) closeMenu();
      drawVisibleCharts();
    }, 150);
  },
  { passive: true },
);

// Existing JSON loader pattern, with safe root-relative normalization because
// locations.json contains ./images/... paths intended for the original root.
async function loadJsonList(url) {
  const response = await fetch(url, { cache: "no-cache" });
  if (!response.ok)
    throw new Error(`목록을 불러올 수 없습니다: ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error("목록 형식 오류");
  return data;
}
async function loadShowcase(url, selector, type) {
  const container = $(selector);
  try {
    const items = await loadJsonList(url);
    items.forEach((src, index) => {
      const image = document.createElement("img");
      image.src = new URL(src, `${location.origin}/`).href;
      image.dataset.index = index;
      image.alt =
        t(type === "partner" ? "partnerAlt" : "locationAlt") +
        " " +
        (index + 1);
      image.loading = "lazy";
      image.decoding = "async";
      image.width = type === "partner" ? 240 : 640;
      image.height = type === "partner" ? 105 : 480;
      container.appendChild(image);
    });
  } catch (error) {
    const message = document.createElement("p");
    message.textContent = t("loadError");
    container.appendChild(message);
    console.error(error);
  }
}
await Promise.all([
  loadShowcase("/data/partners.json", "#partners", "partner"),
  loadShowcase("/data/locations.json", "#location-list", "location"),
]);
