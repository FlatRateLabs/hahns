// Assemble a SELF-CONTAINED preview page: the PDF reader (src/helper.js) + the
// maintenance parser prototype + a small UI, inlined into one HTML the owner can
// open in Chrome. No server, no network, nothing committed.
const fs = require("fs");
const REPO = "/Users/ryanvanpolen/Documents/Claude App Builds/VW Tech Helper App";
const helper = fs.readFileSync(REPO + "/src/helper.js", "utf8");
var pm = fs.readFileSync(__dirname + "/parse-maint.js", "utf8");
// keep only the parser functions: after `const V = window.VWJB;` … before the runner
pm = pm.slice(pm.indexOf("const V = window.VWJB;") + "const V = window.VWJB;".length, pm.indexOf("// ---- run ----"));

const ui = fs.readFileSync(__dirname + "/preview-ui.js", "utf8");
const uiOLD = `
var V = window.VWJB;
function esc(s){return String(s==null?"":s).replace(/[&<>]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;"}[c];});}
function intMiles(t){var m=t.match(/([\\d,]+)\\s*miles/);if(m)return parseInt(m[1].replace(/,/g,""),10);m=t.match(/(\\d+)K\\s*miles/);if(m)return parseInt(m[1],10)*1000;return null;}
function intYears(t){var m=t.match(/(\\d+)\\s*year/);return m?parseInt(m[1],10):null;}
function ageYears(deliv){if(!deliv)return null;var d=new Date(deliv);if(isNaN(d))return null;return (Date.now()-d.getTime())/(365.25*24*3600*1000);}
function servicesDue(sched, mileage, deliv){
  var out=[]; var rounded=Math.round(mileage/10000)*10000; var age=ageYears(deliv);
  if(rounded>0){
    var g=sched.grid;
    function hits(arr){if(!arr||arr.length<2)return false;var first=arr[0],per=arr[1]-arr[0];return rounded>=first && (rounded-first)%per===0;}
    if(hits(g.extended)) out.push({t:"Extended Maintenance",items:sched.extended});
    if(hits(g.standard)) out.push({t:"Standard Maintenance (incl. Minor)",items:sched.standard});
    else if(hits(g.minor)) out.push({t:"Minor Maintenance",items:sched.minor});
  }
  // additional items due by mileage or time
  var add=[];
  sched.additional.forEach(function(it){
    it.variants.forEach(function(v){
      var mi=intMiles(v.interval),yr=intYears(v.interval),due=[];
      if(mi && rounded>0 && rounded%mi===0) due.push("mileage");
      if(yr && age!=null && age>=yr) due.push("age "+age.toFixed(1)+"y");
      if(due.length) add.push({item:it.item, interval:v.interval, applic:v.applic, why:due.join(" + ")});
    });
  });
  return {blocks:out, add:add, rounded:rounded, age:age};
}
function renderSched(name, s){
  var h="<h2>"+esc(name)+"</h2>";
  h+="<div class=grid><b>Service intervals</b><br>Minor: "+s.grid.minor.join(", ")+" &nbsp; Standard: "+s.grid.standard.join(", ")+" &nbsp; Extended: "+s.grid.extended.join(", ")+" (miles)</div>";
  function list(t,arr){var x="<details><summary>"+esc(t)+" ("+arr.length+")</summary><table>";arr.forEach(function(r){x+="<tr><td>"+esc(r.item)+"</td><td class=ap>"+esc(r.applic)+"</td></tr>";});return x+"</table></details>";}
  h+=list("Minor",s.minor)+list("Standard",s.standard)+list("Extended",s.extended);
  h+="<details open><summary>Additional Items ("+s.additional.length+")</summary><table>";
  s.additional.forEach(function(it){
    h+="<tr><td class=item>"+esc(it.item)+"</td><td>";
    it.variants.forEach(function(v){h+="<div><span class=iv>"+esc(v.interval||"—")+"</span> <span class=ap>"+esc(v.applic)+"</span></div>";});
    h+="</td></tr>";
  });
  h+="</table></details>";
  return h;
}
var parsed=null;
function run(){
  if(!parsed){return;}
  var mileage=parseInt(document.getElementById("mi").value||"0",10);
  var deliv=document.getElementById("dl").value;
  var out=document.getElementById("out"); out.innerHTML="";
  var sched=parsed.ice;
  var d=servicesDue(sched, mileage, deliv);
  var due="<div class=due><h2>Possible services due!</h2><div class=sub>Based on the ~"+d.rounded.toLocaleString()+"-mile service"+(d.age!=null?" · vehicle age ~"+d.age.toFixed(1)+" yrs":"")+" (gas/diesel/hybrid schedule; model matching not wired in this preview — check applicability yourself)</div>";
  if(!d.blocks.length && !d.add.length){due+="<p>Nothing computed — enter a mileage.</p>";}
  d.blocks.forEach(function(b){due+="<h3>"+esc(b.t)+"</h3><ul>"+b.items.map(function(r){return "<li>"+esc(r.item)+" <span class=ap>"+esc(r.applic)+"</span></li>";}).join("")+"</ul>";});
  if(d.add.length){due+="<h3>Additional items due</h3><ul>"+d.add.map(function(a){return "<li><b>"+esc(a.item)+"</b> — "+esc(a.interval)+" <span class=ap>"+esc(a.applic)+"</span> <span class=why>("+esc(a.why)+")</span></li>";}).join("")+"</ul>";}
  due+="</div>";
  out.innerHTML=due + renderSched("Gas / Diesel / Hybrid schedule", parsed.ice) + (parsed.bev?renderSched("Battery Electric schedule", parsed.bev):"");
}
document.getElementById("file").addEventListener("change", function(e){
  var f=e.target.files[0]; if(!f)return;
  document.getElementById("status").textContent="Reading "+f.name+"…";
  var fr=new FileReader();
  fr.onload=function(){
    V.pdfPages(fr.result).then(function(pages){
      var text=pages.map(function(p){return p.lines.join("\\n");}).join("\\n");
      var r=parseMaintenance(text);
      r.ice.additional=additionalFromPages(pages,/1\\.1\\.4\\s+Additional Maintenance/,/1\\.2\\s+Maintenance Schedule/);
      if(r.bev) r.bev.additional=additionalFromPages(pages,/1\\.2\\.4\\s+Additional Maintenance/,/ZZZ_NO_MATCH/);
      parsed=r;
      document.getElementById("status").textContent=f.name+" — parsed. "+r.ice.additional.length+" additional items.";
      run();
    }).catch(function(err){document.getElementById("status").textContent="Error: "+(err&&err.message||err);});
  };
  fr.readAsArrayBuffer(f);
});
document.getElementById("mi").addEventListener("input", run);
document.getElementById("dl").addEventListener("input", run);
`;

