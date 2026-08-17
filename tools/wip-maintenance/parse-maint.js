// Prototype maintenance-schedule parser. Develops parseMaintenance(text) against
// the real 2019 PDF, reusing helper.js's pdfTextLines. Port to helper.js once solid.
const fs = require("fs");
global.window = {};
eval(fs.readFileSync(__dirname + "/../../src/helper.js", "utf8"));
const V = window.VWJB;

const CHECK = 61608; // U+F0A8 — the checkbox glyph, vertically CENTERED on each item cell
function hasCheck(s) { return s.indexOf(String.fromCharCode(CHECK)) >= 0; }
function stripCheck(s) { return s.replace(new RegExp(String.fromCharCode(CHECK), "g"), " "); }
function tidy(s) { return stripCheck(s || "").replace(/\s+/g, " ").trim(); }
// glue soft-hyphen word wraps ("Ti‐ guan" -> "Tiguan") AFTER fragments are joined,
// so a trailing ‐ meets its continuation. U+2010 (‐) only; real "-" is left alone.
function finalize(s) { return tidy(s).replace(/‐\s*/g, ""); }
// page furniture that repeats across page breaks — blank it so it never joins a cell
function isJunk(s) {
  var t = tidy(s);
  if (!t) return true;
  if (/^\d{1,3}$/.test(t)) return true;                       // page number / chapter "3"
  if (/^©?\s*11\.2025/.test(t)) return true;                  // footer date
  if (/^Volkswagen Group of America/.test(t)) return true;
  if (/^Service Item$/.test(t)) return true;                  // repeated table headers
  if (/^(Vehicle )?Applicability$/.test(t)) return true;
  if (/^Interval$/.test(t)) return true;
  if (/^Service Intervals$/.test(t)) return true;
  if (/^Service Item\b.*Applicability$/.test(t)) return true;   // repeated table header row
  return false;
}
// junk at the FRAGMENT level (a page-break token that slid into a column slice)
function junkFrag(t) {
  t = tidy(t);
  if (!t) return true;
  if (/^\d{1,3}$/.test(t)) return true;
  if (/^11\.2025$/.test(t)) return true;
  if (/^(Service Item|Interval|Applicability|Vehicle Applicability|Service Intervals)$/.test(t)) return true;
  return false;
}
// each item cell is centered on its checkbox line; given contiguous cells and the
// checkbox line-indices, recover each cell's [start,end] line range.
function cellRanges(checkLines, sectionStart) {
  var cells = [], prevEnd = sectionStart - 1;
  checkLines.forEach(function (c, i) {
    var start = prevEnd + 1;
    var end = 2 * c - start;                 // c is the midpoint of [start,end]
    if (end < c) end = c;
    if (i + 1 < checkLines.length && end >= checkLines[i + 1]) end = checkLines[i + 1] - 1;
    cells.push([Math.min(start, c), end]);
    prevEnd = end;
  });
  return cells;
}

// nearest mileage column for an X at char index x
function colFor(x, cols) {
  var best = -1, bd = 1e9;
  cols.forEach(function (c) { var d = Math.abs(c.idx - x); if (d < bd) { bd = d; best = c.mi; } });
  return bd <= 4 ? best : null;
}

function parseGrid(lines, milesLine) {
  var mline = lines[milesLine];
  // token start positions of 10K..100K
  var cols = [], re = /(\d+)K/g, m;
  while ((m = re.exec(mline))) cols.push({ idx: m.index, mi: parseInt(m[1], 10) * 1000 });
  function xs(reLabel) {
    var li = lines.findIndex(function (l, i) { return i > milesLine && reLabel.test(l); });
    if (li < 0) return [];
    var out = [], ln = lines[li];
    for (var i = 0; i < ln.length; i++) if (ln[i] === "X") { var mi = colFor(i, cols); if (mi) out.push(mi); }
    return out.sort(function (a, b) { return a - b; });
  }
  return {
    miles: cols.map(function (c) { return c.mi; }),
    minor: xs(/Minor Maintenance/),
    standard: xs(/Standard Maintenance/),
    extended: xs(/Extended Maintenance/)
  };
}

