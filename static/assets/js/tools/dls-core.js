"use strict";
// Standard Edition Duckworth-Lewis-Stern resource solver.
// Tables: ICC Standard Edition resource percentages, indexed by overs remaining.
window.DLSCore = (() => {
  const TABLES = window.DLS_TABLES;
  const FORMATS = {
    odi: { key: "odi", table: "odi", label: "ODI", overs: 50, minOvers: 20, g50: 245 },
    t20: { key: "t20", table: "t20", label: "T20", overs: 20, minOvers: 5, g50: 160 }
  };

  const num = (value) => {
    const n = Number(String(value ?? "").replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : null;
  };

  const ballsFromOvers = (value) => {
    const raw = String(value ?? "").trim();
    const match = raw.match(/^(\d+)(?:\.(\d))?$/);
    if (!match) return null;
    const balls = Number(match[2] || 0);
    if (balls > 5) return null;
    return Number(match[1]) * 6 + balls;
  };

  const oversLabel = (balls) => {
    if (!Number.isFinite(balls) || balls < 0) return "—";
    return `${Math.floor(balls / 6)}.${balls % 6}`;
  };

  const resource = (tableKey, balls, wickets) => {
    const table = TABLES[tableKey];
    const w = Math.max(0, Math.min(10, Math.trunc(Number(wickets) || 0)));
    if (w >= 10) return 0;
    if (!Number.isFinite(balls) || balls <= 0) return 0;
    const maxBalls = table.overs * 6;
    if (balls >= maxBalls) return table.rows[table.overs][w];
    const exact = balls / 6;
    const lower = Math.floor(exact);
    if (exact === lower) return table.rows[lower][w];
    const upper = Math.min(lower + 1, table.overs);
    const start = table.rows[lower][w];
    const end = table.rows[upper][w];
    return start + (end - start) * (exact - lower);
  };

  const parseInterruptions = (tableKey, startOvers, interruptions) => {
    const errors = [];
    const steps = [];
    const startBalls = ballsFromOvers(startOvers);
    if (startBalls === null) errors.push("Start overs must look like 50 or 12.3 (12 overs, 3 balls).");
    let totalOvers = startBalls === null ? null : startBalls / 6;
    let resources = startBalls === null ? 0 : resource(tableKey, startBalls, 0);
    if (startBalls !== null) {
      steps.push({
        label: `Start: ${oversLabel(startBalls)} overs, 0 wickets`,
        value: `${resources.toFixed(1)}% resources`
      });
    }
    (interruptions || []).forEach((item, index) => {
      const n = index + 1;
      const usedBalls = ballsFromOvers(item.usedOvers);
      const previousBalls = totalOvers === null ? null : Math.round(totalOvers * 6);
      const resumeBalls = item.ended ? usedBalls : ballsFromOvers(item.resumeOvers);
      const wickets = Math.trunc(Number(item.wickets));
      const maxWickets = item.ended ? 10 : 9;
      if (usedBalls === null) errors.push(`Interruption ${n}: enter overs used as 18 or 18.2.`);
      if (previousBalls === null) errors.push(`Interruption ${n}: the previous overs limit is invalid.`);
      if (!item.ended && resumeBalls === null) errors.push(`Interruption ${n}: enter the revised overs limit.`);
      if (!Number.isInteger(wickets) || wickets < 0 || wickets > maxWickets) {
        errors.push(`Interruption ${n}: wickets must be between 0 and ${maxWickets}.`);
      }
      if (usedBalls === null || previousBalls === null || (resumeBalls === null && !item.ended)) return;
      if (usedBalls > previousBalls) errors.push(`Interruption ${n}: overs used cannot exceed the previous limit.`);
      if (!item.ended && resumeBalls > previousBalls) errors.push(`Interruption ${n}: revised limit cannot exceed the previous limit.`);
      if (!item.ended && resumeBalls < usedBalls) errors.push(`Interruption ${n}: revised limit cannot be below overs already used.`);
      if (errors.length && (usedBalls > previousBalls || (!item.ended && resumeBalls > previousBalls))) return;

      const remainingBefore = previousBalls - usedBalls;
      const remainingAfter = item.ended ? 0 : resumeBalls - usedBalls;
      const before = resource(tableKey, remainingBefore, wickets);
      const after = resource(tableKey, remainingAfter, wickets);
      const lost = Math.max(0, before - after);
      resources = Math.max(0, resources - lost);
      totalOvers = item.ended ? usedBalls / 6 : resumeBalls / 6;
      steps.push({
        label: `Interruption ${n}: ${oversLabel(usedBalls)} overs used, ${wickets} wicket${wickets === 1 ? "" : "s"} down`,
        value: `${before.toFixed(1)}% left → ${after.toFixed(1)}% left`
      });
      steps.push({ label: `Resource lost in interruption ${n}`, value: `${lost.toFixed(1)}%` });
    });
    return { errors, steps, startBalls, totalOvers, resources };
  };

  const parRaw = (g50, score1, r1, r2) => {
    if (!Number.isFinite(r1) || r1 <= 0) return null;
    if (r2 <= r1) return (score1 * r2) / r1;
    return score1 + (g50 * (r2 - r1)) / 100;
  };

  const compute = (input) => {
    const errors = [];
    const notes = [];
    const formatKey = input.format === "custom" ? "odi" : input.format;
    const format = FORMATS[formatKey] || FORMATS.odi;
    const customOvers = formatKey === "odi" && input.format === "custom" ? num(input.customOvers) : null;
    const maxOvers = input.format === "custom" ? customOvers : format.overs;
    if (input.format === "custom" && (!Number.isFinite(customOvers) || customOvers < 5 || customOvers > 50)) {
      errors.push("Custom overs must be between 5 and 50.");
    }
    const g50 = num(input.g50);
    if (g50 === null || g50 <= 0) errors.push("G50 must be a positive number.");

    const team1Input = input.team1 || {};
    const team2Input = input.team2 || {};
    const score1 = num(team1Input.score);
    if (score1 === null || score1 < 0) errors.push("Team 1 score must be zero or more.");

    const team1 = parseInterruptions(format.table, team1Input.startOvers, team1Input.interruptions);
    errors.push(...team1.errors);
    const team2 = parseInterruptions(format.table, team2Input.startOvers, team2Input.interruptions);
    errors.push(...team2.errors);

    const r1 = team1.resources;
    const r2 = team2.resources;
    if (r1 <= 0) errors.push("Team 1 has no resources left. Check the innings start and interruptions.");
    if (r2 <= 0) errors.push("Team 2 has no resources left. Check the chase start and interruptions.");

    const par = errors.length ? null : parRaw(g50, score1, r1, r2);
    if (!errors.length && par === null) errors.push("Could not calculate a par score from these inputs.");
    const target = par === null ? null : Math.floor(par + 1e-9) + 1;
    const tie = par === null ? null : Math.floor(par + 1e-9);

    let live = null;
    const currentScore = num(team2Input.currentScore);
    const currentOversBalls = ballsFromOvers(team2Input.currentOvers);
    const currentWickets = num(team2Input.currentWickets);
    const liveProvided = String(team2Input.currentScore ?? "").trim() !== "" || String(team2Input.currentOvers ?? "").trim() !== "";
    if (liveProvided) {
      if (currentScore === null || currentScore < 0) errors.push("Current chase score must be zero or more.");
      if (currentOversBalls === null) errors.push("Current overs must look like 12.3.");
      if (currentWickets === null || !Number.isInteger(currentWickets) || currentWickets < 0 || currentWickets > 10) {
        errors.push("Current wickets must be between 0 and 10.");
      }
      if (r2 <= 0 || team2.totalOvers === null) {
        errors.push("Cannot calculate the live par without a valid chase innings.");
      } else if (currentOversBalls !== null && currentWickets !== null) {
        const totalBalls = Math.round(team2.totalOvers * 6);
        if (currentOversBalls > totalBalls) errors.push("Overs completed cannot exceed the chase's overs limit.");
        const remainingBalls = Math.max(0, totalBalls - currentOversBalls);
        const resourcesUsed = Math.max(0, r2 - resource(format.table, remainingBalls, currentWickets));
        const liveParRaw = parRaw(g50, score1, r1, resourcesUsed);
        const finished = currentOversBalls >= totalBalls || currentWickets >= 10;
        const parNow = liveParRaw === null ? null : Math.floor(liveParRaw + 1e-9);
        const status = parNow === null ? "—" : currentScore > parNow ? (finished ? "Won" : "Ahead of par") : currentScore === parNow ? (finished ? "Tied" : "Level with par") : (finished ? "Lost" : "Behind par");
        live = {
          score: currentScore,
          wickets: currentWickets,
          oversBalls: currentOversBalls,
          remainingBalls,
          resourcesUsed,
          resourcesLeft: Math.max(0, r2 - resourcesUsed),
          parRaw: liveParRaw,
          par: parNow,
          finished,
          status,
          runsAhead: parNow === null ? null : currentScore - parNow,
          minimumWarn: !finished && currentOversBalls / 6 < Math.min(format.minOvers, maxOvers),
          minimumOvers: Math.min(format.minOvers, maxOvers)
        };
      }
    }

    if (!errors.length) {
      notes.push("This is a Standard Edition estimate. Official ICC DLS results use the Professional Edition software.");
      if (r2 > r1) notes.push("Team 2 has more resources than Team 1, so the G50 term is used in the par formula.");
      if (input.format === "custom") notes.push(`Custom match: ${maxOvers} overs, using the ODI resource table.`);
      if (team1.steps.length > 1 || team2.steps.length > 1) notes.push("Resources are recalculated at each stoppage, in the order entered.");
    }

    return {
      ok: errors.length === 0,
      errors,
      notes,
      format: input.format || "odi",
      formatLabel: input.format === "custom" ? `${maxOvers}-over match` : format.label,
      maxOvers,
      g50,
      team1: {
        score: score1,
        startBalls: team1.startBalls,
        totalOvers: team1.totalOvers,
        resources: r1,
        startResources: team1.startBalls === null ? null : resource(format.table, team1.startBalls, 0),
        steps: team1.steps
      },
      team2: {
        startBalls: team2.startBalls,
        totalOvers: team2.totalOvers,
        resources: r2,
        startResources: team2.startBalls === null ? null : resource(format.table, team2.startBalls, 0),
        steps: team2.steps
      },
      par,
      parLabel: par === null ? null : par.toFixed(2),
      target,
      tie,
      mode: par === null ? null : r2 <= r1 ? "standard" : "g50",
      live
    };
  };

  return { FORMATS, ballsFromOvers, oversLabel, resource, parRaw, compute };
})();
