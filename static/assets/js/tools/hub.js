"use strict";
(() => {
  const search = document.getElementById("tp-search");
  const grid = document.getElementById("tp-grid");
  const count = document.getElementById("tp-visible");
  const empty = document.getElementById("tp-empty");
  const chips = [...document.querySelectorAll(".tp-chip")];
  if (!search || !grid) return;
  let category = "All";
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
    empty.hidden = visible !== 0;
  };
  chips.forEach((chip) => chip.addEventListener("click", () => {
    category = chip.dataset.category;
    chips.forEach((item) => item.classList.toggle("is-active", item === chip));
    apply();
  }));
  search.addEventListener("input", apply);
  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && document.activeElement !== search) {
      event.preventDefault();
      search.focus();
    }
  });
})();
