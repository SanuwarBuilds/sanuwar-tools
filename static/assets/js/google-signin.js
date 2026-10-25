"use strict";
window.addEventListener('load', () => {
  const config = document.getElementById('google-signin-config');
  const error = document.getElementById('signin-error');
  const retry = document.getElementById('signin-retry');
  const loading = document.getElementById('google-signin-loading');
  retry.addEventListener('click', () => location.reload());
  const fail = (message) => { loading.hidden = true; error.textContent = message; retry.hidden = false; };
  if (!window.google?.accounts?.id) {
    fail('Google sign-in did not load. Check your connection or browser settings, then retry.');
    return;
  }
  google.accounts.id.initialize({
    client_id: config.dataset.clientId,
    nonce: config.dataset.nonce,
    auto_select: false,
    callback: async (response) => {
      if (!response.credential) return fail('Google did not return a credential. Please retry.');
      error.textContent = '';
      try {
        const result = await ST.api('/api/auth/google', {method:'POST', body:JSON.stringify({credential:response.credential})});
        location.assign(result.redirect);
      } catch (problem) { fail(problem.message); }
    },
  });
  loading.hidden = true;
  google.accounts.id.renderButton(document.getElementById('google-signin-button'), {
    theme:'outline', size:'large', shape:'rectangular', text:'continue_with', width:280,
  });
});
