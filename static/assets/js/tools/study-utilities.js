"use strict";
(() => {
  const T = window.SANU_TOOLS;
  const { el } = T;
  const endpoint = (base, params) => base + "?" + new URLSearchParams(params);
  const list = value => Array.isArray(value) ? value : [];
  const text = value => typeof value === "string" ? value : "";
  const hint = value => el("p", { class: "tp-hint" }, value);
  const output = () => el("div", { class: "api-results" });
  const card = (title, ...children) => el("article", { class: "api-result" }, el("h3", {}, title), children);
  const source = (href, label) => el("a", { class: "wb-text-link", href, target: "_blank", rel: "noopener noreferrer" }, label);
  const format = number => Number(number).toLocaleString(undefined, { maximumSignificantDigits: 10 });

  async function json(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(url, {
        signal: controller.signal, credentials: "omit", redirect: "error", referrerPolicy: "no-referrer",
      });
      if (response.status === 404) return null;
      if (response.status === 429) throw new Error("The provider’s request limit was reached. Try again later.");
      if (!response.ok) throw new Error("The provider could not complete this request. Try again later.");
      return await response.json();
    } catch (error) {
      if (error.name === "AbortError") throw new Error("The provider took too long to respond. Try again.");
      if (error instanceof TypeError || error instanceof SyntaxError) throw new Error("The provider is unavailable. Try again later.");
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  function lookup(label, controls, result, run, help, compact = false) {
    const submit = T.button(label, null, "primary", { type: "submit" });
    const status = el("p", { class: "api-feedback", role: "status", "aria-atomic": "true" });
    const fields = compact ? el("div", { class: "study-weather-controls" }, controls, submit) : [controls, help, T.actions(submit)];
    const form = el("form", {}, fields, status, result);
    form.addEventListener("submit", async event => {
      event.preventDefault();
      if (submit.disabled) return;
      result.replaceChildren();
      status.classList.remove("api-error");
      status.textContent = "Loading…";
      submit.disabled = true;
      try {
        status.textContent = await run() || "";
      } catch (error) {
        status.classList.add("api-error");
        status.textContent = error.message || "This lookup is unavailable.";
      } finally {
        submit.disabled = false;
      }
    });
    return form;
  }

  const references = [
    ["Average speed", "v = d / t", "Divide total distance by elapsed time. SI: metres per second (m/s).", "motion speed velocity distance time"],
    ["Acceleration", "a = Δv / Δt", "Change in velocity per time interval. SI: m/s².", "motion acceleration metre m/s²"],
    ["Force", "F = ma", "Net force equals mass times acceleration for constant mass. SI: newton (N = kg·m/s²).", "newton force motion mass acceleration"],
    ["Momentum", "p = mv", "Mass times velocity. SI: kg·m/s.", "momentum motion"],
    ["Kinetic energy", "Eₖ = ½mv²", "Translational kinetic energy at nonrelativistic speeds. SI: joule (J).", "energy work motion joule kinetic"],
    ["Work and power", "W = Fd cos θ; P = W / t", "For a constant force at angle θ to displacement. SI: joule (J) and watt (W).", "energy work power watt joule"],
    ["Density", "ρ = m / V", "Mass divided by volume. SI: kg/m³.", "density mass volume"],
    ["Pressure", "p = F / A", "Normal force per unit area. SI: pascal (Pa = N/m²).", "pressure pascal area"],
    ["Ohm’s law", "V = IR", "For an ohmic conductor at constant temperature. Units: volts (V), amperes (A), ohms (Ω).", "ohm electricity circuit volt ampere resistance current"],
    ["Electrical power", "P = VI", "Power delivered in a DC circuit. SI: watt (W).", "electricity power watt"],
    ["Wave speed", "v = fλ", "Frequency f in hertz (Hz) times wavelength λ in metres (m).", "frequency hertz wavelength wave sound"],
    ["Circle", "A = πr²; C = 2πr", "Area and circumference of a circle with radius r.", "area circumference geometry radius"],
    ["Triangle", "A = ½bh", "Use the base and its perpendicular height.", "area geometry triangle"],
    ["Quadratic equation", "x = (−b ± √(b² − 4ac)) / (2a)", "Solutions of ax² + bx + c = 0, where a ≠ 0.", "math quadratic roots discriminant"],
    ["SI base units", "m · kg · s · A · K · mol · cd", "Metre, kilogram, second, ampere, kelvin, mole and candela.", "si unit metric mole kelvin candela"],
  ];

  T.register("dictionary-science-reference", root => {
    const word = T.input({ type: "search", required: true, maxlength: 65, placeholder: "e.g. energy" });
    const definition = output();
    const dictionary = lookup("Look up word", T.field("English word", word), definition, async () => {
      const query = word.value.trim();
      if (!/^[a-z][a-z'’ -]{0,64}$/i.test(query)) throw new Error("Enter an English word or phrase.");
      const data = await json("https://api.dictionaryapi.dev/api/v2/entries/en/" + encodeURIComponent(query.toLowerCase()));
      const entries = list(data);
      if (!entries.length) return "No dictionary entry found for “" + query + "”.";
      const meanings = entries.flatMap(entry => list(entry?.meanings)).filter(item => item && typeof item === "object");
      const synonyms = [...new Set(meanings.flatMap(item => [
        ...list(item.synonyms), ...list(item.definitions).flatMap(definition => list(definition?.synonyms)),
      ]).filter(value => typeof value === "string" && value.trim()))].slice(0, 20);
      const quotes = meanings.slice(0, 8).map(item => card(text(item.partOfSpeech) || "Definition",
        el("ol", {}, list(item.definitions).filter(row => text(row?.definition)).slice(0, 4).map(row =>
          el("li", {}, row.definition, text(row.example) ? hint("Example: " + row.example) : null)))));
      const first = entries[0] || {};
      const citation = Array.isArray(first.sourceUrls) && first.sourceUrls.find(value =>
        typeof value === "string" && /^https:\/\/[a-z]+\.wiktionary\.org\//i.test(value));
      definition.replaceChildren(card(text(first.word) || query,
        hint(text(first.phonetic) || list(first.phonetics).map(value => text(value?.text)).find(Boolean) || " "),
        el("p", {}, synonyms.length ? "Synonyms: " + synonyms.join(", ") : "No synonyms were listed for this entry."),
        citation ? source(citation, "Wiktionary entry") : null,
        source("https://dictionaryapi.dev/", "Free Dictionary API")), ...quotes);
      return "Found " + meanings.length + " meaning groups for “" + query + "”.";
    });

    const query = T.input({ type: "search", placeholder: "e.g. force, pascal or circle" });
    const formulaResults = output();
    const count = el("p", { class: "api-feedback", role: "status" });
    const filter = () => {
      const terms = query.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
      const matches = references.filter(row => terms.every(term => row.join(" ").toLowerCase().includes(term)));
      formulaResults.replaceChildren(...matches.map(([title, formula, note]) =>
        card(title, el("code", {}, formula), hint(note))));
      count.textContent = matches.length
        ? matches.length + (matches.length === 1 ? " reference entry." : " reference entries.")
        : "No formula matched. Try a topic or an SI unit.";
    };
    query.addEventListener("input", filter);
    filter();
    const unitQuery = T.input({ type: "search", required: true, maxlength: 60, placeholder: "e.g. kilogram or m/s" });
    const unitResults = output();
    let unitIndex;
    const unitLookup = lookup("Find unit", T.field("Measurement unit", unitQuery), unitResults, async () => {
      const key = unitQuery.value.trim().toLowerCase();
      if (!key) throw new Error("Enter a unit name or symbol.");
      if (!unitIndex) {
        const data = await json("https://toolalize.com/api/units");
        if (!Array.isArray(data?.categories)) throw new Error("The provider returned no unit catalogue.");
        unitIndex = data.categories.flatMap(category => list(category?.units).map(unit => ({ unit, category: category.id })));
      }
      const matches = unitIndex.filter(({ unit }) => text(unit?.name).toLowerCase().includes(key) ||
        text(unit?.symbol).toLowerCase() === key).slice(0, 12);
      unitResults.replaceChildren(...matches.map(({ unit, category }) =>
        card(text(unit.name), el("code", {}, text(unit.symbol)), hint(text(category)))));
      return matches.length ? matches.length + " matching units from Toolalize." : "No unit matched your search.";
    }, source("https://toolalize.com/openapi.json", "Toolalize unit catalogue"));
    root.replaceChildren(T.panel("Dictionary", dictionary),
      T.panel("Science and maths reference", [T.field("Find a formula or unit", query), count, formulaResults,
        el("p", {}, source("https://www.nist.gov/pml/special-publication-330/sp-330-section-2", "NIST SI reference"),
          " · ", el("a", { href: "/tools/live-forex-crypto-converter#units" }, "Convert units"))]),
      T.panel("Units catalogue", unitLookup));
  });

  const translations = [
    ["English · World English Bible", "web"], ["English · King James", "kjv"],
    ["Spanish · Reina Valera", "rv1909"], ["German · Luther", "luther1912"],
  ];
  const bookRank = "https://openbookrank.com";
  const gita = "https://vedicscriptures.github.io";
  const bayan = "https://bayan.alwa7i.com";
  const numericReference = /^(\d{1,3})\s*[:.]\s*(\d{1,3})$/;
  const verse = (label, value, lang) => text(value) ? card(label,
    el("p", { class: "study-reference-line", lang, dir: lang === "ar" ? "rtl" : null }, value)) : null;

  async function readGita(query) {
    const match = numericReference.exec(query);
    if (!match || Number(match[1]) < 1 || Number(match[1]) > 18 || Number(match[2]) < 1) {
      throw new Error("Enter a Gita chapter and verse, such as 2:47.");
    }
    const [, chapter, number] = match.map(Number);
    const data = await json(`${gita}/slok/${chapter}/${number}/`);
    if (!text(data?.slok)) return [];
    return [verse("Sanskrit · " + chapter + ":" + number, data.slok, "sa"),
      verse("Hindi · " + (text(data.tej?.author) || "Translation"), data.tej?.ht, "hi"),
      verse("English · " + (text(data.siva?.author) || "Translation"), data.siva?.et, "en"),
      source(gita, "Vedic Scriptures Bhagavad Gita API")];
  }

  async function readQuran(query) {
    const match = numericReference.exec(query);
    if (!match || Number(match[1]) < 1 || Number(match[1]) > 114 || Number(match[2]) < 1) {
      throw new Error("Enter a surah and ayah, such as 2:255.");
    }
    const [, surah, ayah] = match.map(Number);
    const data = await json(`${bayan}/api/quran/${surah}/${ayah}`);
    if (!text(data?.text)) return [];
    return [verse("Quran " + surah + ":" + ayah + " · Arabic", data.text, "ar"),
      el("p", {}, "Quran text © Tanzil Project · ", source("https://tanzil.net/docs/text_license", "Tanzil attribution"),
        " · ", source(`${bayan}/quran/${surah}/${ayah}`, "Read the verse in Bayan"))];
  }

  async function readBible(query, translation) {
    if (!/^[\p{L}\p{N} .:,-]{3,100}$/u.test(query) || !/\d/.test(query)) {
      throw new Error("Enter a Bible reference, such as John 3:16.");
    }
    const data = await json(endpoint("https://bible-api.com/" + encodeURIComponent(query), { translation }));
    if (!text(data?.text)) return [];
    const language = translation === "rv1909" ? "es" : translation === "luther1912" ? "de" : "en";
    return [verse(text(data.reference) || query, data.text, language),
      el("p", {}, text(data.translation_name), " · ", source("https://bible-api.com/", "Bible-api"))];
  }

  async function readBook(query) {
    const isbn = query.replace(/[ -]/g, "");
    if (!/^\d{13}$/.test(isbn) || [...isbn].reduce((sum, digit, index) =>
      sum + Number(digit) * (index % 2 ? 3 : 1), 0) % 10 !== 0) {
      throw new Error("Enter a valid 13-digit ISBN.");
    }
    const entry = await json(bookRank + "/api/v1/isbn/" + isbn + ".json");
    if (!/^[a-z\d-]{1,180}$/.test(text(entry?.slug))) return [];
    const data = await json(bookRank + "/api/v1/books/" + entry.slug + ".json");
    if (!text(data?.title)) return [];
    const score = Number.isFinite(data.score?.value)
      ? `${data.score.value}/${data.score.scale || 10} from ${format(data.score.ratings || 0)} reader ratings`
      : "This title does not have a score in the current snapshot.";
    return [card(data.title, hint([text(data.author?.name), data.year].filter(Boolean).join(" · ")),
      el("p", {}, score), ...list(data.ranks).slice(0, 4).map(rank => hint("#" + rank.rank + " · " + text(rank.name))),
      text(data.snapshot) ? hint("Snapshot: " + data.snapshot) : null,
      source(bookRank + "/en/book/" + entry.slug, "BookRank · openbookrank.com"))];
  }

  T.register("books-scripture-explorer", root => {
    const collections = T.select([["Bhagavad Gita", "gita"], ["Quran · Bayan", "quran"], ["Bible", "bible"], ["BookRank · ISBN", "books"]], "gita");
    const reference = T.input({ required: true, maxlength: 100, placeholder: "e.g. 2:47" });
    const translation = T.select(translations, "web");
    const translationField = T.field("Bible translation", translation);
    translationField.hidden = true;
    const results = output();
    const samples = { gita: "2:47", quran: "2:255", bible: "John 3:16", books: "9780765326355" };
    collections.addEventListener("change", () => {
      reference.value = "";
      reference.placeholder = "e.g. " + samples[collections.value];
      translationField.hidden = collections.value !== "bible";
      results.replaceChildren();
    });
    root.replaceChildren(T.panel(null, lookup("Find reference", [T.twoCol(T.field("Collection", collections),
      T.field("Verse, passage or ISBN", reference)), translationField], results, async () => {
      const query = reference.value.trim();
      const collection = collections.value;
      const reader = { gita: readGita, quran: readQuran, bible: readBible, books: readBook }[collection];
      const items = await reader(query, translation.value);
      if (collection !== collections.value) return "";
      results.replaceChildren(...items.filter(Boolean));
      return items.length ? "Reference found for “" + query + "”." : "No entry was found for “" + query + "”.";
    })));
  });

  const weatherPublic = {
    places: "https://geocoding-api.open-meteo.com/v1/search",
    weather: "https://api.open-meteo.com/v1/forecast",
    air: "https://air-quality-api.open-meteo.com/v1/air-quality",
  };
  const weatherFields = {
    weather: "temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code",
    air: "us_aqi,pm2_5,pm10",
  };
  const weatherDescription = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Rime fog",
    51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle", 56: "Freezing drizzle", 57: "Freezing drizzle",
    61: "Light rain", 63: "Rain", 65: "Heavy rain", 66: "Freezing rain", 67: "Freezing rain",
    71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains", 80: "Light showers", 81: "Showers",
    82: "Heavy showers", 85: "Snow showers", 86: "Heavy snow showers", 95: "Thunderstorm",
    96: "Thunderstorm with hail", 99: "Thunderstorm with hail",
  };
  const placeName = place => [place.name, place.admin1, place.country].map(text)
    .filter((value, index, values) => value && values.indexOf(value) === index).join(", ");
  const metric = (name, value, unit) => el("p", {}, name + ": " +
    (Number.isFinite(value) ? format(value) + (unit ? " " + unit : "") : "Unavailable"));

  function mountWeather(root, compact = false) {
    const mode = root.dataset.weatherMode;
    if (mode === "unconfigured") {
      root.replaceChildren(hint("Live weather and air quality are unavailable on this deployment until the weather service is configured."));
      return;
    }
    const city = T.input({ type: "search", required: true, minlength: 2, maxlength: 100, placeholder: "e.g. Guwahati" });
    const results = output();
    const fetchWeather = (kind, params) => json(endpoint(
      mode === "proxy" ? "/api/public-weather/" + kind : weatherPublic[kind], params));
    const renderPlace = async (place, container) => {
      container.replaceChildren(hint("Loading current conditions…"));
      const coords = { latitude: place.latitude, longitude: place.longitude, timezone: "auto" };
      const [weather, air] = await Promise.allSettled([
        fetchWeather("weather", { ...coords, current: weatherFields.weather }),
        fetchWeather("air", { ...coords, current: weatherFields.air }),
      ]);
      const details = (result, label, build) => {
        const current = result.value?.current;
        if (!current) return card(label, hint(result.reason?.message || "No data for this location."));
        const stamp = [text(current.time).replace("T", " "), text(result.value.timezone)].filter(Boolean).join(" · ");
        return card(label, ...build(current), stamp ? hint("Model time: " + stamp) : null);
      };
      container.replaceChildren(el("h3", {}, placeName(place)),
        details(weather, "Current weather", data => [
          text(weatherDescription[data.weather_code]) ? el("p", {}, weatherDescription[data.weather_code]) : null,
          metric("Temperature", data.temperature_2m, "°C"), metric("Humidity", data.relative_humidity_2m, "%"),
          metric("Wind speed", data.wind_speed_10m, "km/h")]),
        details(air, "Current air quality", data => [
          metric("U.S. AQI", data.us_aqi, ""), metric("PM2.5", data.pm2_5, "µg/m³"), metric("PM10", data.pm10, "µg/m³")]),
        el("p", {}, source("https://open-meteo.com/", "Open-Meteo"), " · ",
          source("https://atmosphere.copernicus.eu/", "CAMS air-quality model")));
    };
    const form = lookup("Find city", T.field("City or postcode", city), results, async () => {
      const query = city.value.trim();
      if (query.length < 2) throw new Error("Enter at least two characters for the location.");
      const data = await fetchWeather("places", { name: query, count: 6, language: "en" });
      const places = list(data?.results).filter(place => text(place?.name) &&
        Number.isFinite(place.latitude) && Number.isFinite(place.longitude));
      if (!places.length) return "No location matched “" + query + "”.";
      const conditions = el("section", { "aria-label": "Current conditions", "aria-live": "polite" });
      const select = T.select(places.map((place, index) => [placeName(place), String(index)]), "0");
      if (places.length > 1) results.append(T.field("Matching location", select));
      results.append(conditions);
      select.addEventListener("change", () => {
        // A detached result holder prevents a slower previous selection from overwriting this one.
        const selected = el("div");
        conditions.replaceChildren(selected);
        renderPlace(places[Number(select.value)], selected);
      });
      const initial = el("div");
      conditions.append(initial);
      await renderPlace(places[0], initial);
      return places.length > 1 ? "Showing the first match. Choose another location if needed." : "";
    }, null, compact);
    root.replaceChildren(compact ? form : T.panel(null, form));
  }
  T.register("weather-air-quality", mountWeather);
  const weatherWidget = document.querySelector("[data-study-weather-widget]");
  if (weatherWidget) mountWeather(weatherWidget, true);

  function publicLink(raw) {
    if (!/^https:\/\//i.test(raw) || raw.length > 2048 || /[\\\s]/u.test(raw)) return null;
    try {
      const url = new URL(raw);
      const host = url.hostname.replace(/\.$/, "");
      if (url.username || url.password || !/^[a-z0-9.-]+\.[a-z][a-z0-9-]*$/i.test(host) ||
          /\.(?:localhost|local|internal|test|invalid|example|onion|lan|home)$/i.test(host)) return null;
      return url;
    } catch { return null; }
  }

  T.register("url-shortener", root => {
    const input = T.input({ type: "url", maxlength: 2048, required: true, placeholder: "https://example.com/your-page" });
    const results = output();
    const form = lookup("Shorten link", T.field("Public HTTPS link", input), results, async () => {
      const url = publicLink(input.value.trim());
      if (!url) throw new Error("Enter a public HTTPS link without embedded credentials.");
      const data = await json(endpoint("https://is.gd/create.php", { format: "json", url: url.href }));
      const short = text(data?.shorturl);
      if (!/^https:\/\/is\.gd\/[a-z\d]+$/i.test(short)) {
        if (data?.errorcode === 3) throw new Error("The shortening request limit was reached. Try again later.");
        throw new Error("is.gd could not shorten this link.");
      }
      results.replaceChildren(card("Short link", el("code", {}, short),
        T.actions(T.copyButton(short, "Copy short link"),
          el("a", { class: "tp-btn tp-btn-primary", href: "/tools/qr-code-generator#short=" + encodeURIComponent(short) }, "Generate QR code"))));
      return "Short link created.";
    }, hint("The full URL is sent to is.gd. Only submit links you intend to share."));
    root.replaceChildren(T.panel(null, form));
  });

  const currencies = ["INR", "USD", "EUR", "GBP", "JPY", "BTC", "ETH", "SOL"];
  const units = {
    length: [["Centimetres", "centimeter"], ["Metres", "meter"], ["Kilometres", "kilometer"], ["Inches", "inch"], ["Feet", "foot"], ["Miles", "mile"]],
    weight: [["Grams", "gram"], ["Kilograms", "kilogram"], ["Pounds", "pound"], ["Ounces", "ounce"]],
    temperature: [["Celsius", "celsius"], ["Fahrenheit", "fahrenheit"], ["Kelvin", "kelvin"]],
    time: [["Seconds", "second"], ["Minutes", "minute"], ["Hours", "hour"], ["Days", "day"]],
  };
  const conversion = (value, from, to) => `${format(value)} ${from} → ${to}`;
  function amountValue(input) {
    if (input.value.trim() === "" || !Number.isFinite(input.valueAsNumber) || Math.abs(input.valueAsNumber) > 1e12) {
      throw new Error("Enter a number between −1 trillion and 1 trillion.");
    }
    return input.valueAsNumber;
  }

  T.register("live-forex-crypto-converter", root => {
    const amount = T.input({ type: "number", step: "any", min: 0, required: true, value: "100" });
    const from = T.select(currencies, "USD");
    const to = T.select(currencies, "INR");
    const rates = output();
    const market = lookup("Convert currency", [T.field("Amount", amount),
      T.twoCol(T.field("From currency", from), T.field("To currency", to))], rates, async () => {
      const value = amountValue(amount);
      const base = from.value, quote = to.value;
      const data = base === quote ? null : await json(endpoint("https://api.coinbase.com/v2/exchange-rates", { currency: base }));
      const rate = base === quote ? 1 : Number(data?.data?.rates?.[quote]);
      if (!Number.isFinite(rate) || rate <= 0 || !Number.isFinite(value * rate)) return "That currency pair is unavailable.";
      const result = format(value * rate) + " " + quote;
      rates.replaceChildren(card(result, hint(`1 ${base} = ${format(rate)} ${quote}`),
        hint(base === quote ? "Same currency" : "Fetched " + new Date().toLocaleString()),
        T.copyButton(result, "Copy conversion"), base === quote ? null :
          source("https://docs.cdp.coinbase.com/coinbase-app/track-apis/exchange-rates", "Coinbase exchange rates")));
      return "Converted " + conversion(value, base, quote) + ".";
    });
    const measurement = T.input({ type: "number", step: "any", required: true, value: "10" });
    const category = T.select([["Length", "length"], ["Mass", "weight"], ["Temperature", "temperature"], ["Time", "time"]], "length");
    const inputUnit = T.select(units.length, "centimeter"), outputUnit = T.select(units.length, "inch");
    const unitResults = output();
    category.addEventListener("change", () => {
      const choices = units[category.value];
      inputUnit.replaceChildren(...choices.map(([label, value]) => el("option", { value }, label)));
      outputUnit.replaceChildren(...choices.map(([label, value]) => el("option", { value }, label)));
      outputUnit.selectedIndex = 1;
      unitResults.replaceChildren();
    });
    const measure = lookup("Convert units", [T.twoCol(T.field("Measurement", measurement), T.field("Quantity", category)),
      T.twoCol(T.field("From unit", inputUnit), T.field("To unit", outputUnit))], unitResults, async () => {
      const value = amountValue(measurement);
      const params = { value, from: inputUnit.value, to: outputUnit.value, category: category.value };
      const data = await json(endpoint("https://toolalize.com/api/convert", params));
      if (data?.ok !== true || !Number.isFinite(data.result)) return "The unit conversion is unavailable.";
      const result = format(data.result) + " " + text(data.to?.symbol);
      unitResults.replaceChildren(card(result, hint(text(data.formula)), T.copyButton(result, "Copy conversion"),
        source("https://toolalize.com/openapi.json", "Toolalize conversion API")));
      return "Measurement converted.";
    });
    const unitPanel = T.panel("Measurement units", measure);
    unitPanel.id = "units";
    root.replaceChildren(T.panel("Fiat and crypto", market), unitPanel);
    if (location.hash === "#units") unitPanel.scrollIntoView();
  });

  const timingLine = /^(?:\d{2,}:)?\d{2}:\d{2}[.,]\d{3}\s+-->\s+(?:\d{2,}:)?\d{2}:\d{2}[.,]\d{3}(?:\s|$)/;
  function transcript(value, addTimes) {
    const result = [];
    for (const block of value.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split(/\n[ \t]*\n/)) {
      const lines = block.split("\n");
      if (/^(?:NOTE|STYLE|REGION)(?:\s|$)/.test(lines[0])) continue;
      const index = lines.findIndex(line => timingLine.test(line.trim()));
      if (index < 0) continue;
      const content = lines.slice(index + 1).map(line => line
        .replace(/<\/?(?:b|i|u|c(?:\.[\w-]+)*|ruby|rt|lang|v)(?:\s+[^<>]*)?>/gi, "")
        .replace(/<(?:(?:\d{2,}:)?\d{2}:\d{2}\.\d{3})>/g, "")
        .replace(/&(amp|lt|gt|nbsp|quot|apos);/g, (_, name) =>
          ({ amp: "&", lt: "<", gt: ">", nbsp: " ", quot: '"', apos: "'" })[name])
        .trim()).filter(Boolean).join("\n");
      if (content) result.push(addTimes ? lines[index].trim().split(/\s+-->/)[0] + "  " + content : content);
    }
    return result;
  }

  T.register("caption-transcript-extractor", root => {
    const file = T.input({ type: "file", accept: ".srt,.vtt,text/vtt,application/x-subrip", required: true });
    const times = el("input", { type: "checkbox" });
    const result = output();
    const extractor = lookup("Extract transcript", [T.field("Caption file", file), T.field("Include start timestamps", times)],
      result, async () => {
        const selected = file.files[0];
        if (!selected || !/\.(?:srt|vtt)$/i.test(selected.name) || selected.size > 2 * 1024 * 1024) {
          throw new Error("Choose an SRT or WebVTT file up to 2 MB.");
        }
        const cues = transcript(await selected.text(), times.checked);
        if (!cues.length) return "No timed caption cues found. Choose a valid SRT or WebVTT file.";
        const value = cues.join("\n\n");
        result.replaceChildren(T.field("Transcript", T.textarea(value, { readonly: true, rows: 10 })),
          T.actions(T.copyButton(value, "Copy transcript"),
            T.downloadButton("Download TXT", value, T.safeName(selected.name.replace(/\.[^.]+$/, "")) + "-transcript.txt",
              "text/plain;charset=utf-8")));
        return `${cues.length} caption cues extracted.`;
      }, hint("Upload a local caption file. The text is processed in this browser."));
    root.replaceChildren(T.panel(null, extractor));
  });
})();
