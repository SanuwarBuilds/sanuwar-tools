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
    const status = live();
    const files = input({ type: "file", accept: imageTypes, multiple: true });
    const camera = input({ type: "file", accept: "image/*", capture: "environment", hidden: true, "aria-label": "Camera image" });
    const takePhoto = button("Use camera", () => camera.click(), "ghost");
    const paper = select([["Match image", "image"], ["A4", "a4"], ["US Letter", "letter"]], "a4");
    const canvas = canvasFor(1, 1);
    canvas.setAttribute("aria-label", "Selected page and crop preview");
    const rows = el("ol", { class: "sw-pages" });
    const pages = [];
    let selected = null;
    let result;
    let busy = false;
    const sides = ["Left", "Top", "Right", "Bottom"];
    const cropInputs = sides.map(() => input({ type: "range", min: 0, max: 45, value: 0, step: 1 }));
    const reset = button("Reset crop", () => {
      selected.crop = [0, 0, 0, 0];
      update();
    }, "ghost");
    const rotate = button("Rotate page", () => {
      selected.rotation = (selected.rotation + 90) % 360;
      update();
    }, "ghost");
    const cropOptions = el("details", { class: "sw-advanced" }, el("summary", { text: "Crop and rotate" }),
      el("div", { class: "sw-fields" }, cropInputs.map((control, i) => field(sides[i] + " trim (%)", control))),
      actions(reset, rotate));
    const preview = stage(canvas);
    const output = resultBar("Download PDF", () => result, status, [
      ["Edit PDF", "/tools/pdf-editor", "pdf"], ["Add searchable text", "/tools/searchable-pdf", "pdf"],
      ["Add to Application Pack", "/tools/application-file-pack", "pdf"],
    ]);

    function frame(page, target, limit, showCrop) {
      const source = page.image;
      const [left, top, right, bottom] = page.crop.map((n) => n / 100);
      const x = showCrop ? 0 : left * source.width;
      const y = showCrop ? 0 : top * source.height;
      const w = showCrop ? source.width : source.width * (1 - left - right);
      const h = showCrop ? source.height : source.height * (1 - top - bottom);
      const scale = Math.min(1, limit / Math.max(w, h));
      const sideways = page.rotation % 180 !== 0;
      target.width = Math.max(1, Math.round((sideways ? h : w) * scale));
      target.height = Math.max(1, Math.round((sideways ? w : h) * scale));
      const context = target.getContext("2d");
      context.translate(target.width / 2, target.height / 2);
      context.rotate(page.rotation * Math.PI / 180);
      context.scale(scale, scale);
      context.drawImage(source, x, y, w, h, -w / 2, -h / 2, w, h);
      if (showCrop && page.crop.some(Boolean)) {
        context.fillStyle = "#122d24a0";
        context.fillRect(-w / 2, -h / 2, w, h * top);
        context.fillRect(-w / 2, h / 2 - h * bottom, w, h * bottom);
        context.fillRect(-w / 2, -h / 2 + h * top, w * left, h * (1 - top - bottom));
        context.fillRect(w / 2 - w * right, -h / 2 + h * top, w * right, h * (1 - top - bottom));
      }
    }

    function update(invalidate = true) {
      if (invalidate) { result = null; output.hidden = true; }
      files.disabled = camera.disabled = takePhoto.disabled = paper.disabled = busy;
      preview.hidden = cropOptions.hidden = !selected;
      for (const [i, control] of cropInputs.entries()) {
        control.value = selected?.crop[i] ?? 0;
        control.disabled = busy;
      }
      reset.disabled = rotate.disabled = busy;
      generate.disabled = busy || !pages.length;
      rows.replaceChildren(...pages.map((page, index) => {
        const shift = (offset) => {
          [pages[index], pages[index + offset]] = [pages[index + offset], pages[index]];
          update();
          rows.children[index + offset].querySelector("button")?.focus();
        };
        const open = button((index + 1) + ". " + page.name, () => { selected = page; update(false); rows.children[index].querySelector("button")?.focus(); },
          "ghost", { class: "sw-page-name", disabled: busy, "aria-pressed": page === selected ? "true" : "false" });
        return el("li", {}, open,
          button("↑", () => shift(-1), "ghost", { disabled: busy || index === 0, "aria-label": "Move page " + (index + 1) + " earlier" }),
          button("↓", () => shift(1), "ghost", { disabled: busy || index === pages.length - 1, "aria-label": "Move page " + (index + 1) + " later" }),
          button("×", () => {
            pages.splice(index, 1);
            releaseCanvas(page.image);
            if (selected === page) selected = pages[Math.min(index, pages.length - 1)] || null;
            update();
          }, "ghost", { disabled: busy, "aria-label": "Remove page " + (index + 1) }));
      }));
      if (selected) frame(selected, canvas, 1100, true);
    }

    async function add(list) {
      if (busy || !list.length) return;
      busy = true;
      update();
      const errors = [];
      let added = 0;
      if (list.length + pages.length > 30) errors.push("Up to 30 pages per PDF.");
      for (const file of list.slice(0, 30 - pages.length)) {
        try {
          status.textContent = "Opening " + file.name + "…";
          const image = fittedCanvas(await loadImage(file), 1800);
          const usedPixels = pages.reduce((sum, page) => sum + page.image.width * page.image.height, 0);
          if (usedPixels + image.width * image.height > 24_000_000) {
            releaseCanvas(image);
            throw new Error("This batch is too large for the editor. Export a smaller batch first.");
          }
          const page = { image, name: file.name, rotation: 0, crop: [0, 0, 0, 0] };
          pages.push(page);
          selected ||= page;
          added++;
        } catch (error) { errors.push(file.name + ": " + problem(error)); }
      }
      files.value = camera.value = "";
      busy = false;
      update();
      status.textContent = added + " pages added. " + errors.join(" ");
    }
    files.onchange = () => void add([...files.files]);
    camera.onchange = () => void add([...camera.files]);
    paper.onchange = () => update();
    cropInputs.forEach((control, i) => {
      control.oninput = () => {
        selected.crop[i] = Number(control.value);
        result = null;
        output.hidden = true;
        frame(selected, canvas, 1100, true);
      };
    });

    const generate = button("Create PDF", async () => {
      busy = true;
      update();
      try {
        const doc = await PDFLib.PDFDocument.create();
        for (const [i, item] of pages.entries()) {
          status.textContent = "Building page " + (i + 1) + " of " + pages.length + "…";
          const pageCanvas = canvasFor(1, 1);
          try {
            frame(item, pageCanvas, 1800, false);
            const image = await doc.embedJpg(await (await toBlob(pageCanvas, "image/jpeg", 0.88)).arrayBuffer());
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

    root.replaceChildren(panel("", [el("div", { class: "sw-layout" },
      el("div", { class: "sw-controls" }, el("h2", { text: "Pages" }), field("Add page photos", files), camera, takePhoto,
        rows, field("PDF page size", paper), actions(generate)),
      el("div", { class: "sw-preview" }, el("h2", { text: "Page preview" }), preview, cropOptions,
        hint("Use the camera to capture one page at a time, or select several photos."))),
    status, output]));
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
