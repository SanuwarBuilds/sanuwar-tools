"use strict";
(() => {
  const workspace = document.querySelector("[data-doubt-app]");
  if (!workspace) return;

  const language = document.querySelector("#doubt-language");
  const grade = document.querySelector("#doubt-grade");
  const ask = workspace.querySelector("[data-doubt-ask]");
  const generate = workspace.querySelector("[data-doubt-generate]");
  const question = workspace.querySelector("#doubt-question");
  const title = workspace.querySelector("#doubt-note-title");
  const notes = workspace.querySelector("#doubt-note-body");
  const transcript = workspace.querySelector("[data-doubt-transcript]");
  const examples = workspace.querySelector("[data-doubt-examples]");
  const reset = workspace.querySelector("[data-doubt-reset]");
  const download = workspace.querySelector("[data-doubt-pdf]");
  const modes = [...workspace.querySelectorAll("[data-doubt-mode]")];
  const feedback = {
    ask: workspace.querySelector('[data-doubt-feedback="ask"]'),
    notes: workspace.querySelector('[data-doubt-feedback="notes"]')
  };
  const history = [];
  const aiReady = workspace.dataset.aiReady === "true";
  let pending = false;

  try {
    if (localStorage.getItem("eduhelp-answer-language") === "as") language.value = "as";
  } catch {}
  function updateLanguage() {
    notes.lang = question.lang = title.lang = language.value;
  }
  updateLanguage();
  language.addEventListener("change", () => {
    updateLanguage();
    try {
      localStorage.setItem("eduhelp-answer-language", language.value);
    } catch {}
  });

  function openMode(mode) {
    for (const button of modes) {
      const selected = button.dataset.doubtMode === mode;
      button.setAttribute("aria-pressed", String(selected));
      document.getElementById(button.getAttribute("aria-controls")).hidden = !selected;
    }
  }

  for (const button of modes) {
    button.addEventListener("click", () => openMode(button.dataset.doubtMode));
  }
  workspace.querySelectorAll("[data-doubt-example]").forEach(button => {
    button.addEventListener("click", () => {
      question.value = button.dataset[language.value];
      question.focus();
    });
  });

  reset.addEventListener("click", () => {
    history.length = 0;
    transcript.replaceChildren();
    transcript.hidden = reset.hidden = true;
    examples.hidden = false;
    feedback.ask.textContent = "";
    question.value = "";
    question.focus();
  });

  function addToNotes(text) {
    const separator = notes.value.trim() ? "\n\n" : "";
    if (notes.value.length + separator.length + text.length > notes.maxLength) return false;
    notes.value += separator + text;
    return true;
  }

  function addMessage(role, text, locale) {
    const entry = document.createElement("article");
    entry.className = "doubt-message doubt-message--" + role;
    const heading = document.createElement("h3");
    heading.textContent = role === "question" ? "You" : "EduHelp";
    const message = document.createElement("p");
    message.lang = locale;
    message.textContent = text;
    entry.append(heading, message);
    if (role === "answer") {
      const save = document.createElement("button");
      save.type = "button";
      save.className = "doubt-link";
      save.textContent = "Add to notes";
      save.addEventListener("click", () => {
        openMode("notes");
        const added = addToNotes(text);
        if (added && !title.value) title.value = workspace.dataset.topic || "Study notes";
        feedback.notes.textContent = added ? "Answer added to your notes." : "The notes editor is full.";
        notes.focus();
      });
      entry.append(save);
    }
    transcript.append(entry);
  }

  async function submit(mode, prompt) {
    if (pending || !aiReady) return;
    const noteMode = mode === "notes";
    const output = feedback[mode];
    if (prompt.length < 2) {
      output.textContent = noteMode ? "Enter a topic to make notes." : "Enter a question to get started.";
      return;
    }
    const locale = language.value;
    pending = true;
    for (const form of [ask, generate]) form.querySelector("button[type=submit]").disabled = true;
    reset.disabled = true;
    output.textContent = noteMode ? "Writing your study notes…" : "Working on your answer…";
    const slowResponse = setTimeout(() => {
      output.textContent = noteMode ? "Still writing your notes…" : "Still working on your answer…";
    }, 8000);
    try {
      const csrf = document.querySelector('meta[name="csrf-token"]').content;
      const response = await fetch(workspace.dataset.endpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: JSON.stringify({
          mode, prompt, grade: grade.value ? Number(grade.value) : null, language: locale,
          topic: workspace.dataset.topic, history: noteMode ? [] : history.slice(-2)
        })
      });
      const data = await response.json();
      if (!response.ok || typeof data.answer !== "string") throw new Error(data.error || "No answer was returned.");
      if (noteMode) {
        const added = addToNotes(data.answer);
        output.textContent = added ? "Draft added. Edit it before exporting." : "The notes editor is full.";
      } else {
        history.push({ question: prompt, answer: data.answer.slice(0, 4500) });
        if (history.length > 2) history.shift();
        transcript.hidden = reset.hidden = false;
        examples.hidden = true;
        addMessage("question", prompt, locale);
        addMessage("answer", data.answer, locale);
        transcript.scrollTop = transcript.scrollHeight;
        if (question.value.trim() === prompt) question.value = "";
        output.textContent = "";
      }
    } catch (error) {
      output.textContent = error instanceof SyntaxError ? "The AI is temporarily unavailable." : error.message;
    } finally {
      clearTimeout(slowResponse);
      pending = false;
      for (const form of [ask, generate]) form.querySelector("button[type=submit]").disabled = false;
      reset.disabled = false;
    }
  }

  ask.addEventListener("submit", event => {
    event.preventDefault();
    submit("ask", question.value.trim());
  });
  generate.addEventListener("submit", event => {
    event.preventDefault();
    submit("notes", title.value.trim());
  });

  const fontFamily = '"EduHelp Assamese", Arial, sans-serif';
  const segmenter = typeof Intl.Segmenter === "function" ? new Intl.Segmenter("as", { granularity: "grapheme" }) : null;

  function wrapLines(ctx, text, availableWidth) {
    const lines = [];
    for (const paragraph of text.split(/\r?\n/)) {
      let line = "";
      for (const word of paragraph.trim().split(/\s+/)) {
        const candidate = line ? line + " " + word : word;
        if (ctx.measureText(candidate).width <= availableWidth) {
          line = candidate;
          continue;
        }
        if (line) lines.push(line);
        line = "";
        const characters = segmenter ? Array.from(segmenter.segment(word), item => item.segment) : Array.from(word);
        for (const character of characters) {
          if (line && ctx.measureText(line + character).width > availableWidth) {
            lines.push(line);
            line = "";
          }
          line += character;
        }
      }
      lines.push(line);
    }
    return lines;
  }

  async function createPdf(noteTitle, noteText) {
    const { jsPDF } = window.jspdf;
    const sample = (noteTitle + noteText).match(/[\u0980-\u09FF]/u)?.[0];
    if (sample) {
      const loaded = await document.fonts.load('18px "EduHelp Assamese"', sample);
      if (!loaded.length) throw new Error("Assamese font is unavailable.");
    }
    // Canvas uses the browser’s Indic text shaping for Assamese glyphs and conjuncts.
    const pdf = new jsPDF({ unit: "pt", format: "a4", compress: true });
    const width = pdf.internal.pageSize.getWidth();
    const height = pdf.internal.pageSize.getHeight();
    const margin = 48;
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(width * 2);
    canvas.height = Math.ceil(height * 2);
    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.scale(canvas.width / width, canvas.height / height);
    ctx.font = "600 22px " + fontFamily;
    const titleLines = wrapLines(ctx, noteTitle, width - margin * 2);
    ctx.font = "15px " + fontFamily;
    const bodyLines = wrapLines(ctx, noteText.replace(/\n{3,}/g, "\n\n"), width - margin * 2);
    const linesPerPage = Math.floor((height - 75 - 104 - titleLines.length * 28) / 21) + 1;
    if (bodyLines.length > linesPerPage * 25) {
      throw new Error("Shorten your notes or split them into multiple PDFs.");
    }
    let offset = 0;
    let page = 0;

    while (offset < bodyLines.length) {
      if (page) pdf.addPage();
      page += 1;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "#4b30b9";
      ctx.fillRect(margin, 39, 30, 4);
      ctx.font = "600 11px Arial";
      ctx.fillText("EDUHELP STUDY NOTES", margin, 62);
      ctx.fillStyle = "#241b39";
      ctx.font = "600 22px " + fontFamily;
      let y = 94;
      for (const line of titleLines) {
        ctx.fillText(line, margin, y);
        y += 28;
      }
      y += 10;
      ctx.fillStyle = "#2e2937";
      ctx.font = "15px " + fontFamily;
      while (offset < bodyLines.length && y <= height - 75) {
        ctx.fillText(bodyLines[offset], margin, y);
        offset += 1;
        y += 21;
      }
      ctx.fillStyle = "#635978";
      ctx.font = "11px Arial";
      ctx.fillText("EduHelp  /  SanuwarTools", margin, height - 38);
      ctx.textAlign = "right";
      ctx.fillText(String(page), width - margin, height - 38);
      ctx.textAlign = "left";
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.93), "JPEG", 0, 0, width, height);
    }
    pdf.setProperties({ title: noteTitle, creator: "EduHelp" });
    const filename = noteTitle.replace(/[^\p{L}\p{M}\p{N}_.-]+/gu, "-").replace(/^-+|-+$/g, "");
    pdf.save((filename || "eduhelp-notes") + ".pdf");
  }

  download.addEventListener("click", async () => {
    if (!notes.value.trim()) {
      feedback.notes.textContent = "Write or generate some notes first.";
      notes.focus();
      return;
    }
    download.disabled = true;
    feedback.notes.textContent = "Preparing PDF…";
    try {
      await createPdf(title.value.trim() || "Study notes", notes.value.trim());
      feedback.notes.textContent = "PDF ready.";
    } catch (error) {
      feedback.notes.textContent = error.message === "Shorten your notes or split them into multiple PDFs."
        ? error.message : "The PDF could not be created. Your notes are still here.";
    } finally {
      download.disabled = false;
    }
  });
})();
