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
const VERSION = "0.3.6-alpha";

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
const changelogHtml = renderChangelog(fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf8"));

const helper = fs.readFileSync(path.join(root, "src/helper.js"), "utf8")
  .replace(/__BUILD__/g, build);
// the standalone Fluids & Capacities lookup page (opened in a new window from the
// panel — off ELSA, so it CAN load the obfuscated per-year data files in docs/fluids/)
const fluidsPage = fs.readFileSync(path.join(root, "src/fluids.html"), "utf8")
  .replace(/__BUILD__/g, build);
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

const distDir = path.join(root, "dist");
fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(path.join(distDir, "bookmarklet.txt"), bookmarklet);

const html = template
  .replace("__BOOKMARKLET__", bookmarklet.replace(/"/g, "&quot;"))
  .replace("__HELPER__", helper);

fs.writeFileSync(path.join(distDir, "HAHNS.html"), html);

// machine-readable version record. The app no longer fetches this (auto-update is
// impossible on ELSA — the app reminds the tech to check here instead); kept as a
// plain published record of the current build.
const versionJson = JSON.stringify({ version: VERSION, build: build });
fs.writeFileSync(path.join(distDir, "version.json"), versionJson);
fs.writeFileSync(path.join(distDir, "fluids.html"), fluidsPage);
// mirror the published fluid data into dist/ so the page previews locally too
// (the obfuscated docs/fluids/*.json files are produced by tools/parse-fluids.js)
const fluidsDataDir = path.join(root, "docs", "fluids");
if (fs.existsSync(fluidsDataDir)) {
  const dstFluids = path.join(distDir, "fluids");
  fs.mkdirSync(dstFluids, { recursive: true });
  fs.readdirSync(fluidsDataDir).forEach(function (f) {
    if (/\.json$/.test(f)) fs.copyFileSync(path.join(fluidsDataDir, f), path.join(dstFluids, f));
  });
}

// GitHub Pages: serve the site from /docs (index.html is the default page)
const docsDir = path.join(root, "docs");
fs.mkdirSync(docsDir, { recursive: true });
fs.writeFileSync(path.join(docsDir, "index.html"), html);
fs.writeFileSync(path.join(docsDir, "bookmarklet.txt"), bookmarklet);
fs.writeFileSync(path.join(docsDir, "version.json"), versionJson);
fs.writeFileSync(path.join(docsDir, "fluids.html"), fluidsPage);
// stop Pages' Jekyll from touching our files
fs.writeFileSync(path.join(docsDir, ".nojekyll"), "");

console.log("Built " + build + ":");
console.log("  dist/bookmarklet.txt      (" + bookmarklet.length + " chars)");
console.log("  dist/HAHNS.html");
console.log("  docs/index.html           (GitHub Pages)");
console.log("  docs/fluids.html          (fluid-lookup page)");
console.log("  docs/version.json         (version record)");
