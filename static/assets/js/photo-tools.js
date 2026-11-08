'use strict';
(() => {
  const $ = (id) => document.getElementById(id);
  const core = PhotoCore;

  const presets = {
    'passport-print': { name: 'Passport print · 35 × 45 mm', width: 413, height: 531, dpi: 300, kb: '', format: 'image/jpeg', note: '35 × 45 mm print layout at 300 DPI (rounded to whole pixels). This is a print preset, not a universal online-upload specification.', source: 'https://www.indembassyankara.gov.in/eoiank_pages/MTg2' },
    'passport-online': { name: 'Passport mission upload · 630 × 810 px', width: 630, height: 810, dpi: 300, kb: '', format: 'image/jpeg', note: '630 × 810 px for the mission workflow described by the High Commission of India, London. Enter the KB limit shown on your own portal. Use an original, compliant photo; size conversion does not validate face or background rules.', source: 'https://www.hcilondon.gov.in/page/general-guidelines-indian-passport-faqs/' },
    pan: { name: 'PAN photo · Protean DSC', width: 197, height: 276, dpi: 200, kb: 20, format: 'image/jpeg', note: 'Protean DSC scanned-photo workflow: 25 × 35 mm, 200 DPI, JPEG up to 20 KB. Other PAN application methods may have different requirements.', source: 'https://tin.tin.proteantech.in/pan/InstructionDSC.html' },
    'pan-signature': { name: 'PAN signature · Protean DSC', width: 354, height: 157, dpi: 200, kb: 10, format: 'image/jpeg', note: 'Protean DSC scanned-signature workflow: 45 × 20 mm, 200 DPI, JPEG up to 10 KB. Check your application instructions.', source: 'https://tin.tin.proteantech.in/pan/InstructionDSC.html' },
    'voter-print': { name: 'Voter ID Form 6 print · 35 × 45 mm', width: 413, height: 531, dpi: 300, kb: '', format: 'image/jpeg', note: 'ECI Form 6 specifies a 35 × 45 mm unsigned colour photograph with a white background. This print preset uses 300 DPI; for online upload, enter the size limit and dimensions shown on your portal.', source: 'https://voters.eci.gov.in/formspdf/Form_6_English.pdf' },
    square: { name: 'Square · 600 × 600 px', width: 600, height: 600, dpi: 300, kb: '', format: 'image/jpeg', note: 'A general square image. Set your own KB limit if needed.' },
  };
  const sizeFields = ['width', 'height', 'dpi', 'kb', 'format'];
  const presetFields = [...sizeFields, 'quality'];
  const stateFields = ['zoom', 'x', 'y', 'brightness', 'contrast', 'saturation', 'warmth', 'bg', ...sizeFields, 'quality', 'ratio'];
  const ratioMap = { '1:1': 1, '3:4': 3 / 4, '4:3': 4 / 3, '9:16': 9 / 16, '16:9': 16 / 9 };
  const looks = [
    { id: 'neutral', name: 'Neutral', brightness: 100, contrast: 100, saturation: 100, warmth: 0 },
    { id: 'vivid', name: 'Vivid', brightness: 103, contrast: 108, saturation: 132, warmth: 8 },
    { id: 'warm', name: 'Warm', brightness: 103, contrast: 104, saturation: 110, warmth: 26 },
    { id: 'cool', name: 'Cool', brightness: 100, contrast: 105, saturation: 108, warmth: -22 },
    { id: 'mono', name: 'Mono', brightness: 102, contrast: 108, saturation: 0, warmth: 0 },
    { id: 'fade', name: 'Fade', brightness: 108, contrast: 94, saturation: 86, warmth: 6 },
  ];

  let source = null;
  let transformed = null;
  let turn = 0;
  let flip = false;
  let filename = 'photo';
  let busy = false;
  let drag = null;
  let loadVersion = 0;
  let comparing = false;
  let grid = false;
  let history = [];
  let historyIndex = -1;
  let estimateTimer = 0;
  let estimateToken = 0;

  const canvas = $('photo-canvas');
  const ctx = canvas.getContext('2d');
  const savedKey = 'sanuwar.photo.presets.v1';
  let saved = [];

  function quality() {
    return Math.max(50, Math.min(100, Number($('photo-quality').value) || 92));
  }
  function values() {
    const base = core.settings(Object.fromEntries(sizeFields.map((key) => [key, $('photo-' + key).value])));
    return { ...base, quality: quality() };
  }
  function validSaved(preset) {
    try {
      if (!preset || typeof preset.id !== 'string' || !/^saved-[a-z0-9-]+$/.test(preset.id) || typeof preset.name !== 'string' || preset.name.length > 50 || !core.settings(preset)) return false;
      return preset.quality == null || (Number.isFinite(Number(preset.quality)) && Number(preset.quality) >= 50 && Number(preset.quality) <= 100);
    } catch {
      return false;
    }
  }
  try {
    const items = JSON.parse(localStorage.getItem(savedKey) || '[]');
    if (Array.isArray(items)) saved = items.filter(validSaved).slice(0, 20);
  } catch {}

  function savedOptions() {
    $('photo-preset').querySelectorAll('[data-saved]').forEach((node) => node.remove());
    for (const preset of saved) {
      const option = document.createElement('option');
      option.value = preset.id;
      option.textContent = preset.name;
      option.dataset.saved = 'true';
      $('photo-preset').append(option);
    }
  }
  savedOptions();

  function message(text, error = false) {
    for (const id of ['photo-status', 'photo-export-status']) {
      const status = $(id);
      if (!status) continue;
      status.textContent = text;
      status.classList.toggle('error', error);
    }
  }
  function syncQuality() {
    $('photo-quality-field').hidden = $('photo-format').value !== 'image/jpeg';
    $('quality-value').textContent = quality() + '%';
  }
  function allButtonsDisabled(disabled) {
    $('photo-editor').querySelectorAll('button, input, select').forEach((input) => { input.disabled = disabled; });
  }

  function state() {
    const snapshot = { turn, flip };
    for (const key of stateFields) snapshot[key] = $('photo-' + key).value;
    return snapshot;
  }
  function syncHistory() {
    $('photo-undo').disabled = !source || historyIndex <= 0;
    $('photo-redo').disabled = !source || historyIndex >= history.length - 1;
  }
  function pushHistory() {
    if (!source) return;
    const next = state();
    const last = history[historyIndex];
    if (last && JSON.stringify(last) === JSON.stringify(next)) {
      syncHistory();
      return;
    }
    history = history.slice(0, historyIndex + 1);
    history.push(next);
    if (history.length > 40) history.shift();
    historyIndex = history.length - 1;
    syncHistory();
  }
  function resetHistory() {
    history = source ? [state()] : [];
    historyIndex = history.length - 1;
    syncHistory();
  }
  function applyState(snapshot) {
    turn = Number(snapshot.turn) || 0;
    flip = Boolean(snapshot.flip);
    for (const key of stateFields) {
      if (snapshot[key] != null) $('photo-' + key).value = snapshot[key];
    }
    $('photo-preset').value = 'custom';
    $('preset-description').textContent = 'Custom settings. Use the dimensions and size limit shown on your form.';
    $('preset-source').hidden = true;
    $('delete-preset').hidden = true;
    syncQuality();
    transform();
    render();
    syncHistory();
  }
  function undo() {
    if (historyIndex <= 0) return;
    historyIndex -= 1;
    applyState(history[historyIndex]);
  }
  function redo() {
    if (historyIndex >= history.length - 1) return;
    historyIndex += 1;
    applyState(history[historyIndex]);
  }

  function resetView() {
    turn = 0;
    flip = false;
    comparing = false;
    $('photo-compare').setAttribute('aria-pressed', 'false');
    $('photo-compare').classList.remove('active');
    $('photo-compare-badge').hidden = true;
    for (const [key, value] of Object.entries({ zoom: 100, x: 50, y: 50, brightness: 100, contrast: 100, saturation: 100, warmth: 0 })) $('photo-' + key).value = value;
    $('photo-bg').value = '#ffffff';
    transform();
  }

  function transform() {
    if (!source) return;
    const swap = turn % 2;
    transformed = document.createElement('canvas');
    transformed.width = swap ? source.height : source.width;
    transformed.height = swap ? source.width : source.height;
    const context = transformed.getContext('2d');
    context.translate(transformed.width / 2, transformed.height / 2);
    context.rotate(turn * Math.PI / 2);
    context.scale(flip ? -1 : 1, 1);
    context.drawImage(source, -source.width / 2, -source.height / 2);
  }

  function paint(target, w, h, plain = false) {
    const context = target.getContext('2d');
    const rect = core.crop(transformed.width, transformed.height, w, h, Number($('photo-zoom').value) / 100, Number($('photo-x').value) / 100, Number($('photo-y').value) / 100);
    const brightness = Number($('photo-brightness').value);
    const contrast = Number($('photo-contrast').value);
    const saturation = Number($('photo-saturation').value);
    const warmth = Number($('photo-warmth').value);
    context.clearRect(0, 0, w, h);
    context.fillStyle = $('photo-bg').value;
    context.fillRect(0, 0, w, h);
    context.save();
    const usesFilters = 'filter' in context;
    if (!plain && usesFilters) context.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(transformed, rect.x, rect.y, rect.width, rect.height, 0, 0, w, h);
    context.restore();
    if (!plain && !usesFilters) {
      const pixels = context.getImageData(0, 0, w, h);
      const b = brightness / 100;
      const c = contrast / 100;
      const s = saturation / 100;
      const warm = warmth / 100;
      for (let i = 0; i < pixels.data.length; i += 4) {
        let r = (pixels.data[i] * b - 127.5) * c + 127.5;
        let g = (pixels.data[i + 1] * b - 127.5) * c + 127.5;
        let bl = (pixels.data[i + 2] * b - 127.5) * c + 127.5;
        const luma = 0.2126 * r + 0.7152 * g + 0.0722 * bl;
        r = luma + (r - luma) * s + warm * 38;
        g = luma + (g - luma) * s + warm * 8;
        bl = luma + (bl - luma) * s - warm * 34;
        pixels.data[i] = Math.max(0, Math.min(255, r));
        pixels.data[i + 1] = Math.max(0, Math.min(255, g));
        pixels.data[i + 2] = Math.max(0, Math.min(255, bl));
      }
      context.putImageData(pixels, 0, 0);
    }
    if (!plain && usesFilters && warmth) {
      context.save();
      context.globalCompositeOperation = 'soft-light';
      context.globalAlpha = Math.min(0.5, Math.abs(warmth) / 100);
      context.fillStyle = warmth > 0 ? '#ff9648' : '#6da8ff';
      context.fillRect(0, 0, w, h);
      context.restore();
    }
    return rect;
  }

  function drawGrid(w, h) {
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(49,87,223,.6)';
    ctx.shadowColor = 'rgba(255,255,255,.9)';
    ctx.shadowBlur = 2;
    for (const part of [1 / 3, 2 / 3]) {
      const x = Math.round(w * part) + 0.5;
      const y = Math.round(h * part) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function syncLooks() {
    const current = {
      brightness: Number($('photo-brightness').value),
      contrast: Number($('photo-contrast').value),
      saturation: Number($('photo-saturation').value),
      warmth: Number($('photo-warmth').value),
    };
    document.querySelectorAll('.photo-look').forEach((button) => {
      const look = looks.find((item) => item.id === button.dataset.look);
      const active = Boolean(look) && ['brightness', 'contrast', 'saturation', 'warmth'].every((key) => current[key] === look[key]);
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function cancelEstimate() {
    estimateToken += 1;
    window.clearTimeout(estimateTimer);
  }

  function scheduleEstimate() {
    cancelEstimate();
    const token = estimateToken;
    if (!source || busy) return;
    $('output-bytes').textContent = 'Estimating…';
    $('output-bytes').classList.remove('over');
    estimateTimer = window.setTimeout(async () => {
      if (!source || busy || token !== estimateToken) return;
      try {
        const v = values();
        if (v.width * v.height > 10_000_000) {
          $('output-bytes').textContent = 'Download to check';
          return;
        }
        const output = document.createElement('canvas');
        output.width = v.width;
        output.height = v.height;
        paint(output, v.width, v.height);
        const blob = await core.encode(output, { ...v, kb: 0 });
        if (!source || token !== estimateToken) return;
        const over = Boolean(v.kb) && blob.size > v.kb * 1000;
        const cell = $('output-bytes');
        cell.textContent = `${(blob.size / 1000).toFixed(1)} KB · ${v.format === 'image/png' ? 'PNG' : v.quality + '% quality'}${v.kb ? ` · limit ${v.kb} KB` : ''}`;
        cell.classList.toggle('over', over);
      } catch {
        if (token === estimateToken) $('output-bytes').textContent = 'Generate to check';
      }
    }, 650);
  }

  function render(estimate = true) {
    if (!source) return;
    message('');
    try {
      const v = values();
      const scale = Math.min(640 / v.width, 640 / v.height, 1);
      canvas.width = Math.max(1, Math.round(v.width * scale));
      canvas.height = Math.max(1, Math.round(v.height * scale));
      paint(canvas, canvas.width, canvas.height, comparing);
      if (grid && !comparing) drawGrid(canvas.width, canvas.height);
      $('output-dimensions').textContent = `${v.width} × ${v.height} px`;
      $('output-print').textContent = `${(v.width / v.dpi * 25.4).toFixed(1)} × ${(v.height / v.dpi * 25.4).toFixed(1)} mm`;
      const rect = core.crop(transformed.width, transformed.height, v.width, v.height, Number($('photo-zoom').value) / 100, Number($('photo-x').value) / 100, Number($('photo-y').value) / 100);
      $('photo-warning').textContent = v.width > rect.width || v.height > rect.height ? 'This enlarges the original crop. Use a higher-resolution photo for sharper results.' : '';
      ['zoom', 'brightness', 'contrast', 'saturation'].forEach((key) => { $(key + '-value').textContent = $('photo-' + key).value + '%'; });
      const warmth = Number($('photo-warmth').value);
      $('warmth-value').textContent = warmth > 0 ? '+' + warmth : String(warmth);
      $('quality-value').textContent = quality() + '%';
      syncLooks();
      if (estimate) scheduleEstimate();
    } catch (error) {
      $('output-dimensions').textContent = 'Check dimensions';
      $('photo-warning').textContent = error.message;
    }
  }

  function preset() {
    const key = $('photo-preset').value;
    const selected = presets[key] || saved.find((item) => item.id === key);
    if (selected) {
      for (const field of presetFields) {
        if (selected[field] != null) $('photo-' + field).value = selected[field];
      }
    } else if (key === 'original' && source) {
      $('photo-width').value = source.width;
      $('photo-height').value = source.height;
      $('photo-dpi').value = 300;
      $('photo-kb').value = '';
    }
    $('photo-ratio').value = 'free';
    $('preset-description').textContent = selected?.note || 'Set dimensions, DPI and file size to match your form. A saved preset is stored only in this browser.';
    const officialSource = presets[key]?.source;
    $('preset-source').hidden = !officialSource;
    if (officialSource) $('preset-source').href = officialSource;
    $('delete-preset').hidden = !saved.some((item) => item.id === key);
    syncQuality();
    render();
  }

  function custom() {
    if ($('photo-preset').value !== 'custom') {
      $('photo-preset').value = 'custom';
      $('preset-description').textContent = 'Custom settings. Use the dimensions and size limit shown on your form.';
      $('preset-source').hidden = true;
      $('delete-preset').hidden = true;
    }
    render();
  }

  function applyRatio(sourceField) {
    const ratio = ratioMap[$('photo-ratio').value];
    if (!ratio) return;
    let width = Number($('photo-width').value);
    let height = Number($('photo-height').value);
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) return;
    if (sourceField === 'height') width = Math.round(height * ratio);
    else height = Math.round(width / ratio);
    if (height < 16) { height = 16; width = Math.round(height * ratio); }
    if (height > 4096) { height = 4096; width = Math.round(height * ratio); }
    if (width < 16) { width = 16; height = Math.round(width / ratio); }
    if (width > 4096) { width = 4096; height = Math.round(width / ratio); }
    $('photo-width').value = Math.max(16, Math.min(4096, width));
    $('photo-height').value = Math.max(16, Math.min(4096, height));
  }

  function applyLook(id) {
    const look = looks.find((item) => item.id === id);
    if (!look || !source) return;
    $('photo-brightness').value = look.brightness;
    $('photo-contrast').value = look.contrast;
    $('photo-saturation').value = look.saturation;
    $('photo-warmth').value = look.warmth;
    render();
    pushHistory();
    message(`${look.name} look applied.`);
  }

  function autoEnhance() {
    if (!source || busy) return;
    try {
      const probe = document.createElement('canvas');
      const scale = Math.min(1, 128 / Math.max(transformed.width, transformed.height));
      probe.width = Math.max(1, Math.round(transformed.width * scale));
      probe.height = Math.max(1, Math.round(transformed.height * scale));
      const context = probe.getContext('2d', { willReadFrequently: true });
      context.drawImage(transformed, 0, 0, probe.width, probe.height);
      const data = context.getImageData(0, 0, probe.width, probe.height).data;
      const histogram = new Uint32Array(256);
      const count = data.length / 4;
      let sum = 0;
      let chroma = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const luma = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
        histogram[luma] += 1;
        sum += luma;
        chroma += (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
      }
      const mean = sum / count;
      let total = 0;
      let low = 0;
      let high = 255;
      for (let i = 0; i < 256; i += 1) {
        total += histogram[i];
        if (total >= count * 0.02) { low = i; break; }
      }
      total = 0;
      for (let i = 255; i >= 0; i -= 1) {
        total += histogram[i];
        if (total >= count * 0.02) { high = i; break; }
      }
      const range = Math.max(24, high - low);
      const brightness = Math.round(Math.max(92, Math.min(114, 100 + (128 - mean) * 0.45)));
      const contrast = Math.round(Math.max(100, Math.min(124, 100 + (130 - range) * 0.35)));
      const saturation = Math.round(Math.max(94, Math.min(122, 100 + (0.24 - chroma / count) * 110)));
      $('photo-brightness').value = brightness;
      $('photo-contrast').value = contrast;
      $('photo-saturation').value = saturation;
      render();
      pushHistory();
      message('Auto enhance applied. Use Undo to go back.');
    } catch {
      message('Auto enhance is unavailable for this image.', true);
    }
  }

  async function load(file) {
    if (!file || busy) return;
    const version = ++loadVersion;
    try {
      if (file.size > 16 * 1024 * 1024) throw new Error('Choose an image smaller than 16 MB.');
      if (!['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/gif'].includes(file.type)) throw new Error('Choose a JPG, PNG, WebP, BMP or GIF. Export HEIC/TIFF as JPG first.');
      message('Opening your photo on this device…');
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('This file could not be read.'));
        reader.readAsDataURL(file);
      });
      const img = new Image();
      img.src = data;
      await img.decode();
      if (version !== loadVersion) return;
      if (img.naturalWidth * img.naturalHeight > 40_000_000) throw new Error('Choose an image under 40 megapixels to keep editing responsive.');
      if (img.naturalWidth < 16 || img.naturalHeight < 16) throw new Error('Choose an image at least 16 × 16 pixels.');
      const factor = Math.min(1, 4096 / Math.max(img.naturalWidth, img.naturalHeight));
      source = document.createElement('canvas');
      source.width = Math.round(img.naturalWidth * factor);
      source.height = Math.round(img.naturalHeight * factor);
      source.getContext('2d').drawImage(img, 0, 0, source.width, source.height);
      filename = (file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 60) || 'photo');
      $('photo-editor').hidden = false;
      $('photo-mobile-nav').hidden = false;
      $('photo-upload').hidden = true;
      resetView();
      preset();
      resetHistory();
      message(`Photo ready · ${img.naturalWidth} × ${img.naturalHeight} px.${factor < 1 ? ' Editing copy scaled to a maximum of 4096 px.' : ''}`);
    } catch (error) {
      if (version === loadVersion) message(error instanceof DOMException ? 'This image could not be decoded. Try exporting it as JPG.' : error.message, true);
    } finally {
      $('photo-file').value = '';
      $('photo-camera').value = '';
    }
  }

  function download(blob, name) {
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  async function exportPhoto(enforceLimit) {
    const v = values();
    const output = document.createElement('canvas');
    output.width = v.width;
    output.height = v.height;
    paint(output, v.width, v.height);
    const blob = await core.encode(output, { ...v, kb: enforceLimit ? v.kb : 0 });
    if (enforceLimit) {
      const cell = $('output-bytes');
      const size = (blob.size / 1000).toFixed(2);
      cell.textContent = v.format === 'image/png' ? `${size} KB · PNG · ${v.dpi} DPI` : `${size} KB · ${v.dpi} DPI${v.kb ? ` · under ${v.kb} KB` : ` · ${v.quality}% quality`}`;
      cell.classList.remove('over');
    }
    return { v, output, blob };
  }

  async function action(kind) {
    if (!source || busy) return;
    busy = true;
    cancelEstimate();
    allButtonsDisabled(true);
    message('Preparing your image on this device…');
    try {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const { v, output, blob } = await exportPhoto(kind === 'photo');
      if (kind === 'photo') {
        const extension = v.format === 'image/png' ? 'png' : 'jpg';
        download(blob, `${filename}-${v.width}x${v.height}.${extension}`);
        message(`Photo ready · ${(blob.size / 1000).toFixed(2)} KB · ${v.dpi} DPI. Download started.`);
      } else {
        const layout = core.sheetLayout(v, $('photo-sheet').value);
        const sheet = document.createElement('canvas');
        sheet.width = layout.width;
        sheet.height = layout.height;
        const context = sheet.getContext('2d');
        context.fillStyle = '#fff';
        context.fillRect(0, 0, sheet.width, sheet.height);
        for (const pos of layout.positions) {
          context.drawImage(output, pos.x, pos.y, layout.pw, layout.ph);
          context.strokeStyle = '#d9d9d9';
          context.lineWidth = 1;
          context.strokeRect(pos.x - 0.5, pos.y - 0.5, layout.pw + 1, layout.ph + 1);
        }
        const sheetBlob = await core.encode(sheet, { format: 'image/jpeg', dpi: 300, kb: 0 });
        if (kind === 'sheet') {
          download(sheetBlob, `${filename}-${$('photo-sheet').value}-print-sheet.jpg`);
        } else {
          const img = new Image();
          const url = URL.createObjectURL(sheetBlob);
          img.src = url;
          await img.decode();
          img.style.width = layout.width / 300 + 'in';
          img.style.height = layout.height / 300 + 'in';
          const area = $('photo-print-area');
          area.replaceChildren(img);
          area.setAttribute('aria-hidden', 'false');
          document.body.classList.add('photo-printing');
          let style = $('photo-print-style');
          if (!style) {
            style = document.createElement('style');
            style.id = 'photo-print-style';
            document.head.append(style);
          }
          style.textContent = `@page {size: ${layout.width / 300}in ${layout.height / 300}in; margin:0;}`;
          const cleanup = () => {
            document.body.classList.remove('photo-printing');
            area.replaceChildren();
            area.setAttribute('aria-hidden', 'true');
            URL.revokeObjectURL(url);
          };
          window.addEventListener('afterprint', cleanup, { once: true });
          try {
            window.print();
          } catch (error) {
            cleanup();
            throw error;
          }
        }
        message(`${layout.positions.length} copies arranged on a ${$('photo-sheet').value === 'a4' ? 'A4' : '4 × 6 inch'} sheet at 300 DPI. Print at actual size.`);
      }
    } catch (error) {
      message(error.message || 'The image could not be exported. Try smaller dimensions.', true);
    } finally {
      busy = false;
      allButtonsDisabled(false);
      syncHistory();
    }
  }

  $('choose-photo').onclick = () => $('photo-file').click();
  $('change-photo').onclick = () => $('photo-file').click();
  $('camera-photo').onclick = () => $('photo-camera').click();
  $('photo-file').onchange = (event) => load(event.target.files[0]);
  $('photo-camera').onchange = (event) => load(event.target.files[0]);
  ['dragenter', 'dragover'].forEach((type) => $('photo-upload').addEventListener(type, (event) => {
    event.preventDefault();
    $('photo-upload').classList.add('dragging');
  }));
  ['dragleave', 'drop'].forEach((type) => $('photo-upload').addEventListener(type, (event) => {
    event.preventDefault();
    $('photo-upload').classList.remove('dragging');
    if (type === 'drop') load(event.dataTransfer.files[0]);
  }));
  window.addEventListener('dragover', (event) => event.preventDefault());
  window.addEventListener('drop', (event) => event.preventDefault());

  $('clear-photo').onclick = () => {
    loadVersion += 1;
    cancelEstimate();
    source = null;
    transformed = null;
    canvas.width = canvas.height = 1;
    history = [];
    historyIndex = -1;
    syncHistory();
    comparing = false;
    $('photo-compare').setAttribute('aria-pressed', 'false');
    $('photo-compare').classList.remove('active');
    $('photo-compare-badge').hidden = true;
    $('photo-editor').hidden = true;
    $('photo-mobile-nav').hidden = true;
    $('photo-upload').hidden = false;
    message('Photo cleared from the editor.');
  };

  $('rotate-left').onclick = () => { turn = (turn + 3) % 4; transform(); render(); pushHistory(); };
  $('rotate-right').onclick = () => { turn = (turn + 1) % 4; transform(); render(); pushHistory(); };
  $('flip-photo').onclick = () => { flip = !flip; transform(); render(); pushHistory(); };
  $('reset-photo').onclick = () => { resetView(); render(); pushHistory(); };
  $('photo-undo').onclick = undo;
  $('photo-redo').onclick = redo;
  $('photo-compare').onclick = () => {
    if (!source || busy) return;
    comparing = !comparing;
    $('photo-compare').setAttribute('aria-pressed', comparing ? 'true' : 'false');
    $('photo-compare').classList.toggle('active', comparing);
    $('photo-compare-badge').hidden = !comparing;
    render(false);
  };
  $('photo-grid').onclick = () => {
    if (!source || busy) return;
    grid = !grid;
    $('photo-grid').setAttribute('aria-pressed', grid ? 'true' : 'false');
    $('photo-grid').classList.toggle('active', grid);
    render(false);
  };
  $('photo-auto').onclick = autoEnhance;

  document.querySelectorAll('.photo-look').forEach((button) => {
    button.addEventListener('click', () => applyLook(button.dataset.look));
  });

  for (const id of ['zoom', 'x', 'y', 'brightness', 'contrast', 'saturation', 'warmth', 'bg']) {
    $('photo-' + id).addEventListener('input', () => render());
    $('photo-' + id).addEventListener('change', pushHistory);
  }
  for (const field of sizeFields) {
    $('photo-' + field).addEventListener('input', () => {
      if (field === 'width' || field === 'height') applyRatio(field);
      custom();
    });
    $('photo-' + field).addEventListener('change', pushHistory);
  }
  $('photo-format').addEventListener('input', syncQuality);
  $('photo-ratio').addEventListener('change', () => { applyRatio('width'); custom(); pushHistory(); });
  $('photo-quality').addEventListener('input', () => { syncQuality(); render(); });
  $('photo-quality').addEventListener('change', pushHistory);
  $('photo-preset').addEventListener('change', () => { preset(); pushHistory(); });

  canvas.addEventListener('pointerdown', (event) => {
    if (!source || busy) return;
    canvas.setPointerCapture(event.pointerId);
    drag = { x: event.clientX, y: event.clientY, px: Number($('photo-x').value), py: Number($('photo-y').value), moved: false };
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!drag) return;
    let v;
    try { v = values(); } catch { return; }
    const box = canvas.getBoundingClientRect();
    const rect = core.crop(transformed.width, transformed.height, v.width, v.height, Number($('photo-zoom').value) / 100, 0, 0);
    const dx = transformed.width - rect.width;
    const dy = transformed.height - rect.height;
    $('photo-x').value = Math.max(0, Math.min(100, drag.px - (event.clientX - drag.x) / box.width * rect.width / (dx || 1) * 100));
    $('photo-y').value = Math.max(0, Math.min(100, drag.py - (event.clientY - drag.y) / box.height * rect.height / (dy || 1) * 100));
    drag.moved = true;
    render();
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) => canvas.addEventListener(type, () => {
    if (drag?.moved) pushHistory();
    drag = null;
  }));
  canvas.addEventListener('keydown', (event) => {
    const key = { ArrowLeft: ['x', -2], ArrowRight: ['x', 2], ArrowUp: ['y', -2], ArrowDown: ['y', 2] }[event.key];
    if (!key) return;
    event.preventDefault();
    const input = $('photo-' + key[0]);
    input.value = Number(input.value) + key[1];
    render();
    pushHistory();
  });

  document.addEventListener('keydown', (event) => {
    const modifier = event.metaKey || event.ctrlKey;
    if (!modifier) return;
    const key = event.key.toLowerCase();
    if (key !== 'z' && key !== 'y') return;
    const target = event.target;
    if (target && (target.matches?.('input, select, textarea') || target.isContentEditable)) return;
    event.preventDefault();
    if (key === 'y' || (key === 'z' && event.shiftKey)) redo();
    else undo();
  });

  $('save-preset').onclick = () => {
    try {
      values();
      if (saved.length >= 20) throw new Error('You have 20 saved presets. Remove one before adding another.');
      $('preset-name').value = '';
      $('preset-dialog').showModal();
      $('preset-name').focus();
    } catch (error) {
      message(error.message, true);
    }
  };
  $('cancel-preset').onclick = () => $('preset-dialog').close();
  $('preset-form').onsubmit = (event) => {
    event.preventDefault();
    try {
      const name = $('preset-name').value.trim();
      if (!name) throw new Error('Give this preset a name.');
      const next = [...saved, { ...values(), name, id: 'saved-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7) }];
      localStorage.setItem(savedKey, JSON.stringify(next));
      saved = next;
      savedOptions();
      $('photo-preset').value = next[next.length - 1].id;
      preset();
      $('preset-dialog').close();
      message('Preset saved in this browser. Your photo was not saved.');
    } catch (error) {
      $('preset-dialog').close();
      message('Could not save preset. ' + error.message, true);
    }
  };
  $('delete-preset').onclick = () => {
    try {
      const next = saved.filter((item) => item.id !== $('photo-preset').value);
      localStorage.setItem(savedKey, JSON.stringify(next));
      saved = next;
      savedOptions();
      $('photo-preset').value = 'custom';
      preset();
      message('Saved preset removed.');
    } catch {
      message('Browser storage is unavailable.', true);
    }
  };

  $('download-photo').onclick = () => action('photo');
  $('download-sheet').onclick = () => action('sheet');
  $('print-sheet').onclick = () => action('print');

  syncQuality();
  syncHistory();
})();
