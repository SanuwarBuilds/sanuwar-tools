"use strict";
(() => {
  const T = window.SANU_TOOLS;
  const { el, input, field, panel, button, actions, select, download, safeName } = T;
  const { loadImage, canvasFor, releaseCanvas, toBlob, openPdf, renderPdfPage, createOcr } = T.localFiles;
  const transfer = window.SanuFileTransfer;
  const imageTypes = ".jpg,.jpeg,.png,.webp,.bmp,image/jpeg,image/png,image/webp";
  const live = () => el("p", { role: "status", class: "sw-status" });
  const hint = (text) => el("p", { class: "tp-hint", text });
  const stage = (...children) => el("div", { class: "sw-stage" }, children);
  const filename = (file, suffix) => safeName(file.name.replace(/\.[^.]+$/, ""), "result") + suffix;
  const problem = (error) => error?.message || "Could not process the file.";
  const localScript = (src, ready) => {
    if (ready()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = el("script", { src });
      script.onload = () => ready() ? resolve() : reject(new Error("The processing library did not initialize."));
      script.onerror = () => { script.remove(); reject(new Error("Could not load the processing library. Try again.")); };
      document.head.append(script);
    });
  };

  function resultBar(label, getResult, status, links) {
    let pending = false;
    const run = (fn) => async () => {
      const result = getResult();
      if (!result || pending) return;
      pending = true;
      try { await fn(result); }
      catch (error) { status.textContent = problem(error); }
      finally { pending = false; }
    };
    const bar = actions(button(label, run(({ blob, name }) => download(name, blob))));
    if (links.length) {
      bar.append(el("div", { class: "sw-continue", role: "group", "aria-label": "Continue in another tool" },
        links.map(([text, path, role]) => button(text, run(({ blob, name }) =>
          transfer.send(path, blob, name, role)), "ghost"))));
    }
    bar.classList.add("sw-export");
    bar.hidden = true;
    return bar;
  }

  function fittedCanvas(image, edge) {
    const scale = Math.min(1, edge / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = canvasFor(Math.max(1, Math.round(image.naturalWidth * scale)), Math.max(1, Math.round(image.naturalHeight * scale)));
    const context = canvas.getContext("2d");
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  T.register("scan-to-pdf", (root) => {
    const scan = T.smartScan;
    const status = live();
    const files = input({ type: "file", accept: imageTypes + ",.heic,.heif,.pdf,application/pdf", multiple: true });
    const camera = input({ type: "file", accept: "image/*", capture: "environment", hidden: true, "aria-label": "Camera image" });
    const takePhoto = button("Use camera", () => camera.click(), "ghost");
    const paper = select([["Match scan", "image"], ["A4", "a4"], ["US Letter", "letter"]], "a4");
    const filter = select([["Enhanced color", "color"], ["Grayscale", "gray"], ["Black & white", "bw"], ["Original colors", "original"]], "color");
    const canvas = canvasFor(1, 1);
    canvas.setAttribute("aria-label", "Selected page preview");
    const svgNS = "http://www.w3.org/2000/svg";
    const cropOverlay = document.createElementNS(svgNS, "svg");
    cropOverlay.setAttribute("viewBox", "0 0 1000 1000");
    cropOverlay.setAttribute("preserveAspectRatio", "none");
    cropOverlay.setAttribute("aria-hidden", "true");
    const cropOutline = document.createElementNS(svgNS, "polygon");
    cropOverlay.append(cropOutline);
    const handles = ["Top left", "Top right", "Bottom right", "Bottom left"].map((name) =>
      el("button", { type: "button", class: "sw-corner", "aria-label": name + " corner" }));
    const cropLayer = el("div", { class: "sw-corners", hidden: true }, cropOverlay, handles);
    const surface = el("div", { class: "sw-scan-surface" }, canvas, cropLayer);
    const preview = stage(surface);
    preview.classList.add("sw-scan-stage");
    const empty = el("div", { class: "sw-scan-empty" },
      el("span", { class: "sw-scan-mark", "aria-hidden": "true" }),
      el("p", { text: "Add a photo or scanned PDF to preview the scan." }));
    const rows = el("ol", { class: "sw-pages" });
    const pages = [];
    let selected = null;
    let view = "clean";
    let rendered;
    let result;
    let busy = false;
    let drag;
    const views = [["Enhanced", "clean"], ["Original", "original"], ["Adjust corners", "crop"]].map(([label, mode]) =>
      [button(label, () => { view = mode; update(false); }, "ghost"), mode]);
    const viewBar = el("div", { class: "sw-scan-views", role: "group", "aria-label": "Preview mode" }, views.map(([control]) => control));
    const scanInfo = el("p", { class: "tp-hint sw-scan-info" });
    const adjustment = hint("Drag a corner, or focus it and use the arrow keys. Hold Shift for larger steps.");
    const reset = button("Use full page", () => {
      selected.corners = scan.fullPage();
      selected.cornerMode = "full";
      update();
    }, "ghost");
    const auto = button("Use detected corners", () => {
      selected.corners = selected.detected;
      selected.cornerMode = "auto";
      update();
    }, "ghost");
    const rotate = button("Rotate 90°", () => {
      selected.rotation = (selected.rotation + 90) % 360;
      view = "clean";
      update();
    }, "ghost");
    const cropActions = actions(reset, auto);
    cropActions.classList.add("sw-crop-actions");
    const editor = el("div", { class: "sw-scan-editor", hidden: true },
      viewBar, preview, scanInfo, adjustment, cropActions,
      el("div", { class: "sw-scan-settings" }, field("Scan filter", filter), rotate));
    const output = resultBar("Download PDF", () => result, status, [
      ["Edit PDF", "/tools/pdf-editor", "pdf"], ["Add searchable text", "/tools/searchable-pdf", "pdf"],
      ["Add to Application Pack", "/tools/application-file-pack", "pdf"],
    ]);

    function invalidateResult() {
      result = null;
      output.hidden = true;
    }

    function updateCorners() {
      cropOutline.setAttribute("points", selected.corners.map(([x, y], i) => {
        handles[i].style.left = (x * 100) + "%";
        handles[i].style.top = (y * 100) + "%";
        return (x * 1000) + "," + (y * 1000);
      }).join(" "));
      scanInfo.textContent = {
        auto: "Document corners detected automatically.",
        manual: "Custom document corners.",
        full: "Using the full page.",
        none: "Using the full page. Adjust corners if you see a border or desk around the document.",
      }[selected.cornerMode];
    }

    function renderPreview() {
      const isCrop = view === "crop";
      cropLayer.hidden = adjustment.hidden = cropActions.hidden = !isCrop;
      if (isCrop) updateCorners();
      else scanInfo.textContent = view === "original" ? "Source preview before cropping and cleanup."
        : selected.cornerMode === "auto" ? "Auto-cropped and straightened." : selected.cornerMode === "manual" ? "Straightened using your corners." : "";
      const previewMode = view === "clean" ? view : "source";
      const last = rendered;
      if (last?.page === selected && last.view === previewMode && (previewMode === "source" ||
          (last.corners === selected.corners && last.mode === selected.mode && last.rotation === selected.rotation))) return;

      if (view === "clean") scan.draw(selected, canvas, 940);
      else {
        const scale = Math.min(1, 940 / Math.max(selected.image.width, selected.image.height));
        canvas.width = Math.max(1, Math.round(selected.image.width * scale));
        canvas.height = Math.max(1, Math.round(selected.image.height * scale));
        canvas.getContext("2d").drawImage(selected.image, 0, 0, canvas.width, canvas.height);
      }
      surface.style.setProperty("--sw-scan-width", (435 * canvas.width / canvas.height) + "px");
      rendered = { page: selected, view: previewMode, corners: selected.corners, mode: selected.mode, rotation: selected.rotation };
    }

    function moveCorner(index, x, y) {
      const corners = selected.corners.map((point, i) =>
        i === index ? [Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, y))] : point);
      if (!scan.validCorners(corners)) return;
      selected.corners = corners;
      selected.cornerMode = "manual";
      invalidateResult();
      updateCorners();
    }

    handles.forEach((handle, index) => {
      handle.onpointerdown = (event) => {
        if (event.button !== 0 || drag) return;
        const bounds = surface.getBoundingClientRect();
        drag = { id: event.pointerId, index, bounds, x: event.clientX, y: event.clientY, point: selected.corners[index] };
        handle.setPointerCapture(event.pointerId);
      };
      handle.onpointermove = (event) => {
        if (drag?.id !== event.pointerId || drag.index !== index) return;
        moveCorner(index, drag.point[0] + (event.clientX - drag.x) / drag.bounds.width,
          drag.point[1] + (event.clientY - drag.y) / drag.bounds.height);
      };
      handle.onlostpointercapture = (event) => { if (drag?.id === event.pointerId) drag = null; };
      handle.onkeydown = (event) => {
        const offset = { ArrowLeft: [-1, 0], ArrowUp: [0, -1], ArrowRight: [1, 0], ArrowDown: [0, 1] }[event.key];
        if (!offset) return;
        event.preventDefault();
        const step = event.shiftKey ? .035 : .007;
        const [x, y] = selected.corners[index];
        moveCorner(index, x + offset[0] * step, y + offset[1] * step);
      };
    });

    function update(invalidate = true) {
      if (invalidate) invalidateResult();
      files.disabled = camera.disabled = takePhoto.disabled = paper.disabled = busy;
      filter.disabled = rotate.disabled = reset.disabled = busy;
      auto.disabled = busy || !selected?.detected;
      views.forEach(([control, mode]) => {
        control.disabled = busy;
        control.setAttribute("aria-pressed", String(mode === view));
      });
      handles.forEach((handle) => { handle.disabled = busy; });
      editor.hidden = !selected;
      empty.hidden = Boolean(selected);
      generate.disabled = busy || !pages.length;
      rows.replaceChildren(...pages.map((page, index) => {
        const focusPage = (i) => rows.children[i]?.querySelector("button")?.focus();
        const shift = (offset) => {
          [pages[index], pages[index + offset]] = [pages[index + offset], pages[index]];
          update();
          focusPage(index + offset);
        };
        const open = button((index + 1) + ". " + page.name, () => { selected = page; view = "clean"; update(false); focusPage(index); },
          "ghost", { class: "sw-page-name", disabled: busy, "aria-pressed": String(page === selected) });
        return el("li", {}, open,
          button("↑", () => shift(-1), "ghost", { disabled: busy || index === 0, "aria-label": "Move page " + (index + 1) + " earlier" }),
          button("↓", () => shift(1), "ghost", { disabled: busy || index === pages.length - 1, "aria-label": "Move page " + (index + 1) + " later" }),
          button("×", () => {
            pages.splice(index, 1);
            releaseCanvas(page.image);
            if (selected === page) { selected = pages[Math.min(index, pages.length - 1)] || null; view = "clean"; }
            update();
            if (pages.length) focusPage(Math.min(index, pages.length - 1));
            else files.focus();
          }, "ghost", { disabled: busy, "aria-label": "Remove page " + (index + 1) }));
      }));
      if (selected) {
        filter.value = selected.mode;
        renderPreview();
      } else if (rendered) {
        releaseCanvas(canvas);
        rendered = null;
      }
    }

    function appendPage(image, name, hasText = false) {
      try {
        const pixels = pages.reduce((sum, page) => sum + page.image.width * page.image.height, 0);
        if (pixels + image.width * image.height > 24_000_000) {
          throw new Error("This batch is too large for the editor. Export a smaller batch first.");
        }
        const detected = hasText ? null : scan.detectCorners(image);
        const page = {
          image, name, detected, corners: detected || scan.fullPage(), rotation: 0,
          mode: hasText ? "original" : "color", cornerMode: hasText ? "full" : detected ? "auto" : "none",
        };
        pages.push(page);
        selected ||= page;
      } catch (error) {
        releaseCanvas(image);
        throw error;
      }
    }

    async function scanImage(file) {
      if (/\.(heic|heif)$/i.test(file.name) || /^image\/hei[cf]/i.test(file.type)) {
        T.localFiles.guardFile(file);
        const { heicTo, isHeic } = await import("/assets/vendor/heic/heic-to.min.js?v=1.6.7");
        if (!(await isHeic(file))) throw new Error("This HEIC or HEIF image could not be read.");
        const jpeg = await heicTo({ blob: file, type: "image/jpeg", quality: .94 });
        return fittedCanvas(await loadImage(jpeg), 2000);
      }
      return fittedCanvas(await loadImage(file), 2000);
    }

    async function add(list) {
      if (busy || !list.length) return;
      busy = true;
      update(false);
      const initialCount = pages.length;
      const errors = [];
      let rasterizedText = false;
      try {
        for (const file of list) {
          if (pages.length >= 30) { errors.push("Up to 30 pages per scan."); break; }
          let pdf;
          try {
            status.textContent = "Opening " + file.name + "…";
            const header = new TextDecoder().decode(await file.slice(0, 5).arrayBuffer());
            if (header === "%PDF-" || /\.pdf$/i.test(file.name) || file.type === "application/pdf") {
              pdf = await openPdf(file);
              for (let number = 1; number <= pdf.numPages; number++) {
                if (pages.length >= 30) { errors.push("Up to 30 pages per scan."); break; }
                status.textContent = file.name + " · Importing page " + number + " of " + pdf.numPages + "…";
                const pdfPage = await pdf.getPage(number);
                const hasText = (await pdfPage.getTextContent()).items.some((item) => item.str?.trim());
                const { canvas: image } = await renderPdfPage(pdf, number, 2000);
                appendPage(image, file.name + " · " + number, hasText);
                rasterizedText ||= hasText;
              }
            } else appendPage(await scanImage(file), file.name);
          } catch (error) { errors.push(file.name + " · " + problem(error)); }
          finally { await pdf?.destroy().catch(() => {}); }
        }
      } finally {
        files.value = camera.value = "";
        busy = false;
        const added = pages.length - initialCount;
        update(added > 0);
        status.textContent = [
          added ? added + (added === 1 ? " page added." : " pages added.") : "",
          rasterizedText ? "Imported PDF text becomes an image. You can add searchable text after export." : "",
          ...new Set(errors),
        ].filter(Boolean).join(" ");
      }
    }
    files.onchange = () => void add([...files.files]);
    camera.onchange = () => void add([...camera.files]);
    paper.onchange = () => update();
    filter.onchange = () => { selected.mode = filter.value; view = "clean"; update(); };

    const generate = button("Create PDF", async () => {
      busy = true;
      update();
      try {
        const doc = await PDFLib.PDFDocument.create();
        for (const [i, item] of pages.entries()) {
          status.textContent = "Building page " + (i + 1) + " of " + pages.length + "…";
          const pageCanvas = canvasFor(1, 1);
          try {
            scan.draw(item, pageCanvas, 2000);
            const image = await doc.embedJpg(await (await toBlob(pageCanvas, "image/jpeg", .91)).arrayBuffer());
            let dims = paper.value === "a4" ? [595.28, 841.89] : paper.value === "letter" ? [612, 792] : [
              720 * image.width / Math.max(image.width, image.height), 720 * image.height / Math.max(image.width, image.height)];
            if (paper.value !== "image" && image.width > image.height) dims = dims.reverse();
            const page = doc.addPage(dims);
            const padding = paper.value === "image" ? 0 : 18;
            const mark = image.scale(Math.min((dims[0] - padding * 2) / image.width, (dims[1] - padding * 2) / image.height));
            page.drawImage(image, { ...mark, x: (dims[0] - mark.width) / 2, y: (dims[1] - mark.height) / 2 });
          } finally { releaseCanvas(pageCanvas); }
        }
        result = { blob: new Blob([await doc.save()], { type: "application/pdf" }), name: "document-scan.pdf" };
        output.hidden = false;
        status.textContent = "PDF ready · " + pages.length + (pages.length === 1 ? " page" : " pages");
      } catch (error) { status.textContent = problem(error); }
      finally { busy = false; update(false); }
    });

    root.replaceChildren(panel("", [el("div", { class: "sw-layout sw-scan-layout" },
      el("div", { class: "sw-controls" }, el("h2", { text: "Scan pages" }),
        el("div", { class: "sw-scan-import" }, field("Add photos or PDFs", files), camera, takePhoto,
          hint("JPG, PNG, WebP, BMP, HEIC, HEIF or PDF. Files stay on this device.")), rows),
      el("div", { class: "sw-preview" }, el("h2", { text: "Page preview" }), empty, editor)),
    el("div", { class: "sw-scan-output" }, field("PDF page size", paper), actions(generate)), status, output]));
    update();
  });

  T.register("searchable-pdf", (root) => {
    const file = input({ type: "file", accept: ".pdf,application/pdf" });
    const language = select([["English", "eng"], ["Hindi", "hin"], ["Bangla", "ben"]], "eng");
    const status = live();
    const output = el("div", { class: "sw-ocr-output" });
    let result;
    let busy = false;
    const downloads = resultBar("Download searchable PDF", () => result, status, [
      ["Open in PDF Editor", "/tools/pdf-editor", "pdf"], ["Add to Application Pack", "/tools/application-file-pack", "pdf"],
    ]);
    const run = button("Add searchable text", async () => {
      if (!file.files[0] || busy) return;
      busy = true;
      let renderer;
      let worker;
      try {
        file.disabled = language.disabled = run.disabled = true;
        downloads.hidden = true;
        output.replaceChildren();
        const inputFile = file.files[0];
        status.textContent = "Opening PDF…";
        renderer = await openPdf(inputFile);
        const document = await PDFLib.PDFDocument.load(await inputFile.arrayBuffer(), { updateMetadata: false });
        let font;
        let detected = 0;
        let processed = 0;
        let skipped = 0;
        for (const [index, page] of document.getPages().entries()) {
          const source = await renderer.getPage(index + 1);
          if ((await source.getTextContent()).items.some((item) => item.str?.trim())) { skipped++; continue; }
          if (!font) {
            if (language.value === "eng") font = await document.embedFont(PDFLib.StandardFonts.Helvetica);
            else {
              const base = "/assets/vendor/ocr-fonts";
              await localScript(base + "/fontkit.min.js", () => window.fontkit);
              // The hidden layer uses logical character order for search and copy.
              // Shaping Indic glyphs would reorder some vowel signs in ToUnicode.
              document.registerFontkit({
                create(bytes) {
                  const face = window.fontkit.create(bytes);
                  face.layout = (value) => ({
                    glyphs: Array.from(value, (character) => face.glyphForCodePoint(character.codePointAt(0))),
                  });
                  return face;
                },
              });
              const response = await fetch(base + "/" + language.value + ".ttf");
              if (!response.ok) throw new Error("Could not load the OCR font.");
              const fontData = await response.arrayBuffer();
              font = await document.embedFont(fontData, { subset: true });
            }
          }
          const label = "Page " + (index + 1) + " of " + renderer.numPages;
          status.textContent = label + " · Reading scan…";
          worker ||= await createOcr(language.value, (message) => { status.textContent = message; });
          const { canvas, viewport } = await renderPdfPage(renderer, index + 1, 2300);
          try {
            const { data } = await worker.recognize(canvas, {}, { text: true, blocks: true });
            const lines = (data.blocks || []).flatMap((block) => block.paragraphs).flatMap((paragraph) => paragraph.lines);
            const words = lines.flatMap((line) => line.words || []);
            const pdfFont = page.node.newFontDictionary(font.name, font.ref);
            const ops = [];
            for (const { text, bbox } of words) {
              const word = text.trim();
              if (!word) continue;
              const width = (bbox.x1 - bbox.x0) / viewport.scale;
              const height = (bbox.y1 - bbox.y0) / viewport.scale;
              const size = Math.max(1, height);
              let glyphs;
              let advance;
              try { glyphs = font.encodeText(word); advance = font.widthOfTextAtSize(word, size); }
              catch { continue; }
              if (!advance || !width) continue;
              const [x, y] = viewport.convertToPdfPoint(bbox.x0, bbox.y1);
              const [xx, yy] = viewport.convertToPdfPoint(bbox.x0 + viewport.scale, bbox.y1);
              const dx = xx - x;
              const dy = yy - y;
              const fit = width / advance;
              ops.push(PDFLib.setFontAndSize(pdfFont, size), PDFLib.setTextMatrix(dx * fit, dy * fit, -dy, dx, x, y), PDFLib.showText(glyphs));
              detected++;
            }
            if (ops.length) {
              page.pushOperators(PDFLib.pushGraphicsState(), PDFLib.beginText(),
                PDFLib.setTextRenderingMode(PDFLib.TextRenderingMode.Invisible), ...ops,
                PDFLib.endText(), PDFLib.popGraphicsState());
              processed++;
            }
            if (data.text.trim()) output.append(el("section", {}, el("h3", { text: "Page " + (index + 1) }),
              el("p", { text: data.text.trim() })));
          } finally { releaseCanvas(canvas); }
        }
        if (!detected) {
          status.textContent = skipped === renderer.numPages ? "All pages already contain searchable text." : "No text detected. Try another language or a clearer scan.";
          return;
        }
        result = { blob: new Blob([await document.save({ updateFieldAppearances: false })], { type: "application/pdf" }),
          name: filename(inputFile, "-searchable.pdf") };
        downloads.hidden = false;
        status.textContent = detected + " words added across " + processed + " pages. " + skipped + " pages already had text.";
      } catch (error) { status.textContent = problem(error); }
      finally {
        await worker?.terminate().catch(() => {});
        await renderer?.destroy().catch(() => {});
        busy = false;
        file.disabled = language.disabled = false;
        run.disabled = !file.files.length;
      }
    });
    run.disabled = true;
    file.onchange = () => { result = null; downloads.hidden = true; output.replaceChildren(); run.disabled = !file.files.length; status.textContent = ""; };
    language.onchange = () => { result = null; downloads.hidden = true; output.replaceChildren(); status.textContent = ""; };
    root.replaceChildren(panel("", [el("div", { class: "sw-layout" },
      el("div", { class: "sw-controls" }, el("h2", { text: "PDF and language" }), field("Scanned PDF", file),
        field("Text language", language), actions(run), hint("Pages that already contain selectable text are kept as-is.")),
      el("div", { class: "sw-preview" }, el("h2", { text: "Recognized text" }), output)), status, downloads]));
    transfer.receive().then((entry) => { if (entry && !file.files.length) transfer.fill(file, entry.file); })
      .catch((error) => { status.textContent = problem(error); });
  });

  T.register("photo-background-remover", (root) => {
    const file = input({ type: "file", accept: imageTypes });
    const color = input({ type: "color", value: "#5c9ee8" });
    const customColor = field("Custom color", color);
    const background = select([["Transparent", "transparent"], ["White", "#ffffff"], ["Blue", "#5c9ee8"], ["Custom color", "custom"]], "transparent");
    background.setAttribute("aria-label", "Background");
    const status = live();
    const canvas = canvasFor(1, 1);
    const preview = stage(canvas);
    preview.classList.add("sw-transparent");
    preview.hidden = true;
    let portrait;
    let model;
    let name;
    let revision = 0;
    let busy = false;
    let result;
    const links = root.closest("[data-tool-page]")?.dataset.photoTools === "true" ? [
      ["Open in Photo Tools", "/photo-tools", "photo"],
    ] : [];
    const output = resultBar("Download PNG", () => result, status, links);

    async function compose() {
      customColor.hidden = background.value !== "custom";
      if (!portrait) return;
      const ticket = ++revision;
      const context = canvas.getContext("2d");
      context.clearRect(0, 0, canvas.width, canvas.height);
      if (background.value !== "transparent") {
        context.fillStyle = background.value === "custom" ? color.value : background.value;
        context.fillRect(0, 0, canvas.width, canvas.height);
      }
      context.drawImage(portrait, 0, 0);
      const blob = await toBlob(canvas, "image/png");
      if (ticket !== revision) return;
      result = { blob, name };
      output.hidden = false;
    }

    const run = button("Remove background", async () => {
      if (!file.files[0] || busy) return;
      busy = true;
      run.disabled = file.disabled = background.disabled = color.disabled = true;
      let source;
      try {
        status.textContent = "Loading portrait model on this device…";
        const base = "/assets/vendor/portrait/";
        await localScript(base + "selfie_segmentation.js", () => window.SelfieSegmentation);
        if (!model) {
          model = new window.SelfieSegmentation({ locateFile: (asset) => base + asset });
          model.setOptions({ modelSelection: 0 });
        }
        const original = file.files[0];
        source = fittedCanvas(await loadImage(original), 1800);
        status.textContent = "Separating portrait from background…";
        model.onResults(({ segmentationMask }) => {
          portrait = canvasFor(source.width, source.height);
          const ctx = portrait.getContext("2d");
          ctx.drawImage(segmentationMask, 0, 0, portrait.width, portrait.height);
          ctx.globalCompositeOperation = "source-in";
          ctx.drawImage(source, 0, 0);
        });
        if (portrait) releaseCanvas(portrait);
        portrait = null;
        await model.send({ image: source });
        if (!portrait) throw new Error("No portrait result. Try a clear photo with a person in view.");
        name = filename(original, "-background.png");
        canvas.width = portrait.width;
        canvas.height = portrait.height;
        await compose();
        preview.hidden = false;
        status.textContent = "Portrait ready · " + canvas.width + " × " + canvas.height + " px";
      } catch (error) {
        status.textContent = problem(error);
        await model?.close().catch(() => {});
        model = null;
      } finally {
        if (source) releaseCanvas(source);
        busy = false;
        run.disabled = file.disabled = background.disabled = color.disabled = false;
      }
    });
    const recolor = () => {
      output.hidden = true;
      compose().catch((error) => { status.textContent = problem(error); });
    };
    background.onchange = recolor;
    color.onchange = recolor;
    file.onchange = () => {
      revision++;
      if (portrait) releaseCanvas(portrait);
      portrait = result = null;
      output.hidden = preview.hidden = true;
      run.disabled = !file.files.length;
      status.textContent = "";
    };
    run.disabled = true;
    customColor.hidden = true;
    root.replaceChildren(panel("", [el("div", { class: "sw-layout" },
      el("div", { class: "sw-controls" }, el("h2", { text: "Portrait and background" }), field("Portrait photo", file),
        field("Background", background), customColor, actions(run), hint("Best for a clear photo of a person, including application portraits.")),
      el("div", { class: "sw-preview" }, el("h2", { text: "Result preview" }), preview)), status, output]));
  });
})();
