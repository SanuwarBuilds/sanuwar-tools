"use strict";
window.ST = (() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const el = (tag, attrs = {}, ...children) => {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value === null || value === undefined || value === false) return;
      if (key === "class") node.className = value;
      else if (key.startsWith("on") && typeof value === "function")
        node.addEventListener(key.slice(2), value);
      else if (key === "text") node.textContent = value;
      else if (key === "checked") node.checked = Boolean(value);
      else node.setAttribute(key, value === true ? "" : value);
    });
    children.flat(Infinity).forEach((child) => {
      if (child !== null && child !== undefined)
        node.append(child instanceof Node ? child : String(child));
    });
    return node;
  };
  const url = (value, image = false) => {
    if (typeof value !== "string" || !value) return "";
    if (
      image &&
      /^data:image\/(png|jpeg|webp|svg\+xml);base64,[a-z0-9+/=\s]+$/i.test(
        value,
      )
    )
      return value;
    try {
      const u = new URL(value, location.origin);
      if (u.username || u.password || /[\\\r\n]/.test(value)) return "";
      return u.protocol === "https:" ||
        (u.origin === location.origin && value.startsWith("/"))
        ? u.href
        : "";
    } catch {
      return "";
    }
  };
  let timer;
  const toast = (message) => {
    const node = $("#toast");
    node.textContent = message;
    node.classList.add("show");
    clearTimeout(timer);
    timer = setTimeout(() => node.classList.remove("show"), 5000);
  };
  const api = async (path, options = {}) => {
    const headers = { ...options.headers };
    if (options.body && !(options.body instanceof FormData))
      headers["Content-Type"] = "application/json";
    if (options.method && options.method !== "GET")
      headers["X-CSRF-Token"] = $('meta[name="csrf-token"]').content;
    const response = await fetch(path, {
      credentials: "same-origin",
      ...options,
      headers,
    });
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error("Server se response nahi mila. Dobara try karo.");
    }
    if (!response.ok) {
      if (response.status === 401 && location.pathname === "/admin") {
        location.assign("/admin/login");
      }
      throw new Error(data.error || "Request failed. Please try again.");
    }
    return data;
  };
  const image = (src, alt, className = "") => {
    const safe = url(src, true);
    if (!safe)
      return el(
        "span",
        { class: "card-fallback", "aria-hidden": "true" },
        "s",
      );
    const img = el("img", {
      src: safe,
      alt,
      loading: "lazy",
      decoding: "async",
      class: className,
    });
    img.addEventListener(
      "error",
      () =>
        img.replaceWith(
          el("span", { class: "card-fallback", "aria-hidden": "true" }, "s"),
        ),
      { once: true },
    );
    return img;
  };
  const external = (href, text, className = "text-link") => {
    const safe = url(href);
    return safe
      ? el(
          "a",
          {
            href: safe,
            target: "_blank",
            rel: "noopener noreferrer",
            class: className,
          },
          text,
          el("span", {}, "↗"),
        )
      : el("span", { class: "tag" }, "Link unavailable");
  };
  const empty = (node, title, description, action, label = "Clear filters") =>
    node.replaceChildren(
      el(
        "div",
        { class: "empty-state" },
        el("h3", {}, title),
        el("p", {}, description),
        ...(action
          ? [
              el(
                "button",
                { class: "button button-light", onclick: action },
                label,
              ),
            ]
          : []),
      ),
    );
  const tabs = (node, categories, active, onChange, counts = {}) =>
    node.replaceChildren(
      ...categories.map((category) =>
        el(
          "button",
          {
            class: `filter-tab${category === active ? " active" : ""}`,
            "aria-pressed": String(category === active),
            onclick: () => onChange(category),
          },
          category,
          ...(counts[category] !== undefined
            ? [el("span", {}, counts[category])]
            : []),
        ),
      ),
    );
  const dialog = $("#content-dialog");
  const close = () => {
    dialog.close();
    document.body.classList.remove("modal-open");
  };
  dialog?.addEventListener("close", () =>
    document.body.classList.remove("modal-open"),
  );
  $("[data-close-dialog]")?.addEventListener("click", close);
  dialog?.addEventListener("click", (event) => {
    if (event.target === dialog) {
      const box = dialog.getBoundingClientRect();
      if (
        event.clientX < box.left ||
        event.clientX > box.right ||
        event.clientY < box.top ||
        event.clientY > box.bottom
      )
        close();
    }
  });
  const open = (title, children, kicker = "A CLOSER LOOK") => {
    $("#dialog-title").textContent = title;
    $("#dialog-kicker").textContent = kicker;
    $("#dialog-body").replaceChildren(...children);
    document.body.classList.add("modal-open");
    dialog.showModal();
  };
  try {
    document.documentElement.dataset.theme =
      localStorage.getItem("sanuwartools-theme") ||
      document.documentElement.dataset.theme ||
      "light";
  } catch {}
  $("#theme-toggle")?.addEventListener("click", () => {
    const next =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("sanuwartools-theme", next);
    } catch {}
  });
  const menu = $(".menu-toggle");
  menu?.addEventListener("click", () => {
    const expanded = menu.getAttribute("aria-expanded") !== "true";
    menu.setAttribute("aria-expanded", String(expanded));
    $("#site-nav").classList.toggle("open", expanded);
  });
  $("#site-nav")?.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      $("#site-nav").classList.remove("open");
      menu.setAttribute("aria-expanded", "false");
    }
  });
  document.addEventListener("keydown", (event) => {
    if (
      event.key === "/" &&
      !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)
    ) {
      const search = $('input[type="search"]');
      if (search) {
        event.preventDefault();
        search.focus();
      }
    }
  });
  const dateLabel = (value) => {
    if (!value || !/(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return "";
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "";
    return (
      new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Kolkata",
      }).format(date) + " IST"
    );
  };
  return {
    $,
    el,
    url,
    toast,
    api,
    image,
    external,
    empty,
    tabs,
    open,
    close,
    dateLabel,
  };
})();
