"use strict";
(() => {
  const T = window.SANU_TOOLS;
  const { el, field, panel, input, select, button, actions } = T;
  const { canvasFor, releaseCanvas, toBlob, loadImage, openPdf, renderPdfPage, paintMasks, recognize } = T.localFiles;
  const kinds = [
    ["replace", "Edit text"], ["pan", "Pan"], ["text", "Add text"], ["image", "Image"], ["signature", "Signature"],
    ["highlight", "Highlight"], ["underline", "Underline"], ["strike", "Strike out"],
    ["link", "Link"], ["whiteout", "Whiteout"], ["shape", "Shape"], ["redact", "Redact"],
  ];
  const fontFamilies = { sans: "sans-serif", serif: "serif", mono: "monospace", script: "cursive", original: "sans-serif" };
  const blankSize = [595.28, 841.89];
  const mod = (angle) => ((angle % 360) + 360) % 360;
  const clamp = (value) => Math.min(1, Math.max(0, value));
  const overlaps = (a, b) => a.x <= b.x + b.width && a.x + a.width >= b.x &&
    a.y <= b.y + b.height && a.y + a.height >= b.y;
  const checkbox = (label, control) => el("label", { class: "pe-check" }, control, label);

  function editingIcon(tool) {
    const paths = {
      replace: "M5 4h14M12 4v16m-4 0h8",
      pan: "M8 13V6a2 2 0 0 1 4 0v5-7a2 2 0 0 1 4 0v7-4a2 2 0 0 1 4 0v8a6 6 0 0 1-6 6h-2a5 5 0 0 1-4-2l-4-5a2 2 0 0 1 3-2l1 1Z",
      text: "M3 5h13M9.5 5v14m-4 0h8m6-6v8m-4-4h8",
      highlight: "m4 15 4 4L21 6l-4-4L4 15Zm0 0-1 5 5-1M10 22h11",
      redact: "M3 7h18v4H3zm0 6h18v4H3z",
    };
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("stroke-linecap", "round");
    const path = document.createElementNS(ns, "path");
    path.setAttribute("d", paths[tool]);
    svg.append(path);
    return svg;
  }

  function bounds(x1, y1, x2, y2) {
    const x = clamp(Math.min(x1, x2));
    const y = clamp(Math.min(y1, y2));
    return { x, y, width: clamp(Math.max(x1, x2)) - x, height: clamp(Math.max(y1, y2)) - y };
  }

  function nativeClient() {
    const worker = new Worker("/assets/js/tools/pdf-native-worker.js?v=3", { type: "module" });
    const requests = new Map();
    let sequence = 0;
    let closed = false;
    function close() {
      if (closed) return;
      closed = true;
      worker.terminate();
      for (const request of requests.values()) request.reject(new Error("Native text editing is unavailable."));
      requests.clear();
    }
    worker.addEventListener("error", close);
    worker.addEventListener("message", ({ data }) => {
      const request = requests.get(data.id);
      if (!request) return;
      requests.delete(data.id);
      clearTimeout(request.timeout);
      if (data.error) request.reject(new Error(data.error));
      else request.resolve(data.result);
    });
    return {
      close,
      call(type, payload, transfer = []) {
        if (closed) return Promise.reject(new Error("Native text editing is unavailable."));
        return new Promise((resolve, reject) => {
          const id = ++sequence;
          const timeout = setTimeout(close, 22000);
          requests.set(id, { resolve, reject: (error) => { clearTimeout(timeout); reject(error); }, timeout });
          worker.postMessage({ id, type, payload }, transfer);
        });
      },
    };
  }

  function findNativeRegions(objects, viewport, canvas, fallback) {
    const native = objects.flatMap((object) => {
      const [left, bottom, right, top] = object.bounds;
      const [x1, y1, x2, y2] = viewport.convertToViewportRectangle([left, bottom, right, top]);
      const pad = viewport.scale * 0.8;
      const box = bounds((Math.min(x1, x2) - pad) / canvas.width, (Math.min(y1, y2) - pad) / canvas.height,
        (Math.max(x1, x2) + pad) / canvas.width, (Math.max(y1, y2) + pad) / canvas.height);
      if (!box.width || !box.height) return [];
      const { matrix } = object;
      const output = pdfjsLib.Util.transform(viewport.transform, matrix);
      return [{ ...box, text: object.text, sourceText: object.text, object: object.object,
        originalFont: object.font, originalColor: object.color,
        size: object.size * Math.hypot(matrix[2], matrix[3]), angle: Math.atan2(output[1], output[0]) }];
    });
    const area = (a, b) => Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
      Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
    // PDF.js still provides a selection for nested text and other non-editable objects.
    return [...native, ...fallback.filter((item) => native.reduce((sum, region) => sum + area(item, region), 0) <
      item.width * item.height * 0.38)].sort((a, b) => (a.y - b.y) || (a.x - b.x));
  }

  function textRegions(content, viewport, canvas, source) {
    return content.items.flatMap((item) => {
      if (!item.str?.trim()) return [];
      const [a, b, c, d, x, y] = pdfjsLib.Util.transform(viewport.transform, item.transform);
      const length = Math.hypot(a, b);
      const height = Math.hypot(c, d);
      if (!length || !height) return [];
      const ux = a / length;
      const uy = b / length;
      const advance = item.width * viewport.scale;
      const font = content.styles[item.fontName] || {};
      const ascent = Math.max(font.ascent || 0, 0.96);
      const descent = Math.max(-(font.descent || 0), 0.25);
      const points = [-0.75, advance + 0.75].flatMap((along) => [-height * ascent, height * descent].map((down) => [
        (x + ux * along - uy * down) / canvas.width,
        (y + uy * along + ux * down) / canvas.height,
      ]));
      const xs = points.map(([horizontal]) => horizontal);
      const ys = points.map(([, vertical]) => vertical);
      const box = bounds(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
      if (!box.width || !box.height) return [];
      const loaded = source.commonObjs.has(item.fontName) ? source.commonObjs.get(item.fontName) : null;
      return [{ ...box, text: item.str, size: height / viewport.scale, angle: Math.atan2(uy, ux),
        originalFont: loaded?.name || "", fontFamily: loaded?.fallbackName || font.fontFamily,
        fontBold: Boolean(loaded?.bold || loaded?.black), fontItalic: Boolean(loaded?.italic) }];
    });
  }

  function scanRegions(data, canvas) {
    return (data.blocks || []).flatMap((block) => block.paragraphs)
      .flatMap((paragraph) => paragraph.lines)
      .filter((line) => line.text.trim())
      .map(({ text, bbox, words }) => ({
        ...bounds(bbox.x0 / canvas.width, (bbox.y0 - 2) / canvas.height, bbox.x1 / canvas.width, (bbox.y1 + 2) / canvas.height),
        text: text.trim(),
        ocr: true,
        originalFont: words?.find((word) => word.font_name)?.font_name || "",
        fontBold: Boolean(words?.length && words.filter((word) => word.is_bold).length > words.length / 2),
        fontItalic: Boolean(words?.length && words.filter((word) => word.is_italic).length > words.length / 2),
        size: Math.max(5, 0.85 * (bbox.y1 - bbox.y0)),
        angle: 0,
      }));
  }

  function closestStyle(region) {
    const name = (region.originalFont || "").replace(/^[A-Z]{6}\+/, "").toLowerCase();
    const generic = (region.fontFamily || "").toLowerCase();
    const family = /courier|mono|consolas|menlo|typewriter/.test(name + generic) ? "mono"
      : /times|garamond|georgia|baskerville|cambria|minion|palatino|roman/.test(name) ||
        (generic.includes("serif") && !generic.includes("sans")) ? "serif" : "sans";
    return {
      family,
      bold: Boolean(region.fontBold || /bold|black|heavy|demi|semibold|ultra/.test(name)),
      italic: Boolean(region.fontItalic || /italic|oblique|slanted/.test(name)),
    };
  }

  function sampleColors(canvas, region) {
    const sourceX = Math.max(0, Math.floor(region.x * canvas.width));
    const sourceY = Math.max(0, Math.floor(region.y * canvas.height));
    const sourceWidth = Math.min(canvas.width - sourceX, Math.max(1, Math.ceil(region.width * canvas.width)));
    const sourceHeight = Math.min(canvas.height - sourceY, Math.max(1, Math.ceil(region.height * canvas.height)));
    const sample = canvasFor(Math.min(160, sourceWidth), Math.min(48, sourceHeight));
    try {
      const context = sample.getContext("2d");
      context.drawImage(canvas, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sample.width, sample.height);
      const data = context.getImageData(0, 0, sample.width, sample.height).data;
      const colors = new Map();
      for (let offset = 0; offset < data.length; offset += 4) {
        const rgb = [data[offset], data[offset + 1], data[offset + 2]];
        const key = rgb.map((value) => value >> 4).join(",");
        const entry = colors.get(key) || { count: 0, rgb: [0, 0, 0] };
        entry.count++;
        rgb.forEach((value, index) => { entry.rgb[index] += value; });
        colors.set(key, entry);
      }
      const ranked = [...colors.values()].sort((a, b) => b.count - a.count);
      const average = (entry) => entry.rgb.map((value) => Math.round(value / entry.count));
      const toHex = (rgb) => "#" + rgb.map((value) => value.toString(16).padStart(2, "0")).join("");
      const paper = average(ranked[0]);
      const ink = ranked.slice(1).find((entry) => {
        const rgb = average(entry);
        return Math.hypot(...rgb.map((value, index) => value - paper[index])) > 105;
      });
      return { background: toHex(paper), color: ink ? toHex(average(ink)) : "#131722" };
    } finally { releaseCanvas(sample); }
  }

  function mergeDetectedText(digital, scanned) {
    return [...digital, ...scanned.filter((line) => !digital.some((item) => {
      const overlapWidth = Math.max(0, Math.min(item.x + item.width, line.x + line.width) - Math.max(item.x, line.x));
      const overlapHeight = Math.max(0, Math.min(item.y + item.height, line.y + line.height) - Math.max(item.y, line.y));
      return overlapWidth * overlapHeight > item.width * item.height * 0.45;
    }))];
  }

  function hasPageInk(canvas) {
    const sample = canvasFor(48, 48);
    try {
      const context = sample.getContext("2d");
      context.drawImage(canvas, 0, 0, 48, 48);
      const data = context.getImageData(0, 0, 48, 48).data;
      let darkest = 255;
      let lightest = 0;
      for (let offset = 0; offset < data.length; offset += 4) {
        const level = (data[offset] + data[offset + 1] + data[offset + 2]) / 3;
        darkest = Math.min(darkest, level);
        lightest = Math.max(lightest, level);
      }
      return lightest - darkest > 24;
    } finally { releaseCanvas(sample); }
  }

  function paint(canvas, marks, scale, nativeText = new Map()) {
    const context = canvas.getContext("2d");
    for (const mark of marks) {
      if (mark.kind === "redact") {
        paintMasks(canvas, [mark]);
        continue;
      }
      const x = mark.x * canvas.width;
      const y = mark.y * canvas.height;
      const width = mark.width * canvas.width;
      const height = mark.height * canvas.height;
      context.save();
      try {
        context.fillStyle = mark.color;
        if (mark.kind === "highlight") {
          context.globalAlpha = 0.33;
          context.fillRect(x, y, width, height);
        } else if (mark.kind === "whiteout") {
          context.fillRect(x, y, width, height);
        } else if (["underline", "strike", "link"].includes(mark.kind)) {
          const vertical = mark.kind === "strike" ? y + height / 2 : y + height;
          context.fillRect(x, vertical - Math.max(1, scale), width, Math.max(1, scale * 1.2));
          if (mark.kind === "link" && canvas.dataset.preview) {
            context.strokeStyle = mark.color;
            context.strokeRect(x, y, width, height);
          }
        } else if (mark.kind === "image" || mark.image) {
          const sideways = Math.abs(Math.sin(mark.angle || 0)) > 0.7;
          const fitWidth = sideways ? height : width;
          const fitHeight = sideways ? width : height;
          const fit = Math.min(fitWidth / mark.image.naturalWidth, fitHeight / mark.image.naturalHeight);
          const w = mark.image.naturalWidth * fit;
          const h = mark.image.naturalHeight * fit;
          context.translate(x + width / 2, y + height / 2);
          context.rotate(mark.angle || 0);
          context.drawImage(mark.image, -w / 2, -h / 2, w, h);
        } else if (mark.kind === "shape") {
          context.strokeStyle = mark.color;
          context.lineWidth = Math.max(1, 2 * scale);
          context.beginPath();
          if (mark.shape === "ellipse") context.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
          else if (mark.shape === "line") {
            context.moveTo(x, mark.reverse ? y + height : y);
            context.lineTo(x + width, mark.reverse ? y : y + height);
          } else context.rect(x, y, width, height);
          context.stroke();
        } else {
          if (mark.kind === "replace") {
            context.fillStyle = mark.background;
            context.fillRect(Math.floor(x), Math.floor(y), Math.ceil(x + width) - Math.floor(x), Math.ceil(y + height) - Math.floor(y));
            context.fillStyle = mark.color;
          }
          if (nativeText.has(mark)) continue;
          const sideways = Math.abs(Math.sin(mark.angle || 0)) > 0.7;
          const textWidth = sideways ? height : width;
          const textHeight = sideways ? width : height;
          context.translate(x + width / 2, y + height / 2);
          context.rotate(mark.angle || 0);
          const lines = mark.text.split(/\r?\n/);
          const size = Math.max(1, Math.min(mark.size * scale, textHeight / (lines.length * 1.12)));
          const family = fontFamilies[mark.family];
          const style = (mark.italic || mark.kind === "signature" ? "italic " : "") + (mark.bold ? "bold " : "");
          context.font = style + size + "px " + family;
          context.textBaseline = "middle";
          context.textAlign = mark.align;
          const tx = { left: -textWidth / 2, center: 0, right: textWidth / 2 }[mark.align];
          lines.forEach((line, index) => {
            context.fillText(line, tx, (index - (lines.length - 1) / 2) * size * 1.12, textWidth);
          });
        }
      } finally {
        context.restore();
      }
    }
  }

  function drawOverlay(page, image, viewport) {
    const [x, y] = viewport.convertToPdfPoint(0, viewport.height);
    const [rightX, rightY] = viewport.convertToPdfPoint(viewport.width, viewport.height);
    const [topX, topY] = viewport.convertToPdfPoint(0, 0);
    page.drawImage(image, {
      x, y, width: Math.hypot(rightX - x, rightY - y), height: Math.hypot(topX - x, topY - y),
      rotate: PDFLib.radians(Math.atan2(rightY - y, rightX - x)),
    });
  }

  async function getNativeText(document, page, fonts) {
    const result = new Map();
    for (const [index, mark] of page.marks.entries()) {
      if (!["text", "replace"].includes(mark.kind) || !mark.text ||
        page.marks.slice(index + 1).some((later) => overlaps(mark, later))) continue;
      const fontSet = mark.family === "serif" ? ["TimesRoman", "TimesRomanBold", "TimesRomanItalic", "TimesRomanBoldItalic"]
        : mark.family === "mono" ? ["Courier", "CourierBold", "CourierOblique", "CourierBoldOblique"]
          : ["Helvetica", "HelveticaBold", "HelveticaOblique", "HelveticaBoldOblique"];
      const name = PDFLib.StandardFonts[fontSet[Number(mark.bold) + 2 * Number(mark.italic || mark.family === "script")]];
      if (!fonts.has(name)) fonts.set(name, await document.embedFont(name));
      const font = fonts.get(name);
      const lines = mark.text.split(/\r?\n/);
      try {
        lines.forEach((line) => font.encodeText(line));
        result.set(mark, { font, lines });
      } catch {
        // Canvas supports scripts outside the built-in PDF fonts.
      }
    }
    return result;
  }

  function drawSelectableText(page, marks, rendered, overlay) {
    const { canvas, viewport, width, height } = rendered;
    const point = (x, y) => overlay
      ? viewport.convertToPdfPoint(x / canvas.width * viewport.width, y / canvas.height * viewport.height)
      : [x / canvas.width * width, (1 - y / canvas.height) * height];
    for (const [mark, { font, lines }] of marks) {
      const angle = mark.angle || 0;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const sideways = Math.abs(sin) > 0.7;
      const boxWidth = mark.width * canvas.width;
      const boxHeight = mark.height * canvas.height;
      const availableWidth = sideways ? boxHeight : boxWidth;
      const availableHeight = sideways ? boxWidth : boxHeight;
      const widest = Math.max(...lines.map((line) => font.widthOfTextAtSize(line, 1)), 1);
      const size = Math.min(mark.size * canvas.width / width, availableHeight / (lines.length * 1.12), availableWidth / widest);
      if (size <= 0) continue;
      const cx = mark.x * canvas.width + boxWidth / 2;
      const cy = mark.y * canvas.height + boxHeight / 2;
      const [zeroX, zeroY] = point(cx, cy);
      const [directionX, directionY] = point(cx + cos, cy + sin);
      const pixel = Math.hypot(directionX - zeroX, directionY - zeroY);
      const rotation = PDFLib.radians(Math.atan2(directionY - zeroY, directionX - zeroX));
      const rgb = mark.color.match(/[a-f0-9]{2}/gi).map((component) => Number.parseInt(component, 16) / 255);
      lines.forEach((line, index) => {
        if (!line.length) return;
        const span = font.widthOfTextAtSize(line, size);
        const horizontal = { left: -availableWidth / 2, center: -span / 2, right: availableWidth / 2 - span }[mark.align];
        const vertical = (index - (lines.length - 1) / 2) * size * 1.12 +
          font.heightAtSize(size, { descender: false }) / 2;
        const [x, y] = point(cx + cos * horizontal - sin * vertical, cy + sin * horizontal + cos * vertical);
        page.drawText(line, { x, y, rotate: rotation, size: size * pixel, font, color: PDFLib.rgb(...rgb) });
      });
    }
  }

  function addLinks(document, page, marks, viewport, width, height) {
    for (const mark of marks.filter((item) => item.kind === "link")) {
      const point = (x, y) => viewport
        ? viewport.convertToPdfPoint(x * viewport.width, y * viewport.height)
        : [x * width, (1 - y) * height];
      const a = point(mark.x, mark.y);
      const b = point(mark.x + mark.width, mark.y + mark.height);
      const name = PDFLib.PDFName.of;
      const annotation = document.context.obj({
        Type: "Annot", Subtype: "Link",
        Rect: [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])],
        Border: [0, 0, 0], A: { S: "URI", URI: PDFLib.PDFString.of(mark.url) },
      });
      let references = page.node.lookupMaybe(name("Annots"), PDFLib.PDFArray);
      if (!references) {
        references = document.context.obj([]);
        page.node.set(name("Annots"), references);
      }
      references.push(document.context.register(annotation));
    }
  }

  class FontMatchError extends Error {}

  const nativeMarks = (marks) => marks.filter((mark) => mark.kind === "replace" && !mark.visual);
  const visualMarks = (marks) => marks.filter((mark) => mark.kind !== "replace" || mark.visual);

  async function materializeText(client, pages) {
    const candidates = pages.flatMap((page) => {
      const patches = nativeMarks(page.marks);
      if (!page.original || !patches.length) return [];
      const edits = [...new Map(patches.map((mark) => [mark.object, mark])).values()].map(({ object, sourceText, text,
        size, color, align, family, bold, italic, fallback }) => ({ object, sourceText, text, size, color, align, family, bold, italic, fallback }));
      return [{ index: page.original - 1, edits }];
    });
    if (!candidates.length) return { bytes: null, applied: [] };
    if (!client) throw new Error("The PDF text engine is unavailable. Reopen the PDF and try again.");
    const result = await client.call("save", candidates);
    const failed = candidates.find(({ index }) => !result.applied.includes(index));
    if (failed) throw new FontMatchError("Page " + (failed.index + 1) + " could not write this text as selectable PDF text.");
    return result;
  }

  async function usePatchedPdf(bytes, callback) {
    const task = pdfjsLib.getDocument({ data: bytes.slice(), isEvalSupported: false });
    try { return await callback(await task.promise); }
    finally { await task.destroy(); }
  }

  async function writePdf(file, pdf, pages, client, onProgress) {
    const redact = pages.some((page) => page.marks.some((mark) => mark.kind === "redact"));
    onProgress("Writing selectable PDF text…");
    const { bytes, applied } = await materializeText(client, pages);
    const changed = new Set(applied.map((index) => index + 1));
    const replacements = (page) => page.marks.some((mark) => mark.kind === "replace" && mark.visual);
    const ordered = pages.length === pdf.numPages && pages.every((page, index) => page.original === index + 1);
    const flattenReplacement = pages.some(replacements);
    if (bytes && !redact && ordered && pages.every((page) => !page.rotation &&
      page.marks.every((mark) => mark.kind === "replace" && !mark.visual && changed.has(page.original)))) {
      return { bytes, native: changed.size, flattened: 0 };
    }
    const source = redact ? null : await PDFLib.PDFDocument.load(bytes || await file.arrayBuffer(), { updateMetadata: false });
    if (flattenReplacement && source) {
      // A link can refer to a source page that was replaced. Exclude annotations before copying.
      for (const page of source.getPages()) page.node.delete(PDFLib.PDFName.of("Annots"));
    }
    const preserve = ordered && !redact && !flattenReplacement;
    const result = preserve ? source : await PDFLib.PDFDocument.create();
    const fonts = new Map();
    const copyIndices = pages.filter((page) => page.original && !redact &&
      !replacements(page)).map((page) => page.original - 1);
    const copies = !preserve && copyIndices.length ? await result.copyPages(source, copyIndices) : [];
    let flattened = 0;
    let copyIndex = 0;
    for (const [index, page] of pages.entries()) {
      onProgress("Exporting page " + (index + 1) + " of " + pages.length + "…");
      const flatten = page.original && (redact || replacements(page));
      const marks = visualMarks(page.marks);
      if (flatten) flattened += 1;
      const target = !page.original ? result.addPage(blankSize) : flatten ? null
        : preserve ? result.getPage(page.original - 1) : result.addPage(copies[copyIndex++]);
      if (flatten || marks.length) {
        let rendered;
        if (page.original && flatten) {
          rendered = changed.has(page.original)
            ? await usePatchedPdf(bytes, (patched) => renderPdfPage(patched, page.original, 2350))
            : await renderPdfPage(pdf, page.original, 2350);
        }
        else if (page.original) {
          const sourcePage = await pdf.getPage(page.original);
          const actual = sourcePage.getViewport({ scale: 1 });
          const viewport = sourcePage.getViewport({ scale: Math.min(3, 2350 / Math.max(actual.width, actual.height)) });
          rendered = { canvas: canvasFor(Math.ceil(viewport.width), Math.ceil(viewport.height)),
            viewport, width: actual.width, height: actual.height };
        } else {
          rendered = { canvas: canvasFor(1191, 1684), width: blankSize[0], height: blankSize[1] };
        }
        const { canvas, viewport, width, height } = rendered;
        try {
          const scale = canvas.width / width;
          const text = redact ? new Map() : await getNativeText(result, { marks }, fonts);
          paint(canvas, marks, scale, text);
          const image = await result.embedPng(await (await toBlob(canvas, "image/png")).arrayBuffer());
          const outputPage = target || result.addPage([width, height]);
          if (target && viewport) drawOverlay(target, image, viewport);
          else outputPage.drawImage(image, { x: 0, y: 0, width, height });
          drawSelectableText(outputPage, text, rendered, Boolean(target && viewport));
          if (!redact) addLinks(result, outputPage, marks, target && viewport, width, height);
          outputPage.setRotation(PDFLib.degrees(mod(outputPage.getRotation().angle + page.rotation)));
        } finally {
          releaseCanvas(canvas);
        }
      } else if (target) {
        target.setRotation(PDFLib.degrees(mod(target.getRotation().angle + page.rotation)));
      }
    }
    return { bytes: await result.save({ updateFieldAppearances: false }), native: changed.size, flattened };
  }

  T.register("pdf-editor", (root) => {
    const pdfInput = input({ type: "file", accept: ".pdf,application/pdf" });
    const imageInput = input({ type: "file", accept: ".jpg,.jpeg,.png,.webp,.bmp" });
    const notice = el("p", { class: "pe-status", role: "status" });
    const fileName = el("strong", { class: "pe-filename" });
    const upload = el("div", { class: "st-editor-upload" },
      el("div", { class: "st-editor-upload-copy" },
        el("h2", { text: "Open a PDF" }),
        el("p", { class: "tp-hint", text: "Choose or drop a PDF. Up to 40 MB and 100 pages." })),
      field("PDF file", pdfInput));
    const changeFile = button("Change file", () => pdfInput.click(), "ghost");
    const pageList = select([]);
    const pageSummary = el("p", { class: "tp-hint", role: "status" });
    const regionsList = select([]);
    const textFind = input({ type: "search", placeholder: "Find text on this page" });
    const zoom = select([["Fit width", "fit"], ["75%", "75"], ["100%", "100"], ["125%", "125"], ["150%", "150"], ["200%", "200"]], "fit");
    const urlInput = input({ type: "url", placeholder: "https://example.com" });
    const bold = el("input", { type: "checkbox" });
    const italic = el("input", { type: "checkbox" });
    const language = select([["Automatic (English, Hindi, Bangla)", "eng+hin+ben"], ["English", "eng"], ["Hindi", "hin"], ["Bangla", "ben"],
      ["Hindi + English", "hin+eng"], ["Bangla + English", "ben+eng"]], "eng+hin+ben");
    const textValue = T.textarea("", { rows: 3, maxlength: 2000, placeholder: "Enter text" });
    const size = input({ type: "number", min: 4, max: 120, step: 0.5, value: 18 });
    const color = input({ type: "color", value: "#131722", class: "pe-color" });
    const background = input({ type: "color", value: "#ffffff", class: "pe-color" });
    const shape = select([["Rectangle", "rectangle"], ["Ellipse", "ellipse"], ["Line", "line"]], "rectangle");
    const family = select([["Auto match font", "original"], ["Sans-serif", "sans"], ["Serif", "serif"], ["Monospace", "mono"], ["Script", "script"]], "sans");
    const alignment = select([["Left", "left"], ["Center", "center"], ["Right", "right"]], "left");
    const signatureImage = el("input", { type: "checkbox" });
    for (const [control, label] of [[pageList, "Go to page"], [regionsList, "Text on this page"], [language, "Scan language"],
      [shape, "Shape"], [family, "Font"], [alignment, "Alignment"], [zoom, "Zoom"]]) {
      control.setAttribute("aria-label", label);
    }
    const preview = canvasFor(1, 1);
    preview.setAttribute("aria-label", "PDF page preview");
    const inlineValue = input({ "aria-label": "Edit text directly on the page", maxlength: 2000 });
    const inlineNotice = el("p", { class: "pe-inline-notice", role: "status", hidden: true });
    const fontNotice = el("p", { class: "pe-font-notice", role: "status", hidden: true });
    const inlineApply = el("button", { type: "submit", class: "tp-btn tp-btn-primary" }, "Apply");
    const inlineCancel = button("Cancel", cancelInline, "ghost");
    inlineCancel.classList.add("pe-inline-cancel");
    const chooseFont = button("Font options", () => {
      closeInline();
      (regionCanUseFont() ? family : visualReplacement).focus();
    }, "ghost", { hidden: true });
    const mobileEditor = window.matchMedia("(max-width: 720px)");
    const closeSheet = button("×", cancelInline, "ghost", { "aria-label": "Close edit" });
    const inlineEdit = el("form", { class: "pe-inline-edit", "aria-label": "Edit text", hidden: true },
      el("div", { class: "pe-sheet-heading" }, el("strong", { text: "Edit text" }), closeSheet),
      inlineValue, inlineNotice, actions(inlineApply, chooseFont, inlineCancel));
    const sheet = el("div", { class: "pe-sheet" }, preview);
    const workArea = el("div", { class: "pe-preview", tabindex: 0, role: "region", "aria-label": "PDF preview" }, sheet, inlineEdit);
    const matchBadge = el("span", { class: "pe-match-badge", text: "Closest match", hidden: true });
    const stage = el("div", { class: "pe-stage-column" }, workArea, matchBadge);
    const thumbnailList = el("div", { class: "pe-thumbnails", role: "group", "aria-label": "Page thumbnails" });
    const thumbnails = new Map();
    const visibleThumbnails = new Set();
    let paintingThumbnail = false;
    const thumbObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const id = Number(entry.target.dataset.pageId);
        if (entry.isIntersecting) visibleThumbnails.add(id);
        else visibleThumbnails.delete(id);
      }
      void paintNextThumbnail();
    }, { root: thumbnailList, rootMargin: "80px 0px" });
    const toolHelp = el("p", { class: "tp-hint" });
    const exportNote = el("p", { class: "tp-hint pe-export-note" });
    const history = [];
    const future = [];
    const scans = new Map();
    let pages = [];
    let currentId;
    let nextId = 0;
    let file;
    let pdf;
    let client;
    let nativeReady;
    const objectRegions = new Map();
    let base;
    let patchedCanvas;
    let baseScale = 1;
    let digitalRegions = [];
    let originalRegions = [];
    let regions = [];
    let selected = -1;
    let hovered = -1;
    let active = "replace";
    let image;
    let drag;
    let moving;
    let pinch;
    const pointers = new Map();
    let zoomPercent = 100;
    let busy = false;

    const regionCanUseFont = () => regions[selected]?.object != null;
    const current = () => pages.find((page) => page.id === currentId);
    const index = () => pages.findIndex((page) => page.id === currentId);
    const wantsImage = () => active === "image" || (active === "signature" && signatureImage.checked);
    const wantsText = () => active === "text" || active === "replace" || (active === "signature" && !wantsImage());
    const tell = (message) => { notice.textContent = message; };
    const error = (failure) => failure?.message || (typeof failure === "string" ? failure : "The PDF could not be processed.");

    function snapshot() { return { pages, id: currentId }; }
    function change(updated, id = currentId) {
      history.push(snapshot());
      if (history.length > 60) history.shift();
      future.length = 0;
      pages = updated;
      currentId = id;
    }

    function pageWithMark(page, mark) {
      const previous = mark.kind === "replace" ? regions[selected] : null;
      return { ...page, marks: [...page.marks.filter((item) => item !== previous), mark] };
    }

    function commit(mark) {
      closeInline();
      change(pages.map((page) => page.id === currentId ? pageWithMark(page, mark) : page));
      selected = -1;
      updateRegions();
      refresh();
      tell(mark.kind === "replace"
        ? (mark.closest ? "Text replacement added. Closest match used." : "Text replacement added.")
        : "Edit added to the page.");
    }

    async function revisit(from, to) {
      if (!from.length || busy) return;
      closeInline();
      to.push(snapshot());
      const previous = from.pop();
      const rerender = currentId !== previous.id || !base;
      pages = previous.pages;
      currentId = previous.id;
      selected = -1;
      updateRegions();
      if (rerender || nativeMarks(current()?.marks || []).length || patchedCanvas) await showPage();
      else refresh();
      tell(from === history ? "Edit undone." : "Edit restored.");
    }

    function copyThumbnail(entry, source, rotation = 0) {
      const sideways = rotation % 180 !== 0;
      const factor = 176 / Math.max(source.width, source.height);
      const width = Math.max(1, Math.round(source.width * factor));
      const height = Math.max(1, Math.round(source.height * factor));
      entry.canvas.width = sideways ? height : width;
      entry.canvas.height = sideways ? width : height;
      const context = entry.canvas.getContext("2d");
      context.fillStyle = "#fff";
      context.fillRect(0, 0, entry.canvas.width, entry.canvas.height);
      context.translate(entry.canvas.width / 2, entry.canvas.height / 2);
      context.rotate(rotation * Math.PI / 180);
      context.drawImage(source, -width / 2, -height / 2, width, height);
      entry.ready = true;
    }

    async function paintNextThumbnail() {
      if (!pdf || busy || paintingThumbnail) return;
      const page = pages.find((item) => {
        const entry = thumbnails.get(item.id);
        return entry && visibleThumbnails.has(item.id) && !entry.ready && !entry.failed && item.id !== currentId;
      });
      if (!page) return;
      const entry = thumbnails.get(page.id);
      const document = pdf;
      paintingThumbnail = true;
      let source;
      try {
        if (page.original) {
          source = (await renderPdfPage(document, page.original, 176)).canvas;
        } else {
          source = canvasFor(blankSize[0], blankSize[1]);
        }
        if (pdf === document && entry.button.isConnected && page.id !== currentId) {
          const currentPage = pages.find((item) => item.id === page.id);
          copyThumbnail(entry, source, currentPage.rotation);
          entry.rotation = currentPage.rotation;
        }
      } catch {
        entry.failed = true;
      } finally {
        if (source) releaseCanvas(source);
        paintingThumbnail = false;
        void paintNextThumbnail();
      }
    }

    function syncThumbnails() {
      const ids = new Set(pages.map((page) => page.id));
      for (const [id, entry] of thumbnails) {
        if (!ids.has(id)) {
          thumbObserver.unobserve(entry.button);
          entry.button.remove();
          releaseCanvas(entry.canvas);
          thumbnails.delete(id);
          visibleThumbnails.delete(id);
        }
      }
      pages.forEach((page, i) => {
        let entry = thumbnails.get(page.id);
        if (!entry) {
          const canvas = canvasFor(1, 1);
          canvas.setAttribute("aria-hidden", "true");
          const label = el("span", { class: "pe-thumb-number" });
          const control = button("", () => navigate(pages.findIndex((item) => item.id === page.id)), "ghost",
            { class: "pe-thumb", "data-page-id": page.id });
          control.replaceChildren(el("span", { class: "pe-thumb-paper", "aria-hidden": "true" }, canvas), label);
          entry = { button: control, canvas, label, ready: false, rotation: page.rotation };
          thumbnails.set(page.id, entry);
          thumbObserver.observe(control);
        }
        if (entry.rotation !== page.rotation) {
          entry.rotation = page.rotation;
          entry.ready = false;
        }
        entry.label.textContent = String(i + 1);
        entry.button.setAttribute("aria-label", "Open page " + (i + 1));
        if (page.id === currentId) entry.button.setAttribute("aria-current", "page");
        else entry.button.removeAttribute("aria-current");
        entry.button.disabled = busy;
        if (thumbnailList.children[i] !== entry.button) {
          thumbnailList.insertBefore(entry.button, thumbnailList.children[i] || null);
        }
      });
      void paintNextThumbnail();
    }

    function draw(outline) {
      const page = current();
      if (!page || !base) return;
      const angle = page.rotation;
      const sideways = angle % 180 !== 0;
      const width = base.width;
      const height = base.height;
      const composed = canvasFor(width, height);
      try {
        composed.dataset.preview = "true";
        const context = composed.getContext("2d");
        context.drawImage(patchedCanvas || base, 0, 0, width, height);
        paint(composed, visualMarks(page.marks), baseScale);
        const thumb = thumbnails.get(page.id);
        if (thumb && !outline) copyThumbnail(thumb, composed, angle);
        if (active === "replace") {
          context.lineWidth = Math.max(1, 1.4 * baseScale);
          for (const [i, item] of regions.entries()) {
            if (i !== selected && (i !== hovered && !textFind.value.trim() || !matchesSearch(item) || item.width * width < 5)) continue;
            context.strokeStyle = i === selected ? "#177a50" : "#3a8b6555";
            if (i === selected) {
              context.fillStyle = "#96e3af40";
              context.fillRect(item.x * width, item.y * height, item.width * width, item.height * height);
            }
            context.strokeRect(item.x * width, item.y * height, item.width * width, item.height * height);
          }
        }
        if (outline) {
          context.strokeStyle = "#177a50";
          context.lineWidth = 2;
          context.setLineDash([6, 4]);
          context.strokeRect(outline.x * width, outline.y * height, outline.width * width, outline.height * height);
        }
        preview.width = sideways ? height : width;
        preview.height = sideways ? width : height;
        const display = preview.getContext("2d");
        display.translate(preview.width / 2, preview.height / 2);
        display.rotate(angle * Math.PI / 180);
        display.drawImage(composed, -width / 2, -height / 2);
        if (!inlineEdit.hidden) positionInline();
      } finally {
        releaseCanvas(composed);
      }
    }

    function updateRegions() {
      hovered = -1;
      const marks = current()?.marks || [];
      const destructive = marks.filter((mark) => mark.kind === "replace" || mark.kind === "redact");
      const covered = (region, mark) => {
        const x = region.x + region.width / 2;
        const y = region.y + region.height / 2;
        return x >= mark.x && x <= mark.x + mark.width && y >= mark.y && y <= mark.y + mark.height;
      };
      regions = originalRegions.filter((region) => !destructive.some((mark) =>
        mark.kind === "redact" ? overlaps(region, mark) : covered(region, mark)));
      destructive.forEach((mark, i) => {
        if (mark.kind === "replace" && mark.text && !destructive.slice(i + 1).some((later) => overlaps(mark, later))) {
          regions.push(mark);
        }
      });
      refreshRegions();
    }

    const matchesSearch = (item) => item.text.toLocaleLowerCase().includes(textFind.value.trim().toLocaleLowerCase());

    function refreshRegions() {
      const items = regions.flatMap((item, i) => (i === selected || matchesSearch(item))
        ? [el("option", { value: i, text: item.text.slice(0, 110) })] : []);
      regionsList.replaceChildren(el("option", { value: "", text: items.length ? "Choose text on this page"
        : textFind.value ? "No matching text" : "No selectable text" }), ...items);
      regionsList.value = selected < 0 ? "" : String(selected);
    }

    function chooseRegion(value) {
      closeInline();
      fontNotice.hidden = true;
      inlineNotice.hidden = true;
      visualReplacement.checked = Boolean(regions[value]?.forceVisual);
      selected = value;
      regionsList.value = value < 0 ? "" : String(value);
      if (value >= 0) {
        const item = regions[value];
        textValue.value = item.text;
        const style = closestStyle(item);
        const sampled = item.kind === "replace" ? null : sampleColors(base, item);
        family.value = item.autoFont ? "original" : item.family || "original";
        color.value = item.color || item.originalColor || sampled?.color || "#131722";
        background.value = item.background || sampled?.background || "#ffffff";
        bold.checked = item.bold ?? style.bold;
        italic.checked = item.italic ?? style.italic;
        alignment.value = item.align || (/^[\p{Script=Arabic}\p{Script=Hebrew}]/u.test(item.text) ? "right" : "left");
        size.value = Math.max(4, Math.min(120, Math.round(item.size * 2) / 2));
      }
      refresh();
    }

    function selectTool(kind) {
      closeInline();
      active = kind;
      selected = -1;
      regionsList.value = "";
      textValue.value = "";
      alignment.value = kind === "signature" ? "center" : "left";
      family.value = kind === "signature" ? "script" : kind === "replace" ? "original" : "sans";
      bold.checked = italic.checked = false;
      color.value = kind === "highlight" ? "#ffe15a" : kind === "whiteout" ? "#ffffff" : kind === "link" ? "#1b52cb" : "#131722";
      refresh();
    }

    function closeInline(restoreFocus = false) {
      if (inlineEdit.hidden) return;
      inlineEdit.hidden = true;
      if (restoreFocus) regionsList.focus({ preventScroll: true });
    }

    function cancelInline() {
      textValue.value = regions[selected]?.text || "";
      closeInline(true);
    }

    function positionInline() {
      const item = regions[selected];
      if (!item || !base) { closeInline(); return; }
      if (mobileEditor.matches) {
        ["width", "left", "top"].forEach((property) => inlineEdit.style.removeProperty(property));
        const viewport = window.visualViewport;
        const lowerInset = viewport ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0;
        inlineEdit.style.setProperty("--pe-keyboard", lowerInset + "px");
        return;
      }
      const canvas = preview.getBoundingClientRect();
      const area = workArea.getBoundingClientRect();
      const displayPoint = (x, y) => ({
        90: [1 - y, x], 180: [1 - x, 1 - y], 270: [y, 1 - x],
      }[current().rotation] || [x, y]);
      const pointA = displayPoint(item.x, item.y);
      const pointB = displayPoint(item.x + item.width, item.y + item.height);
      const left = canvas.left - area.left + workArea.scrollLeft + Math.min(pointA[0], pointB[0]) * canvas.width;
      const top = canvas.top - area.top + workArea.scrollTop + Math.min(pointA[1], pointB[1]) * canvas.height;
      const width = Math.min(workArea.clientWidth - 16, Math.max(360, Math.abs(pointA[0] - pointB[0]) * canvas.width));
      inlineEdit.style.width = width + "px";
      inlineEdit.style.left = Math.max(workArea.scrollLeft + 8,
        Math.min(left, workArea.scrollLeft + workArea.clientWidth - width - 8)) + "px";
      const below = top + Math.abs(pointA[1] - pointB[1]) * canvas.height + 9;
      const bottom = workArea.scrollTop + workArea.clientHeight - 8;
      const position = below + inlineEdit.offsetHeight <= bottom ? below : top - inlineEdit.offsetHeight - 9;
      inlineEdit.style.top = Math.max(workArea.scrollTop + 8, position) + "px";
    }

    function openInline() {
      const item = regions[selected];
      if (!item || busy || active !== "replace" || /[\r\n]/.test(item.text)) return;
      inlineValue.value = textValue.value;
      inlineNotice.hidden = true;
      chooseFont.hidden = true;
      inlineEdit.hidden = false;
      positionInline();
      inlineValue.focus({ preventScroll: true });
      inlineValue.select();
    }

    inlineEdit.addEventListener("submit", (event) => {
      event.preventDefault();
      if (selected < 0 || busy) return;
      textValue.value = inlineValue.value;
      apply.click();
    });
    inlineValue.addEventListener("input", () => { textValue.value = inlineValue.value; });
    inlineValue.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cancelInline();
      }
    });
    textValue.addEventListener("input", () => { if (!inlineEdit.hidden) inlineValue.value = textValue.value; });
    workArea.addEventListener("scroll", () => { if (!inlineEdit.hidden) positionInline(); }, { passive: true });
    const observe = new ResizeObserver(() => { if (!inlineEdit.hidden) positionInline(); });
    observe.observe(workArea);
    const repositionEditor = () => { if (!inlineEdit.hidden) positionInline(); };
    mobileEditor.addEventListener("change", repositionEditor);
    window.visualViewport?.addEventListener("resize", repositionEditor);
    window.visualViewport?.addEventListener("scroll", repositionEditor);

    function newMark(box, replacing, reverse = false) {
      const text = textValue.value.trim();
      if (active === "replace" && !replacing) throw new Error("Choose existing text first.");
      if (wantsText() && !text && active !== "replace") throw new Error("Enter text before placing it on the page.");
      if (wantsText() && !size.reportValidity()) throw new Error("Enter a font size between 4 and 120.");
      if (wantsImage() && !image) throw new Error("Choose an image file first.");
      let url;
      if (active === "link") {
        try { url = new URL(urlInput.value.trim()); } catch { throw new Error("Enter a full HTTP or HTTPS link."); }
        if (!["https:", "http:"].includes(url.protocol)) throw new Error("Enter a full HTTP or HTTPS link.");
      }
      const displayedSize = replacing && Math.max(4, Math.min(120, Math.round(replacing.size * 2) / 2));
      const fontSize = displayedSize === Number(size.value) ? replacing.size : Number(size.value);
      return { ...box, kind: active, text, url: url?.href, size: fontSize, family: family.value, color: color.value,
        bold: bold.checked, italic: italic.checked,
        background: background.value, image: wantsImage() ? image : null, shape: shape.value, align: alignment.value,
        angle: replacing?.angle ?? -current().rotation * Math.PI / 180, reverse,
        visual: false, closest: false, autoFont: false, forceVisual: false };
    }

    async function detectScannedText(page, languageCode) {
      const { canvas, viewport } = await renderPdfPage(pdf, page.original, 1900);
      try {
        const data = await recognize(canvas, languageCode, tell, true);
        const items = scanRegions(data, canvas).map((item) => ({ ...item, size: item.size / viewport.scale }));
        scans.set(page.original, items);
        originalRegions = mergeDetectedText(digitalRegions, items);
        return items.length;
      } finally { releaseCanvas(canvas); }
    }

    async function runPageOcr(automatic = false) {
      const page = current();
      if (!page?.original || busy) return;
      busy = true;
      refresh(false);
      try {
        if (automatic) {
          const source = await pdf.getPage(page.original);
          const { fnArray } = await source.getOperatorList();
          const imageOps = new Set(Object.entries(pdfjsLib.OPS).filter(([name]) =>
            /^paint.*Image/.test(name)).map(([, operation]) => operation));
          if (!fnArray.some((operation) => imageOps.has(operation))) {
            scans.set(page.original, []);
            return;
          }
        }
        tell("Detecting text on this page…");
        const count = await detectScannedText(page, language.value);
        selected = -1;
        updateRegions();
        tell(count ? "Scan ready. Tap the text you want to edit." : "No text detected. Try another language or a clearer scan.");
      } catch (failure) {
        scans.set(page.original, []);
        tell(error(failure));
      } finally { busy = false; refresh(); }
    }

    const scan = button("Run OCR on page", () => runPageOcr(), "ghost");

    function useVisualMatch(mark, region) {
      const automatic = mark.family === "original";
      const style = automatic ? closestStyle(region) : null;
      return { ...mark, ...style, visual: true, closest: automatic, autoFont: automatic, forceVisual: visualReplacement.checked };
    }

    const apply = button("Apply replacement", async () => {
      if (selected < 0 || busy) return;
      const region = regions[selected];
      const inlineWasOpen = !inlineEdit.hidden;
      try {
        const mark = newMark(region, region);
        if (region.object == null || visualReplacement.checked || /[\r\n]/.test(mark.text)) {
          commit(useVisualMatch(mark, region));
          return;
        }
        if (mark.family === "original") mark.fallback = closestStyle(region);
        busy = true;
        refresh(false);
        tell("Matching the PDF font…");
        const page = current();
        let result;
        try {
          result = await materializeText(client, [pageWithMark(page, mark)]);
        } catch (failure) {
          if (!(failure instanceof FontMatchError)) throw failure;
          commit(useVisualMatch(mark, region));
          return;
        }
        mark.closest = result.closest.some((item) => item.index === page.original - 1 && item.object === mark.object);
        const rendered = await usePatchedPdf(result.bytes, (patched) => renderPdfPage(patched, page.original, 1450));
        if (patchedCanvas) releaseCanvas(patchedCanvas);
        patchedCanvas = rendered.canvas;
        fontNotice.hidden = true;
        commit(mark);
      } catch (failure) {
        const message = error(failure);
        fontNotice.textContent = message;
        fontNotice.hidden = false;
        tell(message);
        if (inlineWasOpen) {
          inlineNotice.textContent = message;
          inlineNotice.hidden = false;
          chooseFont.hidden = false;
          inlineEdit.hidden = false;
          positionInline();
        }
      } finally {
        busy = false;
        refresh(false);
      }
    });
    const center = button("Place at center", () => {
      try { commit(newMark(bounds(...originalPoint(0.25, 0.4), ...originalPoint(0.75, 0.6)))); }
      catch (failure) { tell(error(failure)); }
    }, "ghost");
    const positions = [["Left (%)", 25], ["Top (%)", 40], ["Width (%)", 50], ["Height (%)", 20]]
      .map(([label, value], index) => [label, input({ type: "number", step: 0.1, min: index < 2 ? 0 : 0.1,
        max: 100, value, required: true })]);
    const placement = el("form", {}, el("div", { class: "pe-fields" },
      positions.map(([label, control]) => field(label, control))),
      actions(el("button", { type: "submit", class: "tp-btn tp-btn-ghost" }, "Place at position")));
    placement.addEventListener("submit", (event) => {
      event.preventDefault();
      if (busy || !base || active === "replace") return;
      const [x, y, width, height] = positions.map(([, control]) => Number(control.value) / 100);
      if (x + width > 1.000001 || y + height > 1.000001) {
        tell("Keep the whole box inside the page.");
        return;
      }
      try { commit(newMark(bounds(...originalPoint(x, y), ...originalPoint(x + width, y + height)))); }
      catch (failure) { tell(error(failure)); }
    });
    const positionOptions = el("details", { class: "pe-position" },
      el("summary", { text: "Place by coordinates" }), placement);
    const undo = button("Undo", () => revisit(history, future), "ghost");
    const redo = button("Redo", () => revisit(future, history), "ghost");
    const prev = button("Previous page", () => navigate(index() - 1), "ghost");
    const next = button("Next page", () => navigate(index() + 1), "ghost");
    const earlier = button("Move page earlier", () => move(-1), "ghost");
    const later = button("Move page later", () => move(1), "ghost");
    const rotate = button("Rotate page", () => {
      change(pages.map((page) => page.id === currentId ? { ...page, rotation: mod(page.rotation + 90) } : page));
      refresh();
    }, "ghost");
    const add = button("Add blank page", async () => {
      if (pages.length >= 100) return;
      const page = { id: ++nextId, original: null, rotation: 0, marks: [] };
      const updated = [...pages];
      updated.splice(index() + 1, 0, page);
      change(updated, page.id);
      await showPage();
    }, "ghost");
    const remove = button("Delete page", async () => {
      if (pages.length <= 1) return;
      const offset = index();
      const updated = pages.filter((page) => page.id !== currentId);
      change(updated, updated[Math.min(offset, updated.length - 1)].id);
      await showPage();
    }, "ghost");
    const save = button("Download PDF", async () => {
      if (busy || !pdf) return;
      busy = true;
      refresh(false);
      try {
        const result = await writePdf(file, pdf, pages, client, tell);
        const name = T.safeName(file.name.replace(/\.pdf$/i, ""), "document");
        T.download(name + "-edited.pdf", result.bytes, "application/pdf");
        const details = [];
        if (result.native) details.push(result.native + (result.native === 1 ? " page kept" : " pages kept") + " as selectable PDF text");
        if (result.flattened) details.push(result.flattened + (result.flattened === 1 ? " page was flattened" : " pages were flattened"));
        tell("Edited PDF downloaded." + (details.length ? " " + details.join(" · ") + "." : ""));
      } catch (failure) { tell("Could not export: " + error(failure)); }
      finally { busy = false; refresh(false); }
    }, "primary", { "aria-label": "Download edited PDF" });

    const zoomOut = button("−", () => adjustZoom(-25), "ghost", { "aria-label": "Zoom out" });
    const zoomIn = button("+", () => adjustZoom(25), "ghost", { "aria-label": "Zoom in" });
    const fitPage = button("Fit", () => setZoom("fit"), "ghost", { "aria-label": "Fit page width" });
    const primaryKinds = ["replace", "pan", "text", "highlight", "redact"];
    const toolButtons = primaryKinds.map((kind) => {
      const label = kinds.find(([item]) => item === kind)[1];
      const control = button(label, () => selectTool(kind), "ghost", { "aria-pressed": "false" });
      control.prepend(editingIcon(kind));
      return [kind, control];
    });
    const mobileKinds = ["replace", "pan", "highlight"];
    const otherTools = select([]);
    otherTools.setAttribute("aria-label", "More tools");
    otherTools.addEventListener("change", () => { if (otherTools.value) selectTool(otherTools.value); });
    const replaceOptions = el("div", { class: "pe-options" }, field("Find text", textFind), field("Text on this page", regionsList),
      actions(field("Scan language", language), scan));
    const textField = field("Text", textValue);
    const imageField = field("Choose image or signature", imageInput);
    const shapeField = field("Shape", shape);
    const urlField = field("Link URL", urlInput);
    const styleOptions = el("div", { class: "pe-fields" }, checkbox("Bold", bold), checkbox("Italic", italic));
    const signatureField = checkbox("Use an image of my signature", signatureImage);
    const visualReplacement = el("input", { type: "checkbox" });
    const visualChoice = checkbox("Use visual replacement", visualReplacement);
    visualReplacement.addEventListener("change", () => {
      refresh(false);
    });
    const fontControls = el("div", { class: "pe-fields" }, field("Font", family), field("Size (pt)", size), field("Alignment", alignment));
    const colorField = field("Color", color);
    const fillField = field("Replacement background", background);
    const inspectorTitle = el("h2", { text: "Text appearance" });
    const toolPage = root.closest("[data-tool-page]");
    const favorite = toolPage?.querySelector("[data-save-tool]");
    const inspector = el("section", { class: "pe-inspector" }, inspectorTitle, fontControls,
      el("div", { class: "pe-fields" }, colorField, fillField), toolHelp, styleOptions, fontNotice,
      replaceOptions, signatureField, textField, imageField, shapeField, urlField, visualChoice, actions(apply, center), positionOptions);
    const zoomBar = el("div", { class: "pe-zoom", role: "group", "aria-label": "Page zoom" }, zoomOut, zoom, zoomIn, fitPage);
    stage.append(zoomBar);
    const pagesPanel = el("section", { class: "pe-page-rail" }, el("h2", { text: "Pages" }), thumbnailList,
      el("details", { class: "pe-page-actions" }, el("summary", { text: "Manage pages" }), field("Go to page", pageList),
        actions(prev, next, earlier, later, rotate, add, remove), pageSummary));
    const editor = el("div", { class: "pe-workspace" },
      el("div", { class: "pe-top" },
        el("div", { class: "pe-document-title" }, el("h2", { text: "PDF Editor" }), fileName),
        el("div", { class: "tp-actions pe-file-actions" }, changeFile, undo, redo), save),
      el("div", { class: "pe-command-bar" },
        el("div", { class: "pe-tools", role: "group", "aria-label": "Editing tools" }, toolButtons.map(([, control]) => control), otherTools)),
      el("div", { class: "pe-desk studio-split" }, el("div", { class: "pe-document-pane" }, stage, pagesPanel), inspector), exportNote);
    root.replaceChildren(panel("", [upload, notice, editor]));
    upload.addEventListener("dragover", (event) => {
      if (busy) return;
      event.preventDefault();
      upload.classList.add("is-over");
    });
    upload.addEventListener("dragleave", (event) => {
      if (!upload.contains(event.relatedTarget)) upload.classList.remove("is-over");
    });
    upload.addEventListener("drop", (event) => {
      event.preventDefault();
      upload.classList.remove("is-over");
      if (busy || !event.dataTransfer?.files?.length) return;
      pdfInput.files = event.dataTransfer.files;
      pdfInput.dispatchEvent(new Event("change"));
    });

    function refresh(repaint = true) {
      const page = current();
      if (busy) closeInline();
      inlineValue.disabled = inlineApply.disabled = busy;
      pdfInput.disabled = busy;
      changeFile.disabled = busy;
      editor.hidden = !pdf || !page;
      upload.hidden = !editor.hidden;
      toolPage?.classList.toggle("pe-document-open", !editor.hidden);
      if (editor.hidden) return;
      if (favorite && favorite.parentElement !== inspector) inspector.append(favorite);
      const offset = index();
      fileName.textContent = file.name;
      const pageLabels = pages.map((item, i) => "Page " + (i + 1) + (item.original ? "" : " · Blank"));
      if (pageList.options.length !== pages.length ||
          pages.some((item, i) => pageList.options[i]?.value !== String(item.id))) {
        pageList.replaceChildren(...pages.map((item, i) => el("option", { value: item.id, text: pageLabels[i] })));
      }
      pageList.value = String(currentId);
      pageList.disabled = busy;
      syncThumbnails();
      matchBadge.hidden = !page.marks.some((mark) => mark.closest);
      pageSummary.textContent = pageLabels[offset] + " of " + pages.length + " · " + page.marks.length + " edits";
      [prev, earlier].forEach((control) => { control.disabled = busy || offset <= 0; });
      [next, later].forEach((control) => { control.disabled = busy || offset >= pages.length - 1; });
      add.disabled = busy || pages.length >= 100;
      remove.disabled = busy || pages.length <= 1;
      rotate.disabled = save.disabled = busy || !base;
      zoomOut.disabled = busy || zoomPercent <= 50;
      zoomIn.disabled = busy || zoomPercent >= 400;
      fitPage.disabled = busy || !base;
      undo.disabled = busy || !history.length;
      redo.disabled = busy || !future.length;
      const visibleKinds = mobileEditor.matches ? mobileKinds : primaryKinds;
      toolButtons.forEach(([kind, control]) => {
        control.setAttribute("aria-pressed", String(kind === active));
        control.hidden = !visibleKinds.includes(kind);
        control.disabled = busy;
      });
      const toolbar = mobileEditor.matches ? "compact" : "wide";
      if (otherTools.dataset.layout !== toolbar) {
        otherTools.dataset.layout = toolbar;
        otherTools.replaceChildren(el("option", { value: "", text: mobileEditor.matches ? "More" : "More tools" }),
          ...kinds.filter(([kind]) => !visibleKinds.includes(kind)).map(([kind, label]) =>
            el("option", { value: kind, text: label })));
      }
      otherTools.value = visibleKinds.includes(active) ? "" : active;
      otherTools.disabled = busy;
      inspectorTitle.textContent = wantsText() ? "Text appearance" : "Tool settings";
      const instructions = {
        replace: "Tap text to edit. Drag to move around the page or pinch to zoom.",
        pan: "Drag to move around the page. Pinch or use the zoom controls to change its size.",
        text: "Enter text and drag a box on the page to place it.",
        image: "Choose an image and drag to place it on the page.",
        signature: "Type your name or choose a signature image, then drag to place it.",
        highlight: "Drag across the area you want to highlight.",
        underline: "Drag across the text to underline it.",
        strike: "Drag across the text to strike it out.",
        link: "Enter a URL, then drag a clickable area on the page.",
        whiteout: "Paint over an area with a solid color. Use Redact to remove private content.",
        shape: "Choose a shape and drag to draw it.",
        redact: "Drag a box over private details. Redaction exports every page as an image and removes underlying text and links.",
      };
      toolHelp.textContent = instructions[active];
      workArea.dataset.selecting = String(active === "replace");
      workArea.dataset.panning = String(active === "pan");
      const marks = pages.flatMap((item) => item.marks);
      const hasRedaction = marks.some((mark) => mark.kind === "redact");
      const visualFallback = marks.some((mark) => mark.kind === "replace" && mark.visual);
      const hasReplacement = marks.some((mark) => mark.kind === "replace");
      exportNote.hidden = !hasRedaction && !hasReplacement;
      exportNote.textContent = hasRedaction
        ? "Redaction exports every page as a flattened image without selectable text, links or form fields."
        : visualFallback
          ? "This edit uses a visual replacement. Its page may be flattened when you download."
          : "Direct text edits stay selectable. Auto match tries the original font first.";
      replaceOptions.hidden = active !== "replace";
      const region = regions[selected];
      visualChoice.hidden = active !== "replace" || !region || region.ocr;
      visualReplacement.disabled = busy;
      fillField.hidden = active !== "replace" || (region?.object != null && !visualReplacement.checked);
      textField.hidden = fontControls.hidden = !wantsText();
      styleOptions.hidden = !wantsText();
      family.options[0].hidden = active !== "replace";
      const keepFont = family.value === "original";
      bold.disabled = italic.disabled = busy || keepFont;
      urlField.hidden = active !== "link";
      signatureField.hidden = active !== "signature";
      imageField.hidden = !wantsImage();
      shapeField.hidden = active !== "shape";
      colorField.hidden = active === "redact" || active === "pan" || wantsImage();
      apply.hidden = active !== "replace";
      center.hidden = ["replace", "redact", "pan"].includes(active);
      positionOptions.hidden = active === "replace" || active === "pan";
      scan.disabled = busy || !page.original || !base;
      apply.disabled = busy || selected < 0;
      center.disabled = busy || !base;
      [regionsList, textFind, textValue, size, color, background, shape, family, alignment, signatureImage, imageInput,
        language, urlInput, zoom]
        .forEach((control) => { control.disabled = busy; });
      if (repaint) draw();
    }

    async function showPage() {
      busy = true;
      selected = -1;
      drag = moving = pinch = null;
      pointers.clear();
      if (base) releaseCanvas(base);
      if (patchedCanvas) releaseCanvas(patchedCanvas);
      patchedCanvas = base = null;
      digitalRegions = originalRegions = [];
      textFind.value = "";
      updateRegions();
      refresh(false);
      tell("Rendering page…");
      try {
        const page = current();
        if (page.original) {
          const rendered = await renderPdfPage(pdf, page.original, 1450);
          base = rendered.canvas;
          baseScale = rendered.viewport.scale;
          const source = await pdf.getPage(page.original);
          const extracted = textRegions(await source.getTextContent(), rendered.viewport, base, source);
          if (client && await nativeReady) {
            if (!objectRegions.has(page.original)) {
              try { objectRegions.set(page.original, await client.call("page", page.original - 1)); }
              catch { objectRegions.set(page.original, []); }
            }
          }
          digitalRegions = findNativeRegions(objectRegions.get(page.original) || [], rendered.viewport, base, extracted);
          originalRegions = mergeDetectedText(digitalRegions, scans.get(page.original) || []);
          if (!digitalRegions.length && !scans.has(page.original) && hasPageInk(base)) {
            tell("Detecting scanned text…");
            try { await detectScannedText(page, language.value); }
            catch { scans.set(page.original, []); }
          }
          if (nativeMarks(page.marks).length) {
            const { bytes } = await materializeText(client, [page]);
            patchedCanvas = (await usePatchedPdf(bytes, (patched) => renderPdfPage(patched, page.original, 1450))).canvas;
          }
        } else {
          baseScale = 1.5;
          base = canvasFor(Math.ceil(blankSize[0] * baseScale), Math.ceil(blankSize[1] * baseScale));
          const context = base.getContext("2d");
          context.fillStyle = "#fff";
          context.fillRect(0, 0, base.width, base.height);
        }
        updateRegions();
        tell("");
      } catch (failure) { tell(error(failure)); }
      finally {
        busy = false;
        refresh();
        workArea.scrollTo(0, 0);
      }
    }

    function move(direction) {
      const offset = index();
      const updated = [...pages];
      const destination = offset + direction;
      if (destination < 0 || destination >= updated.length) return;
      [updated[offset], updated[destination]] = [updated[destination], updated[offset]];
      change(updated);
      refresh(false);
    }

    async function navigate(offset) {
      if (!pages[offset] || pages[offset].id === currentId || busy) return;
      currentId = pages[offset].id;
      await showPage();
    }

    const originalPoint = (x, y) => ({ 90: [y, 1 - x], 180: [1 - x, 1 - y], 270: [1 - y, x] }[current().rotation] || [x, y]);
    const point = (event) => {
      const rect = preview.getBoundingClientRect();
      const x = clamp((event.clientX - rect.left) / rect.width);
      const y = clamp((event.clientY - rect.top) / rect.height);
      return originalPoint(x, y);
    };

    function setZoom(value, center, location) {
      const rect = workArea.getBoundingClientRect();
      const canvas = preview.getBoundingClientRect();
      const focus = center || { x: rect.left + workArea.clientWidth / 2, y: rect.top + workArea.clientHeight / 2 };
      const anchor = location || {
        x: clamp((focus.x - canvas.left) / Math.max(1, canvas.width)),
        y: clamp((focus.y - canvas.top) / Math.max(1, canvas.height)),
      };
      zoomPercent = value === "fit" ? 100 : Math.max(50, Math.min(400, Math.round(Number(value))));
      sheet.style.width = zoomPercent + "%";
      const displayed = value === "fit" ? value : String(zoomPercent);
      zoom.querySelector("[data-custom-zoom]")?.remove();
      if (![...zoom.options].some((option) => option.value === displayed)) {
        zoom.append(el("option", { value: displayed, "data-custom-zoom": true, text: displayed + "%" }));
      }
      zoom.value = displayed;
      const resized = preview.getBoundingClientRect();
      workArea.scrollLeft += resized.left + anchor.x * resized.width - focus.x;
      workArea.scrollTop += resized.top + anchor.y * resized.height - focus.y;
      zoomOut.disabled = zoomPercent <= 50;
      zoomIn.disabled = zoomPercent >= 400;
      if (!inlineEdit.hidden) positionInline();
    }

    function adjustZoom(delta) {
      setZoom(zoomPercent + delta);
    }

    function touchPair() {
      const [a, b] = [...pointers.values()];
      return {
        x: (a.x + b.x) / 2, y: (a.y + b.y) / 2,
        distance: Math.hypot(a.x - b.x, a.y - b.y),
      };
    }

    function regionAt(event) {
      const [x, y] = point(event);
      const matches = regions.map((item, i) => ({ ...item, i })).filter((item) =>
        matchesSearch(item) && item.x <= x && item.x + item.width >= x && item.y <= y && item.y + item.height >= y);
      matches.sort((first, second) => first.width * first.height - second.width * second.height);
      return matches[0]?.i ?? -1;
    }

    function hitText(event) {
      const match = regionAt(event);
      chooseRegion(match);
      if (match >= 0) openInline();
      else if (current()?.original && !textFind.value && !scans.has(current().original)) void runPageOcr(true);
    }

    preview.addEventListener("pointerleave", () => {
      if (hovered === -1) return;
      hovered = -1;
      draw();
    });

    let animation = 0;
    preview.addEventListener("pointerdown", (event) => {
      if (!base || busy || event.button !== 0) return;
      const pointer = { x: event.clientX, y: event.clientY };
      if (event.pointerType === "touch") {
        pointers.set(event.pointerId, pointer);
        preview.setPointerCapture(event.pointerId);
        if (pointers.size > 1) {
          if (pointers.size === 2) {
            const center = touchPair();
            const rect = preview.getBoundingClientRect();
            pinch = { ...center, percent: zoomPercent, anchor: {
              x: clamp((center.x - rect.left) / rect.width),
              y: clamp((center.y - rect.top) / rect.height),
            } };
            drag = moving = null;
            closeInline();
            draw();
          }
          return;
        }
        if (pinch) return;
      }
      if (active === "replace" && event.pointerType !== "touch") {
        hitText(event);
      } else if (active === "pan" || active === "replace") {
        moving = { id: event.pointerId, ...pointer, dragged: false };
        preview.setPointerCapture(event.pointerId);
      } else if (!drag) {
        drag = { id: event.pointerId, point: point(event) };
        preview.setPointerCapture(event.pointerId);
      }
    });
    preview.addEventListener("pointermove", (event) => {
      if (pointers.has(event.pointerId)) pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pinch) {
        if (pointers.size === 2) {
          const center = touchPair();
          const factor = center.distance / Math.max(1, pinch.distance);
          setZoom(pinch.percent * factor, center, pinch.anchor);
        }
        return;
      }
      if (moving?.id === event.pointerId) {
        const dx = moving.x - event.clientX;
        const dy = moving.y - event.clientY;
        if (!moving.dragged && Math.hypot(dx, dy) < 7) return;
        moving = { id: event.pointerId, x: event.clientX, y: event.clientY, dragged: true };
        closeInline();
        const prior = workArea.scrollTop;
        workArea.scrollLeft += dx;
        workArea.scrollTop += dy;
        if (event.pointerType === "touch") {
          const remainder = dy - (workArea.scrollTop - prior);
          if (Math.abs(remainder) > 1) window.scrollBy(0, remainder);
        }
        return;
      }
      if (!drag && active === "replace" && base && !busy && event.pointerType === "mouse") {
        const nextHover = regionAt(event);
        if (nextHover !== hovered) {
          hovered = nextHover;
          draw();
        }
        return;
      }
      if (drag?.id !== event.pointerId) return;
      const outline = bounds(...drag.point, ...point(event));
      cancelAnimationFrame(animation);
      animation = requestAnimationFrame(() => { if (drag) draw(outline); });
    });
    preview.addEventListener("pointerup", (event) => {
      pointers.delete(event.pointerId);
      if (pinch) {
        if (pointers.size === 0) pinch = null;
        return;
      }
      if (moving?.id === event.pointerId) {
        const tap = !moving.dragged;
        moving = null;
        if (tap && active === "replace") hitText(event);
        return;
      }
      if (drag?.id !== event.pointerId) return;
      cancelAnimationFrame(animation);
      const end = point(event);
      const box = bounds(...drag.point, ...end);
      const reverse = (end[0] - drag.point[0]) * (end[1] - drag.point[1]) < 0;
      drag = null;
      const width = box.width * base.width;
      const height = box.height * base.height;
      const canBeFlat = active === "shape" && shape.value === "line";
      if (Math.max(width, height) < 3 || (!canBeFlat && Math.min(width, height) < 3)) { draw(); return; }
      try { commit(newMark(box, null, reverse)); }
      catch (failure) { tell(error(failure)); draw(); }
    });
    function cancelPointer(event) {
      pointers.delete(event.pointerId);
      if (pointers.size === 0) pinch = null;
      if (moving?.id === event.pointerId) moving = null;
      if (drag?.id === event.pointerId) { drag = null; draw(); }
    }
    preview.addEventListener("pointercancel", cancelPointer);
    preview.addEventListener("lostpointercapture", cancelPointer);

    textFind.addEventListener("input", () => { closeInline(); selected = -1; refreshRegions(); refresh(); });
    zoom.addEventListener("change", () => setZoom(zoom.value));
    textValue.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && !apply.hidden && !apply.disabled) {
        event.preventDefault();
        apply.click();
      }
    });
    window.addEventListener("pagehide", (event) => { if (!event.persisted) client?.close(); });
    regionsList.addEventListener("change", () => chooseRegion(regionsList.value === "" ? -1 : Number(regionsList.value)));
    pageList.addEventListener("change", () => navigate(pages.findIndex((page) => page.id === Number(pageList.value))));
    family.addEventListener("change", () => refresh(false));
    signatureImage.addEventListener("change", () => refresh(false));
    imageInput.addEventListener("change", async () => {
      image = null;
      if (!imageInput.files[0]) return;
      busy = true;
      refresh(false);
      try { image = await loadImage(imageInput.files[0]); tell("Image ready to place."); }
      catch (failure) { tell(error(failure)); }
      finally { busy = false; refresh(false); }
    });
    pdfInput.addEventListener("change", async () => {
      const candidate = pdfInput.files[0];
      if (!candidate || busy) return;
      busy = true;
      refresh(false);
      tell("Opening PDF…");
      let incoming;
      try {
        incoming = await openPdf(candidate);
        // Exporting preserved pages requires a PDF that pdf-lib can open too.
        await PDFLib.PDFDocument.load(await candidate.arrayBuffer(), { updateMetadata: false });
        await pdf?.destroy();
        pdf = incoming;
        file = candidate;
        client?.close();
        objectRegions.clear();
        try {
          const worker = nativeClient();
          client = worker;
          nativeReady = candidate.arrayBuffer().then((buffer) => worker.call("open", buffer, [buffer]))
            .catch(() => { worker.close(); return false; });
        } catch {
          client = null;
          nativeReady = Promise.resolve(false);
        }
        history.length = future.length = 0;
        scans.clear();
        image = null;
        imageInput.value = "";
        signatureImage.checked = false;
        pages = Array.from({ length: pdf.numPages }, (_, i) => ({
          id: ++nextId, original: i + 1, rotation: 0, marks: [],
        }));
        currentId = pages[0].id;
        setZoom("fit");
        await showPage();
      } catch (failure) {
        if (incoming && incoming !== pdf) await incoming.destroy();
        pdfInput.value = "";
        tell(error(failure));
      } finally { busy = false; refresh(false); }
    });
    mobileEditor.addEventListener("change", () => refresh(false));
    refresh(false);
  });
})();
