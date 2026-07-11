// H.A.H.N.S feedback relay — Cloudflare Worker
// ---------------------------------------------------------------------------
// Turns an in-app bug report / feature request into a labeled GitHub issue.
//
// This file holds NO secrets and is safe to commit. The two secrets below are
// read from the Worker's encrypted environment (set in the Cloudflare
// dashboard: Worker -> Settings -> Variables and Secrets), NOT from this code:
//
//   GITHUB_TOKEN   fine-grained PAT, "Issues: read & write" on FlatRateLabs/hahns
//   SHARED_SECRET  soft anti-spam gate string; must match the one baked into
//                  src/report.html at build time
//
// Flow: report.html (on our GitHub Pages origin) POSTs JSON here -> we validate
// origin + gate + lengths -> create the issue via the GitHub API using the
// token -> return the new issue URL. Only what the tech typed + app version +
// browser is forwarded; no ELSA / job / manual content ever reaches this Worker.

const REPO = "FlatRateLabs/hahns";
const ALLOWED_ORIGIN = "https://flatratelabs.github.io";

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
    };

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "POST") {
      return json({ ok: false, error: "method" }, 405, cors);
    }
    // Only accept reports coming from our own hosted report page
    if ((request.headers.get("Origin") || "") !== ALLOWED_ORIGIN) {
      return json({ ok: false, error: "origin" }, 403, cors);
    }

    let data;
    try {
      data = await request.json();
    } catch (e) {
      return json({ ok: false, error: "badjson" }, 400, cors);
    }

    // Soft anti-spam gate (client string must match the Worker secret)
    if (!env.SHARED_SECRET || data.gate !== env.SHARED_SECRET) {
      return json({ ok: false, error: "gate" }, 403, cors);
    }

    // Validate + clamp everything the client sent
    const clamp = (s, n) => String(s == null ? "" : s).slice(0, n).trim();
    const type = data.type === "feature" ? "feature" : "bug";
    const label = type === "feature" ? "enhancement" : "bug";
    let title = clamp(data.title, 120);
    const desc = clamp(data.description, 5000);
    const name = clamp(data.name, 80);
    const email = clamp(data.email, 120);
    const version = clamp(data.version, 40);
    const ua = clamp(data.ua, 300);

    if (!desc) {
      return json({ ok: false, error: "empty" }, 400, cors);
    }
    if (!title) title = desc.slice(0, 60);

    const issueTitle = (type === "feature" ? "[Feature] " : "[Bug] ") + title;
    const body =
      desc + "\n\n" +
      "---\n" +
      "_Submitted from the H.A.H.N.S in-app " +
      (type === "feature" ? "feedback" : "bug report") + " form._\n" +
      (name ? "**From:** " + name + "\n" : "") +
      (email ? "**Email:** " + email + "\n" : "") +
      "**App version:** " + (version || "unknown") + "\n" +
      "**Browser:** " + (ua || "unknown") + "\n" +
      "**When:** " + new Date().toISOString() + "\n";

    const gh = await fetch(
      "https://api.github.com/repos/" + REPO + "/issues",
      {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + env.GITHUB_TOKEN,
          "Accept": "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "hahns-feedback-worker",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: issueTitle, body: body, labels: [label] }),
      }
    );

    if (!gh.ok) {
      const detail = (await gh.text()).slice(0, 300);
      return json({ ok: false, error: "github", status: gh.status, detail }, 502, cors);
    }
    const issue = await gh.json();
    return json({ ok: true, url: issue.html_url, number: issue.number }, 200, cors);
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status: status,
    headers: Object.assign({ "Content-Type": "application/json" }, cors || {}),
  });
}
