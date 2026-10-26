# Private visitor analytics

Admin workspace → **Visitor analytics**. Public totals are not exposed. `/api/admin/analytics?days=7|30|90` uses the existing admin session requirement, no-store response and noindex rules. Google visitor sign-in does not grant access. Counts begin when tracking is enabled; historical traffic cannot be reconstructed.

## Deployment

No new external service or package is required. The collector uses `ANALYTICS_DATABASE_URL`, then the existing `LICENSE_DATABASE_URL` / `LICENSE_DATABASE_DATABASE_URL` / `POSTGRES_URL` / `DATABASE_URL`. Production requires private PostgreSQL. SQLite is local/test only. A stable `ANALYTICS_SECRET` (optional separate key) or `SECRET_KEY` / `FLASK_SECRET_KEY` of at least 32 characters is required. `ANALYTICS_ENABLED=0` pauses measurement. The existing Neon private database can be reused; no license/payment tables are read or changed. Only the three `site_analytics_*_v1` tables are created on first use. Never put connection strings, HMAC keys or event data in public catalogue JSON/GitHub.

Collector: CSRF-protected, same-origin JSON POST `/api/analytics/collect`. The browser sends only a random browser UUID, random event UUID, a whitelisted public pathname, event kind, known public catalogue ID (for clicks), source bucket and device bucket. Query strings, full referrer URLs, IP addresses, credentials, account identities, photo contents and filenames are not part of the analytics record. Event writes are idempotent and counter increments transactional. Metrics are private aggregate reports.

## Meaning and limits

- Visitors are approximate distinct browser IDs. A local identifier expires after 180 days; clearing storage or changing browser/device counts again. It is HMAC-hashed before storage and never returned by the report API. Rotating the HMAC key resets identity continuity.
- Views count successful browser measurements, including reloads and back/forward navigation. Each event UUID is counted once. Today / 7-day / period unique counts use IST calendar boundaries and distinct hashes over page views. All-time visitors count new measured browser identities across event kinds; all-time views count only page views.
- Tool opens and download clicks measure link/button activations. They do not prove completed file transfers, payment, tool work or conversion.
- Popular pages, sources, devices and actions cover the selected 7/30/90-day range. The chart always shows the most recent 14 IST dates and has a keyboard-accessible daily table.
- Admin browsing, recognised bots, DNT, GPC and the privacy page's browser opt-out are excluded. Ad blockers, disabled JavaScript, failed requests and unknown/spoofed bots affect counts. The in-process rate limit is a best-effort abuse bound, not a global distributed anti-bot service.
- Event details older than 90 days and hashes inactive for 180 days are pruned during ongoing collection, at most once per 24 hours. Lifetime aggregate counters remain. If traffic stops completely, pruning waits for the next measurement.
- The original referrer is classified client-side into Direct, Google, Bing, Social or Other websites. A source bucket is retained in sessionStorage for 30 minutes; device is a broad UA-based category. No location is inferred.
- Tracking failures never interrupt tools, navigation, checkout or downloads. Missing database/secret shows a configuration message in admin, not fake zero data.

The privacy page explains measurement and provides a local opt-out. No new third-party analytics scripts are loaded.

## Validation

Python tests exercise duplicate/concurrent writes, browser deduplication, IST day boundaries, preservation of lifetime totals during pruning, bot/privacy/admin exclusions, public item validation, Origin/CSRF and admin authorization, secret-safe failure paths, and production SQLite rejection. UI checks should use an isolated local database and synthetic events. Validate real hosted persistence separately after deployment.
