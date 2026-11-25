---
name: SanuwarTools
description: A clear workspace for useful browser tools and resources.
colors:
  primary: "#155b42"
  primary-hover: "#104731"
  canvas: "#f6f7f3"
  paper: "#fff"
  surface-subtle: "#f0f3ee"
  ink: "#15251e"
  ink-secondary: "#15251e"
  muted: "#4d5e55"
  faint: "#4d5e55"
  line: "#d8e0d9"
  line-strong: "#a9bab0"
  workspace: "#f0f3ee"
  accent-wash: "#e2efe4"
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
    textColor: "{colors.paper}"
    rounded: "{rounded.action}"
    padding: "8px 26px"
    height: "44px"
  search-field:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.search}"
    padding: "6px 7px 6px 16px"
  panel:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.panel}"
    padding: "{spacing.panel}"
  tool-row:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.row}"
    padding: "10px 12px"
---

# Design System: SanuwarTools

## Overview

**Creative North Star: "The Everyday Workspace"**

SanuwarTools opens to a search-first directory on an off-white canvas with forest-green actions. The home page gives equal access to search and browsing. Individual tools prioritize their controls, inputs and results.

The shared public chrome is in `static/assets/css/workspace.css`. The current directory and tool layouts are in `static/assets/css/tool-studio.css`.

## Colors

Green identifies primary actions, keyboard focus and the selected category. Pale sage marks previews, active controls and result panels. White separates work surfaces from the page canvas. Dark mode uses the same roles with a deep green canvas and a light green accent.

## Typography

Inter serves interface labels and headings. Use monospace for editable code, output and technical data. Page title, controls and help copy have distinct sizes so the active work is easy to find.

## Layout

The home page puts search first, categories on the left and six tools in a three-column grid. The resource strip links to downloads, guides and Eduhelp. On mobile the category rail scrolls horizontally and tool cards use two columns.

Tool pages put help and related links below the workspace. Documents and players use a wider stage. Calculators keep data entry and results in a focused column. Text tools distinguish source and output. QR brings settings and preview side by side. OCR separates file and language from text output. Application File Pack shows photo and signature requirements together. The study planner places its timer beside revision targets. Side-by-side work surfaces stack on small screens.

## Elevation & Depth

The canvas, header, task rows and panels are flat and border-led. Search focus uses a 2px accent-wash ring. The expandable footer panel alone has a structural floating shadow (`0 15px 35px -16px #0005`). Preserve the existing animated hover navigation and reduced-motion behavior; this workspace does not introduce a new motion system.

## Shapes

Panels have gently rounded corners, rows are slightly tighter, and primary actions use compact rounded rectangles. Colored icon sockets are 40px squares with 9px corners; compact workspace icons are 34px. Thin borders define grouping without heavy shells.

## Components

- **Primary action:** forest-green fill, white text, 44px minimum search-button height, compact corners. Keyboard focus uses a 2px green outline offset by 3px.
- **Search:** an outlined field with a search icon and keyboard shortcut hint. It opens the existing shared global search dialog; it does not create a competing search engine.
- **Task row:** colored SVG symbol, strong task name, muted one-line description and optional arrow. Hover strengthens the border and uses the subtle surface token.
- **Workspace:** an optional panel for recent and saved tools. Favorites use a real star toggle with `aria-pressed`; descriptions distinguish recent and saved entries.
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
