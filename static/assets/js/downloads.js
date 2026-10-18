"use strict";
(async () => {
  const { $, el, api, image, empty, tabs, open, url, toast } = ST;
  let items = [],
    selected = "All";
  const grid = $("#downloads-grid");
  function downloadLink(raw, title) {
    let safe = url(raw);
    if (!safe) return el("span", { class: "tag" }, "Link unavailable");
    const parsed = new URL(safe);
    if (
      parsed.hostname === "res.cloudinary.com" &&
      parsed.pathname.includes("/upload/") &&
      !parsed.pathname.includes("fl_attachment")
    )
      parsed.pathname = parsed.pathname.replace(
        "/upload/",
        "/upload/fl_attachment/",
      );
    safe = parsed.href;
    return el(
      "a",
      {
        class: "button button-dark",
        href: safe,
        target: "_blank",
        rel: "noopener noreferrer",
        download: "",
        onclick: () =>
          toast(
            "Download link open ho gaya. Browser ya file host par status dekho.",
          ),
      },
      title,
      el("span", {}, "↓"),
    );
  }
  function detail(item) {
    const nodes = [
      el(
        "p",
        { class: "dialog-description" },
        item.description || "Download ki details neeche hain.",
      ),
      el(
        "div",
        { class: "dialog-meta" },
        el("span", { class: "tag" }, item.category || "Files"),
        ...(item.version
          ? [el("span", { class: "tag" }, `Version ${item.version}`)]
          : []),
      ),
    ];
    if (item.is_album) {
      const files = el("div", { class: "album-files" });
      (item.album_files || []).forEach((file, index) =>
        files.append(
          el(
            "div",
            { class: "album-file" },
            el(
              "span",
              {},
              `${String(index + 1).padStart(2, "0")} / ${file.name || `File ${index + 1}`}`,
            ),
            downloadLink(file.link, "Download"),
          ),
        ),
      );
      nodes.push(files);
      if (!item.album_files?.length)
        nodes.push(el("p", {}, "Is album mein abhi koi file nahi hai."));
    } else {
      const safe = url(item.link);
      if (safe) {
        const host = new URL(safe).hostname;
        nodes.push(
          el(
            "p",
            { class: "dialog-description" },
            `Source: ${host}. File external host se download hogi. Host ke hisaab se file direct save hogi ya download page khulega.`,
          ),
        );
      }
      nodes.push(downloadLink(item.link, "Continue to download"));
    }
    open(
      item.title,
      nodes,
      item.is_album
        ? `ALBUM / ${(item.album_files || []).length} FILES`
        : "DOWNLOAD DETAILS",
    );
  }
  function render() {
    const q = $("#download-search").value.trim().toLowerCase();
    let filtered = items.filter(
      (i) =>
        (selected === "All" || (i.category || "Files") === selected) &&
        `${i.title} ${i.description || ""} ${i.category || ""}`
          .toLowerCase()
          .includes(q),
    );
    const sort = $("#download-sort").value;
    if (sort === "alpha")
      filtered.sort((a, b) => a.title.localeCompare(b.title));
    if (sort === "albums")
      filtered.sort(
        (a, b) => Number(Boolean(b.is_album)) - Number(Boolean(a.is_album)),
      );
    if (sort === "apps")
      filtered.sort(
        (a, b) => Number(Boolean(a.is_album)) - Number(Boolean(b.is_album)),
      );
    const cats = ["All", ...new Set(items.map((i) => i.category || "Files"))];
    const counts = Object.fromEntries(
      cats.map((c) => [
        c,
        c === "All"
          ? items.length
          : items.filter((i) => (i.category || "Files") === c).length,
      ]),
    );
    tabs(
      $("#download-categories"),
      cats,
      selected,
      (c) => {
        selected = c;
        render();
      },
      counts,
    );
    $("#download-count").textContent =
      `${filtered.length} of ${items.length} items`;
    if (!filtered.length)
      return empty(
        grid,
        "No finds this time.",
        "Search badal kar dekho ya filters clear karo.",
        () => {
          selected = "All";
          $("#download-search").value = "";
          render();
        },
      );
    grid.replaceChildren(
      ...filtered.map((item, index) =>
        el(
          "article",
          { class: "tool-card" },
          el(
            "div",
            { class: `card-visual tone-${index % 4}` },
            image(item.image, item.title),
            el(
              "span",
              { class: "card-badge" },
              item.is_album
                ? `▧ ALBUM · ${(item.album_files || []).length} FILES`
                : "↓ DOWNLOAD",
            ),
          ),
          el(
            "div",
            { class: "card-body" },
            el(
              "div",
              { class: "card-topline" },
              el("span", {}, item.category || "Files"),
              el(
                "span",
                {},
                item.version
                  ? `V${item.version.replace(/^v/i, "")}`
                  : item.is_album
                    ? "COLLECTION"
                    : "FILE",
              ),
            ),
            el("h3", {}, item.title),
            el(
              "p",
              {},
              item.description ||
                (item.is_album
                  ? "Memories, ek jagah. Album open karke individual files dekho."
                  : "Details dekho aur file ko apne device par download karo."),
            ),
            el(
              "div",
              { class: "card-bottom" },
              el(
                "button",
                {
                  class: `button ${item.is_album ? "button-light" : "button-dark"}`,
                  onclick: () => detail(item),
                },
                item.is_album ? "Explore album" : "Get download",
                el("span", {}, item.is_album ? "↗" : "↓"),
              ),
            ),
          ),
        ),
      ),
    );
  }
  $("#download-search").addEventListener("input", render);
  $("#download-sort").addEventListener("change", render);
  async function load() {
    try {
      items = await api("/api/downloads_data");
      const albums = items.filter((i) => i.is_album).length;
      const files = items.reduce(
        (n, i) => n + (i.is_album ? (i.album_files || []).length : 1),
        0,
      );
      $("#collection-stats").replaceChildren(
        ...[
          [items.length, "In the collection"],
          [items.length - albums, "Apps & files"],
          [albums, "Curated albums"],
          [files, "Individual files"],
        ].map(([count, label]) =>
          el(
            "div",
            { class: "collection-stat" },
            el("strong", {}, String(count).padStart(2, "0")),
            el("span", {}, label),
          ),
        ),
      );
      render();
    } catch (error) {
      empty(grid, "Collection unavailable.", error.message, load, "Try again");
    }
  }
  await load();
})();
