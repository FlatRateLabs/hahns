# Project Overview

- **Project name:** H.A.H.N.S — **H**ardware, **A**dvisories, **H**ighlights, & **N**avigation **S**pecialist (mascot "Hahns", art not yet created). Formerly code-named "VW Job Buddy".
- **Purpose:** A no-install browser helper that reads the VW repair procedure a technician already has open in ELSA (via vw-now.com → ELSA 2 Go / ELSA Pro) and pulls the job-relevant data into one tidy, printable panel: torque specs, replace-after-removal (one-time-use) parts, fluids & capacities, special tools, critical warnings, and the numbered overview diagram.
- **Target users:** VW dealership technicians at the bay, using locked-down shop computers. Primary stakeholder/owner: a VW tech (GitHub `senditbro`), not a developer — explain changes in plain terms.
- **Core value proposition:** One click collects everything a tech needs for a job (across multiple manual pages), labels each spec with the component callout number so it maps to the diagram, and prints a clean job sheet — **while keeping nothing** (no files saved, no manual content sent anywhere). Ships as a bookmark, so nothing installs on restricted machines.

# Architecture

- **Frontend:** A single self-contained vanilla-JS bookmarklet. No framework, no build-time transpile, **no runtime dependencies**. The UI panel is rendered into a **Shadow DOM** root injected into the host (ELSA) page so ELSA's CSS can't touch it and vice-versa. Written in conservative, broadly-compatible JS (mostly `var`/`function`, try/catch around anything risky).
- **Backend:** None. There is no server-side component. All extraction/rendering happens locally in the browser.
- **Database:** None. Transient state lives in **`sessionStorage`** (per-tab, auto-clears on tab/browser close):
  - `vwjb_job_v1` — the running job (collected specs, tools, diagram URLs, title, **and `__vehicle`** — the loaded vehicle `{vin, year, model, engine, trans}`, v0.3.2+). No separate vehicle key: it rides inside the job so it shares the job's lifecycle (cleared on Exit / New job, survives page-to-page navigation).
  - `vwjb_pos_v1` — remembered panel position.
  - `vwjb_min_v1` — minimized (collapsed) state.
  - `vwjb_vehexp_v1` (v0.3.7+) — green vehicle-bar expand/collapse state (`"1"` expanded, `"0"` collapsed, **absent** = never set → render expanded then auto-collapse after 3 s once per load). Pure UI flag, never job/ELSA content.
  - **Exit** (the panel ✕, with a confirm dialog) clears all four of the above.
  - **One** `localStorage` key, `vwjb_upd_reminder_v1` (v0.3.0+) — the Wednesday-marker (a `YYYY-MM-DD` date string) of the last Wednesday the **weekly update-check reminder** was shown. Written the moment the banner becomes due so it shows **only once per Wednesday**. Stores **only a date string**, never job/ELSA content, so it doesn't weaken the privacy posture; persists across tabs by design. Surfaced in the diagnostic dump.
  - **History:** the v0.2.x auto-update keys (`vwjb_last_update_check_v1`, `vwjb_last_update_result_v1`, `vwjb_upd_blk_dismiss_v1`) and the v0.1.1 changelog key (`vwjb_seen_ver_v1`) were **removed in v0.3.0** when the network update check and the in-app changelog pop-up were dropped.
- **Hosting / deployment:** Static. Source repo **github.com/FlatRateLabs/hahns** (public). Hosted on **GitHub Pages** from the **`/docs`** folder of `main`. Live setup page (share this with techs): **https://flatratelabs.github.io/hahns/**. Pages auto-redeploys ~1 min after push.
- **Authentication:** None in the tool. It only reads pages the tech has already logged into. (A Google-Authenticator/TOTP auto-fill feature was explored and **shelved** — see Design Decisions / Known Constraints.)
- **Third-party services / APIs:** **None at runtime — ZERO network calls** (restored in v0.3.0). The v0.2.x auto-update `fetch` of `version.json` was **removed** — ELSA's CSP blocks every request to our domain (confirmed for both `connect-src` and `img-src`), so it never worked there anyway. In its place is a **weekly, network-free update reminder**: a pure local-date check (anchored to Wednesday) that shows a yellow "App may be out of date — Check for update?" banner linking to the setup page. It works identically on and off ELSA because it touches no network. **Keep it this way — do not re-add any runtime network call**; the setup page + version stamp + "check for latest ↗" link are the update path. GitHub Pages is used only for hosting (`version.json` is still published as a static version record, but nothing fetches it). `gh` CLI (installed via Homebrew, authed as `senditbro`) is used for repo/Pages management from the dev machine.

