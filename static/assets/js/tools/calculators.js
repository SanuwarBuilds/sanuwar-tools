"use strict";
(() => {
  const T = window.SANU_TOOLS;
  const M = window.CalcMath;
  const { el } = T;

  const num = (value) => {
    if (value === null || value === undefined) return null;
    const text = String(value).replace(/[,\s]/g, "");
    if (!text) return null;
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const roundTo = (value, digits = 2) => {
    const factor = 10 ** digits;
    return Math.round((value + Number.EPSILON) * factor) / factor;
  };

  const fmt = (value, digits = 2) => {
    if (!Number.isFinite(value)) return "—";
    const abs = Math.abs(value);
    if (abs !== 0 && (abs >= 1e15 || abs < 1e-6)) return value.toExponential(4).replace(/\.?0+e/, "e");
    const safe = Math.min(10, Math.max(0, digits));
    const rounded = roundTo(value, safe);
    if (Object.is(rounded, -0)) return "0";
    return rounded.toLocaleString("en-US", { maximumFractionDigits: safe });
  };

  const money = (value) => {
    if (!Number.isFinite(value)) return "—";
    return "₹" + value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const parseNumbers = (text) => {
    const parts = String(text ?? "").split(/[\s,;]+/).filter(Boolean);
    if (!parts.length) throw new Error("Enter at least one number.");
    return parts.map((part) => {
      const value = Number(part);
      if (!Number.isFinite(value)) throw new Error(`"${part}" is not a valid number.`);
      return value;
    });
  };

  const gcd = (a, b) => {
    a = Math.abs(Math.round(a));
    b = Math.abs(Math.round(b));
    while (b) {
      const next = a % b;
      a = b;
      b = next;
    }
    return a || 1;
  };

  const lcm = (a, b) => Math.abs(a * b) / gcd(a, b);

  const simplifyFraction = (numerator, denominator) => {
    if (denominator === 0) throw new Error("The denominator cannot be zero.");
    const sign = denominator < 0 ? -1 : 1;
    const n = numerator * sign;
    const d = Math.abs(denominator);
    const divisor = gcd(n, d);
    return { n: n / divisor, d: d / divisor };
  };

  const fractionText = (n, d) => d === 1 ? String(n) : `${n}/${d}`;

  const mixedText = (n, d) => {
    if (d === 1) return String(n);
    if (Math.abs(n) < d) return `${n}/${d}`;
    const sign = n < 0 ? "−" : "";
    const abs = Math.abs(n);
    const whole = Math.floor(abs / d);
    const remainder = abs % d;
    return remainder === 0 ? `${sign}${whole}` : `${sign}${whole} ${remainder}/${d}`;
  };

  const superscript = (value) => String(value).split("").map((digit) => ({
    "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻",
  }[digit] || digit)).join("");

  const dayMs = 86400000;
  const pad = (value) => String(value).padStart(2, "0");
  const isoDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const today = () => isoDate(new Date());

  const parseDate = (value) => {
    const match = String(value ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) throw new Error("Enter a valid date.");
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      throw new Error("Enter a valid calendar date.");
    }
    return date;
  };

  const utcValue = (date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = (start, end) => Math.round((utcValue(end) - utcValue(start)) / dayMs);
  const addDays = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  const formatDate = (date) => date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const parseTime = (value) => {
    const match = String(value ?? "").match(/^(\d{1,2}):(\d{2})$/);
    if (!match) throw new Error("Enter a valid time.");
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) throw new Error("Enter a valid time.");
    return hours * 60 + minutes;
  };

  const durationText = (minutes) => {
    const total = Math.round(minutes);
    const hours = Math.floor(total / 60);
    const mins = total % 60;
    return `${hours} hour${hours === 1 ? "" : "s"} ${mins} minute${mins === 1 ? "" : "s"}`;
  };

  const randomInt = (min, max) => {
    const range = max - min + 1;
    if (window.crypto?.getRandomValues && range <= 0xFFFFFFFF) {
      const limit = Math.floor(0xFFFFFFFF / range) * range;
      const buffer = new Uint32Array(1);
      let value;
      do {
        window.crypto.getRandomValues(buffer);
        value = buffer[0];
      } while (value >= limit);
      return min + (value % range);
    }
    return min + Math.floor(Math.random() * range);
  };

  const H = {
    num, round: roundTo, fmt, money, parseNumbers, gcd, lcm, simplifyFraction, fractionText, mixedText,
    superscript, parseDate, isoDate, today, diffDays, addDays, formatDate, parseTime, durationText, randomInt,
  };

  const defaultOption = (options) => !options?.length ? "" : Array.isArray(options[0]) ? options[0][1] : options[0];
  const isVisible = (field, values) => typeof field.showIf !== "function" || field.showIf(values);
  const fieldLabel = (field, values) => typeof field.label === "function" ? field.label(values) : field.label;
  const fieldHint = (field, values) => typeof field.hint === "function" ? field.hint(values) : field.hint;

  const controls = (field, values, rerender) => {
    const current = values[field.id];
    if (field.type === "select") {
      const control = T.select(field.options || [], current);
      control.addEventListener("change", () => {
        values[field.id] = control.value;
        rerender();
      });
      return control;
    }
    if (field.type === "textarea") {
      const control = T.textarea(current ?? "", { rows: field.rows || 4, placeholder: field.placeholder || "" });
      control.addEventListener("input", () => { values[field.id] = control.value; });
      return control;
    }
    const attrs = { type: field.type || "text", placeholder: field.placeholder || "" };
    if (field.type === "number") {
      attrs.inputmode = "decimal";
      attrs.step = field.step ?? "any";
      if (field.min !== undefined) attrs.min = field.min;
      if (field.max !== undefined) attrs.max = field.max;
    }
    const control = T.input(attrs);
    control.value = current ?? "";
    control.addEventListener("input", () => { values[field.id] = control.value; });
    if (field.type === "date" || field.type === "time") control.addEventListener("change", () => { values[field.id] = control.value; });
    return control;
  };

  const mountWizard = (root, config) => {
    const steps = config.steps || [{ title: config.stepTitle || "Enter the values", fields: config.fields || [] }];
    const values = {};
    let index = 0;
    let resultState = null;
    let errorState = null;

    const seed = () => {
      Object.keys(values).forEach((key) => delete values[key]);
      steps.forEach((step) => step.fields.forEach((field) => {
        if (field.default !== undefined) values[field.id] = field.default;
        else if (field.type === "select") values[field.id] = defaultOption(field.options);
      }));
    };
    seed();

    const snapshot = () => {
      const copy = {};
      Object.keys(values).forEach((key) => { copy[key] = values[key]; });
      return copy;
    };

    const reset = () => {
      seed();
      index = 0;
      resultState = null;
      errorState = null;
      render();
    };

    const calculate = () => {
      try {
        resultState = config.compute(snapshot(), H);
        errorState = null;
      } catch (error) {
        resultState = null;
        errorState = error.message || "This calculation could not be completed.";
      }
      index = steps.length;
      render();
    };

    const validate = () => {
      const step = steps[index];
      const visible = step.fields.filter((field) => isVisible(field, values));
      for (const field of visible) {
        const value = values[field.id];
        const label = fieldLabel(field, values);
        if (field.type === "number") {
          if (field.required === false && String(value ?? "").trim() === "") continue;
          const parsed = num(value);
          if (parsed === null) return `${label} must be a number.`;
          if (field.min !== undefined && parsed < field.min) return `${label} must be at least ${field.min}.`;
          if (field.max !== undefined && parsed > field.max) return `${label} must be at most ${field.max}.`;
          continue;
        }
        if (field.required !== false && String(value ?? "").trim() === "") return `${label} is required.`;
      }
      return null;
    };

    const progress = () => {
      const labels = [...steps.map((step) => step.title || "Values"), "Result"];
      return el("ol", { class: "calc-progress", "aria-label": "Calculator steps" },
        labels.map((label, stepIndex) => el("li", {
          class: `calc-progress-step${stepIndex === index ? " is-active" : ""}${stepIndex < index ? " is-done" : ""}`,
        }, el("span", { class: "calc-progress-dot", text: String(stepIndex + 1).padStart(2, "0") }), el("span", { class: "calc-progress-label", text: label }))));
    };

    const summary = (result) => {
      const lines = [config.title, `${result.primary.label}: ${result.primary.value}`];
      (result.details || []).forEach(([label, value]) => lines.push(`${label}: ${value}`));
      return lines.join("\n");
    };

    const sourceView = () => {
      if (!config.reviewed && !config.sources?.length) return null;
      const source = el("p", { class: "calc-note calc-source" });
      if (config.reviewed) source.append(`Last reviewed ${config.reviewed}. `);
      if (config.sources?.length) {
        source.append("Official source: ");
        config.sources.forEach((item, sourceIndex) => {
          if (sourceIndex) source.append(" · ");
          source.append(el("a", {
            href: item.url,
            target: "_blank",
            rel: "noopener noreferrer",
            text: item.label,
          }));
        });
        source.append(".");
      }
      return source;
    };

    const resultView = () => {
      const result = resultState;
      const hero = el("div", { class: `calc-result-hero${result.variant ? " is-" + result.variant : ""}` },
        el("span", { class: "calc-result-label", text: result.primary.label }),
        el("strong", { class: "calc-result-value", text: result.primary.value }),
        result.primary.sub ? el("span", { class: "calc-result-sub", text: result.primary.sub }) : null);
      const section = el("section", { class: "tp-panel calc-result" }, hero);
      if (result.details?.length) {
        section.append(el("div", { class: "tp-kv calc-details" },
          result.details.map(([label, value]) => el("div", {}, el("span", { text: label }), el("strong", { text: String(value) })))));
      }
      if (result.steps?.length) {
        section.append(el("h3", { class: "tp-panel-title", text: "Step-by-step working" }));
        section.append(el("ol", { class: "calc-working" }, result.steps.map((line) => el("li", { text: String(line) }))));
      }
      (result.notes || []).forEach((note) => section.append(el("p", { class: "calc-note", text: String(note) })));
      section.append(el("div", { class: "tp-actions calc-actions" },
        T.button("Copy result", () => T.copy(summary(result)), "primary"),
        T.button("Edit inputs", () => { index = steps.length - 1; render(); }, "ghost"),
        T.button("Start over", reset, "ghost")));
      return section;
    };

    const errorView = () => el("section", { class: "tp-panel" },
      el("div", { class: "tp-error" }, el("strong", { text: "Check your inputs" }), el("p", { text: errorState })),
      el("div", { class: "tp-actions calc-actions" },
        T.button("Edit inputs", () => { index = Math.max(0, steps.length - 1); render(); }, "primary"),
        T.button("Start over", reset, "ghost")));

    const stepView = () => {
      const step = steps[index];
      const visible = step.fields.filter((field) => isVisible(field, values));
      const grid = el("div", { class: "tp-cols calc-fields" },
        visible.map((field) => {
          const wrap = el("label", { class: "tp-field" },
            el("span", { class: "tp-label", text: fieldLabel(field, values) }),
            controls(field, values, render));
          const hint = fieldHint(field, values);
          if (hint) wrap.append(el("span", { class: "tp-hint", text: hint }));
          if (field.wide) wrap.classList.add("calc-field-wide");
          return wrap;
        }));
      const isLast = index === steps.length - 1;
      const actions = el("div", { class: "tp-actions calc-actions" });
      if (index > 0) actions.append(T.button("← Back", () => { index -= 1; render(); }, "ghost"));
      actions.append(T.button(isLast ? "Calculate result" : "Next →", () => {
        const problem = validate();
        if (problem) {
          T.status(root, problem, "error");
          return;
        }
        if (isLast) calculate();
        else { index += 1; render(); }
      }, "primary"));
      actions.append(T.button("Reset", reset, "ghost"));
      return el("section", { class: "tp-panel calc-step" },
        el("h2", { class: "calc-step-title", text: `${index + 1}. ${step.title || "Values"}` }),
        step.description ? el("p", { class: "calc-step-desc", text: step.description }) : null,
        grid,
        actions);
    };

    const render = () => {
      const shell = el("div", { class: "calc-wizard" }, progress());
      if (index >= steps.length) {
        if (errorState) shell.append(errorView());
        else if (resultState) shell.append(resultView());
        else { calculate(); return; }
      } else {
        shell.append(stepView());
      }
      const source = sourceView();
      if (source) shell.append(source);
      root.replaceChildren(shell);
    };

    render();
  };

  const fractionMath = (a, b, c, d, op) => {
    if (b === 0 || d === 0) throw new Error("Denominators cannot be zero.");
    let numerator;
    let denominator;
    if (op === "+") { numerator = a * d + c * b; denominator = b * d; }
    else if (op === "-") { numerator = a * d - c * b; denominator = b * d; }
    else if (op === "*") { numerator = a * c; denominator = b * d; }
    else {
      if (c === 0) throw new Error("Cannot divide by a fraction with a zero numerator.");
      numerator = a * d;
      denominator = b * c;
    }
    const simplified = simplifyFraction(numerator, denominator);
    return { numerator, denominator, n: simplified.n, d: simplified.d };
  };

  const linearConverter = ({ slug, title, intro, units, baseLabel, defaultFrom, defaultTo, decimals = 6 }) => {
    const entries = Object.entries(units);
    const options = entries.map(([id, unit]) => [unit.label, id]);
    return {
      slug,
      title,
      intro,
      fields: [
        { id: "value", label: "Value to convert", type: "number", default: 1, placeholder: "1" },
        { id: "from", label: "From unit", type: "select", options, default: defaultFrom },
        { id: "to", label: "To unit", type: "select", options, default: defaultTo },
      ],
      compute(v, H) {
        const value = H.num(v.value);
        if (value === null) throw new Error("Enter a value to convert.");
        const from = units[v.from];
        const to = units[v.to];
        if (!from || !to) throw new Error("Choose both units.");
        const base = value * from.factor;
        const result = base / to.factor;
        const details = [
          ["Input", `${H.fmt(value, decimals)} ${from.label}`],
          ["Result", `${H.fmt(result, decimals)} ${to.label}`],
          ["Reverse rate", `1 ${to.label} = ${H.fmt(to.factor / from.factor, decimals)} ${from.label}`],
        ];
        entries.filter(([id]) => id !== v.from && id !== v.to).slice(0, 4).forEach(([, unit]) => {
          details.push([unit.label, H.fmt(base / unit.factor, decimals)]);
        });
        return {
          primary: { label: `${H.fmt(value, decimals)} ${from.label} equals`, value: `${H.fmt(result, decimals)} ${to.label}` },
          details,
          steps: [
            `Convert to the base unit: ${H.fmt(value, decimals)} ${from.label} × ${from.factor} = ${H.fmt(base, decimals)} ${baseLabel}.`,
            `Convert from the base unit: ${H.fmt(base, decimals)} ${baseLabel} ÷ ${to.factor} = ${H.fmt(result, decimals)} ${to.label}.`,
          ],
          notes: ["Every value is calculated locally with standard conversion factors."],
        };
      },
    };
  };

  const CALCS = [
    {
      slug: "percentage-calculator",
      title: "Percentage Calculator",
      intro: "Pick the percentage question, enter two numbers and get the answer with the formula shown line by line.",
      stepTitle: "Choose the percentage problem",
      fields: [
        { id: "mode", label: "What do you want to find?", type: "select", default: "of", options: [
          ["X% of Y", "of"], ["X is what percent of Y?", "is"], ["Percentage change from X to Y", "change"],
          ["Increase X by Y%", "increase"], ["Decrease X by Y%", "decrease"], ["X is Y% of what number?", "reverse"],
        ] },
        { id: "x", label: (v) => ({ of: "Percentage (X)", is: "Part (X)", change: "Original value (X)", increase: "Original value (X)", decrease: "Original value (X)", reverse: "Part (X)" }[v.mode] || "Value X"), type: "number", placeholder: "25" },
        { id: "y", label: (v) => ({ of: "Whole value (Y)", is: "Whole value (Y)", change: "New value (Y)", increase: "Percent increase (Y)", decrease: "Percent decrease (Y)", reverse: "Percentage (Y)" }[v.mode] || "Value Y"), type: "number", placeholder: "200" },
      ],
      compute(v, H) {
        const x = H.num(v.x);
        const y = H.num(v.y);
        if (x === null || y === null) throw new Error("Enter both numbers.");
        if (v.mode === "of") {
          const result = (x / 100) * y;
          return {
            primary: { label: `${H.fmt(x)}% of ${H.fmt(y)}`, value: H.fmt(result, 4) },
            details: [["Answer", H.fmt(result, 4)], ["Formula", "X% × Y = (X ÷ 100) × Y"]],
            steps: [`${H.fmt(x)}% of ${H.fmt(y)} = (${H.fmt(x)} ÷ 100) × ${H.fmt(y)}`, `= ${H.fmt(x / 100, 6)} × ${H.fmt(y)}`, `= ${H.fmt(result, 4)}`],
          };
        }
        if (v.mode === "is") {
          if (y === 0) throw new Error("The whole value cannot be zero.");
          const result = (x / y) * 100;
          return {
            primary: { label: `${H.fmt(x)} is what percent of ${H.fmt(y)}?`, value: `${H.fmt(result, 4)}%` },
            details: [["Percentage", `${H.fmt(result, 4)}%`], ["Formula", "(X ÷ Y) × 100"]],
            steps: [`(${H.fmt(x)} ÷ ${H.fmt(y)}) × 100`, `= ${H.fmt(x / y, 6)} × 100`, `= ${H.fmt(result, 4)}%`],
          };
        }
        if (v.mode === "change") {
          if (x === 0) throw new Error("The original value cannot be zero.");
          const result = ((y - x) / Math.abs(x)) * 100;
          return {
            primary: { label: "Percentage change", value: `${result > 0 ? "+" : ""}${H.fmt(result, 4)}%` },
            details: [["Change", H.fmt(y - x, 4)], ["Percentage change", `${H.fmt(result, 4)}%`], ["Direction", result >= 0 ? "Increase" : "Decrease"]],
            steps: [`((${H.fmt(y)} − ${H.fmt(x)}) ÷ |${H.fmt(x)}|) × 100`, `= (${H.fmt(y - x, 4)} ÷ ${H.fmt(Math.abs(x), 4)}) × 100`, `= ${H.fmt(result, 4)}%`],
          };
        }
        if (v.mode === "increase" || v.mode === "decrease") {
          const direction = v.mode === "increase" ? 1 : -1;
          const change = (x * y) / 100;
          const result = x + direction * change;
          return {
            primary: { label: `${H.fmt(x)} ${v.mode === "increase" ? "increased" : "decreased"} by ${H.fmt(y)}%`, value: H.fmt(result, 4) },
            details: [["Change amount", H.fmt(change, 4)], ["Final value", H.fmt(result, 4)], ["Formula", v.mode === "increase" ? "X × (1 + Y ÷ 100)" : "X × (1 − Y ÷ 100)"]],
            steps: [`${H.fmt(x)} × ${H.fmt(1 + direction * y / 100, 6)}`, `= ${H.fmt(result, 4)}`],
          };
        }
        if (y === 0) throw new Error("The percentage cannot be zero.");
        const result = x / (y / 100);
        return {
          primary: { label: `${H.fmt(x)} is ${H.fmt(y)}% of`, value: H.fmt(result, 4) },
          details: [["Whole value", H.fmt(result, 4)], ["Formula", "X ÷ (Y ÷ 100)"]],
          steps: [`${H.fmt(x)} ÷ (${H.fmt(y)} ÷ 100)`, `= ${H.fmt(x)} ÷ ${H.fmt(y / 100, 6)}`, `= ${H.fmt(result, 4)}`],
        };
      },
    },
    {
      slug: "fraction-calculator",
      title: "Fraction Calculator",
      intro: "Add, subtract, multiply or divide two fractions. The answer is simplified and converted to a decimal and mixed number.",
      stepTitle: "Enter both fractions",
      fields: [
        { id: "n1", label: "First numerator", type: "number", step: 1, default: 1 },
        { id: "d1", label: "First denominator", type: "number", step: 1, default: 2 },
        { id: "op", label: "Operation", type: "select", default: "+", options: [["Add (+)", "+"], ["Subtract (−)", "-"], ["Multiply (×)", "*"], ["Divide (÷)", "/"]] },
        { id: "n2", label: "Second numerator", type: "number", step: 1, default: 1 },
        { id: "d2", label: "Second denominator", type: "number", step: 1, default: 3 },
      ],
      compute(v, H) {
        const values = [v.n1, v.d1, v.n2, v.d2].map(H.num);
        if (values.some((value) => value === null || !Number.isInteger(value))) throw new Error("Use whole numbers for all fraction fields.");
        const [a, b, c, d] = values;
        const math = fractionMath(a, b, c, d, v.op);
        const decimal = math.n / math.d;
        const symbol = { "+": "+", "-": "−", "*": "×", "/": "÷" }[v.op];
        return {
          primary: { label: `${H.fractionText(a, b)} ${symbol} ${H.fractionText(c, d)}`, value: H.fractionText(math.n, math.d), sub: `Decimal ${H.fmt(decimal, 8)} · Mixed ${H.mixedText(math.n, math.d)}` },
          details: [["Simplified fraction", H.fractionText(math.n, math.d)], ["Mixed number", H.mixedText(math.n, math.d)], ["Decimal", H.fmt(decimal, 8)], ["Unsimplified", H.fractionText(math.numerator, math.denominator)]],
          steps: [
            `Set up: ${H.fractionText(a, b)} ${symbol} ${H.fractionText(c, d)}`,
            `Before simplifying: ${H.fractionText(math.numerator, math.denominator)}`,
            `Greatest common divisor: ${H.gcd(math.numerator, math.denominator)}`,
            `Simplified: ${H.fractionText(math.n, math.d)} = ${H.fmt(decimal, 8)}`,
          ],
          notes: ["Division by zero is not allowed."],
        };
      },
    },
    {
      slug: "mixed-number-calculator",
      title: "Mixed Number Calculator",
      intro: "Calculate with mixed numbers. Each mixed number is converted to an improper fraction, solved, then converted back.",
      stepTitle: "Enter the mixed numbers",
      fields: [
        { id: "w1", label: "First whole number", type: "number", step: 1, default: 1 },
        { id: "n1", label: "First numerator", type: "number", step: 1, default: 1 },
        { id: "d1", label: "First denominator", type: "number", step: 1, default: 2 },
        { id: "op", label: "Operation", type: "select", default: "+", options: [["Add (+)", "+"], ["Subtract (−)", "-"], ["Multiply (×)", "*"], ["Divide (÷)", "/"]] },
        { id: "w2", label: "Second whole number", type: "number", step: 1, default: 2 },
        { id: "n2", label: "Second numerator", type: "number", step: 1, default: 1 },
        { id: "d2", label: "Second denominator", type: "number", step: 1, default: 3 },
      ],
      compute(v, H) {
        const values = [v.w1, v.n1, v.d1, v.w2, v.n2, v.d2].map(H.num);
        if (values.some((value) => value === null || !Number.isInteger(value))) throw new Error("Use whole numbers for every field.");
        const [w1, n1, d1, w2, n2, d2] = values;
        if (d1 === 0 || d2 === 0) throw new Error("Denominators cannot be zero.");
        const a = w1 < 0 ? w1 * d1 - n1 : w1 * d1 + n1;
        const c = w2 < 0 ? w2 * d2 - n2 : w2 * d2 + n2;
        const math = fractionMath(a, d1, c, d2, v.op);
        const decimal = math.n / math.d;
        const symbol = { "+": "+", "-": "−", "*": "×", "/": "÷" }[v.op];
        return {
          primary: { label: `${H.mixedText(a, d1)} ${symbol} ${H.mixedText(c, d2)}`, value: H.mixedText(math.n, math.d), sub: `Improper ${H.fractionText(math.n, math.d)} · Decimal ${H.fmt(decimal, 8)}` },
          details: [["Mixed number", H.mixedText(math.n, math.d)], ["Improper fraction", H.fractionText(math.n, math.d)], ["Decimal", H.fmt(decimal, 8)]],
          steps: [
            `${H.mixedText(a, d1)} = (${w1} × ${d1} ${w1 < 0 ? "−" : "+"} ${n1}) / ${d1} = ${H.fractionText(a, d1)}`,
            `${H.mixedText(c, d2)} = (${w2} × ${d2} ${w2 < 0 ? "−" : "+"} ${n2}) / ${d2} = ${H.fractionText(c, d2)}`,
            `${H.fractionText(a, d1)} ${symbol} ${H.fractionText(c, d2)} = ${H.fractionText(math.n, math.d)}`,
            `Back to a mixed number: ${H.mixedText(math.n, math.d)}`,
          ],
        };
      },
    },
    {
      slug: "ratio-calculator",
      title: "Ratio Calculator",
      intro: "Simplify a ratio or solve a proportion A : B = C : D for the missing value.",
      stepTitle: "Enter the ratio",
      fields: [
        { id: "mode", label: "What do you need?", type: "select", default: "simplify", options: [["Simplify A : B", "simplify"], ["Solve A : B = C : D", "solve"]] },
        { id: "a", label: "A", type: "number", default: 12, placeholder: "12" },
        { id: "b", label: "B", type: "number", default: 18, placeholder: "18" },
        { id: "c", label: "C", type: "number", placeholder: "6", showIf: (v) => v.mode === "solve" },
      ],
      compute(v, H) {
        const a = H.num(v.a);
        const b = H.num(v.b);
        if (a === null || b === null) throw new Error("Enter both parts of the ratio.");
        if (v.mode === "simplify") {
          if (!Number.isInteger(a) || !Number.isInteger(b)) throw new Error("Use whole numbers to simplify a ratio.");
          if (a === 0 && b === 0) throw new Error("The ratio cannot be 0 : 0.");
          const divisor = H.gcd(a, b);
          const left = a / divisor;
          const right = b / divisor;
          return {
            primary: { label: `${H.fmt(a)} : ${H.fmt(b)} simplified`, value: `${H.fmt(left)} : ${H.fmt(right)}` },
            details: [["Greatest common divisor", H.fmt(divisor)], ["Decimal ratio", b === 0 ? "—" : H.fmt(a / b, 6)], ["Reverse ratio", `${H.fmt(right)} : ${H.fmt(left)}`]],
            steps: [`Find the GCD of ${H.fmt(a)} and ${H.fmt(b)}: ${H.fmt(divisor)}`, `Divide both parts by ${H.fmt(divisor)}: ${H.fmt(left)} : ${H.fmt(right)}`],
          };
        }
        const c = H.num(v.c);
        if (c === null) throw new Error("Enter C.");
        if (a === 0) throw new Error("A cannot be zero when solving the proportion.");
        if (b === 0) throw new Error("B cannot be zero when solving the proportion.");
        const d = (b * c) / a;
        return {
          primary: { label: "Missing value D", value: H.fmt(d, 6) },
          details: [["Proportion", `${H.fmt(a)} : ${H.fmt(b)} = ${H.fmt(c)} : ${H.fmt(d, 6)}`], ["Cross multiply", `${H.fmt(a)} × D = ${H.fmt(b)} × ${H.fmt(c)}`], ["Solution", `D = ${H.fmt(b * c, 6)} ÷ ${H.fmt(a, 6)}`]],
          steps: ["A : B = C : D means A × D = B × C", `${H.fmt(a)} × D = ${H.fmt(b)} × ${H.fmt(c)}`, `D = ${H.fmt(b * c, 6)} ÷ ${H.fmt(a, 6)} = ${H.fmt(d, 6)}`],
        };
      },
    },
    {
      slug: "gcd-lcm-calculator",
      title: "GCD and LCM Calculator",
      intro: "Find the greatest common divisor and least common multiple of two whole numbers with the Euclidean steps shown.",
      stepTitle: "Enter two whole numbers",
      fields: [
        { id: "a", label: "First number", type: "number", step: 1, default: 36 },
        { id: "b", label: "Second number", type: "number", step: 1, default: 48 },
      ],
      compute(v, H) {
        const a = H.num(v.a);
        const b = H.num(v.b);
        if (a === null || b === null) throw new Error("Enter both numbers.");
        if (!Number.isInteger(a) || !Number.isInteger(b) || a <= 0 || b <= 0) throw new Error("Use positive whole numbers.");
        const steps = [];
        let left = Math.max(a, b);
        let right = Math.min(a, b);
        while (right !== 0) {
          const quotient = Math.floor(left / right);
          const remainder = left % right;
          steps.push(`${left} = ${right} × ${quotient} + ${remainder}`);
          left = right;
          right = remainder;
        }
        const divisor = left;
        const multiple = (a * b) / divisor;
        return {
          primary: { label: `GCD of ${H.fmt(a)} and ${H.fmt(b)}`, value: H.fmt(divisor), sub: `LCM = ${H.fmt(multiple)}` },
          details: [["GCD", H.fmt(divisor)], ["LCM", H.fmt(multiple)], ["LCM formula", "(A × B) ÷ GCD"]],
          steps: [...steps, `GCD = ${H.fmt(divisor)}`, `LCM = (${H.fmt(a)} × ${H.fmt(b)}) ÷ ${H.fmt(divisor)} = ${H.fmt(multiple)}`],
        };
      },
    },
    {
      slug: "prime-factorization-calculator",
      title: "Prime Factorization Calculator",
      intro: "Break any whole number into prime factors and see every division step.",
      stepTitle: "Enter a whole number",
      fields: [{ id: "n", label: "Number", type: "number", step: 1, min: 2, max: 1e12, default: 360 }],
      compute(v, H) {
        const n = H.num(v.n);
        if (n === null) throw new Error("Enter a number.");
        if (!Number.isInteger(n) || n < 2 || n > 1e12) throw new Error("Enter a whole number from 2 to 1,000,000,000,000.");
        const factors = [];
        const steps = [];
        let value = n;
        const test = (prime) => {
          while (value % prime === 0) {
            factors.push(prime);
            steps.push(`${value} ÷ ${prime} = ${value / prime}`);
            value /= prime;
          }
        };
        test(2);
        for (let prime = 3; prime * prime <= value; prime += 2) test(prime);
        if (value > 1) {
          factors.push(value);
          steps.push(`${value} is prime and cannot be divided further.`);
        }
        const counts = new Map();
        factors.forEach((factor) => counts.set(factor, (counts.get(factor) || 0) + 1));
        const factorization = [...counts.entries()].map(([factor, count]) => count === 1 ? String(factor) : `${factor}${H.superscript(count)}`).join(" × ");
        return {
          primary: { label: `Prime factorization of ${H.fmt(n)}`, value: factorization },
          details: [["Prime factors", factors.join(", ")], ["Distinct primes", String(counts.size)], ["Factors with multiplicity", String(factors.length)]],
          steps: steps.length ? steps : [`${H.fmt(n)} is already prime.`],
          notes: [n > 1e7 ? "Large numbers may take a moment to factor." : "A prime factor cannot be divided by anything except 1 and itself."],
        };
      },
    },
    {
      slug: "square-root-calculator",
      title: "Square Root and Nth Root Calculator",
      intro: "Find a square root, cube root or any custom root with a clear exponent step.",
      stepTitle: "Enter the number and root",
      fields: [
        { id: "n", label: "Number", type: "number", default: 144 },
        { id: "root", label: "Root (2 = square root, 3 = cube root)", type: "number", default: 2, min: 1 },
      ],
      compute(v, H) {
        const n = H.num(v.n);
        const root = H.num(v.root);
        if (n === null || root === null) throw new Error("Enter both values.");
        if (root <= 0) throw new Error("The root must be greater than zero.");
        if (n < 0 && root % 2 === 0) throw new Error("Even roots of negative numbers are not real numbers.");
        const result = Math.sign(n) * Math.abs(n) ** (1 / root);
        const perfect = Math.abs(Math.round(result) ** root - n) < 1e-9;
        return {
          primary: { label: `${root === 2 ? "Square root" : root === 3 ? "Cube root" : `${H.fmt(root)}th root`} of ${H.fmt(n)}`, value: H.fmt(result, 8) },
          details: [["Root", H.fmt(root)], ["Result", H.fmt(result, 8)], ["Perfect power", perfect ? "Yes" : "No"], ["Check", `${H.fmt(result, 6)}^${H.fmt(root)} ≈ ${H.fmt(Math.sign(result) * Math.abs(result) ** root, 6)}`]],
          steps: ["Use the rule: result = n^(1/root)", `result = ${H.fmt(n)}^(1 ÷ ${H.fmt(root)})`, `result = ${H.fmt(result, 8)}`],
          notes: perfect ? ["The number is a perfect power, so the result is exact."] : [],
        };
      },
    },
    {
      slug: "exponent-calculator",
      title: "Exponent Calculator",
      intro: "Raise any base to a power, including negative and decimal exponents.",
      stepTitle: "Enter the base and exponent",
      fields: [
        { id: "base", label: "Base", type: "number", default: 2 },
        { id: "exponent", label: "Exponent", type: "number", default: 10 },
      ],
      compute(v, H) {
        const base = H.num(v.base);
        const exponent = H.num(v.exponent);
        if (base === null || exponent === null) throw new Error("Enter both values.");
        if (base === 0 && exponent < 0) throw new Error("0 cannot be raised to a negative power.");
        const result = base ** exponent;
        return {
          primary: { label: `${H.fmt(base, 6)} raised to ${H.fmt(exponent, 6)}`, value: H.fmt(result, 10) },
          details: [["Base", H.fmt(base, 6)], ["Exponent", H.fmt(exponent, 6)], ["Result", H.fmt(result, 10)], ["Scientific notation", result.toExponential(6)]],
          steps: ["Power = base^exponent", `Power = ${H.fmt(base, 6)}^${H.fmt(exponent, 6)}`, `Power = ${H.fmt(result, 10)}`],
          notes: exponent < 0 ? ["A negative exponent means divide 1 by the positive power."] : [],
        };
      },
    },
    {
      slug: "quadratic-equation-calculator",
      title: "Quadratic Equation Calculator",
      intro: "Solve ax² + bx + c = 0 with the quadratic formula, discriminant and vertex.",
      stepTitle: "Enter the coefficients",
      fields: [
        { id: "a", label: "a", type: "number", default: 1 },
        { id: "b", label: "b", type: "number", default: -3 },
        { id: "c", label: "c", type: "number", default: 2 },
      ],
      compute(v, H) {
        const a = H.num(v.a);
        const b = H.num(v.b);
        const c = H.num(v.c);
        if (a === null || b === null || c === null) throw new Error("Enter a, b and c.");
        if (a === 0) throw new Error("a cannot be zero in a quadratic equation.");
        const discriminant = b * b - 4 * a * c;
        let rootText;
        const steps = ["Discriminant Δ = b² − 4ac", `Δ = (${H.fmt(b)})² − 4 × ${H.fmt(a)} × ${H.fmt(c)} = ${H.fmt(discriminant)}`];
        if (discriminant > 0) {
          const r1 = (-b + Math.sqrt(discriminant)) / (2 * a);
          const r2 = (-b - Math.sqrt(discriminant)) / (2 * a);
          rootText = `x₁ = ${H.fmt(r1, 6)}, x₂ = ${H.fmt(r2, 6)}`;
          steps.push("x = (−b ± √Δ) ÷ 2a", `x₁ = (${H.fmt(-b)} + ${H.fmt(Math.sqrt(discriminant), 6)}) ÷ ${H.fmt(2 * a)} = ${H.fmt(r1, 6)}`, `x₂ = (${H.fmt(-b)} − ${H.fmt(Math.sqrt(discriminant), 6)}) ÷ ${H.fmt(2 * a)} = ${H.fmt(r2, 6)}`);
        } else if (discriminant === 0) {
          const root = -b / (2 * a);
          rootText = `x = ${H.fmt(root, 6)} (double root)`;
          steps.push(`x = −b ÷ 2a = ${H.fmt(root, 6)}`);
        } else {
          const real = -b / (2 * a);
          const imaginary = Math.sqrt(-discriminant) / (2 * a);
          rootText = `x = ${H.fmt(real, 6)} ± ${H.fmt(Math.abs(imaginary), 6)}i`;
          steps.push("x = (−b ± i√|Δ|) ÷ 2a", `x = ${H.fmt(real, 6)} ± ${H.fmt(Math.abs(imaginary), 6)}i`);
        }
        const vertexX = -b / (2 * a);
        const vertexY = c - (b * b) / (4 * a);
        return {
          primary: { label: "Roots", value: rootText, sub: `Δ = ${H.fmt(discriminant, 6)} · ${discriminant > 0 ? "two real roots" : discriminant === 0 ? "one real root" : "two complex roots"}` },
          details: [["Discriminant", H.fmt(discriminant, 6)], ["Vertex", `(${H.fmt(vertexX, 6)}, ${H.fmt(vertexY, 6)})`], ["Sum of roots", H.fmt(-b / a, 6)], ["Product of roots", H.fmt(c / a, 6)]],
          steps,
          notes: ["The quadratic formula is x = (−b ± √(b² − 4ac)) ÷ 2a."],
        };
      },
    },
    {
      slug: "rounding-calculator",
      title: "Rounding Calculator",
      intro: "Round a number to decimal places, significant figures or the nearest 10, 100 or 1,000.",
      stepTitle: "Choose the rounding rule",
      fields: [
        { id: "value", label: "Number to round", type: "number", default: 3.14159 },
        { id: "mode", label: "Rounding mode", type: "select", default: "decimal", options: [["Decimal places", "decimal"], ["Significant figures", "sig"], ["Nearest whole number", "integer"], ["Nearest 10", "ten"], ["Nearest 100", "hundred"], ["Nearest 1,000", "thousand"]] },
        { id: "places", label: "Places", type: "number", step: 1, min: 0, max: 15, default: 2, showIf: (v) => v.mode === "decimal" || v.mode === "sig" },
      ],
      compute(v, H) {
        const value = H.num(v.value);
        if (value === null) throw new Error("Enter a number to round.");
        const places = H.num(v.places);
        if ((v.mode === "decimal" || v.mode === "sig") && (places === null || !Number.isInteger(places) || places < 0 || places > 15)) throw new Error("Places must be a whole number from 0 to 15.");
        if (v.mode === "sig" && places === 0) throw new Error("Significant figures must be at least 1.");
        let result;
        let label;
        if (v.mode === "decimal") {
          result = H.round(value, places);
          label = `${places} decimal place${places === 1 ? "" : "s"}`;
        } else if (v.mode === "sig") {
          if (value === 0) result = 0;
          else {
            const magnitude = places - 1 - Math.floor(Math.log10(Math.abs(value)));
            const factor = 10 ** magnitude;
            result = Math.round(value * factor) / factor;
          }
          label = `${places} significant figure${places === 1 ? "" : "s"}`;
        } else {
          const unit = { integer: 1, ten: 10, hundred: 100, thousand: 1000 }[v.mode];
          result = Math.round(value / unit) * unit;
          label = v.mode === "integer" ? "the nearest whole number" : `the nearest ${unit.toLocaleString("en-US")}`;
        }
        return {
          primary: { label: `Rounded to ${label}`, value: H.fmt(result, 10), sub: `Original ${H.fmt(value, 10)}` },
          details: [["Original", H.fmt(value, 10)], ["Rounded", H.fmt(result, 10)], ["Difference", H.fmt(result - value, 10)], ["Direction", result > value ? "Rounded up" : result < value ? "Rounded down" : "Unchanged"]],
          steps: [`Look at ${label} in ${H.fmt(value, 10)}.`, `The rounded value is ${H.fmt(result, 10)}.`, `Difference = ${H.fmt(result - value, 10)}`],
        };
      },
    },
    {
      slug: "scientific-notation-calculator",
      title: "Scientific Notation Calculator",
      intro: "Convert any number to scientific, E and engineering notation in one step.",
      stepTitle: "Enter a number",
      fields: [{ id: "value", label: "Number", type: "number", default: 0.000123, placeholder: "0.000123" }],
      compute(v, H) {
        const value = H.num(v.value);
        if (value === null) throw new Error("Enter a number.");
        if (value === 0) {
          return {
            primary: { label: "Scientific notation", value: "0 × 10⁰" },
            details: [["E notation", "0e0"], ["Engineering notation", "0 × 10⁰"], ["Standard form", "0"]],
            steps: ["Zero has no non-zero digits, so it stays 0."],
          };
        }
        let exponent = Math.floor(Math.log10(Math.abs(value)));
        let mantissa = value / 10 ** exponent;
        if (Math.abs(mantissa) >= 10) { mantissa /= 10; exponent += 1; }
        if (Math.abs(mantissa) < 1) { mantissa *= 10; exponent -= 1; }
        const engineeringExponent = Math.floor(exponent / 3) * 3;
        const engineeringMantissa = value / 10 ** engineeringExponent;
        return {
          primary: { label: "Scientific notation", value: `${H.fmt(mantissa, 6)} × 10${H.superscript(exponent)}` },
          details: [["E notation", `${H.fmt(mantissa, 6)}e${exponent}`], ["Engineering notation", `${H.fmt(engineeringMantissa, 6)} × 10${H.superscript(engineeringExponent)}`], ["Standard form", H.fmt(value, 10)], ["Exponent", String(exponent)]],
          steps: ["Move the decimal point so the mantissa is between 1 and 10.", `${H.fmt(value, 10)} = ${H.fmt(mantissa, 6)} × 10${H.superscript(exponent)}`, `Engineering notation uses a power of 3: ${H.fmt(engineeringMantissa, 6)} × 10${H.superscript(engineeringExponent)}`],
        };
      },
    },
    {
      slug: "percent-error-calculator",
      title: "Percent Error Calculator",
      intro: "Compare an experimental value with a theoretical value and get the percent error with working.",
      stepTitle: "Enter both values",
      fields: [
        { id: "experimental", label: "Experimental value", type: "number", default: 98 },
        { id: "theoretical", label: "Theoretical value", type: "number", default: 100 },
      ],
      compute(v, H) {
        const experimental = H.num(v.experimental);
        const theoretical = H.num(v.theoretical);
        if (experimental === null || theoretical === null) throw new Error("Enter both values.");
        if (theoretical === 0) throw new Error("The theoretical value cannot be zero.");
        const error = Math.abs(experimental - theoretical);
        const percent = (error / Math.abs(theoretical)) * 100;
        return {
          primary: { label: "Percent error", value: `${H.fmt(percent, 4)}%`, sub: `Absolute error ${H.fmt(error, 6)}` },
          details: [["Experimental", H.fmt(experimental, 6)], ["Theoretical", H.fmt(theoretical, 6)], ["Absolute error", H.fmt(error, 6)], ["Percent error", `${H.fmt(percent, 4)}%`]],
          steps: [`Absolute error = |${H.fmt(experimental)} − ${H.fmt(theoretical)}| = ${H.fmt(error, 6)}`, `Percent error = (${H.fmt(error, 6)} ÷ |${H.fmt(theoretical)}|) × 100`, `= ${H.fmt(percent, 4)}%`],
        };
      },
    },
    {
      slug: "average-calculator",
      title: "Average, Median and Mode Calculator",
      intro: "Paste a list of numbers to get the mean, median, mode, range and count with step-by-step working.",
      stepTitle: "Paste your numbers",
      fields: [{ id: "numbers", label: "Numbers", type: "textarea", rows: 5, wide: true, placeholder: "10, 20, 20, 35, 50", default: "10, 20, 20, 35, 50" }],
      compute(v, H) {
        const numbers = H.parseNumbers(v.numbers);
        const sorted = [...numbers].sort((a, b) => a - b);
        const count = numbers.length;
        const sum = numbers.reduce((total, value) => total + value, 0);
        const mean = sum / count;
        const middle = Math.floor(count / 2);
        const median = count % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
        const counts = new Map();
        numbers.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
        const highest = Math.max(...counts.values());
        const modes = [...counts.entries()].filter(([, times]) => times === highest).map(([value]) => value);
        return {
          primary: { label: "Mean (average)", value: H.fmt(mean, 6), sub: `${count} value${count === 1 ? "" : "s"} · sum ${H.fmt(sum, 6)}` },
          details: [["Count", H.fmt(count)], ["Sum", H.fmt(sum, 6)], ["Median", H.fmt(median, 6)], ["Mode", highest === 1 ? "No repeated value" : modes.map((value) => H.fmt(value, 6)).join(", ")], ["Range", H.fmt(sorted[count - 1] - sorted[0], 6)], ["Minimum", H.fmt(sorted[0], 6)], ["Maximum", H.fmt(sorted[count - 1], 6)]],
          steps: [`Sum = ${numbers.join(" + ")} = ${H.fmt(sum, 6)}`, `Mean = sum ÷ count = ${H.fmt(sum, 6)} ÷ ${count} = ${H.fmt(mean, 6)}`, `Sorted: ${sorted.map((value) => H.fmt(value, 6)).join(", ")}`, `Median = ${H.fmt(median, 6)}`],
        };
      },
    },
    {
      slug: "standard-deviation-calculator",
      title: "Standard Deviation Calculator",
      intro: "Calculate population or sample standard deviation from a list of numbers, with variance and mean shown.",
      stepTitle: "Enter the data set",
      fields: [
        { id: "numbers", label: "Numbers", type: "textarea", rows: 5, wide: true, placeholder: "2, 4, 4, 4, 5, 5, 7, 9", default: "2, 4, 4, 4, 5, 5, 7, 9" },
        { id: "type", label: "Data set", type: "select", default: "sample", options: [["Sample (n − 1)", "sample"], ["Population (n)", "population"]] },
      ],
      compute(v, H) {
        const numbers = H.parseNumbers(v.numbers);
        const count = numbers.length;
        if (count < 2) throw new Error("Enter at least two numbers.");
        const mean = numbers.reduce((total, value) => total + value, 0) / count;
        const squared = numbers.map((value) => (value - mean) ** 2);
        const sumSquares = squared.reduce((total, value) => total + value, 0);
        const denominator = v.type === "sample" ? count - 1 : count;
        const variance = sumSquares / denominator;
        const deviation = Math.sqrt(variance);
        return {
          primary: { label: `Standard deviation (${v.type})`, value: H.fmt(deviation, 6), sub: `Variance ${H.fmt(variance, 6)} · Mean ${H.fmt(mean, 6)}` },
          details: [["Count", H.fmt(count)], ["Mean", H.fmt(mean, 6)], ["Sum of squared differences", H.fmt(sumSquares, 6)], ["Denominator", String(denominator)], ["Variance", H.fmt(variance, 6)], ["Standard deviation", H.fmt(deviation, 6)]],
          steps: [`Mean = ${H.fmt(mean, 6)}`, `Squared differences: ${squared.map((value) => H.fmt(value, 4)).join(", ")}`, `Sum of squares = ${H.fmt(sumSquares, 6)}`, `Variance = ${H.fmt(sumSquares, 6)} ÷ ${denominator} = ${H.fmt(variance, 6)}`, `Standard deviation = √${H.fmt(variance, 6)} = ${H.fmt(deviation, 6)}`],
          notes: ["Use the sample formula when the data is a sample of a larger group."],
        };
      },
    },
    {
      slug: "random-number-generator",
      title: "Random Number Generator",
      intro: "Generate random whole numbers inside any range, with an option to avoid repeats.",
      stepTitle: "Set the range",
      fields: [
        { id: "min", label: "Minimum", type: "number", step: 1, default: 1 },
        { id: "max", label: "Maximum", type: "number", step: 1, default: 100 },
        { id: "count", label: "How many numbers?", type: "number", step: 1, min: 1, max: 1000, default: 5 },
        { id: "unique", label: "Avoid duplicate numbers?", type: "select", default: "no", options: [["No, duplicates are allowed", "no"], ["Yes, every number different", "yes"]] },
      ],
      compute(v, H) {
        const min = H.num(v.min);
        const max = H.num(v.max);
        const count = H.num(v.count);
        if (min === null || max === null || count === null) throw new Error("Enter the minimum, maximum and count.");
        if (!Number.isInteger(min) || !Number.isInteger(max)) throw new Error("Minimum and maximum must be whole numbers.");
        if (!Number.isInteger(count) || count < 1 || count > 1000) throw new Error("Count must be a whole number from 1 to 1,000.");
        if (min > max) throw new Error("Minimum cannot be greater than maximum.");
        const range = max - min + 1;
        if (v.unique === "yes" && range < count) throw new Error(`Only ${H.fmt(range)} unique values exist in that range.`);
        const values = [];
        if (v.unique === "yes") {
          const used = new Set();
          while (values.length < count) {
            const value = H.randomInt(min, max);
            if (!used.has(value)) { used.add(value); values.push(value); }
          }
        } else {
          for (let index = 0; index < count; index += 1) values.push(H.randomInt(min, max));
        }
        return {
          primary: { label: `Generated ${count} random number${count === 1 ? "" : "s"}`, value: values.join(", ") },
          details: [["Range", `${H.fmt(min)} to ${H.fmt(max)}`], ["Count", H.fmt(count)], ["Unique", v.unique === "yes" ? "Yes" : "No"]],
          steps: [`Range size = ${H.fmt(max)} − ${H.fmt(min)} + 1 = ${H.fmt(range)}`, `Generated ${count} value${count === 1 ? "" : "s"} with ${window.crypto?.getRandomValues ? "secure browser randomness" : "browser randomness"}.`],
          notes: ["Run the calculation again for a fresh set of numbers."],
        };
      },
    },
    {
      slug: "triangle-calculator",
      title: "Triangle Calculator",
      intro: "Enter all three sides to get the area, perimeter, angles and triangle type.",
      stepTitle: "Enter the three sides",
      fields: [
        { id: "a", label: "Side a", type: "number", default: 3 },
        { id: "b", label: "Side b", type: "number", default: 4 },
        { id: "c", label: "Side c", type: "number", default: 5 },
      ],
      compute(v, H) {
        const a = H.num(v.a);
        const b = H.num(v.b);
        const c = H.num(v.c);
        if (a === null || b === null || c === null) throw new Error("Enter all three sides.");
        if (a <= 0 || b <= 0 || c <= 0) throw new Error("Every side must be greater than zero.");
        if (a + b <= c || a + c <= b || b + c <= a) throw new Error("These sides cannot form a triangle: each pair must add up to more than the third side.");
        const perimeter = a + b + c;
        const s = perimeter / 2;
        const area = Math.sqrt(Math.max(0, s * (s - a) * (s - b) * (s - c)));
        const angle = (opposite, left, right) => {
          const ratio = (left * left + right * right - opposite * opposite) / (2 * left * right);
          return Math.acos(Math.max(-1, Math.min(1, ratio))) * (180 / Math.PI);
        };
        const A = angle(a, b, c);
        const B = angle(b, a, c);
        const C = 180 - A - B;
        const sides = [a, b, c].sort((x, y) => x - y);
        const sideType = sides[0] === sides[2] ? "Equilateral" : sides[0] === sides[1] || sides[1] === sides[2] ? "Isosceles" : "Scalene";
        const largest = Math.max(A, B, C);
        const angleType = Math.abs(largest - 90) < 1e-9 ? "Right" : largest > 90 ? "Obtuse" : "Acute";
        return {
          primary: { label: "Area", value: H.fmt(area, 6), sub: `${sideType} · ${angleType} triangle` },
          details: [["Perimeter", H.fmt(perimeter, 6)], ["Semi-perimeter", H.fmt(s, 6)], ["Angle A", `${H.fmt(A, 4)}°`], ["Angle B", `${H.fmt(B, 4)}°`], ["Angle C", `${H.fmt(C, 4)}°`], ["Type", `${sideType}, ${angleType.toLowerCase()}`]],
          steps: [`Semi-perimeter s = (${H.fmt(a)} + ${H.fmt(b)} + ${H.fmt(c)}) ÷ 2 = ${H.fmt(s, 6)}`, "Area = √[s(s−a)(s−b)(s−c)]", `Area = √[${H.fmt(s, 6)} × ${H.fmt(s - a, 6)} × ${H.fmt(s - b, 6)} × ${H.fmt(s - c, 6)}] = ${H.fmt(area, 6)}`, "Angles use the law of cosines: cos A = (b² + c² − a²) ÷ 2bc"],
        };
      },
    },
    {
      slug: "circle-calculator",
      title: "Circle Calculator",
      intro: "Enter a radius to calculate diameter, circumference and area.",
      stepTitle: "Enter the radius",
      fields: [{ id: "radius", label: "Radius", type: "number", default: 5 }],
      compute(v, H) {
        const radius = H.num(v.radius);
        if (radius === null || radius <= 0) throw new Error("Enter a radius greater than zero.");
        const diameter = 2 * radius;
        const circumference = 2 * Math.PI * radius;
        const area = Math.PI * radius * radius;
        return {
          primary: { label: "Area", value: H.fmt(area, 6), sub: `Circumference ${H.fmt(circumference, 6)}` },
          details: [["Radius", H.fmt(radius, 6)], ["Diameter", H.fmt(diameter, 6)], ["Circumference", H.fmt(circumference, 6)], ["Area", H.fmt(area, 6)]],
          steps: [`Diameter = 2r = 2 × ${H.fmt(radius, 6)} = ${H.fmt(diameter, 6)}`, `Circumference = 2πr = 2 × π × ${H.fmt(radius, 6)} = ${H.fmt(circumference, 6)}`, `Area = πr² = π × ${H.fmt(radius, 6)}² = ${H.fmt(area, 6)}`],
        };
      },
    },
    {
      slug: "rectangle-calculator",
      title: "Rectangle Calculator",
      intro: "Get the area, perimeter and diagonal of a rectangle from its length and width.",
      stepTitle: "Enter length and width",
      fields: [
        { id: "length", label: "Length", type: "number", default: 8 },
        { id: "width", label: "Width", type: "number", default: 5 },
      ],
      compute(v, H) {
        const length = H.num(v.length);
        const width = H.num(v.width);
        if (length === null || width === null || length <= 0 || width <= 0) throw new Error("Enter a length and width greater than zero.");
        const area = length * width;
        const perimeter = 2 * (length + width);
        const diagonal = Math.sqrt(length * length + width * width);
        return {
          primary: { label: "Area", value: H.fmt(area, 6), sub: `Perimeter ${H.fmt(perimeter, 6)}` },
          details: [["Length", H.fmt(length, 6)], ["Width", H.fmt(width, 6)], ["Area", H.fmt(area, 6)], ["Perimeter", H.fmt(perimeter, 6)], ["Diagonal", H.fmt(diagonal, 6)]],
          steps: [`Area = length × width = ${H.fmt(length, 6)} × ${H.fmt(width, 6)} = ${H.fmt(area, 6)}`, `Perimeter = 2 × (length + width) = ${H.fmt(perimeter, 6)}`, `Diagonal = √(length² + width²) = ${H.fmt(diagonal, 6)}`],
        };
      },
    },
    {
      slug: "cylinder-calculator",
      title: "Cylinder Calculator",
      intro: "Calculate the volume and surface area of a cylinder from its radius and height.",
      stepTitle: "Enter radius and height",
      fields: [
        { id: "radius", label: "Radius", type: "number", default: 3 },
        { id: "height", label: "Height", type: "number", default: 10 },
      ],
      compute(v, H) {
        const radius = H.num(v.radius);
        const height = H.num(v.height);
        if (radius === null || height === null || radius <= 0 || height <= 0) throw new Error("Enter a radius and height greater than zero.");
        const volume = Math.PI * radius * radius * height;
        const lateral = 2 * Math.PI * radius * height;
        const total = 2 * Math.PI * radius * (radius + height);
        return {
          primary: { label: "Volume", value: H.fmt(volume, 6), sub: `Total surface area ${H.fmt(total, 6)}` },
          details: [["Radius", H.fmt(radius, 6)], ["Height", H.fmt(height, 6)], ["Volume", H.fmt(volume, 6)], ["Curved surface", H.fmt(lateral, 6)], ["Total surface", H.fmt(total, 6)]],
          steps: [`Volume = πr²h = π × ${H.fmt(radius, 6)}² × ${H.fmt(height, 6)} = ${H.fmt(volume, 6)}`, `Curved surface = 2πrh = ${H.fmt(lateral, 6)}`, `Total surface = 2πr(r + h) = ${H.fmt(total, 6)}`],
        };
      },
    },
    {
      slug: "sphere-calculator",
      title: "Sphere Calculator",
      intro: "Find the volume and surface area of a sphere from its radius.",
      stepTitle: "Enter the radius",
      fields: [{ id: "radius", label: "Radius", type: "number", default: 4 }],
      compute(v, H) {
        const radius = H.num(v.radius);
        if (radius === null || radius <= 0) throw new Error("Enter a radius greater than zero.");
        const volume = (4 / 3) * Math.PI * radius ** 3;
        const surface = 4 * Math.PI * radius * radius;
        return {
          primary: { label: "Volume", value: H.fmt(volume, 6), sub: `Surface area ${H.fmt(surface, 6)}` },
          details: [["Radius", H.fmt(radius, 6)], ["Diameter", H.fmt(2 * radius, 6)], ["Volume", H.fmt(volume, 6)], ["Surface area", H.fmt(surface, 6)]],
          steps: [`Volume = (4/3)πr³ = (4/3) × π × ${H.fmt(radius, 6)}³ = ${H.fmt(volume, 6)}`, `Surface area = 4πr² = ${H.fmt(surface, 6)}`],
        };
      },
    },
    {
      slug: "cone-calculator",
      title: "Cone Calculator",
      intro: "Calculate slant height, volume and surface area for a right circular cone.",
      stepTitle: "Enter radius and height",
      fields: [
        { id: "radius", label: "Radius", type: "number", default: 3 },
        { id: "height", label: "Height", type: "number", default: 4 },
      ],
      compute(v, H) {
        const radius = H.num(v.radius);
        const height = H.num(v.height);
        if (radius === null || height === null || radius <= 0 || height <= 0) throw new Error("Enter a radius and height greater than zero.");
        const slant = Math.sqrt(radius * radius + height * height);
        const volume = (Math.PI * radius * radius * height) / 3;
        const lateral = Math.PI * radius * slant;
        const total = Math.PI * radius * (radius + slant);
        return {
          primary: { label: "Volume", value: H.fmt(volume, 6), sub: `Slant height ${H.fmt(slant, 6)}` },
          details: [["Radius", H.fmt(radius, 6)], ["Height", H.fmt(height, 6)], ["Slant height", H.fmt(slant, 6)], ["Volume", H.fmt(volume, 6)], ["Curved surface", H.fmt(lateral, 6)], ["Total surface", H.fmt(total, 6)]],
          steps: [`Slant height l = √(r² + h²) = ${H.fmt(slant, 6)}`, `Volume = πr²h ÷ 3 = ${H.fmt(volume, 6)}`, `Total surface = πr(r + l) = ${H.fmt(total, 6)}`],
        };
      },
    },
    {
      slug: "slope-calculator",
      title: "Slope Calculator",
      intro: "Find slope, distance, midpoint and the line equation from two points.",
      stepTitle: "Enter two points",
      fields: [
        { id: "x1", label: "x₁", type: "number", default: 1 },
        { id: "y1", label: "y₁", type: "number", default: 2 },
        { id: "x2", label: "x₂", type: "number", default: 4 },
        { id: "y2", label: "y₂", type: "number", default: 6 },
      ],
      compute(v, H) {
        const x1 = H.num(v.x1);
        const y1 = H.num(v.y1);
        const x2 = H.num(v.x2);
        const y2 = H.num(v.y2);
        if ([x1, y1, x2, y2].some((value) => value === null)) throw new Error("Enter all four coordinates.");
        const midpoint = `(${H.fmt((x1 + x2) / 2, 6)}, ${H.fmt((y1 + y2) / 2, 6)})`;
        const distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        if (x1 === x2) {
          return {
            primary: { label: "Slope", value: "Undefined (vertical line)", sub: `x = ${H.fmt(x1, 6)}` },
            details: [["Distance", H.fmt(distance, 6)], ["Midpoint", midpoint], ["Angle", "90°"], ["Equation", `x = ${H.fmt(x1, 6)}`]],
            steps: ["x₁ equals x₂, so the run is 0.", "Slope = rise ÷ run = undefined.", `The line is vertical: x = ${H.fmt(x1, 6)}.`],
          };
        }
        const slope = (y2 - y1) / (x2 - x1);
        const intercept = y1 - slope * x1;
        const angle = Math.atan(slope) * (180 / Math.PI);
        const equation = `y = ${H.fmt(slope, 4)}x ${intercept >= 0 ? "+" : "−"} ${H.fmt(Math.abs(intercept), 4)}`;
        return {
          primary: { label: "Slope (m)", value: H.fmt(slope, 6), sub: equation },
          details: [["Slope", H.fmt(slope, 6)], ["Angle", `${H.fmt(angle, 4)}°`], ["Distance", H.fmt(distance, 6)], ["Midpoint", midpoint], ["y-intercept", H.fmt(intercept, 6)], ["Equation", equation]],
          steps: [`Slope = (y₂ − y₁) ÷ (x₂ − x₁) = (${H.fmt(y2)} − ${H.fmt(y1)}) ÷ (${H.fmt(x2)} − ${H.fmt(x1)}) = ${H.fmt(slope, 6)}`, `Angle = arctan(${H.fmt(slope, 6)}) = ${H.fmt(angle, 4)}°`, `Distance = √[(x₂−x₁)² + (y₂−y₁)²] = ${H.fmt(distance, 6)}`, `y-intercept = y₁ − m × x₁ = ${H.fmt(intercept, 6)}`],
        };
      },
    },
    {
      slug: "permutation-combination-calculator",
      title: "Permutation and Combination Calculator",
      intro: "Calculate nPr and nCr for choosing r items from n items, with or without order.",
      stepTitle: "Enter n and r",
      fields: [
        { id: "n", label: "Total items (n)", type: "number", step: 1, min: 0, max: 170, default: 5 },
        { id: "r", label: "Items chosen (r)", type: "number", step: 1, min: 0, max: 170, default: 2 },
        { id: "mode", label: "Does order matter?", type: "select", default: "combination", options: [["No order — combination (nCr)", "combination"], ["Order matters — permutation (nPr)", "permutation"]] },
      ],
      compute(v, H) {
        const n = H.num(v.n);
        const r = H.num(v.r);
        if (n === null || r === null) throw new Error("Enter n and r.");
        if (!Number.isInteger(n) || !Number.isInteger(r) || n < 0 || r < 0) throw new Error("n and r must be whole numbers of 0 or more.");
        if (r > n) throw new Error("r cannot be greater than n.");
        const factorial = (value) => {
          let total = 1;
          for (let index = 2; index <= value; index += 1) total *= index;
          return total;
        };
        const combination = Math.round(factorial(n) / (factorial(r) * factorial(n - r)));
        const permutation = Math.round(factorial(n) / factorial(n - r));
        const value = v.mode === "permutation" ? permutation : combination;
        const label = v.mode === "permutation" ? `P(${n}, ${r})` : `C(${n}, ${r})`;
        return {
          primary: { label, value: H.fmt(value) },
          details: [["nCr", H.fmt(combination)], ["nPr", H.fmt(permutation)], ["Formula", v.mode === "permutation" ? "n! ÷ (n − r)!" : "n! ÷ [r! × (n − r)!]"]],
          steps: v.mode === "permutation"
            ? [`nPr = ${n}! ÷ (${n} − ${r})!`, `= ${H.fmt(factorial(n))} ÷ ${H.fmt(factorial(n - r))}`, `= ${H.fmt(permutation)}`]
            : [`nCr = ${n}! ÷ (${r}! × ${n - r}!)`, `= ${H.fmt(factorial(n))} ÷ (${H.fmt(factorial(r))} × ${H.fmt(factorial(n - r))})`, `= ${H.fmt(combination)}`],
          notes: ["Use permutations when order matters and combinations when it does not."],
        };
      },
    },
    {
      slug: "probability-calculator",
      title: "Probability Calculator",
      intro: "Turn favourable and total outcomes into probability, percentage and odds.",
      stepTitle: "Enter the outcomes",
      fields: [
        { id: "favorable", label: "Favourable outcomes", type: "number", min: 0, default: 1 },
        { id: "total", label: "Total possible outcomes", type: "number", min: 1, default: 6 },
      ],
      compute(v, H) {
        const favorable = H.num(v.favorable);
        const total = H.num(v.total);
        if (favorable === null || total === null) throw new Error("Enter both outcome counts.");
        if (total <= 0) throw new Error("Total outcomes must be greater than zero.");
        if (favorable < 0 || favorable > total) throw new Error("Favourable outcomes must be between 0 and the total.");
        const probability = favorable / total;
        const against = total - favorable;
        const oddsFor = against === 0 ? "Certain" : `${H.fmt(favorable)} : ${H.fmt(against)}`;
        const oddsAgainst = favorable === 0 ? "Impossible" : `${H.fmt(against)} : ${H.fmt(favorable)}`;
        return {
          primary: { label: "Probability", value: H.fmt(probability, 6), sub: `${H.fmt(probability * 100, 4)}% chance` },
          details: [["Fraction", `${favorable}/${total}`], ["Decimal", H.fmt(probability, 8)], ["Percentage", `${H.fmt(probability * 100, 4)}%`], ["Odds in favour", oddsFor], ["Odds against", oddsAgainst], ["Complement", `${H.fmt((against / total) * 100, 4)}%`]],
          steps: ["Probability = favourable ÷ total", `P = ${H.fmt(favorable)} ÷ ${H.fmt(total)} = ${H.fmt(probability, 8)}`, `Percentage = ${H.fmt(probability, 8)} × 100 = ${H.fmt(probability * 100, 4)}%`],
        };
      },
    },
    {
      slug: "loan-emi-calculator",
      title: "Loan EMI Calculator",
      intro: "Calculate the monthly EMI, total interest and total repayment for a loan.",
      stepTitle: "Enter the loan details",
      fields: [
        { id: "principal", label: "Loan amount", type: "number", min: 1, default: 500000 },
        { id: "rate", label: "Annual interest rate (%)", type: "number", min: 0, default: 9.5 },
        { id: "years", label: "Loan term (years)", type: "number", min: 0.1, default: 5 },
      ],
      compute(v, H) {
        const principal = H.num(v.principal);
        const annualRate = H.num(v.rate);
        const years = H.num(v.years);
        if (principal === null || annualRate === null || years === null) throw new Error("Enter the loan amount, rate and term.");
        if (principal <= 0) throw new Error("The loan amount must be greater than zero.");
        if (annualRate < 0) throw new Error("The interest rate cannot be negative.");
        if (years <= 0) throw new Error("The loan term must be greater than zero.");
        const months = Math.round(years * 12);
        const monthlyRate = annualRate / 12 / 100;
        const emi = monthlyRate === 0 ? principal / months : (principal * monthlyRate * (1 + monthlyRate) ** months) / ((1 + monthlyRate) ** months - 1);
        const total = emi * months;
        const interest = total - principal;
        const firstInterest = principal * monthlyRate;
        return {
          primary: { label: "Monthly EMI", value: H.money(emi), sub: `${months} monthly payments` },
          details: [["Loan amount", H.money(principal)], ["Monthly interest rate", `${H.fmt(monthlyRate * 100, 4)}%`], ["Total repayment", H.money(total)], ["Total interest", H.money(interest)], ["First month interest", H.money(firstInterest)], ["First month principal", H.money(Math.max(0, emi - firstInterest))]],
          steps: [`Monthly rate r = ${H.fmt(annualRate, 4)} ÷ 12 ÷ 100 = ${H.fmt(monthlyRate, 8)}`, `Number of payments n = ${H.fmt(years, 4)} × 12 = ${months}`, monthlyRate === 0 ? `EMI = P ÷ n = ${H.money(principal)} ÷ ${months} = ${H.money(emi)}` : "EMI = P × r × (1+r)^n ÷ [(1+r)^n − 1]", `EMI = ${H.money(emi)}`, `Total interest = (EMI × n) − P = ${H.money(interest)}`],
          notes: ["EMI is rounded to two decimal places for display. Exact lender calculations may differ slightly."],
        };
      },
    },
    {
      slug: "compound-interest-calculator",
      title: "Compound Interest Calculator",
      intro: "See the final balance, total interest and effective annual rate for compounding investments.",
      stepTitle: "Enter the investment details",
      fields: [
        { id: "principal", label: "Principal amount", type: "number", min: 1, default: 100000 },
        { id: "rate", label: "Annual interest rate (%)", type: "number", min: 0, default: 8 },
        { id: "years", label: "Time (years)", type: "number", min: 0.1, default: 10 },
        { id: "frequency", label: "Compounding", type: "select", default: "12", options: [["Annually", "1"], ["Semi-annually", "2"], ["Quarterly", "4"], ["Monthly", "12"], ["Daily", "365"]] },
      ],
      compute(v, H) {
        const principal = H.num(v.principal);
        const annualRate = H.num(v.rate);
        const years = H.num(v.years);
        const frequency = H.num(v.frequency);
        if (principal === null || annualRate === null || years === null) throw new Error("Enter the principal, rate and time.");
        if (principal <= 0) throw new Error("The principal must be greater than zero.");
        if (annualRate < 0) throw new Error("The interest rate cannot be negative.");
        if (years <= 0) throw new Error("The time must be greater than zero.");
        const rate = annualRate / 100;
        const amount = principal * (1 + rate / frequency) ** (frequency * years);
        const interest = amount - principal;
        const effective = ((1 + rate / frequency) ** frequency - 1) * 100;
        return {
          primary: { label: "Final balance", value: H.money(amount), sub: `Interest earned ${H.money(interest)}` },
          details: [["Principal", H.money(principal)], ["Total interest", H.money(interest)], ["Compounding periods", H.fmt(frequency * years)], ["Rate per period", `${H.fmt(annualRate / frequency, 6)}%`], ["Effective annual rate", `${H.fmt(effective, 6)}%`]],
          steps: ["Formula: A = P(1 + r/n)^(nt)", `A = ${H.money(principal)} × (1 + ${H.fmt(rate, 6)} ÷ ${frequency})^(${frequency} × ${H.fmt(years, 4)})`, `A = ${H.money(amount)}`, `Interest = A − P = ${H.money(interest)}`],
        };
      },
    },
    {
      slug: "simple-interest-calculator",
      title: "Simple Interest Calculator",
      intro: "Calculate simple interest, total amount and monthly interest for any principal, rate and time.",
      stepTitle: "Enter the details",
      fields: [
        { id: "principal", label: "Principal amount", type: "number", min: 1, default: 100000 },
        { id: "rate", label: "Annual interest rate (%)", type: "number", min: 0, default: 8 },
        { id: "years", label: "Time (years)", type: "number", min: 0.01, default: 3 },
      ],
      compute(v, H) {
        const principal = H.num(v.principal);
        const rate = H.num(v.rate);
        const years = H.num(v.years);
        if (principal === null || rate === null || years === null) throw new Error("Enter the principal, rate and time.");
        if (principal <= 0) throw new Error("The principal must be greater than zero.");
        if (rate < 0) throw new Error("The interest rate cannot be negative.");
        if (years <= 0) throw new Error("The time must be greater than zero.");
        const interest = (principal * rate * years) / 100;
        const total = principal + interest;
        return {
          primary: { label: "Simple interest", value: H.money(interest), sub: `Total amount ${H.money(total)}` },
          details: [["Principal", H.money(principal)], ["Interest", H.money(interest)], ["Total amount", H.money(total)], ["Interest per year", H.money((principal * rate) / 100)], ["Interest per month", H.money((principal * rate) / 1200)]],
          steps: ["Simple interest = P × R × T ÷ 100", `I = ${H.money(principal)} × ${H.fmt(rate, 4)} × ${H.fmt(years, 4)} ÷ 100`, `I = ${H.money(interest)}`, `Total = P + I = ${H.money(total)}`],
        };
      },
    },
    {
      slug: "discount-calculator",
      title: "Discount Calculator",
      intro: "Find the sale price and money saved from a percentage discount.",
      stepTitle: "Enter the price and discount",
      fields: [
        { id: "price", label: "Original price", type: "number", min: 0, default: 1999 },
        { id: "discount", label: "Discount (%)", type: "number", min: 0, max: 100, default: 25 },
      ],
      compute(v, H) {
        const price = H.num(v.price);
        const discount = H.num(v.discount);
        if (price === null || discount === null) throw new Error("Enter the price and discount.");
        if (price < 0) throw new Error("The price cannot be negative.");
        if (discount < 0 || discount > 100) throw new Error("The discount must be between 0% and 100%.");
        const saved = (price * discount) / 100;
        const final = price - saved;
        return {
          primary: { label: "Sale price", value: H.money(final), sub: `You save ${H.money(saved)}` },
          details: [["Original price", H.money(price)], ["Discount", `${H.fmt(discount, 4)}%`], ["Amount saved", H.money(saved)], ["Sale price", H.money(final)]],
          steps: [`Discount amount = price × discount ÷ 100 = ${H.money(saved)}`, `Sale price = ${H.money(price)} − ${H.money(saved)} = ${H.money(final)}`, `Effective price = ${H.fmt(100 - discount, 4)}% of the original.`],
        };
      },
    },
    {
      slug: "tip-calculator",
      title: "Tip Calculator",
      intro: "Calculate the tip, total bill and amount per person for any bill and tip percentage.",
      stepTitle: "Enter the bill details",
      fields: [
        { id: "bill", label: "Bill amount", type: "number", min: 0, default: 1500 },
        { id: "tip", label: "Tip (%)", type: "number", min: 0, default: 10 },
        { id: "people", label: "Split between (people)", type: "number", min: 1, step: 1, default: 1 },
      ],
      compute(v, H) {
        const bill = H.num(v.bill);
        const percent = H.num(v.tip);
        const people = H.num(v.people);
        if (bill === null || percent === null || people === null) throw new Error("Enter the bill, tip and number of people.");
        if (bill < 0) throw new Error("The bill cannot be negative.");
        if (percent < 0) throw new Error("The tip cannot be negative.");
        if (!Number.isInteger(people) || people < 1) throw new Error("The number of people must be a whole number of at least 1.");
        const tip = (bill * percent) / 100;
        const total = bill + tip;
        return {
          primary: { label: "Tip amount", value: H.money(tip), sub: `Total ${H.money(total)}` },
          details: [["Bill", H.money(bill)], ["Tip", H.money(tip)], ["Total", H.money(total)], ["Per person", H.money(total / people)], ["Tip per person", H.money(tip / people)]],
          steps: [`Tip = bill × tip% = ${H.money(bill)} × ${H.fmt(percent, 4)}% = ${H.money(tip)}`, `Total = bill + tip = ${H.money(total)}`, `Each person pays ${H.money(total / people)}.`],
        };
      },
    },
    {
      slug: "sales-tax-calculator",
      title: "Sales Tax and VAT Calculator",
      intro: "Add tax to a price or remove tax from a tax-inclusive amount, with the tax amount shown separately.",
      stepTitle: "Enter the amount and tax rate",
      fields: [
        { id: "amount", label: "Amount", type: "number", min: 0, default: 1000 },
        { id: "rate", label: "Tax rate (%)", type: "number", min: 0, default: 18 },
        { id: "mode", label: "Is the amount before or after tax?", type: "select", default: "add", options: [["Before tax — add tax", "add"], ["After tax — remove tax", "remove"]] },
      ],
      compute(v, H) {
        const amount = H.num(v.amount);
        const rate = H.num(v.rate);
        if (amount === null || rate === null) throw new Error("Enter the amount and tax rate.");
        if (amount < 0) throw new Error("The amount cannot be negative.");
        if (rate < 0) throw new Error("The tax rate cannot be negative.");
        let net;
        let tax;
        let total;
        if (v.mode === "add") {
          tax = (amount * rate) / 100;
          net = amount;
          total = amount + tax;
        } else {
          net = amount / (1 + rate / 100);
          tax = amount - net;
          total = amount;
        }
        return {
          primary: { label: v.mode === "add" ? "Total with tax" : "Amount before tax", value: H.money(v.mode === "add" ? total : net), sub: `Tax ${H.money(tax)}` },
          details: [["Net amount", H.money(net)], ["Tax rate", `${H.fmt(rate, 4)}%`], ["Tax amount", H.money(tax)], ["Gross total", H.money(total)], ["Mode", v.mode === "add" ? "Tax added to net" : "Tax removed from gross"]],
          steps: v.mode === "add"
            ? [`Tax = ${H.money(amount)} × ${H.fmt(rate, 4)}% = ${H.money(tax)}`, `Total = ${H.money(amount)} + ${H.money(tax)} = ${H.money(total)}`]
            : [`Net = gross ÷ (1 + rate) = ${H.money(amount)} ÷ ${H.fmt(1 + rate / 100, 6)} = ${H.money(net)}`, `Tax = gross − net = ${H.money(tax)}`],
        };
      },
    },
    {
      slug: "salary-calculator",
      title: "Salary Calculator",
      intro: "Convert an hourly rate into weekly, monthly and yearly pay, or turn a yearly salary back into an hourly rate.",
      stepTitle: "Enter the pay details",
      fields: [
        { id: "mode", label: "What do you know?", type: "select", default: "hourly", options: [["Hourly rate", "hourly"], ["Yearly salary", "annual"]] },
        { id: "amount", label: "Amount", type: "number", min: 0, default: 500 },
        { id: "hours", label: "Hours per week", type: "number", min: 0.1, max: 168, default: 40 },
        { id: "weeks", label: "Paid weeks per year", type: "number", min: 1, max: 52, default: 52 },
      ],
      compute(v, H) {
        const amount = H.num(v.amount);
        const hours = H.num(v.hours);
        const weeks = H.num(v.weeks);
        if (amount === null || hours === null || weeks === null) throw new Error("Enter the amount, weekly hours and paid weeks.");
        if (amount < 0) throw new Error("The amount cannot be negative.");
        if (hours <= 0 || hours > 168) throw new Error("Weekly hours must be between 0 and 168.");
        if (weeks <= 0 || weeks > 52) throw new Error("Paid weeks must be between 1 and 52.");
        const weekly = v.mode === "hourly" ? amount * hours : amount / weeks;
        const annual = v.mode === "hourly" ? weekly * weeks : amount;
        const monthly = annual / 12;
        const hourly = v.mode === "hourly" ? amount : annual / (hours * weeks);
        const daily = annual / (weeks * 5);
        return {
          primary: { label: v.mode === "hourly" ? "Yearly salary" : "Hourly rate", value: H.money(v.mode === "hourly" ? annual : hourly), sub: `Monthly ${H.money(monthly)}` },
          details: [["Hourly", H.money(hourly)], ["Daily (5-day week)", H.money(daily)], ["Weekly", H.money(weekly)], ["Monthly", H.money(monthly)], ["Yearly", H.money(annual)]],
          steps: [`Weekly pay = ${v.mode === "hourly" ? `${H.money(amount)} × ${H.fmt(hours, 4)} hours` : `${H.money(amount)} ÷ ${H.fmt(weeks, 4)} weeks`} = ${H.money(weekly)}`, `Yearly = ${H.money(weekly)} × ${H.fmt(weeks, 4)} = ${H.money(annual)}`, `Monthly = ${H.money(annual)} ÷ 12 = ${H.money(monthly)}`, `Hourly = ${H.money(annual)} ÷ (${H.fmt(hours, 4)} × ${H.fmt(weeks, 4)}) = ${H.money(hourly)}`],
          notes: ["Figures are pre-tax and do not include bonuses, overtime or deductions."],
        };
      },
    },
    {
      slug: "savings-goal-calculator",
      title: "Savings Goal Calculator",
      intro: "Find out how long it takes to reach a savings goal with monthly contributions and compound interest.",
      stepTitle: "Enter your goal",
      fields: [
        { id: "goal", label: "Savings goal", type: "number", min: 1, default: 1000000 },
        { id: "current", label: "Amount already saved", type: "number", min: 0, default: 100000 },
        { id: "monthly", label: "Monthly contribution", type: "number", min: 0, default: 20000 },
        { id: "rate", label: "Annual return (%)", type: "number", min: 0, default: 8 },
      ],
      compute(v, H) {
        const goal = H.num(v.goal);
        const current = H.num(v.current);
        const monthly = H.num(v.monthly);
        const annualRate = H.num(v.rate);
        if (goal === null || current === null || monthly === null || annualRate === null) throw new Error("Enter the goal, savings, contribution and return rate.");
        if (goal <= 0) throw new Error("The savings goal must be greater than zero.");
        if (current < 0 || monthly < 0) throw new Error("Savings and contributions cannot be negative.");
        if (annualRate < 0) throw new Error("The annual return cannot be negative.");
        if (current >= goal) {
          return {
            primary: { label: "Time to goal", value: "Already reached", sub: `${H.money(current)} saved` },
            details: [["Goal", H.money(goal)], ["Saved", H.money(current)], ["Surplus", H.money(current - goal)]],
            steps: ["Your current savings already meet the goal."],
          };
        }
        const rate = annualRate / 12 / 100;
        let months;
        if (rate === 0) {
          if (monthly <= 0) throw new Error("Add a monthly contribution or a return rate to reach the goal.");
          months = Math.ceil((goal - current) / monthly);
        } else if (monthly === 0) {
          if (current <= 0) throw new Error("Add a starting amount or a monthly contribution to reach the goal.");
          months = Math.ceil(Math.log(goal / current) / Math.log(1 + rate));
        } else {
          months = Math.ceil(Math.log((goal + monthly / rate) / (current + monthly / rate)) / Math.log(1 + rate));
        }
        const years = Math.floor(months / 12);
        const remainingMonths = months % 12;
        const finalBalance = rate === 0
          ? current + monthly * months
          : current * (1 + rate) ** months + monthly * (((1 + rate) ** months - 1) / rate);
        const contributed = current + monthly * months;
        return {
          primary: { label: "Time to goal", value: years > 0 ? `${years} year${years === 1 ? "" : "s"} ${remainingMonths} month${remainingMonths === 1 ? "" : "s"}` : `${months} month${months === 1 ? "" : "s"}`, sub: `About ${months} monthly deposit${months === 1 ? "" : "s"}` },
          details: [["Months", H.fmt(months)], ["Total contributed", H.money(contributed)], ["Interest earned", H.money(Math.max(0, finalBalance - contributed))], ["Projected balance", H.money(finalBalance)]],
          steps: [rate === 0 ? `Months = (goal − saved) ÷ monthly = ${months}` : "Formula: n = ln[(goal + monthly ÷ r) ÷ (saved + monthly ÷ r)] ÷ ln(1 + r)", `Monthly rate r = ${H.fmt(annualRate, 4)}% ÷ 12 = ${H.fmt(rate, 8)}`, `Months = ${months}`, `Total contributed = ${H.money(contributed)}`, `Interest earned ≈ ${H.money(Math.max(0, finalBalance - contributed))}`],
          notes: ["Returns are compounded monthly. Actual investment returns vary and are not guaranteed."],
        };
      },
    },
    {
      slug: "gst-calculator",
      title: "GST Calculator",
      intro: "Add or remove GST at current Indian rates, with CGST and SGST split for intra-state supplies and IGST for inter-state supplies.",
      reviewed: "12 November 2026",
      sources: [{ label: "CBIC Notification No. 9/2025-Integrated Tax (Rate), effective 22 September 2025", url: "https://courier.cbic.gov.in/ECCS/advisory/2025/NOTIFICATION%20NO.%209_2025-INTEGRATED%20TAX%20(RATE)%20-1759486719.pdf" }],
      stepTitle: "Enter the amount and GST details",
      fields: [
        { id: "amount", label: "Amount", type: "number", min: 0, default: 1000 },
        { id: "rate", label: "GST rate", type: "select", default: "18", options: [
          ["0%", "0"], ["5%", "5"], ["18%", "18"], ["40%", "40"],
          ["3% — specified goods", "3"], ["1.5% — specified goods", "1.5"],
          ["0.25% — specified goods", "0.25"], ["28% — specified goods", "28"], ["Custom rate", "custom"],
        ] },
        { id: "customRate", label: "Custom GST rate (%)", type: "number", min: 0, max: 100, default: 18, showIf: (v) => v.rate === "custom" },
        { id: "mode", label: "The amount is", type: "select", default: "exclusive", options: [["Before GST — add GST", "exclusive"], ["Including GST — remove GST", "inclusive"]] },
        { id: "supply", label: "Supply type", type: "select", default: "intra", options: [["Intra-state — CGST + SGST", "intra"], ["Inter-state — IGST", "inter"]] },
      ],
      compute(v, H) {
        const amount = H.num(v.amount);
        const rate = v.rate === "custom" ? H.num(v.customRate) : H.num(v.rate);
        if (amount === null || rate === null) throw new Error("Enter the amount and GST rate.");
        const result = M.gst({ amount, rate, inclusive: v.mode === "inclusive", interstate: v.supply === "inter" });
        const split = result.interstate
          ? ["IGST", H.money(result.igst)]
          : ["CGST", H.money(result.cgst)];
        const splitTwo = result.interstate ? null : ["SGST", H.money(result.sgst)];
        return {
          primary: {
            label: v.mode === "inclusive" ? "Amount before GST" : "Total including GST",
            value: H.money(v.mode === "inclusive" ? result.base : result.total),
            sub: `GST ${H.money(result.tax)} at ${H.fmt(result.rate, 2)}%`,
          },
          details: [
            ["Taxable value", H.money(result.base)],
            ["GST rate", `${H.fmt(result.rate, 2)}%`],
            ["GST amount", H.money(result.tax)],
            split,
            ...(splitTwo ? [splitTwo] : []),
            ["Total", H.money(result.total)],
            ["Supply type", result.interstate ? "Inter-state" : "Intra-state"],
          ],
          steps: v.mode === "inclusive"
            ? [`Taxable value = ${H.money(amount)} ÷ (1 + ${H.fmt(result.rate, 2)} ÷ 100)`, `= ${H.money(result.base)}`, `GST = ${H.money(amount)} − ${H.money(result.base)} = ${H.money(result.tax)}`]
            : [`GST = ${H.money(amount)} × ${H.fmt(result.rate, 2)} ÷ 100 = ${H.money(result.tax)}`, `Total = ${H.money(amount)} + ${H.money(result.tax)} = ${H.money(result.total)}`, result.interstate ? "Inter-state supply: the full GST amount is IGST." : `Intra-state supply: CGST = ${H.money(result.cgst)} and SGST = ${H.money(result.sgst)}.`],
          notes: ["Uses the GST 2.0 rate structure announced on 22 September 2025: 5%, 18% and 40%, plus special rates for specified goods.", "GST treatment depends on the HSN/SAC classification, place of supply and exemptions. Confirm rates with the official GST portal or a tax professional."],
        };
      },
    },
    {
      slug: "income-tax-calculator",
      title: "Income Tax Calculator",
      intro: "Compare the new and old Indian income-tax regimes for FY 2026-27 using salary income, deductions and the latest slab rates.",
      reviewed: "12 November 2026",
      sources: [{ label: "Finance Bill 2026 memorandum — income-tax rates (PDF)", url: "https://www.incometaxindia.gov.in/documents/81799/11848482/memo-2026.pdf" }],
      stepTitle: "Enter your income and deductions",
      fields: [
        { id: "gross", label: "Gross annual income", type: "number", min: 0, default: 1200000, placeholder: "1200000" },
        { id: "regime", label: "Tax regime", type: "select", default: "compare", options: [["Compare both regimes", "compare"], ["New regime", "new"], ["Old regime", "old"]] },
        { id: "age", label: "Age group", type: "select", default: "below60", options: [["Below 60", "below60"], ["60 to 79", "senior"], ["80 or above", "super"]] },
        { id: "salaried", label: "Salaried or pensioner?", type: "select", default: "yes", options: [["Yes — claim standard deduction", "yes"], ["No", "no"]] },
        { id: "c80", label: "Section 80C investments", type: "number", min: 0, default: 0, hint: "PPF, ELSS, life insurance, principal repayment; capped at ₹1.5 lakh.", showIf: (v) => v.regime !== "new" },
        { id: "d80", label: "Section 80D health insurance", type: "number", min: 0, default: 0, hint: "Capped at ₹25,000 below 60, or ₹50,000 for senior citizens.", showIf: (v) => v.regime !== "new" },
        { id: "homeLoan", label: "Home loan interest", type: "number", min: 0, default: 0, hint: "Self-occupied property interest is capped at ₹2 lakh.", showIf: (v) => v.regime !== "new" },
        { id: "nps", label: "NPS — Section 80CCD(1B)", type: "number", min: 0, default: 0, hint: "Additional NPS deduction capped at ₹50,000.", showIf: (v) => v.regime !== "new" },
        { id: "other", label: "Other old-regime deductions", type: "number", min: 0, default: 0, hint: "Enter the eligible amount, for example 80G or 80TTA.", showIf: (v) => v.regime !== "new" },
      ],
      compute(v, H) {
        const gross = H.num(v.gross);
        if (gross === null) throw new Error("Enter your gross annual income.");
        const result = M.incomeTax({
          gross,
          regime: v.regime,
          age: v.age,
          salaried: v.salaried === "yes",
          deductions: {
            c80: H.num(v.c80) || 0,
            d80: H.num(v.d80) || 0,
            homeLoan: H.num(v.homeLoan) || 0,
            nps: H.num(v.nps) || 0,
            other: H.num(v.other) || 0,
          },
        });
        const plan = result.selected;
        const regimeLabel = result.recommendation === "new" ? "New regime" : "Old regime";
        const compare = v.regime === "compare";
        const details = [
          ["Gross annual income", H.money(plan.gross)],
          ["Standard deduction", H.money(plan.standardDeduction)],
          ["Deductions allowed", H.money(plan.deductions.total)],
          ["Taxable income", H.money(plan.taxable)],
          ["Tax before rebate / relief", H.money(plan.slabTax)],
          ["87A rebate / marginal relief", H.money(plan.rebate)],
          ["Surcharge", plan.surcharge > 0 ? `${H.money(plan.surcharge)} (${H.fmt(plan.surchargeRate * 100, 0)}%)` : "Nil"],
          ["Health and education cess (4%)", H.money(plan.cess)],
          ["Total tax", H.money(plan.total)],
          ["Effective tax rate", `${H.fmt(plan.effectiveRate, 2)}%`],
          ["Monthly tax (approx.)", H.money(plan.monthly)],
          ["New regime total", H.money(result.new.total)],
          ["Old regime total", H.money(result.old.total)],
        ];
        if (compare) details.unshift(["Recommended regime", plan.total === 0 ? `${regimeLabel} — no tax` : `${regimeLabel} — saves ${H.money(result.savings)}`]);
        const steps = [
          `Taxable income = gross income − standard deduction − eligible deductions`,
          `= ${H.money(plan.gross)} − ${H.money(plan.standardDeduction)} − ${H.money(plan.deductions.total)} = ${H.money(plan.taxable)}`,
          ...plan.breakdown.filter((band) => band.amount > 0).map((band) => `${H.money(band.from)} to ${band.to === Infinity ? "above" : H.money(band.to)} at ${H.fmt(band.rate * 100, 0)}% = ${H.money(band.amount)}`),
          `Tax before rebate = ${H.money(plan.slabTax)}`,
          plan.rebate > 0 ? `87A rebate / marginal relief = ${H.money(plan.rebate)}` : "No Section 87A rebate applies.",
          plan.surcharge > 0 ? `Surcharge = ${H.money(plan.surcharge)}` : "No surcharge applies.",
          `Cess = 4% × (tax after rebate + surcharge) = ${H.money(plan.cess)}`,
          `Total tax = ${H.money(plan.total)}`,
        ];
        return {
          primary: {
            label: compare ? `${regimeLabel} — lower tax` : `${regimeLabel} tax`,
            value: plan.total === 0 ? "Nil" : H.money(plan.total),
            sub: plan.total === 0 ? "No tax payable after rebate" : `Effective ${H.fmt(plan.effectiveRate, 2)}% · ${H.money(plan.monthly)} per month`,
          },
          variant: plan.total === 0 ? "good" : undefined,
          details,
          steps,
          notes: [
            "Built for FY 2026-27 (assessment year 2027-28) using the new-regime slabs of 0–4 lakh: nil, 4–8 lakh: 5%, 8–12 lakh: 10%, 12–16 lakh: 15%, 16–20 lakh: 20%, 20–24 lakh: 25% and above 24 lakh: 30%.",
            "The old regime uses the 2.5 / 5 / 10 lakh slabs, with higher exemption limits for senior citizens. HRA, LTA, employer NPS contributions and other special deductions are not modelled here.",
            "Surcharge marginal relief is estimated. This is a planning estimate, not a filing or legal opinion; confirm with the official income-tax calculator or a chartered accountant.",
          ],
        };
      },
    },
    {
      slug: "plot-area-calculator",
      title: "Plot Area and Land Rate Calculator",
      intro: "Measure a rectangular, triangular or four-sided plot and estimate its land value from a rate per square foot, square metre, acre or hectare.",
      stepTitle: "Choose the plot shape and dimensions",
      fields: [
        { id: "shape", label: "Plot shape", type: "select", default: "rectangle", options: [["Rectangle", "rectangle"], ["Triangle — three sides", "triangle"], ["Four-sided plot — four sides and one diagonal", "quadrilateral"]] },
        { id: "unit", label: "Measurement unit", type: "select", default: "ft", options: [["Feet", "ft"], ["Metres", "m"]] },
        { id: "length", label: (v) => `Length (${v.unit === "m" ? "m" : "ft"})`, type: "number", min: 0.01, default: 30, showIf: (v) => v.shape === "rectangle" },
        { id: "width", label: (v) => `Width (${v.unit === "m" ? "m" : "ft"})`, type: "number", min: 0.01, default: 40, showIf: (v) => v.shape === "rectangle" },
        { id: "sideA", label: (v) => `Side A (${v.unit === "m" ? "m" : "ft"})`, type: "number", min: 0.01, default: 30, showIf: (v) => v.shape !== "rectangle" },
        { id: "sideB", label: (v) => `Side B (${v.unit === "m" ? "m" : "ft"})`, type: "number", min: 0.01, default: 40, showIf: (v) => v.shape !== "rectangle" },
        { id: "sideC", label: (v) => `Side C (${v.unit === "m" ? "m" : "ft"})`, type: "number", min: 0.01, default: 50, showIf: (v) => v.shape !== "rectangle" },
        { id: "sideD", label: (v) => `Side D (${v.unit === "m" ? "m" : "ft"})`, type: "number", min: 0.01, default: 35, showIf: (v) => v.shape === "quadrilateral" },
        { id: "diagonal", label: (v) => `Diagonal from A–B corner to C–D corner (${v.unit === "m" ? "m" : "ft"})`, type: "number", min: 0.01, default: 50, showIf: (v) => v.shape === "quadrilateral" },
        { id: "rate", label: "Land rate", type: "number", min: 0, default: 1000 },
        { id: "rateBasis", label: "Rate is per", type: "select", default: "sqft", options: [["Square foot", "sqft"], ["Square metre", "sqm"], ["Acre", "acre"], ["Hectare", "hectare"]] },
      ],
      compute(v, H) {
        const rate = H.num(v.rate);
        if (rate === null) throw new Error("Enter the land rate, or zero if you only need the area.");
        const result = M.plotArea({
          shape: v.shape,
          unit: v.unit,
          length: H.num(v.length),
          width: H.num(v.width),
          sideA: H.num(v.sideA),
          sideB: H.num(v.sideB),
          sideC: H.num(v.sideC),
          sideD: H.num(v.sideD),
          diagonal: H.num(v.diagonal),
          rate,
          rateBasis: v.rateBasis,
        });
        const basisLabel = { sqft: "sq ft", sqm: "sq m", acre: "acre", hectare: "hectare" }[v.rateBasis];
        return {
          primary: {
            label: "Plot area",
            value: `${H.fmt(result.squareFeet, 2)} sq ft`,
            sub: `${H.fmt(result.squareMetres, 2)} sq m · ${H.fmt(result.acres, 4)} acre`,
          },
          details: [
            ["Square feet", H.fmt(result.squareFeet, 2)],
            ["Square metres", H.fmt(result.squareMetres, 2)],
            ["Square yards (gaj)", H.fmt(result.squareYards, 2)],
            ["Acres", H.fmt(result.acres, 4)],
            ["Hectares", H.fmt(result.hectares, 4)],
            ["Land rate", `${H.money(rate)} per ${basisLabel}`],
            ["Estimated land value", H.money(result.value)],
          ],
          steps: v.shape === "rectangle"
            ? [`Area = length × width = ${H.fmt(H.num(v.length), 4)} × ${H.fmt(H.num(v.width), 4)} = ${H.fmt(result.squareFeet, 2)} sq ft`, `Square metres = ${H.fmt(result.squareFeet, 2)} ÷ 10.7639 = ${H.fmt(result.squareMetres, 2)}`, `Value = ${H.money(rate)} per ${basisLabel} × area in that unit = ${H.money(result.value)}`]
            : v.shape === "triangle"
              ? ["Area uses Heron's formula with the three side lengths.", `Area = ${H.fmt(result.squareFeet, 2)} sq ft`, `Value = ${H.money(rate)} per ${basisLabel} × area in that unit = ${H.money(result.value)}`]
              : ["The four-sided plot is split into two triangles using the diagonal.", "Area = triangle A–B–diagonal + triangle C–D–diagonal", `Area = ${H.fmt(result.squareFeet, 2)} sq ft`, `Value = ${H.money(rate)} per ${basisLabel} × area in that unit = ${H.money(result.value)}`],
          notes: ["Enter the measurements from the plot boundary or a registered survey. A four-sided plot calculator assumes the diagonal divides the plot into two valid triangles.", "This is a geometric area estimate, not a legal survey. Verify the area, access, setbacks and title with the revenue record, registered deed or a licensed surveyor.", "Land rates vary by locality, road access and land use. The rate you enter is applied uniformly to the measured area."],
        };
      },
    },
    {
      slug: "construction-material-calculator",
      title: "Construction Material Calculator",
      intro: "Estimate concrete, bricks, tiles or paint from room dimensions, with wastage and Indian site-mix ratios built in.",
      stepTitle: "Choose the material and enter measurements",
      fields: [
        { id: "mode", label: "Material to estimate", type: "select", default: "concrete", options: [["Concrete — cement, sand and aggregate", "concrete"], ["Brickwork — bricks and mortar", "brick"], ["Tiles — tile and box count", "tile"], ["Paint — litres required", "paint"]] },
        { id: "unit", label: "Room or wall dimensions in", type: "select", default: "ft", options: [["Feet", "ft"], ["Metres", "m"]] },
        { id: "length", label: (v) => v.mode === "brick" ? "Wall length" : v.mode === "tile" ? "Room length" : v.mode === "paint" ? "Wall length" : "Length", type: "number", min: 0.01, default: 10 },
        { id: "width", label: (v) => v.mode === "tile" ? "Room width" : "Width", type: "number", min: 0.01, default: 10, showIf: (v) => v.mode !== "brick" && v.mode !== "paint" },
        { id: "height", label: (v) => v.mode === "brick" ? "Wall height" : "Wall height", type: "number", min: 0.01, default: 10, showIf: (v) => v.mode === "brick" || v.mode === "paint" },
        { id: "thickness", label: (v) => v.mode === "brick" ? "Wall thickness" : "Slab thickness", type: "number", min: 0.01, default: 0.5, showIf: (v) => v.mode === "concrete" || v.mode === "brick" },
        { id: "mix", label: "Concrete mix", type: "select", default: "m20", options: [["M5 — 1 : 5 : 10", "m5"], ["M7.5 — 1 : 4 : 8", "m75"], ["M10 — 1 : 3 : 6", "m10"], ["M15 — 1 : 2 : 4", "m15"], ["M20 — 1 : 1.5 : 3", "m20"], ["M25 — 1 : 1 : 2", "m25"]], showIf: (v) => v.mode === "concrete" },
        { id: "brickSize", label: "Brick size", type: "select", default: "standard", options: [["Standard — 190 × 90 × 90 mm", "standard"], ["Traditional — 230 × 110 × 75 mm", "traditional"]], showIf: (v) => v.mode === "brick" },
        { id: "mortar", label: "Mortar mix", type: "select", default: "1:6", options: [["1 : 4 — stronger", "1:4"], ["1 : 6 — common", "1:6"]], showIf: (v) => v.mode === "brick" },
        { id: "tileLength", label: "Tile length (mm)", type: "number", min: 1, default: 600, showIf: (v) => v.mode === "tile" },
        { id: "tileWidth", label: "Tile width (mm)", type: "number", min: 1, default: 600, showIf: (v) => v.mode === "tile" },
        { id: "perBox", label: "Tiles per box", type: "number", min: 1, default: 4, showIf: (v) => v.mode === "tile" },
        { id: "openings", label: (v) => `Doors and windows area (${v.unit === "m" ? "sq m" : "sq ft"})`, type: "number", min: 0, default: 20, showIf: (v) => v.mode === "paint" },
        { id: "coats", label: "Paint coats", type: "number", min: 1, max: 5, default: 2, showIf: (v) => v.mode === "paint" },
        { id: "coverage", label: "Coverage (sq m per litre per coat)", type: "number", min: 0.1, default: 10, showIf: (v) => v.mode === "paint" },
        { id: "waste", label: "Wastage allowance (%)", type: "number", min: 0, max: 50, default: 5 },
      ],
      compute(v, H) {
        const result = M.construction({
          mode: v.mode, unit: v.unit,
          length: H.num(v.length), width: H.num(v.width), height: H.num(v.height), thickness: H.num(v.thickness),
          mix: v.mix, brickSize: v.brickSize, mortar: v.mortar,
          tileLength: H.num(v.tileLength), tileWidth: H.num(v.tileWidth), perBox: H.num(v.perBox),
          openings: H.num(v.openings), coats: H.num(v.coats), coverage: H.num(v.coverage),
          waste: H.num(v.waste),
        });
        if (v.mode === "concrete") {
          return {
            primary: { label: "Cement required", value: `${H.fmt(result.cementBags, 2)} bags`, sub: `Sand ${H.fmt(result.sandVolume, 2)} m³ · Aggregate ${H.fmt(result.aggregateVolume, 2)} m³` },
            details: [["Concrete mix", result.mix], ["Wet volume", `${H.fmt(result.wetVolume, 3)} m³`], ["Dry volume", `${H.fmt(result.dryVolume, 3)} m³`], ["Cement volume", `${H.fmt(result.cementVolume, 3)} m³`], ["Cement", `${H.fmt(result.cementBags, 2)} bags (50 kg)`], ["Sand", `${H.fmt(result.sandVolume, 3)} m³`], ["Aggregate", `${H.fmt(result.aggregateVolume, 3)} m³`], ["Water (approx.)", `${H.fmt(result.waterLitres, 0)} litres`]],
            steps: [`Wet volume = length × width × thickness = ${H.fmt(result.wetVolume, 3)} m³`, `Dry volume = wet volume × 1.54 × wastage factor = ${H.fmt(result.dryVolume, 3)} m³`, `Split the dry volume in the selected mix ratio, then convert cement volume to 50 kg bags.`, `Cement = ${H.fmt(result.cementBags, 2)} bags; sand = ${H.fmt(result.sandVolume, 3)} m³; aggregate = ${H.fmt(result.aggregateVolume, 3)} m³.`],
            notes: ["Nominal mixes are a site estimate, not a design mix. Water is shown at a 0.50 water–cement ratio; actual water depends on workability and admixtures.", "Confirm quantities with your contractor or structural engineer before ordering."],
          };
        }
        if (v.mode === "brick") {
          return {
            primary: { label: "Bricks required", value: `${H.fmt(result.bricks, 0)} bricks`, sub: `Cement ${H.fmt(result.cementBags, 2)} bags · Sand ${H.fmt(result.sandVolume, 2)} m³` },
            details: [["Brick size", result.brickSize], ["Mortar mix", `1 : ${result.mortar.split(":")[1]}`], ["Wall volume", `${H.fmt(result.wallVolume, 3)} m³`], ["Bricks", `${H.fmt(result.bricks, 0)}`], ["Mortar dry volume", `${H.fmt(result.mortarVolume, 3)} m³`], ["Cement", `${H.fmt(result.cementBags, 2)} bags (50 kg)`], ["Sand", `${H.fmt(result.sandVolume, 3)} m³`]],
            steps: [`Wall volume = length × height × thickness = ${H.fmt(result.wallVolume, 3)} m³`, "Brick count uses the brick size plus a 10 mm mortar joint and the wastage allowance.", `Bricks = ${H.fmt(result.bricks, 0)}`, `Mortar dry volume = (wall volume − brick volume) × 1.33 = ${H.fmt(result.mortarVolume, 3)} m³`, `Cement = ${H.fmt(result.cementBags, 2)} bags; sand = ${H.fmt(result.sandVolume, 3)} m³.`],
            notes: ["Brick quantities assume a 10 mm mortar joint. Actual wastage depends on breakage, bond pattern and site handling.", "Confirm the brick size and mortar ratio with your mason or structural engineer."],
          };
        }
        if (v.mode === "tile") {
          return {
            primary: { label: "Tiles required", value: `${H.fmt(result.tiles, 0)} tiles`, sub: `${H.fmt(result.boxes, 0)} boxes · ${H.fmt(result.area, 2)} m² floor` },
            details: [["Floor area", `${H.fmt(result.area, 2)} m²`], ["Tile area", `${H.fmt(result.tileArea, 4)} m²`], ["Tiles with wastage", `${H.fmt(result.tiles, 0)}`], ["Boxes", `${H.fmt(result.boxes, 0)}`], ["Tiles per box", `${H.fmt(result.perBox, 0)}`]],
            steps: [`Floor area = length × width = ${H.fmt(result.area, 2)} m²`, `Tile area = tile length × tile width = ${H.fmt(result.tileArea, 4)} m²`, `Tiles = floor area ÷ tile area × wastage factor = ${H.fmt(result.tiles, 0)}`, `Boxes = ceil(tiles ÷ tiles per box) = ${H.fmt(result.boxes, 0)}`],
            notes: ["Tile box sizes vary by brand and tile size. Check the actual tiles per box before ordering.", "Keep extra tiles for cuts, future repairs and pattern matching."],
          };
        }
        return {
          primary: { label: "Paint required", value: `${H.fmt(result.litres, 2)} litres`, sub: `${H.fmt(result.area, 2)} m² × ${H.fmt(result.coats, 0)} coats` },
          details: [["Paintable area", `${H.fmt(result.area, 2)} m²`], ["Coats", `${H.fmt(result.coats, 0)}`], ["Coverage", `${H.fmt(result.coverage, 2)} m² per litre per coat`], ["Paint with wastage", `${H.fmt(result.litres, 2)} litres`]],
          steps: [`Paintable area = wall area − doors and windows = ${H.fmt(result.area, 2)} m²`, `Paint = area × coats ÷ coverage × wastage factor = ${H.fmt(result.litres, 2)} litres`],
          notes: ["Coverage varies by paint brand, surface porosity, colour and application method. Check the tin label for the product coverage.", "Primer, putty and undercoat are not included."],
        };
      },
    },
    {
      slug: "stamp-duty-calculator",
      title: "Stamp Duty and Registration Calculator",
      intro: "Estimate stamp duty, registration fees and other charges using the rates that apply in your state.",
      reviewed: "12 November 2026",
      sources: [{ label: "Indian Stamp Act, 1899 — India Code", url: "https://www.indiacode.nic.in/handle/123456789/15510?locale=en" }],
      stepTitle: "Enter the property value and applicable rates",
      fields: [
        { id: "value", label: "Property value", type: "number", min: 0, default: 5000000 },
        { id: "stampRate", label: "Stamp duty rate (%)", type: "number", min: 0, max: 100, default: 6, hint: "Use the rate from your state's current ready reckoner or stamp office." },
        { id: "registrationRate", label: "Registration fee rate (%)", type: "number", min: 0, max: 100, default: 1 },
        { id: "other", label: "Other charges", type: "number", min: 0, default: 1000, hint: "For example document charges, scanning or user fees." },
      ],
      compute(v, H) {
        const value = H.num(v.value);
        const stampRate = H.num(v.stampRate);
        const registrationRate = H.num(v.registrationRate);
        const other = H.num(v.other);
        if (value === null || stampRate === null || registrationRate === null || other === null) throw new Error("Enter the property value and all rate fields.");
        const result = M.stampDuty({ value, stampRate, registrationRate, other });
        return {
          primary: { label: "Total stamp duty and registration", value: H.money(result.total), sub: `${H.fmt(result.effectiveRate, 2)}% of property value` },
          details: [["Property value", H.money(result.value)], ["Stamp duty rate", `${H.fmt(stampRate, 3)}%`], ["Stamp duty", H.money(result.stamp)], ["Registration rate", `${H.fmt(registrationRate, 3)}%`], ["Registration fee", H.money(result.registration)], ["Other charges", H.money(result.other)], ["Total payable", H.money(result.total)], ["Effective rate", `${H.fmt(result.effectiveRate, 3)}%`]],
          steps: [`Stamp duty = ${H.money(result.value)} × ${H.fmt(stampRate, 3)}% = ${H.money(result.stamp)}`, `Registration fee = ${H.money(result.value)} × ${H.fmt(registrationRate, 3)}% = ${H.money(result.registration)}`, `Total = stamp duty + registration fee + other charges = ${H.money(result.total)}`],
          notes: ["Stamp duty and registration rates differ by state, property type, location, buyer category and transaction type. Use the current rate from your state's stamp and registration department.", "This estimate excludes GST, legal fees, brokerage, mutation charges and any concessions. Confirm the final amount with the registering authority.", "The default 6% and 1% are example rates, not a recommendation for any state."],
        };
      },
    },
    {
      slug: "bmi-calculator",
      title: "BMI Calculator",
      intro: "Calculate body mass index in metric or imperial units and see the WHO weight category.",
      stepTitle: "Enter your measurements",
      fields: [
        { id: "units", label: "Units", type: "select", default: "metric", options: [["Metric (kg, cm)", "metric"], ["Imperial (lb, inches)", "imperial"]] },
        { id: "weight", label: (v) => v.units === "imperial" ? "Weight (lb)" : "Weight (kg)", type: "number", min: 1, default: 70 },
        { id: "height", label: (v) => v.units === "imperial" ? "Height (inches)" : "Height (cm)", type: "number", min: 1, default: 175 },
      ],
      compute(v, H) {
        const weight = H.num(v.weight);
        const height = H.num(v.height);
        if (weight === null || height === null) throw new Error("Enter your weight and height.");
        if (weight <= 0 || height <= 0) throw new Error("Weight and height must be greater than zero.");
        const kg = v.units === "imperial" ? weight * 0.45359237 : weight;
        const metres = v.units === "imperial" ? height * 0.0254 : height / 100;
        const bmi = kg / (metres * metres);
        const category = bmi < 18.5 ? "Underweight" : bmi < 25 ? "Normal weight" : bmi < 30 ? "Overweight" : "Obese";
        const low = 18.5 * metres * metres;
        const high = 24.9 * metres * metres;
        const displayWeight = (value) => v.units === "imperial" ? `${H.fmt(value / 0.45359237, 4)} lb` : `${H.fmt(value, 4)} kg`;
        return {
          primary: { label: "Body Mass Index", value: H.fmt(bmi, 4), sub: category },
          details: [["Weight", displayWeight(kg)], ["Height", v.units === "imperial" ? `${H.fmt(height, 4)} in` : `${H.fmt(height, 4)} cm`], ["Category", category], ["Healthy BMI range", "18.5 to 24.9"], ["Healthy weight range", `${displayWeight(low)} to ${displayWeight(high)}`]],
          steps: [`Convert to metric: ${H.fmt(kg, 4)} kg, ${H.fmt(metres, 4)} m`, "BMI = weight ÷ height²", `BMI = ${H.fmt(kg, 4)} ÷ ${H.fmt(metres, 4)}² = ${H.fmt(bmi, 4)}`, `Category: ${category}`],
          notes: ["BMI is a screening measure and does not directly measure body fat or health."],
        };
      },
    },
    {
      slug: "calorie-calculator",
      title: "Calorie and BMR Calculator",
      intro: "Estimate basal metabolic rate and daily calorie needs with the Mifflin-St Jeor equation and activity levels.",
      stepTitle: "Enter your details",
      fields: [
        { id: "gender", label: "Gender", type: "select", default: "male", options: [["Male", "male"], ["Female", "female"]] },
        { id: "age", label: "Age (years)", type: "number", min: 1, max: 120, default: 30 },
        { id: "weight", label: "Weight (kg)", type: "number", min: 1, default: 70 },
        { id: "height", label: "Height (cm)", type: "number", min: 1, default: 175 },
        { id: "activity", label: "Activity level", type: "select", default: "1.375", options: [["Sedentary — little exercise", "1.2"], ["Light — 1-3 days/week", "1.375"], ["Moderate — 3-5 days/week", "1.55"], ["Active — 6-7 days/week", "1.725"], ["Very active — hard training", "1.9"]] },
      ],
      compute(v, H) {
        const age = H.num(v.age);
        const weight = H.num(v.weight);
        const height = H.num(v.height);
        const activity = H.num(v.activity);
        if (age === null || weight === null || height === null) throw new Error("Enter age, weight and height.");
        if (age <= 0 || weight <= 0 || height <= 0) throw new Error("Age, weight and height must be greater than zero.");
        const base = 10 * weight + 6.25 * height - 5 * age;
        const bmr = v.gender === "male" ? base + 5 : base - 161;
        const tdee = bmr * activity;
        return {
          primary: { label: "Daily calories to maintain weight", value: `${H.fmt(tdee, 0)} kcal`, sub: `BMR ${H.fmt(bmr, 0)} kcal · activity factor ${H.fmt(activity, 3)}` },
          details: [["BMR", `${H.fmt(bmr, 0)} kcal`], ["Maintenance", `${H.fmt(tdee, 0)} kcal`], ["Mild weight loss", `${H.fmt(tdee - 250, 0)} kcal`], ["Weight loss", `${H.fmt(tdee - 500, 0)} kcal`], ["Mild weight gain", `${H.fmt(tdee + 250, 0)} kcal`], ["Weight gain", `${H.fmt(tdee + 500, 0)} kcal`]],
          steps: [v.gender === "male" ? "BMR = 10w + 6.25h − 5a + 5" : "BMR = 10w + 6.25h − 5a − 161", `BMR = 10×${H.fmt(weight, 4)} + 6.25×${H.fmt(height, 4)} − 5×${H.fmt(age, 4)} ${v.gender === "male" ? "+ 5" : "− 161"} = ${H.fmt(bmr, 0)} kcal`, `TDEE = BMR × activity factor = ${H.fmt(bmr, 0)} × ${H.fmt(activity, 3)} = ${H.fmt(tdee, 0)} kcal`],
          notes: ["Calorie estimates are approximate. Consult a qualified professional for personal medical advice."],
        };
      },
    },
    {
      slug: "body-fat-calculator",
      title: "Body Fat Calculator",
      intro: "Estimate body fat percentage with the US Navy circumference method.",
      stepTitle: "Enter your measurements",
      fields: [
        { id: "gender", label: "Gender", type: "select", default: "male", options: [["Male", "male"], ["Female", "female"]] },
        { id: "height", label: "Height (cm)", type: "number", min: 1, default: 175 },
        { id: "neck", label: "Neck circumference (cm)", type: "number", min: 1, default: 38 },
        { id: "waist", label: "Waist circumference (cm)", type: "number", min: 1, default: 85 },
        { id: "hip", label: "Hip circumference (cm)", type: "number", min: 1, default: 95, showIf: (v) => v.gender === "female" }],
      compute(v, H) {
        const height = H.num(v.height);
        const neck = H.num(v.neck);
        const waist = H.num(v.waist);
        const hip = H.num(v.hip);
        if (height === null || neck === null || waist === null) throw new Error("Enter your height, neck and waist measurements.");
        if (height <= 0 || neck <= 0 || waist <= 0) throw new Error("measurements must be greater than zero.");
        let bodyFat;
        if (v.gender === "male") {
          if (waist <= neck) throw new Error("Waist must be larger than neck for the male formula.");
          bodyFat = 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(height)) - 450;
        } else {
          if (hip === null || hip <= 0) throw new Error("Enter the hip circumference.");
          if (waist + hip <= neck) throw new Error("Waist plus hip must be larger than neck for the female formula.");
          bodyFat = 495 / (1.29579 - 0.35004 * Math.log10(waist + hip - neck) + 0.22100 * Math.log10(height)) - 450;
        }
        const category = v.gender === "male"
          ? bodyFat < 6 ? "Essential fat" : bodyFat < 14 ? "Athletic" : bodyFat < 18 ? "Fitness" : bodyFat < 25 ? "Average" : "Obese"
          : bodyFat < 14 ? "Essential fat" : bodyFat < 21 ? "Athletic" : bodyFat < 25 ? "Fitness" : bodyFat < 32 ? "Average" : "Obese";
        return {
          primary: { label: "Estimated body fat", value: `${H.fmt(bodyFat, 2)}%`, sub: category },
          details: [["Body fat", `${H.fmt(bodyFat, 2)}%`], ["Lean body mass estimate", `${H.fmt(100 - bodyFat, 2)}%`], ["Category", category], ["Method", "US Navy circumference formula"]],
          steps: [v.gender === "male" ? "Body fat = 495 ÷ (1.0324 − 0.19077×log10(waist − neck) + 0.15456×log10(height)) − 450" : "Body fat = 495 ÷ (1.29579 − 0.35004×log10(waist + hip − neck) + 0.22100×log10(height)) − 450", `Measurements in cm: waist ${H.fmt(waist, 2)}, neck ${H.fmt(neck, 2)}, height ${H.fmt(height, 2)}`, `Estimated body fat = ${H.fmt(bodyFat, 2)}%`],
          notes: ["Circumference estimates are less precise than professional body composition testing."],
        };
      },
    },
    {
      slug: "water-intake-calculator",
      title: "Daily Water Intake Calculator",
      intro: "Estimate how much water to drink each day based on body weight, exercise and climate.",
      stepTitle: "Enter your details",
      fields: [
        { id: "weight", label: "Weight (kg)", type: "number", min: 1, default: 70 },
        { id: "exercise", label: "Exercise per day (minutes)", type: "number", min: 0, default: 30 },
        { id: "climate", label: "Climate", type: "select", default: "normal", options: [["Normal", "normal"], ["Hot", "hot"], ["Very hot and humid", "very-hot"]] },
      ],
      compute(v, H) {
        const weight = H.num(v.weight);
        const exercise = H.num(v.exercise);
        if (weight === null || exercise === null) throw new Error("Enter your weight and exercise time.");
        if (weight <= 0) throw new Error("Weight must be greater than zero.");
        if (exercise < 0) throw new Error("Exercise time cannot be negative.");
        const base = weight * 35;
        const exerciseWater = exercise * 12;
        const multiplier = { normal: 1, hot: 1.1, "very-hot": 1.2 }[v.climate] || 1;
        const totalMl = (base + exerciseWater) * multiplier;
        const litres = totalMl / 1000;
        return {
          primary: { label: "Daily water target", value: `${H.fmt(litres, 2)} litres`, sub: `${H.fmt(totalMl, 0)} ml · about ${H.fmt(totalMl / 240, 1)} cups` },
          details: [["Body weight base", `${H.fmt(base, 0)} ml`], ["Exercise addition", `${H.fmt(exerciseWater, 0)} ml`], ["Climate multiplier", `× ${H.fmt(multiplier, 2)}`], ["Total", `${H.fmt(totalMl, 0)} ml`], ["Cups (240 ml)", H.fmt(totalMl / 240, 1)], ["Glasses (250 ml)", H.fmt(totalMl / 250, 1)]],
          steps: [`Base = weight × 35 ml = ${H.fmt(weight, 4)} × 35 = ${H.fmt(base, 0)} ml`, `Exercise = minutes × 12 ml = ${H.fmt(exercise, 4)} × 12 = ${H.fmt(exerciseWater, 0)} ml`, `Climate adjustment = × ${H.fmt(multiplier, 2)}`, `Total = (${H.fmt(base, 0)} + ${H.fmt(exerciseWater, 0)}) × ${H.fmt(multiplier, 2)} = ${H.fmt(totalMl, 0)} ml`],
          notes: ["This is a general estimate. Medical conditions, pregnancy and heat exposure can change your needs."],
        };
      },
    },
    {
      slug: "pregnancy-due-date-calculator",
      title: "Pregnancy Due Date Calculator",
      intro: "Estimate the due date from the first day of your last menstrual period and see the current gestational age.",
      stepTitle: "Enter the last period date",
      fields: [
        { id: "lmp", label: "First day of last period", type: "date", default: H.isoDate(H.addDays(new Date(), -70)) },
        { id: "cycle", label: "Average cycle length (days)", type: "number", min: 20, max: 45, step: 1, default: 28 },
      ],
      compute(v, H) {
        const lmp = H.parseDate(v.lmp);
        const cycle = H.num(v.cycle);
        if (cycle === null || !Number.isInteger(cycle) || cycle < 20 || cycle > 45) throw new Error("Cycle length must be a whole number from 20 to 45 days.");
        const now = H.parseDate(H.today());
        if (H.diffDays(lmp, now) < 0) throw new Error("The last period date cannot be in the future.");
        const adjustment = cycle - 28;
        const due = H.addDays(lmp, 280 + adjustment);
        const gestationalDays = H.diffDays(lmp, now);
        const weeks = Math.floor(gestationalDays / 7);
        const days = gestationalDays % 7;
        const trimester = weeks < 14 ? "First trimester" : weeks < 28 ? "Second trimester" : "Third trimester";
        const remaining = H.diffDays(now, due);
        const conception = H.addDays(lmp, 14 + adjustment);
        return {
          primary: { label: "Estimated due date", value: H.formatDate(due), sub: remaining >= 0 ? `${remaining} day${remaining === 1 ? "" : "s"} to go` : `${Math.abs(remaining)} day${Math.abs(remaining) === 1 ? "" : "s"} past the due date` },
          details: [["Current gestational age", `${weeks} week${weeks === 1 ? "" : "s"} ${days} day${days === 1 ? "" : "s"}`], ["Trimester", trimester], ["Estimated conception", H.formatDate(conception)], ["Cycle adjustment", `${adjustment >= 0 ? "+" : ""}${adjustment} days`], ["Pregnancy length used", `${280 + adjustment} days`]],
          steps: [`Start with the last period date: ${H.formatDate(lmp)}`, `Naegele rule: due date = last period + 280 days`, `Adjust for a ${cycle}-day cycle: ${adjustment >= 0 ? "+" : ""}${adjustment} days`, `Due date = ${H.formatDate(due)}`, `Gestational age today = ${weeks} weeks and ${days} days`],
          notes: ["Only an ultrasound can confirm gestational age. This calculator is for information, not medical advice."],
        };
      },
    },
    {
      slug: "age-calculator",
      title: "Age Calculator",
      intro: "Calculate exact age in years, months and days, plus total days and the next birthday.",
      stepTitle: "Enter the birth date",
      fields: [
        { id: "dob", label: "Date of birth", type: "date", default: "2000-01-01" },
        { id: "asOf", label: "Age at date", type: "date", default: H.today() },
      ],
      compute(v, H) {
        const dob = H.parseDate(v.dob);
        const asOf = H.parseDate(v.asOf);
        if (H.diffDays(dob, asOf) < 0) throw new Error("The birth date must be before the age date.");
        let years = asOf.getFullYear() - dob.getFullYear();
        let months = asOf.getMonth() - dob.getMonth();
        let days = asOf.getDate() - dob.getDate();
        if (days < 0) {
          months -= 1;
          days += new Date(asOf.getFullYear(), asOf.getMonth(), 0).getDate();
        }
        if (months < 0) {
          years -= 1;
          months += 12;
        }
        const totalDays = H.diffDays(dob, asOf);
        let birthday = new Date(asOf.getFullYear(), dob.getMonth(), dob.getDate());
        if (H.diffDays(birthday, asOf) < 0) birthday = new Date(asOf.getFullYear() + 1, dob.getMonth(), dob.getDate());
        const untilBirthday = H.diffDays(asOf, birthday);
        const nextAge = birthday.getFullYear() - dob.getFullYear();
        return {
          primary: { label: "Age", value: `${years} year${years === 1 ? "" : "s"}, ${months} month${months === 1 ? "" : "s"}, ${days} day${days === 1 ? "" : "s"}`, sub: `Born ${H.formatDate(dob)}` },
          details: [["Total days", H.fmt(totalDays)], ["Total weeks", H.fmt(Math.floor(totalDays / 7))], ["Total months", H.fmt(Math.floor(totalDays / 30.4375))], ["Total hours", H.fmt(totalDays * 24)], ["Next birthday", H.formatDate(birthday)], ["Days until birthday", H.fmt(untilBirthday)], ["Turning", `${nextAge} years`]],
          steps: [`Years = ${years}, months = ${months}, days = ${days}`, `Total days = ${H.fmt(totalDays)}`, `Next birthday: ${H.formatDate(birthday)} (${untilBirthday} days away)`],
        };
      },
    },
    {
      slug: "date-difference-calculator",
      title: "Date Difference Calculator",
      intro: "Count the days, weeks and business days between two dates.",
      stepTitle: "Choose the dates",
      fields: [
        { id: "start", label: "Start date", type: "date", default: H.today() },
        { id: "end", label: "End date", type: "date", default: H.isoDate(H.addDays(new Date(), 30)) },
        { id: "includeEnd", label: "Include the end date?", type: "select", default: "no", options: [["No", "no"], ["Yes", "yes"]] },
      ],
      compute(v, H) {
        const start = H.parseDate(v.start);
        const end = H.parseDate(v.end);
        const include = v.includeEnd === "yes" ? 1 : 0;
        const difference = H.diffDays(start, end);
        const direction = difference < 0 ? -1 : 1;
        const total = Math.abs(difference) + include;
        const first = direction > 0 ? start : end;
        const last = direction > 0 ? end : start;
        let business = 0;
        let weekend = 0;
        const countDay = (date) => {
          const day = date.getDay();
          if (day === 0 || day === 6) weekend += 1;
          else business += 1;
        };
        for (let cursor = new Date(first.getFullYear(), first.getMonth(), first.getDate()); H.diffDays(cursor, last) > 0; cursor = H.addDays(cursor, 1)) {
          countDay(cursor);
        }
        if (include) countDay(last);
        const weeks = Math.floor(total / 7);
        const days = total % 7;
        return {
          primary: { label: "Calendar days", value: H.fmt(total), sub: `${weeks} week${weeks === 1 ? "" : "s"} ${days} day${days === 1 ? "" : "s"} · ${direction > 0 ? "forward" : "backward"}` },
          details: [["Start", H.formatDate(start)], ["End", H.formatDate(end)], ["Calendar days", H.fmt(total)], ["Weeks", `${weeks} weeks ${days} days`], ["Business days (Mon-Fri)", H.fmt(business)], ["Weekend days", H.fmt(weekend)], ["Approximate months", H.fmt(total / 30.4375)]],
          steps: [`Difference = end − start${include ? " + 1 day" : ""}`, `${H.formatDate(start)} → ${H.formatDate(end)}`, `Calendar days = ${H.fmt(total)}`, `Weeks = ${weeks}, remaining days = ${days}`],
          notes: ["Business days exclude Saturdays and Sundays but do not account for public holidays."],
        };
      },
    },
    {
      slug: "time-duration-calculator",
      title: "Time Duration Calculator",
      intro: "Find the hours and minutes between two times, including breaks and overnight shifts.",
      stepTitle: "Enter the start and end time",
      fields: [
        { id: "start", label: "Start time", type: "time", default: "09:00" },
        { id: "end", label: "End time", type: "time", default: "17:30" },
        { id: "breakMinutes", label: "Break time (minutes)", type: "number", min: 0, default: 30 },
      ],
      compute(v, H) {
        const start = H.parseTime(v.start);
        const end = H.parseTime(v.end);
        const breakMinutes = H.num(v.breakMinutes);
        if (breakMinutes === null || breakMinutes < 0) throw new Error("Break time must be zero or more minutes.");
        let elapsed = end - start;
        const overnight = elapsed < 0;
        if (overnight) elapsed += 1440;
        const duration = elapsed - breakMinutes;
        if (duration < 0) throw new Error("The break is longer than the elapsed time.");
        const hours = Math.floor(duration / 60);
        const minutes = duration % 60;
        return {
          primary: { label: "Duration", value: `${hours} hour${hours === 1 ? "" : "s"} ${minutes} minute${minutes === 1 ? "" : "s"}`, sub: `${H.fmt(duration / 60, 4)} decimal hours` },
          details: [["Start", v.start], ["End", v.end], ["Elapsed", H.durationText(elapsed)], ["Break", H.durationText(breakMinutes)], ["Worked time", H.durationText(duration)], ["Decimal hours", H.fmt(duration / 60, 4)], ["Total minutes", H.fmt(duration)]],
          steps: [`Elapsed = end − start${overnight ? " (add 24 hours for an overnight shift)" : ""} = ${H.durationText(elapsed)}`, `Subtract the break: ${H.durationText(elapsed)} − ${H.durationText(breakMinutes)} = ${H.durationText(duration)}`, `Decimal hours = ${H.fmt(duration)} ÷ 60 = ${H.fmt(duration / 60, 4)}`],
        };
      },
    },
    {
      slug: "work-hours-calculator",
      title: "Work Hours and Pay Calculator",
      intro: "Calculate worked hours and pay from start time, end time, break and hourly rate.",
      stepTitle: "Enter the shift details",
      fields: [
        { id: "start", label: "Start time", type: "time", default: "09:00" },
        { id: "end", label: "End time", type: "time", default: "17:30" },
        { id: "breakMinutes", label: "Break time (minutes)", type: "number", min: 0, default: 30 },
        { id: "rate", label: "Hourly rate", type: "number", min: 0, default: 500 },
      ],
      compute(v, H) {
        const start = H.parseTime(v.start);
        const end = H.parseTime(v.end);
        const breakMinutes = H.num(v.breakMinutes);
        const rate = H.num(v.rate);
        if (breakMinutes === null || breakMinutes < 0) throw new Error("Break time must be zero or more minutes.");
        if (rate === null || rate < 0) throw new Error("Hourly rate must be zero or more.");
        let elapsed = end - start;
        if (elapsed < 0) elapsed += 1440;
        const duration = elapsed - breakMinutes;
        if (duration < 0) throw new Error("The break is longer than the elapsed time.");
        const hours = duration / 60;
        return {
          primary: { label: "Pay for this shift", value: H.money(hours * rate), sub: `${H.durationText(duration)} at ${H.money(rate)} per hour` },
          details: [["Worked time", H.durationText(duration)], ["Decimal hours", H.fmt(hours, 4)], ["Hourly rate", H.money(rate)], ["Gross pay", H.money(hours * rate)], ["Unpaid break", H.durationText(breakMinutes)]],
          steps: [`Elapsed = ${H.durationText(elapsed)}`, `Worked time = ${H.durationText(elapsed)} − ${H.durationText(breakMinutes)} = ${H.durationText(duration)}`, `Decimal hours = ${H.fmt(hours, 4)}`, `Pay = ${H.fmt(hours, 4)} × ${H.money(rate)} = ${H.money(hours * rate)}`],
          notes: ["Gross pay only. Overtime, taxes and deductions are not included."],
        };
      },
    },
    {
      slug: "temperature-converter",
      title: "Temperature Converter",
      intro: "Convert between Celsius, Fahrenheit and Kelvin with the conversion steps shown.",
      stepTitle: "Enter the temperature",
      fields: [
        { id: "value", label: "Temperature", type: "number", default: 25 },
        { id: "from", label: "From", type: "select", default: "C", options: [["Celsius (°C)", "C"], ["Fahrenheit (°F)", "F"], ["Kelvin (K)", "K"]] },
        { id: "to", label: "To", type: "select", default: "F", options: [["Celsius (°C)", "C"], ["Fahrenheit (°F)", "F"], ["Kelvin (K)", "K"]] },
      ],
      compute(v, H) {
        const value = H.num(v.value);
        if (value === null) throw new Error("Enter a temperature.");
        const celsius = v.from === "C" ? value : v.from === "F" ? (value - 32) * 5 / 9 : value - 273.15;
        if (celsius < -273.15) throw new Error("That temperature is below absolute zero.");
        const result = v.to === "C" ? celsius : v.to === "F" ? celsius * 9 / 5 + 32 : celsius + 273.15;
        const symbol = { C: "°C", F: "°F", K: "K" };
        return {
          primary: { label: `${H.fmt(value, 6)} ${symbol[v.from]} equals`, value: `${H.fmt(result, 6)} ${symbol[v.to]}` },
          details: [["Celsius", `${H.fmt(celsius, 6)} °C`], ["Fahrenheit", `${H.fmt(celsius * 9 / 5 + 32, 6)} °F`], ["Kelvin", `${H.fmt(celsius + 273.15, 6)} K`]],
          steps: [v.from === "C" ? `Start with ${H.fmt(value, 6)} °C.` : v.from === "F" ? `Convert to Celsius: (${H.fmt(value, 6)} − 32) × 5/9 = ${H.fmt(celsius, 6)} °C.` : `Convert to Celsius: ${H.fmt(value, 6)} − 273.15 = ${H.fmt(celsius, 6)} °C.`, v.to === "C" ? `Result: ${H.fmt(result, 6)} °C` : v.to === "F" ? `Convert to Fahrenheit: ${H.fmt(celsius, 6)} × 9/5 + 32 = ${H.fmt(result, 6)} °F` : `Convert to Kelvin: ${H.fmt(celsius, 6)} + 273.15 = ${H.fmt(result, 6)} K`],
        };
      },
    },
    linearConverter({
      slug: "length-converter",
      title: "Length Converter",
      intro: "Convert between millimetres, metres, kilometres, inches, feet, yards, miles and nautical miles.",
      units: {
        mm: { label: "Millimetres (mm)", factor: 0.001 },
        cm: { label: "Centimetres (cm)", factor: 0.01 },
        m: { label: "Metres (m)", factor: 1 },
        km: { label: "Kilometres (km)", factor: 1000 },
        in: { label: "Inches (in)", factor: 0.0254 },
        ft: { label: "Feet (ft)", factor: 0.3048 },
        yd: { label: "Yards (yd)", factor: 0.9144 },
        mi: { label: "Miles (mi)", factor: 1609.344 },
        nmi: { label: "Nautical miles (nmi)", factor: 1852 },
      },
      baseLabel: "metres",
      defaultFrom: "m",
      defaultTo: "ft",
    }),
    linearConverter({
      slug: "weight-converter",
      title: "Weight Converter",
      intro: "Convert between milligrams, grams, kilograms, tonnes, ounces, pounds and stones.",
      units: {
        mg: { label: "Milligrams (mg)", factor: 0.000001 },
        g: { label: "Grams (g)", factor: 0.001 },
        kg: { label: "Kilograms (kg)", factor: 1 },
        t: { label: "Tonnes (t)", factor: 1000 },
        oz: { label: "Ounces (oz)", factor: 0.028349523125 },
        lb: { label: "Pounds (lb)", factor: 0.45359237 },
        st: { label: "Stones (st)", factor: 6.35029318 },
      },
      baseLabel: "kilograms",
      defaultFrom: "kg",
      defaultTo: "lb",
    }),
    linearConverter({
      slug: "area-converter",
      title: "Area Converter",
      intro: "Convert between square metres, square feet, acres, hectares and more.",
      units: {
        mm2: { label: "Square millimetres (mm²)", factor: 0.000001 },
        cm2: { label: "Square centimetres (cm²)", factor: 0.0001 },
        m2: { label: "Square metres (m²)", factor: 1 },
        ha: { label: "Hectares (ha)", factor: 10000 },
        km2: { label: "Square kilometres (km²)", factor: 1000000 },
        in2: { label: "Square inches (in²)", factor: 0.00064516 },
        ft2: { label: "Square feet (ft²)", factor: 0.09290304 },
        yd2: { label: "Square yards (yd²)", factor: 0.83612736 },
        acre: { label: "Acres", factor: 4046.8564224 },
        mi2: { label: "Square miles (mi²)", factor: 2589988.110336 },
      },
      baseLabel: "square metres",
      defaultFrom: "m2",
      defaultTo: "ft2",
    }),
    linearConverter({
      slug: "volume-converter",
      title: "Volume Converter",
      intro: "Convert litres, millilitres, cubic metres, cups, pints, quarts and gallons.",
      units: {
        ml: { label: "Millilitres (ml)", factor: 0.001 },
        l: { label: "Litres (l)", factor: 1 },
        m3: { label: "Cubic metres (m³)", factor: 1000 },
        cm3: { label: "Cubic centimetres (cm³)", factor: 0.001 },
        tsp: { label: "Teaspoons (US)", factor: 0.00492892159375 },
        tbsp: { label: "Tablespoons (US)", factor: 0.01478676478125 },
        floz: { label: "Fluid ounces (US)", factor: 0.0295735295625 },
        cup: { label: "Cups (US)", factor: 0.2365882365 },
        pint: { label: "Pints (US)", factor: 0.473176473 },
        quart: { label: "Quarts (US)", factor: 0.946352946 },
        gallon: { label: "Gallons (US)", factor: 3.785411784 },
        ft3: { label: "Cubic feet (ft³)", factor: 28.316846592 },
      },
      baseLabel: "litres",
      defaultFrom: "l",
      defaultTo: "cup",
    }),
    linearConverter({
      slug: "speed-converter",
      title: "Speed Converter",
      intro: "Convert between metres per second, kilometres per hour, miles per hour, feet per second and knots.",
      units: {
        ms: { label: "Metres per second (m/s)", factor: 1 },
        kmh: { label: "Kilometres per hour (km/h)", factor: 0.2777777777777778 },
        mph: { label: "Miles per hour (mph)", factor: 0.44704 },
        fts: { label: "Feet per second (ft/s)", factor: 0.3048 },
        knot: { label: "Knots", factor: 0.5144444444444445 },
      },
      baseLabel: "metres per second",
      defaultFrom: "kmh",
      defaultTo: "mph",
    }),
    linearConverter({
      slug: "data-storage-converter",
      title: "Data Storage Converter",
      intro: "Convert bits, bytes and decimal or binary storage units such as KB, MB, GB, KiB, MiB and GiB.",
      units: {
        bit: { label: "Bits (b)", factor: 0.125 },
        byte: { label: "Bytes (B)", factor: 1 },
        kb: { label: "Kilobytes (KB, 1000 B)", factor: 1000 },
        mb: { label: "Megabytes (MB, 10⁶ B)", factor: 1000000 },
        gb: { label: "Gigabytes (GB, 10⁹ B)", factor: 1000000000 },
        tb: { label: "Terabytes (TB, 10¹² B)", factor: 1000000000000 },
        kib: { label: "Kibibytes (KiB, 1024 B)", factor: 1024 },
        mib: { label: "Mebibytes (MiB, 1024² B)", factor: 1048576 },
        gib: { label: "Gibibytes (GiB, 1024³ B)", factor: 1073741824 },
        tib: { label: "Tebibytes (TiB, 1024⁴ B)", factor: 1099511627776 },
      },
      baseLabel: "bytes",
      defaultFrom: "gb",
      defaultTo: "mb",
    }),
    linearConverter({
      slug: "time-converter",
      title: "Time Converter",
      intro: "Convert seconds, minutes, hours, days, weeks, months and years.",
      units: {
        second: { label: "Seconds (s)", factor: 1 },
        minute: { label: "Minutes (min)", factor: 60 },
        hour: { label: "Hours (h)", factor: 3600 },
        day: { label: "Days", factor: 86400 },
        week: { label: "Weeks", factor: 604800 },
        month: { label: "Months (30.4375 days)", factor: 2629800 },
        year: { label: "Years (365.25 days)", factor: 31557600 },
      },
      baseLabel: "seconds",
      defaultFrom: "hour",
      defaultTo: "minute",
      decimals: 4,
    }),
    linearConverter({
      slug: "cooking-measurement-converter",
      title: "Cooking Measurement Converter",
      intro: "Convert teaspoons, tablespoons, cups, fluid ounces, pints, quarts, gallons, millilitres and litres.",
      units: {
        tsp: { label: "Teaspoons (tsp)", factor: 4.92892159375 },
        tbsp: { label: "Tablespoons (tbsp)", factor: 14.78676478125 },
        floz: { label: "Fluid ounces (fl oz)", factor: 29.5735295625 },
        cup: { label: "Cups", factor: 236.5882365 },
        pint: { label: "Pints", factor: 473.176473 },
        quart: { label: "Quarts", factor: 946.352946 },
        gallon: { label: "Gallons", factor: 3785.411784 },
        ml: { label: "Millilitres (ml)", factor: 1 },
        l: { label: "Litres (l)", factor: 1000 },
      },
      baseLabel: "millilitres",
      defaultFrom: "cup",
      defaultTo: "ml",
      decimals: 4,
    }),
  ];

  CALCS.forEach((config) => T.register(config.slug, (root) => mountWizard(root, config)));
})();
