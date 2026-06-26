# Session Summary

Running log of development sessions. Newest entry on top. See `CLAUDE.md` for the
permanent project reference.

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
