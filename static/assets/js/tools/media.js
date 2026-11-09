"use strict";
(() => {
  const T = window.SANU_TOOLS;
  const { el, fileDrop, readFile, fmtBytes, safeName, download } = T;
  const q = (selector, root) => T.$(selector, root);
  const qa = (selector, root) => T.$$(selector, root);
  const status = (root, message, kind) => T.status(root, message, kind);

  if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/assets/vendor/pdf.worker.min.js";
  }

  let fflatePromise = null;
  const ensureFflate = () => {
    if (window.fflate) return Promise.resolve(window.fflate);
    if (!fflatePromise) {
      fflatePromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "/assets/vendor/fflate.js";
        script.onload = () => window.fflate ? resolve(window.fflate) : reject(new Error("ZIP library failed to load."));
        script.onerror = () => reject(new Error("ZIP library failed to load."));
        document.head.append(script);
      });
    }
    return fflatePromise;
  };
  const downloadAll = async (items, zipName) => {
    if (!items.length) return;
    try {
      const fflate = await ensureFflate();
      const entries = {};
      for (const item of items) entries[safeName(item.name)] = new Uint8Array(await item.blob.arrayBuffer());
      download(zipName, new Blob([fflate.zipSync(entries, { level: 6 })], { type: "application/zip" }));
      status(document.querySelector("[data-tool-page]"), `ZIP created with ${items.length} files.`, "ok");
    } catch (error) { T.toast(error.message, "error"); }
  };

  const loadImage = (source) => new Promise((resolve, reject) => {
    const image = new Image();
    const url = source instanceof Blob ? URL.createObjectURL(source) : source;
    image.onload = () => resolve({ image, url });
    image.onerror = () => { if (source instanceof Blob) URL.revokeObjectURL(url); reject(new Error("That image could not be opened.")); };
    image.src = url;
  });
  const canvasBlob = (canvas, type, quality) => new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error(`This browser cannot encode ${type.split("/")[1].toUpperCase()}.`)), type, quality);
  });
  const supportsType = (type) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL(type).startsWith(`data:${type}`);
  };
  const drawOnCanvas = (image, maxWidth = 0, background = "", maxHeight = 0) => {
    let width = image.naturalWidth || image.width || 1;
    let height = image.naturalHeight || image.height || 1;
    if (maxWidth && width > maxWidth) { height = Math.round(height * (maxWidth / width)); width = maxWidth; }
    if (maxHeight && height > maxHeight) { width = Math.round(width * (maxHeight / height)); height = maxHeight; }
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    const context = canvas.getContext("2d");
    if (background) { context.fillStyle = background; context.fillRect(0, 0, canvas.width, canvas.height); }
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  };
  const extensionFor = (mime) => ({ "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/avif": "avif", "application/pdf": "pdf" }[mime] || "bin");
  const replaceExtension = (name, extension) => {
    const base = String(name || "image").replace(/\.[^.]+$/, "");
    return `${safeName(base, "image")}.${extension}`;
  };
  const revokeLater = (url) => setTimeout(() => URL.revokeObjectURL(url), 60000);

  const renderImageResults = (root, items) => {
    const preview = q(".js-preview", root);
    const list = q(".js-files", root);
    preview.replaceChildren(...items.slice(0, 12).map((item) => {
      const url = URL.createObjectURL(item.blob);
      revokeLater(url);
      return el("figure", {}, el("img", { src: url, alt: item.name, loading: "lazy" }), el("figcaption", { text: `${item.name} · ${fmtBytes(item.blob.size)}` }));
    }));
    list.replaceChildren(...items.map((item) => el("div", { class: "tp-file-row" },
      el("strong", { text: item.name }),
      el("span", { text: `${fmtBytes(item.original)} → ${fmtBytes(item.blob.size)}` }),
      el("button", { type: "button", class: "tp-btn tp-btn-sm", onclick: () => download(item.name, item.blob, item.blob.type) }, "Save"))));
    const all = q("[data-all]", root);
    if (all) all.disabled = items.length < 2;
    const saved = items.reduce((sum, item) => sum + Math.max(0, item.original - item.blob.size), 0);
    status(root, `${items.length} image${items.length === 1 ? "" : "s"} converted · ${fmtBytes(saved)} saved.`, "ok");
    if (all) all.onclick = () => downloadAll(items, "converted-images.zip");
  };

  const buildImageTool = (root, config) => {
    const { accept, outputType, quality = false, background = false, maxWidth = true, label, hint } = config;
    root.innerHTML = `<div class="tp-panel"><div class="js-file-slot"></div>
      <div class="tp-cols">
        ${quality ? `<label class="tp-field"><span class="tp-label">Quality <b class="js-quality-value">${Math.round((config.defaultQuality || 0.9) * 100)}%</b></span><input class="tp-input js-quality" type="range" min="30" max="100" value="${Math.round((config.defaultQuality || 0.9) * 100)}"></label>` : ""}
        ${maxWidth ? `<label class="tp-field"><span class="tp-label">Max width (px, 0 = original)</span><input class="tp-input js-max" type="number" min="0" max="12000" value="${config.defaultWidth || 0}"></label>` : ""}
        ${background ? `<label class="tp-field"><span class="tp-label">Background</span><input class="tp-input js-background" type="color" value="#ffffff"></label>` : ""}
      </div>
      <div class="tp-actions"><button type="button" class="tp-btn tp-btn-primary" data-run disabled>${label}</button><button type="button" class="tp-btn" data-all disabled>Download all as ZIP</button></div>
      <div class="tp-preview js-preview"></div><div class="tp-file-list js-files"></div>
      <p class="tp-hint">${hint || "Files are processed in this tab and never uploaded."}</p></div>`;
    let files = [];
    const drop = fileDrop({ accept, multiple: true, label: "Drop images or choose files", onFiles: (list) => {
      files = list.filter((file) => file.type.startsWith("image/") || /\.(jpe?g|png|webp|avif|svg)$/i.test(file.name));
      q("[data-run]", root).disabled = !files.length;
      if (!files.length) return status(root, "Choose a JPG, PNG, WebP, AVIF or SVG image.", "error");
      status(root, `${files.length} image${files.length === 1 ? "" : "s"} ready.`, "info");
    }});
    q(".js-file-slot", root).append(drop.node);
    if (quality) q(".js-quality", root).addEventListener("input", () => { q(".js-quality-value", root).textContent = `${q(".js-quality", root).value}%`; });
    q("[data-run]", root).addEventListener("click", async () => {
      if (!files.length) return;
      if (!supportsType(outputType)) return status(root, `This browser cannot encode ${outputType.split("/")[1].toUpperCase()} images. Try Chrome or Edge, or choose another format.`, "error");
      const amount = Number(q(".js-quality", root)?.value || 90) / 100;
      const width = Number(q(".js-max", root)?.value || 0);
      const fill = background ? q(".js-background", root)?.value || "#ffffff" : "";
      const items = [];
      const button = q("[data-run]", root);
      button.disabled = true;
      try {
        for (let index = 0; index < files.length; index += 1) {
          const file = files[index];
          status(root, `Converting ${index + 1} of ${files.length}…`, "info");
          const { image, url } = await loadImage(file);
          const canvas = drawOnCanvas(image, width, fill);
          const blob = await canvasBlob(canvas, outputType, amount);
          URL.revokeObjectURL(url);
          items.push({ name: replaceExtension(file.name, extensionFor(outputType)), blob, original: file.size });
        }
        renderImageResults(root, items);
      } catch (error) { status(root, error.message, "error"); }
      finally { button.disabled = false; }
    });
  };

  T.register("image-compressor", (root) => {
    root.innerHTML = `<div class="tp-panel"><div class="js-file-slot"></div><div class="tp-cols">
      <label class="tp-field"><span class="tp-label">Quality <b class="js-quality-value">80%</b></span><input class="tp-input js-quality" type="range" min="25" max="95" value="80"></label>
      <label class="tp-field"><span class="tp-label">Max width (px, 0 = original)</span><input class="tp-input js-max" type="number" min="0" max="12000" value="2000"></label>
      <label class="tp-field"><span class="tp-label">Output</span><select class="tp-select js-format"><option value="keep">Keep format</option><option value="image/jpeg">JPG</option><option value="image/webp">WebP</option><option value="image/png">PNG</option></select></label>
      <label class="tp-field"><span class="tp-label">JPG background</span><input class="tp-input js-background" type="color" value="#ffffff"></label>
      </div><div class="tp-actions"><button type="button" class="tp-btn tp-btn-primary" data-run disabled>Compress images</button><button type="button" class="tp-btn" data-all disabled>Download all as ZIP</button></div><div class="tp-preview js-preview"></div><div class="tp-file-list js-files"></div><p class="tp-hint">PNG export is lossless but may be larger; JPG and WebP use your quality setting.</p></div>`;
    let files = [];
    const drop = fileDrop({ accept: "image/*", multiple: true, label: "Drop photos to compress", onFiles: (list) => {
      files = list.filter((file) => file.type.startsWith("image/"));
      q("[data-run]", root).disabled = !files.length;
      status(root, `${files.length} image${files.length === 1 ? "" : "s"} ready.`, "info");
    }});
    q(".js-file-slot", root).append(drop.node);
    q(".js-quality", root).addEventListener("input", () => { q(".js-quality-value", root).textContent = `${q(".js-quality", root).value}%`; });
    q("[data-run]", root).addEventListener("click", async () => {
      if (!files.length) return;
      const quality = Number(q(".js-quality", root).value) / 100;
      const maxWidth = Number(q(".js-max", root).value || 0);
      const format = q(".js-format", root).value;
      const background = q(".js-background", root).value;
      const items = [];
      const button = q("[data-run]", root);
      button.disabled = true;
      try {
        for (let index = 0; index < files.length; index += 1) {
          const file = files[index];
          status(root, `Compressing ${index + 1} of ${files.length}…`, "info");
          const { image, url } = await loadImage(file);
          let output = format;
          if (output === "keep") output = ["image/jpeg", "image/png", "image/webp"].includes(file.type) ? file.type : "image/jpeg";
          const canvas = drawOnCanvas(image, maxWidth, output === "image/jpeg" ? background : "");
          const blob = await canvasBlob(canvas, output, quality);
          URL.revokeObjectURL(url);
          items.push({ name: replaceExtension(file.name, extensionFor(output)), blob, original: file.size });
        }
        renderImageResults(root, items);
      } catch (error) { status(root, error.message, "error"); }
      finally { button.disabled = false; }
    });
  });

  T.register("jpg-to-png", (root) => buildImageTool(root, { accept: "image/jpeg,image/jpg", outputType: "image/png", maxWidth: true, label: "Convert to PNG", hint: "JPG photos become PNG files. Transparency is not added." }));
  T.register("jpg-to-webp", (root) => buildImageTool(root, { accept: "image/jpeg,image/jpg", outputType: "image/webp", quality: true, maxWidth: true, label: "Convert to WebP" }));
  T.register("png-to-jpg", (root) => buildImageTool(root, { accept: "image/png", outputType: "image/jpeg", quality: true, background: true, maxWidth: true, label: "Convert to JPG" }));
  T.register("png-to-webp", (root) => buildImageTool(root, { accept: "image/png", outputType: "image/webp", quality: true, maxWidth: true, label: "Convert to WebP" }));
  T.register("jpg-to-avif", (root) => buildImageTool(root, { accept: "image/jpeg,image/jpg", outputType: "image/avif", quality: true, maxWidth: true, label: "Convert to AVIF", hint: "AVIF encoding depends on browser support. If the button reports it is unavailable, use Chrome/Edge or the WebP tool." }));
  T.register("png-to-avif", (root) => buildImageTool(root, { accept: "image/png", outputType: "image/avif", quality: true, maxWidth: true, label: "Convert to AVIF", hint: "AVIF encoding depends on browser support. Transparency is preserved when supported." }));

  T.register("svg-to-png", (root) => {
    root.innerHTML = `<div class="tp-panel"><div class="js-file-slot"></div><label class="tp-field"><span class="tp-label">Or paste SVG code</span><textarea class="tp-textarea js-svg" rows="8" placeholder="<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'>…</svg>"></textarea></label><div class="tp-cols"><label class="tp-field"><span class="tp-label">Width (px, 0 = SVG size)</span><input class="tp-input js-width" type="number" min="0" max="8000" value="0"></label><label class="tp-field"><span class="tp-label">Background</span><input class="tp-input js-background" type="color" value="#ffffff"></label><label class="tp-field"><span class="tp-label">Transparent</span><select class="tp-select js-transparent"><option value="no">No</option><option value="yes">Yes</option></select></label></div><div class="tp-actions"><button type="button" class="tp-btn tp-btn-primary" data-run>Render PNG</button></div><div class="tp-preview js-preview"></div></div>`;
    let svgBlob = null;
    const drop = fileDrop({ accept: ".svg,image/svg+xml", label: "Drop an SVG file", onFiles: ([file]) => {
      svgBlob = file;
      q(".js-svg", root).value = "";
      status(root, `${file.name} ready.`, "info");
    }});
    q(".js-file-slot", root).append(drop.node);
    q("[data-run]", root).addEventListener("click", async () => {
      try {
        let blob = svgBlob;
        const code = q(".js-svg", root).value.trim();
        if (code) blob = new Blob([code], { type: "image/svg+xml" });
        if (!blob) return status(root, "Add an SVG file or paste SVG code first.", "error");
        const { image, url } = await loadImage(blob);
        const requested = Number(q(".js-width", root).value || 0);
        const background = q(".js-transparent", root).value === "yes" ? "" : q(".js-background", root).value;
        const canvas = drawOnCanvas(image, requested, background);
        const png = await canvasBlob(canvas, "image/png");
        URL.revokeObjectURL(url);
        q(".js-preview", root).replaceChildren(el("figure", {}, el("img", { src: URL.createObjectURL(png), alt: "Rendered SVG" }), el("figcaption", { text: `${canvas.width} × ${canvas.height} · ${fmtBytes(png.size)}` }), el("button", { type: "button", class: "tp-btn tp-btn-sm", onclick: () => download("rendered-svg.png", png, "image/png") }, "Save PNG")));
        status(root, "PNG rendered.", "ok");
      } catch (error) { status(root, error.message, "error"); }
    });
  });

  const readPdf = async (file) => {
    const bytes = new Uint8Array(await readFile(file, "buffer"));
    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
    return pdf;
  };

  T.register("pdf-merge", (root) => {
    root.innerHTML = `<div class="tp-panel"><div class="js-file-slot"></div><div class="tp-file-list js-files"></div><div class="tp-actions"><button type="button" class="tp-btn tp-btn-primary" data-run disabled>Merge PDFs</button><button type="button" class="tp-btn tp-btn-ghost" data-clear disabled>Clear</button></div><p class="tp-hint">Use the arrows to set the order. Encrypted PDFs may need to be unlocked first.</p></div>`;
    let files = [];
    const render = () => {
      q(".js-files", root).replaceChildren(...files.map((file, index) => el("div", { class: "tp-file-row" },
        el("strong", { text: `${index + 1}. ${file.name}` }), el("span", { text: fmtBytes(file.size) }),
        el("button", { type: "button", class: "tp-btn tp-btn-sm", disabled: index === 0, onclick: () => { [files[index - 1], files[index]] = [files[index], files[index - 1]]; render(); } }, "↑"),
        el("button", { type: "button", class: "tp-btn tp-btn-sm", disabled: index === files.length - 1, onclick: () => { [files[index + 1], files[index]] = [files[index], files[index + 1]]; render(); } }, "↓"),
        el("button", { type: "button", class: "tp-btn tp-btn-sm tp-btn-danger", onclick: () => { files.splice(index, 1); render(); } }, "×"))));
      q("[data-run]", root).disabled = files.length < 2;
      q("[data-clear]", root).disabled = !files.length;
    };
    const drop = fileDrop({ accept: ".pdf,application/pdf", multiple: true, label: "Drop PDF files to merge", onFiles: (list) => {
      files = [...files, ...list.filter((file) => file.type === "application/pdf" || /\.pdf$/i.test(file.name))];
      render();
      status(root, `${files.length} PDFs ready.`, "info");
    }});
    q(".js-file-slot", root).append(drop.node);
    q("[data-clear]", root).addEventListener("click", () => { files = []; render(); });
    q("[data-run]", root).addEventListener("click", async () => {
      try {
        const merged = await PDFLib.PDFDocument.create();
        for (let index = 0; index < files.length; index += 1) {
          status(root, `Merging ${index + 1} of ${files.length}…`, "info");
          const source = await PDFLib.PDFDocument.load(new Uint8Array(await readFile(files[index], "buffer")), { ignoreEncryption: true });
          const pages = await merged.copyPages(source, source.getPageIndices());
          pages.forEach((page) => merged.addPage(page));
        }
        const bytes = await merged.save();
        download("merged.pdf", new Blob([bytes], { type: "application/pdf" }));
        status(root, `Merged ${files.length} PDFs into ${merged.getPageCount()} pages.`, "ok");
      } catch (error) { status(root, `Could not merge: ${error.message}`, "error"); }
    });
    render();
  });

  T.register("pdf-split", (root) => {
    root.innerHTML = `<div class="tp-panel"><div class="js-file-slot"></div><label class="tp-field"><span class="tp-label">Page ranges</span><input class="tp-input js-ranges" placeholder="1-3, 4, 5-8"></label><div class="tp-actions"><button type="button" class="tp-btn tp-btn-primary" data-run disabled>Split PDF</button><button type="button" class="tp-btn" data-all disabled>Download all as ZIP</button></div><div class="tp-file-list js-files"></div><p class="tp-hint">Leave the ranges empty to split every page into its own PDF.</p></div>`;
    let file = null;
    let results = [];
    const drop = fileDrop({ accept: ".pdf,application/pdf", label: "Drop a PDF to split", onFiles: ([selected]) => {
      file = selected;
      q("[data-run]", root).disabled = false;
      status(root, `${selected.name} ready.`, "info");
    }});
    q(".js-file-slot", root).append(drop.node);
    const parseRanges = (value, max) => {
      if (!value.trim()) return Array.from({ length: max }, (_, index) => [index]);
      return value.split(",").map((part) => {
        const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
        if (!match) throw new Error(`"${part.trim()}" is not a valid page range.`);
        const start = Math.max(1, Number(match[1]));
        const end = Math.min(max, Number(match[2] || match[1]));
        if (start > end || start > max) throw new Error(`Range "${part.trim()}" is outside 1–${max}.`);
        return Array.from({ length: end - start + 1 }, (_, index) => start - 1 + index);
      });
    };
    q("[data-run]", root).addEventListener("click", async () => {
      try {
        const source = await PDFLib.PDFDocument.load(new Uint8Array(await readFile(file, "buffer")), { ignoreEncryption: true });
        const ranges = parseRanges(q(".js-ranges", root).value, source.getPageCount());
        results = [];
        for (let index = 0; index < ranges.length; index += 1) {
          status(root, `Building part ${index + 1} of ${ranges.length}…`, "info");
          const doc = await PDFLib.PDFDocument.create();
          const pages = await doc.copyPages(source, ranges[index]);
          pages.forEach((page) => doc.addPage(page));
          const bytes = await doc.save();
          const label = ranges[index].length === 1 ? `${ranges[index][0] + 1}` : `${ranges[index][0] + 1}-${ranges[index][ranges[index].length - 1] + 1}`;
          results.push({ name: `pages-${label}.pdf`, blob: new Blob([bytes], { type: "application/pdf" }) });
        }
        q(".js-files", root).replaceChildren(...results.map((item) => el("div", { class: "tp-file-row" }, el("strong", { text: item.name }), el("span", { text: fmtBytes(item.blob.size) }), el("button", { type: "button", class: "tp-btn tp-btn-sm", onclick: () => download(item.name, item.blob, "application/pdf") }, "Save"))));
        q("[data-all]", root).disabled = results.length < 2;
        status(root, `${results.length} PDF part${results.length === 1 ? "" : "s"} created.`, "ok");
      } catch (error) { status(root, error.message, "error"); }
    });
    q("[data-all]", root).addEventListener("click", () => downloadAll(results, "split-pdf.zip"));
  });

  const pdfPageToCanvas = async (page, dpi = 144) => {
    const viewport = page.getViewport({ scale: dpi / 72 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d");
    await page.render({ canvasContext: context, viewport }).promise;
    return { canvas, viewport };
  };

  T.register("pdf-to-image", (root) => {
    root.innerHTML = `<div class="tp-panel"><div class="js-file-slot"></div><div class="tp-cols"><label class="tp-field"><span class="tp-label">Format</span><select class="tp-select js-format"><option value="image/png">PNG</option><option value="image/jpeg">JPG</option></select></label><label class="tp-field"><span class="tp-label">Resolution</span><select class="tp-select js-dpi"><option value="110">110 DPI · small</option><option value="144" selected>144 DPI · balanced</option><option value="200">200 DPI · sharp</option><option value="300">300 DPI · print</option></select></label></div><div class="tp-actions"><button type="button" class="tp-btn tp-btn-primary" data-run disabled>Convert pages</button><button type="button" class="tp-btn" data-all disabled>Download all as ZIP</button></div><div class="tp-preview js-preview"></div><div class="tp-file-list js-files"></div></div>`;
    let file = null;
    let results = [];
    const drop = fileDrop({ accept: ".pdf,application/pdf", label: "Drop a PDF to render", onFiles: ([selected]) => { file = selected; q("[data-run]", root).disabled = false; status(root, `${selected.name} ready.`, "info"); }});
    q(".js-file-slot", root).append(drop.node);
    q("[data-run]", root).addEventListener("click", async () => {
      const format = q(".js-format", root).value;
      const dpi = Number(q(".js-dpi", root).value);
      if (!(format === "image/png" || supportsType(format))) return status(root, "This browser cannot encode JPG images.", "error");
      q("[data-run]", root).disabled = true;
      results = [];
      try {
        const pdf = await readPdf(file);
        for (let index = 1; index <= pdf.numPages; index += 1) {
          status(root, `Rendering page ${index} of ${pdf.numPages}…`, "info");
          const page = await pdf.getPage(index);
          const { canvas } = await pdfPageToCanvas(page, dpi);
          const blob = await canvasBlob(canvas, format, 0.9);
          results.push({ name: `page-${String(index).padStart(2, "0")}.${extensionFor(format)}`, blob, original: 0 });
        }
        q(".js-preview", root).replaceChildren(...results.slice(0, 12).map((item) => {
          const url = URL.createObjectURL(item.blob);
          revokeLater(url);
          return el("figure", {}, el("img", { src: url, alt: item.name }), el("figcaption", { text: item.name }));
        }));
        q(".js-files", root).replaceChildren(...results.map((item) => el("div", { class: "tp-file-row" }, el("strong", { text: item.name }), el("span", { text: fmtBytes(item.blob.size) }), el("button", { type: "button", class: "tp-btn tp-btn-sm", onclick: () => download(item.name, item.blob, item.blob.type) }, "Save"))));
        q("[data-all]", root).disabled = results.length < 2;
        status(root, `${results.length} page${results.length === 1 ? "" : "s"} rendered.`, "ok");
      } catch (error) { status(root, `Could not render the PDF: ${error.message}`, "error"); }
      finally { q("[data-run]", root).disabled = false; }
    });
    q("[data-all]", root).addEventListener("click", () => downloadAll(results, "pdf-pages.zip"));
  });

  T.register("pdf-viewer", (root) => {
    root.innerHTML = `<div class="tp-panel"><div class="js-file-slot"></div><div class="tp-actions js-controls" hidden><button type="button" class="tp-btn tp-btn-sm" data-prev>← Prev</button><span class="tp-pill js-page">Page 1</span><button type="button" class="tp-btn tp-btn-sm" data-next>Next →</button><label class="tp-pill"><span>Zoom</span><select class="tp-select js-zoom" style="padding:3px 6px"><option value="0.8">80%</option><option value="1" selected>100%</option><option value="1.4">140%</option><option value="2">200%</option></select></label><button type="button" class="tp-btn tp-btn-sm" data-print>Print</button><button type="button" class="tp-btn tp-btn-sm" data-save>Save</button></div><div class="tp-viewer js-pages"></div></div>`;
    let pdf = null;
    let fileBlob = null;
    let current = 1;
    const pages = () => [...q(".js-pages", root).querySelectorAll("canvas")];
    const render = async () => {
      if (!pdf) return;
      const scale = Number(q(".js-zoom", root).value || 1);
      const container = q(".js-pages", root);
      container.replaceChildren(el("p", { class: "tp-hint", text: "Rendering pages…" }));
      const canvases = [];
      for (let index = 1; index <= pdf.numPages; index += 1) {
        const page = await pdf.getPage(index);
        const viewport = page.getViewport({ scale: scale * (window.devicePixelRatio > 1 ? 1.35 : 1.1) });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        canvas.dataset.page = index;
        await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
        canvases.push(canvas);
      }
      container.replaceChildren(...canvases);
      q(".js-page", root).textContent = `Page ${current} of ${pdf.numPages}`;
    };
    const drop = fileDrop({ accept: ".pdf,application/pdf", label: "Drop a PDF to read", onFiles: async ([selected]) => {
      try {
        fileBlob = selected;
        pdf = await readPdf(selected);
        current = 1;
        q(".js-controls", root).hidden = false;
        await render();
        status(root, `${selected.name} · ${pdf.numPages} pages`, "ok");
      } catch (error) { status(root, `Could not open the PDF: ${error.message}`, "error"); }
    }});
    q(".js-file-slot", root).append(drop.node);
    q("[data-prev]", root).addEventListener("click", () => { current = Math.max(1, current - 1); pages()[current - 1]?.scrollIntoView({ behavior: "smooth", block: "start" }); q(".js-page", root).textContent = `Page ${current} of ${pdf.numPages}`; });
    q("[data-next]", root).addEventListener("click", () => { current = Math.min(pdf.numPages, current + 1); pages()[current - 1]?.scrollIntoView({ behavior: "smooth", block: "start" }); q(".js-page", root).textContent = `Page ${current} of ${pdf.numPages}`; });
    q(".js-zoom", root).addEventListener("change", render);
    q("[data-print]", root).addEventListener("click", () => window.print());
    q("[data-save]", root).addEventListener("click", () => { if (fileBlob) download(safeName(fileBlob.name || "document.pdf"), fileBlob); });
  });

  T.register("image-to-pdf", (root) => {
    root.innerHTML = `<div class="tp-panel"><div class="js-file-slot"></div><div class="tp-cols"><label class="tp-field"><span class="tp-label">Page size</span><select class="tp-select js-size"><option value="a4">A4</option><option value="letter">Letter</option><option value="fit">Fit to image</option></select></label><label class="tp-field"><span class="tp-label">Margin</span><select class="tp-select js-margin"><option value="0">None</option><option value="18" selected>Small</option><option value="36">Large</option></select></label></div><div class="tp-actions"><button type="button" class="tp-btn tp-btn-primary" data-run disabled>Create PDF</button></div><div class="tp-preview js-preview"></div><div class="tp-file-list js-files"></div></div>`;
    let files = [];
    const drop = fileDrop({ accept: "image/*", multiple: true, label: "Drop images for the PDF", onFiles: (list) => {
      files = list.filter((file) => file.type.startsWith("image/"));
      q("[data-run]", root).disabled = !files.length;
      q(".js-files", root).replaceChildren(...files.map((file) => el("div", { class: "tp-file-row" }, el("strong", { text: file.name }), el("span", { text: fmtBytes(file.size) }))));
      status(root, `${files.length} image${files.length === 1 ? "" : "s"} ready.`, "info");
    }});
    q(".js-file-slot", root).append(drop.node);
    q("[data-run]", root).addEventListener("click", async () => {
      try {
        const size = q(".js-size", root).value;
        const margin = Number(q(".js-margin", root).value);
        const { jsPDF } = window.jspdf;
        let doc = null;
        for (let index = 0; index < files.length; index += 1) {
          status(root, `Adding image ${index + 1} of ${files.length}…`, "info");
          const file = files[index];
          const buffer = await readFile(file, "buffer");
          const { image } = await loadImage(new Blob([buffer], { type: file.type || "image/jpeg" }));
          let dataUrl;
          let imageFormat;
          if (file.type === "image/png" || file.type === "image/jpeg") {
            dataUrl = await readFile(file, "dataurl");
            imageFormat = file.type === "image/png" ? "PNG" : "JPEG";
          } else {
            dataUrl = drawOnCanvas(image, 0, "#ffffff").toDataURL("image/jpeg", 0.9);
            imageFormat = "JPEG";
          }
          const pageWidth = size === "letter" ? 612 : 595.28;
          const pageHeight = size === "letter" ? 792 : 841.89;
          const width = image.naturalWidth;
          const height = image.naturalHeight;
          const format = size === "fit" ? [width, height] : [pageWidth, pageHeight];
          const orientation = format[0] > format[1] ? "landscape" : "portrait";
          if (!doc) doc = new jsPDF({ unit: "pt", format, orientation, compress: true });
          else doc.addPage(format, orientation);
          const availableWidth = format[0] - margin * 2;
          const availableHeight = format[1] - margin * 2;
          const ratio = Math.min(availableWidth / width, availableHeight / height);
          const drawWidth = width * ratio;
          const drawHeight = height * ratio;
          doc.addImage(dataUrl, imageFormat, (format[0] - drawWidth) / 2, (format[1] - drawHeight) / 2, drawWidth, drawHeight, undefined, "FAST");
        }
        const blob = doc.output("blob");
        download("images.pdf", blob, "application/pdf");
        status(root, `PDF created with ${files.length} page${files.length === 1 ? "" : "s"} · ${fmtBytes(blob.size)}.`, "ok");
      } catch (error) { status(root, `Could not build the PDF: ${error.message}`, "error"); }
    });
  });

  T.register("markdown-to-pdf", (root) => {
    root.innerHTML = `<div class="tp-panel"><div class="js-file-slot"></div><label class="tp-field"><span class="tp-label">Markdown</span><textarea class="tp-textarea js-in" rows="12" placeholder="# Report&#10;&#10;Markdown becomes a clean PDF."></textarea></label><div class="tp-actions"><button type="button" class="tp-btn tp-btn-primary" data-run>Create PDF</button><button type="button" class="tp-btn tp-btn-ghost" data-load>Load .md file</button></div></div>`;
    let dropped = "";
    const drop = fileDrop({ accept: ".md,.markdown,text/markdown,text/plain", label: "Drop a Markdown file", onFiles: async ([file]) => {
      dropped = await readFile(file, "text");
      q(".js-in", root).value = dropped;
      status(root, `${file.name} loaded.`, "ok");
    }});
    q(".js-file-slot", root).append(drop.node);
    q("[data-load]", root).addEventListener("click", () => q(".js-in", root).focus());
    const inlineText = (token) => token.tokens ? token.tokens.map(inlineText).join("") : token.text || "";
    q("[data-run]", root).addEventListener("click", () => {
      try {
        const source = q(".js-in", root).value.trim();
        if (!source) return status(root, "Add some Markdown first.", "error");
        const tokens = marked.lexer(source);
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
        const margin = 54;
        const width = doc.internal.pageSize.getWidth() - margin * 2;
        const height = doc.internal.pageSize.getHeight();
        let y = margin;
        const nextPage = (needed) => { if (y + needed > height - margin) { doc.addPage(); y = margin; } };
        const write = (text, size, style = "normal", indent = 0, lineGap = 1.5) => {
          doc.setFont("helvetica", style);
          doc.setFontSize(size);
          const lines = doc.splitTextToSize(text, width - indent);
          lines.forEach((line) => { nextPage(size * lineGap); doc.text(line, margin + indent, y); y += size * lineGap; });
        };
        tokens.forEach((token) => {
          if (token.type === "heading") { y += 6; write(inlineText(token), [22, 18, 15, 13, 12, 11][token.depth - 1] || 12, "bold"); y += 8; }
          else if (token.type === "paragraph") { write(inlineText(token), 11); y += 8; }
          else if (token.type === "list") {
            token.items.forEach((item) => { write(`• ${inlineText(item).trim()}`, 11, "normal", 12); y += 2; });
            y += 6;
          } else if (token.type === "code") {
            doc.setFillColor(242, 243, 244); doc.rect(margin, y - 10, width, token.text.split("\n").length * 12 + 10, "F");
            token.text.split("\n").forEach((line) => { write(line || " ", 9, "normal", 8, 1.35); });
            y += 8;
          } else if (token.type === "blockquote") { write(inlineText(token), 11, "italic", 18); y += 6; }
          else if (token.type === "hr") { nextPage(20); doc.setDrawColor(190); doc.line(margin, y, margin + width, y); y += 14; }
          else if (token.type === "space") y += 4;
        });
        const blob = doc.output("blob");
        download("markdown-document.pdf", blob, "application/pdf");
        status(root, `PDF created · ${fmtBytes(blob.size)}.`, "ok");
      } catch (error) { status(root, `Could not create the PDF: ${error.message}`, "error"); }
    });
  });

  T.register("pdf-compress", (root) => {
    root.innerHTML = `<div class="tp-panel"><div class="js-file-slot"></div><div class="tp-cols"><label class="tp-field"><span class="tp-label">Method</span><select class="tp-select js-method"><option value="optimize">Optimize structure (safe)</option><option value="raster">Rasterize pages (stronger)</option></select></label><label class="tp-field"><span class="tp-label">Raster DPI</span><select class="tp-select js-dpi"><option value="96">96 DPI</option><option value="120" selected>120 DPI</option><option value="150">150 DPI</option></select></label><label class="tp-field"><span class="tp-label">JPEG quality</span><select class="tp-select js-quality"><option value="0.55">55%</option><option value="0.7" selected>70%</option><option value="0.85">85%</option></select></label></div><div class="tp-actions"><button type="button" class="tp-btn tp-btn-primary" data-run disabled>Compress PDF</button></div><div class="tp-file-list js-files"></div><p class="tp-hint">Rasterizing turns each page into an image — excellent for scans, but text stops being selectable.</p></div>`;
    let file = null;
    const drop = fileDrop({ accept: ".pdf,application/pdf", label: "Drop a PDF to compress", onFiles: ([selected]) => { file = selected; q("[data-run]", root).disabled = false; status(root, `${selected.name} · ${fmtBytes(selected.size)}`, "info"); }});
    q(".js-file-slot", root).append(drop.node);
    q("[data-run]", root).addEventListener("click", async () => {
      const method = q(".js-method", root).value;
      q("[data-run]", root).disabled = true;
      try {
        let blob;
        if (method === "optimize") {
          status(root, "Rewriting PDF structure…", "info");
          const doc = await PDFLib.PDFDocument.load(new Uint8Array(await readFile(file, "buffer")), { ignoreEncryption: true, updateMetadata: false });
          const bytes = await doc.save({ useObjectStreams: true });
          blob = new Blob([bytes], { type: "application/pdf" });
        } else {
          const dpi = Number(q(".js-dpi", root).value);
          const quality = Number(q(".js-quality", root).value);
          const pdf = await readPdf(file);
          const { jsPDF } = window.jspdf;
          let doc = null;
          for (let index = 1; index <= pdf.numPages; index += 1) {
            status(root, `Rasterizing page ${index} of ${pdf.numPages}…`, "info");
            const page = await pdf.getPage(index);
            const { canvas, viewport } = await pdfPageToCanvas(page, dpi);
            const image = canvas.toDataURL("image/jpeg", quality);
            const pageWidth = viewport.width * 72 / dpi;
            const pageHeight = viewport.height * 72 / dpi;
            const format = [pageWidth, pageHeight];
            const orientation = pageWidth > pageHeight ? "landscape" : "portrait";
            if (!doc) doc = new jsPDF({ unit: "pt", format, orientation, compress: true });
            else doc.addPage(format, orientation);
            doc.addImage(image, "JPEG", 0, 0, pageWidth, pageHeight, undefined, "FAST");
          }
          blob = doc.output("blob");
        }
        const outputName = `compressed-${(file.name || "document").replace(/\.pdf$/i, "")}.pdf`;
        download(outputName, blob, "application/pdf");
        const saved = file.size - blob.size;
        q(".js-files", root).replaceChildren(el("div", { class: "tp-file-row" }, el("strong", { text: outputName }), el("span", { text: `${fmtBytes(file.size)} → ${fmtBytes(blob.size)} (${saved > 0 ? "saved " + fmtBytes(saved) : "larger"})` })));
        status(root, saved > 0 ? `Compressed by ${fmtBytes(saved)}.` : "This PDF is already well optimized; the output is slightly larger.", saved > 0 ? "ok" : "info");
      } catch (error) { status(root, `Could not compress: ${error.message}`, "error"); }
      finally { q("[data-run]", root).disabled = false; }
    });
  });
})();
