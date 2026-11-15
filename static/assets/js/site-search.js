"use strict";
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SiteSearch = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const normalize = value => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const aliases = { pic: "image", pics: "image", picture: "image", pictures: "image", photos: "photo", jpg: "jpg jpeg", jpeg: "jpeg jpg", adminpanel: "admin", apk: "apk apps", signin: "sign in", login: "login sign in", maths: "math", files: "file", downloads: "download", tools: "tool" };
  const near = (a, b) => {
    if (a.length < 4 || Math.abs(a.length - b.length) > 1) return false;
    if (a.length === b.length) {
      const differences = [...a].map((c, i) => c === b[i] ? -1 : i).filter(i => i >= 0);
      return differences.length === 1 || (differences.length === 2 && differences[1] === differences[0] + 1 && a[differences[0]] === b[differences[1]] && a[differences[1]] === b[differences[0]]);
    }
    const [short, long] = a.length < b.length ? [a, b] : [b, a];
    let i = 0;
    while (i < short.length && short[i] === long[i]) i++;
    return short.slice(i) === long.slice(i + 1);
  };
  const prepare = entries => entries.map(item => ({ ...item, title: normalize(item.name), text: normalize(`${item.name} ${item.description} ${item.category} ${item.keywords || ""}`) }));
  const search = (entries, query) => {
    const phrase = normalize(query);
    if (!phrase) return entries;
    const tokens = phrase.split(/\s+/);
    const scored = entries.map((item, index) => {
      const title = item.title ?? normalize(item.name);
      const text = item.text ?? normalize(`${item.name} ${item.description || ""} ${item.category || ""} ${item.keywords || ""}`);
      const words = text.split(" ");
      let fuzzy = false;
      let score = title === phrase ? 1000 : title.startsWith(phrase) ? 500 : title.includes(phrase) ? 300 : 0;
      for (const token of tokens) {
        const alternatives = [token, ...(aliases[token] || "").split(" ").filter(Boolean)];
        if (alternatives.some(t => title.split(" ").includes(t))) score += 60;
        else if (alternatives.some(t => text.includes(t))) score += 20;
        else if (words.some(word => near(token, word))) { score += 5; fuzzy = true; }
        else return null;
      }
      return { item, score, index, fuzzy };
    }).filter(Boolean);
    const exactMatches = scored.filter(result => !result.fuzzy);
    return (exactMatches.length ? exactMatches : scored).sort((a, b) => b.score - a.score || a.index - b.index).map(result => result.item);
  };
  return { normalize, prepare, search };
});
