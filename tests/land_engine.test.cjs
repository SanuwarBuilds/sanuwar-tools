"use strict";
const assert = require("node:assert/strict");
const path = require("node:path");
const data = require(path.join(__dirname, "..", "static/assets/js/tools/land-data.js"));
const { createLandEngine, parseArea, LandError } = require(path.join(__dirname, "..", "static/assets/js/tools/land-engine.js"));

const engine = createLandEngine(data);
const SQFT = 0.09290304;
const sqft = 1 / SQFT;
const close = (actual, expected, label, epsilon = 1e-8) => {
  assert.ok(Math.abs(actual - expected) <= Math.max(1, Math.abs(expected)) * epsilon, `${label}: ${actual} != ${expected}`);
};
const unit = (id, region, standard) => {
  const found = engine.findUnit(id, region, standard);
  assert.ok(found, `missing unit ${id} for ${region}/${standard}`);
  return found;
};
const convert = (value, from, to, region, standard) => {
  const result = engine.convert(value, unit(from, region, standard), unit(to, region, standard));
  const expected = value * unit(from, region, standard).sqft / unit(to, region, standard).sqft;
  close(result.value, expected, `${value} ${from} -> ${to}`);
  return result;
};

assert.equal(data.regions.length, 37);
assert.equal(data.commonUnits.length, 9);
assert.equal(new Set(data.regions.map((region) => region.id)).size, data.regions.length);
for (const region of data.regions) {
  assert.ok(engine.getStandardOptions(region.id).length, `${region.id} has no standards`);
  for (const standard of engine.getStandardOptions(region.id)) {
    const units = engine.unitsFor(region.id, standard.id);
    assert.ok(units.length, `${region.id}/${standard.id} has no units`);
    assert.equal(new Set(units.map((item) => item.id)).size, units.length, `${region.id}/${standard.id} duplicate units`);
    for (const item of units) {
      assert.ok(item.sqft > 0, `${region.id}/${standard.id}/${item.id} sqft`);
      assert.ok(item.names.en && item.names.hi && item.names.as, `${region.id}/${standard.id}/${item.id} names`);
    }
    for (const primary of standard.primary || []) {
      assert.ok(units.some((item) => item.id === primary), `${region.id}/${standard.id} primary ${primary}`);
    }
    if (!standard.units.length) assert.ok(standard.note && standard.note.en, `${region.id}/${standard.id} fallback note`);
  }
}

const assam = engine.getRegion("assam");
assert.ok(assam);
assert.equal(assam.standards.length, 2);
close(engine.findUnit("bigha", "assam", "assam-brahmaputra").sqft, 14400, "Assam bigha");
close(engine.findUnit("katha", "assam", "assam-brahmaputra").sqft, 2880, "Assam katha");
close(engine.findUnit("lessa", "assam", "assam-brahmaputra").sqft, 144, "Assam lessa");
close(engine.findUnit("pura", "assam", "assam-brahmaputra").sqft, 57600, "Assam pura");
convert(1, "bigha", "katha", "assam", "assam-brahmaputra");
convert(1, "pura", "bigha", "assam", "assam-brahmaputra");
convert(1, "katha", "lessa", "assam", "assam-brahmaputra");
close(convert(1, "bigha", "sqft", "assam", "assam-brahmaputra").value, 14400, "Assam bigha to sqft");
close(convert(1, "bigha", "katha", "assam", "assam-barak").value, 20, "Barak katha per bigha");
close(convert(1, "katha", "chatak", "assam", "assam-barak").value, 16, "Barak chatak per katha");

close(convert(1, "bigha", "katha", "west-bengal", "west-bengal-bigha").value, 20, "WB katha per bigha");
close(engine.findUnit("katha", "west-bengal", "west-bengal-bigha").sqft, 720, "WB katha");

close(engine.findUnit("bigha", "bihar", "bihar-patna").sqft, 27225, "Patna bigha");
close(engine.findUnit("katha", "bihar", "bihar-patna").sqft, 1361.25, "Patna katha");
close(engine.findUnit("dhur", "bihar", "bihar-patna").sqft, 68.0625, "Patna dhur");
close(engine.findUnit("bigha", "bihar", "bihar-chhapra").sqft, 34848, "Chhapra bigha");
close(engine.findUnit("bigha", "bihar", "bihar-hajipur").sqft, 38025, "Hajipur bigha");
close(engine.findUnit("bigha", "bihar", "bihar-bettiah").sqft, 65340, "Bettiah bigha");
close(engine.findUnit("bigha", "bihar", "bihar-six-haath").sqft, 32400, "6-haath bigha");

