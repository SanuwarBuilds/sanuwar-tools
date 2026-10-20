"use strict";
(() => {
  const { $, el } = ST;
  let state = "locked";
  const currency = (value) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(value);
  function render() {
    const free = $("#demo-access").value === "free",
      price = Number($("#demo-price").value),
      discount = Number($("#demo-discount").value),
      total = price - discount;
    const valid =
      free ||
      (Number.isFinite(total) &&
        price >= 1 &&
        price <= 100000 &&
        discount >= 0 &&
        total >= 1);
    $("#demo-price").disabled = $("#demo-discount").disabled = free;
    $("#demo-price-error").textContent = valid
      ? ""
      : "Final price kam se kam ₹1 rakho, ya Free select karo.";
    $("#demo-total").replaceChildren(
      ...(free
        ? [el("span", {}, "Free")]
        : [
            ...(discount > 0 ? [el("del", {}, currency(price))] : []),
            el("strong", {}, currency(Math.max(0, total))),
          ]),
    );
    $("#demo-buy").textContent = free
      ? "Get free samples ↓"
      : `Try checkout · ${currency(Math.max(0, total))} ↗`;
    $("#demo-buy").disabled = !valid || state === "pending";
    $("#demo-simulator").hidden = state !== "pending";
    const unlocked = free || state === "paid";
    $("#demo-status").textContent = free
      ? "Free access · Sample files unlocked."
      : state === "paid"
        ? "✓ Simulated payment verified · Samples unlocked."
        : state === "pending"
          ? "Demo checkout open hai. Neeche success ya failure simulate karo."
          : state === "failed"
            ? "Simulated payment failed · Files locked hain. Dobara checkout try karo."
            : "Files locked hain. Checkout try karo.";
    $("#demo-status").classList.toggle("paid", unlocked);
    $("#demo-files").replaceChildren(
      ...["Welcome.txt", "Creative-checklist.txt"].map((name, index) =>
        el(
          "div",
          { class: "purchase-file" },
          el("span", {}, name),
          el(
            "button",
            {
              class: "button button-light",
              disabled: !unlocked,
              onclick: () => {
                if (!unlocked) return;
                const content = index
                  ? "Creative checklist\n1. Choose your idea\n2. Make something useful\n3. Share your work\n\nSanuwarTools payment demo. No real payment occurred.\n"
                  : "Welcome to SanuwarTools!\nThis is a sample download from the free payment demo.\nNo real payment occurred.\n";
                const blob = URL.createObjectURL(
                  new Blob([content], { type: "text/plain" }),
                );
                el("a", { href: blob, download: name }).click();
                setTimeout(() => URL.revokeObjectURL(blob), 1000);
              },
            },
            unlocked ? "Download sample ↓" : "Locked ⌑",
          ),
        ),
      ),
    );
  }
  $("#demo-pricing").addEventListener("submit", (e) => e.preventDefault());
  $("#demo-pricing").addEventListener("input", () => {
    state = "locked";
    render();
  });
  $("#demo-buy").addEventListener("click", () => {
    state = $("#demo-access").value === "free" ? "paid" : "pending";
    render();
    $("#demo-delivery").scrollIntoView({ behavior: "smooth", block: "center" });
  });
  $("#demo-success").addEventListener("click", () => {
    if (state === "pending") {
      state = "paid";
      render();
    }
  });
  $("#demo-fail").addEventListener("click", () => {
    if (state === "pending") {
      state = "failed";
      render();
    }
  });
  $("#demo-reset").addEventListener("click", () => {
    state = "locked";
    render();
  });
  render();
})();
