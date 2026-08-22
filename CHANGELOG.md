# Changelog

What changed in each version of H.A.H.N.S, newest on top. Written in plain
terms for techs. The version here matches the stamp shown in the panel and on
the setup page (e.g. `v0.1.1-alpha`).

Categories: **Added** (new), **Changed** (different behavior), **Fixed** (bugs),
**Removed** (taken out).

---

## v0.5.5-beta — in progress

### Added
- **Reads the vehicle’s Country and picks the right market’s maintenance intervals.** Hahns now reads the
  **Country** field from ELSA’s Vehicle Summary (shown, and editable, in the green vehicle bar). A
  **Canada** vehicle uses the Canada service intervals; USA (or blank/unknown) uses USA. (#165)
- **Kilometres for Canada vehicles.** For a Canada-market car the odometer is treated as **km** throughout
  the maintenance feature — the mileage field, the “possible NNK km service due” message, the milestone
  dropdown (in km) and the window all read in kilometres. (#165)

### Fixed
- **Maintenance: services no longer listed twice.** A transmission (DSG) service and, on some cars, spark
  plugs were showing twice at different intervals — they now appear once, at the correct interval. Spark-plug
  matching also respects the engine size (so a 1.8L and a 1.4L don’t both match). (#160, #164)
- **Maintenance: sunroof service now recommended for the Alltrack / Golf wagons.** The Sunroof Drains check
  is a Golf-family service; ELSA calls the car “GSW ALLTRACK”, which was hiding it. Fixed — and a plain Golf
  no longer picks up Golf-R-only services. (#166)
- **Maintenance: Canada-only brake flush no longer shown on USA cars.** A separate Canada brake-fluid
  interval was being applied to US vehicles; it now follows the vehicle’s market. (#165)
- **Confirmations show over the Settings window.** “Removed”, “Saved”, and error messages for the tool list,
  fluid tables, Service Xpress, maintenance PDFs, and Copy-setup now pop up on the Settings screen (where
  you’re looking) instead of behind the app. (#162, #163)
- **Panel no longer jumps to the other side of the screen.** Clicking near the minimize/close buttons and
  slightly missing no longer flings the whole app across the screen. (#167)
- **Minimized panel: “Vehicle” button works.** From the minimized quick-row, tapping **Vehicle** now opens
  the full panel with the vehicle details instead of showing a stray maintenance bar. (#168)
- **Minimized panel: no stray maintenance bar.** With no vehicle scanned and Hahns minimized, the
  “scan Vehicle Summary to enable” bar is no longer shown. (#169)

---

## v0.5.4-beta — 2026-08-18

### Fixed
- **Maintenance: right services for cars named oddly in ELSA (e.g. the Alltrack).** The app now uses your
  car’s **Sales Code / transmission code** to find the right maintenance rows even when ELSA’s model name
  doesn’t spell out the family. A 2017 Alltrack (which ELSA calls “GSW ALLTRACK”) now correctly gets its
  **spark plugs and DSG fluid at the 40K interval** (so they show at 80K). (#154)
- **Maintenance: no AWD fluid on front-wheel-drive cars.** The “AWD Clutch – change fluid” service no longer
  shows on non-AWD vehicles. (#155)
- **Maintenance: no spark plugs on diesels.** Diesels have glow plugs — spark-plug service is no longer
  recommended on a TDI. (#156)
- **Maintenance: timing/toothed belt no longer shows a wrong mileage.** The belt interval depends on the
  exact engine and year in a way the app can’t yet read reliably, so instead of guessing a mileage it now
  shows a **“Verify interval in ELSA”** note. (Full fix tracked in #157.)
- **“New Vehicle” confirm button order** now matches every other Yes/No prompt (Yes on the left). (#152)

### Changed
- **Settings shows the newest PDF years first.** The Update list and the loaded-year chips for fluids,
  Service Xpress and maintenance now list newest → oldest. (#153)
- **Clear “✓ saved / loaded” confirmations.** Loading or updating a fluid, torque, maintenance PDF or your
  tool list — and copying your setup to another computer — now shows a confirmation with an **OK** button
  on top of Settings, instead of a small message that disappears on its own. (#158)

---

## v0.5.3-beta — 2026-08-18

### Added
- **2027 fluid capacities.** The 2027 *VW Fluid Capacity Tables* now read and look up correctly (all 7
  models). Load the 2027 PDF once in ⚙ Settings; the Settings counter now shows **“X / 28 years.”** (#144)
- **Pick the service interval by hand (maintenance).** The “possible services due” window now has
  **Mileage** and **Time in service** dropdowns, so you can check any service for those one-off cases.
  They default to what the scan pulled — the odometer and the delivery-date age — and you can override
  either; **Reset** puts them back. (#148)

### Changed
- **The top of the panel folds into one compact row.** A few seconds after a vehicle loads, the Fluids,
  Maintenance, New Vehicle and Vehicle-details controls shrink into a single icon row to free up screen
  space (Fluids keeps its oil-drop, Maintenance uses a wrench). Tap **Vehicle ▾** to expand the full
  details again. (#149)
- **Maintenance is now discoverable before a PDF is loaded.** Like Fluids, there’s now a button telling
  you to load the Maintenance PDF in Settings, so techs know the feature exists. (#145)

### Fixed
- **Electric vehicles now get their maintenance items.** e-Golf / ID.4 / ID.Buzz were showing *no*
  services due because the electric **“Additional Maintenance Items”** (brake fluid, cabin/pollen filter,
  tire filler bottle) weren’t being read for most years. Now read for every EV year. (#141)
- **Services due now go by mileage OR time — whichever is further along.** A car at ~50,000 miles but
  ~8 years old is now correctly flagged for its **80K** service, not 50K (using the ~10,000 miles/year
  guideline). (#147)
- **The maintenance trash-button note** now shows a matching trash icon instead of a mismatched emoji
  that looked odd on some computers. (#146)

---

## v0.5.2-beta — 2026-08-17

### Changed
- **Maintenance window: the cross-off checkbox is now a 🗑 trash button with a confirm.** The checkbox
  looked like Hahns was recommending the item. Now each item has a trash button — click it and confirm
  (*“Are you sure you want to remove …?” Yes / No*) to take that line off the list (e.g. a cabin filter or
  sunroof clean done last visit) before printing. **Yes** removes it; **No** puts it back.

---

## v0.5.1-beta — 2026-08-16

### Changed
- **Maintenance “services due” — smarter about what a service actually includes** (from bay feedback on a
  2023 Tiguan at 27,651 mi):
  - **The oil change is always listed.** Every gas vehicle gets an engine oil & filter change at its
    service interval, so Hahns now always shows **“Engine Oil and Filter”** under *Replace* — even on the
    newer (2022+) schedules where the service-level table doesn’t come through the PDF cleanly. (Hahns now
    works out the service level — Minor / Standard / Extended — from the mileage using VW’s standard
    cadence when the PDF’s own grid is unreadable.) Electric vehicles don’t get an oil line.
  - **Time-based items follow the ~10,000 mile/year schedule.** A brake-fluid flush (every 3 years, then
    every 2) now lands on the **30K and 50K services** and skips 40K, and the AWD/Haldex fluid (every 3
    years) lands on **30K and 60K** — matching how these actually come due at ~10K mi/yr, using the U.S.
    intervals. An older low-mileage car still gets its first flush flagged from the delivery date.
  - **You can cross items off.** Every item in the maintenance window has a checkbox — tick anything
    already done or not needed (e.g. a cabin filter or sunroof clean done last visit) to strike it out
    before printing.

### Changed (Settings)
- **Each PDF section now shows how many years you’ve loaded out of what’s available** — e.g. *Fluid
  capacity tables **12 / 27 yrs***, *Service Xpress **8 / 19 yrs***, *Maintenance schedules **1 / 18 yrs***
  — right in the section header, so you can see at a glance what’s still missing on this computer.
  (Maintenance is 18 for now — 2010–2027; it grows to 28 once the 2000–2009 format is supported.)
- **Renamed “Fluid database” → “Database & parser versions”** since it now covers all three PDF types. Each
  category (fluid capacities, Service Xpress, maintenance) is its own drop-down showing its parser
  version(s), **PDF storage, last auto-update, and health status** — Service Xpress and maintenance now
  report the same info fluid capacities always did. The old “years installed” line was removed from here
  (that count now lives in the section headers above).

---

## v0.5.0-beta — 2026-08-16

### Added
- **Maintenance schedules — a brand-new 4th kind of PDF.** Load the yearly **VW Maintenance Schedules**
  PDF once per shop computer (⚙ Settings → *Maintenance schedules* → *Load PDFs*), and Hahns shows the
  **services that may be due** for the loaded vehicle at its mileage — in its own printable window, right
  under the Fluids button.
  - The vehicle bar now has an editable **Mileage** field and reads the **Delivery Date** from ELSA’s
    Vehicle Summary (used for the “every N years” items). Type the odometer into Mileage; Hahns rounds it
    to the nearest 10,000-mile service.
  - When something’s due it shows an amber **“Possible NNK service due”** button naming the service level
    (Standard / Extended). The window lists the **Replace** items for that service plus the **Additional
    Maintenance Items** — the *all-vehicles* ones and the ones that match *this exact vehicle*.
  - Matching is exact to your car: a 2nd-gen Tiguan (BW2) gets its own 80,000-mile spark-plug interval, not
    the old Tiguan’s — read from the Sales Code, the same way the fluids and torque lookups work.
  - Same as the other PDFs: read and kept **only on this computer**, never uploaded; travels in **Copy
    setup to another computer**; re-reads itself automatically when the parser improves.
  - **Years supported: 2010–2027.** 2000–2009 use an older, mileage-indexed format and are politely
    declined for now (you’ll get a clear message). Electric-vehicle "additional items" are read for most
    years but not all yet — the gas/diesel side is complete across 2010–2027.

---

## v0.4.9.3-alpha — 2026-08-16

### Fixed
- **Updating a Fluid Capacities year now correctly rejects a Service Xpress chart.** The wrong-file check
  shipped in v0.4.9.2 wasn’t actually in the delivered app (a build was missed), so a Service Xpress PDF
  of the matching year could still be used to update a fluid table. It’s now blocked with the right
  message. (Right file type **and** right year are both required.)

---

## v0.4.9.2-alpha — 2026-08-16

### Changed
- **Service Xpress charts now list by year**, exactly like the fluid tables — the file name is gone from
  the list and the Update chooser. You only pick a file (and see its name) at the point of choosing the
  PDF to add or update.

### Added
- **The Update button now checks the file you pick.** When you replace a year, Hahns makes sure the PDF
  is the **right kind** and the **right year** before saving:
  - Pick a Service Xpress chart while updating a Fluid Capacities year (or vice-versa) → it tells you
    it’s the wrong kind and asks for the correct one.
  - Pick the wrong year (a 2014 file to update 2013) → it tells you and asks for the 2013 file.
  - Either way you can choose another file without starting over.

---

## v0.4.9.1-alpha — 2026-08-16

### Changed
- **Service Xpress charts now show just the file name** in ⚙ Settings — the extra model years listed
  after the file name were confusing, and the file name already has the year in it.
- **Separate “Add PDFs” and “Update” buttons** for fluid tables and Service Xpress charts (they used to
  share one “Add / replace” button). **Update** now opens a small chooser so you pick exactly which year
  (or which chart) you want to replace, then select its new PDF — the rest stay untouched.

---

## v0.4.9-alpha — 2026-08-16

### Added
- **Remove one loaded list at a time** (issue #129). In ⚙ Settings each loaded fluid year and each
  Service Xpress chart now has its own **×** button, so you can drop a single year or a single chart
  without wiping the rest. A **Remove all** button still appears when more than one is loaded.

### Changed
- **Removing a list now asks first** (issue #130). Every remove — the tool list, a fluid year, a torque
  chart, or “Remove all” — shows a **Remove / Cancel** confirmation, so an accidental click can’t erase a
  list you meant to keep.

---

## v0.4.8.2-alpha — 2026-07-16

### Fixed
- **The Drivetrain card now shows YOUR transmission, not every transmission** (issue #126). On a 2017
  Golf Alltrack the card listed all five gearboxes instead of the one in the car. The tables write a
  long application across two lines — *“6 Speed Direct Shift Gearbox”* then *“0D9 (FWD)”* underneath —
  and Hahns was reading the second line as a separate entry. That left the gearbox with no code to match
  against, so it fell back to showing everything. The two lines are now read as one entry.
  - This also **reunites capacities that had drifted onto the wrong line**: the Refill and Mechatronic
    amounts were being split away from their Initial Fill, and on the **Touareg** the transfer-case
    capacities were parked under a footnote instead of the transmission.
  - Fixes the same split on **Eos, Jetta, Passat, CC, Beetle, Routan, Atlas and Touareg** across
    2006–2022 — the Alltrack was just where it showed up first.
- **AWD and FWD versions of the same gearbox are no longer both shown** when we know which one the car
  has. If the Model Name says 4MOTION / 4MO / AWD, you get that one. If it says nothing, **both are
  shown and labelled** rather than guessing — the name doesn't always carry the marker, and guessing FWD
  would give you the wrong capacity.
- **A Golf R, Touareg or Alltrack now counts as AWD on its name alone** — none of the three was ever
  built in front-wheel drive, so there's nothing to guess even when the Model Name carries no 4MOTION
  marker. They now get the AWD gearbox straight away, and the **wheel-bolt torque** on the Service Xpress
  card resolves to the AWD figure instead of showing you both. (An *R-Line* is a trim, not an R — it's
  still read as whatever the name actually says.)
- **Rear Final Drive no longer shows another model’s section** (issue #126). An Alltrack was listing the
  **Golf R** final drive alongside its own; the tables keep a separate section per variant. Each car now
  sees only its own.

Saved fluid PDFs re-read themselves after this update — nothing to re-upload. Ships as a normal app
update, so **no re-drag needed**.

---

## v0.4.8.1-alpha — 2026-07-16

### Fixed
- **“Torque Wrench, 40-200Nm” no longer shows up as a torque spec** (issue #124). When a page’s **Tool
  list** panel lists the wrench on its own line, Hahns was reading the wrench’s *size* (40-200Nm) as if
  it were a tightening spec. It now recognises a wrench listing even when the tool number sits on a
  separate line, and ignores it. A real spec written next to a wrench (like the 100 Nm fixed in v0.4.8)
  still shows, and a genuine range spec — “tighten to 100-120 Nm with a torque wrench” — is untouched.
  This one was **not new in v0.4.8** — v0.4.7 did the same; it only became visible on a page whose Tool
  list panel was captured.
- **A special tool no longer picks up the previous tool's name** (issue #125). When ELSA lists several
  tools on one line — *"Torque Wrench, 40-200Nm - V.A.G 1332A - and Counterholder - T10663 -"* — the
  second tool was grabbing everything before it, so **T10663** read as *"Torque Wrench, 40-200Nm -
  V.A.G 1332A - and Counterholder"*. Each tool now takes only the name written next to it: **T10663 —
  Counterholder**, **V.A.G 1332A — Torque Wrench, 40-200Nm**.

This ships as a normal app update, so **no re-drag needed**.

---

## v0.4.8-alpha — 2026-07-15

### Fixed
- **Fluids and torque now work for cars whose name doesn’t say the family** — like the **2017 Golf
  Alltrack**, which ELSA calls “GSW ALLTRACK”. The tables list it under **Golf Family**, so looking it
  up by name found nothing and you got “no Alltrack” / “no listing”. Hahns now also reads the
  **Sales Code** off the Vehicle Summary (e.g. `BX5DQ7`) and uses it as a backup to find the right
  table when the name doesn’t match. The 2017 Alltrack now correctly shows the Golf Family fluids and
  **30 N·m drain plug / 120 N·m wheel bolt**. (Issues #118, #119)
- **Torque now looks across chart years when it has to.** The year printed on a Service Xpress torque
  table isn’t always the year on the cover — the 2017 chart labels its Golf table *2018*. If nothing
  matches for your model year, Hahns now finds the same platform on another year’s chart instead of
  showing nothing.
- **4MOTION is recognised when ELSA shortens it to “4MO”**, so all-wheel-drive cars are identified
  properly for the wheel-bolt torque.
- **Torque specs written on the same line as a torque wrench are no longer missed.** When ELSA writes
  a component like *“Torque Wrench, 40-200Nm - V.A.G 1332A - and Counterholder - T10663 - 100 Nm”*,
  Hahns was throwing the whole line away and the **100 Nm never showed up**. It now tells the wrench’s
  *range* (40-200Nm — that’s the tool’s size, not your spec) apart from the fastener’s *actual* spec,
  and the row now reads a clean **100 Nm**. The wrench and counterholder are still listed under
  Special Tools as before.
- **Dragging the install button by the Hahns icon no longer makes a blank bookmark.** Grabbing the
  button by the picture used to drag the picture instead of the link. Any part of the button works
  now. (Issue #120)

- **Lines you add by hand can now be edited.** Previously, once you typed a line and hit Enter it was
  stuck — a typo meant deleting it and starting over. Click any line you added (they have a dotted
  underline) to fix it in place; **Enter** saves, **Esc** cancels. Lines scanned from ELSA stay as the
  manual wrote them.

### Added
- **Sales Code is shown in the green vehicle bar**, alongside VIN and engine code — and you can click
  to correct it by hand like the other fields.

This ships as a normal app update, so **no re-drag needed**.

---

## v0.4.7-alpha — 2026-07-11

### Added
- **Copy your setup to another shop computer.** ⚙ Settings has a new **“Copy setup to another computer”**
  section. **Save setup to a file** bundles your tool list, fluid capacity tables (and their PDFs), and
  Service Xpress torque charts into a single file. **Load setup from a file** loads all of it onto another
  shop computer — so you don’t have to upload every PDF again on each machine. The file stays on your own
  computers; nothing is uploaded anywhere.

This ships as a normal app update, so **no re-drag needed**.

---

## v0.4.6.4-alpha — 2026-07-11

### Fixed
- **The feedback window no longer shows a tiny scrollbar** when opened from the ⚙ Settings button (or
  reopened). It now re-checks its size after opening and always fits the whole form.

This ships as a normal app update, so **no re-drag needed**.

---

## v0.4.6.3-alpha — 2026-07-11

### Changed
- **The feedback window now opens tall enough to show the whole form** — no more scrolling to reach
  the email field and Send button. It sizes itself to fit its contents.

This ships as a normal app update, so **no re-drag needed**.

---

## v0.4.6.2-alpha — 2026-07-11

### Fixed
- **The feedback form now checks that your email is actually an email.** Before, it would accept any
  text; now it must look like a real address (or you can just leave it blank).

This ships as a normal app update, so **no re-drag needed**.

---

## v0.4.6.1-alpha — 2026-07-11

### Changed
- **The feedback form now also asks for your email** (in addition to your name) — so the developer can
  actually reach back out if there's a question about your report. Both are optional.

### Fixed
- **2025 Jetta A/C: the refrigerant compressor oil now shows up.** It was missing (should list
  **Denso — 80 ± 10 cc** and **Sanden — 75 ± 10 cc**). The source PDF had a small typo — it wrote the
  unit as "cm" instead of "cc" — so the app couldn't read the number and dropped the whole line. Now
  handled. Same fix also restores the compressor oil on the **2023 and 2026 Jetta**. (Saved fluid
  tables re-read themselves on the next update — no re-upload needed.)

This ships as a normal app update, so **no re-drag needed**.

---

## v0.4.6-alpha — 2026-07-11

### Added
- **Report a bug or send feedback right from the app.** There's now a small **Feedback** link on the
  version bar (and a **Report a bug / send feedback** button in ⚙ Settings). It opens a quick form —
  pick Bug or Feature request, type what happened, optionally leave your name — and your report goes
  straight to the developer as a labeled GitHub issue. Your app version and browser are attached
  automatically to help with debugging. **Nothing about the repair job is included — only what you type.**

This ships as a normal app update, so **no re-drag needed** — you'll get the Feedback button on your next update.

---

## v0.4.5-alpha — 2026-07-11

### Added
- **"What's new" right in the update window.** When an update is offered, the popup now lists the changes
  in the version you're about to get — so you know what you're updating to before you click. It shows only
  that one version's changes, not the whole history.

### Changed
- **The update window now opens in the center of the screen** instead of wherever the browser happened to
  put it.

Both are in the update window itself, so **no re-drag needed** — you'll see them on your next update.

---

## v0.4.4-alpha — 2026-07-11

### Fixed
- **Re-dragging the bookmark no longer leaves a second update waiting.** In v0.4.3, updating the bookmark
  and reopening Hahns would immediately show *another* "newer version available" prompt — because
  re-dragging only swaps the bookmark, while the app itself updates separately. Now, when you click
  **"Update the bookmark,"** Hahns quietly grabs the latest app at the same moment, so the freshly-dragged
  bookmark opens already up to date — one step, no surprise second prompt. **No re-drag needed for this
  fix** (it lives in the update window, which always loads fresh).

---

## v0.4.3-alpha — 2026-07-11

### Added
- **The update popup now tells you when you need a fresh bookmark.** When a new version needs the
  bookmark itself re-dragged (not just the app updated), the little update window now **says so** and
  shows an **"Update the bookmark"** button that takes you straight to the setup page to drag the new one —
  instead of quietly doing nothing. Most updates still install on their own with no re-drag; this only
  appears the rare times the bookmark itself changed.

### Changed
- Because of the above, this release **does** need a one-time re-drag (it's the version that teaches the
  bookmark how to notice future bookmark updates). Delete the H.A.H.N.S bookmark and drag the newest one
  from the setup page once.

---

## v0.4.2-alpha — 2026-07-11

### Fixed
- **The 2025 Service Xpress chart now loads.** It was being rejected with "not a Service Xpress PDF."
  That one year's file was saved in a slightly newer PDF format than every other year, and Hahns's
  built-in PDF reader couldn't unpack it — so the torque tables came out as scrambled text and the file
  looked empty. The reader now handles that format. All other years are unchanged. Load the 2025 chart
  again in ⚙ Settings and it works.
- **The "Check for Update" button no longer opens the old website.** On the newest bookmark it does an
  instant in-app check (no website). If your bookmark is an older one that can't check on its own yet, the
  button now clearly says **"Update the bookmark…"** and opens the setup page so you can drag the newest
  one — that's the *only* time the setup page is used now, and only for (re)installing the bookmark itself.

### Changed
- **Automatic update check now runs on the first time you open Hahns each day** (instead of a rolling
  24-hour timer). So getting to work and clicking Hahns will check for a new version if you haven't been
  on since the day before — more predictable than before. You can still force a check any time with the
  **Check for Update** button in ⚙ Settings.

> **One-time re-drag:** to get the fixed manual button and the new daily-check timing, delete the
> H.A.H.N.S bookmark and drag the newest one from the setup page once. After that, app updates keep
> installing on their own — no more re-dragging.

---

## v0.4.1-alpha — 2026-07-10

### Added
- **Torque specs — oil drain plug & wheel bolt (Service Xpress).** Load the yearly **VW Service
  Xpress** charts (PDF) in ⚙ Settings, and the **Fluids & Capacities** window now shows the **oil drain
  plug** and **wheel bolt** torque for the loaded vehicle — in its own **Torque** card at the top, right
  next to the Vehicle box — no digging through the chart. It's smart
  about the tricky cases: **wheel torque that differs by drivetrain** (e.g. Tiguan FWD 120 / AWD 140 N·m)
  shows the right one for your vehicle; **one-piece vs two-piece wheel bolts** (some Atlas) and **M14 vs M24
  drain plugs** (older years) show both, labeled, since the car can't tell us which; EVs correctly show no
  drain plug. Covers **2008–2026** (2007 and earlier never had these charts). Everything else in the chart
  (oil spec, capacities, etc.) is ignored — that comes from the Fluid Capacity tables. Charts are read and
  kept **only on this computer**, never uploaded, and re-read automatically when the reader is improved —
  same as the fluid tables.
- **A "Check for Update" button in Settings (⚙).** Open Settings and click it to check right away — the
  same little update window that normally runs about once a day opens on the spot. If there's a newer
  version it asks before installing; if you're already current, it tells you so.

### Changed
- **Settings is tidier.** Each part (shop tool list, fluid tables, fluid database) is now a collapsible
  section — click a heading to expand it. Each heading shows its status at a glance (e.g. how many tools
  or years are loaded), so you don't have to open a section to check.
- **Uploading no longer closes Settings.** After you load a tool list or fluid PDFs, Settings stays open
  (and updates to show what you just loaded) so you can keep working — instead of closing and making you
  reopen it.

### Removed
- **The weekly "App may be out of date" reminder is gone.** Now that Hahns updates itself (the
  self-updating loader added in v0.4.0), the old once-a-week Wednesday nudge to go re-check the setup
  page is no longer needed.
- **The "check for latest" link in the panel header is gone too** — Hahns updates itself now, so there's
  nothing to check by hand. (If you ever want to check on demand, use the new **Check for Update** button
  in Settings.) The version stamp stays where it was, and clicking it still copies a diagnostic.

---

## v0.4.0-alpha — 2026-07-09

### Added
- **H.A.H.N.S now updates itself.** The bookmark you drag is a small "loader" that keeps a copy of Hahns on
  your computer and runs it instantly (even offline). About once a day it quietly checks this site for a newer
  version, and **if there's an update it asks you first** — a little window shows your installed version vs the
  latest, with **Update now** / **Not now**. Say yes and it updates on the spot; say no and it keeps your
  current version. The upshot: after this one-time switch, you normally **never re-drag the bookmark again** —
  new fluids, tools, and fixes just show up.
- Brand-new installs are silent (it just sets Hahns up); only *updates* ask you.

### Changed
- **The setup page now hands out the new self-updating bookmark.** Existing users: delete your old H.A.H.N.S
  bookmark and drag this new one on once — that's the switch. First click needs internet to set up; after that
  it works offline.
- Your repair data still never leaves your browser. The only new network use is the once-a-day update check,
  which pulls **Hahns's own code** in — nothing about your job goes out.

---

## v0.3.18.6-alpha — 2026-07-08

### Changed
- **Minimized SCAN moved left of the gear.** The compact green SCAN in the minimized title bar now sits to
  the left of the settings gear (was left of the minimize button).

---

## v0.3.18.5-alpha — 2026-07-08

### Changed
- **Smaller minimized bar.** When you minimize Hahns, SCAN now sits up in the title bar as compact green
  text (just left of the minimize button) instead of a full green button below it — so the collapsed panel
  takes up as little room as possible. Expanded, the big green SCAN button is unchanged.

---

## v0.3.18.4-alpha — 2026-07-08

### Fixed
- **A/C now hides specs for the wrong engine.** On years where the A/C charge depends on the engine (e.g. a
  2000–2005 Passat has one spec for the 4.0L W8 and another for everything else), Hahns was showing both.
  It now shows only the row that matches your vehicle's engine size — a 2.8L V6 sees the "except with 4.0 L"
  spec (600 g), a 4.0L W8 sees the "with 4.0 L" spec (500 g). A/C rows that aren't engine-specific (like the
  Eurovan's 1- vs 2-evaporator options) still show all choices.

---

## v0.3.18.3-alpha — 2026-07-08

### Fixed
- **2000–2005 A/C rows no longer cut off.** On these older tables the A/C notes (e.g. the 4.0L-engine
  exception on the Passat) wrap across several lines, so a row that should read "Refrigerant, except with
  4.0 L" was showing only "except." Hahns now stitches the wrapped text back together — the Passat shows
  "except with 4.0 L" / "with 4.0 L" for both refrigerant and compressor oil, and the Eurovan reads
  "1 Evaporator" / "2 Evaporators" instead of a broken fragment.

---

## v0.3.18.2-alpha — 2026-07-08

### Fixed
- **Older vehicles (2000–2010) now pick the right engine instead of showing every option.** The vehicle
  reader was only keeping the engine **code** (e.g. "ATQ") and dropping the engine **size** ("2771 ccm")
  next to it — and the older fluid tables are matched by size. Hahns now keeps the size, so it lands on the
  correct engine oil and coolant automatically (e.g. a 2003 Passat V6 → 6.2 L oil / 9.0 L coolant, a 2006
  GTI 2.0T → 4.6 L). The engine size now also shows in the green vehicle bar.

---

## v0.3.18.1-alpha — 2026-07-07

### Fixed
- **2000–2005 vehicles now actually update, and the "Updating…" status clears.** After the v0.3.18 update,
  the older fluid tables saved on your computer weren't re-reading themselves with the new parser (so a 2003
  still showed nothing), and the Fluid database status could stay stuck on "Updating." Both are fixed — every
  saved year now correctly refreshes itself once with the right parser on this update. (If a year was loaded
  on a very old version that didn't keep the PDF, it'll ask you to re-load that one PDF.)

---

## v0.3.18-alpha — 2026-07-07

### Added
- **Fluids & Capacities now works on 2000–2010 vehicles (issue #43).**
  - **2006–2010:** those tables list engines by their size (like "2.0L") instead of the letter engine code
    newer years use, so Hahns couldn't pin down the right row before. It now reads your vehicle's engine size
    and picks the matching engine oil and coolant automatically. It also tells apart a gas and a diesel of the
    **same** size (e.g. 2.0L TSI vs 2.0L TDI get different oil and capacity) and handles the V10 TDI ("5.0L").
  - **2000–2005:** these use a completely different older page layout (one combined table per model). Hahns now
    reads it too — engine oil, coolant, and transmission/final-drive capacities, matched to your vehicle by
    engine size, engine code (e.g. the two different 2.0L Beetles, AZG vs BDC), and fuel type. Air-conditioning
    charges are shown best-effort for these years.
  - Load each year's PDF in ⚙ Settings the same as always. Verified against the real 2000–2010 tables.

### Changed
- **The three fluid readers are now named by the years they cover: Parser 00-05, Parser 06-10, Parser 11-26.**
  This is an under-the-hood cleanup that makes each one easy to maintain and improve on its own. The Settings
  "Fluid database" panel shows all three. (Parser 00-05 covers 2000–2005 and isn't built yet.)

### Fixed
- **A rare capacity could go missing on 2006–2010 tables.** When an engine's oil capacity was printed without
  the "(quarts)" conversion next to it (e.g. the 2006 Touareg 4.2L/5.0L), that number was being dropped. It's
  now read correctly.

---

## v0.3.17.1-alpha — 2026-07-05

### Fixed
- **The magnifier no longer triggers ELSA's Print button (bad v0.3.17 bug).** Clicking the magnifying
  glass could fire ELSA's print command multiple times. The magnifier now has a hard rule that it will
  **never** click print/save/close/etc. controls, and it clicks a section's opener only once.
- **When it opens a tool dropdown, it now waits a moment and jumps to the tool** (ELSA opens these
  sections a split-second after the click). If a section still can't be opened, it lands on the
  dropdown's header so you can open it with one click — and records a more detailed diagnostic.

---

## v0.3.17-alpha — 2026-07-05

### Changed
- **The magnifier now tries much harder to open a collapsed "special tools" dropdown before jumping to
  it (issue #47).** It walks up from the tool to whatever is hiding it, handles more kinds of collapsed
  sections (not just standard ones), and clicks the section's header/expander the same way a person
  would. **If it still can't open the section, it now highlights the dropdown's header text** so you're
  taken to the right spot and can open it with one click.

### Added
- **Magnifier diagnostics.** If a section won't open, Hahns prints a plain report to the browser console
  (and into the diagnostic dump) — what it was looking for, which element hid it, what it tried, and
  where it landed — so a stubborn ELSA layout can be pinned down exactly.

---

## v0.3.16.2-alpha — 2026-07-05

### Fixed
- **Tool numbers written in spaced groups (e.g. `VAS 294 025`) are now read in full.** The scan used to
  stop at the first space and grab only `VAS 294`. It now keeps the whole number (up to three
  space-separated groups), without grabbing an unrelated trailing number. (Issue #78)

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
