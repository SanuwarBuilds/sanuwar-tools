# SanuwarTools public design

Hallmark redesign, 27 October 2026. Applies to the public shell, tool directory and download library. Admin and checkout keep their existing layouts.

Use Cobalt's cool paper, blue accent and quiet borders. Preserve the existing SanuwarTools identity and locally hosted Manrope. All new colours and fonts live in `static/assets/css/hallmark/tokens.css` or the declared theme token blocks in `workspace.css`. Respect saved light/dark preference; light is the public default.

The homepage is a working directory. Its compact heading and real search lead directly to categories and actual tools. No marketing-sized hero, gradients, decorative mock browser, duplicate navigation chips, invented proof or extra promotional copy. Mobile uses readable single-column tool rows and compact thumbnail download rows and 44px interactive targets. Desktop uses two columns. Search, disabled-content behavior, analytics attributes, Google sign-in and download/payment handlers retain their original wiring.

`workspace.css` overrides the existing public styles after `pro-max.css`. Tokens and the public-scoped scaffold base are imported locally; admin pages do not load them. Container: 1160px maximum with 16px mobile gutters. Use `minmax(0,1fr)` tracks, immediate visible focus rings and reduced-motion fallbacks.

Copy changes: the old multi-line SanuwarTools slogan and promotional hero copy become “Tools for everyday work.” / “Find a tool. Get straight to work.” Hero chips, repeated actions and reassurance dots are removed; their destinations remain in navigation and the catalogue. Collection heading becomes “All tools”. Photo, guide and contact sections are shortened around their original actions. Download heading becomes “Downloads”. Featured labels use sentence case. Decorative link arrows are removed from tool actions and footer links.

No picture placeholders or missing brand assets. Real icons and uploaded covers remain the material.
