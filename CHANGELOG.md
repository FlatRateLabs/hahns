# Changelog

What changed in each version of H.A.H.N.S, newest on top. Written in plain
terms for techs. The version here matches the stamp shown in the panel and on
the setup page (e.g. `v0.1.1-alpha`).

Categories: **Added** (new), **Changed** (different behavior), **Fixed** (bugs),
**Removed** (taken out).

---

## v0.3.16.1-alpha — 2026-07-05

### Added
- **Added special tool 3259 to the built-in scan list.** It now gets picked up when a page writes it as a
  tool callout (`-3259-`).

---

## v0.3.16-alpha — 2026-07-05

### Added
- **Tool descriptions in the "Find these tools" pop-up and the printout.** Each tool now shows what it
  *is* (from your shop list, or what the scan read off the page) next to its number and drawer location —
  so a number you don't recognize still tells you the tool. (Your shop list's descriptions appear after you
  re-upload the list once on this version.)
- **A built-in VW special-tool list baked into the page scan (~1,000 tools).** The scanner now recognizes
  these tools even before you load a shop list, and catches number formats it used to miss. Plain-number
  tools (like 1833) are only picked up when the page writes them as a tool callout (e.g. `-1833-`), so
  ordinary numbers in the text aren't mistaken for tools.

### Changed
- **The shop special-tool list now lives in the browser database (IndexedDB), same as the fluid
  tables.** It used to be kept in the browser's older "local storage." Your existing list moves over
  automatically the first time you open this version — nothing to re-upload. Everything is still saved
  only on this computer, never uploaded, and still isn't cleared by Exit / New Vehicle / Clear info
  (only by Settings → "Remove list"). No change to how you use it.
- **The app's browser database is now named `hahns_db`** (it holds more than fluids). The very
  short-lived `hahns_fluids` database from the day before is simply removed on first open. If you had
  loaded fluid PDFs on that one-day-old version, re-load them once in ⚙ Settings — your tool list
  carries over automatically.

---

## v0.3.15.4-alpha — 2026-07-04

### Fixed
- **Range capacities were half-shown.** When a fluid capacity is a range — e.g. the 2025/2026
  ID.Buzz / ID.4 / ID.7 "Single Speed 0MJ" transmission `0.88 - 0.93 L`, and the older DSG
  `6.9 - 7.2 L` — only the high end was picked up in bold and the low end got left behind in the
  grey label. The full range now shows as the value. (Verified against the archived 2011–2026 data:
  47 range cells corrected, no other values touched.) Modern fluid reader → **1.3.4**; saved PDFs
  re-read automatically on this update.

---

## v0.3.15.3-alpha — 2026-07-04

### Changed
- **A/C capacities now show grams only (imperial ounces dropped).** VW works in grams, so the
  redundant `(… oz.)` / `(… fl. oz.)` conversions are removed from the Air Conditioning card —
  cleaner, one unit.

### Fixed
- **e-Golf (2015–2018) and 2017 Tiguan A/C capacities were still wrong.** On those years the ounces
  conversion was wedged into the middle of the metric value, so the charge got stranded and only the
  tolerance showed (e.g. `15 g` instead of `500 +/- 15 g`). Removing the imperial conversion fixes
  those cells: e-Golf reads `500 / 950 / 850 / 450 +/- 15 g`, the 2017 Tiguan `460 +/- 15 g`, etc.
  (Verified against the full archived 2011–2026 A/C data — all correct, no other years affected.)
  Modern fluid reader → **1.3.3**; saved PDFs re-read automatically on this update.

---

## v0.3.15.2-alpha — 2026-07-04

### Fixed
- **A/C capacity fix, take two — now handles the 2018 Golf R's tolerance format.** The v0.3.15.1
  fix only caught tolerances written as `±` / `+/-`. On some years (e.g. the 2018 Golf R) the
  "plus-or-minus" prints as three spaced characters — `+ / -` — which slipped through, so the A/C
  charge (500 g) still showed in the small grey label with the tolerance (15 g) bolded. The reader
  now normalizes that spaced form too, so A/C and A/C compressor oil read correctly as
  **500 +/- 15 g**. (Modern fluid reader → **1.3.2**; saved PDFs re-read automatically.)

> **If a year still looks wrong after re-dragging:** re-load that year's PDF once via ⚙ Settings.
> Years loaded before v0.3.15 have no saved PDF to re-read automatically, so a one-time re-upload
> applies the newest reader (and enables automatic fixes going forward).

