"use strict";
(() => {
  const T = window.SANU_TOOLS;
  const { el, panel, input, field, button, actions } = T;
  const storeKey = "sanuwartools:study-planner:v1";
  const dateKey = (date = new Date()) => [
    date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0"),
  ].join("-");
  const dayNumber = (value) => Date.parse(value + "T00:00:00Z") / 86400000;
  const dateFromDay = (day) => new Date(day * 86400000).toISOString().slice(0, 10);
  const displayDate = (value) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" })
    .format(new Date(value + "T00:00:00Z"));

  T.register("study-timer-revision-planner", (root) => {
    const defaults = {
      exam: "", tasks: [], sessions: {}, durations: { focus: 25, break: 5 },
      timer: { mode: "focus", remaining: 25 * 60_000, deadline: null },
    };
    let state = defaults;
    try {
      const saved = JSON.parse(localStorage.getItem(storeKey));
      if (saved && Array.isArray(saved.tasks)) state = { ...defaults, ...saved };
    } catch {}

    const storageStatus = el("p", { class: "fw-status", role: "status" });
    const timerNotice = el("p", { class: "fw-status", role: "status" });
    const timerDisplay = el("div", { class: "fw-clock", role: "timer", "aria-label": "Time remaining" });
    const focusCount = el("p", { class: "tp-hint" });
    const planNotice = el("p", { class: "fw-status", role: "status" });
    const examStatus = el("p", { class: "fw-status", role: "status" });
    const progressLabel = el("p", { class: "tp-hint", role: "status" });
    const progress = el("progress", { class: "fw-progress", max: 1, value: 0, "aria-label": "Chapter targets completed" });
    const taskList = el("div", { class: "fw-target-groups" });
    const targetsDate = input({ type: "date", required: true, value: dateKey() });
    const chapter = input({ required: true, maxlength: 160, placeholder: "e.g. Physics · Current Electricity" });
    const examDate = input({ type: "date", value: state.exam });
    const duration = input({ type: "number", required: true, min: 1, max: 180 });
    const durationField = field("Focus minutes", duration);
    const persist = () => {
      try {
        localStorage.setItem(storeKey, JSON.stringify(state));
      } catch {
        storageStatus.textContent = "Browser storage is unavailable. Progress will last until you close this page.";
      }
    };
    const durationMs = () => state.durations[state.timer.mode] * 60_000;

    const renderCountdown = () => {
      const timer = state.timer;
      if (timer.deadline !== null && timer.deadline <= Date.now()) {
        if (timer.mode === "focus") {
          const day = dateKey(new Date(timer.deadline));
          state.sessions[day] = (state.sessions[day] || 0) + 1;
        }
        timerNotice.textContent = timer.mode === "focus" ? "Focus session complete. Take a break when ready." : "Break complete.";
        timer.deadline = null;
        timer.remaining = durationMs();
        persist();
      }
      const seconds = Math.ceil((timer.deadline === null ? timer.remaining : Math.max(0, timer.deadline - Date.now())) / 1000);
      const shown = String(Math.floor(seconds / 60)).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");
      if (timerDisplay.textContent !== shown) timerDisplay.textContent = shown;
      const sessions = state.sessions[dateKey()] || 0;
      const sessionText = sessions + (sessions === 1 ? " focus session completed today." : " focus sessions completed today.");
      if (focusCount.textContent !== sessionText) focusCount.textContent = sessionText;
      const running = timer.deadline !== null;
      const timerAction = running ? "Pause" : "Start";
      if (start.textContent !== timerAction) start.textContent = timerAction;
      if (duration.disabled !== running) duration.disabled = running;
    };

    const start = button("Start", () => {
      if (!duration.reportValidity()) return;
      const timer = state.timer;
      if (timer.deadline !== null) {
        timer.remaining = Math.max(0, timer.deadline - Date.now());
        timer.deadline = null;
      } else {
        saveDuration();
        timer.deadline = Date.now() + (timer.remaining || durationMs());
      }
      timerNotice.textContent = "";
      persist();
      renderCountdown();
    });
    const reset = button("Reset", () => {
      state.timer.deadline = null;
      state.timer.remaining = durationMs();
      duration.value = state.durations[state.timer.mode];
      timerNotice.textContent = "";
      persist();
      renderCountdown();
    }, "ghost");
    const modes = ["focus", "break"].map((mode) => button(mode === "focus" ? "Focus" : "Break", () => {
      if (mode === state.timer.mode) return;
      state.timer.mode = mode;
      state.timer.deadline = null;
      state.timer.remaining = durationMs();
      timerNotice.textContent = "";
      persist();
      renderMode();
    }, "ghost", { "aria-pressed": "false" }));

    function saveDuration() {
      if (!duration.checkValidity()) return;
      const minutes = Number(duration.value);
      if (state.durations[state.timer.mode] !== minutes) {
        state.durations[state.timer.mode] = minutes;
        state.timer.remaining = durationMs();
        persist();
      }
    }

    function renderMode() {
      const focus = state.timer.mode === "focus";
      durationField.querySelector(".tp-label").textContent = focus ? "Focus minutes" : "Break minutes";
      duration.value = state.durations[state.timer.mode];
      modes[0].setAttribute("aria-pressed", String(focus));
      modes[1].setAttribute("aria-pressed", String(!focus));
      renderCountdown();
    }

    duration.addEventListener("change", () => { saveDuration(); renderCountdown(); });
    const renderExam = () => {
      if (!state.exam) { examStatus.textContent = ""; return; }
      const days = dayNumber(state.exam) - dayNumber(dateKey());
      examStatus.textContent = days > 0 ? days + (days === 1 ? " day until your exam." : " days until your exam.")
        : days === 0 ? "Exam day is today." : "Exam date has passed.";
    };
    examDate.addEventListener("change", () => {
      state.exam = examDate.value;
      persist();
      renderExam();
    });

    function renderTargets() {
      const done = state.tasks.filter((task) => task.done).length;
      progress.max = state.tasks.length || 1;
      progress.value = done;
      progressLabel.textContent = done + " of " + state.tasks.length + " chapter targets completed.";
      const groups = new Map();
      for (const task of [...state.tasks].sort((first, second) => first.date.localeCompare(second.date))) {
        if (!groups.has(task.date)) groups.set(task.date, []);
        groups.get(task.date).push(task);
      }
      const today = dateKey();
      const sections = [...groups].map(([day, tasks]) => {
        const list = el("ul", { class: "fw-list" }, tasks.map((task) => {
          const checkbox = el("input", { type: "checkbox", checked: task.done });
          checkbox.addEventListener("change", () => {
            task.done = checkbox.checked;
            persist();
            renderTargets();
            taskList.querySelector("[data-task='" + task.id + "']")?.focus();
          });
          checkbox.setAttribute("data-task", task.id);
          const remove = button("Remove", () => {
            state.tasks = state.tasks.filter((item) => item.id !== task.id);
            persist();
            renderTargets();
            chapter.focus();
          }, "ghost", { "aria-label": "Remove " + task.chapter });
          const date = input({ type: "date", "aria-label": "Reschedule " + task.chapter, value: task.date });
          date.addEventListener("change", () => {
            if (!date.value) { date.value = task.date; return; }
            task.date = date.value;
            planNotice.textContent = task.chapter + " moved to " + displayDate(task.date) + ".";
            persist();
            renderTargets();
            taskList.querySelector("[data-task='" + task.id + "']")?.focus();
          });
          return el("li", { class: "fw-list-row" }, el("label", { class: "fw-check" }, checkbox, task.chapter),
            el("div", { class: "fw-reschedule" }, date, remove));
        }));
        const label = day === today ? "Today · " : day < today && tasks.some((task) => !task.done) ? "Overdue · " : "";
        return el("section", { class: "fw-target-day" }, el("h3", { text: label + displayDate(day) }), list);
      });
      taskList.replaceChildren(...sections);
      moveOverdue.disabled = !state.tasks.some((task) => !task.done && task.date < today);
    }

    const add = el("form", {},
      el("div", { class: "fw-grid" }, field("Study date", targetsDate), field("Chapter or topic", chapter)),
      actions(el("button", { type: "submit", class: "tp-btn tp-btn-primary" }, "Add target")));
    add.addEventListener("submit", (event) => {
      event.preventDefault();
      const text = chapter.value.trim();
      if (!text) { chapter.focus(); return; }
      state.tasks.push({ id: crypto.randomUUID(), date: targetsDate.value, chapter: text, done: false });
      persist();
      chapter.value = "";
      renderTargets();
      chapter.focus();
    });

    const topics = el("textarea", { class: "tp-textarea", rows: 4, maxlength: 5000, required: true,
      placeholder: "Electricity\nCarbon and its Compounds" });
    const batch = el("form", {},
      field("Pending chapters, one per line", topics, "New chapters are spread from today through the day before your exam."),
      actions(el("button", { type: "submit", class: "tp-btn tp-btn-primary" }, "Build daily plan")));
    batch.addEventListener("submit", (event) => {
      event.preventDefault();
      const first = dayNumber(dateKey());
      const days = dayNumber(state.exam) - first;
      if (!Number.isFinite(days) || days < 1) {
        planNotice.textContent = "Choose a future exam date before building a daily plan.";
        examDate.focus();
        return;
      }
      const seen = new Set(state.tasks.map((task) => task.chapter.toLowerCase()));
      const pending = [];
      for (const line of topics.value.split(/\r?\n/)) {
        const name = line.trim().slice(0, 160);
        const key = name.toLowerCase();
        if (!name || seen.has(key)) continue;
        seen.add(key);
        pending.push(name);
      }
      if (!pending.length) {
        planNotice.textContent = "Add at least one new chapter.";
        return;
      }
      if (pending.length > 60) {
        planNotice.textContent = "Enter up to 60 new chapters at a time.";
        return;
      }
      pending.forEach((name, index) => {
        const offset = pending.length === 1 ? 0 : Math.floor(index * (days - 1) / (pending.length - 1));
        state.tasks.push({ id: crypto.randomUUID(), date: dateFromDay(first + offset), chapter: name, done: false });
      });
      topics.value = "";
      planNotice.textContent = pending.length + (pending.length === 1 ? " chapter scheduled." : " chapters scheduled.");
      persist();
      renderTargets();
    });

    const moveOverdue = button("Move overdue to today", () => {
      const today = dateKey();
      const overdue = state.tasks.filter((task) => !task.done && task.date < today);
      overdue.forEach((task) => { task.date = today; });
      planNotice.textContent = overdue.length + (overdue.length === 1 ? " target moved to today." : " targets moved to today.");
      persist();
      renderTargets();
    }, "ghost");

    root.replaceChildren(
      panel("Study timer", [actions(...modes), timerDisplay, durationField, actions(start, reset), timerNotice, focusCount], "fw-timer-panel"),
      panel("Revision plan", [field("Exam date (optional)", examDate), examStatus, batch, add, actions(moveOverdue), planNotice, progressLabel, progress, taskList, storageStatus]),
    );
    renderMode();
    renderExam();
    renderTargets();
    let today = dateKey();
    const tick = () => {
      renderCountdown();
      if (today !== dateKey()) {
        today = dateKey();
        renderExam();
        renderTargets();
      }
    };
    const clock = setInterval(tick, 250);
    window.addEventListener("pagehide", (event) => {
      if (!event.persisted) clearInterval(clock);
    });
  });
})();
