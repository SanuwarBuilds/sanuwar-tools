"use strict";
(async () => {
  const { $, el, api, image, toast, open, close, empty } = ST;
  const root = $("#admin-view");
  let config,
    downloads = [],
    widgets = [],
    store = [],
    current = "dashboard";
  const titles = {
    dashboard: [
      "Overview",
      "A LITTLE PROGRESS, EVERY DAY",
      "Your workspace, at a glance.",
      "Everything you need to keep your toolkit moving.",
      "Add a tool",
    ],
    tools: [
      "Tools",
      "THE EVERYDAY TOOLKIT",
      "Useful things, thoughtfully organised.",
      "Add, edit aur organise the tools your visitors use.",
      "Add a tool",
    ],
    downloads: [
      "Downloads",
      "THE GOOD STUFF",
      "A better place for every file.",
      "Apps, albums aur files ko ek jagah manage karo.",
      "Add a download",
    ],
    widgets: [
      "Home widgets",
      "MAKE IT YOURS",
      "Give your homepage a little life.",
      "Announcements, links, polls aur updates ko publish karo.",
      "Add a widget",
    ],
    store: [
      "Store apps",
      "YOUR APP COLLECTION",
      "Apps worth sharing.",
      "Add, update aur organise your app collection.",
      "Add an app",
    ],
    categories: [
      "Categories",
      "A PLACE FOR EVERYTHING",
      "Keep things easy to find.",
      "Organise your toolkit with clear, useful categories.",
      "",
    ],
    settings: [
      "Site settings",
      "THE FINISHING TOUCHES",
      "Make it feel like you.",
      "Brand, links aur default theme ko update karo.",
      "",
    ],
    payments: [
      "Payments",
      "PRICES & PURCHASES",
      "Your downloads, your prices.",
      "Downloads editor se Free/Paid, price aur discount set karo.",
      "",
    ],
    backup: [
      "Backup & restore",
      "A LITTLE PEACE OF MIND",
      "Keep a copy of the good work.",
      "Tools configuration export karo ya saved backup restore karo.",
      "",
    ],
  };
  const uid = (prefix) => `${prefix}_${crypto.randomUUID()}`;
  const state = (message) => {
    $("#save-status").replaceChildren(
      el("span", { class: "status-dot" }),
      message,
    );
  };
  const mutate = async (path, method, body) => {
    state("Saving changes…");
    try {
      const result = await api(path, {
        method,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      state("Changes saved");
      return result;
    } catch (error) {
      state("Save failed · retry");
      throw error;
    }
  };
  const saveConfig = async (next) => {
    await mutate("/api/tools.config", "POST", next);
    config = next;
  };
  const sidebarMedia = matchMedia("(max-width: 800px)");
  const syncSidebar = () => {
    $("#admin-sidebar").inert =
      sidebarMedia.matches && !$("#admin-sidebar").classList.contains("open");
  };
  new MutationObserver(syncSidebar).observe($("#admin-sidebar"), {
    attributes: true,
    attributeFilter: ["class"],
  });
  sidebarMedia.addEventListener("change", syncSidebar);
  syncSidebar();
  const clone = (object) => JSON.parse(JSON.stringify(object));
  const rowButton = (label, action, danger = false, aria) =>
    el(
      "button",
      {
        class: `row-button${danger ? " danger" : ""}`,
        type: "button",
        onclick: () => Promise.resolve(action()).catch((e) => toast(e.message)),
        "aria-label": aria || label,
      },
      label,
    );
  const card = (title, content, sub) =>
    el(
      "section",
      { class: "admin-card" },
      el(
        "div",
        { class: "admin-card-header" },
        el("div", {}, el("h2", {}, title), ...(sub ? [el("p", {}, sub)] : [])),
      ),
      el("div", { class: "admin-card-body" }, content),
    );
  const pill = (visible = true) =>
    el(
      "span",
      { class: `status-pill${visible ? "" : " hidden"}` },
      visible ? "Published" : "Hidden",
    );
  function updateCounts() {
    $("#nav-tools-count").textContent = config.tools.length;
    $("#nav-downloads-count").textContent = downloads.length;
  }
  function navigate(view) {
    current = view;
    const [crumb, kicker, title, description, action] = titles[view];
    $("#view-breadcrumb").textContent = crumb;
    $("#view-eyebrow").textContent = kicker;
    $("#view-title").textContent = title;
    $("#view-description").textContent = description;
    const button = $("#primary-action");
    button.hidden = !action;
    button.replaceChildren(action, el("span", {}, "+"));
    document
      .querySelectorAll("[data-view]")
      .forEach((b) => b.classList.toggle("selected", b.dataset.view === view));
    $("#admin-sidebar").classList.remove("open");
    $("#admin-menu").setAttribute("aria-expanded", "false");
    updateCounts();
    render();
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  const primary = () =>
    ({
      dashboard: () => editTool(),
      tools: () => editTool(),
      downloads: () => editDownload(),
      widgets: () => editWidget(),
      store: () => editStore(),
    })[current]?.();
  $("#primary-action").addEventListener("click", primary);
  document
    .querySelectorAll("[data-view]")
    .forEach((button) =>
      button.addEventListener("click", () => navigate(button.dataset.view)),
    );
  $("#admin-menu").addEventListener("click", () => {
    const showing = $("#admin-sidebar").classList.toggle("open");
    $("#admin-menu").setAttribute("aria-expanded", String(showing));
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest("#admin-sidebar,#admin-menu")) {
      $("#admin-sidebar").classList.remove("open");
      $("#admin-menu").setAttribute("aria-expanded", "false");
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      $("#admin-sidebar").classList.remove("open");
      $("#admin-menu").setAttribute("aria-expanded", "false");
    }
  });
  $("#logout").addEventListener("click", async () => {
    try {
      await fetch("/admin/logout", {
        method: "POST",
        headers: { "X-CSRF-Token": $('meta[name="csrf-token"]').content },
      });
      location.assign("/admin/login");
    } catch {
      toast("Sign out failed. Try again.");
    }
  });
  function dashboard() {
    const stats = [
      [
        config.tools.length,
        "Total tools",
        "↗",
        `${config.tools.filter((t) => t.visible !== false).length} published on your website`,
      ],
      [
        downloads.length,
        "Download items",
        "↓",
        `${downloads.filter((i) => i.is_album).length} albums in the collection`,
      ],
      [
        config.categories.filter((c) => c !== "All").length,
        "Tool categories",
        "≡",
        "Everything in its right place",
      ],
      [
        widgets.filter((w) => w.enabled).length,
        "Active widgets",
        "⊞",
        `${widgets.length} widgets in your workspace`,
      ],
    ];
    const recent = el(
      "div",
      {},
      ...[...config.tools]
        .sort((a, b) => (b.addedDate || "").localeCompare(a.addedDate || ""))
        .slice(0, 4)
        .map((tool) =>
          el(
            "div",
            { class: "recent-row" },
            image(tool.thumbnail, tool.name),
            el(
              "div",
              {},
              el("strong", {}, tool.name),
              el("p", {}, tool.category || "Tool"),
            ),
            pill(tool.visible !== false),
            rowButton("↗", () => editTool(tool), false, `Edit ${tool.name}`),
          ),
        ),
    );
    const recentCard = el(
      "section",
      { class: "admin-card" },
      el(
        "div",
        { class: "admin-card-header" },
        el("h2", {}, "Recently added"),
        el(
          "button",
          { class: "text-link", onclick: () => navigate("tools") },
          "All tools ↗",
        ),
      ),
      recent,
    );
    const quick = el(
      "div",
      { class: "quick-create" },
      el("span", { class: "eyebrow" }, "KEEP THE GOOD THINGS COMING"),
      el(
        "h2",
        {},
        "What will you",
        el("br"),
        el("span", { class: "serif" }, "build next?"),
      ),
      el(
        "p",
        {},
        "Share something useful. Your next tool could make someone’s day.",
      ),
      el(
        "button",
        { class: "button button-dark", onclick: () => editTool() },
        "Add to your toolkit",
        el("span", {}, "↗"),
      ),
      el("span", { "aria-hidden": "true" }, "✳"),
    );
    const health = el(
      "div",
      { class: "admin-checklist" },
      ...[
        [
          "↗",
          "Explore your website",
          "Check your latest content on desktop and mobile.",
        ],
        [
          "↓",
          "Keep downloads organised",
          "Use albums for related files and memories.",
        ],
        [
          "↙",
          "Save a configuration backup",
          "Export before making big catalogue changes.",
        ],
      ].map(([symbol, title, description]) =>
        el(
          "div",
          {},
          el("span", {}, symbol),
          el("div", {}, el("h3", {}, title), el("p", {}, description)),
        ),
      ),
    );
    root.replaceChildren(
      el(
        "div",
        { class: "dashboard-stats" },
        ...stats.map(([count, label, icon, note]) =>
          el(
            "div",
            { class: "dashboard-stat" },
            el(
              "div",
              { class: "stat-top" },
              el("span", {}, label),
              el("span", {}, icon),
            ),
            el("strong", {}, String(count).padStart(2, "0")),
            el("small", {}, note),
          ),
        ),
      ),
      el("div", { class: "dashboard-columns" }, recentCard, quick),
      card("A little workspace care", health),
    );
  }
  function listing(items, kind) {
    const search = el("input", {
      type: "search",
      placeholder: `Search ${kind}…`,
      "aria-label": `Search ${kind}`,
    });
    const body = el("tbody");
    const count = el("div", { class: "table-bottom" });
    const nameOf = (i) =>
      i.name ||
      i.title ||
      i.data?.title ||
      i.data?.question ||
      i.data?.name ||
      i.data?.winner_name ||
      i.type ||
      "Untitled";
    const draw = () => {
      const q = search.value.trim().toLowerCase();
      const found = items.filter((i) =>
        `${nameOf(i)} ${i.category || ""} ${i.type || ""}`
          .toLowerCase()
          .includes(q),
      );
      body.replaceChildren(
        ...found.map((item) => {
          const actions = [];
          const edit = () =>
            kind === "tools"
              ? editTool(item)
              : kind === "downloads"
                ? editDownload(item)
                : kind === "widgets"
                  ? editWidget(item)
                  : editStore(item);
          actions.push(rowButton("Edit", edit, false, `Edit ${nameOf(item)}`));
          if (kind === "tools" || kind === "widgets") {
            const move = async (delta) => {
              const list = kind === "tools" ? config.tools : widgets;
              const index = list.findIndex((i) => i.id === item.id);
              const next = index + delta;
              if (next < 0 || next >= list.length) return;
              const reordered = [...list];
              [reordered[index], reordered[next]] = [
                reordered[next],
                reordered[index],
              ];
              if (kind === "tools") {
                const draft = clone(config);
                draft.tools = reordered;
                await saveConfig(draft);
              } else {
                await mutate("/api/admin/widgets/reorder", "POST", {
                  order: reordered.map((w) => w.id),
                });
                widgets = reordered;
              }
              render();
            };
            actions.push(
              rowButton("↑", () => move(-1), false, `Move ${nameOf(item)} up`),
              rowButton("↓", () => move(1), false, `Move ${nameOf(item)} down`),
            );
          }
          actions.push(
            rowButton(
              "×",
              () =>
                confirmDelete(nameOf(item), async () => {
                  if (kind === "tools") {
                    const next = clone(config);
                    next.tools = next.tools.filter((t) => t.id !== item.id);
                    await saveConfig(next);
                  } else if (kind === "downloads") {
                    await mutate(
                      `/api/delete_item/${encodeURIComponent(item.id)}`,
                      "DELETE",
                    );
                    downloads = downloads.filter((i) => i.id !== item.id);
                  } else if (kind === "widgets") {
                    await mutate(
                      `/api/admin/widgets/${encodeURIComponent(item.id)}`,
                      "DELETE",
                    );
                    widgets = widgets.filter((i) => i.id !== item.id);
                  } else {
                    await mutate(
                      `/api/admin/store-apps/${encodeURIComponent(item.id)}`,
                      "DELETE",
                    );
                    store = store.filter((i) => i.id !== item.id);
                  }
                  updateCounts();
                  render();
                }),
              true,
              `Delete ${nameOf(item)}`,
            ),
          );
          return el(
            "tr",
            {},
            el(
              "td",
              {},
              el(
                "div",
                { class: "table-name" },
                ...(kind !== "widgets"
                  ? [image(item.thumbnail || item.image, nameOf(item))]
                  : []),
                el(
                  "div",
                  {},
                  el("strong", {}, nameOf(item)),
                  el(
                    "small",
                    {},
                    kind === "widgets"
                      ? item.type
                      : item.slug ||
                          (item.is_album
                            ? `${item.album_files?.length || 0} files`
                            : item.version || "—"),
                  ),
                ),
              ),
            ),
            el(
              "td",
              {},
              item.category || item.type || "General",
              ...(kind === "downloads"
                ? [
                    el(
                      "small",
                      { class: "admin-upload-date" },
                      (ST.dateLabel(item.uploaded_at || item.created_at) ||
                        "Upload date unavailable") +
                        (item.pricing?.mode === "paid"
                          ? ` · ₹${(Number(item.pricing.price) - Number(item.pricing.discount)).toFixed(2)}`
                          : " · Free"),
                    ),
                  ]
                : []),
            ),
            el(
              "td",
              {},
              pill(kind === "widgets" ? item.enabled : item.visible !== false),
            ),
            el("td", {}, el("div", { class: "row-actions" }, actions)),
          );
        }),
      );
      if (!found.length)
        body.append(
          el(
            "tr",
            {},
            el(
              "td",
              { colspan: "4" },
              "Koi result nahi mila. Search badal kar dekho.",
            ),
          ),
        );
      count.textContent = `${found.length} of ${items.length} ${kind} · Changes are saved to the server`;
    };
    search.addEventListener("input", draw);
    const toolbar = el(
      "div",
      { class: "admin-list-toolbar" },
      el("label", { class: "search-box" }, el("span", {}, "⌕"), search),
      el(
        "a",
        {
          class: "text-link",
          href: kind === "downloads" ? "/downloads" : "/",
          target: "_blank",
          rel: "noopener",
        },
        "View live ↗",
      ),
    );
    const panel = el(
      "section",
      { class: "admin-card" },
      toolbar,
      el(
        "div",
        { class: "table-wrap" },
        el(
          "table",
          { class: "admin-table" },
          el(
            "thead",
            {},
            el(
              "tr",
              {},
              ...["NAME", "CATEGORY / TYPE", "STATUS", "ACTIONS"].map((t) =>
                el("th", {}, t),
              ),
            ),
          ),
          body,
        ),
      ),
      count,
    );
    root.replaceChildren(panel);
    if (kind === "downloads")
      root.prepend(
        card(
          "A quicker way to share",
          el(
            "div",
            {},
            el(
              "p",
              { class: "form-note" },
              "Multiple files ko upload karo. Individual downloads banao, ya ek album mein saath rakho.",
            ),
            el(
              "div",
              { class: "backup-actions" },
              el(
                "button",
                { class: "button button-light", onclick: bulkUpload },
                "Upload files",
                el("span", {}, "↑"),
              ),
            ),
          ),
        ),
      );
    draw();
  }
  function field(label, value = "", type = "text", required = false) {
    const input = el(type === "textarea" ? "textarea" : "input", {
      ...(type === "textarea" ? { rows: "3" } : { type }),
      required,
      ...(type !== "textarea" ? { value } : {}),
      maxlength: type === "url" ? "500000" : "20000",
    });
    if (type === "textarea") input.value = value;
    return { input, node: el("label", {}, label, input) };
  }
  function checkbox(label, checked) {
    const input = el("input", { type: "checkbox", checked });
    return {
      input,
      node: el("label", { class: "checkbox-label" }, input, label),
    };
  }
  function select(label, options, value) {
    const input = el(
      "select",
      {},
      ...options.map((o) => el("option", { value: o }, o)),
    );
    input.value = value;
    return { input, node: el("label", {}, label, input) };
  }
  function editor(title, nodes, onSave, kicker = "CONTENT EDITOR") {
    const error = el("p", { class: "form-error", role: "alert" });
    const submit = el(
      "button",
      { class: "button button-orange", type: "submit" },
      "Save changes",
      el("span", {}, "✓"),
    );
    const form = el(
      "form",
      { class: "editor-form" },
      nodes,
      error,
      el(
        "div",
        { class: "editor-actions" },
        el(
          "button",
          { type: "button", class: "button button-light", onclick: close },
          "Cancel",
        ),
        submit,
      ),
    );
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      error.textContent = "";
      if (Number(form.dataset.pendingUploads || 0)) {
        error.textContent = "Upload complete hone tak wait karo.";
        return;
      }
      submit.disabled = true;
      try {
        await onSave();
        close();
        toast("Changes save ho gaye.");
        updateCounts();
        render();
      } catch (e) {
        error.textContent = e.message;
      } finally {
        submit.disabled = false;
      }
    });
    open(title, [form], kicker);
    return form;
  }
  function uploadField(target, isImage = false, privateMode = () => false) {
    const status = el(
      "span",
      { class: "form-note" },
      isImage
        ? "PNG, JPG, WebP or GIF · max 32 MB"
        : "Supported files · max 32 MB",
    );
    const input = el("input", {
      type: "file",
      ...(isImage
        ? { accept: "image/png,image/jpeg,image/webp,image/gif" }
        : {
            accept:
              ".jpg,.jpeg,.png,.webp,.gif,.pdf,.zip,.apk,.txt,.csv,.mp3,.mp4,.json,.aab",
          }),
      "aria-label": isImage ? "Upload thumbnail" : "Upload file",
    });
    input.addEventListener("change", async () => {
      const file = input.files[0];
      if (!file) return;
      if (file.size > 32 * 1024 * 1024) {
        status.textContent = "File 32 MB se chhoti honi chahiye.";
        return;
      }
      const data = new FormData();
      data.append(isImage ? "image" : "file", file);
      if (!isImage && privateMode()) data.append("private", "1");
      input.disabled = true;
      status.textContent = "Uploading…";
      const form = input.closest("form");
      if (form)
        form.dataset.pendingUploads =
          Number(form.dataset.pendingUploads || 0) + 1;
      const saveButton = form?.querySelector("[type=submit]");
      if (saveButton) saveButton.disabled = true;
      try {
        const result = await api(
          isImage ? "/api/admin/upload" : "/api/admin/upload-download-file",
          { method: "POST", body: data },
        );
        target.value = result.url;
        target.dataset.asset = result.asset ? JSON.stringify(result.asset) : "";
        target.dataset.uploadedAt = result.uploaded_at || "";
        target.dataset.uploadedUrl = result.url;
        target.dispatchEvent(new Event("input", { bubbles: true }));
        status.textContent = `Uploaded: ${result.filename || file.name}${result.uploaded_at ? " · " + ST.dateLabel(result.uploaded_at) : ""}`;
      } catch (e) {
        status.textContent = e.message;
      } finally {
        input.disabled = false;
        if (form)
          form.dataset.pendingUploads = Math.max(
            0,
            Number(form.dataset.pendingUploads || 0) - 1,
          );
        if (saveButton)
          saveButton.disabled = Number(form?.dataset.pendingUploads || 0) > 0;
      }
    });
    return el(
      "div",
      { class: "upload-field" },
      "Or upload a file",
      input,
      status,
    );
  }
  function editTool(tool) {
    const t = tool || {};
    const name = field("Tool name", t.name, "text", true),
      category = select(
        "Category",
        config.categories.filter((c) => c !== "All"),
        t.category || config.categories.find((c) => c !== "All"),
      ),
      description = field("Short description", t.description, "textarea"),
      long = field("Full description", t.longDescription, "textarea"),
      link = field("Website URL", t.siteUrl, "url", true),
      thumb = field("Thumbnail URL", t.thumbnail),
      tags = field("Tags · comma separated", (t.tags || []).join(", ")),
      visible = checkbox("Publish on the website", t.visible !== false),
      featured = checkbox("Feature this tool", t.featured || false);
    editor(
      tool ? "Edit tool" : "A new useful thing.",
      [
        el("div", { class: "form-grid" }, name.node, category.node),
        description.node,
        long.node,
        link.node,
        thumb.node,
        uploadField(thumb.input, true),
        tags.node,
        el("div", { class: "form-grid" }, visible.node, featured.node),
      ],
      async () => {
        const next = clone(config);
        const updated = {
          ...t,
          id: t.id || uid("tool"),
          name: name.input.value.trim(),
          slug:
            t.slug ||
            name.input.value
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, ""),
          category: category.input.value,
          description: description.input.value,
          longDescription: long.input.value,
          siteUrl: link.input.value,
          thumbnail: thumb.input.value,
          tags: tags.input.value
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          visible: visible.input.checked,
          featured: featured.input.checked,
          addedDate: t.addedDate || new Date().toISOString().slice(0, 10),
          downloadAvailable: t.downloadAvailable || false,
        };
        if (!updated.name) throw new Error("Tool name required.");
        if (tool)
          next.tools = next.tools.map((i) => (i.id === tool.id ? updated : i));
        else next.tools.push(updated);
        await saveConfig(next);
      },
    );
  }
  function editDownload(item) {
    const i = item || {};
    const title = field("Title", i.title, "text", true),
      category = field("Category", i.category || "Apps", "text", true),
      description = field("Description", i.description, "textarea"),
      version = field("Version", i.version),
      imageUrl = field("Cover image URL", i.image),
      link = field("Download URL", i.link, "url"),
      album = checkbox("This is an album", i.is_album || false),
      access = select(
        "Download access",
        ["Free", "Paid"],
        i.pricing?.mode === "paid" ? "Paid" : "Free",
      ),
      price = field("Price · INR ₹", i.pricing?.price || "0", "number"),
      discount = field(
        "Discount · INR ₹ off",
        i.pricing?.discount || "0",
        "number",
      );
    [price.input, discount.input].forEach((input) => {
      input.min = "0";
      input.max = "100000";
      input.step = "0.01";
    });
    const isPaid = () => access.input.value === "Paid";
    const finalPrice = el("p", { class: "form-note" });
    function updatePrice() {
      price.input.disabled = discount.input.disabled = !isPaid();
      finalPrice.textContent = isPaid()
        ? `Customer pays ₹${Math.max(0, Number(price.input.value) - Number(discount.input.value)).toFixed(2)} · Poore album ke sab files included. Paid files private upload se dobara upload karo; cover public preview rahega.`
        : "Free download · Payment ki zarurat nahi.";
      toggle();
    }
    [access.input, price.input, discount.input].forEach((input) =>
      input.addEventListener("input", updatePrice),
    );
    const rows = el("div", { class: "file-rows" });
    const albumRows = [];
    function addFile(file = {}) {
      const name = field("File name", file.name, "text", true),
        url = field("HTTPS file URL", file.link, "url", true);
      const row = { name, url, original: file };
      row.node = el(
        "div",
        { class: "file-row" },
        el(
          "div",
          {},
          name.node,
          url.node,
          el(
            "p",
            { class: "form-note" },
            ST.dateLabel(file.uploaded_at || file.added_at) ||
              "Upload date unavailable",
          ),
          uploadField(url.input, false, isPaid),
        ),
        rowButton(
          "×",
          () => {
            const index = albumRows.indexOf(row);
            albumRows.splice(index, 1);
            row.node.remove();
          },
          true,
          "Remove file from album",
        ),
      );
      albumRows.push(row);
      rows.append(row.node);
      url.input.required = !isPaid() && !file.asset;
    }
    (i.album_files || []).forEach(addFile);
    const albumSection = el(
      "div",
      {},
      rows,
      el(
        "button",
        { type: "button", class: "text-link", onclick: () => addFile() },
        "+ Add an album file",
      ),
    );
    const linkSection = el(
      "div",
      {},
      link.node,
      uploadField(link.input, false, isPaid),
    );
    function toggle() {
      albumSection.hidden = !album.input.checked;
      linkSection.hidden = album.input.checked;
      albumRows.forEach((r) => {
        r.name.input.required = album.input.checked;
        r.url.input.required =
          album.input.checked &&
          !isPaid() &&
          !r.url.input.dataset.asset &&
          !r.original.asset;
      });
      link.input.required =
        !album.input.checked &&
        !isPaid() &&
        !link.input.dataset.asset &&
        !i.asset;
    }
    album.input.addEventListener("change", toggle);
    link.input.addEventListener("input", toggle);
    rows.addEventListener("input", toggle);
    updatePrice();
    editor(
      item ? "Edit download" : "Share something good.",
      [
        el("div", { class: "form-grid" }, title.node, category.node),
        description.node,
        el(
          "p",
          { class: "form-note" },
          `Added: ${ST.dateLabel(i.created_at) || "Date unavailable"} · Last edited: ${ST.dateLabel(i.updated_at) || "Date unavailable"}`,
        ),
        el("div", { class: "form-grid" }, version.node, imageUrl.node),
        uploadField(imageUrl.input, true),
        el(
          "div",
          { class: "form-grid" },
          access.node,
          price.node,
          discount.node,
        ),
        finalPrice,
        album.node,
        linkSection,
        albumSection,
      ],
      async () => {
        const payload = {
          ...i,
          title: title.input.value.trim(),
          category: category.input.value.trim(),
          description: description.input.value,
          version: version.input.value,
          image: imageUrl.input.value,
          link: album.input.checked ? "" : link.input.value,
          is_album: album.input.checked,
          pricing: {
            mode: isPaid() ? "paid" : "free",
            price: price.input.value || "0",
            discount: discount.input.value || "0",
          },
          asset:
            link.input.dataset.asset &&
            link.input.dataset.uploadedUrl === link.input.value
              ? JSON.parse(link.input.dataset.asset)
              : i.link === link.input.value
                ? i.asset
                : undefined,
          uploaded_at:
            link.input.dataset.uploadedUrl === link.input.value
              ? link.input.dataset.uploadedAt
              : i.link === link.input.value
                ? i.uploaded_at
                : undefined,
          album_files: album.input.checked
            ? albumRows.map((r) => ({
                ...(r.original.link === r.url.input.value ? r.original : {}),
                asset:
                  r.url.input.dataset.asset &&
                  r.url.input.dataset.uploadedUrl === r.url.input.value
                    ? JSON.parse(r.url.input.dataset.asset)
                    : r.original.link === r.url.input.value
                      ? r.original.asset
                      : undefined,
                name: r.name.input.value,
                link: r.url.input.value,
                ...(r.url.input.dataset.uploadedUrl === r.url.input.value
                  ? { uploaded_at: r.url.input.dataset.uploadedAt }
                  : {}),
              }))
            : [],
        };
        if (payload.is_album && !payload.album_files.length)
          throw new Error("Album mein kam se kam ek file add karo.");
        if (item) {
          const result = await mutate("/api/update_item", "PUT", payload);
          downloads = downloads.map((d) =>
            d.id === item.id ? result.item : d,
          );
        } else {
          const result = await mutate("/api/add_item", "POST", payload);
          downloads.unshift(result.item);
        }
      },
    );
  }
  function confirmDelete(name, action) {
    const error = el("p", { class: "form-error", role: "alert" });
    const button = el(
      "button",
      {
        class: "button button-orange",
        onclick: async () => {
          button.disabled = true;
          try {
            await action();
            close();
            toast("Item removed.");
          } catch (e) {
            error.textContent = e.message;
            button.disabled = false;
          }
        },
      },
      "Delete item",
      el("span", {}, "×"),
    );
    open(
      "Remove this item?",
      [
        el(
          "p",
          { class: "dialog-description" },
          `“${name}” ko catalogue se delete karoge. Uploaded file apne host par rahegi. Delete karne se pehle backup export kar sakte ho.`,
        ),
        error,
        el(
          "div",
          { class: "editor-actions" },
          el(
            "button",
            { class: "button button-light", onclick: close },
            "Keep item",
          ),
          button,
        ),
      ],
      "CONFIRM DELETE",
    );
  }
  const widgetSchemas = {
    notice: [
      ["title", "Title"],
      ["message", "Message", "textarea"],
    ],
    poll: [["question", "Question"]],
    winner: [
      ["winner_name", "Winner name"],
      ["event_name", "Event"],
      ["photo_url", "Photo URL", "url"],
      ["message", "Message", "textarea"],
    ],
    person_card: [
      ["name", "Name"],
      ["role", "Role"],
      ["photo_url", "Photo URL", "url"],
      ["bio", "Bio", "textarea"],
    ],
    link_card: [
      ["title", "Title"],
      ["url", "Website URL", "url"],
      ["description", "Description", "textarea"],
      ["button_text", "Button label"],
    ],
    ticker: [["messages", "Messages · one per line", "textarea"]],
    gallery: [["images", "Image URLs · one per line", "textarea"]],
    event_card: [
      ["title", "Title"],
      ["date", "Date", "date"],
      ["time", "Time", "time"],
      ["venue", "Venue"],
      ["description", "Description", "textarea"],
    ],
    quote: [
      ["text", "Quote", "textarea"],
      ["author", "Author"],
    ],
    custom_html: [["html", "Text content", "textarea"]],
  };
  function editWidget(widget) {
    const w = widget || {},
      d = w.data || {};
    const type = select(
        "Widget type",
        Object.keys(widgetSchemas),
        w.type || "notice",
      ),
      enabled = checkbox("Publish this widget", w.enabled !== false);
    const widgetLabels = {
      notice: "Notice / alert",
      poll: "Poll",
      winner: "Winner celebration",
      person_card: "Person card",
      link_card: "Link card",
      ticker: "News ticker",
      gallery: "Image gallery",
      event_card: "Event",
      quote: "Quote",
      custom_html: "Text block",
    };
    [...type.input.options].forEach((option) => {
      option.textContent = widgetLabels[option.value];
    });
    if (widget) type.input.disabled = true;
    const fieldsRoot = el("div", { class: "editor-form" });
    let fields = {},
      optionRows = [];
    const draw = () => {
      fields = {};
      optionRows = [];
      fieldsRoot.replaceChildren(
        ...widgetSchemas[type.input.value].map(([key, label, kind]) => {
          let value = d[key] || "";
          if (key === "messages") value = (d.messages || []).join("\n");
          if (key === "images")
            value = (d.images || [])
              .map((img) => (typeof img === "string" ? img : img.url || ""))
              .join("\n");
          const f = field(label, value, kind || "text");
          fields[key] = f.input;
          return f.node;
        }),
      );
      if (type.input.value === "poll") {
        const rows = el("div", { class: "file-rows" });
        const addOption = (option = {}) => {
          const text = field(
            "Option",
            option.text || option.label || "",
            "text",
            true,
          );
          const item = {
            id: option.id || uid("option"),
            votes: option.votes || 0,
            input: text.input,
          };
          const line = el(
            "div",
            { class: "file-row" },
            text.node,
            rowButton(
              "×",
              () => {
                optionRows = optionRows.filter((o) => o !== item);
                line.remove();
              },
              true,
              "Remove option",
            ),
          );
          optionRows.push(item);
          rows.append(line);
        };
        (d.options?.length ? d.options : [{}, {}]).forEach(addOption);
        fieldsRoot.append(
          rows,
          el(
            "button",
            { type: "button", class: "text-link", onclick: () => addOption() },
            "+ Add option",
          ),
        );
      }
    };
    type.input.addEventListener("change", draw);
    draw();
    editor(
      widget ? "Edit homepage widget" : "A little homepage update.",
      [type.node, enabled.node, fieldsRoot],
      async () => {
        const data = { ...d };
        Object.entries(fields).forEach(([key, input]) => {
          data[key] =
            key === "messages" || key === "images"
              ? input.value
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean)
              : input.value;
        });
        if (type.input.value === "poll") {
          if (!data.question.trim())
            throw new Error("Poll ke liye question likho.");
          if (optionRows.length < 2)
            throw new Error("Poll ke liye kam se kam 2 options chahiye.");
          data.options = optionRows.map((o) => ({
            id: o.id,
            text: o.input.value,
            votes: o.votes,
          }));
        }
        if (type.input.value === "link_card" && !data.url)
          throw new Error("Website URL required.");
        const payload = {
          type: type.input.value,
          enabled: enabled.input.checked,
          data,
        };
        const result = await mutate(
          widget
            ? `/api/admin/widgets/${encodeURIComponent(w.id)}`
            : "/api/admin/widgets",
          widget ? "PUT" : "POST",
          payload,
        );
        if (widget)
          widgets = widgets.map((i) => (i.id === w.id ? result.widget : i));
        else widgets.push(result.widget);
      },
      "HOME WIDGET",
    );
  }
  function editStore(item) {
    const i = item || {};
    const fields = Object.fromEntries(
      [
        ["title", "App name"],
        ["description", "Description", "textarea"],
        ["category", "Category"],
        ["version", "Version"],
        ["link", "Download URL", "url"],
        ["image", "Image URL"],
      ].map(([key, label, type]) => [
        key,
        field(
          label,
          i[key] || "",
          type || "text",
          key === "title" || key === "link",
        ),
      ]),
    );
    editor(
      item ? "Edit store app" : "Add a store app",
      Object.values(fields).map((f) => f.node),
      async () => {
        const payload = {
          ...i,
          ...Object.fromEntries(
            Object.entries(fields).map(([key, f]) => [key, f.input.value]),
          ),
        };
        const result = await mutate(
          item
            ? `/api/admin/store-apps/${encodeURIComponent(i.id)}`
            : "/api/admin/store-apps",
          item ? "PUT" : "POST",
          payload,
        );
        if (item) store = store.map((a) => (a.id === i.id ? payload : a));
        else store.push(result.app);
      },
    );
  }
  function categories() {
    const input = el("input", {
      placeholder: "New category name",
      required: true,
      maxlength: "80",
      "aria-label": "Category name",
    });
    const list = el(
      "div",
      { class: "category-tags" },
      ...config.categories
        .filter((c) => c !== "All")
        .map((c) =>
          el(
            "div",
            { class: "category-tag" },
            c,
            el(
              "button",
              {
                "aria-label": `Remove category ${c}`,
                onclick: () => {
                  if (config.tools.some((t) => t.category === c))
                    return toast(
                      "Is category mein tools hain. Pehle unki category change karo.",
                    );
                  if (config.categories.filter((c) => c !== "All").length < 2)
                    return toast("Kam se kam ek category rehni chahiye.");
                  confirmDelete(c, async () => {
                    const next = clone(config);
                    next.categories = next.categories.filter(
                      (cat) => cat !== c,
                    );
                    await saveConfig(next);
                    render();
                  });
                },
              },
              "×",
            ),
          ),
        ),
    );
    const form = el(
      "form",
      { class: "category-add" },
      input,
      el(
        "button",
        { class: "button button-dark", type: "submit" },
        "Add category",
        el("span", {}, "+"),
      ),
    );
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const name = input.value.trim();
      if (!name) return;
      if (config.categories.some((c) => c.toLowerCase() === name.toLowerCase()))
        return toast("Ye category pehle se hai.");
      try {
        const next = clone(config);
        next.categories.push(name);
        await saveConfig(next);
        render();
        toast("Category added.");
      } catch (e) {
        toast(e.message);
      }
    });
    root.replaceChildren(card("Your categories", el("div", {}, list, form)));
  }
  function settings() {
    const name = field(
        "Site name",
        config.site?.name || "SanuwarTools",
        "text",
        true,
      ),
      tagline = field("Tagline", config.site?.tagline || ""),
      favicon = field(
        "Favicon URL",
        config.site?.favicon || "/assets/favicon.png",
      ),
      theme = select(
        "Default theme",
        ["light", "dark"],
        config.site?.defaultTheme || "light",
      );
    const social = Object.fromEntries(
      ["github", "instagram", "youtube", "twitter"].map((k) => [
        k,
        field(
          k[0].toUpperCase() + k.slice(1),
          config.socialLinks?.[k] || "",
          "url",
        ),
      ]),
    );
    const enabled = checkbox(
      "Show download collection",
      config.downloadPage?.enabled !== false,
    );
    const error = el("p", { class: "form-error", role: "alert" });
    const submit = el(
      "button",
      { class: "button button-orange", type: "submit" },
      "Save settings",
      el("span", {}, "✓"),
    );
    const form = el(
      "form",
      { class: "settings-form" },
      el("div", { class: "form-grid" }, name.node, tagline.node),
      el("div", { class: "form-grid" }, favicon.node, theme.node),
      el(
        "div",
        { class: "form-grid" },
        ...Object.values(social).map((f) => f.node),
      ),
      enabled.node,
      error,
      submit,
    );
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      submit.disabled = true;
      error.textContent = "";
      try {
        const next = clone(config);
        next.site = {
          ...next.site,
          name: name.input.value.trim(),
          tagline: tagline.input.value,
          favicon: favicon.input.value,
          defaultTheme: theme.input.value,
        };
        next.socialLinks = {
          ...next.socialLinks,
          ...Object.fromEntries(
            Object.entries(social).map(([k, f]) => [k, f.input.value]),
          ),
        };
        next.downloadPage = {
          ...next.downloadPage,
          enabled: enabled.input.checked,
          url: "/downloads",
        };
        await saveConfig(next);
        toast("Site settings updated.");
      } catch (e) {
        error.textContent = e.message;
      } finally {
        submit.disabled = false;
      }
    });
    root.replaceChildren(card("Brand & preferences", form));
  }
  function exportConfig() {
    const blob = new Blob([JSON.stringify(config, null, 2)], {
      type: "application/json",
    });
    const href = URL.createObjectURL(blob);
    const anchor = el("a", {
      href,
      download: `sanuwartools-${new Date().toISOString().slice(0, 10)}.json`,
    });
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(href), 5000);
    toast("Tools configuration exported.");
  }
  function backup() {
    const importFile = el("input", {
      type: "file",
      accept: ".json,application/json",
      "aria-label": "Import tools configuration",
    });
    const preview = el("div");
    importFile.addEventListener("change", async () => {
      const file = importFile.files[0];
      if (!file) return;
      try {
        if (file.size > 2 * 1024 * 1024)
          throw new Error("Backup 2 MB se chhota hona chahiye.");
        const next = JSON.parse(await file.text());
        if (
          !Array.isArray(next.tools) ||
          !Array.isArray(next.categories) ||
          !next.site
        )
          throw new Error("Valid tools configuration chuno.");
        preview.replaceChildren(
          el(
            "div",
            { class: "import-preview" },
            el(
              "h3",
              {},
              `${next.tools.length} tools · ${next.categories.length} categories`,
            ),
            el(
              "p",
              { class: "form-note" },
              "Restore karne se current tools configuration replace hoga. Downloads aur home widgets is backup ka hissa nahi hain.",
            ),
            el(
              "div",
              { class: "backup-actions" },
              el(
                "button",
                { class: "button button-light", onclick: exportConfig },
                "Export current backup ↓",
              ),
              el(
                "button",
                {
                  class: "button button-orange",
                  onclick: () => {
                    const button = el(
                      "button",
                      {
                        class: "button button-orange",
                        onclick: async () => {
                          button.disabled = true;
                          try {
                            await saveConfig(next);
                            close();
                            navigate("backup");
                            toast("Configuration restored.");
                          } catch (e) {
                            toast(e.message);
                            button.disabled = false;
                          }
                        },
                      },
                      "Replace configuration",
                    );
                    open(
                      "Restore this configuration?",
                      [
                        el(
                          "p",
                          { class: "dialog-description" },
                          `${next.tools.length} tools se current catalogue replace hoga. Pehle current backup export kar lo.`,
                        ),
                        el(
                          "div",
                          { class: "editor-actions" },
                          el(
                            "button",
                            { class: "button button-light", onclick: close },
                            "Cancel",
                          ),
                          button,
                        ),
                      ],
                      "CONFIRM RESTORE",
                    );
                  },
                },
                "Review restore →",
              ),
            ),
          ),
        );
      } catch (e) {
        toast(e.message);
        preview.replaceChildren();
      }
    });
    root.replaceChildren(
      el(
        "div",
        { class: "settings-grid" },
        card(
          "Export tools configuration",
          el(
            "div",
            {},
            el(
              "p",
              { class: "form-note" },
              "Site settings, categories aur tools ki JSON copy download karo. Downloads, uploads, store apps aur widgets is file mein include nahi hote.",
            ),
            el(
              "div",
              { class: "backup-actions" },
              el(
                "button",
                { class: "button button-dark", onclick: exportConfig },
                "Download backup",
                el("span", {}, "↓"),
              ),
            ),
          ),
        ),
        card(
          "Restore tools configuration",
          el(
            "div",
            {},
            el(
              "p",
              { class: "form-note" },
              "Apni exported JSON file choose karo. Replace karne se pehle preview aur confirmation milega.",
            ),
            el("div", { class: "upload-field" }, importFile),
            preview,
          ),
        ),
      ),
    );
  }
  function bulkUpload() {
    const files = el("input", {
      type: "file",
      multiple: true,
      "aria-label": "Choose files to upload",
      accept:
        ".jpg,.jpeg,.png,.webp,.gif,.pdf,.zip,.apk,.txt,.csv,.mp3,.mp4,.json,.aab",
    });
    const category = field("Category", "Files", "text", true),
      album = checkbox("Create one album", true),
      title = field("Album title", "My new album", "text", true);
    const progress = el("span"),
      bar = el("div", { class: "bulk-progress" }, progress),
      list = el("div", { class: "bulk-file-list" });
    album.input.addEventListener("change", () => {
      title.node.hidden = !album.input.checked;
      title.input.required = album.input.checked;
    });
    files.addEventListener("change", () => {
      list.replaceChildren(
        ...[...files.files].map((f) =>
          el("div", {}, `${f.name} · ${(f.size / 1024 / 1024).toFixed(1)} MB`),
        ),
      );
    });
    let uploaded = [],
      completed = new Set();
    editor(
      "Share a few good things.",
      [
        el(
          "div",
          { class: "upload-field" },
          "Choose files · up to 32 MB each",
          files,
        ),
        el("div", { class: "form-grid" }, category.node, title.node),
        album.node,
        bar,
        list,
      ],
      async () => {
        if (!files.files.length) throw new Error("Pehle files choose karo.");
        if ([...files.files].some((f) => f.size > 32 * 1024 * 1024))
          throw new Error("Har file 32 MB se chhoti honi chahiye.");
        const keyOf = (f) => `${f.name}:${f.size}:${f.lastModified}`;
        for (const file of files.files) {
          const key = keyOf(file);
          if (uploaded.some((f) => f.key === key)) continue;
          const data = new FormData();
          data.append("file", file);
          const result = await api("/api/admin/upload-download-file", {
            method: "POST",
            body: data,
          });
          uploaded.push({
            key,
            name: file.name,
            link: result.url,
            uploaded_at: result.uploaded_at,
          });
          progress.style.width = `${(uploaded.length / files.files.length) * 80}%`;
        }
        const currentFiles = uploaded.filter((f) =>
          [...files.files].some((file) => keyOf(file) === f.key),
        );
        if (album.input.checked) {
          const result = await mutate("/api/add_item", "POST", {
            title: title.input.value,
            description: `${currentFiles.length} files`,
            category: category.input.value,
            is_album: true,
            album_files: currentFiles.map(({ name, link, uploaded_at }) => ({
              name,
              link,
              uploaded_at,
            })),
            image: "",
            link: "",
          });
          downloads.unshift(result.item);
        } else {
          for (const file of currentFiles) {
            if (completed.has(file.key)) continue;
            const result = await mutate("/api/add_item", "POST", {
              title: file.name,
              category: category.input.value,
              link: file.link,
              uploaded_at: file.uploaded_at,
              is_album: false,
              album_files: [],
              image: "",
            });
            downloads.unshift(result.item);
            completed.add(file.key);
          }
        }
        progress.style.width = "100%";
      },
      "BULK UPLOAD",
    );
  }
  async function paymentDashboard() {
    root.replaceChildren(el("p", {}, "Payment setup check ho raha hai…"));
    try {
      const data = await api("/api/admin/payments");
      if (current !== "payments") return;
      const labels = {
        gateway_urls: "YouPI API & checkout URLs",
        merchant_id: "Merchant ID",
        webhook_secret: "Webhook signing secret",
        site_url: "Site return URL",
        private_database: "Private PostgreSQL orders database",
        session_secret: "Secure site session key",
        private_uploads: "Cloudinary private uploads",
        payments_enabled: "Payments enabled",
        database_connection: "Database connection",
      };
      const checks = el(
        "div",
        { class: "payment-checks" },
        ...Object.entries(data.checks).map(([key, ok]) =>
          el(
            "p",
            {},
            ok ? "✓ " : "○ ",
            labels[key] || key,
            ok ? " · Ready" : " · Setup pending",
          ),
        ),
      );
      const list = el(
        "div",
        { class: "payment-orders" },
        ...data.orders.map((order) =>
          el(
            "div",
            { class: "payment-order" },
            el("strong", {}, order.title),
            el(
              "span",
              {},
              `₹${(order.amount / 100).toFixed(2)} · ${order.status}`,
            ),
            el(
              "small",
              {},
              ST.dateLabel(new Date(order.created_at * 1000).toISOString()),
            ),
            el("small", {}, `Order ${order.id}`),
            ...(order.utr
              ? [el("small", {}, `Bank reference ${order.utr}`)]
              : []),
          ),
        ),
      );
      root.replaceChildren(
        card(
          data.ready ? "Payment checkout enabled" : "Payment setup pending",
          el(
            "div",
            {},
            checks,
            el(
              "a",
              {
                class: "button button-light",
                href: "/payment-demo",
                target: "_blank",
                rel: "noopener",
              },
              "Try free payment demo ↗",
            ),
            el(
              "p",
              { class: "form-note" },
              "YouPI ek alag server par chalega. Merchant dashboard mein apna receiving UPI account aur bank observer configure karo. Secrets sirf server environment mein set karo.",
            ),
            ...(data.webhook_url
              ? [
                  el(
                    "p",
                    { class: "form-note" },
                    `Webhook URL: ${data.webhook_url}`,
                  ),
                ]
              : []),
          ),
        ),
        card(
          "Recent purchases",
          data.orders.length
            ? list
            : el("p", {}, "Abhi koi purchase nahi hai."),
        ),
      );
    } catch (e) {
      root.replaceChildren(el("p", { role: "alert" }, e.message));
    }
  }
  function render() {
    ({
      dashboard,
      categories,
      settings,
      backup,
      payments: paymentDashboard,
      tools: () => listing(config.tools, "tools"),
      downloads: () => listing(downloads, "downloads"),
      widgets: () => listing(widgets, "widgets"),
      store: () => listing(store, "store"),
    })[current]();
  }
  async function load() {
    try {
      [config, downloads, widgets, store] = await Promise.all([
        api("/api/admin/tools.config"),
        api("/api/admin/downloads"),
        api("/api/admin/widgets"),
        api("/api/admin/store-apps"),
      ]);
      navigate("dashboard");
    } catch (error) {
      empty(root, "Workspace unavailable.", error.message, load, "Try again");
    }
  }
  await load();
})();
