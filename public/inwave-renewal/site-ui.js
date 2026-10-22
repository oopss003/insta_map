export function initSiteUI() {
  let language = "ko";
  try {
    if (localStorage.getItem("inwave-language") === "en") language = "en";
  } catch {}
  const translations = [...document.querySelectorAll("[data-en]")]
    .filter((el) => !el.parentElement.closest("[data-en]"))
    .map((el) => ({ el, ko: el.innerHTML, en: el.dataset.en }));
  const menu = document.querySelector(".menu-toggle"),
    nav = document.querySelector("#navigation");
  function closeMenu() {
    nav?.classList.remove("is-open");
    menu?.setAttribute("aria-expanded", "false");
  }
  menu?.addEventListener("click", () => {
    const open = !nav.classList.contains("is-open");
    nav.classList.toggle("is-open", open);
    menu.setAttribute("aria-expanded", String(open));
  });
  nav?.addEventListener("click", (e) => {
    if (e.target.closest("a")) closeMenu();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && nav?.classList.contains("is-open")) {
      closeMenu();
      menu.focus();
    }
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".site-header")) closeMenu();
  });
  matchMedia("(min-width: 961px)").addEventListener("change", closeMenu);
  function apply(next) {
    language = next === "en" ? "en" : "ko";
    translations.forEach(({ el, ko, en }) => {
      el.innerHTML = language === "en" ? en : ko;
    });
    document.documentElement.lang = language;
    document
      .querySelectorAll("[data-language]")
      .forEach((el) =>
        el.setAttribute(
          "aria-pressed",
          String(el.dataset.language === language),
        ),
      );
    document.querySelector(".skip-link").textContent =
      language === "en" ? "Skip to content" : "본문으로 건너뛰기";
    menu?.setAttribute(
      "aria-label",
      language === "en" ? "Toggle menu" : "메뉴 열기·닫기",
    );
    nav?.setAttribute(
      "aria-label",
      language === "en" ? "Main navigation" : "주 메뉴",
    );
    try {
      localStorage.setItem("inwave-language", language);
    } catch {}
    document.dispatchEvent(
      new CustomEvent("inwave:locale", { detail: { language } }),
    );
  }
  document
    .querySelectorAll("[data-language]")
    .forEach((el) =>
      el.addEventListener("click", () => apply(el.dataset.language)),
    );
  apply(language);
  return { getLanguage: () => language };
}
