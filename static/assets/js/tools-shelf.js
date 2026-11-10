"use strict";
(() => {
  const section = document.getElementById("browser-tools");
  if (!section) return;
  const search = document.getElementById("bt-search");
  const chips = [...section.querySelectorAll(".bt-chip")];
  const folders = [...section.querySelectorAll("[data-bt-folder]")];
  const cards = [...section.querySelectorAll("[data-bt-tool]")];
  const visible = document.getElementById("bt-visible");
  const empty = document.getElementById("bt-empty");
  if (!search || !visible || !empty) return;
  let filter = "all";

  const apply = () => {
    const query = search.value.trim().toLowerCase();
    let shown = 0;
    cards.forEach((card) => {
      const matchQuery = !query || (card.dataset.search || "").includes(query);
      const matchFilter =
        filter === "all" ||
        (filter === "popular" && card.dataset.popular === "1") ||
        card.dataset.category === filter;
      const show = matchQuery && matchFilter;
      card.hidden = !show;
      if (show) shown += 1;
    });
    folders.forEach((folder) => {
      folder.hidden = !folder.querySelector("[data-bt-tool]:not([hidden])");
    });
    visible.textContent = shown;
    empty.hidden = shown !== 0;
  };

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      filter = chip.dataset.btFilter || "all";
      chips.forEach((item) => item.classList.toggle("is-active", item === chip));
      apply();
    });
  });

  search.addEventListener("input", apply);
})();
