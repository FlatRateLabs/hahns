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
const VERSION = "0.1.0-alpha";

// shown in the panel + setup page: "v0.1.0-alpha · 2026-06-20 21:53 UTC"
const date = new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC";
const build = "v" + VERSION + " · " + date;

const helper = fs.readFileSync(path.join(root, "src/helper.js"), "utf8").replace(/__BUILD__/g, build);
const template = fs.readFileSync(path.join(root, "src/template.html"), "utf8").replace(/__BUILD__/g, build);

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

// GitHub Pages: serve the site from /docs (index.html is the default page)
const docsDir = path.join(root, "docs");
fs.mkdirSync(docsDir, { recursive: true });
fs.writeFileSync(path.join(docsDir, "index.html"), html);
fs.writeFileSync(path.join(docsDir, "bookmarklet.txt"), bookmarklet);
// stop Pages' Jekyll from touching our files
fs.writeFileSync(path.join(docsDir, ".nojekyll"), "");

console.log("Built " + build + ":");
console.log("  dist/bookmarklet.txt      (" + bookmarklet.length + " chars)");
console.log("  dist/HAHNS.html");
console.log("  docs/index.html           (GitHub Pages)");
