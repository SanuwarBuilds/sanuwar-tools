import { init } from "/assets/vendor/pdfium/index.browser.js?v=2.15.1";

let engine;
let source;
let sourcePointer = 0;
let sourceDocument = 0;

async function initialize() {
  if (engine) return;
  const response = await fetch("/assets/vendor/pdfium/pdfium.wasm?v=2.15.1");
  if (!response.ok) throw new Error("The PDF text engine could not load.");
  engine = await init({ wasmBinary: await response.arrayBuffer() });
  engine.PDFiumExt_Init();
}

function withMemory(size, callback) {
  const memory = engine.pdfium;
  const pointer = memory._malloc(size);
  if (!pointer) throw new Error("The PDF text engine ran out of memory.");
  try { return callback(pointer, memory); }
  finally { memory._free(pointer); }
}

function openDocument(data, callback) {
  return withMemory(data.length, (pointer, memory) => {
    memory.HEAPU8.set(data, pointer);
    const document = engine.FPDF_LoadMemDocument(pointer, data.length, "");
    if (!document) throw new Error("The PDF text engine could not open this file.");
    try { return callback(document); }
    finally { engine.FPDF_CloseDocument(document); }
  });
}

function withPage(document, index, callback) {
  const page = engine.FPDF_LoadPage(document, index);
  if (!page) throw new Error("The PDF text engine could not read this page.");
  try { return callback(page); }
  finally { engine.FPDF_ClosePage(page); }
}

function withTextPage(page, callback) {
  const textPage = engine.FPDFText_LoadPage(page);
  if (!textPage) return [];
  try { return callback(textPage); }
  finally { engine.FPDFText_ClosePage(textPage); }
}

function readText(object, textPage) {
  const length = engine.FPDFTextObj_GetText(object, textPage, 0, 0);
  if (length < 2 || length > 128000) return "";
  return withMemory(length, (pointer, memory) => {
    const received = engine.FPDFTextObj_GetText(object, textPage, pointer, length);
    return received >= 2 && received <= length ? memory.UTF16ToString(pointer, length) : "";
  });
}

const objectBounds = (object) => withMemory(16, (p, m) =>
  engine.FPDFPageObj_GetBounds(object, p, p + 4, p + 8, p + 12)
    ? Array.from({ length: 4 }, (_, i) => m.getValue(p + i * 4, "float")) : null);
const objectMatrix = (object) => withMemory(24, (p, m) =>
  engine.FPDFPageObj_GetMatrix(object, p)
    ? Array.from({ length: 6 }, (_, i) => m.getValue(p + i * 4, "float")) : null);
const textSize = (object) => withMemory(4, (p, m) =>
  engine.FPDFTextObj_GetFontSize(object, p) ? m.getValue(p, "float") : 0);
const fillColor = (object) => withMemory(16, (p, m) =>
  engine.FPDFPageObj_GetFillColor(object, p, p + 4, p + 8, p + 12)
    ? Array.from({ length: 4 }, (_, i) => m.getValue(p + i * 4, "i32")) : [0, 0, 0, 255]);
const fontName = (font) => withMemory(512, (p, m) => {
  const length = engine.FPDFFont_GetBaseFontName(font, p, 512);
  return length && length <= 512 ? m.UTF8ToString(p, length) : "";
});

function setMatrix(object, values) {
  return withMemory(24, (p, m) => {
    values.forEach((value, i) => m.setValue(p + i * 4, value, "float"));
    return engine.FPDFPageObj_SetMatrix(object, p);
  });
}

function readRegions(index) {
  return withPage(sourceDocument, index, (page) => withTextPage(page, (textPage) => {
    const regions = [];
    const count = engine.FPDFPage_CountObjects(page);
    for (let i = 0; i < count; i += 1) {
      const object = engine.FPDFPage_GetObject(page, i);
      if (engine.FPDFPageObj_GetType(object) !== 1 || engine.FPDFTextObj_GetTextRenderMode(object) !== 0) continue;
      const text = readText(object, textPage);
      if (!text.trim() || /[\r\n]/.test(text)) continue;
      const bounds = objectBounds(object);
      const matrix = objectMatrix(object);
      const size = textSize(object);
      if (!bounds || !matrix || !size || !bounds.every(Number.isFinite)) continue;
      const color = "#" + fillColor(object).slice(0, 3).map((c) => c.toString(16).padStart(2, "0")).join("");
      regions.push({ object: i, text, bounds, matrix, size, color, font: fontName(engine.FPDFTextObj_GetFont(object)) });
    }
    return regions;
  }));
}

