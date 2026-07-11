/*
 * build.js — turns src/helper.js into:
 *   1) dist/bookmarklet.txt   the javascript: bookmark you save
 *   2) dist/HAHNS.html        the open-me setup + demo page (bookmarklet baked in)
 *   3) docs/index.html        same page, named for GitHub Pages (serves /docs)
 *   4) docs/bookmarklet.txt   copy for Pages
 *
 * No dependencies. Run:  node tools/build.js
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

// ---- version ----
// Bump this when you ship. While testing, keep the "-alpha" tag.
//   tiny fix -> 0.1.1   new feature -> 0.2.0   stable release -> 1.0.0
const VERSION = "0.4.6-alpha";

// Loader generation. The loader is the dragged bookmark; it can ONLY change by
// re-dragging. Bump this whenever src/loader.js changes so the update popup can
// tell a tech their bookmark is behind and hand them the re-drag button. Pre-lv
// loaders (v0.4.0–v0.4.2) send no lv → the popup reads 0 → they're prompted to
// re-drag onto this generation. Published in version.json as `loader`.
const LOADER_VER = 2;

// ---- self-updating loader (POC) ----
// Where the hosted app.js / update.html live. The loader trusts ONLY messages
// from PAGES_ORIGIN. Set to the fork for testing; flip to the production Pages
// origin (https://flatratelabs.github.io) before shipping to main.
const PAGES_BASE = "https://flatratelabs.github.io/hahns";
const PAGES_ORIGIN = "https://flatratelabs.github.io";

// ---- feedback / bug-report relay (v0.4.6) ----
// The Cloudflare Worker that turns an in-app report into a labeled GitHub issue.
// It holds the GitHub token (never in this repo). REPORT_GATE is a soft anti-spam
// string baked into report.html; it must match the Worker's SHARED_SECRET.
const WORKER_URL = "https://hahns-feedback.rvanpolen89.workers.dev";
const REPORT_GATE = "z3kZsEXFIx1rWxv67P8FUZ7fCbcNwwd6";

// shown in the panel + setup page: "v0.1.0-alpha · 2026-06-20 21:53 UTC"
const date = new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC";
const build = "v" + VERSION + " · " + date;

// ---- changelog ----
// CHANGELOG.md is the single source. We render it to HTML at build time and bake
// it into the setup page only (the app itself no longer shows a changelog — techs
// read it here, on the page they update from). No network needed either way.
function clEsc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function clInline(s) {
  return clEsc(s)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}
function renderChangelog(md) {
  var lines = md.split(/\r?\n/);
  var i = 0;
  while (i < lines.length && lines[i].indexOf("## ") !== 0) i++;  // skip file header/intro
  var html = '<div class="cl">';
  var inList = false, openVer = false, curLi = null;
  function closeLi() { if (curLi !== null) { html += "<li>" + clInline(curLi.trim()) + "</li>"; curLi = null; } }
  function closeList() { closeLi(); if (inList) { html += "</ul>"; inList = false; } }
  function closeVer() { closeList(); if (openVer) { html += "</div>"; openVer = false; } }
  for (; i < lines.length; i++) {
    var ln = lines[i];
    if (ln.indexOf("## ") === 0) {
      closeVer();
      var t = ln.slice(3).trim().split(" — ");
      var ver = t[0], status = t.length > 1 ? t.slice(1).join(" — ") : "";
      html += '<div class="cl-ver"><h3>' + clInline(ver) +
        (status ? ' <span class="cl-status">— ' + clInline(status) + "</span>" : "") + "</h3>";
      openVer = true;
      continue;
    }
    if (!openVer) continue;
    if (ln.indexOf("### ") === 0) { closeList(); html += "<h4>" + clInline(ln.slice(4).trim()) + "</h4><ul>"; inList = true; continue; }
    if (ln.indexOf("---") === 0) continue;
    if (/^\s*-\s+/.test(ln)) { closeLi(); curLi = ln.replace(/^\s*-\s+/, ""); continue; }
    if (/^\s+\S/.test(ln) && curLi !== null) { curLi += " " + ln.trim(); continue; }
    var txt = ln.trim();
    if (!txt) { closeLi(); continue; }
    if (inList) { if (curLi !== null) curLi += " " + txt; continue; }
    html += '<p class="cl-intro">' + clInline(txt) + "</p>";
  }
  closeVer();
  return html + "</div>";
}
// Just the LATEST version's changes, rendered to a small HTML fragment for the
// update popup's "What's new" (it shows only the version being offered). Same
// markdown subset as renderChangelog, but stops at the second "## " heading.
function latestNotesHtml(md) {
  var lines = md.split(/\r?\n/);
  var i = 0;
  while (i < lines.length && lines[i].indexOf("## ") !== 0) i++;   // first version heading
  if (i >= lines.length) return "";
  i++;                                                             // skip the heading itself
  var html = "", inList = false, curLi = null;
  function closeLi() { if (curLi !== null) { html += "<li>" + clInline(curLi.trim()) + "</li>"; curLi = null; } }
  function closeList() { closeLi(); if (inList) { html += "</ul>"; inList = false; } }
  for (; i < lines.length; i++) {
    var ln = lines[i];
    if (ln.indexOf("## ") === 0) break;                           // next version -> stop
    if (ln.indexOf("### ") === 0) { closeList(); html += "<h4>" + clInline(ln.slice(4).trim()) + "</h4><ul>"; inList = true; continue; }
    if (ln.indexOf("---") === 0) continue;
    if (/^\s*>\s?/.test(ln)) { closeList(); html += "<p class='note'>" + clInline(ln.replace(/^\s*>\s?/, "")) + "</p>"; continue; }
    if (/^\s*-\s+/.test(ln)) { closeLi(); curLi = ln.replace(/^\s*-\s+/, ""); continue; }
    if (/^\s+\S/.test(ln) && curLi !== null) { curLi += " " + ln.trim(); continue; }
    var txt = ln.trim();
    if (!txt) { closeLi(); continue; }
    if (inList && curLi !== null) { curLi += " " + txt; continue; }  // wrapped bullet text
    if (inList) closeList();                                         // a paragraph after the list ends it
    html += "<p>" + clInline(txt) + "</p>";
  }
  closeList();
  return html;
}
const changelogMd = fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf8");
const changelogHtml = renderChangelog(changelogMd);
const notesJson = JSON.stringify({ version: VERSION, html: latestNotesHtml(changelogMd) });

// the Hahns mascot (bust) is embedded as a base64 data URI so the bookmarklet stays
// self-contained — no network fetch (mandatory on ELSA; see CLAUDE.md privacy posture).
const hahnsIcon = "data:image/png;base64," +
  fs.readFileSync(path.join(root, "src/assets/hahns-icon.png")).toString("base64");
const helper = fs.readFileSync(path.join(root, "src/helper.js"), "utf8")
  .replace(/__BUILD__/g, build)
  .replace(/__HAHNS_ICON__/g, hahnsIcon)
  .replace(/__REPORT_URL__/g, PAGES_BASE + "/report.html");
// (v0.3.13: the Fluids & Capacities lookup no longer has a hosted page or hosted
// data — the tech loads the yearly PDFs through the panel's ⚙ Settings and the
// lookup window is built locally inside helper.js.)
const template = fs.readFileSync(path.join(root, "src/template.html"), "utf8")
  .replace(/__BUILD__/g, build)
  .replace("__CHANGELOG__", changelogHtml);

/* Light, safe whitespace trim for the bookmarklet payload — strips block
 * comments and collapses leading indentation. We deliberately avoid a real
 * minifier (no deps) and the size is well within bookmark URL limits. */
