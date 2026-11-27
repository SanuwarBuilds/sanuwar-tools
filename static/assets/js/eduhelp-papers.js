"use strict";
(() => {
  const panel = document.querySelector("[data-paper-practice]");
  const clock = panel.querySelector("[role=timer]");
  const minutes = panel.querySelector("[name=minutes]");
  const toggle = panel.querySelector("[data-paper-toggle]");
  const reset = panel.querySelector("[data-paper-reset]");
  const status = panel.querySelector("[data-paper-status]");
  let deadline = null;
  let remaining = null;
  const draw = () => {
    if (deadline !== null) {
      remaining = Math.max(0, deadline - Date.now());
      if (!remaining) {
        deadline = null;
        status.textContent = "Time is up. Compare your answers and enter your marks below.";
      }
    }
    const seconds = Math.ceil((remaining ?? Number(minutes.value) * 60_000) / 1000);
    const next = Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
    if (clock.textContent !== next) clock.textContent = next;
    toggle.textContent = deadline !== null ? "Pause" : remaining ? "Resume" : "Start";
    minutes.disabled = deadline !== null;
  };
  toggle.addEventListener("click", () => {
    if (deadline !== null) {
      remaining = Math.max(0, deadline - Date.now());
      deadline = null;
    } else {
      if (!minutes.reportValidity()) return;
      remaining ||= Number(minutes.value) * 60_000;
      deadline = Date.now() + remaining;
      status.textContent = "";
    }
    draw();
  });
  const clear = () => { remaining = null; deadline = null; status.textContent = ""; draw(); };
  minutes.addEventListener("input", clear);
  reset.addEventListener("click", clear);
  const score = panel.querySelector("[data-paper-score]");
  const result = panel.querySelector("[data-paper-result]");
  score.addEventListener("input", () => { result.textContent = ""; });
  score.addEventListener("submit", (event) => {
    event.preventDefault();
    const points = new FormData(score);
    const earned = Number(points.get("earned"));
    const total = Number(points.get("total"));
    result.textContent = earned <= total ? earned + " / " + total + " · " + Math.round(100 * earned / total) + "%"
      : "Marks earned must be less than or equal to total marks.";
  });
  setInterval(() => { if (deadline !== null) draw(); }, 250);
  draw();
})();