---

## v0.3.15.1-alpha — 2026-07-04

### Fixed
- **Air-conditioning (and A/C compressor oil) capacities on some years showed the wrong
  number in bold.** On years like the 2018 Golf R the charge printed as *"Initial 500 +/-
  Fill / Refill **15 g**"* — the real capacity (500 g) was buried in the small grey text and
  the ± tolerance (15 g) was shown as the big number. Now it reads correctly as **500 +/- 15 g**
  (and the compressor oils likewise), matching how other years already displayed. This was a
  table-layout quirk where the "Initial Fill / Refill" label words landed between the number
  and its tolerance.
- Because of this fix the **modern fluid reader version ticks to 1.3.1**, so any fluid PDFs you
  have saved are re-read automatically in the background on this update — no re-upload needed.

---

## v0.3.15-alpha — 2026-07-04

### Changed
- **Your fluid PDFs are now kept safely in this browser, and improvements apply by
  themselves.** Before, Hahns converted a fluid PDF and threw the PDF away — so whenever the
  fluid reader was improved (a page-break fix, a corrected oil grade, etc.), the only way to
  get the fix was to clear your browser data and re-upload every PDF. Now the original PDFs
  are stored on this computer (in the browser's own database, still **never uploaded
  anywhere**). When you re-drag an updated Hahns, it quietly re-reads your saved PDFs with the
  newer reader in the background — no re-uploading, no clearing anything.
- **New "Fluid database" panel in ⚙ Settings.** Shows where the data is stored, the current
  fluid-reader versions, how many model years you have installed, how much space the PDFs use,
  when the last background update ran, and an overall health check.

### Fixed
- Fluid tables that were loaded on an older version keep working after this update; re-upload
  those years once to also get automatic reader updates for them going forward.

---

## v0.3.14-alpha — 2026-07-03

