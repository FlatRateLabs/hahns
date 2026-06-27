# Session Summary

Running log of development sessions. Newest entry on top. See `CLAUDE.md` for the
permanent project reference.

---

## 2026-06-26 — v0.3.2 → v0.3.3-alpha: vehicle init + real-page gating fix

**Current version:** `v0.3.3-alpha` (built). Branch `v0.3.2`, PR
[#19](https://github.com/FlatRateLabs/hahns/pull/19). All in `src/helper.js` +
version bump in `tools/build.js`.

### v0.3.3 fix — load ONLY from the real Vehicle Summary (owner-tested)
- **Owner tested on real ELSA (ATLAS VIN `1V2MR2CAXKC537000`):** the summary scan
  was **perfect** — all 5 fields correct (`Model Name=ATLAS 3.6 SEL AWD`,
  `Engine Code=CDVC`, `Trans Type=09PA - AQ450-8A`, `Model Year=2019`).
- **Bug found:** scanning a **repair-manual** page with no vehicle loaded still
  grabbed a vehicle — ELSA shows the selected VIN in its header on EVERY page
  (`Select VIN:…`), so the old "VIN present = summary page" signal mis-fired, then
  loose matchers filled Model Name with "code" and Trans Type with "in the
  illustration may differ from the".
- **Fix:** added **`isVehicleSummaryPage(segments)`** — requires the summary's own
  structure (the "Vehicle Data" section header and/or ≥2 of the anchored labels
  Model Name / Model Year / Engine Code / Trans Type on their own lines). `scan()`
  now loads only when that's true; otherwise it's blocked with "this isn't the
  Vehicle Summary page." Rewrote extraction to **anchored, exact-label** matching
  (`VEH_LABELS` + `vehField`, label-cell → next-line value), keyed to ELSA's real
  layout. Diagnostic dump now prints `looks like Vehicle Summary: yes/no`.
- **Verified** with the actual readout segments: real summary → `isSummary:true` +
  all 5 correct; a simulated repair page (header VIN + junk) → `isSummary:false`
  (loads nothing). Browser: helper loads clean, `v0.3.3-alpha` stamp, no errors.

### v0.3.2 base (vehicle init)

New up-front step: the tech scans ELSA's **Vehicle Summary** page before anything
else, and H.A.H.N.S captures the vehicle's identity. This is **groundwork for a
later feature** (owner's note), plus a clear "good grab" confirmation.

### Decisions (asked the owner)
- **Gating:** *Block + prompt* — clicking Scan on a procedure before a vehicle is
  loaded collects nothing and shows "scan the Vehicle Summary first."
- **Partial grab:** *Accept + flag blanks* — a found VIN loads the vehicle; any of
  the other four blank fields are flagged amber and click-to-edit.
- **Scan UX:** *Auto-detect on the same Scan button* — a found VIN means "this was
  the summary page"; no VIN means it's a procedure page (blocked until loaded).

### Shipped
- **`extractVehicle(segments)`** → `{vin, year, model, engine, trans}`. VIN via
  `VIN_RE` (17 chars, excl. I/O/Q) + `looksVin`; the other four via `vehVal()`, a
  label→value scan (same line or next line). **Heuristic** — keyed off field
  labels; will need tuning against a real Vehicle Summary page (see below).
- **Vehicle rides inside `vwjb_job_v1` as `r.__vehicle`** (no new storage key) — so
  Exit and New job clear it automatically and it survives page navigation.
  `emptyResults`/`saveJob`/`loadJob`/`mergeInto` updated to carry it.
- **Vehicle bar** (`vehicleBar(r)`): green "Vehicle loaded" strip with a check + the
  5 fields, pinned under the header; blanks show "+ add" + a "Missing: …" note;
  each value is click-to-edit (`.vval`, mirrors the part-label editor). Hidden in
  `embed` (setup-page demo) mode. Added to `plainText`, print (`.veh` block), and
  the diagnostic dump (which now prints the **per-field grab** — the tuning hook).
- **Gating** in `run().scan()`: until `vehLoaded(job)`, a scan only tries the
  vehicle; a found VIN loads it, otherwise `vehNotice` prompts and nothing is
  collected. After that, scans collect procedure specs as before.
- Version bumped to `v0.3.2-alpha`; CHANGELOG entry added.

### Verified
- `node --check` clean. Eval harness: `extractVehicle` pulls all 5 from a synthetic
  summary (both same-line and label-on-own-line layouts); a no-VIN procedure page
  yields blanks (correctly "not a summary"); `mergeInto` preserves a loaded vehicle
  across a page scan; `plainText` prints the vehicle block (blank → "—").
- Browser preview (temp harness, since the demo is embed-mode): all three states
  render clean with no console errors — **loaded/complete** (green + 5 fields),
  **loaded/blanks** (amber "+ add" + Missing note), **no-vehicle** (prompt). Inline
  edit of a blank Engine Code saved + re-rendered.

### Next session
- **Extractor is now tuned to the real ATLAS summary** (anchored labels) — if a
  future vehicle/page reads wrong, grab a fresh diagnostic dump and adjust
  `VEH_LABELS`/`vehField`. Watch for non-English ELSA labels (matchers are English).
- **Re-test the gate on a repair page** on real ELSA to confirm the header VIN no
  longer loads a vehicle (verified in the harness; confirm in the bay).
- **Deploy:** push to update PR #19; confirm the live stamp reads `v0.3.3-alpha`;
  owner hard-refresh + re-drag.
- The "feature we'll add later" that consumes the vehicle data is still TBD.

---

## 2026-06-25 — v0.3.1-alpha: warning banners + special-tools rework

**Current version:** `v0.3.1-alpha`. Branch `v0.3.1` → merged to `main`.

Three bug-fix/improvement areas, all in `src/helper.js` (+ demo sample in
`src/template.html`). Verified by `node --check`, the eval harness, and the
browser preview (DOM + computed styles; no console errors).

### Warning banners (DANGER / WARNING / CAUTION / NOTE)
- **NOTE banner text was being missed** (it has no warning keyword). Added banner
  detection: `bannerLabel()` (a lone banner word colours the next line via a
  `pendingSev`), `inlineBanner()` ("WARNING: …" / uppercase-glued), `sevFromText()`
  (keyword fallback). NOTE matched ONLY as a real banner so "Note the gap" can't
  false-trigger. Each warning now carries a `sev`.
- **Colour-coded to ELSA:** `.sev-danger` red, `.sev-warning` orange,
  `.sev-caution` yellow, `.sev-note` light blue, plus a bold severity tag; manual
  adds keep a neutral red. Copy/Print prefix the severity word.

### Special tools
- **`/N` sub-part fix:** `T…`/`VAS…` patterns now allow a trailing `/N`
  (e.g. `T1000/1`) in both `test` and the shared `TOOL_RE` — were truncating.
- **Deduped + described:** the `tools` bucket is special-cased. `toolEntries()`
  parses each number + a description (`toolDescBefore` strips "Use/With/the…";
  `toolDescAfter` Title-Case fallback). Items `{num, desc, text}` **deduped by
  number job-wide** (a tool cited many times → one row; `mergeInto`/`toolKey`
  back-fill a missing desc). List shows `**num** — desc`, or just the number.
- **Removable chips:** chips now derive from the list via `toolNums(r)` (the
  `__tools` field was removed everywhere) and each has a ✕ (`data-chipdel`) that
  also removes the list row. Tools render **flat** (never grouped per-page) in
  panel/copy/print.

### Notes for next session
- Old in-progress jobs in `sessionStorage` (pre-0.3.1 tools shape) lose chips until
  re-scanned — transient, acceptable.
- Description parsing assumes ELSA's "Name - NUMBER -" layout + English filler
  words; tune `toolDescBefore`/`toolDescAfter` if real pages differ.

---

## 2026-06-25 — v0.3.0-alpha: drop network auto-update, add weekly reminder

**Current version:** `v0.3.0-alpha` (built, not yet pushed). **Live (pending push):**
https://flatratelabs.github.io/hahns/

Reversed the v0.2.x auto-update feature (proven impossible on ELSA) and replaced it
with a network-free weekly reminder. **The app is back to ZERO network calls.**

### Shipped (on `main` working tree — build done, push pending)
- **Removed the entire network update check.** Deleted `checkForUpdate`,
  `restoreUpdateState`, `isElsaPage`, the `version.json` fetch, the
  `securitypolicyviolation` listener, the "update available" banner, and the
  "check off ELSA" guidance note. Removed storage keys
  `vwjb_last_update_check_v1`, `vwjb_last_update_result_v1`,
  `vwjb_upd_blk_dismiss_v1`.
- **Added a Wednesday-only reminder (no network).** Pure local-date check:
  `reminderDue()` returns true **only on Wednesday** (`getDay() === 3`) and **only
  once** that day — it writes this Wednesday's marker (`wedMarker()`, `YYYY-MM-DD`)
  the instant it's due, so re-opening the panel later the same day won't show it
  again. Yellow banner at the top of the panel: *"App may be out of date. **Check
  for update?**"* — the link opens the setup page; **Dismiss** just clears the
  current view. One new localStorage key: `vwjb_upd_reminder_v1` (a date string
  only). Works identically on/off ELSA. Deliberately low-key: we can't know if the
  app is actually stale, so it's a soft nudge, not an alert (owner's call).
- **Removed the in-app "What's new" pop-up.** Deleted `showChangelog`, the
  `vwjb_seen_ver_v1` key, and the modal CSS. The changelog now lives only on the
  setup page. Stopped baking the changelog into the bookmarklet (`build.js` no
  longer emits `__CHANGELOG_HTML__`/`__VERSION__`; helper's only placeholder is
  `__BUILD__`). **Payload dropped ~97 KB → ~78 KB.**
- **Setup page:** moved the **drag-to-install button card to the top** (right under
  the tagline) so updating techs find it fast; made **"What's new" collapsed by
  default** (removed `open`).
- `version.json` is still published (static version record) but nothing fetches it.

### Verified
- `node --check` clean; eval harness confirms extraction + ADD-button numbering
  still work; browser preview confirms: setup page layout (drag card on top,
  collapsed changelog, `v0.3.0-alpha` stamp); zero `fetch(` in the bundle; no
  `clmodal` left. Reminder behavior tested by forcing the weekday: **non-Wednesday
  → no banner, no marker written**; **Wednesday → banner shows once**; **re-open
  same Wednesday → no banner**. No console errors.

### Next session
- **Push to deploy:** `git pull --rebase` → commit → push; confirm the live stamp
  reads `v0.3.0-alpha`. Tell the owner to hard-refresh + re-drag.

---

## 2026-06-25 — Auto-update saga: v0.2.0 → v0.2.4 (shipped, settled)

**Current version:** `v0.2.4-alpha` (live). **Live:** https://flatratelabs.github.io/hahns/

Goal: add an auto-update check (the owner's one sanctioned network exception).
Iterated through real-ELSA testing to a settled end-state.

- **v0.2.0** — once-per-session `fetch` of `version.json`; update banner. Real-ELSA
  test: failed with generic `Failed to fetch`.
- **v0.2.1** — reworked: once-per-day (localStorage throttle), richer banner
  (current/new version, Get Update/Dismiss), and a `securitypolicyviolation`
  listener so the diagnostic records whether CSP *actually* fired (owner pushed
  back on assuming CSP — good call). Real-ELSA test: **`csp:true` for
  `connect-src`** — ELSA's CSP block now browser-confirmed, not guessed.
- **v0.2.2** — tried a CSP-proof **marker-image** check via `img-src` (build
  published `uc/control.png` + `uc/cur/<ver>.png`). Real-ELSA test: **`imgCsp:true`**
  — ELSA blocks images from our domain too. Dead end, confirmed by the browser.
- **v0.2.3** — accepted that **no background check can run on ELSA**.
  Host-gate `isElsaPage()` (vwhub.com/vw-now.com/elsa/e2g): on ELSA make **zero
  network calls** + show a muted note; off ELSA do the once-a-day fetch + banner.
  Removed the marker images. Real-ELSA verified: result `"skipped":"on ELSA…"`.
- **v0.2.4 (final)** — reworded the ELSA note to point at the **"check for latest ↗"**
  link (which opens the setup page even from inside ELSA), after the owner noted a
  bookmarklet can't run on a blank/new-tab page. The note now says: *"Can't
  auto-check while ELSA is open. To check, click check for latest ↗ and compare…"*

**Loader bookmarklet — asked & DEFINITIVELY ruled out.** Owner asked about a tiny
auto-updating loader stub. Then pasted ELSA's **actual CSP header** (recorded in
CLAUDE.md): `script-src 'self' 'unsafe-inline'` (no external scripts → loader
can't load our code; inline allowed → why the self-contained bookmarklet works),
`connect-src 'self' blob:`, `img-src 'self' blob: data:`. So **external code on
ELSA is impossible**; the self-contained bookmarklet + re-drag-to-update is
mandatory and final. Don't revisit loaders/remote-code for ELSA.

**Other facts (in CLAUDE.md):** ELSA served from `www.vwhub.com`; GitHub Pages
CORS is `*` (never the blocker); repo must stay **public** for the Pages link
(free plan).

**Storage added:** `vwjb_last_update_check_v1`, `vwjb_last_update_result_v1`
(localStorage), `vwjb_upd_blk_dismiss_v1` (sessionStorage). Diagnostic dump now
includes the update-check attempt + result.

**Open/next:**
- Bookmarklet payload ~97 KB (baked-in changelog growing) — consider trimming the
  *app's* embedded changelog to recent versions while keeping full on the page.
- Optional: add `accessaudi.com` to `isElsaPage()` (Audi shares ELSA infra; it's
  in ELSA's CSP) if Hahns is ever used on Audi ELSA.
- Auto-update feature is **done/settled** — no further ELSA network work possible.

---

## 2026-06-24 — v0.1.1-alpha bug-fix/polish cycle (shipped)

**Current version:** `v0.1.1-alpha` (live). **Live:** https://flatratelabs.github.io/hahns/

### Context
- Owner briefly made the repo **private**, which took GitHub Pages offline (404).
  Switched back to public; Pages had to be **re-enabled** via `gh api -X POST
  repos/FlatRateLabs/hahns/pages -f source[branch]=main -f source[path]=/docs`.
  Rule: on a free plan the repo must stay **public** for the Pages link to work.
- Discussed commercialization: a bookmarklet can't hide its own source (it lives
  in the bookmark), so a private repo protects history/discoverability, not the
  code itself. Flagged the **ELSA content licensing** question before monetizing.

### Shipped (branch `v0.1.1` → fast-forward merged to `main`)
- **Exit confirmation** on the panel ✕ ("Are you sure you want to exit? All
  collected job info will be lost." — Exit/Cancel modal in the Shadow DOM).
- **Exit now clears all stored state** (`vwjb_job_v1`/`vwjb_pos_v1`/`vwjb_min_v1`);
  previously closing only hid the panel and the job came back on re-open.
- **CHANGELOG.md** added as the single source of truth (plain-language, newest on
  top). `tools/build.js` now renders it to HTML (`renderChangelog`) and bakes it
  into the page (`__CHANGELOG__`) and bookmarklet (`__CHANGELOG_HTML__`,
  `__VERSION__`) — no network, posture preserved.
- **"What's new"**: shown on the setup page under the Current-version box
  (expanded `<details>`), and **auto-pops once after an update** in the panel,
  tracked by one `localStorage` key `vwjb_seen_ver_v1` (version string only).
- Removed an in-panel "What's new" link (decluttered the version bar).
- **README**: added a Changelog section linking to CHANGELOG.md.
- Payload now ~80 KB (changelog baked in) — still fine; trim app changelog to
  recent versions if it ever balloons.

### Notes for next session
- New work should start on a fresh branch (e.g. `v0.1.2`) off `main`.
- The `v0.1.1` branch is merged; safe to leave or delete.

---

## 2026-06-21 — Initial build through public deployment

**Current version:** `v0.1.0-alpha` (live build stamp `v0.1.0-alpha · 2026-06-21 …`)
**Live:** https://flatratelabs.github.io/hahns/ · **Repo:** github.com/FlatRateLabs/hahns

### What was accomplished (idea → shipped product)
- Built **H.A.H.N.S** from scratch as a dependency-free, no-install **bookmarklet** that
  reads ELSA repair pages and extracts torque specs, replace-after-removal parts,
  fluids/capacities, special tools, and critical warnings into a Shadow-DOM panel.
- **Cracked the real ELSA structure via a live diagnostic dump:** the visible 1./2./3.
  callout numbers are CSS list markers (absent from page text); each component name
  follows a "+ ADD" button. Component numbering now counts ADD buttons → labels like
  `2. Torx Bolt`. Bold is not required (whole legend is bold).
- Tuned extraction patterns against real wording (e.g. many "replace after removal"
  phrasings; VAS / V.A.G tool numbers; dedup by part+text so identical wording under
  different components is kept).
- Added: editable per-part labels, manual "+ add", per-item trash, **job title**,
  **multi-page accumulation grouped by source page** (editable page headers),
  **diagram capture** (numbered-overview pages only, dominant image, by URL reference,
  deletable, click-to-enlarge), **Print** to a clean job sheet/PDF, Copy list,
  **draggable** panel (pointer-capture), **Minimize**, **New job** with Yes/No confirm,
  scroll-position preservation, blank-on-open (deliberate "Scan page" click).
- Persistence via `sessionStorage` (job, panel position, minimized) — survives page
  navigation, auto-clears on tab close. Kept the "retain nothing / no network" posture.
- **Renamed** Job Buddy → **H.A.H.N.S** everywhere; file renamed to `HAHNS.html`.
- **Published:** created repo, pushed, enabled **GitHub Pages from `/docs`**; later the
  owner moved it to the **FlatRateLabs org** and the remote/links were re-pointed.
- **Versioning:** single `VERSION` constant in `tools/build.js`; user-facing stamp
  `v<VERSION> · <date>`. Added a prominent "Current version" box + hard-refresh-on-update
  note on the setup page, and a "check for latest ↗" link in the panel.
- Removed the "no IT approval" wording and the in-panel "nothing saved/sent" line per
  owner request.
- Wrote **CLAUDE.md** (permanent project reference) and this file.

### Verified
- Works on **Safari, Chrome, Edge**; **Firefox does not** (CSP enforces on bookmarklets).
- Multi-page grouping, numbering, diagram capture, print, and the full
  build→deploy→re-drag loop all confirmed.

### Open items / next steps
- **Hahns mascot artwork** (polish phase; currently a wrench placeholder).
- Optional no-network **"build is stale" nudge**; optional **Firefox/browser note**.
- **Google Authenticator / TOTP auto-fill — shelved.** Blocked on: owner obtaining the
  secret seed (may be admin-locked under Group Retail Portal) + confirming GRP policy
  allows colocating the 2FA factor. The "sign in with Google" approach is not possible.
- Consider pilot-testing on more shop machines before wider rollout (managed-browser
  policies vary; some disable `javascript:` bookmarklets).

### Notes for next session
- Most work is in `src/helper.js`; page copy in `src/template.html`; build/deploy in `tools/`.
- After editing `helper.js`: `node --check src/helper.js` → `node tools/build.js`.
- Deploy: rebuild → `git pull --rebase origin main` → commit → push (owner edits README on GitHub).
