"use strict";
(() => {
  const T = window.SANU_TOOLS;
  const { el, fileDrop, textToB64, b64ToText, bytesB64, b64Bytes, hex, bytesFromHex, fmtBytes, readFile, safeName, escapeHtml, copy, toast } = T;
  const q = (selector, root) => T.$(selector, root);
  const qa = (selector, root) => T.$$(selector, root);
  const setStatus = (root, message, kind) => T.status(root, message, kind);
  const setOutput = (root, value) => { const out = q(".js-out", root); if (out) out.value = value; };
  const getOutput = (root) => q(".js-out", root)?.value || "";
  const concat = (...arrays) => {
    const total = arrays.reduce((sum, array) => sum + array.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    arrays.forEach((array) => { out.set(array, offset); offset += array.length; });
    return out;
  };

  const MD5_SHIFTS = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
  const MD5_K = new Uint32Array(64);
  for (let index = 0; index < 64; index += 1) MD5_K[index] = Math.floor(Math.abs(Math.sin(index + 1)) * 4294967296) >>> 0;

  const md5Bytes = (input) => {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    const length = bytes.length;
    const padded = new Uint8Array((((length + 8) >> 6) + 1) << 6);
    padded.set(bytes);
    padded[length] = 0x80;
    const view = new DataView(padded.buffer);
    const bits = length * 8;
    view.setUint32(padded.length - 8, bits >>> 0, true);
    view.setUint32(padded.length - 4, Math.floor(bits / 4294967296), true);
    let a0 = 0x67452301;
    let b0 = 0xefcdab89;
    let c0 = 0x98badcfe;
    let d0 = 0x10325476;
    const words = new Uint32Array(16);
    for (let offset = 0; offset < padded.length; offset += 64) {
      for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4, true);
      let A = a0;
      let B = b0;
      let C = c0;
      let D = d0;
      for (let index = 0; index < 64; index += 1) {
        let F = 0;
        let g = 0;
        if (index < 16) { F = (B & C) | (~B & D); g = index; }
        else if (index < 32) { F = (D & B) | (~D & C); g = (5 * index + 1) % 16; }
        else if (index < 48) { F = B ^ C ^ D; g = (3 * index + 5) % 16; }
        else { F = C ^ (B | ~D); g = (7 * index) % 16; }
        const temp = D;
        D = C;
        C = B;
        const sum = (A + F + MD5_K[index] + words[g]) >>> 0;
        const shift = MD5_SHIFTS[index];
        B = (B + ((sum << shift) | (sum >>> (32 - shift)))) >>> 0;
        A = temp;
      }
      a0 = (a0 + A) >>> 0;
      b0 = (b0 + B) >>> 0;
      c0 = (c0 + C) >>> 0;
      d0 = (d0 + D) >>> 0;
    }
    const out = new Uint8Array(16);
    const outView = new DataView(out.buffer);
    outView.setUint32(0, a0, true);
    outView.setUint32(4, b0, true);
    outView.setUint32(8, c0, true);
    outView.setUint32(12, d0, true);
    return out;
  };
  const md5Hex = (input) => hex(md5Bytes(input));

  const CRC_TABLE = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? (0xedb88320 ^ (value >>> 1)) : value >>> 1;
    CRC_TABLE[index] = value >>> 0;
  }
  const crc32Hex = (input) => {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    let crc = 0xffffffff;
    for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, "0");
  };
  const hashBytes = async (algorithm, bytes) => {
    if (algorithm === "MD5") return md5Hex(bytes);
    if (algorithm === "CRC32") return crc32Hex(bytes);
    const digest = await crypto.subtle.digest(algorithm, bytes);
    return hex(new Uint8Array(digest));
  };

  const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const base32Encode = (bytes) => {
    let bits = 0;
    let value = 0;
    let out = "";
    for (const byte of bytes) {
      value = (value << 8) | byte;
      bits += 8;
      while (bits >= 5) {
        out += BASE32[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }
    if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
    return out;
  };
  const base32Decode = (value) => {
    const clean = String(value).toUpperCase().replace(/=+$/g, "").replace(/\s/g, "");
    let bits = 0;
    let buffer = 0;
    const out = [];
    for (const char of clean) {
      const index = BASE32.indexOf(char);
      if (index < 0) throw new Error("That is not a valid Base32 string.");
      buffer = (buffer << 5) | index;
      bits += 5;
      if (bits >= 8) {
        out.push((buffer >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }
    return Uint8Array.from(out);
  };

  const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const base58Encode = (bytes) => {
    let zeros = 0;
    while (zeros < bytes.length && bytes[zeros] === 0) zeros += 1;
    let value = 0n;
    for (const byte of bytes) value = (value << 8n) | BigInt(byte);
    let out = "";
    while (value > 0n) {
      out = BASE58[Number(value % 58n)] + out;
      value /= 58n;
    }
    return "1".repeat(zeros) + out;
  };
  const base58Decode = (text) => {
    let zeros = 0;
    while (zeros < text.length && text[zeros] === "1") zeros += 1;
    let value = 0n;
    for (const char of text) {
      const index = BASE58.indexOf(char);
      if (index < 0) throw new Error("That is not a valid Base58 string.");
      value = value * 58n + BigInt(index);
    }
    const out = [];
    while (value > 0n) { out.unshift(Number(value & 255n)); value >>= 8n; }
    return Uint8Array.from([...new Uint8Array(zeros), ...out]);
  };

  const csvRows = (text, delimiter) => {
    const rows = [];
    let row = [];
    let value = "";
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      if (quoted) {
        if (char === '"' && text[index + 1] === '"') { value += '"'; index += 1; }
        else if (char === '"') quoted = false;
        else value += char;
      } else if (char === '"') quoted = true;
      else if (char === delimiter) { row.push(value); value = ""; }
      else if (char === "\n" || char === "\r") {
        if (char === "\r" && text[index + 1] === "\n") index += 1;
        row.push(value);
        if (row.some((cell) => cell !== "")) rows.push(row);
        row = [];
        value = "";
      } else value += char;
    }
    row.push(value);
    if (row.some((cell) => cell !== "")) rows.push(row);
    return rows;
  };
  const csvEscape = (value) => {
    const text = value === null || value === undefined ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const xmlToValue = (node) => {
    const attributes = {};
    for (const attribute of node.attributes) attributes[`@${attribute.name}`] = attribute.value;
    const children = [...node.childNodes].filter((child) => child.nodeType === 1);
    const text = [...node.childNodes].filter((child) => child.nodeType === 3)
      .map((child) => child.nodeValue.trim()).join("").trim();
    if (!children.length && !Object.keys(attributes).length) return text;
    const out = { ...attributes };
    if (children.length) {
      children.forEach((child) => {
        const value = xmlToValue(child);
        if (Object.prototype.hasOwnProperty.call(out, child.tagName)) {
          if (!Array.isArray(out[child.tagName])) out[child.tagName] = [out[child.tagName]];
          out[child.tagName].push(value);
        } else out[child.tagName] = value;
      });
      if (text) out["#text"] = text;
    } else if (text) out["#text"] = text;
    return out;
  };
  const xmlEscape = (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  const valueToXml = (name, value, depth = 0) => {
    const pad = "  ".repeat(depth);
    if (Array.isArray(value)) return value.map((item) => valueToXml(name, item, depth)).join("\n");
    if (value === null || value === undefined) return `${pad}<${name}/>`;
    if (typeof value !== "object") return `${pad}<${name}>${xmlEscape(value)}</${name}>`;
    const attributes = Object.entries(value).filter(([key]) => key.startsWith("@"))
      .map(([key, attr]) => ` ${key.slice(1)}="${xmlEscape(attr)}"`).join("");
    const children = Object.entries(value).filter(([key]) => key !== "#text" && !key.startsWith("@"));
    if (!children.length) {
      const text = value["#text"] !== undefined ? xmlEscape(value["#text"]) : "";
      return text ? `${pad}<${name}${attributes}>${text}</${name}>` : `${pad}<${name}${attributes}/>`;
    }
    const body = children.map(([key, child]) => valueToXml(key, child, depth + 1)).join("\n");
    const text = value["#text"] !== undefined ? `\n${pad}  ${xmlEscape(value["#text"])}` : "";
    return `${pad}<${name}${attributes}>${text}\n${body}\n${pad}</${name}>`;
  };

  const sanitizeHtml = (html) => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("script,style,iframe,object,embed,link,meta,form,input,button,textarea,select").forEach((node) => node.remove());
    doc.body.querySelectorAll("*").forEach((node) => {
      [...node.attributes].forEach((attribute) => {
        const name = attribute.name.toLowerCase();
        const value = attribute.value.trim();
        if (name.startsWith("on")) node.removeAttribute(attribute.name);
        else if ((name === "href" || name === "src" || name === "xlink:href") && /^(javascript|vbscript|data:text\/html)/i.test(value)) node.removeAttribute(attribute.name);
      });
    });
    return doc.body.innerHTML;
  };

  const htmlToMarkdown = (html) => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const walk = (node) => {
      if (node.nodeType === 3) return node.nodeValue.replace(/\s+/g, " ");
      if (node.nodeType !== 1) return "";
      const tag = node.tagName.toLowerCase();
      const inner = () => [...node.childNodes].map(walk).join("");
      if (/^h[1-6]$/.test(tag)) return `\n${"#".repeat(Number(tag[1]))} ${inner().trim()}\n`;
      if (tag === "p") return `\n${inner().trim()}\n`;
      if (tag === "br") return "\n";
      if (tag === "strong" || tag === "b") return `**${inner().trim()}**`;
      if (tag === "em" || tag === "i") return `*${inner().trim()}*`;
      if (tag === "del" || tag === "s") return `~~${inner().trim()}~~`;
      if (tag === "code") return `\`${node.textContent}\``;
      if (tag === "pre") return `\n\`\`\`\n${node.textContent.trim()}\n\`\`\`\n`;
      if (tag === "a") return `[${inner().trim()}](${node.getAttribute("href") || ""})`;
      if (tag === "img") return `![${node.getAttribute("alt") || ""}](${node.getAttribute("src") || ""})`;
      if (tag === "blockquote") return inner().split("\n").map((line) => `> ${line}`).join("\n");
      if (tag === "li") return `\n- ${inner().trim()}`;
      if (tag === "hr") return "\n---\n";
      return inner();
    };
    return [...doc.body.childNodes].map(walk).join("").replace(/\n{3,}/g, "\n\n").trim();
  };

  const tomlModule = () => import("/assets/vendor/smol-toml/index.js").then((module) => module.default || module);

  const splitWords = (text) => String(text)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/).filter(Boolean);

  const loremWords = "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum".split(" ");
  const pick = (array) => array[Math.floor(Math.random() * array.length)];
  const loremSentence = (wordCount) => {
    const words = Array.from({ length: wordCount }, () => pick(loremWords));
    const text = words.join(" ");
    return text.charAt(0).toUpperCase() + text.slice(1) + ".";
  };

  const diffLines = (left, right) => {
    const a = left.split(/\r?\n/);
    const b = right.split(/\r?\n/);
    if (a.length > 1400 || b.length > 1400) throw new Error("Keep each side under 1,400 lines for a readable comparison.");
    const n = a.length;
    const m = b.length;
    const matrix = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i -= 1) {
      for (let j = m - 1; j >= 0; j -= 1) {
        matrix[i][j] = a[i] === b[j] ? matrix[i + 1][j + 1] + 1 : Math.max(matrix[i + 1][j], matrix[i][j + 1]);
      }
    }
    const ops = [];
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (a[i] === b[j]) { ops.push([" ", a[i]]); i += 1; j += 1; }
      else if (matrix[i + 1][j] >= matrix[i][j + 1]) { ops.push(["-", a[i]]); i += 1; }
      else { ops.push(["+", b[j]]); j += 1; }
    }
    while (i < n) { ops.push(["-", a[i]]); i += 1; }
    while (j < m) { ops.push(["+", b[j]]); j += 1; }
    return ops;
  };

  const SQL_KEYWORDS = new Set(("select from where group by order by having limit offset join left right inner outer full cross on as and or not in is null like between union all distinct insert into values update set delete create table alter drop index view primary key foreign references default case when then else end asc desc").split(" "));

  const beautifyCss = (text) => {
    let out = "";
    let indent = 0;
    let buffer = "";
    let quote = "";
    const flush = () => {
      const value = buffer.trim();
      buffer = "";
      if (!value) return;
      out += "  ".repeat(indent) + value;
    };
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      if (quote) {
        buffer += char;
        if (char === quote && text[index - 1] !== "\\") quote = "";
        continue;
      }
      if (char === '"' || char === "'") { quote = char; buffer += char; continue; }
      if (char === "{") { flush(); out += " {\n"; indent += 1; }
      else if (char === "}") { flush(); indent = Math.max(0, indent - 1); out += "  ".repeat(indent) + "}\n"; }
      else if (char === ";") { buffer += ";"; flush(); out += "\n"; }
      else if (char === "\n") { if (buffer.trim()) buffer += " "; }
      else buffer += char;
    }
    flush();
    return out.trim();
  };
  const minifyCss = (text) => {
    let out = "";
    let quote = "";
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      const next = text[index + 1];
      if (quote) { out += char; if (char === quote && text[index - 1] !== "\\") quote = ""; continue; }
      if (char === '"' || char === "'") { quote = char; out += char; continue; }
      if (char === "/" && next === "*") { const end = text.indexOf("*/", index + 2); index = end < 0 ? text.length : end + 1; continue; }
      if (/\s/.test(char)) { if (out && !/[\s{}:;,>+~]$/.test(out)) out += " "; continue; }
      if ("{}:;,>+~".includes(char)) out = out.replace(/\s+$/, "") + char;
      else out += char;
    }
    return out.replace(/\s+/g, " ").replace(/\s*([{}:;,>+~])\s*/g, "$1").trim();
  };

  const beautifyHtml = (text) => {
    const tokens = String(text).replace(/>\s+</g, "><").split(/(<[^>]+>)/).filter((token) => token.trim() !== "");
    let indent = 0;
    const lines = [];
    const voidTags = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
    tokens.forEach((token) => {
      const trimmed = token.trim();
      if (!trimmed) return;
      if (trimmed.startsWith("</")) {
        indent = Math.max(0, indent - 1);
        lines.push("  ".repeat(indent) + trimmed);
      } else if (trimmed.startsWith("<")) {
        lines.push("  ".repeat(indent) + trimmed);
        const name = (trimmed.match(/^<\s*([a-zA-Z0-9-]+)/) || [])[1]?.toLowerCase();
        if (name && !voidTags.has(name) && !trimmed.endsWith("/>") && !/^<!/.test(trimmed)) indent += 1;
      } else lines.push("  ".repeat(indent) + trimmed);
    });
    return lines.join("\n");
  };
  const minifyHtml = (text) => {
    const protectedBlocks = [];
    let value = String(text).replace(/<(pre|textarea|script|style)([\s\S]*?)<\/\1>/gi, (match) => {
      protectedBlocks.push(match);
      return `\u0000${protectedBlocks.length - 1}\u0000`;
    });
    value = value.replace(/<!--(?!\[if)[\s\S]*?-->/g, "").replace(/>\s+</g, "><").replace(/\s{2,}/g, " ").trim();
    return value.replace(/\u0000(\d+)\u0000/g, (match, index) => protectedBlocks[Number(index)]);
  };

  const minifyJs = (text) => {
    let out = "";
    let quote = "";
    let template = false;
    let regex = false;
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      const next = text[index + 1];
      if (quote) {
        out += char;
        if (char === quote && text[index - 1] !== "\\") quote = "";
        continue;
      }
      if (template) { out += char; if (char === "`" && text[index - 1] !== "\\") template = false; continue; }
      if (char === '"' || char === "'") { quote = char; out += char; continue; }
      if (char === "`") { template = true; out += char; continue; }
      if (char === "/" && next === "/") { const end = text.indexOf("\n", index + 2); index = end < 0 ? text.length : end - 1; continue; }
      if (char === "/" && next === "*") { const end = text.indexOf("*/", index + 2); index = end < 0 ? text.length : end + 1; continue; }
      if (/\s/.test(char)) { if (out && !/[\s(,;={}[\]+\-*/%<>!&|?:]$/.test(out)) out += " "; continue; }
      out += char;
    }
    return out.split("\n").map((line) => line.replace(/\s+$/, "")).filter((line, index, all) => line || all[index - 1]).join("\n");
  };
  const beautifyJs = (text) => {
    let out = "";
    let indent = 0;
    let quote = "";
    let template = false;
    let line = "";
    const emit = () => { if (line.trim()) out += "  ".repeat(indent) + line.trim() + "\n"; line = ""; };
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      if (quote) { line += char; if (char === quote && text[index - 1] !== "\\") quote = ""; continue; }
      if (template) { line += char; if (char === "`" && text[index - 1] !== "\\") template = false; continue; }
      if (char === '"' || char === "'") { quote = char; line += char; continue; }
      if (char === "`") { template = true; line += char; continue; }
      if (char === "{") { line += char; emit(); indent += 1; }
      else if (char === "}") { emit(); indent = Math.max(0, indent - 1); line += char; emit(); }
      else if (char === ";") { line += char; emit(); }
      else if (char === "\n") { emit(); }
      else line += char;
    }
    emit();
    return out.trim();
  };

  const formatSql = (text) => {
    const pieces = String(text).replace(/\s+/g, " ").trim().split(/(\s+|,|\(|\)|;)/).filter((piece) => piece !== "");
    let out = "";
    let indent = 0;
    let newline = false;
    pieces.forEach((piece) => {
      const upper = piece.toUpperCase();
      const major = ["SELECT", "FROM", "WHERE", "GROUP BY", "ORDER BY", "HAVING", "LIMIT", "UNION", "INSERT INTO", "VALUES", "UPDATE", "SET", "DELETE FROM", "CREATE TABLE", "ALTER TABLE", "DROP TABLE"].includes(upper);
      if (major && out) { out = out.replace(/\s+$/, "") + "\n" + "  ".repeat(indent); newline = false; }
      if (piece === "(") { out += "("; indent += 1; newline = true; }
      else if (piece === ")") { indent = Math.max(0, indent - 1); out = out.replace(/\s+$/, "") + ")"; newline = false; }
      else if (piece === ",") { out = out.replace(/\s+$/, "") + ", "; newline = true; }
      else if (piece === ";") { out = out.replace(/\s+$/, "") + ";\n"; newline = false; }
      else {
        if (newline && out && !out.endsWith("\n")) out += "\n" + "  ".repeat(indent);
        if (out && !/[\s(]$/.test(out) && !/^[),;]$/.test(piece)) out += " ";
        out += SQL_KEYWORDS.has(upper) ? upper : piece;
        newline = false;
      }
    });
    return out.trim();
  };

  const PRETTY_NAMES = { "Select": "SQL Select", "Insert": "SQL Insert", "Update": "SQL Update", "Delete": "SQL Delete" };

  T.register("base64", (root) => {
    root.innerHTML = `<div class="tp-panel"><div class="tp-cols"><label class="tp-field"><span class="tp-label">Input</span><textarea class="tp-textarea js-in" rows="9" placeholder="Paste text or Base64 here…"></textarea></label><label class="tp-field"><span class="tp-label">Result</span><textarea class="tp-textarea is-output js-out" rows="9" readonly placeholder="Result appears here…"></textarea></label></div><div class="tp-actions"><button type="button" class="tp-btn tp-btn-primary" data-run="encode">Encode</button><button type="button" class="tp-btn" data-run="decode">Decode</button><button type="button" class="tp-btn tp-btn-ghost" data-copy>Copy</button><button type="button" class="tp-btn tp-btn-ghost" data-download>Download</button><label class="tp-pill"><input type="checkbox" class="js-urlsafe"> URL-safe</label></div><p class="tp-hint">UTF-8 aware. URL-safe mode swaps + / for - _.</p></div>`;
    const run = (mode) => {
      try {
        const value = q(".js-in", root).value;
        if (!value.trim()) return setStatus(root, "Add some input first.", "error");
        let result = mode === "encode" ? textToB64(value) : b64ToText(value);
        if (q(".js-urlsafe", root).checked) result = mode === "encode" ? result.replace(/\+/g, "-").replace(/\//g, "_") : result;
        setOutput(root, result);
        setStatus(root, `${mode === "encode" ? "Encoded" : "Decoded"} ${result.length.toLocaleString()} characters.`, "ok");
      } catch (error) { setStatus(root, error.message, "error"); }
    };
    qa("[data-run]", root).forEach((node) => node.addEventListener("click", () => run(node.dataset.run)));
    q("[data-copy]", root).addEventListener("click", () => copy(getOutput(root)));
    q("[data-download]", root).addEventListener("click", () => T.download("base64.txt", getOutput(root), "text/plain"));
  });

  T.register("base64-file-converter", (root) => {
    root.innerHTML = `<div class="tp-panel"><div class="js-file-slot"></div><label class="tp-field"><span class="tp-label">Base64 or data URL</span><textarea class="tp-textarea js-in" rows="8" placeholder="data:image/png;base64,… or raw Base64"></textarea></label><div class="tp-actions"><button type="button" class="tp-btn tp-btn-primary" data-decode>Decode to file</button><button type="button" class="tp-btn" data-copy>Copy data URL</button><button type="button" class="tp-btn tp-btn-ghost" data-download>Download text</button></div><p class="tp-hint">Files are converted locally with FileReader.</p></div>`;
    const drop = fileDrop({ accept: "", label: "Drop a file to make a data URL", onFiles: async ([file]) => {
      try {
        const dataUrl = await readFile(file, "dataurl");
        q(".js-in", root).value = dataUrl;
        setStatus(root, `${file.name} → ${fmtBytes(dataUrl.length)} data URL.`, "ok");
      } catch (error) { setStatus(root, error.message, "error"); }
    }});
    q(".js-file-slot", root).append(drop.node);
    q("[data-decode]", root).addEventListener("click", () => {
      try {
        const raw = q(".js-in", root).value.trim();
        if (!raw) return setStatus(root, "Add a data URL or Base64 string first.", "error");
        const match = raw.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
        const mime = match?.[1] || "application/octet-stream";
        const payload = match ? match[3] : raw;
        const bytes = match && !match[2] ? new TextEncoder().encode(decodeURIComponent(payload)) : b64Bytes(payload);
        const extension = (mime.split("/")[1] || "bin").replace(/[^a-z0-9]+/gi, "").slice(0, 8) || "bin";
        T.download(`decoded-file.${extension}`, new Blob([bytes], { type: mime }));
        setStatus(root, `Decoded ${fmtBytes(bytes.length)}. Check your downloads.`, "ok");
      } catch (error) { setStatus(root, error.message || "That data URL could not be decoded.", "error"); }
    });
    q("[data-copy]", root).addEventListener("click", () => copy(q(".js-in", root).value));
    q("[data-download]", root).addEventListener("click", () => T.download("base64-data.txt", q(".js-in", root).value, "text/plain"));
  });

  T.register("base32", (root) => {
    root.innerHTML = `<div class="tp-panel"><div class="tp-cols"><label class="tp-field"><span class="tp-label">Input</span><textarea class="tp-textarea js-in" rows="9" placeholder="Text or Base32 string…"></textarea></label><label class="tp-field"><span class="tp-label">Result</span><textarea class="tp-textarea is-output js-out" rows="9" readonly></textarea></label></div><div class="tp-actions"><button type="button" class="tp-btn tp-btn-primary" data-run="encode">Encode</button><button type="button" class="tp-btn" data-run="decode">Decode</button><button type="button" class="tp-btn tp-btn-ghost" data-copy>Copy</button></div></div>`;
    const run = (mode) => {
      try {
        const value = q(".js-in", root).value;
        const result = mode === "encode" ? base32Encode(new TextEncoder().encode(value)) : new TextDecoder().decode(base32Decode(value));
        setOutput(root, result);
      } catch (error) { setStatus(root, error.message, "error"); }
    };
    qa("[data-run]", root).forEach((node) => node.addEventListener("click", () => run(node.dataset.run)));
    q("[data-copy]", root).addEventListener("click", () => copy(getOutput(root)));
  });

  T.register("base58", (root) => {
    root.innerHTML = `<div class="tp-panel"><div class="tp-cols"><label class="tp-field"><span class="tp-label">Input</span><textarea class="tp-textarea js-in" rows="9" placeholder="Text or Base58 string…"></textarea></label><label class="tp-field"><span class="tp-label">Result</span><textarea class="tp-textarea is-output js-out" rows="9" readonly></textarea></label></div><div class="tp-actions"><button type="button" class="tp-btn tp-btn-primary" data-run="encode">Encode</button><button type="button" class="tp-btn" data-run="decode">Decode</button><button type="button" class="tp-btn tp-btn-ghost" data-copy>Copy</button></div><p class="tp-hint">Uses the Bitcoin Base58 alphabet.</p></div>`;
    const run = (mode) => {
      try {
        const value = q(".js-in", root).value;
        const result = mode === "encode" ? base58Encode(new TextEncoder().encode(value)) : new TextDecoder().decode(base58Decode(value));
        setOutput(root, result);
      } catch (error) { setStatus(root, error.message, "error"); }
    };
    qa("[data-run]", root).forEach((node) => node.addEventListener("click", () => run(node.dataset.run)));
    q("[data-copy]", root).addEventListener("click", () => copy(getOutput(root)));
  });

  T.register("url-encode", (root) => {
    root.innerHTML = `<div class="tp-panel"><div class="tp-cols"><label class="tp-field"><span class="tp-label">Input</span><textarea class="tp-textarea js-in" rows="9" placeholder="https://example.com/search?q=hello world"></textarea></label><label class="tp-field"><span class="tp-label">Result</span><textarea class="tp-textarea is-output js-out" rows="9" readonly></textarea></label></div><div class="tp-actions"><button type="button" class="tp-btn tp-btn-primary" data-run="component">Encode component</button><button type="button" class="tp-btn" data-run="uri">Encode full URL</button><button type="button" class="tp-btn" data-run="decode">Decode</button><button type="button" class="tp-btn tp-btn-ghost" data-copy>Copy</button></div><p class="tp-hint">Encode component escapes &amp; = ? / #; full URL keeps URL separators.</p></div>`;
    const run = (mode) => {
      try {
        const value = q(".js-in", root).value;
        const result = mode === "component" ? encodeURIComponent(value) : mode === "uri" ? encodeURI(value) : decodeURIComponent(value.replace(/\+/g, " "));
        setOutput(root, result);
      } catch (error) { setStatus(root, "That string could not be decoded. Check for incomplete % escapes.", "error"); }
    };
    qa("[data-run]", root).forEach((node) => node.addEventListener("click", () => run(node.dataset.run)));
    q("[data-copy]", root).addEventListener("click", () => copy(getOutput(root)));
  });

  T.register("html-encode", (root) => {
    root.innerHTML = `<div class="tp-panel"><div class="tp-cols"><label class="tp-field"><span class="tp-label">Input</span><textarea class="tp-textarea js-in" rows="9" placeholder="<p>Hello & welcome</p>"></textarea></label><label class="tp-field"><span class="tp-label">Result</span><textarea class="tp-textarea is-output js-out" rows="9" readonly></textarea></label></div><div class="tp-actions"><button type="button" class="tp-btn tp-btn-primary" data-run="encode">Escape HTML</button><button type="button" class="tp-btn" data-run="decode">Decode entities</button><button type="button" class="tp-btn tp-btn-ghost" data-copy>Copy</button></div></div>`;
    const decode = (value) => { const node = document.createElement("textarea"); node.innerHTML = value; return node.value; };
    const run = (mode) => {
      const value = q(".js-in", root).value;
      setOutput(root, mode === "encode" ? escapeHtml(value) : decode(value));
    };
    qa("[data-run]", root).forEach((node) => node.addEventListener("click", () => run(node.dataset.run)));
    q("[data-copy]", root).addEventListener("click", () => copy(getOutput(root)));
  });

  T.register("case-converter", (root) => {
    root.innerHTML = `<div class="tp-panel"><label class="tp-field"><span class="tp-label">Text</span><textarea class="tp-textarea js-in" rows="8" placeholder="paste text in any style"></textarea></label><div class="tp-actions">${["UPPER CASE", "lower case", "Title Case", "Sentence case", "camelCase", "PascalCase", "snake_case", "kebab-case", "CONSTANT_CASE"].map((label) => `<button type="button" class="tp-btn tp-btn-ghost" data-case="${label}">${label}</button>`).join("")}</div><label class="tp-field"><span class="tp-label">Result</span><textarea class="tp-textarea is-output js-out" rows="8" readonly></textarea></label><div class="tp-actions"><button type="button" class="tp-btn" data-copy>Copy</button></div></div>`;
    const words = (value) => splitWords(value);
    const transforms = {
      "UPPER CASE": (value) => value.toUpperCase(),
      "lower case": (value) => value.toLowerCase(),
      "Title Case": (value) => value.replace(/\p{L}[\p{L}'’-]*/gu, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()),
      "Sentence case": (value) => value.toLowerCase().replace(/(^\s*\p{L}|[.!?]\s+\p{L})/gu, (match) => match.toUpperCase()),
      "camelCase": (value) => words(value).map((word, index) => index ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : word.toLowerCase()).join(""),
      "PascalCase": (value) => words(value).map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(""),
      "snake_case": (value) => words(value).map((word) => word.toLowerCase()).join("_"),
      "kebab-case": (value) => words(value).map((word) => word.toLowerCase()).join("-"),
      "CONSTANT_CASE": (value) => words(value).map((word) => word.toUpperCase()).join("_"),
    };
    qa("[data-case]", root).forEach((node) => node.addEventListener("click", () => {
      setOutput(root, transforms[node.dataset.case](q(".js-in", root).value));
    }));
    q(".js-in", root).addEventListener("input", () => setOutput(root, transforms["Title Case"](q(".js-in", root).value)));
    q("[data-copy]", root).addEventListener("click", () => copy(getOutput(root)));
  });

  T.register("reverse-string", (root) => {
    root.innerHTML = `<div class="tp-panel"><label class="tp-field"><span class="tp-label">Input</span><textarea class="tp-textarea js-in" rows="8"></textarea></label><div class="tp-actions"><button type="button" class="tp-btn tp-btn-primary" data-run="chars">Reverse characters</button><button type="button" class="tp-btn" data-run="words">Reverse words</button><button type="button" class="tp-btn" data-run="lines">Reverse lines</button><button type="button" class="tp-btn tp-btn-ghost" data-copy>Copy</button></div><label class="tp-field"><span class="tp-label">Result</span><textarea class="tp-textarea is-output js-out" rows="8" readonly></textarea></label></div>`;
    const run = (mode) => {
      const value = q(".js-in", root).value;
      const result = mode === "chars" ? [...value].reverse().join("")
        : mode === "words" ? value.split(/(\s+)/).reverse().join("")
        : value.split(/\r?\n/).reverse().join("\n");
      setOutput(root, result);
    };
    qa("[data-run]", root).forEach((node) => node.addEventListener("click", () => run(node.dataset.run)));
    q("[data-copy]", root).addEventListener("click", () => copy(getOutput(root)));
  });

  T.register("line-sorter", (root) => {
    root.innerHTML = `<div class="tp-panel"><label class="tp-field"><span class="tp-label">Lines</span><textarea class="tp-textarea js-in" rows="10" placeholder="One item per line…"></textarea></label><div class="tp-actions"><button type="button" class="tp-btn tp-btn-primary" data-run="asc">Sort A → Z</button><button type="button" class="tp-btn" data-run="desc">Sort Z → A</button><button type="button" class="tp-btn" data-run="dedupe">Remove duplicates</button><button type="button" class="tp-btn" data-run="reverse">Reverse</button><button type="button" class="tp-btn" data-run="shuffle">Shuffle</button><button type="button" class="tp-btn" data-run="trim">Trim lines</button><button type="button" class="tp-btn" data-run="empty">Remove empty</button><button type="button" class="tp-btn tp-btn-ghost" data-copy>Copy</button></div><label class="tp-field"><span class="tp-label">Result</span><textarea class="tp-textarea is-output js-out" rows="10" readonly></textarea></label></div>`;
    const run = (mode) => {
      let lines = q(".js-in", root).value.split(/\r?\n/);
      if (mode === "asc" || mode === "desc") lines = [...lines].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))[mode === "asc" ? "slice" : "reverse"]();
      else if (mode === "dedupe") { const seen = new Set(); lines = lines.filter((line) => !seen.has(line) && seen.add(line)); }
      else if (mode === "reverse") lines.reverse();
      else if (mode === "shuffle") { for (let index = lines.length - 1; index > 0; index -= 1) { const swap = Math.floor(Math.random() * (index + 1)); [lines[index], lines[swap]] = [lines[swap], lines[index]]; } }
      else if (mode === "trim") lines = lines.map((line) => line.trim());
      else if (mode === "empty") lines = lines.filter((line) => line.trim() !== "");
      setOutput(root, lines.join("\n"));
    };
    qa("[data-run]", root).forEach((node) => node.addEventListener("click", () => run(node.dataset.run)));
    q("[data-copy]", root).addEventListener("click", () => copy(getOutput(root)));
  });

  T.register("word-counter", (root) => {
    root.innerHTML = `<div class="tp-panel"><label class="tp-field"><span class="tp-label">Text</span><textarea class="tp-textarea js-in" rows="10" placeholder="Start typing or paste text…"></textarea></label><div class="tp-kv"><div><span>Words</span><strong data-stat="words">0</strong></div><div><span>Characters</span><strong data-stat="chars">0</strong></div><div><span>No spaces</span><strong data-stat="chars-ns">0</strong></div><div><span>Sentences</span><strong data-stat="sentences">0</strong></div><div><span>Paragraphs</span><strong data-stat="paragraphs">0</strong></div><div><span>Reading time</span><strong data-stat="reading">0 min</strong></div></div><div class="tp-chips-inline js-top"></div></div>`;
    const update = () => {
      const value = q(".js-in", root).value;
      const words = value.trim() ? value.trim().split(/\s+/) : [];
      const sentences = value.trim() ? (value.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || []).filter((part) => part.trim()).length : 0;
      const paragraphs = value.trim() ? value.trim().split(/\n\s*\n/).filter((part) => part.trim()).length : 0;
      const stats = { words: words.length, chars: value.length, "chars-ns": value.replace(/\s/g, "").length, sentences, paragraphs, reading: words.length ? `${Math.max(1, Math.ceil(words.length / 200))} min` : "0 min" };
      Object.entries(stats).forEach(([key, number]) => { const node = q(`[data-stat="${key}"]`, root); if (node) node.textContent = number.toLocaleString(); });
      const counts = new Map();
      words.map((word) => word.toLowerCase().replace(/[^\p{L}\p{N}'-]/gu, "")).filter((word) => word.length > 2).forEach((word) => counts.set(word, (counts.get(word) || 0) + 1));
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
      q(".js-top", root).replaceChildren(...top.map(([word, number]) => el("span", { class: "tp-pill", text: `${word} × ${number}` })));
    };
    q(".js-in", root).addEventListener("input", update);
    update();
  });

  T.register("lorem-ipsum", (root) => {
    root.innerHTML = `<div class="tp-panel"><div class="tp-cols"><label class="tp-field"><span class="tp-label">Amount</span><input class="tp-input" type="number" min="1" max="200" value="4"></label><label class="tp-field"><span class="tp-label">Unit</span><select class="tp-select js-unit"><option value="paragraphs">Paragraphs</option><option value="sentences">Sentences</option><option value="words">Words</option></select></label></div><div class="tp-chips-inline"><label class="tp-pill"><input type="checkbox" class="js-start" checked> Start with “Lorem ipsum”</label><label class="tp-pill"><input type="checkbox" class="js-html"> Wrap paragraphs in HTML</label></div><div class="tp-actions"><button type="button" class="tp-btn tp-btn-primary" data-run>Generate</button><button type="button" class="tp-btn tp-btn-ghost" data-copy>Copy</button></div><label class="tp-field"><span class="tp-label">Result</span><textarea class="tp-textarea is-output js-out" rows="12" readonly></textarea></label></div>`;
    const generate = () => {
      const amount = Math.max(1, Math.min(200, Number(q("input[type=number]", root).value) || 1));
      const unit = q(".js-unit", root).value;
      let parts = [];
      if (unit === "words") parts = Array.from({ length: amount }, () => pick(loremWords));
      else if (unit === "sentences") parts = Array.from({ length: amount }, () => loremSentence(8 + Math.floor(Math.random() * 10)));
      else parts = Array.from({ length: amount }, () => Array.from({ length: 3 + Math.floor(Math.random() * 3) }, () => loremSentence(8 + Math.floor(Math.random() * 9))).join(" "));
      let text = parts.join(unit === "words" ? " " : unit === "sentences" ? " " : "\n\n");
      if (q(".js-start", root).checked && !/^lorem ipsum/i.test(text)) text = `Lorem ipsum dolor sit amet, ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
      if (q(".js-html", root).checked) text = text.split(/\n\n/).map((paragraph) => `<p>${paragraph}</p>`).join("\n");
      setOutput(root, text);
    };
    q("[data-run]", root).addEventListener("click", generate);
    q("[data-copy]", root).addEventListener("click", () => copy(getOutput(root)));
    generate();
  });

  T.register("uuid", (root) => {
    root.innerHTML = `<div class="tp-panel"><div class="tp-cols"><label class="tp-field"><span class="tp-label">How many?</span><input class="tp-input" type="number" min="1" max="500" value="10"></label><label class="tp-field"><span class="tp-label">Style</span><select class="tp-select js-style"><option value="standard">Lowercase, hyphens</option><option value="upper">Uppercase</option><option value="nohyphen">No hyphens</option><option value="braces">Braces</option></select></label></div><div class="tp-actions"><button type="button" class="tp-btn tp-btn-primary" data-run>Generate UUIDs</button><button type="button" class="tp-btn tp-btn-ghost" data-copy>Copy all</button><button type="button" class="tp-btn tp-btn-ghost" data-download>Download</button></div><label class="tp-field"><span class="tp-label">UUID v4 list</span><textarea class="tp-textarea is-output js-out" rows="12" readonly></textarea></label></div>`;
    const uuid = () => crypto.randomUUID ? crypto.randomUUID() : (() => {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const value = hex(bytes);
      return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
    })();
    const generate = () => {
      const count = Math.max(1, Math.min(500, Number(q("input[type=number]", root).value) || 1));
      const style = q(".js-style", root).value;
      const list = Array.from({ length: count }, () => {
        let value = uuid();
        if (style === "upper") value = value.toUpperCase();
        if (style === "nohyphen") value = value.replace(/-/g, "");
        if (style === "braces") value = `{${value}}`;
        return value;
      });
      setOutput(root, list.join("\n"));
    };
    q("[data-run]", root).addEventListener("click", generate);
    q("[data-copy]", root).addEventListener("click", () => copy(getOutput(root)));
    q("[data-download]", root).addEventListener("click", () => T.download("uuids.txt", getOutput(root), "text/plain"));
    generate();
  });

  const jsonTool = (root) => {
    root.innerHTML = `<div class="tp-panel"><div class="tp-cols"><label class="tp-field"><span class="tp-label">JSON input</span><textarea class="tp-textarea js-in" rows="12" placeholder='{"hello":"world"}'></textarea></label><label class="tp-field"><span class="tp-label">Formatted JSON</span><textarea class="tp-textarea is-output js-out" rows="12" readonly></textarea></label></div><div class="tp-actions"><button type="button" class="tp-btn tp-btn-primary" data-run="format">Format</button><button type="button" class="tp-btn" data-run="minify">Minify</button><button type="button" class="tp-btn" data-run="sort">Sort keys + format</button><button type="button" class="tp-btn tp-btn-ghost" data-copy>Copy</button><button type="button" class="tp-btn tp-btn-ghost" data-download>Download</button></div><label class="tp-field"><span class="tp-label">Indent</span><select class="tp-select js-indent"><option value="2">2 spaces</option><option value="4">4 spaces</option><option value="tab">Tab</option></select></label></div>`;
    const sortValue = (value) => {
      if (Array.isArray(value)) return value.map(sortValue);
      if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])]));
      return value;
    };
    const run = (mode) => {
      try {
        const parsed = JSON.parse(q(".js-in", root).value);
        const indentValue = q(".js-indent", root).value;
        const indent = indentValue === "tab" ? "\t" : Number(indentValue);
        const data = mode === "sort" ? sortValue(parsed) : parsed;
        setOutput(root, mode === "minify" ? JSON.stringify(data) : JSON.stringify(data, null, indent));
        setStatus(root, mode === "minify" ? `Valid JSON · ${JSON.stringify(data).length.toLocaleString()} bytes minified.` : "Valid JSON.", "ok");
      } catch (error) { setOutput(root, ""); setStatus(root, `Invalid JSON: ${error.message}`, "error"); }
    };
    qa("[data-run]", root).forEach((node) => node.addEventListener("click", () => run(node.dataset.run)));
    q("[data-copy]", root).addEventListener("click", () => copy(getOutput(root)));
    q("[data-download]", root).addEventListener("click", () => T.download("formatted.json", getOutput(root), "application/json"));
  };
  T.register("json-formatter", jsonTool);

  T.register("regex", (root) => {
    root.innerHTML = `<div class="tp-panel"><div class="tp-cols"><label class="tp-field"><span class="tp-label">Pattern</span><input class="tp-input js-pattern" placeholder="\\b\\w+@\\w+\\.\\w+\\b" spellcheck="false"></label><label class="tp-field"><span class="tp-label">Flags</span><div class="tp-chips-inline">${["g", "i", "m", "s", "u"].map((flag) => `<label class="tp-pill"><input type="checkbox" class="js-flag" value="${flag}" ${flag === "g" ? "checked" : ""}> ${flag}</label>`).join("")}</div></label></div><label class="tp-field"><span class="tp-label">Test text</span><textarea class="tp-textarea js-text" rows="7" placeholder="Paste text to search…"></textarea></label><div class="tp-actions"><button type="button" class="tp-btn tp-btn-primary" data-run>Run test</button><button type="button" class="tp-btn" data-replace>Replace</button><button type="button" class="tp-btn tp-btn-ghost" data-copy>Copy matches</button></div><div class="tp-kv"><div><span>Status</span><strong class="js-state">—</strong></div><div><span>Matches</span><strong class="js-count">0</strong></div></div><div class="tp-result-list js-results"></div><div class="tp-panel"><label class="tp-field"><span class="tp-label">Replace with</span><input class="tp-input js-replacement" placeholder="$1 or replacement text"></label><label class="tp-field"><span class="tp-label">Replaced result</span><textarea class="tp-textarea is-output js-replaced" rows="6" readonly></textarea></label></div></div>`;
    let lastMatches = [];
    const compile = () => {
      const flags = qa(".js-flag", root).filter((node) => node.checked).map((node) => node.value).join("");
      return new RegExp(q(".js-pattern", root).value, flags);
    };
    const run = () => {
      try {
        const regex = compile();
        const text = q(".js-text", root).value;
        lastMatches = [];
        if (regex.global) {
          let match;
          let guard = 0;
          while ((match = regex.exec(text)) !== null && guard < 5000) {
            lastMatches.push(match);
            guard += 1;
            if (match[0] === "") regex.lastIndex += 1;
          }
        } else {
          const match = regex.exec(text);
          if (match) lastMatches.push(match);
        }
        q(".js-state", root).textContent = "Valid";
        q(".js-count", root).textContent = lastMatches.length;
        q(".js-results", root).replaceChildren(...lastMatches.slice(0, 300).map((match, index) => el("div", { class: "tp-result" },
          el("b", { text: `#${index + 1} at ${match.index}` }), " · ", JSON.stringify(match[0]),
          ...(match.length > 1 ? [el("div", { class: "is-muted" }, ...match.slice(1).map((group, groupIndex) => el("span", { text: ` $${groupIndex + 1}=${JSON.stringify(group)}` })))] : []))));
      } catch (error) {
        q(".js-state", root).textContent = "Invalid";
        q(".js-count", root).textContent = "0";
        q(".js-results", root).replaceChildren();
        setStatus(root, error.message, "error");
      }
    };
    q("[data-run]", root).addEventListener("click", run);
    q("[data-replace]", root).addEventListener("click", () => {
      try {
        const regex = compile();
        const text = q(".js-text", root).value;
        const replacement = q(".js-replacement", root).value;
        q(".js-replaced", root).value = text.replace(regex.global ? regex : new RegExp(regex.source, regex.flags + "g"), replacement);
        setStatus(root, "Replacement generated.", "ok");
      } catch (error) { setStatus(root, error.message, "error"); }
    });
    q("[data-copy]", root).addEventListener("click", () => copy(lastMatches.map((match) => match[0]).join("\n")));
    run();
  });

  T.register("yaml-json", (root) => {
    root.innerHTML = `<div class="tp-panel"><div class="tp-cols"><label class="tp-field"><span class="tp-label">YAML / JSON input</span><textarea class="tp-textarea js-in" rows="12" placeholder="name: Sanuwar&#10;tools: 67"></textarea></label><label class="tp-field"><span class="tp-label">Result</span><textarea class="tp-textarea is-output js-out" rows="12" readonly></textarea></label></div><div class="tp-actions"><button type="button" class="tp-btn tp-btn-primary" data-run="tojson">YAML → JSON</button><button type="button" class="tp-btn" data-run="toyaml">JSON → YAML</button><button type="button" class="tp-btn tp-btn-ghost" data-copy>Copy</button><button type="button" class="tp-btn tp-btn-ghost" data-download>Download</button></div></div>`;
    const run = (mode) => {
      try {
        const value = q(".js-in", root).value;
        if (mode === "tojson") setOutput(root, JSON.stringify(jsyaml.load(value), null, 2));
        else setOutput(root, jsyaml.dump(JSON.parse(value), { noRefs: true, lineWidth: 100 }));
        setStatus(root, "Converted successfully.", "ok");
      } catch (error) { setOutput(root, ""); setStatus(root, error.message, "error"); }
    };
    qa("[data-run]", root).forEach((node) => node.addEventListener("click", () => run(node.dataset.run)));
    q("[data-copy]", root).addEventListener("click", () => copy(getOutput(root)));
    q("[data-download]", root).addEventListener("click", () => T.download("converted.yaml", getOutput(root), "text/yaml"));
  });

  T.register("csv-json", (root) => {
    root.innerHTML = `<div class="tp-panel"><div class="tp-chips-inline"><label class="tp-pill"><input type="checkbox" class="js-header" checked> First row is header</label><label class="tp-pill"><span>Delimiter</span><select class="tp-select js-delimiter" style="padding:3px 6px"><option value=",">Comma</option><option value=";">Semicolon</option><option value="\t">Tab</option></select></label></div><div class="tp-cols"><label class="tp-field"><span class="tp-label">CSV / JSON input</span><textarea class="tp-textarea js-in" rows="12" placeholder="name,role&#10;Sanuwar,Builder"></textarea></label><label class="tp-field"><span class="tp-label">Result</span><textarea class="tp-textarea is-output js-out" rows="12" readonly></textarea></label></div><div class="tp-actions"><button type="button" class="tp-btn tp-btn-primary" data-run="tojson">CSV → JSON</button><button type="button" class="tp-btn" data-run="tocsv">JSON → CSV</button><button type="button" class="tp-btn tp-btn-ghost" data-copy>Copy</button><button type="button" class="tp-btn tp-btn-ghost" data-download>Download</button></div></div>`;
    const run = (mode) => {
      try {
        const value = q(".js-in", root).value;
        if (!value.trim()) return setStatus(root, "Add CSV or JSON first.", "error");
        if (mode === "tojson") {
          const rows = csvRows(value, q(".js-delimiter", root).value);
          if (!rows.length) throw new Error("No rows found.");
          let data;
          if (q(".js-header", root).checked) {
            const header = rows[0].map((name, index) => name.trim() || `column_${index + 1}`);
            data = rows.slice(1).map((row) => Object.fromEntries(header.map((name, index) => [name, row[index] ?? ""])));
          } else data = rows;
          setOutput(root, JSON.stringify(data, null, 2));
        } else {
          const data = JSON.parse(value);
          const rows = Array.isArray(data) ? data : [data];
          if (!rows.length) throw new Error("The JSON array is empty.");
          const keys = [...new Set(rows.flatMap((row) => row && typeof row === "object" ? Object.keys(row) : []))];
          const lines = [keys.map(csvEscape).join(","), ...rows.map((row) => keys.map((key) => csvEscape(row?.[key])).join(","))];
          setOutput(root, lines.join("\n"));
        }
        setStatus(root, "Converted successfully.", "ok");
      } catch (error) { setOutput(root, ""); setStatus(root, error.message, "error"); }
    };
    qa("[data-run]", root).forEach((node) => node.addEventListener("click", () => run(node.dataset.run)));
    q("[data-copy]", root).addEventListener("click", () => copy(getOutput(root)));
    q("[data-download]", root).addEventListener("click", () => T.download("converted.csv", getOutput(root), "text/csv"));
  });

  T.register("xml-json", (root) => {
    root.innerHTML = `<div class="tp-panel"><div class="tp-cols"><label class="tp-field"><span class="tp-label">XML / JSON input</span><textarea class="tp-textarea js-in" rows="12" placeholder="<root><item id='1'>Hello</item></root>"></textarea></label><label class="tp-field"><span class="tp-label">Result</span><textarea class="tp-textarea is-output js-out" rows="12" readonly></textarea></label></div><div class="tp-actions"><button type="button" class="tp-btn tp-btn-primary" data-run="tojson">XML → JSON</button><button type="button" class="tp-btn" data-run="toxml">JSON → XML</button><button type="button" class="tp-btn tp-btn-ghost" data-copy>Copy</button><button type="button" class="tp-btn tp-btn-ghost" data-download>Download</button></div></div>`;
    const run = (mode) => {
      try {
        const value = q(".js-in", root).value;
        if (!value.trim()) return setStatus(root, "Add XML or JSON first.", "error");
        if (mode === "tojson") {
          const doc = new DOMParser().parseFromString(value, "application/xml");
          if (doc.querySelector("parsererror")) throw new Error("The XML could not be parsed. Check for unclosed tags.");
          setOutput(root, JSON.stringify({ [doc.documentElement.tagName]: xmlToValue(doc.documentElement) }, null, 2));
        } else {
          const data = JSON.parse(value);
          const keys = Object.keys(data);
          if (!keys.length) throw new Error("The JSON object is empty.");
          setOutput(root, keys.map((key) => valueToXml(key, data[key])).join("\n"));
        }
        setStatus(root, "Converted successfully.", "ok");
      } catch (error) { setOutput(root, ""); setStatus(root, error.message, "error"); }
    };
    qa("[data-run]", root).forEach((node) => node.addEventListener("click", () => run(node.dataset.run)));
    q("[data-copy]", root).addEventListener("click", () => copy(getOutput(root)));
    q("[data-download]", root).addEventListener("click", () => T.download("converted.xml", getOutput(root), "application/xml"));
  });

  T.register("toml-json", (root) => {
    root.innerHTML = `<div class="tp-panel"><div class="tp-cols"><label class="tp-field"><span class="tp-label">TOML / JSON input</span><textarea class="tp-textarea js-in" rows="12" placeholder='[site]&#10;name = "SanuwarTools"'></textarea></label><label class="tp-field"><span class="tp-label">Result</span><textarea class="tp-textarea is-output js-out" rows="12" readonly></textarea></label></div><div class="tp-actions"><button type="button" class="tp-btn tp-btn-primary" data-run="tojson">TOML → JSON</button><button type="button" class="tp-btn" data-run="totoml">JSON → TOML</button><button type="button" class="tp-btn tp-btn-ghost" data-copy>Copy</button><button type="button" class="tp-btn tp-btn-ghost" data-download>Download</button></div></div>`;
    const run = async (mode) => {
      try {
        const toml = await tomlModule();
        const value = q(".js-in", root).value;
        if (!value.trim()) return setStatus(root, "Add TOML or JSON first.", "error");
        setOutput(root, mode === "tojson" ? JSON.stringify(toml.parse(value), null, 2) : toml.stringify(JSON.parse(value)));
        setStatus(root, "Converted successfully.", "ok");
      } catch (error) { setOutput(root, ""); setStatus(root, error.message, "error"); }
    };
    qa("[data-run]", root).forEach((node) => node.addEventListener("click", () => run(node.dataset.run)));
    q("[data-copy]", root).addEventListener("click", () => copy(getOutput(root)));
    q("[data-download]", root).addEventListener("click", () => T.download("converted.toml", getOutput(root), "text/plain"));
  });

  T.register("yaml-toml", (root) => {
    root.innerHTML = `<div class="tp-panel"><div class="tp-cols"><label class="tp-field"><span class="tp-label">YAML / TOML input</span><textarea class="tp-textarea js-in" rows="12"></textarea></label><label class="tp-field"><span class="tp-label">Result</span><textarea class="tp-textarea is-output js-out" rows="12" readonly></textarea></label></div><div class="tp-actions"><button type="button" class="tp-btn tp-btn-primary" data-run="totoml">YAML → TOML</button><button type="button" class="tp-btn" data-run="toyaml">TOML → YAML</button><button type="button" class="tp-btn tp-btn-ghost" data-copy>Copy</button></div></div>`;
    const run = async (mode) => {
      try {
        const toml = await tomlModule();
        const value = q(".js-in", root).value;
        if (!value.trim()) return setStatus(root, "Add YAML or TOML first.", "error");
        setOutput(root, mode === "totoml" ? toml.stringify(jsyaml.load(value)) : jsyaml.dump(toml.parse(value), { noRefs: true, lineWidth: 100 }));
        setStatus(root, "Converted successfully.", "ok");
      } catch (error) { setOutput(root, ""); setStatus(root, error.message, "error"); }
    };
    qa("[data-run]", root).forEach((node) => node.addEventListener("click", () => run(node.dataset.run)));
    q("[data-copy]", root).addEventListener("click", () => copy(getOutput(root)));
  });

  T.register("bbcode", (root) => {
    root.innerHTML = `<div class="tp-panel"><label class="tp-field"><span class="tp-label">Mode</span><select class="tp-select js-mode"><option value="html">BBCode → HTML</option><option value="markdown">BBCode → Markdown</option><option value="bbcode">HTML → BBCode</option></select></label><div class="tp-cols"><label class="tp-field"><span class="tp-label">Input</span><textarea class="tp-textarea js-in" rows="10" placeholder="[b]Hello[/b]"></textarea></label><label class="tp-field"><span class="tp-label">Result</span><textarea class="tp-textarea is-output js-out" rows="10" readonly></textarea></label></div><div class="tp-actions"><button type="button" class="tp-btn tp-btn-primary" data-run>Convert</button><button type="button" class="tp-btn tp-btn-ghost" data-copy>Copy</button></div></div>`;
    const safeUrl = (value) => /^https?:\/\//i.test(value) ? value : "";
    const bbToHtml = (value) => {
      let text = escapeHtml(value);
      text = text.replace(/\[b\]([\s\S]*?)\[\/b\]/gi, "<strong>$1</strong>")
        .replace(/\[i\]([\s\S]*?)\[\/i\]/gi, "<em>$1</em>")
        .replace(/\[u\]([\s\S]*?)\[\/u\]/gi, "<u>$1</u>")
        .replace(/\[s\]([\s\S]*?)\[\/s\]/gi, "<s>$1</s>")
        .replace(/\[code\]([\s\S]*?)\[\/code\]/gi, "<pre><code>$1</code></pre>")
        .replace(/\[quote\]([\s\S]*?)\[\/quote\]/gi, "<blockquote>$1</blockquote>")
        .replace(/\[url=([^\]]+)\]([\s\S]*?)\[\/url\]/gi, (match, url, label) => safeUrl(url) ? `<a href="${url}" rel="noopener noreferrer">${label}</a>` : label)
        .replace(/\[url\]([\s\S]*?)\[\/url\]/gi, (match, url) => safeUrl(url) ? `<a href="${url}" rel="noopener noreferrer">${url}</a>` : url)
        .replace(/\[img\]([\s\S]*?)\[\/img\]/gi, (match, url) => safeUrl(url) ? `<img src="${url}" alt="">` : "")
        .replace(/\[list\]([\s\S]*?)\[\/list\]/gi, (match, body) => `<ul>${body.replace(/\[\*\]\s*([^\[]*)/g, "<li>$1</li>")}</ul>`)
        .replace(/\n/g, "<br>");
      return text;
    };
    const bbToMd = (value) => bbToHtml(value)
      .replace(/<strong>(.*?)<\/strong>/g, "**$1**").replace(/<em>(.*?)<\/em>/g, "*$1*")
      .replace(/<u>(.*?)<\/u>/g, "$1").replace(/<s>(.*?)<\/s>/g, "~~$1~~")
      .replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/g, "\n```\n$1\n```\n")
      .replace(/<blockquote>([\s\S]*?)<\/blockquote>/g, "> $1")
      .replace(/<a href="([^"]+)"[^>]*>(.*?)<\/a>/g, "[$2]($1)")
      .replace(/<img src="([^"]+)"[^>]*>/g, "![]($1)")
      .replace(/<li>(.*?)<\/li>/g, "- $1").replace(/<\/?ul>/g, "")
      .replace(/<br>/g, "\n").replace(/<[^>]+>/g, "");
    const htmlToBb = (value) => value
      .replace(/<strong>([\s\S]*?)<\/strong>/gi, "[b]$1[/b]").replace(/<b>([\s\S]*?)<\/b>/gi, "[b]$1[/b]")
      .replace(/<em>([\s\S]*?)<\/em>/gi, "[i]$1[/i]").replace(/<i>([\s\S]*?)<\/i>/gi, "[i]$1[/i]")
      .replace(/<u>([\s\S]*?)<\/u>/gi, "[u]$1[/u]").replace(/<s>([\s\S]*?)<\/s>/gi, "[s]$1[/s]")
      .replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/gi, "[code]$1[/code]")
      .replace(/<blockquote>([\s\S]*?)<\/blockquote>/gi, "[quote]$1[/quote]")
      .replace(/<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, "[url=$1]$2[/url]")
      .replace(/<img src="([^"]+)"[^>]*>/gi, "[img]$1[/img]")
      .replace(/<li>([\s\S]*?)<\/li>/gi, "[*]$1").replace(/<ul>([\s\S]*?)<\/ul>/gi, "[list]$1[/list]")
      .replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");
    q("[data-run]", root).addEventListener("click", () => {
      const mode = q(".js-mode", root).value;
      const value = q(".js-in", root).value;
      setOutput(root, mode === "html" ? bbToHtml(value) : mode === "markdown" ? bbToMd(value) : htmlToBb(value));
    });
    q("[data-copy]", root).addEventListener("click", () => copy(getOutput(root)));
  });

  T.register("markdown", (root) => {
    root.innerHTML = `<div class="tp-panel"><div class="tp-cols"><label class="tp-field"><span class="tp-label">Markdown / HTML input</span><textarea class="tp-textarea js-in" rows="12" placeholder="# Hello&#10;&#10;**Bold** text and [a link](https://example.com)."></textarea></label><label class="tp-field"><span class="tp-label">HTML / Markdown result</span><textarea class="tp-textarea is-output js-out" rows="12" readonly></textarea></label></div><div class="tp-actions"><button type="button" class="tp-btn tp-btn-primary" data-run="tohtml">Markdown → HTML</button><button type="button" class="tp-btn" data-run="tomd">HTML → Markdown</button><button type="button" class="tp-btn tp-btn-ghost" data-copy>Copy</button></div><div class="tp-field"><span class="tp-label">Preview</span><div class="tp-output js-preview"></div></div></div>`;
    const run = (mode) => {
      const value = q(".js-in", root).value;
      if (mode === "tohtml") {
        const html = sanitizeHtml(marked.parse(value, { headerIds: false, mangle: false }));
        setOutput(root, html);
        q(".js-preview", root).innerHTML = html;
      } else {
        setOutput(root, htmlToMarkdown(value));
        q(".js-preview", root).textContent = "";
      }
    };
    qa("[data-run]", root).forEach((node) => node.addEventListener("click", () => run(node.dataset.run)));
    q("[data-copy]", root).addEventListener("click", () => copy(getOutput(root)));
    run("tohtml");
  });

  T.register("text-diff", (root) => {
    root.innerHTML = `<div class="tp-panel"><div class="tp-cols"><label class="tp-field"><span class="tp-label">Original</span><textarea class="tp-textarea js-left" rows="10"></textarea></label><label class="tp-field"><span class="tp-label">Changed</span><textarea class="tp-textarea js-right" rows="10"></textarea></label></div><div class="tp-actions"><button type="button" class="tp-btn tp-btn-primary" data-run>Compare</button><button type="button" class="tp-btn tp-btn-ghost" data-copy>Copy diff</button></div><div class="tp-chips-inline js-stats"></div><div class="tp-output js-out"></div></div>`;
    let plain = "";
    q("[data-run]", root).addEventListener("click", () => {
      try {
        const ops = diffLines(q(".js-left", root).value, q(".js-right", root).value);
        const stats = { added: 0, removed: 0, same: 0 };
        ops.forEach(([kind]) => { if (kind === "+") stats.added += 1; else if (kind === "-") stats.removed += 1; else stats.same += 1; });
        q(".js-stats", root).replaceChildren(
          el("span", { class: "tp-pill is-good", text: `+ ${stats.added} added` }),
          el("span", { class: "tp-pill is-bad", text: `− ${stats.removed} removed` }),
          el("span", { class: "tp-pill", text: `${stats.same} unchanged` }));
        const container = q(".js-out", root);
        container.replaceChildren(...ops.map(([kind, line]) => el("div", { class: `tp-diff-line ${kind === "+" ? "is-add" : kind === "-" ? "is-del" : ""}` },
          el("span", { class: "tp-diff-mark", text: kind }), line || " ")));
        plain = ops.map(([kind, line]) => `${kind} ${line}`).join("\n");
      } catch (error) { setStatus(root, error.message, "error"); }
    });
    q("[data-copy]", root).addEventListener("click", () => copy(plain));
  });

  T.register("sql-formatter", (root) => {
    root.innerHTML = `<div class="tp-panel"><label class="tp-field"><span class="tp-label">SQL</span><textarea class="tp-textarea js-in" rows="10" placeholder="select id, name from users where active = 1 order by name"></textarea></label><div class="tp-actions"><button type="button" class="tp-btn tp-btn-primary" data-run="format">Format</button><button type="button" class="tp-btn" data-run="minify">Minify</button><button type="button" class="tp-btn tp-btn-ghost" data-copy>Copy</button></div><label class="tp-field"><span class="tp-label">Result</span><textarea class="tp-textarea is-output js-out" rows="12" readonly></textarea></label></div>`;
    const run = (mode) => {
      const value = q(".js-in", root).value;
      setOutput(root, mode === "format" ? formatSql(value) : value.replace(/\s+/g, " ").replace(/\s*([(),;])\s*/g, "$1 ").trim());
    };
    qa("[data-run]", root).forEach((node) => node.addEventListener("click", () => run(node.dataset.run)));
    q("[data-copy]", root).addEventListener("click", () => copy(getOutput(root)));
  });

  const codeTool = (slug, label, beautify, minify, language) => T.register(slug, (root) => {
    root.innerHTML = `<div class="tp-panel"><label class="tp-field"><span class="tp-label">${label} input</span><textarea class="tp-textarea js-in" rows="12" placeholder="Paste ${label} here…"></textarea></label><div class="tp-actions"><button type="button" class="tp-btn tp-btn-primary" data-run="beautify">Beautify</button><button type="button" class="tp-btn" data-run="minify">Minify</button><button type="button" class="tp-btn tp-btn-ghost" data-copy>Copy</button><button type="button" class="tp-btn tp-btn-ghost" data-download>Download</button></div><label class="tp-field"><span class="tp-label">Result</span><textarea class="tp-textarea is-output js-out" rows="14" readonly></textarea></label><p class="tp-hint">Best-effort ${language} formatting; minification preserves strings and comments inside them.</p></div>`;
    const run = (mode) => {
      const value = q(".js-in", root).value;
      if (!value.trim()) return setStatus(root, "Paste some code first.", "error");
      try {
        setOutput(root, mode === "beautify" ? beautify(value) : minify(value));
        setStatus(root, mode === "beautify" ? "Formatted." : "Minified.", "ok");
      } catch (error) { setStatus(root, error.message, "error"); }
    };
    qa("[data-run]", root).forEach((node) => node.addEventListener("click", () => run(node.dataset.run)));
    q("[data-copy]", root).addEventListener("click", () => copy(getOutput(root)));
    q("[data-download]", root).addEventListener("click", () => T.download(`formatted.${language}`, getOutput(root), "text/plain"));
  });
  codeTool("css-beautifier-minifier", "CSS", beautifyCss, minifyCss, "css");
  codeTool("html-beautifier-minifier", "HTML", beautifyHtml, minifyHtml, "html");
  codeTool("javascript-beautifier-minifier", "JavaScript", beautifyJs, minifyJs, "js");

  const singleHashTool = (slug, algorithm, label) => T.register(slug, (root) => {
    root.innerHTML = `<div class="tp-panel"><div class="js-file-slot"></div><label class="tp-field"><span class="tp-label">Or hash text</span><textarea class="tp-textarea js-in" rows="6" placeholder="Type text to hash…"></textarea></label><div class="tp-actions"><button type="button" class="tp-btn tp-btn-primary" data-run>Generate ${label}</button><button type="button" class="tp-btn tp-btn-ghost" data-copy>Copy</button></div><div class="tp-output js-out"></div></div>`;
    const show = (value, note) => { q(".js-out", root).textContent = value; setStatus(root, note, "ok"); };
    const run = async () => {
      try { show(await hashBytes(algorithm, new TextEncoder().encode(q(".js-in", root).value)), `${label} generated.`); }
      catch (error) { setStatus(root, error.message, "error"); }
    };
    q("[data-run]", root).addEventListener("click", run);
    const drop = fileDrop({ accept: "", label: `Drop a file to hash with ${label}`, onFiles: async ([file]) => {
      try { show(await hashBytes(algorithm, new Uint8Array(await readFile(file, "buffer"))), `${file.name} · ${fmtBytes(file.size)}`); }
      catch (error) { setStatus(root, error.message, "error"); }
    }});
    q(".js-file-slot", root).append(drop.node);
    q("[data-copy]", root).addEventListener("click", () => copy(q(".js-out", root).textContent));
    q(".js-in", root).addEventListener("input", T.debounce(run, 260));
  });
  singleHashTool("md5", "MD5", "MD5");
  singleHashTool("sha1", "SHA-1", "SHA-1");
  singleHashTool("sha256", "SHA-256", "SHA-256");
  singleHashTool("sha512", "SHA-512", "SHA-512");

  T.register("hash-generator", (root) => {
    root.innerHTML = `<div class="tp-panel"><div class="js-file-slot"></div><label class="tp-field"><span class="tp-label">Or hash text</span><textarea class="tp-textarea js-in" rows="6" placeholder="Type text to hash…"></textarea></label><div class="tp-chips-inline"><label class="tp-pill"><input type="checkbox" class="js-upper"> Uppercase output</label></div><div class="tp-actions"><button type="button" class="tp-btn tp-btn-primary" data-run>Generate all hashes</button><button type="button" class="tp-btn tp-btn-ghost" data-copy>Copy all</button><button type="button" class="tp-btn tp-btn-ghost" data-download>Download</button></div><div class="tp-kv js-out"></div></div>`;
    let last = {};
    const render = async (bytes, note) => {
      const algorithms = [["MD5", "MD5"], ["SHA-1", "SHA-1"], ["SHA-256", "SHA-256"], ["SHA-512", "SHA-512"], ["CRC32", "CRC32"]];
      const results = await Promise.all(algorithms.map(async ([algorithm, label]) => [label, await hashBytes(algorithm, bytes)]));
      const upper = q(".js-upper", root).checked;
      last = Object.fromEntries(results.map(([label, value]) => [label, upper ? value.toUpperCase() : value]));
      q(".js-out", root).replaceChildren(...Object.entries(last).map(([label, value]) => el("div", {}, el("span", { text: label }), el("strong", { text: value }))));
      setStatus(root, note, "ok");
    };
    const runText = () => render(new TextEncoder().encode(q(".js-in", root).value), "Hashes generated for the text.");
    q("[data-run]", root).addEventListener("click", () => runText().catch((error) => setStatus(root, error.message, "error")));
    const drop = fileDrop({ accept: "", label: "Drop a file to hash every algorithm", onFiles: async ([file]) => {
      try { await render(new Uint8Array(await readFile(file, "buffer")), `${file.name} · ${fmtBytes(file.size)}`); }
      catch (error) { setStatus(root, error.message, "error"); }
    }});
    q(".js-file-slot", root).append(drop.node);
    q("[data-copy]", root).addEventListener("click", () => copy(Object.entries(last).map(([label, value]) => `${label}: ${value}`).join("\n")));
    q("[data-download]", root).addEventListener("click", () => T.download("hashes.txt", Object.entries(last).map(([label, value]) => `${label}: ${value}`).join("\n"), "text/plain"));
    q(".js-upper", root).addEventListener("change", runText);
  });

  T.register("checksum", (root) => {
    root.innerHTML = `<div class="tp-panel"><div class="js-file-slot"></div><label class="tp-field"><span class="tp-label">Expected checksum</span><input class="tp-input js-expected" placeholder="Paste the published MD5, SHA-1, SHA-256 or SHA-512 hash"></label><div class="tp-actions"><button type="button" class="tp-btn tp-btn-primary" data-run>Verify file</button></div><div class="tp-result-list js-results"></div></div>`;
    let selected = null;
    const drop = fileDrop({ accept: "", label: "Drop the downloaded file", onFiles: ([file]) => { selected = file; setStatus(root, `Ready to verify ${file.name}.`, "info"); }});
    q(".js-file-slot", root).append(drop.node);
    q("[data-run]", root).addEventListener("click", async () => {
      if (!selected) return setStatus(root, "Choose a file first.", "error");
      const expected = q(".js-expected", root).value.trim().replace(/\s+/g, "").toLowerCase();
      if (!expected) return setStatus(root, "Paste the expected checksum first.", "error");
      try {
        const bytes = new Uint8Array(await readFile(selected, "buffer"));
        const algorithms = ["MD5", "SHA-1", "SHA-256", "SHA-512"];
        const results = await Promise.all(algorithms.map(async (algorithm) => [algorithm, await hashBytes(algorithm, bytes)]));
        const match = results.find(([algorithm, value]) => value.length === expected.length && value === expected);
        q(".js-results", root).replaceChildren(...results.map(([algorithm, value]) => {
          const good = value === expected;
          return el("div", { class: "tp-result" },
            el("b", { text: algorithm }), " · ",
            el("span", { class: good ? "tp-pill is-good" : "tp-pill", text: good ? "MATCH" : value }));
        }));
        setStatus(root, match ? `Checksum matches ${match[0]}.` : "No algorithm matches that checksum.", match ? "ok" : "error");
      } catch (error) { setStatus(root, error.message, "error"); }
    });
  });

  const parseTar = (buffer) => {
    const bytes = new Uint8Array(buffer);
    const files = [];
    let offset = 0;
    const readString = (start, length) => new TextDecoder().decode(bytes.subarray(start, start + length)).replace(/\0.*$/, "").trim();
    while (offset + 512 <= bytes.length) {
      const block = bytes.subarray(offset, offset + 512);
      if (block.every((byte) => byte === 0)) break;
      const name = readString(offset, 100);
      const size = parseInt(readString(offset + 124, 12) || "0", 8) || 0;
      const type = String.fromCharCode(bytes[offset + 156] || 48);
      const prefix = readString(offset + 345, 155);
      const full = prefix ? `${prefix}/${name}` : name;
      offset += 512;
      const data = bytes.slice(offset, offset + size);
      offset += Math.ceil(size / 512) * 512;
      if ((type === "0" || type === "\0" || type === "") && full) files.push({ name: full.replace(/^\.\//, ""), data });
    }
    return files;
  };
  const renderArchive = (root, files, title) => {
    const list = q(".js-files", root);
    list.replaceChildren(...files.slice(0, 500).map((file) => el("div", { class: "tp-file-row" },
      el("strong", { text: file.name }), el("span", { text: fmtBytes(file.data.length) }),
      el("button", { type: "button", class: "tp-btn tp-btn-sm", onclick: () => T.download(safeName(file.name.split("/").pop()), new Blob([file.data])) }, "Save"))));
    setStatus(root, `${title}: ${files.length} file${files.length === 1 ? "" : "s"} found.`, "ok");
    return files;
  };

  T.register("untar", (root) => {
    root.innerHTML = `<div class="tp-panel"><div class="js-file-slot"></div><div class="tp-actions"><button type="button" class="tp-btn" data-all disabled>Download all as ZIP</button></div><div class="tp-file-list js-files"></div></div>`;
    let files = [];
    const drop = fileDrop({ accept: ".tar,.gz,.tgz,application/x-tar,application/gzip", label: "Drop a .tar, .tar.gz or .tgz file", onFiles: async ([file]) => {
      try {
        let buffer = new Uint8Array(await readFile(file, "buffer"));
        if (buffer[0] === 0x1f && buffer[1] === 0x8b) buffer = fflate.gunzipSync(buffer);
        files = parseTar(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
        renderArchive(root, files, file.name);
        q("[data-all]", root).disabled = !files.length;
      } catch (error) { setStatus(root, `Could not read that archive: ${error.message}`, "error"); }
    }});
    q(".js-file-slot", root).append(drop.node);
    q("[data-all]", root).addEventListener("click", () => {
      if (!files.length) return;
      const entries = Object.fromEntries(files.map((file) => [safeName(file.name), file.data]));
      T.download("extracted-files.zip", new Blob([fflate.zipSync(entries, { level: 6 })], { type: "application/zip" }));
    });
  });

  T.register("unzip", (root) => {
    root.innerHTML = `<div class="tp-panel"><div class="js-file-slot"></div><div class="tp-actions"><button type="button" class="tp-btn" data-all disabled>Extract all as ZIP</button></div><div class="tp-file-list js-files"></div></div>`;
    let files = [];
    const drop = fileDrop({ accept: ".zip,application/zip", label: "Drop a ZIP archive", onFiles: async ([file]) => {
      try {
        const archive = fflate.unzipSync(new Uint8Array(await readFile(file, "buffer")));
        files = Object.entries(archive).filter(([name]) => !name.endsWith("/")).map(([name, data]) => ({ name, data }));
        renderArchive(root, files, file.name);
        q("[data-all]", root).disabled = !files.length;
      } catch (error) { setStatus(root, "That ZIP could not be opened. It may be encrypted or damaged.", "error"); }
    }});
    q(".js-file-slot", root).append(drop.node);
    q("[data-all]", root).addEventListener("click", () => {
      if (!files.length) return;
      const entries = Object.fromEntries(files.map((file) => [file.name, file.data]));
      T.download("extracted-files.zip", new Blob([fflate.zipSync(entries, { level: 6 })], { type: "application/zip" }));
    });
  });

  T.register("zip", (root) => {
    root.innerHTML = `<div class="tp-panel"><div class="js-file-slot"></div><div class="tp-file-list js-files"></div><div class="tp-actions"><button type="button" class="tp-btn tp-btn-primary" data-run disabled>Create ZIP</button><button type="button" class="tp-btn tp-btn-ghost" data-clear disabled>Clear</button></div><p class="tp-hint">Names inside the archive are preserved; a folder picker is available below.</p><label class="tp-drop"><strong>Add a whole folder</strong><span class="tp-hint">The folder name becomes the ZIP root.</span><input type="file" class="js-folder" webkitdirectory hidden></label></div>`;
    const files = [];
    const render = () => {
      q(".js-files", root).replaceChildren(...files.slice(0, 200).map((file) => el("div", { class: "tp-file-row" },
        el("strong", { text: file.name }), el("span", { text: fmtBytes(file.size) }))));
      q("[data-run]", root).disabled = !files.length;
      q("[data-clear]", root).disabled = !files.length;
    };
    const add = (list) => {
      [...list].forEach((file) => {
        const name = file.webkitRelativePath || file.name;
        if (!files.some((item) => item.file === file)) files.push({ file, name, size: file.size });
      });
      render();
      setStatus(root, `${files.length} file${files.length === 1 ? "" : "s"} ready.`, "info");
    };
    const drop = fileDrop({ accept: "", multiple: true, label: "Drop files to compress", onFiles: add });
    q(".js-file-slot", root).append(drop.node);
    q(".js-folder", root).addEventListener("change", (event) => add(event.target.files));
    q("[data-run]", root).addEventListener("click", async () => {
      try {
        const entries = {};
        for (const item of files) entries[item.name] = new Uint8Array(await readFile(item.file, "buffer"));
        const zipped = fflate.zipSync(entries, { level: 6 });
        T.download("sanuwartools-files.zip", new Blob([zipped], { type: "application/zip" }));
        setStatus(root, `ZIP created · ${fmtBytes(zipped.length)}.`, "ok");
      } catch (error) { setStatus(root, `Could not create the ZIP: ${error.message}`, "error"); }
    });
    q("[data-clear]", root).addEventListener("click", () => { files.length = 0; render(); });
  });

  T.register("random-password-generator", (root) => {
    root.innerHTML = `<div class="tp-panel"><div class="tp-cols"><label class="tp-field"><span class="tp-label">Length</span><input class="tp-input" type="number" min="4" max="128" value="20"></label><label class="tp-field"><span class="tp-label">How many?</span><input class="tp-input" type="number" min="1" max="50" value="5"></label></div><div class="tp-chips-inline"><label class="tp-pill"><input type="checkbox" class="js-lower" checked> a-z</label><label class="tp-pill"><input type="checkbox" class="js-upper" checked> A-Z</label><label class="tp-pill"><input type="checkbox" class="js-numbers" checked> 0-9</label><label class="tp-pill"><input type="checkbox" class="js-symbols" checked> Symbols</label><label class="tp-pill"><input type="checkbox" class="js-avoid"> Avoid look-alikes</label></div><div class="tp-actions"><button type="button" class="tp-btn tp-btn-primary" data-run>Generate passwords</button><button type="button" class="tp-btn tp-btn-ghost" data-copy>Copy all</button><button type="button" class="tp-btn tp-btn-ghost" data-download>Download</button></div><div class="tp-kv"><div><span>Entropy each</span><strong class="js-entropy">—</strong></div><div><span>Pool</span><strong class="js-pool">—</strong></div></div><label class="tp-field"><span class="tp-label">Passwords</span><textarea class="tp-textarea is-output js-out" rows="10" readonly></textarea></label></div>`;
    const randomIndex = (length) => {
      const limit = Math.floor(4294967296 / length) * length;
      const buffer = new Uint32Array(1);
      do { crypto.getRandomValues(buffer); } while (buffer[0] >= limit);
      return buffer[0] % length;
    };
    const generate = () => {
      const length = Math.max(4, Math.min(128, Number(q("input[type=number]", root).value) || 20));
      const count = Math.max(1, Math.min(50, Number(qa("input[type=number]", root)[1].value) || 1));
      const sets = [];
      if (q(".js-lower", root).checked) sets.push("abcdefghijklmnopqrstuvwxyz");
      if (q(".js-upper", root).checked) sets.push("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
      if (q(".js-numbers", root).checked) sets.push("0123456789");
      if (q(".js-symbols", root).checked) sets.push("!@#$%^&*()-_=+[]{};:,.?/");
      if (!sets.length) return setStatus(root, "Choose at least one character set.", "error");
      let pool = sets.join("");
      if (q(".js-avoid", root).checked) pool = pool.replace(/[Il1O0o]/g, "");
      if (!pool) return setStatus(root, "That combination leaves no usable characters.", "error");
      const passwords = Array.from({ length: count }, () => {
        const chars = sets.map((set) => set.replace(/[Il1O0o]/g, "")).filter(Boolean).map((set) => set[randomIndex(set.length)]);
        while (chars.length < length) chars.push(pool[randomIndex(pool.length)]);
        for (let index = chars.length - 1; index > 0; index -= 1) { const swap = randomIndex(index + 1); [chars[index], chars[swap]] = [chars[swap], chars[index]]; }
        return chars.join("");
      });
      q(".js-out", root).value = passwords.join("\n");
      q(".js-pool", root).textContent = `${pool.length} chars`;
      q(".js-entropy", root).textContent = `${(Math.log2(pool.length) * length).toFixed(1)} bits`;
      setStatus(root, "Generated with crypto.getRandomValues().", "ok");
    };
    q("[data-run]", root).addEventListener("click", generate);
    q("[data-copy]", root).addEventListener("click", () => copy(getOutput(root)));
    q("[data-download]", root).addEventListener("click", () => T.download("passwords.txt", getOutput(root), "text/plain"));
    generate();
  });

  T.register("basic-auth-header", (root) => {
    root.innerHTML = `<div class="tp-panel"><div class="tp-cols"><label class="tp-field"><span class="tp-label">Username</span><input class="tp-input js-user" autocomplete="off"></label><label class="tp-field"><span class="tp-label">Password</span><input class="tp-input js-pass" type="password" autocomplete="off"></label></div><div class="tp-actions"><button type="button" class="tp-btn tp-btn-primary" data-run="encode">Encode header</button><button type="button" class="tp-btn tp-btn-ghost" data-copy>Copy</button></div><label class="tp-field"><span class="tp-label">Authorization header</span><textarea class="tp-textarea is-output js-out" rows="4" readonly></textarea></label><div class="tp-panel"><label class="tp-field"><span class="tp-label">Decode a Basic header</span><input class="tp-input js-decode" placeholder="Authorization: Basic dXNlcjpwYXNz"></label><div class="tp-actions"><button type="button" class="tp-btn" data-run="decode">Decode</button></div><div class="tp-output js-decoded"></div></div>`;
    const encode = () => {
      const user = q(".js-user", root).value;
      const pass = q(".js-pass", root).value;
      if (!user && !pass) return setStatus(root, "Enter a username and password.", "error");
      setOutput(root, `Authorization: Basic ${bytesB64(new TextEncoder().encode(`${user}:${pass}`))}`);
    };
    q("[data-run='encode']", root).addEventListener("click", encode);
    q("[data-run='decode']", root).addEventListener("click", () => {
      try {
        const raw = q(".js-decode", root).value.replace(/^Authorization:\s*Basic\s+/i, "").trim();
        q(".js-decoded", root).textContent = new TextDecoder().decode(b64Bytes(raw));
      } catch { q(".js-decoded", root).textContent = "That is not a valid Basic header."; }
    });
    q("[data-copy]", root).addEventListener("click", () => copy(getOutput(root)));
  });

  const ITOA64 = "./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const to64 = (b2, b1, b0, count) => {
    let value = (b2 << 16) | (b1 << 8) | b0;
    let out = "";
    for (let index = 0; index < count; index += 1) { out += ITOA64[value & 0x3f]; value >>>= 6; }
    return out;
  };
  const apr1 = (password, saltValue) => {
    const salt = (saltValue || Array.from({ length: 8 }, () => ITOA64[Math.floor(Math.random() * 64)]).join("")).slice(0, 8);
    const pw = new TextEncoder().encode(password);
    const saltBytes = new TextEncoder().encode(salt);
    let context = concat(pw, new TextEncoder().encode("$apr1$"), saltBytes);
    let final = md5Bytes(concat(pw, saltBytes, pw));
    for (let remaining = pw.length; remaining > 0; remaining -= 16) context = concat(context, final.slice(0, Math.min(remaining, 16)));
    for (let bits = pw.length; bits > 0; bits >>= 1) context = concat(context, new Uint8Array([(bits & 1) ? 0 : pw[0]]));
    final = md5Bytes(context);
    for (let round = 0; round < 1000; round += 1) {
      const parts = [];
      parts.push((round & 1) ? pw : final);
      if (round % 3) parts.push(saltBytes);
      if (round % 7) parts.push(pw);
      parts.push((round & 1) ? final : pw);
      final = md5Bytes(concat(...parts));
    }
    return "$apr1$" + salt + "$" + to64(final[0], final[6], final[12], 4) + to64(final[1], final[7], final[13], 4)
      + to64(final[2], final[8], final[14], 4) + to64(final[3], final[9], final[15], 4)
      + to64(final[4], final[10], final[5], 4) + to64(0, 0, final[11], 2);
  };

  T.register("htpasswd-generator", (root) => {
    root.innerHTML = `<div class="tp-panel"><div class="tp-cols"><label class="tp-field"><span class="tp-label">Username</span><input class="tp-input js-user" autocomplete="off" placeholder="admin"></label><label class="tp-field"><span class="tp-label">Password</span><input class="tp-input js-pass" type="password" autocomplete="off"></label></div><div class="tp-cols"><label class="tp-field"><span class="tp-label">Algorithm</span><select class="tp-select js-algo"><option value="bcrypt">bcrypt (Apache 2.4+)</option><option value="apr1">APR1 (MD5)</option><option value="sha1">SHA-1 ({SHA})</option><option value="plain">Plain text</option></select></label><label class="tp-field"><span class="tp-label">bcrypt rounds</span><input class="tp-input" type="number" min="8" max="12" value="10"></label></div><div class="tp-actions"><button type="button" class="tp-btn tp-btn-primary" data-run>Generate entry</button><button type="button" class="tp-btn tp-btn-ghost" data-copy>Copy</button></div><label class="tp-field"><span class="tp-label">.htpasswd entry</span><textarea class="tp-textarea is-output js-out" rows="5" readonly></textarea></label><p class="tp-hint">Keep the output file outside your public web root. bcrypt is the safest option for new deployments.</p></div>`;
    q("[data-run]", root).addEventListener("click", async () => {
      const user = q(".js-user", root).value.trim();
      const pass = q(".js-pass", root).value;
      if (!/^[A-Za-z0-9._-]{1,64}$/.test(user)) return setStatus(root, "Use letters, numbers, dots, underscores or hyphens in the username.", "error");
      if (!pass) return setStatus(root, "Enter a password.", "error");
      const algorithm = q(".js-algo", root).value;
      try {
        let hash = "";
        if (algorithm === "bcrypt") {
          const rounds = Math.max(8, Math.min(12, Number(q("input[type=number]", root).value) || 10));
          hash = dcodeIO.bcrypt.hashSync(pass, dcodeIO.bcrypt.genSaltSync(rounds));
        } else if (algorithm === "apr1") hash = apr1(pass);
        else if (algorithm === "sha1") hash = `{SHA}${bytesB64(new Uint8Array(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(pass))))}`;
        else hash = pass;
        setOutput(root, `${user}:${hash}`);
        setStatus(root, `${algorithm.toUpperCase()} hash created.`, "ok");
      } catch (error) { setStatus(root, error.message, "error"); }
    });
    q("[data-copy]", root).addEventListener("click", () => copy(getOutput(root)));
  });
})();