### Added
- **The page scan now uses your uploaded tool list to catch oddly-named tools.** Special
  tools that don't look like the usual `T…`, `VAS…` or `VAG…` numbers — for example
  `VW 771` or `VW 771/37` — used to be skipped by the scan. Now, if a tool is on the list
  you loaded in ⚙ Settings, Hahns will spot it on the repair page even when its name is
  unusual, show it under Special Tools, and give it a drawer location in **Find these
  tools**. (Tools that are only numbers with no letters are still skipped on purpose, so a
  bare number can't be confused with a torque value or part number.)

### Fixed
- **The 2018 Golf R engine oil now lists `VW 504 00 (0W-30)`.** Because that oil line is
  squeezed in the PDF, the `(0W-30)` wrapped to the next line and was being dropped — it's
  now kept with its spec. (Checked every year 2011–2026: this was the only entry affected.)
- **Windows no longer close on their own.** If you opened Settings (or the Fluids/tools
  window) right after scanning a vehicle, it would vanish a few seconds later when the
  green vehicle bar auto-minimized. The bar still minimizes, but the window you're using
  stays open.
- **The "find on page" magnifier now opens collapsed sections first.** If a special tool
  lived inside a dropdown/expandable section on the ELSA page, clicking the magnifier
  appeared to do nothing (there was nothing on screen to jump to). It now opens that
  section, then scrolls to and highlights the tool.

### Changed
- **Every pop-up window now has a standard ✕ in the top-right corner to close it**, instead
  of a "Close"/"Cancel" button that was easy to miss.

### Note
- **Re-drag to get all of this** (hard-refresh the setup page, then drag the button up
  again). Your loaded tool list and fluid tables are kept.

---

## v0.3.13-alpha — 2026-07-02

### Changed
- **Fluids & Capacities now runs entirely from your own computer.** Load the yearly
  **"VW Fluid Capacity Tables" PDFs** once through the ⚙ Settings gear (you can pick all
  the years at once) — Hahns converts each PDF **right in the browser** into a small
  lookup table it keeps on that computer, shows you a preview of the years and models it
  found before saving, and the PDFs themselves aren't kept. The Fluids & capacities
  button then opens the same vehicle-matched lookup as before (now with its own **Print**
  button), built locally with **zero network calls** — the fluid data is no longer
  fetched from the Hahns website at all. Like the shop tool list, the loaded tables stay
  on that computer and are **not** cleared by Exit / New Vehicle / Clear All Info — only
  by Settings → Remove tables. **Re-drag to get this**, then load your PDFs once per shop
  computer.

### Removed
- The hosted fluid-lookup page (`fluids.html`) and the published per-year fluid data
  files were removed from the website — the lookup lives inside the app now. If you're
  on an older version, the fluids link will stop working until you re-drag.

---

## v0.3.12.1-alpha — 2026-07-01

### Changed
- **Settings now shows which tool list is loaded.** Instead of just the upload date, it now
  shows the **file name**, its **format** (CSV or Excel .xlsx), and the **date** — so you can
  tell at a glance exactly which list Hahns is using. **Re-drag to get this.**

---

## v0.3.12-alpha — 2026-07-01

### Added
- **Upload your tool list as Excel (.xlsx) — no more "save as CSV" step.** When you pick a
  native Excel file in Settings, Hahns now reads it right in the browser and converts it for
  you (first sheet). CSV still works exactly as before. This all happens **on your computer**
  — nothing is uploaded, still **zero network calls** on ELSA. (Old-style `.xls` files and
  Apple Numbers aren't supported — save those as CSV or `.xlsx` first.) **Re-drag to get
  this.**

---

## v0.3.11.1-alpha — 2026-07-01

### Changed
- **Tidied the no-vehicle view.** Removed the extra "Scanning a repair page works right
  away…" note — it repeated what the greyed-out **Fluids & capacities** row already says
  ("scan Vehicle Summary to enable"). One less thing on screen. **Re-drag to get this.**

---

## v0.3.11-alpha — 2026-07-01

### Changed
- **SCAN now works without loading a vehicle first.** If you're already in a repair
  procedure, just click **SCAN** — Hahns collects the specs right away. You no longer have
  to go back to the Vehicle Summary page first. **Re-drag to get this.**
- **Loading the vehicle is now only needed for Fluids & Capacities.** Scan ELSA's
  **Vehicle Summary** page once to turn that feature on. Until you do, the Fluids &
  Capacities row shows as greyed-out with a note telling you how to enable it — so you
  know the feature is there.

---

## v0.3.10.1-alpha — 2026-06-30

### Changed
- **When you minimize Hahns, it now shows the SCAN button** instead of the New Vehicle
  button — so you can collapse the panel and still scan a page in one click. (New Vehicle
  is tucked away until you expand again.) **Re-drag to get this.**

---

## v0.3.10-alpha — 2026-06-30

### Added
- **Your shop's tool list — "Find these tools."** You can now load your shop's
  special-tool list (a CSV file), and a **"Find these tools"** button (under Special Tools)
  opens a **separate, printable window** — a tidy **tick-off list** with the **tool number
  on the left, its drawer/location on the right, and a check box** so you can cross each
  one off as you grab it (ticking it strikes the line through). It's sorted by drawer so
  same-drawer tools sit together (one-trip grab), and has its own **Print** button (clean,
  easy-to-read, just like the main Hahns print).
  - **Load it from the new ⚙ gear (top-right).** Pick your spreadsheet (saved as **CSV** —
    File → Save As → CSV), then tell Hahns which column is the **tool number**, the
    **drawer**, and (optionally) the **description**. It handles different layouts — your
    3-column list or VW's 4-column minimum-index sheet — and guesses the columns for you.
  - **Flags problem tools.** If your list notes a tool as **MISSING**, **CHECK PART
    NUMBER**, broken, etc., Hahns shows that warning right in the tool list AND in the
    Find-these-tools window. If a tool **isn't on your list at all**, it's flagged
    **"not in list"** — a sign to order it or update your list.
  - **Keeps the main panel uncluttered.** The drawer locations live in the pop-up window,
    not the main list — the main list just shows the tools (with a warning on any that need
    attention).
  - **Stays on your computer.** The list is saved **only on that shop computer** (never
    uploaded, never on GitHub) and the window is built locally too — the bookmark still
    makes **zero network calls** on ELSA. Each computer loads its list once; re-upload to
    update. **This is a code change, so hard-refresh the setup page and re-drag.**

---

## v0.3.9-alpha — 2026-06-29

### Added
- **Meet Hahns!** The plain wrench icon is replaced everywhere by the **Hahns mascot** —
  in the panel header inside ELSA, on the setup page (full-body), on the Fluids &
  Capacities page, and as the **browser tab/bookmark icon** (favicon). The mascot in the
  panel is built right into the bookmark, so it still makes **no network calls** and keeps
  nothing — same privacy promise as before. **This is a code change, so hard-refresh the
  setup page and re-drag your bookmark to get Hahns.**

---

## v0.3.8-alpha — 2026-06-29

### Added
- **Fluid & capacity data for 2011, 2012 and 2013.** The lookup now covers **2011
  through 2026**. (Older years 2006–2010 list engines by size only — no engine code —
  and 2000–2005 use a different table format; those need more work and will come later.)

### Fixed
- **More accurate A/C refrigerant amounts (2014–2017).** Those years' air-conditioning
  charges were showing the *tolerance* (e.g. "25 g") instead of the actual amount; they
  now read correctly (e.g. "525 ± 25 g"). New fluid years are served data, so you do
  **not** need to re-drag the bookmark for any of this.

---

## v0.3.7.2-alpha — 2026-06-29

### Changed
- **Clearer buttons, less confusion.** The **New job** button is renamed **New Vehicle**
  (it wipes the loaded vehicle *and* all collected info) and moved to the **top**, right
  under the version line, so the "start over" action is easy to find. **Clear info** is
  renamed **Clear All Info** (it clears collected info but keeps the vehicle) and stays
  next to the job title.
- **Faster hover hints.** The little explanations that pop up when you hover a button now
  appear quickly instead of after the usual long browser delay.

> **Re-drag needed:** this changes the bookmarklet itself, so hard-refresh the setup
> page and re-drag the bookmark.

---

## v0.3.7.1-alpha — 2026-06-28

### Added
- **"Clear info" button.** A new button under **New job** wipes everything Hahns has
  collected — torque, replace, special tools, warnings and diagrams — **but keeps the
  loaded vehicle**, so you can start a fresh procedure on the same car without
  re-scanning the Vehicle Summary. (New job still clears the vehicle too.)
- **Per-group Clear.** Each section (Torque, Replace, Special Tools, Critical Warnings,
  Diagram) now has its own small **Clear** button in its header to empty just that
  group. Both kinds of clear ask "Clear all?" first so a stray tap can't wipe your work.

> **Re-drag needed:** this changes the bookmarklet itself, so hard-refresh the setup
> page and re-drag the bookmark.

---

## v0.3.7-alpha — 2026-06-28

### Changed
- **The green "Vehicle loaded" box now collapses to save space.** A few seconds after
  it appears it tucks itself away to a single "✓ Vehicle loaded" line, giving the rest
  of the panel more room. Click the little arrow on the right to open it back up and
  edit any field, and click again to collapse it. If any fields are still blank, the
  collapsed line shows a small "N to add" tag so you don't miss them.

> **Re-drag needed:** this changes the bookmarklet itself, so hard-refresh the setup
> page and re-drag the bookmark.

---

## v0.3.6-alpha — 2026-06-28

### Added
- **Find-on-page magnifier.** Every spec, part, tool, and warning that Hahns collected
  now has a small magnifying-glass icon on its left. Click it and Hahns scrolls the ELSA
  page to exactly where it found that item and flashes it yellow so you can eyeball it in
  context. The highlight fades on its own and changes nothing on the page.
- Items collected from an **earlier page** of a multi-page job show the magnifier
  **greyed out** (with a tooltip) — the browser throws that page away when you navigate,
  so there's nothing left to jump to until you go back to it. Hand-added rows and the
  Fluids link have no magnifier (they didn't come from a spot on the page).

> **Re-drag needed:** this changes the bookmarklet itself, so hard-refresh the setup
> page and re-drag the bookmark.

---

## v0.3.5.12-alpha — 2026-06-27

### Fixed
- **Sequence diagram now shows on the first scan.** A diagram lower on the page (like
  the tightening-sequence figure) sometimes only appeared after pressing SCAN a second
  time. Hahns now waits for any still-loading images and grabs them automatically, so
  one scan is enough.

### Changed
- **The tightening sequence gets its own labeled section.** The sequence steps and its
  diagram are now grouped under their own heading (the table/figure title, e.g.
  "Cylinder Head – Tightening Specifications and Sequence"), separated from the regular
  bolt torques — like a freshly scanned page — so the list stays organized.

> **Re-drag needed:** this changes the bookmarklet itself, so hard-refresh the setup
> page and re-drag the bookmark.

---

## v0.3.5.11-alpha — 2026-06-27

### Fixed
- **Tightening-sequence tables now read correctly.** When a page has a "Step / Bolts /
  Tightening Specification" table (e.g. cylinder-head bolts), Hahns now lists each
  step in order with its bolts and spec — including the angle-only steps (90°) that
  were being dropped. Before, the step numbers were mistaken for part callouts, which
  scrambled the list and stuck the table header onto the previous part.

> **Re-drag needed:** this changes the bookmarklet itself, so hard-refresh the setup
> page and re-drag the bookmark.

---

## v0.3.5.10-alpha — 2026-06-27

### Fixed
- **Tightening sequences now show up.** On a page like *Overview – Cylinder Head*,
  the cylinder-head bolt's "Tightening Specifications and Sequence — refer to figure"
  note is now captured under Torque (so the bolt clearly needs the sequence), and the
  **sequence diagram itself is now kept** alongside the main overview diagram instead
  of being dropped.
- **A dropped second image can no longer scramble bolt numbers.** Following up on the
  multiple-diagram support: only the main assembly diagram(s) start a new "Fig",
  so a smaller secondary image on the page won't restart or split the numbering.

> **Re-drag needed:** this changes the bookmarklet itself, so hard-refresh the setup
> page and re-drag the bookmark.

---

## v0.3.5.9-alpha — 2026-06-27

### Fixed
- **Replace-after-removal now catches a plain "Replace" note.** When ELSA marks a
  part for one-time use with just the word **Replace** (or **Renew**) next to it, it
  was being skipped. Those parts now show up in the Replace-after-removal section,
  labeled with their component number like everything else.
- **More special tools are recognized.** Tool numbers like **10-222 A** (and its
  sub-parts **10-222 A/1, /2, …**) are now picked up, and the **VAG 1331A / V.A.G
  1332A torque wrenches** are listed under Special Tools instead of being mistaken
  for a torque spec. Works whether or not the number is written with periods
  (VAG or V.A.G).
- **Print now waits for the diagrams.** Diagrams sometimes came out blank on the
  print preview and only showed up on a second try. Print now holds until the
  diagram images have finished loading before opening the preview, so they show up
  the first time.
- **Pages with more than one diagram now keep them separate.** When a page shows
  two assembly diagrams, each with its own numbered bolts and torque specs, Hahns
  now splits them into "Fig 1" / "Fig 2" groups — each diagram's bolt numbers start
  at 1 again and match that diagram, and an identical spec that appears on both is
  no longer dropped. Pages with a single diagram look exactly as before.

> **Re-drag needed:** this changes the bookmarklet itself, so hard-refresh the setup
> page and re-drag the bookmark.

---

## v0.3.5.8-alpha — 2026-06-27

### Fixed
- **Fluids & Capacities now always opens the latest version.** GitHub caches the page
  for ~10 minutes, so after an update you could briefly see the old look/data. The
  fluids link now forces a fresh load every time, so what you see is always current.

> **Re-drag needed:** this changes the bookmarklet itself, so hard-refresh the setup
> page and re-drag the bookmark.

## v0.3.5.7-alpha — 2026-06-27

### Changed
- **Fluids & Capacities page now matches the new look** — its header is the same dark
  graphite with green accent and green wrench as the main panel, instead of VW blue.
  (This is the served lookup page, so you don’t need to re-drag the bookmark for it.)

## v0.3.5.6-alpha — 2026-06-27

### Changed
- **Fluids & Capacities now opens in a small pop-up window** instead of a full new
  tab. It’s sized to fit the data with no side-scrolling (just scroll up/down) and
  centered on screen, so it reads as a quick reference you can glance at and close —
  no hunting for a stray tab. Opening it again reuses the same pop-up. (If your
  browser blocks pop-ups, it falls back to opening a tab.)

> **Re-drag needed:** this changes the bookmarklet itself, so hard-refresh the setup
> page and re-drag the bookmark.

## v0.3.5.5-alpha — 2026-06-27

A fresh look so H.A.H.N.S stands out from ELSA.

### Changed
- **New header color.** The top bar is now dark graphite with a green accent (and a
  green wrench) instead of VW blue, so the panel no longer blends into ELSA2Go.
- **The SCAN button moved and got bigger.** It’s no longer tucked in the header — it’s
  now a large green button (renamed from “Scan page” to **SCAN**) sitting right above
  the job title, so it’s easy to hit at the bay.
- **Version line moved to the very top**, directly under the H.A.H.N.S title bar.
- **Buttons look consistent now.** A long-standing styling bug left most buttons (New
  job, + add, Copy list, Print, etc.) thinner than intended; they’re now uniformly
  bold so the whole panel looks tied together.

> **Re-drag needed:** this changes the bookmarklet itself, so hard-refresh the setup
> page and re-drag the bookmark to get the new look.

## v0.3.5.4-alpha — 2026-06-27

More model years for Fluids & Capacities.

### Added
- **Fluid & capacity data for model years 2014–2018.** The lookup now covers
  **2014 through 2026**. Older years (2006–2013 and 2000–2005) use a different VW
  table format and will come in a later update. New fluid years are served data, so
  you do **not** need to re-drag the bookmark to get them.

## v0.3.5.3-alpha — 2026-06-27

EV drivetrain detail + a recovered 2019 spec.

### Fixed
- **ID.Buzz / ID.4 / ID.7 “0MP” single-speed gearbox now reads clearly.** It used to
  show one mangled line. It now shows the two real service cases: *Refilling
  transmission that had residue removed* → **3.18 L (3.36 qt)**, and *Transmission
  fluid drained, residue not removed* → *fill up to the lower edge of the fill/check
  hole*.
- **2019 Golf SportWagen / Alltrack — AWD Clutch capacity restored.** The
  **655 ml** AWD-clutch fill was being dropped (the original parser didn’t read “ml”).
  It now appears.

## v0.3.5.2-alpha — 2026-06-27

Electric-vehicle fixes for the Fluids & Capacities lookup.

### Fixed
- **Electric vehicles now find their fluids.** Clicking Fluids & Capacities for an
  EV (e.g. *ID. Buzz 1st Edition AWD*, *ID.4 AWD PRO S*) used to say “No fluid entry
  found.” The lookup now matches the vehicle to the right table even when the model
  name carries trim/options (and regardless of spacing or punctuation like the dot in
  “ID.4”). This also fixes a related gap where **2023–2026 Atlas** (“Atlas Family”)
  and **GTI / Golf R** (under “Golf Family”) weren’t matching.
- **EV engine & transmission codes are read from the Vehicle Summary.** EV summaries
  don’t have a single “Engine Code” / “Trans Type” — they list **Front/Rear** motor
  and transaxle codes. H.A.H.N.S now reads those (shown as “FRONT / REAR”), so the
  green vehicle bar fills in and the drivetrain lookup can match the EV’s single-speed
  reduction gear.

## v0.3.5.1-alpha — 2026-06-27

More fluid years.

### Added
- **2020 through 2026 fluid data.** The Fluids & Capacities lookup now covers
  **2020** (Jetta/GLI, Golf/GTI, Golf R, e-Golf, Passat, Arteon, Tiguan, Atlas/Atlas
  Cross Sport), **2021** (adds **Taos** and **ID.4**), **2022** (Jetta/GLI, GTI/Golf
  R, Passat, Arteon, Taos, Tiguan, Atlas/Atlas Cross Sport, ID.4), **2023** (Arteon,
  Atlas Family, Golf Family, ID.4, Jetta, Taos, Tiguan), **2024** (same lineup as
  2023), **2025** (Atlas Family, Golf Family, **ID.Buzz**, ID.4, **ID.7**, Jetta,
  Taos, Tiguan), and **2026** (Atlas Family, Golf Family, ID.Buzz, ID.4, Jetta, Taos,
  Tiguan) in addition to 2019. No need to re-drag the bookmark — new years are served
  automatically.

## v0.3.5-alpha — 2026-06-27

Fluids polish.

### Changed
- **Fluids & Capacities link moved up.** It now sits right under the green vehicle
  box (above the version line), so it's the first thing you reach once a vehicle is
  loaded.
- **Clearer system icons** on the lookup page — an oil can, a thermometer, a
  snowflake, and a gear for Engine Oil / Coolant / A/C / Drivetrain.

## v0.3.4-alpha — 2026-06-27

Fluids & Capacities is now a vehicle-matched lookup.

### Added
- **Fluids & Capacities opens a matched lookup page.** Instead of scanning fluids
  from the repair manual (they're rarely there — they live in a separate per-year
  PDF), the **Fluids & Capacities** section is now a button. With a vehicle loaded,
  it opens a new window showing **Engine Oil, Engine Coolant, Air Conditioning, and
  Drivetrain** for *your* vehicle — capacities and fluid specs matched to your
  Engine Code, Transmission, Model, and Model Year. No digging through the PDF.
- The A/C section shows the **refrigerant type** (R1234yf / R134a) next to each
  charge, and Drivetrain shows all the sub-fills (transmission, bevel box, AWD
  clutch, final drive), with AWD-only parts hidden on front-wheel-drive vehicles.

### Changed
- **Fluids are no longer scanned** from procedure pages. The button needs a vehicle
  loaded (scan the Vehicle Summary first), same as the rest of the job.

### Notes
- Fluid data is published per model year and only the **2019** tables are loaded so
  far. Other years show "no data published yet" until their PDF is processed.

## v0.3.3-alpha — 2026-06-27

Vehicle loading is now locked to the Vehicle Summary page.

### Fixed
- **Only the Vehicle Summary page loads a vehicle now.** ELSA shows the selected
  VIN in its header on *every* page, so scanning a repair-manual page used to load
  a half-wrong vehicle (right VIN, but garbage Model Name / Trans Type). H.A.H.N.S
  now checks for the summary's own layout (the **Vehicle Data** section with its
  Model Name / Engine Code / Model Year / Trans Type fields) before loading
  anything — scan any other page first and it just says that isn't the summary.
- **Tighter field reading.** The five fields are now read straight from their
  ELSA labels, so values like Engine Code (**CDVC**) and Trans Type
  (**09PA – AQ450-8A**) come through exactly.

## v0.3.2-alpha — folded into v0.3.3

Start every job by loading the vehicle.

### Added
- **Load the vehicle first.** Open ELSA's **Vehicle Summary** page and click
  **Scan page** — H.A.H.N.S reads the **VIN, Model Year, Model Name, Engine Code,
  and Trans Type** and pins them in a green "Vehicle loaded" strip at the top of
  the panel, so you can see at a glance that it got a good grab. The vehicle stays
  loaded for the whole job and clears when you Exit or start a New job.
- **Fill in anything it missed.** If a field comes up blank, it's flagged and you
  can click it to type the value by hand. The vehicle also prints and copies at
  the top of the job sheet.

### Changed
- **A vehicle is required before collecting specs.** If you click **Scan page** on
  a repair procedure before loading a vehicle, H.A.H.N.S asks you to scan the
  Vehicle Summary page first instead of collecting anything.

---

## v0.3.1-alpha — 2026-06-25

Bug fixes for how safety banners are read and shown.

### Fixed
- **NOTE banners are now captured.** ELSA flags safety text with four banners —
  **DANGER**, **WARNING**, **CAUTION**, and **NOTE**. The **NOTE** banner's text
  was being skipped (it has no warning word of its own), so important "could
  result in vehicle damage" notes never made it into Critical warnings. They're
  now collected like the other three.
- **Special tools with a "/N" sub-part are read in full.** Tool numbers that end
  in a slash and a number — like **T1000/1** or **VAS 6234/2** — were being cut
  off (or missed). They now come through complete.
- **Each special tool is listed once.** A tool mentioned several times in a
  procedure used to appear as a repeated row in the list. It's now listed a single
  time (the blue chip at the top stays for the quick glance).

### Added
- **Warnings are colour-coded to match ELSA.** Each item in Critical warnings now
  shows its banner type and matching colour — **DANGER** red, **WARNING** orange,
  **CAUTION** yellow, **NOTE** light blue — the same colours ELSA uses, so they're
  easy to tell apart at a glance. The Copy/Print output labels each one too
  (e.g. "NOTE: …").
- **Special tools now show a name.** When the procedure gives the tool a name
  (e.g. "Caliper Piston Tool - T10145/1 -"), the list shows the number **and** the
  name. If there's no name, it just shows the number.
- **You can remove a tool chip.** Each blue tool chip now has a small ✕ to delete
  it (which also removes it from the list below) — handy when a tool isn't one you
  need.

---

## v0.3.0-alpha — 2026-06-25

Replaces the automatic update check (which simply can't work inside ELSA) with a
simple weekly reminder, and tidies up the panel.

### Added
- **Weekly "check for updates" reminder.** On **Wednesdays** — and only once that
  day — a yellow bar appears at the top of the panel: *"App may be out of date.
  **Check for update?**"* The link opens the H.A.H.N.S setup page so you can
  compare your version to the latest; **Dismiss** clears it. Kept deliberately
  low-key: it shows once a week and nothing more, because there's no way to know
  for sure whether your copy is actually out of date. Needs no internet — it's
  just a calendar reminder, so it works the same inside ELSA as anywhere else.

### Changed
- **The setup page now leads with the bookmark button.** The drag-the-wrench
  button moved to the top of the page, so updating is faster to find.
- **"What's new" starts collapsed** on the setup page — click it open when you
  want the full history.

### Removed
- **The automatic, over-the-internet update check** (from v0.2.0–v0.2.4). ELSA
  blocks it completely, so it never worked there — the weekly reminder above
  replaces it. H.A.H.N.S is now back to making **zero network calls**, ever.
- **The "What's new" pop-up inside the panel.** The full history lives on the
  setup page (the only place you can actually update from), so the app no longer
  carries its own copy — which also makes the bookmark smaller.

---

## v0.2.4-alpha — 2026-06-25

### Fixed
- **Clearer "how to check for updates" note.** The note inside ELSA now points
  you straight at the **check for latest ↗** link (which opens the H.A.H.N.S page
  even from inside ELSA), instead of telling you to open the bookmark on another
  web page — which didn't work from a blank tab.

---

## v0.2.3-alpha — 2026-06-25

Settles how the update check behaves on ELSA, after testing proved ELSA blocks
every kind of background check.

### Changed
- **The update check now runs only outside ELSA, and tells you so.** Testing
  confirmed (by the browser itself) that ELSA blocks H.A.H.N.S from reaching the
  internet at all while it's open — so the check no longer even tries while
  you're in ELSA (keeping the "nothing leaves your browser on ELSA" promise
  intact). Instead, the panel shows a short note: *"Update checks can't run
  inside ELSA — open H.A.H.N.S on a normal web page before opening ELSA (or after
  closing it)."* When you do open it off ELSA, it checks and shows the exact new
  version if one exists.

### Removed
- The marker-image trick from v0.2.2 (ELSA blocks images from us too, so it
  couldn't work).

---

## v0.2.2-alpha — 2026-06-25

Attempted to make the update check work inside ELSA via a marker image. Testing
showed ELSA blocks that too — superseded by v0.2.3.

---

## v0.2.1-alpha — 2026-06-25

Reworks the update check from v0.2.0.

### Changed
- **Update check now runs at most once a day** (in the background, after the
  panel is already on screen — it never slows the panel down), instead of once
  per browser session.
- **Clearer update banner**: shows the version you have, the new version, a
  **Get Update** button, and a **Dismiss** button.

### Added
- **Better self-diagnosis.** If the check can't reach the internet, the panel
  still works silently — but the diagnostic dump (click the version stamp) now
  records exactly what happened: whether it was attempted, the HTTP status, the
  error, and whether the browser actually reported a security-policy block. No
  more guessing why an update didn't show.

---

## v0.2.0-alpha — 2026-06-24

New feature release.

### Added
- **Automatic update check.** The first time you open the panel each browser
  session, H.A.H.N.S quietly checks whether a newer version has been published.
  If so, a small banner appears: "Update available — hard-refresh the setup page
  & re-drag the bookmark," with a link to open it. This is the tool's **only**
  network use: it requests a single public version file and sends no job or ELSA
  data. If your shop browser blocks the check, nothing breaks — the panel works
  exactly as before and the manual "check for latest" link still works.

---

## v0.1.1-alpha — 2026-06-24

Bug-fix and polish cycle.

### Added
- **Exit confirmation.** Clicking the panel's **✕** now asks "Are you sure you
  want to exit? All collected job info will be lost." with **Exit** / **Cancel**,
  so an accidental click no longer wipes the job.
- **"What's new" changelog.** This list now appears on the setup page (under
  "Current version"), and after an update the panel shows it once automatically
  so you can see what changed.

### Fixed
- **Closing now actually clears the job.** Before, closing only hid the panel —
  the job stayed in memory and came back when you re-opened the bookmark.
  **Exit** now clears everything (job, saved panel position, minimized state) so
  the next open starts fresh. **Cancel** leaves your job untouched.

---

## v0.1.0-alpha — 2026-06-21

First public release.

### Added
- One-click **Scan page**: pulls torque specs, replace-after-removal parts,
  fluids/capacities, special tools, and critical warnings into one panel.
- **Auto component numbering** so each spec maps to the diagram callout.
- Editable part labels, manual add rows, per-item delete.
- **Job title** bar, **multi-page accumulation** grouped by page.
- **Diagram capture** (numbered-overview pages), **Print** to a clean job sheet,
  **Copy list**.
- **Draggable** panel, **Minimize**, **New job** with confirmation.
- Version stamp + diagnostic dump; paste-box fallback on the setup page.
- Published to GitHub Pages; works in Chrome, Edge, Safari (not Firefox).
