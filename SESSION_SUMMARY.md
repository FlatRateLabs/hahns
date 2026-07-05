# Session Summary

Running log of development sessions. Newest entry on top. See `CLAUDE.md` for the
permanent project reference.

---

## 2026-07-04 — v0.3.16-alpha: built-in tool scan list + tool descriptions (branch `0.3.16`)

Two owner-requested additions on the `0.3.16` branch (alongside the IDB tool-list move + DB rename below).

### 1. Tool descriptions in the "Find these tools" window + printout
- `buildToolMap` now stores the shop list's **description** column (`map[key].desc`) — previously read only
  for status detection, now kept. New `toolDesc(it)` = shop-list desc (preferred) → scanned desc → "".
- **Window** (`buildToolsWindowHTML`) now iterates `r.tools` (not just `toolNums`) and renders a 3-column
  row: **Tool · Description · Location** (+ `TOOLS_WIN_CSS` grid + strike-through includes `.tdesc`). The
  "Not in your list" callout shows each tool's description too.
- **Main print** (`buildPrintHTML`) tools section: chip row of numbers, then a list of **number — description**;
  restructured so tools no longer double-render (dedicated branch, not the generic `li` fallthrough).
- Note: migrated/old shop lists have no stored desc until re-uploaded once (scanned desc shows meanwhile).

### 2. Built-in VW special-tool list baked into the scan (~1,000 tools)
- Owner supplied a master list of **1,022 unique** VW special tools. Stored as `BUILTIN_TOOLS` (a JSON array
  literal, ~10.5 KB) so the scan recognises them **even with no shop list loaded** + catches formats
  `TOOL_RE` misses. `builtinToolDict()` builds two memoised regexes from it:
  - **`reAny`** (936 letter/separator tools) — match anywhere, word-boundaried. Parts split at every
    letter↔digit boundary (`/[A-Z]+|[0-9]+/`) + `BTOOL_SEP` (spaces/dots/dashes/slashes/`+`), so a solid list
    entry `VW771` still matches ELSA's spaced `VW 771`.
  - **`reNum`** (86 bare-integer tools, e.g. `1833`) — **callout-only** per owner's choice (Option 1):
    matches ONLY when dash-wrapped like `-1833-` (leading dash + non-alphanumeric trailing boundary,
    capture group 1 = the number). Keeps ordinary page numbers (torque, years, part fragments) from being
    mistaken for tools.
  - Wired into the scan tools bucket after the shop `toolDict`; existing normTool dedup handles overlaps.

### Verified (node logic harness + browser)
- Matcher: `T10001`/`VAS 6909`/`VW 771` (spaced)/`10-203`/`T 10004` all detected anywhere; `-1833-`/`-3033-`/
  `-10200-` detected as callouts; **bare `1833 Nm` / `3033 times` in prose NOT matched**; `VW 502 00` fluid
  spec **not** mistaken for a tool. Descriptions: shop-list desc preferred, scanned fallback, one `<ul>` for
  tools (no double render). **Browser screenshot** of the "Find these tools" window confirms the 3-column
  Tool/Description/Location layout, sorted by location, with the not-in-list callout showing a description.
- `node --check` clean; built (bookmarklet grew ~11 KB for the built-in list).

---

## 2026-07-04 — v0.3.16-alpha: DB renamed → `hahns_db` (branch `0.3.16`)

**Owner ask (follow-on):** now that the DB holds more than fluids, rename the IndexedDB to `hahns_db`.
**Owner then simplified the ask:** don't bother migrating the day-old `hahns_fluids` fluid data —
it shipped only yesterday (v0.3.15), ~nobody in the 4-person shop has it, and re-loading fluid PDFs
once is trivial. So: **no IDB-to-IDB copy migration** — just use `hahns_db` and drop the old DB.

### What changed (all `src/helper.js`)
- **Constants:** `FLUID_DB="hahns_fluids"` → `APP_DB="hahns_db"`, `FLUID_DB_VER=2` → `APP_DB_VER=1`
  (fresh DB, all five stores `pdfs/parsed/meta/kv/tools` created in one upgrade). Shared-scope vars
  `fluidsDB`/`fluidsIdbOk` → `appDB`/`appIdbOk` (app-wide now). (`openFluidsWindow`'s `"hahns_fluids"`
  is a **window** name, not the DB — left as-is.)
- **No copy migration.** An earlier draft had a `migrateDbRename()` that copied every store out of
  `hahns_fluids` into `hahns_db` and preserved the PDF Blobs — **removed per the owner's simplification.**
  Instead boot does a one-line **fire-and-forget `indexedDB.deleteDatabase("hahns_fluids")`** so only
  `hahns_db` remains (deleting a non-existent DB is a harmless no-op; no guard/flag needed).
- **Kept the lightweight localStorage → IDB migrations** (`migrateLegacyFluids`, `migrateLegacyTools`):
  the **tool list is still in localStorage in production** (since v0.3.10), so `migrateLegacyTools` carries
  it into `hahns_db` with **no re-upload**. Only the fluid PDFs (which lived in the dropped `hahns_fluids`)
  need a one-time re-load in Settings.

### Verified (real-browser IndexedDB harness, Chrome preview)
- Seeded a leftover `hahns_fluids` (with data) + a tool list in localStorage → boot → **only `hahns_db@1`
  remains** (old `hahns_fluids` deleted), **tool list migrated** into `hahns_db` (count 2, correct),
  fluids empty (old DB intentionally not migrated). kv holds `migratedV1`/`migratedToolsV1` (no
  `migratedDbName` — that logic is gone). No console errors. `node --check` clean; rebuilt.
- Net: the tech loses nothing they can't trivially restore — tool list auto-carries, fluid PDFs re-load once.

---

## 2026-07-04 — v0.3.16-alpha: shop tool list → IndexedDB (branch `0.3.16`, NOT yet deployed)

**Owner ask:** now that fluids live in IndexedDB (v0.3.15), move the shop special-tool list there too.
Done — the tool list now lives in the **same `hahns_fluids` IDB** as the fluid tables (one DB, one
connection), off `localStorage`. All in `src/helper.js`. **Bookmarklet code change → re-drag needed.**

### What changed
- **DB `hahns_fluids` bumped v1 → v2**, adding a **`tools` object store** (single record, key `"shop"`,
  shape `{k:"shop", data:{updated,count,file,fmt,map}}`). Upgrade only ADDS a store (`if(!contains)
  create`), so existing fluid data (pdfs/parsed/meta/kv) survives untouched — verified.
- **Sync cache preserved.** `shopTools` is hydrated from IDB at boot (`hydrateShopTools`, folded into the
  existing `fluidsBoot` so the DB opens once), so `loadShopTools()` and every render/match path stay
  **synchronous & unchanged** — same object shape as before.
- **One-time migration** `migrateLegacyTools()` (kv flag `migratedToolsV1`, alongside `migratedV1`):
  copies the old `vwjb_tools_v1` localStorage list into IDB. Legacy key kept as the IDB-unavailable fallback.
- **`saveShopTools(obj)` → async (returns `Promise<boolean>`):** updates the sync cache + invalidates the
  `toolDict` matcher immediately (so the next render shows the new list), then writes IDB; falls back to
  localStorage if IDB is unavailable/write fails. `removeShopTools()` clears cache + IDB `tools` store +
  legacy key. Mapper save call site updated to `.then`.
- Diagnostic dump tags the tool-list backend (`[IndexedDB]` / `[localStorage(fallback)]`). Exposed
  `loadShopTools`/`saveShopTools`/`removeShopTools` on `window.VWJB` for dev harnesses.

### On-architecture / privacy
- Still 100% local, **zero network**, still shop-config lifecycle (NOT cleared by Exit / New Vehicle /
  Clear info — only Settings "Remove list"). No new data leaves the browser; it just moves from one local
  store to another.

### Verified
- `node --check` clean; `window.VWJB` intact (tool fns exposed); built **v0.3.16-alpha** (bookmarklet
  343,746 chars). **Real-browser IndexedDB harness (Chrome preview):**
  - **Migration:** seeded a legacy `vwjb_tools_v1`, ran boot → DB upgraded to **v2**, `tools` store added
    (fluid stores `kv/meta/parsed/pdfs` all still present), legacy list migrated into IDB, sync cache
    hydrated (count/file/fmt/keys correct), `migratedToolsV1` flag set.
  - **Save round-trip:** `saveShopTools` → `true`, cache updated, record read back from a **fresh** DB
    handle (persistence confirmed).
  - **Remove:** cache → null, IDB `tools` store cleared.
  - No console errors.

### Next
- **Deploy:** PR → `main` (branch-protected, merge `--admin`; `git pull --rebase` first); confirm live
  `version.json` = `v0.3.16-alpha`. **Re-drag needed.** Owner: existing tool list migrates automatically
  on first open — no re-upload. Bay-verify: Settings shows the loaded list, "Find these tools" works.
