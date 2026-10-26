# Browser photo tools

`/photo-tools` edits local images with Canvas. No image bytes are posted to the application, stored in accounts, or passed to external services. The page has a first-party CSP and no AdSense/GIS script. Files are capped at 16 MB and 40 megapixels; an editing copy is capped at a 4096-pixel longest edge. Supported inputs are browser-decodable JPEG, PNG, WebP, BMP and GIF (one frame). HEIC/TIFF should be exported to JPG first. Camera capture uses the device file picker; desktop pickers may offer a regular file chooser instead.

Features: drag/keyboard/slider crop positioning, zoom, quarter-turn rotation, flip, brightness, contrast, transparent-area background fill, exact pixel dimensions, JPG/PNG exports, DPI metadata, decimal KB ceilings, local custom presets (20 maximum), 4 × 6 inch and A4 print sheets at 300 DPI. This does not remove backgrounds or verify face placement/document acceptance. PNG is lossless; an impossible size ceiling is reported instead of silently exporting an oversized file. JPG compression searches quality while preserving requested dimensions. Sheet export uses physical dimensions derived from pixels/DPI and ignores the single-photo KB ceiling.

The `builtin-photo-tools` catalogue record can be disabled/hidden through the existing admin controls. This hides its card and sitemap entry and makes the direct route return 404. Deleting the catalogue record removes its card, while the built-in route remains available.

Preset sources checked 2026-10-26:
- [Protean DSC guidelines](https://tin.tin.proteantech.in/pan/InstructionDSC.html): photo 25 × 35 mm at 200 DPI, JPEG up to 20 KB; signature 45 × 20 mm at 200 DPI, up to 10 KB. These describe the DSC workflow, not all PAN applications.
- [India Embassy Ankara](https://www.indembassyankara.gov.in/eoiank_pages/MTg2): passport print 35 × 45 mm. Tool uses 300 DPI for print preparation, rounded to whole pixels.
- [India High Commission London](https://www.hcilondon.gov.in/page/general-guidelines-indian-passport-faqs/): mission photo upload 630 × 810 px. The user must enter the limit shown on their portal; the selected DPI is a print setting.
- [ECI Form 6](https://voters.eci.gov.in/formspdf/Form_6_English.pdf): unsigned 35 × 45 mm colour photograph with white background. Tool's 300 DPI is a print-preparation choice, not an ECI digital-upload DPI requirement.

Exam portals that require live capture cannot be satisfied by a downloaded/resized photo. Generic exam requirements should be entered as custom settings from the current application instructions, rather than maintaining misleading universal NEET/SSC/UPSC presets.

Validation: Python route/CSP/availability tests, Node geometry/metadata/size-limit tests, plus browser UI exports inspected with Pillow for decoded dimensions, DPI and actual byte size. Synthetic images only. Browser print-sheet file generation is checked separately from a physical printer; physical print size and real-phone camera capture require device validation.

Commands:
```
.venv312/bin/python -m unittest discover -s tests -q
node --test tests/photo_core.test.cjs
```
