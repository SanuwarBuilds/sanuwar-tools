"use strict";
const loginForm = document.querySelector("#login-form");
document
  .querySelector(".password-toggle")
  .addEventListener("click", (event) => {
    const password = loginForm.elements.password;
    const show = password.type === "password";
    password.type = show ? "text" : "password";
    event.target.textContent = show ? "Hide password" : "Show password";
  });
loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = loginForm.querySelector("[type=submit]");
  button.disabled = true;
  document.querySelector("#login-error").textContent = "";
  try {
    await ST.api("/admin/login", {
      method: "POST",
      body: JSON.stringify({
        username: loginForm.elements.username.value,
        password: loginForm.elements.password.value,
      }),
    });
    location.assign("/admin");
  } catch (error) {
    document.querySelector("#login-error").textContent = error.message;
  } finally {
    button.disabled = false;
  }
});
