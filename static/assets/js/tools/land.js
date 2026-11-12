"use strict";
(() => {
  const T = window.SANU_TOOLS;
  const DATA = window.LAND_DATA;
  const STRINGS = window.LAND_I18N;
  const ENGINE = window.LAND_ENGINE;

  if (!T || !DATA || !STRINGS || !ENGINE) {
    console.error("Land measurement calculator assets are missing.");
    return;
  }

  const { el, toast } = T;
  const { createLandEngine, parseArea } = ENGINE;
  const engine = createLandEngine(DATA);
  const STORAGE_KEY = "land-lang";

  const state = {
    lang: "en",
    regionId: "assam",
    standardId: "assam-brahmaputra",
    fromId: "",
    toId: "",
    area: "",
    mode: "auto",
  };

  let rootEl = null;

  const t = (key) => {
    const dictionary = STRINGS[state.lang] || STRINGS.en;
    return dictionary[key] ?? STRINGS.en[key] ?? key;
  };

  const localized = (value) => (value ? value[state.lang] || value.en || "" : "");

  const errorKey = (code) => "error" + code.charAt(0).toUpperCase() + code.slice(1);

  function validLang(value) {
    return typeof value === "string" && Object.prototype.hasOwnProperty.call(STRINGS, value) ? value : "";
  }

  function detectLang(params) {
    const fromUrl = validLang(params.get("lang"));
    if (fromUrl) return fromUrl;
    try {
      const saved = validLang(localStorage.getItem(STORAGE_KEY));
      if (saved) return saved;
    } catch {}
    const prefix = String(navigator.language || "").slice(0, 2);
    return validLang(prefix) || "en";
  }

  function hydrate(params) {
    state.lang = detectLang(params);
    const region = params.get("state") ? engine.getRegion(params.get("state")) : null;
    state.regionId = region ? region.id : "assam";
    const standards = engine.getStandardOptions(state.regionId);
    const wanted = standards.find((standard) => standard.id === params.get("standard"));
    state.standardId = (wanted || standards[0] || { id: "common" }).id;
    const units = engine.unitsFor(state.regionId, state.standardId);
    const defaults = engine.defaultUnits(state.regionId, state.standardId);
    const from = units.find((unit) => unit.id === params.get("from"));
    const to = units.find((unit) => unit.id === params.get("to"));
    state.fromId = (from || defaults.from).id;
    state.toId = (to || defaults.to || defaults.from).id;
    state.area = params.get("area") || "";
    state.mode = params.get("precision") === "precise" ? "precise" : "auto";
  }

  function ensureUnits() {
    const units = engine.unitsFor(state.regionId, state.standardId);
    const defaults = engine.defaultUnits(state.regionId, state.standardId);
    if (!units.some((unit) => unit.id === state.fromId)) state.fromId = defaults.from.id;
    if (!units.some((unit) => unit.id === state.toId)) state.toId = defaults.to.id;
  }

  function writeUrl() {
    const params = new URLSearchParams(location.search);
    params.set("state", state.regionId);
    if (state.standardId && state.standardId !== "common") params.set("standard", state.standardId);
    else params.delete("standard");
    params.set("from", state.fromId);
    params.set("to", state.toId);
    if (state.area.trim()) params.set("area", state.area.trim());
    else params.delete("area");
    if (state.mode === "precise") params.set("precision", "precise");
    else params.delete("precision");
    params.set("lang", state.lang);
    const query = params.toString();
    try {
      history.replaceState(null, "", `${location.pathname}${query ? "?" + query : ""}${location.hash}`);
    } catch {}
  }

  function compute() {
    const parsed = parseArea(state.area);
    if (!parsed.ok) return { status: parsed.code === "empty" ? "empty" : "error", code: parsed.code };
    const units = engine.unitsFor(state.regionId, state.standardId);
    const from = units.find((unit) => unit.id === state.fromId) || units[0];
    const to = units.find((unit) => unit.id === state.toId) || units[1] || units[0];
    if (!from || !to) return { status: "error", code: "invalid" };
    try {
      const conversion = engine.convert(parsed.value, from, to);
      const main = engine.formatValue(conversion.sqm, to, state.lang, state.mode);
      const secondary = [];
      ["sqft", "sqm", "acre"].forEach((unitId) => {
        const unit = units.find((item) => item.id === unitId);
        if (unit) secondary.push({ unit, ...engine.formatNumber(conversion.sqm / unit.sqm, state.lang, state.mode) });
      });
      return {
        status: "ok",
        main,
        to,
        from,
        secondary,
        sqm: conversion.sqm,
        parts: engine.breakdown(conversion.sqm, state.regionId, state.standardId, state.lang, state.mode),
        standard: engine.getStandard(state.regionId, state.standardId),
        region: engine.getRegion(state.regionId),
      };
    } catch (error) {
      return { status: "error", code: error.code || "invalid" };
    }
  }

  function resultCopyText(result) {
    const primary = `${result.main.approx ? "≈ " : ""}${result.main.text} ${engine.label(result.to, state.lang)}`;
    const secondary = result.secondary
      .map((item) => `${item.approx ? "≈ " : ""}${item.text} ${engine.label(item.unit, state.lang)}`)
      .join(" · ");
    const standard = result.standard ? engine.label(result.standard, state.lang) : t("commonStandard");
    return `${primary} = ${secondary} (${t("resultBasedOn").replace("{standard}", standard)})`;
  }

  async function copyText(value) {
    try {
      await navigator.clipboard.writeText(value);
      toast(t("copied"));
    } catch {
      const proxy = el("textarea", { class: "lm-copy-proxy", value });
      document.body.append(proxy);
      proxy.select();
      try {
        document.execCommand("copy");
        toast(t("copied"));
      } catch {
        toast(t("errorInvalid"));
      }
      proxy.remove();
    }
  }

  function renderFaqs() {
    const host = document.querySelector("[data-land-faq]");
    if (!host) return;
    const faqs = t("faqs") || [];
    host.replaceChildren(...faqs.map((item) => el("details", { class: "lm-faq-item" },
      el("summary", { text: item.q }),
      el("p", { text: item.a }))));
  }

  function renderDisclaimer() {
    const title = document.querySelector("[data-land-disclaimer-title]");
    if (title) title.textContent = t("disclaimerTitle");
    const body = document.querySelector("[data-land-disclaimer]");
    if (body) body.textContent = t("disclaimer");
  }

  function setLanguage(lang) {
    if (!validLang(lang) || lang === state.lang) return;
    state.lang = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {}
    document.documentElement.lang = lang;
    render();
    renderFaqs();
    renderDisclaimer();
  }

  function render() {
    if (!rootEl) return;
    ensureUnits();
    const result = compute();
    rootEl.replaceChildren(
      buildToolbar(),
      el("div", { class: "lm-grid" },
        buildConvertPanel(),
        el("div", { class: "lm-side" }, buildResult(result), buildQuick(result))),
      buildReference());
    writeUrl();
  }

  function recalc() {
    if (!rootEl) return;
    const result = compute();
    const currentResult = rootEl.querySelector("#lm-result");
    const currentQuick = rootEl.querySelector("#lm-quick");
    const error = rootEl.querySelector("#lm-area-error");
    if (currentResult) currentResult.replaceWith(buildResult(result));
    if (currentQuick) currentQuick.replaceWith(buildQuick(result));
    if (error) {
      if (result.status === "error") {
        error.textContent = t(errorKey(result.code));
        error.hidden = false;
      } else {
        error.textContent = "";
        error.hidden = true;
      }
    }
    const input = rootEl.querySelector(".lm-area-input");
    if (input) input.setAttribute("aria-invalid", String(result.status === "error"));
    writeUrl();
  }

  function unitHint(unit) {
    if (!unit) return "";
    const name = engine.label(unit, state.lang);
    if (unit.id === "sqft") {
      return `1 ${name} = ${engine.formatNumber(unit.sqm, state.lang, "auto").text} ${t("tableSqm")}`;
    }
    return `1 ${name} = ${engine.formatNumber(unit.sqft, state.lang, "auto").text} ${t("tableSqft")}`;
  }

  function selectField(labelText, control) {
    const wrap = el("label", { class: "lm-field" });
    wrap.append(el("span", { class: "lm-label", text: labelText }), control);
    return wrap;
  }

  function buildToolbar() {
    const languages = el("div", { class: "lm-lang", role: "group", "aria-label": t("languageLabel") });
    DATA.languages.forEach((language) => {
      languages.append(el("button", {
        type: "button",
        class: "lm-lang-btn" + (language.id === state.lang ? " is-active" : ""),
        "aria-pressed": String(language.id === state.lang),
        onclick: () => setLanguage(language.id),
      }, language.label));
    });
    return el("div", { class: "lm-toolbar" },
      languages,
      el("button", { type: "button", class: "lm-print", onclick: () => window.print() }, t("printLabel")));
  }

  function buildConvertPanel() {
    const regionSelect = el("select", { class: "lm-select", "aria-label": t("stateLabel") });
    engine.regions.forEach((region) => {
      regionSelect.append(el("option", {
        value: region.id,
        text: engine.label(region, state.lang),
        selected: region.id === state.regionId,
      }));
    });
    regionSelect.addEventListener("change", () => {
      state.regionId = regionSelect.value;
      const standards = engine.getStandardOptions(state.regionId);
      state.standardId = standards[0] ? standards[0].id : "common";
      const defaults = engine.defaultUnits(state.regionId, state.standardId);
      state.fromId = defaults.from.id;
      state.toId = defaults.to.id;
      render();
    });

    const standards = engine.getStandardOptions(state.regionId);
    const standardSelect = el("select", { class: "lm-select", "aria-label": t("standardLabel") });
    if (standards.length) {
      standards.forEach((standard) => {
        standardSelect.append(el("option", {
          value: standard.id,
          text: engine.label(standard, state.lang),
          selected: standard.id === state.standardId,
        }));
      });
    } else {
      standardSelect.append(el("option", { value: "common", text: t("commonStandard"), selected: true }));
      standardSelect.disabled = true;
    }
    standardSelect.addEventListener("change", () => {
      if (standardSelect.value === "common") return;
      state.standardId = standardSelect.value;
      const defaults = engine.defaultUnits(state.regionId, state.standardId);
      state.fromId = defaults.from.id;
      state.toId = defaults.to.id;
      render();
    });

    const areaInput = el("input", {
      class: "lm-area-input",
      type: "text",
      inputmode: "decimal",
      autocomplete: "off",
      spellcheck: "false",
      value: state.area,
      placeholder: t("areaPlaceholder"),
      "aria-describedby": "lm-area-error",
    });
    areaInput.addEventListener("input", () => {
      state.area = areaInput.value;
      recalc();
    });

    const initial = compute();
    const error = el("p", {
      class: "lm-error",
      id: "lm-area-error",
      role: "alert",
      hidden: initial.status === "ok" || initial.status === "empty",
    });
    if (initial.status === "error") error.textContent = t(errorKey(initial.code));

    const swap = el("button", {
      type: "button",
      class: "lm-swap",
      onclick: () => {
        const from = state.fromId;
        state.fromId = state.toId;
        state.toId = from;
        render();
      },
    }, el("span", { "aria-hidden": "true", text: "⇅" }), t("swap"));

    const convertButton = el("button", {
      type: "button",
      class: "lm-convert-btn",
      onclick: () => recalc(),
    }, t("convert"));

    const standard = engine.getStandard(state.regionId, state.standardId);
    const note = standard && standard.note ? el("p", { class: "lm-note", text: localized(standard.note) }) : null;
    const warning = !standard ? el("p", { class: "lm-warning", text: t("noStandard") }) : null;

    return el("section", { class: "lm-panel lm-convert-panel" },
      el("div", { class: "lm-panel-head" },
        el("h2", { text: t("panelConvert") }),
        el("p", { class: "lm-hint", text: t("panelConvertHint") })),
      el("div", { class: "lm-row lm-row-two" },
        selectField(t("stateLabel"), regionSelect),
        selectField(t("standardLabel"), standardSelect)),
      el("div", { class: "lm-row lm-row-two" },
        selectField(t("areaLabel"), areaInput),
        buildCombo("from", t("fromLabel"))),
      el("div", { class: "lm-row lm-row-swap" }, swap),
      el("div", { class: "lm-row" }, buildCombo("to", t("toLabel"))),
      error,
      note,
      warning,
      el("div", { class: "lm-actions" }, convertButton));
  }

  function buildCombo(kind, labelText) {
    const units = engine.unitsFor(state.regionId, state.standardId);
    const current = units.find((unit) => unit.id === state[kind + "Id"]) || units[0];
    const localIds = new Set(engine.localUnits(state.regionId, state.standardId).map((unit) => unit.id));
    const idBase = "lm-" + kind;
    const wrap = el("div", { class: "lm-combo" });
    const label = el("span", { class: "lm-label", id: idBase + "-label", text: labelText });
    const trigger = el("button", {
      type: "button",
      class: "lm-combo-trigger",
      "aria-haspopup": "listbox",
      "aria-expanded": "false",
      "aria-labelledby": idBase + "-label " + idBase + "-value",
    });
    trigger.append(
      el("span", { class: "lm-combo-text" },
        el("span", { class: "lm-combo-value", id: idBase + "-value", text: engine.label(current, state.lang) }),
        el("span", { class: "lm-combo-meta", text: unitHint(current) })),
      el("span", { class: "lm-combo-caret", "aria-hidden": "true", text: "▾" }));
    const panel = el("div", { class: "lm-combo-panel", hidden: true });
    const search = el("input", {
      type: "search",
      class: "lm-combo-search",
      placeholder: t("searchPlaceholder"),
      autocomplete: "off",
      "aria-controls": idBase + "-list",
      "aria-autocomplete": "list",
      "aria-labelledby": idBase + "-label",
    });
    const list = el("ul", { class: "lm-combo-list", id: idBase + "-list", role: "listbox", "aria-labelledby": idBase + "-label" });
    const empty = el("p", { class: "lm-combo-empty", text: t("noUnits"), hidden: true });
    panel.append(search, list, empty);
    wrap.append(label, trigger, panel);

    let open = false;
    let activeIndex = -1;
    let options = [];
    let outside = null;

    function buildList(query) {
      list.replaceChildren();
      options = [];
      activeIndex = -1;
      search.removeAttribute("aria-activedescendant");
      const matches = engine.searchUnits(query, units, state.lang);
      const groups = [
        { title: t("localGroup"), items: matches.filter((unit) => localIds.has(unit.id)) },
        { title: t("commonGroup"), items: matches.filter((unit) => !localIds.has(unit.id)) },
      ].filter((group) => group.items.length);
      empty.hidden = matches.length > 0;
      groups.forEach((group) => {
        list.append(el("li", { class: "lm-combo-group", role: "presentation", text: group.title }));
        group.items.forEach((unit) => {
          const item = el("li", {
            class: "lm-combo-option" + (unit.id === state[kind + "Id"] ? " is-selected" : ""),
            id: idBase + "-opt-" + unit.id,
            role: "option",
            "aria-selected": String(unit.id === state[kind + "Id"]),
          });
          item.append(
            el("span", { class: "lm-combo-option-name", text: engine.label(unit, state.lang) }),
            el("span", { class: "lm-combo-option-meta", text: unitHint(unit) }));
          item.addEventListener("pointerdown", (event) => event.preventDefault());
          item.addEventListener("click", () => choose(unit));
          list.append(item);
          options.push(item);
        });
      });
    }

    function highlight() {
      options.forEach((item, index) => item.classList.toggle("is-active", index === activeIndex));
      const active = options[activeIndex];
      if (active) {
        search.setAttribute("aria-activedescendant", active.id);
        active.scrollIntoView({ block: "nearest" });
      } else {
        search.removeAttribute("aria-activedescendant");
      }
    }

    function move(step) {
      if (!options.length) return;
      if (activeIndex < 0) activeIndex = step >= 0 ? 0 : options.length - 1;
      else activeIndex = (activeIndex + step + options.length) % options.length;
      highlight();
    }

    function choose(unit) {
      state[kind + "Id"] = unit.id;
      setOpen(false);
      render();
    }

    function setOpen(next) {
      if (open === next) return;
      open = next;
      panel.hidden = !open;
      trigger.setAttribute("aria-expanded", String(open));
      if (open) {
        search.value = "";
        buildList("");
        if (outside) document.addEventListener("pointerdown", outside, true);
        requestAnimationFrame(() => search.focus());
      } else if (outside) {
        document.removeEventListener("pointerdown", outside, true);
      }
    }

    outside = (event) => {
      if (!wrap.contains(event.target)) setOpen(false);
    };

    trigger.addEventListener("click", () => setOpen(!open));
    search.addEventListener("input", () => buildList(search.value));
    search.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        trigger.focus();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        move(1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        move(-1);
      } else if (event.key === "Home") {
        event.preventDefault();
        activeIndex = 0;
        highlight();
      } else if (event.key === "End") {
        event.preventDefault();
        activeIndex = options.length - 1;
        highlight();
      } else if (event.key === "Enter") {
        const active = options[activeIndex];
        if (active) {
          event.preventDefault();
          active.click();
        }
      } else if (event.key === "Tab") {
        setOpen(false);
      }
    });

    return wrap;
  }

  function buildResult(result) {
    const region = engine.getRegion(state.regionId);
    const standard = engine.getStandard(state.regionId, state.standardId);
    const scope = [region ? engine.label(region, state.lang) : "", standard ? engine.label(standard, state.lang) : t("commonStandard")]
      .filter(Boolean)
      .join(" · ");
    const section = el("section", { class: "lm-deed" + (result.status === "ok" ? "" : " is-empty"), id: "lm-result", "aria-live": "polite" });
    section.append(el("span", { class: "lm-stamp", "aria-hidden": "true", text: t("stamp") }));
    section.append(el("div", { class: "lm-deed-head" },
      el("div", { class: "lm-deed-kicker", text: t("resultLabel") }),
      el("div", { class: "lm-deed-standard", text: scope })));

    if (result.status === "ok") {
      const unitName = engine.label(result.to, state.lang);
      const value = el("div", { class: "lm-deed-value" });
      if (result.main.approx) value.append(el("span", { class: "lm-deed-approx", text: "≈" }));
      value.append(
        el("span", { class: "lm-deed-number", text: result.main.text }),
        el("span", { class: "lm-deed-unit", text: unitName }));
      section.append(value);
      section.append(el("p", {
        class: "lm-deed-secondary",
        text: result.secondary
          .map((item) => `${item.approx ? "≈ " : ""}${item.text} ${engine.label(item.unit, state.lang)}`)
          .join(" · "),
      }));
      if (result.parts.length) {
        section.append(el("p", { class: "lm-deed-breakdown" },
          el("span", { class: "lm-deed-breakdown-label", text: t("breakdownLabel") }),
          el("span", { class: "lm-deed-breakdown-value", text: result.parts
            .map((part) => `${part.approx ? "≈" : ""}${part.text} ${engine.label(part.unit, state.lang)}`)
            .join(" · ") })));
      }
      const copyButton = el("button", {
        type: "button",
        class: "lm-deed-copy",
        onclick: () => copyText(resultCopyText(result)),
      }, t("resultCopy"));
      const precision = el("div", { class: "lm-seg", role: "group", "aria-label": t("precisionLabel") });
      [["auto", t("precisionAuto")], ["precise", t("precisionMore")]].forEach(([mode, label]) => {
        precision.append(el("button", {
          type: "button",
          class: "lm-seg-btn" + (state.mode === mode ? " is-active" : ""),
          "aria-pressed": String(state.mode === mode),
          onclick: () => {
            state.mode = mode;
            render();
          },
        }, label));
      });
      section.append(el("div", { class: "lm-deed-foot" }, copyButton, precision));
    } else {
      section.append(el("div", { class: "lm-deed-empty" },
        el("strong", { text: result.status === "empty" ? t("resultEmptyTitle") : t(errorKey(result.code)) }),
        el("p", { text: result.status === "empty" ? t("resultEmptyBody") : t("panelConvertHint") })));
    }
    return section;
  }

  function buildQuick(result) {
    const section = el("section", { class: "lm-panel lm-quick", id: "lm-quick" });
    section.append(el("div", { class: "lm-panel-head" },
      el("h2", { text: t("quickTable") }),
      el("p", { class: "lm-hint", text: t("quickTableHint") })));
    if (result.status !== "ok") {
      section.append(el("p", { class: "lm-muted", text: t("quickEmpty") }));
      return section;
    }
    const rows = engine.conversionRows(result.sqm, engine.unitsFor(state.regionId, state.standardId), state.lang, state.mode);
    const table = el("table", { class: "lm-table" });
    table.append(el("thead", {}, el("tr", {},
      el("th", { scope: "col", text: t("tableUnit") }),
      el("th", { scope: "col", text: t("tableValue") }))));
    const body = el("tbody");
    rows.forEach((row) => {
      const tr = el("tr", { class: row.unit.id === state.toId ? "is-current" : "" });
      const cell = el("th", { scope: "row" });
      cell.append(el("button", {
        type: "button",
        class: "lm-row-btn",
        onclick: () => {
          state.toId = row.unit.id;
          render();
        },
      }, engine.label(row.unit, state.lang)));
      tr.append(cell, el("td", { text: `${row.approx ? "≈ " : ""}${row.text}` }));
      body.append(tr);
    });
    table.append(body);
    section.append(table);
    return section;
  }

  function buildReference() {
    const region = engine.getRegion(state.regionId);
    const standard = engine.getStandard(state.regionId, state.standardId);
    const section = el("section", { class: "lm-panel lm-reference" });
    section.append(el("div", { class: "lm-panel-head" },
      el("h2", { text: t("standardTable") }),
      el("p", { class: "lm-hint", text: t("standardTableHint") })));
    section.append(el("p", {
      class: "lm-ref-scope",
      text: [region ? engine.label(region, state.lang) : "", standard ? engine.label(standard, state.lang) : t("commonStandard")]
        .filter(Boolean)
        .join(" — "),
    }));

    const relations = engine.relationRows(state.regionId, state.standardId);
    if (relations.length) {
      section.append(el("p", {
        class: "lm-relations",
        text: relations.map((relation) => `1 ${engine.label(relation.from, state.lang)} = ${engine.formatNumber(relation.factor, state.lang).text} ${engine.label(relation.to, state.lang)}`).join(" · "),
      }));
    }
    if (standard && standard.note) section.append(el("p", { class: "lm-note", text: localized(standard.note) }));
    if (!standard) section.append(el("p", { class: "lm-warning", text: t("noStandard") }));

    const table = el("table", { class: "lm-table lm-ref-table" });
    table.append(el("thead", {}, el("tr", {},
      el("th", { scope: "col", text: t("tableUnit") }),
      el("th", { scope: "col", text: t("tableSqft") }),
      el("th", { scope: "col", text: t("tableSqm") }))));
    const body = el("tbody");
    engine.referenceRows(state.regionId, state.standardId, state.lang, state.mode).forEach((row) => {
      body.append(el("tr", {},
        el("th", { scope: "row", text: engine.label(row.unit, state.lang) }),
        el("td", { text: row.sqft }),
        el("td", { text: row.sqm })));
    });
    table.append(body);
    section.append(table);
    return section;
  }

  function mount(root) {
    rootEl = root;
    hydrate(new URLSearchParams(location.search));
    ensureUnits();
    render();
    renderFaqs();
    renderDisclaimer();
  }

  T.register("land-measurement-calculator", mount);
})();
