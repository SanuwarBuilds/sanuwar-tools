"use strict";
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.LAND_ENGINE = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const SQFT_TO_SQM = 0.09290304;
  const MAX_SQFT = 1e10;
  const LOCALES = { en: "en-IN", hi: "hi-IN", as: "as-IN" };

  class LandError extends Error {
    constructor(code) {
      super(code);
      this.name = "LandError";
      this.code = code;
    }
  }

  function normalizeDigits(value) {
    return String(value ?? "").replace(/[\u09e6-\u09ef\u0966-\u096f]/g, (character) => {
      const code = character.charCodeAt(0);
      return String(code >= 0x09e6 ? code - 0x09e6 : code - 0x0966);
    });
  }

  function parseArea(raw) {
    const text = normalizeDigits(raw).trim();
    if (!text) return { ok: false, code: "empty" };
    const compact = text.replace(/[\s\u00a0\u202f,]/g, "");
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(compact)) return { ok: false, code: "invalid" };
    const value = Number(compact);
    if (!Number.isFinite(value)) return { ok: false, code: "invalid" };
    if (value < 0) return { ok: false, code: "negative" };
    if (value === 0) return { ok: false, code: "zero" };
    return { ok: true, value };
  }

  function localeFor(lang) {
    return LOCALES[lang] || "en-IN";
  }

  function fractionDigits(value, mode) {
    const size = Math.abs(value);
    let digits = mode === "precise"
      ? (size < 1 ? 8 : size < 1000 ? 6 : size < 1e6 ? 4 : 2)
      : (size < 1 ? 6 : size < 1000 ? 4 : size < 1e6 ? 2 : 0);
    if (size >= 1e9) digits = 0;
    else if (size >= 1e6) digits = Math.min(digits, 2);
    return digits;
  }

  function formatNumber(value, lang, mode = "auto") {
    if (!Number.isFinite(value)) return { text: "—", approx: false, value: Number.NaN };
    const digits = fractionDigits(value, mode);
    const factor = Math.pow(10, digits);
    const rounded = Math.round(value * factor) / factor;
    let formatter;
    try {
      formatter = new Intl.NumberFormat(localeFor(lang), {
        maximumFractionDigits: digits,
        minimumFractionDigits: 0,
      });
    } catch {
      formatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: digits });
    }
    let text;
    try {
      text = formatter.format(rounded);
    } catch {
      text = String(rounded);
    }
    const approx = Math.abs(rounded - value) > Math.abs(value) * 1e-10 + 1e-9;
    return { text, approx, value: rounded };
  }

  function label(entity, lang) {
    if (!entity || !entity.names) return "";
    return entity.names[lang] || entity.names.en || "";
  }

  function cloneUnit(unit) {
    return {
      id: unit.id,
      sqft: unit.sqft,
      sqm: unit.sqm,
      names: { ...unit.names },
      aliases: [...(unit.aliases || [])],
    };
  }

  function fold(value) {
    return String(value ?? "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  function createLandEngine(data) {
    if (!data || !Array.isArray(data.regions) || !Array.isArray(data.commonUnits)) {
      throw new Error("Land measurement data is missing.");
    }

    const common = data.commonUnits.map(cloneUnit);
    const regions = data.regions.map((region) => ({
      ...region,
      names: { ...region.names },
      standards: (region.standards || []).map((standard) => ({
        ...standard,
        names: { ...standard.names },
        note: standard.note ? { ...standard.note } : null,
        units: (standard.units || []).map(cloneUnit),
      })),
    }));
    const regionById = new Map(regions.map((region) => [region.id, region]));

    function getRegion(regionId) {
      return regionById.get(regionId) || null;
    }

    function getStandard(regionId, standardId) {
      const region = getRegion(regionId);
      if (!region || !standardId || standardId === "common") return null;
      return region.standards.find((standard) => standard.id === standardId) || null;
    }

    function getStandardOptions(regionId) {
      const region = getRegion(regionId);
      return region ? region.standards : [];
    }

    function localUnits(regionId, standardId) {
      const standard = getStandard(regionId, standardId);
      return standard ? standard.units.map(cloneUnit) : [];
    }

    function unitsFor(regionId, standardId) {
      const local = localUnits(regionId, standardId);
      const seen = new Set(local.map((unit) => unit.id));
      const rest = common.filter((unit) => !seen.has(unit.id)).map(cloneUnit);
      return [...local, ...rest];
    }

    function findUnit(unitId, regionId, standardId) {
      return unitsFor(regionId, standardId).find((unit) => unit.id === unitId) || null;
    }

    function defaultUnits(regionId, standardId) {
      const standard = getStandard(regionId, standardId);
      const units = unitsFor(regionId, standardId);
      const primary = standard && Array.isArray(standard.primary) ? standard.primary : [];
      const from = units.find((unit) => unit.id === primary[0]) || units[0] || null;
      const to = units.find((unit) => unit.id === primary[1]) || units[1] || from;
      return { from, to };
    }

    function convert(value, fromUnit, toUnit) {
      if (!fromUnit || !toUnit) throw new LandError("invalid");
      if (!Number.isFinite(value) || value <= 0) throw new LandError("invalid");
      const sqm = value * fromUnit.sqm;
      const sqft = sqm / SQFT_TO_SQM;
      if (sqft > MAX_SQFT) throw new LandError("tooLarge");
      return { value: sqm / toUnit.sqm, sqm, sqft };
    }

    function valueIn(sqm, unit) {
      return unit ? sqm / unit.sqm : Number.NaN;
    }

    function formatValue(sqm, unit, lang, mode = "auto") {
      return { ...formatNumber(valueIn(sqm, unit), lang, mode), unit };
    }

    function breakdown(sqm, regionId, standardId, lang, mode = "auto") {
      const standard = getStandard(regionId, standardId);
      if (!standard || standard.units.length < 2) return [];
      const ordered = [...standard.units].sort((a, b) => b.sqm - a.sqm);
      let remaining = sqm;
      const parts = [];
      ordered.forEach((unit, index) => {
        const raw = remaining / unit.sqm;
        const isSmallest = index === ordered.length - 1;
        const count = isSmallest ? raw : Math.floor(raw + 1e-9);
        if (count > 0) {
          const formatted = formatNumber(count, lang, mode);
          if (formatted.value > 0) {
            parts.push({ unit, count: formatted.value, text: formatted.text, approx: formatted.approx });
            remaining -= formatted.value * unit.sqm;
          }
        }
      });
      return parts;
    }

    function searchUnits(query, units, lang) {
      const needle = fold(query);
      if (!needle) return units.slice();
      const scored = [];
      units.forEach((unit) => {
        const values = [unit.id, unit.names?.[lang], unit.names?.en, unit.names?.hi, unit.names?.as, ...(unit.aliases || [])]
          .filter(Boolean)
          .map(fold);
        let score = 0;
        values.forEach((value) => {
          if (value === needle) score = Math.max(score, 3);
          else if (value.startsWith(needle)) score = Math.max(score, 2);
          else if (value.includes(needle)) score = Math.max(score, 1);
        });
        if (score > 0) scored.push({ unit, score });
      });
      return scored.sort((a, b) => b.score - a.score).map((item) => item.unit);
    }

    function conversionRows(sqm, units, lang, mode = "auto") {
      return units.map((unit) => {
        const formatted = formatNumber(valueIn(sqm, unit), lang, mode);
        return { unit, text: formatted.text, approx: formatted.approx, value: formatted.value };
      });
    }

    function referenceRows(regionId, standardId, lang, mode = "auto") {
      const standard = getStandard(regionId, standardId);
      const units = standard && standard.units.length ? standard.units : common;
      return units.map((unit) => ({
        unit,
        sqft: formatNumber(unit.sqft, lang, mode).text,
        sqm: formatNumber(unit.sqm, lang, mode).text,
      }));
    }

    function relationRows(regionId, standardId) {
      const standard = getStandard(regionId, standardId);
      if (!standard) return [];
      const rows = [];
      for (let index = 0; index < standard.units.length - 1; index += 1) {
        const from = standard.units[index];
        const to = standard.units[index + 1];
        const factor = from.sqm / to.sqm;
        const rounded = Math.round(factor);
        if (rounded >= 2 && rounded <= 10000 && Math.abs(factor - rounded) < factor * 1e-8) {
          rows.push({ from, to, factor: rounded });
        }
      }
      return rows;
    }

    return {
      regions,
      commonUnits: common,
      getRegion,
      getStandard,
      getStandardOptions,
      localUnits,
      unitsFor,
      findUnit,
      defaultUnits,
      convert,
      valueIn,
      formatNumber,
      formatValue,
      breakdown,
      searchUnits,
      conversionRows,
      referenceRows,
      relationRows,
      label,
      parseArea,
      normalizeDigits,
      LandError,
    };
  }

  return {
    createLandEngine,
    parseArea,
    normalizeDigits,
    formatNumber,
    LandError,
    SQFT_TO_SQM,
    MAX_SQFT,
    LOCALES,
  };
});
