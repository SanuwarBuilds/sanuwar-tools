"use strict";
(() => {
  const key = "sanuwar.tools.shortcuts.v1";
  const button = document.querySelector("[data-save-tool]");
  const shelf = document.querySelector("[data-saved-tools]");
  if (!button && !shelf) return;

  const valid = (entry) => entry &&
    typeof entry.path === "string" && /^(?:\/photo-tools|\/tools\/[a-z0-9-]+)$/.test(entry.path) &&
    typeof entry.name === "string" && Boolean(entry.name.trim()) && entry.name.length <= 80;
  const list = (value) => Array.isArray(value) ? value.filter(valid) : [];
  const photoEnabled = shelf?.dataset.photoAvailable !== "false";
  const read = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      return { favorites: list(saved?.favorites).slice(0, 50), recent: list(saved?.recent).slice(0, 6) };
    } catch {
      return { favorites: [], recent: [] };
    }
  };
  const write = (saved) => {
    try {
      localStorage.setItem(key, JSON.stringify(saved));
      return true;
    } catch {
      return false;
    }
  };

  if (button) {
    const current = { path: button.dataset.saveTool, name: button.dataset.saveName };
    const hasFavorite = (saved) => saved.favorites.some((item) => item.path === current.path);
    const refresh = () => {
      const favorite = hasFavorite(read());
      button.setAttribute("aria-pressed", String(favorite));
      button.textContent = favorite ? "Saved to favorites" : "Save to favorites";
    };
    const saved = read();
    saved.recent = [current, ...saved.recent.filter((item) => item.path !== current.path)].slice(0, 6);
    if (!valid(current) || !write(saved)) return;
    button.hidden = false;
    refresh();
    button.addEventListener("click", () => {
      const latest = read();
      if (hasFavorite(latest)) {
        latest.favorites = latest.favorites.filter((item) => item.path !== current.path);
      } else {
        latest.favorites = [current, ...latest.favorites].slice(0, 50);
      }
      if (write(latest)) refresh();
      else window.ST?.toast("Could not save this tool in your browser.");
    });
    window.addEventListener("storage", refresh);
    window.addEventListener("pageshow", refresh);
  }

  if (shelf) {
    const render = () => {
      const saved = read();
      for (const group of shelf.querySelectorAll("[data-tool-list]")) {
        const entries = saved[group.dataset.toolList].filter((entry) => photoEnabled || entry.path !== "/photo-tools");
        group.hidden = !entries.length;
        group.querySelector("ul").replaceChildren(...entries.map(({path, name}) => {
          const item = document.createElement("li");
          const link = document.createElement("a");
          link.href = path;
          link.textContent = name;
          item.append(link);
          return item;
        }));
      }
      shelf.hidden = !shelf.querySelector("[data-tool-list]:not([hidden])");
    };
    render();
    window.addEventListener("storage", render);
    window.addEventListener("pageshow", render);
  }
})();
