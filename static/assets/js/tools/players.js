"use strict";
(() => {
  const T = window.SANU_TOOLS;
  if (!T) return;
  const { el, $ } = T;
  const SVG_NS = "http://www.w3.org/2000/svg";

  const ICONS = {
    play: { fill: true, paths: ["M8 5.1v13.8L19.2 12z"] },
    pause: { fill: true, paths: ["M7 5h3.6v14H7zM13.4 5H17v14h-3.6z"] },
    volume: { paths: ["M4 9.4v5.2h3.4L12 18.4V5.6L7.4 9.4z"] },
    muted: { paths: ["M4 9.4v5.2h3.4L12 18.4V5.6L7.4 9.4z", "M16 9.6l4.8 4.8M20.8 9.6 16 14.4"] },
    full: { paths: ["M4 9V4h5", "M20 9V4h-5", "M4 15v5h5", "M20 15v5h-5"] },
    exitfull: { paths: ["M9 4v5H4", "M15 4v5h5", "M9 20v-5H4", "M15 20v-5h5"] },
    native: { paths: ["M3.4 5.2h17.2v13.6H3.4z", "M3.4 14.6h17.2", "M6.8 17.2h3.4"] },
    pip: { paths: ["M3.6 5.6h16.8v12.8H3.6z", "M12.4 12.4h6.4v3.8h-6.4z"] },
    camera: { paths: ["M3.6 7.4h4.2L9.4 5.2h5.2l1.6 2.2h4.2v11.2H3.6z", "M12 10.2a3.1 3.1 0 1 0 0 6.2 3.1 3.1 0 0 0 0-6.2z"] },
    loop: { paths: ["M4.6 10.2A7.4 7.4 0 0 1 17 6.5", "M19.4 13.8A7.4 7.4 0 0 1 7 17.5", "M17.2 3.6v3.1h-3.1", "M6.8 20.4v-3.1h3.1"] },
    speed: { paths: ["M4 17.4a8.6 8.6 0 1 1 16 0", "M12 13.2 15.6 9", "M12 17.4a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"] },
    next: { fill: true, paths: ["M6 5.4 14.2 12 6 18.6z"], extra: [{ d: "M17 5v14", stroke: true }] },
    prev: { fill: true, paths: ["M18 5.4 9.8 12 18 18.6z"], extra: [{ d: "M7 5v14", stroke: true }] },
    shuffle: { paths: ["M4 7.2h3.4l9 9.6H20", "M4 16.8h3.4l9-9.6H20", "M17.2 4.4 20 7.2l-2.8 2.8", "M17.2 13.6l2.8 2.8-2.8 2.8"] },
    repeat: { paths: ["M4.6 11.2a7.2 7.2 0 0 1 12.2-5", "M19.4 12.8a7.2 7.2 0 0 1-12.2 5", "M17 3.6v3h-3", "M7 20.4v-3h3"] },
    captions: { paths: ["M3.6 5.6h16.8v12.8H3.6z", "M7 11h4.4", "M14 11h3", "M7 14.2h3", "M12.4 14.2H17"] },
    cloud: { paths: ["M7.4 18.4a4.4 4.4 0 0 1-.6-8.8 5.6 5.6 0 0 1 10.8 1.5 3.7 3.7 0 0 1-.7 7.3z", "M12 12v5.4", "M9.7 14.3 12 12l2.3 2.3"] },
    link: { paths: ["M10.5 13.5a3.6 3.6 0 0 0 5.1 0l2.6-2.6a3.6 3.6 0 0 0-5.1-5.1L11.6 7.3", "M13.5 10.5a3.6 3.6 0 0 0-5.1 0l-2.6 2.6a3.6 3.6 0 0 0 5.1 5.1l1.5-1.5"] },
    list: { paths: ["M4.4 6.4h1.4M4.4 12h1.4M4.4 17.6h1.4", "M9.4 6.4h10M9.4 12h10M9.4 17.6h10"] },
    upload: { paths: ["M12 16V4.8", "M7.6 9.2 12 4.8l4.4 4.4", "M4.4 15.6v3.6h15.2v-3.6"] },
    download: { paths: ["M12 4.4v11.2", "M7.6 11.2 12 15.6l4.4-4.4", "M4.4 19.2h15.2"] },
    close: { paths: ["M6 6l12 12", "M18 6 6 18"] },
    check: { paths: ["M4.8 12.4 9.6 17.2 19.2 6.8"] },
  };

  const icon = (name, size = 17) => {
    const spec = ICONS[name] || ICONS.play;
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    (spec.paths || []).forEach((d) => {
      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("d", d);
      if (spec.fill) {
        path.setAttribute("fill", "currentColor");
      } else {
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", "currentColor");
        path.setAttribute("stroke-width", "1.8");
        path.setAttribute("stroke-linecap", "round");
        path.setAttribute("stroke-linejoin", "round");
      }
      svg.append(path);
    });
    (spec.extra || []).forEach((item) => {
      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("d", item.d);
      path.setAttribute("fill", item.stroke ? "none" : "currentColor");
      if (item.stroke) {
        path.setAttribute("stroke", "currentColor");
        path.setAttribute("stroke-width", "1.8");
        path.setAttribute("stroke-linecap", "round");
      }
      svg.append(path);
    });
    return svg;
  };

  const fmtTime = (value) => {
    if (!Number.isFinite(value) || value < 0) return "0:00";
    const total = Math.floor(value);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}` : `${minutes}:${String(seconds).padStart(2, "0")}`;
  };

  const isHttpLink = (value) => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === "https:" || parsed.protocol === "http:";
    } catch {
      return false;
    }
  };

  const extensionOf = (name) => {
    const clean = String(name || "").split(/[?#]/)[0];
    const dot = clean.lastIndexOf(".");
    return dot > -1 ? clean.slice(dot + 1).toLowerCase() : "";
  };

  const guessType = (name) => {
    const ext = extensionOf(name);
    if (["mp4", "m4v", "mov"].includes(ext)) return "MP4 family";
    if (ext === "webm") return "WebM";
    if (ext === "mkv") return "Matroska";
    if (ext === "ogv" || ext === "ogg") return "Ogg";
    if (["mp3", "m4a", "aac", "wav", "flac", "oga", "opus"].includes(ext)) return ext.toUpperCase();
    if (ext === "m3u8") return "HLS playlist";
    if (ext === "mpd") return "DASH manifest";
    return ext ? ext.toUpperCase() : "Media";
  };

  const readVolume = () => {
    try {
      const stored = Number(localStorage.getItem("st.players.volume"));
      return Number.isFinite(stored) && stored >= 0 && stored <= 1 ? stored : 0.9;
    } catch {
      return 0.9;
    }
  };

  const storeVolume = (value) => {
    try {
      localStorage.setItem("st.players.volume", String(Math.round(value * 100) / 100));
    } catch {}
  };

  const readNativePref = () => {
    try {
      return localStorage.getItem("st.players.native") === "1";
    } catch {
      return false;
    }
  };

  const storeNativePref = (value) => {
    try {
      localStorage.setItem("st.players.native", value ? "1" : "0");
    } catch {}
  };

  const readCaptionStyle = () => {
    try {
      const stored = JSON.parse(localStorage.getItem("st.players.captions") || "{}");
      return {
        size: ["s", "m", "l"].includes(stored.size) ? stored.size : "m",
        background: stored.background !== false,
        position: stored.position === "top" ? "top" : "bottom",
      };
    } catch {
      return { size: "m", background: true, position: "bottom" };
    }
  };

  const storeCaptionStyle = (style) => {
    try {
      localStorage.setItem("st.players.captions", JSON.stringify(style));
    } catch {}
  };

  const stripCaption = (value) => String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim();

  const captionSeconds = (value) => {
    const match = String(value).trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:[.,](\d{1,3}))?/);
    if (!match) return null;
    return (Number(match[1]) || 0) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(`0.${match[4] || "0"}`);
  };

  const parseCaptions = (text) => {
    const source = String(text || "").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
    const cues = [];
    source.split(/\n{2,}/).forEach((block, blockIndex) => {
      const lines = block.split("\n").map(line => line.trimEnd());
      const timingIndex = lines.findIndex(line => line.includes("-->"));
      if (timingIndex < 0) return;
      const parts = lines[timingIndex].split("-->");
      if (parts.length < 2) return;
      const start = captionSeconds(parts[0]);
      const end = captionSeconds(parts[1].trim().split(/\s+/)[0]);
      const body = stripCaption(lines.slice(timingIndex + 1).join("\n"));
      if (start === null || end === null || end <= start || !body) return;
      cues.push({ key: `${blockIndex}:${start}:${end}`, start, end, text: body });
    });
    return cues.sort((a, b) => a.start - b.start);
  };

  const findCue = (cues, time) => {
    let low = 0;
    let high = cues.length - 1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      const cue = cues[mid];
      if (time < cue.start) high = mid - 1;
      else if (time > cue.end) low = mid + 1;
      else return cue;
    }
    return null;
  };

  const resolveCloudLink = (raw) => {
    const value = String(raw || "").trim();
    if (!value) return { error: "Paste a share link first." };
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;
    if (!isHttpLink(withScheme)) return { error: "Use an http or https link." };
    let url;
    try {
      url = new URL(withScheme);
    } catch {
      return { error: "That link could not be read. Check it and try again." };
    }
    const host = url.hostname.toLowerCase();
    if (/(^|\.)youtube\.com$|(^|\.)youtu\.be$|(^|\.)vimeo\.com$|(^|\.)instagram\.com$|(^|\.)facebook\.com$/.test(host)) {
      return { error: "This is a web page, not a media file. YouTube, Vimeo and social pages cannot stream directly here — use a direct media link or an authorized cloud link." };
    }
    if (host === "drive.google.com" || host.endsWith(".drive.google.com")) {
      const fileId = (url.pathname.match(/\/file\/d\/([A-Za-z0-9_-]{10,})/) || [])[1] || url.searchParams.get("id");
      if (!fileId) return { error: "Open the Drive file, choose Share, then paste the file link (it contains a file id)." };
      return {
        url: `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`,
        provider: "Google Drive",
        note: "The file must be shared with anyone who has the link. Very large Drive files may show a confirmation page instead of the video.",
      };
    }
    if (host === "www.dropbox.com" || host === "dropbox.com" || host.endsWith(".dropbox.com")) {
      url.searchParams.set("raw", "1");
      return { url: url.toString(), provider: "Dropbox", note: "The share link is switched to Dropbox's raw mode so the media file loads directly." };
    }
    if (host === "1drv.ms" || host.endsWith(".onedrive.live.com") || host === "onedrive.live.com") {
      url.searchParams.set("download", "1");
      return { url: url.toString(), provider: "OneDrive", note: "OneDrive links must allow viewing or download. Short 1drv.ms links redirect, so playback depends on the shared file permissions." };
    }
    if (host === "github.com" && url.pathname.includes("/blob/")) {
      url.hostname = "raw.githubusercontent.com";
      url.pathname = url.pathname.replace("/blob/", "/");
      return { url: url.toString(), provider: "GitHub raw", note: "The repository file link was converted to its raw media address." };
    }
    return { url: url.toString(), provider: "Direct link", note: "Direct links play only when the server allows browser streaming and cross-origin requests." };
  };

  const createPlayer = (root, config) => {
    const kind = config.kind === "audio" ? "audio" : "video";
    const state = {
      files: [],
      index: -1,
      objectUrl: "",
      hls: null,
      dash: null,
      engineLabel: "",
      cues: [],
      captionName: "",
      captionOffset: 0,
      captionStyle: readCaptionStyle(),
      volume: readVolume(),
      muted: false,
      shuffle: false,
      repeat: "off",
      analyser: null,
      audioCtx: null,
      vizData: null,
      tickRaf: 0,
      vizRaf: 0,
      live: false,
      duration: 0,
      sourceLabel: "",
      sourceType: "",
      playlist: Boolean(config.playlist),
      native: readNativePref(),
    };

    const alertBox = el("p", { class: "pl-alert", role: "status", hidden: true });
    const setAlert = (message = "", tone = "info") => {
      alertBox.hidden = !message;
      alertBox.textContent = message;
      alertBox.dataset.tone = tone;
    };

    const media = document.createElement(kind);
    media.className = "pl-media";
    media.preload = "metadata";
    media.playsInline = true;
    media.setAttribute("playsinline", "");
    if (kind === "audio") media.setAttribute("aria-label", "Audio playback");
    else media.setAttribute("aria-label", "Video playback");
    try {
      media.volume = state.volume;
    } catch {}

    const captionBox = el("div", { class: "pl-cue", "aria-live": "off" });
    const artTitle = el("strong", { class: "pl-art-title", text: "Choose audio to begin" });
    const artSub = el("span", { class: "pl-art-sub", text: "Files stay on this device" });
    const eq = el("div", { class: "pl-eq", "aria-hidden": "true" }, ...Array.from({ length: 7 }, () => el("span")));
    const canvas = el("canvas", { class: "pl-viz", "aria-hidden": "true", hidden: true });
    const artwork = el("div", { class: "pl-artwork" },
      el("span", { class: "pl-art-icon", "aria-hidden": "true" }, icon(kind === "audio" ? "list" : "play", 34)),
      el("div", { class: "pl-art-copy" }, artTitle, artSub), eq, canvas);
    const bigPlay = el("button", {
      type: "button", class: "pl-bigplay", "aria-label": "Play",
      onclick: () => { if (media.paused) attemptPlay(); else pauseMedia(); },
    }, icon("play", 26));
    const spinner = el("span", { class: "pl-spinner", hidden: true, "aria-hidden": "true" });
    const liveBadge = el("span", { class: "pl-live", hidden: true, text: "LIVE" });
    const dropVeil = el("div", { class: "pl-dropveil", hidden: true }, el("strong", { text: "Drop to play" }));

    const screen = el("div", { class: `pl-screen pl-${kind}` });
    screen.append(media, artwork, captionBox, bigPlay, spinner, liveBadge, dropVeil);

    const playButton = el("button", { type: "button", class: "pl-btn pl-btn-play", "aria-label": "Play", onclick: () => { if (media.paused) attemptPlay(); else pauseMedia(); } }, icon("play", 16));
    const prevButton = el("button", { type: "button", class: "pl-btn", "aria-label": "Previous item", onclick: () => step(-1) }, icon("prev", 15));
    const nextButton = el("button", { type: "button", class: "pl-btn", "aria-label": "Next item", onclick: () => step(1) }, icon("next", 15));
    const muteButton = el("button", { type: "button", class: "pl-btn", "aria-label": "Mute", onclick: () => toggleMute() }, icon("volume", 16));
    const volume = el("input", { type: "range", min: "0", max: "1", step: "0.01", value: String(state.volume), class: "pl-range pl-volume", "aria-label": "Volume" });
    const timeLabel = el("span", { class: "pl-time", text: "0:00 / 0:00" });
    const seek = el("input", { type: "range", min: "0", max: "1000", step: "1", value: "0", class: "pl-range pl-seek", "aria-label": "Seek" });
    const speedButton = el("button", { type: "button", class: "pl-btn pl-btn-text", "aria-label": "Playback speed", text: "1×" });
    const loopButton = el("button", { type: "button", class: "pl-btn", "aria-label": "Loop video", "aria-pressed": "false", onclick: () => toggleLoop() }, icon("loop", 16));
    const pipButton = el("button", { type: "button", class: "pl-btn", "aria-label": "Picture in picture", onclick: () => togglePip() }, icon("pip", 16));
    const nativeButton = el("button", { type: "button", class: "pl-btn", "aria-label": "Use browser controls", title: "Switch between this player and your browser's built-in controls", "aria-pressed": "false" }, icon("native", 16));
    const shotButton = el("button", { type: "button", class: "pl-btn", "aria-label": "Save a frame as PNG", onclick: () => captureFrame() }, icon("camera", 16));
    const fullButton = el("button", { type: "button", class: "pl-btn", "aria-label": "Fullscreen", onclick: () => toggleFullscreen() }, icon("full", 16));
    const changeButton = el("button", { type: "button", class: "pl-btn", "aria-label": "Open another source", onclick: () => showLoader() }, icon("upload", 16));
    const quality = el("select", { class: "pl-quality", "aria-label": "Stream quality", hidden: true });
    const speedMenu = el("div", { class: "pl-menu", hidden: true });

    const controls = el("div", { class: "pl-controls" });
    const topRow = el("div", { class: "pl-row pl-row-seek" }, seek);
    const bottomRow = el("div", { class: "pl-row pl-row-buttons" });
    const left = el("div", { class: "pl-group" }, playButton);
    if (state.playlist) left.append(prevButton, nextButton);
    left.append(el("div", { class: "pl-volume-group" }, muteButton, volume), timeLabel);
    const right = el("div", { class: "pl-group pl-group-end" }, quality, liveBadge, speedButton, loopButton);
    if (kind === "video") right.append(shotButton);
    right.append(pipButton, nativeButton, fullButton, changeButton);
    if (config.subtitles) {
      const capButton = el("button", { type: "button", class: "pl-btn", "aria-label": "Caption settings", onclick: () => captionPanel.scrollIntoView({ behavior: "smooth", block: "center" }) }, icon("captions", 16));
      right.insertBefore(capButton, changeButton);
    }
    bottomRow.append(left, right);
    controls.append(topRow, bottomRow);

    const dock = el("div", { class: "pl-dock" }, controls, speedMenu);
    screen.append(dock);

    const applyNativeControls = (enabled) => {
      state.native = Boolean(enabled);
      media.controls = state.native;
      screen.classList.toggle("is-native", state.native);
      nativeButton.classList.toggle("is-on", state.native);
      nativeButton.setAttribute("aria-pressed", state.native ? "true" : "false");
      nativeButton.setAttribute("aria-label", state.native ? "Use custom controls" : "Use browser controls");
      speedMenu.hidden = true;
    };
    nativeButton.addEventListener("click", () => {
      applyNativeControls(!state.native);
      storeNativePref(state.native);
      if (state.native) frame.focus({ preventScroll: true });
    });
    applyNativeControls(state.native);

    const statusLine = el("div", { class: "pl-meta" });
    const titleLine = el("div", { class: "pl-titlebar" },
      el("span", { class: "pl-source-chip", text: config.label }),
      el("strong", { class: "pl-title", text: "No media loaded" }),
      el("span", { class: "pl-badges" }));
    const frame = el("div", { class: "pl-frame", hidden: true, tabindex: "0" }, alertBox, screen, titleLine, statusLine);
    const loader = el("div", { class: "pl-loader" });
    const extras = el("div", { class: "pl-extras" });
    const playlistWrap = el("div", { class: "pl-playlist", hidden: true });
    let cloudNote = null;
    let cloudChip = null;

    root.replaceChildren(el("div", { class: "pl-tool" }, loader, frame, extras, playlistWrap));

    const speedOptions = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
    speedOptions.forEach((rate) => {
      const option = el("button", { type: "button", class: `pl-menu-item${rate === 1 ? " is-on" : ""}`, text: `${rate}×`, onclick: () => setSpeed(rate) });
      speedMenu.append(option);
    });
    speedButton.addEventListener("click", (event) => {
      event.stopPropagation();
      speedMenu.hidden = !speedMenu.hidden;
    });
    document.addEventListener("click", (event) => {
      if (!speedMenu.hidden && !event.target.closest(".pl-menu") && event.target !== speedButton) speedMenu.hidden = true;
    });

    const updatePlayIcons = () => {
      const paused = media.paused;
      playButton.replaceChildren(icon(paused ? "play" : "pause", 16));
      playButton.setAttribute("aria-label", paused ? "Play" : "Pause");
      bigPlay.replaceChildren(icon(paused ? "play" : "pause", 26));
      bigPlay.classList.toggle("is-hidden", !paused || media.readyState < 2);
      screen.classList.toggle("is-playing", !paused);
      if ("mediaSession" in navigator) {
        try { navigator.mediaSession.playbackState = paused ? "paused" : "playing"; } catch {}
      }
    };

    const updateVolumeIcons = () => {
      const silent = media.muted || media.volume === 0;
      muteButton.replaceChildren(icon(silent ? "muted" : "volume", 16));
      muteButton.setAttribute("aria-label", silent ? "Unmute" : "Mute");
      volume.value = String(media.muted ? 0 : media.volume);
      volume.style.setProperty("--fill", `${Number(volume.value) * 100}%`);
    };

    const updateTime = () => {
      const duration = media.duration;
      state.duration = duration;
      state.live = !Number.isFinite(duration) && Boolean(state.hls || state.dash);
      liveBadge.hidden = !state.live;
      seek.disabled = state.live;
      const ratio = !state.live && duration > 0 ? Math.min(media.currentTime / duration, 1) : 0;
      if (!seek.matches(":active")) seek.value = String(Math.round(ratio * 1000));
      seek.style.setProperty("--fill", `${ratio * 100}%`);
      timeLabel.textContent = state.live ? `${fmtTime(media.currentTime)} / live` : `${fmtTime(media.currentTime)} / ${fmtTime(duration)}`;
      media.loop = state.repeat === "one" || loopButton.dataset.loop === "true";
    };

    const updateBuffer = () => {
      const duration = media.duration;
      if (!Number.isFinite(duration) || duration <= 0) return;
      let buffered = 0;
      try {
        for (let index = 0; index < media.buffered.length; index += 1) {
          if (media.buffered.start(index) <= media.currentTime && media.currentTime <= media.buffered.end(index)) {
            buffered = media.buffered.end(index);
            break;
          }
        }
      } catch {}
      seek.style.setProperty("--buffer", `${Math.min(buffered / duration, 1) * 100}%`);
    };

    const updateBadges = () => {
      const badges = $(".pl-badges", frame);
      if (!badges) return;
      const bits = [];
      if (state.engineLabel) bits.push(state.engineLabel);
      if (kind === "video" && media.videoWidth) bits.push(`${media.videoWidth}×${media.videoHeight}`);
      if (state.live) bits.push("Live stream");
      const list = $(".pl-playlist", root);
      if (list) list.hidden = !state.playlist || state.files.length < 1;
      badges.replaceChildren(...bits.map(text => el("span", { class: "pl-chip", text })));
    };

    const setNowPlaying = (name, source) => {
      state.sourceLabel = name || "Media";
      state.sourceType = guessType(name || source || "");
      $(".pl-title", frame).textContent = state.sourceLabel;
      artTitle.textContent = state.sourceLabel;
      const locality = config.modes === "file" ? "local playback" : "browser playback";
      artSub.textContent = `${state.sourceType} · ${locality}`;
      updateBadges();
      if ("mediaSession" in navigator && window.MediaMetadata) {
        try {
          navigator.mediaSession.metadata = new MediaMetadata({ title: state.sourceLabel, artist: "SanuwarTools Player", album: config.label });
        } catch {}
      }
    };

    const teardownEngine = () => {
      if (state.hls) {
        try { state.hls.destroy(); } catch {}
        state.hls = null;
      }
      if (state.dash) {
        try { state.dash.reset(); } catch {}
        state.dash = null;
      }
      try {
        media.pause();
        media.removeAttribute("src");
        media.load();
      } catch {}
    };

    const showMediaError = (extra = "") => {
      const code = media.error ? media.error.code : 0;
      const messages = {
        1: "Playback was interrupted. Press play to continue.",
        2: "A network error stopped the media from loading. Check the link and your connection.",
        3: "This media uses a codec the browser cannot decode. Try MP4 with H.264 video and AAC audio, or use a different file.",
        4: "The source could not be opened. The link may be offline, private, or missing cross-origin (CORS) permission.",
      };
      const text = [messages[code] || "The media could not be played.", extra].filter(Boolean).join(" ");
      setAlert(text, "error");
      bigPlay.classList.remove("is-hidden");
      updatePlayIcons();
    };

    const attachNative = (src) => {
      state.engineLabel = config.engine === "native" ? "Browser engine" : `${config.engine} fallback`;
      media.src = src;
      media.load();
    };

    const attachHls = (src) => {
      const nativeHls = Boolean(media.canPlayType("application/vnd.apple.mpegurl"));
      if (window.Hls && window.Hls.isSupported()) {
        const hls = new window.Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 90,
          xhrSetup: (xhr) => { xhr.withCredentials = false; },
        });
        state.hls = hls;
        state.engineLabel = "HLS.js";
        hls.attachMedia(media);
        hls.on(window.Hls.Events.MEDIA_ATTACHED, () => hls.loadSource(src));
        hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
          populateHlsQuality();
          updateBadges();
          updateTime();
        });
        hls.on(window.Hls.Events.LEVEL_SWITCHED, () => {
          const level = hls.levels && hls.levels[hls.currentLevel];
          if (level && media.videoHeight) updateBadges();
        });
        hls.on(window.Hls.Events.ERROR, (_event, data) => {
          if (!data || !data.fatal) return;
          const detail = String(data.details || "");
          if (detail.includes("bufferStalledError") && hls.media) {
            hls.startLoad();
            return;
          }
          if (detail.includes("networkError")) {
            showMediaError("The HLS playlist or a segment could not be fetched. Confirm the stream allows browser access.");
            return;
          }
          if (detail.includes("manifestParsingError")) {
            showMediaError("The playlist could not be parsed. Check that the link points to an .m3u8 manifest.");
            return;
          }
          showMediaError("The HLS stream reported a playback error.");
        });
        return;
      }
      if (nativeHls) {
        state.engineLabel = "Safari HLS";
        attachNative(src);
        return;
      }
      state.engineLabel = "HLS unavailable";
      attachNative(src);
      setAlert("This browser cannot play HLS natively. Open the page in Safari, or use a browser that supports Media Source Extensions.", "error");
    };

    const populateHlsQuality = () => {
      if (!state.hls || !state.hls.levels) return;
      const levels = state.hls.levels;
      const options = [el("option", { value: "-1", text: "Auto" })];
      levels.forEach((level, index) => {
        const label = level.height ? `${level.height}p` : `${Math.round((level.bitrate || 0) / 1000)} kbps`;
        options.push(el("option", { value: String(index), text: label }));
      });
      quality.replaceChildren(...options);
      quality.hidden = levels.length < 2;
      quality.value = "-1";
    };

    quality.addEventListener("change", () => {
      const value = Number(quality.value);
      if (state.hls) {
        state.hls.currentLevel = Number.isFinite(value) ? value : -1;
        return;
      }
      if (state.dash) {
        try {
          if (value < 0) state.dash.setAutoSwitchQualityFor("video", true);
          else {
            state.dash.setAutoSwitchQualityFor("video", false);
            state.dash.setQualityFor("video", value);
          }
        } catch {}
      }
    });

    const attachDash = (src) => {
      if (!window.dashjs || !window.dashjs.MediaPlayer) {
        attachNative(src);
        setAlert("DASH playback needs dash.js, which could not be loaded. Reload the page or use the HLS player for .m3u8 links.", "error");
        return;
      }
      try {
        const player = window.dashjs.MediaPlayer().create();
        state.dash = player;
        state.engineLabel = "DASH.js";
        player.initialize(media, src, false);
        player.on(window.dashjs.MediaPlayer.events.STREAM_INITIALIZED, () => {
          populateDashQuality();
          updateTime();
          updateBadges();
        });
        player.on(window.dashjs.MediaPlayer.events.ERROR, (event) => {
          const message = event && event.error ? String(event.error.message || event.error.code || "") : "";
          if (message.includes("capability") || message.includes("MEDIA_ERROR")) {
            showMediaError("The DASH stream uses a codec this browser cannot decode.");
          } else {
            showMediaError("The DASH manifest could not be played. Check the .mpd link and its permissions.");
          }
        });
      } catch {
        attachNative(src);
        setAlert("The DASH engine could not start. Reload the page and try again.", "error");
      }
    };

    const populateDashQuality = () => {
      if (!state.dash) return;
      try {
        const list = state.dash.getBitrateInfoListFor("video") || [];
        if (!list.length) return;
        const options = [el("option", { value: "-1", text: "Auto" })];
        const counts = list.reduce((map, item) => {
          const key = String(item.height || "");
          map[key] = (map[key] || 0) + 1;
          return map;
        }, {});
        list.forEach((item, index) => {
          const height = item.height ? `${item.height}p` : `Track ${index + 1}`;
          const rate = item.bitrate ? `${Math.round(item.bitrate / 1000)}k` : "";
          const label = counts[String(item.height || "")] > 1 && rate ? `${height} · ${rate}` : height;
          options.push(el("option", { value: String(index), text: label }));
        });
        quality.replaceChildren(...options);
        quality.hidden = list.length < 2;
      } catch {}
    };

    const attachSource = (src, name) => {
      setAlert("");
      teardownEngine();
      setNowPlaying(name, src);
      spinner.hidden = false;
      if (config.engine === "hls") attachHls(src);
      else if (config.engine === "dash") attachDash(src);
      else attachNative(src);
      updatePlayIcons();
      updateTime();
      updateBadges();
      requestAnimationFrame(() => {
        attemptPlay();
        spinner.hidden = true;
      });
    };

    const loadFile = (file) => {
      if (state.objectUrl) {
        try { URL.revokeObjectURL(state.objectUrl); } catch {}
        state.objectUrl = "";
      }
      state.objectUrl = URL.createObjectURL(file);
      state.sourceLabel = file.name;
      attachSource(state.objectUrl, file.name);
    };

    const playlistName = (item) => item.file ? item.file.name : item.name;

    const renderPlaylist = () => {
      if (!state.playlist || !state.files.length) return;
      const list = el("div", { class: "pl-list", role: "list" });
      state.files.forEach((item, index) => {
        const file = item.file;
        const row = el("button", {
          type: "button", role: "listitem",
          class: `pl-item${index === state.index ? " is-current" : ""}`,
          onclick: () => { state.index = index; loadFile(file); renderPlaylist(); },
        },
        el("span", { class: "pl-item-index", text: String(index + 1).padStart(2, "0") }),
        el("span", { class: "pl-item-copy" }, el("strong", { text: playlistName(item) }), el("small", { text: T.fmtBytes(file ? file.size : item.size || 0) })),
        el("span", { class: "pl-item-play", "aria-hidden": "true" }, icon("play", 13)));
        list.append(row);
      });
      const toolsRow = el("div", { class: "pl-list-tools" },
        el("button", { type: "button", class: `pl-chip-btn${state.shuffle ? " is-on" : ""}`, "aria-pressed": String(state.shuffle), onclick: () => toggleShuffle() }, icon("shuffle", 13), el("span", { text: "Shuffle" })),
        el("button", { type: "button", class: `pl-chip-btn${state.repeat !== "off" ? " is-on" : ""}`, "aria-pressed": String(state.repeat !== "off"), onclick: () => cycleRepeat() }, icon("repeat", 13), el("span", { text: state.repeat === "one" ? "Repeat one" : state.repeat === "all" ? "Repeat all" : "Repeat" })),
        el("span", { class: "pl-list-count", text: `${state.files.length} ${state.files.length === 1 ? "item" : "items"} · local only` }));
      playlistWrap.replaceChildren(el("div", { class: "pl-playlist-head" }, el("strong", { text: "Playlist" }), toolsRow), list);
      playlistWrap.hidden = false;
    };

    const step = (direction) => {
      if (!state.playlist || state.files.length < 2) {
        if (direction < 0) media.currentTime = 0;
        return;
      }
      let nextIndex;
      if (state.shuffle && state.files.length > 1) {
        do { nextIndex = Math.floor(Math.random() * state.files.length); } while (nextIndex === state.index);
      } else {
        nextIndex = (state.index + direction + state.files.length) % state.files.length;
      }
      state.index = nextIndex;
      loadFile(state.files[nextIndex].file);
      renderPlaylist();
    };

    const onEnded = () => {
      updatePlayIcons();
      if (state.repeat === "one") {
        attemptPlay();
        return;
      }
      if (state.playlist && state.files.length > 1) {
        const atEnd = state.index === state.files.length - 1;
        if (!atEnd || state.repeat === "all") {
          const nextIndex = state.shuffle ? Math.floor(Math.random() * state.files.length) : (state.index + 1) % state.files.length;
          state.index = nextIndex;
          loadFile(state.files[nextIndex].file);
          renderPlaylist();
        }
      }
    };

    const toggleShuffle = () => {
      state.shuffle = !state.shuffle;
      renderPlaylist();
    };
    const cycleRepeat = () => {
      state.repeat = state.repeat === "off" ? "all" : state.repeat === "all" ? "one" : "off";
      media.loop = state.repeat === "one" || loopButton.dataset.loop === "true";
      renderPlaylist();
      setAlert(state.repeat === "one" ? "This item will repeat." : state.repeat === "all" ? "The playlist will repeat from the start." : "", "info");
    };

    const toggleLoop = () => {
      const active = loopButton.dataset.loop !== "true";
      loopButton.dataset.loop = String(active);
      loopButton.classList.toggle("is-on", active);
      loopButton.setAttribute("aria-pressed", String(active));
      media.loop = active;
      T.toast(active ? "Loop is on." : "Loop is off.");
    };

    const setSpeed = (rate) => {
      try { media.playbackRate = rate; } catch {}
      speedButton.textContent = `${rate}×`;
      speedMenu.hidden = true;
      speedMenu.querySelectorAll(".pl-menu-item").forEach((item) => item.classList.toggle("is-on", item.textContent === `${rate}×`));
    };

    const toggleMute = () => {
      media.muted = !media.muted;
      updateVolumeIcons();
    };

    const attemptPlay = () => {
      const promise = media.play();
      if (promise && typeof promise.catch === "function") {
        promise.catch((error) => {
          if (error && error.name === "NotAllowedError") {
            bigPlay.classList.remove("is-hidden");
            setAlert("Press play to start. Browsers ask for a tap before media can begin.", "info");
          }
        });
      }
    };

    const pauseMedia = () => media.pause();

    const togglePip = async () => {
      if (kind !== "video") return;
      try {
        if (document.pictureInPictureElement) await document.exitPictureInPicture();
        else if (document.pictureInPictureEnabled) await media.requestPictureInPicture();
        else T.toast("Picture-in-picture is not available in this browser.", "error");
      } catch {
        T.toast("Picture-in-picture could not start for this video.", "error");
      }
    };

    const toggleFullscreen = async () => {
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else {
          await screen.requestFullscreen();
        }
      } catch {
        T.toast("Fullscreen is not available here.", "error");
      }
    };
    document.addEventListener("fullscreenchange", () => {
      fullButton.replaceChildren(icon(document.fullscreenElement ? "exitfull" : "full", 16));
    });

    const captureFrame = () => {
      if (kind !== "video" || !media.videoWidth) {
        T.toast("Load a video first.", "error");
        return;
      }
      const shot = document.createElement("canvas");
      shot.width = media.videoWidth;
      shot.height = media.videoHeight;
      const context = shot.getContext("2d");
      try {
        context.drawImage(media, 0, 0, shot.width, shot.height);
        shot.toBlob((blob) => {
          if (blob) T.download(`frame-${fmtTime(media.currentTime).replace(/:/g, "-")}.png`, blob, "image/png");
        }, "image/png");
      } catch {
        T.toast("The frame could not be saved. A cross-origin video can block screenshots.", "error");
      }
    };

    const setupAnalyser = () => {
      if (kind !== "audio" || !config.visualizer || state.analyser || !state.objectUrl) return;
      if (media.getAttribute("src") !== state.objectUrl) return;
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return;
      try {
        state.audioCtx = new Context();
        state.analyser = state.audioCtx.createAnalyser();
        state.analyser.fftSize = 128;
        state.analyser.smoothingTimeConstant = 0.78;
        const source = state.audioCtx.createMediaElementSource(media);
        source.connect(state.analyser);
        state.analyser.connect(state.audioCtx.destination);
        state.vizData = new Uint8Array(state.analyser.frequencyBinCount);
        canvas.hidden = false;
        eq.hidden = true;
        media.addEventListener("play", () => {
          if (state.audioCtx && state.audioCtx.state === "suspended") state.audioCtx.resume().catch(() => {});
        });
        drawViz();
      } catch {
        state.analyser = null;
      }
    };

    const drawViz = () => {
      if (!state.analyser || media.paused) {
        state.vizRaf = 0;
        return;
      }
      const width = canvas.clientWidth || screen.clientWidth;
      const height = canvas.clientHeight || 120;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (!width || !height) return;
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
      }
      const context = canvas.getContext("2d");
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);
      state.analyser.getByteFrequencyData(state.vizData);
      const count = state.vizData.length;
      const bar = width / count;
      for (let index = 0; index < count; index += 1) {
        const value = state.vizData[index] / 255;
        const barHeight = Math.max(2, value * height * 0.86);
        context.fillStyle = `rgba(255, 255, 255, ${0.2 + value * 0.65})`;
        context.fillRect(index * bar + bar * 0.18, height - barHeight, bar * 0.62, barHeight);
      }
      state.vizRaf = requestAnimationFrame(drawViz);
    };

    const tick = () => {
      if (media.paused) {
        state.tickRaf = 0;
        return;
      }
      updateTime();
      applyCaption();
      state.tickRaf = requestAnimationFrame(tick);
    };

    const applyCaption = () => {
      if (!config.subtitles) return;
      const cue = state.cues.length ? findCue(state.cues, media.currentTime + state.captionOffset) : null;
      const key = cue ? cue.key : "";
      if (captionBox.dataset.key === key) return;
      captionBox.dataset.key = key;
      captionBox.textContent = cue ? cue.text : "";
      captionBox.classList.toggle("is-empty", !cue);
    };

    media.addEventListener("loadedmetadata", () => {
      updateTime();
      updateBuffer();
      updateBadges();
      spinner.hidden = true;
    });
    media.addEventListener("timeupdate", () => { updateTime(); applyCaption(); });
    media.addEventListener("progress", updateBuffer);
    media.addEventListener("durationchange", updateTime);
    media.addEventListener("play", () => {
      updatePlayIcons();
      updateTime();
      applyCaption();
      if (state.tickRaf) cancelAnimationFrame(state.tickRaf);
      state.tickRaf = requestAnimationFrame(tick);
      if (state.analyser && !state.vizRaf) state.vizRaf = requestAnimationFrame(drawViz);
    });
    media.addEventListener("pause", () => {
      updatePlayIcons();
      if (state.vizRaf) cancelAnimationFrame(state.vizRaf);
      state.vizRaf = 0;
    });
    media.addEventListener("playing", () => {
      spinner.hidden = true;
      setAlert("");
      updatePlayIcons();
    });
    media.addEventListener("waiting", () => { spinner.hidden = false; });
    media.addEventListener("canplay", () => { spinner.hidden = true; });
    media.addEventListener("seeked", applyCaption);
    media.addEventListener("ended", onEnded);
    media.addEventListener("error", () => {
      if (!media.getAttribute("src") && !state.hls && !state.dash) return;
      showMediaError();
    });
    media.addEventListener("volumechange", () => {
      updateVolumeIcons();
      if (!media.muted) {
        state.volume = media.volume;
        storeVolume(media.volume);
      }
    });

    seek.addEventListener("input", () => {
      seek.style.setProperty("--fill", `${Number(seek.value) / 10}%`);
      const duration = media.duration;
      if (Number.isFinite(duration) && duration > 0) media.currentTime = (Number(seek.value) / 1000) * duration;
    });
    volume.addEventListener("input", () => {
      media.volume = Number(volume.value);
      media.muted = Number(volume.value) === 0;
      updateVolumeIcons();
    });

    media.addEventListener("click", () => {
      if (state.native) return;
      if (media.paused) attemptPlay(); else media.pause();
    });
    media.addEventListener("dblclick", () => { if (!state.native) toggleFullscreen(); });
    screen.addEventListener("click", (event) => {
      if (state.native) return;
      if (!event.target.closest("button, input, select")) frame.focus({ preventScroll: true });
    });
    screen.addEventListener("dragover", (event) => {
      if (!config.dropEnabled) return;
      event.preventDefault();
      dropVeil.hidden = false;
    });
    screen.addEventListener("dragleave", () => { dropVeil.hidden = true; });
    screen.addEventListener("drop", (event) => {
      if (!config.dropEnabled) return;
      event.preventDefault();
      dropVeil.hidden = true;
      const files = event.dataTransfer && event.dataTransfer.files;
      if (files && files.length) acceptFiles([...files]);
    });

    frame.addEventListener("keydown", (event) => {
      if (event.target.matches("input, select, textarea, button") && event.key !== "Escape") return;
      const key = event.key;
      const jump = event.shiftKey ? 30 : 10;
      if (key === " " || key.toLowerCase() === "k") {
        event.preventDefault();
        if (media.paused) attemptPlay(); else media.pause();
      } else if (key === "ArrowLeft") {
        event.preventDefault();
        media.currentTime = Math.max(0, media.currentTime - jump);
      } else if (key === "ArrowRight") {
        event.preventDefault();
        if (Number.isFinite(media.duration)) media.currentTime = Math.min(media.duration, media.currentTime + jump);
      } else if (key === "ArrowUp") {
        event.preventDefault();
        media.volume = Math.min(1, media.volume + 0.05);
      } else if (key === "ArrowDown") {
        event.preventDefault();
        media.volume = Math.max(0, media.volume - 0.05);
      } else if (key.toLowerCase() === "m") {
        toggleMute();
      } else if (key.toLowerCase() === "f") {
        toggleFullscreen();
      } else if (key.toLowerCase() === "p") {
        togglePip();
      } else if (key.toLowerCase() === "l") {
        toggleLoop();
      } else if (key === ">" || key === ".") {
        setSpeed(Math.min(2, Math.round((media.playbackRate + 0.25) * 100) / 100));
      } else if (key === "<" || key === ",") {
        setSpeed(Math.max(0.25, Math.round((media.playbackRate - 0.25) * 100) / 100));
      }
    });

    const showLoader = () => {
      media.pause();
      frame.hidden = true;
      loader.hidden = false;
      loader.scrollIntoView({ behavior: "smooth", block: "nearest" });
    };

    const acceptFiles = (files) => {
      const usable = files.filter(file => file && file.size > 0);
      if (!usable.length) {
        T.toast("No usable media files were found.", "error");
        return;
      }
      state.files = usable.map(file => ({ file, name: file.name, size: file.size }));
      state.index = 0;
      state.playlist = Boolean(config.playlist);
      loader.hidden = true;
      frame.hidden = false;
      renderPlaylist();
      loadFile(usable[0]);
    };

    const buildLoader = () => {
      loader.replaceChildren();
      const intro = el("div", { class: "pl-loader-head" },
        el("span", { class: "pl-loader-icon", "aria-hidden": "true" }, icon(kind === "audio" ? "list" : "upload", 22)),
        el("div", {}, el("strong", { text: config.heading }), el("p", { text: config.hint })));
      loader.append(intro);
      const options = el("div", { class: "pl-source-grid" });

      if (config.modes !== "url") {
        const drop = T.fileDrop({
          accept: config.accept,
          multiple: state.playlist,
          icon: kind === "audio" ? "♫" : "⇪",
          label: config.fileLabel,
          hint: config.fileHint,
          onFiles: acceptFiles,
        });
        drop.node.classList.add("pl-drop-source");
        options.append(drop.node);
      }

      if (config.modes !== "file") {
        const urlInput = el("input", { type: "url", class: "tp-input pl-url", placeholder: config.placeholder, autocomplete: "off", spellcheck: "false", inputmode: "url", "aria-label": "Media link" });
        const loadButton = el("button", { type: "button", class: "tp-btn tp-btn-primary" }, icon("link", 14), el("span", { text: "Play link" }));
        const loadUrl = () => {
          const raw = urlInput.value.trim();
          if (!raw) {
            T.toast("Paste a media link first.", "error");
            return;
          }
          let target = raw;
          let provider = "";
          if (config.cloud) {
            const resolved = resolveCloudLink(raw);
            if (resolved.error) {
              T.toast(resolved.error, "error");
              return;
            }
            target = resolved.url;
            provider = resolved.provider;
            cloudNote.textContent = resolved.note;
            cloudNote.hidden = false;
            cloudChip.textContent = provider;
            cloudChip.hidden = false;
          } else if (!isHttpLink(target)) {
            T.toast("Use a full http or https media link.", "error");
            return;
          }
          state.files = [];
          state.playlist = false;
          loader.hidden = true;
          frame.hidden = false;
          const rawName = provider ? `${provider} stream` : (target.split("/").pop() || "Media link").split("?")[0];
          let name = rawName;
          try { name = decodeURIComponent(rawName); } catch {}
          attachSource(target, name);
        };
        loadButton.addEventListener("click", loadUrl);
        urlInput.addEventListener("keydown", (event) => { if (event.key === "Enter") loadUrl(); });
        const toolbar = el("div", { class: "pl-url-row" }, urlInput, loadButton);
        const samples = el("div", { class: "pl-samples" });
        if (config.sample) {
          samples.append(el("button", { type: "button", class: "pl-chip-btn", onclick: () => { urlInput.value = config.sample.url; urlInput.focus(); } }, icon("link", 12), el("span", { text: config.sample.label })));
        }
        if (config.cloud) {
          samples.append(el("span", { class: "pl-hint", text: "Drive · Dropbox · OneDrive share links are converted to playable media links." }));
        }
        const urlBox = el("div", { class: "pl-url-source" }, el("strong", { text: config.urlLabel }), toolbar, samples);
        options.append(urlBox);
      }

      loader.append(options);
    };

    if (config.cloud) {
      cloudNote = el("p", { class: "pl-cloud-note", hidden: true, text: "" });
      cloudChip = el("span", { class: "pl-chip", text: "Google Drive", hidden: true });
    }

    buildLoader();

    let captionPanel = null;
    if (config.subtitles) {
      const styleControls = el("div", { class: "pl-caption-controls" });
      const sizeSelect = el("select", { class: "tp-select", "aria-label": "Caption size" },
        ...["s", "m", "l"].map(size => el("option", { value: size, text: size === "s" ? "Small" : size === "l" ? "Large" : "Medium", selected: state.captionStyle.size === size })));
      const positionSelect = el("select", { class: "tp-select", "aria-label": "Caption position" },
        el("option", { value: "bottom", text: "Bottom", selected: state.captionStyle.position === "bottom" }),
        el("option", { value: "top", text: "Top", selected: state.captionStyle.position === "top" }));
      const backgroundToggle = el("input", { type: "checkbox", checked: state.captionStyle.background });
      const offsetValue = el("strong", { class: "pl-offset", text: "0.0 s" });
      const offsetInput = el("input", { type: "range", min: "-10", max: "10", step: "0.1", value: "0", class: "pl-range pl-offset-range", "aria-label": "Subtitle delay" });
      const captionName = el("span", { class: "pl-caption-name", text: "No subtitle loaded" });
      const captionDrop = T.fileDrop({
        accept: ".srt,.vtt,.sub,text/plain",
        icon: "CC",
        label: "Drop an SRT or VTT subtitle",
        hint: "Captions are rendered on your device; nothing is uploaded.",
        onFiles: async (files) => {
          const file = files[0];
          if (!file) return;
          try {
            const text = await T.readFile(file, "text");
            state.cues = parseCaptions(text);
            state.captionName = file.name;
            captionName.textContent = `${file.name} · ${state.cues.length} cues`;
            captionBox.dataset.key = "";
            applyCaption();
            if (!state.cues.length) setAlert("No timed cues were found in that file. Check it is a valid .srt or .vtt file.", "error");
            else setAlert(`Loaded ${state.cues.length} subtitle cues from ${file.name}.`, "info");
          } catch {
            setAlert("The subtitle file could not be read.", "error");
          }
        },
      });
      captionDrop.node.classList.add("pl-caption-drop");
      const applyStyle = () => {
        state.captionStyle.size = sizeSelect.value;
        state.captionStyle.position = positionSelect.value;
        state.captionStyle.background = backgroundToggle.checked;
        storeCaptionStyle(state.captionStyle);
        captionBox.className = `pl-cue is-${state.captionStyle.position}${state.captionStyle.background ? " has-bg" : ""} size-${state.captionStyle.size}`;
      };
      sizeSelect.addEventListener("change", applyStyle);
      positionSelect.addEventListener("change", applyStyle);
      backgroundToggle.addEventListener("change", applyStyle);
      offsetInput.addEventListener("input", () => {
        state.captionOffset = Number(offsetInput.value);
        offsetValue.textContent = `${state.captionOffset > 0 ? "+" : ""}${state.captionOffset.toFixed(1)} s`;
        captionBox.dataset.key = "";
        applyCaption();
      });
      styleControls.append(T.field("Caption size", sizeSelect), T.field("Position", positionSelect), T.field("Background", backgroundToggle), el("div", { class: "pl-offset-wrap" }, el("span", { class: "tp-label", text: "Subtitle delay" }), el("div", { class: "pl-offset-row" }, offsetInput, offsetValue)));
      captionPanel = T.panel("Subtitles", el("div", { class: "pl-caption-body" }, captionDrop.node, el("p", { class: "pl-caption-name" }, captionName), styleControls, el("p", { class: "tp-hint", text: "The delay shifts captions earlier or later without changing the video. SRT files are read locally and converted while you watch." })), "pl-caption-panel");
      extras.append(captionPanel);
      captionBox.className = `pl-cue is-${state.captionStyle.position}${state.captionStyle.background ? " has-bg" : ""} size-${state.captionStyle.size}`;
    }

    if (config.cloud) {
      const providers = el("ul", { class: "pl-provider-list" },
        el("li", {}, el("strong", { text: "Google Drive" }), el("span", { text: "Share the file with “anyone with the link”, then paste the file link." })),
        el("li", {}, el("strong", { text: "Dropbox" }), el("span", { text: "Paste a shared file link; raw mode is applied automatically." })),
        el("li", {}, el("strong", { text: "OneDrive" }), el("span", { text: "Paste a share link from your own drive; viewing or download permission is required." })));
      extras.append(T.panel("Authorized cloud links", el("div", { class: "pl-cloud-body" },
        el("p", { class: "tp-hint", text: "Only play media you own or are allowed to access. This player never stores the link or the file." }),
        providers,
        el("div", { class: "pl-cloud-flags" }, cloudChip, cloudNote))));
    }

    if (config.codecCheck) {
      const probes = [
        ["H.264 video", 'video/mp4; codecs="avc1.42E01E"'],
        ["HEVC video", 'video/mp4; codecs="hvc1.1.6.L93.B0"'],
        ["VP9 video", 'video/webm; codecs="vp9"'],
        ["AV1 video", 'video/mp4; codecs="av01.0.05M.08"'],
        ["AAC audio", 'audio/mp4; codecs="mp4a.40.2"'],
        ["MP3 audio", "audio/mpeg"],
        ["Opus audio", 'audio/webm; codecs="opus"'],
        ["FLAC audio", "audio/flac"],
        ["AC-3 audio", 'audio/mp4; codecs="ac-3"'],
        ["DTS audio", "audio/vnd.dts"],
      ];
      const probe = document.createElement("video");
      const rows = probes.map(([label, type]) => {
        const support = probe.canPlayType(type);
        const status = support === "probably" ? "Yes" : support === "maybe" ? "Maybe" : "No";
        const tone = support === "probably" ? "ok" : support === "maybe" ? "warn" : "no";
        return el("li", { class: "pl-codec" }, el("strong", { text: label }), el("span", { class: `pl-codec-state is-${tone}`, text: status }));
      });
      extras.append(T.panel("Codec check", el("div", { class: "pl-codec-body" },
        el("p", { class: "tp-hint", text: "Browsers do not publish Matroska container support directly. This table shows the tracks this device reports it can decode. If a playable MKV gets a black screen or no sound, the audio track is probably AC-3 or DTS." }),
        el("ul", { class: "pl-codec-list" }, ...rows))));
    }

    if (config.notes) {
      extras.append(T.panel(config.notes.title, el("div", { class: "pl-note-body" },
        ...config.notes.items.map(item => el("p", { class: "tp-hint", text: item })))));
    }

    const shortcutItems = [["Space / K", "Play or pause"], ["← / →", "Seek 10 s (Shift: 30 s)"], ["↑ / ↓", "Volume"], ["M", "Mute"], ["F", "Fullscreen"], ["P", "Picture-in-picture"], ["L", "Loop"], [", / .", "Slower or faster"]];
    extras.append(T.panel("Keyboard shortcuts", el("ul", { class: "pl-keys" },
      ...shortcutItems.map(([keys, action]) => el("li", {}, el("kbd", { text: keys }), el("span", { text: action }))))));

    updateVolumeIcons();
    updateTime();
    updatePlayIcons();
    if (config.subtitles) {
      captionBox.className = `pl-cue is-${state.captionStyle.position}${state.captionStyle.background ? " has-bg" : ""} size-${state.captionStyle.size}`;
    }

    if ("mediaSession" in navigator) {
      try {
        ["play", "pause", "seekbackward", "seekforward", "previoustrack", "nexttrack"].forEach((action) => {
          navigator.mediaSession.setActionHandler(action, () => {
            if (action === "play") attemptPlay();
            else if (action === "pause") media.pause();
            else if (action === "seekbackward") media.currentTime = Math.max(0, media.currentTime - 10);
            else if (action === "seekforward") media.currentTime = Math.min(media.duration || media.currentTime + 10, media.currentTime + 10);
            else if (action === "previoustrack") step(-1);
            else if (action === "nexttrack") step(1);
          });
        });
      } catch {}
    }

    playButton.addEventListener("click", () => { setupAnalyser(); });
    bigPlay.addEventListener("click", () => { setupAnalyser(); });

    media.addEventListener("play", () => { if (kind === "audio") setupAnalyser(); });

  };

  T.register("online-video-player", (root) => createPlayer(root, {
    kind: "video",
    modes: "both",
    accept: "video/*,.mp4,.m4v,.webm,.mov,.ogv,.mkv",
    engine: "native",
    label: "Video",
    heading: "Open a video",
    hint: "Choose a video from this device or paste a direct link. Playback happens in your browser.",
    fileLabel: "Drop a video or click to browse",
    fileHint: "MP4, WebM, MOV, OGV and more · files stay on this device",
    urlLabel: "Direct video link",
    placeholder: "https://example.com/video.mp4",
    playlist: false,
    dropEnabled: true,
    visualizer: false,
  }));

  T.register("mp4-player", (root) => createPlayer(root, {
    kind: "video",
    modes: "both",
    accept: "video/mp4,video/x-m4v,.mp4,.m4v",
    engine: "native",
    label: "MP4",
    heading: "Play an MP4",
    hint: "MP4 files with H.264 video and AAC audio play in every modern browser. Links must point straight to a media file.",
    fileLabel: "Drop an MP4 or click to browse",
    fileHint: "MP4 and M4V · processed locally",
    urlLabel: "MP4 link",
    placeholder: "https://example.com/clip.mp4",
    playlist: false,
    dropEnabled: true,
    visualizer: false,
    notes: {
      title: "MP4 compatibility",
      items: [
        "H.264 + AAC is the most widely supported combination. HEVC (H.265) depends on the device and browser.",
        "If a remote MP4 refuses to play, the server may not allow cross-origin streaming; a download-and-drop usually works.",
      ],
    },
  }));

  T.register("m3u8-player", (root) => createPlayer(root, {
    kind: "video",
    modes: "url",
    engine: "hls",
    label: "HLS",
    heading: "Open an HLS stream",
    hint: "Paste an .m3u8 playlist. Adaptive bitrate playback uses HLS.js in Chrome, Edge and Firefox, and the native player in Safari.",
    urlLabel: "HLS playlist link",
    placeholder: "https://example.com/live/playlist.m3u8",
    sample: { label: "Try a public test stream", url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8" },
    playlist: false,
    dropEnabled: false,
    visualizer: false,
    notes: {
      title: "About HLS",
      items: [
        "HLS streams load the playlist and video segments over the network, so the server must allow cross-origin requests.",
        "Live streams show a LIVE badge. Use the quality menu to pin a resolution or leave it on Auto.",
      ],
    },
  }));

  T.register("dash-player", (root) => createPlayer(root, {
    kind: "video",
    modes: "url",
    engine: "dash",
    label: "DASH",
    heading: "Open a DASH manifest",
    hint: "Paste an .mpd manifest. Quality switches automatically unless you pick a resolution.",
    urlLabel: "DASH manifest link",
    placeholder: "https://example.com/stream/manifest.mpd",
    sample: { label: "Try a public test manifest", url: "https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd" },
    playlist: false,
    dropEnabled: false,
    visualizer: false,
    notes: {
      title: "About DASH",
      items: [
        "MPEG-DASH manifests usually arrive with several video bitrates; the quality menu appears when more than one track is available.",
        "DRM-protected streams need a licensed player and cannot play here.",
      ],
    },
  }));

  T.register("mkv-player", (root) => createPlayer(root, {
    kind: "video",
    modes: "both",
    accept: ".mkv,video/x-matroska,video/*",
    engine: "native",
    label: "MKV",
    heading: "Open an MKV file",
    hint: "Drop a Matroska video or paste a link. Chrome, Edge and Firefox can often decode H.264 or VP9 tracks inside MKV.",
    fileLabel: "Drop an MKV or click to browse",
    fileHint: "MKV, MKA and other Matroska files · local only",
    urlLabel: "MKV link",
    placeholder: "https://example.com/video.mkv",
    playlist: false,
    dropEnabled: true,
    visualizer: false,
    codecCheck: true,
    notes: {
      title: "If an MKV will not play",
      items: [
        "Matroska is a container. The browser must decode the tracks inside it: H.264/VP9/AV1 video with AAC/Opus/MP3 audio is the safest mix.",
        "AC-3, E-AC-3 and DTS audio often play as silence or fail; the Codec check table shows what this device reports.",
        "For unsupported tracks, remux the file to MP4 with a desktop tool, then use the MP4 player.",
      ],
    },
  }));

  T.register("local-video-player", (root) => createPlayer(root, {
    kind: "video",
    modes: "file",
    accept: "video/*,.mkv",
    engine: "native",
    label: "Local video",
    heading: "Play videos from this device",
    hint: "Drop several files to build a queue. Nothing is uploaded and no account is needed.",
    fileLabel: "Drop videos or click to browse",
    fileHint: "Select one or many video files · local playback only",
    playlist: true,
    dropEnabled: true,
    visualizer: false,
  }));

  T.register("mp3-player", (root) => createPlayer(root, {
    kind: "audio",
    modes: "file",
    accept: "audio/*,.mp3,.m4a,.aac,.wav,.flac,.ogg,.opus",
    engine: "native",
    label: "MP3 playlist",
    heading: "Build a local audio playlist",
    hint: "Drop MP3 files or a folder selection. Shuffle, repeat and the visualizer are built in.",
    fileLabel: "Drop audio files or click to browse",
    fileHint: "MP3, M4A, AAC, WAV, FLAC, OGG · stays on this device",
    playlist: true,
    dropEnabled: true,
    visualizer: true,
  }));

  T.register("online-audio-player", (root) => createPlayer(root, {
    kind: "audio",
    modes: "both",
    accept: "audio/*,.mp3,.m4a,.aac,.wav,.flac,.ogg,.opus",
    engine: "native",
    label: "Audio",
    heading: "Play an audio file or link",
    hint: "Choose a local file or paste a direct audio link that allows cross-origin access.",
    fileLabel: "Drop audio or click to browse",
    fileHint: "MP3, M4A, AAC, WAV, FLAC, OGG · local only",
    urlLabel: "Direct audio link",
    placeholder: "https://example.com/track.mp3",
    playlist: false,
    dropEnabled: true,
    visualizer: false,
    notes: {
      title: "About audio links",
      items: [
        "Remote audio plays only when the server allows cross-origin streaming. The animated equalizer is a visual cue, not a spectrum reading of the remote file.",
      ],
    },
  }));

  T.register("subtitle-player", (root) => createPlayer(root, {
    kind: "video",
    modes: "both",
    accept: "video/*,.mkv,.mp4,.mov,.webm",
    engine: "native",
    label: "Subtitles",
    heading: "Play a video with subtitles",
    hint: "Open a video first, then drop an SRT or VTT file to turn on captions. Delay and styling adjust live.",
    fileLabel: "Drop a video or click to browse",
    fileHint: "MP4, WebM, MKV and more · local playback",
    urlLabel: "Video link",
    placeholder: "https://example.com/video.mp4",
    playlist: false,
    dropEnabled: true,
    visualizer: false,
    subtitles: true,
  }));

  T.register("cloud-video-player", (root) => createPlayer(root, {
    kind: "video",
    modes: "url",
    engine: "native",
    label: "Cloud",
    heading: "Play from an authorized cloud link",
    hint: "Paste a Google Drive, Dropbox, OneDrive share link or any direct video URL. The link is converted in your browser.",
    urlLabel: "Share link or direct media URL",
    placeholder: "https://drive.google.com/file/d/FILE_ID/view",
    playlist: false,
    dropEnabled: false,
    visualizer: false,
    cloud: true,
    notes: {
      title: "Permissions matter",
      items: [
        "A cloud file plays only when the link grants access to anyone with the link. Private files stay private and will fail to load.",
        "Large Drive files may show a virus-scan confirmation page that the video element cannot handle; download those manually.",
      ],
    },
  }));
})();
