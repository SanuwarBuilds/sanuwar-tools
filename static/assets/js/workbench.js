"use strict";
(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const root = document.documentElement;

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
  let loading = false;
  let loadError = false;
  let resultLimit = 30;

  const loadTools = () => {
    if (!toolsPromise) {
      loading = true;
      loadError = false;
      toolsPromise = fetch("/api/search-index", { credentials: "same-origin", cache: "no-store" })
        .then(response => {
          if (!response.ok) throw new Error("Search unavailable");
          return response.json();
        }).then(feed => { tools = SiteSearch.prepare(feed.entries || []); })
        .catch(() => { loadError = true; toolsPromise = null; })
        .finally(() => { loading = false; });
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
    nodes.forEach((node, i) => {
      node.classList.toggle("is-selected", i === selected);
      node.setAttribute("aria-selected", String(i === selected));
    });
    paletteInput.setAttribute("aria-activedescendant", nodes[selected].id);
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
    const term = query.trim();
    let all = SiteSearch.search(tools, term);
    const smart = window.ToolSmartSearch?.parse(term);
    if (smart && tools.some(item => item.href.split("?")[0] === `/tools/${smart.slug}`)) {
      all = [{ name: smart.label, href: smart.href, category: "Calculate", description: "Open with your values filled in", mark: "=" }, ...all];
    }
    const matches = all.slice(0, term ? resultLimit : 12);
    paletteInput.removeAttribute("aria-activedescendant");
    results.replaceChildren();
    paletteBody?.querySelectorAll(".wb-palette-empty, .wb-search-more").forEach(node => node.remove());
    groupLabel.textContent = loading ? "Loading search…" : loadError ? "Search could not load. Try again." : term ? `${all.length} ${all.length === 1 ? "result" : "results"}` : "Jump to · Search everything";
    results.setAttribute("aria-busy", String(loading));
    if (loadError) {
      const retry = make("button", "wb-search-more", "Retry search");
      retry.type = "button";
      retry.addEventListener("click", () => { const pending = loadTools(); renderHits(paletteInput.value); pending.then(() => renderHits(paletteInput.value)); });
      paletteBody.append(retry);
      return;
    }
    if (loading) return;
    if (!matches.length) {
      groupLabel.textContent = "Search";
      paletteBody?.append(renderEmpty(query.trim()));
      selected = -1;
      return;
    }
    matches.forEach((item, index) => {
      const link = make("a", "wb-hit");
      link.href = item.href;
      link.id = `wb-result-${index}`;
      link.setAttribute("aria-selected", "false");
      link.addEventListener("click", () => closePalette());
      link.setAttribute("role", "option");
      link.setAttribute("tabindex", "-1");
      link.append(make("span", "wb-hit-mark", String(item.mark || "T").toUpperCase().slice(0, 1)));
      const copy = make("span", "wb-hit-copy");
      copy.append(make("strong", "", item.name));
      copy.append(make("small", "", `${item.category} · ${item.description || item.name}`));
      link.append(copy, make("span", "wb-hit-go", "↵"));
      link.addEventListener("mousemove", () => {
        const index = hitNodes().indexOf(link);
        if (index !== selected) selectHit(index);
      });
      const listItem = document.createElement("li");
      listItem.append(link);
      results.append(listItem);
    });
    if (term && all.length > matches.length) {
      const more = make("button", "wb-search-more", `Show more (${all.length - matches.length} remaining)`);
      more.type = "button";
      more.addEventListener("click", () => { resultLimit += 30; renderHits(paletteInput.value); selectHit(matches.length); });
      paletteBody.append(more);
    }
    selected = -1;
  };

  const closePalette = () => {
    if (!palette || palette.hidden) return;
    palette.hidden = true;
    paletteInput.setAttribute("aria-expanded", "false");
    document.body.classList.remove("modal-open");
    paletteTrigger?.setAttribute("aria-expanded", "false");
    paletteReturn?.focus?.();
    paletteReturn = null;
  };

  const openPalette = (query = "") => {
    if (!palette) return;
    if (!palette.hidden) return;
    closeNavMenus();
    paletteReturn = document.activeElement;
    palette.hidden = false;
    paletteInput.setAttribute("aria-expanded", "true");
    resultLimit = 30;
    if (!loading) toolsPromise = null;
    const pending = loadTools();
    document.body.classList.add("modal-open");
    paletteTrigger?.setAttribute("aria-expanded", "true");
    paletteInput.value = query;
    renderHits(query);
    requestAnimationFrame(() => {
      paletteInput.focus();
    });
    pending.then(() => {
      if (!palette.hidden) renderHits(paletteInput.value);
    });
  };

  paletteTrigger?.addEventListener("click", () => openPalette());
  paletteInput?.addEventListener("input", () => { resultLimit = 30; renderHits(paletteInput.value); });
  const homeSearch = $("#tool-search");
  homeSearch?.addEventListener("click", () => openPalette(homeSearch.value));
  homeSearch?.addEventListener("input", () => openPalette(homeSearch.value));
  homeSearch?.addEventListener("keydown", event => {
    if (event.key === "Enter") { event.preventDefault(); openPalette(homeSearch.value); }
  });
  $$("[data-site-search-open]").forEach(button => button.addEventListener("click", () => openPalette()));
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
  palette?.querySelector("[data-wb-search-close]")?.addEventListener("click", closePalette);

  /* ---------- Desktop navigation dropdowns ------------------------------- */
  const navMenus = $$("[data-nav-menu]");
  let navCloseTimer;
  const closeNavMenus = (except = null) => {
    navMenus.forEach(menu => {
      if (menu === except) return;
      menu.dataset.clicked = "false";
      menu.querySelector(".wb-nav-panel").hidden = true;
      menu.querySelector(".wb-nav-toggle").setAttribute("aria-expanded", "false");
    });
  };
  const navEntries = kind => {
    if (kind === "tools") return tools.filter(item => item.category === "Tool");
    if (kind === "categories") return tools.filter(item => item.category === "Category");
    if (kind === "directories") {
      const seen = new Set();
      const directories = tools.filter(item => item.category === "Directory" || (item.category === "Tool" && item.href.startsWith("/directory/")))
        .filter(item => { if (seen.has(item.href)) return false; seen.add(item.href); return true; });
      return [...directories, ...tools.filter(item => item.category === "Website")];
    }
    if (kind === "downloads") return tools.filter(item => ["Download", "Album", "File"].includes(item.category));
    if (kind === "eduhelp") return tools.filter(item => item.category === "Eduhelp" || item.href.startsWith("/eduhelp/labs"));
    if (kind === "players") return tools.filter(item => (item.keywords || "").includes("Players") || item.href === "/players");
    const pages = tools.filter(item => ["Page", "Admin", "Widget"].includes(item.category));
    return pages.filter(item => !["/", "/tools", "/downloads", "/directory", "/eduhelp", "/eduhelp/labs"].includes(item.href));
  };
  navMenus.forEach(menu => {
    const toggle = menu.querySelector(".wb-nav-toggle");
    const panel = menu.querySelector(".wb-nav-panel");
    const filter = menu.querySelector(".wb-nav-filter");
    const list = menu.querySelector(".wb-nav-links");
    let limit = 40;
    const draw = () => {
      list.replaceChildren();
      if (loading) { list.append(make("p", "wb-nav-status", "Loading…")); return; }
      if (loadError) {
        const retry = make("button", "wb-nav-retry", "Could not load this menu. Retry");
        retry.type = "button";
        retry.addEventListener("click", () => { const pending = loadTools(); draw(); pending.then(draw); });
        list.append(retry);
        return;
      }
      const entries = SiteSearch.search(navEntries(menu.dataset.navMenu), filter.value);
      if (!entries.length) {
        list.append(make("p", "wb-nav-status", filter.value ? "No matches. Try another name." : "No published items yet."));
        return;
      }
      entries.slice(0, limit).forEach(item => {
        const row = make("div", "wb-nav-row");
        row.setAttribute("role", "listitem");
        const link = make("a", "wb-nav-link");
        link.href = item.href;
        link.append(make("strong", "", item.name), make("small", "", `${item.category} · ${item.description || item.name}`));
        link.addEventListener("click", () => closeNavMenus());
        row.append(link);
        list.append(row);
      });
      if (entries.length > limit) {
        const more = make("button", "wb-nav-load-more", `Show more (${entries.length - limit} remaining)`);
        more.type = "button";
        more.addEventListener("click", () => {
          const previousLimit = limit;
          limit += 40;
          draw();
          list.querySelectorAll(".wb-nav-link")[previousLimit]?.focus();
        });
        list.append(more);
      }
    };
    const show = () => {
      clearTimeout(navCloseTimer);
      closeNavMenus(menu);
      if (!panel.hidden) return;
      panel.hidden = false;
      toggle.setAttribute("aria-expanded", "true");
      const pending = loadTools();
      draw();
      pending.then(draw);
    };
    menu.addEventListener("pointerenter", event => { if (event.pointerType === "mouse") show(); });
    menu.addEventListener("pointerleave", () => {
      navCloseTimer = setTimeout(() => {
        if (!menu.contains(document.activeElement)) closeNavMenus();
      }, 180);
    });
    toggle.addEventListener("click", () => {
      if (!panel.hidden && menu.dataset.clicked === "true") closeNavMenus();
      else { show(); menu.dataset.clicked = "true"; }
    });
    menu.addEventListener("focusout", event => { if (!menu.contains(event.relatedTarget)) closeNavMenus(); });
    menu.addEventListener("keydown", event => {
      if (event.key === "Escape") { event.preventDefault(); closeNavMenus(); toggle.focus(); }
      else if (event.key === "ArrowDown" && !event.target.matches("input")) {
        event.preventDefault(); show(); filter.focus();
      }
    });
    filter.addEventListener("input", () => { limit = 40; draw(); });
  });
  document.addEventListener("pointerdown", event => {
    if (!event.target.closest("[data-nav-menu]")) closeNavMenus();
  });
  window.addEventListener("resize", () => closeNavMenus());

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
      $$(".wb-more[open], .desk-footer-more[open]").forEach((details) => { details.open = false; });
    }
  });

  $$(".wb-more").forEach((details) => {
    document.addEventListener("click", (event) => {
      if (details.open && !details.contains(event.target)) details.open = false;
    });
  });

  /* Keep keyboard focus inside the open sheet. */
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const activeDialog = palette && !palette.hidden ? palette : sheet && !sheet.hidden ? sheet : null;
    if (!activeDialog) return;
    const focusable = $$("input, button:not([disabled]), a[href]:not([tabindex='-1'])", activeDialog);
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

  $$(".desk-footer-more").forEach(details => {
    document.addEventListener("click", event => {
      if (details.open && !details.contains(event.target)) details.open = false;
    });
  });

  /* ---------- Small conveniences ----------------------------------------- */
  if (root) {
    $$("[data-wb-year]").forEach((node) => { node.textContent = String(new Date().getFullYear()); });
  }
})();
