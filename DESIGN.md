---
name: SanuwarTools
description: A clear workspace for useful browser tools and resources.
colors:
  primary: "#3424bd"
  primary-hover: "#5842d9"
  canvas: "#fff"
  surface-subtle: "#fafaff"
  ink: "#111321"
  ink-secondary: "#303244"
  muted: "#56596d"
  faint: "#62657a"
  line: "#e0e1eb"
  line-strong: "#c5c7d9"
  workspace: "#f2f1fc"
  accent-wash: "#eeebff"
  icon-purple: "#6740ed"
  icon-purple-wash: "#f0eaff"
  icon-blue: "#0874dc"
  icon-blue-wash: "#eaf3ff"
  icon-red: "#db3543"
  icon-red-wash: "#ffedef"
  icon-green: "#187b39"
  icon-green-wash: "#eaf6ed"
typography:
  display:
    fontFamily: "Inter, sans-serif"
    fontSize: "clamp(30px, 3.4vw, 46px)"
    fontWeight: 750
    lineHeight: 1.14
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Inter, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Inter, sans-serif"
    fontSize: "16px"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: "16px"
  label:
    fontFamily: "Inter, sans-serif"
    fontSize: "12px"
    lineHeight: 1.4
rounded:
  panel: "14px"
  search: "12px"
  row: "10px"
  action: "9px"
  small: "6px"
spacing:
  compact: "8px"
  row-gap: "10px"
  icon-gap: "12px"
  grid-gap: "16px"
  panel: "18px"
  section: "20px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.canvas}"
    rounded: "{rounded.action}"
    padding: "8px 26px"
    height: "44px"
  search-field:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.search}"
    padding: "6px 7px 6px 16px"
  panel:
    backgroundColor: "{colors.canvas}"
    rounded: "{rounded.panel}"
    padding: "{spacing.panel}"
  tool-row:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.row}"
    padding: "10px 12px"
---

# Design System: SanuwarTools

## Overview

**Creative North Star: "The Everyday Workspace"**

A clear, compact workspace for choosing a useful task and getting started. White surfaces, restrained indigo actions, readable Inter type and colored task symbols make the catalogue easy to scan. The user-approved homepage reference establishes the current visual authority and supersedes the former hardware-plaque design.

**Key Characteristics:**
- Search is immediately available.
- Thin borders and tonal grouping define sections.
- Compact task rows pair a colored symbol with direct labels.
- Shared public chrome stays consistent across routes.

This document records the implemented public workspace. Its authoritative source is `static/assets/css/workspace.css`, loaded last for public pages under `body.pro-theme.v2.bp.nx.wb-ui.reference-ui`. The approved reference is `.impeccable/mocks/approved-homepage.png`. Page strategy belongs in `.impeccable/surfaces/homepage.md`.

## Colors

### Primary

Indigo identifies the primary action, links, brand dot and keyboard focus. Its wash supplies selection and saved-star feedback.

### Secondary

Purple, blue, red and green task symbols sit on matching pale washes. These colors identify task families and remain accompanied by text.

### Neutral

White is the default public canvas and card surface. Dark ink supports headings, muted slate supports descriptions, and pale cool lines separate compact rows. The workspace uses a lavender-tinted ground to group personal shortcuts.

Dark mode overrides the same CSS variables: canvas `#14141d`, card `#1c1c29`, ink `#f5f5ff`, line `#38384c`, primary `#b6a6ff`, workspace `#302a48`. Public routes initially select light; persisted user dark choice remains supported. These are theme overrides, not a second component system.

## Typography

Inter with a sans-serif fallback serves every role. The display headline uses a tight, balanced setting; titles use semibold compact copy and descriptions stay visibly secondary. The frontmatter records the desktop hierarchy. Section headings become 19px and tool titles 14px at the mobile breakpoint; the hero becomes 30px. Keep interface copy direct and in English.

## Layout

The public content wrap is capped at 1440px with 40px side gutters. Panels use 18px padding and 16px grid gaps. The homepage pairs a two-column popular-tools panel with a narrower workspace (1.9:1); download and education panels form equal columns. Header height is 56px.

At 1250px, the header and task rows compact and the main split becomes 1.7:1. At 1100px, the main grid becomes one column, recent shortcuts use three columns, the category heading moves above its links, and the footer wraps. Header height becomes 60px. At 760px, gutters become 16px; tool, library and recent grids become one column, panels use 16px padding and categories use two columns. The search keyboard hint is hidden and quick links wrap. The footer reserves room for existing mobile navigation; its Guides & more panel becomes fixed above that navigation.

## Elevation & Depth

The canvas, header, task rows and panels are flat and border-led. Search focus uses a 2px accent-wash ring. The expandable footer panel alone has a structural floating shadow (`0 15px 35px -16px #0005`). Preserve the existing animated hover navigation and reduced-motion behavior; this workspace does not introduce a new motion system.

## Shapes

Panels have gently rounded corners, rows are slightly tighter, and primary actions use compact rounded rectangles. Colored icon sockets are 40px squares with 9px corners; compact workspace icons are 34px. Thin borders define grouping without heavy shells.

## Components

- **Primary action:** indigo fill, white text, 44px minimum search-button height, compact corners. Keyboard focus uses a 2px indigo outline offset by 3px.
- **Search:** a 58px minimum-height outlined compound field, icon, optional keyboard hint and separate Search button. It opens the existing shared global search dialog; it does not create a competing search engine.
- **Task row:** colored SVG symbol, strong task name, muted one-line description and optional arrow. Hover strengthens the border and uses the subtle surface token.
- **Workspace:** pale lavender panel with quick access until recently used entries exist. Favorites use a real star toggle with `aria-pressed`; descriptions distinguish recent and saved entries.
- **Navigation:** shared brand, public hover menus, theme control and sign-in/account action. Existing animated hover menus and mobile navigation remain functional authorities.
- **Downloads:** compact rows with actual public title, description, type label and download symbol. Empty collections receive a truthful message.
- **Footer disclosure:** Guides & more retains the complete tool and guide links inside an expandable panel.

Symbols come from the native SVG sprite `static/assets/icons/workspace.svg`. New components should reuse it without adding an icon dependency.

## Do's and Don'ts

### Do:
- Do use the workspace tokens for public surfaces and keep visible keyboard focus.
- Do pair task icons with readable text labels.
- Do preserve real catalogue links and truthful empty states.
- Do honor an explicitly saved dark preference.

### Don't:
- Don't revive the superseded orange hardware, scanline or embossed-plaque treatment.
- Don't replace catalogue content with invented downloads, counts or testimonials.
- Don't apply the public workspace override to the admin layout.
