# Session Summary

Running log of development sessions. Newest entry on top. See `CLAUDE.md` for the
permanent project reference.

---

## 2026-06-27 — v0.3.5.12-alpha: seq diagram first-scan + sequence grouping

Branch **`0.3.5.12`** (off `main`). **Re-drag needed.** Two owner follow-ups after the
sequence-table parse (v0.3.5.11) tested clean.

### 1. Sequence diagram didn't appear until the 2nd SCAN
- A 2nd, lower-down image (the sequence diagram) is often still loading on the first
  scan → `gatherImages` reads size 0 → skipped; the 2nd scan caught it once cached.
- Added `pendingImages(doc)` (incomplete `<img>` across same-origin frames) +
  `scheduleImageRescan(scan)` (module flag `imgRescanDone`): after a successful scan,
  if any images are still loading, re-run the scan ONCE when they settle (4 s cap).
  Idempotent (mergeInto dedups), one auto-rescan per page load.

### 2. Give the tightening sequence its own labeled break
- `extractSegments`: capture the heading above the table/diagram (line with
  `tightening`+`sequence`, not `refer to`, not starting with `Step`) into `seqTitle`,
  consumed (not emitted). Each step row carries `seqTitle`. `results.__seqSeen` set when
  a title/table is found.
- `run().scan()`: sequence steps get `it.src = seqTitle`; the supplementary
  (non-dominant) **sequence diagram** also gets `src = seqTitle`. This reuses the
  existing per-source grouping → the steps + their diagram break out under
  "Cylinder Head – Tightening Specifications and Sequence", like a separately-scanned
  page. `hasSeqRef` now also honors `__seqSeen`.

### Verified (harness from real rows)
- Steps + sequence diagram grouped under the captured title; component torque under the
  page header; both diagrams kept; `multiFig=false`. The 2026 "refer to Fig" reference
  case is unaffected (reference kept on the bolt, not swallowed as a title).

### Deployed
- Version → `v0.3.5.12-alpha`; branch `0.3.5.12` → PR → `main`. **Re-drag required.**

---

## 2026-06-27 — v0.3.5.11-alpha: parse the tightening-sequence TABLE

Branch **`0.3.5.11`** (off `main`). **Re-drag needed.** Owner tested v0.3.5.10 on a
real page (2022 GTI, DRNA) and the sequence was still wrong — screenshots showed the
sequence is an inline **table** on the *same* page, not just a referenced figure.

### The real structure (from owner screenshots)
A table with columns **Step | Bolts | Tightening Specification/Additional Turn**:
1. 1 through 10 — All the way by hand · 2. 50 Nm · 3. 90° · 4. 90° · 5. (bolt 11) 8 Nm
· 6. (bolt 11) 90°. Plus the sequence diagram (bolt callouts 1–11) to the right.

### Why it was mangled
The Step column ("1.", "2." …) looks exactly like a component callout ("1. Part"), so:
- row 1 became a fake component `1. 1 through 10 All the way by hand`;
- the Nm rows (2, 5) attached under it; the °-only rows (3, 4, 6) were **dropped**
  (a lone 90° isn't captured without stage/step/tighten context);
- the header row matched `SEQ_REF_RE` and stuck onto the last real part (24. Alignment
  Pin → "Step Bolts Tightening Specification/Additional Turn").

### Fix (`extractSegments`)
- Detect the table **header** (line with `step` + `bolts` + `tightening`) → enter
  `inSeqTable`, consume it.
- Each following `^\d+[.)]? …` row is parsed into a step: split bolts
  (`1 through 10`, `11`, ranges/lists) from the spec, push to **torque** as
  `part:"Step N", text:"Bolts X — <spec>", seq:true`. Rows return early so the
  component/torque heuristics never see them. A non-step row ends the table.
- `run()` `hasSeqRef` now also fires on `it.seq`, so the **sequence diagram is kept**
  for display (alongside the overview), not as a figure boundary.

### Verified (harness from the real rows)
- All 6 steps listed **in order** incl. the 90° rows; header not captured; component 24
  not polluted; real component torques intact; both diagrams kept; `multiFig=false`
  (no split).

### Deployed
- Version → `v0.3.5.11-alpha`; branch `0.3.5.11` → PR → `main`. **Re-drag required.**

---

## 2026-06-27 — v0.3.5.10-alpha: tightening sequences + multi-diagram hardening

Branch **`0.3.5.10`** (off `main`). **Bookmarklet code change → re-drag needed.**
Owner-reported via a real diagnostic dump (*Overview – Cylinder Head*, 2026 Tiguan
2.0L, engine DNFH). All in `src/helper.js`. Verified with `node --check` + harnesses
built from the actual dump segments.

### Findings from the dump (key context)
- The overview page itself reads **correctly** (14 components numbered 1–14, torques/
  replaces attached). The cylinder-head **bolt (callout 8)** had two notes:
  `Replace after removing` (captured) and seg 096 `Tightening Specifications and
  Sequence. Refer to Fig …` (was **dropped** — no Nm number).
- Diagnostic showed **large images: 2 · diagrams kept: 1** — the 2nd image is the
  **tightening sequence diagram**, dropped by the dominant-only filter.

### 1. Tightening-sequence reference + diagram now captured
- New `SEQ_REF_RE = /\btightening\s+(?:specification|spec|sequence|procedure|order)/i`.
- **torque test** now matches a seq-ref line → seg 096 is captured under Torque with
  part `8. Bolt` (so the bolt visibly needs the sequence).
- **`run().scan()`**: when a page has a seq-ref, the smaller **supplementary sequence
  diagram** is kept for **display** (any candidate ≥45000 px²), in addition to the
  dominant overview. Kept for display **only — NOT as a figure boundary**, so it can't
  restart bolt numbering. Diagnostic now reports the display count + "(incl.
  tightening-sequence diagram)".

