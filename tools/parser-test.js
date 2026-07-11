#!/usr/bin/env node
/*
 * tools/parser-test.js — REGRESSION TEST for the in-app fluid + Service Xpress parsers.
 *
 * Wrong torque/capacity numbers are a real-world (safety) problem, and the parsers
 * get touched often. This tool parses the REAL source PDFs with the SAME code the
 * app runs (window.VWJB.fluidsFromPdf / sxFromPdf) and diffs the result against an
 * approved snapshot, so an accidental change to any value shows up as a red diff
 * before it ships — no more re-eyeballing every year by hand each release.
 *
 * Usage:
 *   node tools/parser-test.js            # check current output vs. snapshots (exit 1 on drift)
 *   node tools/parser-test.js --update   # (re)write the snapshots from the current output
 *
 * Typical flow: after a parser change, run the plain check. If it flags a diff you
 * INTENDED (e.g. the #103 cm→cc fix that adds the Jetta compressor-oil rows), eyeball
 * the diff, then `--update` to bless the new baseline.
 *
 * Sources (all GITIGNORED — licensed VW data, never committed):
 *   fluids : $HAHNS_FLUID_DIR (default ~/Downloads) — any "*Fluid Capacity*.pdf", year = leading 4 digits
 *   SX     : $HAHNS_SX_DIR    (default <repo root>) — sx-YYYY.pdf
 * Snapshots: tools/parser-snapshots/ (GITIGNORED — holds parsed VW data).
 *
 * Zero network, no dependencies. Runs only where the PDFs exist (a dev machine) — same
 * posture as tools/parse-fluids.js. Requires Node 18+ (global DecompressionStream).
 */
"use strict";
var fs = require("fs"), path = require("path"), os = require("os");

// ---- load the app's real parsers into a Node harness -----------------------
global.window = {};
global.self = global;
try {
  eval(fs.readFileSync(path.join(__dirname, "..", "src", "helper.js"), "utf8"));
} catch (e) {
  console.error("Could not load src/helper.js:", e.message);
  process.exit(2);
}
var V = global.window.VWJB;
if (!V || typeof V.fluidsFromPdf !== "function" || typeof V.sxFromPdf !== "function") {
  console.error("window.VWJB.fluidsFromPdf / sxFromPdf missing — did helper.js parse cleanly?");
  process.exit(2);
}

// ---- helpers ---------------------------------------------------------------
var SNAP_DIR = path.join(__dirname, "parser-snapshots");
// volatile fields that legitimately change without being a data regression
var DROP = /^(parsedDate|importDate|parseDate|parserVersion|hash|sha|size|appBuild|fileName|updated)$/i;

function toArrayBuffer(p) {
  var b = fs.readFileSync(p);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
}
// stable JSON with volatile keys removed, so a version bump alone never diffs
function stable(obj) {
  return JSON.stringify(obj, function (k, v) { return DROP.test(k) ? undefined : v; }, 2);
}
function firstYear(name) { var m = String(name).match(/(\d{4})/); return m ? m[1] : null; }

// collect fluid PDFs from a directory, keyed by year, preferring the non-"(1)" copy
function fluidPdfs(dir) {
  var out = {};
  var files;
  try { files = fs.readdirSync(dir); } catch (e) { return out; }
  files.forEach(function (f) {
    if (!/\.pdf$/i.test(f) || !/Fluid Capacity/i.test(f)) return;
    var m = f.match(/^(\d{4})\b/); if (!m) return;
    var year = m[1];
    // keep the first non-duplicate; don't let a "(1)" copy overwrite a clean one
    if (out[year] && /\(\d+\)\.pdf$/i.test(f)) return;
    out[year] = path.join(dir, f);
  });
  return out;
}
// collect Service Xpress charts (sx-YYYY.pdf), keyed by year
function sxPdfs(dir) {
  var out = {};
  var files;
  try { files = fs.readdirSync(dir); } catch (e) { return out; }
  files.forEach(function (f) {
    var m = f.match(/^sx-(\d{4})\.pdf$/i); if (m) out[m[1]] = path.join(dir, f);
  });
  return out;
}