function lighten(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, "")          // block comments
    .replace(/^[ \t]+/gm, "")                    // leading indentation
    .replace(/[ \t]+$/gm, "")                    // trailing spaces
    .replace(/\n{2,}/g, "\n")                     // blank lines
    .trim();
}

const payload = "(function(){" + lighten(helper) +
  "if(window.VWJB){window.VWJB.run();}})();";

const bookmarklet = "javascript:" + encodeURIComponent(payload);

// the tiny self-updating loader the tech drags (points at PAGES_BASE/ORIGIN).
// This is what the setup page now hands out via __LOADER__.
const loaderSrc = fs.readFileSync(path.join(root, "src/loader.js"), "utf8")
  .replace(/__PAGES_BASE__/g, PAGES_BASE)
  .replace(/__PAGES_ORIGIN__/g, PAGES_ORIGIN)
  .replace(/__LOADER_VER__/g, String(LOADER_VER));
const loader = "javascript:" + encodeURIComponent(lighten(loaderSrc));

const distDir = path.join(root, "dist");
fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(path.join(distDir, "bookmarklet.txt"), bookmarklet);

const html = template
  .replace(/__LOADER__/g, loader.replace(/"/g, "&quot;"))
  .replace("__BOOKMARKLET__", bookmarklet.replace(/"/g, "&quot;"))
  .replace("__HELPER__", helper);

fs.writeFileSync(path.join(distDir, "HAHNS.html"), html);

// machine-readable version record. The app no longer fetches this (auto-update is
// impossible on ELSA — the app reminds the tech to check here instead); kept as a
// plain published record of the current build.
const versionJson = JSON.stringify({ version: VERSION, build: build, loader: LOADER_VER });
fs.writeFileSync(path.join(distDir, "version.json"), versionJson);
// "What's new" for the update popup — the latest version's changes only
fs.writeFileSync(path.join(distDir, "notes.json"), notesJson);

// GitHub Pages: serve the site from /docs (index.html is the default page)
const docsDir = path.join(root, "docs");
fs.mkdirSync(docsDir, { recursive: true });
fs.writeFileSync(path.join(docsDir, "index.html"), html);
fs.writeFileSync(path.join(docsDir, "bookmarklet.txt"), bookmarklet);
fs.writeFileSync(path.join(docsDir, "version.json"), versionJson);
fs.writeFileSync(path.join(docsDir, "notes.json"), notesJson);
// stop Pages' Jekyll from touching our files
fs.writeFileSync(path.join(docsDir, ".nojekyll"), "");

// ---- self-updating loader artifacts ----
// app.js = the exact same code the classic bookmarklet runs, but hosted so the
// update window can hand it to ELSA via postMessage + inline-<script> injection.
const appJs = payload;
// update.html = the popup that checks version.json, then fetches app.js on demand.
const updateHtml = fs.readFileSync(path.join(root, "src/update.html"), "utf8");
// (loader.txt written below is the same `loader` string handed out on the setup page)

// report.html = the feedback / bug-report popup. Posts to the Cloudflare relay
// Worker (WORKER_URL), which files a labeled GitHub issue. REPORT_GATE is the soft
// anti-spam string; it must match the Worker's SHARED_SECRET.
const reportHtml = fs.readFileSync(path.join(root, "src/report.html"), "utf8")
  .replace(/__WORKER_URL__/g, WORKER_URL)
  .replace(/__REPORT_GATE__/g, REPORT_GATE);

[distDir, docsDir].forEach(function (d) {
  fs.writeFileSync(path.join(d, "app.js"), appJs);
  fs.writeFileSync(path.join(d, "update.html"), updateHtml);
  fs.writeFileSync(path.join(d, "report.html"), reportHtml);
  fs.writeFileSync(path.join(d, "loader.txt"), loader);
});

// served mascot assets (Hahns full body for the page hero + the favicon/apple icon).
// Copied verbatim into both docs/ (Pages) and dist/ (local preview).
["hahns.png", "favicon.png", "apple-touch-icon.png"].forEach(function (f) {
  const srcF = path.join(root, "src/assets", f);
  if (fs.existsSync(srcF)) {
    fs.copyFileSync(srcF, path.join(docsDir, f));
    fs.copyFileSync(srcF, path.join(distDir, f));
  }
});

console.log("Built " + build + ":");
console.log("  dist/bookmarklet.txt      (" + bookmarklet.length + " chars)");
console.log("  dist/HAHNS.html");
console.log("  docs/index.html           (GitHub Pages)");
console.log("  docs/version.json         (version record)");
