"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const i18n = require(path.join(__dirname, "..", "static/assets/js/tools/land-i18n.js"));
const landSource = fs.readFileSync(path.join(__dirname, "..", "static/assets/js/tools/land.js"), "utf8");
const langs = ["en", "hi", "as"];
const keys = Object.keys(i18n.en).sort();

for (const lang of langs) {
  assert.ok(Object.keys(i18n).includes(lang), `missing language ${lang}`);
  assert.deepEqual(Object.keys(i18n[lang]).sort(), keys, `${lang} key parity`);
  for (const key of keys) {
    const value = i18n[lang][key];
    if (Array.isArray(value)) {
      assert.ok(value.length > 0, `${lang}.${key} is empty`);
    } else {
      assert.equal(typeof value, "string", `${lang}.${key} must be a string`);
      assert.ok(value.trim(), `${lang}.${key} is blank`);
    }
  }
  assert.equal(i18n[lang].faqs.length, 6, `${lang} FAQ count`);
  for (const faq of i18n[lang].faqs) {
    assert.ok(faq.q && faq.a, `${lang} FAQ question and answer required`);
  }
  assert.match(i18n[lang].resultBasedOn, /\{standard\}/);
  assert.match(i18n[lang].shareUpdated, /\{date\}/);
}

const required = [
  "shareTitle", "shareHint", "shareCopyLink", "shareWhatsapp", "sharePrint",
  "shareBadge", "shareUpdated", "methodologyLink", "linkCopied", "clear",
  "printTitle", "printPrepared", "printNote",
  "explainTitle", "explainIntro", "explainFactor", "explainResult", "explainRound", "explainNote",
];
for (const key of required) {
  assert.ok(keys.includes(key), `missing UI key ${key}`);
}

assert.equal(i18n.en.errorInvalid, "Please enter a valid land area.");
assert.equal(i18n.hi.errorInvalid, "कृपया भूमि का सही क्षेत्रफल दर्ज करें।");
assert.equal(i18n.as.errorInvalid, "অনুগ্ৰহ কৰি ভূমিৰ সঠিক পৰিমাণ লিখক।");

const used = new Set([...landSource.matchAll(/\bt\("([^"]+)"\)/g)].map((match) => match[1]));
for (const key of used) {
  assert.ok(keys.includes(key), `land.js uses missing key ${key}`);
}
for (const code of ["Empty", "Invalid", "Negative", "Zero", "TooLarge"]) {
  assert.ok(keys.includes(`error${code}`), `missing error key error${code}`);
}

console.log("land_i18n.test.cjs: all assertions passed");
