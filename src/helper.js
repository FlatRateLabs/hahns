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
  // ---- shop special-tool list (v0.3.10; moved to IndexedDB v0.3.16) -------
  // A per-shop list (tool number -> drawer/location, plus any "missing / check
  // part number" status note) the tech uploads as a CSV / .xlsx. Stored ONLY on
  // this machine (under ELSA's origin) — never uploaded, never on GitHub. Powers
  // the drawer locations + "Find these tools" gather list in the Special Tools
  // section. Reading a user-picked file via FileReader is a LOCAL read, not a
  // network call, so the bookmarklet's zero-network posture on ELSA is intact.
  // As of v0.3.16 it lives in the shared `hahns_db` IndexedDB (the same DB
  // the fluid tables use) — one record in the `tools` store. A SYNCHRONOUS
  // in-memory cache (`shopTools`) is hydrated from IDB at boot so every render /
  // match path stays synchronous & unchanged. The old `vwjb_tools_v1`
  // localStorage key is kept only for a one-time migration + IDB-unavailable
  // fallback.
  var TOOLS_KEY = "vwjb_tools_v1";   // legacy localStorage (pre-v0.3.16) — migration source + fallback
  var shopTools = null;              // sync cache: null=unread, false=none, obj={updated,count,file,fmt,map}

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
  // is an element hidden (display:none / visibility:hidden)? — used to decide
  // whether a collapsed section needs revealing before we can scroll to it.
  function isElHidden(el) {
    try {
      var win = el.ownerDocument && el.ownerDocument.defaultView;
      var cs = win && win.getComputedStyle(el);
      if (cs && (cs.display === "none" || cs.visibility === "hidden")) return true;
    } catch (e) {}
    return false;
  }
  // A collapsed panel is usually opened by a control that points at it with
  // aria-controls, or a header just before it — but ONLY click things explicitly
  // marked aria-expanded="false" so we never fire a random (maybe destructive)
  // button. Standard accordion markup; no-op otherwise.
  function tryExpandPanel(panel) {
    try {
      var doc = panel.ownerDocument, cand = [];
      if (panel.id) {
        try { cand = cand.concat(Array.prototype.slice.call(doc.querySelectorAll('[aria-controls="' + panel.id.replace(/"/g, '\\"') + '"]'))); } catch (e0) {}
      }
      var prev = panel.previousElementSibling;
      if (prev) {
        if (prev.getAttribute && prev.getAttribute("aria-expanded") != null) cand.push(prev);
        if (prev.querySelector) { var q = prev.querySelector("[aria-expanded]"); if (q) cand.push(q); }
      }
      for (var i = 0; i < cand.length; i++) {
        var c = cand[i];
        if (c && c.getAttribute && c.getAttribute("aria-expanded") === "false") {
          try { c.click(); } catch (e1) {}
          if (!isElHidden(panel)) return;
        }
      }
    } catch (e) {}
  }
  // Reveal the element if it lives inside a collapsed/hidden section — ELSA lists
  // special tools (and other data) in expandable dropdowns, and scroll/highlight
  // can't land on a hidden node. Best-effort + defensive: opens <details>, drops
  // the `hidden` attribute, and clicks a standard aria toggle, walking up through
  // ancestors and out of any nested iframe. Never throws into the host page.
  function revealForLocate(el) {
    var node = el, hops = 0;
    while (node && hops < 15) {
      hops++;
      var p = node.parentNode;
      while (p && p.nodeType === 1) {
        try {
          if (p.tagName === "DETAILS" && !p.open) p.open = true;
          if (p.hasAttribute && p.hasAttribute("hidden")) p.removeAttribute("hidden");
          if (isElHidden(p)) tryExpandPanel(p);
        } catch (e) {}
        p = p.parentNode;
      }
      try { node = node.ownerDocument.defaultView.frameElement; } catch (e2) { node = null; }
    }
  }
  // scroll ELSA to the element (incl. its iframe, if nested) and pulse it yellow,
  // then fade back. Uses inline !important styles only — no network, fully
  // reversible, never touches ELSA's stylesheets.
  function highlightOnPage(el) {
    clearHi();
    try { revealForLocate(el); } catch (eRev) {}
    var doScroll = function () {
      try { el.scrollIntoView({ behavior: "smooth", block: "center" }); }
      catch (e) { try { el.scrollIntoView(); } catch (e2) {} }
      try {
        var fe = el.ownerDocument && el.ownerDocument.defaultView && el.ownerDocument.defaultView.frameElement;
        if (fe && fe.scrollIntoView) fe.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch (e3) {}
    };
    doScroll();
    // a just-expanded panel often animates open — scroll once more after it settles
    setTimeout(doScroll, 350);
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
      // NOT scanned from the repair manual (fluids live in a separate per-year PDF
      // the tech loads through ⚙ Settings). This section is a button that opens the
      // vehicle-matched lookup in a locally-built window. See fluidsBar()/openFluidsWindow().
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

  /* ------------------------------------------------------------------ *
   *  Shop special-tool list — a local CSV/.xlsx the tech uploads (v0.3.10).
   *  Stored as { updated, count, file, fmt, map:{ NORM:{n,d,s} } } in the
   *  shared `hahns_db` IndexedDB (v0.3.16; was localStorage pre-v0.3.16),
   *  THIS machine only. Never leaves the page / no network. `shopTools` is a
   *  synchronous cache hydrated from IDB at boot (see fluidsBoot); saves are
   *  async but update the cache first so renders stay synchronous.
   * ------------------------------------------------------------------ */

  // match key: strip everything but letters/digits, uppercase. So ELSA's
  // "VAS 6909" lines up with a sheet's "VAS6909", and "10-222 A/10" with
  // "10-222A/10". Sub-parts stay distinct (10222A10 != 10222A).
  function normTool(s) { return String(s == null ? "" : s).toUpperCase().replace(/[^A-Z0-9]/g, ""); }

  function todayISO() {
    var d = new Date(), m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" + m : m) + "-" + (day < 10 ? "0" + day : day);
  }

  // synchronous read of the cache. Hydrated from IndexedDB at boot
  // (hydrateShopTools). If a render path asks before boot finishes — or IDB is
  // unavailable — fall back to a one-off legacy localStorage read so the feature
  // still works and there's no flash of "no list" on first paint.
  function loadShopTools() {
    if (shopTools !== null) return shopTools || null;
    try { var raw = localStorage.getItem(TOOLS_KEY); shopTools = raw ? JSON.parse(raw) : false; }
    catch (e) { shopTools = false; }
    return shopTools || null;
  }
  // persist the shop list. Updates the sync cache immediately (so the next render
  // shows it), then writes to IndexedDB. Returns a Promise<boolean>. Falls back to
  // localStorage if IDB is unavailable or the write fails, so a save never no-ops.
  function saveShopTools(obj) {
    shopTools = obj; _toolDict = null; _toolDictSig = "";   // cache + invalidate matcher
    if (appIdbOk && appDB) {
      return idbPut("tools", { k: "shop", data: obj }).then(function () { return true; }, function () {
        try { localStorage.setItem(TOOLS_KEY, JSON.stringify(obj)); return true; } catch (e) { return false; }
      });
    }
    try { localStorage.setItem(TOOLS_KEY, JSON.stringify(obj)); return Promise.resolve(true); }
    catch (e) { return Promise.resolve(false); }
  }
  function removeShopTools() {
    shopTools = false; _toolDict = null; _toolDictSig = "";
    try { localStorage.removeItem(TOOLS_KEY); } catch (e) {}
    if (appIdbOk && appDB) { try { appDB.transaction("tools", "readwrite").objectStore("tools").clear(); } catch (e) {} }
  }
  // one-time: copy a pre-v0.3.16 localStorage tool list into IDB. Guarded by a kv
  // flag so it runs once. The localStorage key is left in place as a fallback.
  function migrateLegacyTools() {
    return idbGet("kv", "migratedToolsV1").then(function (flag) {
      if (flag && flag.v) return;
      var old = null;
      try { old = JSON.parse(localStorage.getItem(TOOLS_KEY) || "null"); } catch (e) {}
      var chain = (old && old.map) ? idbPut("tools", { k: "shop", data: old }) : Promise.resolve();
      return chain.then(function () { return idbPut("kv", { k: "migratedToolsV1", v: 1, at: todayISO() }); });
    });
  }
  // hydrate the sync cache from IDB (called from fluidsBoot after the DB opens).
  function hydrateShopTools() {
    return idbGet("tools", "shop").then(function (rec) {
      shopTools = (rec && rec.data && rec.data.map) ? rec.data : false;
      _toolDict = null; _toolDictSig = "";
    }).catch(function () { /* leave cache null → loadShopTools falls back to localStorage */ });
  }

  // look a tool number up in the loaded shop list (or null)
  function matchShopTool(num) {
    var st = loadShopTools();
    if (!st || !st.map) return null;
    return st.map[normTool(num)] || null;
  }

  // A matcher built from the uploaded shop list so the page scan ALSO catches
  // tools whose format the generic TOOL_RE misses — e.g. "VW 771" / "VW 771/37".
  // We deliberately do NOT add a generic "VW ###" rule to TOOL_RE: that would
  // grab fluid specs like "VW 502 00". Matching only against tools that are
  // actually on the shop's own list sidesteps that. Pure-number tools are skipped
  // (they'd collide with torque values / part numbers); anything with a letter is
  // fair game. Rebuilt only when the list changes (keyed on updated+count).
  var _toolDict = null, _toolDictSig = "";
  function reEsc(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  var TOOL_SEP = "[\\s.\\u2010-\\u2015\\-/]*";   // spaces, dots, dashes, slashes — 0+
  function toolDict() {
    var st = loadShopTools();
    if (!st || !st.map) { _toolDict = null; _toolDictSig = ""; return null; }
    var sig = (st.updated || "") + "|" + (st.count || 0);
    if (_toolDict && _toolDictSig === sig) return _toolDict;
    var pats = [];
    Object.keys(st.map).forEach(function (norm) {
      if (norm.length < 3 || !/[A-Z]/.test(norm)) return;      // skip short / pure-number keys
      var orig = (st.map[norm] && st.map[norm].n) || norm;
      var parts = String(orig).toUpperCase().match(/[A-Z0-9]+/g);
      if (!parts || !parts.length) return;
      pats.push({ len: norm.length, src: parts.map(reEsc).join(TOOL_SEP) });
    });
    _toolDictSig = sig;
    if (!pats.length) { _toolDict = null; return null; }
    pats.sort(function (a, b) { return b.len - a.len; });       // longest first: "VW 771/37" beats "VW 771"
    try { _toolDict = { re: new RegExp("\\b(?:" + pats.map(function (p) { return p.src; }).join("|") + ")\\b", "gi"), map: st.map }; }
    catch (e) { _toolDict = null; }
    return _toolDict;
  }

  // ---- Built-in VW special-tool list (v0.3.16) --------------------------
  // A curated master list so the page scan recognises these tools even with NO
  // shop list loaded (and catches formats TOOL_RE misses). Tools WITH a letter or
  // separator match anywhere (word-boundaried); a BARE-INTEGER tool (e.g. "1833")
  // matches ONLY as a VW callout — dash-wrapped like "-1833-" — so ordinary
  // numbers on the page (torque values, years, part-number fragments) aren't
  // mistaken for tools. Built once (constant list), then memoised.
  var BUILTIN_TOOLS = ["1833","2003","2010","2026","2036","2039","2050","2085","2587","2596","3033","3036","3067","3070","3079","3083","3099","3114","3118","3129","3147","3176","3180","3203","3212","3217","3220","3240","3241","3253","3266","3269","3270","3282","3299","3301","3305","3307","3310","3312","3316","3357","3359","3362","3364","3365","3366","3368","3369","3370","3371","3387","3391","3392","3400","3409","3410","3411","3415","3417","3424","3438","3450","3904","4003","9613","10200","10202","10369","10-203","10-206","10-222A","10-222A/10","10-222A/12","10-222A/13","10-222A/16","10-222A/16-1","10-222A/17","10-222A/18","10-222A/19","10-222A/22","10-222A/25","10-222A/28","10-222A/28-1","10-222A/28-2","10-222A/29","10-222A/3","10-222A/31-2","10-222A/31A","10-222A/35","10-222A/4","10-222A/5","10-222A/6","10-222A/7","10-222A/8","10-222B","10-22A/14","1184-13100","1184-14100","1184-15100","1310/25","17707","2024A","2024B","204/1","2085/2","30-211A","30-23","3032A","3047A","3122B","3145/2","3190A","3241/5","3247","3257","3276A","3282/29","3282/71","3287A","3300A","3356","3450/2A","3450/3","40-105","401NSM","4487-1","5571/9","582277","621001US","7/16 WLL 3/8T","80-200","8333-VW","8443A-VW","9336A","9336B","9721","9723","9725","9727","9729","9730","9735","9738","9741","9908","9951","9952","ACT760B","BGP9850","BRT-DBL4","C2934","c-4995A","CAB400A","CAB400B","FLUKE835","FM3000DH","FM3000GH","GRX3000VAS","HUNRX10KAU","HUNRX10KAUBL","HUNTCA34SBLK","J-48840","J-48843","J-48844","JC1000","KL3633","KL9001","KLI9210/50","KLI9210/52","KLI9210/54","KLI9210/55","KLI9210/57","KLI9210DLX","KLIAT1006","LIL20540","MCAL12A","MD9981","MD998772","MTRMSP0702","MTRPSC700SKT","MWG3282-49","NRI71233A","OTC7503","PRO8000A","ROB134APF","ROTSPOA10RA","RTI360831840","SET PICK I","SET PICK L","SET740","SET850","SNA007","T03000","T03001","T03002","T03003","T03003A","T03004","T03005A","T03006","T10001","T10004","T10006A","T10007A","T10008","T10010","T10011","T10012","T10013","T10014","T10020","T10021","T10027A","T10034","T10038","T10039","T10044","T10049","T10050","T10051","T10051A","T10052","T10053","T10054","T10055","T10055/1","T10055/4","T10057","T10058","T10060A","T10061","T10066","T10068A","T10069","T10070","T10071","T10092","T10093","T10094A","T10095A","T10096","T10097","T10099","T10100","T10101A","T10103/1","T10107A","T10115","T10118","T10122/1","T10122/2","T10122/3","T10122/4","T10122/5","T10122/6","T10122B","T10122C","T10133/23","T10133C","T10134","T10143","T10145","T10146","T10146/6","T10149","T10157/1","T10158/1","T10159A","T10159B","T10160","T10161","T10162A","T10165","T10166","T10170A","T10171A","T10172/11","T10172/4","T10172/5-9","T10172A","T10173","T10174","T10175","T10176","T10177","T10178","T10179","T10181","T10182","T10183","T10187","T10188","T10189","T10190","T10197","T10198","T10202","T10206","T10209","T10215","T10219","T10228","T10230","T10230/14-16","T10236","T10238","T10243","T10252","T10255","T10264","T10265","T10300","T10302","T10303","T10313","T10315","T10320","T10323","T10332","T10333","T10337","T10338","T10339","T10340","T10346","T10346/1","T10352/3","T10352/5","T10352B","T10352C","T10353","T10353/1","T10354","T10355A","T10356/7+/8","T10356A","T10358","T10359/2","T10359A","T10360","T10363","T10364","T10368","T10369","T10370","T10371","T10372","T10373","T10373A","T10374","T10375","T10376","T10377","T10378","T10382","T10383","T10384","T10385","T10387","T10388","T10389","T10391","T10392","T10394","T10395B","T10401","T10406","T10407","T10408","T10408/1","T10408/2","T10408/3","T10409","T10415","T10419","T10420","T10420A","T10421","T10422A","T10423","T10439","T10441","T10442","T10443","T10444","T10448","T10452","T10457","T10461","T10466","T10467","T10468","T10472","T10473","T10475","T10478B","T10479A","T10480","T10485A","T10486A","T10487","T10488","T10489","T10490","T10491","T10492","T10493","T10494","T10497A","T10498","T10499","T10499A","T10500","T10501","T10504","T10505","T10506","T10508","T10511","T10512","T10513","T10515","T10516","T10517","T10518","T10518A","T10520","T10520A","T10524","T10525","T10526","T10527","T10530","T10531","T10531/5-/6","T10533","T10538","T10539","T10541","T10546","T10547","T10548","T10549","T10554","T10558A","T10561","T10563","T10567","T10568","T10570","T10571","T10575A","T10576","T10577","T10578","T10581","T10582","T10585","T10587","T10589","T10606","T10607","T10608","T10610","T10612","T10614","T10615","T10623","T10626","T10628","T10633","T10634","T10635","T10635/3","T10640","T10647","T10659","T10660","T10681","T10688","T10691","T20097","T20143/1/2","T30114","T40001","T40001/3","T40001/5","T40001/6","T40001/7","T40004","T40005","T40009","T40010A","T40011","T40012","T40019","T40039","T40045","T40048/1","T40048/2","T40048/7","T40048A","T40049","T40055","T40057","T40058","T40060","T40061","T40062","T40064","T40064/1","T40064/2","T40069","T40070","T40073","T40074","T40075A","T40080","T40087","T40091","T40091/1","T40091/2","T40091/3","T40091/4","T40091/4-8","T40091/8","T40093/1","T40093/2","T40093/3","T40093/3-2","T40093/3-6","T40093/4","T40093/5","T40093/6","T40093B","T40093C","T40094A","T40100","T40135","T40138","T40148","T40155","T40155A","T40159","T40175","T40178A","T40178B","T40187","T40191","T40196","T40199","T40218","T40237","T40243","T40245","T40246","T40248","T40262/1","T40263","T40263/1","T40265","T40266","T40267","T40268","T40270/12","T40271","T40271/3+/4","T40274","T40276","T40280","T40288","T40301","T40302","T40311","T40314","T40345","T40346","T40347","T40363","T40372","T40376A","T40379A","T40414","T40427","T40433","T40433/2A","T40434","T40435","T40452","T40463","T40465","T40503","T40504","T50014","T50112/1","T50112/17","T50117/11","T50117/12","T50117/13","T50117/6","T50117/7","T50117/8","T50117/9","T-70","US1033/S","US1058","US1059","US1061","US1062","US1063","US1071","US9025","V/159","V/170","V-160","VAG10351/1","VAG1274/10","VAG1274/2","VAG1274/3A4A","VAG1274/8","VAG1274/9","VAG1274B","VAG1318","VAG1318/16","VAG1318/16A","VAG1318/17A","VAG1318/20","VAG1331","VAG1331/1","VAG1331A","VAG1332/10","VAG1342","VAG1342/14","VAG1342/15+16","VAG1342/20+21","VAG1348/3-3","VAG1348/3A","VAG1397A","VAG1397B","VAG1402","VAG1402/17","VAG1402/1A","VAG1402/6","VAG1582","VAG1582/3","VAG1582/3A","VAG1582/4","VAG1582/4A","VAG1582/5","VAG1582/5A","VAG1582/7","VAG159/29","VAG1590","VAG1594/14A","VAG1594/29A","VAG1594/30A","VAG1594/31","VAG1594/51","VAG1594D","VAG1598/20","VAG1598/21","VAG1598/31","VAG1598/36","VAG1598/37","VAG1598/39","VAG1598/40","VAG1598/41","VAG1598/42","VAG1598/43","VAG1598/44","VAG1598/47","VAG1598/48","VAG1598/49","VAG1598/57","VAG1598/58","VAG1598A","VAG1682A","VAG1687","VAG1687/10","VAG1687/11","VAG1687/15","VAG1687/17","VAG1687/5","VAG1687/50","VAG1739","VAG1752","VAG1752/8","VAG1752/9","VAG1763","VAG1763/13","VAG1763/6","VAG1763/8","VAG1788/10","VAG1921","VAG1924","VAS1763/06","VAS1978/1-3","VAS1978/35-13","VAS1978/35-19","VAS1978B","VAS211 011","VAS211003","VAS241001","VAS251001","VAS251409","VAS251419","VAS2516/35","VAS251601","VAS251605","VAS251607","VAS251613","VAS251615","VAS251621","VAS251623","VAS251805","VAS262017","VAS271013","VAS271015","VAS281025","VAS501019","VAS50121","VAS5051/66","VAS5055/4","VAS5056/11B","VAS5056/12","VAS5056/14","VAS5056/15","VAS5056/5","VAS5056/6","VAS5056C","VAS5094","VAS5103A","VAS5155","VAS5161/19C","VAS5161A","VAS5161A/44","VAS5161A/46","VAS5190A","VAS5226","VAS5232/1","VAS5232/2","VAS5234","VAS5237","VAS5255","VAS5256","VAS5256/1","VAS5257","VAS5258","VAS5258A","VAS5259","VAS5260A","VAS5261","VAS5262","VAS5301/7","VAS531001","VAS531011","VAS5503A","VAS5565","VAS5570","VAS5571","VAS5572","VAS5575","VAS5578","VAS5579","VAS5583","VAS581005","VAS6025","VAS6046","VAS6046/3","VAS6056","VAS6058A","VAS6068","VAS6069","VAS6070","VAS6071","VAS6079","VAS6080A","VAS6095/01(R/,L)","VAS6095/1-22","VAS6095/1-4","VAS6095A","VAS6095A/1-21","VAS6095A/1-22","VAS6096","VAS6096/3","VAS6096-2","VAS6100","VAS6101","VAS6103","VAS6103/2","VAS6103/2-1","VAS611 007/19","VAS611007","VAS611-013","VAS6122","VAS6131/1","VAS6131/16","VAS6131/16-1","VAS6131/16-2","VAS6131/16-3","VAS6131/6","VAS6131/8","VAS6131B","VAS6136","VAS6138","VAS6150C","VAS6150E","VAS6150E/TSP","VAS6160A/TSP","VAS6160E","VAS6161","VAS6161/1","VAS6178","VAS6179","VAS6190/2","VAS6205","VAS6205-1","VAS6213","VAS6229","VAS6230BE3","VAS6230BE3NP","VAS6230BE4","VAS6230BE4NP","VAS6235","VAS6254","VAS6262/2","VAS6262A","VAS6262A/8","VAS6262A/SET2","VAS6291/2","VAS6291A","VAS6291A/4","VAS6292CM","VAS6292FM","VAS6292PCM","VAS6292PFM","VAS6292PLCM","VAS6292PLFM","VAS6292PLWM","VAS6292PLWMB","VAS6292PWM","VAS6292WM","VAS6320","VAS6330","VAS6337/1A","VAS6338/1","VAS6338/38","VAS6338/48","VAS6338/60","VAS6338/63","VAS6338/81","VAS6338/82","VAS6338/88","VAS6338/90","VAS6338/93","VAS6339","VAS6340","VAS6345","VAS6349","VAS6350/1A","VAS6350/2A","VAS6350/4","VAS6350A","VAS6356/11","VAS6362","VAS6365","VAS6367","VAS6368","VAS6369","VAS6370","VAS6371","VAS6373","VAS638/82","VAS6394","VAS6394/3","VAS6395/6","VAS6395B","VAS6427","VAS6430/10","VAS6430/1A","VAS6430/2","VAS6430/3","VAS6430/4","VAS6430/8","VAS6454","VAS6532A","VAS6532A/5","VAS6542","VAS6550","VAS6550/3","VAS6550/4","VAS6551","VAS6551/5","VAS6551/6","VAS6558/15","VAS6558/16","VAS6558/1A","VAS6558/9-1","VAS6558/9-2","VAS6558/9-3","VAS6558/9-4","VAS6558/9-5","VAS6558/9-6","VAS6558A","VAS6558A/33A","VAS6558A/35","VAS6558A/36A","VAS6558A/37A","VAS6586","VAS6586/3","VAS6586/4","VAS6594","VAS6606/1","VAS6606/10","VAS6606/11","VAS6606/2","VAS6606/3","VAS6606/7-1","VAS6606/7-2","VAS6606/9","VAS6613","VAS6616","VAS6620A","VAS6633","VAS6649","VAS6650A","VAS6684","VAS671005","VAS671007","VAS6722A","VAS6750","VAS6762/10","VAS6762/29","VAS6762/41","VAS6762/44","VAS6762/45","VAS6774","VAS6775","VAS6779A","VAS6786","VAS6860US","VAS6871","VAS6881","VAS6882","VAS6884US","VAS6886","VAS6909","VAS691003A","VAS691005","VAS691005/11","VAS691009US","VAS6931","VAS6966","VAS701001","VAS721001","VAS741003","VAS741005","VAS741011","VAS861001-1","VAS895015","VAS895025","VTS-500","VW207","VW207C","VW210","VW222A","VW244B","VW295","VW295A","VW309A","VW353","VW382/10","VW382/7","VW385/17","VW385/19","VW385/22","VW387","VW388","VW391","VW401","VW402","VW407","VW408A","VW409","VW411","VW412","VW415A","VW416B","VW418A","VW420","VW421","VW422","VW423","VW426","VW431","VW432","VW433","VW434","VW442","VW447H","VW447I","VW454","VW457","VW459","VW472","VW516","VW519","VW521/4","VW522","VW541/1A","VW558","VW5BNKCAB","VW637/2","VW771","VW792","VWMICROPOD","WIL577102","WIL577172","WIL745","WSPEQU132","WV622N-VWKIT"];
  var BTOOL_SEP = "[\\s.\\u2010-\\u2015\\-/+]*";   // like TOOL_SEP, also allows "+"
  var _builtinDict = null;
  function builtinToolDict() {
    if (_builtinDict !== null) return _builtinDict.built ? _builtinDict : null;
    var anyPats = [], numPats = [], map = {};
    BUILTIN_TOOLS.forEach(function (orig) {
      var norm = normTool(orig);
      if (norm.length < 3) return;
      if (!map[norm]) map[norm] = orig;                          // canonical display, first wins
      // split at every letter↔digit boundary too, so a list entry written solid
      // ("VW771", "VAS6909", "T10001") still matches ELSA's spaced "VW 771" etc.
      var parts = String(orig).toUpperCase().match(/[A-Z]+|[0-9]+/g);
      if (!parts || !parts.length) return;
      var src = parts.map(reEsc).join(BTOOL_SEP);
      (/^[0-9]+$/.test(orig) ? numPats : anyPats).push({ len: norm.length, src: src });
    });
    anyPats.sort(function (a, b) { return b.len - a.len; });      // longest first
    numPats.sort(function (a, b) { return b.len - a.len; });
    var d = { built: true, map: map, reAny: null, reNum: null };
    try { if (anyPats.length) d.reAny = new RegExp("\\b(?:" + anyPats.map(function (p) { return p.src; }).join("|") + ")\\b", "gi"); } catch (e) {}
    // bare integers: leading dash (VW callout "-1833-") + a non-alphanumeric
    // trailing boundary. Capture group 1 is the tool number.
    try { if (numPats.length) d.reNum = new RegExp("[-\\u2010-\\u2015]\\s*(" + numPats.map(function (p) { return p.src; }).join("|") + ")(?![0-9A-Za-z])", "gi"); } catch (e) {}
    _builtinDict = d;
    return d;
  }
  // canonical display for a matched built-in tool number
  function builtinCanon(numStr) {
    var d = builtinToolDict();
    return (d && d.map[normTool(numStr)]) || String(numStr).replace(/\s+/g, " ").trim();
  }

  // detect a "this isn't a normal tool description" note baked into the
  // description column — the owner's sheets write these inline.
  function toolStatus(desc) {
    var d = String(desc || "");
    if (/missing/i.test(d)) return "MISSING TOOL";
    if (/\bbroken\b/i.test(d)) return "BROKEN";
    if (/\bdamaged\b/i.test(d)) return "DAMAGED";
    if (/check\s+part\s*(?:number|no\.?|#)?/i.test(d)) return "CHECK PART NUMBER";
    if (/\bdo\s+not\s+use\b/i.test(d)) return "DO NOT USE";
    if (/\b(?:on\s+order|ordered|out\s+of\s+service)\b/i.test(d)) return "ON ORDER";
    if (/\blost\b/i.test(d)) return "LOST";
    return "";
  }

  // tiny RFC-4180 CSV reader: handles quoted fields with embedded commas, doubled
  // quotes ("") and newlines. Returns an array of row arrays.
  function parseCSV(text) {
    var rows = [], row = [], cur = "", inQ = false, i, c;
    text = String(text == null ? "" : text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    for (i = 0; i < text.length; i++) {
      c = text.charAt(i);
      if (inQ) {
        if (c === '"') { if (text.charAt(i + 1) === '"') { cur += '"'; i++; } else inQ = false; }
        else cur += c;
      } else if (c === '"') { inQ = true; }
      else if (c === ",") { row.push(cur); cur = ""; }
      else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
      else cur += c;
    }
    if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
    return rows;
  }

  // ---- native .xlsx reading (LOCAL, NO network) --------------------------
  // A modern Excel file is a ZIP of XML. We read it in-browser with ZERO
  // dependencies: parse the ZIP directory, inflate each entry with the
  // browser's built-in DecompressionStream (no library, no network), then pull
  // the FIRST worksheet's cells into the SAME 2D string array parseCSV()
  // returns — so the column-mapper downstream is completely unchanged. Keeps
  // the ELSA zero-network promise intact (it's pure local processing).
  function u16(b, o) { return b[o] | (b[o + 1] << 8); }
  function u32(b, o) { return b[o] + b[o + 1] * 256 + b[o + 2] * 65536 + b[o + 3] * 16777216; }
  function utf8(bytes) {
    try { return new TextDecoder("utf-8").decode(bytes); }
    catch (e) { var s = "", i; for (i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return s; }
  }
  // native raw-DEFLATE inflate → Promise<Uint8Array> (Chrome/Edge/Safari)
  function inflateRaw(bytes) {
    var ds = new DecompressionStream("deflate-raw");
    var stream = new Blob([bytes]).stream().pipeThrough(ds);
    return new Response(stream).arrayBuffer().then(function (ab) { return new Uint8Array(ab); });
  }
  // parse a ZIP into { name: Uint8Array } for the entries want(name) selects.
  // Reads the CENTRAL DIRECTORY (reliable even when Excel streams entries with
  // data descriptors, which zero out the local-header sizes). Returns a Promise.
  function unzipEntries(buf, want) {
    var b = new Uint8Array(buf), i, eocd = -1, floor = Math.max(0, b.length - 22 - 65536);
    for (i = b.length - 22; i >= floor; i--) {
      if (b[i] === 0x50 && b[i + 1] === 0x4b && b[i + 2] === 0x05 && b[i + 3] === 0x06) { eocd = i; break; }
    }
    if (eocd < 0) return Promise.reject(new Error("not a zip"));
    var n = u16(b, eocd + 10), p = u32(b, eocd + 16), jobs = [], out = {};
    for (i = 0; i < n && p + 46 <= b.length; i++) {
      if (!(b[p] === 0x50 && b[p + 1] === 0x4b && b[p + 2] === 0x01 && b[p + 3] === 0x02)) break;
      var method = u16(b, p + 10), compSize = u32(b, p + 20);
      var nameLen = u16(b, p + 28), extraLen = u16(b, p + 30), commentLen = u16(b, p + 32);
      var lho = u32(b, p + 42), name = utf8(b.subarray(p + 46, p + 46 + nameLen));
      p += 46 + nameLen + extraLen + commentLen;
      if (want && !want(name)) continue;
      var dataStart = lho + 30 + u16(b, lho + 26) + u16(b, lho + 28);
      var comp = b.subarray(dataStart, dataStart + compSize);
      if (method === 0) out[name] = comp;
      else if (method === 8) jobs.push((function (nm, data) { return inflateRaw(data).then(function (u) { out[nm] = u; }); })(name, comp));
    }
    return Promise.all(jobs).then(function () { return out; });
  }
  function xmlDoc(text) { return new DOMParser().parseFromString(text, "application/xml"); }
  // concatenated <t> text under a shared-string <si> / inline <is> (handles rich runs)
  function joinTs(el) {
    var ts = el.getElementsByTagName("t"), out = "", i;
    for (i = 0; i < ts.length; i++) out += ts[i].textContent || "";
    return out;
  }
  // "A1" / "AB12" → 0-based column index
  function colToIdx(ref) {
    var m = /^([A-Za-z]+)/.exec(String(ref || ""));
    if (!m) return -1;
    var s = m[1].toUpperCase(), n = 0, i;
    for (i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64);
    return n - 1;
  }
  // resolve the first tab's worksheet path via workbook.xml + rels; fall back
  // to the lowest-numbered worksheet file
  function firstSheetPath(files) {
    try {
      var wb = xmlDoc(utf8(files["xl/workbook.xml"])), sh = wb.getElementsByTagName("sheet")[0];
      var RELNS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
      var rid = sh && (sh.getAttributeNS(RELNS, "id") || sh.getAttribute("r:id"));
      if (rid && files["xl/_rels/workbook.xml.rels"]) {
        var rels = xmlDoc(utf8(files["xl/_rels/workbook.xml.rels"])), rs = rels.getElementsByTagName("Relationship"), i;
        for (i = 0; i < rs.length; i++) {
          if (rs[i].getAttribute("Id") === rid) {
            var tgt = rs[i].getAttribute("Target") || "";
            return /^\//.test(tgt) ? tgt.replace(/^\//, "") : "xl/" + tgt.replace(/^\.\//, "");
          }
        }
      }
    } catch (e) {}
    var names = Object.keys(files).filter(function (nm) { return /^xl\/worksheets\/sheet\d+\.xml$/.test(nm); });
    names.sort(function (a, c) { return (parseInt((/(\d+)/.exec(a) || [])[1], 10) || 0) - (parseInt((/(\d+)/.exec(c) || [])[1], 10) || 0); });
    return names[0];
  }
  // read the first worksheet into a dense 2D array of strings → Promise
  function xlsxToRows(buf) {
    return unzipEntries(buf, function (nm) {
      return nm === "xl/sharedStrings.xml" || nm === "xl/workbook.xml" ||
             nm === "xl/_rels/workbook.xml.rels" || /^xl\/worksheets\/sheet\d+\.xml$/.test(nm);
    }).then(function (files) {
      var shared = [];
      if (files["xl/sharedStrings.xml"]) {
        var sis = xmlDoc(utf8(files["xl/sharedStrings.xml"])).getElementsByTagName("si"), i;
        for (i = 0; i < sis.length; i++) shared.push(joinTs(sis[i]));
      }
      var wsName = firstSheetPath(files), wsBytes = wsName && files[wsName];
      if (!wsBytes) throw new Error("no worksheet");
      var rowEls = xmlDoc(utf8(wsBytes)).getElementsByTagName("row"), rows = [], ri;
      for (ri = 0; ri < rowEls.length; ri++) {
        var cells = rowEls[ri].getElementsByTagName("c"), tmp = [], maxc = -1, ci, row = [];
        for (ci = 0; ci < cells.length; ci++) {
          var c = cells[ci], idx = colToIdx(c.getAttribute("r"));
          if (idx < 0) idx = ci;
          var t = c.getAttribute("t"), val = "", vEl;
          if (t === "s") { vEl = c.getElementsByTagName("v")[0]; var si2 = vEl ? parseInt(vEl.textContent, 10) : -1; val = (si2 >= 0 && si2 < shared.length) ? shared[si2] : ""; }
          else if (t === "inlineStr") { var isEl = c.getElementsByTagName("is")[0]; val = isEl ? joinTs(isEl) : ""; }
          else { vEl = c.getElementsByTagName("v")[0]; val = vEl ? (vEl.textContent || "") : ""; }
          tmp[idx] = val;
          if (idx > maxc) maxc = idx;
        }
        for (ci = 0; ci <= maxc; ci++) row.push(tmp[ci] == null ? "" : tmp[ci]);
        rows.push(row);
      }
      return rows;
    });
  }

  // find the header row: one cell names a tool column AND one names a location
  function findToolHeader(rows) {
    for (var i = 0; i < Math.min(rows.length, 15); i++) {
      var cells = rows[i] || [];
      var hasTool = cells.some(function (c) { return /tool\s*#|tool\s*(?:number|no\b)|^\s*tool\s*$/i.test(String(c || "")); });
      var hasLoc = cells.some(function (c) { return /drawer|location|\bbin\b/i.test(String(c || "")); });
      if (hasTool && hasLoc) return i;
    }
    return -1;
  }

  // guess a column's role from its header text (the mapper lets the tech override)
  function guessToolRole(headerText) {
    var h = String(headerText || "");
    if (/desc/i.test(h)) return "desc";
    if (/drawer|location|\bbin\b/i.test(h)) return "drawer";
    if (/tool\s*#|tool\s*(?:number|no\b)|^\s*tool\s*$/i.test(h)) return "num";
    if (/order/i.test(h)) return "ignore";
    return "";
  }

  // build the stored list from parsed rows + the chosen column roles
  function buildToolMap(rows, dataStart, cols) {
    var map = {}, count = 0, i, num, key, drawer, desc, st, row;
    for (i = dataStart; i < rows.length; i++) {
      row = rows[i] || [];
      num = String(row[cols.num] == null ? "" : row[cols.num]).trim();
      if (!num || !/\d/.test(num)) continue;                       // skip blanks / non-tool junk
      if (/^table\b/i.test(num) || /^print\s+date/i.test(num)) continue;
      key = normTool(num);
      if (!key) continue;
      drawer = cols.drawer >= 0 ? String(row[cols.drawer] == null ? "" : row[cols.drawer]).trim() : "";
      desc = cols.desc >= 0 ? String(row[cols.desc] == null ? "" : row[cols.desc]).replace(/\s+/g, " ").trim() : "";
      st = toolStatus(desc);
      // keep the shop's description too (v0.3.16) so the "Find these tools" window
      // and the printout can show what each tool is, not just its number.
      if (!map[key]) { map[key] = { n: num, d: drawer, s: st, desc: desc }; count++; }
      else { if (!map[key].d && drawer) map[key].d = drawer; if (!map[key].s && st) map[key].s = st; if (!map[key].desc && desc) map[key].desc = desc; }
    }
    return { updated: todayISO(), count: count, map: map };
  }

  // sort locations: numeric drawers ascending, then text (LARGE, Right O/H, …)
  function locSort(a, b) {
    var na = parseInt(a, 10), nb = parseInt(b, 10);
    var ia = /^\d/.test(a) && !isNaN(na), ib = /^\d/.test(b) && !isNaN(nb);
    if (ia && ib) return na - nb;
    if (ia) return -1;
    if (ib) return 1;
    return String(a).localeCompare(String(b));
  }

  /* ------------------------------------------------------------------ *
   * FLUID CAPACITY TABLES (v0.3.13) — read the yearly VW PDFs LOCALLY.
   *   The tech loads the "VW Fluid Capacity Tables" PDFs (one per model
   *   year) through the ⚙ Settings gear. Each PDF is read ONE TIME, right
   *   here in the browser (FileReader + the built-in DecompressionStream —
   *   NO library, NO network), converted to a small data table, and saved
   *   in localStorage on this machine. The PDF itself is not kept. The
   *   Fluids & Capacities button then shows the values matched to the
   *   loaded vehicle in a printable pop-up window (built locally, like
   *   "Find these tools"). Nothing fluid-related is hosted online.
   *   Like the shop tool list, this is shop config — NOT cleared by
   *   Exit / New Vehicle / Clear info, only by Settings "Remove".
   * ------------------------------------------------------------------ */
  var FLUIDS_KEY = "vwjb_fluids_v1";  // legacy localStorage (pre-v0.3.15) — kept for migration + IDB-unavailable fallback
  // ---- Fluid storage v2: IndexedDB is primary ----------------------------
  //   Three data stores keyed by year (pdfs = original PDF Blob, parsed =
  //   parsed models, meta = lightweight index) + a kv store for db-level
  //   scalars. A SYNCHRONOUS in-memory projection (fluidsData, the same shape
  //   the render path always used) is hydrated from `parsed` at boot, so
  //   fluidsBar / openFluidsWindow / debugDump stay synchronous & unchanged.
  //   Keeping the original PDF lets us silently RE-PARSE with an improved
  //   parser (version bump below) without the tech re-uploading anything.
  // Shared app database `hahns_db` (v0.3.16 — it holds more than fluids: the
  // `tools` store too). Five stores: pdfs / parsed / meta / kv (fluids) + tools
  // (shop tool list), created fresh at v1. (The short-lived v0.3.15 `hahns_fluids`
  // DB is intentionally NOT migrated — it shipped one day earlier and had almost
  // no real-world uptake; on update the tech re-loads their fluid PDFs once.)
  var APP_DB = "hahns_db", APP_DB_VER = 1;
  var MODERN_PARSER_VER = "1.3.4";   // 2011–2026, engine-code parser (1.3.4: capture range capacities, e.g. ID.Buzz 0MJ 0.88-0.93 L)
  var LEGACY_PARSER_VER = "1.0.0";   // 2000–2010, displacement parser (not built yet)
  var FLUID_YEAR_MIN = 2000, FLUID_YEAR_MAX = 2026;  // span for "Years installed: N/M"
  var fluidsData = null;      // sync projection: null=unread, false=none, obj={updated,count,years:{Y:{models,file}}}
  var appDB = null;        // open IDBDatabase (null until boot resolves / on failure)
  var appIdbOk = true;     // false → IDB unavailable, using localStorage fallback
  var fluidsReady = false;    // projection hydrated (render shows "loading" until true)
  var fluidsBooted = false;   // boot runs once
  var fluidsMetaList = [];    // sync mirror of the `meta` store (info page + reconcile)
  var fluidsBgUpdate = 0;     // ms timestamp of the last successful background re-parse
  var fluidsRerender = null;  // repaint the panel after async hydrate / re-parse
  var reconcileActive = false;

  function familyForYear(y) { return (+y <= 2010) ? "legacy" : "modern"; }
  function currentParserVer(fam) { return fam === "legacy" ? LEGACY_PARSER_VER : MODERN_PARSER_VER; }

  // tiny promise-wrapped IndexedDB helpers (only the ops we need) --------
  function idbOpen() {
    return new Promise(function (res, rej) {
      if (typeof indexedDB === "undefined") { rej(new Error("no IndexedDB")); return; }
      var rq;
      try { rq = indexedDB.open(APP_DB, APP_DB_VER); } catch (e) { rej(e); return; }
      rq.onupgradeneeded = function () {
        var db = rq.result;
        if (!db.objectStoreNames.contains("pdfs")) db.createObjectStore("pdfs", { keyPath: "year" });
        if (!db.objectStoreNames.contains("parsed")) db.createObjectStore("parsed", { keyPath: "year" });
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "year" });
        if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv", { keyPath: "k" });
        if (!db.objectStoreNames.contains("tools")) db.createObjectStore("tools", { keyPath: "k" });
      };
      rq.onsuccess = function () {
        var db = rq.result;
        try { db.onversionchange = function () { try { db.close(); } catch (e) {} appDB = null; }; } catch (e) {}
        res(db);
      };
      rq.onerror = function () { rej(rq.error || new Error("open failed")); };
      rq.onblocked = function () { rej(new Error("blocked")); };
    });
  }
  function idbReq(req) { return new Promise(function (res, rej) { req.onsuccess = function () { res(req.result); }; req.onerror = function () { rej(req.error); }; }); }
  function idbGet(store, key) { try { return idbReq(appDB.transaction(store, "readonly").objectStore(store).get(key)); } catch (e) { return Promise.reject(e); } }
  function idbGetAll(store) { try { return idbReq(appDB.transaction(store, "readonly").objectStore(store).getAll()); } catch (e) { return Promise.reject(e); } }
  function idbTxDone(tx) { return new Promise(function (res, rej) { tx.oncomplete = function () { res(); }; tx.onerror = function () { rej(tx.error); }; tx.onabort = function () { rej(tx.error || new Error("aborted")); }; }); }
  function idbPut(store, val) { try { var tx = appDB.transaction(store, "readwrite"); tx.objectStore(store).put(val); return idbTxDone(tx); } catch (e) { return Promise.reject(e); } }
  // write several records across stores in ONE atomic transaction
  function idbPutMany(stores, recs) {
    try {
      var tx = appDB.transaction(stores, "readwrite");
      recs.forEach(function (rc) { tx.objectStore(rc.store).put(rc.val); });
      return idbTxDone(tx);
    } catch (e) { return Promise.reject(e); }
  }

  // build the sync projection from `parsed` records (skips blobs entirely)
  function buildProjection(parsedRecs) {
    var years = {}, latest = "";
    (parsedRecs || []).forEach(function (p) {
      years[p.year] = { models: p.models || [], file: p.fileName || "" };
      if (p.parsedDate && p.parsedDate > latest) latest = p.parsedDate;
    });
    fluidsData = Object.keys(years).length ? { years: years, count: Object.keys(years).length, updated: latest } : false;
  }
  function updateYearInProjection(year, models, file) {
    if (!fluidsData) fluidsData = { years: {}, count: 0, updated: todayISO() };
    fluidsData.years[year] = { models: models || [], file: file || "" };
    fluidsData.count = Object.keys(fluidsData.years).length;
    fluidsData.updated = todayISO();
  }
  function refreshMetaList() { return idbGetAll("meta").then(function (l) { fluidsMetaList = l || []; }).catch(function () {}); }
  function setLastBgUpdate() { fluidsBgUpdate = Date.now(); return idbPut("kv", { k: "lastBgUpdate", v: fluidsBgUpdate }).catch(function () {}); }

  // startup: open IDB → migrate old localStorage once → hydrate projection →
  // (background) reconcile parser versions & auto re-parse. Falls back to the
  // legacy localStorage read if IDB can't be opened, so fluids still work.
  function fluidsBoot(onReady) {
    if (fluidsBooted) { if (onReady) onReady(); return; }
    fluidsBooted = true;
    idbOpen().then(function (db) {
      appDB = db; appIdbOk = true;
      // tidy up the short-lived v0.3.15 `hahns_fluids` DB if it's still around —
      // we don't migrate it (see APP_DB note), we just drop it so only `hahns_db`
      // remains. Fire-and-forget; deleting a non-existent DB is a harmless no-op.
      try { indexedDB.deleteDatabase("hahns_fluids"); } catch (e) {}
      return migrateLegacyFluids();
    }).then(function () {
      return migrateLegacyTools();   // v0.3.16: one-time localStorage → IDB for the tool list
    }).then(function () {
      return Promise.all([idbGetAll("parsed"), idbGetAll("meta"), idbGet("kv", "lastBgUpdate"), hydrateShopTools()]);
    }).then(function (out) {
      buildProjection(out[0]);
      fluidsMetaList = out[1] || [];
      fluidsBgUpdate = (out[2] && out[2].v) || 0;
      fluidsReady = true;
      if (onReady) onReady();
      reconcileFluids();   // background, non-blocking
    }).catch(function () {
      // IDB unavailable → legacy sync read so the feature still works
      appIdbOk = false; appDB = null;
      try { var raw = localStorage.getItem(FLUIDS_KEY); fluidsData = raw ? JSON.parse(raw) : false; } catch (e) { fluidsData = false; }
      fluidsReady = true;
      if (onReady) onReady();
    });
  }

  // one-time: convert pre-v0.3.15 localStorage fluid data into IDB. Those PDFs
  // were discarded (no Blob), so records are marked hasBlob:false / parserVersion
  // "0" → usable now, but can't auto re-parse until the tech re-uploads the PDF.
  function migrateLegacyFluids() {
    return idbGet("kv", "migratedV1").then(function (flag) {
      if (flag && flag.v) return;
      var old = null;
      try { old = JSON.parse(localStorage.getItem(FLUIDS_KEY) || "null"); } catch (e) {}
      var recs = [];
      if (old && old.years) Object.keys(old.years).forEach(function (yy) {
        var yd = old.years[yy] || {}, fam = familyForYear(yy), when = old.updated || todayISO();
        recs.push({ store: "parsed", val: { year: yy, family: fam, parserVersion: "0", models: yd.models || [], fileName: yd.file || "", parsedDate: when } });
        recs.push({ store: "meta", val: { year: yy, family: fam, parserVersion: "0", hash: "", fileName: yd.file || "", size: 0, hasBlob: false, status: "stale-no-source", importDate: when, lastParsedDate: when, appBuild: BUILD } });
      });
      var chain = recs.length ? idbPutMany(["parsed", "meta"], recs) : Promise.resolve();
      return chain.then(function () { return idbPut("kv", { k: "migratedV1", v: 1, at: todayISO() }); });
    });
  }

  // compare each year's stored parser version to the current one; if different
  // AND we have the source PDF, re-parse it in the background (throttled, one at
  // a time). Non-destructive: a failed re-parse keeps the last good data.
  function reconcileFluids() {
    if (!appIdbOk || !appDB) return;
    var todo = [];
    fluidsMetaList.forEach(function (m) {
      if (m && m.parserVersion !== currentParserVer(m.family) && m.hasBlob) todo.push(m.year);
    });
    if (!todo.length) return;
    reconcileActive = true;
    var idle = window.requestIdleCallback || function (f) { return setTimeout(f, 120); };
    (function next(i) {
      if (i >= todo.length) { reconcileActive = false; if (fluidsRerender) fluidsRerender(); return; }
      reparseYear(todo[i]).then(function () {}, function () {}).then(function () {
        if (fluidsRerender) fluidsRerender();
        idle(function () { next(i + 1); });
      });
    })(0);
  }

  function reparseYear(year) {
    return idbGet("pdfs", year).then(function (pdf) {
      if (!pdf || !pdf.blob) throw new Error("no source PDF");
      return pdf.blob.arrayBuffer().then(function (buf) {
        return fluidsFromPdf(buf, pdf.fileName || (year + ".pdf")).then(function (out) {
          var fam = familyForYear(year), ver = currentParserVer(fam), now = todayISO();
          return idbPutMany(["parsed", "meta"], [
            { store: "parsed", val: { year: year, family: fam, parserVersion: ver, models: out.models, fileName: pdf.fileName || "", parsedDate: now } },
            { store: "meta", val: { year: year, family: fam, parserVersion: ver, hash: pdf.hash || "", fileName: pdf.fileName || "", size: pdf.size || 0, hasBlob: true, status: "ok", importDate: pdf.importDate || now, lastParsedDate: now, appBuild: BUILD } }
          ]).then(function () {
            updateYearInProjection(year, out.models, pdf.fileName || "");
            return refreshMetaList();
          }).then(function () { return setLastBgUpdate(); });
        });
      });
    }).catch(function (e) {
      // keep the old parsed data; just record the error on meta
      return idbGet("meta", year).then(function (m) {
        m = m || { year: year, family: familyForYear(year) };
        m.status = "reparse-error"; m.lastError = (e && e.message) || "parse failed";
        return idbPut("meta", m);
      }).then(function () { return refreshMetaList(); }).catch(function () {});
    });
  }

  // save a batch of newly-uploaded years (Blob + parsed + meta, atomic per year).
  // Falls back to the legacy localStorage shape if IDB is unavailable.
  function fluidsSaveYears(list) {
    if (!appIdbOk || !appDB) {
      var st = null;
      try { st = JSON.parse(localStorage.getItem(FLUIDS_KEY) || "null"); } catch (e) {}
      st = st || { years: {} }; if (!st.years) st.years = {};
      list.forEach(function (o) { st.years[o.year] = { models: o.models, file: o.name }; });
      st.updated = todayISO(); st.count = Object.keys(st.years).length;
      try { localStorage.setItem(FLUIDS_KEY, JSON.stringify(st)); } catch (e) { return Promise.reject(e); }
      fluidsData = st;
      return Promise.resolve();
    }
    var chain = Promise.resolve(), now = todayISO();
    list.forEach(function (o) {
      chain = chain.then(function () {
        var fam = familyForYear(o.year), ver = currentParserVer(fam);
        var blob = new Blob([o.buf], { type: "application/pdf" });
        return idbPutMany(["pdfs", "parsed", "meta"], [
          { store: "pdfs", val: { year: o.year, family: fam, blob: blob, hash: o.hash || "", size: o.size || blob.size, fileName: o.name, importDate: now } },
          { store: "parsed", val: { year: o.year, family: fam, parserVersion: ver, models: o.models, fileName: o.name, parsedDate: now } },
          { store: "meta", val: { year: o.year, family: fam, parserVersion: ver, hash: o.hash || "", fileName: o.name, size: o.size || blob.size, hasBlob: true, status: "ok", importDate: now, lastParsedDate: now, appBuild: BUILD } }
        ]).then(function () { updateYearInProjection(o.year, o.models, o.name); });
      });
    });
    return chain.then(function () { return refreshMetaList(); });
  }

  function loadFluids() { return fluidsData || null; }
  function removeFluids() {
    fluidsData = false; fluidsMetaList = []; fluidsBgUpdate = 0;
    try { localStorage.removeItem(FLUIDS_KEY); } catch (e) {}
    if (appIdbOk && appDB) {
      try {
        var tx = appDB.transaction(["pdfs", "parsed", "meta"], "readwrite");
        tx.objectStore("pdfs").clear(); tx.objectStore("parsed").clear(); tx.objectStore("meta").clear();
      } catch (e) {}
    }
  }
  // SHA-256 hex of the PDF bytes (integrity / future dedupe). Optional — resolves
  // to "" if the browser lacks crypto.subtle (secure context; ELSA + Pages https).
  function sha256Hex(buf) {
    try {
      if (typeof window === "undefined" || !window.crypto || !window.crypto.subtle) return Promise.resolve("");
      return window.crypto.subtle.digest("SHA-256", buf).then(function (h) {
        var b = new Uint8Array(h), s = "", i;
        for (i = 0; i < b.length; i++) s += (b[i] < 16 ? "0" : "") + b[i].toString(16);
        return s;
      }, function () { return ""; });
    } catch (e) { return Promise.resolve(""); }
  }
  // ---- info-page formatters (Settings › Fluid database) ----
  function fmtBytesMB(bytes) {
    var mb = (bytes || 0) / 1048576;
    if (bytes && mb < 0.1) return "<0.1 MB";
    return (mb >= 10 ? Math.round(mb) : (Math.round(mb * 10) / 10)) + " MB";
  }
  function fmtWhen(ts) {
    if (!ts) return "—";
    var d = new Date(ts), now = new Date(), t = "";
    try { t = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); } catch (e) {}
    if (d.toDateString() === now.toDateString()) return "Today " + t;
    var y = new Date(now); y.setDate(now.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return "Yesterday " + t;
    var ds = ""; try { ds = d.toLocaleDateString(); } catch (e) {}
    return (ds + " " + t).replace(/\s+$/, "");
  }
  function fluidsHealth() {
    if (!fluidsReady) return { cls: "dbwait", txt: "Loading…" };
    var err = 0, pending = 0, stale = 0;
    var installed = fluidsData && fluidsData.years ? Object.keys(fluidsData.years).length : 0;
    fluidsMetaList.forEach(function (m) {
      if (!m) return;
      if (m.status === "reparse-error") err++;
      else if (m.parserVersion !== currentParserVer(m.family)) { if (m.hasBlob) pending++; else stale++; }
    });
    if (err) return { cls: "dbwarn", txt: "⚠ " + err + " year" + (err > 1 ? "s" : "") + " need attention" };
    if (reconcileActive || pending) return { cls: "dbwait", txt: "⟳ Updating…" };
    if (stale) return { cls: "dbwarn", txt: "⚠ Re-upload " + stale + " to enable auto-update" };
    if (!installed) return { cls: "dbnone", txt: "No tables yet" };
    return { cls: "dbok", txt: "✓ Healthy" };
  }
  function fluidsInfoHTML() {
    var installed = fluidsData && fluidsData.years ? Object.keys(fluidsData.years).length : 0;
    var total = FLUID_YEAR_MAX - FLUID_YEAR_MIN + 1;
    var bytes = 0; fluidsMetaList.forEach(function (m) { if (m && m.hasBlob) bytes += (m.size || 0); });
    var h = fluidsHealth();
    function row(k, v, cls) { return '<div class="dbrow"><span class="k">' + k + '</span><span class="v' + (cls ? " " + cls : "") + '">' + v + "</span></div>"; }
    return '<div class="dbinfo">' +
      row("Storage", appIdbOk ? "IndexedDB" : "Local storage (fallback)") +
      row("Modern parser", esc(MODERN_PARSER_VER)) +
      row("Legacy parser", esc(LEGACY_PARSER_VER)) +
      row("Years installed", installed + " / " + total) +
      row("PDF storage", fmtBytesMB(bytes)) +
      row("Last background update", esc(fmtWhen(fluidsBgUpdate))) +
      row("Status", h.txt, h.cls) +
      "</div>";
  }

  /* ---- 1. mini PDF text extractor -----------------------------------
   * Purpose-built for the VW Fluid Capacity Tables family (Antenna House,
   * PDF 1.4): classic xref, FlateDecode streams, Type0 fonts with a
   * ToUnicode CMap, text positioned with cm/Tm/Td and shown with hex
   * Tj/TJ. Produces layout-preserving text lines (columns aligned by
   * character position) like `pdftotext -layout`, which the table parser
   * below relies on. NOT a general PDF reader — anything else fails
   * gracefully with "no fluid tables found".
   * ------------------------------------------------------------------ */

  // bytes → 1:1 byte string (indexes match the byte offsets; NOT TextDecoder
  // "latin1", which is windows-1252 and remaps 0x80–0x9F)
  function bstr(bytes) {
    var out = "", i, CH = 32768;
    for (i = 0; i < bytes.length; i += CH) {
      out += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + CH, bytes.length)));
    }
    return out;
  }
  // zlib-wrapped DEFLATE (PDF FlateDecode) → Promise<Uint8Array>
  function inflateZlib(bytes) {
    var ds = new DecompressionStream("deflate");
    var stream = new Blob([bytes]).stream().pipeThrough(ds);
    return new Response(stream).arrayBuffer().then(function (ab) { return new Uint8Array(ab); });
  }

  // scan "N 0 obj … endobj" objects; slice stream bytes by /Length (direct or
  // resolved from a bare-number object). Sequential walk so a byte pattern
  // INSIDE a stream can't spawn a phantom object.
  function pdfObjects(bytes) {
    var s = bstr(bytes), objs = {}, heads = [], re = /(\d+)\s+\d+\s+obj\b/g, m;
    while ((m = re.exec(s))) heads.push({ num: +m[1], at: m.index, end: re.lastIndex });
    var cursor = 0, list = [], i;
    for (i = 0; i < heads.length; i++) {
      if (heads[i].at < cursor) continue;
      var h = heads[i], endobjAt = s.indexOf("endobj", h.end);
      var streamAt = s.indexOf("stream", h.end);
      var o = { num: h.num, dict: "", data: null, lenRef: -1, dataStart: -1, dataEnd: -1 };
      if (streamAt >= 0 && (endobjAt < 0 || streamAt < endobjAt)) {
        o.dict = s.slice(h.end, streamAt);
        var ds2 = streamAt + 6;
        if (s.charAt(ds2) === "\r") ds2++;
        if (s.charAt(ds2) === "\n") ds2++;
        o.dataStart = ds2;
        var lm = /\/Length\s+(\d+)(\s+0\s+R)?/.exec(o.dict);
        if (lm && !lm[2]) o.dataEnd = ds2 + (+lm[1]);
        else if (lm) o.lenRef = +lm[1];
        var esAt = s.indexOf("endstream", o.dataEnd > 0 ? o.dataEnd : ds2);
        if (o.dataEnd < 0) o.dataEnd = esAt;
        endobjAt = s.indexOf("endobj", esAt >= 0 ? esAt : ds2);
      } else {
        o.dict = endobjAt >= 0 ? s.slice(h.end, endobjAt) : s.slice(h.end);
      }
      objs[h.num] = o;
      list.push(o);
      cursor = endobjAt >= 0 ? endobjAt + 6 : h.end;
    }
    list.forEach(function (o) {
      if (o.dataStart < 0) return;
      if (o.lenRef >= 0 && objs[o.lenRef]) {
        var n = parseInt(String(objs[o.lenRef].dict).replace(/[^\d]/g, " "), 10);
        if (!isNaN(n)) o.dataEnd = o.dataStart + n;
      }
      if (o.dataEnd > o.dataStart) o.data = bytes.subarray(o.dataStart, o.dataEnd);
    });
    return objs;
  }

  function pdfRef(dict, key) {
    var m = new RegExp("\\/" + key + "\\s+(\\d+)\\s+0\\s+R").exec(dict || "");
    return m ? +m[1] : -1;
  }

  // page objects in document order (walk /Pages → /Kids from the root)
  function pdfPageOrder(objs) {
    var root = -1, n, pages = [];
    for (n in objs) {
      var d = objs[n].dict || "";
      if (/\/Type\s*\/Pages\b/.test(d) && !/\/Parent\b/.test(d)) { root = +n; break; }
    }
    function walk(num, depth) {
      if (depth > 16 || !objs[num]) return;
      var d = objs[num].dict || "";
      if (/\/Type\s*\/Page\b/.test(d) && !/\/Type\s*\/Pages\b/.test(d)) { pages.push(num); return; }
      var km = /\/Kids\s*\[([^\]]*)\]/.exec(d);
      if (!km) return;
      var re = /(\d+)\s+0\s+R/g, m;
      while ((m = re.exec(km[1]))) walk(+m[1], depth + 1);
    }
    if (root >= 0) walk(root, 0);
    if (!pages.length) {
      for (n in objs) {
        var d2 = objs[n].dict || "";
        if (/\/Type\s*\/Page\b/.test(d2) && !/\/Type\s*\/Pages\b/.test(d2)) pages.push(+n);
      }
      pages.sort(function (a, b) { return a - b; });
    }
    return pages;
  }

  // "0048" hex (UTF-16BE code units) → string
  function hexUtf16(hex) {
    var out = "", i;
    if (hex.length % 4 === 0) { for (i = 0; i < hex.length; i += 4) out += String.fromCharCode(parseInt(hex.substr(i, 4), 16)); }
    else if (hex.length) out = String.fromCharCode(parseInt(hex, 16));
    return out;
  }
  // ToUnicode CMap: glyph code → text (bfchar pairs + bfrange runs)
  function parseCMap(text) {
    var map = {}, m, p;
    var bf = /beginbfchar([\s\S]*?)endbfchar/g;
    while ((m = bf.exec(text))) {
      var pre = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]*)>/g;
      while ((p = pre.exec(m[1]))) map[parseInt(p[1], 16)] = hexUtf16(p[2]);
    }
    var rg = /beginbfrange([\s\S]*?)endbfrange/g;
    while ((m = rg.exec(text))) {
      var tri = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(?:<([0-9A-Fa-f]+)>|\[([^\]]*)\])/g, t, i;
      while ((t = tri.exec(m[1]))) {
        var lo = parseInt(t[1], 16), hi = parseInt(t[2], 16);
        if (hi - lo > 65535) continue;
        if (t[3] != null) {
          var start = parseInt(t[3], 16), digits = t[3].length;
          for (i = lo; i <= hi; i++) {
            var hx = (start + (i - lo)).toString(16);
            while (hx.length < digits) hx = "0" + hx;
            map[i] = hexUtf16(hx);
          }
        } else if (t[4]) {
          var arr = t[4].match(/<([0-9A-Fa-f]*)>/g) || [];
          for (i = 0; i < arr.length && lo + i <= hi; i++) map[lo + i] = hexUtf16(arr[i].replace(/[<>]/g, ""));
        }
      }
    }
    return map;
  }
  // CID font /W widths array (balanced-bracket scan; entries are either
  // "cFirst [w w …]" or "cFirst cLast w"). Returns { code: width/1000 units }.
  function parseWidths(dict) {
    var w = {}, at = (dict || "").search(/\/W\s*\[/);
    if (at < 0) return w;
    var i = dict.indexOf("[", at), depth = 0, end = i;
    for (; end < dict.length; end++) {
      var c = dict.charAt(end);
      if (c === "[") depth++;
      else if (c === "]") { depth--; if (!depth) break; }
    }
    var body = dict.slice(i + 1, end);
    // tokenize: numbers and [ ] only
    var toks = body.match(/-?[\d.]+|\[|\]/g) || [], k = 0;
    while (k < toks.length) {
      var first = parseFloat(toks[k]); k++;
      if (isNaN(first)) continue;
      if (toks[k] === "[") {
        k++;
        var code = first;
        while (k < toks.length && toks[k] !== "]") { w[code++] = parseFloat(toks[k]); k++; }
        k++; // closing ]
      } else {
        var last = parseFloat(toks[k]), width = parseFloat(toks[k + 1]); k += 2;
        if (!isNaN(last) && !isNaN(width)) { for (var cc = first; cc <= last && cc - first < 65536; cc++) w[cc] = width; }
      }
    }
    return w;
  }

  function mmul(a, b) {   // 6-term matrix product a×b ([a b c d e f])
    return [
      a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3],
      a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3],
      a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5]
    ];
  }

  // decode a shown string's raw glyph bytes through the font: returns the text
  // plus the exact advance width (font units/1000 × size applied by caller)
  function decodeGlyphs(raw, font) {
    var text = "", adv = 0, i, code;
    if (font && font.two) {
      for (i = 0; i + 1 < raw.length; i += 2) {
        code = (raw.charCodeAt(i) << 8) | raw.charCodeAt(i + 1);
        var t = font.map ? font.map[code] : null;
        text += (t == null ? "" : t);
        adv += (font.widths && font.widths[code] != null) ? font.widths[code] : (font.dw || 500);
      }
    } else {
      for (i = 0; i < raw.length; i++) {
        code = raw.charCodeAt(i);
        text += (font && font.map && font.map[code] != null) ? font.map[code] : String.fromCharCode(code);
        adv += 500;
      }
    }
    return { text: text.replace(/\u0000/g, ""), adv: adv };
  }

  // interpret one content stream: track ctm (q/Q/cm) + text matrix (BT/Tm/Td/
  // TD/T*/TL), decode Tj/TJ/'/" through the current font, emit positioned runs
  function pdfPageRuns(content, fontsByName, out) {
    var i = 0, n = content.length;
    var stack = [], ctm = [1, 0, 0, 1, 0, 0];
    var tm = null, tlm = null, tl = 0, fsize = 10, font = null;
    var ops = [];
    function isWS(c) { return c === " " || c === "\n" || c === "\r" || c === "\t" || c === "\f" || c === "\u0000"; }
    function isDelim(c) { return c === "/" || c === "[" || c === "]" || c === "<" || c === ">" || c === "(" || c === ")" || c === "{" || c === "}" || c === "%"; }
    function nums(count) {
      var vals = [];
      for (var k = 0; k < ops.length; k++) if (ops[k].t === "num") vals.push(ops[k].v);
      return vals.slice(vals.length - count);
    }
    function lineTd(tx, ty) { if (tlm) { tlm = mmul([1, 0, 0, 1, tx, ty], tlm); tm = tlm; } }
    function show(raw) {
      if (tm == null || raw == null) return;
      var d = decodeGlyphs(raw, font);
      if (d.text) {
        var trm = mmul(tm, ctm);
        // sheared/rotated text (the slanted "Note" label) mustn't define the
        // page's left margin — flag it so runsToText skips it for minX
        var sk = (Math.abs(trm[1]) > 0.001 || Math.abs(trm[2]) > 0.001) ? 1 : 0;
        out.push({ x: trm[4], y: trm[5], s: d.text, end: 0, sk: sk });
        out[out.length - 1].end = mmul(mmul([1, 0, 0, 1, d.adv / 1000 * fsize, 0], tm), ctm)[4];
      }
      tm = mmul([1, 0, 0, 1, d.adv / 1000 * fsize, 0], tm);
    }
    while (i < n) {
      var c = content.charAt(i);
      if (isWS(c)) { i++; continue; }
      if (c === "%") { while (i < n && content.charAt(i) !== "\n") i++; continue; }
      if (c === "(") {                                   // literal string
        var depth = 1, j = i + 1, sbuf = "";
        while (j < n && depth > 0) {
          var ch = content.charAt(j);
          if (ch === "\\") {
            var nx = content.charAt(j + 1);
            if (nx === "n") sbuf += "\n"; else if (nx === "r") sbuf += "\r"; else if (nx === "t") sbuf += "\t";
            else if (nx >= "0" && nx <= "7") {
              var oct = (/^[0-7]{1,3}/.exec(content.slice(j + 1, j + 4)) || ["0"])[0];
              sbuf += String.fromCharCode(parseInt(oct, 8)); j += oct.length - 1;
            } else sbuf += nx;
            j += 2; continue;
          }
          if (ch === "(") depth++;
          else if (ch === ")") { depth--; if (!depth) { j++; break; } }
          sbuf += ch; j++;
        }
        ops.push({ t: "str", v: sbuf }); i = j; continue;
      }
      if (c === "<") {
        if (content.charAt(i + 1) === "<") {             // inline dict — skip balanced
          var d2 = 1, j2 = i + 2;
          while (j2 < n && d2 > 0) {
            if (content.charAt(j2) === "<" && content.charAt(j2 + 1) === "<") { d2++; j2 += 2; }
            else if (content.charAt(j2) === ">" && content.charAt(j2 + 1) === ">") { d2--; j2 += 2; }
            else j2++;
          }
          ops.push({ t: "dict" }); i = j2; continue;
        }
        var e2 = content.indexOf(">", i);                // hex string
        if (e2 < 0) break;
        var hex = content.slice(i + 1, e2).replace(/[^0-9A-Fa-f]/g, "");
        if (hex.length % 2) hex += "0";
        var hbuf = "";
        for (var hh = 0; hh < hex.length; hh += 2) hbuf += String.fromCharCode(parseInt(hex.substr(hh, 2), 16));
        ops.push({ t: "str", v: hbuf }); i = e2 + 1; continue;
      }
      if (c === "[") { ops.push({ t: "[" }); i++; continue; }
      if (c === "]") {
        var arr = [];
        while (ops.length && ops[ops.length - 1].t !== "[") arr.unshift(ops.pop());
        ops.pop();
        ops.push({ t: "arr", v: arr }); i++; continue;
      }
      if (c === "/") {
        var j3 = i + 1;
        while (j3 < n && !isWS(content.charAt(j3)) && !isDelim(content.charAt(j3))) j3++;
        ops.push({ t: "name", v: content.slice(i + 1, j3) }); i = j3; continue;
      }
      if (c === "+" || c === "-" || c === "." || (c >= "0" && c <= "9")) {
        var j4 = i + 1;
        while (j4 < n && /[0-9.eE+\-]/.test(content.charAt(j4))) j4++;
        ops.push({ t: "num", v: parseFloat(content.slice(i, j4)) }); i = j4; continue;
      }
      var j5 = i;                                        // operator word
      while (j5 < n && !isWS(content.charAt(j5)) && !isDelim(content.charAt(j5))) j5++;
      if (j5 === i) { i++; continue; }                   // stray delimiter — skip
      var op = content.slice(i, j5); i = j5;
      try {
        if (op === "q") stack.push(ctm);
        else if (op === "Q") { if (stack.length) ctm = stack.pop(); }
        else if (op === "cm") { var m6 = nums(6); if (m6.length === 6) ctm = mmul(m6, ctm); }
        else if (op === "BT") { tm = [1, 0, 0, 1, 0, 0]; tlm = tm; }
        else if (op === "ET") { tm = null; tlm = null; }
        else if (op === "Tf") {
          for (var kf = ops.length - 1; kf >= 0; kf--) if (ops[kf].t === "name") { font = fontsByName[ops[kf].v] || null; break; }
          var sz = nums(1); if (sz.length) fsize = sz[0];
        }
        else if (op === "Tm") { var t6 = nums(6); if (t6.length === 6) { tm = t6; tlm = t6; } }
        else if (op === "Td") { var td = nums(2); if (td.length === 2) lineTd(td[0], td[1]); }
        else if (op === "TD") { var td2 = nums(2); if (td2.length === 2) { tl = -td2[1]; lineTd(td2[0], td2[1]); } }
        else if (op === "TL") { var tn = nums(1); if (tn.length) tl = tn[0]; }
        else if (op === "T*") lineTd(0, -tl);
        else if (op === "Tj") { if (ops.length && ops[ops.length - 1].t === "str") show(ops[ops.length - 1].v); }
        else if (op === "'") { lineTd(0, -tl); if (ops.length && ops[ops.length - 1].t === "str") show(ops[ops.length - 1].v); }
        else if (op === '"') { lineTd(0, -tl); if (ops.length && ops[ops.length - 1].t === "str") show(ops[ops.length - 1].v); }
        else if (op === "TJ") {
          if (ops.length && ops[ops.length - 1].t === "arr") {
            ops[ops.length - 1].v.forEach(function (el) {
              if (el.t === "str") show(el.v);
              else if (el.t === "num" && tm) tm = mmul([1, 0, 0, 1, -el.v / 1000 * fsize, 0], tm);
            });
          }
        }
      } catch (e) {}
      ops = [];
    }
  }

  // positioned runs → layout-preserving text lines. Columns land at x/COLW so
  // cells align by character position across rows (what the table parser
  // slices by); a run starting within a point of the previous run's true end
  // is GLUED (footnote markers like "VW 504 001)" must stay glued).
  function runsToText(runs) {
    var COLW = 4.2, lines = [], cur = null, i;
    if (!runs.length) return [];
    // PDF device y points UP (visual top = largest y) → sort descending for
    // top-to-bottom reading order. Columns are anchored at the page's left
    // margin (minX) like pdftotext, so headings start at column 0.
    // the margin = the leftmost x SHARED by several runs. A one-off element
    // (the big page number sits ~3pt left of the margin; the slanted "Note"
    // label is skewed) must not drag the margin left, or every line gains a
    // stray leading space and the model headers stop matching.
    var counts = {}, minAll = null, minX = null;
    runs.forEach(function (rn) {
      if (rn.sk) return;
      var k = Math.round(rn.x * 4) / 4;
      counts[k] = (counts[k] || 0) + 1;
      if (minAll === null || rn.x < minAll) minAll = rn.x;
    });
    Object.keys(counts).forEach(function (k) { if (counts[k] >= 3 && (minX === null || +k < minX)) minX = +k; });
    if (minX === null) minX = (minAll === null ? runs[0].x : minAll);
    runs.sort(function (a, b) { return (b.y - a.y) || (a.x - b.x); });
    for (i = 0; i < runs.length; i++) {
      if (!cur || cur.y - runs[i].y > 4) { cur = { y: runs[i].y, parts: [] }; lines.push(cur); }
      cur.parts.push(runs[i]);
    }
    var out = [];
    lines.forEach(function (ln) {
      ln.parts.sort(function (a, b) { return a.x - b.x; });
      var s = "", endX = -1e9;
      ln.parts.forEach(function (p) {
        var col = Math.round((p.x - minX) / COLW);
        if (!s) { while (s.length < col) s += " "; }
        else if (p.x - endX < 1.0) { /* glue */ }
        else {
          var target = Math.max(col, s.length + 1);
          while (s.length < target) s += " ";
        }
        s += p.s;
        endX = Math.max(endX, p.end || p.x);
      });
      out.push(s.replace(/\s+$/, ""));
    });
    return out;
  }

  // whole PDF → Promise<layout text> (pages in order, lines top to bottom)
  function pdfTextLines(buf) {
    var bytes = new Uint8Array(buf);
    if (bstr(bytes.subarray(0, 5)) !== "%PDF-") return Promise.reject(new Error("that file isn't a PDF"));
    var objs = pdfObjects(bytes);
    var pages = pdfPageOrder(objs);
    if (!pages.length) return Promise.reject(new Error("couldn't read that PDF"));
    var jobs = [], fontByObj = {}, contentText = {}, pageInfo = [];
    pages.forEach(function (pn) {
      var d = (objs[pn] || {}).dict || "";
      var resSrc = d, rr = /\/Resources\s+(\d+)\s+0\s+R/.exec(d);
      if (rr && objs[+rr[1]]) resSrc = objs[+rr[1]].dict || "";
      var fonts = {}, fm = /\/Font\s*<<([\s\S]*?)>>/.exec(resSrc);
      if (fm) { var pr = /\/([^\s\/<>\[\]]+)\s+(\d+)\s+0\s+R/g, pm; while ((pm = pr.exec(fm[1]))) fonts[pm[1]] = +pm[2]; }
      var contents = [], cs = /\/Contents\s+(\d+)\s+0\s+R/.exec(d);
      if (cs) contents.push(+cs[1]);
      else {
        var ca = /\/Contents\s*\[([^\]]*)\]/.exec(d);
        if (ca) { var cr = /(\d+)\s+0\s+R/g, cm2; while ((cm2 = cr.exec(ca[1]))) contents.push(+cm2[1]); }
      }
      pageInfo.push({ fonts: fonts, contents: contents });
      Object.keys(fonts).forEach(function (nm) {
        var fn = fonts[nm];
        if (fn in fontByObj) return;
        var fd = (objs[fn] || {}).dict || "";
        var info = { two: /\/Subtype\s*\/Type0/.test(fd), map: null, widths: null, dw: 500 };
        fontByObj[fn] = info;
        var desc = -1, dm = /\/DescendantFonts\s*\[\s*(\d+)\s+0\s+R/.exec(fd);
        if (dm) desc = +dm[1];
        if (desc >= 0 && objs[desc]) {
          var dd = objs[desc].dict || "";
          info.widths = parseWidths(dd);
          var dwm = /\/DW\s+([\d.]+)/.exec(dd);
          if (dwm) info.dw = parseFloat(dwm[1]);
        }
        var tu = pdfRef(fd, "ToUnicode");
        if (tu >= 0 && objs[tu] && objs[tu].data) {
          jobs.push(inflateZlib(objs[tu].data).then(function (u) { info.map = parseCMap(bstr(u)); }).catch(function () {}));
        }
      });
      contents.forEach(function (cn) {
        if (cn in contentText || !objs[cn] || !objs[cn].data) return;
        contentText[cn] = "";
        jobs.push(inflateZlib(objs[cn].data).then(function (u) { contentText[cn] = bstr(u); }).catch(function () {}));
      });
    });
    return Promise.all(jobs).then(function () {
      var all = [];
      pageInfo.forEach(function (pi) {
        var runs = [], byName = {};
        Object.keys(pi.fonts).forEach(function (nm) { byName[nm] = fontByObj[pi.fonts[nm]]; });
        pi.contents.forEach(function (cn) { try { pdfPageRuns(contentText[cn] || "", byName, runs); } catch (e) {} });
        all = all.concat(runsToText(runs));
      });
      return all.join("\n");
    });
  }

  /* ---- 2. fluid table parser (ported from tools/parse-fluids.js) ----
   * Same battle-tested logic that produced the reviewed 2011–2026 data:
   * model sections ("1.9  Atlas (CA1)") each holding the 4 system tables,
   * columns sliced by the header row's character positions.
   * ------------------------------------------------------------------ */

  // strip a glued footnote marker like the "1)" in "VW 504 001) (0W-30)"
  function dropFootnote(s) { return String(s || "").replace(/(\d{2})\d\)/g, "$1"); }
  // normalise Unicode hyphens + rejoin words split across a line wrap
  function normHyphens(s) {
    return String(s || "").replace(/[‐‑­]/g, "-").replace(/([a-z])-\s+([a-z])/g, "$1$2");
  }
  var CAP_RE = /\d[\d.]*\s*L\s*\([^)]*qt[^)]*\)/;
  var SPEC_RE = /VW\s*\d{3}\s*\d{2}(?:\s*\(\s*\d[0-9W\s-]*\))?/g;
  // engine/trans codes out of "(DDSA / DDSB)" or "(0CR / 0CQ)"
  function codesIn(text) {
    var m = /\(([^)]*)\)/.exec(text || "");
    if (!m) return [];
    return m[1].split(/[\/,]/).map(function (s) { return s.trim().toUpperCase(); })
      .filter(function (s) { return /^[A-Z0-9]{2,6}$/.test(s); });
  }
  // The optional "(?:\d[\d.]*\s*[-‐-―−]\s*)?" prefix captures a RANGE low-end, so a
  // capacity like "0.88 - 0.93 L (…)" (2025/26 ID.Buzz/ID.4/ID.7 Single Speed 0MJ,
  // and the older DSG range nit) is taken whole instead of stranding "0.88 -" in the
  // grey label with only "0.93 L" bolded. It stays optional + demands a real dash, so
  // "500 +/- 15 g" and every plain value are unaffected.
  var VAL_RE = /(?:Approximately\s+)?(?:\d[\d.]*\s*[-‐-―−]\s*)?\d[\d.]*(?:\s*\+\/-\s*[\d.]+)?\s*(?:L|g|cc|ml)(?:\s*\+\/-\s*[\d.]+\s*(?:L|g|cc|ml))?(?:\s*\([^)]*\))?/g;
  // a number can never have two decimal points — VW's 2023 PDF has a
  // "(0.6.3 qt)" typo for "(0.63 qt)". Collapse a stray middle dot.
  function fixDecimals(s) { return s.replace(/(\d+\.\d+)\.(\d+)/g, "$1$2"); }
  // tidy a captured range so a glued source cell ("0.88- 0.93L") prints spaced
  // ("0.88 - 0.93 L"); leaves the imperial "(… qt)" parenthetical alone.
  function tidyRange(s) { return s.replace(/^(\d[\d.]*)\s*[-‐-―−]\s*(\d[\d.]*)\s*(L|g|cc|ml)\b/i, "$1 - $2 $3"); }
  function valuesIn(text) {
    var out = [], m;
    VAL_RE.lastIndex = 0;
    while ((m = VAL_RE.exec(text || ""))) out.push(fixDecimals(tidyRange(m[0].replace(/\s+/g, " ").trim())));
    return out;
  }
  // noise lines inside tables (page chrome, footnotes, the Note block)
  function isNoise(line) {
    var t = line.trim();
    if (!t) return true;
    if (/^\d{1,3}$/.test(t)) return true;
    if (/^\d{2}\.\d{4}$/.test(t)) return true;
    if (/^\d{1,3}\s+\d{2}\.\d{4}$/.test(t)) return true;
    if (/^Note$/i.test(t)) return true;
    if (/^All quantities are approximate/i.test(t)) return true;
    if (/^filling instructions\.?$/i.test(t)) return true;
    if (/^\d\)\s/.test(t)) return true;
    if (/^(engine oil that meets|Using oil with|Only use different)/i.test(t)) return true;
    return false;
  }
  // column boundaries from a header row + slicing a row into cells by them
  function boundaries(headerLine, titles) {
    var idx = [], from = 0;
    for (var i = 0; i < titles.length; i++) {
      var at = headerLine.indexOf(titles[i], from);
      if (at < 0) return null;
      idx.push(at); from = at + titles[i].length;
    }
    return idx;
  }
  function sliceCells(line, idx) {
    var cells = [];
    for (var i = 0; i < idx.length; i++) {
      var end = (i + 1 < idx.length) ? idx[i + 1] : line.length + 999;
      cells.push((line.substring(Math.max(0, idx[i] - 1), end) || "").trim());
    }
    return cells;
  }
  // ENGINE OIL CAPACITY: Engine | Engine Oil Type | Capacity
  function parseOil(lines, hdrIdx) {
    var idxType = lines[hdrIdx].indexOf("Engine Oil Type");
    if (idxType < 0) return [];
    var rows = [], cur = null;
    for (var i = hdrIdx + 1; i < lines.length; i++) {
      if (/^\s*\d\)\s/.test(lines[i])) break;   // footnote paragraph ends the table
      if (isNoise(lines[i])) continue;
      var ln = normHyphens(lines[i]);
      if (/^\s*Engine\s+Engine Oil Type/.test(ln)) { idxType = ln.indexOf("Engine Oil Type"); continue; }
      var col1 = ln.substring(0, idxType).trim();
      var rest = dropFootnote(ln.substring(idxType));
      // Everything before the capacity value is Oil-Type column text. Keeping a
      // separate `type` accumulator holds a spec's viscosity next to its "VW ###"
      // even when the cell wraps and the "(0W-30)" lands on a continuation line
      // (2018 Golf R: line 1 ends "VW 508 00 (0W-20) VW 504 00", line 2 is
      // "(0W-30) /") — otherwise the "(0W-30)" was appended after the capacity in
      // `rest` and dropped by SPEC_RE.
      var cm = rest.match(CAP_RE);
      if (cm) { cur = { eng: col1, rest: rest, type: rest.slice(0, cm.index) }; rows.push(cur); }
      else if (cur) { if (col1) cur.eng += " " + col1; cur.rest += " " + rest; cur.type += " " + rest; }
    }
    return rows.map(function (r) {
      var engines = codesIn(r.eng);
      var bare = !engines.length;
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
  // COMPONENT/APPLICATION/CAPACITY tables (coolant, A/C, drivetrain)
  function parseCAC(lines, hdrIdx) {
    var idx = null, rows = [], cur = null, lastComp = "";
    for (var i = hdrIdx; i < lines.length; i++) {
      var ln = normHyphens(lines[i]);
      if (/^\s*Component\s+Application\s+Capacity/.test(ln)) {
        idx = boundaries(ln, ["Component", "Application", "Capacity"]); cur = null; continue;
      }
      if (!idx || isNoise(ln)) continue;
      var c = sliceCells(ln, idx), comp = c[0], app = c[1], capCell = c[2];
      if (comp) lastComp = comp;
      // A/C capacities are metric (VW works in grams) — drop the imperial
      // "(… oz.)" / "(… fl. oz.)" conversion entirely. This ALSO un-breaks the
      // e-Golf / 2017 Tiguan cells where the layout interleaves that parenthetical
      // between a charge and its tolerance ("500 +/- (17.6 +/- 0.5 oz.) 15 g"),
      // which otherwise stranded the charge in the label.
      capCell = capCell.replace(/\([^)]*(?:oz|fl)[^)]*\)/gi, " ");
      // Some years' cells interleave the label words between a "N +/-" tolerance
      // and its trailing "M unit" (2018 Golf R A/C + compressor oil render as
      // "Initial 500 +/- Fill / Refill 15 g"). Left as-is, VAL_RE only sees the
      // orphaned "15 g" and the real capacity "500" gets stranded in the label.
      // Pull the label words out so the value reassembles to "500 +/- 15 g".
      capCell = capCell.replace(
        /(\d[\d.]*\s*\+\/-)\s+((?:Initial|Fill|Refill|\/|\s)+?)\s*([\d.]+\s*(?:L|g|cc|ml)\b)/gi,
        "$2 $1 $3");
      var vals = valuesIn(capCell);
      var label = capCell.replace(VAL_RE, "").replace(/\s+/g, " ").trim();
      var codeOnly = /^\([A-Z0-9/\s]+\)$/.test(app);
      var madeRow = false;
      if (codeOnly && cur) { cur.application += " " + app; }
      else if (app && (comp || /[A-Za-z]/.test(app)) && !/^(Fill|Refill|Initial|Approximately)/i.test(app)) {
        cur = { component: comp || lastComp, application: app, fills: [] };
        rows.push(cur); madeRow = true;
      }
      if (!cur) { cur = { component: comp || lastComp, application: app || "", fills: [] }; rows.push(cur); madeRow = true; }
      if (comp && !madeRow && !codeOnly) cur.component += " " + comp;
      for (var v = 0; v < vals.length; v++) cur.fills.push({ label: label, value: vals[v] });
      if (!vals.length && label && cur.fills.length) {
        var f = cur.fills[cur.fills.length - 1];
        f.label = (f.label ? f.label + " " : "") + label;
      }
    }
    rows.forEach(function (r) {
      r.fills.forEach(function (f) { f.label = (f.label || "").replace(/\s+/g, " ").replace(/\s*\/\s*/g, " / ").trim(); });
      r.application = (r.application || "").replace(/\s+/g, " ").trim();
      r.component = (r.component || "").replace(/\s+/g, " ").trim();
      var rt = /R\s?1234yf|R\s?134a|R\s?744/i.exec(r.component);
      if (rt) {
        r.refrigerant = rt[0].replace(/\s+/g, "").replace(/^r/, "R");
        if (/^\(?R\s?(1234yf|134a|744)\)?$/i.test(r.component)) r.component = "A/C System Refrigerant " + r.component;
      }
    });
    return rows.filter(function (r) { return r.fills.length; });
  }
  // rebuild the EV single-speed "0MP" row whose 2nd (text-only) fill gets
  // mangled by the cramped source cell — fixed VW wording, same every year
  function fixEvSingleSpeed(rows) {
    return rows.map(function (r) {
      if (!/\b0MP\b/.test(r.application || "")) return r;
      var blob = (r.fills || []).map(function (f) { return (f.label || "") + " " + (f.value || ""); }).join(" ");
      if (!/residue/i.test(blob)) return r;
      var num = "";
      (r.fills || []).forEach(function (f) { if (!num && /\d/.test(f.value || "")) num = f.value; });
      num = num.replace(/(\d)\s*L\b/g, "$1 L");
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
  var SYS_HEADERS = {
    "ENGINE OIL CAPACITY": "engineOil",
    "ENGINE COOLANT": "engineCoolant",
    "E-MOTOR COOLANT": "engineCoolant",
    "AIR CONDITIONING": "airConditioning",
    "DRIVETRAIN": "drivetrain"
    // BRAKE HYDRAULIC SYSTEM intentionally skipped
  };
  var MODEL_HDR = /^\d+\.\d+\s+(.+?)\s*\(([^)]*)\)\s*$/;
  // layout text → [{ model, modelCode, engineOil, engineCoolant, airConditioning, drivetrain }]
  function parseFluidModels(text) {
    // Tolerances arrive in two shapes: a Unicode ± (most years), OR — on years
    // like the 2018 Golf R — three separate glyphs the layout spaces out into
    // "+ / -" (any dash variant). Normalise BOTH to the contiguous ASCII "+/-"
    // so VAL_RE and the A/C split-tolerance reassembly (parseCAC) match uniformly.
    var lines = String(text || "").replace(/±/g, " +/- ")
      .replace(/\+\s*\/\s*[-‐-―−]/g, "+/-").split(/\r?\n/);
    for (var cLn = 0; cLn < lines.length; cLn++) {
      if (/^\s*\d[\d.]*\s+Maintenance\s+Schedules?\b/i.test(lines[cLn])) { lines = lines.slice(0, cLn); break; }
    }
    var sections = [];
    for (var i = 0; i < lines.length; i++) {
      var m = MODEL_HDR.exec(lines[i]);
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
      var sys = [];
      for (var j = start; j < end; j++) {
        var key = SYS_HEADERS[lines[j].trim()];
        if (key) sys.push({ key: key, at: j });
      }
      for (var k = 0; k < sys.length; k++) {
        var sStart = sys[k].at, sEnd = (k + 1 < sys.length) ? sys[k + 1].at : end;
        for (var b = sStart + 1; b < sEnd; b++) { if (/^BRAKE HYDRAULIC SYSTEM$/.test(lines[b].trim())) { sEnd = b; break; } }
        var sub = lines.slice(sStart, sEnd);
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

  // model year: the file name carries it ("2022 VW Fluid Capacity Tables.pdf");
  // fall back to the first plausible year near the top of the text
  function fluidYearOf(name, text) {
    var m = /\b(20\d\d)\b/.exec(String(name || ""));
    if (m) return m[1];
    m = /\b(20\d\d)\b/.exec(String(text || "").split("\n").slice(0, 40).join(" "));
    return m ? m[1] : "";
  }
  // PDF bytes → { year, models } (rejects with a plain-language message)
  function fluidsFromPdf(buf, name) {
    return pdfTextLines(buf).then(function (text) {
      var models = parseFluidModels(text);
      if (!models.length) throw new Error("no fluid tables found — is this a VW Fluid Capacity Tables PDF?");
      var year = fluidYearOf(name, text);
      if (!year) throw new Error("couldn’t tell the model year — put it in the file name (e.g. “2022 ….pdf”)");
      return { year: year, models: models };
    });
  }

  /* ---- 3. vehicle matching (ported from the old lookup page) -------- */
  function fluidVeh(r) {
    var v = (r && r.__vehicle) || {};
    var veh = {
      year: String(v.year || ""), model: String(v.model || ""),
      engine: String(v.engine || "").toUpperCase(), trans: String(v.trans || "").toUpperCase()
    };
    // a vehicle can carry more than one trans code — EVs list front + rear
    // drive units ("0MH / 0MK"); ICE is one ("09PA - AQ450-8A"). Keep them all.
    veh.transCodes = veh.trans.split(/[^A-Z0-9]/).filter(function (s) { return /^[A-Z0-9]{3,6}$/.test(s); });
    veh.transCode = veh.transCodes[0] || "";
    veh.awd = /\bAWD\b|4 ?MOTION|4MOT/i.test(veh.model);
    return veh;
  }
  function bareCodes(text) {
    return String(text || "").toUpperCase().split(/[\/,]/).map(function (s) { return s.trim(); })
      .filter(function (s) { return /^[A-Z0-9]{2,6}$/.test(s); });
  }
  // normalise a model name for comparison: "ID.4" ↔ "ID.4 AWD PRO S",
  // "Atlas Family" ↔ "ATLAS SEL AWD"
  function modelNorm(s) { return String(s || "").toUpperCase().replace(/\bFAMILY\b/g, " ").replace(/[^A-Z0-9]/g, ""); }
  function pickFluidModel(models, veh) {
    var vm = modelNorm(veh.model);
    if (/GTI|GOLFR/.test(vm)) vm += "GOLF";   // GTI / Golf R live under "Golf Family"
    var best = null, score = -1;
    (models || []).forEach(function (m) {
      String(m.model || "").toUpperCase().split("/").forEach(function (tok) {
        var t = modelNorm(tok);
        if (t && vm.indexOf(t) >= 0 && t.length > score) { score = t.length; best = m; }
      });
    });
    return best;
  }
  // trans codes from an Application cell — parenthesised "(09P)" and bare
  // "Single Speed 0MH" (EV reduction gears are often written without parens)
  function appTransCodes(app) {
    var cs = codesIn(app);
    (String(app || "").toUpperCase().match(/\b0[A-Z0-9]{2,3}\b/g) || []).forEach(function (c) { if (cs.indexOf(c) < 0) cs.push(c); });
    return cs;
  }
  function transHit(app, veh) {
    var cs = appTransCodes(app);
    if (!cs.length || !veh.transCodes.length) return false;
    return cs.some(function (c) {
      return veh.transCodes.some(function (t) { return t && (t.indexOf(c) === 0 || c.indexOf(t) === 0); });
    });
  }
  var TRANS_RE = /\d+\s*-?\s*speed|single\s*(?:gear|speed)|direct shift|gearbox|automatic|manual|dsg|tiptronic/i;

  /* ---- 4. the Fluids & Capacities window (ported from the old lookup
   *         page, now built LOCALLY from the stored data — no network) ---- */
  var FL_ICON = {
    oil:   "M3 12h9l3-2 6 1v1l-6 1M3 12v6a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-6M7 12V9h3v3M19.5 7l1-2M20.5 5c.5.7.8 1.2.8 1.6a.8.8 0 0 1-1.6 0c0-.4.3-.9.8-1.6z",
    cool:  "M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z",
    ac:    "M12 2v20M4.2 7l15.6 10M19.8 7L4.2 17M12 2l-2.4 2.4M12 2l2.4 2.4M12 22l-2.4-2.4M12 22l2.4-2.4M4.2 7l3.3-.4M4.2 7l.4 3.3M19.8 17l-3.3.4M19.8 17l-.4-3.3M19.8 7l-.4 3.3M19.8 7l-3.3-.4M4.2 17l.4-3.3M4.2 17l3.3.4",
    drive: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
  };
  function fCapHtml(fills) {
    return (fills || []).map(function (f) {
      return '<span class="fill">' + (f.label ? '<span class="lab">' + esc(f.label) + "</span> " : "") + "<b>" + esc(f.value) + "</b></span>";
    }).join("");
  }
  function fCard(cls, icon, title, inner) {
    return '<div class="card ' + cls + '"><div class="chd"><svg viewBox="0 0 24 24"><path d="' + icon + '"/></svg><b>' +
      esc(title) + '</b></div><div class="cbody">' + (inner || '<div class="none">Not listed for this vehicle.</div>') + "</div></div>";
  }
  function fluidOilHTML(m, veh) {
    var rows = (m.engineOil || []).filter(function (r) { return (r.engines || []).indexOf(veh.engine) >= 0; });
    var fallback = !rows.length && (m.engineOil || []).length;
    if (fallback) rows = m.engineOil;
    var inner = rows.map(function (r) {
      return '<div class="row"><div class="cap">' + esc(r.capacity || "—") + "</div>" +
        (r.specs && r.specs.length ? '<div class="spec">' + esc(r.specs.join("  ·  ")) + "</div>" : "") +
        (fallback ? '<div class="lab">' + esc(r.desc || (r.engines || []).join("/")) + "</div>" : "") + "</div>";
    }).join("");
    if (fallback && inner) inner += '<div class="lab note">No exact engine-code match for ' + esc(veh.engine) + " — all engines shown.</div>";
    return fCard("oil", FL_ICON.oil, "Engine Oil", inner);
  }
  function fluidCoolHTML(m, veh) {
    var rows = (m.engineCoolant || []).filter(function (r) { return bareCodes(r.application).indexOf(veh.engine) >= 0; });
    if (!rows.length) rows = m.engineCoolant || [];
    var inner = rows.map(function (r) {
      return '<div class="row"><div class="cap">' + esc((r.fills[0] && r.fills[0].value) || "—") + "</div></div>";
    }).join("");
    return fCard("cool", FL_ICON.cool, "Engine Coolant", inner);
  }
  function fluidAcHTML(m) {
    var inner = (m.airConditioning || []).map(function (r) {
      var name = String(r.component || "").replace(/\s*\(R\s?1234yf\)|\s*\(R\s?134a\)/ig, "").trim();
      return '<div class="row"><div class="lab">' + esc(name) +
        (r.refrigerant ? '<span class="tag">' + esc(r.refrigerant) + "</span>" : "") +
        (r.application && !/^all/i.test(r.application) ? ' <span class="lab">· ' + esc(r.application) + "</span>" : "") +
        '</div><div class="cap">' + fCapHtml(r.fills) + "</div></div>";
    }).join("");
    return fCard("ac", FL_ICON.ac, "Air Conditioning", inner);
  }
  function fluidDriveHTML(m, veh) {
    var all = m.drivetrain || [];
    var trans = all.filter(function (r) { return TRANS_RE.test(r.application); });
    var subs = all.filter(function (r) { return !TRANS_RE.test(r.application); });
    var matched = trans.filter(function (r) { return transHit(r.application, veh); });
    var noMatch = !matched.length && trans.length;
    if (noMatch) matched = trans;                       // fallback: show all transmissions
    // hide "only AWD" sub-components on a FWD vehicle
    subs = subs.filter(function (r) { return veh.awd || !/AWD/i.test(r.application); });
    var rowHtml = function (r) {
      var qualOnly = /^(only\b|all\b|awd$|fwd$)/i.test(r.application || "");
      var name = qualOnly ? (r.component || r.application) : (r.application || r.component);
      var qual = (qualOnly && r.application) ? ' <span class="lab">· ' + esc(r.application) + "</span>" : "";
      return '<div class="row"><div class="lab">' + esc(name) + qual + "</div>" +
        '<div class="cap">' + fCapHtml(r.fills) + "</div></div>";
    };
    var inner = matched.map(rowHtml).join("") + subs.map(rowHtml).join("");
    if (noMatch && inner) inner += '<div class="lab note">No match for transmission ' + esc(veh.transCode || veh.trans) + " — all transmissions shown.</div>";
    return fCard("drive", FL_ICON.drive, "Drivetrain", inner);
  }

  function buildFluidsWindowHTML(r) {
    var veh = fluidVeh(r);
    var st = loadFluids();
    var yd = st && st.years && st.years[veh.year];
    var body;
    if (!yd) {
      body = '<div class="err">No fluid tables are loaded for <b>' + esc(veh.year || "this year") +
        "</b> on this computer. Open Settings (the ⚙ gear in Hahns) and load that year’s VW Fluid Capacity Tables PDF.</div>";
    } else {
      var m = pickFluidModel(yd.models || [], veh);
      if (!m) body = '<div class="err">No fluid entry found for <b>' + esc(veh.model || "this model") + "</b> in the " + esc(veh.year) + " tables.</div>";
      else body = fluidOilHTML(m, veh) + fluidCoolHTML(m, veh) + fluidAcHTML(m) + fluidDriveHTML(m, veh);
    }
    var vehGrid = [["Model Year", veh.year], ["Model", veh.model], ["Engine Code", veh.engine], ["Trans Type", veh.trans + (veh.awd ? " · AWD" : "")]]
      .map(function (p) { return '<span class="k">' + esc(p[0]) + '</span><span class="v">' + esc(p[1] || "—") + "</span>"; }).join("");
    return '<!doctype html><html><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      "<title>Fluids &amp; Capacities" + (veh.model ? " — " + esc(veh.model) : "") + "</title>" +
      "<style>" + FLUIDS_WIN_CSS + "</style></head><body>" +
      '<button id="hb_close" class="xclose" onclick="window.close()" title="Close" aria-label="Close">&#10005;</button>' +
      '<div class="bar"><button id="hb_print" onclick="window.print()">Print</button></div>' +
      "<h1>Fluids &amp; Capacities</h1>" +
      '<div class="meta">from the ' + esc(veh.year || "?") + " tables on this computer" + (yd && yd.file ? " (" + esc(yd.file) + ")" : "") + "</div>" +
      '<div class="veh"><div class="t">Vehicle</div><div class="grid">' + vehGrid + "</div></div>" +
      body +
      '<div class="foot">Approximate quantities — always confirm against the Repair Manual / Maintenance Procedures.<br>H.A.H.N.S ' + esc(BUILD) + " · matched to your vehicle, nothing saved online.</div>" +
      "</body></html>";
  }

  // open (or reuse) a named pop-up and write a self-contained document into it.
  // Buttons are wired from the opener too (same-origin), so Print/Close work
  // regardless of the child window's CSP. Returns false if pop-ups are blocked.
  function openDocWindow(name, w, h, html) {
    try {
      if (screen && screen.availWidth) w = Math.min(w, screen.availWidth - 40);
      if (screen && screen.availHeight) h = Math.min(h, screen.availHeight - 80);
    } catch (e) {}
    var left = 0, top = 0;
    try {
      left = Math.max(0, Math.round(((screen.availWidth || w) - w) / 2));
      top = Math.max(0, Math.round(((screen.availHeight || h) - h) / 2));
    } catch (e2) {}
    var feats = "width=" + w + ",height=" + h + ",left=" + left + ",top=" + top +
      ",scrollbars=yes,resizable=yes,menubar=no,toolbar=no,location=no,status=no";
    var win = null;
    try { win = window.open("", name, feats); } catch (e3) {}
    if (!win) { try { win = window.open("", name); } catch (e4) {} }
    if (!win) return false;
    try {
      win.document.open();
      win.document.write(html);
      win.document.close();
      var pb = win.document.getElementById("hb_print");
      if (pb) pb.onclick = function () { try { win.print(); } catch (e5) {} };
      var cb = win.document.getElementById("hb_close");
      if (cb) cb.onclick = function () { try { win.close(); } catch (e6) {} };
      win.focus();
    } catch (e7) {}
    return true;
  }
  function openFluidsWindow(r) { return openDocWindow("hahns_fluids", 620, 820, buildFluidsWindowHTML(r)); }

  /* ---- 5. loading the PDFs through Settings -------------------------- */
  // pick the year PDFs (several at once is fine) and convert each LOCALLY.
  // Reading a picked file via FileReader is a LOCAL read — NO network.
  function pickFluidFiles(host, r, options, root) {
    var inp = document.createElement("input");
    inp.type = "file";
    inp.accept = ".pdf,application/pdf";
    inp.multiple = true;
    inp.style.display = "none";
    inp.addEventListener("change", function () {
      var files = Array.prototype.slice.call(inp.files || []);
      try { inp.remove(); } catch (e) {}
      if (!files.length) return;
      if (typeof DecompressionStream === "undefined") { flash(root, "This browser can’t read PDFs — use Chrome, Edge or Safari"); return; }
      flash(root, "Reading " + files.length + " PDF" + (files.length > 1 ? "s" : "") + "…");
      var results = [], chain = Promise.resolve();
      files.forEach(function (f) {
        chain = chain.then(function () {
          return new Promise(function (res) {
            var fr = new FileReader();
            fr.onload = function () {
              var buf = fr.result;
              sha256Hex(buf).then(function (hash) {
                fluidsFromPdf(buf, f.name).then(function (out) {
                  // keep the bytes + hash so the year can be stored as a Blob and
                  // silently re-parsed later when the parser improves
                  results.push({ name: f.name, year: out.year, models: out.models, buf: buf, hash: hash, size: (f.size || (buf && buf.byteLength) || 0) }); res();
                }).catch(function (err) {
                  results.push({ name: f.name, err: (err && err.message) || "could not read that PDF" }); res();
                });
              });
            };
            fr.onerror = function () { results.push({ name: f.name, err: "could not read that file" }); res(); };
            try { fr.readAsArrayBuffer(f); } catch (e) { results.push({ name: f.name, err: "could not read that file" }); res(); }
          });
        });
      });
      chain.then(function () { openFluidsConfirm(host, r, options, root, results); });
    });
    (root.querySelector(".wrap") || root).appendChild(inp);
    inp.click();
  }

  // the eyeball step before saving: per file, the model year + the models the
  // converter found (or a plain-language error). Save merges into the store.
  function openFluidsConfirm(host, r, options, root, results) {
    var ok = results.filter(function (o) { return !o.err; });
    var rows = results.map(function (o) {
      if (o.err) return '<div class="flrow bad"><b>' + esc(o.name) + "</b><span>" + esc(o.err) + "</span></div>";
      var names = (o.models || []).map(function (m) { return m.model; }).join(", ");
      if (names.length > 120) names = names.slice(0, 120) + "…";
      return '<div class="flrow"><b>' + esc(o.year) + " — " + o.models.length + " models</b><span>" + esc(names) + "</span></div>";
    }).join("");
    var ov = document.createElement("div");
    ov.className = "setc";
    ov.innerHTML = '<div class="setbox">' +
      '<button class="xclose" title="Close" aria-label="Close">&#10005;</button>' +
      '<p class="settl">Load fluid capacity tables</p>' +
      '<p class="setsub">Check each year’s models below against your PDFs, then save. Converted on this computer and kept only in this browser (so future parser fixes apply automatically) — nothing is uploaded.</p>' +
      rows +
      '<div class="maperr" style="display:none"></div>' +
      '<div class="setbtns"><button class="cancel">Cancel</button>' +
      (ok.length ? '<button class="primary save">Save ' + ok.length + " year" + (ok.length > 1 ? "s" : "") + "</button>" : "") +
      "</div></div>";
    root.appendChild(ov);
    var close = function () { try { ov.remove(); } catch (e) {} };
    ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
    ov.querySelector(".cancel").addEventListener("click", close);
    ov.querySelector(".xclose").addEventListener("click", close);
    var sv = ov.querySelector(".save");
    if (sv) sv.addEventListener("click", function () {
      sv.disabled = true;
      fluidsSaveYears(ok).then(function () {
        close();
        renderInto(host, r, options);
        flash(root, "Fluid tables saved: " + ok.map(function (o) { return o.year; }).sort().join(", "));
      }).catch(function (e) {
        var err = ov.querySelector(".maperr");
        err.textContent = "Couldn’t save (" + ((e && e.message) || "storage blocked or full on this machine") + ").";
        err.style.display = "block"; sv.disabled = false;
      });
    });
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
          // ALSO catch any tool from the uploaded shop list that TOOL_RE's fixed
          // formats miss (e.g. "VW 771"). The list is the shop's own dictionary.
          var dict = toolDict();
          if (dict) {
            dict.re.lastIndex = 0;
            var dm;
            while ((dm = dict.re.exec(line))) {
              var canon = (dict.map[normTool(dm[0])] || {}).n || dm[0].replace(/\s+/g, " ").trim();
              entries.push({ num: canon, desc: toolDescBefore(line.slice(0, dm.index)) || toolDescAfter(line.slice(dm.index + dm[0].length)) });
            }
          }
          // ALSO catch tools from the built-in VW master list (v0.3.16). Letter/
          // separator tools match anywhere; bare-integer tools only as a "-1833-"
          // callout (reNum, group 1 = the number). Dedup below handles overlaps.
          var bd = builtinToolDict();
          if (bd) {
            if (bd.reAny) {
              bd.reAny.lastIndex = 0;
              var bam;
              while ((bam = bd.reAny.exec(line))) {
                entries.push({ num: builtinCanon(bam[0]), desc: toolDescBefore(line.slice(0, bam.index)) || toolDescAfter(line.slice(bam.index + bam[0].length)) });
              }
            }
            if (bd.reNum) {
              bd.reNum.lastIndex = 0;
              var bnm;
              while ((bnm = bd.reNum.exec(line))) {
                var ni = bnm.index + bnm[0].indexOf(bnm[1]);
                entries.push({ num: builtinCanon(bnm[1]), desc: toolDescBefore(line.slice(0, ni)) || toolDescAfter(line.slice(ni + bnm[1].length)) });
              }
            }
          }
          if (entries.length) {
            entries.forEach(function (e) {
              var tk = normTool(e.num);
              if (!tk) return;
              if (seen.tools[tk]) {
                // already have it — fill in a description if this sighting has one
                if (e.desc) results.tools.forEach(function (it) { if (it.num && normTool(it.num) === tk && !it.desc) { it.desc = e.desc; it.text = it.num + " — " + e.desc; } });
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
  // (the fluid lookup used to open a page on our website; since v0.3.13 the
  // data lives on this computer and the window is built locally — see the
  // FLUID CAPACITY TABLES block above)

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
  function toolKey(it) { return it.num ? "num::" + normTool(it.num) : "txt::" + (it.text || "").toLowerCase(); }

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
    ".hd img.brand{width:30px;height:30px;flex:none;object-fit:contain}" +
    ".hd b{font-size:14px;font-weight:600;flex:1}" +
    ".hd button{background:transparent;border:0;color:#cdd7ea;cursor:pointer;font-size:13px;padding:3px 6px;border-radius:6px}" +
    ".hd button:hover{background:rgba(255,255,255,.15);color:#fff}" +
    ".hd .hbtn{display:inline-flex;align-items:center;justify-content:center;padding:3px 5px}" +
    ".hd .hbtn svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}" +
    ".wrap.min{max-height:none}" +
    // minimized = header + SCAN only (so a tech can collapse the panel and still
    // scan a page). New Vehicle / everything else is hidden.
    ".wrap.min .sub,.wrap.min .topbar,.wrap.min .jobbar,.wrap.min .body,.wrap.min .ft,.wrap.min .updbar,.wrap.min .vbar,.wrap.min .fluidbar{display:none}" +
    ".wrap.min .scanbar{padding:11px 13px}" +
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
    ".fluidbtn.off{background:#f4f4f6;border-color:#e5e5ea;color:#8a8a8a;cursor:default;font-weight:600}" +
    ".fluidbtn.off:hover{background:#f4f4f6;border-color:#e5e5ea}" +
    ".fluidbtn.off svg{stroke:#a8a8ae}" +
    // "load the PDFs" state: grey like .off but CLICKABLE (opens Settings)
    ".fluidbtn.load{background:#f4f4f6;border-color:#e5e5ea;color:#5f6b80;cursor:pointer;font-weight:600}" +
    ".fluidbtn.load:hover{background:#ececf0;border-color:#c9c9d2}" +
    ".fluidbtn.load svg{stroke:#8a94a6}" +
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
    ".toast{position:absolute;bottom:54px;left:50%;transform:translateX(-50%);background:#1c1c1c;color:#fff;font-size:11px;padding:5px 10px;border-radius:6px;opacity:0;transition:opacity .2s;pointer-events:none;z-index:7}" +
    ".toast.on{opacity:1}" +
    // ⚙ settings + tool-list mapper overlays
    ".setc{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:rgba(0,8,30,.28);padding:14px}" +
    ".setbox{position:relative;background:#fff;border:1px solid #d4d4d4;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.3);padding:16px;width:440px;max-width:92vw;max-height:88vh;overflow:auto;text-align:left}" +
    ".setbox .xclose{position:absolute;top:9px;right:9px;width:30px;height:30px;padding:0;border-radius:8px;border:1px solid #cfd6e4;background:#fff;color:#3a4a63;font-size:16px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center}" +
    ".setbox .xclose:hover{background:#f3f6fb;color:#001e50}" +
    ".settl{font-size:14px;font-weight:700;color:#001e50;margin:0 0 4px;padding-right:26px}" +
    ".setsub{font-size:12px;color:#3a4a63;line-height:1.45;margin:0 0 12px}" +
    ".setsub b{color:#001e50}" +
    ".setstat{background:#edf7ee;border:1px solid #cce6cf;border-radius:8px;padding:9px 11px;font-size:12.5px;color:#1e6b34;line-height:1.4;margin-bottom:12px}" +
    ".setstat b{color:#13502a}" +
    ".setfile{margin-top:4px;font-weight:700;color:#13502a;word-break:break-all}" +
    ".setmeta{margin-top:2px;font-size:11.5px;color:#3f7a52}" +
    ".setstat.none{background:#eef1f6;border-color:#dfe4ee;color:#3a4a63}" +
    ".dbinfo{background:#f4f7fc;border:1px solid #dfe4ee;border-radius:8px;padding:4px 11px;margin-bottom:12px}" +
    ".dbrow{display:flex;justify-content:space-between;gap:12px;align-items:baseline;padding:6px 0;border-bottom:1px solid #e7ebf3;font-size:12.5px}" +
    ".dbrow:last-child{border-bottom:0}" +
    ".dbrow .k{color:#3a4a63}" +
    ".dbrow .v{font-weight:700;color:#001e50;text-align:right;word-break:break-word}" +
    ".dbrow .v.dbok{color:#1e7a3a}" +
    ".dbrow .v.dbwarn{color:#a35a00}" +
    ".dbrow .v.dbwait{color:#12508a}" +
    ".dbrow .v.dbnone{color:#7a7a7a}" +
    ".setdiv{border-top:1px solid #e3e6ee;margin:16px 0 12px}" +
    // fluid-PDF confirm rows (year + models found per picked file)
    ".flrow{background:#eef1f6;border:1px solid #dfe4ee;border-radius:8px;padding:8px 11px;font-size:12px;color:#3a4a63;line-height:1.4;margin-bottom:8px}" +
    ".flrow b{display:block;color:#001e50;font-size:12.5px}" +
    ".flrow span{display:block;margin-top:2px}" +
    ".flrow.bad{background:#fff5f5;border-color:#e6b0b0;color:#7a1f1f}" +
    ".flrow.bad b{color:#7a1f1f}" +
    ".setbtns{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:6px}" +
    ".setbtns button{appearance:none;-webkit-appearance:none;font-family:inherit;font-weight:600;font-size:12.5px;padding:8px 14px;border-radius:8px;cursor:pointer;border:1px solid #cfd6e4;background:#fff;color:#001e50}" +
    ".setbtns button:hover{background:#f3f6fb}" +
    ".setbtns .primary{background:#2fb84d;border-color:#2fb84d;color:#0a0a0a}" +
    ".setbtns .primary:hover{background:#28a344}" +
    ".setbtns .danger{border-color:#e6b0b0;color:#a32d2d}" +
    ".setbtns .danger:hover{background:#fff5f5}" +
    ".setnote{font-size:11px;color:#7a7a7a;line-height:1.4;margin:10px 0 0;border-top:1px solid #eee;padding-top:8px}" +
    ".maptbl{width:100%;border-collapse:collapse;margin:2px 0 4px;font-size:12px;table-layout:fixed}" +
    ".maptbl td{border:1px solid #e7e7e7;padding:4px 6px;color:#444;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
    ".maptbl th{padding:0 0 4px;vertical-align:top}" +
    ".mapsel{width:100%;font-family:inherit;font-weight:600;font-size:11.5px;padding:5px 4px;border:1px solid #cfd6e4;border-radius:6px;background:#fff;color:#001e50}" +
    ".maperr{color:#a32d2d;font-size:12px;font-weight:600;margin:6px 0 0}" +
    // per-tool location / status badges
    ".tbadge{display:inline-block;margin-left:6px;font-size:10px;font-weight:700;letter-spacing:.01em;padding:1px 7px;border-radius:8px;white-space:nowrap;text-transform:none}" +
    ".tbadge.warn{background:#fff4e6;color:#8a4708;border:1px solid #f0d4a6}" +
    ".tbadge.order{background:#fdecec;color:#a32d2d;border:1px solid #efbcbc}" +
    // "Find these tools" button (opens the printable locations pop-up)
    ".findtools{appearance:none;-webkit-appearance:none;display:inline-flex;align-items:center;gap:6px;background:#534ab7;color:#fff;border:0;font-family:inherit;font-weight:700;font-size:11.5px;letter-spacing:.02em;padding:7px 11px;border-radius:8px;cursor:pointer;margin:2px 0 8px}" +
    ".findtools:hover{background:#4640a0}" +
    ".findtools svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}" +
    ".findtools .arr{margin-left:1px;font-weight:700}" +
    ".gnone{font-size:11.5px;color:#7a7a7a;margin:2px 0 8px;line-height:1.4}" +
    // fast custom tooltip (native `title` has a ~1s delay we can't shorten). Positioned
    // by JS relative to the panel; shown after a short hover. See the [data-tip] wiring.
    ".tip{position:absolute;z-index:6;display:none;max-width:210px;background:#1c2530;color:#fff;font-size:11px;font-weight:600;line-height:1.35;padding:6px 9px;border-radius:7px;box-shadow:0 4px 14px rgba(0,0,0,.28);pointer-events:none;opacity:0;transition:opacity .1s ease}" +
    ".tip.on{opacity:1}";

  // the Hahns mascot (bust) — a base64 PNG injected at build time (__HAHNS_ICON__).
  // Embedded, not fetched, so the bookmarklet stays 100% self-contained / no network.
  var HAHNS_ICON = "__HAHNS_ICON__";
  var TRASH = "M4 7h16M10 11v6M14 11v6M5 7l1 13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-13M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3";
  var IMG_ICON = "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 10a1.3 1.3 0 1 1-2.6 0 1.3 1.3 0 0 1 2.6 0";
  var CHECK = "M20 6 9 17l-5-5";
  var GLASS = "M10 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12M20 20l-5.2-5.2";   // locate-on-page magnifier
  var CHEV_DOWN = "M6 9l6 6 6-6";   // expand the vehicle bar
  var CHEV_UP = "M6 15l6-6 6 6";    // collapse the vehicle bar
  var RESTART = "M20 11.5a8 8 0 1 1-2.3-5.6M20 4v5h-5";   // "New Vehicle" / start over
  var GEAR = "M19.14 12.94a7.5 7.5 0 0 0 0-1.88l2-1.56-2-3.46-2.39.96a7 7 0 0 0-1.62-.94L14.7 2.5h-4l-.43 2.56a7 7 0 0 0-1.62.94L6.26 5l-2 3.46 2 1.56a7.5 7.5 0 0 0 0 1.88l-2 1.56 2 3.46 2.39-.96c.5.38 1.04.7 1.62.94l.43 2.56h4l.43-2.56c.58-.24 1.12-.56 1.62-.94l2.39.96 2-3.46-2-1.56zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z";   // settings gear

  function svg(path, cls) {
    return '<svg viewBox="0 0 24 24" class="' + (cls || "") + '"><path d="' + path + '"/></svg>';
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  // the identity strip pinned under the header. When a vehicle is loaded it
  // shows the five fields (blanks flagged + editable); otherwise it stays empty
  // (the greyed Fluids & Capacities row already prompts to scan the Summary),
  // only surfacing a transient scan note if there is one.
  function vehicleBar(r) {
    var note = vehNotice
      ? '<div class="vwarn">' + esc(vehNotice) + "</div>"
      : "";
    if (!vehLoaded(r)) {
      return note ? '<div class="vbar empty">' + note + "</div>" : "";
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
    // no vehicle yet: keep the feature discoverable with a greyed, non-clickable
    // placeholder that tells the tech how to enable it (scan the Vehicle Summary).
    if (!vehLoaded(r)) {
      return '<div class="fluidbar"><div class="fluidbtn off" title="Scan ELSA’s Vehicle Summary page to enable">' +
        svg(DROPLET) + "Fluids &amp; capacities — scan Vehicle Summary to enable</div></div>";
    }
    var v = r.__vehicle || {};
    if (!v.year) return '<div class="fluidbar"><div class="fluidnote">Add the <b>Model Year</b> above to look up fluids &amp; capacities.</div></div>';
    // fluid tables load asynchronously from IndexedDB at startup — show a neutral
    // "loading" state until the projection is hydrated (a few ms), then re-render.
    if (!fluidsReady) return '<div class="fluidbar"><div class="fluidbtn off" title="Reading saved fluid tables…">' + svg(DROPLET) + "Fluids &amp; capacities — loading…</div></div>";
    // the data now lives on THIS computer (loaded once via ⚙ Settings from the
    // yearly VW Fluid Capacity Tables PDFs). No data for this year yet → point
    // the tech at Settings; otherwise open the locally-built lookup window.
    var st = loadFluids();
    if (!(st && st.years && st.years[v.year])) {
      return '<div class="fluidbar"><button class="fluidbtn load" data-act="settings" data-tip="Open Settings (⚙) and load the yearly VW Fluid Capacity Tables PDFs — kept only on this computer">' +
        svg(DROPLET) + (st ? "No " + esc(String(v.year)) + " fluid tables on this computer — add the PDF in Settings"
                           : "Fluids &amp; capacities — load the fluid PDFs in Settings") + "</button></div>";
    }
    return '<div class="fluidbar"><button class="fluidbtn" data-act="fluids">' +
      svg(DROPLET) + "Fluids &amp; capacities for this vehicle<span class=\"arr\">&#8599;</span></button></div>";
  }

  // a small ALERT badge shown after a tool in the Special Tools list (only a
  // PROBLEM is shown inline — missing/check or not-on-the-list — so the tech is
  // warned at a glance. The drawer LOCATIONS live in the "Find these tools"
  // window, to keep the main panel uncluttered.)
  function toolBadge(it) {
    if (!it || !it.num || !loadShopTools()) return "";
    var hit = matchShopTool(it.num);
    if (!hit) return ' <span class="tbadge order" data-tip="Not in your shop list — order the tool, or update your list">not in list</span>';
    if (hit.s) return ' <span class="tbadge warn">' + esc(hit.s) + "</span>";
    return "";
  }
  // the best description for a tool: the shop list's (curated) if we have it,
  // else the one parsed off the ELSA page during the scan.
  function toolDesc(it) {
    var hit = it && it.num ? matchShopTool(it.num) : null;
    return (hit && hit.desc) || (it && it.desc) || "";
  }

  // the self-contained "Find these tools" document, written into a new window
  // (like the fluids pop-up). Built locally — NO network — and styled to read +
  // print cleanly. The Print/Close buttons are hidden when printing.
  function buildToolsWindowHTML(r) {
    var when = new Date().toLocaleString();
    var veh = "";
    if (vehLoaded(r)) veh = [r.__vehicle.year, r.__vehicle.model].filter(function (x) { return x; }).join(" ");
    // one row per tool: tool number (left) + location (right) + a tick box. Sorted
    // by location so same-drawer tools sit together (still a one-trip grab list).
    var items = [], missing = [];
    (r.tools || []).forEach(function (it) {
      if (!it || !it.num) return;
      var hit = matchShopTool(it.num);
      var desc = (hit && hit.desc) || it.desc || "";
      if (!hit) { missing.push({ num: it.num, desc: desc }); return; }
      items.push({ num: it.num, desc: desc, loc: hit.d || "(no location)", flag: hit.s || "" });
    });
    items.sort(function (a, b) { var c = locSort(a.loc, b.loc); return c !== 0 ? c : String(a.num).localeCompare(String(b.num)); });
    var rows = "";
    items.forEach(function (it) {
      rows += '<label class="row"><input type="checkbox" class="cb">' +
        '<span class="tnum">' + esc(it.num) + (it.flag ? '<span class="flag">' + esc(it.flag) + "</span>" : "") + "</span>" +
        '<span class="tdesc">' + esc(it.desc) + "</span>" +
        '<span class="tloc">' + esc(it.loc) + "</span></label>";
    });
    var h = '<!doctype html><html><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      "<title>Find these tools" + (r.__title ? " — " + esc(r.__title) : "") + "</title>" +
      "<style>" + TOOLS_WIN_CSS + "</style></head><body>" +
      '<button id="hb_close" class="xclose" onclick="window.close()" title="Close" aria-label="Close">&#10005;</button>' +
      '<div class="bar"><button id="hb_print" onclick="window.print()">Print</button></div>' +
      "<h1>Find these tools</h1>" +
      '<div class="meta">' + (r.__title ? esc(r.__title) + " · " : "") + (veh ? esc(veh) + " · " : "") + "printed " + esc(when) + "</div>";
    if (!items.length && !missing.length) {
      h += '<p class="empty">No special tools to locate yet.</p>';
    } else {
      if (items.length) h += '<div class="thead"><span class="cbh"></span><span class="nh">Tool</span><span class="dh">Description</span><span class="lh">Location</span></div>' + rows;
      if (missing.length) h += '<div class="callout order"><b>Not in your list — order, or update your list</b>' +
        '<div class="ordnums">' + missing.map(function (n) { return esc(n.num) + (n.desc ? " — " + esc(n.desc) : ""); }).join("<br>") + "</div></div>";
    }
    h += '<div class="foot">From your shop tool list · H.A.H.N.S ' + esc(BUILD) + "</div></body></html>";
    return h;
  }

  // open (or reuse) the "Find these tools" window (shared openDocWindow —
  // written locally, buttons wired from the opener, false if pop-ups blocked)
  function openToolWindow(r) { return openDocWindow("hahns_tools", 640, 760, buildToolsWindowHTML(r)); }

  function buildHTML(r, embed) {
    var mini = !embed && isMin();
    // any collected info (specs/tools/warnings/diagrams)? drives the "Clear info"
    // button — which wipes the recorded data but keeps the loaded vehicle.
    var hasInfo = (r.__images || []).length > 0;
    SECTIONS.forEach(function (s) { if ((r[s.key] || []).length) hasInfo = true; });
    var html = "" +
      '<div class="wrap' + (embed ? " embed" : "") + (mini ? " min" : "") + '"><div class="hd"><img class="brand" src="' + HAHNS_ICON + '" alt="Hahns">' +
        '<b title="Hardware, Advisories, Highlights, &amp; Navigation Specialist">H.A.H.N.S</b>' +
        (embed ? "" : '<button data-act="settings" class="hbtn" title="Settings — shop tool list &amp; fluid tables">' + svg(GEAR) + "</button>") +
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
        : '<div class="hint">Open a repair procedure and click <b>SCAN</b> to collect its specs. Want <b>Fluids &amp; Capacities</b> too? Scan ELSA’s <b>Vehicle Summary</b> page first.</div>';
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
        return '<div class="item tool">' + find + '<span class="txt">' + t + toolBadge(it) + "</span>" + del + "</div>";
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
        // shop tool-list extras: a "Find these tools" button (opens a printable
        // pop-up with the drawer locations), or a nudge to load a list
        if (items.length) {
          if (loadShopTools()) {
            html += '<button class="findtools" data-act="findtools" data-tip="Open a printable list of where to find each tool">' +
              svg(s.icon) + "Find these tools" + '<span class="arr">&#8599;</span></button>';
          } else {
            html += '<div class="gnone">Tip: load your shop’s tool list (gear icon, top-right) to find tool drawer locations.</div>';
          }
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

  // styles for the standalone "Find these tools" window (screen + print). The
  // Print/Close button bar is hidden when printing so the sheet stays clean.
  var TOOLS_WIN_CSS =
    "*{box-sizing:border-box}" +
    "body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111;margin:0;padding:20px 22px 30px;font-size:14px;background:#fff}" +
    ".bar{display:flex;gap:8px;margin-bottom:14px}" +
    ".bar button{appearance:none;-webkit-appearance:none;font-family:inherit;font-weight:700;font-size:13px;padding:9px 18px;border-radius:8px;cursor:pointer;border:0;background:#2fb84d;color:#0a0a0a}" +
    ".bar button:hover{background:#28a344}" +
    ".bar button.sec{background:#fff;border:1px solid #cfd6e4;color:#001e50;font-weight:600}" +
    ".bar button.sec:hover{background:#f3f6fb}" +
    ".xclose{position:fixed;top:10px;right:12px;width:34px;height:34px;padding:0;border-radius:8px;border:1px solid #cfd6e4;background:#fff;color:#333;font-size:19px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:20}" +
    ".xclose:hover{background:#f3f6fb;color:#000}" +
    "h1{font-size:21px;margin:0 0 3px;color:#1b232b}" +
    ".meta{color:#555;font-size:12px;margin-bottom:14px;border-bottom:2px solid #2fb84d;padding-bottom:10px}" +
    // tick-off list: [box] Tool#  ........  Location
    ".thead{display:flex;align-items:center;gap:12px;font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:#5a6b8c;border-bottom:1px solid #ccc;padding:0 4px 6px}" +
    ".thead .cbh{width:20px;flex:none}" +
    ".thead .nh{width:24%;flex:none}" +
    ".thead .dh{flex:1}" +
    ".thead .lh{width:24%;flex:none}" +
    ".row{display:flex;align-items:center;gap:12px;padding:9px 4px;border-bottom:1px solid #eee;cursor:pointer}" +
    ".row .cb{width:18px;height:18px;flex:none;margin:0;cursor:pointer}" +
    ".row .tnum{width:24%;flex:none;font-weight:700;color:#1b232b;font-size:15px;word-break:break-word}" +
    ".row .tdesc{flex:1;color:#444;font-size:13px}" +
    ".row .tloc{width:24%;flex:none;color:#333}" +
    ".row .flag{display:inline-block;margin-left:8px;font-size:10px;font-weight:700;color:#8a4708;background:#fff4e6;border:1px solid #f0d4a6;border-radius:7px;padding:1px 6px;vertical-align:middle;text-transform:none;letter-spacing:0}" +
    ".row input:checked~.tnum,.row input:checked~.tdesc,.row input:checked~.tloc{text-decoration:line-through;color:#aaa}" +
    ".row input:checked~.tnum .flag{opacity:.45}" +
    ".callout{border-radius:8px;padding:10px 14px;margin:14px 0 12px;font-size:13px;line-height:1.5}" +
    ".callout b{display:block;margin-bottom:4px}" +
    ".callout .ordnums{font-weight:600}" +
    ".callout.order{background:#fdecec;border:1px solid #efbcbc;color:#a32d2d}" +
    ".empty{color:#888;font-style:italic}" +
    ".foot{margin-top:20px;color:#999;font-size:11px;border-top:1px solid #eee;padding-top:8px}" +
    "@media print{.bar{display:none}.xclose{display:none}body{padding:0}.meta{border-bottom-color:#999}.row{cursor:default;page-break-inside:avoid}}";

  // styles for the standalone Fluids & Capacities window (same bones as the
  // tools window; the four system cards keep the old lookup page's colours)
  var FLUIDS_WIN_CSS =
    "*{box-sizing:border-box}" +
    "body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1c1c1c;margin:0;padding:20px 22px 30px;font-size:14px;background:#eef1f6;max-width:640px}" +
    ".bar{display:flex;gap:8px;margin-bottom:14px}" +
    ".bar button{appearance:none;-webkit-appearance:none;font-family:inherit;font-weight:700;font-size:13px;padding:9px 18px;border-radius:8px;cursor:pointer;border:0;background:#2fb84d;color:#0a0a0a}" +
    ".bar button:hover{background:#28a344}" +
    ".bar button.sec{background:#fff;border:1px solid #cfd6e4;color:#001e50;font-weight:600}" +
    ".bar button.sec:hover{background:#f3f6fb}" +
    ".xclose{position:fixed;top:10px;right:12px;width:34px;height:34px;padding:0;border-radius:8px;border:1px solid #cfd6e4;background:#fff;color:#333;font-size:19px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:20}" +
    ".xclose:hover{background:#f3f6fb;color:#000}" +
    "h1{font-size:21px;margin:0 0 3px;color:#1b232b}" +
    ".meta{color:#555;font-size:12px;margin-bottom:14px;border-bottom:2px solid #2fb84d;padding-bottom:10px}" +
    ".veh{background:#fff;border:1px solid #e3e3e3;border-radius:12px;padding:12px 14px;margin:14px 0}" +
    ".veh .t{font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#5a6b8c;margin-bottom:7px}" +
    ".veh .grid{display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:13px}" +
    ".veh .k{color:#5a6b8c;font-weight:600;white-space:nowrap}" +
    ".veh .v{font-weight:700;color:#001e50;word-break:break-word}" +
    ".card{background:#fff;border:1px solid #e3e3e3;border-radius:12px;margin:12px 0;overflow:hidden}" +
    ".chd{display:flex;align-items:center;gap:9px;padding:12px 14px;border-left:5px solid #5a6b8c}" +
    ".chd svg{width:19px;height:19px;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}" +
    ".chd b{font-size:14px;font-weight:700}" +
    ".card.oil .chd{border-left-color:#b8860b}.card.oil .chd svg{stroke:#b8860b}" +
    ".card.cool .chd{border-left-color:#0f6e9c}.card.cool .chd svg{stroke:#0f6e9c}" +
    ".card.ac .chd{border-left-color:#0f6e56}.card.ac .chd svg{stroke:#0f6e56}" +
    ".card.drive .chd{border-left-color:#534ab7}.card.drive .chd svg{stroke:#534ab7}" +
    ".cbody{padding:2px 14px 12px}" +
    ".row{padding:9px 0;border-top:1px solid #f0f0f0}" +
    ".row:first-child{border-top:0}" +
    ".lab{font-size:12px;color:#5a6b8c;font-weight:600}" +
    ".lab.note{margin-top:6px;display:block}" +
    ".cap{font-size:17px;font-weight:700;color:#1c1c1c;margin:2px 0}" +
    ".spec{font-size:12.5px;color:#3a4a63}" +
    ".tag{display:inline-block;font-size:10.5px;font-weight:700;letter-spacing:.03em;padding:1px 7px;border-radius:20px;background:#eef1f6;color:#001e50;margin-left:6px;vertical-align:1px}" +
    ".fill{display:inline-block;margin-right:14px}" +
    ".fill b{font-weight:700}" +
    ".none{font-size:13px;color:#9a9a9a;font-style:italic;padding:8px 0}" +
    ".err{background:#fff5f5;border:1px solid #e6b0b0;color:#7a1f1f;border-radius:10px;padding:13px 14px;font-size:13.5px;margin:16px 0;line-height:1.45}" +
    ".foot{font-size:11px;color:#5a6b8c;text-align:center;margin-top:18px;line-height:1.5}" +
    "@media print{.bar{display:none}.xclose{display:none}body{padding:0;background:#fff}.card{page-break-inside:avoid}}";

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
        // quick chip row of numbers, then a list of tool number + description
        // (shop-list description preferred, else what the scan parsed).
        var nums = toolNums(r);
        if (nums.length) p.push('<div class="chips">' + nums.map(function (t) { return '<span class="chip">' + esc(t) + "</span>"; }).join("") + "</div>");
        p.push("<ul>" + (r.tools || []).map(function (it) {
          if (!it.num) return "<li>" + esc(it.text) + "</li>";
          var d = toolDesc(it);
          return "<li><b>" + esc(it.num) + "</b>" + (d ? " — " + esc(d) : "") + "</li>";
        }).join("") + "</ul>");
      } else if (multiSrc) {
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
    var toolsLine;
    try {
      var stt = loadShopTools();
      var toolsBackend = (appIdbOk && appDB) ? "IndexedDB" : "localStorage(fallback)";
      toolsLine = (stt ? ("loaded " + (stt.count || 0) + " tools from " + (stt.file || "?") + " (" + (stt.fmt || "?") + "), uploaded " + (stt.updated || "?")) : "none loaded") + " [" + toolsBackend + "]";
    } catch (e) { toolsLine = "(unreadable)"; }
    var fluidsLine;
    try {
      var flt = loadFluids();
      var flys = flt && flt.years ? Object.keys(flt.years).sort() : [];
      var errs = fluidsMetaList.filter(function (m) { return m && m.status === "reparse-error"; }).map(function (m) { return m.year; });
      fluidsLine = (appIdbOk ? "IndexedDB" : "localStorage(fallback)") +
        " · parsers modern " + MODERN_PARSER_VER + " / legacy " + LEGACY_PARSER_VER +
        " · " + (flys.length ? flys.length + " years (" + flys.join(", ") + ")" : "none loaded") +
        " · last bg update " + fmtWhen(fluidsBgUpdate) +
        (errs.length ? " · re-parse errors: " + errs.join(", ") : "");
    } catch (e) { fluidsLine = "(unreadable)"; }
    var veh = {}, isSum = false;
    try { veh = extractVehicle(lastSegments) || {}; } catch (e) {}
    try { isSum = isVehicleSummaryPage(lastSegments); } catch (e) {}
    var vehLine = VEH_FIELDS.map(function (f) { return f.label + "=" + (veh[f.k] || "(none)"); }).join(" · ");
    return "H.A.H.N.S diagnostic — version " + BUILD + "\n" +
      "update reminder — last acknowledged week: " + remindSeen + " · this week: " + wedMarker(Date.now()) + "\n" +
      "shop tool list: " + toolsLine + "\n" +
      "fluid tables (this computer): " + fluidsLine + "\n" +
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


  // small transient toast in the panel (used by the settings flows). Re-renders
  // replace root.innerHTML but keep the same shadow root, so this finds the live .toast.
  function flash(root, msg) {
    var t = root.querySelector(".toast");
    if (t) { t.textContent = msg; t.classList.add("on"); setTimeout(function () { t.classList.remove("on"); }, 1600); }
  }

  // pick a CSV off this computer and open the column-mapper. Reading the file is a
  // LOCAL FileReader read — NO network — so the ELSA zero-network rule is intact.
  function pickToolFile(host, r, options, root) {
    var inp = document.createElement("input");
    inp.type = "file";
    inp.accept = ".csv,text/csv,text/plain,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    inp.style.display = "none";
    inp.addEventListener("change", function () {
      var f = inp.files && inp.files[0];
      try { inp.remove(); } catch (e) {}
      if (!f) return;
      // modern Excel (.xlsx) → convert to rows in the browser (local, no network)
      if (/\.xlsx$/i.test(f.name)) {
        if (typeof DecompressionStream === "undefined") { flash(root, "This browser can’t read .xlsx — save it as CSV first"); return; }
        var fx = new FileReader();
        fx.onload = function () {
          xlsxToRows(fx.result).then(function (rows) {
            if (!rows || !rows.length) { flash(root, "That .xlsx looked empty — is the list on the first sheet?"); return; }
            openToolMapper(host, r, options, root, rows, { name: f.name, fmt: "xlsx" });
          }).catch(function () { flash(root, "Couldn’t read that .xlsx — try saving it as CSV"); });
        };
        fx.onerror = function () { flash(root, "Could not read that file"); };
        try { fx.readAsArrayBuffer(f); } catch (e) { flash(root, "Could not read that file"); }
        return;
      }
      // old .xls (binary) / Apple Numbers → different formats we can't parse
      if (/\.(xls|numbers)$/i.test(f.name)) { flash(root, "Save the spreadsheet as CSV (or .xlsx) first, then upload"); return; }
      var fr = new FileReader();
      fr.onload = function () {
        var rows;
        try { rows = parseCSV(String(fr.result || "")); }
        catch (e) { flash(root, "Could not read that file"); return; }
        openToolMapper(host, r, options, root, rows, { name: f.name, fmt: "csv" });
      };
      fr.onerror = function () { flash(root, "Could not read that file"); };
      try { fr.readAsText(f); } catch (e) { flash(root, "Could not read that file"); }
    });
    (root.querySelector(".wrap") || root).appendChild(inp);
    inp.click();
  }

  // the ⚙ settings panel — manage the shop tool list (upload / replace / remove)
  function openSettings(host, r, options, root) {
    var st = loadShopTools();
    var ov = document.createElement("div");
    ov.className = "setc";
    var fmtLabel = st ? (st.fmt === "xlsx" ? "Excel (.xlsx)" : st.fmt === "csv" ? "CSV" : "") : "";
    var meta = st ? [fmtLabel, st.updated ? "uploaded " + st.updated : ""].filter(function (x) { return x; }).join(" · ") : "";
    var status = st
      ? '<div class="setstat">Tool list loaded: <b>' + esc(String(st.count || 0)) + "</b> tools" +
          (st.file ? '<div class="setfile">' + esc(st.file) + "</div>" : "") +
          (meta ? '<div class="setmeta">' + esc(meta) + "</div>" : "") + "</div>"
      : '<div class="setstat none">No tool list loaded yet. Upload your shop’s list to see drawer locations next to each special tool.</div>';
    // ---- fluid capacity tables status (v0.3.13) ----
    var fl = loadFluids();
    var flYears = fl && fl.years ? Object.keys(fl.years).sort() : [];
    var flStatus = flYears.length
      ? '<div class="setstat">Fluid tables loaded: <b>' + esc(String(flYears.length)) + "</b> year" + (flYears.length > 1 ? "s" : "") +
          '<div class="setfile">' + esc(flYears.join(", ")) + "</div>" +
          (fl.updated ? '<div class="setmeta">updated ' + esc(fl.updated) + "</div>" : "") + "</div>"
      : '<div class="setstat none">No fluid tables loaded yet. Load the yearly “VW Fluid Capacity Tables” PDFs (you can pick several at once) to enable the Fluids &amp; Capacities lookup.</div>';
    ov.innerHTML = '<div class="setbox">' +
      '<button class="xclose" title="Close" aria-label="Close">&#10005;</button>' +
      '<p class="settl">Shop special-tool list</p>' +
      '<p class="setsub">Upload your shop’s tool list (a CSV or Excel <b>.xlsx</b> file). Hahns shows each special tool’s drawer location and flags tools that aren’t on the list.</p>' +
      status +
      '<div class="setbtns">' +
        (st ? '<button class="danger remove">Remove list</button>' : "") +
        '<button class="primary upload">' + (st ? "Replace list" : "Upload list") + "</button>" +
      "</div>" +
      '<div class="setdiv"></div>' +
      '<p class="settl">Fluid capacity tables</p>' +
      '<p class="setsub">Load the yearly <b>VW Fluid Capacity Tables</b> PDFs. Hahns converts them on this computer — kept only in this browser, never uploaded — and shows the values matched to the loaded vehicle.</p>' +
      flStatus +
      '<div class="setbtns">' +
        (flYears.length ? '<button class="danger flremove">Remove tables</button>' : "") +
        '<button class="primary flupload">' + (flYears.length ? "Add / replace PDFs" : "Load PDFs") + "</button>" +
      "</div>" +
      '<div class="setdiv"></div>' +
      '<p class="settl">Fluid database</p>' +
      '<p class="setsub">The parsed tables and their source PDFs live in this browser’s database. When the parser is improved, saved PDFs are re-read automatically — no re-upload needed.</p>' +
      fluidsInfoHTML() +
      '<p class="setnote">Everything here is saved only on this computer (under ELSA) — never uploaded anywhere or sent to GitHub.</p>' +
      "</div>";
    root.appendChild(ov);
    var close = function () { try { ov.remove(); } catch (e) {} };
    ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
    ov.querySelector(".xclose").addEventListener("click", close);
    var up = ov.querySelector(".upload");
    if (up) up.addEventListener("click", function () { close(); pickToolFile(host, r, options, root); });
    var rm = ov.querySelector(".remove");
    if (rm) rm.addEventListener("click", function () {
      removeShopTools(); close();
      renderInto(host, r, options);
      flash(root, "Tool list removed");
    });
    var flup = ov.querySelector(".flupload");
    if (flup) flup.addEventListener("click", function () { close(); pickFluidFiles(host, r, options, root); });
    var flrm = ov.querySelector(".flremove");
    if (flrm) flrm.addEventListener("click", function () {
      removeFluids(); close();
      renderInto(host, r, options);
      flash(root, "Fluid tables removed");
    });
  }

  // the column-mapper overlay — the tech tags which CSV column is which. Honors
  // any layout (3-col shop sheet, 4-col VW minimum index, …). Picking one role
  // removes it from the other dropdowns; the last column auto-fills.
  function openToolMapper(host, r, options, root, rows, meta) {
    meta = meta || {};
    rows = (rows || []).filter(function (row) {
      return row && row.some(function (c) { return String(c == null ? "" : c).trim() !== ""; });
    });
    if (!rows.length) { flash(root, "That file looks empty"); return; }

    var headerIdx = findToolHeader(rows);
    var dataStart = headerIdx >= 0 ? headerIdx + 1 : 0;
    var headerRow = headerIdx >= 0 ? rows[headerIdx] : null;

    function effLen(row) { var n = row.length; while (n > 0 && String(row[n - 1] == null ? "" : row[n - 1]).trim() === "") n--; return n; }
    var ncol = headerRow ? effLen(headerRow) : 0, i, c;
    for (i = dataStart; i < Math.min(rows.length, dataStart + 8); i++) ncol = Math.max(ncol, effLen(rows[i]));
    if (ncol < 2) { for (i = 0; i < Math.min(rows.length, 8); i++) ncol = Math.max(ncol, (rows[i] || []).length); }
    if (ncol < 1) ncol = 1;

    // up to 3 sample data rows, per column, for the preview
    var samples = []; for (c = 0; c < ncol; c++) samples[c] = [];
    var taken = 0;
    for (i = dataStart; i < rows.length && taken < 3; i++) {
      if (effLen(rows[i]) < 2) continue;
      for (c = 0; c < ncol; c++) samples[c].push(String(rows[i][c] == null ? "" : rows[i][c]));
      taken++;
    }

    // guess each column's role from its header; content-guess the tool-number
    // column if no header named one, then assign a remaining column to drawer
    var roleOf = [];
    for (c = 0; c < ncol; c++) roleOf[c] = guessToolRole(headerRow ? headerRow[c] : "");
    function hasRole(rr) { for (var k = 0; k < ncol; k++) if (roleOf[k] === rr) return true; return false; }
    if (!hasRole("num")) {
      var best = -1, bestScore = -1;
      for (c = 0; c < ncol; c++) {
        if (roleOf[c]) continue;
        var sc = 0;
        samples[c].forEach(function (v) { if (/\d/.test(v) && /^[A-Za-z0-9][A-Za-z0-9\/\.\- ]*$/.test(v) && v.length <= 18) sc++; });
        if (sc > bestScore) { bestScore = sc; best = c; }
      }
      if (best >= 0) roleOf[best] = "num";
    }
    if (!hasRole("drawer")) { for (c = 0; c < ncol; c++) if (!roleOf[c]) { roleOf[c] = "drawer"; break; } }

    var ROLES = [["", "— choose —"], ["num", "Tool number"], ["desc", "Description"], ["drawer", "Drawer location"], ["ignore", "Not used"]];
    function selHTML(col) {
      var o = "";
      ROLES.forEach(function (rr) { o += '<option value="' + rr[0] + '"' + (roleOf[col] === rr[0] ? " selected" : "") + ">" + rr[1] + "</option>"; });
      return '<select class="mapsel" data-col="' + col + '">' + o + "</select>";
    }
    var head = "", body = "", k;
    for (c = 0; c < ncol; c++) head += "<th>" + selHTML(c) + "</th>";
    for (k = 0; k < (samples[0] ? samples[0].length : 0); k++) {
      body += "<tr>";
      for (c = 0; c < ncol; c++) body += "<td>" + esc(samples[c][k] || "") + "</td>";
      body += "</tr>";
    }

    var ov = document.createElement("div");
    ov.className = "setc";
    ov.innerHTML = '<div class="setbox">' +
      '<button class="xclose" title="Close" aria-label="Close">&#10005;</button>' +
      '<p class="settl">Set up your tool list</p>' +
      '<p class="setsub">Pick which column is which. <b>Description</b> is only read to flag tools marked “missing” or “check part number” — it’s never shown on its own.</p>' +
      '<table class="maptbl"><tr>' + head + "</tr>" + body + "</table>" +
      '<div class="maperr" style="display:none"></div>' +
      '<div class="setbtns"><button class="cancel">Cancel</button><button class="primary save">Save list</button></div>' +
      '<p class="setnote">Saved only on this computer (under ELSA) — never uploaded anywhere.</p>' +
      "</div>";
    root.appendChild(ov);

    var selects = Array.prototype.slice.call(ov.querySelectorAll(".mapsel"));
    var err = ov.querySelector(".maperr");
    function refresh() {
      var chosen = {};
      selects.forEach(function (sel) { var v = sel.value; if (v && v !== "ignore") chosen[v] = sel; });
      selects.forEach(function (sel) {
        Array.prototype.forEach.call(sel.options, function (opt) {
          if (!opt.value || opt.value === "ignore") { opt.disabled = false; return; }
          opt.disabled = !!(chosen[opt.value] && chosen[opt.value] !== sel);
        });
      });
      var roles = ["num", "desc", "drawer"];
      var unfilled = roles.filter(function (rr) { return !chosen[rr]; });
      var blanks = selects.filter(function (sel) { return sel.value === ""; });
      if (blanks.length === 1 && unfilled.length === 1) { blanks[0].value = unfilled[0]; refresh(); }
    }
    selects.forEach(function (sel) { sel.addEventListener("change", refresh); });
    refresh();

    var close = function () { try { ov.remove(); } catch (e) {} };
    ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
    ov.querySelector(".cancel").addEventListener("click", close);
    ov.querySelector(".xclose").addEventListener("click", close);
    ov.querySelector(".save").addEventListener("click", function () {
      var cols = { num: -1, desc: -1, drawer: -1 };
      selects.forEach(function (sel) { if (sel.value && sel.value !== "ignore") cols[sel.value] = +sel.getAttribute("data-col"); });
      if (cols.num < 0 || cols.drawer < 0) {
        err.textContent = "Please choose which column is the Tool number and which is the Drawer location.";
        err.style.display = "block"; return;
      }
      var built = buildToolMap(rows, dataStart, cols);
      if (!built.count) {
        err.textContent = "No tools found in that column — double-check the Tool number selection.";
        err.style.display = "block"; return;
      }
      if (meta.name) built.file = meta.name;   // remember what was uploaded
      if (meta.fmt) built.fmt = meta.fmt;
      // saveShopTools updates the sync cache immediately then persists to IDB
      // (async). Render right away off the cache; report a genuine write failure.
      saveShopTools(built).then(function (ok) {
        if (!ok) {
          err.textContent = "Couldn’t save (storage blocked on this machine).";
          err.style.display = "block"; return;
        }
        close();
        renderInto(host, r, options);
        flash(root, built.count + " tools loaded");
      });
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
    // Keep any open modal (Settings, tool mapper, fluids confirm, exit confirm)
    // ALIVE across this rebuild. A background re-render — e.g. the vehicle-bar
    // auto-collapse timer firing 3 s after a scan — otherwise wipes root.innerHTML
    // and would close a pop-up the tech is in the middle of using. These nodes keep
    // their own event listeners, so re-appending the same elements is enough.
    var keepModals = Array.prototype.slice.call(root.querySelectorAll(".setc, .exitc"));
    root.innerHTML = "<style>" + CSS + "</style>" + buildHTML(r, options.embed);
    keepModals.forEach(function (m) { try { root.appendChild(m); } catch (eKM) {} });
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
          // the lookup window is BUILT LOCALLY from the data stored on this
          // computer (no network) — small, centered, reused on a second click
          if (e && e.preventDefault) e.preventDefault();
          if (!openFluidsWindow(r)) flash(root, "Allow pop-ups to open the fluids lookup");
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
        } else if (act === "settings") {
          openSettings(host, r, options, root);
        } else if (act === "findtools") {
          if (e && e.preventDefault) e.preventDefault();
          if (!openToolWindow(r)) flash(root, "Allow pop-ups to open the tool list");
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

    var opts = { onRescan: scan, onNewJob: newJob, persist: true };
    var show = function (job) {
      saveJob(job);
      renderInto(host, job, opts);
    };
    // one Scan button, auto-detected:
    //  - scanning ELSA's Vehicle Summary page loads the vehicle (needed ONLY for
    //    the Fluids & Capacities lookup). It has no procedure specs, so we load +
    //    return.
    //  - scanning any other page ADDS its specs to the job — a vehicle is NOT
    //    required, so a repair page can be scanned straight away.
    function scan() {
      var job = loadJob() || emptyResults();
      var segs = gatherSegments(document);
      lastSegments = segs;   // keep the diagnostic dump in sync

      // opportunistically load the vehicle from the Vehicle Summary page. A VIN in
      // ELSA's header is NOT enough — only the real summary page, so a repair page
      // can't seed a wrong/partial vehicle. Only do this until one is loaded.
      if (!vehLoaded(job) && isVehicleSummaryPage(segs)) {
        var veh = extractVehicle(segs);
        if (veh && veh.vin) {
          job.__vehicle = veh;   // accept + flag any blank fields in the bar
          vehNotice = "Vehicle loaded — Fluids & Capacities is now available.";
        } else {
          vehNotice = "Read the Vehicle Summary but couldn’t find a VIN — click SCAN again.";
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
    // bring up the fluid store (IndexedDB): hydrate the sync projection, then
    // repaint so the fluids bar reflects saved tables; also kicks off the
    // background parser-version reconcile / auto re-parse. Async & non-blocking.
    fluidsRerender = function () { try { renderInto(host, loadJob() || emptyResults(), opts); } catch (e) {} };
    fluidsBoot(fluidsRerender);
  }

  window.VWJB = { run: run, extract: extract, extractSegments: extractSegments,
    gatherSegments: gatherSegments, renderInto: renderInto, plainText: plainText,
    emptyResults: emptyResults, mergeInto: mergeInto, loadJob: loadJob,
    saveJob: saveJob, clearJob: clearJob, extractVehicle: extractVehicle,
    isVehicleSummaryPage: isVehicleSummaryPage,
    // fluid-table pipeline, exposed so new-year PDFs can be sanity-checked
    // from a dev harness (PDF bytes → layout text → parsed models)
    fluidsFromPdf: fluidsFromPdf, pdfTextLines: pdfTextLines, parseFluidModels: parseFluidModels,
    // fluid-store internals, exposed for dev harnesses (IndexedDB layer)
    fluidsBoot: fluidsBoot, loadFluids: loadFluids, fluidsSaveYears: fluidsSaveYears,
    reparseYear: reparseYear, fluidsInfoHTML: fluidsInfoHTML,
    // shop tool-list store (IndexedDB v0.3.16), exposed for dev harnesses
    loadShopTools: loadShopTools, saveShopTools: saveShopTools, removeShopTools: removeShopTools };
})();
