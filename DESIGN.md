# SanuwarTools public design

Hallmark redesign, 27 October 2026. Applies to the public shell, tool directory and download library. Admin and checkout keep their existing layouts.

Use Cobalt's cool paper, blue accent and quiet borders. Preserve the existing SanuwarTools identity and locally hosted Manrope. All new colours and fonts live in `static/assets/css/hallmark/tokens.css` or the declared theme token blocks in `workspace.css`. Respect saved light/dark preference; light is the public default.

The homepage is a working directory. Its first region contains search only, with no slogan or subtitle. A dark category rail on desktop carries real category counts and workspace shortcuts. The main canvas places its plain Tools title above a compact two-column directory. Mobile moves search first, then category filters and the tools. No marketing-sized hero, gradients, decorative mock browser, duplicate navigation chips, invented proof or extra promotional copy. Mobile uses readable single-column tool rows and compact thumbnail download rows and 44px interactive targets. Desktop uses two columns. Search, disabled-content behavior, analytics attributes, Google sign-in and download/payment handlers retain their original wiring.

`workspace.css` overrides the existing public styles after `pro-max.css`; homepage-only `workbench.css` then recomposes the directory. Tokens and the public-scoped scaffold base are imported locally; admin pages do not load them. Container: 1280px maximum on the homepage, 1160px on other public routes with 16px mobile gutters. Use `minmax(0,1fr)` tracks, immediate visible focus rings and reduced-motion fallbacks.

Copy changes: all promotional hero wording is removed, including “Tools for everyday work.” and “Find a tool. Get straight to work.” The hero contains the existing real search field only. Hero chips, repeated actions and reassurance dots are removed; their destinations remain in navigation and the catalogue. Collection heading becomes “All tools”. The duplicate Photo Tools promotion moves into a workspace shortcut; its privacy fact remains in the rail. The existing guide becomes a disclosure and contact is retained in the rail/footer. Download heading becomes “Downloads”. Featured labels use sentence case. Decorative link arrows are removed from tool actions and footer links.

No picture placeholders or missing brand assets. Real icons and uploaded covers remain the material.
