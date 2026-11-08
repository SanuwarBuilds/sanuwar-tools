# SanuwarTools public design

**Current direction (v3, "Vector Machine"): warm-grey hardware, mono plaque labels and a single oxidized-orange LED accent.**
Applies to the public shell, homepage, download library, sign-in/account and information pages. Admin and the two utility pages (`/purchases`, `/purchase/<id>`, `/payment-demo`) keep their existing layouts.

## Where the styles live

| File | Role |
| --- | --- |
| `static/assets/css/style.css` | Global reset and legacy base. Always loaded. |
| `static/assets/css/studio.css` | Legacy app theme. Loaded only on non-public routes and `/photo-tools`. |
| `static/assets/css/sanuwar.css` | **The public design system.** Loaded last on public routes, scoped to `body.pro-theme.bp`. |
| `static/assets/css/photo-tools.css` | The photo editor's own component styles. Unchanged. |
| `static/assets/js/sanuwar.js` | Theme label/colour sync, mobile nav dismissal. |

Public routes are the ones listed in `public_ui` in `templates/base.html`. They get `pro-theme v2 bp` on `<body>`, a light `data-theme` default, the v3 header/footer, and `sanuwar.css` last in the cascade. Everything in `sanuwar.css` is prefixed with `body.pro-theme.bp` (or an unscoped `bp-*` component class) so it outranks the legacy sheets without `!important`.

## Visual language

- **Canvas:** warm paper grey (`#e3e4e5`) with a 32px blueprint grid. The hero adds faint motherboard traces in grey and orange. Dark mode swaps to charcoal (`#141618`) with the same grid in white at low opacity.
- **Type:** locally hosted Manrope for display and body. System monospace for plaque labels, counts, screens and metadata. Section headings are uppercase and medium weight; the hero headline stays sentence case.
- **Surfaces:** embossed hardware plates with a double bezel, 14–22px radii, hairline borders, recessed corner screws, vent slots and LED strips.
- **Accent:** one oxidized orange (`#d45420` light, `#e2642e` dark) reserved for LEDs, eyebrows, status dots, links and hover traces. Everything else is greyscale.
- **Signature:** the hero is a "toolkit computer" plaque — three blinking orange LEDs, a model label, an etched mark and a recessed search screen with a slow scanline. Tool cards read as modules with an LED strip and an etched icon socket. The footer is a dark charcoal board that closes the page.
- **Motion:** LED blink, scanline sweep, hover lift and the section rise-in. All of it is decorative and disabled by `prefers-reduced-motion`.

## Structure

- **Header:** sticky frosted bar with the brand chip, mono uppercase navigation, theme toggle and sign-in pill. Below 900px the navigation becomes a sheet with a scrim and closes on Escape, outside click, focus loss or resize.
- **Homepage:** mono status rails, the hero machine plaque (headline, one-line lede, search screen and category keys), then "Tools" modules, the featured Photo Tools panel, "Downloads", "How it works" and the board footer. `#tools`, `#how-it-works`, `#tool-search`, `#categories`, `#tools-grid`, `#tool-total` and `#widgets` keep their original ids so `main.js` is untouched.
- **Downloads:** plaque page head with real collection counts, a hardware filter panel, then the card grid. `downloads.js` renders the cards; `_initial_downloads.html` mirrors that markup for no-JS crawlers, including album file lists.
- **Footer:** a dark rounded board with brand, tagline and social pills beside two labelled link columns, then copyright and a status mark.
- **Reading pages:** sign-in, account and information pages use the same embossed plate language at a smaller scale.

## Rules

- No invented numbers, testimonials or proof. Counts come from `public_config`; "0 Install" and "Built for the browser" describe the site itself.
- Tool icons and download covers are real uploaded material at their original colours. No placeholder art.
- Interactive targets stay at least 44px. Focus rings are always visible on the accent colour.
- `prefers-reduced-motion` disables the LED blink, scanline, reveals and transitions.
- All interface copy is English. The headline keeps the brand promise: "Small tools. Big work." Tool and download descriptions come from the catalogue data.
- Keep `theme-color` in `base.html` / `sanuwar.js` in sync with `--bp-paper` and `--bp-paper-2`.
- Admin pages do not load `sanuwar.css`; the photo editor keeps `photo-tools.css` and only inherits the shell.
