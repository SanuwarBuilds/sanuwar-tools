"use strict";
(() => {
  const T = window.SANU_TOOLS;
  const { el, field, input, select, button, actions, panel, status, fmtBytes } = T;
  const maxFileBytes = 32 * 1024 * 1024;
  const formats = { jpg: "JPG", png: "PNG", webp: "WebP", pdf: "PDF" };

  const identify = async (file) => {
    const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const ascii = new TextDecoder().decode(header);
    if (ascii.startsWith("%PDF-")) return "pdf";
    if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) return "jpg";
    if (header[0] === 0x89 && ascii.slice(1, 4) === "PNG" && header[4] === 13 &&
        header[5] === 10 && header[6] === 26 && header[7] === 10) return "png";
    if (ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP") return "webp";
    return "";
  };

  const imageFile = async (file) => {
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      return image;
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  T.register("form-file-checker", (root) => {
    const picker = input({ type: "file", accept: ".jpg,.jpeg,.png,.webp,.pdf" });
    const role = select([["Photo", "photo"], ["Signature", "signature"], ["PDF document", "pdf"]], "photo");
    const format = select([["Any supported image", "any"], ...Object.entries(formats).slice(0, 3).map(([key, name]) => [name, key])], "any");
    const dimension = () => input({ type: "number", min: 1, step: 1, placeholder: "Optional", inputmode: "numeric" });
    const width = dimension();
    const height = dimension();
    const limit = input({ type: "number", min: 0.001, step: "any", placeholder: "Optional", inputmode: "decimal" });
    const imageFields = T.twoCol(field("Required format", format), field("Width (px)", width), field("Height (px)", height));
    const results = el("div", { class: "tp-form-results", "aria-live": "polite" });
    const form = el("form", { class: "studio-split" },
      el("section", { class: "studio-pane studio-source" }, field("File to check", picker), results),
      el("section", { class: "studio-pane studio-controls" }, field("What are you submitting?", role), imageFields,
      field("Maximum file size (KB)", limit, "1 KB = 1,000 bytes. Enter the limit shown on your form."),
      actions(el("button", { type: "submit", class: "tp-btn tp-btn-primary" }, "Check file"))));
    let revision = 0;
    form.addEventListener("input", () => {
      revision++;
      results.replaceChildren();
    });
    role.addEventListener("change", () => {
      imageFields.hidden = role.value === "pdf";
      for (const control of [format, width, height]) control.disabled = imageFields.hidden;
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const tag = ++revision;
      const file = picker.files[0];
      if (!file) {
        results.textContent = "Choose a file to check.";
        return;
      }
      const isPdf = role.value === "pdf";
      const expected = isPdf ? "pdf" : format.value;
      const expectedWidth = isPdf ? 0 : Number(width.value);
      const expectedHeight = isPdf ? 0 : Number(height.value);
      const maxKB = Number(limit.value);
      results.textContent = "Checking file…";

      let actual = "";
      let image;
      let details = "";
      let readable = false;
      try {
        actual = await identify(file);
        if (!actual) throw new Error("Choose a JPG, PNG, WebP or PDF.");
        if (file.size > maxFileBytes) throw new Error("File contents can only be checked up to 32 MiB.");
        if (actual === "pdf") {
          const pdf = await PDFLib.PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
          const pages = pdf.getPageCount();
          if (!pages) throw new Error("The PDF has no pages.");
          details = `${pages} ${pages === 1 ? "page" : "pages"}`;
        } else {
          image = await imageFile(file);
          details = `${image.naturalWidth} × ${image.naturalHeight} px`;
        }
        readable = true;
      } catch (error) {
        details = error.message || "The file could not be opened.";
      }
      if (tag !== revision) return;

      const formatOK = expected === "any" ? Boolean(actual && actual !== "pdf") : actual === expected;
      const sizeOK = !maxKB || file.size <= Math.floor(maxKB * 1000);
      const checks = [
        [readable, readable ? `Readable · ${details}` : details],
        [formatOK, `Format: ${formats[actual] || "Unknown"} · Required: ${formats[expected] || "JPG, PNG or WebP"}`],
        [sizeOK, `Size: ${(file.size / 1000).toLocaleString(undefined, { maximumFractionDigits: 3 })} KB${maxKB ? ` · Limit: ${maxKB} KB` : ""}`],
      ];
      if (expectedWidth) checks.push([image?.naturalWidth === expectedWidth, `Width: ${image?.naturalWidth ?? "Unavailable"} · Required: ${expectedWidth} px`]);
      if (expectedHeight) checks.push([image?.naturalHeight === expectedHeight, `Height: ${image?.naturalHeight ?? "Unavailable"} · Required: ${expectedHeight} px`]);
      const passed = checks.every(([ok]) => ok);
      results.replaceChildren(
        el("h2", { text: passed ? "Matches the selected requirements" : "File needs attention" }),
        el("ul", {}, checks.map(([ok, label]) => el("li", {}, el("strong", { text: ok ? "Pass · " : "Check · " }), label)))
      );
      if (actual === "pdf" && isPdf && readable && !sizeOK) {
        results.append(el("a", { href: "/tools/pdf-compress", class: "tp-btn tp-btn-ghost" }, "Open PDF Compress"));
      } else if (image && !isPdf && !passed && expected === "webp") {
        results.append(el("a", { href: "/tools/image-compressor?format=webp", class: "tp-btn tp-btn-ghost" }, "Open Image Compressor for WebP"));
      } else if (image && !isPdf && !passed && root.closest("[data-tool-page]")?.dataset.photoAvailable === "true") {
        const params = new URLSearchParams({ mode: role.value });
        if (expectedWidth >= 16 && expectedWidth <= 4096) params.set("width", expectedWidth);
        if (expectedHeight >= 16 && expectedHeight <= 4096) params.set("height", expectedHeight);
        if (maxKB >= 1 && maxKB <= 20000) params.set("kb", maxKB);
        if (expected === "jpg" || expected === "png") params.set("format", expected);
        results.append(el("a", { href: `/photo-tools?${params}`, class: "tp-btn tp-btn-ghost" }, "Open Photo & Signature Tools"));
      }
    });
    root.replaceChildren(panel("", form));
  });

  const canvas = (width = 1, height = 1) => el("canvas", { width, height });
  const clamp = (value, max = 1) => Math.max(0, Math.min(value, max));

  T.register("fill-sign-pdf", (root) => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/assets/vendor/pdf.worker.min.js";
    const picker = input({ type: "file", accept: ".pdf,application/pdf" });
    const preview = canvas();
    const overlay = canvas();
    const sheet = el("div", { class: "tp-sign-sheet" }, preview, overlay);
    const indicator = el("span", { role: "status", class: "tp-sign-page-number" });
    const chosenName = el("p", { class: "tp-hint", "aria-live": "polite" });
    const kind = select(["Text", "Date", "Tick mark", "Drawn signature", "Signature image"], "Text");
    const text = input({ maxlength: 120, placeholder: "Name, address or other text" });
    const date = input({ type: "date" });
    const signatureFile = input({ type: "file", accept: ".jpg,.jpeg,.png,.webp" });
    const signature = canvas(480, 144);
    signature.className = "tp-sign-pad";
    signature.setAttribute("aria-label", "Draw your signature here. You can also upload a signature image.");
    const pen = signature.getContext("2d");
    const x = input({ type: "number", min: 0, max: 100, value: 25, step: 1 });
    const y = input({ type: "number", min: 0, max: 100, value: 25, step: 1 });
    const size = input({ type: "number", min: 8, max: 48, step: 1, value: 16 });
    const marksList = el("ul", { class: "tp-sign-marks" });
    const signMessage = (message, type = "info") => status(root, message, type);
    let source = null;
    let documentName = "";
    let task = null;
    let pdf = null;
    let pageNumber = 1;
    let viewport = null;
    let version = 0;
    let screenVersion = 0;
    let marks = [];
    let hasInk = false;
    let pointer = null;
    let saving = false;

    const clearPad = () => {
      pen.clearRect(0, 0, signature.width, signature.height);
      hasInk = false;
      pointer = null;
    };
    const penPoint = (event) => {
      const rect = signature.getBoundingClientRect();
      return [(event.clientX - rect.left) * signature.width / rect.width,
        (event.clientY - rect.top) * signature.height / rect.height];
    };
    signature.addEventListener("pointerdown", (event) => {
      if (pointer !== null || event.button !== 0) return;
      const [px, py] = penPoint(event);
      pointer = event.pointerId;
      signature.setPointerCapture(pointer);
      pen.lineWidth = 3;
      pen.lineCap = "round";
      pen.lineJoin = "round";
      pen.strokeStyle = "#16243d";
      pen.fillStyle = "#16243d";
      pen.beginPath();
      pen.arc(px, py, 1.5, 0, Math.PI * 2);
      pen.fill();
      pen.beginPath();
      pen.moveTo(px, py);
      hasInk = true;
    });
    signature.addEventListener("pointermove", (event) => {
      if (event.pointerId !== pointer) return;
      pen.lineTo(...penPoint(event));
      pen.stroke();
    });
    signature.addEventListener("lostpointercapture", () => { pointer = null; });

    const settings = new Map([
      ["Text", field("Text to add", text)],
      ["Date", field("Date to add", date)],
      ["Drawn signature", el("div", {}, signature, actions(button("Clear signature", clearPad, "ghost")))],
      ["Signature image", field("Choose a PNG, JPG or WebP signature image", signatureFile)],
    ]);
    const syncKind = () => {
      for (const [type, control] of settings) control.hidden = type !== kind.value;
      size.disabled = kind.value.endsWith("signature") || kind.value === "Signature image";
    };
    kind.addEventListener("change", syncKind);
    syncKind();

    const clippedSignature = () => {
      if (!hasInk) throw new Error("Draw a signature first.");
      const { width, height } = signature;
      const pixels = pen.getImageData(0, 0, width, height).data;
      let left = width, top = height, right = 0, bottom = 0;
      for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
          if (!pixels[(row * width + col) * 4 + 3]) continue;
          left = Math.min(left, col);
          right = Math.max(right, col);
          top = Math.min(top, row);
          bottom = Math.max(bottom, row);
        }
      }
      const image = canvas(right - left + 1, bottom - top + 1);
      image.getContext("2d").drawImage(signature, left, top, image.width, image.height, 0, 0, image.width, image.height);
      return image;
    };

    const drawMark = async (type) => {
      if (type === "Drawn signature") return { art: clippedSignature(), label: "Drawn signature", visualWidth: 120 };
      if (type === "Signature image") {
        const file = signatureFile.files[0];
        if (!file || file.size > 4 * 1024 * 1024) throw new Error("Choose a signature image up to 4 MiB.");
        if (!["jpg", "png", "webp"].includes(await identify(file))) throw new Error("Choose a JPG, PNG or WebP signature image.");
        const image = await imageFile(file);
        const scale = Math.min(1, 600 / Math.max(image.naturalWidth, image.naturalHeight));
        const art = canvas(Math.max(1, Math.round(image.naturalWidth * scale)), Math.max(1, Math.round(image.naturalHeight * scale)));
        art.getContext("2d").drawImage(image, 0, 0, art.width, art.height);
        return { art, label: "Signature image", visualWidth: 120 };
      }

      const value = { Text: text.value.trim(), Date: date.value, "Tick mark": "✓" }[type];
      if (!value) throw new Error(type === "Date" ? "Choose a date first." : "Enter the text you want to add.");
      if (!size.value || !size.checkValidity()) throw new Error("Choose a text size from 8 to 48 pt.");
      const points = Number(size.value);
      const art = canvas();
      const context = art.getContext("2d");
      const font = `${points * 3}px sans-serif`;
      context.font = font;
      art.width = Math.ceil(context.measureText(value).width) + 6;
      art.height = Math.ceil(points * 4.5);
      context.font = font;
      context.fillStyle = "#16243d";
      context.textBaseline = "middle";
      context.fillText(value, 3, art.height / 2);
      return { art, label: type === "Tick mark" ? type : value, visualWidth: art.width / 3 };
    };

    const refreshMarks = () => {
      const context = overlay.getContext("2d");
      context.clearRect(0, 0, overlay.width, overlay.height);
      marksList.replaceChildren();
      for (const mark of marks) {
        if (mark.page !== pageNumber) continue;
        if (viewport) context.drawImage(mark.art, mark.left * viewport.width, mark.top * viewport.height,
          mark.width * viewport.width, mark.height * viewport.height);
        marksList.append(el("li", {}, el("span", { text: mark.label }),
          button("Remove", () => {
            marks = marks.filter((item) => item !== mark);
            refreshMarks();
            signMessage("Item removed.");
          }, "ghost", { "aria-label": `Remove ${mark.label}` })));
      }
      save.disabled = saving || !source || marks.length === 0;
    };

    const place = async (left, top) => {
      if (!viewport || saving) return;
      if (marks.length >= 150) { signMessage("This PDF already has 150 added items.", "error"); return; }
      const page = pageNumber;
      const activeViewport = viewport;
      const activeScreen = screenVersion;
      const type = kind.value;
      try {
        const { art, label, visualWidth } = await drawMark(type);
        if (activeScreen !== screenVersion || saving) return;
        if (marks.length >= 150) throw new Error("This PDF already has 150 added items.");
        const scale = activeViewport.scale;
        const width = Math.min(visualWidth * scale, activeViewport.width * 0.95,
          activeViewport.height * 0.95 * art.width / art.height) / activeViewport.width;
        const height = width * activeViewport.width * art.height / art.width / activeViewport.height;
        marks.push({ art, label, page, left: clamp(left, 1 - width), top: clamp(top, 1 - height),
          width, height, viewport: activeViewport });
        refreshMarks();
        signMessage(`${type} added to page ${page}.`, "ok");
      } catch (error) {
        if (activeScreen === screenVersion) signMessage(error.message, "error");
      }
    };

    overlay.addEventListener("click", (event) => {
      const bounds = overlay.getBoundingClientRect();
      place((event.clientX - bounds.left) / bounds.width, (event.clientY - bounds.top) / bounds.height);
    });
    const placeButton = button("Place at position", () => {
      if (!x.value || !y.value || !x.checkValidity() || !y.checkValidity()) {
        signMessage("Enter positions from 0 to 100%.", "error");
        return;
      }
      place(Number(x.value) / 100, Number(y.value) / 100);
    }, "ghost");

    const showPage = async (number) => {
      const screen = ++screenVersion;
      pageNumber = number;
      viewport = null;
      sheet.hidden = true;
      placeButton.disabled = true;
      indicator.textContent = `Page ${number} of ${pdf.numPages}`;
      previous.disabled = number === 1;
      next.disabled = number === pdf.numPages;
      refreshMarks();
      try {
        const page = await pdf.getPage(number);
        const original = page.getViewport({ scale: 1 });
        const view = page.getViewport({ scale: Math.min(1.5, 1100 / Math.max(original.width, original.height)) });
        const render = canvas(Math.ceil(view.width), Math.ceil(view.height));
        await page.render({ canvasContext: render.getContext("2d"), viewport: view }).promise;
        if (screen !== screenVersion) return;
        preview.width = overlay.width = render.width;
        preview.height = overlay.height = render.height;
        preview.getContext("2d").drawImage(render, 0, 0);
        viewport = view;
        sheet.hidden = false;
        placeButton.disabled = false;
        refreshMarks();
        page.cleanup();
      } catch {
        if (screen === screenVersion) signMessage("This page could not be previewed. Try another page.", "error");
      }
    };

    const previous = button("Previous page", () => showPage(pageNumber - 1), "ghost");
    const next = button("Next page", () => showPage(pageNumber + 1), "ghost");
    const save = button("Download filled PDF", async () => {
      if (saving || !source || !marks.length) return;
      const current = version;
      const snapshot = marks.slice();
      saving = true;
      picker.disabled = true;
      refreshMarks();
      signMessage("Preparing your PDF…");
      try {
        const output = await PDFLib.PDFDocument.load(source, { updateMetadata: false });
        for (const mark of snapshot) {
          const view = mark.viewport;
          const left = mark.left * view.width;
          const right = (mark.left + mark.width) * view.width;
          const top = mark.top * view.height;
          const bottom = (mark.top + mark.height) * view.height;
          const [px, py] = view.convertToPdfPoint(left, bottom);
          const [rx, ry] = view.convertToPdfPoint(right, bottom);
          const [tx, ty] = view.convertToPdfPoint(left, top);
          const image = await output.embedPng(mark.art.toDataURL("image/png"));
          output.getPage(mark.page - 1).drawImage(image, {
            x: px, y: py, width: Math.hypot(rx - px, ry - py), height: Math.hypot(tx - px, ty - py),
            rotate: PDFLib.degrees(Math.atan2(ry - py, rx - px) * 180 / Math.PI),
          });
        }
        const bytes = await output.save();
        if (version !== current) return;
        T.download(`${documentName}-filled.pdf`, bytes, "application/pdf");
        signMessage(`PDF ready · ${fmtBytes(bytes.length)}.`, "ok");
      } catch (error) {
        if (version === current) signMessage(`Could not save PDF: ${error.message}`, "error");
      } finally {
        saving = false;
        picker.disabled = false;
        refreshMarks();
      }
    }, "primary", { disabled: true });

    const editor = el("div", { class: "tp-sign-editor studio-split", hidden: true },
      el("section", { class: "studio-pane studio-source", "aria-label": "Document preview" }, actions(previous, indicator, next), sheet),
      el("section", { class: "studio-pane studio-controls", "aria-label": "Signature settings" },
        field("Add to page", kind), ...settings.values(), field("Text size (pt)", size),
        el("p", { class: "tp-hint", text: "Click the page to place an item, or set its position and use Place at position." }),
        T.twoCol(field("From left (%)", x), field("From top (%)", y)),
        actions(placeButton), marksList, actions(save))
    );
    picker.addEventListener("change", async () => {
      const file = picker.files[0];
      if (!file || saving) return;
      picker.value = "";
      chosenName.textContent = file.name;
      const current = ++version;
      screenVersion++;
      if (task) task.destroy().catch(() => {});
      task = null;
      source = null;
      pdf = null;
      viewport = null;
      marks = [];
      text.value = "";
      date.value = "";
      signatureFile.value = "";
      clearPad();
      editor.hidden = true;
      if (file.size > maxFileBytes) { signMessage("Choose a PDF up to 32 MiB.", "error"); return; }
      signMessage("Opening PDF…");
      try {
        if (await identify(file) !== "pdf") throw new Error("Choose a valid PDF file.");
        const bytes = await file.arrayBuffer();
        const doc = await PDFLib.PDFDocument.load(bytes, { updateMetadata: false });
        if (current !== version) return;
        if (!doc.getPageCount() || doc.getPageCount() > 150) throw new Error("Choose a PDF with 1 to 150 pages.");
        const loading = pdfjsLib.getDocument({ data: new Uint8Array(bytes.slice(0)), isEvalSupported: false, maxImageSize: 16_000_000 });
        task = loading;
        const previewDoc = await loading.promise;
        if (current !== version) return;
        pdf = previewDoc;
        source = bytes;
        documentName = T.safeName(file.name.replace(/\.pdf$/i, ""), "document");
        editor.hidden = false;
        signMessage("PDF ready. Choose what to add.", "ok");
        await showPage(1);
      } catch (error) {
        if (current === version) signMessage(error.message || "The PDF could not be opened.", "error");
      }
    });
    root.replaceChildren(panel("", [
      field("Choose a PDF", picker, "One PDF up to 32 MiB and 150 pages."),
      chosenName, editor,
      el("p", { class: "tp-hint", text: "Adds visible text and signatures to a PDF copy. This tool creates a visual signature without a signing certificate." }),
    ]));
  });
})();
