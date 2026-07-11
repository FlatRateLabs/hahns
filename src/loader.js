/*
 * loader.js — the tiny self-updating bookmarklet (build.js turns this into
 * docs/loader.txt). It is the ONLY thing the tech drags; it should almost never
 * need to change, so they almost never re-drag again.
 *
 * How it works on ELSA (proven possible 2026-07-08; see CLAUDE.md / memory):
 *   1. Inject the last cached copy of the app instantly  -> works offline, no wait.
 *   2. On the FIRST bookmark click of each calendar day, open the GitHub Pages
 *      update window. If a newer version exists it ASKS the tech (Update now /
 *      Not now) and only hands the code back if they accept; we cache it and apply
 *      it right away. (So arriving at work and clicking Hahns always checks if you
 *      haven't been on since the day before.)
 *   3. First run on a machine (no cache): the window installs the app silently.
 *   4. Manual check: the app's Settings "Check for updates" button calls
 *      window.hahnsCheckForUpdate(), which forces the same window open NOW,
 *      ignoring the once-a-day throttle.
 *
 * The app code is delivered via popup + postMessage + inline-<script> injection
 * because ELSA's CSP blocks fetch()/external <script>/iframe to our domain but
 * allows 'unsafe-inline'. Only messages from __PAGES_ORIGIN__ are trusted.
 *
 * Privacy: the update window only pulls Hahns's OWN code in; it never reads or
 * sends any ELSA/manual content. Nothing licensed leaves the browser.
 */
(function () {
  var BASE = "__PAGES_BASE__";        // e.g. https://flatratelabs.github.io/hahns
  var ORIGIN = "__PAGES_ORIGIN__";    // e.g. https://flatratelabs.github.io  (trusted sender)
  var LOADER_VER = __LOADER_VER__;    // loader generation (build.js) — the update popup
                                      // compares this to version.json's `loader` to
                                      // tell whether THIS bookmark needs a re-drag.
  var LS_CODE = "hahns_code", LS_VER = "hahns_ver", LS_TS = "hahns_upd_ts", LS_DAY = "hahns_upd_day";

  // local calendar day "YYYY-MM-DD" (local, not UTC, so the day rolls at the
  // tech's midnight — the auto-check fires on the first click of a new day).
  function today() {
    var d = new Date(), p = function (n) { return (n < 10 ? "0" : "") + n; };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }

  function inject(src) {
    try {
      var s = document.createElement("script");
      s.textContent = src;
      (document.head || document.documentElement).appendChild(s);
      s.remove();
    } catch (e) { /* ignore */ }
  }

  // Listen for the update window's reply. Registered at most once per page so a
  // repeat bookmark click (or a manual check) never stacks duplicate handlers.
  // Only messages from our Pages origin are trusted.
  function listen() {
    if (window.__hahnsListening) return;
    window.__hahnsListening = true;
    window.addEventListener("message", function (e) {
      if (e.origin !== ORIGIN) return;                       // only trust our Pages origin
      var d = e.data;
      if (!d || d.source !== "hahns-updater") return;
      if (d.upToDate || d.dismissed) {                       // current, or the tech chose "Not now"
        try { localStorage.setItem(LS_TS, String(Date.now())); localStorage.setItem(LS_DAY, today()); } catch (_) { }
        return;                                              // don't auto-check again until the next day
      }
      if (typeof d.code !== "string") return;
      try {
        localStorage.setItem(LS_CODE, d.code);
        localStorage.setItem(LS_VER, d.version || "");
        localStorage.setItem(LS_TS, String(Date.now()));
        localStorage.setItem(LS_DAY, today());
      } catch (_) { }
      inject(d.code);   // install (first run) or apply an accepted update now; run() replaces any open panel
    }, false);
  }

  // Open the GitHub Pages update window; it postMessages the newest code back.
  // force=true is a manual check (Settings button): it bypasses the once-a-day
  // throttle and tells the window to confirm even when already up to date.
  function openUpdate(force) {
    var ver = "";
    try { ver = localStorage.getItem(LS_VER) || ""; } catch (e) { }
    try {
      listen();
      var w = window.open(
        BASE + "/update.html?v=" + encodeURIComponent(ver) +
          "&lv=" + LOADER_VER + (force ? "&force=1" : "") + "&cb=" + Date.now(),
        "hahns_upd", "popup=1,width=400,height=280");
      if (!w) {
        var haveCode = false;
        try { haveCode = !!localStorage.getItem(LS_CODE); } catch (_) { }
        // only nag about pop-ups when it actually matters: a first install, or a
        // deliberate manual check. A blocked *background* check stays silent.
        if (force || !haveCode) {
          alert("Hahns: allow pop-ups for this site once so it can check for updates, then try again.");
        }
        return false;
      }
      return true;
    } catch (e) { return false; }
  }

  // Manual "check now" hook for the app's Settings button. Present only when the
  // app was delivered by this loader; the classic self-contained bookmarklet has
  // no loader, so the app falls back to opening the setup page instead.
  try { window.hahnsCheckForUpdate = function () { return openUpdate(true); }; } catch (e) { }

  var code = null;
  try { code = localStorage.getItem(LS_CODE); } catch (e) { }

  // 1) run the cached app right now (instant, works with no network)
  if (code) inject(code);

  // 2) automatic check once per calendar day: skip only if we already have the app
  //    AND we already checked today. (First click of a new day always checks.)
  var lastDay = "";
  try { lastDay = localStorage.getItem(LS_DAY) || ""; } catch (e) { }
  if (code && lastDay === today()) return;

  // 3) automatic background check
  openUpdate(false);
})();
