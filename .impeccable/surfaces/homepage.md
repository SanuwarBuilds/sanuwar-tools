# Homepage

## Mode

Operate. Help a visitor choose a task and resume useful work with minimal browsing.

## Authority

The user-approved `.impeccable/mocks/approved-homepage.png` supersedes the former orange hardware-plaque homepage. `DESIGN.md` records the reusable implemented visual system. The implementation lives in `templates/index.html` with the public workspace stylesheet loaded last by the shared base template.

## Composition

1. Compact shared header with existing animated hover navigation, theme control and account action.
2. “What would you like to do?” heading, short supporting line and broad search field opening the existing global search dialog; four direct quick-task links.
3. Six popular task rows, alongside Your workspace. Photo resizing has a configured fallback when the photo tool is unavailable.
4. Category strip for image/media, PDF/documents, developer, calculator and text tools, plus all categories.
5. Public featured downloads alongside Eduhelp study resources and interactive labs. Download visibility follows configuration; missing items use an honest empty state.
6. Existing widgets/ad placement and compact shared footer. Guides & more retains complete tool and guide navigation in an expandable panel.

## Workspace behavior

Use `saved-tools.js` and the existing browser-local storage key. Quick access is real linked content, then recent tools appear after supported tool visits. Favorite stars update saved state with accessible pressed labels. Recent entries are capped at six; favorites at fifty. Do not imply cloud synchronization or populate fake history.

## Responsive behavior

At 1250px the header and rows compact. At 1100px the main split stacks, recent entries use three columns and the footer wraps. At 760px the tool/library/recent grids stack, categories form two columns, gutters reduce to 16px and the search keyboard hint disappears. The footer disclosure becomes a fixed panel above mobile navigation. Keep controls and labels usable without horizontal page scrolling.

## Implementation boundaries

Public routes use the light workspace by default while an explicit saved dark preference remains supported through dark tokens. Admin layout remains separate. Native SVG sprite assets supply task symbols without a new dependency. The complete tool catalogue, guides, download configuration, shared search and existing hover navigation remain functional dependencies.

## Evidence status

This brief records approved direction and inspected source implementation. It is not runtime or deployment proof. The Impeccable launcher previously returned permission denied; no detector or full skill runtime pipeline is claimed here. Browser and functional validation are tracked by the implementing agent.
