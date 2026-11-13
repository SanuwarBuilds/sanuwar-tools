"use strict";
(() => {
  const search = document.getElementById("tp-search");
  const grid = document.getElementById("tp-grid");
  const count = document.getElementById("tp-visible");
  const empty = document.getElementById("tp-empty");
  const smart = document.getElementById("tp-smart");
  const smartHit = document.getElementById("tp-smart-hit");
  const smartLabel = document.getElementById("tp-smart-label");
  const examples = [...document.querySelectorAll("[data-smart-example]")];
  const chips = [...document.querySelectorAll(".tp-chip")];
  if (!search || !grid) return;
  let category = "All";
  let smartTarget = null;
  const cards = [...grid.querySelectorAll(".tp-card")];
  const apply = () => {
    const query = search.value.trim().toLowerCase();
    let visible = 0;
    cards.forEach((card) => {
      const matchCategory = category === "All" || card.dataset.category === category;
      const matchQuery = !query || card.dataset.search.includes(query);
      const show = matchCategory && matchQuery;
      card.hidden = !show;
      if (show) visible += 1;
    });
    count.textContent = visible;
    empty.hidden = visible !== 0 || Boolean(smartTarget);
  };
  const updateSmart = () => {
    smartTarget = window.ToolSmartSearch?.parse ? window.ToolSmartSearch.parse(search.value) : null;
    if (smart && smartHit && smartLabel) {
      smart.hidden = !smartTarget;
      smartLabel.textContent = smartTarget ? smartTarget.label : "";
    }
    apply();
  };
  const openSmart = () => {
    if (smartTarget) location.assign(smartTarget.href);
  };
  chips.forEach((chip) => chip.addEventListener("click", () => {
    category = chip.dataset.category;
    chips.forEach((item) => item.classList.toggle("is-active", item === chip));
    apply();
  }));
  examples.forEach((button) => button.addEventListener("click", () => {
    search.value = button.dataset.smartExample || button.textContent;
    updateSmart();
    search.focus();
  }));
  search.addEventListener("input", updateSmart);
  search.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && smartTarget) {
      event.preventDefault();
      openSmart();
    }
  });
  if (smartHit) smartHit.addEventListener("click", openSmart);
  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && document.activeElement !== search) {
      event.preventDefault();
      search.focus();
    }
  });
  updateSmart();
})();
