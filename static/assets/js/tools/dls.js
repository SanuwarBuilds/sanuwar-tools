"use strict";
(() => {
  const T = window.SANU_TOOLS;
  const { el } = T;
  const C = window.DLSCore;

  const fmt = (value, digits = 0) => {
    if (!Number.isFinite(Number(value))) return "—";
    return Number(value).toLocaleString("en-US", { maximumFractionDigits: digits });
  };

  const numberInput = (value, onInput, placeholder = "", min, max, stepValue = "any") => {
    const control = T.input({ type: "number", inputmode: "decimal", step: stepValue, placeholder });
    if (min !== undefined) control.min = min;
    if (max !== undefined) control.max = max;
    control.value = value ?? "";
    control.addEventListener("input", () => onInput(control.value));
    return control;
  };

  T.register("dls-calculator", (root) => {
    const defaults = () => ({
      format: "odi",
      customOvers: "",
      g50: "",
      team1Score: "",
      team1Start: "50",
      team1Interruptions: [],
      team2Start: "50",
      team2Interruptions: [],
      currentScore: "",
      currentOvers: "",
      currentWickets: "",
    });

    const labels = ["Match setup", "Team 1 innings", "Team 2 chase", "Live situation", "Result"];
    let state = defaults();
    let step = 0;
    let result = null;
    let problem = "";

    const reset = () => {
      state = defaults();
      step = 0;
      result = null;
      problem = "";
      render();
    };

    const formatOvers = (balls) => C.oversLabel(balls);
    const startDefaultFor = (format, custom) => format === "t20" ? "20" : format === "custom" ? (custom || "40") : "50";

    const interruptionProblem = (list, team) => {
      for (let index = 0; index < list.length; index += 1) {
        const item = list[index];
        const prefix = `${team} interruption ${index + 1}`;
        if (C.ballsFromOvers(item.usedOvers) === null) return `${prefix}: enter overs used like 12.3.`;
        const wickets = Number(item.wickets);
        const maxWickets = item.ended ? 10 : 9;
        if (!Number.isInteger(wickets) || wickets < 0 || wickets > maxWickets) return `${prefix}: wickets must be between 0 and ${maxWickets}.`;
        if (!item.ended && C.ballsFromOvers(item.resumeOvers) === null) return `${prefix}: enter the revised overs limit.`;
      }
      return "";
    };

    const validate = () => {
      if (step === 0) {
        if (state.format === "custom") {
          const overs = Number(state.customOvers);
          if (!Number.isFinite(overs) || overs < 5 || overs > 50) return "Custom overs must be between 5 and 50.";
        }
        if (String(state.g50).trim() !== "" && !(Number(state.g50) > 0)) return "G50 must be a positive number.";
      }
      if (step === 1) {
        if (String(state.team1Score).trim() === "" || !(Number(state.team1Score) >= 0)) return "Enter Team 1's final score.";
        if (C.ballsFromOvers(state.team1Start) === null) return "Team 1 start overs must look like 50 or 12.3.";
        return interruptionProblem(state.team1Interruptions, "Team 1");
      }
      if (step === 2) {
        if (C.ballsFromOvers(state.team2Start) === null) return "Team 2 start overs must look like 50 or 12.3.";
        return interruptionProblem(state.team2Interruptions, "Team 2");
      }
      if (step === 3) {
        const live = [state.currentScore, state.currentOvers, state.currentWickets].some((value) => String(value).trim() !== "");
        if (live) {
          if (!(Number(state.currentScore) >= 0)) return "Enter the current chase score.";
          if (C.ballsFromOvers(state.currentOvers) === null) return "Current overs must look like 12.3.";
          const wickets = Number(state.currentWickets);
          if (!Number.isInteger(wickets) || wickets < 0 || wickets > 10) return "Current wickets must be between 0 and 10.";
        }
      }
      return "";
    };

    const compute = () => {
      const g50 = String(state.g50).trim() === "" ? (state.format === "t20" ? 160 : 245) : state.g50;
      const output = C.compute({
        format: state.format,
        customOvers: state.customOvers,
        g50,
        team1: { score: state.team1Score, startOvers: state.team1Start, interruptions: state.team1Interruptions },
        team2: {
          startOvers: state.team2Start,
          interruptions: state.team2Interruptions,
          currentScore: state.currentScore,
          currentOvers: state.currentOvers,
          currentWickets: state.currentWickets,
        },
      });
      if (!output.ok) throw new Error(output.errors.join(" "));
      return output;
    };

    const interruptionEditor = (key, team) => {
      const list = state[key];
      const wrap = el("div", { class: "calc-interruptions" });
      wrap.append(el("span", { class: "tp-label", text: "Interruptions" }));
      if (!list.length) wrap.append(el("p", { class: "tp-hint", text: "No interruptions. Add one if overs were reduced or the innings ended early." }));
      list.forEach((item, index) => {
        const row = el("div", { class: "calc-interruption" });
        row.append(T.field("Overs used when play stopped", numberInput(item.usedOvers, (value) => { item.usedOvers = value; }, "12.3", 0), "Use cricket notation: 12.3 means 12 overs and 3 balls."));
        row.append(T.field("Wickets down", numberInput(item.wickets, (value) => { item.wickets = value; }, "2", 0, 10, "1")));
        const outcome = T.select([["Play resumed with fewer overs", "continue"], ["Innings ended", "ended"]], item.ended ? "ended" : "continue");
        outcome.addEventListener("change", () => {
          item.ended = outcome.value === "ended";
          render();
        });
        row.append(T.field("What happened?", outcome));
        if (!item.ended) row.append(T.field("Revised overs limit", numberInput(item.resumeOvers, (value) => { item.resumeOvers = value; }, "40", 0)));
        row.append(T.button("Remove", () => {
          list.splice(index, 1);
          render();
        }, "ghost", { class: "tp-btn tp-btn-ghost tp-btn-sm" }));
        wrap.append(row);
      });
      wrap.append(T.button(`+ Add ${team} interruption`, () => {
        list.push({ usedOvers: "", wickets: "0", ended: false, resumeOvers: "" });
        render();
      }, "ghost"));
      return wrap;
    };

    const progress = () => el("ol", { class: "calc-progress", "aria-label": "DLS calculator steps" },
      labels.map((label, index) => el("li", {
        class: `calc-progress-step${index === step ? " is-active" : ""}${index < step ? " is-done" : ""}`,
      }, el("span", { class: "calc-progress-dot", text: String(index + 1).padStart(2, "0") }), el("span", { class: "calc-progress-label", text: label }))));

    const setupStep = () => {
      const format = T.select([["ODI (50 overs)", "odi"], ["T20 (20 overs)", "t20"], ["Custom overs", "custom"]], state.format);
      format.addEventListener("change", () => {
        const oldDefault = startDefaultFor(state.format, state.customOvers);
        state.format = format.value;
        const nextDefault = startDefaultFor(state.format, state.customOvers);
        if (!state.team1Start || state.team1Start === oldDefault) state.team1Start = nextDefault;
        if (!state.team2Start || state.team2Start === oldDefault) state.team2Start = nextDefault;
        state.g50 = "";
        render();
      });
      const grid = el("div", { class: "tp-cols calc-fields" },
        T.field("Match format", format),
        state.format === "custom" ? T.field("Custom overs", numberInput(state.customOvers, (value) => {
          const previousDefault = startDefaultFor("custom", state.customOvers);
          state.customOvers = value;
          const nextDefault = startDefaultFor("custom", state.customOvers);
          if (!state.team1Start || state.team1Start === previousDefault) state.team1Start = nextDefault;
          if (!state.team2Start || state.team2Start === previousDefault) state.team2Start = nextDefault;
        }, "40", 5, 50, "1"), "Between 5 and 50 overs.") : null,
        T.field("G50 (par score for a full innings)", numberInput(state.g50, (value) => { state.g50 = value; }, state.format === "t20" ? "160" : "245", 1), "Leave blank for the standard default: 245 ODI, 160 T20."));
      return el("section", { class: "tp-panel calc-step" },
        el("h2", { class: "calc-step-title", text: "1. Match setup" }),
        el("p", { class: "calc-step-desc", text: "Choose the match length. The calculator uses the ICC Standard Edition resource tables." }),
        grid);
    };

    const team1Step = () => el("section", { class: "tp-panel calc-step" },
      el("h2", { class: "calc-step-title", text: "2. Team 1 innings" }),
      el("p", { class: "calc-step-desc", text: "Enter the final score and any interruptions that reduced Team 1's innings." }),
      el("div", { class: "tp-cols calc-fields" },
        T.field("Team 1 final score", numberInput(state.team1Score, (value) => { state.team1Score = value; }, "280", 0)),
        T.field("Overs available at the start", numberInput(state.team1Start, (value) => { state.team1Start = value; }, state.format === "t20" ? "20" : "50", 0), "Change this only if the innings started with fewer overs.")),
      interruptionEditor("team1Interruptions", "Team 1"));

    const team2Step = () => el("section", { class: "tp-panel calc-step" },
      el("h2", { class: "calc-step-title", text: "3. Team 2 chase" }),
      el("p", { class: "calc-step-desc", text: "Set the overs available to Team 2, then add any interruptions or a revised target situation." }),
      el("div", { class: "tp-cols calc-fields" },
        T.field("Overs available at the start", numberInput(state.team2Start, (value) => { state.team2Start = value; }, state.format === "t20" ? "20" : "50", 0), "Usually the same as Team 1's revised overs.")),
      interruptionEditor("team2Interruptions", "Team 2"));

    const liveStep = () => el("section", { class: "tp-panel calc-step" },
      el("h2", { class: "calc-step-title", text: "4. Live situation (optional)" }),
      el("p", { class: "calc-step-desc", text: "Fill these fields to see the current par score during the chase. Leave them blank for the pre-match target." }),
      el("div", { class: "tp-cols calc-fields" },
        T.field("Current chase score", numberInput(state.currentScore, (value) => { state.currentScore = value; }, "145", 0)),
        T.field("Overs completed", numberInput(state.currentOvers, (value) => { state.currentOvers = value; }, "25.4", 0), "Cricket notation: 25.4 = 25 overs 4 balls."),
        T.field("Wickets lost", numberInput(state.currentWickets, (value) => { state.currentWickets = value; }, "3", 0, 10, "1"))));

    const resultView = () => {
      const output = result;
      const live = output.live;
      const primary = live
        ? { label: "Par score right now", value: fmt(live.par), sub: `${live.status} · ${live.runsAhead >= 0 ? "+" : ""}${fmt(live.runsAhead)} runs` }
        : { label: "Target for Team 2", value: fmt(output.target), sub: `Par score ${output.parLabel} · Tie at ${fmt(output.tie)}` };
      const details = [
        ["Team 1 score", fmt(output.team1.score)],
        ["Team 1 resources", `${output.team1.resources.toFixed(1)}%`],
        ["Team 2 resources", `${output.team2.resources.toFixed(1)}%`],
        ["Par score", output.parLabel],
        ["Target", fmt(output.target)],
        ["Tie score", fmt(output.tie)],
        ["Formula", output.mode === "g50" ? "G50 adjustment" : "Standard resource ratio"],
        ["Format", output.formatLabel],
        ["G50", fmt(output.g50)],
      ];
      if (live) {
        details.push(["Current score", `${fmt(live.score)}/${live.wickets}`]);
        details.push(["Overs bowled", formatOvers(live.oversBalls)]);
        details.push(["Balls remaining", fmt(live.remainingBalls)]);
        details.push(["Resources used", `${live.resourcesUsed.toFixed(1)}%`]);
        details.push(["Resources left", `${live.resourcesLeft.toFixed(1)}%`]);
        details.push(["Par now", fmt(live.par)]);
        details.push(["Result", live.status]);
      }
      const steps = [`Match: ${output.formatLabel}, G50 = ${fmt(output.g50)}`];
      output.team1.steps.forEach((item) => steps.push(`Team 1 — ${item.label}: ${item.value}`));
      output.team2.steps.forEach((item) => steps.push(`Team 2 — ${item.label}: ${item.value}`));
      if (output.mode === "g50") {
        steps.push(`Par = Team 1 score + G50 × (R2 − R1) ÷ 100`);
        steps.push(`Par = ${fmt(output.team1.score)} + ${fmt(output.g50)} × (${output.team2.resources.toFixed(1)} − ${output.team1.resources.toFixed(1)}) ÷ 100 = ${output.parLabel}`);
      } else {
        steps.push(`Par = Team 1 score × (R2 ÷ R1)`);
        steps.push(`Par = ${fmt(output.team1.score)} × (${output.team2.resources.toFixed(1)} ÷ ${output.team1.resources.toFixed(1)}) = ${output.parLabel}`);
      }
      steps.push(`Target = floor(${output.parLabel}) + 1 = ${output.target}`);
      if (live && live.parRaw !== null) {
        steps.push(`Live par = Team 1 score × (resources used by Team 2 ÷ R1)`);
        steps.push(`Live par = ${fmt(output.team1.score)} × (${live.resourcesUsed.toFixed(1)} ÷ ${output.team1.resources.toFixed(1)}) = ${live.parRaw.toFixed(2)}`);
      }
      const notes = [...output.notes];
      if (live?.minimumWarn) notes.push(`A result is only official after the minimum of ${live.minimumOvers} overs per side (or a valid reduced target) has been played.`);

      const section = el("section", { class: "tp-panel calc-result" },
        el("div", { class: "calc-result-hero" },
          el("span", { class: "calc-result-label", text: primary.label }),
          el("strong", { class: "calc-result-value", text: primary.value }),
          el("span", { class: "calc-result-sub", text: primary.sub })),
        el("div", { class: "tp-kv calc-details" },
          details.map(([label, value]) => el("div", {}, el("span", { text: label }), el("strong", { text: String(value) })))),
        el("h3", { class: "tp-panel-title", text: "Step-by-step working" }),
        el("ol", { class: "calc-working" }, steps.map((line) => el("li", { text: line }))));
      notes.forEach((note) => section.append(el("p", { class: "calc-note", text: note })));
      const summary = [primary.label + ": " + primary.value, ...details.map(([label, value]) => `${label}: ${value}`)].join("\n");
      section.append(el("div", { class: "tp-actions calc-actions" },
        T.button("Copy DLS analysis", () => T.copy(summary), "primary"),
        T.button("Edit inputs", () => { step = 0; render(); }, "ghost"),
        T.button("Start over", reset, "ghost")));
      return section;
    };

    const errorView = () => el("section", { class: "tp-panel" },
      el("div", { class: "tp-error" }, el("strong", { text: "DLS could not calculate this match" }), el("p", { text: problem })),
      el("div", { class: "tp-actions calc-actions" },
        T.button("Edit inputs", () => { step = 0; render(); }, "primary"),
        T.button("Start over", reset, "ghost")));

    const actions = () => {
      const row = el("div", { class: "tp-actions calc-actions" });
      if (step > 0 && step < 4) row.append(T.button("← Back", () => { step -= 1; render(); }, "ghost"));
      if (step < 4) {
        row.append(T.button(step === 3 ? "Calculate DLS result" : "Next →", () => {
          const message = validate();
          if (message) {
            T.status(root, message, "error");
            return;
          }
          if (step === 3) {
            try {
              result = compute();
              problem = "";
              step = 4;
              render();
            } catch (error) {
              result = null;
              problem = error.message;
              step = 4;
              render();
            }
            return;
          }
          step += 1;
          render();
        }, "primary"));
      }
      row.append(T.button("Reset", reset, "ghost"));
      return row;
    };

    const render = () => {
      const shell = el("div", { class: "calc-wizard" }, progress());
      if (step === 0) shell.append(setupStep());
      else if (step === 1) shell.append(team1Step());
      else if (step === 2) shell.append(team2Step());
      else if (step === 3) shell.append(liveStep());
      else shell.append(result ? resultView() : errorView());
      if (step < 4) {
        const body = el("div", { class: "calc-step" });
        body.append(actions());
        shell.append(body);
      }
      root.replaceChildren(shell);
    };

    render();
  });
})();
