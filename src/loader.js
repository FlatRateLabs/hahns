/*
 * loader.js — the tiny self-updating bookmarklet (build.js turns this into
 * docs/loader.txt). It is the ONLY thing the tech drags; it should almost never
 * need to change, so they almost never re-drag again.
 *
 * How it works on ELSA (proven possible 2026-07-08; see CLAUDE.md / memory):
 *   1. Inject the last cached copy of the app instantly  -> works offline, no wait.
 *   2. At most once a day, open the GitHub Pages update window. If a newer version
 *      exists it ASKS the tech (Update now / Not now) and only hands the code back
 *      if they accept; we cache it and apply it right away.
 *   3. First run on a machine (no cache): the window installs the app silently.
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
  var DAY = 86400000;
  var LS_CODE = "hahns_code", LS_VER = "hahns_ver", LS_TS = "hahns_upd_ts";

  function inject(src) {
    try {
      var s = document.createElement("script");
      s.textContent = src;
      (document.head || document.documentElement).appendChild(s);
      s.remove();
    } catch (e) { /* ignore */ }
  }

  var code = null, ver = "";
  try { code = localStorage.getItem(LS_CODE); } catch (e) { }
  try { ver = localStorage.getItem(LS_VER) || ""; } catch (e) { }

  // 1) run the cached app right now (instant, works with no network)
  if (code) inject(code);

  // 2) throttle the background update check to once a day (unless we have no app yet)
  var last = 0;
  try { last = +localStorage.getItem(LS_TS) || 0; } catch (e) { }
  if (code && (Date.now() - last) < DAY) return;

  // 3) open the update window; it will postMessage the newest code back
  try {
    window.addEventListener("message", function (e) {
      if (e.origin !== ORIGIN) return;                       // only trust our Pages origin
      var d = e.data;
      if (!d || d.source !== "hahns-updater") return;
      if (d.upToDate || d.dismissed) {                       // current, or the tech chose "Not now"
        try { localStorage.setItem(LS_TS, String(Date.now())); } catch (_) { }
        return;                                              // don't check again until the next day
      }
      if (typeof d.code !== "string") return;
      try {
        localStorage.setItem(LS_CODE, d.code);
        localStorage.setItem(LS_VER, d.version || "");
        localStorage.setItem(LS_TS, String(Date.now()));
      } catch (_) { }
      inject(d.code);   // install (first run) or apply an accepted update now; run() replaces any open panel
    }, false);

    // pass the version we already have so the window can skip the big download when current
    var w = window.open(
      BASE + "/update.html?v=" + encodeURIComponent(ver) + "&cb=" + Date.now(),
      "hahns_upd", "popup=1,width=400,height=280");
    if (!w && !code) {
      alert("Hahns: allow pop-ups for this site once so it can install, then click the bookmark again.");
    }
  } catch (e) { /* offline / blocked: the cached app (if any) already ran */ }
})();
