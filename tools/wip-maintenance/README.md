# Maintenance Schedule parser — WORK IN PROGRESS (not shipped)

Dev prototype for the 4th PDF type: **VW Maintenance Schedules** (v0.5.0-beta target).
This is **not** wired into the app yet — `main` and the live app are unchanged.

## Files
- **`parse-maint.js`** — the maintenance parser prototype. Run: `node parse-maint.js`
  (reads `~/Downloads/2019 VW Maintenance Schedules.pdf`, gitignored/licensed).
  Parses both schedules (ICE + BEV): the Service Intervals grid, the Minor/Standard/
  Extended lists, and the dense 3-column **Additional Items** table (exact model↔interval
  pairing via the drawn table **border lines**). To port into `src/helper.js`, wrap as
  `parseMaintenance(pages)` / `msFromPdf(buf,name)` with its own `MS_PARSER_VER`.
- **`preview-ui.js`** — vehicle matching + due logic + preview UI (inlined into the page).
- **`build-preview.js`** — assembles the self-contained preview page
  (`~/Downloads/HAHNS-maintenance-preview.html`) from src/helper.js + the two files above.

## Reader change already in `src/helper.js` (uncommitted → on this WIP branch)
`pdfPages(buf)` → `Array<{lines, runs, rules}>` per page; `pdfPageRuns` now also collects
horizontal border lines (`rulesOut`). **Additive only — all 46 fluid/SX PDFs still 0-drift.**

## What's left
Port the parser into helper.js as its own parser + `ms_pdfs`/`ms_parsed`/`ms_meta` IDB
stores + Settings section (mirror Service Xpress) + mileage & delivery vehicle-bar fields
+ the "Possible NNK service due" popup. See the `maintenance-schedule-feature` memory for
the full design, gotchas (checkbox U+F0A8, wrap hyphen U+2010, full-width vs inner border
rules), and the owner's due/matching requirements (replace-only, exact model-code e.g.
BW2≠5N Tiguan).
