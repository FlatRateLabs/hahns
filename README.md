# H.A.H.N.S

**H**ardware, **A**dvisories, **H**ighlights, & **N**avigation **S**pecialist (mascot: "Hahns")

A no-install browser helper for VW technicians. It reads the repair procedure
you already have open in ELSA (via vw-now.com) and lists the things you need for
the job — torque specs, one-time-use parts, fluids & capacities, special tools,
and critical warnings — then keeps nothing.

It ships as a **bookmarklet** (just a bookmark) so there's nothing to install.

## Get it / share it
Live setup page: **https://rvanpolen89.github.io/hahns/**

Send techs that link. They open it, drag the **H.A.H.N.S** button to their
bookmarks bar, and they're done — nothing installs.

## Shipping an update
1. Edit `src/helper.js` (or `src/template.html`).
2. `node tools/build.js` — regenerates `dist/` and `docs/` with a fresh build stamp.
3. `git commit -am "..." && git push` — GitHub Pages redeploys in ~1 minute.
4. Tell techs to **re-drag** the bookmark from the link (the panel's build stamp
   confirms they have the latest).

## Privacy by design
- Runs entirely in your browser. No server, no network calls, no analytics.
- Only reads text ELSA has already displayed to you.
- Saves no files and copies no manual content anywhere. Close it and it's gone.

## Using it
1. Open `dist/HAHNS.html` in Chrome or Edge.
2. Drag the **H.A.H.N.S** wrench button onto your bookmarks bar.
3. On any ELSA procedure page, click the bookmark — the wrench panel appears.
4. The paste box on that page is a fallback for pages the bookmark can't read
   (e.g. content inside a cross-origin frame), and a way to try it with no login.

## Project layout
- `src/helper.js` — all the logic: page reading, the five extraction patterns,
  and the shadow-DOM panel. **This is the file to tune** as you see real ELSA
  wording. The `SECTIONS` array near the top defines what each bucket matches.
- `src/template.html` — the setup/demo page (with `__BOOKMARKLET__` /
  `__HELPER__` placeholders).
- `tools/build.js` — bakes `helper.js` into the bookmarklet and the page.
- `dist/` — the build output: `HAHNS.html` (open this) and
  `bookmarklet.txt` (the raw bookmark code).

## Rebuild after editing
```
node tools/build.js
```

## Tuning the extraction
Open `src/helper.js`, find the `SECTIONS` array. Each bucket has a `test(line)`
function with the regular expressions that decide whether a line belongs in that
bucket. Adjust the wording to match real ELSA text, then rebuild. The fastest
loop: paste a real procedure into the box on the page and watch what lands where.
