/*
 * H.A.H.N.S (Hardware, Advisories, Highlights, & Navigation Specialist) — core logic
 * --------------------------
 * Self-contained, no dependencies, no network, no storage.
 * Exposes a single global object: window.VWJB
 *
 *   VWJB.run()                -> scan the current page (+ same-origin frames) and show the panel
 *   VWJB.extract(text)        -> pure function: text in, categorized specs out (used by the test box)
 *   VWJB.renderInto(host, r)  -> render results into a host element using a private shadow root
 *
 * Everything below stays inside this file so it can be encoded verbatim into the
 * bookmarklet AND embedded into the installer/demo page. Tune the PATTERNS block
 * against real ELSA pages — that's the part most likely to need adjustment.
 */
(function () {
  "use strict";

  // build id, stamped in by tools/build.js so you can confirm which version is live
  var BUILD = "__BUILD__";
  // where techs re-grab the latest (used by the "check for latest" link and the
  // weekly update-check reminder)
  var SITE_URL = "https://flatratelabs.github.io/hahns/";
  // ---- weekly "check for updates" reminder (no network — pure local date) ----
  // Auto-update can't work on ELSA: its CSP blocks every request to our domain
  // (confirmed by the browser for connect-src AND img-src), so the app makes
  // ZERO network calls. Instead we nudge the tech once a week — anchored to
  // Wednesday — to open the setup page and compare versions. We persist ONLY a
  // date string (the Wednesday we last reminded for), never job/ELSA content, so
  // the no-network / retain-nothing posture stays fully intact.
  var REMIND_KEY = "vwjb_upd_reminder_v1";  // localStorage: Wednesday-marker last acknowledged
  var remindDue = false;                     // show the weekly update-check banner
  // transient one-line note for the vehicle bar (e.g. a blocked procedure scan
  // before a vehicle is loaded). Cleared once shown — never persisted.
  var vehNotice = "";

  // the segments captured by the last scan, kept so the build stamp can dump a
  // diagnostic of exactly what the page-walk saw (helps tune against real pages)
  var lastSegments = [];

  /* ------------------------------------------------------------------ *
   * LOCATE-ON-PAGE (v0.3.6) — the little magnifier on each found item.
   *   During a scan we remember which DOM element each extracted item came
   *   from, in an IN-MEMORY registry (never saved to storage — DOM nodes
   *   can't be serialized, and keeping nothing on disk is the product
   *   promise). Clicking an item's magnifier scrolls ELSA to that element
   *   and pulses it yellow. Because the panel + this registry are rebuilt
   *   fresh every page load, only items found on the page CURRENTLY on
   *   screen can be located; items collected on an earlier page of a
   *   multi-page job carry a loc id from a previous load (a different
   *   nonce) that won't resolve here, so their magnifier is greyed out.
   * ------------------------------------------------------------------ */
  // a per-load nonce so a saved loc id from an earlier page can't accidentally
  // resolve to a different element on this page (ids restart each load)
  var LOC_NONCE = "L" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  var locMap = {};         // loc id -> source DOM element (this page load only)
  var locSeq = 0;

  // remember an element and hand back a stable id (or "" when there's no element,
  // e.g. the plain-text paste path or a hand-added row)
  function registerLoc(el) {
    if (!el || el.nodeType !== 1) return "";
    var id = LOC_NONCE + ":" + (++locSeq);
    locMap[id] = el;
    return id;
  }
  // resolve a loc id to a still-attached element on THIS page, or null
  function locEl(id) {
    if (!id) return null;
    var el = locMap[id];
    if (!el) return null;
    try {
      var d = el.ownerDocument;
      if (!d || !d.documentElement || !d.documentElement.contains(el)) return null;
    } catch (e) { return null; }
    return el;
  }

  // the currently-highlighted element + its pending timers, so a new click
  // cancels the old pulse and fully restores the previous element's styling
  var hiState = null;
  function clearHi() {
    if (!hiState) return;
    var st = hiState; hiState = null;
    st.timers.forEach(function (t) { clearTimeout(t); });
    try {
      if (st.prevStyle === null) st.el.removeAttribute("style");
      else st.el.setAttribute("style", st.prevStyle);
    } catch (e) {}
  }
  // scroll ELSA to the element (incl. its iframe, if nested) and pulse it yellow,
  // then fade back. Uses inline !important styles only — no network, fully
  // reversible, never touches ELSA's stylesheets.
  function highlightOnPage(el) {
    clearHi();
    try { el.scrollIntoView({ behavior: "smooth", block: "center" }); }
    catch (e) { try { el.scrollIntoView(); } catch (e2) {} }
    try {
      var fe = el.ownerDocument && el.ownerDocument.defaultView && el.ownerDocument.defaultView.frameElement;
      if (fe && fe.scrollIntoView) fe.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (e3) {}
    var st = { el: el, prevStyle: el.getAttribute("style"), timers: [] };
    hiState = st;
    function paint(c) {
      try {
        el.style.setProperty("background-color", c, "important");
        el.style.setProperty("outline", "3px solid #ffce00", "important");
        el.style.setProperty("outline-offset", "1px", "important");
        el.style.setProperty("transition", "background-color .3s ease", "important");
      } catch (e) {}
    }
    var seq = ["#fff39a", "#ffe24d", "#fff39a", "#ffe24d", "#fff39a"];
    seq.forEach(function (c, i) {
      st.timers.push(setTimeout(function () { paint(c); }, i * 380));
    });
    // settle, then restore the element's original styling
    st.timers.push(setTimeout(function () { if (hiState === st) clearHi(); }, seq.length * 380 + 1600));
  }

  /* ------------------------------------------------------------------ *
   * 1. CONFIG — the five buckets and how we recognise each one.
   *    Edit these to fit how ELSA actually phrases things.
   * ------------------------------------------------------------------ */

  var FASTENER = /\b(bolt|bolts|screw|screws|nut|nuts|seal\w*|gasket|gaskets|o-?ring|o-?rings|ring|rings|circlip|circlips|washer|washers|stretch|micro-?encapsulated)\b/i;

  // a "refer to the tightening specifications/sequence figure" reference. The real
  // values live in a sequence DIAGRAM (no number on the page), so we capture the
  // reference under torque AND keep the supplementary sequence image.
  var SEQ_REF_RE = /\btightening\s+(?:specification|spec|sequence|procedure|order)/i;

  // if a numbered line's name STARTS WITH one of these whole words it's an
  // instruction or a section label, not a part. Matched on the entire first
  // word (not a prefix) so real parts like "Guide pin bolt" or "Pulley" survive.
  var STOP_FIRST = {};
  ("remove removing removal unscrew unscrewing install installing refit refitting undo loosen loosening tighten tightening " +
   "disconnect connect connecting check checking note position positioning pull press drain fill filling renew renewing " +
   "replace replacing insert detach attach raise lower clean apply lubricate measure adjust secure release slacken rotate " +
   "align move switch start observe always danger warning caution important allocation wear refer overview general assembly")
    .split(" ").forEach(function (w) { STOP_FIRST[w] = 1; });

  var SECTIONS = [
    {
      key: "torque",
      title: "Torque",
      label: true,
      autoPart: true,
      icon: "M14.7 6.3a4 4 0 0 0-5.4 5.4l-6 6 2 2 6-6a4 4 0 0 0 5.4-5.4l-2.3 2.3-2-2 2.3-2.3z",
      // a number immediately followed by Nm, OR an angle/stage line near torque wording
      test: function (line) {
        // a torque WRENCH is a special tool, not a torque spec. Only skip it when
        // the line is clearly a wrench LISTING: it carries a tool number AND has
        // "torque wrench" directly followed by an Nm RANGE (the tool's capacity,
        // e.g. "VAG 1331A, Torque Wrench 6-50 Nm"). A real tightening instruction
        // that merely mentions a torque wrench (a single target value) is KEPT.
        if (/\btorque\s+wrench\b/i.test(line)) {
          TOOL_RE.lastIndex = 0;
          var wrenchListing = TOOL_RE.test(line) &&
            /\btorque\s+wrench\b[^.]*?\d+(?:[.,]\d+)?\s*-\s*\d+(?:[.,]\d+)?\s*N\s*m\b/i.test(line);
          TOOL_RE.lastIndex = 0;
          if (wrenchListing) return false;
        }
        if (/\d+(?:[.,]\d+)?\s*N\s*m\b/i.test(line)) return true;
        if (/\b(stage|step)\b/i.test(line) && /(\d+\s*°|\d+\s*degrees?|turn\s+(?:a\s+)?(?:further\s+)?\d+)/i.test(line)) return true;
        if (/\btighten\b/i.test(line) && /(\d+\s*°|\d+\s*degrees?)/i.test(line)) return true;
        // a "refer to the tightening specs/sequence figure" line — the bolt's
        // torque is given by a sequence diagram, so surface it as a torque entry
        if (SEQ_REF_RE.test(line)) return true;
        return false;
      }
    },
    {
      key: "replace",
      title: "Replace after removal",
      label: true,
      autoPart: true,
      icon: "M20 11a8 8 0 1 0-2.3 5.7M20 4v5h-5",
      // one-time-use parts. ELSA phrases this many ways, e.g.:
      //   "Always renew", "Always replace after removing", "replace if removed",
      //   "Mandatory replacement", "must be renewed", "do not re-use",
      //   "single use", "renew the bolts after loosening", etc.
      // We match the strong phrasings on their own, plus replace/renew + a fastener.
      test: function (line) {
        // a bare "Replace" / "Renew" note on its own line — ELSA's one-time-use
        // legend marker against a numbered component. Anchored ^...$ so it only
        // fires on the lone word (incl. "Replaced"/"Renewal", trailing period),
        // never on instructions like "Replace the cover" (= reinstall, not one-use).
        if (/^(?:replac\w*|renew\w*)\.?$/i.test(line)) return true;
        // replace / renew ... after|if|when removed|loosened|undone|disturbed
        if (/\b(?:replac\w*|renew\w*)(?:\s+\w+){0,4}\s+(?:after|if|when|once|whenever|each\s+time|every\s+time|prior\s+to|before)\s+(?:it\s+is\s+|they\s+are\s+|being\s+|been\s+|re-?)?(?:remov\w*|loosen\w*|undone|undoing|slacken\w*|disturb\w*|unscrew\w*|detach\w*|disconnect\w*|opening|opened)\b/i.test(line)) return true;
        // mandatory replacement / replacement is mandatory
        if (/\b(?:mandatory\s+(?:replac\w*|renew\w*)|(?:replac\w*|renew\w*)\s+(?:is\s+|are\s+)?mandatory|replacement\s+(?:is\s+|are\s+)?(?:mandatory|required|compulsory|essential))\b/i.test(line)) return true;
        // must (always) be replaced / always replace / always renew
        if (/\b(?:must\s+(?:always\s+|each\s+time\s+)?be\s+(?:replac\w*|renew\w*)|(?:always|each\s+time)\s+(?:replac\w*|renew\w*))\b/i.test(line)) return true;
        // do not re-use / non-reusable / cannot be reused / never re-use
        if (/\b(?:do\s+not\s+re-?use|not\s+(?:to\s+)?be\s+re-?used|(?:non-?|not\s+)re-?usable|cannot\s+be\s+re-?used|never\s+re-?use|must\s+not\s+be\s+re-?used)\b/i.test(line)) return true;
        // single use / one-time use / use once / discard and renew
        if (/\b(?:single[-\s]?use|one[-\s]?time\s+use|use\s+(?:only\s+)?once|discard\s+(?:and\s+)?(?:replac\w*|renew\w*)?)\b/i.test(line)) return true;
        // fallback: a replace/renew instruction that names a fastener or seal
        if (/\b(?:renew\w*|replac\w*)\b/i.test(line) && FASTENER.test(line)) return true;
        return false;
      }
    },
    {
      key: "fluids",
      title: "Fluids & capacities",
      icon: "M12 2.7s6 6.6 6 10.3a6 6 0 0 1-12 0c0-3.7 6-10.3 6-10.3z",
      // NOT scanned from the repair manual (fluids live in a separate per-year PDF).
      // Instead this section is a link that opens the vehicle-matched fluid lookup
      // page in a new window (off ELSA, so it can load the data). See vehFluidsUrl().
      linkOnly: true,
      test: function () { return false; }
    },
    {
      key: "tools",
      title: "Special tools",
      icon: "M14.7 6.3a4 4 0 0 0-5.4 5.4l-6 6 2 2 6-6a4 4 0 0 0 5.4-5.4l-2.3 2.3-2-2 2.3-2.3z",
      // distinctive VW tool numbers (incl. a "/N" sub-part), or an explicit
      // "special tool" mention. The actual parsing + de-duping is done by
      // toolEntries() in the extract loop (the tools bucket is special-cased).
      test: function (line) {
        if (TOOL_RE.test(line)) { TOOL_RE.lastIndex = 0; return true; }
        if (/\bspecial\s+tool\b/i.test(line)) return true;
        return false;
      }
    },
    {
      key: "warnings",
      title: "Critical warnings",
      icon: "M12 3 2 20h20L12 3zM12 9v5M12 17.5v.5",
      test: function (line) {
        if (/\b(warning|caution|danger|attention|important)\b/i.test(line)) return true;
        if (/\b(risk\s+of|injury|scalding|burns?|hot\s+(?:coolant|oil|surface)|under\s+pressure|pressuris|pressuriz|airbag|pyrotechnic|disconnect\s+the\s+battery|high\s+voltage)\b/i.test(line)) return true;
        return false;
      }
    }
  ];

  /* ------------------------------------------------------------------ *
   * 2. EXTRACT — text -> { torque:[...], replace:[...], ... }
   * ------------------------------------------------------------------ */

  function splitLines(text) {
    return String(text || "")
      .replace(/ /g, " ")
      .split(/\r?\n|(?<=\.)\s{2,}/)
      .map(function (l) { return l.replace(/\s+/g, " ").trim(); })
      .filter(function (l) { return l.length > 2 && l.length < 400; });
  }

  // is a string a usable part name (a noun phrase, not a spec or an instruction)?
  function cleanPartName(name) {
    name = String(name).trim().replace(/[\s.,;:]+$/, "");
    if (name.length < 2 || name.length > 50 || !/[A-Za-z]/.test(name)) return null;
    if (/\d\s*(?:Nm|°)/i.test(name)) return null;   // it's a spec value, not a part
    var first = name.toLowerCase().split(/[\s.,;:()]+/)[0].replace(/[^a-z]/g, "");
    if (STOP_FIRST[first]) return null;              // first word is an instruction/section word
    return name;
  }

  // ELSA assembly-overview legends number each part. Real ELSA uses a PERIOD,
  // e.g. "2. Torx Bolt"; some manuals use a dash "2 - Torx Bolt". Accept both.
  // Returns "2. Torx Bolt" (number kept so the tech can match it to the diagram).
  function partFromHeading(line) {
    var m = line.match(/^\s*(\d{1,3}|[A-Za-z])\s*[-–—.)]\s+(.{2,50})$/);
    if (!m) return null;
    var name = cleanPartName(m[2]);
    if (!name) return null;
    return m[1].trim() + ". " + name;
  }

  // a line that is ONLY a callout marker, e.g. "2." or "2 -" — used when the
  // number and the name land in separate cells/elements.
  function loneMarker(line) {
    var m = line.match(/^\s*(\d{1,3}|[A-Za-z])\s*[-–—.)]\s*$/);
    return m ? m[1].trim() : null;
  }

  // ELSA flags safety text with one of four colored banners — DANGER (red),
  // WARNING (orange), CAUTION (yellow), NOTE (light blue). The banner word is its
  // own styled element, so it usually lands in its own segment ahead of the text.
  // We map each to a severity so the panel can colour-match ELSA. NOTE matters
  // most here: its text has no warning keyword of its own, so it was being missed
  // — and it's matched ONLY as a real banner (never the loose word "note") so a
  // sentence like "Note the gap" can't false-trigger.
  var BANNERS = { DANGER: "danger", WARNING: "warning", CAUTION: "caution", NOTE: "note" };

  // a segment that is ONLY a banner word (any case, optional trailing : or !)
  function bannerLabel(line) {
    var m = line.match(/^\s*(danger|warning|caution|note)\s*[:!]?\s*$/i);
    return m ? BANNERS[m[1].toUpperCase()] : null;
  }

  // a banner word glued to its text on one line: "WARNING: ...", "NOTE - ...", or
  // an UPPERCASE header run together with the text ("DANGER Texts with this ...").
  function inlineBanner(line) {
    var m = line.match(/^\s*(danger|warning|caution|note)\s*[:!\-–—]\s+(.{2,})$/i);
    if (m) return { sev: BANNERS[m[1].toUpperCase()], text: m[2].replace(/\s+/g, " ").trim() };
    m = line.match(/^\s*(DANGER|WARNING|CAUTION|NOTE)\s+(.{3,})$/);   // uppercase only, no false hits
    if (m) return { sev: BANNERS[m[1]], text: m[2].replace(/\s+/g, " ").trim() };
    return null;
  }

  // best-guess severity for a warning line caught by the keyword test but with no
  // explicit banner: colour follows the word; risk-only lines default to amber.
  function sevFromText(line) {
    if (/\bdanger\b/i.test(line)) return "danger";
    if (/\bcaution\b/i.test(line)) return "caution";
    return "warning";
  }

  // matches a VW special-tool number, incl. a trailing "/N" sub-part. Forms:
  //   T10145 / T10145/1            (T-numbers)
  //   VAS 6395 / VAS6395A          (VAS numbers)
  //   VAG 1331A / V.A.G 1332A      (V.A.G/VAG numbers, with or without the dots,
  //                                 now incl. a trailing letter like 1331A)
  //   10-222 A / 10-222A/1         (classic hyphenated tool numbers + sub-parts;
  //                                 the trailing letter is REQUIRED here so plain
  //                                 ranges like "6-50 Nm" / "40-200 Nm" don't match)
  var TOOL_RE = /\b(?:T\d{3,5}[A-Z]?(?:\/\d+)?|VAS\s?\d{3,5}[A-Z]?(?:\/\d+)?|V\.?A\.?[SG]\.?\s?\d{3,4}\s?[A-Z]?(?:\/\d+)?|\d{1,3}-\d{2,3}\s?[A-Z](?:\/\d+)?)\b/gi;

  // ELSA writes tools as "<Tool Name> - <number> -". Pull the tool name out of the
  // text BEFORE the number: drop a trailing separator, keep the nearest clause,
  // and strip leading filler verbs (Use/With/Install/the…) so we're left with the
  // name. Returns "" when nothing name-like remains (then we just show the number).
  function toolDescBefore(before) {
    var s = String(before).replace(/[\s\-–—:,.]+$/, "").trim();
    if (!s) return "";
    s = s.split(/[.;:]\s+/).pop();                  // the clause nearest the number
    var prev;
    do { prev = s;
      s = s.replace(/^(?:use|using|with|via|install|installing|installed|fit|fitting|fitted|the|a|an|by|of|means|to|and|then|now|first|see|refer|insert|inserting)\s+/i, "");
    } while (s !== prev);
    s = s.replace(/[\s\-–—:,]+$/, "").replace(/\s+/g, " ").trim();
    if (s.length < 2 || s.length > 60 || !/[A-Za-z]/.test(s)) return "";
    return s;
  }

  // fallback: a name AFTER the number ("- T10145/1 - Caliper Piston Tool"). Only
  // accept a leading run of Title-Case words so we don't grab a following sentence.
  function toolDescAfter(after) {
    var s = String(after).replace(/^[\s\-–—:,.]+/, "").trim();
    if (!s) return "";
    var m = s.match(/^((?:[A-Z][\w\/&.\-]*\s+){0,5}[A-Z][\w\/&.\-]*)/);
    if (!m) return "";
    var name = m[1].replace(/\s+/g, " ").trim();
    return (name.length < 2 || name.length > 60) ? "" : name;
  }

  // every tool number on a line, paired with a best-guess description, deduped order
  function toolEntries(line) {
    var out = [];
    TOOL_RE.lastIndex = 0;
    var m;
    while ((m = TOOL_RE.exec(line))) {
      var num = m[0].replace(/\s+/g, " ").trim();
      var desc = toolDescBefore(line.slice(0, m.index)) ||
                 toolDescAfter(line.slice(m.index + m[0].length));
      out.push({ num: num, desc: desc });
    }
    return out;
  }

  // unique tool numbers across the whole job (drives the blue chips)
  function toolNums(r) {
    var seen = {}, out = [];
    (r.tools || []).forEach(function (it) {
      var n = it.num || "";
      if (n && !seen[n.toLowerCase()]) { seen[n.toLowerCase()] = 1; out.push(n); }
    });
    return out;
  }

  // Core extractor. Works on ordered SEGMENTS: { text, bold }.
  //   A component callout is a line like "2. Torx Bolt". We detect it by the
  //   number-period-name PATTERN plus the STOP_FIRST word filter (which rejects
  //   numbered procedure steps like "1. Remove ..."). Bold is a helpful hint on
  //   real ELSA pages but NOT required — detection must work even when the
  //   page's bold styling isn't something we can read.
  //   keepImgUrls (optional): a set {url:1} of the DOMINANT diagram URLs (from
  //   pickDiagrams). Only those images act as figure boundaries, so a small
  //   non-dominant image on the page can't wrongly restart the bolt numbering.
  function extractSegments(segments, keepImgUrls) {
    lastSegments = segments;   // kept for the one-click diagnostic dump
    var results = {};
    var seen = {};
    SECTIONS.forEach(function (s) { results[s.key] = []; seen[s.key] = {}; });

    // carry the current legend part name down onto the specs listed under it,
    // until the next callout heading. ttl is a safety budget against bleed.
    var currentPart = "";
    var ttl = 0;
    var pending = "";        // a bare "2." whose name is in the next segment
    var partNum = 0;         // running component count for ELSA "+ ADD" legends
    var expectName = false;  // the previous segment was an "+ ADD" button
    var pendingSev = "";     // a lone banner word (DANGER/…/NOTE) colours the next line
    var figIdx = 0;          // which diagram (figure) on the page we're under
    var sawPart = false;     // a numbered part has been collected for this figure
    var figImages = [];      // [{url, fig}] diagram markers in DOM order
    var inSeqTable = false;  // inside a "Step | Bolts | Tightening Spec" table
    var seqTitle = "";       // heading above the sequence table/diagram

    segments.forEach(function (seg) {
      // a diagram image marker (from gatherSegments). If we've already numbered a
      // part under the current figure, this image starts the NEXT one: bump the
      // figure and restart component numbering so each diagram reads 1, 2, 3…
      if (seg.img) {
        // ignore non-dominant images entirely when we know the kept set — only a
        // real assembly diagram should start a new figure / restart numbering
        if (keepImgUrls && !keepImgUrls[seg.url]) return;
        if (sawPart) {
          figIdx++; partNum = 0; sawPart = false;
          currentPart = ""; ttl = 0; pending = ""; expectName = false; pendingSev = "";
        }
        figImages.push({ url: seg.url, fig: figIdx });
        return;
      }
      var line = String(seg.text || "").replace(/\s+/g, " ").trim();
      if (!line) return;

      // ---- tightening-sequence TABLE (Step | Bolts | Tightening Spec) ----
      // ELSA renders this as a table whose Step column ("1.", "2." …) looks exactly
      // like a component callout, which used to mangle it (fake parts, dropped °-only
      // rows, header stuck onto the last component). Detect the header, then parse
      // each row into an ordered step and keep it OUT of the component/torque
      // heuristics. Steps land in torque as "Step N → Bolts X — spec", with seq:true.

      // the heading above the sequence table/diagram (e.g. "Cylinder Head -
      // Tightening Specifications and Sequence") — used as the group header for the
      // sequence. NOT a "refer to Fig" reference (that stays as a bolt's torque spec).
      if (/tightening/i.test(line) && /\bsequence\b/i.test(line) && !/refer\s+to/i.test(line) && !/^step\b/i.test(line)) {
        seqTitle = line.replace(/[\s.;:]+$/, "").trim();
        results.__seqSeen = true;
        return;                            // it's a heading, not a spec — don't emit it
      }
      if (/^step\b/i.test(line) && /\bbolts?\b/i.test(line) && /tightening/i.test(line)) {
        inSeqTable = true; results.__seqSeen = true;   // header row — consume it
        return;
      }
      if (inSeqTable) {
        var srow = line.match(/^(\d{1,3})[.)]?\s+(.+)$/);
        if (srow) {
          var srest = srow[2];
          var bsplit = srest.match(/^(\d+(?:\s*(?:through|thru|to|[-–—])\s*\d+)?(?:\s*(?:,|and|\+|&)\s*\d+(?:\s*(?:through|thru|to|[-–—])\s*\d+)?)*)\s+(.+)$/i);
          var sbolts = bsplit ? bsplit[1].replace(/\s+/g, " ").trim() : "";
          var sspec = bsplit ? bsplit[2].trim() : srest.trim();
          var stext = (sbolts ? "Bolts " + sbolts + " — " : "") + sspec;
          var skey = ("seq||" + srow[1] + "||" + stext).toLowerCase();
          if (!seen.torque[skey]) {
            seen.torque[skey] = 1;
            results.torque.push({ text: stext, part: "Step " + srow[1], fig: figIdx, seq: true, seqTitle: seqTitle || "Tightening Specifications and Sequence", loc: registerLoc(seg.el) });
          }
          return;
        }
        inSeqTable = false;                // a non-step row ends the table
      }

      var handled = false;
      var ph = partFromHeading(line);            // explicit "2. Torx Bolt" in the text
      if (ph) {
        currentPart = ph; ttl = 8; pending = ""; expectName = false; handled = true; sawPart = true;
      } else if (/^(?:\+\s*)?(?:add|ajouter)$/i.test(line)) {
        // ELSA renders an "+ ADD" button right before each component name. The
        // visible "1./2./3." numbers are list markers (not text), so we count
        // the components ourselves — the Nth ADD'd part is callout N.
        expectName = true; handled = true;
      } else if (expectName) {
        expectName = false;
        var nm = cleanPartName(line);
        partNum++;                               // every ADD is one numbered component
        currentPart = partNum + ". " + (nm || line);
        ttl = 8; pending = "";
        handled = true; sawPart = true;
      } else {
        var lm = loneMarker(line);               // a bare "2." (number split off)
        if (lm) { pending = lm; handled = true; }
        else if (pending) {                      // the line right after a lone number
          var nm2 = cleanPartName(line);
          if (nm2) { currentPart = pending + ". " + nm2; ttl = 8; sawPart = true; }
          pending = "";
          handled = true;
        }
      }
      if (!handled && ttl > 0) { ttl--; if (ttl === 0) currentPart = ""; }

      // ---- safety-banner severity (DANGER / WARNING / CAUTION / NOTE) ----
      // A lone banner word just colours the NEXT content line — that's how the
      // text under a NOTE banner (which has no warning keyword) gets captured.
      var lineSev = "";          // severity to colour this line's warning, if any
      var warnText = line;       // warning text with any inline banner word stripped
      var bannerHeader = handled ? null : bannerLabel(line);
      if (bannerHeader) {
        pendingSev = bannerHeader;
      } else if (!handled) {
        var ib = inlineBanner(line);
        if (ib) { lineSev = ib.sev; warnText = ib.text; pendingSev = ""; }
        else if (pendingSev) { lineSev = pendingSev; pendingSev = ""; }
      } else {
        // a structural line (ADD / marker / heading) — a pending banner with no
        // plain text after it just lapses, so it can't leak onto a part name/spec
        pendingSev = "";
      }

      SECTIONS.forEach(function (s) {
        if (s.key === "warnings") {
          // warnings carry a severity → the panel colour-matches ELSA's banner.
          // Include a line if it has a banner severity OR trips the keyword test.
          if (handled || bannerHeader) return;          // skip part lines + the bare banner word
          if (!(lineSev || s.test(warnText))) return;
          var sev = lineSev || sevFromText(warnText);
          var wk = ("warn||" + sev + "||" + warnText).toLowerCase();
          if (seen.warnings[wk]) return;
          seen.warnings[wk] = 1;
          results.warnings.push({ text: warnText, part: "", sev: sev, loc: registerLoc(seg.el) });
          return;
        }
        if (s.key === "tools") {
          // ONE entry per unique tool number (a tool is usually cited many times),
          // each with a parsed name when we can find one. A bare "special tool"
          // mention with no number is kept as a text-only entry.
          var entries = toolEntries(line);
          if (entries.length) {
            entries.forEach(function (e) {
              var tk = e.num.toLowerCase();
              if (seen.tools[tk]) {
                // already have it — fill in a description if this sighting has one
                if (e.desc) results.tools.forEach(function (it) { if (it.num && it.num.toLowerCase() === tk && !it.desc) { it.desc = e.desc; it.text = it.num + " — " + e.desc; } });
                return;
              }
              seen.tools[tk] = 1;
              results.tools.push({ num: e.num, desc: e.desc, text: e.num + (e.desc ? " — " + e.desc : ""), part: "", loc: registerLoc(seg.el) });
            });
          } else if (/\bspecial\s+tool\b/i.test(line)) {
            var sk = "txt::" + line.toLowerCase();
            if (!seen.tools[sk]) { seen.tools[sk] = 1; results.tools.push({ num: "", desc: "", text: line, part: "", loc: registerLoc(seg.el) }); }
          }
          return;
        }
        if (!s.test(line)) return;
        // auto part names only flow into torque/replace; fluids keeps the manual
        // chip but won't grab a stray legend name (capacities aren't callout parts)
        var part = s.autoPart ? currentPart || "" : "";
        // dedup on part + text, so the SAME wording under different components
        // (e.g. "Always replace after removing" on two separate bolts) is kept.
        // For figure-aware sections, scope the key to the figure too, so an
        // identical spec that legitimately repeats on a 2nd diagram isn't dropped.
        var key = ((s.autoPart ? figIdx + "::" : "") + part + "||" + line).toLowerCase();
        if (seen[s.key][key]) return;
        seen[s.key][key] = 1;
        var rec = { text: line, part: part, loc: registerLoc(seg.el) };
        if (s.autoPart) rec.fig = figIdx;
        results[s.key].push(rec);
      });
    });

    // cap each list so the panel never gets out of hand
    SECTIONS.forEach(function (s) {
      if (results[s.key].length > 40) results[s.key] = results[s.key].slice(0, 40);
    });
    results.__figImages = figImages;   // diagram markers + their figure index
    return results;
  }

  // Plain-text path (the paste box and tests). With no styling to read, we mark
  // any line that *looks* like a numbered callout as a heading candidate and let
  // the STOP_FIRST word filter reject numbered procedure steps.
  function segmentsFromText(text) {
    return splitLines(text).map(function (line) {
      return { text: line, bold: /^\s*(?:\d{1,3}|[A-Za-z])\s*[-–—.)]\s+\S/.test(line) || /^\s*(?:\d{1,3}|[A-Za-z])\s*[-–—.)]\s*$/.test(line) };
    });
  }

  function extract(text) {
    return extractSegments(segmentsFromText(text));
  }

  /* ------------------------------------------------------------------ *
   * 2a. VEHICLE — read the ELSA "Vehicle Summary" page once, up front.
   *     We pull five identity fields (VIN, Model Year, Model Name, Engine
   *     Code, Trans Type) so the rest of the job is anchored to a known
   *     vehicle. Tuned against a real Vehicle Summary dump (ATLAS, 2026-06):
   *     ELSA lays each field out as a "Vehicle Data" section where the label
   *     ("Model Name", "Engine Code", …) is its own line and the value is the
   *     NEXT line. We anchor the matchers to those exact labels so stray text
   *     on a repair page can't trip them.
   *
   *     IMPORTANT: a VIN ALONE is NOT proof we're on the summary — ELSA shows
   *     the selected VIN in its header on EVERY page. `isVehicleSummaryPage`
   *     gates loading on the summary's own structure (see below), so a repair
   *     page's header VIN never loads a vehicle.
   * ------------------------------------------------------------------ */

  // a VIN is 17 chars from A–Z/0–9 with I, O and Q excluded
  var VIN_RE = /\b[A-HJ-NPR-Z0-9]{17}\b/;
  function looksVin(t) { return VIN_RE.test(t) && /[0-9]/.test(t) && /[A-Z]/.test(t); }

  function vehLines(segments) {
    return (segments || [])
      .map(function (s) { return String(s.text || "").replace(/\s+/g, " ").trim(); })
      .filter(function (l) { return l; });
  }

  // the four identity labels as they appear on the Vehicle Summary, each
  // ANCHORED to the start of its own line (so "model" buried in a sentence on a
  // repair page can't match). Shared by extraction and the page-type gate.
  var VEH_LABELS = {
    year:   /^model\s*year\b/i,
    model:  /^model\s*name\b/i,
    engine: /^engine\s*code\b/i,
    trans:  /^trans(?:mission)?\s*type\b|^gearbox\s*type\b/i
  };
  // Electric vehicles' Vehicle Summary has NO single "Engine Code" / "Trans Type" —
  // it lists Front/Rear motor and transaxle codes instead. Match those so EVs load
  // their codes too (used by the fluids lookup for the single-speed reduction gear).
  var VEH_LABELS_EV = {
    engine: /^(?:front|rear)\s*(?:e-?motor|engine|motor)\s*code(?:\(s\))?/i,
    trans:  /^(?:front|rear)\s*(?:trans(?:mission)?|gearbox|transaxle)\.?\s*(?:type|code)(?:\(s\))?/i
  };
  // value cell for an engine/motor code: a 2–5 letter code, optional digits/suffix
  var ENG_VAL = /^([A-Za-z]{2,5}\d{0,2}[A-Za-z]?)\b/;

  // value for a labelled field: the rest of the label's own line if anything
  // follows it, otherwise the NEXT line (ELSA's label-cell / value-cell layout).
  function vehField(lines, labelRe, valRe) {
    for (var i = 0; i < lines.length; i++) {
      var m = lines[i].match(labelRe);
      if (!m) continue;
      var rest = lines[i].slice(m[0].length).replace(/^[\s:#.\-–—=|]+/, "").trim();
      var raw = rest || (i + 1 < lines.length ? lines[i + 1].trim() : "");
      if (!raw) continue;
      if (valRe) { var vm = raw.match(valRe); if (vm) return (vm[1] || vm[0]).trim(); continue; }
      return raw.replace(/\s+/g, " ").slice(0, 60).trim();
    }
    return "";
  }

  // like vehField, but collects EVERY matching label's value (EVs carry a Front and
  // a Rear code), deduped and order-preserving. Returns an array.
  function vehFieldAll(lines, labelRe, valRe) {
    var out = [];
    for (var i = 0; i < lines.length; i++) {
      var m = lines[i].match(labelRe);
      if (!m) continue;
      var rest = lines[i].slice(m[0].length).replace(/^[\s:#.\-–—=|]+/, "").trim();
      var raw = rest || (i + 1 < lines.length ? lines[i + 1].trim() : "");
      if (!raw) continue;
      var val;
      if (valRe) { var vm = raw.match(valRe); val = vm ? (vm[1] || vm[0]).trim() : ""; }
      else { val = raw.replace(/\s+/g, " ").slice(0, 60).trim(); }
      if (val && out.indexOf(val) < 0) out.push(val);
    }
    return out;
  }

  // Is the scanned page actually ELSA's Vehicle Summary? A VIN alone isn't enough
  // (it's in the header on every page), so we require the summary's own structure:
  // the "Vehicle Data" section, and/or its labelled identity fields on their own
  // lines. Two label hits — or the section header plus one — is the threshold.
  function isVehicleSummaryPage(segments) {
    var lines = vehLines(segments);
    var hasHeader = lines.some(function (l) { return /^vehicle\s*data\b/i.test(l); });
    var hits = 0;
    [VEH_LABELS.year, VEH_LABELS.model, VEH_LABELS.engine, VEH_LABELS.trans,
     VEH_LABELS_EV.engine, VEH_LABELS_EV.trans].forEach(function (re) {
      if (lines.some(function (l) { return re.test(l); })) hits++;
    });
    return hits >= 2 || (hasHeader && hits >= 1);
  }

  // returns { vin, year, model, engine, trans } — any field may be "" (blank).
  // Only meaningful when isVehicleSummaryPage() is true for the same page.
  function extractVehicle(segments) {
    var lines = vehLines(segments);
    var v = { vin: "", year: "", model: "", engine: "", trans: "" };

    // VIN — prefer a line that names it; fall back to any VIN-shaped token
    for (var i = 0; i < lines.length && !v.vin; i++) {
      if (/\bVIN\b|chassis|vehicle\s*identification/i.test(lines[i])) {
        var m = lines[i].toUpperCase().match(VIN_RE);
        if (!m && i + 1 < lines.length) m = lines[i + 1].toUpperCase().match(VIN_RE);
        if (m && looksVin(m[0])) v.vin = m[0];
      }
    }
    if (!v.vin) {
      for (var j = 0; j < lines.length; j++) {
        var u = lines[j].toUpperCase(), mm = u.match(VIN_RE);
        if (mm && looksVin(mm[0])) { v.vin = mm[0]; break; }
      }
    }

    v.year   = vehField(lines, VEH_LABELS.year, /\b((?:19|20)\d{2})\b/);
    v.model  = vehField(lines, VEH_LABELS.model, null);
    v.engine = vehField(lines, VEH_LABELS.engine, ENG_VAL);
    v.trans  = vehField(lines, VEH_LABELS.trans, null);
    // EV summaries have no single Engine Code / Trans Type — collect the Front/Rear
    // motor + transaxle codes instead (joined "FRONT / REAR" for display + lookup).
    if (!v.engine) v.engine = vehFieldAll(lines, VEH_LABELS_EV.engine, ENG_VAL).join(" / ");
    if (!v.trans)  v.trans  = vehFieldAll(lines, VEH_LABELS_EV.trans, null).join(" / ");
    return v;
  }

  // the five fields in display order — shared by the panel, copy, print, dump
  var VEH_FIELDS = [
    { k: "vin",    label: "VIN" },
    { k: "year",   label: "Model Year" },
    { k: "model",  label: "Model Name" },
    { k: "engine", label: "Engine Code" },
    { k: "trans",  label: "Trans Type" }
  ];
  function vehLoaded(r) { return !!(r && r.__vehicle && r.__vehicle.vin); }
  function vehMissing(v) {
    return VEH_FIELDS.filter(function (f) { return !(v && v[f.k]); }).map(function (f) { return f.label; });
  }
  // the fluid-lookup URL for the loaded vehicle. Opens on OUR origin (off ELSA, so
  // its CSP doesn't apply), carrying the specs needed to match — year/model/engine/
  // trans. Deliberately NO VIN (not needed, and shouldn't ride in a URL). Needs a
  // year to pick the data file; "" if the year is blank.
  function vehFluidsUrl(r) {
    var v = (r && r.__vehicle) || {};
    if (!v.year) return "";
    var q = "y=" + encodeURIComponent(v.year) + "&m=" + encodeURIComponent(v.model || "") +
      "&e=" + encodeURIComponent(v.engine || "") + "&t=" + encodeURIComponent(v.trans || "");
    // cache-buster: GitHub Pages serves fluids.html with max-age=600, so without this
    // a tech can see a stale (old-color / old-data) copy for ~10 min after an update.
    // Keyed to BUILD so it changes every release → a re-drag always loads the fresh page.
    q += "&_=" + encodeURIComponent(BUILD);
    return SITE_URL + "fluids.html?" + q;
  }

  /* ------------------------------------------------------------------ *
   * 2b. JOB — accumulate specs across pages. The running list lives in
   *     sessionStorage so it survives navigating ELSA page-to-page and
   *     auto-erases when the tab/browser closes (or on "New job").
   * ------------------------------------------------------------------ */

  var STORE_KEY = "vwjb_job_v1";

  function emptyResults() {
    var r = {};
    SECTIONS.forEach(function (s) { r[s.key] = []; });
    r.__title = "";
    r.__images = [];   // [{ src: pageHeader, url }] — diagram references, not copies
    r.__vehicle = null; // { vin, year, model, engine, trans } once the summary is scanned
    return r;
  }

  // large image candidates on the page (with rendered area), recursing same-origin
  // frames. Skips icons/logos/pixels by filename and small graphics by size.
  function gatherImages(doc, out) {
    out = out || [];
    try {
      Array.prototype.forEach.call(doc.querySelectorAll("img"), function (im) {
        var w = im.naturalWidth || im.clientWidth || 0;
        var h = im.naturalHeight || im.clientHeight || 0;
        var url = im.currentSrc || im.src || "";
        if (!url || w < 200 || h < 150) return;               // assembly diagrams are big
        if (/sprite|icon|logo|button|avatar|spacer|pixel|thumb|banner/i.test(url)) return;
        out.push({ url: url, area: w * h });
      });
    } catch (e) {}
    try {
      Array.prototype.forEach.call(doc.querySelectorAll("iframe, frame"), function (f) {
        try { var d = f.contentDocument || (f.contentWindow && f.contentWindow.document); if (d) gatherImages(d, out); } catch (e) {}
      });
    } catch (e) {}
    return out;
  }

  // <img> elements that haven't finished loading yet (across same-origin frames).
  // On a first scan a not-yet-loaded image reports size 0 and is skipped.
  function pendingImages(doc, out) {
    out = out || [];
    try {
      Array.prototype.forEach.call(doc.querySelectorAll("img"), function (im) {
        if (!im.complete) out.push(im);
      });
    } catch (e) {}
    try {
      Array.prototype.forEach.call(doc.querySelectorAll("iframe, frame"), function (f) {
        try { var d = f.contentDocument || (f.contentWindow && f.contentWindow.document); if (d) pendingImages(d, out); } catch (e) {}
      });
    } catch (e) {}
    return out;
  }

  var imgRescanDone = false;   // auto re-scan at most once per page (for late images)
  // after a scan, if any images are still loading, re-run the scan once they settle
  // so a late-loading diagram (e.g. a lower-down sequence diagram that read size 0
  // the first time) gets captured without the tech having to press SCAN twice.
  function scheduleImageRescan(rescan) {
    if (imgRescanDone) return;
    var pend = pendingImages(document);
    if (!pend.length) return;
    imgRescanDone = true;
    var fired = false, remaining = pend.length;
    var go = function () { if (fired) return; fired = true; try { rescan(); } catch (e) {} };
    pend.forEach(function (im) {
      var settle = function () {
        try { im.removeEventListener("load", settle); im.removeEventListener("error", settle); } catch (e) {}
        if (--remaining === 0) go();
      };
      try { im.addEventListener("load", settle); im.addEventListener("error", settle); } catch (e) { remaining--; }
    });
    setTimeout(go, 4000);   // safety cap so a stalled image can't block the re-scan
  }

  // from the candidates, keep only the dominant image(s) — the overview/assembly
  // diagram is the biggest thing on the page; drop anything much smaller
  function pickDiagrams(cands) {
    if (!cands.length) return [];
    var byUrl = {};
    cands.forEach(function (c) { if (!(c.url in byUrl) || c.area > byUrl[c.url]) byUrl[c.url] = c.area; });
    var list = Object.keys(byUrl).map(function (u) { return { url: u, area: byUrl[u] }; });
    var maxA = list.reduce(function (m, c) { return Math.max(m, c.area); }, 0);
    var floor = Math.max(maxA * 0.6, 45000);                  // ~250×180 minimum
    return list.filter(function (c) { return c.area >= floor; }).map(function (c) { return c.url; });
  }

  // does this freshly scanned page have numbered components (i.e. it's an
  // overview/assembly page, the kind whose diagram we actually want)?
  function hasNumberedParts(pageR) {
    return SECTIONS.some(function (s) {
      return s.autoPart && (pageR[s.key] || []).some(function (it) { return /^\d+\./.test(it.part || ""); });
    });
  }

  // group diagram references by source page (mirrors groupBySource for items)
  function groupImagesBySource(imgs) {
    var order = [], map = {};
    imgs.forEach(function (im) {
      var s = im.src || "";
      if (!(s in map)) { map[s] = []; order.push(s); }
      map[s].push(im.url);
    });
    return order.map(function (s) { return { src: s, urls: map[s] }; });
  }

  // identity includes the source page, so the same spec from two pages is kept
  function itemKey(it) { return ((it.src || "") + "||" + (it.part || "") + "||" + (it.text || "")).toLowerCase(); }

  // distinct source pages currently in the job
  function srcCount(r) {
    var set = {};
    SECTIONS.forEach(function (s) { (r[s.key] || []).forEach(function (it) { if (it.src) set[it.src] = 1; }); });
    return Object.keys(set).length;
  }

  // group a section's items by source page, preserving first-seen order and the
  // item's original index (needed for the edit/delete handlers)
  function groupBySource(items) {
    var order = [], map = {};
    items.forEach(function (it, idx) {
      var s = it.src || "";
      if (!(s in map)) { map[s] = []; order.push(s); }
      map[s].push({ it: it, idx: idx });
    });
    return order.map(function (s) { return { src: s, entries: map[s] }; });
  }

  // dedup key for a tool entry — by number across the whole job (so a tool cited
  // on several pages is listed once), or by text for a number-less "special tool"
  function toolKey(it) { return it.num ? "num::" + it.num.toLowerCase() : "txt::" + (it.text || "").toLowerCase(); }

  // fold a freshly scanned page (src) into the running job list (dst)
  function mergeInto(dst, src) {
    SECTIONS.forEach(function (s) {
      if (s.key === "tools") {
        // tools are deduped by number job-wide (NOT per page); fill in a missing
        // description if a later page provides one
        var tseen = {};
        dst.tools.forEach(function (it) { tseen[toolKey(it)] = it; });
        (src.tools || []).forEach(function (it) {
          var k = toolKey(it), have = tseen[k];
          if (!have) {
            tseen[k] = it;
            dst.tools.push({ num: it.num || "", desc: it.desc || "", text: it.text, part: "", src: it.src || "", loc: it.loc || "" });
          } else if (it.desc && !have.desc) {
            have.desc = it.desc; have.text = have.num + " — " + it.desc;
          }
        });
        if (dst.tools.length > 150) dst.tools = dst.tools.slice(0, 150);
        return;
      }
      var seen = {};
      dst[s.key].forEach(function (it) { seen[itemKey(it)] = 1; });
      (src[s.key] || []).forEach(function (it) {
        var k = itemKey(it);
        if (!seen[k]) { seen[k] = 1; dst[s.key].push({ text: it.text, part: it.part || "", src: it.src || "", sev: it.sev || "", loc: it.loc || "" }); }
      });
      if (dst[s.key].length > 150) dst[s.key] = dst[s.key].slice(0, 150);
    });
    // diagram references, deduped by url
    dst.__images = dst.__images || [];
    var iset = {};
    dst.__images.forEach(function (im) { iset[im.url] = 1; });
    (src.__images || []).forEach(function (im) {
      if (!iset[im.url]) { iset[im.url] = 1; dst.__images.push({ src: im.src || "", url: im.url }); }
    });
    if (!dst.__title && src.__title) dst.__title = src.__title;
    if (!dst.__vehicle && src.__vehicle) dst.__vehicle = src.__vehicle;
    return dst;
  }

  function saveJob(r) {
    try {
      var slim = { __title: r.__title || "", __images: r.__images || [], __vehicle: r.__vehicle || null };
      SECTIONS.forEach(function (s) { slim[s.key] = r[s.key] || []; });
      sessionStorage.setItem(STORE_KEY, JSON.stringify(slim));
    } catch (e) { /* storage unavailable — stay in-memory for this page */ }
  }

  function loadJob() {
    try {
      var raw = sessionStorage.getItem(STORE_KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      var r = emptyResults();
      SECTIONS.forEach(function (s) { if (Array.isArray(o[s.key])) r[s.key] = o[s.key]; });
      r.__title = o.__title || "";
      r.__images = Array.isArray(o.__images) ? o.__images : [];
      r.__vehicle = (o.__vehicle && o.__vehicle.vin) ? o.__vehicle : null;
      return r;
    } catch (e) { return null; }
  }

  function clearJob() { try { sessionStorage.removeItem(STORE_KEY); } catch (e) {} }

  // remembered panel position (so it stays where you drag it, even across pages)
  function loadPos() { try { var p = sessionStorage.getItem("vwjb_pos_v1"); return p ? JSON.parse(p) : null; } catch (e) { return null; } }
  function savePos(p) { try { sessionStorage.setItem("vwjb_pos_v1", JSON.stringify(p)); } catch (e) {} }

  // minimized (collapsed to just the header) state
  function isMin() { try { return sessionStorage.getItem("vwjb_min_v1") === "1"; } catch (e) { return false; } }
  function setMin(v) { try { sessionStorage.setItem("vwjb_min_v1", v ? "1" : "0"); } catch (e) {} }

  // vehicle-bar expand/collapse (v0.3.7) — to reclaim vertical space, the green
  // "Vehicle loaded" strip auto-collapses to one line a few seconds after it first
  // appears. State: null = never set (render expanded + arm the auto-collapse),
  // "1" = the tech expanded it, "0" = collapsed. The toggle button / editing a
  // field cancels the pending auto-collapse so it can't fold up mid-edit.
  function vehExpState() { try { return sessionStorage.getItem("vwjb_vehexp_v1"); } catch (e) { return null; } }
  function setVehExp(v) { try { sessionStorage.setItem("vwjb_vehexp_v1", v ? "1" : "0"); } catch (e) {} }
  var vehAutoArmed = false;   // arm the 3s auto-collapse only once per page load
  var vehCollapseTimer = null;
  function cancelVehAuto() { if (vehCollapseTimer) { clearTimeout(vehCollapseTimer); vehCollapseTimer = null; } }

  // the most recent Wednesday on or before `now`, as YYYY-MM-DD. Used as a
  // once-a-week marker: it only changes when a new Wednesday passes.
  function wedMarker(now) {
    var d = new Date(now);
    d.setHours(0, 0, 0, 0);
    var back = (d.getDay() - 3 + 7) % 7;   // 3 = Wednesday; days since the last one
    d.setDate(d.getDate() - back);
    var mm = ("0" + (d.getMonth() + 1)).slice(-2), dd = ("0" + d.getDate()).slice(-2);
    return d.getFullYear() + "-" + mm + "-" + dd;
  }

  // Is the weekly reminder due right now? Two guards keep it from being annoying:
  //   1. it only fires on WEDNESDAY (getDay() === 3), and
  //   2. it shows at most ONCE per Wednesday — we record this Wednesday's marker
  //      the moment it becomes due, so re-opening the panel later the same day
  //      won't show it again.
  // We can't actually tell whether the app is out of date (there's no network
  // check), so this is a gentle once-a-week nudge to go look — never a real alert.
  function reminderDue() {
    try {
      if (new Date().getDay() !== 3) return false;                  // 3 = Wednesday only
      var cur = wedMarker(Date.now());
      if (localStorage.getItem(REMIND_KEY) === cur) return false;   // already shown this Wed
      localStorage.setItem(REMIND_KEY, cur);                        // show once, then mark seen
      return true;
    } catch (e) { return false; }
  }

  /* ------------------------------------------------------------------ *
   * 3. GATHER — walk the live page into ordered { text, bold } segments,
   *    preserving which text is bold (how ELSA marks component callouts).
   *    Breaks lines at block boundaries; joins table cells on one row so a
   *    "2." cell and a "Torx Bolt" cell stay together. Same-origin frames
   *    are included; cross-origin frames silently fail (security).
   * ------------------------------------------------------------------ */

  // tags that end the current line
  var LINEBREAK = { DIV: 1, P: 1, LI: 1, TR: 1, UL: 1, OL: 1, TABLE: 1, BR: 1,
    H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1, SECTION: 1, ARTICLE: 1, HEADER: 1,
    FOOTER: 1, DL: 1, DD: 1, DT: 1, BLOCKQUOTE: 1, HR: 1, PRE: 1, FORM: 1, FIELDSET: 1 };

  function isBoldStyle(el) {
    try {
      var w = (el.ownerDocument.defaultView || window).getComputedStyle(el).fontWeight;
      return w === "bold" || w === "bolder" || parseInt(w, 10) >= 600;
    } catch (e) { return false; }
  }

  function gatherSegments(doc) {
    var segs = [];
    var cur = null;

    function flush() {
      if (cur && cur.text.trim()) { cur.text = cur.text.replace(/\s+/g, " ").trim(); segs.push(cur); }
      cur = null;
    }
    function add(text, bold, el) {
      if (!cur) cur = { text: "", bold: false, started: false, el: null };
      if (!cur.started) {
        var lead = text.replace(/^\s+/, "");
        if (lead === "") { cur.text += " "; return; }
        cur.text += lead;
        cur.bold = bold;       // does the line's leading text come from bold?
        cur.el = el || null;   // the element the line's text starts in (for locate-on-page)
        cur.started = true;
      } else {
        cur.text += text;
      }
    }
    function walk(node, bold) {
      for (var c = node.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3) {
          if (c.nodeValue) add(c.nodeValue, bold, node);
        } else if (c.nodeType === 1) {
          var tag = c.nodeName;
          if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT" || tag === "SVG") continue;
          if (tag === "IFRAME" || tag === "FRAME") {
            try {
              var d = c.contentDocument || (c.contentWindow && c.contentWindow.document);
              if (d && d.body) { flush(); walk(d.body, false); flush(); }
            } catch (e) { /* cross-origin */ }
            continue;
          }
          if (tag === "IMG") {
            // emit a diagram MARKER in DOM order (same size filter as the diagram
            // capture in gatherImages). The extractor uses these as figure
            // boundaries so a page with two assembly diagrams numbers each one
            // from 1 again and keeps their specs separate.
            try {
              var iw = c.naturalWidth || c.clientWidth || 0;
              var ih = c.naturalHeight || c.clientHeight || 0;
              var iu = c.currentSrc || c.src || "";
              if (iu && iw >= 200 && ih >= 150 &&
                  !/sprite|icon|logo|button|avatar|spacer|pixel|thumb|banner/i.test(iu)) {
                flush();
                segs.push({ text: "", img: true, url: iu, area: iw * ih });
              }
            } catch (e) {}
            continue;
          }
          var b = bold || tag === "B" || tag === "STRONG" || tag === "TH" || isBoldStyle(c);
          var brk = LINEBREAK[tag];
          if (brk) flush();
          if ((tag === "TD" || tag === "TH") && cur && cur.started) cur.text += " ";
          walk(c, b);
          if (brk) flush();
        }
      }
    }

    try { if (doc.body) walk(doc.body, false); } catch (e) {}
    flush();
    return segs;
  }

  // best guess at the job title for the title bar (the tech can edit it).
  // Prefer a real page heading / title container, then the document title.
  function detectTitle(doc) {
    var sels = ["h1", "h2", ".page-title", "[class*='pageTitle']", "[class*='page-title']",
      "[class*='PageTitle']", "[class*='title' i]", "[id*='title' i]", "h3"];
    for (var j = 0; j < sels.length; j++) {
      try {
        var el = doc.querySelector(sels[j]);
        if (el) {
          var t = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim().replace(/:$/, "");
          if (t && t.length > 2 && t.length < 90 && !/^(search|menu|note|home|logout|help)$/i.test(t)) return t;
        }
      } catch (e) {}
    }
    try {
      var d = (doc.title || "").replace(/\s+/g, " ").trim();
      d = d.replace(/\s*[|\-–—:]\s*(elsa|vw|volkswagen|service).*$/i, "").trim();
      if (d && d.length > 1 && !/^elsa/i.test(d)) return d.slice(0, 90);
    } catch (e) {}
    return "";
  }

  /* ------------------------------------------------------------------ *
   * 4. RENDER — build the panel inside a shadow root so ELSA's own CSS
   *    can't touch it and ours can't touch the page.
   * ------------------------------------------------------------------ */

  var CSS = "" +
    ":host{all:initial}" +
    "*{box-sizing:border-box;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif}" +
    ".wrap{position:fixed;top:12px;right:16px;width:330px;max-height:94vh;display:flex;flex-direction:column;" +
      "background:#fff;color:#1c1c1c;border:1px solid #d4d4d4;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.18);z-index:2147483647;overflow:hidden}" +
    ".wrap.embed{position:static;width:100%;max-height:none;box-shadow:none}" +
    ".hd{display:flex;align-items:center;gap:9px;padding:11px 13px;background:#1b232b;color:#fff;border-bottom:3px solid #2fb84d;cursor:move;user-select:none;touch-action:none}" +
    ".hd svg{width:20px;height:20px;stroke:#2fb84d;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}" +
    ".hd b{font-size:14px;font-weight:600;flex:1}" +
    ".hd button{background:transparent;border:0;color:#cdd7ea;cursor:pointer;font-size:13px;padding:3px 6px;border-radius:6px}" +
    ".hd button:hover{background:rgba(255,255,255,.15);color:#fff}" +
    ".hd .hbtn{display:inline-flex;align-items:center;justify-content:center;padding:3px 5px}" +
    ".hd .hbtn svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}" +
    ".wrap.min{max-height:none}" +
    ".wrap.min .sub,.wrap.min .scanbar,.wrap.min .jobbar,.wrap.min .body,.wrap.min .ft,.wrap.min .updbar,.wrap.min .vbar,.wrap.min .fluidbar{display:none}" +
    // vehicle bar — the up-front "what car is this" identity strip
    ".vbar{padding:9px 13px;border-bottom:1px solid #eee;font-size:12px;line-height:1.4}" +
    ".vbar.empty{background:#eef1f6;color:#3a4a63}" +
    ".vbar.ok{background:#edf7ee;border-bottom-color:#cce6cf}" +
    ".vmsg b{color:#001e50}" +
    ".vhead{display:flex;align-items:center;gap:6px;font-weight:700;color:#1e6b34;font-size:11px;letter-spacing:.03em;text-transform:uppercase;margin-bottom:6px}" +
    ".vheadl{display:inline-flex;align-items:center;gap:6px}" +
    ".vhead svg{width:14px;height:14px;fill:none;stroke:#1e6b34;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}" +
    // expand/collapse toggle for the vehicle bar
    ".vtog{appearance:none;-webkit-appearance:none;background:transparent;border:0;cursor:pointer;padding:1px 2px;margin-left:auto;color:#1e6b34;display:flex;align-items:center;border-radius:5px}" +
    ".vtog svg{width:17px;height:17px;stroke-width:2.2}" +
    ".vtog:hover{background:#dcecdd}" +
    ".vbar.collapsed .vhead{margin-bottom:0}" +
    ".vmiss{margin-left:7px;font-weight:700;color:#9a5a00;background:#fff6e0;border:1px solid #f0dca6;border-radius:8px;padding:1px 7px;font-size:10px;letter-spacing:.01em;text-transform:none}" +
    ".vgrid{display:grid;grid-template-columns:auto 1fr;gap:3px 9px;align-items:baseline}" +
    ".vk{color:#5a6b8c;font-weight:600;white-space:nowrap}" +
    ".vval{color:#1c1c1c;font-weight:600;cursor:text;word-break:break-all}" +
    ".vval.miss{color:#b06a00;font-style:italic;font-weight:600}" +
    ".vvalin{font-family:inherit;font-weight:600;font-size:12px;padding:2px 5px;border:1px solid #001e50;border-radius:5px;outline:none;width:100%;max-width:190px}" +
    ".vwarn{margin-top:7px;font-size:11px;color:#8a5a00;background:#fff6e0;border:1px solid #f0dca6;border-radius:6px;padding:5px 8px;line-height:1.35}" +
    ".sub{padding:6px 13px;background:#eef1f6;display:flex;align-items:center}" +
    ".bld{font-size:11px;color:#5a6b8c;white-space:nowrap;cursor:pointer}" +
    ".bld:hover{color:#001e50;text-decoration:underline}" +
    ".upd{margin-left:auto;font-size:11px;color:#185fa5;text-decoration:none;white-space:nowrap}" +
    ".upd:hover{text-decoration:underline}" +
    // weekly "App may be out of date" update-check reminder banner (yellow)
    ".updbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:9px 13px;background:#fff8e6;border-bottom:1px solid #f3e2b3;font-size:12px;color:#6b5300;line-height:1.3}" +
    ".updmsg2{flex:1;min-width:120px;font-weight:600;color:#5a4300}" +
    ".updget{flex-shrink:0;appearance:none;-webkit-appearance:none;background:#185fa5;color:#fff;text-decoration:none;font-family:inherit;font-weight:600;font-size:11.5px;padding:6px 11px;border-radius:7px;white-space:nowrap;border:0;cursor:pointer}" +
    ".updget:hover{background:#134c84}" +
    ".updx{flex-shrink:0;appearance:none;-webkit-appearance:none;border:1px solid #e0cf9a;background:#fff;color:#6b5300;font-family:inherit;font-weight:600;font-size:11.5px;padding:6px 10px;border-radius:7px;cursor:pointer}" +
    ".updx:hover{background:#fdf6e3}" +
    // big primary action — its own bar, directly above the job title row
    ".scanbar{padding:11px 13px 4px}" +
    ".scan{width:100%;appearance:none;-webkit-appearance:none;background:#2fb84d;color:#0a0a0a;font-family:inherit;font-size:17px;font-weight:800;letter-spacing:.1em;padding:13px;border:0;border-radius:9px;cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,.18)}" +
    ".scan:hover{background:#28a344}" +
    ".scan:active{background:#22923b}" +
    ".jobbar{padding:9px 13px;border-bottom:1px solid #eee;display:flex;gap:7px;align-items:center}" +
    // "New Vehicle" — the start-over action, pinned at the top under the version bar
    ".topbar{padding:9px 13px 5px;background:#fff}" +
    ".newveh{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;appearance:none;-webkit-appearance:none;background:#fff;border:1px solid #cfd6e4;color:#001e50;font-family:inherit;font-weight:600;font-size:12.5px;padding:8px 10px;border-radius:8px;cursor:pointer}" +
    ".newveh:hover{background:#f3f6fb;border-color:#001e50}" +
    ".newveh svg{width:15px;height:15px;flex-shrink:0;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}" +
    ".topbar .confirm{justify-content:center}" +
    ".job{flex:1;min-width:0;font-family:inherit;font-weight:600;font-size:14px;color:#001e50;border:1px solid #dfe4ee;border-radius:8px;padding:8px 10px;outline:none;background:#fff}" +
    ".job::placeholder{color:#b3b9c4;font-weight:400}" +
    ".job:focus{border-color:#001e50}" +
    ".newjob{flex-shrink:0;appearance:none;-webkit-appearance:none;background:#fff;border:1px solid #cfd6e4;color:#001e50;font-family:inherit;font-weight:600;font-size:12px;padding:8px 10px;border-radius:8px;cursor:pointer;white-space:nowrap}" +
    ".newjob:hover{background:#f3f6fb;border-color:#001e50}" +
    // "Clear info" — wipes recorded data but keeps the vehicle (red-tinted to mark it destructive)
    ".clrinfo{appearance:none;-webkit-appearance:none;background:#fff;border:1px solid #e6b0b0;color:#a32d2d;font-family:inherit;font-weight:600;font-size:12px;padding:8px 10px;border-radius:8px;cursor:pointer;white-space:nowrap}" +
    ".clrinfo:hover{background:#fff5f5;border-color:#a32d2d}" +
    ".confirm{flex-shrink:0;display:flex;align-items:center;gap:5px}" +
    ".ctxt{font-size:11px;font-weight:600;color:#a32d2d;white-space:nowrap}" +
    ".confirm button{appearance:none;-webkit-appearance:none;border:1px solid #cfd6e4;background:#fff;font-family:inherit;font-weight:600;font-size:12px;padding:6px 9px;border-radius:7px;cursor:pointer}" +
    ".cyes{color:#a32d2d;border-color:#e6b0b0}" +
    ".cyes:hover{background:#fff5f5}" +
    ".cno{color:#001e50}" +
    ".cno:hover{background:#f3f6fb}" +
    // exit confirmation modal (shown when the header X is clicked)
    ".exitc{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:rgba(0,8,30,.28)}" +
    ".exitbox{background:#fff;border:1px solid #d4d4d4;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.3);padding:18px 18px 14px;width:288px;max-width:86vw;text-align:left}" +
    ".exittl{font-size:14px;font-weight:700;color:#001e50;margin:0 0 5px}" +
    ".exitmsg{font-size:12.5px;color:#3a4a63;line-height:1.45;margin:0 0 14px}" +
    ".exitbtns{display:flex;gap:8px;justify-content:flex-end}" +
    ".exitbtns button{appearance:none;-webkit-appearance:none;font-family:inherit;font-weight:600;font-size:12.5px;padding:8px 14px;border-radius:8px;cursor:pointer;border:1px solid #cfd6e4}" +
    ".exyes{background:#a32d2d;border-color:#a32d2d;color:#fff}" +
    ".exyes:hover{background:#8f2626}" +
    ".exno{background:#fff;color:#001e50}" +
    ".exno:hover{background:#f3f6fb}" +
    ".body{overflow-y:auto;padding:4px 13px 13px}" +
    ".sec{padding:11px 0;border-bottom:1px solid #eee}" +
    ".sec:last-child{border-bottom:0}" +
    ".st{display:flex;align-items:center;gap:7px;font-size:11px;font-weight:600;letter-spacing:.03em;text-transform:uppercase;margin-bottom:7px}" +
    ".st svg{width:15px;height:15px;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}" +
    ".st .ct{margin-left:auto;background:#eef1f6;color:#5a6b8c;border-radius:9px;padding:1px 8px;font-size:11px;font-weight:600}" +
    // per-group clear button in each section header
    ".clrsec{appearance:none;-webkit-appearance:none;background:transparent;border:0;cursor:pointer;font-family:inherit;font-weight:600;font-size:10px;letter-spacing:.03em;color:#aab0bb;padding:2px 6px;margin-left:7px;border-radius:5px}" +
    ".clrsec:hover{color:#c0392b;background:#fdecec}" +
    ".st .confirm{text-transform:none;margin-left:7px}" +
    ".item{display:flex;gap:7px;align-items:flex-start;font-size:13px;line-height:1.45;padding:5px 0 5px 10px;border-left:2px solid #e3e3e3;margin:3px 0;color:#222}" +
    ".txt{flex:1;min-width:0}" +
    ".del{flex-shrink:0;appearance:none;-webkit-appearance:none;background:transparent;border:0;cursor:pointer;padding:1px;margin-top:1px;color:#c3c7cf;display:flex;align-items:center}" +
    ".del svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}" +
    ".del:hover{color:#c0392b}" +
    // locate-on-page magnifier, pinned to the LEFT of each found item
    ".find{flex-shrink:0;appearance:none;-webkit-appearance:none;background:transparent;border:0;cursor:pointer;padding:1px;margin-top:1px;color:#185fa5;opacity:.7;display:flex;align-items:center}" +
    ".find svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}" +
    ".find:hover{opacity:1}" +
    // greyed: the item was found on a page you've since navigated away from
    ".find.off{opacity:.3;cursor:default;color:#9aa3b2}" +
    ".find.off:hover{opacity:.3}" +
    ".lbl{appearance:none;-webkit-appearance:none;flex-shrink:0;border:1px solid;cursor:text;font:600 11px/1.3 inherit;padding:3px 7px;border-radius:6px;white-space:nowrap;max-width:118px;overflow:hidden;text-overflow:ellipsis}" +
    ".lbl.set{background:#eef1f6;border-color:#cfd6e4;color:#001e50}" +
    ".lbl.add{background:transparent;border-style:dashed;border-color:#cfcfcf;color:#9a9a9a}" +
    ".lblin{flex-shrink:0;width:118px;font-family:inherit;font-weight:600;font-size:12px;padding:3px 6px;border:1px solid #001e50;border-radius:6px;outline:none}" +
    ".addrow{appearance:none;-webkit-appearance:none;background:transparent;border:1px dashed #cfcfcf;color:#5a6b8c;cursor:pointer;font-family:inherit;font-weight:600;font-size:11px;padding:4px 9px;border-radius:6px;margin-top:7px}" +
    ".addrow:hover{border-color:#001e50;color:#001e50}" +
    ".addin{width:100%;font:13px inherit;padding:6px 8px;border:1px solid #001e50;border-radius:6px;outline:none;margin-top:7px}" +
    ".empty{font-size:12px;color:#9a9a9a;font-style:italic}" +
    ".srch{width:100%;font-family:inherit;font-weight:600;font-size:11px;letter-spacing:.02em;color:#5f6b80;background:#eef1f6;border:1px solid transparent;border-radius:6px;padding:5px 8px;outline:none;margin:9px 0 4px}" +
    ".srch:hover{border-color:#cfd6e4}" +
    ".srch:focus{border-color:#001e50;background:#fff;color:#001e50}" +
    ".hint{font-size:13px;color:#5a6b8c;background:#eef1f6;border-radius:8px;padding:11px 13px;margin:6px 0 4px;line-height:1.5}" +
    ".hint b{color:#001e50}" +
    ".chips{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:6px}" +
    ".chip{display:inline-flex;align-items:center;gap:4px;background:#001e50;color:#fff;font-size:12px;font-weight:600;border-radius:6px;padding:2px 5px 2px 8px}" +
    ".chipx{appearance:none;-webkit-appearance:none;background:transparent;border:0;color:#9fb2d6;cursor:pointer;font-size:11px;line-height:1;padding:0 1px;border-radius:4px}" +
    ".chipx:hover{color:#fff;background:rgba(255,255,255,.18)}" +
    ".c-torque{color:#185fa5}.c-replace{color:#0f6e56}.c-fluids{color:#185fa5}.c-tools{color:#534ab7}.c-warnings{color:#a32d2d}.c-diagram{color:#5f5e5a}" +
    // fluids = a link out to the vehicle-matched lookup page (not scanned),
    // pinned right under the green vehicle bar
    ".fluidbar{padding:9px 13px;border-bottom:1px solid #eee;background:#fff}" +
    ".fluidbtn{display:flex;align-items:center;gap:8px;width:100%;text-align:left;appearance:none;-webkit-appearance:none;text-decoration:none;background:#eef6ff;border:1px solid #cfe0f5;color:#0a3d6e;font-family:inherit;font-weight:600;font-size:13px;padding:10px 12px;border-radius:9px;cursor:pointer}" +
    ".fluidbtn:hover{background:#e2eefc;border-color:#185fa5}" +
    ".fluidbtn svg{width:17px;height:17px;flex-shrink:0;fill:none;stroke:#185fa5;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}" +
    ".fluidbtn .arr{margin-left:auto;font-size:14px;color:#185fa5}" +
    ".fluidnote{font-size:12px;color:#7a7a7a;line-height:1.4}" +
    ".dgmhdr{font-family:inherit;font-weight:600;font-size:11px;color:#5f6b80;margin:9px 0 4px}" +
    ".dgmwrap{position:relative;margin:6px 0}" +
    ".dgm{display:block;max-width:100%;height:auto;border:1px solid #e3e3e3;border-radius:6px;cursor:zoom-in;background:#fff}" +
    ".dgmdel{position:absolute;top:6px;right:6px;width:22px;height:22px;border-radius:50%;border:0;background:rgba(0,0,0,.55);color:#fff;cursor:pointer;font-size:11px;line-height:1;display:flex;align-items:center;justify-content:center;padding:0}" +
    ".dgmdel:hover{background:#c0392b}" +
    ".sec.warnings .item{border-left-width:3px;border-radius:0 6px 6px 0;padding-left:10px}" +
    // ELSA's four banner colours: DANGER red, WARNING orange, CAUTION yellow, NOTE light blue
    ".sec.warnings .item.sev-danger{border-left-color:#d11f2d;background:#fdecec;color:#7a1620}" +
    ".sec.warnings .item.sev-warning{border-left-color:#e8821e;background:#fff4e6;color:#7a4708}" +
    ".sec.warnings .item.sev-caution{border-left-color:#e0b400;background:#fffbe0;color:#6b5300}" +
    ".sec.warnings .item.sev-note{border-left-color:#3a86c8;background:#eef5fb;color:#1d4e74}" +
    // a warning with no detected banner (e.g. added by hand) keeps a neutral red
    ".sec.warnings .item:not([class*=sev-]){border-left-color:#e24b4a;background:#fff5f5;color:#791f1f}" +
    ".sec.warnings .sevtag{font-weight:700;font-size:10px;letter-spacing:.04em;margin-right:6px;color:inherit}" +
    ".ft{padding:9px 13px;border-top:1px solid #eee;display:flex;gap:8px}" +
    ".ft button{flex:1;font-size:12px;font-weight:600;border:1px solid #cfd6e4;background:#fff;color:#001e50;border-radius:7px;padding:7px;cursor:pointer}" +
    ".ft button:hover{background:#f3f6fb}" +
    ".toast{position:absolute;bottom:54px;left:50%;transform:translateX(-50%);background:#1c1c1c;color:#fff;font-size:11px;padding:5px 10px;border-radius:6px;opacity:0;transition:opacity .2s;pointer-events:none}" +
    ".toast.on{opacity:1}" +
    // fast custom tooltip (native `title` has a ~1s delay we can't shorten). Positioned
    // by JS relative to the panel; shown after a short hover. See the [data-tip] wiring.
    ".tip{position:absolute;z-index:6;display:none;max-width:210px;background:#1c2530;color:#fff;font-size:11px;font-weight:600;line-height:1.35;padding:6px 9px;border-radius:7px;box-shadow:0 4px 14px rgba(0,0,0,.28);pointer-events:none;opacity:0;transition:opacity .1s ease}" +
    ".tip.on{opacity:1}";

  var WRENCH = "M14.7 6.3a4 4 0 0 0-5.4 5.4l-6 6 2 2 6-6a4 4 0 0 0 5.4-5.4l-2.3 2.3-2-2 2.3-2.3z";
  var TRASH = "M4 7h16M10 11v6M14 11v6M5 7l1 13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-13M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3";
  var IMG_ICON = "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 10a1.3 1.3 0 1 1-2.6 0 1.3 1.3 0 0 1 2.6 0";
  var CHECK = "M20 6 9 17l-5-5";
  var GLASS = "M10 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12M20 20l-5.2-5.2";   // locate-on-page magnifier
  var CHEV_DOWN = "M6 9l6 6 6-6";   // expand the vehicle bar
  var CHEV_UP = "M6 15l6-6 6 6";    // collapse the vehicle bar
  var RESTART = "M20 11.5a8 8 0 1 1-2.3-5.6M20 4v5h-5";   // "New Vehicle" / start over

  function svg(path, cls) {
    return '<svg viewBox="0 0 24 24" class="' + (cls || "") + '"><path d="' + path + '"/></svg>';
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  // the identity strip pinned under the header. When a vehicle is loaded it
  // shows the five fields (blanks flagged + editable); otherwise it prompts the
  // tech to scan ELSA's Vehicle Summary page first.
  function vehicleBar(r) {
    var note = vehNotice
      ? '<div class="vwarn">' + esc(vehNotice) + "</div>"
      : "";
    if (!vehLoaded(r)) {
      return '<div class="vbar empty"><div class="vmsg">' +
        '<b>No vehicle loaded.</b> Open ELSA’s <b>Vehicle Summary</b> page and click ' +
        '<b>SCAN</b> to load the vehicle before collecting specs.</div>' + note + "</div>";
    }
    var v = r.__vehicle;
    var miss = vehMissing(v);
    // collapsed: a single "✓ Vehicle loaded" line (+ a blanks tag) and an expand
    // arrow — frees up vertical space for the rest of the panel
    if (vehExpState() === "0") {
      var missTag = miss.length ? '<span class="vmiss">' + miss.length + " to add</span>" : "";
      return '<div class="vbar ok collapsed"><div class="vhead">' +
        '<span class="vheadl">' + svg(CHECK) + "Vehicle loaded" + missTag + "</span>" +
        '<button class="vtog" data-act="vehexpand" title="Show vehicle details">' + svg(CHEV_DOWN) + "</button>" +
        "</div>" + note + "</div>";
    }
    var grid = VEH_FIELDS.map(function (f) {
      var val = v[f.k];
      var cell = val
        ? '<span class="vval" data-vk="' + f.k + '" title="Click to edit">' + esc(val) + "</span>"
        : '<span class="vval miss" data-vk="' + f.k + '" title="Click to add">+ add</span>';
      return '<span class="vk">' + esc(f.label) + "</span>" + cell;
    }).join("");
    var warn = miss.length
      ? '<div class="vwarn">Missing: ' + esc(miss.join(", ")) + " — click a blank to add it by hand.</div>"
      : "";
    return '<div class="vbar ok"><div class="vhead">' +
      '<span class="vheadl">' + svg(CHECK) + "Vehicle loaded</span>" +
      '<button class="vtog" data-act="vehcollapse" title="Hide vehicle details">' + svg(CHEV_UP) + "</button>" +
      "</div>" +
      '<div class="vgrid">' + grid + "</div>" + warn + note + "</div>";
  }

  // the Fluids & Capacities link, pinned right under the vehicle bar. Only shown
  // once a vehicle is loaded (you can't look fluids up without one).
  var DROPLET = "M12 2.7s6 6.6 6 10.3a6 6 0 0 1-12 0c0-3.7 6-10.3 6-10.3z";
  function fluidsBar(r) {
    if (!vehLoaded(r)) return "";
    var url = vehFluidsUrl(r);
    if (!url) return '<div class="fluidbar"><div class="fluidnote">Add the <b>Model Year</b> above to look up fluids &amp; capacities.</div></div>';
    // opens in a small, centered pop-up window (see the "fluids" click handler) so
    // it reads as a quick reference, not a full tab the tech has to find and close.
    return '<div class="fluidbar"><a class="fluidbtn" href="' + esc(url) + '" data-act="fluids" target="_blank" rel="noopener">' +
      svg(DROPLET) + "Fluids &amp; capacities for this vehicle<span class=\"arr\">&#8599;</span></a></div>";
  }

  function buildHTML(r, embed) {
    var mini = !embed && isMin();
    // any collected info (specs/tools/warnings/diagrams)? drives the "Clear info"
    // button — which wipes the recorded data but keeps the loaded vehicle.
    var hasInfo = (r.__images || []).length > 0;
    SECTIONS.forEach(function (s) { if ((r[s.key] || []).length) hasInfo = true; });
    var html = "" +
      '<div class="wrap' + (embed ? " embed" : "") + (mini ? " min" : "") + '"><div class="hd">' + svg(WRENCH) +
        '<b title="Hardware, Advisories, Highlights, &amp; Navigation Specialist">H.A.H.N.S</b>' +
        (embed ? "" : '<button data-act="min" class="hbtn" title="' + (mini ? "Expand" : "Minimize") + '">' + svg(mini ? "M7 7h10v10H7z" : "M6 12h12") + "</button>") +
        '<button data-act="close" title="Close">&#10005;</button></div>' +
      // version stamp — pinned to the very top, directly under the title bar
      '<div class="sub">' +
        '<span class="bld" title="Click to copy a diagnostic of what the tool saw">' + esc(BUILD) + "</span>" +
        '<a class="upd" href="' + SITE_URL + '" target="_blank" rel="noopener" title="Opens the H.A.H.N.S page so you can compare versions">check for latest &#8599;</a></div>' +
      // "New Vehicle" — the start-over action: wipes the loaded vehicle AND all
      // collected info. Pinned at the very top, right under the version bar.
      (embed ? "" : '<div class="topbar"><button class="newveh" data-act="newjob" data-tip="Start over with a NEW vehicle — clears the loaded vehicle and all collected info">' + svg(RESTART) + "New Vehicle</button></div>") +
      // vehicle identity strip (required before any procedure page is collected)
      (embed ? "" : vehicleBar(r)) +
      // fluids & capacities link — pinned directly under the vehicle bar
      (embed ? "" : fluidsBar(r)) +
      // gentle once-a-week nudge to open the setup page and compare versions —
      // shown only on Wednesdays, once that day. Network-free (we can't actually
      // know if the app is stale), so it behaves the same inside and outside ELSA.
      (!embed && remindDue
        ? '<div class="updbar"><span class="updmsg2">App may be out of date.</span>' +
            '<a class="updget" href="' + SITE_URL + '" target="_blank" rel="noopener" title="Open the H.A.H.N.S setup page to compare versions">Check for update?</a>' +
            '<button class="updx" data-act="reminddismiss" title="Hide this">Dismiss</button></div>'
        : "") +
      '<div class="scanbar"><button class="scan" data-act="rescan" data-tip="Read this page and add its specs to the job">SCAN</button></div>' +
      '<div class="jobbar">' +
        '<input class="job" type="text" placeholder="Job title — e.g. Rear Brakes" value="' + esc(r.__title || "") + '">' +
        (hasInfo ? '<button class="clrinfo" data-act="clearinfo" data-tip="Clears all collected specs, tools, warnings and diagrams — keeps the loaded vehicle">Clear All Info</button>' : "") +
      "</div>" +
      '<div class="body">';

    var total = 0;
    SECTIONS.forEach(function (s) { total += (r[s.key] || []).length; });
    if (total === 0) {
      html += vehLoaded(r)
        ? '<div class="hint">Vehicle loaded. Open a repair procedure and click <b>SCAN</b> to collect its specs.</div>'
        : '<div class="hint">Start on ELSA’s <b>Vehicle Summary</b> page and click <b>SCAN</b> to load the vehicle. Procedure specs can be collected after that.</div>';
    }

    // group items under a per-page header once 2+ pages have been scanned
    var multiSrc = srcCount(r) >= 2;
    function itemRow(s, it, idx) {
      var del = '<button class="del" data-del="' + s.key + '" data-i="' + idx + '" title="Remove this line" aria-label="Remove this line">' + svg(TRASH) + "</button>";
      // the locate-on-page magnifier (left side). Only items with a source
      // element get one; if that element is from an earlier page (not on screen
      // now) the button is greyed with an explanatory tooltip.
      var find = "";
      if (it.loc) {
        var live = !!locEl(it.loc);
        find = '<button class="find' + (live ? "" : " off") + '" data-loc="' + esc(it.loc) + '" aria-label="Show on page" title="' +
          (live ? "Show where Hahns found this on the page"
                : "Found on another page — open that page to locate it") + '">' + svg(GLASS) + "</button>";
      }
      // tools show the number in bold, then the description (when we found one)
      if (s.key === "tools") {
        var t = it.num ? "<b>" + esc(it.num) + "</b>" + (it.desc ? " — " + esc(it.desc) : "") : esc(it.text);
        return '<div class="item tool">' + find + '<span class="txt">' + t + "</span>" + del + "</div>";
      }
      var lbl = "";
      if (s.label) {
        lbl = it.part
          ? '<button class="lbl set" data-k="' + s.key + '" data-i="' + idx + '" title="Click to edit part">' + esc(it.part) + "</button>"
          : '<button class="lbl add" data-k="' + s.key + '" data-i="' + idx + '" title="Click to name this part">+ part</button>';
      }
      // warnings carry a banner severity → colour the row + show a matching tag
      var sevCls = "", sevTag = "";
      if (s.key === "warnings" && it.sev) {
        sevCls = " sev-" + it.sev;
        sevTag = '<span class="sevtag">' + esc(it.sev.toUpperCase()) + "</span>";
      }
      return '<div class="item' + sevCls + '">' + find + lbl + '<span class="txt">' + sevTag + esc(it.text) + "</span>" + del + "</div>";
    }

    SECTIONS.forEach(function (s) {
      var items = r[s.key] || [];

      // fluids isn't a body section anymore — it's a link pinned under the vehicle
      // bar (see fluidsBar). Skip it here.
      if (s.linkOnly) return;

      html += '<div class="sec ' + s.key + '"><div class="st c-' + s.key + '">' +
        svg(s.icon) + s.title + '<span class="ct">' + items.length + "</span>" +
        (items.length ? '<button class="clrsec" data-clear="' + s.key + '" data-tip="Clear all ' + esc(s.title) + '">Clear</button>' : "") +
        "</div>";

      // blue tool-number chips for a quick glance — each one removable
      if (s.key === "tools") {
        var nums = toolNums(r);
        if (nums.length) {
          html += '<div class="chips">';
          nums.forEach(function (t) {
            html += '<span class="chip">' + esc(t) +
              '<button class="chipx" data-chipdel="' + esc(t) + '" title="Remove ' + esc(t) + '" aria-label="Remove tool">&#10005;</button></span>';
          });
          html += "</div>";
        }
      }

      // tools are a single job-wide deduped list → render flat (never per-page)
      if (items.length && (multiSrc && s.key !== "tools")) {
        groupBySource(items).forEach(function (g) {
          html += '<input class="srch" data-src="' + esc(g.src) + '" value="' + esc(g.src) +
            '" placeholder="page name" title="Page these came from — edit to rename">';
          g.entries.forEach(function (e) { html += itemRow(s, e.it, e.idx); });
        });
      } else if (items.length) {
        items.forEach(function (it, idx) { html += itemRow(s, it, idx); });
      } else {
        html += '<div class="empty">None yet.</div>';
      }
      html += '<button class="addrow" data-add="' + s.key + '" title="Add a line by hand">+ add</button>';
      html += "</div>";
    });

    // diagram(s) captured from the page(s), so the tech can match the numbers
    var imgs = r.__images || [];
    if (imgs.length) {
      var imgTag = function (u) {
        return '<div class="dgmwrap"><img class="dgm" src="' + esc(u) + '" data-full="' + esc(u) +
          '" title="Click to open full size" loading="lazy">' +
          '<button class="dgmdel" data-imgdel="' + esc(u) + '" title="Remove image" aria-label="Remove image">&#10005;</button></div>';
      };
      html += '<div class="sec diagram"><div class="st c-diagram">' + svg(IMG_ICON) + "Diagram" +
        '<span class="ct">' + imgs.length + "</span>" +
        '<button class="clrsec" data-clear="__images" data-tip="Clear all diagrams">Clear</button>' +
        "</div>";
      if (multiSrc) {
        groupImagesBySource(imgs).forEach(function (g) {
          html += '<div class="dgmhdr">' + esc(g.src || "page") + "</div>";
          g.urls.forEach(function (u) { html += imgTag(u); });
        });
      } else {
        imgs.forEach(function (im) { html += imgTag(im.url); });
      }
      html += "</div>";
    }

    html += "</div>" +
      '<div class="ft"><button data-act="copy">Copy list</button><button data-act="print">Print</button></div>' +
      '<div class="toast">Copied</div></div>';
    return html;
  }

  function plainText(r) {
    var out = [];
    if (r.__title) { out.push(r.__title, "=".repeat(Math.min(40, r.__title.length)), ""); }
    if (vehLoaded(r)) {
      out.push("VEHICLE");
      VEH_FIELDS.forEach(function (f) { out.push("   " + f.label + ": " + (r.__vehicle[f.k] || "—")); });
      out.push("");
    }
    var multiSrc = srcCount(r) >= 2;
    SECTIONS.forEach(function (s) {
      var items = r[s.key] || [];
      if (!items.length) return;
      out.push("== " + s.title.toUpperCase() + " ==");
      var line = function (it) { return "   - " + (it.sev ? it.sev.toUpperCase() + ": " : "") + (it.part ? "[" + it.part + "] " : "") + it.text; };
      if (multiSrc && s.key !== "tools") {
        groupBySource(items).forEach(function (g) {
          out.push("  -- " + (g.src || "page") + " --");
          g.entries.forEach(function (e) { out.push(line(e.it)); });
        });
      } else {
        items.forEach(function (it) { out.push(line(it)); });
      }
      out.push("");
    });
    return out.join("\n").trim() || "Nothing found on this page.";
  }

  function copyText(txt, onDone) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(onDone, onDone);
    } else {
      var ta = document.createElement("textarea");
      ta.value = txt; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (e) {}
      ta.remove(); if (onDone) onDone();
    }
  }

  var PRINT_CSS =
    "body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111;margin:24px;font-size:13px}" +
    "h1{font-size:20px;margin:0 0 2px}" +
    ".meta{color:#555;font-size:11px;margin-bottom:14px;border-bottom:1px solid #bbb;padding-bottom:8px}" +
    ".veh{margin:0 0 14px;padding:8px 10px;border:1px solid #bbb;border-radius:5px;font-size:12px;background:#f6f8f6}" +
    ".veh b{color:#000}.veh span{display:inline-block;margin-right:16px}" +
    "h2{font-size:15px;margin:16px 0 4px;border-bottom:1px solid #ccc;padding-bottom:2px}" +
    "h3{font-size:12px;margin:9px 0 2px;color:#333}" +
    "ul{margin:2px 0 6px;padding-left:18px}" +
    "li{margin:2px 0;line-height:1.45}" +
    ".chips{margin:4px 0}" +
    ".chip{display:inline-block;border:1px solid #333;border-radius:4px;padding:1px 6px;margin:2px 4px 2px 0;font-size:11px;font-weight:bold}" +
    "img.dgm{max-width:100%;height:auto;margin:6px 0;border:1px solid #ccc}" +
    "@media print{h2,h3{page-break-after:avoid}li,img.dgm{page-break-inside:avoid}}";

  // a clean, print-only document of the collected job
  function buildPrintHTML(r) {
    var multiSrc = srcCount(r) >= 2;
    var when = new Date().toLocaleString();
    var p = ['<!doctype html><html><head><meta charset="utf-8"><title>' +
      esc(r.__title || "H.A.H.N.S job") + "</title><style>" + PRINT_CSS + "</style></head><body>"];
    p.push("<h1>" + esc(r.__title || "H.A.H.N.S — Job sheet") + "</h1>");
    p.push('<div class="meta">H.A.H.N.S · printed ' + esc(when) + "</div>");
    if (vehLoaded(r)) {
      p.push('<div class="veh">' + VEH_FIELDS.map(function (f) {
        return "<span><b>" + esc(f.label) + ":</b> " + esc(r.__vehicle[f.k] || "—") + "</span>";
      }).join("") + "</div>");
    }
    var any = false;
    var li = function (it) { return "<li>" + (it.sev ? "<b>" + esc(it.sev.toUpperCase()) + ":</b> " : "") + (it.part ? "<b>" + esc(it.part) + "</b> " : "") + esc(it.text) + "</li>"; };
    SECTIONS.forEach(function (s) {
      var items = r[s.key] || [];
      if (!items.length) return;
      any = true;
      p.push("<h2>" + esc(s.title) + "</h2>");
      if (s.key === "tools") {
        var nums = toolNums(r);
        if (nums.length) p.push('<div class="chips">' + nums.map(function (t) { return '<span class="chip">' + esc(t) + "</span>"; }).join("") + "</div>");
      }
      if (multiSrc && s.key !== "tools") {
        groupBySource(items).forEach(function (g) {
          p.push("<h3>" + esc(g.src || "page") + "</h3><ul>" + g.entries.map(function (e) { return li(e.it); }).join("") + "</ul>");
        });
      } else {
        p.push("<ul>" + items.map(li).join("") + "</ul>");
      }
    });
    var imgs = r.__images || [];
    if (imgs.length) {
      any = true;
      p.push("<h2>Diagram</h2>");
      if (multiSrc) {
        groupImagesBySource(imgs).forEach(function (g) {
          p.push("<h3>" + esc(g.src || "page") + "</h3>");
          g.urls.forEach(function (u) { p.push('<img class="dgm" src="' + esc(u) + '">'); });
        });
      } else {
        imgs.forEach(function (im) { p.push('<img class="dgm" src="' + esc(im.url) + '">'); });
      }
    }
    if (!any) p.push("<p>Nothing collected yet.</p>");
    p.push("</body></html>");
    return p.join("");
  }

  // print just the job (not the whole ELSA page) via a hidden same-origin iframe
  function printJob(r) {
    var ifr = document.createElement("iframe");
    ifr.setAttribute("aria-hidden", "true");
    ifr.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0";
    (document.body || document.documentElement).appendChild(ifr);
    var d;
    try {
      d = ifr.contentWindow.document;
      d.open(); d.write(buildPrintHTML(r)); d.close();
    } catch (e) { ifr.remove(); return; }
    var w = ifr.contentWindow;
    var fired = false;
    var go = function () {
      if (fired) return; fired = true;
      try { w.focus(); w.print(); } catch (e) {}
      setTimeout(function () { ifr.remove(); }, 800);
    };
    // Wait for the diagram images to finish downloading before printing — they're
    // remote ELSA URLs, so a fixed delay sometimes fired before they loaded and the
    // print preview came out blank (worked on a 2nd try once cached). Print once all
    // images settle (load OR error), with a hard cap so a stalled image never hangs.
    try {
      var imgs = d.images ? Array.prototype.slice.call(d.images) : [];
      var pending = 0;
      imgs.forEach(function (im) {
        if (im.complete) return;            // already loaded/cached
        pending++;
        var settle = function () { im.onload = im.onerror = null; if (--pending === 0) go(); };
        im.onload = settle; im.onerror = settle;
      });
      if (pending === 0) setTimeout(go, 100);   // nothing to wait on — just let layout settle
      else setTimeout(go, 3000);                // safety cap: print anyway if an image stalls
    } catch (e) { setTimeout(go, 250); }
  }

  // a diagnostic of exactly what the page-walk captured: each line, whether it
  // was read as bold, and whether the tool recognised it as a part heading.
  // The tech clicks the build stamp to copy this; pasting it back shows me why
  // a callout did or didn't attach, without me needing to see the page.
  function debugDump() {
    var lines = lastSegments.slice(0, 120).map(function (seg, i) {
      if (seg.img) return ("000" + i).slice(-3) + " [IMG] diagram → " + (seg.url || "");
      var t = String(seg.text || "").replace(/\s+/g, " ").trim();
      var head = partFromHeading(t);
      var flag = (seg.bold ? "B" : ".") + (head ? "H" : " ");
      return ("000" + i).slice(-3) + " [" + flag + "] " + t;
    });
    var hdr = "", cands = [], picked = [];
    try { hdr = detectTitle(document); } catch (e) {}
    try { cands = gatherImages(document); picked = pickDiagrams(cands); } catch (e) {}
    // mirror the scan's display logic: a tightening-sequence page also keeps the
    // smaller supplementary diagram, so report that count too
    var seqRef = false, displayCount = picked.length;
    try {
      seqRef = lastSegments.some(function (sg) { return SEQ_REF_RE.test(String(sg.text || "")); });
      if (seqRef) {
        var have = {}; picked.forEach(function (u) { have[u] = 1; });
        var byU = {}; cands.forEach(function (c) { if (!(c.url in byU) || c.area > byU[c.url]) byU[c.url] = c.area; });
        Object.keys(byU).forEach(function (u) { if (!have[u] && byU[u] >= 45000) displayCount++; });
      }
    } catch (e) {}
    var remindSeen;
    try { remindSeen = localStorage.getItem(REMIND_KEY) || "(unset)"; } catch (e) { remindSeen = "(unreadable)"; }
    var veh = {}, isSum = false;
    try { veh = extractVehicle(lastSegments) || {}; } catch (e) {}
    try { isSum = isVehicleSummaryPage(lastSegments); } catch (e) {}
    var vehLine = VEH_FIELDS.map(function (f) { return f.label + "=" + (veh[f.k] || "(none)"); }).join(" · ");
    return "H.A.H.N.S diagnostic — version " + BUILD + "\n" +
      "update reminder — last acknowledged week: " + remindSeen + " · this week: " + wedMarker(Date.now()) + "\n" +
      "looks like Vehicle Summary page: " + (isSum ? "yes" : "no") + "\n" +
      "vehicle grab (from last scan): " + vehLine + "\n" +
      "flags: B=read as bold, H=recognised as a part heading\n" +
      "detected page header: \"" + hdr + "\"\n" +
      "large images on page: " + cands.length + " · diagrams kept: " + displayCount +
      (seqRef ? " (incl. tightening-sequence diagram)" : "") +
      (picked.length ? " (" + picked[0].slice(0, 80) + " …)" : "") + "\n" +
      "segments captured: " + lastSegments.length + "\n\n" + lines.join("\n");
  }

  // keep the panel on-screen
  function clampPos(left, top, wrap) {
    var w = wrap.offsetWidth || 330, vw = window.innerWidth, vh = window.innerHeight;
    return {
      left: Math.max(12 - w + 80, Math.min(left, vw - 80)),
      top: Math.max(0, Math.min(top, vh - 28))
    };
  }

  // drag the panel by its header. Pointer capture routes every move/up event to
  // the handle — so dragging keeps working even when the cursor passes over an
  // ELSA iframe (which would otherwise swallow the events).
  function makeDraggable(wrap, handle) {
    if (!handle) return;
    handle.addEventListener("pointerdown", function (e) {
      if ((e.target.closest && e.target.closest("button")) || e.button !== 0) return;
      e.preventDefault();
      var rect = wrap.getBoundingClientRect();
      var sx = e.clientX, sy = e.clientY, sl = rect.left, st = rect.top;
      wrap.style.right = "auto";
      try { handle.setPointerCapture(e.pointerId); } catch (_) {}
      function move(ev) {
        var p = clampPos(sl + (ev.clientX - sx), st + (ev.clientY - sy), wrap);
        wrap.style.left = p.left + "px"; wrap.style.top = p.top + "px";
      }
      function up() {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
        try { handle.releasePointerCapture(e.pointerId); } catch (_) {}
        savePos({ left: parseInt(wrap.style.left, 10) || 0, top: parseInt(wrap.style.top, 10) || 0 });
      }
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
    });
  }


  function renderInto(host, r, options) {
    options = options || {};
    var onRescan = options.onRescan;
    var root = host.__vwjbShadow || host.attachShadow({ mode: "open" });
    host.__vwjbShadow = root;
    // remember the scroll position so a rebuild (add/delete/edit/scan) doesn't
    // snap the list back to the top
    var prevBody = root.querySelector(".body");
    var prevScroll = prevBody ? prevBody.scrollTop : 0;
    root.innerHTML = "<style>" + CSS + "</style>" + buildHTML(r, options.embed);
    vehNotice = "";   // a blocked-scan note shows once, then clears on next render
    var newBody = root.querySelector(".body");
    if (newBody) newBody.scrollTop = prevScroll;

    // persist manual edits so they survive navigating to the next page
    function persist() { if (options.persist) saveJob(r); }

    // generic inline Yes/No confirm: swap `btn` for a small confirm, run onYes on
    // Yes, just re-render on No. Used by the clear buttons (destructive actions).
    function inlineConfirm(btn, msg, onYes) {
      var cf = document.createElement("span");
      cf.className = "confirm";
      cf.innerHTML = '<span class="ctxt">' + esc(msg) + '</span>' +
        '<button class="cyes">Yes</button><button class="cno">No</button>';
      btn.replaceWith(cf);
      cf.querySelector(".cyes").addEventListener("click", onYes);
      cf.querySelector(".cno").addEventListener("click", function () { renderInto(host, r, options); });
    }

    // per-group "Clear" — empties just that section (or the diagrams), keeping the
    // rest of the job and the vehicle. Confirmed inline so a stray click is safe.
    root.querySelectorAll("[data-clear]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var key = btn.getAttribute("data-clear");
        inlineConfirm(btn, "Clear all?", function () {
          if (key === "__images") r.__images = [];
          else if (r[key]) r[key] = [];
          persist();
          renderInto(host, r, options);
        });
      });
    });

    // editable part labels — type the component name when auto-detection misses.
    // Stored only in memory for this view; nothing is written to disk.
    root.querySelectorAll(".lbl").forEach(function (lbl) {
      lbl.addEventListener("click", function () {
        var k = lbl.getAttribute("data-k");
        var i = +lbl.getAttribute("data-i");
        var inp = document.createElement("input");
        inp.type = "text";
        inp.className = "lblin";
        inp.value = r[k][i].part || "";
        inp.placeholder = "name this part";
        lbl.replaceWith(inp);
        inp.focus();
        inp.select();
        var done = false;
        var commit = function (save) {
          if (done) return;
          done = true;
          if (save) { r[k][i].part = inp.value.trim(); persist(); }
          renderInto(host, r, options);
        };
        inp.addEventListener("keydown", function (e) {
          if (e.key === "Enter") { e.preventDefault(); commit(true); }
          else if (e.key === "Escape") { e.preventDefault(); commit(false); }
        });
        inp.addEventListener("blur", function () { commit(true); });
      });
    });

    // editable vehicle fields — fix a mis-read value or fill a blank by hand.
    // Stored in memory + sessionStorage (alongside the job), nothing leaves the page.
    root.querySelectorAll(".vval").forEach(function (cell) {
      cell.addEventListener("click", function () {
        if (!r.__vehicle) return;
        cancelVehAuto();          // don't let the bar auto-collapse while editing
        setVehExp(true);          // keep it open across the edit's re-render
        var vk = cell.getAttribute("data-vk");
        var inp = document.createElement("input");
        inp.type = "text";
        inp.className = "vvalin";
        inp.value = r.__vehicle[vk] || "";
        inp.placeholder = "type the value";
        cell.replaceWith(inp);
        inp.focus();
        inp.select();
        var done = false;
        var commit = function (save) {
          if (done) return;
          done = true;
          if (save) { r.__vehicle[vk] = inp.value.trim(); persist(); }
          renderInto(host, r, options);
        };
        inp.addEventListener("keydown", function (e) {
          if (e.key === "Enter") { e.preventDefault(); commit(true); }
          else if (e.key === "Escape") { e.preventDefault(); commit(false); }
        });
        inp.addEventListener("blur", function () { commit(true); });
      });
    });

    // manual "+ add" — type a line the helper missed; added to this view only
    root.querySelectorAll(".addrow").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var k = btn.getAttribute("data-add");
        var inp = document.createElement("input");
        inp.type = "text";
        inp.className = "addin";
        inp.placeholder = "type a line, then Enter";
        btn.replaceWith(inp);
        inp.focus();
        var done = false;
        var commit = function (save) {
          if (done) return;
          done = true;
          var v = inp.value.trim();
          if (save && v) { r[k].push({ text: v, part: "", src: "Added by hand" }); persist(); }
          renderInto(host, r, options);
        };
        inp.addEventListener("keydown", function (e) {
          if (e.key === "Enter") { e.preventDefault(); commit(true); }
          else if (e.key === "Escape") { e.preventDefault(); commit(false); }
        });
        inp.addEventListener("blur", function () { commit(true); });
      });
    });

    // click a diagram to open it full-size in a new tab
    root.querySelectorAll(".dgm").forEach(function (im) {
      im.addEventListener("click", function () {
        try { window.open(im.getAttribute("data-full"), "_blank"); } catch (e) {}
      });
    });

    // remove an unwanted diagram
    root.querySelectorAll(".dgmdel").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var url = btn.getAttribute("data-imgdel");
        r.__images = (r.__images || []).filter(function (im) { return im.url !== url; });
        persist();
        renderInto(host, r, options);
      });
    });

    // locate-on-page magnifier — scroll ELSA to where this item was found and
    // pulse it yellow. Greyed (".off") buttons are from an earlier page and do
    // nothing (their element no longer exists on this page).
    root.querySelectorAll(".find").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        if (e && e.stopPropagation) e.stopPropagation();
        if (btn.className.indexOf("off") !== -1) return;
        var el = locEl(btn.getAttribute("data-loc"));
        if (el) highlightOnPage(el);
      });
    });

    // trash icon — drop a line the job doesn't need
    root.querySelectorAll(".del").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var k = btn.getAttribute("data-del");
        var i = +btn.getAttribute("data-i");
        if (r[k] && i >= 0 && i < r[k].length) {
          r[k].splice(i, 1);
          persist();
          renderInto(host, r, options);
        }
      });
    });

    // ✕ on a tool chip — removes that tool (chip + its list row are the same tool)
    root.querySelectorAll("[data-chipdel]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var num = (btn.getAttribute("data-chipdel") || "").toLowerCase();
        r.tools = (r.tools || []).filter(function (it) { return (it.num || "").toLowerCase() !== num; });
        persist();
        renderInto(host, r, options);
      });
    });

    root.querySelectorAll("[data-act]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        var act = btn.getAttribute("data-act");
        if (act === "fluids") {
          // open the lookup in a small, centered pop-up window (not a full tab):
          // just wide enough for the content (page is max-width 580px) so there's
          // no side-scrolling, and tall with vertical scroll. A fixed window name
          // means a second lookup reuses the same pop-up instead of stacking up.
          if (e && e.preventDefault) e.preventDefault();
          var url = btn.getAttribute("href");
          var w = 620, h = 820;
          try {
            if (screen && screen.availWidth) w = Math.min(w, screen.availWidth - 40);
            if (screen && screen.availHeight) h = Math.min(h, screen.availHeight - 80);
          } catch (e2) {}
          var left = 0, top = 0;
          try {
            left = Math.max(0, Math.round(((screen.availWidth || w) - w) / 2));
            top = Math.max(0, Math.round(((screen.availHeight || h) - h) / 2));
          } catch (e3) {}
          var feats = "width=" + w + ",height=" + h + ",left=" + left + ",top=" + top +
            ",scrollbars=yes,resizable=yes,menubar=no,toolbar=no,location=no,status=no";
          var win = null;
          try { win = window.open(url, "hahns_fluids", feats); } catch (e4) {}
          if (win) { try { win.focus(); } catch (e5) {} }
          else { try { window.open(url, "_blank"); } catch (e6) {} }   // pop-up blocked → fall back to a tab
          return;
        }
        if (act === "close") {
          // the job lives only in memory/sessionStorage, so closing discards it —
          // guard against an accidental click with an explicit confirmation
          var ov = document.createElement("div");
          ov.className = "exitc";
          ov.innerHTML = '<div class="exitbox">' +
            '<p class="exittl">Are you sure you want to exit?</p>' +
            '<p class="exitmsg">All collected job info will be lost.</p>' +
            '<div class="exitbtns"><button class="exno">Cancel</button>' +
            '<button class="exyes">Exit</button></div></div>';
          root.appendChild(ov);
          var closeOv = function () { try { ov.remove(); } catch (e) {} };
          ov.querySelector(".exno").addEventListener("click", closeOv);
          ov.addEventListener("click", function (e) { if (e.target === ov) closeOv(); });
          ov.querySelector(".exyes").addEventListener("click", function () {
            // a real exit discards the job — wipe all stored state so a fresh
            // open starts clean (matches the "all info will be lost" promise)
            try {
              clearJob();
              sessionStorage.removeItem("vwjb_pos_v1");
              sessionStorage.removeItem("vwjb_min_v1");
              sessionStorage.removeItem("vwjb_vehexp_v1");
            } catch (e) {}
            host.remove();
          });
        } else if (act === "reminddismiss") {
          // this Wednesday's marker was already recorded when the banner became
          // due, so dismissing just clears it from the current view
          remindDue = false;
          renderInto(host, r, options);
        } else if (act === "min") {
          setMin(!isMin());
          renderInto(host, r, options);
        } else if (act === "rescan" && typeof onRescan === "function") {
          onRescan();
        } else if (act === "newjob" && typeof options.onNewJob === "function") {
          // New Vehicle wipes EVERYTHING (vehicle + all collected info) — confirm first
          inlineConfirm(btn, "New vehicle? Clears all.", function () { options.onNewJob(); });
        } else if (act === "clearinfo") {
          // clear the COLLECTED info (specs, tools, warnings, diagrams, title) but
          // keep the loaded vehicle — confirmed inline so a stray click is safe
          inlineConfirm(btn, "Clear all info?", function () {
            SECTIONS.forEach(function (s) { r[s.key] = []; });
            r.__images = [];
            r.__title = "";
            persist();
            renderInto(host, r, options);
          });
        } else if (act === "vehcollapse") {
          cancelVehAuto(); setVehExp(false); renderInto(host, r, options);
        } else if (act === "vehexpand") {
          cancelVehAuto(); setVehExp(true); renderInto(host, r, options);
        } else if (act === "copy") {
          copyText(plainText(r), toast("Copied"));
        } else if (act === "print") {
          printJob(r);
        }
      });
    });

    // the job title bar — editable, kept in memory only (like the part labels)
    var job = root.querySelector(".job");
    if (job) job.addEventListener("input", function () { r.__title = job.value; persist(); });

    // per-page source headers — rename a page; applies to that page in EVERY
    // section. Commit on change (blur/Enter) so typing doesn't lose focus.
    root.querySelectorAll(".srch").forEach(function (inp) {
      inp.addEventListener("change", function () {
        var oldL = inp.getAttribute("data-src");
        var newL = inp.value.trim();
        if (newL === oldL) return;
        SECTIONS.forEach(function (s) {
          (r[s.key] || []).forEach(function (it) { if ((it.src || "") === oldL) it.src = newL; });
        });
        (r.__images || []).forEach(function (im) { if ((im.src || "") === oldL) im.src = newL; });
        persist();
        renderInto(host, r, options);
      });
    });

    // click the build stamp to copy the diagnostic dump
    var bld = root.querySelector(".bld");
    if (bld) bld.addEventListener("click", function () {
      copyText(debugDump(), toast("Diagnostic copied"));
    });

    // draggable panel — restore where the tech parked it, then make it movable
    if (!options.embed) {
      var wrap = root.querySelector(".wrap");
      var pos = loadPos();
      if (wrap && pos) {
        var p = clampPos(pos.left, pos.top, wrap);
        wrap.style.left = p.left + "px"; wrap.style.top = p.top + "px"; wrap.style.right = "auto";
      }
      if (wrap) makeDraggable(wrap, root.querySelector(".hd"));
    }

    // auto-collapse the vehicle bar a few seconds after it first shows, to free up
    // vertical space. Only once per page load, only if the tech hasn't set their own
    // preference yet (state still null) and the panel isn't minimized. Manual
    // toggling or editing a field cancels this (see cancelVehAuto).
    if (!options.embed && vehLoaded(r) && !isMin() && vehExpState() === null && !vehAutoArmed) {
      vehAutoArmed = true;
      vehCollapseTimer = setTimeout(function () {
        vehCollapseTimer = null;
        if (vehExpState() === null) { setVehExp(false); renderInto(host, r, options); }
      }, 3000);
    }

    // fast custom tooltips — the native `title` delay (~1 s) can't be shortened, so
    // any [data-tip] element gets a quick (180 ms) JS tooltip instead. One shared
    // bubble, appended to the panel (not the scrolling body) so it isn't clipped.
    (function () {
      var wrap = root.querySelector(".wrap");
      if (!wrap) return;
      var tip = document.createElement("div");
      tip.className = "tip";
      wrap.appendChild(tip);
      var timer = null;
      function hide() { tip.classList.remove("on"); tip.style.display = "none"; }
      function show(el) {
        if (!el.isConnected) return;
        var msg = el.getAttribute("data-tip");
        if (!msg) return;
        tip.textContent = msg;
        tip.style.display = "block";
        var er = el.getBoundingClientRect(), wr = wrap.getBoundingClientRect(), tr = tip.getBoundingClientRect();
        var left = (er.left - wr.left) + er.width / 2 - tr.width / 2;
        left = Math.max(6, Math.min(left, wr.width - tr.width - 6));
        var top = (er.top - wr.top) - tr.height - 7;          // prefer above
        if (top < 4) top = (er.top - wr.top) + er.height + 7;  // not enough room → below
        tip.style.left = Math.round(left) + "px";
        tip.style.top = Math.round(top) + "px";
        tip.classList.add("on");
      }
      root.querySelectorAll("[data-tip]").forEach(function (el) {
        el.addEventListener("mouseenter", function () { clearTimeout(timer); timer = setTimeout(function () { show(el); }, 180); });
        el.addEventListener("mouseleave", function () { clearTimeout(timer); hide(); });
        el.addEventListener("click", function () { clearTimeout(timer); hide(); });
      });
    })();

    function toast(msg) {
      return function () {
        var t = root.querySelector(".toast");
        if (t) { t.textContent = msg; t.classList.add("on"); setTimeout(function () { t.classList.remove("on"); }, 1300); }
      };
    }
  }

  /* ------------------------------------------------------------------ *
   * 5. RUN — bookmarklet entry point. Toggle: open if closed, refresh
   *    if already open, close on the next click via the X.
   * ------------------------------------------------------------------ */

  function run() {
    var ID = "vwjb-host-9a3f";
    var existing = document.getElementById(ID);
    if (existing) existing.remove();

    var host = document.createElement("div");
    host.id = ID;
    document.documentElement.appendChild(host);

    var show = function (job) {
      saveJob(job);
      renderInto(host, job, { onRescan: scan, onNewJob: newJob, persist: true });
    };
    // one Scan button, auto-detected:
    //  - until a vehicle is loaded, a scan MUST be the Vehicle Summary page.
    //    Finding a VIN loads the vehicle (other fields fill in / get flagged);
    //    finding none is blocked with a prompt — no procedure specs collected.
    //  - once a vehicle is loaded, a scan ADDS the page's specs to the job.
    function scan() {
      var job = loadJob() || emptyResults();
      var segs = gatherSegments(document);
      lastSegments = segs;   // keep the diagnostic dump in sync even when blocked

      if (!vehLoaded(job)) {
        // a VIN in ELSA's header is NOT enough — only load from the real Vehicle
        // Summary page, so a repair page can't seed a wrong/partial vehicle
        if (isVehicleSummaryPage(segs)) {
          var veh = extractVehicle(segs);
          if (veh && veh.vin) {
            job.__vehicle = veh;   // accept + flag any blank fields in the bar
            vehNotice = "";
          } else {
            vehNotice = "Read the Vehicle Summary but couldn’t find a VIN — click SCAN again.";
          }
        } else {
          // gating: don't collect anything until a vehicle is loaded
          vehNotice = "This isn’t the Vehicle Summary page. Open ELSA’s Vehicle Summary, then click SCAN.";
        }
        show(job);
        return;
      }

      var header = detectTitle(document) || ("Page " + (srcCount(job) + 1));
      if (!job.__title) job.__title = header;
      // work out the dominant diagram(s) FIRST, so the extractor only treats those
      // as figure boundaries (a small non-dominant image can't restart numbering)
      var cands = gatherImages(document);
      var dominant = pickDiagrams(cands);
      var keepSet = {}; dominant.forEach(function (u) { keepSet[u] = 1; });
      var pageR = extractSegments(segs, keepSet);
      // diagrams to DISPLAY. Normally just the dominant overview, but if the page
      // refers to a tightening sequence the supplementary sequence diagram is
      // smaller (dominance would drop it) — keep it too, for display only (NOT as a
      // figure boundary, so it can't restart the bolt numbering).
      var displayUrls = dominant.slice();
      var hasSeqRef = pageR.__seqSeen || (pageR.torque || []).some(function (it) { return it.seq || SEQ_REF_RE.test(it.text || ""); });
      // the sequence section's header (its own group label for steps + diagram)
      var seqTitle = "Tightening Specifications and Sequence";
      (pageR.torque || []).some(function (it) { if (it.seq && it.seqTitle) { seqTitle = it.seqTitle; return true; } return false; });
      if (hasSeqRef) {
        var have = {}; displayUrls.forEach(function (u) { have[u] = 1; });
        var byUrl = {}; cands.forEach(function (c) { if (!(c.url in byUrl) || c.area > byUrl[c.url]) byUrl[c.url] = c.area; });
        Object.keys(byUrl).forEach(function (u) { if (!have[u] && byUrl[u] >= 45000) displayUrls.push(u); });
      }
      // only capture diagrams on overview pages (those with numbered components)
      var keptUrls = hasNumberedParts(pageR) ? displayUrls : [];
      // map each kept diagram URL to the figure it introduced (from the walk)
      var figByUrl = {};
      (pageR.__figImages || []).forEach(function (m) { if (!(m.url in figByUrl)) figByUrl[m.url] = m.fig; });
      // split into figures only when ≥2 dominant diagrams were actually kept
      var keptFigs = {};
      dominant.forEach(function (u) { keptFigs[figByUrl[u] || 0] = 1; });
      var multiFig = Object.keys(keptFigs).length >= 2;
      // when a page has several diagrams, tag each item/diagram with "… · Fig N" so
      // the existing per-source grouping separates them and numbers restart per
      // diagram. A normal single-diagram page keeps just the page header (unchanged).
      var figLabel = function (f) { return header + " · Fig " + ((f || 0) + 1); };
      SECTIONS.forEach(function (s) {
        pageR[s.key].forEach(function (it) {
          // sequence steps get their own group header (the table/diagram title), so
          // they break out from the component torques like a separately-scanned page
          if (it.seq) it.src = it.seqTitle || seqTitle;
          else it.src = (multiFig && s.autoPart) ? figLabel(it.fig) : header;
        });
      });
      var domSet = {}; dominant.forEach(function (u) { domSet[u] = 1; });
      pageR.__images = keptUrls.map(function (u) {
        // the supplementary (non-dominant) diagram is the sequence one → group it
        // under the sequence header alongside its steps
        if (!domSet[u]) return { src: seqTitle, url: u };
        return { src: multiFig ? figLabel(figByUrl[u] || 0) : header, url: u };
      });
      mergeInto(job, pageR);
      show(job);
      // some diagram images (esp. a 2nd, lower-down sequence diagram) may still be
      // loading on the first scan → their size reads 0 and they're skipped. Wait for
      // in-flight images to finish, then re-scan ONCE so they get captured.
      scheduleImageRescan(scan);
    }
    // wipe everything — empty list, empty title, cleared storage. The next
    // "Scan page" starts collecting the new job from scratch.
    function newJob() {
      clearJob();
      show(emptyResults());
    }
    // weekly update-check reminder (pure local date — no network): shows once,
    // only on Wednesdays. We can't know if the app is actually stale, so it's a
    // gentle nudge, not an alert.
    remindDue = reminderDue();

    // open showing the current job (blank if nothing collected yet) WITHOUT
    // auto-scanning — scanning the page is a deliberate "Scan page" click
    show(loadJob() || emptyResults());
  }

  window.VWJB = { run: run, extract: extract, extractSegments: extractSegments,
    gatherSegments: gatherSegments, renderInto: renderInto, plainText: plainText,
    emptyResults: emptyResults, mergeInto: mergeInto, loadJob: loadJob,
    saveJob: saveJob, clearJob: clearJob, extractVehicle: extractVehicle,
    isVehicleSummaryPage: isVehicleSummaryPage };
})();