close(engine.findUnit("bigha", "uttar-pradesh", "up-pucca").sqft, 27225, "UP pucca bigha");
close(engine.findUnit("biswa", "uttar-pradesh", "up-pucca").sqft, 1361.25, "UP biswa");
close(engine.findUnit("bigha", "uttar-pradesh", "up-kachha-half").sqft, 13612.5, "UP kachha half");
close(engine.findUnit("bigha", "uttar-pradesh", "up-kachha-two-third").sqft, 9075, "UP kachha 6.67 biswa");
assert.equal(engine.getStandard("uttar-pradesh", "up-kachha-two-third").names.en, "Kachha Bigha — 6⅔ Biswa");
assert.ok(engine.getStandard("uttar-pradesh", "up-kachha-two-third").note.en.includes("one-third"));
close(engine.findUnit("bigha", "uttar-pradesh", "up-small").sqft, 6806.25, "UP small bigha");

close(convert(1, "killa", "kanal", "punjab", "punjab-killa").value, 8, "Punjab kanal per killa");
close(convert(1, "kanal", "marla", "punjab", "punjab-killa").value, 20, "Punjab marla per kanal");
close(convert(1, "marla", "sarsahi", "punjab", "punjab-killa").value, 9, "Punjab sarsahi per marla");
close(convert(1, "murabba", "killa", "punjab", "punjab-killa").value, 25, "Punjab killa per murabba");
close(engine.findUnit("marla", "punjab", "punjab-killa").sqft, 272.25, "Punjab marla");

close(engine.findUnit("bigha", "rajasthan", "rajasthan-pucca").sqft, 27225, "Rajasthan pucca bigha");
close(engine.findUnit("bigha", "rajasthan", "rajasthan-kachha").sqft, 17424, "Rajasthan kachha bigha");
close(engine.findUnit("bigha", "delhi", "delhi-bigha").sqft, 9075, "Delhi bigha");
close(engine.findUnit("bigha", "haryana", "haryana-killa").sqft, 9075, "Haryana old bigha");
close(engine.findUnit("bigha", "himachal-pradesh", "himachal-bigha").sqft, 8712, "Himachal bigha");
close(engine.findUnit("bigha", "jharkhand", "jharkhand-bigha").sqft, 27225, "Jharkhand bigha");
close(engine.findUnit("bigha", "madhya-pradesh", "mp-bigha").sqft, 12000, "MP bigha");

close(engine.findUnit("vigha", "gujarat", "gujarat-saurashtra").sqft, 17424, "Saurashtra vigha");
close(convert(1, "vigha", "guntha", "gujarat", "gujarat-saurashtra").value, 16, "Saurashtra guntha");
close(convert(1, "vigha", "guntha", "gujarat", "gujarat-gaekwad").value, 24, "Gaekwad guntha");
close(engine.findUnit("vaar", "gujarat", "gujarat-saurashtra").sqft, 9, "Gujarat vaar");
close(engine.findUnit("guntha", "maharashtra", "maharashtra-guntha").sqft, 1089, "Maharashtra guntha");
close(engine.findUnit("guntha", "karnataka", "karnataka-guntha").sqft, 1089, "Karnataka guntha");

close(engine.findUnit("ground", "tamil-nadu", "tn-ground").sqft, 2400, "TN ground");
close(engine.findUnit("ankanam", "tamil-nadu", "tn-ground").sqft, 72, "TN ankanam");
close(engine.findUnit("kuli", "tamil-nadu", "tn-ground").sqft, 144, "TN kuli");
close(convert(1, "cent_decimal", "sqft", "tamil-nadu", "tn-ground").value, 435.6, "TN cent");
close(convert(1, "kuncham", "cent_decimal", "kerala", "kerala-cent").value, 10, "Kerala kuncham");

const acre = engine.findUnit("acre", "all-india", "common");
close(acre.sqft, 43560, "Acre sqft");
close(engine.findUnit("hectare", "all-india", "common").sqft, 10000 / SQFT, "Hectare sqft");
close(engine.findUnit("sqm", "all-india", "common").sqft, sqft, "Sq metre sqft");
close(engine.findUnit("cent_decimal", "all-india", "common").sqft, 435.6, "Cent sqft");
close(engine.findUnit("guntha", "all-india", "common").sqft, 1089, "Guntha sqft");

