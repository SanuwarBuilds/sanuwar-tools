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
      document.documentElement.dataset.theme === 'light' ? '#e8e8e8' : '#2b2e32',
    );
  }
})();
