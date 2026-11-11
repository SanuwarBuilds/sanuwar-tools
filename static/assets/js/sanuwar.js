'use strict';
/* Public interface behaviour: theme labelling, pointer spotlight, mobile nav. */
(() => {
  const root = document.documentElement;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  /* Boot plate: dismissed once the page is ready. */
  const boot = document.getElementById('bp-boot');
  if (boot) {
    if (root.classList.contains('bp-booting')) {
      const status = document.getElementById('bp-boot-status');
      const messages = ['Checking modules…', 'Loading archive…', 'Ready.'];
      const started = performance.now();
      let step = 0;
      let done = false;
      const cycle = window.setInterval(() => {
        step = Math.min(step + 1, messages.length - 1);
        if (status) status.textContent = messages[step];
      }, 650);
      const finish = () => {
        if (done) return;
        done = true;
        window.clearInterval(cycle);
        if (status) status.textContent = messages[messages.length - 1];
        boot.classList.add('is-done');
        root.classList.remove('bp-booting');
        window.setTimeout(() => boot.remove(), 450);
      };
      const settle = () => window.setTimeout(finish, Math.max(0, 800 - (performance.now() - started)));
      if (document.readyState === 'complete') settle();
      else window.addEventListener('load', settle, { once: true });
      window.setTimeout(finish, 3800);
    } else {
      boot.remove();
    }
  } else {
    root.classList.remove('bp-booting');
  }

  /* Theme button label mirrors the current theme. */
  const toggle = document.getElementById('theme-toggle');
  const themeColor = document.querySelector('meta[name="theme-color"]');
  const syncThemeLabel = () => {
    if (!toggle) return;
    const dark = root.dataset.theme === 'dark';
    const label = dark ? 'Switch to light theme' : 'Switch to dark theme';
    toggle.setAttribute('aria-label', label);
    toggle.setAttribute('title', label);
    themeColor?.setAttribute('content', dark ? '#2b2e32' : '#e8e8e8');
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

  /* Scroll reveal: only below-the-fold blocks, and only when motion is safe. */
  const revealTargets = [
    ...document.querySelectorAll(
      'main .bp-section:not(.bp-hero), main .photo-guide, main .photo-guidance, main .visitor-card, main .information-page',
    ),
  ];
  if (
    !reduceMotion.matches &&
    'IntersectionObserver' in window &&
    revealTargets.length
  ) {
    root.classList.add('bp-motion');
    const reveal = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-revealed');
          reveal.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.06 },
    );
    revealTargets.forEach((node) => {
      node.dataset.bpReveal = '';
      const box = node.getBoundingClientRect();
      if (box.top < window.innerHeight * 0.92 && box.bottom > 0) {
        node.classList.add('is-revealed');
        return;
      }
      reveal.observe(node);
    });
    reduceMotion.addEventListener('change', (event) => {
      if (!event.matches) return;
      root.classList.remove('bp-motion');
      reveal.disconnect();
    });
  }
})();
