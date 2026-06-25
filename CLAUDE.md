# Project Overview

- **Project name:** H.A.H.N.S — **H**ardware, **A**dvisories, **H**ighlights, & **N**avigation **S**pecialist (mascot "Hahns", art not yet created). Formerly code-named "VW Job Buddy".
- **Purpose:** A no-install browser helper that reads the VW repair procedure a technician already has open in ELSA (via vw-now.com → ELSA 2 Go / ELSA Pro) and pulls the job-relevant data into one tidy, printable panel: torque specs, replace-after-removal (one-time-use) parts, fluids & capacities, special tools, critical warnings, and the numbered overview diagram.
- **Target users:** VW dealership technicians at the bay, using locked-down shop computers. Primary stakeholder/owner: a VW tech (GitHub `rvanpolen89`), not a developer — explain changes in plain terms.
- **Core value proposition:** One click collects everything a tech needs for a job (across multiple manual pages), labels each spec with the component callout number so it maps to the diagram, and prints a clean job sheet — **while keeping nothing** (no files saved, no manual content sent anywhere). Ships as a bookmark, so nothing installs on restricted machines.

# Architecture

- **Frontend:** A single self-contained vanilla-JS bookmarklet. No framework, no build-time transpile, **no runtime dependencies**. The UI panel is rendered into a **Shadow DOM** root injected into the host (ELSA) page so ELSA's CSS can't touch it and vice-versa. Written in conservative, broadly-compatible JS (mostly `var`/`function`, try/catch around anything risky).
- **Backend:** None. There is no server-side component. All extraction/rendering happens locally in the browser.
- **Database:** None. Transient state lives in **`sessionStorage`** (per-tab, auto-clears on tab/browser close):
  - `vwjb_job_v1` — the running job (collected specs, tools, diagram URLs, title).
  - `vwjb_pos_v1` — remembered panel position.
  - `vwjb_min_v1` — minimized (collapsed) state.
  - **Exit** (the panel ✕, with a confirm dialog) clears all three of the above.
  - **One** `localStorage` key, `vwjb_seen_ver_v1` — the last version a tech saw "What's new" for, so the changelog pops up once per update. Stores **only a version string** (e.g. `0.1.1-alpha`), never job/ELSA content, so it doesn't weaken the privacy posture; persists across tabs by design (that's the point).
  - **Two** `localStorage` keys for the auto-update check (v0.2.1): `vwjb_last_update_check_v1` (`{at, ver}` of the last network attempt — drives the **once-per-day** throttle; a version change re-checks promptly) and `vwjb_last_update_result_v1` (JSON of the last attempt's outcome: `fetchSuccess`, `httpStatus`, `error`, `csp`, `latest`). Both hold only timing/version/diagnostic data — never job/ELSA content — and are surfaced in the diagnostic dump.
- **Hosting / deployment:** Static. Source repo **github.com/FlatRateLabs/hahns** (public). Hosted on **GitHub Pages** from the **`/docs`** folder of `main`. Live setup page (share this with techs): **https://flatratelabs.github.io/hahns/**. Pages auto-redeploys ~1 min after push.
- **Authentication:** None in the tool. It only reads pages the tech has already logged into. (A Google-Authenticator/TOTP auto-fill feature was explored and **shelved** — see Design Decisions / Known Constraints.)
- **Third-party services / APIs:** **None at runtime, with ONE deliberate exception** (v0.2.0+): the **auto-update check** — at most once per day, in the background after render, the app does a single `fetch` of the public `version.json` on GitHub Pages to detect a newer build. It is sent with **no referrer, no cookies, no cached data, and zero job/ELSA content**, and fails **silently** for the tech (the real reason is recorded in `vwjb_last_update_result_v1` for the diagnostic). This is the only network call; preserve that scope. GitHub Pages is used only for hosting. `gh` CLI (installed via Homebrew, authed as `rvanpolen89`) is used for repo/Pages management from the dev machine.

# Folder Structure

- **`src/helper.js`** — THE BRAIN. All logic: DOM walking, spec extraction, component numbering, panel rendering, sessionStorage, drag, print, diagnostics. Exposes `window.VWJB`. Edit here.
- **`src/template.html`** — the setup/demo page template. Contains placeholders the build replaces: `__BOOKMARKLET__` (the `javascript:` URL), `__HELPER__` (raw helper.js for the live demo box), `__BUILD__` (the version stamp), `__CHANGELOG__` (rendered changelog HTML for the bottom "What's new" card). Includes the draggable install button, a working paste-box demo, the prominent "Current version" box, an update/hard-refresh note, and the "What's new" section.
- **`tools/build.js`** — the build. Reads `src/`, stamps the version, generates: `dist/HAHNS.html`, `dist/bookmarklet.txt`, `dist/version.json`, `docs/index.html`, `docs/bookmarklet.txt`, `docs/version.json`, `docs/.nojekyll`. **Holds the `VERSION` constant.** Also **renders `CHANGELOG.md` to HTML** (`renderChangelog`, a tiny markdown subset) and injects it into the page (`__CHANGELOG__`) and the bookmarklet (helper's `__CHANGELOG_HTML__` as a JS string, `__VERSION__` as the bare version). So the app's "What's new" needs no network — the changelog is baked in. **`version.json`** (`{version, build}`) is what the deployed app fetches for its update check.
- **`tools/serve.js`** — tiny no-cache static dev server (port 8755) for local preview. Default route serves `dist/HAHNS.html`.
- **`dist/`** — build output for local use (`HAHNS.html`, `bookmarklet.txt`, `version.json`).
- **`docs/`** — build output served by GitHub Pages (`index.html`, `bookmarklet.txt`, `version.json`, `.nojekyll`).
- **`README.md`** — user-facing readme (NOTE: the owner sometimes edits this directly on GitHub web UI — always `git pull --rebase` before pushing).
- **`CHANGELOG.md`** — plain-language, user-facing record of what changed per version (newest on top, grouped Added/Changed/Fixed/Removed). Version headings match the build stamp. Add an entry whenever you bump `VERSION` / ship user-visible changes.
- **`.gitignore`** — excludes `.claude/`, `.DS_Store`, `node_modules/`.
- **`.claude/launch.json`** — preview server config (runs `tools/serve.js`).

## Key functions in `src/helper.js`
- `gatherSegments(doc)` — walks the live DOM into ordered `{text, bold}` segments; breaks at block boundaries, joins table cells per row, recurses same-origin frames.
- `extractSegments(segments)` / `extract(text)` — the extractor. `SECTIONS` array defines the 5 buckets (`torque`, `replace`, `fluids`, `tools`, `warnings`) with `test()` regex; `torque`+`replace` have `autoPart:true`, `torque`/`replace`/`fluids` have `label:true`.
- Component numbering: ELSA's visible "1./2./3." are CSS list markers (NOT in text). Each component name follows an **"+ ADD" button** — so `extractSegments` counts ADD buttons and numbers components itself (`partFromHeading`, `cleanPartName`, `STOP_FIRST` reject list).
- `gatherImages`/`pickDiagrams` — capture only the dominant overview diagram(s), and only on pages with numbered components.
- `mergeInto`/`saveJob`/`loadJob` + `groupBySource`/`srcCount` — multi-page accumulation grouped by source page.
- `buildHTML`/`renderInto` — render the Shadow-DOM panel; `makeDraggable`, `printJob`/`buildPrintHTML`, `plainText`, `debugDump`, `detectTitle`, `run`.

# Development Standards

- **Coding style:** Vanilla, dependency-free, broadly-compatible JS. Match the existing file: `var`, named `function`s, IIFE module pattern, single shared `window.VWJB` namespace. No frameworks, no bundler. CSS is a single concatenated string constant in `helper.js`; the panel uses short class names inside its shadow root.
- **Naming:** `camelCase` functions/vars; `SCREAMING_CASE`/`PascalCase` module constants (`SECTIONS`, `BUILD`, `VERSION`, `STORE_KEY`, `TRASH`, `IMG_ICON`, `SITE_URL`). sessionStorage keys are `vwjb_*_v1`.
- **Error handling:** Wrap all DOM access, cross-origin frame access, `sessionStorage`, clipboard, and `getComputedStyle` in `try/catch` and **degrade gracefully** — never throw into the host page. Cross-origin iframes silently skipped.
- **Security / privacy (CRITICAL — this is the product's promise):** Exactly **one** network call (the v0.2.0 auto-update check: a referrer-less, cookie-less GET of `version.json` carrying no job/ELSA data, failing silently) — nothing else phones home. No saving manual content to files. Only the small extracted working list + UI state in sessionStorage (volatile). Diagrams stored **by URL reference, not copied**. Shadow DOM isolation. Always preserve this posture; flag any change that would send job/ELSA content anywhere or add a second network call.
- **Performance:** Designed around a single user-initiated "Scan page" click, so per-scan DOM walking + `getComputedStyle` is acceptable. Keep the bookmarklet self-contained (current payload ~80 KB — fine for bookmark URLs; the baked-in changelog grows it over time, so trim the app changelog to recent versions if it ever balloons).
- **Verification:** No automated test suite. Verify with (a) `node --check src/helper.js` for syntax, (b) a Node eval harness (`global.window={}; eval(helper); window.VWJB...`) for logic, and (c) the browser preview. ALWAYS `node --check` after editing `helper.js` — a stray quote silently breaks `window.VWJB`.

# Product Requirements

## Core features (built)
- One-click **Scan page**: extracts torque, replace-after-removal, fluids/capacities, special tools, critical warnings.
- **Auto component numbering** from the "+ ADD" button pattern → labels like `2. Torx Bolt`.
- Per-spec **editable part labels** (`+ part` chips); auto labels flow into torque/replace only (fluids = manual chip).
- **Manual add** rows per section; **trash/delete** per item; **delete** per diagram.
- **Job title** bar (auto-filled from page header, editable).
- **Multi-page accumulation**: navigating + scanning more pages adds them, **grouped by page** with editable page headers; deduped by source+part+text.
- **Diagram capture** (numbered-overview pages only, dominant image only, by URL reference); click to open full size.
- **Print** to a clean job sheet / PDF (hidden iframe, not the ELSA page); **Copy list**.
- **Draggable** panel (pointer-capture, works over iframes), **Minimize**, **New job** (with Yes/No confirm).
- **Version stamp** + "check for latest" link; **Current version** box on setup page; **diagnostic dump** (click the version stamp).
- **Paste-box fallback** on the setup page for pages the bookmark can't read.

## Planned / discussed
- Hahns **mascot artwork** (during polish phase; currently a wrench icon placeholder).
- A no-network **"build is stale" nudge** (offered, not yet built).
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
- **Single `VERSION` constant** in `build.js`; user-facing stamp = `v<VERSION> · <UTC date time>`. Currently `0.1.0-alpha` (alpha/testing stage).
- **TOTP shelved:** Google Authenticator codes can only be reproduced from the secret seed (no "sign in with Google" path exists); the seed may be admin-locked under Group Retail Portal, and colocating the 2FA factor on the PC weakens security and may violate GRP policy. Parked pending the owner getting the seed + policy clearance.

# Known Constraints

- **Browser support:** Works in **Chrome, Edge, Safari**. **Firefox does NOT work** — it enforces the page's CSP on bookmarklets (others exempt user-clicked bookmarklets). Not fixable without an extension. Verified on multiple machines 2026-06-20.
- **Updates require re-dragging:** the bookmark is a frozen snapshot. Users must **hard-refresh** the setup page (Cmd/Ctrl+Shift+R — GitHub Pages caches) THEN re-drag. The version stamp is the staleness check.
- **Auto-update check is best-effort:** the app fetches `version.json` (≤once/day, background) and shows an "update available" banner if a newer build exists; on failure it no-ops silently. On the **one real-ELSA test so far** (host `www.vwhub.com`, v0.2.0 build) the fetch failed with a generic `Failed to fetch` — cause **not yet definitively identified**. The host's `connect-src` CSP is the leading suspect (it governs bookmarklet-initiated requests even though Chrome/Edge/Safari exempt the bookmarklet *code* from CSP), but the v0.2.0 diagnostic couldn't distinguish CSP from other network failures. **v0.2.1 adds a `securitypolicyviolation` listener** so the diagnostic now records whether a CSP block *actually* fired (`csp:true/false`) — **re-test on a real ELSA page pending** to confirm the true cause. GitHub Pages serves `version.json` with permissive CORS (`access-control-allow-origin: *`), so CORS is not the blocker. The version stamp + manual "check for latest ↗" link remain the guaranteed fallback.
- **Diagram capture only finds `<img>`** of sufficient size on numbered-overview pages. Inline SVG/canvas diagrams or cross-origin frames are not captured (diagnostic reports "diagrams kept: N").
- **Component numbering depends on the "+ ADD" button** text (English "ADD" / French "AJOUTER"). UI changes upstream could break it.
- **`detectTitle` (page header) is heuristic** — editable per page as the fallback. The diagnostic reports the detected header.
- **Cross-origin iframe content is unreadable** (browser security); paste-box is the fallback.
- **Re-scanning the same page can re-add a deleted item** (deletions persist but a fresh scan re-reads everything).
- **Repo + Pages are public** — the setup page URL is shareable but not access-restricted.

# Common Commands

Run from project root (`/Users/ryanvanpolen/Documents/Claude App Builds/VW Tech Helper App`).

- **Build:** `node tools/build.js` — regenerates `dist/` and `docs/` with a fresh version stamp.
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
