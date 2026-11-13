const assert = require("node:assert/strict");
const path = require("node:path");
const calc = require(path.join(__dirname, "..", "static/assets/js/tools/calc-math.js"));

const near = (actual, expected, epsilon = 0.0001) => {
  assert.ok(Math.abs(actual - expected) < epsilon, `${actual} is not within ${epsilon} of ${expected}`);
};

const gstOut = calc.gst({ amount: 1000, rate: 18 });
near(gstOut.base, 1000);
near(gstOut.tax, 180);
near(gstOut.cgst, 90);
near(gstOut.sgst, 90);
near(gstOut.total, 1180);

const gstIn = calc.gst({ amount: 1180, rate: 18, inclusive: true });
near(gstIn.base, 1000);
near(gstIn.tax, 180);
near(gstIn.total, 1180);

const gstInter = calc.gst({ amount: 500, rate: 5, interstate: true });
near(gstInter.igst, 25);
near(gstInter.cgst, 0);
near(gstInter.sgst, 0);

const taxFree = calc.incomeTax({ gross: 1200000, regime: "new", salaried: true }).selected;
near(taxFree.taxable, 1125000);
near(taxFree.rebate, 52500);
near(taxFree.total, 0);

const taxMarginal = calc.incomeTax({ gross: 1300000, regime: "new", salaried: true }).selected;
near(taxMarginal.taxable, 1225000);
near(taxMarginal.slabTax, 63750);
near(taxMarginal.rebate, 38750);
near(taxMarginal.total, 26000);

const taxOld = calc.incomeTax({
  gross: 1000000, regime: "old", salaried: true, deductions: { c80: 150000 },
}).selected;
near(taxOld.taxable, 800000);
near(taxOld.slabTax, 72500);
near(taxOld.total, 75400);

const taxOldCapped = calc.incomeTax({
  gross: 1000000, regime: "old", salaried: true,
  deductions: { c80: 500000, d80: 50000, nps: 50000, homeLoan: 500000 },
}).selected;
near(taxOldCapped.deductions.c80, 150000);
near(taxOldCapped.deductions.d80, 25000);
near(taxOldCapped.deductions.nps, 50000);
near(taxOldCapped.deductions.homeLoan, 200000);

const taxSenior = calc.incomeTax({
  gross: 800000, regime: "old", age: "senior", salaried: false, deductions: { d80: 50000 },
}).selected;
near(taxSenior.deductions.d80, 50000);
near(taxSenior.taxable, 750000);

const compare = calc.incomeTax({ gross: 1200000, regime: "compare", salaried: true, deductions: { c80: 150000 } });
assert.equal(compare.recommendation, "new");
assert.ok(compare.savings > 0);
assert.equal(compare.new.regime, "new");
assert.equal(compare.old.regime, "old");

const surcharge = calc.incomeTax({ gross: 6000000, regime: "new", salaried: true }).selected;
assert.ok(Number.isFinite(surcharge.total));
assert.ok(surcharge.total > surcharge.slabTax);

const rectangle = calc.plotArea({ shape: "rectangle", unit: "ft", length: 30, width: 40, rate: 1000, rateBasis: "sqft" });
near(rectangle.squareFeet, 1200);
near(rectangle.squareMetres, 111.483648);
near(rectangle.acres, 1200 / 43560);
near(rectangle.value, 1200000);

const triangle = calc.plotArea({ shape: "triangle", unit: "ft", sideA: 3, sideB: 4, sideC: 5, rate: 0, rateBasis: "sqft" });
near(triangle.squareFeet, 6);

const quadrilateral = calc.plotArea({
  shape: "quadrilateral", unit: "ft", sideA: 30, sideB: 40, sideC: 30, sideD: 40, diagonal: 50, rate: 100, rateBasis: "sqft",
});
near(quadrilateral.squareFeet, 1200);
near(quadrilateral.value, 120000);

const concrete = calc.construction({ mode: "concrete", unit: "m", length: 10, width: 5, thickness: 0.15, mix: "m20", waste: 0 });
near(concrete.wetVolume, 7.5);
near(concrete.dryVolume, 11.55);
near(concrete.cementBags, 60.48);
near(concrete.sandVolume, 3.15);
near(concrete.aggregateVolume, 6.3);

const brick = calc.construction({ mode: "brick", unit: "m", length: 10, height: 3, thickness: 0.115, brickSize: "standard", mortar: "1:6", waste: 0 });
assert.equal(brick.bricks, 1725);
assert.ok(brick.cementBags > 4 && brick.cementBags < 5);
assert.ok(brick.sandVolume > 0.8 && brick.sandVolume < 1);

const tile = calc.construction({ mode: "tile", unit: "ft", length: 20, width: 15, tileLength: 600, tileWidth: 600, waste: 10, perBox: 4 });
assert.equal(tile.tiles, 86);
assert.equal(tile.boxes, 22);

const paint = calc.construction({ mode: "paint", unit: "ft", length: 20, height: 10, openings: 20, coats: 2, coverage: 10, waste: 5 });
near(paint.area, 16.7225472);
near(paint.litres, 3.511734912);

const stamp = calc.stampDuty({ value: 5000000, stampRate: 6, registrationRate: 1, other: 1000 });
near(stamp.stamp, 300000);
near(stamp.registration, 50000);
near(stamp.total, 351000);
near(stamp.effectiveRate, 7.02);

assert.throws(() => calc.gst({ amount: -1, rate: 18 }), /cannot be negative/);
assert.throws(() => calc.plotArea({ shape: "triangle", unit: "ft", sideA: 1, sideB: 2, sideC: 5 }), /cannot form a triangle/);
assert.throws(() => calc.incomeTax({ gross: -5 }), /cannot be negative/);

console.log("calc_math.test.cjs: all assertions passed");
