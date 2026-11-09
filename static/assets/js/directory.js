"use strict";
(() => {
  const input = document.querySelector("#directory-search");
  if (!input) return;

  const isHub = !document.querySelector("#directory-grid");
  const items = [...document.querySelectorAll(isHub ? ".dir-hub-card" : ".dir-site")];
  const visible = document.querySelector("#directory-visible");
  const empty = document.querySelector("#directory-empty");
  const tabs = [...document.querySelectorAll("#directory-groups [data-group]")];
  let activeGroup = "all";

  const setActiveTab = (group) => {
    activeGroup = group;
    tabs.forEach((tab) => {
      const active = tab.dataset.group === group;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-pressed", String(active));
    });
  };

  const apply = () => {
    const query = input.value.trim().toLowerCase();
    let count = 0;

    items.forEach((item) => {
      const groupOk = isHub || activeGroup === "all" || item.dataset.group === activeGroup;
      const queryOk = !query || (item.dataset.search || "").includes(query);
      const show = groupOk && queryOk;
      item.hidden = !show;
      if (show) count += 1;
    });

    if (visible) visible.textContent = String(count);
    if (empty) empty.hidden = count !== 0;
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      setActiveTab(tab.dataset.group || "all");
      apply();
    });
  });

  document.querySelector("#directory-clear")?.addEventListener("click", () => {
    input.value = "";
    setActiveTab("all");
    apply();
    input.focus();
  });

  input.addEventListener("input", apply);
  apply();
})();