const html = `<!doctype html><html><head><meta charset="utf-8"><title>H.A.H.N.S Maintenance Parser — Preview</title>
<style>
body{font:14px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;margin:0;padding:18px;background:#f4f6fa;color:#1b2536;}
h1{font-size:18px;margin:0 0 4px}
.note{color:#5a6b85;font-size:12.5px;margin-bottom:14px;max-width:820px}
.bar{background:#fff;border:1px solid #dde3ee;border-radius:10px;padding:12px 14px;margin-bottom:16px;display:flex;gap:18px;align-items:center;flex-wrap:wrap}
.bar label{font-weight:600;font-size:12.5px;color:#33435c}
.bar input[type=number]{width:110px}.bar input{padding:6px 8px;border:1px solid #cbd4e4;border-radius:7px;font:inherit}
#status{color:#2b6b3a;font-size:12.5px}
h2{font-size:15px;margin:20px 0 8px;border-bottom:2px solid #e2e8f2;padding-bottom:4px}
h3{font-size:13.5px;margin:12px 0 4px;color:#0b3d91}
.grid{background:#eef3fb;border:1px solid #d6e0f0;border-radius:8px;padding:9px 11px;font-size:12.5px;margin-bottom:8px}
details{background:#fff;border:1px solid #e0e6f0;border-radius:8px;margin:6px 0;padding:2px 10px}
summary{font-weight:700;cursor:pointer;padding:6px 0;font-size:13px}
table{width:100%;border-collapse:collapse;font-size:12.5px}
td{border-top:1px solid #eef1f7;padding:5px 6px;vertical-align:top}
.ap{color:#8a5a00}
td.item,.item{font-weight:600;width:38%}
.iv{color:#0b6b52;font-weight:600}
.due{background:#fff8e6;border:1px solid #f0d98a;border-radius:10px;padding:12px 16px;margin-bottom:10px}
.due h2{color:#8a5a00;border:0;margin-top:0}
.due .sub{color:#7a6a45;font-size:12px;margin-bottom:8px}
.due ul{margin:4px 0 10px 18px;padding:0}.due li{margin:2px 0}
.why{color:#2b6b3a;font-size:11.5px}
.lvl{font-size:13px;color:#7a6a45;font-weight:600}
.sm{color:#8a7a55;font-size:11.5px}
.none{color:#9aa3b3;font-style:italic;margin:2px 0 8px}
.sech{margin-top:26px;color:#5a6b85}
.due h3{color:#8a5a00}
</style></head><body>
<h1>H.A.H.N.S Maintenance Parser — local preview</h1>
<div class="note"><b>Work-in-progress preview.</b> Pick a VW Maintenance Schedule PDF (stays on this computer — no upload). The vehicle row is prefilled with the 2019 BW2 Tiguan from your dump — edit it to test other cars. The top panel shows the <b>due-services</b> logic: the service level, the <b>Replace</b> items, and the Additional Items that <b>apply to this exact model + platform code</b> (a BW2 Tiguan should NOT show 5N Tiguan items). Below is the full parsed schedule so you can verify the parser. Note: the densest Additional Items (Snow Screen → belts) can still drift until the table-border reading is added.</div>
<div class="bar">
  <span><label>Maintenance PDF:</label> <input type="file" id="file" accept=".pdf,application/pdf"></span>
  <span id="status">No PDF loaded.</span>
</div>
<div class="bar">
  <span><label>Model Name:</label> <input id="mn" value="TIGUAN SEL 4MOTION" size="22"></span>
  <span><label>Sales Code:</label> <input id="sc" value="BW24VJ" size="9"></span>
  <span><label>Trans:</label> <input id="tr" value="09PA" size="7"></span>
  <span><label>Engine:</label> <input id="en" value="DGUA - 1984 ccm" size="16"></span>
  <span><label>Mileage:</label> <input type="number" id="mi" value="40000"></span>
  <span><label>Delivery:</label> <input type="date" id="dl" value="2018-11-25"></span>
</div>
<div id="due"></div>
<div id="tables"></div>
<script>${helper}</script>
<script>${pm}</script>
<script>${ui}</script>
</body></html>`;

const outPath = "/Users/ryanvanpolen/Downloads/HAHNS-maintenance-preview.html";
fs.writeFileSync(outPath, html);
fs.writeFileSync(__dirname + "/maintenance-preview.html", html);
console.log("wrote", outPath, "(" + Math.round(html.length/1024) + " KB)");