### 2. Multi-diagram hardening (follow-up to v0.3.5.9)
- `extractSegments(segments, keepImgUrls)` — figure boundaries now fire **only on
  dominant/kept diagrams**, never on a small non-dominant image. `multiFig` is based
  on distinct **kept-diagram** figures. Fixes a latent v0.3.5.9 bug this page exposed:
  a dropped 2nd image could have restarted/split the single-legend numbering.

### Verified
- Cylinder-head dump: bolt 8 gets the seq line; both diagrams kept; `multiFig=false`
  (no split); numbering stays 1–14.
- Regression: two genuine dominant diagrams still split into Fig 1/Fig 2 with restarted
  numbering; a dropped small image (no seq ref) → no split, 1 diagram.

### Deployed
- Version → `v0.3.5.10-alpha`; branch `0.3.5.10` → PR → `main`. **Re-drag required.**

---

## 2026-06-27 — v0.3.5.9-alpha: extractor bug-fix pass (4 fixes)

Branch **`0.3.5.9`** (off `main`). **Bookmarklet code change → re-drag needed.**
Four owner-reported extraction bugs, all in `src/helper.js`. Verified with
`node --check` + node logic harnesses (the project's standard for extractor logic;
the print/multi-diagram cases can't be exercised in the embed-mode demo).

### 1. Replace-after-removal missed a bare "Replace"
- A standalone **Replace** / **Renew** note (ELSA's one-time-use legend marker on a
  component) matched none of the `replace` test patterns. Added an anchored check
  `^(?:replac\w*|renew\w*)\.?$` — fires only on the lone word (not "Replace the
  cover" = reinstall). Now picks up its numbered component like the others.

### 2. Special tools: missing numbers + torque wrench misfiled
- **`TOOL_RE` extended:** new hyphenated branch `\d{1,3}-\d{2,3}\s?[A-Z](?:\/\d+)?`
  for `10-222 A` + sub-parts `10-222 A/1, /2`; the trailing letter is required so
  ranges like `6-50 Nm` aren't matched. Added a trailing letter (+ optional space)
  to the V.A.G branch (`\d{3,4}\s?[A-Z]?`) so `VAG 1331A` / `V.A.G 1332A` /
  `1332 A` match (with or without dots). Word-boundary protected (`VAG 1331
  Adapter` → `VAG 1331`).
- **Torque wrench no longer lands in Torque specs.** First attempt (skip any line
  with "torque wrench") **broke real specs** — confirmed in a harness that
  "Using a torque wrench, tighten to 23 Nm" lost its 23 Nm. Refined: only skip when
  the line is a wrench **listing** (carries a tool number AND "torque wrench"
  directly followed by an Nm **range** = the tool's capacity). Real tightening
  instructions keep their spec; "Tighten to 50 Nm using torque wrench -VAG 1331A-"
  yields **both** a tool and a torque spec. 11/11 routing cases pass.

### 3. Print sometimes showed blank diagrams (2nd try worked)
- `printJob` called `w.print()` on a fixed 250 ms timer; remote ELSA diagram
  `<img>`s often hadn't loaded yet (worked on retry once cached). Now waits for all
  iframe images to **settle** (load OR error) before printing, with a 3 s safety
  cap and a `fired` once-guard. Simulated load/error/stall cases → prints exactly
  once every time.

### 4. Multiple diagrams on one page — only the first usable
- Two root causes: (a) one **running** component counter never reset, so diagram 2's
  bolts were numbered 4,5,6 (not matching its 1,2,3 callouts); (b) dedup key was
  `part+text` with no figure dimension, so a spec identical on both diagrams was
  **dropped**. Fix: `gatherSegments` emits diagram **markers** (DOM order, same size
  filter as capture); `extractSegments` uses them as **figure boundaries** —
  restarts numbering per figure, tags torque/replace items with `.fig`, scopes the
  dedup key to the figure. `run().scan()` labels items/diagrams `Title · Fig N` only
  when a page truly has ≥2 figures, reusing the **existing per-source grouping**
  (panel/print/copy/edit/merge) — single-diagram pages are unchanged. `debugDump`
  shows the markers. Verified: per-figure numbering restarts, repeated spec kept,
  single/multi/no-image labeling correct, vehicle detection unaffected by markers.

### Deployed
- Version → `v0.3.5.9-alpha`; branch `0.3.5.9` → PR → `main`. **Bookmarklet code
  change → owner must hard-refresh the setup page + re-drag.**

### Open / honest caveats
- Diagrams still render in their own section (now grouped by `Fig N`); an *inline*
  per-figure layout would be a larger change (offered).
- Figure boundary triggers on any captured-size image on an overview page; a large
  non-diagram image *between* two bolts of the same legend could split mid-diagram
  (judged unlikely — confirm against a real two-diagram page if one shows up).

---

## 2026-06-27 — v0.3.5.8-alpha: cache-bust the fluids page

Branch **`0.3.5.8`** (off `main`). **Bookmarklet code change → re-drag needed.**
Owner reported the fluids pop-up still showed **v0.3.5.6 + the blue header** even though
the panel showed v0.3.5.7.

### Root cause
- The live `fluids.html` was already correct (verified via curl: v0.3.5.7, `--hd`/`--grn`,
  graphite header). The culprit: **GitHub Pages serves `fluids.html` with
  `cache-control: max-age=600`** → the browser held the old copy for ~10 min. The
  bookmarklet opened the URL with no cache-buster, so `window.open` reused the stale page.

### Fix (`src/helper.js` → `vehFluidsUrl`)
- Append **`&_=" + encodeURIComponent(BUILD)`** to the fluids URL. Keyed to `BUILD`, so it
  changes every release → after a re-drag the pop-up always loads the fresh page. (Extra
  param is ignored by the page's `qs()`; still **no VIN** in the URL.)

### Verified
- Built bookmarklet: `BUILD` substitutes to `v0.3.5.8-alpha …`; embedded helper has
  `q += "&_=" + encodeURIComponent(BUILD)`; bookmarklet.txt carries the URL-encoded
  `_%3D`. Harness (raw source) → URL ends `&_=__BUILD__` (placeholder, real value in the
  build). `node --check` clean.

### Next
- **Deploy:** commit branch `0.3.5.8` → PR → `main`; confirm live stamp `v0.3.5.8-alpha`.
- **Owner immediate workaround (pre-re-drag):** hard-refresh the fluids pop-up
  (Cmd/Ctrl+Shift+R) or wait ~10 min. After re-dragging the 0.3.5.8 bookmark, the
  cache-buster prevents this going forward.

---

## 2026-06-27 — v0.3.5.7-alpha: fluids page header → new color scheme

Branch **`0.3.5.7`** (off `main`). **Served-page change (`src/fluids.html`) → no
re-drag needed.** Owner: the lookup page header was still VW blue; bring it in line
with the new panel scheme.

### Change (`src/fluids.html`)
- Added `--hd:#1b232b` + `--grn:#2fb84d` CSS vars; header now `background:var(--hd)`
  with `border-bottom:3px solid var(--grn)`, **green wrench** (`header svg` stroke →
  `var(--grn)`), and the version span recolored `#aebfe0`→`#9ba6b2` (neutral grey reads
  better on graphite). **Left `--vw` navy** for the on-white accent text (`.veh .v`
  values, refrigerant `.tag`) — matches the panel's navy text accents, so cohesive.

### Verified (browser preview)
- 2018 Atlas lookup: header computed `bg rgb(27,35,43)` (#1b232b), border `rgb(47,184,77)`
  (#2fb84d), wrench stroke green. Matches the panel. Stamp `v0.3.5.7-alpha`. No console
  errors. Rebuilt.

### Next
- **Deploy:** commit branch `0.3.5.7` → PR → `main` (`git pull --rebase` first); confirm
  live stamp `v0.3.5.7-alpha`. Served change — **no re-drag needed**.

---

## 2026-06-27 — v0.3.5.6-alpha: fluids opens in a sized pop-up window

Branch **`0.3.5.6`** (off `main`). **Bookmarklet code change → re-drag required.**
Owner: the fluids lookup opening as a full new tab was confusing (easy to lose / forget
to close). Wanted a **separate, smaller window** sized so the data fits with **no
side-scrolling** (up/down ok).

### Change (`src/helper.js`)
- The Fluids & Capacities link (`fluidsBar`) now carries `data-act="fluids"`; the
  `[data-act]` click handler gained a **`fluids` case** that `preventDefault()`s and
  opens the URL via **`window.open(url, "hahns_fluids", feats)`**:
  - **Size:** `width=620, height=820`, each clamped to `screen.avail*-40/-80` for small
    screens; **centered** via computed `left/top`. 620px chosen because the lookup page
    is `max-width:580px` + 14px side padding → 620 fits it with room for the scrollbar.
  - **Named window** `hahns_fluids` → a second lookup **reuses the same pop-up** instead
    of stacking windows; `win.focus()` brings it forward.
  - **Fallback:** if `window.open` is blocked/returns null, falls back to a plain tab
    (`window.open(url, "_blank")`). Kept `href`/`target=_blank` on the anchor as a
    no-JS fallback too.

### Verified (browser preview)
- `fluids.html` at **620px viewport**: `horizScroll=false`, `vertScroll=true` (exactly
  the goal); content fills width cleanly; screenshot captured; no console errors.
- Panel harness with `window.open` stubbed: clicking the link calls open with the
  correct URL (`fluids.html?y/m/e/t`, **no VIN**), name `hahns_fluids`, and the
  sized/centered feature string; default navigation prevented. (Width read 580 in the
  preview only because its own screen is 620 → the `availWidth-40` clamp; real monitors
  get the full 620×820.)
- `node --check` clean; rebuilt `v0.3.5.6-alpha`.

### Next
- **Deploy:** commit branch `0.3.5.6` → PR → `main` (`git pull --rebase` first); confirm
  live stamp `v0.3.5.6-alpha`. **Owner: hard-refresh setup page + re-drag** (code change).

---

## 2026-06-27 — v0.3.5.5-alpha: UI cleanup (header color + SCAN button)

Branch **`0.3.5.5`** (off `main`, after v0.3.5.4 merged). **Bookmarklet code change**
(`src/helper.js` CSS + `buildHTML`), so this one **requires a re-drag** (unlike the
data-only fluids work). All in `src/helper.js` + VERSION bump.

### Owner asks (UI polish)
1. **Header blended into ELSA2Go** (both VW blue `#001e50`). → Header is now dark
   graphite **`#1b232b`** with a **green accent bottom border** + **green wrench**
   (`#2fb84d`), so the panel reads as its own overlay against ELSA's blue.
2. **Rename "Scan page" → "SCAN"** (also updated the hint/notice text that named it).
3. **Move SCAN off the header** into its own **`.scanbar`** directly above the job-title/
   New-job row; made it a **large, full-width green button (`#2fb84d`) with black
   text**, `font-weight:800`, 17px.
4. **(follow-up)** Fixed the broken `font:… inherit` shorthand **file-wide** (13
   buttons/inputs: job, newjob, addrow, fluidbtn, confirm, exitbtns, srch, etc.) →
   converted each to explicit `font-family/weight/size` longhands so they all render at
   their intended **weight 600** instead of falling back to 400. Everything looks tied
   together now (verified newjob computed weight = 600).
5. **(follow-up)** Moved the **version bar (`.sub`)** to the very top — directly under
   the title bar (order is now `hd → sub → vbar → fluidbar → scanbar → jobbar → body`).

### Gotcha fixed
- First pass the SCAN button rendered at weight 400. Cause: the file's common
  `font:<weight> <size> inherit` shorthand is **invalid CSS** (CSS-wide keyword
  `inherit` isn't allowed as the family in the `font` shorthand → whole declaration
  dropped). Set `.scan` weight/size/family as **separate properties** instead.
  (The other buttons share this latent quirk but weren't in scope.)

### Verified (browser preview)
- Non-embed harness (seeded a loaded 2019 ATLAS + specs over a VW-blue fake ELSA bg):
  header graphite + green accent, green wrench, SCAN big/green/black above the job bar;
  computed styles confirmed (scanBg `rgb(47,184,77)`, color `rgb(10,10,10)`, weight
  **800**, width full; headerBg `rgb(27,35,43)`, border green). No console errors.
- Setup-page embed demo: SCAN in `.scanbar` (not header), real stamp `v0.3.5.5-alpha`.
- `node --check` clean; rebuilt.

### Next
- **Deploy:** commit branch `0.3.5.5` → PR → `main` (`git pull --rebase` first); confirm
  live stamp `v0.3.5.5-alpha`. **Tell owner to hard-refresh the setup page + re-drag**
  the bookmark (code change).
- Possible follow-on UI polish: the same broken `font:… inherit` shorthand on other
  buttons (newjob/etc.) leaves them at weight 400 — could fix file-wide if desired.
  Mascot art still pending.

---

## 2026-06-27 — v0.3.5.4-alpha: add 2014–2018 fluid data + identity rename

Branch **`0.3.5.4`** (off `main`). Version → `v0.3.5.4-alpha`. Two things:

### GitHub identity rename (`rvanpolen89` → `senditbro`)
- Owner renamed their GitHub account (didn't want their full name on contributions).
  Removed `rvanpolen89` from the project: **`CLAUDE.md`** (2 refs → `senditbro`) and
  **git config** (global + this repo's local): name → `senditbro`, email → the GitHub
  private noreply **`81943271+senditbro@users.noreply.github.com`**. Verified no
  `rvanpolen89` remains in files or any git config scope. Past commits unchanged
  (not rewritten — public `main`). GitHub auto-redirects the old handle.

### Fluids data — 2014–2018 added (lookup now covers 2014–2026)
- **Key finding — the 19 missing years (2000–2018) split into three tiers:**
  - **2014–2018** (5 yrs): modern format, mostly 4-letter engine codes → parse cleanly
    and work with the existing engine-code matching. **Shipped this session.**
  - **2006–2013** (8 yrs): modern table structure BUT **displacement-only** (no 4-letter
    codes; engines shown as `[?]` "2.0L"). Data parses, but `fluids.html` matches by
    engine code → would need a **displacement-based matching fallback** (and confirmation
    of what ELSA shows for old vehicles). **Deferred.**
  - **2000–2005** (6 yrs): **completely different old 2-column** `Component/System |
    Capacity` layout → parser produces empty tables. Needs a **second parser path** plus
    the displacement-matching work. **Deferred** (rarest vehicles).
- **Owner decided: 2014–2018 only this session** (the clean win). Also declined a
  standalone self-service parsing app — the parser regex tuning (needed almost every
  year) is the real bottleneck, not the tooling, so an app wouldn't remove the
  dependency on a developer for new layouts. **Kept current flow.**
- All PDFs (2000–2026) are in `~/Downloads` (gitignored, not in repo). Parsed
  2014–2018 → obfuscated `docs/fluids/<year>.json` + review sheets. **Cleanup:** my
  probe runs had written 2000–2013 JSON into `docs/fluids/`; deleted those (+ dist
  mirror) so only **2014–2026** ship.
- **Verified:** decode round-trip clean for all 5 new years; browser preview —
  **2018 Atlas** (CDVC → oil 5.5 L, coolant 20 L, A/C R1234yf, 09P drivetrain) and
  **2015 Golf** (CXBA → oil 5.7 L, coolant 10 L, R134a 15 g, 02Q 2.3 L) both render
  correctly, no console errors. Same known cosmetic label-wrap class on DSG/AWD-clutch
  secondary rows (values correct — flagged for owner review of the sheets).

### Uncommitted on branch `0.3.5.4` (fold into the deploy commit)
- `CLAUDE.md` (identity), `tools/build.js` (VERSION), `CHANGELOG.md`, this summary,
  `docs/fluids/2014–2018.json` + `dist/fluids/2014–2018.json`, rebuilt `docs/`+`dist/`.

### Next
- **Deploy:** PR `0.3.5.4` → `main` (`git pull --rebase` first); confirm live stamp
  `v0.3.5.4-alpha`. Data-only + version bump — **no bookmark re-drag needed**.
- Later: tackle 2006–2013 (needs displacement matching + a real old-vehicle ELSA
  summary to design against), then 2000–2005 (second parser).

---

## 2026-06-27 — v0.3.5.3-alpha: EV 0MP gearbox detail + recovered 2019 spec

Branch **`0.3.5.3`** (off `main`). Owner follow-up: the EV **0MP** single-speed
gearbox displayed as one garbled line.

### 0MP fix — `tools/parse-fluids.js`
- The 0MP cell holds **two** service scenarios in a cramped 4-column block that
  pdftotext collapses, and the 2nd scenario's spec is **text** ("Up to the lower
  edge…"), not a number, so it was dropped while the 1st scenario's label absorbed
  all the wrapped text. Added `fixEvSingleSpeed()` (post-parse, applied to drivetrain):
  detects the 0MP residue row and rebuilds two clean fills —
  *Refilling transmission that had residue removed* → 3.18 L (3.36 qt), and
  *Transmission fluid drained, residue not removed* → "Up to the lower edge of the
  transmission fluid fill and check hole". Reuses the captured numeric (not
  hardcoded); the text scenario is fixed VW boilerplate. Re-parsed **2025 + 2026**.
- **Verified in browser** (ID.Buzz 2025, t=0MP): drivetrain shows both scenarios
  cleanly; screenshot captured; no console errors.

### Bonus — 2019 AWD-clutch spec recovered
- Re-running the regression check re-parsed the **2019** PDF with the current parser
  and it gained one row the **original** (v0.3.4) parser had dropped: Golf SportWagen
  / Alltrack **Rear Final Drive / AWD Clutch — 655 ml** (the old parser predated
  `ml`-unit support; confirmed against the PDF, line 371). Kept it — strictly better,
  only adds a verified row. 2020–2024 re-parsed byte-identical.

### Deployed
- Version → `v0.3.5.3-alpha`; PR/merge to `main`; live stamp confirmed. Data-only +
  parser-tool change — no bookmarklet re-drag needed.

---

## 2026-06-27 — v0.3.5.2-alpha: electric-vehicle fluids fixes

Branch **`0.3.5.2`** (off `main`). Owner reported EVs broken in the Fluids lookup:
(1) clicking Fluids for an EV said "No fluid entry found"; (2) the Vehicle Summary
didn't pull engine/trans codes for EVs.

### Bug 1 — "No fluid entry found" (model matching) — `src/fluids.html`
- **Root cause:** `pickModel` stripped punctuation from the *table* model token
  (“ID.4”→“ID4”, “ID.Buzz”→“IDBUZZ”) but compared it against the **raw** ELSA model
  string (“ID.4 AWD PRO S”, “ID. BUZZ 1ST EDITION AWD (TWO TONE)”) — so the dot/space
  never lined up → no match. Reproduced in a harness first.
- **Fix:** `modelNorm()` normalizes **both** sides identically (drop the generic word
  “Family”, strip all non-alphanumerics), so “ID.4”↔“ID.4 AWD PRO S”, “ID.Buzz”↔“ID.
  BUZZ …”, and “Atlas Family”↔“ATLAS SEL AWD” all match. Added a small alias so
  **GTI / Golf R** map to the “Golf Family” entry.
- **Bonus:** this also fixed a *latent* break — **2023–2026 “Atlas Family”** never
  matched any ELSA Atlas name (only the older “Atlas / Atlas Cross Sport” did).

### Bug 2 — EV engine/trans not read from Vehicle Summary — `src/helper.js`
- EV summaries list **Front/Rear (E-)Motor Code(s)** and **Front/Rear Trans. Code(s)**
  instead of a single “Engine Code”/“Trans Type”. Added `VEH_LABELS_EV` + `vehFieldAll`
  (collects every matching label, deduped), and `extractVehicle` falls back to these
  when the standard fields are blank → `engine`/`trans` become “FRONT / REAR” (e.g.
  `EAXA / APA`, `0MH / 0MK`). Had to absorb the trailing “(s)” in “Code(s)” so the
  value (next line) is read, not the “(s)”. `isVehicleSummaryPage` now counts the EV
  labels too. **ICE extraction is byte-for-byte unchanged** (verified in harness).

### Drivetrain matching (EV) — `src/fluids.html`
- A vehicle can now carry **multiple trans codes** (`VEH.transCodes`); `transHit`
  matches any of them and also reads **bare** codes from the Application (EV gears are
  written “Single Speed 0MH”, no parens). Added “single speed” to `TRANS_RE` so those
  rows route through trans-matching (with the existing “all shown” fallback). No ICE
  row says “single speed”, so zero ICE risk.

### Verified (browser preview, real data)
- **ID.Buzz 2025** (the reported case): renders — A/C (R1234yf + R744) + Drivetrain
  matched to **Single Speed 0MH** 0.8 L; vehicle bar shows EAXA / APA, 0MH / 0MK · AWD.
  Screenshot captured. No console errors.
- **ID.4 2023** ✓ · **Atlas 2024 (Family)** ✓ (was silently broken) · **Atlas 2019
  ICE** ✓ (regression clean, 09P matched) · **GTI 2025** ✓ (alias works).
- `node --check src/helper.js` clean; rebuilt → `v0.3.5.2-alpha`.

### Next
- **Deploy:** PR `0.3.5.2` → `main`; confirm live stamp `v0.3.5.2-alpha`.
- **Real-ELSA confirm:** the EV Front/Rear label wording is matched defensively
  (e-motor/motor/engine, trans/transaxle/gearbox, optional “(s)”). If a real EV
  summary still shows blank engine/trans, grab a diagnostic dump and tune
  `VEH_LABELS_EV`.

---

## 2026-06-27 — v0.3.5.1-alpha: add 2021–2026 fluid data (+ parser robustness)

Branch **`0.3.5.1`** (off `main`, carries the 2020 work below). Version bumped to
`v0.3.5.1-alpha`. Added the **2021–2026** model years — lookup now covers **2019
through 2026** (8 years). **Note:** new fluid years are *served data*, so techs do
**not** need to re-drag the bookmark to get them; the version bump is just to track
the release.

### 2026 (added after 2025, same branch)
- Parsed `2026 VW Fluid Capacity Tables.pdf` → 7 models (Atlas Family, Golf Family,
  ID.Buzz, ID.4, Jetta, Taos, Tiguan — no ID.7 this year, faithful to the PDF).
  **No parser changes needed** — all engine codes captured, all oil/coolant/AC
  capacities correct; 2025 re-parsed byte-identical.
- **Faithful changes:** Tiguan (RM1) adds a third engine **DYKA** (all 6.0 L) and its
  AWD-clutch fill is now 0.95 L (was 0.75/0.65); Taos (CL2) lists both DYBA + DNKA.
- **Minor cosmetic (engine code correct):** Golf's DZMA desc shows a stray ")"
  ("2.0L )") from a wrapped engine cell. Same EV 0MP messy-label row as 2025.

### 2025 (added after 2024, same branch)

### 2025 (added after 2024, same branch)
- Parsed `2025 VW Fluid Capacity Tables.pdf` → 8 models (Atlas Family, Golf Family,
  **ID.Buzz**, ID.4, **ID.7**, Jetta, Taos, Tiguan). **No parser changes needed** —
  all engine codes captured, all oil/coolant/AC capacities correct; 2024 re-parsed
  byte-identical.
- **Faithful redesigns/new codes:** Tiguan is new — code **RM1** (was BJ2), engines
  **DYLA/DYLB**, oil up to **6.0 L (6.3 qt)**, dual 8-spd autos (09H 7.5 L / 09U
  6.4 L). Taos **CL2** + new engine **DYBA**. Jetta **BU5**, Golf Family **DA1**.
  New EVs **ID.Buzz** (EBJ) and **ID.7** (ED2) join ID.4. Jetta now uses the 09U
  8-spd auto (6.4 L).
- **Messy SECONDARY label to flag in `2025.txt`** (value correct): the EV
  **Single-Speed 0MP** reduction-gearbox row (ID.Buzz/ID.4/ID.7) has a multi-line
  procedural cell ("residue removed" → **3.18 L (3.36 qt)**, captured; plus a
  no-number "fill to the check hole" scenario) whose label absorbed the wrapped
  text. Also the 0MJ range "0.88-0.93 L" shows as "0.93 L". Same dense-table class
  as the Golf/Arteon torque-splitter rows; capacities are present.

### 2024 (added after 2023, same branch)

### 2024 (added after 2023, same branch)
- Parsed `2024 VW Fluid Capacity.pdf` → 7 models (Arteon, Atlas Family, Golf Family,
  ID.4, Jetta, Taos, Tiguan). **No parser changes needed** — all engine codes
  captured, all oil/coolant/AC capacities correct; 2023 re-parsed byte-identical.
- **Faithful changes:** Atlas Family is redesigned — code **CA3/CMD** (was CA2/CMC),
  new engine **DRKB** 2.0L only (the 3.6L VR6 is gone), so its coolant is now ~10 L
  (not 20 L). Most models list both R1234yf and R134a A/C charges. Same dense-table
  drivetrain secondary-label messiness as 2022/2023 (Golf/Arteon torque-splitter).

### 2023 (added after 2022, same branch)

### 2023 (added after 2022, same branch)
- Parsed `2023 VW Fluid Capacity Tables.pdf` → 7 models (Arteon, Atlas Family,
  Golf Family, ID.4, Jetta, Taos, Tiguan). **No parser changes needed** — all
  engine codes captured, all oil/coolant/AC capacities correct. Decode round-trip
  verified.
- **VW PDF typo corrected:** the Golf Front-Axle-Diff-Lock qt value reads
  "(0.6.3 qt)" in VW's PDF — a number can't have two decimal points. Added
  `fixDecimals()` to the parser (collapses a stray middle dot: `0.6.3` → `0.63`),
  so the served value now reads **0.60 L (0.63 qt)**. Generic + durable across
  re-parses; only fires on malformed double-dot numbers (2020–2022 re-parsed
  byte-identical).
- **Faithful PDF quirks (not bugs):** ID.4 model code is now **E81** (was E21);
  Atlas/Golf/Jetta sections are named "… Family"; 2023 lists Tiguan rear final
  drive as a single "0CQ / 0BR" row at 0.9 L (2022 had them split). Jetta/Taos/
  Tiguan now also list an R134a A/C charge alongside R1234yf.
- **Messy SECONDARY labels to flag in `2023.txt`** (values correct): Golf Family &
  Arteon drivetrain torque-splitter / manual-trans rows ("ly Disas- sembled",
  "Clutch Cable (0.4L on each", "Hypoid Chamber (housing let-"). Same dense-table
  class as 2022.

### 2022 (added after 2021, same branch)

### 2022 (added after 2021, same branch)
- Parsed `2022 VW Fluid Capacity Tables.pdf` → 8 models (Jetta/GLI, GTI/Golf R,
  Passat, Arteon, Taos, Tiguan, Atlas/Atlas Cross Sport, ID.4).
- **Critical parser bug fixed — phantom model section.** Taos's engine-oil row
  rendered as `1.5 - DNKA … 4.3 L (4.6 qt)` (the "L" dropped off "1.5L"), so it
  matched `MODEL_HDR` (`^\d+\.\d+\s+ … (CODE)`) — spawning a junk "model" and
  leaving the real **Taos empty** (engine oil lost). Fix: `parsePdf` now rejects any
  candidate header line carrying table data (`VW \d{3}` / `qt` / `\d L (` / `+/-`).
  After fix: 8 models, Taos `[DNKA]` 4.3 L + coolant/AC/drivetrain all present.
- **Verified:** 2020 + 2021 re-parsed **byte-identical** (guard only fires on
  table-data lines). Decode round-trip: Taos DNKA 4.3 L, Tiguan DTEA 5.7 L, Atlas
  DCGA/DTFA + CDVC, ID.4 EV. Built + mirrored `docs/dist/fluids/2022.json`.
- **PDF quirks (faithful, handled by the page):** Tiguan lists coolant application
  as **DGUA** but engine oil as **DTEA** — the page's coolant fallback shows the
  model's coolant row when no engine-code match, so 10 L still displays. Atlas
  model code is now **CA2 / CMC** (was CA1 / CMC).
- **Messy SECONDARY labels to flag in `2022.txt`** (values correct): GTI/Golf R and
  Arteon **drivetrain** rows have scrambled labels from a denser multi-column table
  (e.g. "sembled: 2.30 L", "(6.4 Refill qt): Approximately 6.0 L", torque-splitter
  "Clutch Cable (0.4L on each"). Capacities are present; labels need an owner pass.

### 2021

### What happened
- Parsed `2021 VW Fluid Capacity Tables.pdf` → 8 models (Jetta/GLI, Golf/GTI,
  Passat, Arteon, Tiguan, **Taos** (new), Atlas/Atlas Cross Sport, **ID.4** (new EV)).
- **2021 PDF layout exposed 4 parser gaps — all fixed in `tools/parse-fluids.js`:**
  1. **Bare engine codes.** Arteon ("DLRB") and Taos ("1.5L - DNKA") list the code
     *unparenthesised* in the Engine column, so `codesIn` (parens-only) missed it →
     no engine match. `parseOil` now falls back to a bare 4-letter code (`\b[A-Z]{4}\b`)
     and strips it from the display label. → Arteon `[DLRB]`, Taos `[DNKA] 1.5L`.
  2. **Indented table headers.** ID.4's A/C + Drivetrain header rows are indented;
     the header-finder regex (`^(Engine…|Component…)`) didn't allow leading space, so
     both tables were skipped (ID.4 came out fully empty). Added `^\s*`.
  3. **`ml` units.** ID.4 compressor oil is in `ml` (e.g. "200 +/- 10 ml"); `VAL_RE`
     only knew L/g/cc. Added `ml`.
  4. **R744 refrigerant + E-MOTOR COOLANT.** ID.4 uses R744 (CO2) alongside R1234yf;
     added R744 to the refrigerant tagger. Mapped the EV "E-MOTOR COOLANT" header to
     `engineCoolant` (ID.4's coolant has no numeric value — "refer to manual" — so it
     filters to empty, which is correct).
- **Regression check:** re-ran 2020 after the edits — `docs/fluids/2020.json` is
  **byte-identical** (the new code paths only fire on the 2021-style cases).
- Bumped `VERSION` → `0.3.5.1-alpha`, rebuilt (stamp `v0.3.5.1-alpha · 2026-06-27`),
  reorganized CHANGELOG (marked v0.3.5 released; new v0.3.5.1 "Added" for 2020+2021).
- **Verified:** `node --check` clean; decode round-trip OK (Arteon DLRB 5.7 L, Taos
  DNKA 4.3 L, ID.4 EV oil empty + A/C 4 rows + drivetrain 0MH 0.8 L).

### Known messy labels (values correct — flag for owner review of `2021.txt`)
- **Taos** drivetrain 09S row: label reads "Initial Fill Refill N / A" because the
  PDF's Refill is literally "N/A" (no number) — the **6.3 L initial fill is correct**.
- Same exotic-label class as prior years (Arteon Denso date variants, etc.).

### Next
- **Deploy pending owner OK:** PR `0.3.5.1` → `main` (or commit + `pull --rebase` +
  push). Confirm live stamp `v0.3.5.1-alpha`; new years appear in the lookup.
- More years: same flow, review the gitignored sheet each time.

---

## 2026-06-27 — Add 2020 fluid data (+ parser footnote fix)

Loaded the **2020** model-year fluids so the lookup now covers 2019 **and** 2020.

### What happened
- Ran `node tools/parse-fluids.js "2020 VW Fluid Capacity Tables.pdf" --year 2020`.
  All 8 models parsed (Jetta/GLI, Golf/GTI, Golf R, e-Golf, Passat, Arteon, Tiguan,
  Atlas/Atlas Cross Sport) with **correct capacities/specs throughout**.
- **Parser bug found & fixed:** the 2.0L engine-oil rows had the oil-quality
  **footnote paragraph** ("1) If you must add oil…") bleeding into the engine
  *description* label. `isNoise` caught the footnote's first line but not its
  wrapped continuation lines, so `parseOil` folded them into col1. Fix: `parseOil`
  now **breaks** at the footnote marker (`/^\s*\d\)\s/`) — the footnote always sits
  below the last engine row — so no continuation can leak in. Engine *codes* were
  always clean (matching never broke); this only cleaned the display label.
- Re-ran the parser → all engine-oil labels clean. Built (`node tools/build.js`),
  confirmed `docs/fluids/2020.json` + mirrored `dist/fluids/2020.json`. Decode test
  round-trips (Atlas DCGA 5.7 L / CDVC 5.5 L oil, 20 L coolant). CHANGELOG entry
  added under v0.3.5 (Added).

### Known messy labels (values correct — same exotic cases as 2019)
- **Golf R** compressor-oil rows ("Denso – Note the type plate on I", multiple
  Denso week/date variants) and the `0GC` DSG `+/- 0.1L` tolerance splitting into
  its own fill line. **Atlas A/C** application reads `(CA2)` / `(CMC)` (from the PDF).
  All capacities are right; only some SECONDARY *labels* are cosmetically messy.

### Next
- **Deploy pending owner OK:** commit `tools/parse-fluids.js`, `docs/fluids/2020.json`,
  `dist/fluids/2020.json`, CHANGELOG, this summary → `git pull --rebase` → push.
- More years: same flow, one PDF at a time; review the gitignored sheet each time.

---

## 2026-06-27 — v0.3.4 → v0.3.5-alpha: Fluids & Capacities vehicle-matched lookup

**Current version:** `v0.3.5-alpha` — **DEPLOYED & LIVE** (PRs #20 + #23 merged to
`main`; Pages serving it). The feature the vehicle-init work was groundwork for.
**v0.3.5** is a small post-test polish: moved the Fluids link to directly under the
green vehicle bar (new `fluidsBar(r)`; removed from the body) and gave the lookup
page recognizable system icons (oil can / thermometer / snowflake / gear). Owner
tested the live flow on the shop machine — "looks perfect."

### What it does
Fluids/capacities aren't in the repair manual — they're in a separate per-year VW
PDF. So the panel's **Fluids & Capacities** section is no longer scanned: it's a
**link** (active once a vehicle is loaded) that opens a new window showing Engine
Oil, Engine Coolant, Air Conditioning, Drivetrain — capacities + fluid specs
matched to the loaded vehicle.

### The key architectural unlock
ELSA's CSP blocks the bookmarklet from fetching our data. But the link does
`window.open` to a page on **our** origin → not bound by ELSA's CSP → it CAN load
the data. The bookmarklet itself still makes zero network calls. Only
year/model/engine/trans ride in the URL (**no VIN**).

### Decisions (asked the owner)
- PDF→data = **local Node command** (programmer-only). Display = **capacity + fluid
  spec**. Data protection = **light obfuscation** (key in page; owner accepted it's
  not real security). Show **all** drivetrain sub-fills. Trans match = **prefix**
  (PDF `09P` ⊂ ELSA `09PA`; codes are 3–4 char).

### Built
- **`tools/parse-fluids.js`** — shells out to poppler `pdftotext -layout` (kept the
  project npm-dependency-free), parses model sections → 4 system tables. Handles
  the nasty bits: wrapped engine cells, footnote markers (`001)`), `+/-` tolerances,
  page-break-repeated headers **with shifted columns** (re-reads boundaries each
  header — this fixed the Golf R compressor-oil mangling), page-footer (`N 03.2024`)
  filtering, unicode-hyphen wraps, and the **refrigerant type** (R1234yf/R134a) which
  wraps onto its own line. Emits obfuscated `docs/fluids/<year>.json` + a **plaintext
  review sheet** (gitignored).
- **`tools/fluids-codec.js`** — XOR+base64 light obfuscation (shared key).
- **`src/fluids.html`** → built to `docs/fluids.html` — the lookup page. Matching:
  engine code → oil/coolant; trans-prefix + AWD/FWD → drivetrain; model → A/C.
- **`src/helper.js`** — fluids SECTION now `linkOnly:true` (not scanned, `test`→false);
  `vehFluidsUrl(r)` builds the URL; `buildHTML` renders the link card.
- **`tools/build.js`** — emits + mirrors `fluids.html`/data to dist & docs.
- **`.gitignore`** — `tools/fluids-review/` + `*.pdf` (keep plaintext data / licensed
  PDFs out of the public repo).

### Verified in browser (preview)
- 2019 ATLAS (CDVC / 09PA / AWD): oil **5.5 L · VW 504 00 (0W-30)**, coolant **20 L**,
  A/C **650 g [R1234yf]** + compressor oil 110 cc, drivetrain **09P 7.0 L** + bevel
  box + AWD clutch + rear final drive. All correct.
- **FWD** Atlas → AWD-only drivetrain parts hidden. **Multi-trans** Jetta (t=09S) →
  only the 09S shown (manuals/DSG excluded). No-params → friendly prompt. Panel link
  URL correct (no VIN). No console errors.

### Parser data quality (review sheet)
All 10 models parse; **values correct throughout**. A few exotic SECONDARY rows have
messy *labels* only (Golf SportW `0D9` DSG range values + "Mechatronic Only"; a Golf R
"check the type plate" note) — flagged for the owner's review pass.

### Next session
- **Process more model-year PDFs:** `node tools/parse-fluids.js "<year>.pdf"` → review
  the (gitignored) sheet → the obfuscated `docs/fluids/<year>.json` ships. **Only 2019
  is loaded so far**; other years show "no data published yet" in the lookup.
- **Owner can still review `tools/fluids-review/2019.txt`** against the PDF for the few
  exotic SECONDARY rows flagged (Golf SportW `0D9` DSG range values; Golf R type-plate
  note) — values are correct, labels are messy. Re-run the parser if any need tuning.
- Possible polish: print/copy could mention the fluids lookup; mascot art still pending.
- **Note:** this session's doc updates (this entry) were left uncommitted on `main` —
  fold them into the next commit, as before.

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
