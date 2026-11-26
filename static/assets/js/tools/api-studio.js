"use strict";
(() => {
  const T = window.SANU_TOOLS;
  const { el } = T;
  const colorAPI = "https://www.thecolorapi.com";
  const scanAPI = "https://scanmalware.com/api/v1";
  const iconAPI = "https://api.iconify.design";
  const fontAPI = "https://api.fontsource.org/v1";
  const traceAPI = "https://api.trace.moe/search";
  const hexPattern = /^#[\da-f]{6}$/i;

  const endpoint = (base, params) => base + "?" + new URLSearchParams(params);
  function publicHttps(value) {
    if (typeof value !== "string" || value.length > 2048 || !/^https:\/\//i.test(value) || /[\\\s]/u.test(value)) return null;
    try {
      const url = new URL(value);
      const host = url.hostname.replace(/\.$/, "");
      if (url.username || url.password || !/^[a-z\d.-]+\.[a-z][a-z\d-]*$/i.test(host) ||
          /\.(?:localhost|local|internal|test|invalid|example|onion|home|lan)$/i.test(host)) return null;
      url.hostname = host;
      return url;
    } catch {
      return null;
    }
  }

  async function request(url, options, read = "json") {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, {
        ...options, signal: controller.signal, credentials: "omit", redirect: "error", referrerPolicy: "no-referrer",
      });
      if (response.status === 429) throw new Error("The provider's request limit was reached. Try again later.");
      if (!response.ok) throw new Error("The provider could not complete this request. Try again later.");
      return await response[read]();
    } catch (error) {
      if (error.name === "AbortError") throw new Error("The provider took too long to respond. Try again.");
      if (error instanceof TypeError || error instanceof SyntaxError) {
        throw new Error("The provider is unavailable right now. Try again later.");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  const paragraph = (text) => el("p", { class: "tp-hint", text });
  const outbound = (href, label) => el("a", { class: "wb-text-link", href, target: "_blank", rel: "noopener noreferrer" }, label);
  const output = () => el("div", { class: "api-results" });
  const card = (title, ...children) => el("article", { class: "api-result" }, el("h3", {}, title), children);

  function feedback() {
    const node = el("p", { class: "api-feedback", role: "status", "aria-atomic": "true" });
    return {
      node,
      say(message, error = false) {
        node.textContent = message;
        node.classList.toggle("api-error", error);
      },
    };
  }

  function form(label, controls, result, run, help) {
    const submit = T.button(label, null, "primary", { type: "submit" });
    const status = feedback();
    const node = el("form", {}, controls, help, T.actions(submit), status.node, result);
    node.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (submit.disabled) return;
      result.replaceChildren();
      submit.disabled = true;
      status.say("Working…");
      try {
        await run(status.say);
      } catch (error) {
        status.say(error.message || "Something went wrong. Try again.", true);
      } finally {
        submit.disabled = false;
      }
    });
    return node;
  }

  function fromHsl(h, s, l) {
    const a = s * Math.min(l, 1 - l);
    const channel = (n) => {
      const k = (n + h / 30) % 12;
      return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
    };
    return [channel(0), channel(8), channel(4)];
  }

  function parseColor(input) {
    const color = input.trim().toLowerCase();
    if (/^#?(?:[\da-f]{3}|[\da-f]{6})$/.test(color)) {
      const hex = color.replace(/^#/, "");
      const expanded = hex.length === 3 ? [...hex].map(digit => digit.repeat(2)).join("") : hex;
      return expanded.match(/../g).map(part => parseInt(part, 16));
    }
    const match = /^(rgb|hsl)\(\s*([+-]?(?:\d*\.)?\d+%?)(?:\s*,\s*|\s+)([+-]?(?:\d*\.)?\d+%?)(?:\s*,\s*|\s+)([+-]?(?:\d*\.)?\d+%?)\s*\)$/.exec(color);
    if (!match) return null;
    const parts = match.slice(2);
    const nums = parts.map(parseFloat);
    if (!nums.every(Number.isFinite)) return null;
    if (match[1] === "rgb") {
      const rgb = nums.map((value, index) => parts[index].endsWith("%") ? value * 255 / 100 : value);
      return rgb.every(value => value >= 0 && value <= 255) ? rgb : null;
    }
    const [hue, saturation, lightness] = nums;
    if (parts[0].endsWith("%") || !parts.slice(1).every(part => part.endsWith("%")) ||
        [saturation, lightness].some(value => value < 0 || value > 100)) return null;
    return fromHsl((hue % 360 + 360) % 360, saturation / 100, lightness / 100);
  }

  const toHex = rgb => "#" + rgb.map(value => Math.round(value).toString(16).padStart(2, "0")).join("").toUpperCase();
  const rounded = value => Number(value.toFixed(2));
  function toHsl(rgb) {
    const [r, g, b] = rgb.map(value => value / 255);
    const high = Math.max(r, g, b), low = Math.min(r, g, b);
    const delta = high - low, lightness = (high + low) / 2;
    if (!delta) return [0, 0, lightness];
    const h = high === r ? (g - b) / delta : high === g ? 2 + (b - r) / delta : 4 + (r - g) / delta;
    const range = lightness <= 0.5 ? high + low : (1 - high) + (1 - low);
    return [(h * 60 + 360) % 360, delta / range, lightness];
  }

  function contrast(a, b) {
    const luminance = (color) => {
      const [r, g, b] = color.map(value => {
        const srgb = value / 255;
        return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }

  T.register("color-contrast-studio", (root) => {
    const fg = T.input({ value: "#155B42", maxlength: 80 });
    const bg = T.input({ value: "#FFFFFF", maxlength: 80 });
    const converted = output();
    const palette = output();
    const scheme = T.select([["Analogous", "analogic"], ["Complementary", "complement"], ["Triadic", "triad"], ["Monochromatic", "monochrome"]]);
    const colorStatus = feedback();
    const update = () => {
      const foreground = parseColor(fg.value), background = parseColor(bg.value);
      converted.replaceChildren();
      fg.setAttribute("aria-invalid", String(!foreground));
      bg.setAttribute("aria-invalid", String(!background));
      if (!foreground || !background) {
        colorStatus.say("Enter both colors as HEX, RGB or HSL. Alpha is not supported.", true);
        return;
      }
      colorStatus.say("");
      const colorValues = (label, rgb) => {
        const [h, s, l] = toHsl(rgb);
        const values = [
          ["HEX", toHex(rgb)],
          ["RGB", `rgb(${rgb.map(rounded).join(", ")})`],
          ["HSL", `hsl(${rounded(h)}, ${rounded(s * 100)}%, ${rounded(l * 100)}%)`],
        ];
        return card(label + " values", ...values.map(([format, value]) =>
          el("div", { class: "api-row" }, el("code", {}, value), T.copyButton(value, `Copy ${label.toLowerCase()} ${format}`))));
      };
      const ratio = contrast(foreground, background);
      const preview = el("p", { class: "api-color-preview" }, "Sample text");
      // Use the original RGB precision for the preview and contrast decision.
      preview.style.color = `rgb(${foreground.join(",")})`;
      preview.style.backgroundColor = `rgb(${background.join(",")})`;
      converted.replaceChildren(
        colorValues("Foreground", foreground),
        colorValues("Background", background),
        card("WCAG contrast", preview, el("strong", {}, (Math.floor(ratio * 100) / 100).toFixed(2) + ":1"),
          paragraph(`Normal text: AA ${ratio >= 4.5 ? "passes" : "fails"}, AAA ${ratio >= 7 ? "passes" : "fails"}.`),
          paragraph(`Large text: AA ${ratio >= 3 ? "passes" : "fails"}, AAA ${ratio >= 4.5 ? "passes" : "fails"}.`)),
      );
    };
    [fg, bg].forEach(input => input.addEventListener("input", update));
    root.replaceChildren(
      T.panel("Convert and compare", [T.twoCol(T.field("Foreground color", fg), T.field("Background color", bg)),
        paragraph("Use #155B42, rgb(21, 91, 66) or hsl(158, 63%, 22%)."), colorStatus.node, converted]),
      T.panel("Generate a palette", form("Generate palette", T.field("Palette scheme", scheme), palette, async (say) => {
        const seed = parseColor(fg.value);
        if (!seed) throw new Error("Enter a valid foreground color first.");
        const hex = toHex(seed);
        const data = await request(endpoint(colorAPI + "/scheme", { hex: hex.slice(1), mode: scheme.value, count: 5 }));
        const colors = (Array.isArray(data?.colors) ? data.colors : []).map(item => item?.hex?.value).filter(value => hexPattern.test(value));
        if (!colors.length) return say("No palette colors were returned for " + hex + ".");
        palette.replaceChildren(...colors.slice(0, 10).map(value => {
          const swatch = el("span", { class: "api-swatch", "aria-hidden": "true" });
          swatch.style.backgroundColor = value;
          return el("div", { class: "api-result api-row" }, swatch, el("code", {}, value), T.copyButton(value, "Copy color"));
        }));
        say("Palette generated from " + hex + ".");
      })),
    );
    update();
  });

  function pageKey(value) {
    const url = publicHttps(value);
    return url ? url.origin + url.pathname : "";
  }

  T.register("link-safety-checker", (root) => {
    const handoff = publicHttps(new URLSearchParams(location.hash.slice(1)).get("url"));
    const address = T.input({ type: "url", required: true, maxlength: 2048, placeholder: "https://example.com/page" });
    if (handoff) address.value = handoff.origin + handoff.pathname;
    const results = output();
    root.replaceChildren(T.panel(null, form("Check link", T.field("HTTPS URL", address), results, async (say) => {
      const target = publicHttps(address.value.trim());
      if (!target) throw new Error("Enter a public HTTPS URL without embedded credentials.");
      const host = target.hostname;
      const scans = await request(endpoint(scanAPI + "/domains/" + encodeURIComponent(host) + "/scans", {
        status: "completed", limit: 30,
      }));
      if (!Array.isArray(scans)) throw new Error("The provider returned an unexpected response. Try again later.");
      const targetPage = pageKey(target.href);
      const sameHost = scans.filter(row => {
        const url = publicHttps(row?.url);
        return url?.hostname === host && row.status === "completed" &&
          /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(row.scan_id);
      });
      const exact = sameHost.find(row => pageKey(row.url) === targetPage);
      const match = exact || sameHost[0];
      if (!match) return say("No recent public report found for " + host + ". This link has not been verified.");
      const date = String(match.completed_at || match.submitted_at || "").match(/^\d{4}-\d{2}-\d{2}/)?.[0];
      const details = card(exact ? "Report for this URL path" : "Report for another page on this host",
        el("p", { class: "api-address" }, pageKey(match.url)),
        date ? paragraph("Report date: " + date) : null);
      results.replaceChildren(details);
      try {
        const summary = await request(scanAPI + "/scan/" + match.scan_id + "/summary");
        const verdict = summary?.security_verdict?.verdict || summary?.security_verdict?.risk_level;
        if (typeof verdict === "string" && verdict.trim()) {
          details.append(el("p", {}, "Provider verdict: ", el("strong", {}, verdict.slice(0, 80))));
        } else {
          details.append(paragraph("This report has no published risk verdict."));
        }
        say(exact ? "Found an existing public report." : "No exact path match in recent reports. Showing host history only.");
      } catch (error) {
        say("Report found, but its verdict is unavailable. " + error.message, true);
      }
    }, paragraph("Checks existing public reports. Only the hostname is sent. An empty or low-risk result does not establish that a link is safe."))));
  });

  // Rebuild inert XML with drawing elements and same-document references only.
  function cleanIcon(source) {
    if (source.length > 150000 || /<!doctype|<!entity/i.test(source)) throw new Error("This icon cannot be exported as a safe SVG.");
    const ns = "http://www.w3.org/2000/svg";
    const svg = new DOMParser().parseFromString(source, "image/svg+xml").documentElement;
    if (svg.localName !== "svg" || svg.namespaceURI !== ns) throw new Error("The provider returned an invalid SVG.");
    const shapes = new Set(["svg", "g", "path", "circle", "ellipse", "rect", "line", "polyline", "polygon",
      "defs", "clipPath", "mask", "linearGradient", "radialGradient", "stop", "symbol", "use"]);
    const attributes = new Set(["viewBox", "width", "height", "d", "fill", "stroke", "stroke-width", "stroke-linecap",
      "stroke-linejoin", "stroke-miterlimit", "stroke-dasharray", "stroke-dashoffset", "fill-rule", "clip-rule",
      "opacity", "fill-opacity", "stroke-opacity", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r",
      "rx", "ry", "points", "transform", "id", "clip-path", "mask", "clipPathUnits", "maskUnits", "maskContentUnits",
      "gradientTransform", "gradientUnits", "offset", "stop-color", "stop-opacity", "fx", "fy", "fr"]);
    const referenceAttributes = new Set(["fill", "stroke", "clip-path", "mask"]);
    const unsafeSVG = "This icon uses SVG features that cannot be exported here.";
    const copy = (node, depth = 0) => {
      if (depth > 32 || node.namespaceURI !== ns || !shapes.has(node.localName)) throw new Error(unsafeSVG);
      const shape = document.createElementNS(ns, node.localName);
      for (const attr of node.attributes) {
        if (attr.namespaceURI === "http://www.w3.org/2000/xmlns/") continue;
        if (attr.name === "href" || attr.name === "xlink:href") {
          if (!/^#[a-z\d_.:-]+$/i.test(attr.value)) throw new Error(unsafeSVG);
          shape.setAttribute("href", attr.value);
          continue;
        }
        if (!attributes.has(attr.name)) throw new Error(unsafeSVG);
        if (referenceAttributes.has(attr.name) && /^url\(#[a-z\d_.:-]+\)$/i.test(attr.value)) {
          shape.setAttribute(attr.name, attr.value);
          continue;
        }
        if (!/^[a-z\d\s.,#%+()\-]+$/i.test(attr.value) || /url\s*\(/i.test(attr.value)) throw new Error(unsafeSVG);
        shape.setAttribute(attr.name, attr.value);
      }
      for (const child of node.children) shape.append(copy(child, depth + 1));
      return shape;
    };
    return new XMLSerializer().serializeToString(copy(svg));
  }

  function assetAction(label, status, run) {
    return T.button(label, async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      status.say("Preparing asset…");
      try {
        await run();
        status.say("");
      } catch (error) {
        status.say(error.message || "The asset could not be prepared.", true);
      } finally {
        button.disabled = false;
      }
    }, "ghost");
  }

  async function showIcons(query, results) {
    const data = await request(endpoint(iconAPI + "/search", { query, limit: 32 }));
    if (!Array.isArray(data?.icons)) throw new Error("Iconify returned an unexpected response.");
    const icons = data.icons.filter(id => typeof id === "string" && /^[a-z\d-]+:[a-z\d-]+$/.test(id)).slice(0, 24);
    results.replaceChildren(...icons.map(id => {
      const [prefix, name] = id.split(":");
      const assetURL = `${iconAPI}/${prefix}/${name}.svg`;
      const license = data.collections?.[prefix]?.license;
      const licenseURL = publicHttps(license?.url);
      const licenseLabel = license?.spdx || license?.title || "License details";
      const status = feedback();
      const svg = async () => cleanIcon(await request(assetURL, {}, "text"));
      const icon = el("img", { class: "api-icon-preview", src: assetURL, width: 32, height: 32, alt: "", loading: "lazy", referrerpolicy: "no-referrer" });
      return card(id, icon,
        licenseURL ? outbound(licenseURL.href, licenseLabel) : paragraph(license?.spdx || "See the icon collection for license terms."),
        T.actions(assetAction("Copy SVG", status, async () => T.copy(await svg())),
          assetAction("Download SVG", status, async () => T.download(prefix + "-" + name + ".svg", await svg(), "image/svg+xml"))),
        status.node);
    }));
    return icons.length;
  }

  const fontId = /^[a-z\d]+(?:-[a-z\d]+)*$/;
  let fontList;
  async function showFonts(query, results) {
    fontList ||= request(fontAPI + "/fonts").catch(error => { fontList = null; throw error; });
    const data = await fontList;
    if (!Array.isArray(data)) {
      fontList = null;
      throw new Error("Fontsource returned an unexpected response.");
    }
    const needle = query.toLowerCase().replace(/-/g, " ");
    const fonts = data.filter(font => fontId.test(font?.id) && typeof font.family === "string" &&
      (font.family.toLowerCase().includes(needle) || font.id.replace(/-/g, " ").includes(needle))).slice(0, 24);
    results.replaceChildren(...fonts.map(font => {
      const status = feedback();
      const weight = font.weights?.includes(400) ? 400 : font.weights?.[0];
      const style = font.styles?.includes("normal") ? "normal" : font.styles?.[0];
      return card(font.family, paragraph([font.category, font.license].filter(Boolean).join(" · ")),
        outbound("https://fontsource.org/fonts/" + font.id, "Font family and license"),
        T.actions(T.copyButton(font.family, "Copy family name"),
          assetAction("Download WOFF2", status, async () => {
            const meta = await request(fontAPI + "/fonts/" + font.id);
            const available = meta?.variants?.[weight]?.[style];
            const subset = available?.[meta?.defSubset] ? meta.defSubset : Object.keys(available || {})[0];
            const resource = publicHttps(available?.[subset]?.url?.woff2);
            if (!resource || resource.origin !== "https://cdn.jsdelivr.net" ||
                !resource.pathname.startsWith("/fontsource/fonts/" + font.id + "@") || !resource.pathname.endsWith(".woff2")) {
              throw new Error("A downloadable WOFF2 file is unavailable for this font.");
            }
            const bytes = await request(resource.href, {}, "arrayBuffer");
            if (bytes.byteLength < 48 || bytes.byteLength > 5000000 || new DataView(bytes).getUint32(0) !== 0x774f4632) {
              throw new Error("The file returned is not a supported WOFF2 font.");
            }
            T.download(`${font.id}-${weight}-${style}-${T.safeName(subset)}.woff2`, new Blob([bytes], { type: "font/woff2" }));
          })),
        status.node);
    }));
    return fonts.length;
  }

  T.register("svg-icon-font-finder", (root) => {
    const kind = T.select([["SVG icons", "icons"], ["Fonts", "fonts"]]);
    const query = T.input({ type: "search", required: true, minlength: 2, maxlength: 80, placeholder: "e.g. home or Inter" });
    const results = output();
    root.replaceChildren(T.panel(null, form("Search assets", T.twoCol(T.field("Asset type", kind), T.field("Search", query)),
      results, async (say) => {
        const value = query.value.trim();
        if (value.length < 2) throw new Error("Enter at least two characters.");
        const icons = kind.value === "icons";
        const count = await (icons ? showIcons : showFonts)(value, results);
        say(count ? `Showing ${count} ${icons ? "icon" : "font"} results for “${value}”.` : "No matching assets. Try another search.");
      }, paragraph("Icons from Iconify, fonts from Fontsource. The font download is one weight, style and character subset."))));
  });

  const timestamp = (seconds) => {
    const total = Math.floor(seconds);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor(total / 60) % 60;
    return [hours, minutes, total % 60].map(value => String(value).padStart(2, "0")).join(":");
  };

  async function screenshotFile(file) {
    if (file.size > 8 * 1024 * 1024 || !["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      throw new Error("Choose a PNG, JPEG or WebP screenshot up to 8 MB.");
    }
    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      throw new Error("This image could not be read. Choose a valid screenshot.");
    }
    try {
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.getContext("2d", { alpha: false }).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const image = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.9));
      if (!image) throw new Error("The screenshot could not be prepared.");
      return image;
    } finally {
      bitmap.close();
    }
  }

  T.register("anime-scene-finder", (root) => {
    const mode = T.select([["Upload screenshot", "file"], ["Public image URL", "url"]]);
    const file = T.input({ type: "file", accept: "image/jpeg,image/png,image/webp", required: true });
    const address = T.input({ type: "url", maxlength: 2048, placeholder: "https://example.com/frame.jpg" });
    const fileField = T.field("Screenshot", file);
    const urlField = T.field("HTTPS image URL", address);
    urlField.hidden = true;
    address.disabled = true;
    mode.addEventListener("change", () => {
      const byURL = mode.value === "url";
      fileField.hidden = file.disabled = byURL;
      urlField.hidden = address.disabled = !byURL;
      address.required = byURL;
    });
    const results = output();
    root.replaceChildren(T.panel(null, form("Find scene", [T.field("Image source", mode), fileField, urlField], results, async (say) => {
      const byURL = mode.value === "url";
      const search = new URL(traceAPI);
      search.searchParams.set("anilistInfo", "");
      const options = {};
      if (byURL) {
        const target = publicHttps(address.value.trim());
        if (!target) throw new Error("Enter a public HTTPS image URL without embedded credentials.");
        target.hash = "";
        search.searchParams.set("url", target.href);
      } else {
        const body = new FormData();
        body.append("image", await screenshotFile(file.files[0]), "screenshot.jpg");
        Object.assign(options, { method: "POST", body });
      }
      const data = await request(search.href, options);
      if (data?.error || !Array.isArray(data?.result)) throw new Error("trace.moe could not match the image. Try another screenshot or URL.");
      const seen = new Set();
      const matches = data.result.filter(row => {
        if (row?.anilist?.isAdult !== false || typeof row.similarity !== "number" || !Number.isFinite(row.similarity) ||
            row.similarity < 0 || row.similarity > 1 || !Number.isFinite(row.from) || row.from < 0) return false;
        const key = `${row.anilist.id}:${row.episode}:${Math.floor(row.from)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).sort((a, b) => b.similarity - a.similarity).slice(0, 5);
      results.replaceChildren(...matches.map(row => {
        const anime = row.anilist;
        const title = anime.title?.english || anime.title?.romaji || anime.title?.native || "Untitled anime";
        const label = Array.isArray(row.episode) ? row.episode.join("–") : row.episode;
        return card(title,
          el("p", {}, `Episode ${label ?? "unavailable"} · ${timestamp(row.from)}` +
            (Number.isFinite(row.to) && row.to > row.from ? `–${timestamp(row.to)}` : "")),
          paragraph(`${(row.similarity * 100).toFixed(1)}% image similarity`),
          Number.isSafeInteger(anime.id) && anime.id > 0 ? outbound("https://anilist.co/anime/" + anime.id, "View on AniList") : null);
      }));
      say(matches.length ? "Possible matches. Check the episode and timestamp against your screenshot." : "No displayable matches found. Try a clearer frame.");
    }, paragraph("PNG, JPEG or WebP up to 8 MB. Your screenshot or public image URL is sent to trace.moe when you search."))));
  });
})();
