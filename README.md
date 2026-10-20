# SanuwarTools

A Flask tools hub with a responsive homepage, downloads and albums, and an authenticated content workspace. The redesign uses warm ivory, orange and sage, with system fonts, original CSS illustrations and lightweight animations. Explanatory copy is in Roman Hindi/Hinglish.

## Run locally

Python **3.12** and Node.js (only for JavaScript syntax checks) are used for verification.

```sh
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Set `ADMIN_USER`, a password hash and `SECRET_KEY` in `.env`. Generate a session secret:

```sh
python -c "import secrets; print(secrets.token_hex(32))"
```

Generate a password hash interactively so your password is not placed in shell history:

```sh
python -c "from getpass import getpass; from werkzeug.security import generate_password_hash; print(generate_password_hash(getpass('Admin password: '), method='pbkdf2:sha256:1000000'))"
```

Copy the result to `ADMIN_PASSWORD_HASH`. Alternatively, set `ADMIN_PASSWORD` to a password of at least 12 characters. There are no default credentials. The legacy checked-in admin hash is no longer used. Keep `.env` untracked.

```sh
python app.py
```

Open `http://127.0.0.1:5002` and `/admin`. Debug mode is off; opt in locally with `FLASK_DEBUG=1`.

## What is included

- Homepage: tool search/categories, tool details, featured cards, responsive navigation, light/dark theme, workflow animation, FAQ and enabled home widgets.
- Downloads: compact phone rows, sticky search/category filters, apps/files versus album filters, direct download buttons, sorting, app/file details, version/source information, album thumbnail galleries, full-size image/media previews and individual download links. The browser streams external downloads directly; the UI does not buffer large APKs or claim that a file finished downloading.
- Workspace: real counts, tool CRUD/reordering, download/album CRUD, sequential bulk uploads with retry tracking, widget CRUD/reordering and poll voting, store app management, categories, branding/social links/theme, and tools configuration import/export with a review step.
- Existing tools, download URLs and album entries are retained. A missing election-tool thumbnail has an original local SVG replacement.
- Security: environment-based secrets/credentials, password hash support, login throttling, two-hour sessions, HttpOnly/SameSite cookies, secure cookies on Vercel, CSRF and origin checks on mutations, authenticated management APIs, hidden tools excluded from public JSON, request/upload limits, image verification and file allowlists, HTTPS URL validation, DOM-safe rendering, restrictive script CSP and response headers. Logout requires POST. Save failures return errors rather than false success.

Custom HTML widgets are intentionally rendered as text; arbitrary stored scripts/markup cannot run. Existing structured widget types remain available. No third-party script/font CDN is required.

## Deployment on the existing Vercel project

This repository keeps the existing Flask/Vercel deployment route. `.python-version` selects Python 3.12. Do not serve the repository as a static directory: templates and admin APIs require Flask.

Before deploying this branch, configure the production environment:

| Variable | Purpose |
| --- | --- |
| `SECRET_KEY` | Random secret of at least 32 characters; required on Vercel or startup fails closed. |
| `ADMIN_USER` | Administrator username. |
| `ADMIN_PASSWORD_HASH` | Werkzeug password hash; preferred over `ADMIN_PASSWORD`. |
| `ADMIN_PASSWORD` | Optional alternative, at least 12 characters. |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Required for uploads. |
| `GITHUB_PAT`, `GITHUB_USER`, `GITHUB_REPO` | Existing GitHub-backed JSON persistence; required for saves on Vercel. |
| `COOKIE_SECURE=1` | Set on other HTTPS hosting; enabled automatically on Vercel. |

The JSON writer atomically replaces local files and checks the GitHub response before acknowledging a save. GitHub writes use the repository's default branch and can trigger that branch's deployment. Use a separate repository or disable persistence credentials in disposable previews; do not give test previews production write credentials.

**Operational limits:** the retained JSON/GitHub storage is appropriate for this small catalogue but is not a transactional multi-writer database. Warm Vercel instances can serve stale `/tmp` data until redeployment. Concurrent edits/votes can overwrite one another. Rate limits are per process; configure a shared edge/gateway limiter for distributed brute-force protection. Poll sessions deter repeat votes in the same browser but are not verified-person voting. The application upload ceiling is 32 MB; your hosting plan may impose a smaller request-body limit. Larger release files should be hosted on GitHub Releases and added by HTTPS URL. The app validates images and blocks executable web uploads; it does not perform antivirus scanning or certify third-party downloads.

## Checks

```sh
python -m unittest discover -s tests -v
node --check static/assets/js/shared.js
node --check static/assets/js/main.js
node --check static/assets/js/downloads.js
node --check static/assets/js/admin.js
node --check static/assets/js/login.js
pip install pip-audit
pip-audit -r requirements.txt
```

Integration tests isolate data and mock uploads/writes, so they never modify the live catalogue, GitHub, or Cloudinary. Browser QA is recorded in `QA.md`. Live Cloudinary uploads, production environment variables, and the actual device/browser download completion require verification on the deployed host.

## Files

- `app.py`, `security.py`, `utils.py`: Flask routes, request protections, persistence.
- `templates/`: shared layout, homepage, downloads, admin and login.
- `static/assets/css/`, `static/assets/js/`: local UI assets.
- `data/tools.config.json`: catalogue, categories and public settings.
- `data/downloads.json`: download items and album links.
- `data/config.json`: home widgets and store apps; no administrator credentials.
- `tests/test_app.py`: integration and security regression tests.

## Upload dates and mobile downloads

New download entries receive server-generated UTC `created_at` and `updated_at` timestamps. Upload responses include `uploaded_at` and byte size; the individual-file editor, album editor and bulk uploader carry that upload time into the saved catalogue. Album links added manually receive `added_at`. Editing names/descriptions preserves original dates, while changing a file URL clears the old upload date unless a fresh upload result is supplied. Dates are shown publicly and in admin in **Asia/Kolkata (IST)**, independent of the visitor's timezone.

Legacy items without recorded timestamps display “Upload date available nahi hai”; no dates are invented from filenames or deployment times. Photo thumbnails are lazy-loaded, with resized/auto-format Cloudinary previews when applicable; full-size originals open on demand. PDF/app/archive files show their type and an original-file link. Audio/video previews use browser controls when the host and format support playback. External file hosts may block previews; download links remain available.
