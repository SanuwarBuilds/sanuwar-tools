"use strict";
(() => {
  const library = document.querySelector(".video-library");
  if (!library) return;
  const storageKey = "sanuwartools-eduhelp-study";
  const videoId = /^[A-Za-z0-9_-]{11}$/;
  const watchUrl = (id) => "https://www.youtube.com/watch?v=" + id;
  const study = { completed: new Set(), preferred: "", last: null };
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (Array.isArray(saved?.completed)) study.completed = new Set(saved.completed.filter(id => videoId.test(id)));
    if (typeof saved?.preferred === "string") study.preferred = saved.preferred;
    if (typeof saved?.last?.title === "string" && typeof saved.last.url === "string") study.last = saved.last;
  } catch {}

  const resume = library.querySelector("[data-video-resume]");
  function renderResume() {
    if (!study.last || !resume) return;
    let url;
    try {
      url = new URL(study.last.url, location.origin);
    } catch {
      return;
    }
    if (url.origin !== location.origin || url.pathname !== "/eduhelp/videos") return;
    resume.querySelector("[data-video-resume-label]").textContent = study.last.title;
    resume.querySelector("[data-video-resume-link]").href = url.href;
    resume.hidden = false;
  }

  function save() {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ ...study, completed: [...study.completed] }));
    } catch {}
  }

  function remember(title, url) {
    study.last = { title, url };
    save();
    renderResume();
  }

  function player(id, title) {
    const iframe = document.createElement("iframe");
    iframe.title = title;
    iframe.src = "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1";
    iframe.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    return iframe;
  }

  function directClick(event) {
    return !event.defaultPrevented && event.button === 0 &&
      !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
  }

  renderResume();
  const dialog = document.querySelector(".video-dialog");
  if (typeof dialog?.showModal === "function") {
    const frame = dialog.querySelector(".video-frame");
    const heading = dialog.querySelector("#video-player-title");
    const watch = dialog.querySelector(".video-watch");
    let opener;
    library.addEventListener("click", (event) => {
      const link = event.target.closest(".video-card a[href*='youtube.com/watch']");
      if (!link || !directClick(event)) return;
      const card = link.closest(".video-card");
      remember(card.dataset.studyTitle, card.dataset.studyUrl);
      const id = link.dataset.videoId;
      if (!videoId.test(id)) return;
      event.preventDefault();
      opener = link;
      heading.textContent = link.dataset.videoTitle;
      watch.href = link.href;
      frame.replaceChildren(player(id, link.dataset.videoTitle));
      dialog.showModal();
    });
    dialog.addEventListener("close", () => {
      frame.replaceChildren();
      opener?.focus();
    });
  }

  const studio = library.querySelector("[data-chapter-studio]");
  if (!studio) return;
  const frame = studio.querySelector("[data-chapter-frame]");
  const poster = studio.querySelector("[data-chapter-play]");
  const heading = studio.querySelector("[data-chapter-title]");
  const language = studio.querySelector("[data-chapter-language]");
  const channel = studio.querySelector("[data-chapter-channel]");
  const youtube = studio.querySelector("[data-chapter-youtube]");
  const complete = studio.querySelector("[data-video-complete]");
  const progress = studio.querySelector("[data-chapter-progress]");
  const preference = studio.querySelector("[data-video-language]");
  const queue = studio.querySelector(".chapter-lesson-list");
  const lessons = [...queue.querySelectorAll("[data-chapter-lesson]")];
  let active = queue.querySelector("[aria-current=true]");

  function renderProgress() {
    let done = 0;
    for (const lesson of lessons) {
      const completed = study.completed.has(lesson.dataset.chapterLesson);
      lesson.querySelector("[data-lesson-completed]").hidden = !completed;
      if (completed) done += 1;
    }
    const currentDone = study.completed.has(active.dataset.chapterLesson);
    complete.setAttribute("aria-pressed", String(currentDone));
    complete.textContent = currentDone ? "Completed" : "Mark complete";
    progress.textContent = `${done} of ${lessons.length} completed`;
  }

  function selectLesson(lesson) {
    active.removeAttribute("aria-current");
    active = lesson;
    active.setAttribute("aria-current", "true");
    const { chapterLesson: id, title, language: medium, channel: source } = active.dataset;
    heading.textContent = title;
    language.textContent = medium || "Language unlisted";
    channel.textContent = source;
    youtube.href = watchUrl(id);
    poster.href = watchUrl(id);
    poster.setAttribute("aria-label", "Play " + title);
    poster.querySelector("img").src = "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg";
    frame.replaceChildren(poster);
    renderProgress();
  }

  function play() {
    const { chapterLesson: id, title } = active.dataset;
    remember(title, active.href);
    if (active.hasAttribute("data-external-only") || !videoId.test(id)) return false;
    frame.replaceChildren(player(id, title));
    return true;
  }

  function orderByPreference() {
    const medium = preference.value;
    const ordered = medium
      ? [...lessons.filter(lesson => lesson.dataset.language === medium),
         ...lessons.filter(lesson => lesson.dataset.language !== medium)]
      : lessons;
    for (const lesson of ordered) queue.append(lesson.parentElement);
    return ordered[0];
  }

  if ([...preference.options].some(option => option.value === study.preferred)) {
    preference.value = study.preferred;
  }
  preference.closest("[data-language-setting]").hidden = false;
  const first = orderByPreference();
  if (!studio.hasAttribute("data-explicit-lesson") && first !== active) selectLesson(first);
  complete.hidden = false;
  renderProgress();

  preference.addEventListener("change", () => {
    study.preferred = preference.value;
    save();
    const preferred = orderByPreference();
    if (!frame.querySelector("iframe") && preferred !== active && preference.value &&
        preferred.dataset.language === preference.value) selectLesson(preferred);
  });
  complete.addEventListener("click", () => {
    const id = active.dataset.chapterLesson;
    if (study.completed.has(id)) study.completed.delete(id);
    else study.completed.add(id);
    remember(active.dataset.title, active.href);
    renderProgress();
  });
  poster.addEventListener("click", (event) => {
    if (directClick(event) && play()) {
      event.preventDefault();
      frame.querySelector("iframe").focus();
    }
  });
  youtube.addEventListener("click", () => remember(active.dataset.title, active.href));
  queue.addEventListener("click", (event) => {
    const lesson = event.target.closest("[data-chapter-lesson]");
    if (!lesson || !directClick(event)) return;
    event.preventDefault();
    selectLesson(lesson);
    history.replaceState(history.state, "", lesson.href);
    if (!play()) window.open(watchUrl(lesson.dataset.chapterLesson), "_blank", "noopener,noreferrer");
    heading.focus({ preventScroll: true });
    studio.querySelector("[data-chapter-watch]").scrollIntoView({ block: "nearest" });
  });
})();
