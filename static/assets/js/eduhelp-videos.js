"use strict";
(() => {
  const library = document.querySelector(".video-library");
  const dialog = document.querySelector(".video-dialog");
  if (!library || typeof dialog?.showModal !== "function") return;
  const frame = dialog.querySelector(".video-frame");
  const heading = dialog.querySelector("#video-player-title");
  const watch = dialog.querySelector(".video-watch");
  let opener;
  library.addEventListener("click", (event) => {
    const link = event.target.closest("a[data-video-id]");
    if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const id = link.dataset.videoId;
    if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return;
    event.preventDefault();
    opener = link;
    heading.textContent = link.dataset.videoTitle;
    watch.href = link.href;
    const player = document.createElement("iframe");
    player.title = link.dataset.videoTitle;
    player.src = "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1";
    player.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
    player.allowFullscreen = true;
    player.referrerPolicy = "strict-origin-when-cross-origin";
    frame.replaceChildren(player);
    dialog.showModal();
  });
  dialog.addEventListener("close", () => {
    frame.replaceChildren();
    opener?.focus();
  });
})();