function stockFont(family, name, bold, italic) {
  const original = name.toLowerCase();
  if (family === "original") {
    family = /courier|mono|consolas|menlo/.test(original) ? "mono" : /times|serif|garamond|georgia/.test(original) ? "serif" : "sans";
    bold ||= /bold|black|heavy|demi|semibold/.test(original);
    italic ||= /italic|oblique/.test(original);
  }
  if (family === "serif") return bold ? (italic ? "Times-BoldItalic" : "Times-Bold") : (italic ? "Times-Italic" : "Times-Roman");
  const base = family === "mono" ? "Courier" : "Helvetica";
  return base + (bold ? (italic ? "-BoldOblique" : "-Bold") : italic ? "-Oblique" : "");
}

function configureText(object, edit, matrix, oldBounds, oldColor, size) {
  if (!withMemory((edit.text.length + 1) * 2, (p, m) => {
    m.stringToUTF16(edit.text, p, (edit.text.length + 1) * 2);
    return engine.FPDFText_SetText(object, p);
  })) return false;
  const [a, b, c, d, x, y] = matrix;
  const scale = size ? edit.size / size : 1;
  const moved = [a * scale, b * scale, c * scale, d * scale, x, y];
  if (!setMatrix(object, moved)) return false;
  const color = edit.color.match(/[a-f0-9]{2}/gi).map((v) => Number.parseInt(v, 16));
  if (!engine.FPDFPageObj_SetFillColor(object, ...color, oldColor[3])) return false;

  const actual = objectBounds(object);
  if (!actual) return false;
  const axisLength = Math.hypot(a, b);
  if (!axisLength) return false;
  // On straight baselines, fit a longer replacement to the space the old run occupied.
  if (Math.min(Math.abs(a), Math.abs(b)) < axisLength * 0.01) {
    const sideways = Math.abs(b) > Math.abs(a);
    const j = sideways ? 1 : 0;
    const usable = oldBounds[j + 2] - oldBounds[j];
    const advance = actual[j + 2] - actual[j];
    if (advance > 0 && usable > 0) {
      const fit = Math.min(1, (usable + 0.75) / advance);
      moved[0] *= fit;
      moved[1] *= fit;
      const remaining = Math.max(0, usable - advance * fit);
      const offset = edit.align === "center" ? remaining / 2 : edit.align === "right" ? remaining : 0;
      moved[4] += offset * a / axisLength;
      moved[5] += offset * b / axisLength;
      if (!setMatrix(object, moved)) return false;
    }
  }
  return true;
}

