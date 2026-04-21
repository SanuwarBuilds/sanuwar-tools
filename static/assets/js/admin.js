/* ============================================
   SanuwarTools — Admin Panel JavaScript
   Full CRUD, config management, import/export
   ============================================ */

(function () {
  'use strict';

  // ── Constants ───────────────────────────
  const LS_CONFIG_KEY = 'sanuwartools-config';
  const CONFIG_URL = '/tools.config.json';

  let config = null;
  let currentView = 'dashboard';
  let editingToolId = null;
  let editingToolTags = [];

  // ── Toast Notifications ─────────────────
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = {
      success: '✅',
      error: '❌',
      info: 'ℹ️',
      warning: '⚠️'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <span>${message}</span>
      <button class="toast-close" onclick="this.parentElement.classList.add('toast-exit'); setTimeout(() => this.parentElement.remove(), 300)">×</button>
    `;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-exit');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // ── Config Management ───────────────────
  async function loadConfig() {
    try {
      // Always fetch fresh from server so deletes/edits are reflected everywhere
      const res = await fetch(CONFIG_URL + '?t=' + Date.now());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      config = await res.json();
      localStorage.setItem(LS_CONFIG_KEY, JSON.stringify(config));
    } catch (err) {
      console.warn('Server fetch failed, trying localStorage:', err);
      const cached = localStorage.getItem(LS_CONFIG_KEY);
      if (cached) {
        config = JSON.parse(cached);
      } else {
        config = {
          site: { name: 'SanuwarTools', tagline: 'All my tools, one place.', favicon: '', defaultTheme: 'light' },
          downloadPage: { enabled: true, url: '/downloads', buttonLabel: '⬇ Download Tools', buttonSubtext: 'Get all tools offline' },
          tools: [],
          categories: ['All', 'Utility', 'Downloader', 'Converter', 'Generator'],
          socialLinks: { github: '', instagram: '', youtube: '', twitter: '' }
        };
        saveConfig();
        showToast('Created new config — add your tools!', 'info');
      }
    }

    renderCurrentView();
    updateDashboardStats();
  }

  // Push config to localStorage AND server
  function saveConfig() {
    localStorage.setItem(LS_CONFIG_KEY, JSON.stringify(config));
    syncToServer();
  }

  async function syncToServer() {
    try {
      const res = await fetch('/api/tools.config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (!res.ok) console.warn('Server sync failed:', await res.text());
    } catch (e) {
      console.warn('Server sync error:', e);
    }
  }

  // ── Sidebar Navigation ──────────────────
  function initSidebar() {
    const links = document.querySelectorAll('.sidebar-link');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.querySelector('.admin-sidebar');
    const overlay = document.querySelector('.sidebar-overlay');

    links.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const view = link.dataset.view;
        if (view) {
          currentView = view;
          links.forEach(l => l.classList.remove('active'));
          link.classList.add('active');
          renderCurrentView();
          updateTopbarTitle(view);

          // Close mobile sidebar
          sidebar?.classList.remove('mobile-open');
          overlay?.classList.remove('active');
        }
      });
    });

    // Mobile sidebar toggle
    if (sidebarToggle) {
      sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('mobile-open');
        overlay.classList.toggle('active');
      });
    }

    if (overlay) {
      overlay.addEventListener('click', () => {
        sidebar.classList.remove('mobile-open');
        overlay.classList.remove('active');
      });
    }
  }

  function updateTopbarTitle(view) {
    const titles = {
      dashboard: '📊 Dashboard',
      tools: '🛠️ Manage Tools',
      categories: '📁 Categories',
      settings: '⚙️ Site Settings',
      download: '⬇️ Download Settings',
      theme: '🎨 Theme Settings',
      export: '📤 Export Config',
      import: '📥 Import Config'
    };
    const topbar = document.getElementById('topbar-title');
    if (topbar) topbar.textContent = titles[view] || 'Admin';
  }

  // ── Render Views ────────────────────────
  function renderCurrentView() {
    document.querySelectorAll('.admin-view').forEach(v => v.classList.remove('active'));
    const el = document.getElementById(`view-${currentView}`);
    if (el) el.classList.add('active');

    switch (currentView) {
      case 'dashboard': renderDashboard(); break;
      case 'tools': renderToolsTable(); break;
      case 'categories': renderCategories(); break;
      case 'settings': renderSettings(); break;
      case 'download': renderDownloadSettings(); break;
      case 'theme': renderThemeSettings(); break;
      case 'export': renderExport(); break;
      case 'import': renderImport(); break;
    }
  }

  // ── Dashboard ───────────────────────────
  function updateDashboardStats() {
    const tools = config.tools || [];
    document.getElementById('stat-total')?.textContent && (document.getElementById('stat-total').textContent = tools.length);
    document.getElementById('stat-categories')?.textContent && (document.getElementById('stat-categories').textContent = (config.categories || []).filter(c => c !== 'All').length);
    document.getElementById('stat-featured')?.textContent && (document.getElementById('stat-featured').textContent = tools.filter(t => t.featured).length);
    document.getElementById('stat-visible')?.textContent && (document.getElementById('stat-visible').textContent = tools.filter(t => t.visible !== false).length);
  }

  function renderDashboard() {
    updateDashboardStats();

    const recentList = document.getElementById('recent-tools-list');
    if (!recentList) return;

    const recent = [...(config.tools || [])].sort((a, b) => new Date(b.addedDate) - new Date(a.addedDate)).slice(0, 5);

    if (recent.length === 0) {
      recentList.innerHTML = `<div class="empty-state"><div class="empty-icon">📦</div><h4>No tools yet</h4><p>Add your first tool to get started.</p></div>`;
      return;
    }

    recentList.innerHTML = `
      <table class="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Category</th>
            <th>Added</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${recent.map(t => `
            <tr>
              <td class="table-name">${t.name}</td>
              <td><span class="table-category">${t.category}</span></td>
              <td style="color: var(--admin-text-muted); font-size: 0.85rem;">${t.addedDate || '—'}</td>
              <td>${t.visible !== false ? '<span style="color: var(--admin-success); font-weight: 600;">Visible</span>' : '<span style="color: var(--admin-text-muted);">Hidden</span>'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  // ── Tools Management ────────────────────
  function renderToolsTable() {
    const container = document.getElementById('tools-table-body');
    if (!container) return;

    const tools = config.tools || [];

    if (tools.length === 0) {
      container.innerHTML = `
        <tr><td colspan="7" style="text-align: center; padding: 40px;">
          <div class="empty-state"><div class="empty-icon">🛠️</div><h4>No tools added</h4><p>Click "Add New Tool" to add your first tool.</p></div>
        </td></tr>
      `;
      return;
    }

    container.innerHTML = tools.map((tool, index) => `
      <tr data-id="${tool.id}" draggable="true">
        <td>
          <img src="${tool.thumbnail}" alt="" class="table-thumb" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2256%22 height=%2235%22 fill=%22%23f0f0f5%22%3E%3Crect width=%2256%22 height=%2235%22 rx=%224%22/%3E%3C/svg%3E'">
        </td>
        <td class="table-name">${tool.name}</td>
        <td><span class="table-category">${tool.category}</span></td>
        <td>
          <label class="toggle">
            <input type="checkbox" ${tool.visible !== false ? 'checked' : ''} onchange="window.adminToggleVisibility('${tool.id}', this.checked)">
            <span class="toggle-slider"></span>
          </label>
        </td>
        <td>
          <label class="toggle">
            <input type="checkbox" ${tool.featured ? 'checked' : ''} onchange="window.adminToggleFeatured('${tool.id}', this.checked)">
            <span class="toggle-slider"></span>
          </label>
        </td>
        <td>
          <div class="table-actions">
            <button class="table-action-btn edit" onclick="window.adminEditTool('${tool.id}')">✏️ Edit</button>
            <button class="table-action-btn delete" onclick="window.adminDeleteTool('${tool.id}')">🗑️ Delete</button>
          </div>
        </td>
      </tr>
    `).join('');

    initDragReorder();
  }

  // Drag to reorder
  function initDragReorder() {
    const tbody = document.getElementById('tools-table-body');
    if (!tbody) return;

    let draggedRow = null;

    tbody.querySelectorAll('tr[draggable]').forEach(row => {
      row.addEventListener('dragstart', (e) => {
        draggedRow = row;
        row.style.opacity = '0.4';
        e.dataTransfer.effectAllowed = 'move';
      });

      row.addEventListener('dragend', () => {
        row.style.opacity = '1';
        draggedRow = null;
        tbody.querySelectorAll('tr').forEach(r => r.style.borderTop = '');
      });

      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        row.style.borderTop = '2px solid var(--admin-accent)';
      });

      row.addEventListener('dragleave', () => {
        row.style.borderTop = '';
      });

      row.addEventListener('drop', (e) => {
        e.preventDefault();
        row.style.borderTop = '';
        if (draggedRow && draggedRow !== row) {
          tbody.insertBefore(draggedRow, row);

          // Update config order
          const newOrder = Array.from(tbody.querySelectorAll('tr[data-id]')).map(r => r.dataset.id);
          const reordered = [];
          newOrder.forEach(id => {
            const tool = config.tools.find(t => t.id === id);
            if (tool) reordered.push(tool);
          });
          config.tools = reordered;
          saveConfig();
          showToast('Tool order updated', 'success');
        }
      });
    });
  }

  // Toggle visibility
  window.adminToggleVisibility = function (id, value) {
    const tool = config.tools.find(t => t.id === id);
    if (tool) {
      tool.visible = value;
      saveConfig();
      showToast(`${tool.name} is now ${value ? 'visible' : 'hidden'}`, 'success');
    }
  };

  // Toggle featured
  window.adminToggleFeatured = function (id, value) {
    const tool = config.tools.find(t => t.id === id);
    if (tool) {
      tool.featured = value;
      saveConfig();
      updateDashboardStats();
      showToast(`${tool.name} ${value ? 'marked as featured' : 'unfeatured'}`, 'success');
    }
  };

  // Delete tool
  window.adminDeleteTool = function (id) {
    const tool = config.tools.find(t => t.id === id);
    if (!tool) return;

    if (confirm(`Delete "${tool.name}"? This cannot be undone.`)) {
      config.tools = config.tools.filter(t => t.id !== id);
      saveConfig();
      renderToolsTable();
      updateDashboardStats();
      showToast(`"${tool.name}" deleted`, 'success');
    }
  };

  // Edit tool
  window.adminEditTool = function (id) {
    const tool = config.tools.find(t => t.id === id);
    if (!tool) return;

    editingToolId = id;
    editingToolTags = [...(tool.tags || [])];

    document.getElementById('modal-title').textContent = 'Edit Tool';
    document.getElementById('tool-form-name').value = tool.name || '';
    document.getElementById('tool-form-slug').value = tool.slug || '';
    document.getElementById('tool-form-category').value = tool.category || '';
    document.getElementById('tool-form-description').value = tool.description || '';
    document.getElementById('tool-form-long-desc').value = tool.longDescription || '';
    document.getElementById('tool-form-url').value = tool.siteUrl || '';
    document.getElementById('tool-form-thumbnail').value = tool.thumbnail || '';
    document.getElementById('tool-form-download').checked = tool.downloadAvailable || false;
    document.getElementById('tool-form-featured').checked = tool.featured || false;
    document.getElementById('tool-form-visible').checked = tool.visible !== false;
    document.getElementById('tool-form-date').value = tool.addedDate || '';

    renderFormTags();
    openModal();
  };

  // ── Add / Edit Tool Modal ───────────────
  function openModal() {
    const overlay = document.getElementById('tool-modal-overlay');
    overlay?.classList.add('open');

    // Populate category select
    const select = document.getElementById('tool-form-category');
    if (select && config.categories) {
      select.innerHTML = config.categories.filter(c => c !== 'All').map(c =>
        `<option value="${c}" ${select.value === c ? 'selected' : ''}>${c}</option>`
      ).join('');

      // Re-set value after rebuilding options
      if (editingToolId) {
        const tool = config.tools.find(t => t.id === editingToolId);
        if (tool) select.value = tool.category;
      }
    }
  }

  function closeModal() {
    const overlay = document.getElementById('tool-modal-overlay');
    overlay?.classList.remove('open');
    editingToolId = null;
    editingToolTags = [];
  }

  function initToolForm() {
    const addBtn = document.getElementById('add-tool-btn');
    const closeBtn = document.getElementById('modal-close-btn');
    const cancelBtn = document.getElementById('modal-cancel-btn');
    const saveBtn = document.getElementById('modal-save-btn');
    const tagsInput = document.getElementById('tool-form-tags-input');

    if (addBtn) {
      addBtn.addEventListener('click', () => {
        editingToolId = null;
        editingToolTags = [];
        document.getElementById('modal-title').textContent = 'Add New Tool';
        document.getElementById('tool-form').reset();
        document.getElementById('tool-form-visible').checked = true;
        document.getElementById('tool-form-date').value = new Date().toISOString().split('T')[0];
        renderFormTags();
        openModal();
      });
    }

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    // Close on overlay click
    document.getElementById('tool-modal-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'tool-modal-overlay') closeModal();
    });

    // Save
    if (saveBtn) {
      saveBtn.addEventListener('click', saveTool);
    }

    // Tags input
    if (tagsInput) {
      tagsInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ',') {
          e.preventDefault();
          const val = tagsInput.value.trim().replace(',', '');
          if (val && !editingToolTags.includes(val)) {
            editingToolTags.push(val);
            renderFormTags();
            tagsInput.value = '';
          }
        }
      });
    }

    // Image upload
    const thumbUpload = document.getElementById('tool-form-thumb-upload');
    if (thumbUpload) {
      thumbUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
          document.getElementById('tool-form-thumbnail').value = ev.target.result;
          showToast('Thumbnail loaded as Base64', 'info');
        };
        reader.readAsDataURL(file);
      });
    }

    // Auto-generate slug
    const nameInput = document.getElementById('tool-form-name');
    const slugInput = document.getElementById('tool-form-slug');
    if (nameInput && slugInput) {
      nameInput.addEventListener('input', () => {
        if (!editingToolId) {
          slugInput.value = nameInput.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        }
      });
    }
  }

  function renderFormTags() {
    const container = document.getElementById('tool-form-tags-container');
    if (!container) return;

    const input = document.getElementById('tool-form-tags-input');
    container.innerHTML = '';

    editingToolTags.forEach((tag, i) => {
      const pill = document.createElement('span');
      pill.className = 'tag-pill';
      pill.innerHTML = `${tag}<button class="tag-remove" data-index="${i}">×</button>`;
      container.appendChild(pill);
    });

    container.appendChild(input);

    // Tag removal
    container.querySelectorAll('.tag-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        editingToolTags.splice(parseInt(btn.dataset.index), 1);
        renderFormTags();
      });
    });
  }

  window.removeFormTag = function (index) {
    editingToolTags.splice(index, 1);
    renderFormTags();
  };

  function saveTool() {
    const name = document.getElementById('tool-form-name').value.trim();
    const slug = document.getElementById('tool-form-slug').value.trim();
    const category = document.getElementById('tool-form-category').value;
    const description = document.getElementById('tool-form-description').value.trim();
    const longDesc = document.getElementById('tool-form-long-desc').value.trim();
    const url = document.getElementById('tool-form-url').value.trim();
    const thumbnail = document.getElementById('tool-form-thumbnail').value.trim();
    const download = document.getElementById('tool-form-download').checked;
    const featured = document.getElementById('tool-form-featured').checked;
    const visible = document.getElementById('tool-form-visible').checked;
    const date = document.getElementById('tool-form-date').value;

    // Validation
    if (!name) { showToast('Tool name is required', 'error'); return; }
    if (!url) { showToast('Site URL is required', 'error'); return; }

    if (editingToolId) {
      // Update existing
      const tool = config.tools.find(t => t.id === editingToolId);
      if (tool) {
        Object.assign(tool, {
          name, slug, category, description, longDescription: longDesc,
          siteUrl: url, thumbnail, downloadAvailable: download,
          featured, visible, tags: [...editingToolTags], addedDate: date
        });
        showToast(`"${name}" updated`, 'success');
      }
    } else {
      // Add new
      const id = 'tool-' + Date.now().toString(36);
      config.tools.push({
        id, name, slug, category, description, longDescription: longDesc,
        siteUrl: url, thumbnail: thumbnail || `/assets/thumbnails/${id}.png`,
        downloadAvailable: download, featured, visible,
        tags: [...editingToolTags], addedDate: date
      });
      showToast(`"${name}" added`, 'success');
    }

    saveConfig();
    closeModal();
    renderToolsTable();
    updateDashboardStats();
  }

  // ── Categories ──────────────────────────
  function renderCategories() {
    const list = document.getElementById('categories-list');
    if (!list) return;

    const cats = (config.categories || []).filter(c => c !== 'All');
    const toolCounts = {};
    (config.tools || []).forEach(t => {
      toolCounts[t.category] = (toolCounts[t.category] || 0) + 1;
    });

    list.innerHTML = cats.map(cat => `
      <div class="category-item" data-category="${cat}">
        <span class="drag-handle">⠿</span>
        <span class="category-name">${cat}</span>
        <span class="category-count">${toolCounts[cat] || 0} tools</span>
        <button class="category-delete" onclick="window.adminDeleteCategory('${cat}')" title="Delete category">×</button>
      </div>
    `).join('');
  }

  window.adminDeleteCategory = function (cat) {
    if (confirm(`Delete category "${cat}"? Tools in this category won't be deleted.`)) {
      config.categories = config.categories.filter(c => c !== cat);
      saveConfig();
      renderCategories();
      showToast(`Category "${cat}" deleted`, 'success');
    }
  };

  function initCategoryForm() {
    const addBtn = document.getElementById('add-category-btn');
    const input = document.getElementById('new-category-input');

    if (addBtn && input) {
      const addCategory = () => {
        const name = input.value.trim();
        if (!name) { showToast('Enter a category name', 'error'); return; }
        if (config.categories.includes(name)) { showToast('Category already exists', 'warning'); return; }
        config.categories.push(name);
        saveConfig();
        renderCategories();
        input.value = '';
        showToast(`Category "${name}" added`, 'success');
      };

      addBtn.addEventListener('click', addCategory);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addCategory();
      });
    }
  }

  // ── Site Settings ───────────────────────
  function renderSettings() {
    const site = config.site || {};
    const social = config.socialLinks || {};

    setValue('settings-name', site.name);
    setValue('settings-tagline', site.tagline);
    setValue('settings-favicon', site.favicon);
    setValue('settings-github', social.github);
    setValue('settings-instagram', social.instagram);
    setValue('settings-youtube', social.youtube);
    setValue('settings-twitter', social.twitter);
  }

  function initSettingsForm() {
    const saveBtn = document.getElementById('save-settings-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        if (!config.site) config.site = {};
        if (!config.socialLinks) config.socialLinks = {};
        config.site.name = getValue('settings-name');
        config.site.tagline = getValue('settings-tagline');
        config.site.favicon = getValue('settings-favicon');
        config.socialLinks.github = getValue('settings-github');
        config.socialLinks.instagram = getValue('settings-instagram');
        config.socialLinks.youtube = getValue('settings-youtube');
        config.socialLinks.twitter = getValue('settings-twitter');
        saveConfig();
        showToast('Site settings saved & synced to server ✅', 'success');
      });
    }
  }

  // ── Download Settings ───────────────────
  function renderDownloadSettings() {
    const dp = config.downloadPage || {};
    const toggle = document.getElementById('download-enabled');
    if (toggle) toggle.checked = dp.enabled !== false;
    setValue('download-url', dp.url);
    setValue('download-label', dp.buttonLabel);
    setValue('download-subtext', dp.buttonSubtext);
    // Refresh the store apps list
    if (typeof appHubRenderer !== 'undefined') {
      appHubRenderer.refresh();
    }
  }

  function initDownloadSettingsForm() {
    const saveBtn = document.getElementById('save-download-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        config.downloadPage.enabled = document.getElementById('download-enabled')?.checked ?? true;
        config.downloadPage.url = getValue('download-url');
        config.downloadPage.buttonLabel = getValue('download-label');
        config.downloadPage.buttonSubtext = getValue('download-subtext');
        saveConfig();
        showToast('Download settings saved', 'success');
      });
    }
  }

  // ── Theme Settings ──────────────────────
  function renderThemeSettings() {
    const select = document.getElementById('default-theme-select');
    if (select) {
      select.value = config.site?.defaultTheme || 'light';
    }
  }

  function initThemeSettingsForm() {
    const saveBtn = document.getElementById('save-theme-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        config.site.defaultTheme = document.getElementById('default-theme-select')?.value || 'light';
        saveConfig();
        showToast('Default theme updated', 'success');
      });
    }
  }

  // ── Export ──────────────────────────────
  function renderExport() {
    const preview = document.getElementById('export-preview');
    if (preview) {
      preview.textContent = JSON.stringify(config, null, 2);
    }
  }

  function initExport() {
    const downloadBtn = document.getElementById('export-download-btn');
    const copyBtn = document.getElementById('export-copy-btn');

    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'tools.config.json';
        a.click();
        URL.revokeObjectURL(url);
        showToast('Config file downloaded', 'success');
      });
    }

    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(JSON.stringify(config, null, 2))
          .then(() => showToast('Copied to clipboard', 'success'))
          .catch(() => showToast('Failed to copy', 'error'));
      });
    }
  }

  // ── Import ──────────────────────────────
  function renderImport() {
    // Already rendered in HTML
  }

  function initImport() {
    const dropZone = document.getElementById('import-drop-zone');
    const fileInput = document.getElementById('import-file-input');

    if (dropZone && fileInput) {
      dropZone.addEventListener('click', () => fileInput.click());

      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--admin-accent)';
        dropZone.style.background = 'var(--admin-accent-lighter)';
      });

      dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = '';
        dropZone.style.background = '';
      });

      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '';
        dropZone.style.background = '';
        const file = e.dataTransfer.files[0];
        if (file) processImportFile(file);
      });

      fileInput.addEventListener('change', () => {
        if (fileInput.files[0]) processImportFile(fileInput.files[0]);
      });
    }
  }

  function processImportFile(file) {
    if (!file.name.endsWith('.json')) {
      showToast('Please upload a JSON file', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);

        // Validate structure
        if (!imported.site || !imported.tools) {
          showToast('Invalid config format — missing required fields', 'error');
          return;
        }

        if (confirm(`Import config with ${imported.tools.length} tools? This will replace your current config.`)) {
          config = imported;
          saveConfig();
          renderCurrentView();
          updateDashboardStats();
          showToast(`Config imported — ${imported.tools.length} tools loaded`, 'success');
        }
      } catch (err) {
        showToast('Invalid JSON file', 'error');
      }
    };
    reader.readAsText(file);
  }

  // ── Utilities ───────────────────────────
  function setValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value || '';
  }

  function getValue(id) {
    return document.getElementById(id)?.value?.trim() || '';
  }

  // ── Initialize ──────────────────────────
  function init() {
    initSidebar();
    initToolForm();
    initCategoryForm();
    initSettingsForm();
    initDownloadSettingsForm();
    initThemeSettingsForm();
    initExport();
    initImport();
    loadConfig();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();


const appHubRenderer = {
  items: [],
  init: async function() {
    this.refresh();
  },
  refresh: async function() {
    try {
      const r = await fetch('/api/admin/store-apps');
      this.items = await r.json();
      this.render();
    } catch(e) {}
  },
  render: function() {
    const el = document.getElementById('store-apps-list');
    if(!this.items.length) { el.innerHTML = '<p>No apps added yet.</p>'; return; }
    let html = `<table class="admin-table"><thead><tr><th>App</th><th>Details</th><th>Actions</th></tr></thead><tbody>`;
    this.items.forEach(app => {
      html += `<tr>
        <td>
          <div style="display:flex;align-items:center;gap:10px;">
            <img src="${app.image||''}" style="width:40px;height:40px;border-radius:8px;object-fit:cover;background:#333;">
            <strong>${app.title}</strong>
          </div>
        </td>
        <td><small>${app.description||'-'}</small></td>
        <td>
          <button class="admin-btn admin-btn-sm" style="background:#555;" onclick="appHubRenderer.edit('${app.id}')">Edit</button>
          <button class="admin-btn admin-btn-sm" style="background:var(--admin-danger, #ef4444);" onclick="appHubRenderer.del('${app.id}')">Del</button>
        </td>
      </tr>`;
    });
    html += `</tbody></table>`;
    el.innerHTML = html;
  },
  openModal: function(app=null) {
    document.getElementById('store-app-id').value = app ? app.id : '';
    document.getElementById('store-app-title').value = app ? app.title : '';
    document.getElementById('store-app-desc').value = app ? app.description : '';
    document.getElementById('store-app-version').value = app ? app.version : '';
    document.getElementById('store-app-link').value = app ? app.link : '';
    document.getElementById('store-app-image').value = app ? app.image : '';
    
    const overlay = document.getElementById('store-modal-overlay');
    overlay.style.display = 'flex'; // Remove inline display:none if it exists
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  },
  edit: function(id) {
    const app = this.items.find(x => x.id === id);
    if(app) this.openModal(app);
  },
  closeModal: function() {
    const overlay = document.getElementById('store-modal-overlay');
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    // Optional: add a small timeout to set display:none after transition
    setTimeout(() => { if(!overlay.classList.contains('open')) overlay.style.display = 'none'; }, 300);
  },
  saveModal: async function() {
    const id = document.getElementById('store-app-id').value;
    const body = {
      title: document.getElementById('store-app-title').value,
      description: document.getElementById('store-app-desc').value,
      version: document.getElementById('store-app-version').value,
      link: document.getElementById('store-app-link').value,
      image: document.getElementById('store-app-image').value,
      category: 'Apps'
    };
    
    if(!body.title) {
        alert("Title is required!");
        return;
    }
    
    let url = id ? '/api/admin/store-apps/' + id : '/api/admin/store-apps';
    let method = id ? 'PUT' : 'POST';
    
    try {
        const r = await fetch(url, {
          method, headers:{'Content-Type':'application/json'},
          body: JSON.stringify(body)
        });
        if(r.ok) {
          this.closeModal();
          this.refresh();
          if(typeof showToast === 'function') showToast('App saved successfully', 'success');
        } else {
            const err = await r.json();
            alert("Error saving: " + (err.error || r.statusText));
        }
    } catch(e) {
        alert("Network error: " + e.message);
    }
  },
  del: async function(id) {
    if(!confirm("Are you sure?")) return;
    try {
        const r = await fetch('/api/admin/store-apps/' + id, {method:'DELETE'});
        if(r.ok) { this.refresh(); if(typeof showToast === 'function') showToast('App deleted', 'success'); }
        else { alert("Error deleting app"); }
    } catch(e) { alert("Network error"); }
  },
  
  uploadFile: async function(input, targetInputId) {
    const file = input.files[0];
    if(!file) return;
    const stat = document.getElementById('store-app-upload-status');
    if(stat) stat.textContent = 'Uploading to Server/Cloudinary...';
    
    const fd = new FormData();
    fd.append('image', file); // API expects 'image' key
    try {
        const r = await fetch('/api/admin/upload', { method:'POST', body:fd });
        const data = await r.json();
        if(data.url) {
            document.getElementById(targetInputId).value = data.url;
            if(stat) stat.textContent = '✓ Uploaded';
        } else {
            if(stat) stat.textContent = '❌ Upload Failed: ' + (data.error||'Unknown');
            alert('Upload Failed: ' + data.error);
        }
    } catch(e) {
        if(stat) stat.textContent = '❌ Upload Error';
    }
    input.value = '';
  }
};

document.addEventListener('DOMContentLoaded', () => { setTimeout(()=>appHubRenderer.init(), 1000); });


document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('export-download-btn');
    if(btn) {
        btn.addEventListener('click', async (e) => {
            e.stopImmediatePropagation();
            const currentConfig = JSON.parse(localStorage.getItem('sanuwartools-config') || 'null');
            if(currentConfig) {
                try {
                    const r = await fetch('/api/tools.config', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(currentConfig)
                    });
                    if(r.ok) {
                        if(typeof showToast === 'function') showToast('Config saved to server!', 'success');
                        const blob = new Blob([JSON.stringify(currentConfig, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url; a.download = 'tools.config.json'; a.click();
                        URL.revokeObjectURL(url);
                    } else {
                        if(typeof showToast === 'function') showToast('Failed to save to server', 'error');
                    }
                } catch(err) {
                    if(typeof showToast === 'function') showToast('Server error while saving', 'error');
                }
            }
        }, {capture: true});
        btn.textContent = '💾 Save to Server';
    }
});