// parse a 2-column (item | applicability) section between [start,end)
function parseItems(lines, start, end, appX) {
  var checks = [];
  for (var i = start; i < end; i++) if (hasCheck(lines[i]) && !isJunk(lines[i])) checks.push(i);
  if (!checks.length) return [];
  var cells = cellRanges(checks, start);
  return cells.map(function (rng) {
    var left = [], right = [];
    for (var j = rng[0]; j <= rng[1] && j < end; j++) {
      var ln = lines[j] || ""; if (isJunk(ln)) continue;
      var l = tidy(ln.slice(0, appX)), rr = tidy(ln.slice(appX));
      if (l && !junkFrag(l)) left.push(l);
      if (rr && !junkFrag(rr)) right.push(rr);
    }
    return { item: finalize(left.join(" ")), applic: finalize(right.join(" ")) };
  }).filter(function (r) { return r.item; });
}

function newInterval(s) { return /^(Every\b|At\s+\d|[-–]\s*\d)/.test(tidy(s)); }

// ---- runs-based (x/y) parsing for the dense Additional Items table ----
// join runs on one visual row into text, gluing adjacent runs / spacing gaps.
function joinRuns(runs) {
  runs = runs.slice().sort(function (a, b) { return a.x - b.x; });
  var s = "", endX = -1e9;
  runs.forEach(function (p) {
    if (s && p.x - endX >= 1.0) s += " ";
    s += p.s; endX = Math.max(endX, p.end || p.x);
  });
  return s;
}
// cluster runs into visual rows by y (PDF y points up → sort desc)
function rowsByY(runs) {
  runs = runs.slice().sort(function (a, b) { return (b.y - a.y) || (a.x - b.x); });
  var rows = [], cur = null;
  runs.forEach(function (r) {
    if (!cur || cur.y - r.y > 4) { cur = { y: r.y, runs: [] }; rows.push(cur); }
    cur.runs.push(r);
  });
  rows.forEach(function (row) { row.text = finalize(joinRuns(row.runs)); });
  return rows;
}
// cluster run x-positions into column anchors (centers), sorted left→right. Runs in
// a column share an x within a couple points; columns are tens of points apart.
function columnAnchors(xs) {
  xs = xs.slice().sort(function (a, b) { return a - b; });
  var groups = [], g = null;
  xs.forEach(function (x) {
    if (!g || x - g.last > 25) { g = { sum: 0, n: 0, last: x }; groups.push(g); }
    g.sum += x; g.n++; g.last = x;
  });
  return groups.filter(function (gr) { return gr.n >= 2; }).map(function (gr) { return gr.sum / gr.n; });
}
// parse the whole (already y-stacked, in-band) Additional-Items run stream.
// Column boundaries come from the DATA's x-clusters (placed in the wide gaps
// between columns) — NOT a header word, whose x nearly coincides with the data.
// Items are bounded by y-gaps; a block with no checkbox is a page-break
// continuation of the item above it and is merged upward.
function parseAdditionalRuns(inBand, borders) {
  if (!inBand.length) return [];
  var anchors = columnAnchors(inBand.filter(function (r) { return !hasCheck(r.s); }).map(function (r) { return r.x; }));
  if (anchors.length < 3) return [];
  var ivX = (anchors[0] + anchors[1]) / 2, appX = (anchors[1] + anchors[2]) / 2;
  var rows = rowsByY(inBand);
  // EXACT item boundaries from the table's drawn borders: an item-boundary rule is
  // FULL-WIDTH (starts in the name column, x1 < ivX) — inner sub-row dividers only
  // span the interval/applic columns and are excluded. Cluster them by y (a single
  // visual line is drawn as 2-3 near-identical rules).
  var by = (borders || []).filter(function (b) { return b.x1 < ivX; }).map(function (b) { return b.y; }).sort(function (a, b) { return b - a; });
  var B = []; by.forEach(function (y) { if (!B.length || B[B.length - 1] - y > 4) B.push(y); });
  var blocks = [];
  if (B.length >= 2) {
    var prev = null;
    for (var bi = 0; bi < B.length - 1; bi++) {
      var hi = B[bi], lo = B[bi + 1];
      var rws0 = rows.filter(function (row) { return row.y <= hi + 1 && row.y > lo + 1; });
      if (!rws0.length) continue;
      var hasChk = rws0.some(function (row) { return row.runs.some(function (r) { return hasCheck(r.s); }); });
      if (hasChk || !prev) { prev = rws0.slice(); blocks.push(prev); }
      else { Array.prototype.push.apply(prev, rws0); }   // page-break continuation → merge up
    }
  } else {
    // fallback (no borders): centered-cell recurrence on checkbox row indices
    var checkIdx = [];
    rows.forEach(function (row, i) { if (row.runs.some(function (r) { return hasCheck(r.s); })) checkIdx.push(i); });
    blocks = cellRanges(checkIdx, 0).map(function (rng) { return rows.slice(rng[0], rng[1] + 1); });
  }
  return blocks.map(function (rws) {
    if (!rws.length) return null;
    // Collect each column's row fragments RAW (keeping the soft-hyphen ‐), then glue
    // once at the very end — so a word wrapped across a row OR page break (Pas‐/sat,
    // Ten‐/sioning) rejoins into one word instead of "Pas sat" / "Ten sioning".
    var name = [];
    var variants = [], curV = null;
    rws.forEach(function (row) {
      name.push(joinRuns(row.runs.filter(function (r) { return r.x < ivX; })));
      var iv = joinRuns(row.runs.filter(function (r) { return r.x >= ivX && r.x < appX; }));
      if (!tidy(iv)) return;
      if (!curV || newInterval(iv)) { curV = { startY: row.y, iv: [], ap: [] }; variants.push(curV); }
      curV.iv.push(iv);
    });
    if (!variants.length) variants.push({ startY: 1e9, iv: [], ap: [] });
    // applicability assigned to the variant whose vertical band contains its row
    // (models can begin a hair above their interval's first line → the −2 slack)
    rws.forEach(function (row) {
      var ap = joinRuns(row.runs.filter(function (r) { return r.x >= appX; }));
      if (!tidy(ap)) return;
      var k = 0;
      while (k + 1 < variants.length && variants[k + 1].startY >= row.y - 2) k++;
      variants[k].ap.push(ap);
    });
    return {
      item: finalize(name.join(" ")),
      variants: variants.map(function (v) { return { interval: finalize(v.iv.join(" ")), applic: finalize(v.ap.join(" ")) }; })
                        .filter(function (v) { return v.interval || v.applic; })
    };
  }).filter(function (r) { return r && r.item; });
}

