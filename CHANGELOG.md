# Changelog

What changed in each version of H.A.H.N.S, newest on top. Written in plain
terms for techs. The version here matches the stamp shown in the panel and on
the setup page (e.g. `v0.1.1-alpha`).

Categories: **Added** (new), **Changed** (different behavior), **Fixed** (bugs),
**Removed** (taken out).

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
