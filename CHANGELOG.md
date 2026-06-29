# Changelog

What changed in each version of H.A.H.N.S, newest on top. Written in plain
terms for techs. The version here matches the stamp shown in the panel and on
the setup page (e.g. `v0.1.1-alpha`).

Categories: **Added** (new), **Changed** (different behavior), **Fixed** (bugs),
**Removed** (taken out).

---

## v0.3.9-alpha — in progress

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
