'use strict';
(() => {
  try {
    if (!sessionStorage.getItem('sanuwartools-booted')) {
      sessionStorage.setItem('sanuwartools-booted', '1');
      document.documentElement.classList.add('bp-booting');
    }
  } catch (error) {
    document.documentElement.classList.remove('bp-booting');
  }
  window.setTimeout(() => {
    document.documentElement.classList.remove('bp-booting');
    document.getElementById('bp-boot')?.remove();
  }, 4200);
})();