function parseMaintenance(text) {
  var lines = text.split("\n");
  // section anchors
  function findLine(re, from) { for (var i = from || 0; i < lines.length; i++) if (re.test(lines[i])) return i; return -1; }
  function appXof(hdrLine) { var h = lines[hdrLine] || ""; var i = h.indexOf("Vehicle Applicability"); if (i < 0) i = h.indexOf("Applicability"); return i < 0 ? 110 : i; }
  function ivXof(hdrLine) { var m = /Interval/.exec(lines[hdrLine] || ""); return m ? m.index : 46; }

  function parseSchedule(from, to) {
    var milesLine = findLine(/—\s*Miles/, from);
    var grid = parseGrid(lines, milesLine);
    function section(reHdr, reNext) {
      var h = findLine(reHdr, from); if (h < 0 || h >= to) return null;
      var start = findLine(/Service Item\s+.*Applicability/, h);
      var end = findLine(reNext, start + 1); if (end < 0 || end > to) end = to;
      return { start: start, end: end, appX: appXof(start) };
    }
    var mi = section(/1\.\d\.1\s+Minor Maintenance/, /1\.\d\.2\s+Standard Maintenance/);
    var st = section(/1\.\d\.2\s+Standard Maintenance/, /1\.\d\.3\s+Extended Maintenance/);
    var ex = section(/1\.\d\.3\s+Extended Maintenance/, /1\.\d\.4\s+Additional Maintenance/);
    var out = {
      grid: grid,
      minor: mi ? parseItems(lines, mi.start + 1, mi.end, mi.appX) : [],
      standard: st ? parseItems(lines, st.start + 1, st.end, st.appX) : [],
      extended: ex ? parseItems(lines, ex.start + 1, ex.end, ex.appX) : [],
      additional: []   // filled from runs (see below)
    };
    return out;
  }

  var iceStart = findLine(/1\.1\s+Maintenance Schedule/);
  var bevStart = findLine(/1\.2\s+Maintenance Schedule/);
  return {
    ice: parseSchedule(iceStart, bevStart >= 0 ? bevStart : lines.length),
    bev: bevStart >= 0 ? parseSchedule(bevStart, lines.length) : null
  };
}

