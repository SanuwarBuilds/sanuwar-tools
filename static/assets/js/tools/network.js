"use strict";
(() => {
  const T = window.SANU_TOOLS;
  const { el, readFile, copy } = T;
  const q = (selector, root) => T.$(selector, root);
  const status = (root, message, kind) => T.status(root, message, kind);
  const fullMask = (bits) => (1n << BigInt(bits)) - 1n;
  const maskFor = (bits, prefix) => prefix === 0 ? 0n : (((1n << BigInt(prefix)) - 1n) << BigInt(bits - prefix));
  const hexBig = (value, width) => value.toString(16).padStart(width, "0");
  const numberText = (value) => typeof value === "bigint" ? value.toLocaleString("en-US") : Number(value).toLocaleString("en-US");

  const parseIPv4 = (text) => {
    const parts = String(text).trim().split(".");
    if (parts.length !== 4) throw new Error("IPv4 addresses need four octets, like 192.168.1.10.");
    let value = 0n;
    for (const part of parts) {
      if (!/^\d{1,3}$/.test(part) || Number(part) > 255) throw new Error(`"${part}" is not a valid IPv4 octet.`);
      value = (value << 8n) | BigInt(Number(part));
    }
    return value;
  };
  const formatIPv4 = (value) => [24n, 16n, 8n, 0n].map((shift) => Number((value >> shift) & 255n)).join(".");

  const parseIPv6 = (source) => {
    let text = String(source).trim().replace(/^\[|\]$/g, "").split("%")[0].toLowerCase();
    if (text.includes(".")) {
      const colon = text.lastIndexOf(":");
      if (colon < 0) throw new Error("That IPv6 address is not valid.");
      const v4 = parseIPv4(text.slice(colon + 1));
      text = `${text.slice(0, colon + 1)}${Number(v4 >> 16n).toString(16)}:${Number(v4 & 65535n).toString(16)}`;
    }
    const halves = text.split("::");
    if (halves.length > 2) throw new Error("An IPv6 address can contain :: only once.");
    const left = halves[0] ? halves[0].split(":") : [];
    const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
    const groups = [...left];
    if (halves.length === 2) {
      const missing = 8 - left.length - right.length;
      if (missing < 1) throw new Error("Too many groups for an IPv6 address.");
      for (let index = 0; index < missing; index += 1) groups.push("0");
    }
    groups.push(...right);
    if (groups.length !== 8) throw new Error("IPv6 addresses need eight groups (:: fills the gaps).");
    let value = 0n;
    for (const group of groups) {
      if (!/^[0-9a-f]{1,4}$/.test(group)) throw new Error(`"${group}" is not a valid IPv6 group.`);
      value = (value << 16n) | BigInt(parseInt(group, 16));
    }
    return value;
  };
  const formatIPv6 = (value) => {
    const groups = [];
    for (let shift = 112; shift >= 0; shift -= 16) groups.push(((value >> BigInt(shift)) & 65535n).toString(16));
    let bestStart = -1;
    let bestLength = 0;
    let start = -1;
    let length = 0;
    groups.forEach((group, index) => {
      if (group === "0") { if (start < 0) start = index; length += 1; if (length > bestLength) { bestLength = length; bestStart = start; } }
      else { start = -1; length = 0; }
    });
    if (bestLength < 2) return groups.join(":");
    const before = groups.slice(0, bestStart).join(":");
    const after = groups.slice(bestStart + bestLength).join(":");
    return `${before}::${after}` || "::";
  };

  const parseCidr = (input) => {
    const text = String(input).trim();
    if (!text) throw new Error("Enter an IP address or CIDR block.");
    const [addressPart, prefixPart] = text.split("/");
    const version = addressPart.includes(":") ? 6 : 4;
    const bits = version === 4 ? 32 : 128;
    const value = version === 4 ? parseIPv4(addressPart) : parseIPv6(addressPart);
    const prefix = prefixPart === undefined ? bits : Number(prefixPart);
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > bits) throw new Error(`Prefix must be between 0 and ${bits}.`);
    return { version, bits, value, prefix };
  };
  const networkInfo = (parsed) => {
    const mask = maskFor(parsed.bits, parsed.prefix);
    const network = parsed.value & mask;
    const wildcard = fullMask(parsed.bits) ^ mask;
    const broadcast = network | wildcard;
    const total = 1n << BigInt(parsed.bits - parsed.prefix);
    let firstHost = network;
    let lastHost = broadcast;
    let usable = total;
    if (parsed.version === 4) {
      if (parsed.prefix <= 30) { firstHost = network + 1n; lastHost = broadcast - 1n; usable = total - 2n; }
      else if (parsed.prefix === 31) { firstHost = network; lastHost = broadcast; usable = 2n; }
      else { firstHost = network; lastHost = network; usable = 1n; }
    }
    return { mask, network, wildcard, broadcast, total, firstHost, lastHost, usable };
  };
  const formatIp = (version, value) => version === 4 ? formatIPv4(value) : formatIPv6(value);
  const ipKind = (parsed) => {
    if (parsed.version === 6) {
      const top = parsed.value >> 121n;
      if (parsed.value === 1n) return "Loopback";
      if (top === 126n) return "Unique local (private)";
      if ((parsed.value >> 118n) === 1018n) return "Link-local";
      if (parsed.value === 0n) return "Unspecified";
      return "Global unicast";
    }
    const value = Number(parsed.value);
    const blocks = [[10, 8], [172, 12], [192, 168, 16], [127, 8], [169, 254, 16], [100, 64, 10], [0, 8], [192, 0, 2, 24], [198, 51, 100, 24], [203, 0, 113, 24]];
    for (const block of blocks) {
      const address = ((block[0] << 24) | ((block[2] || 0) << 16) | ((block[3] || 0) << 8) | (block[4] || 0)) >>> 0;
      const prefix = block.length === 5 ? block[4] : block[1];
      const maskValue = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
      if ((value & maskValue) === (address & maskValue)) return prefix === 8 && block[0] === 127 ? "Loopback" : prefix === 8 && block[0] === 0 ? "Unspecified" : "Private / special";
    }
    return "Public";
  };
  const copyButton = (getText, label = "Copy summary") => T.button(label, () => copy(getText()), "ghost");

  T.register("ip-calculator", (root) => {
    root.innerHTML = `<div class="tp-panel"><label class="tp-field"><span class="tp-label">IP address or CIDR</span><input class="tp-input js-ip" value="192.168.1.10/24" spellcheck="false"></label><div class="tp-actions"><button type="button" class="tp-btn tp-btn-primary" data-run>Calculate</button><button type="button" class="tp-btn tp-btn-ghost" data-copy>Copy summary</button></div><div class="tp-kv js-out"></div></div>`;
    let summary = "";
    const run = () => {
      try {
        const parsed = parseCidr(q(".js-ip", root).value);
        const info = networkInfo(parsed);
        const rows = [
          ["CIDR", `${formatIp(parsed.version, parsed.value)}/${parsed.prefix}`],
          ["Version", `IPv${parsed.version}`],
          ["Network", formatIp(parsed.version, info.network)],
          ["Netmask", parsed.version === 4 ? formatIPv4(info.mask) : `/${parsed.prefix} (${formatIPv6(info.mask)})`],
          ["Wildcard", parsed.version === 4 ? formatIPv4(info.wildcard) : formatIPv6(info.wildcard)],
          [parsed.version === 4 ? "Broadcast" : "Last address", formatIp(parsed.version, info.broadcast)],
          ["First host", formatIp(parsed.version, info.firstHost)],
          ["Last host", formatIp(parsed.version, info.lastHost)],
          ["Total addresses", info.total.toLocaleString("en-US")],
          ["Usable hosts", info.usable.toLocaleString("en-US")],
          ["Type", ipKind(parsed)],
        ];
        if (parsed.version === 4) rows.push(["Binary", formatIPv4(info.network).split(".").map((octet) => Number(octet).toString(2).padStart(8, "0")).join(".")]);
        else rows.push(["Expanded", Array.from({ length: 8 }, (_, index) => ((info.network >> BigInt((7 - index) * 16)) & 65535n).toString(16).padStart(4, "0")).join(":")]);
        q(".js-out", root).replaceChildren(...rows.map(([label, value]) => el("div", {}, el("span", { text: label }), el("strong", { text: value }))));
        summary = rows.map(([label, value]) => `${label}: ${value}`).join("\n");
        status(root, "Calculated.", "ok");
      } catch (error) { q(".js-out", root).replaceChildren(); summary = ""; status(root, error.message, "error"); }
    };
    q("[data-run]", root).addEventListener("click", run);
    q("[data-copy]", root).addEventListener("click", () => copy(summary));
    q(".js-ip", root).addEventListener("keydown", (event) => { if (event.key === "Enter") run(); });
    run();
  });

  const makeTable = (columns) => {
    const wrap = el("div", { class: "tp-table-wrap" });
    const table = el("table", { class: "tp-table" }, el("thead", {}, el("tr", {}, ...columns.map((column) => el("th", { text: column })))), el("tbody"));
    wrap.append(table);
    return { wrap, body: table.querySelector("tbody") };
  };
  const renderRows = (body, rows) => body.replaceChildren(...rows.map((row) => el("tr", {}, ...row.map((cell) => el("td", { text: String(cell) })))));
  const searchBox = (placeholder) => {
    const label = el("label", { class: "tp-search" }, el("span", { "aria-hidden": "true", text: "⌕" }), el("input", { type: "search", placeholder }));
    return label;
  };

  T.register("ipv4-cidr", (root) => {
    root.innerHTML = `<div class="tp-panel"><div class="tp-cols"><label class="tp-field"><span class="tp-label">Base address</span><input class="tp-input js-base" value="192.168.1.0"></label><label class="tp-field"><span class="tp-label">Filter prefix</span><input class="tp-input js-filter" type="search" placeholder="/24"></label></div><div class="js-table"></div><p class="tp-hint">Usable hosts exclude the network and broadcast addresses for /0–/30. /31 and /32 follow modern point-to-point and host-route rules.</p></div>`;
    const { wrap, body } = makeTable(["Prefix", "Netmask", "Wildcard", "Addresses", "Usable", "Network", "Broadcast"]);
    q(".js-table", root).append(wrap);
    const draw = () => {
      try {
        const base = parseIPv4(q(".js-base", root).value);
        const filter = q(".js-filter", root).value.trim().replace("/", "");
        const rows = [];
        for (let prefix = 0; prefix <= 32; prefix += 1) {
          if (filter && String(prefix) !== filter) continue;
          const info = networkInfo({ version: 4, bits: 32, value: base, prefix });
          rows.push([`/${prefix}`, formatIPv4(info.mask), formatIPv4(info.wildcard), info.total.toLocaleString("en-US"), info.usable.toLocaleString("en-US"), formatIPv4(info.network), formatIPv4(info.broadcast)]);
        }
        renderRows(body, rows);
      } catch (error) { status(root, error.message, "error"); }
    };
    q(".js-base", root).addEventListener("input", T.debounce(draw, 200));
    q(".js-filter", root).addEventListener("input", draw);
    draw();
  });

  T.register("ipv6-cidr", (root) => {
    root.innerHTML = `<div class="tp-panel"><label class="tp-field"><span class="tp-label">Filter prefix</span><input class="tp-input js-filter" type="search" placeholder="/64"></label><div class="js-table"></div><p class="tp-hint">IPv6 has no broadcast address; every address in a block is part of the address space.</p></div>`;
    const { wrap, body } = makeTable(["Prefix", "Mask", "Addresses", "Power of two"]);
    q(".js-table", root).append(wrap);
    const draw = () => {
      const filter = q(".js-filter", root).value.trim().replace("/", "");
      const rows = [];
      for (let prefix = 0; prefix <= 128; prefix += 1) {
        if (filter && String(prefix) !== filter) continue;
        const total = 1n << BigInt(128 - prefix);
        const abbreviated = total.toString().length > 16 ? `${(total.toString().slice(0, 4))}… (${total.toString().length} digits)` : total.toLocaleString("en-US");
        rows.push([`/${prefix}`, prefix === 0 ? "::" : formatIPv6(maskFor(128, prefix)), abbreviated, `2^${128 - prefix}`]);
      }
      renderRows(body, rows);
    };
    q(".js-filter", root).addEventListener("input", draw);
    draw();
  });

  T.register("ip-to-ptr", (root) => {
    root.innerHTML = `<div class="tp-panel"><label class="tp-field"><span class="tp-label">IPv4 or IPv6 address</span><textarea class="tp-textarea js-in" rows="5" placeholder="192.0.2.10&#10;2001:db8::1"></textarea></label><div class="tp-actions"><button type="button" class="tp-btn tp-btn-primary" data-run>Build PTR names</button><button type="button" class="tp-btn tp-btn-ghost" data-copy>Copy</button></div><div class="tp-output js-out"></div></div>`;
    const run = () => {
      const lines = q(".js-in", root).value.split(/\s+/).filter(Boolean);
      if (!lines.length) return status(root, "Add at least one IP address.", "error");
      const out = [];
      for (const line of lines) {
        try {
          const [address] = line.split("/");
          if (address.includes(":")) {
            const value = parseIPv6(address);
            const nibbles = hexBig(value, 32).split("").reverse().join(".");
            out.push(`${nibbles}.ip6.arpa`);
          } else out.push(`${formatIPv4(parseIPv4(address)).split(".").reverse().join(".")}.in-addr.arpa`);
        } catch (error) { out.push(`${line}: ${error.message}`); }
      }
      q(".js-out", root).textContent = out.join("\n");
      status(root, `${out.length} PTR name${out.length === 1 ? "" : "s"} generated.`, "ok");
    };
    q("[data-run]", root).addEventListener("click", run);
    q("[data-copy]", root).addEventListener("click", () => copy(q(".js-out", root).textContent));
  });

  const randomBigInt = (range) => {
    if (range <= 0n) throw new Error("The range is empty.");
    const bits = range.toString(2).length;
    const bytes = Math.ceil(bits / 8);
    for (let attempt = 0; attempt < 10000; attempt += 1) {
      const buffer = crypto.getRandomValues(new Uint8Array(bytes));
      let value = 0n;
      for (const byte of buffer) value = (value << 8n) | BigInt(byte);
      value &= (1n << BigInt(bits)) - 1n;
      if (value < range) return value;
    }
    throw new Error("Could not generate a random value in this range.");
  };

  T.register("random-ip-generator", (root) => {
    root.innerHTML = `<div class="tp-panel"><div class="tp-cols"><label class="tp-field"><span class="tp-label">CIDR range</span><input class="tp-input js-cidr" value="192.168.0.0/24"></label><label class="tp-field"><span class="tp-label">How many?</span><input class="tp-input" type="number" min="1" max="1000" value="20"></label></div><div class="tp-chips-inline"><label class="tp-pill"><input type="checkbox" class="js-usable" checked> Exclude network / broadcast</label><label class="tp-pill"><input type="checkbox" class="js-dedupe" checked> Unique values</label></div><div class="tp-actions"><button type="button" class="tp-btn tp-btn-primary" data-run>Generate</button><button type="button" class="tp-btn tp-btn-ghost" data-copy>Copy</button><button type="button" class="tp-btn tp-btn-ghost" data-download>Download</button></div><label class="tp-field"><span class="tp-label">Addresses</span><textarea class="tp-textarea is-output js-out" rows="12" readonly></textarea></label></div>`;
    const generate = () => {
      try {
        const parsed = parseCidr(q(".js-cidr", root).value);
        const info = networkInfo(parsed);
        const count = Math.max(1, Math.min(1000, Number(q("input[type=number]", root).value) || 1));
        let min = info.network;
        let max = info.broadcast;
        if (parsed.version === 4 && q(".js-usable", root).checked && parsed.prefix <= 30) { min = info.network + 1n; max = info.broadcast - 1n; }
        if (q(".js-usable", root).checked && parsed.version === 6 && parsed.prefix < 128) { min = info.network + 1n; }
        const range = max - min + 1n;
        if (range <= 0n) throw new Error("No usable addresses in this range.");
        if (q(".js-dedupe", root).checked && range < BigInt(count)) throw new Error("The range is smaller than the requested count.");
        const values = new Set();
        const results = [];
        let guard = 0;
        while (results.length < count && guard < count * 200 + 1000) {
          guard += 1;
          const value = min + randomBigInt(range);
          const key = value.toString();
          if (q(".js-dedupe", root).checked && values.has(key)) continue;
          values.add(key);
          results.push(formatIp(parsed.version, value));
        }
        q(".js-out", root).value = results.join("\n");
        status(root, `${results.length} random IPv${parsed.version} address${results.length === 1 ? "" : "es"} generated.`, "ok");
      } catch (error) { q(".js-out", root).value = ""; status(root, error.message, "error"); }
    };
    q("[data-run]", root).addEventListener("click", generate);
    q("[data-copy]", root).addEventListener("click", () => copy(q(".js-out", root).value));
    q("[data-download]", root).addEventListener("click", () => T.download("random-ip.txt", q(".js-out", root).value, "text/plain"));
    generate();
  });

  const referenceTool = (root, config) => {
    root.innerHTML = `<div class="tp-panel"><div class="tp-cols"><label class="tp-field"><span class="tp-label">Search</span><input class="tp-input js-search" type="search" placeholder="${config.placeholder}"></label>${config.filter ? `<label class="tp-field"><span class="tp-label">Show</span><select class="tp-select js-filter">${config.filter.map((item) => `<option value="${item[0]}">${item[1]}</option>`).join("")}</select></label>` : ""}</div><div class="tp-chips-inline js-count"></div><div class="js-table"></div></div>`;
    const { wrap, body } = makeTable(config.columns);
    q(".js-table", root).append(wrap);
    let rows = [];
    const draw = () => {
      const query = q(".js-search", root).value.trim().toLowerCase();
      const filter = q(".js-filter", root)?.value || "";
      const visible = rows.filter((row) => {
        const text = row.join(" ").toLowerCase();
        return (!query || text.includes(query)) && (!filter || row._filter === filter || filter === "all");
      });
      renderRows(body, visible.slice(0, 900));
      q(".js-count", root).replaceChildren(el("span", { class: "tp-pill", text: `${visible.length.toLocaleString("en-US")} entries` }));
    };
    q(".js-search", root).addEventListener("input", T.debounce(draw, 150));
    q(".js-filter", root)?.addEventListener("change", draw);
    T.fetchJSON(config.source).then((data) => {
      rows = data.map((item) => {
        const cells = config.map(item);
        cells._filter = item.type || item.description || item.status || "";
        return cells;
      });
      draw();
    }).catch((error) => status(root, `Could not load the reference data: ${error.message}`, "error"));
  };

  T.register("root-zone-database", (root) => referenceTool(root, {
    source: "/assets/data/tlds.json",
    columns: ["TLD", "Type"],
    placeholder: "Search .com, .in, .app…",
    filter: [["all", "All types"], ["gTLD", "gTLD"], ["ccTLD", "ccTLD"], ["IDN", "IDN"], ["Infrastructure", "Infrastructure"]],
    map: (item) => [`.${item.tld.toLowerCase()}`, item.type],
  }));

  T.register("asn-assignments", (root) => referenceTool(root, {
    source: "/assets/data/asn-blocks.json",
    columns: ["ASN range", "Description", "Registration date"],
    placeholder: "Search ASN, registry, RFC…",
    filter: [["all", "All blocks"], ["16", "16-bit"], ["32", "32-bit"]],
    map: (item) => {
      const row = [item.range, item.description || "—", item.date || "—"];
      row._filter = item.start < 65536 && item.end < 65536 ? "16" : "32";
      return row;
    },
  }));

  T.register("ipv4-address-space", (root) => referenceTool(root, {
    source: "/assets/data/ipv4-space.json",
    columns: ["Prefix", "Designation", "Status", "Date", "Note"],
    placeholder: "Search /8 block, registry, status…",
    filter: [["all", "All statuses"], ["ALLOCATED", "Allocated"], ["RESERVED", "Reserved"], ["LEGACY", "Legacy"]],
    map: (item) => [item.prefix, item.designation, item.status || "—", item.date || "—", item.note || "—"],
  }));

  T.register("ipv6-address-space", (root) => referenceTool(root, {
    source: "/assets/data/ipv6-space.json",
    columns: ["Prefix", "Designation", "Status", "Date", "Note"],
    placeholder: "Search 2001::, registry, status…",
    filter: [["all", "All statuses"], ["ALLOCATED", "Allocated"], ["RESERVED", "Reserved"]],
    map: (item) => [item.prefix, item.designation, item.status || "—", item.date || "—", item.note || "—"],
  }));
})();
