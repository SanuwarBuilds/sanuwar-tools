"use strict";
(() => {
  const data = document.querySelector("#edu-chapter-data");
  if (!data) return;
  const chapter = JSON.parse(data.textContent);
  const root = document.querySelector("#edu-resource");
  const get = (selector) => root.querySelector(selector);
  const node = (tag, text = "") => {
    const element = document.createElement(tag);
    element.textContent = text;
    return element;
  };

  for (const button of root.querySelectorAll("[data-edu-print]")) {
    button.addEventListener("click", () => {
      document.body.dataset.eduPrint = button.dataset.eduPrint;
      window.print();
    });
  }
  window.addEventListener("afterprint", () => { delete document.body.dataset.eduPrint; });

  get("[data-edu-experiment]").addEventListener("submit", (event) => {
    event.preventDefault();
    const choice = Number(new FormData(event.currentTarget).get("prediction"));
    const prompt = chapter.experiment;
    const response = choice === prompt.correct ? "Correct. " : "Expected result: " + prompt.options[prompt.correct] + ". ";
    get("[data-edu-observation]").textContent = response + prompt.explanation;
  });

  const quizForm = get("[data-quiz-form]");
  const quizResult = get("[data-quiz-result]");
  const quizTime = get("[data-quiz-time]");
  let timer;
  let deadline;
  let active = false;
  function renderQuestion(question, index, interactive) {
    const element = node(interactive ? "fieldset" : "div");
    element.className = "edu-question";
    const heading = node(interactive ? "legend" : "h3", (index + 1) + ". " + question.prompt + " (" + question.marks + " " + (question.marks === 1 ? "mark" : "marks") + ")");
    element.append(heading);
    if (interactive) {
      question.options.forEach((option, number) => {
        const label = node("label");
        label.className = "edu-choice";
        const radio = node("input");
        radio.type = "radio";
        radio.name = "answer-" + index;
        radio.value = String(number);
        label.append(radio, " " + option);
        element.append(label);
      });
    } else {
      const list = node("ol");
      list.type = "A";
      list.append(...question.options.map((option) => node("li", option)));
      element.append(list);
    }
    return element;
  }

  function finishQuiz(expired = false) {
    if (!active) return;
    active = false;
    clearInterval(timer);
    const answers = new FormData(quizForm);
    const topics = new Set();
    let marks = 0;
    const review = node("ol");
    review.className = "edu-review";
    chapter.questions.forEach((question, index) => {
      const value = answers.get("answer-" + index);
      const correct = value === String(question.correct);
      if (correct) marks += question.marks;
      else topics.add(question.topic);
      const item = node("li");
      item.append(node("strong", question.prompt), node("p",
        (correct ? "Correct" : value === null ? "Unanswered" : "Incorrect") +
        " · Answer: " + question.options[question.correct] + ". " + question.explanation));
      review.append(item);
    });
    const total = chapter.questions.reduce((sum, question) => sum + question.marks, 0);
    quizForm.hidden = quizTime.hidden = true;
    quizResult.replaceChildren(
      node("h3", (expired ? "Time is up · " : "Score · ") + marks + " / " + total),
      node("p", topics.size ? "Review: " + [...topics].join(", ") : "All topics answered correctly."),
      review,
    );
    quizResult.hidden = false;
    quizResult.focus();
    for (const start of root.querySelectorAll("[data-quiz-start]")) start.disabled = false;
  }

  function tick() {
    const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    quizTime.textContent = Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0") + " remaining";
    if (!seconds) finishQuiz(true);
  }

  for (const button of root.querySelectorAll("[data-quiz-start]")) {
    button.addEventListener("click", () => {
      for (const start of root.querySelectorAll("[data-quiz-start]")) start.disabled = true;
      const submit = node("button", "Check answers");
      submit.type = "submit";
      submit.className = "button button-dark";
      quizForm.replaceChildren(...chapter.questions.map((question, index) => renderQuestion(question, index, true)), submit);
      quizResult.replaceChildren();
      quizResult.hidden = true;
      quizForm.hidden = false;
      active = true;
      quizTime.hidden = !button.hasAttribute("data-timed");
      if (!quizTime.hidden) {
        deadline = Date.now() + 15 * 60_000;
        tick();
        timer = setInterval(tick, 250);
      }
      quizForm.querySelector("input").focus();
    });
  }
  quizForm.addEventListener("submit", (event) => { event.preventDefault(); finishQuiz(!quizTime.hidden && Date.now() >= deadline); });

  const cards = chapter.questions;
  const flashKey = "sanuwartools:edu-cards:" + location.pathname.split("/").pop();
  const memory = new Set();
  try {
    const saved = JSON.parse(localStorage.getItem(flashKey));
    if (Array.isArray(saved)) saved.forEach((entry) => memory.add(entry));
  } catch {}
  let deck;
  let next;
  const cardQuestion = get("[data-card-question]");
  const cardAnswer = get("[data-card-answer]");
  const cardProgress = get("[data-card-progress]");
  const reveal = get("[data-card-reveal]");
  const restart = get("[data-card-restart]");
  const grades = root.querySelectorAll("[data-card-grade]");
  function drawCard() {
    const card = deck[next];
    cardQuestion.textContent = card?.prompt || "Round complete";
    cardProgress.textContent = card ? "Card " + (next + 1) + " of " + deck.length : memory.size + " cards marked for another review";
    cardAnswer.textContent = card ? card.options[card.correct] + " · " + card.explanation : "";
    cardAnswer.hidden = true;
    reveal.hidden = !card;
    restart.hidden = Boolean(card);
    grades.forEach((button) => { button.hidden = true; });
  }
  function newRound() {
    deck = [...cards].sort((first, second) => Number(memory.has(second.prompt)) - Number(memory.has(first.prompt)));
    next = 0;
    drawCard();
  }
  reveal.addEventListener("click", () => {
    cardAnswer.hidden = false;
    grades.forEach((button) => { button.hidden = false; });
    grades[0].focus();
    reveal.hidden = true;
  });
  grades.forEach((button) => button.addEventListener("click", () => {
    const id = deck[next++].prompt;
    if (button.dataset.cardGrade === "again") memory.add(id);
    else memory.delete(id);
    try { localStorage.setItem(flashKey, JSON.stringify([...memory])); } catch {}
    drawCard();
    (reveal.hidden ? restart : reveal).focus();
  }));
  restart.addEventListener("click", () => { newRound(); reveal.focus(); });
  newRound();

  function selectQuestions(questions, marks) {
    const shuffled = [...questions];
    for (let index = shuffled.length - 1; index > 0; index--) {
      const other = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
    }
    const combinations = new Map([[0, []]]);
    for (const question of shuffled) {
      for (const [total, selected] of [...combinations]) {
        const sum = total + question.marks;
        if (sum <= marks && !combinations.has(sum)) combinations.set(sum, [...selected, question]);
      }
    }
    return combinations.get(marks);
  }
  const worksheet = get("[data-edu-worksheet]");
  const paper = get("#worksheet-paper");
  const answerKey = get("#worksheet-key");
  const worksheetButtons = get("[data-worksheet-print]");
  const worksheetStatus = get("[data-worksheet-status]");
  worksheet.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(worksheet);
    const difficulty = form.get("difficulty");
    const marks = Number(form.get("marks"));
    const matching = cards.filter((question) => difficulty === "Mixed" || difficulty === question.difficulty);
    const selection = selectQuestions(matching, marks);
    paper.hidden = answerKey.hidden = worksheetButtons.hidden = !selection;
    if (!selection) {
      const maximum = matching.reduce((sum, question) => sum + question.marks, 0);
      worksheetStatus.textContent = "This difficulty cannot make exactly " + marks + " marks. Available marks: up to " + maximum +
        (difficulty === "Mixed" ? "." : " in " + difficulty + ". Try Mixed or another total.");
      return;
    }
    paper.replaceChildren(node("h2", chapter.title + " · Worksheet"), node("p", "Name: ____________________   Date: __________   Total: " + marks + " marks"),
      ...selection.map((question, index) => renderQuestion(question, index, false)));
    const answers = node("ol");
    answers.append(...selection.map((question) => node("li", question.options[question.correct] + " — " + question.explanation)));
    answerKey.replaceChildren(node("h2", chapter.title + " · Answer key"), answers);
    worksheetStatus.textContent = selection.length + " questions · " + marks + " marks. Worksheet and answer key are ready.";
  });
})();