// find the repeated 3-col header row on a page → {y, ivX, appX}, or null
function findAddHeader(runs) {
  var rows = rowsByY(runs);
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (/Service Item/.test(r.text) && /Interval/.test(r.text) && /Applicability/.test(r.text)) {
      var ivX = null, apX = null;
      r.runs.slice().sort(function (a, b) { return a.x - b.x; }).forEach(function (run) {
        if (ivX == null && /^Interval/.test(run.s)) ivX = run.x;
        if (apX == null && /^(Applicability|Vehicle)/.test(run.s)) apX = run.x;
      });
      if (ivX != null && apX != null) return { y: r.y, ivX: ivX, appX: apX };
    }
  }
  return null;
}
function rowY(runs, re) { var rows = rowsByY(runs); for (var i = 0; i < rows.length; i++) if (re.test(rows[i].text)) return rows[i].y; return null; }

// collect Additional Items across the pages that hold one schedule's 1.d.4 table.
// startRe = the schedule's own additional header; endRe = the next schedule header.
function additionalFromPages(pages, startRe, endRe) {
  // Stack every page that holds this schedule's 1.d.4 table into ONE continuous
  // y-space so an item spanning a page break stays a single item. Each page's
  // in-band runs are shifted below the previous page's, with a gap larger than the
  // intra-item line spacing (so real item boundaries still split).
  var stacked = [], stackedB = [], yCursor = 1e6, started = false;
  for (var p = 0; p < pages.length; p++) {
    var runs = pages[p].runs, rules = pages[p].rules || [], txt = pages[p].lines.join("\n");
    if (!started && startRe.test(txt)) started = true;
    if (!started) continue;
    var hdr = findAddHeader(runs);
    var isEnd = endRe.test(txt);
    if (!hdr) { if (isEnd) break; continue; }
    var topY = hdr.y - 2;
    var botY = isEnd ? rowY(runs, endRe) : -1e9;
    var band = runs.filter(function (r) { return r.y < topY && r.y > botY && (hasCheck(r.s) || !junkFrag(r.s)); });
    if (band.length) {
      var maxY = Math.max.apply(null, band.map(function (r) { return r.y; }));
      var minY = Math.min.apply(null, band.map(function (r) { return r.y; }));
      var off = yCursor - maxY;
      band.forEach(function (r) { stacked.push({ x: r.x, y: r.y + off, s: r.s, end: r.end }); });
      // the drawn row borders in/around this page's band, shifted by the same offset
      rules.filter(function (b) { return b.y < topY + 6 && b.y > minY - 10 && (b.x2 - b.x1) > 50; })
           .forEach(function (b) { stackedB.push({ y: b.y + off, x1: b.x1, x2: b.x2 }); });
      yCursor = yCursor - (maxY - minY) - 30;
    }
    if (isEnd) break;
  }
  return parseAdditionalRuns(stacked, stackedB);
}

// ---- run ----
var buf = fs.readFileSync("/Users/ryanvanpolen/Downloads/2019 VW Maintenance Schedules.pdf");
var ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
V.pdfPages(ab).then(function (pages) {
  var text = pages.map(function (p) { return p.lines.join("\n"); }).join("\n");
  var r = parseMaintenance(text);
  r.ice.additional = additionalFromPages(pages, /1\.1\.4\s+Additional Maintenance/, /1\.2\s+Maintenance Schedule/);
  r.bev && (r.bev.additional = additionalFromPages(pages, /1\.2\.4\s+Additional Maintenance/, /ZZZ_NO_MATCH/));
  function dump(name, s) {
    console.log("\n===== " + name + " =====");
    console.log("grid:", JSON.stringify(s.grid));
    console.log("minor (" + s.minor.length + "):"); s.minor.forEach(function (x) { console.log("   [" + x.applic + "] " + x.item); });
    console.log("standard (" + s.standard.length + "):"); s.standard.forEach(function (x) { console.log("   [" + x.applic + "] " + x.item); });
    console.log("extended (" + s.extended.length + "):"); s.extended.forEach(function (x) { console.log("   [" + x.applic + "] " + x.item); });
    console.log("additional (" + s.additional.length + "):"); s.additional.forEach(function (x) {
      console.log("   • " + x.item);
      x.variants.forEach(function (v) { console.log("       {" + v.interval + "} [" + v.applic + "]"); });
    });
  }
  dump("ICE", r.ice);
  if (r.bev) dump("BEV", r.bev);
}).catch(function (e) { console.error("ERR", e && e.stack || e); });
