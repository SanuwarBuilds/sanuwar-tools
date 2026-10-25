/* Google's CMP handles consent. This only provides its documented revocation entry. */
(() => {
  const link = document.getElementById('privacy-choices');
  if (!link) return;
  window.googlefc = window.googlefc || {};
  window.googlefc.callbackQueue = window.googlefc.callbackQueue || [];
  window.googlefc.callbackQueue.push({ CONSENT_API_READY: () => {
    if (typeof window.__tcfapi !== 'function') return;
    window.__tcfapi('addEventListener', 0, (data, success) => {
      link.hidden = !(success && data && data.gdprApplies);
    });
  }});
  link.addEventListener('click', (event) => {
    event.preventDefault();
    window.googlefc.callbackQueue.push({ CONSENT_API_READY: () => {
      window.googlefc.showRevocationMessage();
    }});
  });
})();