function replacePage(document, index, edits) {
  return withPage(document, index, (page) => {
    const plans = withTextPage(page, (textPage) => edits.map((edit) => {
      const object = engine.FPDFPage_GetObject(page, edit.object);
      if (!object || engine.FPDFPageObj_GetType(object) !== 1 || readText(object, textPage) !== edit.sourceText) return null;
      return { edit, object, matrix: objectMatrix(object), bounds: objectBounds(object),
        font: engine.FPDFTextObj_GetFont(object), size: textSize(object), color: fillColor(object), inserted: 0 };
    }));
    if (plans.length !== edits.length || plans.some((plan) => !plan?.matrix || !plan.bounds || !plan.font || !plan.size)) return false;
    let ready = false;
    try {
      for (const plan of plans) {
        const { edit, matrix, bounds, font, size, color } = plan;
        if (!edit.text) continue;
        const name = stockFont(edit.family, fontName(font), edit.bold, edit.italic);
        const candidates = [
          ...(edit.family === "original" && !edit.bold && !edit.italic
            ? [() => engine.FPDFPageObj_CreateTextObj(document, font, size)] : []),
          () => engine.FPDFPageObj_NewTextObj(document, name, size),
        ];
        for (const make of candidates) {
          const replacement = make();
          if (!replacement) continue;
          if (!configureText(replacement, edit, matrix, bounds, color, size * Math.hypot(matrix[2], matrix[3]))) {
            engine.FPDFPageObj_Destroy(replacement);
            continue;
          }
          // Append provisionally to verify the font can represent the replacement.
          engine.FPDFPage_InsertObject(page, replacement);
          const valid = withTextPage(page, (textPage) => readText(replacement, textPage).trim() === edit.text.trim());
          if (valid === true) {
            plan.inserted = replacement;
            break;
          }
          if (!engine.FPDFPage_RemoveObject(page, replacement)) throw new Error("Could not roll back a PDF text change.");
          engine.FPDFPageObj_Destroy(replacement);
        }
        if (!plan.inserted) return false;
      }
      ready = true;
      for (const plan of plans.sort((a, b) => b.edit.object - a.edit.object)) {
        if (!engine.FPDFPage_RemoveObject(page, plan.object)) throw new Error("Could not remove the original text.");
        engine.FPDFPageObj_Destroy(plan.object);
        if (plan.inserted) {
          if (!engine.FPDFPage_RemoveObject(page, plan.inserted)) throw new Error("Could not move the replacement text.");
          if (!engine.FPDFPage_InsertObjectAtIndex(page, plan.inserted, plan.edit.object)) {
            engine.FPDFPageObj_Destroy(plan.inserted);
            throw new Error("Could not place the replacement text.");
          }
        }
      }
      if (!engine.FPDFPage_GenerateContent(page)) throw new Error("Could not write the changed PDF page.");
      return true;
    } finally {
      if (!ready) {
        for (const { inserted } of plans) {
          if (inserted) {
            if (!engine.FPDFPage_RemoveObject(page, inserted)) throw new Error("Could not roll back a PDF text change.");
            engine.FPDFPageObj_Destroy(inserted);
          }
        }
      }
    }
  });
}

function saveCopy(document) {
  const writer = engine.PDFiumExt_OpenFileWriter();
  if (!writer) throw new Error("Could not open the PDF export.");
  try {
    if (!engine.PDFiumExt_SaveAsCopy(document, writer)) throw new Error("Could not save the PDF text edits.");
    const length = engine.PDFiumExt_GetFileWriterSize(writer);
    return withMemory(length, (pointer, memory) => {
      if (engine.PDFiumExt_GetFileWriterData(writer, pointer, length) !== length) throw new Error("The PDF export is incomplete.");
      return memory.HEAPU8.slice(pointer, pointer + length);
    });
  } finally { engine.PDFiumExt_CloseFileWriter(writer); }
}

self.onmessage = async ({ data: { id, type, payload } }) => {
  try {
    await initialize();
    if (type === "open") {
      if (sourceDocument) engine.FPDF_CloseDocument(sourceDocument);
      if (sourcePointer) engine.pdfium._free(sourcePointer);
      source = new Uint8Array(payload);
      // The source buffer must live as long as PDFium's memory-backed document.
      sourcePointer = engine.pdfium._malloc(source.length);
      sourceDocument = 0;
      if (!sourcePointer) throw new Error("The PDF text engine ran out of memory.");
      engine.pdfium.HEAPU8.set(source, sourcePointer);
      sourceDocument = engine.FPDF_LoadMemDocument(sourcePointer, source.length, "");
      if (!sourceDocument) throw new Error("The PDF text engine could not open this file.");
      self.postMessage({ id, result: true });
    } else if (type === "page") {
      self.postMessage({ id, result: readRegions(payload) });
    } else if (type === "save") {
      const result = openDocument(source, (document) => {
        const applied = [];
        for (const { index, edits } of payload) {
          if (replacePage(document, index, edits)) applied.push(index);
        }
        return { applied, bytes: applied.length ? saveCopy(document) : null };
      });
      self.postMessage({ id, result }, result.bytes ? [result.bytes.buffer] : []);
    } else {
      throw new Error("Unknown PDF text operation.");
    }
  } catch (error) {
    self.postMessage({ id, error: error.message || String(error) });
  }
};
