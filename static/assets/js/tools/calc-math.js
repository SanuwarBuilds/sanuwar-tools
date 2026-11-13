"use strict";
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CalcMath = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const round = (value, digits = 2) => {
    const factor = 10 ** digits;
    return Math.round((value + Number.EPSILON) * factor) / factor;
  };

  const positive = (value, label) => {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) throw new Error(`${label} must be greater than zero.`);
    return number;
  };

  const nonNegative = (value, label) => {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) throw new Error(`${label} cannot be negative.`);
    return number;
  };

  const gst = ({ amount, rate, inclusive = false, interstate = false }) => {
    const value = nonNegative(amount, "Amount");
    const percent = nonNegative(rate, "GST rate");
    if (percent > 100) throw new Error("GST rate cannot exceed 100%.");
    const base = inclusive ? value / (1 + percent / 100) : value;
    const tax = inclusive ? value - base : base * percent / 100;
    const total = inclusive ? value : base + tax;
    return {
      base,
      rate: percent,
      tax,
      cgst: interstate ? 0 : tax / 2,
      sgst: interstate ? 0 : tax / 2,
      igst: interstate ? tax : 0,
      total,
      interstate: Boolean(interstate),
    };
  };

  const NEW_SLABS = [
    { upTo: 400000, rate: 0 },
    { upTo: 800000, rate: 0.05 },
    { upTo: 1200000, rate: 0.10 },
    { upTo: 1600000, rate: 0.15 },
    { upTo: 2000000, rate: 0.20 },
    { upTo: 2400000, rate: 0.25 },
    { upTo: Infinity, rate: 0.30 },
  ];

  const oldSlabs = (age) => {
    if (age === "super") return [
      { upTo: 500000, rate: 0 },
      { upTo: 1000000, rate: 0.20 },
      { upTo: Infinity, rate: 0.30 },
    ];
    if (age === "senior") return [
      { upTo: 300000, rate: 0 },
      { upTo: 500000, rate: 0.05 },
      { upTo: 1000000, rate: 0.20 },
      { upTo: Infinity, rate: 0.30 },
    ];
    return [
      { upTo: 250000, rate: 0 },
      { upTo: 500000, rate: 0.05 },
      { upTo: 1000000, rate: 0.20 },
      { upTo: Infinity, rate: 0.30 },
    ];
  };

  const slabTax = (income, slabs) => {
    let lower = 0;
    let tax = 0;
    const breakdown = [];
    slabs.forEach((slab) => {
      if (income > lower) {
        const amount = Math.min(income, slab.upTo) - lower;
        const charge = amount * slab.rate;
        tax += charge;
        breakdown.push({ from: lower, to: Math.min(income, slab.upTo), rate: slab.rate, amount: charge });
      }
      lower = slab.upTo;
    });
    return { tax, breakdown };
  };

  const oldDeductions = (deductions, age) => {
    const source = deductions || {};
    const allowed = {
      c80: Math.min(nonNegative(source.c80 || 0, "Section 80C deduction"), 150000),
      d80: Math.min(nonNegative(source.d80 || 0, "Section 80D deduction"), age === "below60" ? 25000 : 50000),
      homeLoan: Math.min(nonNegative(source.homeLoan || 0, "Home loan interest"), 200000),
      nps: Math.min(nonNegative(source.nps || 0, "NPS deduction"), 50000),
      other: nonNegative(source.other || 0, "Other deductions"),
    };
    allowed.total = Object.values(allowed).reduce((sum, value) => sum + value, 0);
    return allowed;
  };

  const surchargeFor = (taxable, tax, slabs, regime) => {
    const thresholds = regime === "new"
      ? [[5000000, 0.10], [10000000, 0.15], [20000000, 0.25]]
      : [[5000000, 0.10], [10000000, 0.15], [20000000, 0.25], [50000000, 0.37]];
    let rate = 0;
    let threshold = null;
    thresholds.forEach(([limit, value]) => {
      if (taxable > limit) {
        rate = value;
        threshold = limit;
      }
    });
    if (!rate) return { rate: 0, amount: 0 };
    let amount = tax * rate;
    const taxAtThreshold = slabTax(threshold, slabs).tax;
    const cap = taxAtThreshold + (taxable - threshold);
    if (tax + amount > cap) amount = Math.max(0, cap - tax);
    return { rate, amount };
  };

  const taxPlan = (regime, gross, age, salaried, deductions) => {
    const income = nonNegative(gross, "Annual income");
    const slabs = regime === "new" ? NEW_SLABS : oldSlabs(age);
    const standardDeduction = salaried ? (regime === "new" ? 75000 : 50000) : 0;
    const allowed = regime === "old" ? oldDeductions(deductions, age) : { total: 0 };
    const taxable = Math.max(0, income - standardDeduction - allowed.total);
    const slab = slabTax(taxable, slabs);
    let tax = slab.tax;
    let rebate = 0;
    if (regime === "new" && taxable <= 1200000) {
      rebate = Math.min(tax, 60000);
    } else if (regime === "new" && taxable > 1200000) {
      const relief = taxable - 1200000;
      if (tax > relief) {
        rebate = tax - relief;
      }
    } else if (regime === "old" && taxable <= 500000) {
      rebate = Math.min(tax, 12500);
    }
    const afterRebate = Math.max(0, tax - rebate);
    const surcharge = surchargeFor(taxable, afterRebate, slabs, regime);
    const cess = (afterRebate + surcharge.amount) * 0.04;
    const total = afterRebate + surcharge.amount + cess;
    return {
      regime,
      gross: income,
      standardDeduction,
      deductions: allowed,
      taxable,
      slabTax: tax,
      rebate,
      taxAfterRebate: afterRebate,
      surcharge: surcharge.amount,
      surchargeRate: surcharge.rate,
      cess,
      total,
      effectiveRate: income > 0 ? total / income * 100 : 0,
      monthly: total / 12,
      breakdown: slab.breakdown,
    };
  };

  const incomeTax = ({ gross, regime = "compare", age = "below60", salaried = true, deductions = {} }) => {
    const newPlan = taxPlan("new", gross, age, salaried, deductions);
    const oldPlan = taxPlan("old", gross, age, salaried, deductions);
    if (regime === "new") return { selected: newPlan, new: newPlan, old: oldPlan, recommendation: "new", savings: oldPlan.total - newPlan.total };
    if (regime === "old") return { selected: oldPlan, new: newPlan, old: oldPlan, recommendation: "old", savings: newPlan.total - oldPlan.total };
    const recommendation = newPlan.total <= oldPlan.total ? "new" : "old";
    return {
      selected: recommendation === "new" ? newPlan : oldPlan,
      new: newPlan,
      old: oldPlan,
      recommendation,
      savings: Math.abs(newPlan.total - oldPlan.total),
    };
  };

  const toFeet = (value, unit) => positive(value, "Measurement") * (unit === "m" ? 3.280839895013123 : 1);

  const heron = (a, b, c) => {
    if (a + b <= c || a + c <= b || b + c <= a) throw new Error("Those side lengths cannot form a triangle.");
    const s = (a + b + c) / 2;
    return Math.sqrt(Math.max(0, s * (s - a) * (s - b) * (s - c)));
  };

  const plotArea = ({ shape = "rectangle", unit = "ft", length, width, sideA, sideB, sideC, sideD, diagonal, rate = 0, rateBasis = "sqft" }) => {
    let squareFeet;
    if (shape === "rectangle") {
      squareFeet = toFeet(length, unit) * toFeet(width, unit);
    } else if (shape === "triangle") {
      const a = toFeet(sideA, unit);
      const b = toFeet(sideB, unit);
      const c = toFeet(sideC, unit);
      squareFeet = heron(a, b, c);
    } else if (shape === "quadrilateral") {
      const a = toFeet(sideA, unit);
      const b = toFeet(sideB, unit);
      const c = toFeet(sideC, unit);
      const d = toFeet(sideD, unit);
      const e = toFeet(diagonal, unit);
      squareFeet = heron(a, b, e) + heron(c, d, e);
    } else {
      throw new Error("Choose a plot shape.");
    }
    const squareMetres = squareFeet / 10.763910416709722;
    const acres = squareFeet / 43560;
    const hectares = squareMetres / 10000;
    const squareYards = squareFeet / 9;
    const value = nonNegative(rate, "Land rate") * (
      rateBasis === "sqm" ? squareMetres :
      rateBasis === "acre" ? acres :
      rateBasis === "hectare" ? hectares : squareFeet
    );
    return { squareFeet, squareMetres, squareYards, acres, hectares, value, rateBasis };
  };

  const construction = (input) => {
    const mode = input.mode || "concrete";
    const factor = input.unit === "ft" ? 0.3048 : 1;
    const waste = Math.max(0, Number(input.waste) || 0) / 100;
    if (mode === "concrete") {
      const length = positive(input.length, "Length") * factor;
      const width = positive(input.width, "Width") * factor;
      const thickness = positive(input.thickness, "Thickness") * factor;
      const mixes = {
        m5: { label: "M5 (1 : 5 : 10)", parts: [1, 5, 10] },
        m75: { label: "M7.5 (1 : 4 : 8)", parts: [1, 4, 8] },
        m10: { label: "M10 (1 : 3 : 6)", parts: [1, 3, 6] },
        m15: { label: "M15 (1 : 2 : 4)", parts: [1, 2, 4] },
        m20: { label: "M20 (1 : 1.5 : 3)", parts: [1, 1.5, 3] },
        m25: { label: "M25 (1 : 1 : 2)", parts: [1, 1, 2] },
      };
      const mix = mixes[input.mix] || mixes.m20;
      const wet = length * width * thickness;
      const dry = wet * 1.54 * (1 + waste);
      const totalParts = mix.parts.reduce((sum, value) => sum + value, 0);
      const cementVolume = dry * mix.parts[0] / totalParts;
      const sandVolume = dry * mix.parts[1] / totalParts;
      const aggregateVolume = dry * mix.parts[2] / totalParts;
      const cementBags = cementVolume * 1440 / 50;
      return {
        mode, mix: mix.label, wetVolume: wet, dryVolume: dry,
        cementVolume, cementBags, sandVolume, aggregateVolume,
        waterLitres: cementBags * 50 * 0.5,
      };
    }
    if (mode === "brick") {
      const length = positive(input.length, "Wall length") * factor;
      const height = positive(input.height, "Wall height") * factor;
      const thickness = positive(input.thickness, "Wall thickness") * factor;
      const sizes = {
        standard: { label: "Standard 190 × 90 × 90 mm", l: 0.19, w: 0.09, h: 0.09, ml: 0.20, mw: 0.10, mh: 0.10 },
        traditional: { label: "Traditional 230 × 110 × 75 mm", l: 0.23, w: 0.11, h: 0.075, ml: 0.24, mw: 0.12, mh: 0.085 },
      };
      const size = sizes[input.brickSize] || sizes.standard;
      const ratios = { "1:4": 4, "1:6": 6 };
      const mortarParts = ratios[input.mortar] || 6;
      const wallVolume = length * height * thickness;
      const actualBrickVolume = size.l * size.w * size.h;
      const brickWithMortar = size.ml * size.mw * size.mh;
      const bricks = Math.ceil(wallVolume / brickWithMortar * (1 + waste));
      const mortarWet = Math.max(0, wallVolume - bricks * actualBrickVolume);
      const mortarDry = mortarWet * 1.33;
      const cementVolume = mortarDry / (1 + mortarParts);
      return {
        mode, brickSize: size.label, mortar: input.mortar || "1:6", wallVolume,
        bricks, mortarVolume: mortarDry, cementBags: cementVolume * 1440 / 50,
        sandVolume: mortarDry * mortarParts / (1 + mortarParts),
      };
    }
    if (mode === "tile") {
      const length = positive(input.length, "Room length") * factor;
      const width = positive(input.width, "Room width") * factor;
      const tileLength = positive(input.tileLength, "Tile length") / 1000;
      const tileWidth = positive(input.tileWidth, "Tile width") / 1000;
      const area = length * width;
      const tileArea = tileLength * tileWidth;
      const tiles = Math.ceil(area / tileArea * (1 + waste));
      const perBox = Math.max(1, Math.round(Number(input.perBox) || 4));
      return {
        mode, area, tileArea, tiles, boxes: Math.ceil(tiles / perBox), perBox,
      };
    }
    if (mode === "paint") {
      const length = positive(input.length, "Wall length") * factor;
      const height = positive(input.height, "Wall height") * factor;
      const openings = Math.max(0, Number(input.openings) || 0) * factor * factor;
      const coats = Math.max(1, Number(input.coats) || 2);
      const coverage = positive(input.coverage, "Coverage per litre");
      const area = Math.max(0, length * height - openings);
      const litres = area * coats / coverage * (1 + waste);
      return { mode, area, coats, coverage, litres };
    }
    throw new Error("Choose a material calculator.");
  };

  const stampDuty = ({ value, stampRate, registrationRate = 0, other = 0 }) => {
    const propertyValue = nonNegative(value, "Property value");
    const stamp = propertyValue * nonNegative(stampRate, "Stamp duty rate") / 100;
    const registration = propertyValue * nonNegative(registrationRate, "Registration rate") / 100;
    const extra = nonNegative(other, "Other charges");
    const total = stamp + registration + extra;
    return {
      value: propertyValue,
      stampRate: Number(stampRate),
      registrationRate: Number(registrationRate),
      stamp,
      registration,
      other: extra,
      total,
      effectiveRate: propertyValue > 0 ? total / propertyValue * 100 : 0,
    };
  };

  return { round, gst, incomeTax, plotArea, construction, stampDuty };
});
