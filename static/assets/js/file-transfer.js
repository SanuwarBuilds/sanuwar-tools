"use strict";
(() => {
  const lifetime = 10 * 60_000;
  const targets = new Set(["/photo-tools", "/tools/form-file-checker", "/tools/application-file-pack",
    "/tools/pdf-editor", "/tools/searchable-pdf"]);

  function transaction(action) {
    return new Promise((resolve, reject) => {
      const open = indexedDB.open("sanuwartools-file-transfer", 1);
      open.onupgradeneeded = () => open.result.createObjectStore("files");
      open.onerror = () => reject(open.error);
      open.onblocked = () => reject(new Error("File transfer storage is busy. Close other tool tabs and try again."));
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction("files", "readwrite");
        let answer;
        tx.oncomplete = () => { db.close(); resolve(answer); };
        tx.onabort = () => { db.close(); reject(tx.error); };
        const store = tx.objectStore("files");
        const cursor = store.openCursor();
        cursor.onsuccess = () => {
          const item = cursor.result;
          if (!item) return;
          if (item.value.expires < Date.now()) item.delete();
          item.continue();
        };
        action(store, (value) => { answer = value; });
      };
    });
  }

  async function send(path, blob, name, role) {
    const url = new URL(path, location.origin);
    if (url.origin !== location.origin || !targets.has(url.pathname)) throw new Error("Invalid destination.");
    const token = crypto.randomUUID();
    const bytes = await blob.arrayBuffer();
    await transaction((store) => store.put({ bytes, type: blob.type, name, role,
      path: url.pathname, expires: Date.now() + lifetime }, token));
    url.hash = "file=" + token;
    location.assign(url);
  }

  async function receive() {
    const token = /^#file=([0-9a-f-]{36})$/i.exec(location.hash)?.[1];
    if (!token || !targets.has(location.pathname)) return null;
    const item = await transaction((store, accept) => {
      const get = store.get(token);
      get.onsuccess = () => {
        const entry = get.result;
        if (entry?.path !== location.pathname || entry.expires < Date.now()) return;
        store.delete(token);
        accept(entry);
      };
    });
    history.replaceState(history.state, "", location.pathname + location.search);
    if (!item) throw new Error("The transferred file expired or was already opened. Choose it again.");
    return { file: new File([item.bytes], item.name, { type: item.type }), role: item.role };
  }

  function fill(input, file) {
    const data = new DataTransfer();
    data.items.add(file);
    input.files = data.files;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  window.SanuFileTransfer = { send, receive, fill };
})();
