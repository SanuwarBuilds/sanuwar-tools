"use strict";
(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const root = document.documentElement;

  const PAGES = [
    { name: "All browser tools", description: "Every tool on one shelf", href: "/tools", category: "Page", mark: "T" },
    { name: "Photo tools", description: "Resize and compress photos locally", href: "/photo-tools", category: "Page", mark: "P" },
    { name: "Downloads", description: "Android apps, files and albums", href: "/downloads", category: "Page", mark: "D" },
    { name: "Directories", description: "Movies, anime, music and more", href: "/directory", category: "Page", mark: "D" },
    { name: "Eduhelp", description: "Exam updates and study notes", href: "/eduhelp", category: "Page", mark: "E" },
    { name: "Lab library", description: "Interactive 3D science labs", href: "/eduhelp/labs", category: "Page", mark: "L" },
    { name: "How it works", description: "Open. Work. Done.", href: "/#how-it-works", category: "Page", mark: "H" },
    { name: "About", description: "What this toolkit is", href: "/about", category: "Page", mark: "A" },
    { name: "Contact", description: "Suggest a tool or report a page", href: "/contact", category: "Page", mark: "C" },
    { name: "Privacy", description: "How your data is handled", href: "/privacy", category: "Page", mark: "P" },
  ];

  const platform = navigator.userAgentData?.platform || navigator.platform || "";
  const kbdHint = $("[data-wb-kbd]");
  const isMac = /mac|iphone|ipad/i.test(platform);
  if (kbdHint) kbdHint.textContent = isMac ? "⌘K" : "Ctrl K";

  /* ---------- Search palette --------------------------------------------- */
  const palette = $("#wb-palette");
  const paletteInput = $("#wb-search-input");
  const results = $("#wb-search-results");
  const groupLabel = $("#wb-search-group");
  const paletteBody = $("#wb-palette-body");
  const paletteTrigger = $("#wb-search-open");
  let paletteReturn = null;
  let selected = -1;
  let toolsPromise = null;
  let tools = [];

  const safeRoute = (value) =>
    typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "";

  const loadTools = () => {
    if (!toolsPromise) {
      toolsPromise = Promise.all([
        fetch("/api/browser-tools.json", { credentials: "same-origin" }).then((response) => response.ok ? response.json() : { tools: [] }).catch(() => ({ tools: [] })),
        fetch("/tools.config.json", { credentials: "same-origin" }).then((response) => response.ok ? response.json() : { tools: [] }).catch(() => ({ tools: [] })),
      ]).then(([feed, config]) => {
        const seen = new Set();
        const collect = (entry) => {
          const href = safeRoute(entry.route);
          if (!href || seen.has(href)) return;
          seen.add(href);
          tools.push({
            name: String(entry.name || "Untitled tool"),
            description: String(entry.description || entry.category || ""),
            href,
            category: String(entry.category || "Tool"),
            mark: String(entry.category || entry.name || "T").trim().charAt(0) || "T",
          });
        };
        (config.tools || []).filter((entry) => entry.visible !== false).forEach(collect);
        (feed.tools || []).filter((entry) => entry.visible !== false).forEach(collect);
        return tools;
      });
    }
    return toolsPromise;
  };

  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const hitNodes = () => $$(".wb-hit", results);

  const selectHit = (index) => {
    const nodes = hitNodes();
    if (!nodes.length) return;
    selected = (index + nodes.length) % nodes.length;
    nodes.forEach((node, i) => node.classList.toggle("is-selected", i === selected));
    nodes[selected].scrollIntoView({ block: "nearest" });
  };

  const renderEmpty = (query) => {
    const empty = make("div", "wb-palette-empty");
    empty.append(make("p", "", query ? `Nothing matched “${query}”.` : "Start typing to search the toolkit."));
    const chips = make("div", "wb-palette-chips");
    ["GST", "PDF", "photo", "password", "QR code"].forEach((term) => {
      const button = make("button", "", term);
      button.type = "button";
      button.addEventListener("click", () => {
        paletteInput.value = term;
        renderHits(term);
        paletteInput.focus();
      });
      chips.append(button);
    });
    empty.append(chips);
    return empty;
  };

  const renderHits = (query) => {
    if (!results) return;
    const term = query.trim().toLowerCase();
    const pool = [...tools, ...PAGES];
    const matches = term
      ? pool.filter((item) => `${item.name} ${item.description} ${item.category}`.toLowerCase().includes(term)).slice(0, 12)
      : [...PAGES.slice(0, 6), ...tools.slice(0, 5)];
    results.replaceChildren();
    paletteBody?.querySelector(".wb-palette-empty")?.remove();
    groupLabel.textContent = term ? "Results" : "Jump to";
    if (!matches.length) {
      groupLabel.textContent = "Search";
      paletteBody?.append(renderEmpty(query.trim()));
      selected = -1;
      return;
    }
    matches.forEach((item) => {
      const link = make("a", "wb-hit");
      link.href = item.href;
      link.setAttribute("role", "option");
      link.setAttribute("tabindex", "-1");
      link.append(make("span", "wb-hit-mark", String(item.mark || "T").toUpperCase().slice(0, 1)));
      const copy = make("span", "wb-hit-copy");
      copy.append(make("strong", "", item.name));
      copy.append(make("small", "", item.description));
      link.append(copy, make("span", "wb-hit-go", "↵"));
      link.addEventListener("mousemove", () => {
        const index = hitNodes().indexOf(link);
        if (index !== selected) selectHit(index);
      });
      const listItem = document.createElement("li");
      listItem.append(link);
      results.append(listItem);
    });
    selected = -1;
  };

  const closePalette = () => {
    if (!palette || palette.hidden) return;
    palette.hidden = true;
    document.body.classList.remove("modal-open");
    paletteTrigger?.setAttribute("aria-expanded", "false");
    paletteReturn?.focus?.();
    paletteReturn = null;
  };

  const openPalette = (query = "") => {
    if (!palette) return;
    paletteReturn = document.activeElement;
    palette.hidden = false;
    document.body.classList.add("modal-open");
    paletteTrigger?.setAttribute("aria-expanded", "true");
    paletteInput.value = query;
    renderHits(query);
    requestAnimationFrame(() => {
      paletteInput.focus();
      paletteInput.select();
    });
    loadTools().then(() => {
      if (!palette.hidden) renderHits(paletteInput.value);
    });
  };

  paletteTrigger?.addEventListener("click", () => openPalette());
  paletteInput?.addEventListener("input", () => renderHits(paletteInput.value));
  paletteInput?.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      selectHit(selected + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      selectHit(selected <= 0 ? hitNodes().length - 1 : selected - 1);
    } else if (event.key === "Enter") {
      const nodes = hitNodes();
      const target = nodes[selected] || nodes[0];
      if (target) {
        event.preventDefault();
        target.click();
      }
    }
  });
  palette?.querySelector("[data-wb-palette-close]")?.addEventListener("click", closePalette);

  /* ---------- More sheet -------------------------------------------------- */
  const sheet = $("#wb-more");
  const sheetTrigger = $("#wb-more-open");
  let sheetReturn = null;

  const sheetFocusable = () => $$("a[href], button:not([disabled])", sheet);
  const closeSheet = () => {
    if (!sheet || sheet.hidden) return;
    sheet.hidden = true;
    document.body.classList.remove("modal-open");
    sheetTrigger?.setAttribute("aria-expanded", "false");
    sheetReturn?.focus?.();
    sheetReturn = null;
  };
  const openSheet = () => {
    if (!sheet) return;
    sheetReturn = document.activeElement;
    sheet.hidden = false;
    document.body.classList.add("modal-open");
    sheetTrigger?.setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => sheetFocusable()[0]?.focus());
  };

  sheetTrigger?.addEventListener("click", openSheet);
  $$("[data-wb-close]", sheet || document).forEach((node) => node.addEventListener("click", closeSheet));

  /* ---------- Global keys ------------------------------------------------- */
  document.addEventListener("keydown", (event) => {
    const target = event.target;
    const typing = target instanceof HTMLElement && (target.matches("input, textarea, select") || target.isContentEditable);
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if (palette?.hidden === false) closePalette();
      else openPalette();
      return;
    }
    if (event.key === "/" && !typing && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const homeSearch = $("#tool-search");
      if (homeSearch) {
        event.preventDefault();
        homeSearch.focus();
        return;
      }
      if (palette?.hidden !== false) {
        event.preventDefault();
        openPalette();
      }
      return;
    }
    if (event.key === "Escape") {
      if (sheet && !sheet.hidden) {
        event.preventDefault();
        closeSheet();
        return;
      }
      if (palette && !palette.hidden) {
        event.preventDefault();
        closePalette();
        return;
      }
      $$(".wb-more[open]").forEach((details) => { details.open = false; });
    }
  });

  $$(".wb-more").forEach((details) => {
    document.addEventListener("click", (event) => {
      if (details.open && !details.contains(event.target)) details.open = false;
    });
  });

  /* Keep keyboard focus inside the open sheet. */
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Tab" || !sheet || sheet.hidden) return;
    const focusable = sheetFocusable();
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  /* ---------- Small conveniences ----------------------------------------- */
  if (root) {
    $$("[data-wb-year]").forEach((node) => { node.textContent = String(new Date().getFullYear()); });
  }
})();
