'use strict';
/* Public interface behaviour: theme labelling, pointer spotlight, mobile nav. */
(() => {
  const root = document.documentElement;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  /* Theme button label mirrors the current theme. */
  const toggle = document.getElementById('theme-toggle');
  const themeColor = document.querySelector('meta[name="theme-color"]');
  const syncThemeLabel = () => {
    if (!toggle) return;
    const dark = root.dataset.theme === 'dark';
    const label = dark ? 'Switch to light theme' : 'Switch to dark theme';
    toggle.setAttribute('aria-label', label);
    toggle.setAttribute('title', label);
    themeColor?.setAttribute('content', dark ? '#0e1012' : '#e7e9eb');
  };
  syncThemeLabel();
  new MutationObserver(syncThemeLabel).observe(root, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });

  /* Mobile navigation: Escape, outside click and resize close the panel. */
  const nav = document.getElementById('site-nav');
  const menu = document.querySelector('.menu-toggle');
  const closeNav = (returnFocus) => {
    if (!nav || !nav.classList.contains('open')) return;
    const restore = returnFocus && nav.contains(document.activeElement);
    nav.classList.remove('open');
    menu?.setAttribute('aria-expanded', 'false');
    if (restore) menu?.focus();
  };
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeNav(true);
  });
  document.addEventListener('click', (event) => {
    if (!nav?.classList.contains('open')) return;
    if (nav.contains(event.target) || menu?.contains(event.target)) return;
    closeNav(false);
  });
  document.addEventListener('focusin', (event) => {
    if (!nav?.classList.contains('open')) return;
    if (nav.contains(event.target) || menu?.contains(event.target)) return;
    closeNav(false);
  });
  matchMedia('(min-width: 901px)').addEventListener('change', (event) => {
    if (event.matches) closeNav(false);
  });
})();
