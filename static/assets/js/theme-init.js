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
      document.documentElement.dataset.theme === 'light' ? '#fbfaff' : '#0c0817',
    );
  }
})();
