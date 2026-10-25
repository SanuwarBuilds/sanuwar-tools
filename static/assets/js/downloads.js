"use strict";
(async () => {
  const { $, el, api, image, empty, open, url, toast, dateLabel } = ST;
  let items = [],
    selected = "All",
    kind = "all";
  const grid = $("#downloads-grid");
  const fileType = (file) => {
    let path = "";
    try {
      path = new URL(file.link || "", location.origin).pathname;
    } catch {}
    const ext = (
      (file.name || file.title || "").match(/\.([a-z0-9]{2,5})$/i)?.[1] ||
      path.match(/\.([a-z0-9]{2,5})$/i)?.[1] ||
      ""
    ).toLowerCase();
    if (
      /^(jpe?g|png|gif|webp|svg|avif|bmp)$/.test(ext) ||
      path.includes("/image/upload/")
    )
      return {
        kind: "image",
        label: "Photo",
        ext: ext.toUpperCase() || "IMAGE",
        icon: "▧",
      };
    if (/^(mp4|webm|mov|m4v)$/.test(ext))
      return {
        kind: "video",
        label: "Video",
        ext: ext.toUpperCase(),
        icon: "▷",
      };
    if (/^(mp3|wav|m4a|ogg)$/.test(ext))
      return {
        kind: "audio",
        label: "Audio",
        ext: ext.toUpperCase(),
        icon: "♫",
      };
    return {
      kind: "file",
      label:
        ext === "pdf"
          ? "PDF document"
          : /^(apk|aab)$/.test(ext)
            ? "Android app"
            : ext === "zip"
              ? "Archive"
              : "File",
      ext: ext.toUpperCase() || "FILE",
      icon:
        ext === "pdf"
          ? "PDF"
          : /^(apk|aab)$/.test(ext)
            ? "APP"
            : ext === "zip"
              ? "ZIP"
              : "↙",
    };
  };
  const thumbnail = (raw, alt) => {
    let source = raw;
    try {
      const parsed = new URL(raw, location.origin);
      if (
        parsed.hostname === "res.cloudinary.com" &&
        parsed.pathname.includes("/image/upload/")
      ) {
        parsed.pathname = parsed.pathname.replace(
          "/image/upload/",
          "/image/upload/f_auto,q_auto,w_480,c_limit/",
        );
        source = parsed.href;
      }
    } catch {}
    return image(source, alt);
  };
  const stamp = (file) => {
    const value = file.uploaded_at || file.created_at || file.added_at;
    const label = dateLabel(value);
    return label
      ? el(
          "time",
          { class: "file-date", datetime: value },
          `${file.uploaded_at ? "Uploaded" : "Added"} ${label}`,
        )
      : el(
          "span",
          { class: "file-date unknown-date" },
          "Upload date available nahi hai",
        );
  };
  function downloadLink(raw, title = "Download") {
    const safe = url(raw);
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
    return el(
      "a",
      {
        class: "button button-dark direct-download",
        href: parsed.href,
        target: "_blank",
        rel: "noopener noreferrer",
        download: "",
        "data-google-vignette": "false",
        onclick: () =>
          toast("Download link open hua. Browser mein download status dekho."),
      },
      title,
      el("span", {}, "↓"),
    );
  }
  const rupees = (value) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(value);
  function priceLabel(item) {
    if (!item.locked) return el("span", { class: "price-label" }, "Free");
    return el(
      "span",
      { class: "price-label" },
      ...(Number(item.pricing.discount) > 0
        ? [el("del", {}, rupees(item.pricing.price))]
        : []),
      rupees(item.pricing.payable),
      item.is_album ? " · Full album" : "",
    );
  }
  function buyButton(item) {
    let errorText;
    const button = el(
      "button",
      {
        class: "button button-dark",
        onclick: async () => {
          button.disabled = true;
          if (errorText) errorText.textContent = "";
          try {
            // Checkout never starts if the browser cannot retain its purchase receipt.
            localStorage.setItem("sanuwar-storage-check", "1");
            localStorage.removeItem("sanuwar-storage-check");
            const previous = localStorage.getItem(
              "sanuwar-item-order-" + item.id,
            );
            if (previous) {
              const saved = JSON.parse(
                localStorage.getItem("sanuwar-purchase-" + previous) || "null",
              );
              if (saved?.receipt) {
                const order = await api(`/api/payments/orders/${previous}`, {
                  headers: { Authorization: `Bearer ${saved.receipt}` },
                });
                if (order.status === "PAID") {
                  location.assign(`/purchase/${previous}`);
                  return;
                }
                if (order.status === "PENDING" && order.checkout_url) {
                  location.assign(`/purchase/${previous}`);
                  return;
                }
              }
            }
            const order = await api("/api/payments/orders", {
              method: "POST",
              body: JSON.stringify({ item_id: item.id }),
            });
            localStorage.setItem(
              "sanuwar-purchase-" + order.order_id,
              JSON.stringify(order),
            );
            localStorage.setItem(
              "sanuwar-item-order-" + item.id,
              order.order_id,
            );
            location.assign(`/purchase/${order.order_id}`);
          } catch (e) {
            if (!errorText) {
              errorText = el("p", {
                class: "form-error purchase-error",
                role: "alert",
              });
              button.insertAdjacentElement("afterend", errorText);
            }
            errorText.textContent = e.message;
          } finally {
            button.disabled = false;
          }
        },
      },
      `Buy · ${rupees(item.pricing.payable)}`,
      el("span", {}, "↗"),
    );
    return button;
  }
  function fileAction(item, file = item, index = 0) {
    if (item.locked) return buyButton(item);
    if (!file.private_delivery) return downloadLink(file.link);
    const button = el(
      "button",
      {
        class: "button button-dark",
        onclick: async () => {
          button.disabled = true;
          try {
            const result = await api(
              `/api/downloads/${encodeURIComponent(item.id)}/file`,
              { method: "POST", body: JSON.stringify({ index }) },
            );
            const link = url(result.url);
            if (link) location.assign(link);
          } catch (e) {
            toast(e.message);
          } finally {
            button.disabled = false;
          }
        },
      },
      "Download ↓",
    );
    return button;
  }
  const viewer = el("dialog", {
    class: "media-viewer",
    "aria-labelledby": "media-title",
  });
  document.body.append(viewer);
  let mediaFiles = [],
    mediaIndex = 0;
  viewer.addEventListener("close", () => {
    viewer.replaceChildren();
    if (!$("#content-dialog").open)
      document.body.classList.remove("modal-open");
  });
  viewer.addEventListener("click", (event) => {
    if (event.target === viewer) {
      const r = viewer.getBoundingClientRect();
      if (
        event.clientX < r.left ||
        event.clientX > r.right ||
        event.clientY < r.top ||
        event.clientY > r.bottom
      )
        viewer.close();
    }
  });
  function showMedia(files, index) {
    mediaFiles = files;
    mediaIndex = index;
    const file = files[index],
      type = fileType(file),
      safe = url(file.link);
    const name = file.name || file.title || `File ${index + 1}`;
    const stage = el("div", { class: "media-stage" });
    if (type.kind === "image") stage.append(image(file.link, name));
    else if ((type.kind === "video" || type.kind === "audio") && safe) {
      const media = el(type.kind, {
        src: safe,
        controls: true,
        preload: "metadata",
        "aria-label": name,
        playsinline: true,
      });
      media.addEventListener(
        "error",
        () =>
          stage.replaceChildren(
            el(
              "p",
              {},
              "Preview load nahi hua. Original file open ya download karo.",
            ),
          ),
        { once: true },
      );
      stage.append(media);
    } else
      stage.append(
        el(
          "div",
          { class: "file-type-preview" },
          el("strong", {}, type.icon),
          el("p", {}, type.label),
          ST.external(file.link, "Open original", "button button-light"),
        ),
      );
    const prev = el(
      "button",
      {
        class: "button button-light",
        type: "button",
        disabled: index === 0,
        onclick: () => showMedia(files, index - 1),
        "aria-label": "Previous file",
      },
      "← Previous",
    );
    const next = el(
      "button",
      {
        class: "button button-light",
        type: "button",
        disabled: index === files.length - 1,
        onclick: () => showMedia(files, index + 1),
        "aria-label": "Next file",
      },
      "Next →",
    );
    viewer.replaceChildren(
      el(
        "div",
        { class: "dialog-head" },
        el(
          "div",
          {},
          el(
            "span",
            { class: "eyebrow" },
            `${type.label} · ${index + 1} / ${files.length}`,
          ),
          el("h2", { id: "media-title" }, name),
        ),
        el(
          "button",
          {
            class: "icon-button",
            type: "button",
            "aria-label": "Close file preview",
            onclick: () => viewer.close(),
          },
          "×",
        ),
      ),
      stage,
      stamp(file),
      el(
        "div",
        { class: "media-actions" },
        prev,
        downloadLink(file.link),
        next,
      ),
    );
    if (!viewer.open) {
      document.body.classList.add("modal-open");
      viewer.showModal();
    }
  }
  function openAlbum(item) {
    if (item.locked) {
      open(
        item.title,
        [
          ...(item.image
            ? [image(item.image, item.title, "dialog-preview")]
            : []),
          priceLabel(item),
          el(
            "p",
            { class: "dialog-description" },
            item.description ||
              "Poore album ke files ek purchase mein unlock honge.",
          ),
          el(
            "div",
            { class: "locked-file-list" },
            ...(item.album_files || []).map((file) =>
              el("div", {}, "▣ ", file.name),
            ),
          ),
          buyButton(item),
          el(
            "p",
            { class: "form-note" },
            "Payment verify hone ke baad sab files download kar sakte ho.",
          ),
        ],
        "PAID ALBUM",
      );
      return;
    }
    const files = item.album_files || [],
      gallery = el("div", { class: "album-gallery" });
    const search = el("input", {
      type: "search",
      placeholder: "Is album mein file dhoondo…",
      "aria-label": "Search album files",
    });
    const count = el("span", { class: "album-count", role: "status" });
    const draw = () => {
      const q = search.value.trim().toLowerCase();
      const visible = files
        .map((file, index) => ({ file, index }))
        .filter(({ file }) =>
          `${file.name || ""} ${fileType(file).label}`
            .toLowerCase()
            .includes(q),
        );
      count.textContent = `${visible.length} of ${files.length} files · Tap a preview to see it bigger`;
      gallery.replaceChildren(
        ...visible.map(({ file, index }) => {
          const type = fileType(file),
            name = file.name || `File ${index + 1}`;
          const preview = el(
            "button",
            {
              type: "button",
              class: "album-preview",
              "aria-label": `Preview ${name}`,
              onclick: () =>
                file.private_delivery
                  ? toast("Private file ka preview download ke baad dekho.")
                  : showMedia(files, index),
            },
            ...(type.kind === "image"
              ? [thumbnail(file.link, name)]
              : [
                  el(
                    "span",
                    { class: "file-type-icon", "aria-hidden": "true" },
                    type.icon,
                  ),
                ]),
            el("span", { class: "preview-type" }, type.ext),
            el("span", { class: "preview-hint" }, "Preview ↗"),
          );
          return el(
            "article",
            { class: "album-file-card" },
            preview,
            el(
              "div",
              { class: "album-file-info" },
              el("h3", {}, name),
              stamp(file),
              fileAction(item, file, index),
            ),
          );
        }),
      );
      if (!visible.length)
        empty(
          gallery,
          "Koi file nahi mili.",
          "File name badal kar search karo.",
        );
    };
    search.addEventListener("input", draw);
    draw();
    open(
      item.title,
      [
        el(
          "div",
          { class: "album-intro" },
          stamp(item),
          el(
            "p",
            {},
            "Photo par tap karke dekho, phir apni pasand ki file download karo.",
          ),
        ),
        ...(files.length > 6
          ? [
              el(
                "label",
                { class: "search-box album-search" },
                el("span", {}, "⌕"),
                search,
              ),
            ]
          : []),
        count,
        gallery,
      ],
      `ALBUM · ${files.length} FILES`,
    );
    $("#content-dialog").classList.add("album-dialog");
  }
  function detail(item) {
    if (item.is_album) return openAlbum(item);
    $("#content-dialog").classList.remove("album-dialog");
    const type = fileType(item);
    const nodes = [
      ...(item.image ? [image(item.image, item.title, "dialog-preview")] : []),
      el("p", { class: "dialog-description" }, item.description || type.label),
      stamp(item),
      el(
        "div",
        { class: "dialog-meta" },
        el("span", { class: "tag" }, item.category || "Files"),
        ...(item.version
          ? [el("span", { class: "tag" }, `Version ${item.version}`)]
          : []),
      ),
    ];
    const safe = url(item.link);
    if (safe)
      nodes.push(
        el(
          "p",
          { class: "dialog-description" },
          `Source: ${new URL(safe).hostname}`,
        ),
      );
    if (type.kind !== "file" && !item.locked && !item.private_delivery)
      nodes.push(
        el(
          "button",
          { class: "button button-light", onclick: () => showMedia([item], 0) },
          "Preview file ↗",
        ),
      );
    nodes.push(priceLabel(item), fileAction(item));
    open(item.title, nodes, "FILE DETAILS");
  }
  function render() {
    const q = $("#download-search").value.trim().toLowerCase();
    const filtered = items.filter(
      (item) =>
        (selected === "All" || (item.category || "Files") === selected) &&
        (kind === "all" ||
          (kind === "albums" ? item.is_album : !item.is_album)) &&
        `${item.title} ${item.description || ""} ${item.category || ""} ${(item.album_files || []).map((f) => f.name).join(" ")}`
          .toLowerCase()
          .includes(q),
    );
    const sort = $("#download-sort").value;
    const time = (item) =>
      Date.parse(item.created_at || item.uploaded_at || "") || 0;
    if (sort === "alpha")
      filtered.sort((a, b) => a.title.localeCompare(b.title));
    if (sort === "default") filtered.sort((a, b) => time(b) - time(a));
    if (sort === "oldest")
      filtered.sort((a, b) => (time(a) || Infinity) - (time(b) || Infinity));
    const cats = ["All", ...new Set(items.map((i) => i.category || "Files"))];
    const category = $("#download-category");
    category.replaceChildren(...cats.map(cat => el("option", {value:cat}, cat === "All" ? "Category" : cat)));
    category.value = selected;
    document.querySelectorAll("[data-kind]").forEach((button) => {
      button.classList.toggle("active", button.dataset.kind === kind);
      button.setAttribute("aria-pressed", String(button.dataset.kind === kind));
    });
    $("#download-count").textContent =
      `${filtered.length} of ${items.length} items`;
    if (!filtered.length)
      return empty(
        grid,
        "Koi result nahi mila.",
        "Search ya category badal kar dekho.",
        () => {
          $("#download-search").value = "";
          selected = "All";
          kind = "all";
          render();
        },
      );
    grid.replaceChildren(
      ...filtered.map((item, index) => {
        const cover =
          item.image ||
          (item.is_album
            ? (item.album_files || []).find(
                (file) => fileType(file).kind === "image",
              )?.link
            : "");
        const thumb = el(
          "button",
          {
            class: `card-visual tone-${index % 4}`,
            type: "button",
            "aria-label": `${item.is_album ? "Open album" : "Preview"} ${item.title}`,
            onclick: () => detail(item),
          },
          thumbnail(cover, item.title),
          el(
            "span",
            { class: "card-badge" },
            item.is_album
              ? `${(item.album_files || []).length} files`
              : item.category || "File",
          ),
        );
        const title = el(
          "h3",
          {},
          el(
            "button",
            {
              class: "download-title",
              type: "button",
              onclick: () => detail(item),
            },
            item.title,
          ),
        );
        const action = item.is_album
          ? el(
              "button",
              { class: "button button-light", onclick: () => openAlbum(item) },
              "View album",
              el("span", {}, "↗"),
            )
          : fileAction(item);
        return el(
          "article",
          { class: "tool-card download-card" },
          thumb,
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
                item.version || (item.is_album ? "ALBUM" : "FILE"),
              ),
            ),
            title,
            el("p", { class: "download-description" }, item.description || ""),
            stamp(item),
            priceLabel(item),
            el(
              "div",
              { class: "card-bottom" },
              action,
              ...(!item.is_album
                ? [
                    el(
                      "button",
                      {
                        class: "info-button",
                        "aria-label": `Details for ${item.title}`,
                        onclick: () => detail(item),
                      },
                      "i",
                    ),
                  ]
                : []),
            ),
          ),
        );
      }),
    );
  }
  $("#download-search").addEventListener("input", render);
  $("#download-sort").addEventListener("change", render);
  $("#download-category").addEventListener("change", (event) => { selected = event.target.value; render(); });
  document.querySelectorAll("[data-kind]").forEach((button) =>
    button.addEventListener("click", () => {
      kind = button.dataset.kind;
      selected = "All";
      render();
    }),
  );
  async function load() {
    try {
      items = await api("/api/downloads_data");
      const albums = items.filter((i) => i.is_album).length;
      $("#collection-stats").replaceChildren(
        el("strong", {}, items.length),
        el("span", {}, "items"),
        el("span", {}, "·"),
        el("strong", {}, albums),
        el("span", {}, "albums"),
      );
      render();
    } catch (error) {
      empty(grid, "Collection unavailable.", error.message, load, "Try again");
    }
  }
  await load();
})();
