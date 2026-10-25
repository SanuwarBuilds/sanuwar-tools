# Google Search setup

Canonical website: https://sanuwartools.online/ . The `www` host redirects to the apex domain.

- `/robots.txt` advertises `/sitemap.xml`, permits public rendering resources and excludes admin, receipts, demo and private payment/licensing endpoints from crawling.
- `/sitemap.xml` lists the homepage and public downloads page; turning off the download library removes that page from the sitemap. It does not invent modification dates.
- Public pages have unique titles/descriptions, fixed canonical URLs, Open Graph metadata and valid JSON-LD. The homepage identifies the `SanuwarTools` site name, `Sanuwar Tools` alternate name and existing 256px brand logo.
- Initial HTML contains published tool/download names and descriptions, including album file names. JavaScript enhances the same collection with search, previews and checkout. Disabled records are filtered before HTML is rendered, and paid/private originals never appear in this HTML.
- Private workflows, APIs, raw configuration and errors carry `X-Robots-Tag: noindex, nofollow`. Robots directives are discovery controls, not access control; authentication and payment checks remain enforced separately.
- Canonical URLs do not use the request's Host header. Older Vercel public page URLs identify the custom domain as canonical without breaking existing API clients.

The domain is verified in the owner's Google Search Console using a GoDaddy DNS TXT record. Keep the Google verification TXT record in DNS. Submit `https://sanuwartools.online/sitemap.xml` in that domain property's Sitemaps screen, then use URL Inspection to request indexing of the homepage and `/downloads` after deployment.

Search Console acceptance or a successful live test does not mean a URL is already indexed. Google decides whether and when to crawl, index, rank, and display the site name/favicon. Crawling may take days to weeks. Repeating the same request does not speed it up.

Sources: [Google crawl requests](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl), [Google site names](https://developers.google.com/search/docs/appearance/site-names).

Validation: 101 isolated tests, including canonical host/alias checks, parseable sitemap/JSON-LD, private-page indexing controls, disabled/private content exclusion and HTML escaping/URL filtering. Existing pricing, admin, availability and licensing tests remain included.
