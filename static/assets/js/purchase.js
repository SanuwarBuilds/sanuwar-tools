"use strict";
(async () => {
  const { el, api, $, toast } = ST;
  const page = $(".purchase-page"),
    root = $("#purchase-content"),
    id = page.dataset.orderId;
  const storageKey = "sanuwar-purchase-";
  let attempts = 0,
    timer;
  function receipt() {
    try {
      return JSON.parse(localStorage.getItem(storageKey + id) || "null");
    } catch {
      return null;
    }
  }
  async function check() {
    clearTimeout(timer);
    const saved = receipt();
    if (!saved?.receipt) {
      root.replaceChildren(
        el(
          "p",
          {},
          "Purchase receipt nahi mili. Apni saved receipt restore karo, ya payment wale browser mein kholo.",
        ),
      );
      return;
    }
    try {
      const order = await api(
        `/api/payments/orders/${encodeURIComponent(id)}`,
        { headers: { Authorization: `Bearer ${saved.receipt}` } },
      );
      const price = new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
      }).format(order.amount_paise / 100);
      const nodes = [
        el("h2", {}, order.title),
        el("p", { class: "purchase-total" }, price),
      ];
      const save = el(
        "button",
        {
          class: "button button-light",
          onclick: () => {
            const blob = URL.createObjectURL(
              new Blob([JSON.stringify({ ...saved, order_id: id }, null, 2)], {
                type: "application/json",
              }),
            );
            const link = el("a", {
              href: blob,
              download: `purchase-${id}.json`,
            });
            link.click();
            setTimeout(() => URL.revokeObjectURL(blob), 1000);
          },
        },
        "Save purchase receipt ↓",
      );
      if (order.status === "PAID") {
        nodes.push(
          el(
            "p",
            { class: "payment-status paid" },
            "✓ Payment verified · Downloads unlocked",
          ),
        );
        const files = el("div", { class: "purchase-files" });
        for (const file of order.files) {
          const button = el(
            "button",
            {
              class: "button button-dark",
              onclick: async () => {
                button.disabled = true;
                try {
                  const result = await api(
                    `/api/payments/orders/${encodeURIComponent(id)}/download`,
                    {
                      method: "POST",
                      headers: { Authorization: `Bearer ${saved.receipt}` },
                      body: JSON.stringify({ index: file.index }),
                    },
                  );
                  const link = ST.url(result.url);
                  if (!link) throw new Error("Download unavailable");
                  location.assign(link);
                } catch (e) {
                  toast(e.message);
                } finally {
                  button.disabled = false;
                }
              },
            },
            "Download ↓",
          );
          files.append(
            el(
              "div",
              { class: "purchase-file" },
              el("span", {}, file.name),
              button,
            ),
          );
        }
        nodes.push(files);
      } else {
        nodes.push(
          el(
            "p",
            { class: "payment-status" },
            "Payment confirmation ka wait hai. Paise debit hue hain toh dobara pay mat karo.",
          ),
        );
        if (order.status === "PENDING" && order.checkout_url)
          nodes.push(
            ST.external(
              order.checkout_url,
              "Continue checkout ↗",
              "button button-dark",
            ),
          );
        nodes.push(
          el(
            "button",
            {
              class: "button button-light",
              onclick: () => {
                attempts = 0;
                check();
              },
            },
            "Check payment status",
          ),
        );
        if (order.status !== "PENDING")
          nodes.push(
            el(
              "p",
              {},
              `Payment ${order.status.toLowerCase()}. Bank mein debit dikhe toh merchant se order ID ke saath contact karo.`,
            ),
          );
        if (order.status === "PENDING" && ++attempts < 150)
          timer = setTimeout(check, 6000);
      }
      nodes.push(save, el("small", { class: "form-note" }, `Order: ${id}`));
      root.replaceChildren(...nodes);
    } catch (e) {
      root.replaceChildren(
        el("p", { role: "alert" }, e.message),
        el(
          "button",
          { class: "button button-light", onclick: check },
          "Try again",
        ),
      );
    }
  }
  $("#restore-receipt").addEventListener("change", async (event) => {
    try {
      const file = event.target.files[0];
      if (!file || file.size > 10000)
        throw new Error("Valid purchase receipt chuno.");
      const saved = JSON.parse(await file.text());
      if (
        !/^[a-f0-9-]{36}$/.test(saved.order_id) ||
        !/^[A-Za-z0-9_-]{40,100}$/.test(saved.receipt)
      )
        throw new Error("Invalid receipt file");
      // Verify possession before storing or navigating.
      const order = await api(`/api/payments/orders/${saved.order_id}`, {
        headers: { Authorization: `Bearer ${saved.receipt}` },
      });
      localStorage.setItem(storageKey + saved.order_id, JSON.stringify(saved));
      localStorage.setItem(
        "sanuwar-item-order-" + order.item_id,
        saved.order_id,
      );
      location.assign(`/purchase/${saved.order_id}`);
    } catch (e) {
      toast(e.message);
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearTimeout(timer);
    else if (id) check();
  });
  if (id) await check();
  else
    root.replaceChildren(
      el(
        "p",
        {},
        "Apni purchase receipt file select karke downloads wapas kholo.",
      ),
    );
})();
