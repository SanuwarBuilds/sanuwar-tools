"use strict";
(async () => {
  const { $, el, api, image, external, empty, tabs, open, toast } = ST;
  let config, tools = [], selected = "All";
  const grid = $("#tools-grid");
  const iconFor = (tool) => {
    if (tool.kind !== "tool") return tool.kind === "album" ? "album" : "download";
    const name = tool.name.toLowerCase();
    return name.includes("photo") ? "photo" : name.includes("cricket") ? "score" : name.includes("expense") ? "wallet" : "tool";
  };
  const render = () => {
    const query = $("#tool-search").value.trim().toLowerCase();
    const filtered = tools.filter((t) =>
      (selected === "All" || t.category === selected) &&
      `${t.name} ${t.description || ""} ${t.category || ""} ${(t.tags || []).join(" ")}`.toLowerCase().includes(query));
    const cats = ["All", ...new Set(tools.map(t => t.category).filter(Boolean))];
    tabs($("#categories"), cats, selected, (cat) => { selected = cat; render(); }, Object.fromEntries(cats.map(cat => [cat, cat === "All" ? tools.length : tools.filter(tool => tool.category === cat).length])));
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
        measuredLink(external(tool.siteUrl, "Open tool", "button button-orange")),
      ], tool.category || "WEB TOOL");
      const action = isTool ? external(tool.siteUrl, "Open tool", "text-link catalogue-open") :
        el("a", {href: `/downloads?item=${encodeURIComponent(tool.id)}`, class: "text-link catalogue-open", "data-google-vignette": "false"}, tool.kind === "album" ? "View album" : "View download");
      measuredLink(action);
      return el("article", {class: "tool-card catalogue-card"},
        el("div", {class: "catalogue-card-top"},
          el("img", {class: "catalogue-icon", src: `/assets/icons/${iconFor(tool)}.svg`, alt: "", width: "48", height: "48"}),
          ...(!isTool || tool.featured ? [el("span", {class: "catalogue-badge"}, isTool ? "Featured" : tool.locked ? `₹${tool.pricing.payable}` : "Free")] : [])),
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
                      toast("Vote save ho gaya. Thank you!");
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
      config = await api("/tools.config.json");
      tools = (config.tools || []).filter((t) => t.visible !== false).map(t => ({...t, kind: "tool"}));
      render();
      await widgets();
    } catch (error) {
      empty(grid, "Toolkit unavailable.", error.message, load, "Try again");
    }
  }
  await load();
})();
