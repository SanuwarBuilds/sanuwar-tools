"use strict";
(async () => {
  const { $, el, api, image, external, empty, tabs, open, toast } = ST;
  let tools = [], selected = "All";
  const grid = $("#tools-grid");
  const ICON_NAMES = new Set(["photo", "passport", "score", "wallet", "tool", "download", "album", "film", "anime", "manga", "sports", "tv", "torrent", "game", "music", "ebook", "comics", "drama", "vpn", "shield"]);
  const kindFor = (text) =>
    text.includes("passport") ? "passport" :
    text.includes("photo") ? "photo" :
    text.includes("cricket") ? "score" :
    text.includes("expense") || text.includes("budget") ? "wallet" :
    text.includes("movie") || text.includes("tv show") ? "film" :
    text.includes("anime") ? "anime" :
    text.includes("manga") ? "manga" :
    text.includes("sport") ? "sports" :
    text.includes("live tv") ? "tv" :
    text.includes("torrent") ? "torrent" :
    text.includes("game") ? "game" :
    text.includes("music") ? "music" :
    text.includes("ebook") ? "ebook" :
    text.includes("comic") ? "comics" :
    text.includes("drama") ? "drama" :
    text.includes("vpn") ? "vpn" :
    text.includes("adblock") ? "shield" : "";
  const iconFor = (tool) => {
    if (tool.kind !== "tool") return tool.kind === "album" ? "album" : "download";
    if (ICON_NAMES.has(tool.icon)) return tool.icon;
    const name = tool.name.toLowerCase();
    const tags = Array.isArray(tool.tags) ? tool.tags.join(" ").toLowerCase() : "";
    return kindFor(name) || kindFor(tags) || "tool";
  };
  const routeFor = (tool) =>
    typeof tool.route === "string" && tool.route.startsWith("/") &&
    !tool.route.startsWith("//") && !/[\\\r\n]/.test(tool.route) ? tool.route : "";
  const toolLink = (tool, text, className = "text-link catalogue-open") => {
    const path = routeFor(tool);
    return path
      ? el("a", { href: path, class: className }, text, el("span", {}, "→"))
      : external(tool.siteUrl, text, className);
  };
  const render = () => {
    const query = $("#tool-search").value.trim().toLowerCase();
    const filtered = tools.filter((t) =>
      (selected === "All" || t.category === selected) &&
      `${t.name} ${t.description || ""} ${t.category || ""} ${(t.tags || []).join(" ")}`.toLowerCase().includes(query));
    const cats = ["All", ...new Set(tools.map(t => t.category).filter(Boolean))];
    tabs($("#categories"), cats, selected, (cat) => { selected = cat; render(); }, Object.fromEntries(cats.map(cat => [cat, cat === "All" ? tools.length : tools.filter(tool => tool.category === cat).length])));
    const tabRow = $("#categories");
    const activeTab = tabRow?.querySelector(".filter-tab.active");
    if (tabRow && activeTab) {
      const rowBox = tabRow.getBoundingClientRect();
      const tabBox = activeTab.getBoundingClientRect();
      if (tabBox.left < rowBox.left) tabRow.scrollLeft -= rowBox.left - tabBox.left + 8;
      else if (tabBox.right > rowBox.right) tabRow.scrollLeft += tabBox.right - rowBox.right + 8;
    }
    $("#tool-total").textContent = filtered.length;
    if (!filtered.length) return empty(grid, "No matches found.", "Try another search or browse the full collection.", () => {
      $("#tool-search").value = ""; selected = "All"; render();
    });
    grid.replaceChildren(...filtered.map((tool) => {
      const isTool = tool.kind === "tool";
      const label = isTool ? "Web tool" : tool.kind === "album" ? "Album" : "Download";
      const measuredLink = link => { if (link.tagName === "A") { link.querySelectorAll("span").forEach(node => node.remove()); link.dataset.analyticsKind = "tool_open"; link.dataset.analyticsItem = tool.id; } return link; };
      const info = () => open(tool.name, [
        image(tool.thumbnail, tool.name, "dialog-preview"),
        el("p", {class: "dialog-description"}, tool.longDescription || tool.description || "Open this tool to get started."),
        el("div", {class: "dialog-meta"}, ...(tool.tags || []).map(tag => el("span", {class: "tag"}, tag))),
        measuredLink(toolLink(tool, "Open tool", "button button-orange")),
      ], tool.category || "WEB TOOL");
      const action = isTool ? toolLink(tool, "Open tool", "text-link catalogue-open") :
        el("a", {href: `/downloads?item=${encodeURIComponent(tool.id)}`, class: "text-link catalogue-open", "data-google-vignette": "false"}, tool.kind === "album" ? "View album" : "View download");
      measuredLink(action);
      const badge = isTool
        ? tool.popular
          ? el("span", {class: "catalogue-badge"}, "Popular")
          : tool.featured
            ? el("span", {class: "catalogue-badge"}, "Featured")
            : null
        : el("span", {class: "catalogue-badge"}, tool.locked ? `₹${tool.pricing.payable}` : "Free");
      return el("article", {class: "tool-card catalogue-card"},
        el("div", {class: "catalogue-card-top"},
          el("img", {class: "catalogue-icon", src: `/assets/icons/${iconFor(tool)}.svg?v=keys1`, alt: "", width: "48", height: "48"}),
          ...(badge ? [badge] : [])),
        el("div", {class: "card-body"},
          el("span", {class: "catalogue-type"}, tool.category || label),
          el("h3", {}, tool.name),
          el("p", {}, tool.description || (tool.kind === "album" ? "Explore the files inside this album." : "View details and choose what you need.")),
          el("div", {class: "card-bottom"}, action, ...(isTool ? [el("button", {class: "info-button", "aria-label": `Details about ${tool.name}`, onclick: info}, "i")] : []))));
    }));
  };
  async function widgets() {
    try {
      const items = await api("/api/widgets");
      $("#widgets").replaceChildren(
        ...items.map((w) => {
          const d = w.data || {};
          const card = el(
            "article",
            { class: "widget-card" },
            el(
              "span",
              { class: "eyebrow" },
              w.type === "poll" ? "HAVE YOUR SAY" : "FROM THE WORKSPACE",
            ),
            el(
              "h3",
              {},
              d.title ||
                d.question ||
                d.name ||
                d.winner_name ||
                d.heading ||
                (w.type === "quote"
                  ? "A thought for today."
                  : "Something useful"),
            ),
            el(
              "p",
              {},
              d.description ||
                d.message ||
                d.bio ||
                d.content ||
                d.text ||
                (w.type === "ticker" ? (d.messages || []).join(" • ") : ""),
            ),
          );
          if (d.image || d.image_url || d.photo_url)
            card.append(
              image(
                d.image || d.image_url || d.photo_url,
                d.title || d.name || "",
              ),
            );
          if (w.type === "event_card")
            card.append(
              el(
                "p",
                { class: "widget-credit" },
                [d.date, d.time, d.venue].filter(Boolean).join(" · "),
              ),
            );
          if (d.author || d.role || d.event_name)
            card.append(
              el(
                "span",
                { class: "widget-credit" },
                d.author || d.role || d.event_name,
              ),
            );
          if (w.type === "custom_html") card.append(el("p", {}, d.html || ""));
          if (w.type === "gallery")
            card.append(
              el(
                "div",
                { class: "widget-gallery" },
                ...(d.images || []).map((img) =>
                  image(
                    typeof img === "string" ? img : img.url,
                    img.caption || d.title || "Gallery image",
                  ),
                ),
              ),
            );
          if (d.url || d.link)
            card.append(
              external(
                d.url || d.link,
                d.button_text || "Explore",
                "button button-dark",
              ),
            );
          if (w.type === "poll") {
            (d.options || []).forEach((option) => {
              const button = el(
                "button",
                {
                  class: "poll-option",
                  onclick: async () => {
                    button.disabled = true;
                    try {
                      const result = await api(
                        `/api/widgets/${encodeURIComponent(w.id)}/vote`,
                        {
                          method: "POST",
                          body: JSON.stringify({ option_id: option.id }),
                        },
                      );
                      card.querySelectorAll(".poll-option").forEach((b, i) => {
                        b.disabled = true;
                        b.textContent = `${result.options[i].text || result.options[i].label || "Option"} · ${result.options[i].votes || 0} votes`;
                      });
                      toast("Vote saved. Thank you!");
                    } catch (error) {
                      toast(error.message);
                      button.disabled = false;
                    }
                  },
                },
                option.text || option.label || "Vote",
              );
              card.append(button);
            });
          }
          return card;
        }),
      );
    } catch {
      /* The main catalogue remains usable if optional widgets are unavailable. */
    }
  }
  $("#tool-search").addEventListener("input", render);
  async function load() {
    try {
      const [config, browserFeed] = await Promise.all([
        api("/tools.config.json"),
        api("/api/browser-tools.json").catch(() => ({ tools: [] })),
      ]);
      const curated = (config.tools || []).filter((t) => t.visible !== false);
      const browserTools = (browserFeed.tools || []).filter((t) => t.visible !== false);
      tools = [...curated, ...browserTools].map(t => ({...t, kind: "tool"}));
      render();
      await widgets();
    } catch (error) {
      empty(grid, "Toolkit unavailable.", error.message, load, "Try again");
    }
  }
  await load();
})();
