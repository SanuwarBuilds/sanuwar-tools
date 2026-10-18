# Redesign verification — 18 October 2026

## Automated

- Python 3.12.14; Flask 3.1.3 and the pinned runtime dependencies in `requirements.txt`.
- 30 integration/security tests passed (`python -m unittest discover -s tests -v`).
- All five browser JavaScript files passed `node --check`; Python modules compiled successfully.
- `pip-audit -r requirements.txt`: **No known vulnerabilities found** after dependency updates. This is a point-in-time dependency check, not a penetration test.
- Tests isolate catalogue data, GitHub writes and Cloudinary calls.

## Browser

Tested using the Codex in-app browser against the local Flask application:

| Viewport | Homepage | Downloads | Admin |
| --- | --- | --- | --- |
| 320 × 800 | No page overflow | No page overflow | No page overflow |
| 390 × 844 | No page overflow | No page overflow | No page overflow |
| 768 × 1024 | No page overflow | No page overflow | No page overflow |
| 1024 × 768 | No page overflow after orbit fix | No page overflow | No page overflow |
| 1280 × 720 | Desktop layout reviewed | Desktop layout reviewed | Desktop layout reviewed |

Verified tool search, tool details, mobile navigation, theme switching, download search, the exact Ludo Remote release URL, the 16-file album's individual download links, local admin sign-in, an unchanged tool save, mobile admin navigation, settings population, widget/poll editing and removing an unsaved album row without submitting the form. The final browser console reported no errors. Admin tool tables scroll within their container on narrow screens.

Screenshots:

- [Desktop homepage](docs/screenshots/home-desktop.jpg)
- [Mobile homepage](docs/screenshots/home-mobile.jpg)
- [Downloads](docs/screenshots/downloads-desktop.jpg)
- [Admin dashboard](docs/screenshots/admin-desktop.jpg)

## Deployment and service limits

Vercel reported successful preview builds for application commit `2857abc`. The [primary preview](https://sanuwar-tools-git-redesign-mod-4a03ab-sanuwar-hussains-projects.vercel.app) redirects unauthenticated requests to Vercel sign-in, so hosted runtime behavior remains unverified. Live Cloudinary uploads and the production deployment have not been verified. Actual file completion is controlled by the browser/external file host; release URLs and album links were inspected without downloading every file. Production credentials were not inspected or changed. Production deployment needs the environment variables documented in README.md. The existing JSON/GitHub persistence and per-process rate-limiter limitations are documented there.
