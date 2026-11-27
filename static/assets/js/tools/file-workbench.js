"use strict";
(() => {
  const T = window.SANU_TOOLS;
  const { el, panel, input, field, select, button, actions, download, fmtBytes, safeName } = T;
  const imageAccept = ".jpg,.jpeg,.png,.webp,.bmp";
  const pdfAccept = ".pdf,application/pdf";
  const vendor = "/assets/vendor";
  const MiB = 1024 ** 2;
  const mm = 72 / 25.4;
  const paperSizes = { a4: [210, 297], letter: [215.9, 279.4], legal: [215.9, 355.6] };

  const { guardFile, canvasFor, releaseCanvas, toBlob, loadImage, openPdf, renderPdfPage, paintMasks, recognize } = T.localFiles;

  const live = () => el("p", { class: "fw-status", role: "status" });
  const hint = (text) => el("p", { class: "tp-hint", text });
  const grid = (...nodes) => el("div", { class: "fw-grid" }, nodes);
  const number = (min, max, value = "", step = 1) => input({ type: "number", min, max, step, value });
  const stem = (file) => safeName(file.name.replace(/\.[^.]+$/, ""), "file");
  const errorText = (error) => error?.message || (typeof error === "string" && error) || "Could not process this file.";
  const picker = (accept, multiple = false) => input({ type: "file", accept, multiple });

  async function writeRasterPdf(pdf, longestEdge, quality, onPage, masks) {
    const output = await PDFLib.PDFDocument.create();
    for (let page = 1; page <= pdf.numPages; page += 1) {
      onPage(page, pdf.numPages);
      const { canvas, width, height } = await renderPdfPage(pdf, page, longestEdge);
      try {
        paintMasks(canvas, masks?.get(page) || []);
        const image = masks
          ? await output.embedPng(await (await toBlob(canvas, "image/png")).arrayBuffer())
          : await output.embedJpg(await (await toBlob(canvas, "image/jpeg", quality)).arrayBuffer());
        output.addPage([width, height]).drawImage(image, { x: 0, y: 0, width, height });
      } finally {
        releaseCanvas(canvas);
      }
    }
    return new Blob([await output.save()], { type: "application/pdf" });
  }

  async function zipFiles(items, name) {
    const entries = Object.create(null);
    for (const item of items) {
      const base = item.name.replace(/\.[^.]+$/, "");
      const suffix = item.name.slice(base.length);
      let entry = item.name;
      for (let index = 2; entries[entry]; index += 1) entry = base + "-" + index + suffix;
      entries[entry] = new Uint8Array(await item.blob.arrayBuffer());
    }
    download(name, fflate.zipSync(entries, { level: 0 }), "application/zip");
  }

  function runZip(makeItems, name, notice) {
    const control = button("Download ZIP", async () => {
      control.disabled = true;
      try {
        await zipFiles([...makeItems()], name);
      } catch (error) {
        notice.textContent = errorText(error);
      } finally {
        control.disabled = makeItems().length === 0;
      }
    }, "ghost");
    control.disabled = true;
    return control;
  }

  async function packImage(file, { width, height, type, bytes }) {
    const image = await loadImage(file);
    const naturalWidth = image.naturalWidth;
    const naturalHeight = image.naturalHeight;
    const fit = Math.min(1, 4096 / Math.max(naturalWidth, naturalHeight));
    const targetWidth = width || Math.max(1, Math.round(height ? height * naturalWidth / naturalHeight : naturalWidth * fit));
    const targetHeight = height || Math.max(1, Math.round(width ? width * naturalHeight / naturalWidth : naturalHeight * fit));
    if (Math.max(targetWidth, targetHeight) > 4096) throw new Error("Set both dimensions to 4,096 px or less.");
    const canvas = canvasFor(targetWidth, targetHeight);
    const scales = width || height || bytes === Infinity ? [1] : [1, 0.75, 0.55, 0.4, 0.25, 0.15];
    const qualities = type === "image/png" ? [1] : [0.94, 0.85, 0.73, 0.58, 0.42, 0.28, 0.16, 0.08];
    let smallest;
    try {
      for (const sizeFactor of scales) {
        canvas.width = Math.max(1, Math.round(targetWidth * sizeFactor));
        canvas.height = Math.max(1, Math.round(targetHeight * sizeFactor));
        const details = canvas.width + " × " + canvas.height + " px";
        const context = canvas.getContext("2d");
        const fitScale = Math.min(canvas.width / naturalWidth, canvas.height / naturalHeight);
        const drawWidth = naturalWidth * fitScale;
        const drawHeight = naturalHeight * fitScale;
        context.fillStyle = "#fff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, (canvas.width - drawWidth) / 2, (canvas.height - drawHeight) / 2, drawWidth, drawHeight);
        for (const quality of qualities) {
          const blob = await toBlob(canvas, type, quality);
          if (blob.size <= bytes) return { blob, details };
          if (!smallest || blob.size < smallest.blob.size) smallest = { blob, details };
        }
        if (Math.max(canvas.width, canvas.height) <= 128) break;
      }
      return smallest;
    } finally {
      releaseCanvas(canvas);
    }
  }

  async function packPdf(file, { bytes, flatten }, onPage) {
    guardFile(file);
    const source = await PDFLib.PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
    if (!source.getPageCount()) throw new Error("Choose a PDF with at least one page.");
    let blob = file;
    if (file.size > bytes) {
      const optimized = await source.save({ useObjectStreams: true, updateFieldAppearances: false });
      if (optimized.byteLength < blob.size) blob = new Blob([optimized], { type: "application/pdf" });
    }
    if (blob.size > bytes && flatten) {
      const pdf = await openPdf(file);
      try {
        for (const [edge, quality] of [[1650, 0.72], [1250, 0.55], [900, 0.38]]) {
          const compressed = await writeRasterPdf(pdf, edge, quality, onPage);
          if (compressed.size < blob.size) blob = compressed;
          if (blob.size <= bytes) break;
        }
      } finally {
        await pdf.destroy();
      }
    }
    return { blob, details: source.getPageCount() + (source.getPageCount() === 1 ? " page" : " pages") };
  }

  T.register("application-file-pack", (root) => {
    const notice = live();
    const rows = ["Photo", "Signature", "PDF document"].map((name, index) => {
      const pdf = index === 2;
      const file = picker(pdf ? pdfAccept : imageAccept);
      const limit = number(0.001, 40000, "", "any");
      const width = number(1, 4096);
      const height = number(1, 4096);
      const format = select([["JPG", "image/jpeg"], ["PNG", "image/png"], ["WebP", "image/webp"]], "image/jpeg");
      const flatten = el("input", { type: "checkbox" });
      const result = el("div", { class: "fw-result", "aria-live": "polite" });
      const section = el("fieldset", { class: "fw-file-card" },
        el("legend", { text: name }), field("Choose " + name.toLowerCase(), file),
        pdf ? grid(field("Max size (KB, optional)", limit))
          : grid(field("Output format", format), field("Max size (KB, optional)", limit),
            field("Width (px, optional)", width), field("Height (px, optional)", height)),
        pdf ? el("label", { class: "fw-check" }, flatten, "Allow stronger compression (turns PDF text into images)") : null,
        result);
      return { name, pdf, file, limit, width, height, format, flatten, result, section, output: null };
    });
    const passing = () => rows.flatMap((row) => row.output ? [row.output] : []);
    const zip = runZip(passing, "application-file-pack.zip", notice);
    let busy = false;
    const run = el("button", { type: "submit", class: "tp-btn tp-btn-primary", disabled: true }, "Prepare & check files");
    const form = el("form", { class: "st-pack" },
      el("div", { class: "st-pack-files" }, rows.map((row) => row.section)),
      el("div", { class: "st-pack-actions" }, actions(run, zip), notice));
    const sync = () => {
      run.disabled = busy || !rows.some((row) => row.file.files.length);
      zip.disabled = busy || !passing().length;
      for (const row of rows) row.section.disabled = busy;
    };
    for (const row of rows) {
      row.section.addEventListener("input", () => {
        row.output = null;
        row.result.replaceChildren();
        notice.textContent = "";
        sync();
      });
    }
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (busy) return;
      busy = true;
      rows.forEach((row) => { row.output = null; row.result.replaceChildren(); });
      sync();
      try {
        let selected = 0;
        for (const row of rows) {
          const file = row.file.files[0];
          if (!file) continue;
          selected += 1;
          notice.textContent = "Preparing " + row.name.toLowerCase() + "…";
          const bytes = row.limit.value ? Math.floor(Number(row.limit.value) * 1000) : Infinity;
          try {
            const options = { bytes, width: Number(row.width.value), height: Number(row.height.value), type: row.format.value, flatten: row.flatten.checked };
            const { blob, details } = row.pdf
              ? await packPdf(file, options, (page, total) => { notice.textContent = "Compressing PDF page " + page + " of " + total + "…"; })
              : await packImage(file, options);
            const passed = blob.size <= bytes;
            const format = row.pdf ? "pdf" : { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[blob.type];
            const name = (row.pdf ? "document" : row.name.toLowerCase()) + "." + format;
            if (passed) row.output = { name, blob };
            row.result.append(el("p", { class: passed ? "fw-pass" : "fw-fix", text:
              (passed ? "Pass" : "Fix needed") + " · " + format.toUpperCase() + " · " + details + " · " +
              (blob.size / 1000).toLocaleString(undefined, { maximumFractionDigits: 3 }) + " KB" +
              (passed ? "" : " (limit " + row.limit.value + " KB)") }));
            if (passed) row.result.append(button("Download " + name, () => download(name, blob), "ghost"));
            else row.result.append(hint(row.pdf ? "Try a smaller source PDF or enable stronger compression." : "Try JPG or WebP, or lower the dimensions if your form allows it."));
          } catch (error) {
            row.result.textContent = "Fix needed · " + errorText(error);
          }
        }
        notice.textContent = passing().length + " of " + selected + " selected files passed.";
      } finally {
        busy = false;
        sync();
      }
    });
    root.replaceChildren(panel("Application requirements", [
      hint("Use the limits shown on your form. 1 KB = 1,000 bytes. Images keep their proportions with white padding if needed. With both dimensions blank, images may shrink to fit the size limit."),
      form,
    ]));
  });

  T.register("image-to-text", (root) => {
    const file = picker(imageAccept);
    const language = select([["English", "eng"], ["Hindi", "hin"], ["Bangla", "ben"],
      ["Hindi + English", "hin+eng"], ["Bangla + English", "ben+eng"]], "eng");
    const notice = live();
    const output = T.textarea("", { rows: 12, placeholder: "Recognized text appears here." });
    const controls = el("fieldset", { class: "fw-controls" }, grid(field("Screenshot or scan", file), field("Text language", language)));
    const run = button("Extract text", async () => {
      if (!file.files[0]) return;
      controls.disabled = true;
      run.disabled = true;
      output.value = "";
      notice.textContent = "Preparing image…";
      try {
        const image = await loadImage(file.files[0]);
        const canvas = canvasFor(image.naturalWidth, image.naturalHeight);
        try {
          const context = canvas.getContext("2d");
          context.fillStyle = "#fff";
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0);
          const data = await recognize(canvas, language.value, (message) => { notice.textContent = message; });
          output.value = data.text.trim();
          notice.textContent = output.value ? "Text ready. Review it before copying." : "No text detected. Try a sharper image or a different language.";
        } finally {
          releaseCanvas(canvas);
        }
      } catch (error) {
        notice.textContent = errorText(error);
      } finally {
        controls.disabled = false;
        run.disabled = !file.files.length;
      }
    });
    run.disabled = true;
    file.addEventListener("change", () => {
      run.disabled = !file.files.length;
      output.value = "";
      notice.textContent = "";
    });
    root.replaceChildren(el("div", { class: "st-ocr" },
      panel("Image and language", [controls, actions(run), notice], "st-ocr-source"),
      panel("", [field("Recognized text", output),
        actions(T.copyButton(() => output.value, "Copy text"),
          T.downloadButton("Download TXT", () => output.value, "recognized-text.txt", "text/plain;charset=utf-8", "ghost"))], "st-ocr-result")));
  });

  T.register("heic-to-jpg", (root) => {
    const files = picker(".heic,.heif,image/heic,image/heif", true);
    const quality = number(10, 100, 90);
    quality.required = true;
    const notice = live();
    const results = el("ul", { class: "fw-list" });
    const outputs = [];
    const zip = runZip(() => outputs, "converted-photos.zip", notice);
    const form = el("form");
    const run = el("button", { type: "submit", class: "tp-btn tp-btn-primary", disabled: true }, "Convert to JPG");
    const controls = el("fieldset", { class: "fw-controls studio-split" },
      panel("Source photos", [field("HEIC or HEIF photos (up to 20)", files), notice, results], "studio-pane studio-source"),
      panel("JPG settings", [field("JPG quality (%)", quality), actions(run, zip)], "studio-pane studio-controls"));
    form.append(controls);
    const clear = () => {
      outputs.length = 0;
      results.replaceChildren();
      zip.disabled = true;
      notice.textContent = "";
      run.disabled = !files.files.length;
    };
    controls.addEventListener("input", clear);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (files.files.length > 20) {
        notice.textContent = "Choose up to 20 photos per batch.";
        return;
      }
      clear();
      controls.disabled = run.disabled = true;
      try {
        const { heicTo, isHeic } = await import(vendor + "/heic/heic-to.min.js?v=1.6.7");
        const list = [...files.files];
        for (let index = 0; index < list.length; index += 1) {
          const file = list[index];
          notice.textContent = "Converting photo " + (index + 1) + " of " + list.length + "…";
          const row = el("li", { class: "fw-list-row" }, el("strong", { text: file.name }));
          results.append(row);
          try {
            guardFile(file, 25 * MiB);
            if (!(await isHeic(file))) throw new Error("This file is not a supported HEIC or HEIF photo.");
            const blob = await heicTo({ blob: file, type: "image/jpeg", quality: Number(quality.value) / 100 });
            const name = stem(file) + ".jpg";
            outputs.push({ name, blob });
            row.append(el("span", { text: fmtBytes(blob.size) }),
              button("Download JPG", () => download(name, blob), "ghost", { "aria-label": "Download " + name }));
          } catch (error) {
            row.append(el("span", { class: "fw-fix", text: errorText(error) }));
          }
        }
        notice.textContent = outputs.length + " of " + list.length + " photos converted.";
      } catch (error) {
        notice.textContent = errorText(error);
      } finally {
        controls.disabled = false;
        run.disabled = !files.files.length;
        zip.disabled = !outputs.length;
      }
    });
    root.replaceChildren(panel("Convert iPhone photos", [form]));
  });

  T.register("pdf-page-size-margins", (root) => {
    const file = picker(pdfAccept);
    const paper = select([["A4 (210 × 297 mm)", "a4"], ["US Letter", "letter"], ["US Legal", "legal"]], "a4");
    const orientation = select([["Match each original page", "auto"], ["Portrait", "portrait"], ["Landscape", "landscape"]], "auto");
    const margin = number(0, 60, 10, 0.1);
    margin.required = true;
    const notice = live();
    const run = el("button", { type: "submit", class: "tp-btn tp-btn-primary", disabled: true }, "Download resized PDF");
    const controls = el("fieldset", { class: "fw-controls studio-split" },
      panel("Source document", [field("PDF file", file), notice], "studio-pane studio-source"),
      panel("Paper settings", [field("Paper size", paper), field("Orientation", orientation),
        field("Margins on all sides (mm)", margin), actions(run)], "studio-pane studio-controls"));
    const form = el("form", {}, controls);
    file.addEventListener("change", () => {
      run.disabled = !file.files.length;
      notice.textContent = "";
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const source = file.files[0];
      if (!source) return;
      const edge = Number(margin.value) * mm;
      controls.disabled = run.disabled = true;
      notice.textContent = "Opening PDF…";
      try {
        guardFile(source);
        const original = await PDFLib.PDFDocument.load(await source.arrayBuffer(), { updateMetadata: false });
        if (!original.getPageCount() || original.getPageCount() > 100) throw new Error("Choose a PDF with 1 to 100 pages.");
        const output = await PDFLib.PDFDocument.create();
        for (const page of original.getPages()) {
          const crop = page.getCropBox();
          const angle = ((page.getRotation().angle % 360) + 360) % 360;
          const sideways = angle === 90 || angle === 270;
          const sourceWidth = sideways ? crop.height : crop.width;
          const sourceHeight = sideways ? crop.width : crop.height;
          if (!(sourceWidth > 0 && sourceHeight > 0)) throw new Error("The PDF contains an invalid page size.");
          const paperPoints = paperSizes[paper.value].map((size) => size * mm);
          const landscape = orientation.value === "landscape" || (orientation.value === "auto" && sourceWidth > sourceHeight);
          const [width, height] = landscape ? paperPoints.reverse() : paperPoints;
          const target = output.addPage([width, height]);
          if (!page.node.Contents()) continue;
          const embedded = await output.embedPage(page, {
            left: crop.x, bottom: crop.y, right: crop.x + crop.width, top: crop.y + crop.height,
          });
          const scale = Math.min((width - 2 * edge) / sourceWidth, (height - 2 * edge) / sourceHeight);
          const fittedWidth = sourceWidth * scale;
          const fittedHeight = sourceHeight * scale;
          const x = (width - fittedWidth) / 2;
          const y = (height - fittedHeight) / 2;
          const offsets = { 0: [0, 0], 90: [0, fittedHeight], 180: [fittedWidth, fittedHeight], 270: [fittedWidth, 0] };
          const [dx, dy] = offsets[angle] || offsets[0];
          target.drawPage(embedded, { x: x + dx, y: y + dy, xScale: scale, yScale: scale, rotate: PDFLib.degrees(-angle) });
        }
        download(stem(source) + "-resized.pdf", await output.save(), "application/pdf");
        notice.textContent = "PDF ready · " + output.getPageCount() + " pages.";
      } catch (error) {
        notice.textContent = errorText(error);
      } finally {
        controls.disabled = false;
        run.disabled = !file.files.length;
      }
    });
    root.replaceChildren(panel("Set paper size", [form,
      hint("Page text and artwork stay in the print layout. Form fields, comments, links and interactive features may be omitted.")]));
  });

  T.register("screenshot-pdf-redactor", (root) => {
    const file = picker(imageAccept + "," + pdfAccept);
    const notice = live();
    const pageLabel = el("span", { class: "tp-pill", role: "status" });
    const view = el("div", { class: "fw-redaction-view" });
    const review = el("p", { class: "tp-hint" });
    const masks = new Map();
    let pdf;
    let image;
    let base;
    let preview;
    let current = 1;
    let total = 0;
    let openedFile;
    let drag;
    let busy = false;

    const boxes = () => masks.get(current) || [];
    const repaint = (draft) => {
      if (!base || !preview) return;
      const context = preview.getContext("2d");
      context.clearRect(0, 0, preview.width, preview.height);
      context.drawImage(base, 0, 0);
      paintMasks(preview, draft ? [...boxes(), draft] : boxes());
    };
    const addBox = (box) => {
      masks.set(current, [...boxes(), box]);
      repaint();
      sync();
    };

    const previous = button("Previous page", () => changePage(current - 1), "ghost");
    const next = button("Next page", () => changePage(current + 1), "ghost");
    const undo = button("Undo last box", () => {
      boxes().pop();
      repaint();
      sync();
      if (undo.disabled) boxForm.querySelector("input").focus();
    }, "ghost");
    const save = button("Download redacted copy", async () => {
      if (busy || ![...masks.values()].some((list) => list.length)) return;
      busy = true;
      sync();
      try {
        if (pdf) {
          const blob = await writeRasterPdf(pdf, 2350, 1, (page, count) => {
            notice.textContent = "Exporting page " + page + " of " + count + "…";
          }, masks);
          download(stem(openedFile) + "-redacted.pdf", blob);
        } else {
          const canvas = canvasFor(image.naturalWidth, image.naturalHeight);
          try {
            canvas.getContext("2d").drawImage(image, 0, 0);
            paintMasks(canvas, boxes());
            download(stem(openedFile) + "-redacted.png", await toBlob(canvas, "image/png"));
          } finally {
            releaseCanvas(canvas);
          }
        }
        notice.textContent = "Redacted copy ready.";
      } catch (error) {
        notice.textContent = errorText(error);
      } finally {
        busy = false;
        sync();
      }
    });

    const coordinates = [
      ["Left (%)", number(0, 99.9, 0, 0.1)],
      ["Top (%)", number(0, 99.9, 0, 0.1)],
      ["Width (%)", number(0.1, 100, 20, 0.1)],
      ["Height (%)", number(0.1, 100, 10, 0.1)],
    ];
    const boxFields = el("fieldset", { class: "fw-controls" },
      grid(...coordinates.map(([label, control]) => field(label, control))),
      actions(el("button", { type: "submit", class: "tp-btn tp-btn-ghost" }, "Add black box")));
    coordinates.forEach(([, control]) => { control.required = true; });
    const boxForm = el("form", {}, boxFields);
    boxForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (busy || !preview) return;
      const [x, y, width, height] = coordinates.map(([, control]) => Number(control.value) / 100);
      if (x + width > 1.000001 || y + height > 1.000001) {
        notice.textContent = "Place the whole box inside the page.";
        return;
      }
      notice.textContent = "";
      addBox({ x, y, width, height });
    });

    const pageControls = actions(previous, pageLabel, next);
    pageControls.classList.add("fw-redaction-controls");
    const editor = el("div", { class: "studio-split" },
      panel("Preview", [pageControls, view], "studio-pane studio-source"),
      panel("Redaction controls", [review,
        el("details", { class: "fw-details" }, el("summary", { text: "Add a box by position" }), boxForm),
        actions(undo, save)], "studio-pane studio-controls"));
    const sync = () => {
      const ready = Boolean(preview);
      const count = [...masks.values()].reduce((sum, list) => sum + list.length, 0);
      file.disabled = busy;
      editor.hidden = !ready;
      pageControls.hidden = total < 2;
      pageLabel.textContent = "Page " + current + " of " + total;
      previous.disabled = busy || current <= 1;
      next.disabled = busy || current >= total;
      boxFields.disabled = busy || !ready;
      undo.disabled = busy || !boxes().length;
      save.disabled = busy || !count;
      review.textContent = boxes().length + " on this page · " + count + " black boxes in total.";
    };

    function attachPreview(canvas) {
      const point = (event) => {
        const rect = canvas.getBoundingClientRect();
        const clamp = (value) => Math.max(0, Math.min(1, value));
        return { x: clamp((event.clientX - rect.left) / rect.width), y: clamp((event.clientY - rect.top) / rect.height) };
      };
      const rectangle = ({ x, y }, end) => ({
        x: Math.min(x, end.x), y: Math.min(y, end.y),
        width: Math.abs(x - end.x), height: Math.abs(y - end.y),
      });
      canvas.addEventListener("pointerdown", (event) => {
        if (busy || drag || event.button !== 0) return;
        drag = { id: event.pointerId, start: point(event) };
        canvas.setPointerCapture(event.pointerId);
      });
      canvas.addEventListener("pointermove", (event) => {
        if (drag?.id === event.pointerId) repaint(rectangle(drag.start, point(event)));
      });
      canvas.addEventListener("pointerup", (event) => {
        if (drag?.id !== event.pointerId) return;
        const box = rectangle(drag.start, point(event));
        drag = null;
        if (box.width * canvas.width >= 1 && box.height * canvas.height >= 1) addBox(box);
        else repaint();
      });
      canvas.addEventListener("lostpointercapture", () => {
        if (drag) { drag = null; repaint(); }
      });
    }

    async function changePage(page) {
      busy = true;
      drag = null;
      sync();
      try {
        let canvas;
        if (pdf) {
          ({ canvas } = await renderPdfPage(pdf, page, 1400));
        } else {
          const scale = Math.min(1, 1400 / Math.max(image.naturalWidth, image.naturalHeight));
          const width = Math.max(1, Math.round(image.naturalWidth * scale));
          const height = Math.max(1, Math.round(image.naturalHeight * scale));
          canvas = canvasFor(width, height);
          canvas.getContext("2d").drawImage(image, 0, 0, width, height);
        }
        if (base) releaseCanvas(base);
        if (preview) releaseCanvas(preview);
        base = canvas;
        current = page;
        preview = canvasFor(base.width, base.height);
        preview.setAttribute("aria-label", "Redaction preview. Draw boxes here or use Add a box by position.");
        attachPreview(preview);
        view.replaceChildren(preview);
        repaint();
        notice.textContent = "";
      } catch (error) {
        notice.textContent = errorText(error);
      } finally {
        busy = false;
        sync();
      }
    }

    file.addEventListener("change", async () => {
      const selected = file.files[0];
      if (!selected) return;
      busy = true;
      drag = null;
      masks.clear();
      if (base) releaseCanvas(base);
      if (preview) releaseCanvas(preview);
      base = preview = image = null;
      view.replaceChildren();
      sync();
      notice.textContent = "Opening file…";
      try {
        if (pdf) {
          const previousPdf = pdf;
          pdf = null;
          await previousPdf.destroy();
        }
        const header = await selected.slice(0, 5).text();
        if (header === "%PDF-" || /\.pdf$/i.test(selected.name)) {
          pdf = await openPdf(selected);
          total = pdf.numPages;
        } else {
          image = await loadImage(selected);
          total = 1;
        }
        openedFile = selected;
        await changePage(1);
      } catch (error) {
        notice.textContent = errorText(error);
      } finally {
        busy = false;
        sync();
      }
    });

    root.replaceChildren(panel("Redact private information", [
      field("Screenshot or PDF", file), notice,
      hint("Draw over the entire sensitive area. Review every page before saving. The exported PDF contains page images; text selection, links and forms are removed."),
      editor,
    ]));
    sync();
  });
})();
