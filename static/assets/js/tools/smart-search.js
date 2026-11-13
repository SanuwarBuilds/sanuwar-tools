"use strict";
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.ToolSmartSearch = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const SCALE = {
    crore: 1e7, crores: 1e7, cr: 1e7,
    lakh: 1e5, lakhs: 1e5, lac: 1e5, lacs: 1e5,
    k: 1e3, thousand: 1e3,
  };
  const GST_RATES = new Set(["0", "3", "1.5", "0.25", "5", "18", "28", "40"]);
  const LAND_ALIASES = {
    bigha: "bigha", biga: "bigha", beegha: "bigha",
    katha: "katha", kattha: "katha", katta: "katha", cottah: "katha",
    lessa: "lessa", lecha: "lessa",
    biswa: "biswa", biswansi: "biswansi",
    kanal: "kanal", marla: "marla", guntha: "guntha",
    acre: "acre", acres: "acre", hectare: "hectare", hectares: "hectare",
    sqft: "sqft", "sq ft": "sqft", "square feet": "sqft", "square foot": "sqft",
    sqm: "sqm", "sq m": "sqm", "square metre": "sqm", "square meter": "sqm",
    "square metres": "sqm", "square meters": "sqm",
  };
  const LAND_PATTERN = "bigha|biga|beegha|katha|kattha|katta|cottah|lessa|lecha|biswa|biswansi|kanal|marla|guntha|acres?|hectares?|sq\\.?\\s*ft|square\\s+feet|sq\\.?\\s*m|square\\s+met(?:er|re)s?";
  const PERCENT_PATTERN = "(?:%|percent|per\\s+cent)";

  const clean = (value) => String(value ?? "")
    .toLowerCase()
    .replace(/₹/g, " ")
    .replace(/,/g, "")
    .replace(/\brs\.?\b|\brupees?\b|\binr\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const scaleOf = (unit) => SCALE[String(unit || "").toLowerCase()] || 1;

  const parseNumber = (raw, unit) => {
    const value = Number(raw);
    return Number.isFinite(value) ? value * scaleOf(unit) : null;
  };

  const numberText = (value) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value);

  const amountAfter = (text, anchors) => {
    const re = new RegExp(`(?:${anchors.join("|")})\\s*(?:rs\\.?|inr)?\\s*(\\d+(?:\\.\\d+)?)\\s*(crores?|cr|lakhs?|lacs?|k|thousand)?`, "i");
    const match = text.match(re);
    return match ? parseNumber(match[1], match[2]) : null;
  };

  const numbers = (text) => [...text.matchAll(/(\d+(?:\.\d+)?)\s*(crores?|cr|lakhs?|lacs?|k|thousand)?/gi)].map((match) => ({
    value: parseNumber(match[1], match[2]),
    index: match.index,
  })).filter((item) => item.value !== null);

  const make = (slug, label, params) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== "") query.set(key, String(value));
    });
    return {
      slug,
      label,
      params,
      href: `/tools/${slug}${query.toString() ? `?${query}` : ""}`,
    };
  };

  const landUnit = (value) => {
    const key = String(value || "").toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
    return LAND_ALIASES[key] || "";
  };

  const parse = (raw) => {
    const text = clean(raw);
    if (!text) return null;

    if (/\bgst\b/.test(text)) {
      const rateMatch = text.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${PERCENT_PATTERN}`, "i"));
      const rate = rateMatch ? Number(rateMatch[1]) : null;
      const all = numbers(text);
      const amount = amountAfter(text, ["on", "for", "of", "amount", "bill"])
        ?? (rateMatch ? (all.find((item) => item.index !== rateMatch.index) || {}).value ?? null : all[0]?.value ?? null);
      if (amount === null && rate === null) return null;
      const params = {};
      if (amount !== null) {
        params.amount = amount;
        params.auto = 1;
      }
      if (rate !== null) {
        const rateKey = String(rate);
        params.rate = GST_RATES.has(rateKey) ? rateKey : "custom";
        if (!GST_RATES.has(rateKey)) params.customRate = rate;
      }
      if (/\b(?:inclusive|including|remove|reverse)\b/.test(text)) params.mode = "inclusive";
      if (/\b(?:inter[- ]?state|igst)\b/.test(text)) params.supply = "inter";
      if (/\b(?:intra[- ]?state|cgst|sgst)\b/.test(text)) params.supply = "intra";
      return make(
        "gst-calculator",
        `GST Calculator${rate !== null ? ` — ${rate}%` : ""}${amount !== null ? ` on ₹${numberText(amount)}` : ""}`,
        params,
      );
    }

    if (/\b(?:stamp duty|registration (?:fee|fees|charges?))\b/.test(text)) {
      const value = amountAfter(text, ["on", "for", "of", "value", "property"]) ?? (numbers(text)[0] || {}).value ?? null;
      if (value === null) return null;
      return make("stamp-duty-calculator", `Stamp Duty Calculator — ₹${numberText(value)}`, { value, auto: 1 });
    }

    if (/\b(?:income[- ]?tax|itr|tax regime|old regime|new regime)\b/.test(text)) {
      const gross = amountAfter(text, ["on", "for", "of", "income", "salary", "gross"]) ?? (numbers(text)[0] || {}).value ?? null;
      if (gross === null) return null;
      const params = { gross, auto: 1 };
      if (/\bnew regime\b/.test(text)) params.regime = "new";
      else if (/\bold regime\b/.test(text)) params.regime = "old";
      return make("income-tax-calculator", `Income Tax Calculator — ₹${numberText(gross)}`, params);
    }

    if (/\btip\b/.test(text)) {
      const rateMatch = text.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${PERCENT_PATTERN}`, "i"));
      const all = numbers(text);
      const bill = amountAfter(text, ["on", "for", "of", "bill", "amount"])
        ?? (rateMatch ? (all.find((item) => item.index !== rateMatch.index) || {}).value ?? null : all[0]?.value ?? null);
      if (bill === null) return null;
      const params = { bill, auto: 1 };
      if (rateMatch) params.tip = rateMatch[1];
      const people = text.match(/(?:split|between|for)\s+(\d+)\s*(?:people|persons?|ways?)/i);
      if (people) params.people = people[1];
      return make("tip-calculator", `Tip Calculator${rateMatch ? ` — ${rateMatch[1]}%` : ""} on ₹${numberText(bill)}`, params);
    }

    const percentage = text.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${PERCENT_PATTERN}\\s*(?:of|on)\\s*(?:rs\\.?|inr)?\\s*(\\d+(?:\\.\\d+)?)\\s*(crores?|cr|lakhs?|lacs?|k|thousand)?`, "i"));
    if (percentage) {
      const x = Number(percentage[1]);
      const y = parseNumber(percentage[2], percentage[3]);
      if (y !== null) {
        return make("percentage-calculator", `Percentage Calculator — ${x}% of ${numberText(y)}`, { mode: "of", x, y, auto: 1 });
      }
    }

    const plot = text.match(/(?:plot|land|site|area)?\s*(\d+(?:\.\d+)?)\s*(ft|feet|foot|m|meter|metre)?\s*(?:x|by|\*)\s*(\d+(?:\.\d+)?)\s*(ft|feet|foot|m|meter|metre)?/i);
    if (plot && /\b(?:plot|land|site|area)\b/.test(text)) {
      const unit = /^(?:m|meter|metre)$/i.test(plot[2] || plot[4] || "") ? "m" : "ft";
      return make(
        "plot-area-calculator",
        `Plot Area Calculator — ${plot[1]} × ${plot[3]} ${unit}`,
        { shape: "rectangle", unit, length: plot[1], width: plot[3], auto: 1 },
      );
    }

    const land = text.match(new RegExp(`(\\d+(?:\\.\\d+)?)?\\s*(${LAND_PATTERN})\\s*(?:to|in|into)\\s*(${LAND_PATTERN})`, "i"));
    if (land) {
      const from = landUnit(land[2]);
      const to = landUnit(land[3]);
      if (from && to) {
        const params = { from, to };
        if (land[1]) params.area = land[1];
        return make(
          "land-measurement-calculator",
          `Land Calculator${land[1] ? ` — ${land[1]} ` : " — "}${land[2]} → ${land[3]}`,
          params,
        );
      }
    }

    return null;
  };

  return { parse, landUnit };
});
