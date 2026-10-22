import { initSiteUI } from "./site-ui.js?v=local-ad-20261022";
import { applyLanguage } from "./i18n.js";
import { initStory } from "./story.js?v=local-ad-20261022";
import { platformScenarios } from "./scenarios.js";
const ui = initSiteUI();
applyLanguage(ui.getLanguage());
const story = initStory();
const scenario = document.querySelector("#scenario");
const choose = (ko, en) => (ui.getLanguage() === "en" ? en : ko);
function bars(id, rows) {
  const parent = document.getElementById(id);
  const max = Math.max(1, ...rows.map((row) => row.value));
  parent.replaceChildren(
    ...rows.map((row) => {
      const node = document.createElement("div");
      node.className = "chart-row";
      const label = document.createElement("span");
      label.textContent = row.label;
      const track = document.createElement("div");
      track.className = "bar-track";
      track.setAttribute("aria-hidden", "true");
      const fill = document.createElement("div");
      fill.className = "bar-fill";
      fill.style.setProperty("--bar", `${(row.value / max) * 100}%`);
      track.append(fill);
      const value = document.createElement("strong");
      value.textContent = String(row.value);
      node.append(label, track, value);
      return node;
    }),
  );
}
function renderDashboard() {
  const data =
    platformScenarios[Number(scenario.value)] || platformScenarios[0];
  [...scenario.options].forEach(
    (option, i) =>
      (option.textContent = choose(
        ["출근 시간대", "점심 시간대", "퇴근 시간대"][i],
        ["Morning commute", "Lunchtime", "Evening commute"][i],
      )),
  );
  const cards = [
    [
      choose("시청 집계", "Viewing count"),
      data.kpis.viewers.toLocaleString(),
      choose("집계 건수 예시", "Example viewing count"),
    ],
    [
      choose("평균 시청시간", "Average viewing time"),
      data.kpis.dwell.replace("s", choose("초", " sec")),
      choose("시청 지속시간 예시", "Example viewing duration"),
    ],
    [
      choose("추정 여성 비율", "Estimated female share"),
      `${Math.round(data.audiencePattern.femaleRatio * 100)}%`,
      choose("추정 성별 분포 예시", "Example estimated distribution"),
    ],
    [
      choose("최대 반응 시간대", "Peak response time"),
      `${data.audiencePattern.hours[data.audiencePattern.density.indexOf(Math.max(...data.audiencePattern.density))]}${choose("시", "h")}`,
      choose("시간대별 반응 예시", "Example response by time"),
    ],
  ];
  document.getElementById("demo-kpis").replaceChildren(
    ...cards.map(([title, value, note]) => {
      const card = document.createElement("article");
      card.className = "report-card";
      const h = document.createElement("h3");
      h.textContent = title;
      const v = document.createElement("div");
      v.className = "sample-value";
      const strong = document.createElement("strong");
      strong.textContent = value;
      const badge = document.createElement("span");
      badge.className = "example-badge";
      badge.textContent = choose("예시", "Example");
      v.append(strong, badge);
      const p = document.createElement("p");
      p.textContent = note;
      card.append(h, v, p);
      return card;
    }),
  );
  bars(
    "demo-dwell",
    data.dwell.map((row, i) => ({
      ...row,
      label: choose(
        ["지나감", "짧은 시청", "관심 시청", "긴 시청"][i],
        row.label,
      ),
    })),
  );
  bars(
    "demo-age",
    data.bars.map((row) => ({
      ...row,
      label: choose(row.label, row.label.replace("대", "s")),
    })),
  );
  bars(
    "demo-hours",
    data.audiencePattern.hours.map((hour, i) => ({
      label: hour + choose("시", "h"),
      value: data.audiencePattern.density[i],
    })),
  );
}
function locale() {
  applyLanguage(ui.getLanguage());
  story.render();
  renderDashboard();
  document.title = "INWAVE — " + choose("시선 체험", "Gaze experience");
  document
    .querySelector(".portrait")
    .setAttribute(
      "aria-label",
      choose(
        "캐릭터 시선 조작: 방향키, 정면은 Home 키",
        "Character gaze: use arrow keys, Home to face forward",
      ),
    );
}
scenario.addEventListener("change", renderDashboard);
const tabs = [...document.querySelectorAll("[data-tab]")];
function activate(tab, focus = false) {
  tabs.forEach((el) => {
    const selected = el === tab;
    el.setAttribute("aria-selected", String(selected));
    el.tabIndex = selected ? 0 : -1;
    document.getElementById(el.getAttribute("aria-controls")).hidden =
      !selected;
  });
  if (focus) tab.focus();
}
tabs.forEach((tab, i) => {
  tab.addEventListener("click", () => activate(tab));
  tab.addEventListener("keydown", (e) => {
    let next;
    if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
    if (e.key === "ArrowLeft") next = (i + tabs.length - 1) % tabs.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = tabs.length - 1;
    if (next !== undefined) {
      e.preventDefault();
      activate(tabs[next], true);
    }
  });
});
document.addEventListener("inwave:locale", locale);
locale();
