/*
 * parse-fluids.js — DEV VERIFICATION TOOL (run locally, never shipped).
 *
 * Since v0.3.13 the app itself converts the "VW Fluid Capacity Tables" PDFs
 * in the browser (the tech loads them through ⚙ Settings), and NO fluid data
 * is hosted or committed. This tool remains the poppler-based reference
 * pipeline: when a NEW model year comes out, run it and diff its output
 * against `window.VWJB.fluidsFromPdf` (see SESSION_SUMMARY 2026-07-02 for the
 * harness) to confirm the in-app reader still parses the new PDF correctly.
 *
 *   node tools/parse-fluids.js "~/Downloads/2027 VW Fluid Capacity Tables.pdf"
 *   node tools/parse-fluids.js <pdf> --year 2027
 *
 * Requires poppler's `pdftotext` on PATH (brew install poppler). Emits into
 * the GITIGNORED tools/fluids-review/ dir only (plaintext VW data must never
 * hit the public repo):
 *   tools/fluids-review/<year>.json  — parsed data (plain JSON, reference)
 *   tools/fluids-review/<year>.txt   — PLAIN-TEXT review sheet. ALWAYS eyeball
 *                                      this against the PDF — wrong capacities
 *                                      are a real-world problem.
 *
 * The PDF is organised as model sections ("1.9  Atlas (CA1)"), each holding the
 * tables ENGINE OIL CAPACITY / ENGINE COOLANT / AIR CONDITIONING / DRIVETRAIN
 * (and BRAKE HYDRAULIC SYSTEM, which we skip). Columns are space-aligned, so we
 * slice each table by the column positions found in its header row.
 */
"use strict";

var fs = require("fs");
var path = require("path");
var cp = require("child_process");

var ROOT = path.join(__dirname, "..");

/* ----------------------------- helpers ------------------------------ */

// strip a glued footnote marker like the "1)" in "VW 504 001) (0W-30)"
function dropFootnote(s) { return String(s || "").replace(/(\d{2})\d\)/g, "$1"); }

// normalise Unicode hyphens to ASCII and rejoin words split across a line wrap
// ("Mecha‐ tronic" -> "Mechatronic")
function normHyphens(s) {
  return String(s || "").replace(/[‐‑­]/g, "-").replace(/([a-z])-\s+([a-z])/g, "$1$2");
}

// capacity value(s): "7.0 L (7.4 qt)", "650 +/- 25 g", "6.8 L +/- 0.1 L (7.2 qt)"
var CAP_RE = /\d[\d.]*\s*L\s*\([^)]*qt[^)]*\)/;
var SPEC_RE = /VW\s*\d{3}\s*\d{2}(?:\s*\(\s*\d[0-9W\s-]*\))?/g;

// pull engine/trans codes out of "(DDSA / DDSB)" or "(0CR / 0CQ)"
function codesIn(text) {
  var m = /\(([^)]*)\)/.exec(text || "");
  if (!m) return [];
  return m[1].split(/[\/,]/).map(function (s) { return s.trim().toUpperCase(); })
    .filter(function (s) { return /^[A-Z0-9]{2,5}$/.test(s); });
}

// the capacity value(s) in a cell. Handles "650 +/- 25 g" (tolerance before unit)
// AND "6.8 L +/- 0.1 L (7.2 qt)" (tolerance after unit), plus a trailing "(… qt)".
var VAL_RE = /(?:Approximately\s+)?\d[\d.]*(?:\s*\+\/-\s*[\d.]+)?\s*(?:L|g|cc|ml)(?:\s*\+\/-\s*[\d.]+\s*(?:L|g|cc|ml))?(?:\s*\([^)]*\))?/g;
// a number can never have two decimal points — VW's 2023 PDF has a "(0.6.3 qt)"
// typo for "(0.63 qt)". Collapse a stray middle dot so it reads correctly.
function fixDecimals(s) { return s.replace(/(\d+\.\d+)\.(\d+)/g, "$1$2"); }
function valuesIn(text) {
  var out = [], m;
  VAL_RE.lastIndex = 0;
  while ((m = VAL_RE.exec(text || ""))) out.push(fixDecimals(m[0].replace(/\s+/g, " ").trim()));
  return out;
}

