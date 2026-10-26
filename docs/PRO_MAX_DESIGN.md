# SanuwarTools public design

Reference: https://uupm.cc/ (inspected in browser 2026-10-26). Adapted its navy backdrop, restrained blue/warm glow, gradient brand title, glass header, bordered cards and central primary actions to the existing utility catalogue. Branding and content remain SanuwarTools. Existing tools/downloads separation, document editor, availability controls, Google authentication, checkout and AdSense rules are preserved.

Applied UI/UX Pro Max skill. Its two generated design-system searches returned mismatched audio/wedding guidance, so those palettes and fonts were rejected. The implementation uses the observed reference and general skill accessibility rules. A separate `focus not obscured` UX lookup returned the matching WCAG 2.2 minimum/enhanced guidance; the header is in document flow, mobile menu supports Escape, and anchor/focus targets have scroll offsets.

Detected stack: Flask/Jinja with vanilla JavaScript and CSS. No framework migration or new animation dependency. Reuses the local Manrope font. Public-only `.pro-theme` styling, dark default for new visitors, existing stored theme preference preserved, working light toggle. Editor retains a neutral photo preview surface. Admin screens keep their previous shell.

Tokens: navy #0c1020, surface #141b2e, foreground #f3f5fc, muted #a9b2c8, border white at 11%, accessible CTA #315bce to #426be0, blue links #8eaeff. Light mode uses #f6f8fe / white / #17213c. Primary button text contrast at the lightest gradient stop is 4.76:1. Motion uses small, once-only CSS translations; content stays visible before JavaScript and reduced motion disables transitions/reveals.

Mobile: two-column tool/download grids, 44px interactive controls, account access in the navigation drawer, theme toggle in the header, no horizontal document overflow. Download search/sort/category/album/detail actions and existing photo export scripts remain unchanged.
