"use strict";
const assert = require("node:assert/strict");
const path = require("node:path");

const smart = require(path.join(__dirname, "..", "static/assets/js/tools/smart-search.js"));

const check = (query, slug, params, label) => {
  const result = smart.parse(query);
  assert.ok(result, `${query} should match`);
  assert.equal(result.slug, slug, query);
  for (const [key, value] of Object.entries(params)) {
    assert.equal(String(result.params[key]), String(value), `${query}: ${key}`);
  }
  if (label) assert.equal(result.label, label);
  assert.ok(result.href.startsWith(`/tools/${slug}`), `${query}: href`);
};

check("18% GST on 5000", "gst-calculator", { amount: 5000, rate: "18", auto: 1 });
check("GST 18% on ₹5,000", "gst-calculator", { amount: 5000, rate: "18", auto: 1 });
check("remove 18% GST from 5900", "gst-calculator", { amount: 5900, rate: "18", mode: "inclusive", auto: 1 });
check("GST 18%", "gst-calculator", { rate: "18" });
check("income tax on 12 lakh", "income-tax-calculator", { gross: 1200000, auto: 1 });
check("12 lakh income tax old regime", "income-tax-calculator", { gross: 1200000, regime: "old", auto: 1 });
check("stamp duty on 50 lakh", "stamp-duty-calculator", { value: 5000000, auto: 1 });
check("25% of 200", "percentage-calculator", { x: 25, y: 200, mode: "of", auto: 1 });
check("tip 10% on 1500", "tip-calculator", { bill: 1500, tip: "10", auto: 1 });
check("tip 10% on 1500 for 4 people", "tip-calculator", { bill: 1500, tip: "10", people: "4", auto: 1 });
check("plot 30 x 40", "plot-area-calculator", { length: "30", width: "40", unit: "ft", shape: "rectangle", auto: 1 });
check("30x40 plot", "plot-area-calculator", { length: "30", width: "40", unit: "ft", auto: 1 });
check("2 bigha to katha", "land-measurement-calculator", { area: "2", from: "bigha", to: "katha" });
check("1 acre in sq ft", "land-measurement-calculator", { area: "1", from: "acre", to: "sqft" });

assert.equal(smart.parse(""), null);
assert.equal(smart.parse("qr code"), null);
assert.equal(smart.parse("hello"), null);
assert.equal(smart.parse("GST"), null);
assert.equal(smart.parse("income tax"), null);
assert.equal(smart.landUnit("sq. ft."), "sqft");
assert.equal(smart.landUnit("square metres"), "sqm");

const gst = smart.parse("18% GST on 5000");
assert.equal(gst.href, "/tools/gst-calculator?amount=5000&auto=1&rate=18");
assert.equal(gst.label, "GST Calculator — 18% on ₹5,000");

const land = smart.parse("2 bigha to katha");
assert.equal(land.href, "/tools/land-measurement-calculator?from=bigha&to=katha&area=2");

console.log("smart_search.test.cjs: all assertions passed");