// noise lines that appear inside tables (page chrome, footnotes, the Note block)
function isNoise(line) {
  var t = line.trim();
  if (!t) return true;
  if (/^\d{1,3}$/.test(t)) return true;                 // bare page numbers / column "3"
  if (/^\d{2}\.\d{4}$/.test(t)) return true;            // "03.2024" footer date
  if (/^\d{1,3}\s+\d{2}\.\d{4}$/.test(t)) return true;  // "5    03.2024" page-number + date footer
  if (/^Note$/i.test(t)) return true;
  if (/^All quantities are approximate/i.test(t)) return true;
  if (/^filling instructions\.?$/i.test(t)) return true;
  if (/^\d\)\s/.test(t)) return true;                   // footnote paragraph "1) If you must…"
  if (/^(engine oil that meets|Using oil with|Only use different)/i.test(t)) return true;
  return false;
}

// column boundaries from a header row: the start index of each title, in order
function boundaries(headerLine, titles) {
  var idx = [], from = 0;
  for (var i = 0; i < titles.length; i++) {
    var at = headerLine.indexOf(titles[i], from);
    if (at < 0) return null;
    idx.push(at); from = at + titles[i].length;
  }
  return idx;
}
function slice(line, idx) {
  var cells = [];
  for (var i = 0; i < idx.length; i++) {
    var end = (i + 1 < idx.length) ? idx[i + 1] : line.length + 999;
    // pad 1 char left so values that start just under the header still land right
    cells.push((line.substring(Math.max(0, idx[i] - 1), end) || "").trim());
  }
  return cells;
}

/* -------------------------- table parsers --------------------------- */

// ENGINE OIL CAPACITY: Engine | Engine Oil Type | Capacity (one capacity, 1+ specs).
// We split off the Engine column by the header position (so a wrapped engine code
// like "(DDSA /" → "DDSB)" stays together) and pull the spec(s)/capacity out of the
// remainder by regex — far more robust than 3-way column slicing for these cells.
function parseOil(lines, hdrIdx) {
  var idxType = lines[hdrIdx].indexOf("Engine Oil Type");
  if (idxType < 0) return [];
  var rows = [], cur = null;
  for (var i = hdrIdx + 1; i < lines.length; i++) {
    // the footnote paragraph ("1) If you must add oil…") always sits BELOW the
    // last engine row; stop here so its wrapped continuation lines can't bleed
    // into the engine description column.
    if (/^\s*\d\)\s/.test(lines[i])) break;
    if (isNoise(lines[i])) continue;
    var ln = normHyphens(lines[i]);
    if (/^\s*Engine\s+Engine Oil Type/.test(ln)) { idxType = ln.indexOf("Engine Oil Type"); continue; }  // repeated header (page break)
    var col1 = ln.substring(0, idxType).trim();
    var rest = dropFootnote(ln.substring(idxType));
    // `type` = only the text before the capacity value, so a wrapped viscosity
    // ("(0W-30)" on a continuation line, e.g. 2018 Golf R) stays attached to its
    // "VW 504 00" instead of being appended after the capacity and lost by SPEC_RE.
    var cm = rest.match(CAP_RE);
    if (cm) { cur = { eng: col1, rest: rest, type: rest.slice(0, cm.index) }; rows.push(cur); }   // a capacity = a new engine row
    else if (cur) { if (col1) cur.eng += " " + col1; cur.rest += " " + rest; cur.type += " " + rest; }    // spec / engine-wrap continuation
  }
  return rows.map(function (r) {
    var engines = codesIn(r.eng);
    var bare = !engines.length;
    // 2021+ layout lists the engine code BARE in the Engine column ("DLRB",
    // "1.5L - DNKA") instead of parenthesised — fall back to a 4-letter code.
    if (bare) engines = (r.eng.replace(/\([^)]*\)/g, " ").match(/\b[A-Z]{4}\b/g) || []);
    var desc = r.eng.replace(/\([^)]*\)/g, "");
    if (bare) engines.forEach(function (c) { desc = desc.replace(new RegExp("\\b" + c + "\\b", "g"), " "); });
    return {
      engines: engines.map(function (s) { return s.toUpperCase(); }),
      desc: desc.replace(/\s+/g, " ").replace(/^\s*[—-]\s*/, "").replace(/[—-]\s*$/, "").trim(),
      specs: ((r.type || r.rest).match(SPEC_RE) || []).map(function (s) { return s.replace(/\s+/g, " ").trim(); }),
      capacity: ((r.rest.match(CAP_RE) || [""])[0]).replace(/\s+/g, " ").trim()
    };
  });
}

