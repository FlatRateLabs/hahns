# Changelog

What changed in each version of H.A.H.N.S, newest on top. Written in plain
terms for techs. The version here matches the stamp shown in the panel and on
the setup page (e.g. `v0.1.1-alpha`).

Categories: **Added** (new), **Changed** (different behavior), **Fixed** (bugs),
**Removed** (taken out).

---

## v0.3.4-alpha — in progress

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
