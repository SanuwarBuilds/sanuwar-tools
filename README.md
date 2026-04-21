# SanuwarTools 🛠️

> All my tools, one place.

A personal tools hub/portfolio site where all your web tools and sites are listed, described, and accessible from one central place.

![SanuwarTools](https://img.shields.io/badge/SanuwarTools-v1.0-6C63FF?style=for-the-badge)

---

## 🚀 Quick Start

1. **Clone or download** this project
2. **Serve it locally** — use any static file server:
   ```bash
   # Using Python
   python3 -m http.server 8080

   # Using Node.js (npx)
   npx serve .

   # Using PHP
   php -S localhost:8080
   ```
3. Open `http://localhost:8080` in your browser

---

## 📁 Project Structure

```
/index.html              → Main homepage
/download.html           → Download page
/admin/index.html        → Admin panel (hidden URL)
/assets/
  /thumbnails/           → Tool thumbnail images
  /css/
    style.css            → Main site styles (with theme variables)
    admin.css            → Admin panel styles
  /js/
    main.js              → Homepage logic (load, filter, search, theme)
    admin.js             → Admin panel logic (CRUD, import/export)
/tools.config.json       → Central data file for all tools
```

---

## 🛠️ How to Add a Tool

### Option 1: Via Admin Panel (Recommended)
1. Go to `/admin/` in your browser
2. Click **"Manage Tools"** in the sidebar
3. Click **"+ Add New Tool"**
4. Fill in the form and save
5. Go to **"Export Config"** → download the JSON file
6. Replace `tools.config.json` in your project with the downloaded file

### Option 2: Edit `tools.config.json` Directly
Add a new entry to the `tools` array:

```json
{
  "id": "tool-005",
  "name": "My New Tool",
  "slug": "my-new-tool",
  "category": "Utility",
  "description": "Short description here.",
  "longDescription": "Longer description shown on click.",
  "thumbnail": "/assets/thumbnails/tool-005.png",
  "siteUrl": "https://my-tool.example.com",
  "downloadAvailable": false,
  "tags": ["free", "web"],
  "featured": false,
  "visible": true,
  "addedDate": "2025-06-01"
}
```

---

## 🎨 Theme System

The site supports **Light** and **Dark** themes:
- Users toggle via the **three-dot menu (⋮)** in the top-right corner
- Preference is saved to `localStorage`
- Default theme can be set in the Admin Panel → Theme Settings

All colors use CSS custom properties (variables), making it easy to customize.

---

## 🔧 Admin Panel

Access the admin panel at `/admin/` — no login required (can be added later).

### Features:
- **Dashboard** — Overview stats (total tools, categories, featured count)
- **Manage Tools** — Full CRUD (add, edit, delete, reorder)
- **Categories** — Add/remove filter categories
- **Site Settings** — Update site name, tagline, social links
- **Download Page** — Toggle and configure the download section
- **Theme Settings** — Set default theme for visitors
- **Export Config** — Download current config as JSON
- **Import Config** — Upload a JSON file to restore/update

### How Admin Data Works:
1. Admin changes are saved to `localStorage` (key: `sanuwartools-config`)
2. The homepage reads from `localStorage` first, then falls back to `tools.config.json`
3. To make changes permanent, **export** the config from admin and replace the `tools.config.json` file

---

## 🔮 Future Plans

- [ ] Login/authentication system for admin panel
- [ ] Backend API (replace `fetch()` with API calls)
- [ ] Individual tool detail pages (`/tools/[slug]`)
- [ ] Tool analytics and usage tracking
- [ ] PWA support for offline access

---

## 📄 License

Built with ❤️ by **Sanuwar**