assert.deepEqual(parseArea("২.৫"), { ok: true, value: 2.5 });
assert.deepEqual(parseArea("१,२३४.५"), { ok: true, value: 1234.5 });
assert.deepEqual(parseArea("1,23,456.78"), { ok: true, value: 123456.78 });
assert.deepEqual(parseArea(" .5 "), { ok: true, value: 0.5 });
assert.equal(parseArea("").code, "empty");
assert.equal(parseArea("abc").code, "invalid");
assert.equal(parseArea("-2").code, "negative");
assert.equal(parseArea("0").code, "zero");

const assamBigha = unit("bigha", "assam", "assam-brahmaputra");
const assamKatha = unit("katha", "assam", "assam-brahmaputra");
assert.throws(() => engine.convert(0, assamBigha, assamKatha), (error) => error instanceof LandError && error.code === "invalid");
const limit = Math.floor(1e10 / 14400);
assert.ok(engine.convert(limit, assamBigha, assamKatha).sqft <= 1e10);
assert.throws(() => engine.convert(limit + 1, assamBigha, assamKatha), (error) => error instanceof LandError && error.code === "tooLarge");

const breakdown = engine.breakdown(2.5 * 14400 * SQFT, "assam", "assam-brahmaputra", "en");
assert.deepEqual(breakdown.map((part) => [part.text, part.unit.id]), [["2", "bigha"], ["2", "katha"], ["10", "lessa"]]);

const searchAs = engine.searchUnits("বিঘা", engine.unitsFor("assam", "assam-brahmaputra"), "as").map((item) => item.id);
assert.ok(searchAs.includes("bigha"));
const searchHi = engine.searchUnits("कट्ठा", engine.unitsFor("bihar", "bihar-patna"), "hi").map((item) => item.id);
assert.ok(searchHi.includes("katha"));
const searchEn = engine.searchUnits("cottah", engine.unitsFor("west-bengal", "west-bengal-bigha"), "en").map((item) => item.id);
assert.ok(searchEn.includes("katha"));

const relations = engine.relationRows("assam", "assam-brahmaputra");
assert.ok(relations.some((row) => row.from.id === "bigha" && row.to.id === "katha" && row.factor === 5));
assert.ok(relations.some((row) => row.from.id === "katha" && row.to.id === "lessa" && row.factor === 20));

const rows = engine.referenceRows("assam", "assam-brahmaputra", "en");
assert.equal(rows.length, 4);
assert.equal(rows.find((row) => row.unit.id === "bigha").sqft, "14,400");

const unitIds = engine.unitsFor("gujarat", "gujarat-saurashtra").map((item) => item.id);
assert.equal(new Set(unitIds).size, unitIds.length);
assert.ok(unitIds.includes("guntha"));

const formatted = engine.formatNumber(1337.803776, "en", "auto");
assert.equal(formatted.approx, true);
assert.equal(formatted.text, "1,337.8");
assert.equal(engine.formatNumber(14400, "en", "auto").approx, false);
assert.equal(engine.formatNumber(14400, "en", "auto").text, "14,400");

assert.equal(engine.label(assam, "as"), "অসম");
assert.equal(engine.label(assamKatha, "hi"), "कट्ठा");
assert.equal(engine.label(assam, "en"), "Assam");

const defaults = engine.defaultUnits("assam", "assam-brahmaputra");
assert.equal(defaults.from.id, "bigha");
assert.equal(defaults.to.id, "katha");
const punjabDefaults = engine.defaultUnits("punjab", "punjab-killa");
assert.equal(punjabDefaults.from.id, "killa");
assert.equal(punjabDefaults.to.id, "kanal");
const fallback = engine.getStandard("arunachal-pradesh", "arunachal-pradesh-common");
assert.ok(fallback);
assert.equal(fallback.units.length, 0);
assert.ok(fallback.note.en.includes("No single verified local standard"));
const fallbackDefaults = engine.defaultUnits("arunachal-pradesh", "arunachal-pradesh-common");
assert.equal(fallbackDefaults.from.id, "acre");
assert.equal(fallbackDefaults.to.id, "hectare");
assert.equal(engine.getStandardOptions("all-india").length, 1);

console.log("land_engine.test.cjs: all assertions passed");