- Optional later: keep the original uploaded CSV/.xlsx as a Blob (like the fluid PDFs) for re-export;
  a Settings "database" line for the tool list too.

---

## 2026-07-04 — v0.3.15.4-alpha: range capacities captured whole (ID.Buzz 0MJ, DSG) — issue #75

**Fixes [issue #75](https://github.com/FlatRateLabs/hahns/issues/75)** — deferred at the close of the
previous session. A drivetrain capacity that's a **range** was half-shown: the low end stranded in the
grey label, only the high end bolded.

### Root cause
`VAL_RE` matched a single `N unit` value, so a cell like `Initial Fill / Refill 0.88- 0.93L (0.93-0.98 qt)`
(2025/26 **ID.Buzz / ID.4 / ID.7 "Single Speed 0MJ"**) matched only `0.93L (0.93-0.98 qt)`; the `0.88-`
low end fell into the label. Same class as the long-standing DSG `6.9 - 7.2 L` nit. Different from the
A/C tolerance saga — that was a `+/-` reassembly; this is a plain `N – M unit` range `VAL_RE` never captured.

### Fix (`src/helper.js` + ported to `tools/parse-fluids.js`)
- **`VAL_RE`** gains an optional leading range prefix `(?:\d[\d.]*\s*[-‐-―−]\s*)?` (any dash variant) so
  the low end is taken as part of the value. Prefix is optional and demands a real dash → `500 +/- 15 g`
  and every plain value are untouched.
- New **`tidyRange()`** in `valuesIn` spaces a glued source cell (`0.88- 0.93L` → `0.88 - 0.93 L`),
  leaving the imperial `(… qt)` parenthetical alone.
- **`MODERN_PARSER_VER` 1.3.3 → 1.3.4** → saved PDFs auto-reparse on next load (no re-upload).

### Verified
- `node --check` clean (both files); built **v0.3.15.4-alpha** (bookmarklet 339,026 chars).
- **Full-pipeline node test** through `parseFluidModels`/`parseCAC` on a synthetic ID.Buzz DRIVETRAIN
  layout: 0MJ → label `Initial Fill / Refill`, value `0.88 - 0.93 L (0.93-0.98 qt)`; DSG `6.9 - 7.2 L`
  captured whole; the 0MH control unchanged.
- **Regression sweep over all 16 gold files (2011–2026):** ran OLD vs NEW `valuesIn` over every stored
  value + every reconstructed `label+value` cell. **0 changes to any of 187 non-range values**;
  **47 range cells corrected** — 4 distinct patterns only, all legitimate (DSG `6.9 - 7.2 L` across
  2011–2016, ID.Buzz/ID.4/ID.7 `0.88 - 0.93 L`). No false positives.
- **Browser (shipped bundle, real Chrome):** `window.VWJB` intact; `parseFluidModels` returns the
  0MJ range value `0.88 - 0.93 L (0.93-0.98 qt)`; no console errors.

### Deploy — DONE + CONFIRMED LIVE (owner, 2026-07-04)
- PR #76 → `main` (admin squash-merge). GitHub Pages had a ~30 min incident today (deploys failed with
  transient "Deployment failed, try again later." then jammed in a queue — normal is ~26 s); an empty
  re-trigger commit (`e6ccae8`) finally published. Live `version.json` = `v0.3.15.4-alpha` confirmed.
- **Owner bay-verified: ID.Buzz "Single Speed 0MJ" now shows `0.88 - 0.93 L` correctly.** Saved PDFs
  auto-reparsed on the re-drag via the `MODERN_PARSER_VER` 1.3.3→1.3.4 bump — no re-upload. Issue #75 closed.
- Couldn't run the real 2025/2026 PDFs end-to-end in-repo (same as prior A/C fixes); owner's live check was the gate.

---

## 2026-07-04 — v0.3.15.3-alpha: e-Golf/Tiguan A/C fix (strip imperial oz)

**Closed the e-Golf A/C edge from v0.3.15.2.** Owner OK'd dropping the imperial ounces entirely
("we use grams in VW"), which is both the cleaner UX and the fix.

### Root cause
e-Golf (2015–2018) + 2017 Tiguan A/C cells wedge the imperial conversion **into the middle** of the
metric value — `Initial 500 +/- (17.6 +/- 0.5 Fill / Refill oz.) 15 g` — so the charge (500) was
stranded in the label and only the tolerance (`15 g`) showed.

### Fix (`parseCAC`, ported to `tools/parse-fluids.js`)
Strip imperial parentheticals before value extraction: `capCell.replace(/\([^)]*(?:oz|fl)[^)]*\)/gi, " ")`.
Removes the `(… oz.)` / `(… fl. oz.)` conversion (A/C is metric) AND collapses the interleave so the
metric value reassembles. **`MODERN_PARSER_VER` 1.3.2 → 1.3.3** → saved PDFs auto-reparse.

### Verified (against the real archived 2011–2026 gold data — 500 A/C fills)
- **36 broken cells fixed**, **0 values still contain oz**, **0 malformed**, **0 regressions**.
  Concrete: e-Golf `500/950/850/450 +/- 15 g`, 2017 Tiguan `460 +/- 15 g` + `110/75 +/- 10 cc`,
  2018 Golf R unchanged (`500/460 +/- 15 g`, `75/110/120 +/- 10 cc`), 2019 e-Golf unchanged
  (`850/430 +/- 15 g`). All ~200 previously-correct cells simply lose their `(… oz.)` suffix (desired).
- `node --check` clean; `window.VWJB` intact; built `v0.3.15.3-alpha`.
- Design decision: strip is **A/C-only** (`parseCAC`), so oil/coolant `(… qt)` imperial is untouched.

### Deploy
- PR #74 → `main` (admin merge); live `version.json` = `v0.3.15.3-alpha` confirmed. **Re-drag needed.**

### CONFIRMED LIVE + session close (owner, 2026-07-04)
- Owner: **2018 e-Golf is perfect** — A/C grams-only correct AND the engine-oil **part numbers** pick
  up correctly. The A/C-format saga (v0.3.15.1→.3) is fully closed across all archived years.
