// Home copy and offer visibility are authored in home-content.json.
// A static heading in index.html remains available without JavaScript.
export async function prepareHomeContent() {
  try {
    const response = await fetch(
      "/inwave-renewal/home-content.json?v=renewal-r2-20261022",
    );
    if (!response.ok) return;
    const config = await response.json();
    const copy =
      config.heroTitles[config.heroVariant] || config.heroTitles.steady;
    const title = document.querySelector("[data-hero-title]");
    title.innerHTML = copy.ko;
    if (copy.en) title.dataset.en = copy.en;
    else {
      title.dataset.enPending = "hero.alternative";
      title.lang = "ko";
    }
    if (config.showOffer === true) {
      const template = document.getElementById("offer-template");
      template.before(template.content.cloneNode(true));
      document.querySelector("[data-offer-nav]").hidden = false;
    }
  } catch {
    /* Preserve the static heading and keep unconfirmed offer details hidden. */
  }
}