// COMPONENT/APPLICATION/CAPACITY tables (coolant, A/C, drivetrain). Returns rows
// of { component, application, fills:[{label,value}] }. A new row starts when the
// Application cell names a new thing; capacity values + fill labels accumulate.
function parseCAC(lines, hdrIdx) {
  var idx = null, rows = [], cur = null, lastComp = "";
  for (var i = hdrIdx; i < lines.length; i++) {
    var ln = normHyphens(lines[i]);
    // a page break repeats the header — and its columns can sit at DIFFERENT
    // positions, so re-read the boundaries every time one appears
    if (/^\s*Component\s+Application\s+Capacity/.test(ln)) {
      idx = boundaries(ln, ["Component", "Application", "Capacity"]); cur = null; continue;
    }
    if (!idx || isNoise(ln)) continue;
    var c = slice(ln, idx), comp = c[0], app = c[1], capCell = c[2];
    if (comp) lastComp = comp;
    // reassemble a "N +/-" tolerance split from its "M unit" by interleaved label
    // words (2018 Golf R: "Initial 500 +/- Fill / Refill 15 g") — see helper.js
    capCell = capCell.replace(
      /(\d[\d.]*\s*\+\/-)\s+((?:Initial|Fill|Refill|\/|\s)+?)\s*([\d.]+\s*(?:L|g|cc|ml)\b)/gi,
      "$2 $1 $3");
    var vals = valuesIn(capCell);
    var label = capCell.replace(VAL_RE, "").replace(/\s+/g, " ").trim();   // "Initial Fill / Refill", "Initial", "Refill"…
    var codeOnly = /^\([A-Z0-9/\s]+\)$/.test(app);   // a wrapped code line like "(0GC)"
    var madeRow = false;
    if (codeOnly && cur) { cur.application += " " + app; }   // fold the wrapped code into the row above
    // otherwise a row begins on a new Application descriptor
    else if (app && (comp || /[A-Za-z]/.test(app)) && !/^(Fill|Refill|Initial|Approximately)/i.test(app)) {
      cur = { component: comp || lastComp, application: app, fills: [] };
      rows.push(cur); madeRow = true;
    }
    if (!cur) { cur = { component: comp || lastComp, application: app || "", fills: [] }; rows.push(cur); madeRow = true; }
    // a Component-column continuation — e.g. the refrigerant TYPE "(R1234yf)" that
    // wraps under "A/C System Refrigerant". Critical: never drop it.
    if (comp && !madeRow && !codeOnly) cur.component += " " + comp;
    // attach a value (carry the fill label; "Fill / Refill" continuations refine the last label)
    for (var v = 0; v < vals.length; v++) cur.fills.push({ label: label, value: vals[v] });
    if (!vals.length && label && cur.fills.length) {
      var f = cur.fills[cur.fills.length - 1];
      f.label = (f.label ? f.label + " " : "") + label;   // e.g. "Initial" + "Fill / Refill"
    }
  }
  // tidy labels + pull the refrigerant type (R134a / R1234yf) out of the component
  rows.forEach(function (r) {
    r.fills.forEach(function (f) { f.label = (f.label || "").replace(/\s+/g, " ").replace(/\s*\/\s*/g, " / ").trim(); });
    r.application = (r.application || "").replace(/\s+/g, " ").trim();
    r.component = (r.component || "").replace(/\s+/g, " ").trim();
    var rt = /R\s?1234yf|R\s?134a|R\s?744/i.exec(r.component);
    if (rt) {
      r.refrigerant = rt[0].replace(/\s+/g, "").replace(/^r/, "R");
      // a wrapped second refrigerant can arrive as just "(R1234yf)" — restore the name
      if (/^\(?R\s?(1234yf|134a|744)\)?$/i.test(r.component)) r.component = "A/C System Refrigerant " + r.component;
    }
  });
  return rows.filter(function (r) { return r.fills.length; });
}

