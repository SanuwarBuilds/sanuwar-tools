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
    const isWorkspace = shelf.classList.contains("desk-workspace");
    const iconFor = path => path.includes("pdf") ? ["pdf", "red"] : path.includes("image") || path.includes("photo") ? ["image", "blue"] : path.includes("calculator") ? ["calculator", "blue"] : path.includes("json") ? ["braces", "green"] : ["grid", "purple"];
    const favoriteButton = ({path, name}, saved) => {
      const toggle = document.createElement("button");
      toggle.className = "desk-star";
      toggle.type = "button";
      toggle.dataset.workspaceFavorite = path;
      toggle.dataset.favoriteName = name;
      const favorite = saved.favorites.some(item => item.path === path);
      toggle.setAttribute("aria-pressed", String(favorite));
      toggle.setAttribute("aria-label", `${favorite ? "Remove" : "Save"} ${name} ${favorite ? "from" : "to"} favorites`);
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("aria-hidden", "true");
      const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
      use.setAttribute("href", "/assets/icons/workspace.svg#star");
      svg.append(use); toggle.append(svg);
      return toggle;
    };
    const render = (focusPath = null) => {
      const saved = read();
      for (const group of shelf.querySelectorAll("[data-tool-list]")) {
        const entries = saved[group.dataset.toolList].filter(entry => photoEnabled || entry.path !== "/photo-tools");
        group.hidden = !entries.length;
        group.querySelector("ul").replaceChildren(...entries.map(entry => {
          const item = document.createElement("li");
          const link = document.createElement("a");
          link.href = entry.path;
          if (isWorkspace) {
            item.className = "desk-tool-row";
            const [symbol, tone] = iconFor(entry.path);
            const icon = document.createElement("span");
            icon.className = `desk-icon desk-icon-${tone}`;
            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("aria-hidden", "true");
            const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
            use.setAttribute("href", `/assets/icons/workspace.svg#${symbol}`); svg.append(use); icon.append(svg);
            const copy = document.createElement("span"); copy.className = "desk-row-copy";
            const title = document.createElement("strong"); title.textContent = entry.name;
            const sub = document.createElement("small"); sub.textContent = group.dataset.toolList === "recent" ? "Continue where you left off" : "Saved to your favorites";
            copy.append(title, sub); link.append(icon, copy); item.append(link, favoriteButton(entry, saved));
          } else { link.textContent = entry.name; item.append(link); }
          return item;
        }));
      }
      if (isWorkspace) {
        const defaults = shelf.querySelector("[data-workspace-default]");
        shelf.hidden = !defaults && !shelf.querySelector("[data-tool-list]:not([hidden])");
        if (defaults) defaults.hidden = !shelf.querySelector('[data-tool-list="recent"]').hidden;
        shelf.querySelectorAll("[data-workspace-favorite]").forEach(toggle => {
          const favorite = saved.favorites.some(item => item.path === toggle.dataset.workspaceFavorite);
          toggle.setAttribute("aria-pressed", String(favorite));
          toggle.setAttribute("aria-label", `${favorite ? "Remove" : "Save"} ${toggle.dataset.favoriteName} ${favorite ? "from" : "to"} favorites`);
        });
        if (focusPath) [...shelf.querySelectorAll("[data-workspace-favorite]")].find(toggle => toggle.dataset.workspaceFavorite === focusPath)?.focus();
      } else shelf.hidden = !shelf.querySelector("[data-tool-list]:not([hidden])");
    };
    shelf.addEventListener("click", event => {
      const toggle = event.target.closest("[data-workspace-favorite]");
      if (!toggle || !shelf.contains(toggle)) return;
      const current = {path: toggle.dataset.workspaceFavorite, name: toggle.dataset.favoriteName};
      if (!valid(current)) return;
      const latest = read();
      latest.favorites = latest.favorites.some(item => item.path === current.path)
        ? latest.favorites.filter(item => item.path !== current.path)
        : [current, ...latest.favorites].slice(0, 50);
      if (write(latest)) render(current.path);
      else window.ST?.toast("Could not save this tool in your browser.");
    });
    render();
    window.addEventListener("storage", () => render());
    window.addEventListener("pageshow", () => render());
  }
})();
