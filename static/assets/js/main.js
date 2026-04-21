/* ============================================
   SanuwarTools — Main JavaScript
   Homepage logic: load tools, filter, search,
   theme toggle, scroll animations
   ============================================ */

(function () {
  'use strict';

  // ── Config ──────────────────────────────
  const CONFIG_URL = '/tools.config.json';
  const LS_THEME_KEY = 'sanuwartools-theme';
  const LS_CONFIG_KEY = 'sanuwartools-config';

  let siteConfig = null;
  let allTools = [];

  // ── Theme System ────────────────────────
  function initTheme() {
    const saved = localStorage.getItem(LS_THEME_KEY);
    if (saved) {
      document.documentElement.setAttribute('data-theme', saved);
    }
    updateThemeToggleText();
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(LS_THEME_KEY, next);
    updateThemeToggleText();
  }

  function updateThemeToggleText() {
    const btn = document.getElementById('theme-toggle-btn');
    if (!btn) return;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    btn.innerHTML = isDark
      ? '☀️ <span>Switch to Light Theme</span>'
      : '🌙 <span>Switch to Dark Theme</span>';
  }

  // ── Navbar ──────────────────────────────
  function initNavbar() {
    const navbar = document.querySelector('.navbar');
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    const overlay = document.querySelector('.mobile-nav-overlay');
    const menuBtn = document.getElementById('nav-menu-btn');
    const dropdown = document.getElementById('nav-dropdown');
    const themeBtn = document.getElementById('theme-toggle-btn');

    // Scroll effect
    window.addEventListener('scroll', () => {
      navbar.classList.toggle('scrolled', window.scrollY > 20);
    });

    // iOS Safari scroll-lock helpers (overflow:hidden alone doesn't work on iOS)
    let _scrollY = 0;
    function lockBodyScroll() {
      _scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${_scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
    }
    function unlockBodyScroll() {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      window.scrollTo(0, _scrollY);
    }

    // Hamburger toggle — both click & touchstart for instant mobile response
    function toggleMobileNav() {
      const isOpen = navLinks.classList.toggle('mobile-open');
      hamburger.classList.toggle('active', isOpen);
      overlay.classList.toggle('active', isOpen);
      if (isOpen) lockBodyScroll(); else unlockBodyScroll();
    }
    function closeMobileNav() {
      hamburger.classList.remove('active');
      navLinks.classList.remove('mobile-open');
      overlay.classList.remove('active');
      unlockBodyScroll();
    }

    if (hamburger) {
      hamburger.addEventListener('click', toggleMobileNav);
    }

    // Overlay close
    if (overlay) {
      overlay.addEventListener('click', closeMobileNav);
      // touchstart for instant response on iOS
      overlay.addEventListener('touchstart', (e) => {
        e.preventDefault();
        closeMobileNav();
      }, { passive: false });
    }

    // Close mobile nav on link click
    document.querySelectorAll('.nav-links a').forEach(link => {
      link.addEventListener('click', closeMobileNav);
    });

    // Three-dot menu
    if (menuBtn && dropdown) {
      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('open');
      });

      document.addEventListener('click', () => {
        dropdown.classList.remove('open');
      });

      dropdown.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    // Theme toggle
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        toggleTheme();
        dropdown?.classList.remove('open');
      });
    }
  }

  // ── Load Config ─────────────────────────
  async function loadConfig() {
    try {
      // Always fetch fresh from server (no localStorage cache)
      const res = await fetch(CONFIG_URL + '?t=' + Date.now());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      siteConfig = await res.json();

      allTools = siteConfig.tools || [];
      applySiteSettings();
      renderCategories();
      renderTools(allTools.filter(t => t.visible !== false));
      initScrollReveal();
    } catch (err) {
      console.error('Failed to load config:', err);
      showConfigError();
    }
  }

  function applySiteSettings() {
    const site = siteConfig.site || {};
    // Update page title
    document.title = site.name || 'SanuwarTools';

    // Apply default theme if no user preference
    if (!localStorage.getItem(LS_THEME_KEY) && site.defaultTheme) {
      document.documentElement.setAttribute('data-theme', site.defaultTheme);
      updateThemeToggleText();
    }

    // Social links in footer
    const socialContainer = document.getElementById('footer-social');
    if (socialContainer && siteConfig.socialLinks) {
      socialContainer.innerHTML = '';
      const links = siteConfig.socialLinks;
      if (links.github) {
        socialContainer.innerHTML += `<a href="${links.github}" target="_blank" rel="noopener noreferrer" title="GitHub" aria-label="GitHub">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
        </a>`;
      }
      if (links.youtube) {
        socialContainer.innerHTML += `<a href="${links.youtube}" target="_blank" rel="noopener noreferrer" title="YouTube" aria-label="YouTube">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
        </a>`;
      }
      if (links.twitter) {
        socialContainer.innerHTML += `<a href="${links.twitter}" target="_blank" rel="noopener noreferrer" title="Twitter" aria-label="Twitter">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
        </a>`;
      }
      if (links.instagram) {
        socialContainer.innerHTML += `<a href="${links.instagram}" target="_blank" rel="noopener noreferrer" title="Instagram" aria-label="Instagram" style="background:linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
        </a>`;
      }
    }

    // Download page config
    const downloadSection = document.getElementById('download-section');
    const dp = siteConfig.downloadPage || {};
    if (downloadSection && !dp.enabled) {
      downloadSection.style.display = 'none';
    }
  }

  function showConfigError() {
    const grid = document.getElementById('tools-grid');
    if (grid) {
      grid.innerHTML = `
        <div class="no-results">
          <div class="no-results-icon">⚠️</div>
          <p>Unable to load tools. Please check your configuration.</p>
        </div>
      `;
    }
  }

  // ── Render Categories ───────────────────
  function renderCategories() {
    const filterBar = document.getElementById('filter-bar');
    if (!filterBar || !siteConfig.categories) return;

    filterBar.innerHTML = '';
    siteConfig.categories.forEach((cat, i) => {
      const btn = document.createElement('button');
      btn.className = `filter-btn${i === 0 ? ' active' : ''}`;
      btn.textContent = cat;
      btn.dataset.category = cat;
      btn.addEventListener('click', () => filterByCategory(cat, btn));
      filterBar.appendChild(btn);
    });
  }

  // ── Filter & Search ─────────────────────
  function filterByCategory(category, activeBtn) {
    // Update active button
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    activeBtn.classList.add('active');

    const searchTerm = document.getElementById('search-input')?.value.toLowerCase() || '';
    const filtered = allTools.filter(t => {
      if (t.visible === false) return false;
      const matchCat = category === 'All' || t.category === category;
      const matchSearch = !searchTerm ||
        t.name.toLowerCase().includes(searchTerm) ||
        (t.tags && t.tags.some(tag => tag.toLowerCase().includes(searchTerm)));
      return matchCat && matchSearch;
    });

    renderTools(filtered);
  }

  function searchTools(term) {
    const activeCategory = document.querySelector('.filter-btn.active')?.dataset.category || 'All';
    const filtered = allTools.filter(t => {
      if (t.visible === false) return false;
      const matchCat = activeCategory === 'All' || t.category === activeCategory;
      const matchSearch = !term ||
        (t.name || '').toLowerCase().includes(term.toLowerCase()) ||
        (t.description || '').toLowerCase().includes(term.toLowerCase()) ||
        (t.tags && t.tags.some(tag => tag.toLowerCase().includes(term.toLowerCase())));
      return matchCat && matchSearch;
    });

    renderTools(filtered);
  }

  // ── Render Tools Grid ───────────────────
  function renderTools(tools) {
    const grid = document.getElementById('tools-grid');
    if (!grid) return;

    if (tools.length === 0) {
      grid.innerHTML = `
        <div class="no-results">
          <div class="no-results-icon">🔍</div>
          <p>No tools found. Try a different search or filter.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = tools.map(tool => `
      <div class="tool-card reveal" data-id="${tool.id}">
        <div class="tool-card-thumb">
          <img src="${tool.thumbnail}" alt="${tool.name}" loading="lazy" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22250%22 fill=%22%23e8eaf6%22%3E%3Crect width=%22400%22 height=%22250%22/%3E%3Ctext x=%22200%22 y=%22125%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22 fill=%22%236C63FF%22 font-family=%22Inter,sans-serif%22 font-size=%2220%22 font-weight=%22600%22%3E${encodeURIComponent(tool.name)}%3C/text%3E%3C/svg%3E'">
          <span class="tool-card-category">${tool.category}</span>
          ${tool.featured ? '<span class="tool-card-featured">⭐</span>' : ''}
        </div>
        <div class="tool-card-body">
          <h3 class="tool-card-name">${tool.name}</h3>
          <p class="tool-card-desc">${tool.description}</p>
          <div class="tool-card-tags">
            ${(tool.tags || []).map(t => `<span class="tool-tag">${t}</span>`).join('')}
          </div>
          <div class="tool-card-actions">
            <a href="${tool.siteUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-small">🌐 Visit Site</a>
            ${tool.downloadAvailable ? `<a href="/downloads" class="btn btn-secondary btn-small">⬇ Download Hub</a>` : ''}
          </div>
        </div>
      </div>
    `).join('');

    // Re-initialize scroll reveal for new cards
    initScrollReveal();
  }

  // ── Scroll Reveal ───────────────────────
  function initScrollReveal() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -40px 0px'
    });

    document.querySelectorAll('.reveal').forEach(el => {
      if (!el.classList.contains('visible')) {
        observer.observe(el);
      }
    });
  }

  // ── Smooth Scroll ───────────────────────
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.querySelector(link.getAttribute('href'));
        if (target) {
          const navHeight = document.querySelector('.navbar')?.offsetHeight || 70;
          window.scrollTo({
            top: target.offsetTop - navHeight - 20,
            behavior: 'smooth'
          });
        }
      });
    });
  }

  // ── Tool Detail Modal ───────────────────
  function initToolModal() {
    const overlay = document.getElementById('tool-modal-overlay');
    const closeBtn = document.getElementById('tool-modal-close');

    if (!overlay || !closeBtn) return;

    // Delegate click on tool card name for detail modal
    document.addEventListener('click', (e) => {
      const cardName = e.target.closest('.tool-card-name');
      if (cardName) {
        const card = cardName.closest('.tool-card');
        const toolId = card?.dataset.id;
        const tool = allTools.find(t => t.id === toolId);
        if (tool) showToolModal(tool);
      }
    });

    closeBtn.addEventListener('click', () => {
      overlay.classList.remove('open');
      document.body.style.overflow = '';
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('open');
        document.body.style.overflow = '';
      }
    });
  }

  function showToolModal(tool) {
    const overlay = document.getElementById('tool-modal-overlay');
    const modalName = document.getElementById('modal-tool-name');
    const modalDesc = document.getElementById('modal-tool-desc');
    const modalLink = document.getElementById('modal-tool-link');

    if (!overlay) return;

    modalName.textContent = tool.name;
    modalDesc.textContent = tool.longDescription || tool.description;
    modalLink.href = tool.siteUrl;

    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  // ── Search Input ────────────────────────
  function initSearch() {
    const searchInput = document.getElementById('search-input');
    if (!searchInput) return;

    let debounceTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        searchTools(searchInput.value);
      }, 200);
    });
  }

  // ── Initialize ──────────────────────────
  function init() {
    initTheme();
    initNavbar();
    initSmoothScroll();
    initSearch();
    initToolModal();
    loadConfig();
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
