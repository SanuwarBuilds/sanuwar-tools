"use strict";
(() => {
  const { canvasFor, releaseCanvas } = window.SANU_TOOLS.localFiles;
  const fullPage = () => [[0, 0], [1, 0], [1, 1], [0, 1]];
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const mix = (a, b, t) => a + (b - a) * t;
  const luma = (pixels, i) => .213 * pixels[i] + .715 * pixels[i + 1] + .072 * pixels[i + 2];
  const turn = ([ax, ay], [bx, by], [cx, cy]) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const distance = ([ax, ay], [bx, by]) => Math.hypot(ax - bx, ay - by);

  function validCorners(points) {
    return points.every((point, i) =>
      distance(point, points[(i + 1) % 4]) >= .04 &&
      turn(point, points[(i + 1) % 4], points[(i + 2) % 4]) > .002);
  }

  function sample(source, edge) {
    const scale = Math.min(1, edge / Math.max(source.width, source.height));
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));
    const canvas = canvasFor(width, height);
    try {
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(source, 0, 0, width, height);
      return context.getImageData(0, 0, width, height);
    } finally { releaseCanvas(canvas); }
  }

  function hullOf(points) {
    points.sort(([ax, ay], [bx, by]) => ax - bx || ay - by);
    const chain = (ordered) => {
      const hull = [];
      for (const point of ordered) {
        while (hull.length >= 2 && turn(hull[hull.length - 2], hull[hull.length - 1], point) <= 0) hull.pop();
        hull.push(point);
      }
      hull.pop();
      return hull;
    };
    return chain(points).concat(chain(points.reverse()));
  }

  function quadrilateral(points) {
    const hull = hullOf(points);
    if (hull.length < 4) return null;
    while (hull.length > 4) {
      let smallest = Infinity;
      let corner = 0;
      for (let i = 0; i < hull.length; i++) {
        const area = turn(hull[(i + hull.length - 1) % hull.length], hull[i], hull[(i + 1) % hull.length]);
        if (area < smallest) { smallest = area; corner = i; }
      }
      hull.splice(corner, 1);
    }
    const topLeft = hull.reduce((best, point, i) => point[0] + point[1] < hull[best][0] + hull[best][1] ? i : best, 0);
    return hull.slice(topLeft).concat(hull.slice(0, topLeft));
  }

  function detectCorners(source) {
    const { data, width, height } = sample(source, 420);
    const size = width * height;
    if (Math.min(width, height) < 40) return null;
    const gray = new Uint8Array(size);
    const histogram = new Uint32Array(256);
    let sum = 0;
    for (let i = 0; i < size; i++) {
      const value = Math.round(luma(data, i * 4));
      gray[i] = value;
      histogram[value]++;
      sum += value;
    }
    // Otsu separates paper from the background. Nearby thresholds recover
    // pages where shadows or glare break the first segmentation.
    let split = 0;
    let maximum = 0;
    let lowCount = 0;
    let lowSum = 0;
    for (let i = 0; i < 255; i++) {
      lowCount += histogram[i];
      lowSum += i * histogram[i];
      if (!lowCount || lowCount === size) continue;
      const variance = (sum * lowCount - lowSum * size) ** 2 / (lowCount * (size - lowCount));
      if (variance > maximum) { maximum = variance; split = i; }
    }
    if (!maximum) return null;

    const queue = new Int32Array(size);
    const mask = new Uint8Array(size);
    const left = new Int16Array(height);
    const right = new Int16Array(height);
    let best = null;
    let bestScore = 0;
    const get = (x, y) => gray[Math.round(y) * width + Math.round(x)];
    const inset = Math.max(3, Math.round(Math.min(width, height) * .018));

    function edgeSupport(corners, polarity) {
      const support = corners.map(([ax, ay], i) => {
        const [bx, by] = corners[(i + 1) % 4];
        const length = Math.hypot(bx - ax, by - ay);
        const nx = (ay - by) * inset / length;
        const ny = (bx - ax) * inset / length;
        let count = 0;
        for (let j = 1; j <= 9; j++) {
          const x = mix(ax, bx, j / 10);
          const y = mix(ay, by, j / 10);
          if (x - Math.abs(nx) < 0 || x + Math.abs(nx) >= width - 1 ||
              y - Math.abs(ny) < 0 || y + Math.abs(ny) >= height - 1) continue;
          if ((get(x + nx, y + ny) - get(x - nx, y - ny)) * polarity >= 13) count++;
        }
        return count;
      });
      return support.filter((count) => count >= 4).length >= 3 ? support.reduce((total, n) => total + n, 0) : 0;
    }

    for (const threshold of new Set([split, split - 22, split + 26, 185, 218, 232].map((n) => clamp(n, 10, 245)))) {
      for (const polarity of [1, -1]) {
        for (let i = 0; i < size; i++) mask[i] = Number((gray[i] > threshold) === (polarity === 1));
        for (let seed = 0; seed < size; seed++) {
          if (!mask[seed]) continue;
          mask[seed] = 0;
          queue[0] = seed;
          let tail = 1;
          for (let head = 0; head < tail; head++) {
            const i = queue[head];
            const x = i % width;
            if (x && mask[i - 1]) { mask[i - 1] = 0; queue[tail++] = i - 1; }
            if (x < width - 1 && mask[i + 1]) { mask[i + 1] = 0; queue[tail++] = i + 1; }
            if (mask[i - width]) { mask[i - width] = 0; queue[tail++] = i - width; }
            if (mask[i + width]) { mask[i + width] = 0; queue[tail++] = i + width; }
          }
          if (tail < size * .15 || tail > size * .94) continue;
          left.fill(width);
          right.fill(-1);
          for (let i = 0; i < tail; i++) {
            const x = queue[i] % width;
            const y = Math.floor(queue[i] / width);
            left[y] = Math.min(left[y], x);
            right[y] = Math.max(right[y], x);
          }
          const boundary = [];
          for (let y = 0; y < height; y++) {
            if (right[y] >= 0) boundary.push([left[y], y], [right[y], y]);
          }
          const corners = quadrilateral(boundary);
          if (!corners) continue;
          const area = (turn(corners[0], corners[1], corners[2]) + turn(corners[0], corners[2], corners[3])) / 2;
          const normalized = corners.map(([x, y]) => [x / (width - 1), y / (height - 1)]);
          if (area < size * .2 || area > size * .95 || tail / area < .68 || !validCorners(normalized)) continue;
          const score = edgeSupport(corners, polarity) * Math.sqrt(area / size) * (polarity === 1 ? 1 : .85);
          if (score > bestScore) { best = normalized; bestScore = score; }
        }
      }
    }
    return best;
  }

  function flatten(source, corners, limit) {
    const [a, b, c, d] = corners.map(([x, y]) => [x * (source.width - 1), y * (source.height - 1)]);
    const w = Math.max(distance(a, b), distance(d, c)) + 1;
    const h = Math.max(distance(a, d), distance(b, c)) + 1;
    const scale = Math.min(1, limit / Math.max(w, h));
    const width = Math.max(1, Math.round(w * scale));
    const height = Math.max(1, Math.round(h * scale));
    const target = canvasFor(width, height);
    const context = target.getContext("2d", { willReadFrequently: true });
    const bounds = fullPage();
    if (corners.every(([x, y], i) => x === bounds[i][0] && y === bounds[i][1])) {
      context.drawImage(source, 0, 0, width, height);
      return target;
    }

    // Homography from a unit rectangle to the document quadrilateral.
    const x1 = b[0] - c[0], x2 = d[0] - c[0], dx = a[0] - b[0] + c[0] - d[0];
    const y1 = b[1] - c[1], y2 = d[1] - c[1], dy = a[1] - b[1] + c[1] - d[1];
    const determinant = x1 * y2 - x2 * y1;
    const g = (dx * y2 - x2 * dy) / determinant;
    const h2 = (x1 * dy - dx * y1) / determinant;
    const ax = b[0] - a[0] + g * b[0], bx = d[0] - a[0] + h2 * d[0];
    const ay = b[1] - a[1] + g * b[1], by = d[1] - a[1] + h2 * d[1];
    const pixels = source.getContext("2d").getImageData(0, 0, source.width, source.height).data;
    const frame = context.createImageData(width, height);
    const uStep = 1 / Math.max(1, width - 1);
    for (let y = 0; y < height; y++) {
      const v = y / Math.max(1, height - 1);
      let divisor = 1 + h2 * v;
      let sx = bx * v + a[0];
      let sy = by * v + a[1];
      for (let x = 0; x < width; x++) {
        const px = clamp(sx / divisor, 0, source.width - 1);
        const py = clamp(sy / divisor, 0, source.height - 1);
        const ix = Math.floor(px), iy = Math.floor(py);
        const tx = px - ix, ty = py - iy;
        const p = (iy * source.width + ix) * 4;
        const q = p + (ix < source.width - 1 ? 4 : 0);
        const row = iy < source.height - 1 ? source.width * 4 : 0;
        const i = (y * width + x) * 4;
        for (let ch = 0; ch < 3; ch++) {
          frame.data[i + ch] = mix(mix(pixels[p + ch], pixels[q + ch], tx),
            mix(pixels[p + row + ch], pixels[q + row + ch], tx), ty);
        }
        frame.data[i + 3] = 255;
        divisor += g * uStep;
        sx += ax * uStep;
        sy += ay * uStep;
      }
    }
    context.putImageData(frame, 0, 0);
    return target;
  }

  function enhance(canvas, mode) {
    if (mode === "original") return;
    const { width, height } = canvas;
    const reference = sample(canvas, 260);
    const cols = Math.max(1, Math.round(reference.width / 20));
    const rows = Math.max(1, Math.round(reference.height / 20));
    const background = new Float32Array(cols * rows);
    const histogram = new Uint32Array(256);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        histogram.fill(0);
        let count = 0;
        // Overlap the neighborhoods so that shadows change smoothly across tiles.
        const left = Math.max(0, Math.floor((x - .45) * reference.width / cols));
        const right = Math.min(reference.width, Math.ceil((x + 1.45) * reference.width / cols));
        const top = Math.max(0, Math.floor((y - .45) * reference.height / rows));
        const bottom = Math.min(reference.height, Math.ceil((y + 1.45) * reference.height / rows));
        for (let sy = top; sy < bottom; sy++) {
          for (let sx = left; sx < right; sx++) {
            histogram[Math.round(luma(reference.data, (sy * reference.width + sx) * 4))]++;
            count++;
          }
        }
        let level = 255;
        let bright = 0;
        while (level > 0 && (bright += histogram[level]) < count * .14) level--;
        background[y * cols + x] = Math.max(98, level);
      }
    }

    const context = canvas.getContext("2d");
    const frame = context.getImageData(0, 0, width, height);
    const pixels = frame.data;
    const columns = Array.from({ length: width }, (_, x) => clamp((x + .5) * cols / width - .5, 0, cols - 1));
    for (let y = 0; y < height; y++) {
      const gy = clamp((y + .5) * rows / height - .5, 0, rows - 1);
      const y0 = Math.floor(gy), y1 = Math.min(rows - 1, y0 + 1);
      for (let x = 0; x < width; x++) {
        const gx = columns[x];
        const x0 = Math.floor(gx), x1 = Math.min(cols - 1, x0 + 1);
        const top = mix(background[y0 * cols + x0], background[y0 * cols + x1], gx - x0);
        const bottom = mix(background[y1 * cols + x0], background[y1 * cols + x1], gx - x0);
        const white = mix(top, bottom, gy - y0);
        const i = (y * width + x) * 4;
        const value = luma(pixels, i);
        const normalized = clamp((value / white - .10) / .87, 0, 1) * 255;
        if (mode === "color") {
          const saturation = Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) - Math.min(pixels[i], pixels[i + 1], pixels[i + 2]);
          const gain = mix(1, normalized / Math.max(1, value), 1 - Math.min(.82, saturation / 150));
          const neutral = clamp((normalized - 205) / 45, 0, 1) * clamp((42 - saturation) / 30, 0, 1);
          pixels[i] = mix(pixels[i] * gain, normalized, neutral);
          pixels[i + 1] = mix(pixels[i + 1] * gain, normalized, neutral);
          pixels[i + 2] = mix(pixels[i + 2] * gain, normalized, neutral);
        } else {
          const level = mode === "bw" ? (normalized >= 165 ? 255 : 0) : normalized;
          pixels[i] = pixels[i + 1] = pixels[i + 2] = level;
        }
      }
    }
    context.putImageData(frame, 0, 0);
  }

  function draw(page, target, limit) {
    const flattened = flatten(page.image, page.corners, limit);
    try {
      enhance(flattened, page.mode);
      const sideways = page.rotation % 180 !== 0;
      target.width = sideways ? flattened.height : flattened.width;
      target.height = sideways ? flattened.width : flattened.height;
      const context = target.getContext("2d");
      context.translate(target.width / 2, target.height / 2);
      context.rotate(page.rotation * Math.PI / 180);
      context.drawImage(flattened, -flattened.width / 2, -flattened.height / 2);
    } finally { releaseCanvas(flattened); }
  }

  window.SANU_TOOLS.smartScan = { fullPage, detectCorners, validCorners, draw };
})();
