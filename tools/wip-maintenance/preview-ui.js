// Preview UI + a first cut of the vehicle MATCHING and DUE logic. Written as a
// plain file (no template-literal escaping) and inlined by build-preview.js.
var V = window.VWJB;
function esc(s){return String(s==null?"":s).replace(/[&<>]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;"}[c];});}

// ---- vehicle ----
var MODELS = ["ATLAS SPORT","ATLAS","ARTEON","TIGUAN","GOLF VARIANT","GOLF","GTI","JETTA","GLI","PASSAT","BEETLE","TOUAREG","EOS","ROUTAN","ALLTRACK"];
function vehModels(name){ name=(name||"").toUpperCase(); return MODELS.filter(function(m){return name.indexOf(m)>=0;}); }
function alnum(s){return (s||"").toUpperCase().replace(/[^A-Z0-9.]/g,"");}
function getVeh(){
  return { model:document.getElementById("mn").value, sales:document.getElementById("sc").value,
           trans:document.getElementById("tr").value, engine:document.getElementById("en").value };
}
// does a single applicability CODE (BW2, 5N, A33, 09P, 1.8L…) fit this vehicle?
function codeFits(code, veh){
  code = alnum(code); if(!code) return true;
  var sales = alnum(veh.sales), trans = alnum(veh.trans);
  if(sales && sales.indexOf(code)===0) return true;         // platform = Sales-Code prefix (BW2 of BW24VJ)
  if(trans && trans.indexOf(code)===0) return true;         // trans-code prefix (09P of 09PA)
  if(/^\d\.\d/.test(code)){                                  // engine size like 1.8L / 2.0T
    var lit=parseFloat(code), cc=(veh.engine||"").match(/(\d{3,4})\s*ccm/); if(cc) return Math.abs(parseInt(cc[1],10)/1000-lit)<0.16;
  }
  return false;
}
// does an applicability string apply to this vehicle? returns {ok, scope:"all"|"model", why}
function applies(applic, veh){
  if(/All Vehicles|All Applicable/i.test(applic)) return {ok:true, scope:"all"};
  if(/^\s*(PHEV|BEV|HEV|BEV and PHEV|PHEV,\s*BEV|HEV,\s*PHEV)\s*$/i.test(applic)) return {ok:false}; // gas vehicle in this preview
  var vm = vehModels(veh.model); if(!vm.length) return {ok:false};
  for(var i=0;i<vm.length;i++){
    var m=vm[i];
    // coded mentions of this model: MODEL(code…)
    var re=new RegExp(m.replace(/ /g,"\\s*")+"\\s*\\(([^)]*)\\)","gi"), mm, sawCoded=false, matched=false;
    while((mm=re.exec(applic))){ sawCoded=true;
      var codes=mm[1].split(/[,\s]+/).filter(Boolean);
      if(codes.some(function(c){return codeFits(c,veh);})) matched=true;
    }
    if(matched) return {ok:true, scope:"model", why:m};
    // trans-code-qualified group: "09P: … MODEL …" (code before a colon)
    var tg=new RegExp("([0-9][A-Z0-9]{1,3})\\s*(?:\\(DSG\\))?\\s*:[^:]*\\b"+m.replace(/ /g,"\\s*")+"\\b","gi");
    while((mm=tg.exec(applic))){ if(codeFits(mm[1],veh)) return {ok:true, scope:"model", why:m+" "+mm[1]}; }
    // bare mention (model with no parenthetical code anywhere) → model-level match
    if(!sawCoded && new RegExp("\\b"+m.replace(/ /g,"\\s*")+"\\b","i").test(applic)) return {ok:true, scope:"model", why:m};
  }
  return {ok:false};
}

// ---- due logic ----
function intMiles(t){var m=t.match(/([\d,]+)\s*miles/);if(m)return parseInt(m[1].replace(/,/g,""),10);m=t.match(/(\d+)K\s*miles/);if(m)return parseInt(m[1],10)*1000;return null;}
function intYears(t){var m=t.match(/(\d+)\s*year/);return m?parseInt(m[1],10):null;}
function ageYears(deliv){if(!deliv)return null;var d=new Date(deliv);if(isNaN(d))return null;return (Date.now()-d.getTime())/(365.25*24*3600*1000);}
function gridHits(arr,rounded){if(!arr||arr.length<2||rounded<=0)return false;var first=arr[0],per=arr[1]-arr[0];return rounded>=first&&(rounded-first)%per===0;}

function servicesDue(sched, veh, mileage, deliv){
  var rounded=Math.round(mileage/10000)*10000, age=ageYears(deliv);
  // which service level does this interval require?
  var levels=[]; var g=sched.grid;
  if(gridHits(g.standard,rounded)) levels.push("Standard"); else if(gridHits(g.minor,rounded)) levels.push("Minor");
  if(gridHits(g.extended,rounded)) levels.push("Extended");
  // REPLACE items from the due levels (only things that say Replace)
  var replaceItems=[];
  function addReplace(name, arr){ arr.forEach(function(r){ if(/\breplace\b/i.test(r.item) && applies(r.applic,veh).ok) replaceItems.push({item:r.item, from:name}); }); }
  if(levels.indexOf("Minor")>=0 || levels.indexOf("Standard")>=0) addReplace("Minor", sched.minor);
  if(levels.indexOf("Standard")>=0) addReplace("Standard", sched.standard);
  if(levels.indexOf("Extended")>=0) addReplace("Extended", sched.extended);
  // Additional items that APPLY and are DUE (by mileage or age)
  var all=[], model=[];
  sched.additional.forEach(function(it){
    it.variants.forEach(function(v){
      var ap=applies(v.applic, veh); if(!ap.ok) return;
      var mi=intMiles(v.interval), yr=intYears(v.interval), why=[];
      if(mi && rounded>0 && rounded%mi===0) why.push("at "+rounded.toLocaleString()+" mi");
      if(yr && age!=null && age>=yr) why.push("age "+age.toFixed(1)+"y ≥ "+yr+"y");
      if(!why.length) return;
      var row={item:it.item, interval:v.interval, why:why.join(" · "), applic:v.applic};
      (ap.scope==="all"?all:model).push(row);
    });
  });
  return {rounded:rounded, age:age, levels:levels, replaceItems:replaceItems, all:all, model:model};
}

// ---- render ----
var parsed=null;
function serviceName(rounded){ return (rounded/1000)+"K"; }
function run(){
  if(!parsed){return;}
  var veh=getVeh(), mileage=parseInt(document.getElementById("mi").value||"0",10), deliv=document.getElementById("dl").value;
  var d=servicesDue(parsed.ice, veh, mileage, deliv);
  var lvlTxt = d.levels.length ? d.levels.map(function(l){return l+" Maintenance";}).join(" + ") : "no scheduled level";
  var h="<div class=due><h2>Possible "+serviceName(d.rounded)+" service due! <span class=lvl>("+esc(lvlTxt)+")</span></h2>";
  h+="<div class=sub>"+esc(veh.model)+" · Sales Code "+esc(veh.sales)+" (platform "+esc(alnum(veh.sales).slice(0,3))+") · "+d.rounded.toLocaleString()+" mi · age ~"+(d.age!=null?d.age.toFixed(1):"?")+" yrs</div>";
  if(d.replaceItems.length){ h+="<h3>Replace (from "+esc(d.levels.join("/"))+")</h3><ul>"+d.replaceItems.map(function(r){return "<li>"+esc(r.item)+" <span class=sm>("+esc(r.from)+")</span></li>";}).join("")+"</ul>"; }
  h+="<h3>Additional items — all vehicles</h3>"+ (d.all.length? "<ul>"+d.all.map(addLi).join("")+"</ul>" : "<div class=none>none due</div>");
  h+="<h3>Additional items — this model ("+esc(vehModels(veh.model).join(", ")||"?")+")</h3>"+ (d.model.length? "<ul>"+d.model.map(addLi).join("")+"</ul>" : "<div class=none>none due for this model/code</div>");
  h+="</div>";
  document.getElementById("due").innerHTML=h;
}
function addLi(r){ return "<li><b>"+esc(r.item)+"</b> — "+esc(r.interval)+" <span class=why>("+esc(r.why)+")</span><br><span class=ap>applies to: "+esc(r.applic)+"</span></li>"; }

function renderTables(){
  function renderSched(name, s){
    var h="<h2>"+esc(name)+"</h2>";
    h+="<div class=grid><b>Service intervals (miles)</b> — Minor: "+s.grid.minor.join(", ")+" · Standard: "+s.grid.standard.join(", ")+" · Extended: "+s.grid.extended.join(", ")+"</div>";
    function list(t,arr){var x="<details><summary>"+esc(t)+" ("+arr.length+")</summary><table>";arr.forEach(function(r){x+="<tr><td>"+esc(r.item)+"</td><td class=ap>"+esc(r.applic)+"</td></tr>";});return x+"</table></details>";}
    h+=list("Minor",s.minor)+list("Standard",s.standard)+list("Extended",s.extended);
    h+="<details open><summary>Additional Items ("+s.additional.length+")</summary><table>";
    s.additional.forEach(function(it){ h+="<tr><td class=item>"+esc(it.item)+"</td><td>"+it.variants.map(function(v){return "<div><span class=iv>"+esc(v.interval||"—")+"</span> <span class=ap>"+esc(v.applic)+"</span></div>";}).join("")+"</td></tr>"; });
    return h+"</table></details>";
  }
  document.getElementById("tables").innerHTML = "<h2 class=sech>Full parsed schedule (for verifying the parser)</h2>" + renderSched("Gas / Diesel / Hybrid", parsed.ice) + (parsed.bev?renderSched("Battery Electric", parsed.bev):"");
}

document.getElementById("file").addEventListener("change", function(e){
  var f=e.target.files[0]; if(!f)return;
  document.getElementById("status").textContent="Reading "+f.name+"…";
  var fr=new FileReader();
  fr.onload=function(){
    V.pdfPages(fr.result).then(function(pages){
      var text=pages.map(function(p){return p.lines.join("\n");}).join("\n");
      var r=parseMaintenance(text);
      r.ice.additional=additionalFromPages(pages,/1\.1\.4\s+Additional Maintenance/,/1\.2\s+Maintenance Schedule/);
      if(r.bev) r.bev.additional=additionalFromPages(pages,/1\.2\.4\s+Additional Maintenance/,/ZZZ_NO_MATCH/);
      parsed=r;
      document.getElementById("status").textContent=f.name+" — parsed.";
      run(); renderTables();
    }).catch(function(err){document.getElementById("status").textContent="Error: "+(err&&err.message||err);});
  };
  fr.readAsArrayBuffer(f);
});
["mi","dl","mn","sc","tr","en"].forEach(function(id){ document.getElementById(id).addEventListener("input", run); });
