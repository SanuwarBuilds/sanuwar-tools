"use strict";
(() => {
  const T = window.SANU_TOOLS;
  const { el, fmtBytes } = T;
  const documentLimit = 40 * 1024 ** 2;
  if (window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = "/assets/vendor/pdf.worker.min.js";

  const guardFile = (file, limit = documentLimit) => {
    if (!file.size || file.size > limit) throw new Error("Choose a non-empty file up to " + fmtBytes(limit) + ".");
  };

  const canvasFor = (width, height) => el("canvas", { width, height });
  const releaseCanvas = (canvas) => { canvas.width = 0; canvas.height = 0; };
  const toBlob = (canvas, type, quality) => new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob?.type === type ? resolve(blob) : reject(new Error("This browser could not encode " + type + ".")), type, quality);
  });

  async function loadImage(file) {
    guardFile(file);
    const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const ascii = new TextDecoder().decode(header);
    const type = header[0] === 0xff && header[1] === 0xd8 ? "image/jpeg"
      : header[0] === 0x89 && ascii.slice(1, 4) === "PNG" ? "image/png"
      : ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP" ? "image/webp"
      : ascii.startsWith("BM") ? "image/bmp" : "";
    if (!type) throw new Error("Choose a JPG, PNG, WebP or BMP image.");
    const url = URL.createObjectURL(new Blob([file], { type }));
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      if (image.naturalWidth * image.naturalHeight > 40_000_000) {
        throw new Error("Choose an image under 40 megapixels.");
      }
      return image;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function openPdf(file) {
    guardFile(file);
    const task = pdfjsLib.getDocument({ data: await file.arrayBuffer(), isEvalSupported: false });
    try {
      const pdf = await task.promise;
      if (pdf.numPages > 100) throw new Error("Choose a PDF with up to 100 pages.");
      return pdf;
    } catch (error) {
      await task.destroy();
      throw error;
    }
  }

  async function renderPdfPage(pdf, pageNumber, longestEdge) {
    const page = await pdf.getPage(pageNumber);
    const actual = page.getViewport({ scale: 1 });
    const scale = Math.min(3, longestEdge / Math.max(actual.width, actual.height));
    const viewport = page.getViewport({ scale });
    const canvas = canvasFor(Math.max(1, Math.ceil(viewport.width)), Math.max(1, Math.ceil(viewport.height)));
    try {
      await page.render({ viewport, canvasContext: canvas.getContext("2d"), background: "#fff" }).promise;
      return { canvas, viewport, width: actual.width, height: actual.height };
    } catch (error) {
      releaseCanvas(canvas);
      throw error;
    } finally {
      page.cleanup();
    }
  }

  function paintMasks(canvas, masks) {
    const context = canvas.getContext("2d");
    context.fillStyle = "#000";
    for (const { x, y, width, height } of masks) {
      const left = Math.floor(x * canvas.width);
      const top = Math.floor(y * canvas.height);
      const right = Math.ceil((x + width) * canvas.width);
      const bottom = Math.ceil((y + height) * canvas.height);
      context.fillRect(left, top, right - left, bottom - top);
    }
  }

  async function recognize(canvas, language, onProgress, withBlocks = false) {
    const base = location.origin + "/assets/vendor/ocr";
    let fail;
    const failure = new Promise((resolve, reject) => { fail = reject; });
    const loading = Tesseract.createWorker(language.split("+"), 1, {
      errorHandler: fail,
      workerPath: base + "/worker.min.js",
      corePath: base + "/tesseract-core-lstm.js",
      langPath: base,
      workerBlobURL: false,
      logger: ({ status, progress }) => onProgress(status === "recognizing text"
        ? "Recognizing text… " + Math.round(progress * 100) + "%" : "Preparing OCR…"),
    });
    const worker = await Promise.race([loading, failure]);
    try {
      const { data } = await worker.recognize(canvas, {}, { text: true, blocks: withBlocks });
      return data;
    } finally {
      await worker.terminate();
    }
  }

  T.localFiles = { guardFile, canvasFor, releaseCanvas, toBlob, loadImage, openPdf, renderPdfPage, paintMasks, recognize };
})();
