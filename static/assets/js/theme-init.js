'use strict';
(() => {
  try {
    const stored = localStorage.getItem('sanuwartools-theme');
    if (stored === 'light' || stored === 'dark') {
      document.documentElement.dataset.theme = stored;
    }
  } catch {}
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute(
      'content',
      document.documentElement.hasAttribute('data-public-ui')
        ? (document.documentElement.dataset.theme === 'light' ? '#f4f7f5' : '#0c100f')
        : (document.documentElement.dataset.theme === 'light' ? '#fbfaff' : '#0c0817'),
    );
  }
})();