// The EV single-speed "0MP" gearbox prints TWO service scenarios in a cramped
// 4-column cell that pdftotext collapses badly — and the second scenario's spec is
// TEXT ("Up to the lower edge…"), not a number, so it gets dropped. Rebuild the row
// cleanly: keep the captured numeric fill, restore the text fill. (Fixed VW wording,
// identical across ID models/years.)
function fixEvSingleSpeed(rows) {
  return rows.map(function (r) {
    if (!/\b0MP\b/.test(r.application || "")) return r;
    var blob = (r.fills || []).map(function (f) { return (f.label || "") + " " + (f.value || ""); }).join(" ");
    if (!/residue/i.test(blob)) return r;   // only the mangled residue row
    var num = "";
    (r.fills || []).forEach(function (f) { if (!num && /\d/.test(f.value || "")) num = f.value; });
    num = num.replace(/(\d)\s*L\b/g, "$1 L");   // "3.18L" -> "3.18 L"
    return {
      component: r.component, application: r.application,
      fills: [
        { label: "Refilling transmission that had residue removed", value: num || "—" },
        { label: "Transmission fluid drained, residue not removed",
          value: "Up to the lower edge of the transmission fluid fill and check hole" }
      ]
    };
  });
}

/* ----------------------------- driver ------------------------------- */

var SYS_HEADERS = {
  "ENGINE OIL CAPACITY": "engineOil",
  "ENGINE COOLANT": "engineCoolant",
  "E-MOTOR COOLANT": "engineCoolant",   // EVs (ID.4) label coolant this way
  "AIR CONDITIONING": "airConditioning",
  "DRIVETRAIN": "drivetrain"
  // BRAKE HYDRAULIC SYSTEM intentionally skipped (not one of the four systems)
};
var MODEL_HDR = /^\d+\.\d+\s+(.+?)\s*\(([^)]*)\)\s*$/;

