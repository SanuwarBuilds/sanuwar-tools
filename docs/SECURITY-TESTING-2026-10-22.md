# Security and content availability checks — 22 October 2026

Admin now has an Enable/Disable action for tools, download items/albums, home widgets and store records. Disabled records remain editable in admin. New downloads also have an enabled checkbox in the editor. No production catalogue entries were disabled, deleted or replaced during testing.

## Publication enforcement

- One publication policy filters public tools configuration, server-rendered homepage tools, download JSON, download categories and widgets. Disabled entries and their file names/links are omitted, rather than shown as unavailable cards.
- The download page's global switch also hides its API and blocks website checkout/delivery routes.
- Checkout, free private delivery and paid-receipt status/delivery check current publication state. Existing receipts become usable again after re-enabling. Signed payment callbacks still reconcile payments while content is disabled.
- Enable/disable saves only publication flags. IDs, album files, timestamps, pricing and upload metadata survive a disable/enable cycle.
- Admin availability writes require an authenticated session, CSRF token and an actual JSON boolean. Invalid flags and malformed widget data/order return 400.

## Fixes and security checks

Vercel's instance-local `/tmp` catalogue could outlive a save in another instance. Production reads now use GitHub's current persisted JSON, cache only within one request and fail closed if the authority cannot be reached. Mutations that read a record use that same GitHub revision when writing, so conflicting remote saves fail instead of overwriting a newer revision. Public catalogue HTML and APIs use `Cache-Control: no-store`.

Dependency audit flagged certifi and cryptography. Updated to [certifi 2026.10.19](https://pypi.org/project/certifi/2026.10.19/) and [cryptography 50.0.2](https://pypi.org/project/cryptography/50.0.2/). The post-update requirements audit reported no known vulnerabilities. This describes the audit database result at testing time, not a guarantee against all vulnerabilities.

Validation:

- 95 isolated automated tests passed, including authentication, CSRF, cross-origin rejection, login throttling, URL validation, upload processing, payment signature/amount/receipt ownership, licensing signatures and replay handling.
- Added regression tests for publication leaks, categories, direct checkout/delivery, paid receipt disable/re-enable, malformed booleans, save failures, authoritative serverless reads and write conflicts.
- `pip check`, JavaScript syntax and Git whitespace checks passed.
- Isolated browser test: disable an album in admin, search the public library and see no result, re-enable it and open the original album/file. Mobile admin tested at 390 × 844 without horizontal overflow.
- Browser mutations used in-memory fixtures, with no production writes, Cloudinary downloads or real payments.

Screenshots: [mobile admin disabled state](screenshots/availability-admin-mobile.png), [public search hides disabled album](screenshots/availability-public-hidden.png).

## Boundaries

This is a source review, dependency audit, isolated regression testing and bounded hosted smoke testing, not an exhaustive penetration test. Login throttling remains per process; a shared limiter is needed for a stronger distributed brute-force limit. GitHub API availability/rate limits now affect catalogue reads, intentionally failing closed rather than serving stale enabled content.

Already-open browser pages need a refresh to remove their existing cards. Previously issued signed download URLs can remain valid for their existing 60-second lifetime. Disabling a catalogue record cannot revoke permanent URLs already shared from GitHub Releases or public Cloudinary assets, nor remove files/metadata from a public source repository. Use authenticated storage for files that require revocable access.