# Folder Structure

- **`src/helper.js`** — THE BRAIN. All logic: DOM walking, spec extraction, component numbering, panel rendering, sessionStorage, drag, print, diagnostics. Exposes `window.VWJB`. Edit here.
- **`src/template.html`** — the setup/demo page template. Contains placeholders the build replaces: `__BOOKMARKLET__` (the `javascript:` URL), `__HELPER__` (raw helper.js for the live demo box), `__BUILD__` (the version stamp), `__CHANGELOG__` (rendered changelog HTML for the "What's new" `<details>`, **collapsed by default** as of v0.3.0). The **drag-to-install button card sits at the top of the page** (v0.3.0, so updating techs find it fast), above the "Current version" box; also a working paste-box demo and the hard-refresh note.
- **`src/fluids.html`** (v0.3.4) — the **Fluids & Capacities lookup page**. A standalone page (NOT the bookmarklet) opened in a new window from the panel's fluids link. Because it's on **our** origin (not ELSA), it's free of ELSA's CSP and CAN load the data files. Reads the vehicle from URL params (`y/m/e/t` — year/model/engine/trans, **no VIN**), fetches+deobfuscates `fluids/<year>.json`, matches the vehicle (engine code → oil/coolant; trans-code prefix + AWD/FWD → drivetrain; model → A/C), and renders all four systems pre-resolved. Built to `dist/fluids.html` + `docs/fluids.html` (`__BUILD__` stamp). **This new-window-off-ELSA trick is the whole reason fluid data can be served without violating the zero-network-on-ELSA rule.**
- **`tools/parse-fluids.js`** (v0.3.4) — **PROGRAMMER-ONLY** local command that turns a year's "VW Fluid Capacity Tables" PDF into data. Shells out to poppler's `pdftotext -layout` (dependency-free — `brew install poppler`), parses model sections → the 4 system tables (skips BRAKE), and writes the **obfuscated** `docs/fluids/<year>.json` PLUS a **plaintext review sheet** `tools/fluids-review/<year>.txt`. **Always eyeball the review sheet against the PDF before committing** — wrong capacities are a real-world problem. Run: `node tools/parse-fluids.js "<pdf>" [--year YYYY]`.
- **`tools/fluids-codec.js`** (v0.3.4) — shared **light-obfuscation** codec (XOR with a key + base64). The key ships in `src/fluids.html` too, so this is obfuscation, NOT security (a determined person could recover the data — the owner's accepted trade-off to keep VW data out of plain sight / search indexes). Node side encodes; the page reimplements decode with `atob`+`TextDecoder` and the same `KEY`.
- **`docs/fluids/<year>.json`** — the obfuscated, committed fluid data Pages serves. **`tools/fluids-review/<year>.txt`** and **`*.pdf`** are **gitignored** (plaintext data / licensed source must not hit the public repo).
- **`tools/build.js`** — the build. Reads `src/`, stamps the version, generates: `dist/HAHNS.html`, `dist/bookmarklet.txt`, `dist/version.json`, `dist/fluids.html`, `docs/index.html`, `docs/bookmarklet.txt`, `docs/version.json`, `docs/fluids.html`, `docs/.nojekyll`, and mirrors `docs/fluids/*.json` → `dist/fluids/` for local preview. **Holds the `VERSION` constant.** Also **renders `CHANGELOG.md` to HTML** (`renderChangelog`, a tiny markdown subset) and injects it into the setup page only (`__CHANGELOG__`). As of v0.3.0 the changelog is **no longer baked into the bookmarklet** (the in-app "What's new" pop-up was removed), which shrank the payload. The only helper placeholder is now `__BUILD__`. **`version.json`** (`{version, build}`) is published as a static version record — nothing fetches it (no network calls).
- **`tools/serve.js`** — tiny no-cache static dev server (port 8755) for local preview. Default route serves `dist/HAHNS.html`.
- **`dist/`** — build output for local use (`HAHNS.html`, `bookmarklet.txt`, `version.json`).
- **`docs/`** — build output served by GitHub Pages (`index.html`, `bookmarklet.txt`, `version.json`, `.nojekyll`).
- **`README.md`** — user-facing readme (NOTE: the owner sometimes edits this directly on GitHub web UI — always `git pull --rebase` before pushing).
- **`CHANGELOG.md`** — plain-language, user-facing record of what changed per version (newest on top, grouped Added/Changed/Fixed/Removed). Version headings match the build stamp. Add an entry whenever you bump `VERSION` / ship user-visible changes.
- **`.gitignore`** — excludes `.claude/`, `.DS_Store`, `node_modules/`, **`tools/fluids-review/`** (plaintext data), **`*.pdf`** (licensed source).
- **`.claude/launch.json`** — preview server config (runs `tools/serve.js`).

## Key functions in `src/helper.js`
- `gatherSegments(doc)` — walks the live DOM into ordered `{text, bold}` segments; breaks at block boundaries, joins table cells per row, recurses same-origin frames.
- `extractSegments(segments)` / `extract(text)` — the extractor. `SECTIONS` array defines the 5 buckets (`torque`, `replace`, `fluids`, `tools`, `warnings`) with `test()` regex; `torque`+`replace` have `autoPart:true`, `torque`/`replace`/`fluids` have `label:true`.
- **Vehicle init (v0.3.2, gating fixed v0.3.3):** `extractVehicle(segments)` reads ELSA's **Vehicle Summary** page into `{vin, year, model, engine, trans}` (any field may be `""`). **Tuned against a real summary dump (ATLAS, 2026-06):** ELSA lays each field out as a "Vehicle Data" section where the label ("Model Name", "Engine Code", "Model Year", "Trans Type") is its own line and the value is the **next** line. `VEH_LABELS` holds those four labels **anchored to line start**; `vehField(lines, labelRe, valRe)` takes the rest-of-line or next line. VIN uses `VIN_RE` (17 chars, no I/O/Q) + `looksVin`. `VEH_FIELDS` = shared display order; `vehLoaded(r)`=truthy VIN; `vehMissing(v)`=blank labels. **Gate — `isVehicleSummaryPage(segments)`:** a VIN is NOT proof of the summary (ELSA shows the selected VIN in its header on EVERY page — this caused a repair page to load a half-wrong vehicle pre-0.3.3). The gate requires the summary's structure: a "Vehicle Data" header and/or ≥2 of the four anchored labels. **`run().scan()`:** until loaded, a scan only loads when `isVehicleSummaryPage` is true (then VIN required); otherwise blocked with a `vehNotice` ("this isn't the Vehicle Summary page"), nothing collected. Once loaded, scans collect procedure specs as before. The bar renders via `vehicleBar(r)` (green strip, blanks flagged + click-to-edit `.vval`), hidden in `embed` (demo) mode. Vehicle flows into `plainText`/print/`debugDump` (the dump reports `looks like Vehicle Summary: yes/no` + the per-field grab).
- **Fluids & capacities lookup (v0.3.4):** the `fluids` SECTION is now `linkOnly:true` — **not scanned** (fluids live in a separate per-year PDF, not the repair manual; its `test` returns `false`). `buildHTML` renders it as a link card; `vehFluidsUrl(r)` builds `SITE_URL + "fluids.html?y/m/e/t"` (no VIN) from the loaded vehicle, opened in a new window (`<a target=_blank>`). The new window is on **our** origin so ELSA's CSP doesn't apply and it CAN load the data. The page (`src/fluids.html`) deobfuscates `fluids/<year>.json` and matches: **engine code** → Engine Oil / Coolant rows; **trans-code prefix** (PDF `09P` ⊂ ELSA `09PA`, 3–4 char codes) + **AWD/FWD** (from model string) → Drivetrain (AWD-only parts hidden on FWD); **model name** → A/C (with the **refrigerant type** R1234yf/R134a tagged). Data pipeline = `tools/parse-fluids.js` (PDF→obfuscated JSON + plaintext review sheet) + `tools/fluids-codec.js` (light obfuscation). Verified end-to-end against the 2019 ATLAS (oil 5.5 L, coolant 20 L, A/C 650 g R1234yf, drivetrain 09P + AWD parts).
- **Warning banner severity (v0.3.1):** ELSA flags safety text with four colored banners — **DANGER** (red), **WARNING** (orange), **CAUTION** (yellow), **NOTE** (light blue). `bannerLabel()` matches a lone banner word (its own segment) and carries a `pendingSev` onto the next line; `inlineBanner()` handles "WARNING: …" glued forms; `sevFromText()` infers severity for keyword-only lines. Each `warnings` item gets a `sev` field; the panel/print/copy colour-match and tag it. **NOTE is matched ONLY as a real banner** (never the loose word "note") — its text has no warning keyword, which is why it was previously missed. Detection depends on the English banner words (could break if ELSA localizes them).
- Component numbering: ELSA's visible "1./2./3." are CSS list markers (NOT in text). Each component name follows an **"+ ADD" button** — so `extractSegments` counts ADD buttons and numbers components itself (`partFromHeading`, `cleanPartName`, `STOP_FIRST` reject list).
- **Special tools (reworked v0.3.1):** the `tools` bucket is special-cased in the extract loop. `toolEntries(line)` finds every tool number (`TOOL_RE`, incl. a `/N` sub-part) and parses a description from the surrounding text (`toolDescBefore` strips leading filler like "Use/With/the…"; `toolDescAfter` is a Title-Case fallback). Items are `{num, desc, text}` **deduped by number job-wide** (a tool cited many times is listed once; `mergeInto`/`toolKey` keep it unique across pages and back-fill a missing description). The blue chips are derived from the list via `toolNums(r)` (not a separate `__tools` field anymore) and each chip is removable (`data-chipdel`), which also drops its list row. Tools render **flat** (never grouped per-page) in panel/copy/print.
- `gatherImages`/`pickDiagrams` — capture only the dominant overview diagram(s), and only on pages with numbered components.
- `mergeInto`/`saveJob`/`loadJob` + `groupBySource`/`srcCount` — multi-page accumulation grouped by source page.
- `buildHTML`/`renderInto` — render the Shadow-DOM panel; `makeDraggable`, `printJob`/`buildPrintHTML`, `plainText`, `debugDump`, `detectTitle`, `run`.

# Development Standards

- **Coding style:** Vanilla, dependency-free, broadly-compatible JS. Match the existing file: `var`, named `function`s, IIFE module pattern, single shared `window.VWJB` namespace. No frameworks, no bundler. CSS is a single concatenated string constant in `helper.js`; the panel uses short class names inside its shadow root.
- **Naming:** `camelCase` functions/vars; `SCREAMING_CASE`/`PascalCase` module constants (`SECTIONS`, `BUILD`, `VERSION`, `STORE_KEY`, `TRASH`, `IMG_ICON`, `SITE_URL`). sessionStorage keys are `vwjb_*_v1`.
- **Error handling:** Wrap all DOM access, cross-origin frame access, `sessionStorage`, clipboard, and `getComputedStyle` in `try/catch` and **degrade gracefully** — never throw into the host page. Cross-origin iframes silently skipped.
- **Security / privacy (CRITICAL — this is the product's promise):** The **bookmarklet on ELSA still makes ZERO network calls** — nothing phones home, no manual content saved to files. Only the extracted working list + UI state in sessionStorage (volatile), plus one `localStorage` date string for the weekly reminder. Diagrams stored **by URL reference, not copied**. Shadow DOM isolation. **Fluids lookup nuance (v0.3.4):** the fluids link opens a **separate window on our own origin** (not ELSA) that loads our published fluid data — this does NOT add any network call to the ELSA-resident bookmarklet, and only the vehicle's **year/model/engine/trans** ride in the URL (**never the VIN**, never ELSA/job content). Keep it this way. The fluid data is **light-obfuscated** (key in the page → obfuscation, not security; the owner's accepted trade-off); the **plaintext review sheets and source PDFs are gitignored** so licensed VW data isn't republished openly. Flag any change that would send job/ELSA content anywhere or add a runtime network call **to the bookmarklet itself**.
- **Performance:** Designed around a single user-initiated "Scan page" click, so per-scan DOM walking + `getComputedStyle` is acceptable. Keep the bookmarklet self-contained (payload ~78 KB after dropping the baked-in changelog in v0.3.0 — fine for bookmark URLs).
- **Verification:** No automated test suite. Verify with (a) `node --check src/helper.js` for syntax, (b) a Node eval harness (`global.window={}; eval(helper); window.VWJB...`) for logic, and (c) the browser preview. ALWAYS `node --check` after editing `helper.js` — a stray quote silently breaks `window.VWJB`.

# Product Requirements

## Core features (built)
- **Vehicle init (v0.3.2, gating fixed v0.3.3):** scanning ELSA's **Vehicle Summary** page first loads the vehicle (VIN, Model Year, Model Name, Engine Code, Trans Type) into a green strip at the top of the panel; **required before any procedure specs can be collected**. Only the real summary page loads a vehicle (a stray header VIN on a repair page won't). Blanks are flagged + hand-editable; carried into copy/print. **Powers the fluids lookup (v0.3.4).**
- **Fluids & Capacities lookup (v0.3.4):** the fluids section is a **link** (not scanned) that opens a vehicle-matched lookup page (Engine Oil, Engine Coolant, Air Conditioning, Drivetrain — capacities + fluid specs), matched to the loaded vehicle's engine/trans/model/year. Programmer-only PDF→data pipeline per model year; **only 2019 data loaded so far**.
- One-click **Scan page**: extracts torque, replace-after-removal, fluids/capacities, special tools, critical warnings (incl. **DANGER/WARNING/CAUTION/NOTE** banners, colour-coded to match ELSA — v0.3.1).
- **Auto component numbering** from the "+ ADD" button pattern → labels like `2. Torx Bolt`.
- Per-spec **editable part labels** (`+ part` chips); auto labels flow into torque/replace only (fluids = manual chip).
- **Manual add** rows per section; **trash/delete** per item; **delete** per diagram.
- **Clear info** (v0.3.7.1) — a button under **New job** that empties all collected data (specs, tools, warnings, diagrams, title) **but keeps the loaded vehicle** (unlike New job, which clears the vehicle too). Plus a **per-group Clear** button in each section header (incl. Diagram). Both use an inline "Clear all?" Yes/No confirm (`inlineConfirm` in `renderInto`); per-group via `data-clear="<key>"` / `data-clear="__images"`, Clear info via `data-act="clearinfo"`.
- **Job title** bar (auto-filled from page header, editable).
- **Multi-page accumulation**: navigating + scanning more pages adds them, **grouped by page** with editable page headers; deduped by source+part+text.
- **Diagram capture** (numbered-overview pages only, dominant image only, by URL reference); click to open full size.
- **Print** to a clean job sheet / PDF (hidden iframe, not the ELSA page); **Copy list**.
- **Draggable** panel (pointer-capture, works over iframes), **Minimize**, **New job** (with Yes/No confirm).
- **Version stamp** + "check for latest" link; **Current version** box on setup page; **diagnostic dump** (click the version stamp).
- **Weekly update-check reminder** (v0.3.0): network-free; yellow banner "App may be out of date — Check for update?" linking to the setup page, shown **only on Wednesdays, once that day**, with a Dismiss.
- **Paste-box fallback** on the setup page for pages the bookmark can't read.

## Planned / discussed
- Hahns **mascot artwork** (during polish phase; currently a wrench icon placeholder).
- A short **"works in Chrome/Edge/Safari" note** for Firefox users (offered).

## Intentionally excluded
- **No LLM/AI parsing** — local regex/DOM heuristics only, so manual content never leaves the browser.
- **No backend / no database.**
- **Firefox not supported** (CSP blocks bookmarklets there).
- **Google Authenticator / TOTP auto-fill — shelved** (see constraints).

# Design Decisions

- **Bookmarklet, not a browser extension:** shop machines are locked down and can't install extensions; a bookmark needs no install/admin.
- **Local-only extraction, not an LLM:** ELSA content is licensed; "retain nothing / send nothing" is the core promise, so all parsing is on-device pattern matching.
- **Component numbering via ADD-button counting:** the displayed 1./2./3. are CSS list markers absent from page text (discovered via a real-page diagnostic). Each component name follows an "ADD" button, so counting them reproduces ELSA's numbering. Bold is NOT required (the whole legend is bold).
- **`sessionStorage` for multi-page jobs:** survives page-to-page navigation (the panel is destroyed on navigation) yet auto-clears on tab close — matches "retain nothing." Diagrams stored as URLs (not data) to stay lightweight and reference-only.
- **Shadow DOM panel + pointer-capture dragging:** isolation from ELSA CSS; pointer capture keeps drag working over ELSA's iframes.
- **GitHub Pages from `/docs`:** free, public, trivial updates; the version stamp lets techs confirm they re-dragged the latest.
- **Single `VERSION` constant** in `build.js`; user-facing stamp = `v<VERSION> · <UTC date time>`. (alpha/testing stage).
- **Weekly reminder instead of a network auto-update (v0.3.0):** since no over-the-wire check can run on ELSA (CSP), the app can't *know* if it's stale — so it just nudges the tech to go look. Kept deliberately un-annoying: the banner fires **only on Wednesday** (`new Date().getDay() === 3`) and **only once** that day — `reminderDue()` records this Wednesday's marker (`YYYY-MM-DD`) the instant it returns true, so re-opening the panel later the same day won't show it again. The tradeoff (accepted by the owner): a tech who never opens the app on a Wednesday won't see it that week — fine, because it's a soft nudge, not a real alert, and the app may not even be out of date. Pure local date math = no network, works the same inside ELSA.
- **TOTP shelved:** Google Authenticator codes can only be reproduced from the secret seed (no "sign in with Google" path exists); the seed may be admin-locked under Group Retail Portal, and colocating the 2FA factor on the PC weakens security and may violate GRP policy. Parked pending the owner getting the seed + policy clearance.

# Known Constraints

- **Browser support:** Works in **Chrome, Edge, Safari**. **Firefox does NOT work** — it enforces the page's CSP on bookmarklets (others exempt user-clicked bookmarklets). Not fixable without an extension. Verified on multiple machines 2026-06-20.
- **Updates require re-dragging:** the bookmark is a frozen snapshot. Users must **hard-refresh** the setup page (Cmd/Ctrl+Shift+R — GitHub Pages caches) THEN re-drag. The version stamp is the staleness check.
- **A "loader" bookmarklet (auto-updating stub) is IMPOSSIBLE on ELSA — settled by ELSA's actual CSP header:** A tech read ELSA's real Content-Security-Policy (2026-06-25):
  `default-src 'self'; frame-ancestors 'self' elsa2go.vwhub.com; object-src 'self' *.vwhub.com *.accessaudi.com; block-all-mixed-content; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; frame-src 'self' blob: *.vwhub.com *.accessaudi.com; connect-src 'self' blob:; img-src 'self' blob: data:`.
  Key reads: **`script-src 'self' 'unsafe-inline'`** — external scripts from our domain are blocked (only ELSA's own + inline), so a loader that injects `<script src=…ourdomain…>` cannot load; **but inline is allowed, which is exactly why the self-contained bookmarklet runs**. `connect-src 'self' blob:` and `img-src 'self' blob: data:` confirm the fetch/image blocks we measured. There is **no external-code path** on ELSA (localStorage is per-origin so off-ELSA caching can't help; eval-of-fetched-code hits connect-src). **The self-contained bookmarklet is mandatory; re-dragging is the only possible update method. Do not revisit loader/remote-code ideas for ELSA.**
- **Network auto-update was REMOVED in v0.3.0 (do not re-add):** Real-ELSA testing (host `www.vwhub.com`) with the `securitypolicyviolation` listener confirmed `csp:true` for BOTH `connect-src` (v0.2.1) and `img-src` (v0.2.2) — ELSA's CSP blocks **every** background request to our domain. The whole v0.2.x server-checked update feature (fetch of `version.json`, `isElsaPage()` host-gate, marker images) was therefore **deleted in v0.3.0**, restoring zero network calls. **Replaced by a network-free weekly reminder:** a pure local-date check that — **only on Wednesdays, and only once that day** — shows a yellow "App may be out of date — Check for update?" banner at the top of the panel, linking to the setup page (tracked by the `vwjb_upd_reminder_v1` date string, written the moment it's shown). **Dismiss** just clears it from the current view. Kept deliberately low-key because there's no way to know whether the app is actually stale. It works the same on and off ELSA because it touches no network. The version stamp + "check for latest ↗" link remain the guaranteed manual path. **Don't re-attempt a network update check — proven impossible on ELSA.**
- **Diagram capture only finds `<img>`** of sufficient size on numbered-overview pages. Inline SVG/canvas diagrams or cross-origin frames are not captured (diagnostic reports "diagrams kept: N").
- **Component numbering depends on the "+ ADD" button** text (English "ADD" / French "AJOUTER"). UI changes upstream could break it.
- **`detectTitle` (page header) is heuristic** — editable per page as the fallback. The diagnostic reports the detected header.
- **Cross-origin iframe content is unreadable** (browser security); paste-box is the fallback.
- **Re-scanning the same page can re-add a deleted item** (deletions persist but a fresh scan re-reads everything).
- **Repo + Pages are public** — the setup page URL is shareable but not access-restricted.

# Common Commands

Run from project root (`/Users/ryanvanpolen/Documents/Claude App Builds/VW Tech Helper App`).

- **Build:** `node tools/build.js` — regenerates `dist/` and `docs/` with a fresh version stamp.
- **Parse a fluids PDF (programmer-only):** `node tools/parse-fluids.js "<year>.pdf" [--year YYYY]` — needs poppler (`brew install poppler`). Writes obfuscated `docs/fluids/<year>.json` + the gitignored review sheet `tools/fluids-review/<year>.txt` (**review it before committing**).
- **Syntax check (do after every helper.js edit):** `node --check src/helper.js`
- **Local preview server (no-cache, port 8755):** `node tools/serve.js` → open `http://localhost:8755/dist/HAHNS.html`. (Or use the Claude preview tooling via `.claude/launch.json`.)
- **Logic test harness (no browser):** `node -e 'global.window={}; eval(require("fs").readFileSync("src/helper.js","utf8")); /* call window.VWJB.* */'`
- **Tests:** none (no suite).
- **Bump version:** edit `VERSION` in `tools/build.js` → `node tools/build.js`.
- **Deploy:** `git add -A && git commit -m "..." && git pull --rebase origin main && git push origin main` → GitHub Pages redeploys in ~1 min. (Always `pull --rebase` first; the owner edits README on GitHub.)
- **Verify live:** `curl -s https://flatratelabs.github.io/hahns/ | grep -o 'v0.1.0-alpha[^<]*'`

# Future Session Instructions

When starting a new session:

1. **Read CLAUDE.md first.**
2. **Minimize token usage.**
3. **Do not inspect unnecessary files.**
4. **Read only files required for the task.** (Most work is in `src/helper.js`; UI/page copy is in `src/template.html`; build/deploy in `tools/`.)
5. **Explain planned changes before implementation.**
6. **Preserve existing architecture** (dependency-free bookmarklet, Shadow DOM, local-only/no-network privacy posture, sessionStorage state) **unless explicitly instructed otherwise.**
7. **Update CLAUDE.md** when permanent project knowledge changes.
8. **Update SESSION_SUMMARY.md** at the end of every development session.

## Critical workflow reminders
- After editing `src/helper.js`: run `node --check src/helper.js`, then `node tools/build.js`. A mismatched quote silently makes `window.VWJB` undefined.
- When bumping `VERSION` or shipping user-visible changes, add a `CHANGELOG.md` entry (newest on top). Keep the "in progress" heading for the working branch; rename it to the release date when merged to `main`.
- Editing `src/helper.js` or `src/template.html` requires a rebuild — never hand-edit `dist/` or `docs/`.
- To publish: rebuild → `git pull --rebase` → commit → push. Confirm the live site picks up the new build stamp.
- Tell the user to **hard-refresh + re-drag** the bookmark after any deployed change.
