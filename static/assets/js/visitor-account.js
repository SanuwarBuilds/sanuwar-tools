"use strict";
document.getElementById('visitor-signout').addEventListener('click', async (event) => {
  event.currentTarget.disabled = true;
  try { await ST.api('/api/auth/logout', {method:'POST',body:'{}'}); location.assign('/'); }
  catch (error) { document.getElementById('account-error').textContent=error.message; event.currentTarget.disabled=false; }
});
