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
      document.documentElement.dataset.theme === 'light' ? '#f7f7f5' : '#0b0b0c',
    );
  }
})();
