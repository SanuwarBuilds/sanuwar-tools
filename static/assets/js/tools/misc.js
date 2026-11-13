"use strict";
(() => {
  const T = window.SANU_TOOLS;
  const { el } = T;
  const q = (selector, root) => T.$(selector, root);
  const status = (root, message, kind) => T.status(root, message, kind);
  const API = "https://api.frankfurter.dev/v1";
  const FALLBACK_CURRENCIES = ["USD", "EUR", "GBP", "JPY", "INR", "AUD", "CAD", "CHF", "CNY", "HKD", "SGD", "NZD", "SEK", "NOK", "DKK", "PLN", "CZK", "HUF", "RON", "BGN", "TRY", "ILS", "ZAR", "BRL", "MXN", "KRW", "THB", "MYR", "IDR", "PHP", "ISK"];

  T.register("currency-converter", (root) => {
    root.innerHTML = `<div class="tp-panel"><div class="tp-cols"><label class="tp-field"><span class="tp-label">Amount</span><input class="tp-input js-amount" type="number" min="0" step="any" value="100"></label><label class="tp-field"><span class="tp-label">From</span><span class="js-from"></span></label><label class="tp-field"><span class="tp-label">To</span><span class="js-to"></span></label></div><div class="tp-actions"><button type="button" class="tp-btn tp-btn-primary" data-convert>Convert</button><button type="button" class="tp-btn tp-btn-ghost" data-swap>⇄ Swap</button><button type="button" class="tp-btn tp-btn-ghost" data-copy>Copy result</button></div><div class="tp-currency-result js-result"><span>—</span><small>Live daily rate from the European Central Bank.</small></div><div class="tp-chips-inline"><button type="button" class="tp-chip js-quick" data-value="1">1</button><button type="button" class="tp-chip js-quick" data-value="10">10</button><button type="button" class="tp-chip js-quick" data-value="100">100</button><button type="button" class="tp-chip js-quick" data-value="1000">1,000</button><button type="button" class="tp-chip js-quick" data-value="10000">10,000</button></div></div>`;
    let from = T.select(["USD"], "USD");
    let to = T.select(["EUR"], "EUR");
    q(".js-from", root).replaceChildren(from);
    q(".js-to", root).replaceChildren(to);
    let summary = "";
    const fill = (codes) => {
      const currentFrom = from.value || "USD";
      const currentTo = to.value || "EUR";
      from = T.select(codes.map((code) => [code, code]), currentFrom);
      to = T.select(codes.map((code) => [code, code]), currentTo === currentFrom ? (currentFrom === "EUR" ? "USD" : "EUR") : currentTo);
      q(".js-from", root).replaceChildren(from);
      q(".js-to", root).replaceChildren(to);
      from.addEventListener("change", convert);
      to.addEventListener("change", convert);
    };
    const convert = async () => {
      const amount = Number(q(".js-amount", root).value);
      if (!Number.isFinite(amount) || amount < 0) return status(root, "Enter a valid amount.", "error");
      const result = q(".js-result", root);
      result.querySelector("span").textContent = "…";
      result.querySelector("small").textContent = "Fetching the latest daily rate…";
      try {
        const data = await T.fetchJSON(`${API}/latest?amount=${encodeURIComponent(amount)}&from=${encodeURIComponent(from.value)}&to=${encodeURIComponent(to.value)}`);
        const value = data.rates?.[to.value];
        if (value === undefined) throw new Error("That currency pair is not available.");
        const one = value / (amount || 1);
        result.querySelector("span").textContent = `${value.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${to.value}`;
        result.querySelector("small").textContent = `${amount.toLocaleString("en-US")} ${from.value} = ${value.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${to.value} · 1 ${from.value} = ${one.toLocaleString("en-US", { maximumFractionDigits: 6 })} ${to.value} · ${data.date}`;
        summary = `${amount} ${from.value} = ${value} ${to.value} (${data.date})`;
        status(root, "Converted with the latest published rate.", "ok");
      } catch (error) {
        result.querySelector("span").textContent = "—";
        result.querySelector("small").textContent = "Live rates are unavailable right now.";
        status(root, error.message, "error");
      }
    };
    from.addEventListener("change", convert);
    to.addEventListener("change", convert);
    q("[data-convert]", root).addEventListener("click", convert);
    q("[data-swap]", root).addEventListener("click", () => {
      const oldFrom = from.value;
      from.value = to.value;
      to.value = oldFrom;
      convert();
    });
    q("[data-copy]", root).addEventListener("click", () => T.copy(summary));
    q(".js-amount", root).addEventListener("keydown", (event) => { if (event.key === "Enter") convert(); });
    q(".js-amount", root).addEventListener("input", T.debounce(convert, 500));
    root.querySelectorAll(".js-quick").forEach((chip) => chip.addEventListener("click", () => { q(".js-amount", root).value = chip.dataset.value; convert(); }));
    T.fetchJSON(`${API}/currencies`).then((data) => {
      const codes = Object.keys(data).sort();
      fill(codes);
      convert();
    }).catch(() => {
      fill(FALLBACK_CURRENCIES);
      status(root, "Using a short currency list; live rates still need the network.", "info");
      convert();
    });
  });

  const FUNCTIONS = {
    sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, round: Math.round, floor: Math.floor, ceil: Math.ceil,
    sin: Math.sin, cos: Math.cos, tan: Math.tan, log: Math.log10, ln: Math.log, exp: Math.exp,
  };
  const PRECEDENCE = { "u-": 3, "^": 4, "*": 2, "/": 2, "+": 1, "-": 1 };
  const tokenize = (source) => {
    const text = String(source).replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-").replace(/√/g, "sqrt").replace(/π/g, "pi");
    const tokens = [];
    const push = (token) => {
      const previous = tokens[tokens.length - 1];
      const previousEnds = previous && (previous.type === "number" || previous.type === "postfix" || (previous.type === "paren" && previous.value === ")"));
      const nextStarts = token.type === "number" || token.type === "func" || (token.type === "name") || (token.type === "paren" && token.value === "(");
      if (previousEnds && nextStarts) tokens.push({ type: "op", value: "*" });
      tokens.push(token);
    };
    let index = 0;
    while (index < text.length) {
      const char = text[index];
      if (/\s/.test(char)) { index += 1; continue; }
      const number = text.slice(index).match(/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i);
      if (number) { push({ type: "number", value: Number(number[0]) }); index += number[0].length; continue; }
      const word = text.slice(index).match(/^[a-z]+/i);
      if (word) {
        const name = word[0].toLowerCase();
        if (name === "pi") push({ type: "number", value: Math.PI });
        else if (name === "e") push({ type: "number", value: Math.E });
        else if (FUNCTIONS[name]) push({ type: "func", value: name });
        else throw new Error(`Unknown name "${word[0]}".`);
        index += word[0].length;
        continue;
      }
      if ("+-*/^".includes(char)) { push({ type: "op", value: char }); index += 1; continue; }
      if (char === "(" || char === ")") { push({ type: "paren", value: char }); index += 1; continue; }
      if (char === "%" || char === "!") { push({ type: "postfix", value: char }); index += 1; continue; }
      throw new Error(`Unexpected character "${char}".`);
    }
    return tokens;
  };
  const evaluateExpression = (source) => {
    if (!String(source).trim()) return 0;
    const tokens = tokenize(source);
    const output = [];
    const stack = [];
    tokens.forEach((token, index) => {
      if (token.type === "number") { output.push(token); return; }
      if (token.type === "func") { stack.push(token); return; }
      if (token.type === "postfix") { output.push(token); return; }
      if (token.type === "paren") {
        if (token.value === "(") { stack.push(token); return; }
        while (stack.length && !(stack[stack.length - 1].type === "paren" && stack[stack.length - 1].value === "(")) output.push(stack.pop());
        if (!stack.length) throw new Error("Mismatched parentheses.");
        stack.pop();
        if (stack.length && stack[stack.length - 1].type === "func") output.push(stack.pop());
        return;
      }
      let operator = token.value;
      const previous = tokens[index - 1];
      const unary = operator === "-" && (!previous || (previous.type === "op") || (previous.type === "paren" && previous.value === "("));
      if (unary) operator = "u-";
      if (operator === "u-") { stack.push({ type: "op", value: operator }); return; }
      while (stack.length && stack[stack.length - 1].type === "op") {
        const top = stack[stack.length - 1].value;
        const higher = PRECEDENCE[top] > PRECEDENCE[operator];
        const equalLeft = PRECEDENCE[top] === PRECEDENCE[operator] && operator !== "^" && operator !== "u-";
        if (!higher && !equalLeft) break;
        output.push(stack.pop());
      }
      stack.push({ type: "op", value: operator });
    });
    while (stack.length) {
      const token = stack.pop();
      if (token.type === "paren") throw new Error("Mismatched parentheses.");
      output.push(token);
    }
    const values = [];
    for (const token of output) {
      if (token.type === "number") { values.push(token.value); continue; }
      if (token.type === "func") {
        if (!values.length) throw new Error("A function is missing its input.");
        values.push(FUNCTIONS[token.value](values.pop()));
        continue;
      }
      if (token.type === "postfix") {
        if (!values.length) throw new Error("A value is missing.");
        const value = values.pop();
        if (token.value === "%") { values.push(value / 100); continue; }
        if (!Number.isInteger(value) || value < 0 || value > 170) throw new Error("Factorial needs a whole number from 0 to 170.");
        let total = 1;
        for (let number = 2; number <= value; number += 1) total *= number;
        values.push(total);
        continue;
      }
      if (token.type === "op" && token.value === "u-") {
        if (!values.length) throw new Error("A value is missing.");
        values.push(-values.pop());
        continue;
      }
      if (values.length < 2) throw new Error("The expression is incomplete.");
      const b = values.pop();
      const a = values.pop();
      if (token.value === "+") values.push(a + b);
      else if (token.value === "-") values.push(a - b);
      else if (token.value === "*") values.push(a * b);
      else if (token.value === "/") values.push(a / b);
      else if (token.value === "^") values.push(a ** b);
      else throw new Error("Unknown operator.");
    }
    if (values.length !== 1) throw new Error("The expression is incomplete.");
    return values[0];
  };
  const formatCalc = (value) => {
    if (!Number.isFinite(value)) return "Error";
    if (Object.is(value, -0)) return "0";
    if (Number.isInteger(value) && Math.abs(value) < 1e15) return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
    const absolute = Math.abs(value);
    if (absolute !== 0 && (absolute < 1e-9 || absolute >= 1e12)) return value.toExponential(8).replace(/\.?0+e/, "e");
    return Number(value.toPrecision(12)).toString();
  };

  T.register("online-calculator", (root) => {
    const keys = [["C", "clear"], ["⌫", "back"], ["(", "("], [")", ")"], ["√", "sqrt("],
      ["7", "7"], ["8", "8"], ["9", "9"], ["÷", "/"], ["^", "^"],
      ["4", "4"], ["5", "5"], ["6", "6"], ["×", "*"], ["%", "%"],
      ["1", "1"], ["2", "2"], ["3", "3"], ["−", "-"], ["π", "pi"],
      ["0", "0"], [".", "."], ["e", "e"], ["+", "+"], ["=", "equals"]];
    root.innerHTML = `<div class="tp-calc"><div class="tp-calc-screen"><div class="tp-calc-history js-history" aria-label="Recent calculations"></div><input class="tp-calc-input js-expr" inputmode="text" spellcheck="false" autocomplete="off" aria-label="Calculator expression" value=""><output class="tp-calc-result js-result" aria-live="polite">0</output></div><div class="tp-calc-keys js-keys">${keys.map(([label, key]) => `<button type="button" class="tp-calc-key" data-key="${key}"${key === "equals" ? ' data-equals="true"' : ""}>${label}</button>`).join("")}</div><p class="tp-hint">Type directly with your keyboard. Enter calculates, Escape clears. Supports <code>+ − × ÷ ^</code>, parentheses, <code>sqrt()</code>, <code>%</code>, <code>!</code>, <code>pi</code> and <code>e</code>.</p></div>`;
    const expression = q(".js-expr", root);
    const result = q(".js-result", root);
    const historyNode = q(".js-history", root);
    const history = [];
    const calculate = (record = false) => {
      try {
        const value = evaluateExpression(expression.value);
        result.textContent = formatCalc(value);
        result.classList.remove("is-error");
        if (record && expression.value.trim()) {
          history.unshift(expression.value);
          history.splice(6);
          historyNode.replaceChildren(...history.map((item) => el("button", { type: "button", class: "tp-chip", onclick: () => { expression.value = item; calculate(); expression.focus(); } }, item)));
        }
      } catch (error) {
        result.textContent = error.message;
        result.classList.add("is-error");
      }
    };
    const insert = (text) => { expression.value += text; expression.focus(); calculate(); };
    q(".js-keys", root).addEventListener("click", (event) => {
      const key = event.target.closest("[data-key]")?.dataset.key;
      if (!key) return;
      if (key === "clear") { expression.value = ""; result.textContent = "0"; result.classList.remove("is-error"); expression.focus(); return; }
      if (key === "back") { expression.value = expression.value.slice(0, -1); calculate(); expression.focus(); return; }
      if (key === "equals") { calculate(true); return; }
      insert(key);
    });
    expression.addEventListener("input", () => calculate());
    expression.addEventListener("keydown", (event) => {
      if (event.key === "Enter") { event.preventDefault(); calculate(true); }
      else if (event.key === "Escape") { expression.value = ""; result.textContent = "0"; result.classList.remove("is-error"); }
    });
    expression.focus();
  });

  T.register("emoji-picker", (root) => {
    root.innerHTML = `<div class="tp-panel"><div class="tp-cols"><label class="tp-field"><span class="tp-label">Search emojis</span><input class="tp-input js-search" type="search" placeholder="happy, fire, flag, rocket…"></label><label class="tp-field"><span class="tp-label">Category</span><select class="tp-select js-category"><option value="all">All categories</option></select></label></div><div class="tp-emoji-detail js-detail"><span class="tp-emoji-big" aria-hidden="true">☺</span><div><strong>Pick an emoji</strong><p>Click any character to copy it instantly.</p></div></div><div class="tp-chips-inline js-count"></div><div class="tp-emoji-grid js-grid"></div></div>`;
    const grid = q(".js-grid", root);
    const category = q(".js-category", root);
    const detail = q(".js-detail", root);
    const search = q(".js-search", root);
    let emojis = [];
    const showDetail = (item) => {
      const points = [...item.e].map((character) => `U+${character.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`).join(" ");
      detail.replaceChildren(
        el("span", { class: "tp-emoji-big", "aria-hidden": "true", text: item.e }),
        el("div", {}, el("strong", { text: item.d }), el("p", { text: `${item.c} · ${points}` }), el("p", { class: "tp-hint", text: item.t || item.a || "" })),
        el("div", { class: "tp-emoji-actions" },
          T.button("Copy emoji", () => T.copy(item.e), "primary", { class: "tp-btn tp-btn-sm tp-btn-primary" }),
          T.button("Copy code point", () => T.copy(points), "ghost", { class: "tp-btn tp-btn-sm tp-btn-ghost" }),
          T.button("Copy HTML", () => T.copy([...item.e].map((character) => `&#x${character.codePointAt(0).toString(16)};`).join("")), "ghost", { class: "tp-btn tp-btn-sm tp-btn-ghost" })));
    };
    const draw = () => {
      const query = search.value.trim().toLowerCase();
      const selected = category.value;
      const visible = emojis.filter((item) => (selected === "all" || item.c === selected) && (!query || `${item.d} ${item.t || ""} ${item.a || ""} ${item.c}`.toLowerCase().includes(query)));
      q(".js-count", root).replaceChildren(el("span", { class: "tp-pill", text: `${visible.length.toLocaleString("en-US")} emojis` }));
      grid.replaceChildren(...visible.slice(0, 1200).map((item) => el("button", { type: "button", class: "tp-emoji", title: `${item.d} — ${item.c}`, "aria-label": item.d, onclick: () => { showDetail(item); T.copy(item.e); } }, item.e)));
      if (visible.length > 1200) grid.append(el("p", { class: "tp-hint", text: `Showing the first 1,200 of ${visible.length.toLocaleString("en-US")} matches — refine the search to narrow it down.` }));
    };
    search.addEventListener("input", T.debounce(draw, 120));
    category.addEventListener("change", draw);
    T.fetchJSON("/assets/data/emoji.json").then((data) => {
      emojis = data;
      const categories = [...new Set(data.map((item) => item.c))].sort();
      category.append(...categories.map((name) => el("option", { value: name, text: name })));
      draw();
      status(root, `${data.length.toLocaleString("en-US")} emojis loaded.`, "ok");
    }).catch((error) => status(root, `Could not load emojis: ${error.message}`, "error"));
  });

  const localInputValue = (date) => {
    const pad = (value) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  T.register("countdown-timer", (root) => {
    root.innerHTML = `<div class="tp-panel"><div class="tp-cols"><label class="tp-field"><span class="tp-label">Countdown name</span><input class="tp-input js-name" value="My countdown" maxlength="80"></label><label class="tp-field"><span class="tp-label">Target date and time</span><input class="tp-input js-target" type="datetime-local"></label></div><div class="tp-chips-inline"><button type="button" class="tp-chip js-preset" data-hours="1">+1 hour</button><button type="button" class="tp-chip js-preset" data-hours="24">+1 day</button><button type="button" class="tp-chip js-preset" data-hours="168">+1 week</button><button type="button" class="tp-chip js-preset" data-hours="720">+30 days</button></div><div class="tp-countdown js-clock"><div><strong>00</strong><span>days</span></div><div><strong>00</strong><span>hours</span></div><div><strong>00</strong><span>minutes</span></div><div><strong>00</strong><span>seconds</span></div></div><p class="tp-countdown-note js-note"></p><div class="tp-actions"><button type="button" class="tp-btn tp-btn-ghost" data-copy>Copy countdown</button><button type="button" class="tp-btn tp-btn-ghost" data-reset>Reset</button></div></div>`;
    const targetInput = q(".js-target", root);
    const nameInput = q(".js-name", root);
    const clock = q(".js-clock", root);
    const note = q(".js-note", root);
    let timer = null;
    const readTarget = () => targetInput.value ? new Date(targetInput.value) : null;
    const update = () => {
      const target = readTarget();
      if (!target || Number.isNaN(target.getTime())) {
        note.textContent = "Choose a target date and time.";
        return;
      }
      const remaining = Math.max(0, target.getTime() - Date.now());
      const days = Math.floor(remaining / 86400000);
      const hours = Math.floor(remaining / 3600000) % 24;
      const minutes = Math.floor(remaining / 60000) % 60;
      const seconds = Math.floor(remaining / 1000) % 60;
      [...clock.querySelectorAll("strong")].forEach((node, index) => { node.textContent = String([days, hours, minutes, seconds][index]).padStart(2, "0"); });
      if (remaining > 0) note.textContent = `${nameInput.value || "Countdown"} ends ${target.toLocaleString()} (${target.toISOString()}).`;
      else note.textContent = `${nameInput.value || "Countdown"} finished ${target.toLocaleString()}.`;
      clock.classList.toggle("is-finished", remaining <= 0);
      localStorage.setItem("sanuwar.countdown.target", targetInput.value);
      localStorage.setItem("sanuwar.countdown.name", nameInput.value);
    };
    const start = () => { clearInterval(timer); update(); timer = setInterval(update, 1000); };
    targetInput.addEventListener("change", start);
    nameInput.addEventListener("input", update);
    root.querySelectorAll(".js-preset").forEach((button) => button.addEventListener("click", () => {
      targetInput.value = localInputValue(new Date(Date.now() + Number(button.dataset.hours) * 3600000));
      start();
    }));
    q("[data-reset]", root).addEventListener("click", () => {
      targetInput.value = localInputValue(new Date(Date.now() + 86400000));
      start();
      status(root, "Countdown reset to 24 hours from now.", "ok");
    });
    q("[data-copy]", root).addEventListener("click", () => {
      const target = readTarget();
      if (!target) return;
      T.copy(`${nameInput.value || "Countdown"}: ${[...clock.querySelectorAll("strong")].map((node) => node.textContent).join(":")} remaining · target ${target.toISOString()}`);
    });
    const savedTarget = localStorage.getItem("sanuwar.countdown.target");
    const savedName = localStorage.getItem("sanuwar.countdown.name");
    targetInput.value = savedTarget || localInputValue(new Date(Date.now() + 86400000));
    if (savedName) nameInput.value = savedName;
    start();
  });

  T.register("utc-time", (root) => {
    root.innerHTML = `<div class="tp-panel"><div class="tp-clock-hero"><span class="tp-clock-label">Coordinated Universal Time</span><strong class="js-utc-time">00:00:00</strong><span class="js-utc-date">—</span></div><div class="tp-kv js-details"></div><div class="tp-actions"><button type="button" class="tp-btn tp-btn-ghost" data-copy-iso>Copy ISO 8601</button><button type="button" class="tp-btn tp-btn-ghost" data-copy-unix>Copy Unix timestamp</button><button type="button" class="tp-btn tp-btn-ghost" data-copy-all>Copy all</button></div></div>`;
    let values = {};
    const update = () => {
      const now = new Date();
      const utcTime = now.toLocaleTimeString("en-GB", { timeZone: "UTC", hour12: false });
      const utcDate = now.toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" });
      const start = Date.UTC(now.getUTCFullYear(), 0, 1);
      const dayOfYear = Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - start) / 86400000) + 1;
      const weekDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      weekDate.setUTCDate(weekDate.getUTCDate() + 3 - ((weekDate.getUTCDay() + 6) % 7));
      const firstThursday = new Date(Date.UTC(weekDate.getUTCFullYear(), 0, 4));
      firstThursday.setUTCDate(firstThursday.getUTCDate() + 3 - ((firstThursday.getUTCDay() + 6) % 7));
      const week = 1 + Math.round((weekDate - firstThursday) / 604800000);
      const offset = -now.getTimezoneOffset();
      const sign = offset >= 0 ? "+" : "−";
      const offsetText = `UTC${sign}${String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0")}:${String(Math.abs(offset) % 60).padStart(2, "0")}`;
      values = {
        "UTC time": utcTime,
        "UTC date": utcDate,
        "ISO 8601": now.toISOString(),
        "Unix timestamp": String(Math.floor(now.getTime() / 1000)),
        "Local time": now.toLocaleString(),
        "Your time zone": `${Intl.DateTimeFormat().resolvedOptions().timeZone} (${offsetText})`,
        "Day of year": `${dayOfYear} of ${(now.getUTCFullYear() % 4 === 0 && now.getUTCFullYear() % 100 !== 0) || now.getUTCFullYear() % 400 === 0 ? 366 : 365}`,
        "ISO week": `${now.getUTCFullYear()}-W${String(week).padStart(2, "0")}`,
      };
      q(".js-utc-time", root).textContent = utcTime;
      q(".js-utc-date", root).textContent = utcDate;
      q(".js-details", root).replaceChildren(...Object.entries(values).map(([label, value]) => el("div", {}, el("span", { text: label }), el("strong", { text: value }))));
    };
    q("[data-copy-iso]", root).addEventListener("click", () => T.copy(values["ISO 8601"]));
    q("[data-copy-unix]", root).addEventListener("click", () => T.copy(values["Unix timestamp"]));
    q("[data-copy-all]", root).addEventListener("click", () => T.copy(Object.entries(values).map(([label, value]) => `${label}: ${value}`).join("\n")));
    update();
    setInterval(update, 1000);
    status(root, "Clock running in UTC.", "ok");
  });

  T.register("qr-code-generator", (root) => {
    const type = T.select([
      ["Website URL or link", "url"],
      ["Plain text", "text"],
      ["Wi-Fi network", "wifi"],
      ["UPI payment", "upi"],
    ], "url");
    const content = T.textarea("https://sanuwartools.online", { rows: 3, placeholder: "https://example.com" });
    const ssid = T.input({ type: "text", placeholder: "Home Wi-Fi" });
    const password = T.input({ type: "password", placeholder: "Wi-Fi password" });
    const security = T.select([["WPA / WPA2 / WPA3", "WPA"], ["WEP", "WEP"], ["Open network", "nopass"]], "WPA");
    const hidden = el("input", { type: "checkbox" });
    const pa = T.input({ type: "text", placeholder: "name@bank" });
    const pn = T.input({ type: "text", placeholder: "Merchant or person name" });
    const amount = T.input({ type: "number", min: 0, step: "0.01", placeholder: "0.00" });
    const note = T.input({ type: "text", placeholder: "Payment note" });
    const size = T.select([["256 × 256 px", "256"], ["512 × 512 px", "512"], ["1024 × 1024 px", "1024"]], "512");
    const level = T.select([["Low — 7% recovery", "L"], ["Medium — 15% recovery", "M"], ["Quartile — 25% recovery", "Q"], ["High — 30% recovery", "H"]], "M");
    const margin = T.input({ type: "number", min: 0, max: 16, value: 4 });
    const contentField = T.field("URL or URI", content, "The QR code stores exactly what you enter.");
    contentField.classList.add("qr-wide");
    const wifiFields = [
      T.field("Network name (SSID)", ssid),
      T.field("Password", password),
      T.field("Security", security),
      T.field("Hidden network", hidden),
    ];
    const upiFields = [
      T.field("UPI ID", pa, "For example name@bank or 9876543210@upi."),
      T.field("Payee name", pn),
      T.field("Amount", amount, "Leave blank for an open amount."),
      T.field("Payment note", note),
    ];
    const canvas = el("canvas", { class: "qr-canvas", width: 512, height: 512, "aria-label": "Generated QR code" });
    const preview = el("div", { class: "qr-preview" }, canvas);
    const payloadText = el("code", { class: "qr-payload" });
    const form = el("div", { class: "tp-cols" },
      T.field("QR code type", type), contentField, ...wifiFields, ...upiFields,
      T.field("Download size (approx.)", size), T.field("Error correction", level),
      T.field("Quiet-zone margin (modules)", margin));
    const actions = el("div", { class: "tp-actions" },
      T.button("Generate QR code", () => generate(true), "primary"),
      T.button("Download PNG", () => downloadPng(), "ghost"),
      T.button("Copy encoded content", () => payload ? T.copy(payload) : status(root, "Generate a QR code first.", "error"), "ghost"));
    const panel = el("section", { class: "tp-panel" },
      el("h2", { class: "tp-panel-title", text: "Create a QR code" }),
      form,
      actions,
      el("div", { class: "qr-result" },
        preview,
        el("div", { class: "qr-meta" },
          el("span", { class: "qr-meta-label", text: "Encoded content" }),
          payloadText,
          el("p", { class: "tp-hint", text: "The QR code is generated in this browser. Nothing is uploaded." }))));
    root.replaceChildren(panel);

    let payload = "";
    let lastUrl = "https://sanuwartools.online";
    const escapeWifi = (value) => String(value).replace(/([\\;,":])/g, "\\$1");
    const encodeUpi = (value) => encodeURIComponent(String(value)).replace(/%40/g, "@");

    const syncFields = () => {
      const kind = type.value;
      contentField.hidden = kind !== "url" && kind !== "text";
      contentField.querySelector(".tp-label").textContent = kind === "url" ? "URL or URI" : "Text";
      content.placeholder = kind === "url" ? "https://example.com" : "Enter the text to encode";
      wifiFields.forEach((field) => { field.hidden = kind !== "wifi"; });
      upiFields.forEach((field) => { field.hidden = kind !== "upi"; });
      contentField.hidden = kind !== "url" && kind !== "text";
      schedule();
    };

    const buildPayload = () => {
      if (type.value === "url" || type.value === "text") {
        const value = content.value.trim();
        if (!value) throw new Error("Enter the URL or text to encode.");
        return value;
      }
      if (type.value === "wifi") {
        const network = ssid.value.trim();
        if (!network) throw new Error("Enter the Wi-Fi network name.");
        if (security.value !== "nopass" && !password.value) throw new Error("Enter the Wi-Fi password, or choose an open network.");
        let value = `WIFI:T:${security.value};S:${escapeWifi(network)};`;
        if (security.value !== "nopass") value += `P:${escapeWifi(password.value)};`;
        if (hidden.checked) value += "H:true;";
        return value + ";";
      }
      const address = pa.value.trim();
      if (!address) throw new Error("Enter the UPI ID.");
      const params = [`pa=${encodeUpi(address)}`];
      if (pn.value.trim()) params.push(`pn=${encodeUpi(pn.value.trim())}`);
      if (amount.value !== "" && Number(amount.value) > 0) params.push(`am=${encodeUpi(Number(amount.value).toFixed(2))}`);
      params.push("cu=INR");
      if (note.value.trim()) params.push(`tn=${encodeUpi(note.value.trim())}`);
      return `upi://pay?${params.join("&")}`;
    };

    const draw = (code) => {
      const count = code.getModuleCount();
      const quiet = Math.max(0, Math.min(16, Math.round(Number(margin.value) || 0)));
      const target = Math.max(128, Number(size.value) || 512);
      const cell = Math.max(1, Math.floor(target / (count + quiet * 2)));
      const pixels = cell * (count + quiet * 2);
      canvas.width = pixels;
      canvas.height = pixels;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, pixels, pixels);
      ctx.fillStyle = "#000000";
      for (let row = 0; row < count; row += 1) {
        for (let column = 0; column < count; column += 1) {
          if (code.isDark(row, column)) ctx.fillRect((column + quiet) * cell, (row + quiet) * cell, cell, cell);
        }
      }
      canvas.setAttribute("aria-label", `QR code for ${type.value === "wifi" ? "Wi-Fi network" : type.value === "upi" ? "UPI payment" : "content"}`);
    };

    const generate = (announce) => {
      try {
        if (!window.qrcode) throw new Error("The QR encoder did not load. Refresh the page.");
        payload = buildPayload();
        const code = window.qrcode(0, level.value);
        code.addData(payload);
        code.make();
        draw(code);
        lastUrl = type.value === "url" ? payload : lastUrl;
        payloadText.textContent = payload;
        if (announce) status(root, "QR code generated locally.", "ok");
      } catch (error) {
        payload = "";
        payloadText.textContent = "—";
        canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
        if (announce) status(root, error.message, "error");
      }
    };

    const downloadPng = () => {
      if (!payload) return status(root, "Generate a QR code first.", "error");
      canvas.toBlob((blob) => {
        if (!blob) return status(root, "Could not create the PNG.", "error");
        const name = (type.value === "url" ? lastUrl : type.value === "wifi" ? ssid.value : type.value === "upi" ? pa.value : "qr-code")
          .replace(/^https?:\/\//, "").replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "qr-code";
        T.download(`${name}.png`, blob, "image/png");
        status(root, "PNG downloaded.", "ok");
      }, "image/png");
    };

    const schedule = () => {
      clearTimeout(schedule.timer);
      schedule.timer = setTimeout(() => generate(false), 250);
    };

    [content, ssid, password, pa, pn, amount, note, margin].forEach((control) => control.addEventListener("input", schedule));
    [type, security, size, level].forEach((control) => control.addEventListener("change", syncFields));
    hidden.addEventListener("change", schedule);
    syncFields();
    generate(false);
  });
})();
