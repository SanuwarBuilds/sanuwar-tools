"use strict";
(() => {
  const input = document.querySelector("#eduhelp-search");
  if (!input) return;

  const cards = [...document.querySelectorAll(".edu-card")];
  const visible = document.querySelector("#eduhelp-visible");
  const empty = document.querySelector("#eduhelp-empty");
  const tabs = [...document.querySelectorAll("#eduhelp-filters [data-category]")];
  let activeCategory = "all";

  const setActiveTab = (category) => {
    activeCategory = category;
    tabs.forEach((tab) => {
      const active = tab.dataset.category === category;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-pressed", String(active));
    });
  };

  const apply = () => {
    const query = input.value.trim().toLowerCase();
    let count = 0;

    cards.forEach((card) => {
      const categoryOk =
        activeCategory === "all" || card.dataset.category === activeCategory;
      const queryOk = !query || (card.dataset.search || "").includes(query);
      const show = categoryOk && queryOk;
      card.hidden = !show;
      if (show) count += 1;
    });

    if (visible) visible.textContent = String(count);
    if (empty) empty.hidden = count !== 0;
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      setActiveTab(tab.dataset.category || "all");
      apply();
    });
  });

  document.querySelector("#eduhelp-clear")?.addEventListener("click", () => {
    input.value = "";
    setActiveTab("all");
    apply();
    input.focus();
  });

  input.addEventListener("input", apply);
  apply();
})();