// recursive diff → human-readable "path: old → new" lines (bounded)
function diffInto(a, b, at, acc, cap) {
  if (acc.length >= cap) return;
  if (a === b) return;
  var oa = a && typeof a === "object", ob = b && typeof b === "object";
  if (!oa || !ob) { acc.push(at + ": " + JSON.stringify(a) + "  →  " + JSON.stringify(b)); return; }
  var aa = Array.isArray(a), ab = Array.isArray(b);
  if (aa || ab) {
    if ((a || []).length !== (b || []).length) acc.push(at + ".length: " + (a || []).length + "  →  " + (b || []).length);
    var n = Math.max((a || []).length, (b || []).length);
    for (var i = 0; i < n && acc.length < cap; i++) diffInto(a[i], b[i], at + "[" + i + "]", acc, cap);
    return;
  }
  var keys = {};
  Object.keys(a).forEach(function (k) { keys[k] = 1; });
  Object.keys(b).forEach(function (k) { keys[k] = 1; });
  Object.keys(keys).forEach(function (k) {
    if (acc.length >= cap) return;
    diffInto(a[k], b[k], at ? at + "." + k : k, acc, cap);
  });
}

// ---- main ------------------------------------------------------------------
(async function () {
  var update = process.argv.indexOf("--update") !== -1;
  fs.mkdirSync(SNAP_DIR, { recursive: true });

  var fluidDir = process.env.HAHNS_FLUID_DIR || path.join(os.homedir(), "Downloads");
  var sxDir = process.env.HAHNS_SX_DIR || path.join(__dirname, "..");

  var jobs = [];
  var fl = fluidPdfs(fluidDir);
  Object.keys(fl).sort().forEach(function (y) {
    jobs.push({
      id: "fluids " + y, snap: path.join(SNAP_DIR, "fluids-" + y + ".json"),
      parse: async function () { return stable(await V.fluidsFromPdf(toArrayBuffer(fl[y]), path.basename(fl[y]))); }
    });
  });
  var sx = sxPdfs(sxDir);
  Object.keys(sx).sort().forEach(function (y) {
    jobs.push({
      id: "sx " + y, snap: path.join(SNAP_DIR, "sx-" + y + ".json"),
      parse: async function () { return stable(await V.sxFromPdf(toArrayBuffer(sx[y]), path.basename(sx[y]))); }
    });
  });

  if (!jobs.length) {
    console.error("No source PDFs found.\n  fluids dir: " + fluidDir + "\n  sx dir:     " + sxDir +
      "\nSet HAHNS_FLUID_DIR / HAHNS_SX_DIR if they live elsewhere.");
    process.exit(2);
  }

  var parsed = 0, checked = 0, drift = 0, missing = 0, errors = 0, wrote = 0;
  for (var j = 0; j < jobs.length; j++) {
    var job = jobs[j], out;
    try { out = await job.parse(); }
    catch (e) { errors++; console.log("✗ " + job.id + " — parse error: " + e.message); continue; }
    parsed++;
    if (update) { fs.writeFileSync(job.snap, out); wrote++; continue; }
    if (!fs.existsSync(job.snap)) { missing++; console.log("? " + job.id + " — no snapshot yet (run with --update to bless a baseline)"); continue; }
    checked++;
    var prev = fs.readFileSync(job.snap, "utf8");
    if (prev === out) continue;
    drift++;
    var acc = [];
    try { diffInto(JSON.parse(prev), JSON.parse(out), "", acc, 40); } catch (e) { acc.push("(diff failed: " + e.message + ")"); }
    console.log("✗ " + job.id + " — DRIFT (" + acc.length + (acc.length >= 40 ? "+" : "") + " change" + (acc.length === 1 ? "" : "s") + "):");
    acc.forEach(function (l) { console.log("    " + l); });
  }

  console.log("");
  if (update) {
    console.log("Wrote " + wrote + " snapshot(s) to tools/parser-snapshots/  (" + errors + " parse error(s))");
    process.exit(errors ? 1 : 0);
  }
  console.log("Parsed " + parsed + " · checked " + checked + " · drift " + drift + " · missing " + missing + " · errors " + errors);
  if (drift || errors) { console.log("✗ Parser output changed — review the diffs above. If intended, re-bless with --update."); process.exit(1); }
  if (missing) { console.log("• Some years have no baseline yet — run --update once to record them."); process.exit(0); }
  console.log("✓ No parser drift.");
})();
