# SanuwarTools public design

**Current direction (v2, "Deep Studio"): dark-first, aurora-lit, editorial.**
Applies to the public shell, homepage, download library, sign-in/account and information pages. Admin and the two utility pages (`/purchases`, `/purchase/<id>`, `/payment-demo`) keep their existing layouts.

## Where the styles live

| File | Role |
| --- | --- |
| `static/assets/css/style.css` | Global reset and legacy base. Always loaded. |
| `static/assets/css/studio.css` | Legacy app theme. Loaded only on non-public routes and `/photo-tools`. |
| `static/assets/css/sanuwar.css` | **The public design system.** Loaded last on public routes, scoped to `body.pro-theme.v2`. |
| `static/assets/css/photo-tools.css` | The photo editor's own component styles. Unchanged. |
| `static/assets/js/sanuwar.js` | Theme label/colour sync, card pointer spotlight, mobile nav dismissal. |

Public routes are the ones listed in `public_ui` in `templates/base.html`. They get `pro-theme v2` on `<body>`, a dark `data-theme` default, the v2 header/footer, and `sanuwar.css` last in the cascade. Everything in `sanuwar.css` is prefixed with `body.pro-theme.v2` so it outranks the legacy sheets without `!important`.

## Visual language

- **Canvas:** near-black ink (`#07080e`) with a slow aurora wash (blue → violet → teal) and a very light film grain.
- **Type:** locally hosted Manrope. Display sizes use weight 800 with tight tracking; labels, counts and metadata use a system monospace with wide tracking.
- **Surfaces:** 20–30px radii, hairline borders, inset top highlight, soft long shadows.
- **Accent:** a single blue → violet gradient used for the brand mark, primary buttons, the hero gradient word and card hairlines.
- **Signature:** a pointer-tracking spotlight plus a gradient hairline that appear when a tool card is hovered or focused. Reduced-motion users get none of it.
- **Light mode:** the same system on a cool paper canvas (`#eff2f9`) with white cards and a strengthened shadow so cards separate from the page.

## Structure

- **Header:** sticky frosted bar (frost applied through `::before` so fixed children stay viewport-relative), pill navigation, theme toggle, sign-in pill. Below 900px the navigation becomes a sheet with a scrim and closes on Escape, outside click, focus loss or resize.
- **Homepage:** centred hero (status pill, two-line headline, lede, search, real counts), a "Tools" section with wrapped category chips, tool cards, a featured Photo Tools panel, a three-step guide, then the footer. `#tools`, `#how-it-works`, `#tool-search`, `#categories`, `#tools-grid`, `#tool-total` and `#widgets` keep their original ids so `main.js` is untouched.
- **Downloads:** page head with real collection counts, a glass filter panel, then the card grid. `downloads.js` renders the cards; `_initial_downloads.html` mirrors that markup for no-JS crawlers, including album file lists.
- **Footer:** brand, tagline and social pills beside two labelled link columns, then copyright and a status mark.

## Rules

- No invented numbers, testimonials or proof. Counts come from `public_config`; "0 Install" and "Built for the browser" describe the site itself.
- Tool icons and download covers are real uploaded material at their original colours. No placeholder art.
- Interactive targets stay at least 44px. Focus rings are always visible on the accent colour.
- `prefers-reduced-motion` disables the aurora, reveals, spotlight and transitions.
- All interface copy is English. The headline keeps the brand promise: "Small tools. Big work." Tool and download descriptions come from the catalogue data.
- Admin pages do not load `sanuwar.css`; the photo editor keeps `photo-tools.css` and only inherits the shell.