- **Deferred to tomorrow → [issue #75](https://github.com/FlatRateLabs/hahns/issues/75):** drivetrain
  **range** capacities mis-split. Repro: 2025/2026 **ID.Buzz "Single Speed 0MJ"** capacity is a range
  `0.88 – 0.93 L`; the low end (`0.88`) is stranded in the label (grey) instead of the bold value.
  Different class from the A/C tolerance bug — `VAL_RE`/`parseCAC` don't capture a `N – M unit` range.
  Gold data in `tools/fluids-review/gold-2025.json` + `gold-2026.json`; fix + bump `MODERN_PARSER_VER`
  1.3.3→1.3.4, verify vs gold (sweep all years' drivetrain, likely also fixes the old DSG range nit).

---

## 2026-07-04 — v0.3.15.2-alpha: A/C tolerance fix take two (spaced "+ / -" form)

**v0.3.15.1 didn't fully fix it — owner reported the 2018 Golf R A/C capacity still bold-wrong.**
Root cause the first fix missed: the 2018 PDF doesn't use a Unicode `±` (or contiguous `+/-`) — it
renders the tolerance as **three spaced glyphs `+ / -`**. Tell-tale: the rendered *label* in the
screenshot was `Initial 500 + / - Fill / Refill` (spaces around the `/`), and since the label is
just the raw cell minus the value, the raw cell is `Initial 500 + / - Fill / Refill 15 g`. My
v0.3.15.1 reassembly regex (`\+\/-`, contiguous) never matched, and neither did `VAL_RE`.

### Fix
Broaden the source normalization (`parseFluidModels`, ported to `tools/parse-fluids.js`) to collapse
the spaced form to ASCII `+/-` before parsing:
`.replace(/\+\s*\/\s*[-‐-―−]/g, "+/-")` (any dash variant). Then the existing v0.3.15.1 reassembly +
`VAL_RE` work. **`MODERN_PARSER_VER` 1.3.1 → 1.3.2** → auto-reparse re-runs.

### Verified
- Full-pipeline node test (norm → reassemble → VAL_RE → label) on the **spaced** 2018 strings
  (A/C R134a/R1234yf + compressor oils) → all reassemble to `500 +/- 15 g` etc. with clean
  `Initial Fill / Refill` label; contiguous `+/-`, real Unicode `±` (2019 `650 ± 25 g`), and plain
  oil all **unchanged**. Extracted the exact in-file regex and confirmed the Unicode dash class is
  valid + matches. `node --check` clean; built `v0.3.15.2-alpha`.
- **Owner: re-load the 2018 PDF via ⚙ Settings** to force a fresh parse (a pre-v0.3.15 loaded year
  has no saved PDF blob, so it can't auto-reparse until re-uploaded once).

### Gold-data verification (owner said "it worked before the 0W-30 fix")
- Diffed v0.3.13→v0.3.14: the oil fix is **isolated to `parseOil`** — it never touches `parseCAC`,
  `VAL_RE`, the normalization, or section-splitting, so it can't have caused the A/C bug.
- **Ground truth from `tools/fluids-review/gold-2018.json`** (pre-v0.3.13 hand-reviewed data): it
  has the **identical mis-split** — `label:"Initial 500 + / - Fill / Refill"`, `value:"15 g"`. So
  the A/C was **always** mis-parsed (poppler AND the in-app reader); the old hosted page rendered
  label+value **inline** (read fine) while the v0.3.13 window **bolds the value**, exposing it. Not
  a 0W-30 regression — correlation (owner scrutinized the 2018 Golf R during that testing).
- **Ran the v0.3.15.2 pipeline over ALL gold A/C fills (500 across 16 years):** 44 mis-split cells
  reassemble correctly, incl. the **entire 2018 Golf R** (R134a `500 +/- 15 g`, R1234yf
  `460 +/- 15 g`, compressor `75/110/120 +/- 10 cc`) + 2018 Golf/GTI, Passat, Atlas, Tiguan,
  Sportwagen. **No regressions** (contiguous `+/-`, real `±`, plain oils untouched).

### Known remaining edge (follow-up, NOT owner's vehicle)
- **e-Golf (2015–2018)** A/C cells embed an imperial conversion in parens —
  `Initial 500 + / - (17.6 + / - 0.5 Fill / Refill oz.) 15 g` — which the current reassembly regex
  doesn't fully catch (the `(` breaks the label-word group), so the metric value still lands as the
  orphan. Electric-only, rare. Fix later by stripping the imperial `(… oz.)` parenthetical before
  reassembly (verify against gold 2015–2018 e-Golf).

### Deploy
- PR → `main` (admin merge); confirm live `version.json` = `v0.3.15.2-alpha` (DONE). **Re-drag needed.**

### CONFIRMED LIVE (owner, 2026-07-04)
- Owner re-dragged and the **2018 Golf R A/C now reads correctly** — and **without re-loading the
  PDF**. So the auto-reparse fired on its own: the `MODERN_PARSER_VER` bump was detected, the saved
  2018 PDF Blob was re-read in the background, and the corrected values replaced the old ones with
  **zero tech action beyond the re-drag**. First real-world proof the whole v0.3.15 IndexedDB /
  keep-the-PDF / auto-reparse pipeline works as designed. (Owner's 2018 record therefore had a
  saved Blob — they'd re-uploaded it on v0.3.15 earlier, so it wasn't a no-blob migrated year.)

---

## 2026-07-04 — v0.3.15.1-alpha: A/C split-tolerance fix (first live use of auto re-parse)

**First bug found on live v0.3.15 + first real exercise of the new auto-reparse pipeline.**
Owner tested the 2018 Golf R fluids window in the bay: the 0W-30 oil fix (v0.3.14) was
confirmed, but the **A/C + A/C-compressor-oil capacities showed the wrong number in bold** —
e.g. *"Initial 500 +/- Fill / Refill **15 g**"* (real charge 500 g stranded in the grey label,
the ±15 tolerance bolded as if it were the capacity).

### Root cause
On some years' PDFs the A/C capacity cell interleaves the "Initial Fill / Refill" label words
*between* the number and its tolerance, so the cell reads `Initial 500 +/- Fill / Refill 15 g`.
`VAL_RE` (which matches `500 +/- 15 g` only when contiguous) then saw just the orphaned `15 g`;
`500` fell into the label. 2019+ were fine because their cells stay contiguous (`650 +/- 25 g`).

### Fix (`parseCAC`, ported to `tools/parse-fluids.js`)
Before value extraction, reassemble a split tolerance by pulling label words out from between
`N +/-` and the trailing `M unit`:
`capCell.replace(/(\d[\d.]*\s*\+\/-)\s+((?:Initial|Fill|Refill|\/|\s)+?)\s*([\d.]+\s*(?:L|g|cc|ml)\b)/gi, "$2 $1 $3")`.
→ cell becomes `Initial Fill / Refill 500 +/- 15 g` → value `500 +/- 15 g`, label `Initial Fill / Refill`.
**`MODERN_PARSER_VER` bumped 1.3.0 → 1.3.1** so every tech's stored fluid PDFs auto-re-parse on
this update and pick up the fix — no re-upload.

### Verified
- Unit-tested the reassembly against the four exact broken 2018 strings (A/C R134a/R1234yf +
  two compressor oils) → all reassemble correctly; contiguous controls (2019 `650 +/- 25 g`,
  plain oil, `Approximately …`) **unchanged** (no regression). `node --check` both files clean;
  built `v0.3.15.1-alpha`.
- **Browser (real IndexedDB):** a year stored at parserVersion `1.3.0` with a Blob → on boot the
  reconcile detected `1.3.0 ≠ 1.3.1` and **auto-triggered a background reparse**; the (bogus test)
  blob failed to parse and old data was **preserved non-destructively** (`status=reparse-error`).
  A real 2018 PDF would parse & replace the values. No console errors.
- **Not able to run the real 2018 PDF end-to-end** (PDF not in repo). Owner bay-verify the 2018
  Golf R A/C after deploy.

### Deploy
- PR → `main` (admin merge); confirm live `version.json` = `v0.3.15.1-alpha`. **Re-drag needed.**
  On first launch after re-drag, saved PDFs re-parse silently → A/C reads `500 +/- 15 g`.

---

## 2026-07-04 — v0.3.15-alpha: fluid storage → IndexedDB (PDFs kept, auto re-parse, DB info panel)

**Owner-requested production-ready rework of fluid storage.** Goal: stop making techs clear
browser data + re-upload PDFs whenever the parser improves. **Design was proposed + approved
first** (full architecture written out earlier this session), then implemented. All in
`src/helper.js`. **Bookmarklet code change → re-drag needed.** NOT yet deployed (build done,
verified locally; PR pending).

### What shipped
- **IndexedDB (`hahns_fluids`) is now the PRIMARY fluid store**, replacing `localStorage`
  `vwjb_fluids_v1`. Four stores keyed by year: `pdfs` (original PDF **Blob** — now KEPT, was
  discarded), `parsed` (models + parserVersion/family), `meta` (lightweight index: hash, size,
  hasBlob, status, dates, appBuild), `kv` (migratedV1 flag, lastBgUpdate). A **sync in-memory
  projection** (`fluidsData`, unchanged shape) is hydrated from `parsed` at boot so the render
  path (`fluidsBar`/`openFluidsWindow`/`debugDump`) stays synchronous & untouched.
- **Independent parser versioning:** `MODERN_PARSER_VER="1.3.0"` (2011–2026 engine-code) +
  `LEGACY_PARSER_VER="1.0.0"` (2000–2010 displacement — reserved, still not built).
  `familyForYear`/`currentParserVer`. Bump a family's version string → every stored PDF of
  that family auto-re-parses; the other family is untouched.
- **Auto re-parse on boot** (`fluidsBoot` → `reconcileFluids` → `reparseYear`, throttled via
  `requestIdleCallback`): if a year's stored parserVersion ≠ current AND it has a Blob, re-read
  the saved PDF in the background and replace parsed+meta — **no re-upload**. **Non-destructive:**
  a re-parse that throws keeps the old data and sets `meta.status="reparse-error"`.
- **Migration** (`migrateLegacyFluids`, one-time, `kv.migratedV1` guard): converts old
  localStorage years into IDB. They have **no Blob** → marked `hasBlob:false`/`parserVersion:"0"`/
  `status:"stale-no-source"`: usable immediately but can't auto-re-parse until re-uploaded once.
  **Chosen behavior = keep + nudge** (my recommended default; owner dismissed the question).
  Legacy key kept for migration + IDB-unavailable fallback (not deleted).
- **Settings "Fluid database" info panel** (owner mockup): Storage backend, Modern/Legacy parser
  versions, Years installed N/27, PDF storage (Σ blob sizes), Last background update, Status
  (✓ Healthy / ⟳ Updating / ⚠ needs attention). `fluidsInfoHTML`/`fluidsHealth`/`fmtBytesMB`/
  `fmtWhen`.
- **Error handling:** IDB unavailable → falls back to legacy localStorage read (feature still
  works); QuotaExceeded/abort caught; `crypto.subtle` missing → hash skipped. `sha256Hex` stores
  a PDF fingerprint. Copy updated (PDFs "kept only in this browser, never uploaded"). Diagnostic
  dump now reports backend + parser versions + last bg update + reparse errors.

### Size
- Bookmarklet **311 KB → ~336 KB (+~25 KB)** — comfortably within the proven range (the PDF
  reader alone was ~120 KB). **PDFs live in IDB at runtime, add ZERO to the payload.**

### Verified
- `node --check` clean; `window.VWJB` intact; `node tools/build.js` → `v0.3.15-alpha` (bookmarklet
  335,955 chars). **Real-browser IndexedDB harness (Chrome preview):** migration (2015 legacy →
  projection, no-blob/stale-no-source meta), save round-trip (2020 → Blob 40 KB stored, parsed
  tagged modern 1.3.0, projection updated), persistence across DB reopen, and the non-destructive
  reparse-error path (bogus PDF → old models KEPT, status=reparse-error) — **all PASS, no console
  errors.** Settings panel screenshot shows the three sections incl. "Fluid database" rendering
  the info rows.

### Next
- **Deploy:** PR → `main` (branch-protected, merge `--admin`; `git pull --rebase` first); confirm
  live `version.json` = `v0.3.15-alpha`. **Re-drag needed.** Tell owner: existing fluid years keep
  working; re-upload each once to enable automatic parser updates for them.
- When the **legacy (2000–2010) parser** is eventually built, set `LEGACY_PARSER_VER="1.1.0"`+ and
  every legacy PDF auto-re-parses. Optional later: hash-dedupe on re-upload, local export/import.

---

## 2026-07-03 — v0.3.14-alpha: window ✕, overlay-survives-render, oil-wrap fix, magnifier reveal, tool-list dictionary

**Batch of 5 owner-requested UI/bug/enhancement items, shipped together.** All in
`src/helper.js` unless noted. **Bookmarklet code change → re-drag needed.** Deployed via
PR to `main`; loaded tool list + fluid tables are preserved (shop-config localStorage).

### What shipped
1. **Standard ✕ close in the top-right of every window.** Added a corner ✕ to the two
   pop-up windows (`buildFluidsWindowHTML`/`buildToolsWindowHTML` — `id="hb_close"` moved
   out of the `.bar` so the existing `openDocWindow` wiring still works; Print stays) and
   the three shadow-DOM overlays (`openSettings`, `openFluidsConfirm`, `openToolMapper` —
   `.setbox{position:relative}` + `.xclose` absolute; wired to the existing `close`). Settings
   dropped its redundant "Close" button; the two save-flow dialogs keep "Cancel" too.
   `.xclose` hidden in `@media print` for the windows.
2. **Overlays survive a background re-render (bug fix).** The vehicle-bar 3 s auto-collapse
   timer calls `renderInto`, whose `root.innerHTML = …` was wiping any open overlay — so the
   Settings window the fluids button opens (when a year's PDFs aren't loaded) vanished after
   ~3 s. `renderInto` now snapshots open `.setc`/`.exitc` nodes before the rebuild and
   re-appends them after (same nodes keep their listeners). The bar still minimizes.
   Reproduced + fixed in-browser.
3. **2018 Golf R engine oil dropped `(0W-30)` (parser fix).** That oil-type cell wraps 3
   lines; `VW 504 00` ended one line and its `(0W-30)` started the next, landing *after* the
   capacity in the merged `rest` where `SPEC_RE` couldn't reattach it. `parseOil` now keeps a
   `type` accumulator = text before the capacity value (via `rest.match(CAP_RE).index`) and
   pulls specs from that. Ported the same fix to `tools/parse-fluids.js`. **Regression: ran
   all 16 years before/after — exactly ONE entry changed (2018 Golf R gains `(0W-30)`),
   nothing else.** Verified in-browser against the real 2018 PDF via `fluidsFromPdf`.
4. **Magnifier reveals collapsed sections (enhancement).** `highlightOnPage` now calls
   `revealForLocate(el)` first: opens `<details>`, drops `hidden`, and clicks a standard
   `aria-expanded="false"` toggle, walking ancestors + out of nested iframes — then scrolls
   (twice, 350 ms apart, for animated panels) and pulses. Only clicks controls explicitly
   marked as collapsed expanders (won't fire a random/destructive button). Verified against a
   synthetic `<details>` + ARIA accordion. **Needs a real-ELSA bay test** (unknown markup).
5. **Scan uses the uploaded tool list as a dictionary (enhancement, owner's idea).** New
   `toolDict()` builds one big alternation regex from the shop list (`normTool` keys with a
   letter, len ≥ 3; flexible-separator patterns; longest-first so `VW 771/37` beats
   `VW 771`; memoized on `updated|count`). The tools bucket runs it per line and merges hits
   into `entries`. Deliberately **not** a generic "VW ###" TOOL_RE branch (that would grab
   fluid specs like `VW 502 00`). Pure-number keys skipped (torque/part-number collisions).
   Tool dedup switched to `normTool` (`toolKey` + the extract-loop key) so list/scan forms
   unify. Verified in-browser: `VW 771`/`VW 771/37` caught, `VAS 6909` deduped, decoys
   (`VW 502 00`, `771 Nm`) ignored, no-list path unchanged.

### Deploy
- `VERSION` → `0.3.14-alpha`; `CHANGELOG.md` entry (2026-07-03); rebuilt `dist/` + `docs/`.
  **Re-drag required.** Verify live `version.json` = `v0.3.14-alpha`.

### Open follow-ups
- **Bay-test #4 (magnifier reveal)** on a real ELSA special-tool dropdown; if ELSA uses a
  non-standard collapse (custom JS, or a true `<select>` pick-menu), item 5's dictionary
  still catches the tool but the *jump-to* may need the exact markup.
- Item 5: if the owner has **number-only** tools that matter, add a stricter contextual rule
  (only match a bare number next to a "special tool" mention).

---

## 2026-07-02 — v0.3.13-alpha: fluids go fully local (tech-loaded PDFs, nothing hosted)

**MERGED + LIVE** (PR #66 → `main`; live `v0.3.13-alpha` confirmed via `version.json`;
`fluids.html` + `fluids/*.json` now 404 on Pages). **Re-drag needed.** Owner ask: stop
hosting the fluid data on GitHub; instead let techs load the yearly "VW Fluid Capacity
Tables" PDFs themselves (they can all get them easily), converted once and stored on the
shop computer — via the same ⚙ Settings gear as the tool list. (Reason is private —
keep the changelog wording neutral.) **Owner verified it in the bay 2026-07-02 and the
git history scrub was then completed the same day** (see the scrub note at the end of
this entry).

### What shipped (all in `src/helper.js` unless noted)
- **In-browser PDF reader (zero deps, zero network)** purpose-built for this PDF family
  (Antenna House, PDF 1.4, FlateDecode, Type0 fonts, hex Tj/TJ — probed all 16 real PDFs
  first to confirm the profile): object scan + `/Length` stream slicing (`pdfObjects`),
  page order (`pdfPageOrder`), `DecompressionStream("deflate")` inflate (`inflateZlib` —
  zlib, vs the xlsx reader's `deflate-raw`), ToUnicode CMaps (`parseCMap`), exact glyph
  advances from `/W` (`parseWidths`), a content-stream interpreter (`pdfPageRuns`), and
  layout reconstruction (`runsToText`) that emulates `pdftotext -layout` closely enough
  for the ported parser.
- **Parser + matching ported:** `parseFluidModels` (+`parseOil`/`parseCAC`/
  `fixEvSingleSpeed`…) is a near-verbatim port of `tools/parse-fluids.js` (all year-quirk
  fixes kept); vehicle matching (`pickFluidModel`/`transHit`…) ported from the old
  `fluids.html`.
- **Upload flow:** Settings gained a "Fluid capacity tables" section → `pickFluidFiles`
  (multi-select PDFs) → per-file convert → `openFluidsConfirm` preview (year + models
  per file — the tech's eyeball step) → saved to **`localStorage` `vwjb_fluids_v1`**
  (`{updated,count,years:{Y:{models,file}}}`, plain JSON ~20 KB/yr). Shop-config
  lifecycle (NOT cleared by Exit/New Vehicle/Clear info). PDFs themselves not kept.
- **Local fluids window:** `fluidsBar` now has 3 states (no vehicle → grey; vehicle but
  no data for that year → grey CLICKABLE "load PDFs in Settings" → opens Settings; data →
  active). Active button → `openFluidsWindow` (named `hahns_fluids`, 620×820) writes a
  self-contained doc (`buildFluidsWindowHTML`+`FLUIDS_WIN_CSS`, four system cards +
  vehicle card + **Print**/Close) via new shared `openDocWindow` (tools window refactored
  onto it too). Diagnostic dump reports loaded years.
- **Hosted fluids REMOVED:** deleted `src/fluids.html`, `docs/fluids/*.json`,
  `docs/fluids.html`, `tools/fluids-codec.js`; `build.js` no longer emits fluids files.
  `tools/parse-fluids.js` repurposed as the dev-only reference pipeline for NEW years
  (writes plain JSON + review sheet into gitignored `tools/fluids-review/` only).
  Decoded pre-v0.3.13 shipped data stashed locally as `tools/fluids-review/gold-*.json`.

### Debugging trail (for future PDF work)
- Literal NUL bytes accidentally embedded in two JS strings made grep treat helper.js as
  binary — replaced with ` ` escapes.
- PDF device y points UP → sort runs by y DESCENDING; anchor columns at page minX.
- minX must be the leftmost x shared by ≥3 runs: a one-off 24 pt page number sits ~3 pt
  left of the margin (and a sheared slanted "Note" label is excluded via a skew flag) —
  either would shift every line +1 col and break the `^`-anchored model-header regex
  (symptom: only the odd-page models parsed, other models' tables silently merged into
  the previous section).
- `COLW = 4.2` chosen by sweeping 3.8–6.0 against the gold data (4.0–4.8 equivalent).

### Verified
- **Golden diff (the critical gate):** all 16 real PDFs (2011–2026) through the exact
  in-app pipeline vs the decoded, hand-reviewed shipped data → **every capacity, value,
  spec, engine code, model name and row count identical**. Only ~30 diffs, all label-text
  at column boundaries where poppler itself used to split words (gold contains mangles
  like a label of `"itial"`); new output equal or better, including 2 refrigerant tags
  (R1234yf, 2018 Tiguan) the old pipeline missed.
- Lightened bookmarklet payload `node --check`s clean AND runs the pipeline (2019 → 10
  models) — the comment-stripper didn't break the new code. Payload now ~295 KB.
- **Browser (real Chrome DecompressionStream):** fetched the real 2019 PDF →
  `fluidsFromPdf` → 10 models, Atlas CDVC oil 5.5 L, coolant 20.0 L, A/C 650 ± 25 g
  R1234yf (matches the v0.3.4 verification). Non-embed harness: all 3 fluidsBar states,
  Settings shows both sections (tool list + fluid tables w/ Load PDFs), seeded store →
  active button → captured window doc shows vehicle card, all four cards w/ correct
  values + source file name + Print/Close. No console errors. Screenshot captured.

### Git history scrub — DONE (2026-07-02, after owner bay-verification)
- **Backup first:** full `git bundle --all` → `~/Documents/hahns-prescrub-backup-<ts>.bundle`
  (1.1 MB); pre-scrub `main` tip recorded as `af4522c`.
- **Scrub:** `git filter-repo --path docs/fluids/ --path dist/fluids/ --invert-paths --force`
  removed the 32 licensed-VW JSON data files from ALL 108 commits (left the
  `fluids.html`/`fluids-codec.js` code files — our code, no VW data). Re-added `origin`
  (filter-repo strips it), force-pushed the rewritten `main` (senditbro user id `81943271`
  has `always` bypass on the repo's "Permission" ruleset, which blocks force-push/delete/
  create/update for everyone else).
- **Deleted every stale remote branch** (~20: old version + docs branches like `0.3.5.4`
  that still pointed to data-bearing pre-rewrite commits) so only `main` remains — this is
  what makes the old commits unreachable/GC-able.
- **Verified:** a fresh `git clone` from GitHub has **0** `fluids/<year>.json` references
  across all history; only `main`; 0 forks; live site still `v0.3.13-alpha`. Cleaned local
  branches + gc'd local repo too.
- **Caveat told to owner:** GitHub retains now-unreachable objects server-side until its own
  GC runs — reachable only by exact old commit SHA in the meantime. To purge immediately,
  contact GitHub Support to run gc on the repo.
- The real file-picker upload path (FileReader event flow) was covered by the owner's live
  bay test.

---

## 2026-07-01 — v0.3.12.1-alpha: show tool-list file name + format in Settings

**MERGED + LIVE** (PR #64 → `main`; live `v0.3.12.1-alpha` confirmed). **Re-drag needed.**
Owner ask: the Settings status showed only the upload date — add the **file name**, its
**format** (CSV or .xlsx), and the date. All in `src/helper.js`.

### What changed
- **Store `file` + `fmt`** on the saved list (`vwjb_tools_v1` → `{updated,count,file,fmt,map}`).
  `pickToolFile` now passes `{name:f.name, fmt:"xlsx"|"csv"}` as a new `meta` arg through
  `openToolMapper(host,r,options,root,rows,meta)`; the mapper attaches `built.file`/`built.fmt`
  right before `saveShopTools`.
- **Settings status** (`openSettings`) renders the **filename on its own line** (`.setfile`)
  + a **`FORMAT · uploaded DATE`** meta line (`.setmeta`), format label = "Excel (.xlsx)" /
  "CSV". **Legacy lists** saved before this (no file/fmt) gracefully show just the date.
- **Diagnostic dump** reports the file + format too. New CSS `.setfile`/`.setmeta`.

### Verified
- `node --check` clean; rebuilt. **Browser** (seeded `vwjb_tools_v1`, reload to bust the
  `shopTools` module cache): xlsx → "MASTER LIST 2026.xlsx" + "Excel (.xlsx) · uploaded
  2026-07-01"; csv → "shop_tools.csv" + "CSV · uploaded 2026-06-15". No console errors.

### Note for owner
- The name/format appear once the list is **re-uploaded** on the new version — existing saved
  lists show just the date until then (they predate the stored filename).

---

## 2026-07-01 — v0.3.12-alpha: load the shop tool list from a native Excel (.xlsx)

**MERGED + LIVE** (PR #62 → `main`; live `v0.3.12-alpha` confirmed via `version.json`).
**Bookmarklet code change → re-drag needed.** Owner ask: auto-convert a native Excel file
when uploading the shop tool list, instead of "save as CSV first". All in `src/helper.js`.

### What shipped
- **In-browser `.xlsx` reader (zero dependencies, zero network).** An `.xlsx` is a ZIP of
  XML; new self-contained code reads it locally:
  - `unzipEntries(buf, want)` — parses the ZIP **central directory** (reliable even when
    Excel streams entries with data descriptors that zero out local-header sizes), slices
    each wanted entry's compressed bytes. `u16/u32/utf8` helpers.
  - `inflateRaw(bytes)` — inflates via the browser's built-in
    **`DecompressionStream("deflate-raw")`** (`Blob.stream().pipeThrough` → `Response.arrayBuffer`).
    No library, no network. Returns a Promise.
  - `xlsxToRows(buf)` — resolves `xl/sharedStrings.xml`, picks the **first worksheet** via
    `firstSheetPath` (workbook.xml first `<sheet>` → `workbook.xml.rels` `r:id`, using
    `getAttributeNS` on the relationships ns; falls back to lowest `sheetN.xml`), then reads
    each `<row>`/`<c>` into a **dense** 2D string array (`colToIdx` maps `A1`→col; handles
    `t="s"` shared, `t="inlineStr"`, and raw `<v>` numeric/formula-cached). Same shape
    `parseCSV()` returns, so the column-mapper / `buildToolMap` dedup pipeline is **unchanged**.
- **`pickToolFile` branches on extension:** `.xlsx` → `readAsArrayBuffer` → `xlsxToRows` →
  `openToolMapper`; `.csv` unchanged; old binary `.xls` / Apple `.numbers` still get
  "Save the spreadsheet as CSV (or .xlsx) first"; graceful fallback to the CSV message if a
  browser lacks `DecompressionStream` (Chrome/Edge/Safari all have it). `accept` now includes
  `.xlsx`.
- **Settings copy** updated to "a CSV or Excel **.xlsx** file" (+ note wording).

### On-architecture / privacy
- Pure **local** processing (FileReader + native decompression) — **no new dependency, no
  network call on ELSA**. Same posture as the existing CSV read and the print/fluids windows.

### Limitation (surfaced)
- Only modern **`.xlsx`** (2007+), **first sheet**, cached cell values. Old `.xls` binary
  (BIFF) and Apple `.numbers` are different formats we don't parse → still ask for CSV/.xlsx.

### Verified
- `node --check` clean; rebuilt `v0.3.12-alpha`. **Browser unit test** (temporarily exposed
  `xlsxToRows`, then removed the export): built a real **deflated** test `.xlsx` with a
  shared-string table + 3-col layout via Python `zipfile`, fed its bytes to
  `window.VWJB.xlsxToRows` → returned the exact 4 rows, header intact, tool numbers with
  spaces + sub-parts preserved (`VAS 6909`, `10-222 A/1`). Settings overlay shows the new
  copy; no console errors. Downstream mapper unchanged (proven with CSV rows in v0.3.10).

### Next
- **Re-drag** needed (code change). Owner should confirm end-to-end with the real
  **MASTER LIST 2026 `.xlsx`** (multi-sheet? header not on row 1? the mapper already handles
  those, but worth a live check) and a VW `.xlsx` if he has one.

---

## 2026-07-01 — v0.3.11-alpha: SCAN works without a vehicle; fluids gated + discoverable

**MERGED + LIVE** (PR #55 → `main`; live `v0.3.11-alpha` confirmed via `version.json`).
**Bookmarklet code change → re-drag needed.** Owner ask: it was frustrating to be inside
a repair manual, want to use Hahns, and be forced back to the Vehicle Summary page before
you could scan. Removed that gate. All in `src/helper.js`.

### What changed
- **SCAN no longer requires a loaded vehicle.** `scan()` previously blocked any non-Vehicle-
  Summary page with a `vehNotice` ("This isn't the Vehicle Summary page…") and collected
  nothing until a vehicle was loaded. Now: scanning the **Vehicle Summary** still loads the
  vehicle (VIN gate unchanged — a stray header VIN on a repair page still won't seed one)
  and returns (no specs there); scanning **any other page** collects its specs immediately,
  vehicle or not.
- **Loading the vehicle is now needed ONLY for Fluids & Capacities.** `fluidsBar()` used to
  return `""` (nothing) with no vehicle; now it renders a **greyed, non-clickable
  placeholder** — `.fluidbtn.off` — "Fluids & capacities — scan Vehicle Summary to enable",
  so the feature stays discoverable. The real clickable link (with `data-act="fluids"`, no
  VIN in URL) still only appears once a vehicle is loaded.
- **Reworded prompts** (vehicle now optional): the empty vehicle bar ("Scanning a repair
  page works right away. To also use Fluids & Capacities, open ELSA's Vehicle Summary…")
  and the empty-panel hint ("Open a repair procedure and click SCAN… Want Fluids &
  Capacities too? Scan… Vehicle Summary first."). On a successful summary scan `vehNotice`
  now confirms "Vehicle loaded — Fluids & Capacities is now available."
- New CSS: `.fluidbtn.off` (grey bg/text, `cursor:default`, grey droplet).

### On-architecture
- No new storage, **zero network**, no privacy change. Pure gate-removal + render tweaks.

### Verified
- `node --check` clean; rebuilt `v0.3.11-alpha`. **Browser (non-embed render harness):**
  (a) specs render with **no vehicle** (no blocking hint); (b) fluids placeholder is `.off`,
  has no href, `cursor:default`, grey; (c) loaded vehicle → clickable `<a data-act="fluids">`
  with params + **no VIN**; reworded bar/hint text confirmed. No console errors; screenshot
  captured. Live `version.json` = `v0.3.11-alpha`.

### Next
- **Re-drag** needed (code change) — tell the owner to hard-refresh the setup page + re-drag.
- Follow-ups still open from v0.3.10: confirm shop-tool matching against real ELSA tool
  numbers; optional native `.xlsx` upload.

---

## 2026-06-30 — v0.3.10.1-alpha: minimized panel shows SCAN (not New Vehicle)

Tiny owner-requested UI tweak (same night as v0.3.10). **Bookmarklet code change →
re-drag.** The minimized panel was showing the **New Vehicle** button; the owner wanted
**SCAN** there instead (collapse the panel and still scan in one click). One CSS line in
`src/helper.js`: the `.wrap.min` hide-list now hides `.topbar` (New Vehicle) and no longer
hides `.scanbar`; added `.wrap.min .scanbar{padding:11px 13px}` so it sits cleanly as the
lone element under the header. **Verified** in the browser (non-embed harness, minimized
state): minimized = header + green SCAN, New Vehicle hidden, no console errors. Built
`v0.3.10.1-alpha`.

---

## 2026-06-30 — v0.3.10-alpha: shop special-tool list ("Find these tools")

Work on `main` (uncommitted as of writing). **Bookmarklet code change → re-drag needed
once deployed.** Big new owner-requested feature: techs upload their shop's special-tool
list (CSV) and Hahns shows **where each tool lives** + flags problems. All in
`src/helper.js`.

### What it does
- **⚙ Settings gear** (new, in the panel header, non-embed only) → upload / replace /
  remove the shop tool list. Shows "Tool list loaded: N tools · uploaded DATE".
- **Column-mapper overlay** on upload: a preview table with a dropdown per column
  (Tool number / Description / Drawer location / Not used), **auto-guessed** from the
  header, with mutual-exclusion + last-column auto-fill (the owner's requested flow).
  Handles **any layout** — the owner's 3-col `TOOL# / DESCRIPTION / DRAWER#` AND VW's
  4-col minimum-index (`Order Number` auto-dropped as "Not used").
- **"Find these tools" opens a separate, printable WINDOW** (owner's follow-up — keep the
  main panel uncluttered, mirror the fluids pop-up). `openToolWindow` opens/reuses a named
  window and **writes a self-contained doc locally** (`buildToolsWindowHTML` +
  `TOOLS_WIN_CSS`). **Tick-off list** (2nd owner follow-up): one row per tool =
  `<label>`(checkbox + **tool number on the LEFT** + **location on the right**), sorted by
  drawer (`locSort`) then tool#, with a **pure-CSS strike-through on `input:checked`** (no
  JS; prints as an empty box for paper crossing-off). Flagged tools get an inline amber tag;
  a "Not in your list" callout lists unmatched tools. Its own **Print** button (clean, like
  the main Hahns print; buttons hidden in `@media print`). **No network** (same idea as the
  print iframe); Print/Close also wired from the opener so they work regardless of the
  child window's CSP.
- **Main panel = alerts only.** Each tool shows a small badge **only when there's a
  problem**: amber `toolStatus()` flag (MISSING / CHECK PART NUMBER / broken) or red "not
  in list". **No location badges inline**, and locations are **not** in the main
  `Copy list` / `Print` — the window owns locations.

### How it stays on-architecture (privacy)
- Stored in **`localStorage` `vwjb_tools_v1`** (shop config, persists across sessions on
  that machine; **NOT** cleared by Exit / New Vehicle / Clear info — only by "Remove
  list"). The shop's own data, never VW/ELSA manual content, **never uploaded / never on
  GitHub**. Reading the picked file is a **local FileReader read, not a network call**, so
  the **zero-network-on-ELSA rule is intact**.
- **Matching:** `normTool()` strips to alphanumerics + uppercases BOTH sides → ELSA's
  `VAS 6909` ↔ sheet `VAS6909`, `10-222 A/10` ↔ `10-222A/10`; sub-parts stay distinct.
- **CSV:** `parseCSV` is a real RFC-4180 reader (quoted fields w/ embedded commas + `""` —
  both real files need it). `findToolHeader` locates the header row (skips `Table 1` /
  `Print Date` junk); `buildToolMap` dedupes by `normTool`.

### New code (all `src/helper.js`)
- State: `TOOLS_KEY`, `shopTools` cache. Data/match: `normTool`, `todayISO`,
  `load/save/removeShopTools`, `matchShopTool`, `toolStatus`, `parseCSV`, `findToolHeader`,
  `guessToolRole`, `buildToolMap`, `locSort`. Render: `toolBadge` (alert-only inline),
  `buildToolsWindowHTML` + `TOOLS_WIN_CSS` (the printable tick-off window doc),
  `openToolWindow`. UI: `flash`, `pickToolFile`, `openSettings`, `openToolMapper`. Wiring:
  `GEAR` icon + header button, `data-act="settings"`/`"findtools"`, tools-section render +
  button, `debugDump` line, panel CSS. `.xlsx` upload is politely refused ("save as CSV
  first") — native xlsx is a later option.

### Verified
- `node --check` clean. **Node logic harness against BOTH real files:** owner's
  `MASTER LIST 2026` → header row 1, roles auto `[num,desc,drawer]`, **1018 tools**, MISSING
  flags captured; VW `vwMinimumIndexes` → header row 4, `Order Number` auto-`ignore`, roles
  `[ignore,num,desc,drawer]`, **554 tools**. ELSA-style space/spelling variants match;
  unmatched → "not in list"; CSV quoting correct.
- **Browser (non-embed harness):** gear → settings overlay (loaded count + Remove/Replace);
  inline alerts render (MISSING / not-in-list only, no location badges); **"Find these
  tools" pop-up** renders a clean Location→Tools table (numeric drawers first, then text),
  "Check before you go" + "Not in your list" callouts, Print/Close buttons, vehicle + job
  header; column-mapper for the 4-col sheet auto-maps `[ignore,num,desc,drawer]`,
  mutual-exclusion + Save validation (missing num/drawer → error) + successful Save all
  work. **No console errors.** Built `v0.3.10-alpha`.

### Next
- **Deploy:** PR → `main` (`git pull --rebase` first); confirm live stamp `v0.3.10-alpha`.
  **Re-drag needed** (code change). Tell owner: load the list via the gear once per shop
  computer (save the spreadsheet as CSV first).
- **Open questions for the owner:** confirm matching against a few REAL ELSA tool numbers
  (spelling alignment); more status keywords to flag if his sheets use others; possible
  later add: native `.xlsx` upload so no Save-As-CSV step.

---

## 2026-06-29 — v0.3.9-alpha: Hahns mascot artwork + favicon

**MERGED + LIVE** (PR #46 → `main`; live `v0.3.9-alpha` confirmed). **Bookmarklet code
change → re-drag needed.** Owner supplied ChatGPT-generated mascot art; replaced the
wrench icon everywhere with **Hahns**.

### Source art
- Owner first sent a poster sheet (hero + 8 poses) on a dark background. My first attempt
  to cut out the hero via **flood-fill knockout failed** — a dark silver figure on a dark
  background, so it ate his thin arms/hands/foot. **Lesson: don't chroma-knock-out
  dark-on-dark renders.** Owner then provided a clean **transparent-background PNG**
  (`~/Downloads/Hahns No Background.png`, 500×800 RGBA) — used that, no knockout needed.

### Assets (new — `src/assets/`, masters committed)
- `hahns.png` — full-body, 325×520, web-page hero.
- `favicon.png` — 64px square **bust** (head + wave); used as the served favicon AND the
  drag-button + fluids-page header icon.
- `apple-touch-icon.png` — 180px square bust.
- `hahns-icon.png` — 64px square bust, **base64-embedded into the bookmarklet**.
- Owner picked the **bust** framing for all small/square spots (full body is an
  unreadable speck at 16–32px); full body only on the web hero.

### Wiring
- **`helper.js`:** `var WRENCH` (header path) → **`var HAHNS_ICON = "__HAHNS_ICON__"`**;
  header renders `<img class="brand" src=HAHNS_ICON>` (CSS `.hd img.brand{width:30px;
  height:30px}`). Reads great on the dark `#1b232b` header.
- **`build.js`:** base64-encodes `src/assets/hahns-icon.png` → `data:` URI, replaces
  `__HAHNS_ICON__` (keeps the bookmarklet **self-contained / zero network** — mandatory on
  ELSA). Also copies the 3 served PNGs into `docs/` + `dist/`.
- **`template.html`:** header wrench → full-body `hahns.png` (92px); drag button wrench →
  `favicon.png` bust; favicon + apple-touch `<link>`s; "wrench" wording → "Hahns".
- **`fluids.html`:** header wrench → `favicon.png` bust; favicon `<link>`s.
- Embedded icon adds ~9.5 KB base64 → bookmarklet ~177 KB (fine for bookmark URLs).

### Bookmark-icon caveat (told owner)
- `javascript:` bookmarklets can't reliably carry a custom icon. The lever we control is
  the **setup-page favicon**, which Chrome often inherits onto a dragged bookmark — best
  shot, not guaranteed. Verify by re-dragging after deploy.

### Verified (browser preview, `node --check` clean, built v0.3.9-alpha)
- Setup page: full-body Hahns in header + bust on the navy drag button. Panel demo: bust
  on the dark header (embedded data URI, **no network**). Fluids page: bust in header,
  2019 ATLAS data correct (oil 5.5 L, coolant 20 L, A/C 650 g R1234yf, 09P 7.0 L). No
  console errors. **Preview gotcha:** serve.js maps `/`→`dist/HAHNS.html`, so relative
  PNGs only resolve at `/dist/HAHNS.html` (prod `docs/` has them as siblings — fine).

### Outcome / bookmark-icon finding
- Deployed and verified live (pages + tab favicon show Hahns; panel mascot embedded).
- **Bookmark-bar icon stays the default globe** — confirmed on owner's Chrome. A
  `javascript:` bookmarklet has no page for Chrome to pull a favicon from, so the site
  favicon applies to the tab but NOT the dragged bookmark. **Settled — no page-side fix**
  (recorded in CLAUDE.md Known Constraints). Bookmark is labeled "H.A.H.N.S".
- Owner showing it to the crew tomorrow (2026-06-30) for feedback. Re-drag = the only
  step techs need. Easy rollback via `git revert` of the merge if feedback is negative.

---

## 2026-06-29 — v0.3.8-alpha: fluid data 2011–2013 + parser fixes

Branch **`0.3.8`** (off `main`). **Data + parser-tool only — NO bookmarklet change, no
re-drag.** Extends fluid lookup coverage down to 2011.

### Findings (the old "2006–2013 deferred" note was partly wrong)
Probed the 2000–2013 PDFs with the current parser:
- **2011–2013** — modern layout WITH 4-letter engine codes → engine-code matching works.
  **Shipped.**
- **2006–2010** — modern layout but **displacement-only** engines ("2.0L", `[?]` codes) →
  can't engine-code-match; needs a displacement fallback in `fluids.html`. **Deferred.**
  (2009 is mixed 3-coded/14-disp — also deferred.)
- **2000–2005** — old 2-column `Component/System | Capacity` layout, displacement-only →
  needs a second parser path + displacement matching. **Deferred.**

### Parser fixes (`tools/parse-fluids.js`)
1. **Unicode `±` tolerance.** Older PDFs (≤~2017) write "525 ± 25 g" with the Unicode ±;
   `VAL_RE` only knew ASCII "+/-", so it captured the *tolerance* ("25 g") not the charge.
   Normalized `±` → " +/- " at the source. **This also corrected 2014–2017** (which had
   shipped with the wrong A/C grams — those 4 JSONs are re-emitted; 2018–2026 byte-identical).
2. **Maintenance-Schedule cut.** The 2010 PDF appends a "Maintenance Schedules" section
   (section 2) whose numbered sub-sections looked like model headers → 20 phantom "models".
   `parsePdf` now truncates at the first NUMBERED `Maintenance Schedule` heading (TOC "⇒"
   lines ignored). 2010 → 9 models (it's still deferred for being displacement-only, but
   the fix is general/safe; other years unaffected).

### Shipped data
- **New:** `docs/fluids/{2011,2012,2013}.json`. **Corrected:** 2014–2017 (A/C charges).
  2018–2026 unchanged. Removed the 2006–2010 probe JSONs so only matchable years ship.

### Verified
- 2006–2013 re-parsed: model counts sane (6–9), 2008 matches its TOC exactly, 2011–2013
  fully coded. 2018–2026 byte-identical (no regression). **Browser:** 2013 Golf (CBFA /
  02Q) lookup renders Oil 4.6 L · VW 502 00 (5W-40), Coolant 8.0 L, A/C 525 ± 25 g R134a +
  compressor oils, Drivetrain 02Q 2.3 L + bevel box + rear final drive. Stamp v0.3.8-alpha,
  no console errors. Known cosmetic (values correct): DSG range labels "6.9 -: 7.2 L".

### Next
- **Deploy:** PR `0.3.8` → `main`; confirm live `v0.3.8-alpha`; 2011–2013 appear in lookup.
  **No re-drag** (served data).
- Later: displacement-based matching in `fluids.html` (unlocks 2006–2010, needs to know what
  ELSA shows for old vehicles), then the 2000–2005 second parser path.

---

## 2026-06-29 — v0.3.7.2-alpha: button reword/rearrange + fast tooltips

Branch **`0.3.7.2`** (off `main`). **Bookmarklet code change → re-drag needed.** Owner
found the New job / Clear info naming + placement confusing. All in `src/helper.js`.

### Changes
- **"New job" → "New Vehicle", moved to the TOP.** It wipes everything *incl.* the
  vehicle, so it now lives in a new `.topbar` directly under the version `.sub` bar
  (full-width outline button + `RESTART` refresh icon). Internally still
  `data-act="newjob"` → `options.onNewJob`; confirm reworded to "New vehicle? Clears all."
- **"Clear info" → "Clear All Info".** Stays next to the job-title input (jobbar back to
  a single centered row; the `.jobbtns` column from v0.3.7.1 removed). Confirm → "Clear
  all info?".
- **Fast tooltips.** Native `title` has a ~1 s delay we can't shorten, so `[data-tip]`
  elements now get a quick (~180 ms) JS tooltip: one shared `.tip` bubble appended to
  `.wrap` (not the scrolling body, so it's not clipped), positioned above the element
  (flips below near the top edge), horizontally clamped to the panel. Applied to New
  Vehicle, SCAN, Clear All Info, and per-group Clear (their `title` → `data-tip`). Other
  elements keep native `title`.

### Verified (browser, non-embed harness)
- Child order `hd → sub → topbar(New Vehicle) → vbar → fluidbar → scanbar → jobbar →
  body → ft → toast → tip`; New Vehicle in topbar with icon + correct label, no stray
  `title`; Clear All Info in jobbar; old "New job" gone. Hovering New Vehicle shows the
  `.tip` (on, opacity 1, correct text, positioned + width-clamped) after ~180 ms.
  New Vehicle click → inline confirm "New vehicle? Clears all." → No restores button,
  job preserved. Screenshot captured; no console errors. `node --check` clean; built
  `v0.3.7.2-alpha`. (topbar/vehicle bar still hidden in embed/demo mode.)

### Next
- **Deploy:** PR `0.3.7.2` → `main`; confirm live stamp `v0.3.7.2-alpha`. **Re-drag needed.**

---

## 2026-06-28 — v0.3.7.1-alpha: Clear info + per-group clear

Branch **`0.3.7.1`** (off `main`). **Bookmarklet code change → re-drag needed.** Owner
request: a way to clear collected data without losing the vehicle, plus per-section clears.

### What shipped (all in `src/helper.js`)
- **"Clear info" button** under New job (`data-act="clearinfo"`, red-tinted `.clrinfo`,
  in a new `.jobbtns` column; shown only when `hasInfo`). Clears every SECTION array +
  `__images` + `__title` but **keeps `__vehicle`** (and so the fluids link). New job
  still wipes everything incl. the vehicle.
- **Per-group Clear** in each section header + the Diagram header (`.clrsec`,
  `data-clear="<key>"` / `data-clear="__images"`; rendered only when the group has
  items). Empties just that group.
- **Inline confirm** — new reusable `inlineConfirm(btn, msg, onYes)` in `renderInto`
  (swaps the button for the existing `.confirm` Yes/No). Both Clear info ("Clear
  collected info?") and per-group ("Clear all?") confirm first, so a stray tap is safe.
- Also flipped the **v0.3.7 changelog heading** to `2026-06-28` (v0.3.7 deployed).

### Layout notes
- `.jobbar` now `align-items:flex-start`; the right side is a `.jobbtns` column
  stacking New job over Clear info. `.clrsec` is a small grey text button after the
  count (`.st .confirm{text-transform:none}` so the inline confirm reads normally).

### Verified (browser, non-embed harness w/ seeded vehicle + specs + diagram)
- Clear info present under New job; per-group Clear on torque/replace/tools/warnings/
  diagram. Per-group clear (torque): confirm → Yes empties **only** torque, others +
  vehicle intact, persisted. Clear info: confirm → Yes clears all items + diagrams +
  title, **vehicle bar + fluids link kept**, button disappears (hasInfo false).
  Screenshot captured; no console errors. `node --check` clean; built `v0.3.7.1-alpha`.

### Next
- **Deploy:** PR `0.3.7.1` → `main`; confirm live stamp `v0.3.7.1-alpha`. **Re-drag needed.**

---

## 2026-06-28 — v0.3.7-alpha: collapsible vehicle bar (+ v0.3.6 deployed)

Branch **`0.3.7`** (off `main`). **Bookmarklet code change → re-drag needed.** Two items:

### 1. Follow-up: flipped the v0.3.6 changelog heading
- `v0.3.6-alpha — in progress` → `— 2026-06-28` (the merge-day convention). v0.3.6
  (locate-on-page magnifier) is **merged + LIVE** (PR #38).

### 2. New feature — collapsible green vehicle bar (owner request)
Reclaims vertical space. The green "Vehicle loaded" strip **auto-collapses to one line
~3 s after it first appears**, with a chevron to expand for edits.
- **State:** `sessionStorage["vwjb_vehexp_v1"]` — `null` (never set) → render expanded +
  arm a one-shot 3 s auto-collapse; `"1"` expanded; `"0"` collapsed. Helpers
  `vehExpState()`/`setVehExp()`; `vehAutoArmed` (per-load) so the timer arms once;
  `vehCollapseTimer` + `cancelVehAuto()`.
- **`vehicleBar(r)`:** collapsed branch renders just `✓ Vehicle loaded` + a `.vmiss`
  "N to add" tag when fields are blank + a `data-act="vehexpand"` chevron; expanded
  branch keeps the 5-field grid + a `data-act="vehcollapse"` chevron. Head label
  wrapped in `.vheadl`; toggle is `.vtog` (`CHEV_DOWN`/`CHEV_UP` icons).
- **Wiring:** `[data-act]` handler gained `vehcollapse`/`vehexpand` (cancel auto + set
  state + re-render). `renderInto` arms the 3 s timer (guarded: not embed, vehicle
  loaded, not minimized, state null, not already armed). Clicking a `.vval` to edit
  **cancels the auto-collapse and pins expanded** so it can't fold mid-edit. Exit now
  also clears `vwjb_vehexp_v1`.
- Print/copy/diagnostic show the full vehicle regardless (collapse is UI-only).

### Verified (browser, non-embed harness)
- Fresh state → **expanded** (5 fields, collapse chevron). Auto-collapsed to one line
  after 3 s. Toggle works both ways (collapse → one line "Vehicle loaded" + expand
  chevron; expand → grid back). Blank fields → collapsed strip shows **"2 to add"**.
  Screenshots of both states captured; no console errors. `node --check` clean; built
  `v0.3.7-alpha`.

### Next
- **Deploy:** PR `0.3.7` → `main`; confirm live stamp `v0.3.7-alpha`. **Re-drag needed.**

---

## 2026-06-28 — v0.3.6-alpha: locate-on-page magnifier (NOT yet deployed)

Branch **`0.3.6`** (off `main`). New owner-requested feature. **Bookmarklet code
change → re-drag needed once deployed.** Built + browser-verified; **deploy pending
owner OK** (PR not opened yet).

### What it does
Each populated item (torque, replace, special tools, warnings) now shows a small
**magnifying-glass on its left**. Clicking it **scrolls ELSA to the exact element**
Hahns read that item from and **pulses it yellow** (then fades, fully restoring the
page). Asked the owner two choices: **pulse-then-fade** highlight, **grey-out** the
magnifier for off-page items.

### How it works (key design — keeps the privacy posture)
- `gatherSegments` now records, per segment, the **DOM element** the line's text
  starts in (`add(text,bold,el)` → `cur.el = node`).
- An **in-memory registry** (`locMap`, module scope) maps a per-load id → element.
  `registerLoc(el)` is called at each item-push in `extractSegments`; the id rides on
  the item as `it.loc`. **Never serialized** — DOM nodes can't be saved and we keep
  nothing on disk. `mergeInto` was updated to carry `loc` through (it rebuilds items
  field-by-field, so it'd otherwise drop it).
- A per-load **`LOC_NONCE`** prefixes every id. After navigation the script reloads
  (new nonce, empty `locMap`), so a `loc` from a **previous page** can't resolve →
  that item's magnifier renders **greyed** (`.find.off` + tooltip "Found on another
  page…"); the click handler no-ops on `.off`. Items with no source element
  (hand-added rows, the Fluids link) get **no** magnifier.
- `highlightOnPage(el)`: `scrollIntoView` (plus the element's iframe, if nested) +
  a JS pulse using **inline `!important`** styles (so ELSA's own CSS can't suppress
  it), tracked by `hiState` so a new click cancels/restores the prior one. Fully
  reversible (`removeAttribute("style")` / restore prior inline style). **No network.**

### The one real limitation (told the owner up front)
Only items on the **page currently on screen** can be jumped to — navigating away
destroys that page in the browser, so earlier multi-page-job items grey out. Not
fixable without saving ELSA pages (would break "keep nothing").

### Verified
- `node --check` clean. Logic harness: items carry resolvable `loc`; **paste/text
  path → `loc:""`** (no magnifier in the setup demo); `mergeInto` preserves `loc`.
- **Browser (non-embed harness, real-DOM scan over a fake ELSA page):** scan produced
  4 items each with a magnifier, 0 greyed; clicking each scrolled to and yellow-pulsed
  the **correct** element (torque→spec, replace→replace line, tool→tool line,
  warning→warning line), highlight applied with `!important` then **self-restored**;
  greyed state shown for a simulated previous-page item (correct tooltip, click no-op);
  no-source item → no magnifier. No console errors. Screenshot captured.

### Files
- `src/helper.js` (registry + highlight engine, `gatherSegments`/`extractSegments`/
  `mergeInto` loc threading, `GLASS` icon, `.find` CSS, `itemRow` button, `.find`
  click handler), `tools/build.js` (VERSION → `0.3.6-alpha`), `CHANGELOG.md`, rebuilt
  `dist/` + `docs/`.

### Next
- **Deploy pending owner OK:** PR `0.3.6` → `main` (`git pull --rebase` first); confirm
  live stamp `v0.3.6-alpha`. **Bookmarklet code change → owner must hard-refresh the
  setup page + re-drag.**

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

### RESOLVED (owner-verified on v0.3.5.12)
- Component **24 (Alignment Pin)** no longer gets the
  "Cylinder Head – Tightening Specifications and Sequence" title as a spec — it isn't
  populated at all, which is correct (a pin has no torque spec). The v0.3.5.12 title
  detector *consumes* the heading line instead of letting `SEQ_REF_RE` attach it to the
  last component. Owner confirmed in the bay. No further action.

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