function parsePdf(text) {
  var lines = text.split(/\r?\n/);
  // Some years (e.g. 2010) append a "Maintenance Schedules" section (section 2)
  // after the fluid tables; its numbered sub-sections look like model headers and
  // would spawn junk "models". Cut everything from the first NUMBERED Maintenance
  // Schedule heading onward (the "⇒ …" table-of-contents lines have no leading
  // number, so they're left alone and don't trigger the cut prematurely).
  for (var c = 0; c < lines.length; c++) {
    if (/^\s*\d[\d.]*\s+Maintenance\s+Schedules?\b/i.test(lines[c])) { lines = lines.slice(0, c); break; }
  }
  // locate model section headers
  var sections = [];
  for (var i = 0; i < lines.length; i++) {
    var m = MODEL_HDR.exec(lines[i]);
    // an ENGINE OIL data row can start "1.5 - DNKA … 4.3 L (4.6 qt)", which looks
    // like a "1.5  Model (CODE)" header — reject anything carrying table data
    // (an oil spec or a capacity) so it can't spawn a phantom model section.
    var looksLikeData = /VW\s*\d{3}|\bqt\b|\d\s*L\s*\(|\+\/-/.test(lines[i]);
    if (m && !looksLikeData && !/^(ENGINE|AIR|DRIVE|BRAKE|Component|Engine)/.test(lines[i].trim())) {
      sections.push({ name: m[1].replace(/\s+/g, " ").trim(), code: m[2].replace(/\s+/g, " ").trim(), at: i });
    }
  }
  var models = [];
  for (var s = 0; s < sections.length; s++) {
    var start = sections[s].at, end = (s + 1 < sections.length) ? sections[s + 1].at : lines.length;
    var model = { model: sections[s].name, modelCode: sections[s].code,
      engineOil: [], engineCoolant: [], airConditioning: [], drivetrain: [] };
    // find system tables within this section
    var sys = [];
    for (var j = start; j < end; j++) {
      var key = SYS_HEADERS[lines[j].trim()];
      if (key) sys.push({ key: key, at: j });
    }
    for (var k = 0; k < sys.length; k++) {
      var sStart = sys[k].at, sEnd = (k + 1 < sys.length) ? sys[k + 1].at : end;
      // also stop at a BRAKE header if it falls between
      for (var b = sStart + 1; b < sEnd; b++) { if (/^BRAKE HYDRAULIC SYSTEM$/.test(lines[b].trim())) { sEnd = b; break; } }
      var sub = lines.slice(sStart, sEnd);
      // header row of the table is the first line with the column titles
      var hdr = -1;
      for (var h = 0; h < sub.length; h++) {
        if (/^\s*(Engine\s+Engine Oil Type|Component\s+Application)/.test(sub[h])) { hdr = h; break; }
      }
      if (hdr < 0) continue;
      model[sys[k].key] = (sys[k].key === "engineOil") ? parseOil(sub, hdr) : parseCAC(sub, hdr);
      if (sys[k].key === "drivetrain") model[sys[k].key] = fixEvSingleSpeed(model[sys[k].key]);
    }
    models.push(model);
  }
  return models;
}

/* ------------------------- review + output -------------------------- */

function reviewSheet(year, models) {
  var L = ["VW FLUID CAPACITIES — " + year + " — PARSER REVIEW SHEET",
    "Check every line against the PDF before committing. " + models.length + " models.\n"];
  models.forEach(function (m) {
    L.push("================================================================");
    L.push(m.model + "  (" + m.modelCode + ")");
    L.push("  ENGINE OIL:");
    m.engineOil.forEach(function (r) {
      L.push("    [" + (r.engines.join(", ") || "?") + "] " + r.desc + " — " + r.capacity + "  | " + r.specs.join(" / "));
    });
    L.push("  ENGINE COOLANT:");
    m.engineCoolant.forEach(function (r) {
      L.push("    " + r.application + " — " + r.fills.map(function (f) { return f.value; }).join(" ; "));
    });
    L.push("  AIR CONDITIONING:");
    m.airConditioning.forEach(function (r) {
      L.push("    " + r.component + (r.refrigerant ? "  <" + r.refrigerant + ">" : "") +
        " (" + r.application + ") — " + r.fills.map(function (f) { return f.value; }).join(" ; "));
    });
    L.push("  DRIVETRAIN:");
    m.drivetrain.forEach(function (r) {
      L.push("    " + (r.component ? r.component + " / " : "") + r.application + " — " +
        r.fills.map(function (f) { return (f.label ? f.label + ": " : "") + f.value; }).join(" ; "));
    });
    L.push("");
  });
  return L.join("\n");
}

function main() {
  var args = process.argv.slice(2);
  var pdf = args.filter(function (a) { return a.indexOf("--") !== 0; })[0];
  var yArg = (args.indexOf("--year") >= 0) ? args[args.indexOf("--year") + 1] : null;
  if (!pdf) { console.error("usage: node tools/parse-fluids.js <pdf> [--year YYYY]"); process.exit(1); }
  pdf = pdf.replace(/^~/, process.env.HOME || "");
  if (!fs.existsSync(pdf)) { console.error("not found: " + pdf); process.exit(1); }
  var year = yArg || (path.basename(pdf).match(/\b(19|20)\d{2}\b/) || [])[0];
  if (!year) { console.error("could not infer year — pass --year YYYY"); process.exit(1); }

  var text;
  try { text = cp.execFileSync("pdftotext", ["-layout", pdf, "-"], { encoding: "utf8", maxBuffer: 1 << 24 }); }
  catch (e) { console.error("pdftotext failed — is poppler installed? (brew install poppler)\n" + e.message); process.exit(1); }

  // Older PDFs (≈2006–2013) write tolerances with the Unicode ± ("525 ± 25 g");
  // newer ones already emit ASCII "+/-". VAL_RE expects "+/-", so without this the
  // grams CHARGE ("525") is dropped and only the tolerance ("25 g") is captured.
  // Normalize once at the source so every year parses the same way. Some years
  // (e.g. 2018 Golf R) render the tolerance as three spaced glyphs "+ / -" (any
  // dash) instead of a ± — collapse that to the ASCII "+/-" too.
  text = text.replace(/±/g, " +/- ").replace(/\+\s*\/\s*[-‐-―−]/g, "+/-");

  var models = parsePdf(text);
  if (!models.length) { console.error("no model sections found — PDF layout may have changed"); process.exit(1); }

  var data = { _: "hahns-fluids", v: 1, year: Number(year), models: models };

  var revDir = path.join(ROOT, "tools", "fluids-review");
  fs.mkdirSync(revDir, { recursive: true });
  fs.writeFileSync(path.join(revDir, year + ".json"), JSON.stringify(data, null, 1));
  var review = reviewSheet(year, models);
  fs.writeFileSync(path.join(revDir, year + ".txt"), review);

  console.log("Parsed " + models.length + " models for " + year + ".");
  console.log("  data   -> tools/fluids-review/" + year + ".json  (gitignored reference)");
  console.log("  review -> tools/fluids-review/" + year + ".txt  (CHECK THIS)\n");
  console.log(review);
}

if (require.main === module) main();
module.exports = { parsePdf: parsePdf };
