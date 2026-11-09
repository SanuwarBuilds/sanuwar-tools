"use strict";
(() => {
  const registry = Object.create(null);

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const el = (tag, attrs = {}, ...children) => {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value === null || value === undefined || value === false) return;
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value;
      else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2), value);
      else if (key === "value") node.value = value;
      else if (key === "checked" || key === "selected" || key === "multiple") node[key] = Boolean(value);
      else node.setAttribute(key, value === true ? "" : value);
    });
    children.flat(Infinity).forEach((child) => {
      if (child === null || child === undefined || child === false) return;
      node.append(child instanceof Node ? child : String(child));
    });
    return node;
  };

  const panel = (title, body, className = "") => {
    const section = el("section", { class: `tp-panel ${className}`.trim() });
    if (title) section.append(el("h2", { class: "tp-panel-title", text: title }));
    section.append(body);
    return section;
  };

  const field = (label, control, hint = "") => {
    const wrap = el("label", { class: "tp-field" }, el("span", { class: "tp-label", text: label }), control);
    if (hint) wrap.append(el("span", { class: "tp-hint", text: hint }));
    return wrap;
  };

  const textarea = (value = "", attrs = {}) => el("textarea", { class: "tp-textarea", spellcheck: "false", rows: attrs.rows || 8, ...attrs, value });
  const input = (attrs = {}) => el("input", { class: "tp-input", type: attrs.type || "text", ...attrs });
  const select = (options, value = "") => {
    const node = el("select", { class: "tp-select" });
    options.forEach((option) => {
      const [label, optionValue] = Array.isArray(option) ? option : [option, option];
      node.append(el("option", { value: optionValue, text: label, selected: String(optionValue) === String(value) }));
    });
    return node;
  };
  const option = (values, value) => select(values, value instanceof Node ? undefined : value);

  const button = (label, onclick, variant = "primary", attrs = {}) =>
    el("button", { type: "button", class: `tp-btn tp-btn-${variant}`, ...attrs, onclick }, label);

  const actions = (...children) => el("div", { class: "tp-actions" }, ...children);

  const twoCol = (...children) => el("div", { class: "tp-cols" }, ...children);

  const status = (root, message, kind = "ok") => {
    let node = $(".tp-status", root);
    if (!node) {
      node = el("p", { class: "tp-status", role: "status" });
      root.prepend(node);
    }
    node.className = `tp-status is-${kind}`;
    node.textContent = message;
    clearTimeout(node._timer);
    if (message) node._timer = setTimeout(() => { node.textContent = ""; node.className = "tp-status"; }, 6000);
  };

  const toast = (message, kind = "ok") => {
    if (window.ST && typeof window.ST.toast === "function") {
      window.ST.toast(message);
      return;
    }
    const node = $("#toast");
    if (!node) return;
    node.textContent = message;
    node.classList.toggle("is-error", kind === "error");
    node.classList.add("show");
    clearTimeout(node._timer);
    node._timer = setTimeout(() => node.classList.remove("show"), 4200);
  };

  const copy = async (value) => {
    const text = String(value ?? "");
    try {
      await navigator.clipboard.writeText(text);
      toast("Copied to clipboard.");
    } catch {
      const proxy = el("textarea", { class: "tp-copy-proxy", value: text });
      document.body.append(proxy);
      proxy.select();
      document.execCommand("copy");
      proxy.remove();
      toast("Copied to clipboard.");
    }
  };

  const copyButton = (getValue, label = "Copy") => button(label, async () => {
    const value = typeof getValue === "function" ? getValue() : getValue;
    if (!value) return toast("Nothing to copy yet.", "error");
    await copy(value);
  }, "ghost");

  const blobFor = (data, type = "text/plain") => data instanceof Blob ? data : new Blob([data], { type });

  const download = (filename, data, type = "text/plain") => {
    const url = URL.createObjectURL(blobFor(data, type));
    const anchor = el("a", { href: url, download: filename });
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const downloadButton = (label, getData, filename, type = "text/plain", variant = "primary") =>
    button(label, () => {
      const data = typeof getData === "function" ? getData() : getData;
      if (data === null || data === undefined || data === "") return toast("Nothing to download yet.", "error");
      download(typeof filename === "function" ? filename() : filename, data, type);
    }, variant);

  const fileDrop = (opts = {}) => {
    const fileInput = el("input", { type: "file", accept: opts.accept || "", hidden: true, multiple: Boolean(opts.multiple) });
    const name = el("span", { class: "tp-drop-name" });
    const zone = el("label", { class: "tp-drop" },
      el("span", { class: "tp-drop-icon", "aria-hidden": "true", text: opts.icon || "⇪" }),
      el("strong", { text: opts.label || "Drop a file here or click to browse" }),
      el("span", { class: "tp-hint", text: opts.hint || "Your file stays on this device." }),
      name,
      fileInput);
    const read = (files) => {
      if (!files.length) return;
      name.textContent = files.map((file) => file.name).join(" · ");
      opts.onFiles?.(files, fileInput);
    };
    fileInput.addEventListener("change", () => read([...fileInput.files]));
    zone.addEventListener("dragover", (event) => { event.preventDefault(); zone.classList.add("is-over"); });
    zone.addEventListener("dragleave", () => zone.classList.remove("is-over"));
    zone.addEventListener("drop", (event) => {
      event.preventDefault();
      zone.classList.remove("is-over");
      if (!event.dataTransfer?.files?.length) return;
      try { fileInput.files = event.dataTransfer.files; } catch {}
      read([...event.dataTransfer.files]);
    });
    return { node: zone, input: fileInput };
  };

  const bytesB64 = (bytes) => {
    let binary = "";
    const chunk = 0x8000;
    for (let index = 0; index < bytes.length; index += chunk) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
    }
    return btoa(binary);
  };
  const b64Bytes = (value) => {
    const clean = String(value).replace(/[\s\r\n=]/g, "").replace(/-/g, "+").replace(/_/g, "/");
    const padded = clean + "=".repeat((4 - (clean.length % 4)) % 4);
    const binary = atob(padded);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  };
  const textToB64 = (value) => bytesB64(new TextEncoder().encode(String(value)));
  const b64ToText = (value) => new TextDecoder().decode(b64Bytes(value));
  const hex = (bytes) => [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const bytesFromHex = (value) => {
    const clean = String(value).replace(/[^0-9a-f]/gi, "");
    const out = new Uint8Array(clean.length >> 1);
    for (let index = 0; index < out.length; index += 1) out[index] = parseInt(clean.slice(index * 2, index * 2 + 2), 16);
    return out;
  };
  const fmtBytes = (bytes) => {
    if (!Number.isFinite(bytes)) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
    return `${(bytes / 1073741824).toFixed(2)} GB`;
  };
  const readFile = (file, mode = "text") => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error("Could not read the file."));
    reader.onload = () => resolve(reader.result);
    if (mode === "buffer") reader.readAsArrayBuffer(file);
    else if (mode === "dataurl") reader.readAsDataURL(file);
    else reader.readAsText(file);
  });
  const fetchJSON = async (url) => {
    const response = await fetch(url, { credentials: "same-origin" });
    if (!response.ok) throw new Error(`Could not load ${url} (${response.status})`);
    return response.json();
  };
  const safeName = (name, fallback = "download") => (String(name || "")
    .replace(/[\\/:*?"<>|\r\n]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || fallback);
  const debounce = (fn, wait = 180) => {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), wait); };
  };
  const escapeHtml = (value) => String(value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  const register = (slug, mount) => { registry[slug] = mount; };

  const start = () => {
    const page = $("[data-tool-page]");
    if (!page) return;
    const slug = page.dataset.toolSlug;
    const root = $("#tool-root");
    const mount = registry[slug];
    if (!mount || !root) {
      if (root) root.replaceChildren(el("div", { class: "tp-error" },
        el("strong", { text: "This tool could not load." }),
        el("p", { text: "Refresh the page or open another tool." })));
      return;
    }
    try {
      mount(root);
    } catch (error) {
      console.error(error);
      root.replaceChildren(el("div", { class: "tp-error" },
        el("strong", { text: "This tool stopped unexpectedly." }),
        el("p", { text: error.message || "Refresh the page and try again." })));
    }
  };

  window.SANU_TOOLS = {
    register, start, el, $, $$, panel, field, textarea, input, select, option, button, actions,
    twoCol, status, toast, copy, copyButton, download, downloadButton, fileDrop,
    bytesB64, b64Bytes, textToB64, b64ToText, hex, bytesFromHex, fmtBytes, readFile,
    fetchJSON, safeName, debounce, escapeHtml, registry,
  };
})();
