// ============================================================
//  api-shim.js — lets the Shoe IMS run OUTSIDE Apps Script.
//  Recreates google.script.run over fetch(), with a timeout,
//  retry for slow reads, and a circuit-breaker so a mis-deployed
//  backend fails once with a clear message instead of looping.
// ============================================================
(function () {
  var EXEC_URL   = "https://script.google.com/macros/s/AKfycbyGaMNhu4sh7abzZ2UezEmN6eFV63KFagp3Wpn0M2VBVwY6ZnEHEdURwsTkrJ7lNCIxnw/exec";
  var API_SECRET = "lnBzN83VkRBU1SlLHmy69BQdjkeI0td6";

  var TIMEOUT_MS = 30000;
  var MAX_TRIES  = 3;
  var BACKOFF    = [700, 1600];

  // Read-only calls may be retried. Never retry anything that writes.
  var SAFE = {
    bootstrap:1, getLiveStock:1, getBrands:1, getCatalogue:1, getDashboardData:1,
    getMovements:1, getSalesLog:1, lookupByBarcode:1, searchModels:1,
    getItemMaster:1, parseInvoiceText:1
  };

  // Circuit breaker: once the backend is unreachable (CORS / not public),
  // stop hammering it and report the real cause immediately.
  var DOWN = false;
  var DOWN_MSG = "Cannot reach the server. In Apps Script open Deploy > Manage deployments, " +
                 "set 'Who has access' to Anyone, choose New version, and Deploy.";

  function station(){ try { return window.__IMS_USER || "Web"; } catch(e){ return "Web"; } }

  function attempt(fn, args, onS, onF, uo, tryNo){
    if (DOWN){ if(onF) onF(new Error(DOWN_MSG)); return; }

    var ctrl = (typeof AbortController !== "undefined") ? new AbortController() : null;
    var timer = setTimeout(function(){ if(ctrl) ctrl.abort(); }, TIMEOUT_MS);

    fetch(EXEC_URL, {
      method:"POST",
      headers:{ "Content-Type":"text/plain;charset=utf-8" },
      body: JSON.stringify({ secret:API_SECRET, api:"call", fn:fn, args:args, station:station() }),
      redirect:"follow"
    })
    .then(function(r){ return r.text(); })
    .then(function(txt){
      clearTimeout(timer);
      var data;
      try { data = JSON.parse(txt); }
      catch(e){ return fail(true, "Server sent an unreadable reply."); }
      if (data && data.__error){ if(onF) onF(new Error(data.__error)); return; }  // real error, don't retry
      if (onS) onS(data ? data.__result : undefined, uo);
    })
    .catch(function(err){
      clearTimeout(timer);
      if (err && err.name === "AbortError"){          // our own timeout fired
        fail(false, "The server took too long to answer (over " + (TIMEOUT_MS/1000) + "s).");
        return;
      }
      // A blocked request rejects with TypeError and no status. That is almost always
      // the backend refusing the website (not public), not the user's connection.
      if (err && err.name === "TypeError"){ fail(true, DOWN_MSG); return; }
      fail(false, "Could not reach the server: " + ((err && err.message) || "unknown error"));
    });

    function fail(isFatal, msg){
      if (isFatal){ DOWN = true; if(onF) onF(new Error(DOWN_MSG)); return; }
      if (SAFE[fn] && tryNo < MAX_TRIES){
        setTimeout(function(){ attempt(fn,args,onS,onF,uo,tryNo+1); }, BACKOFF[tryNo-1] || 1600);
        return;
      }
      if (!SAFE[fn]){
        // A write (stock in/out/sale). We never retry these automatically, because a
        // repeat could double-count. Say so plainly and tell the user what to check.
        msg += " This entry was NOT saved — check the quantity on screen and scan again.";
      }
      if (onF) onF(new Error(msg));
    }
  }

  function makeRunner(){
    var onS=null,onF=null,uo=null;
    var api = new Proxy({}, { get:function(_t, prop){
      if(prop==="withSuccessHandler") return function(cb){ onS=cb; return api; };
      if(prop==="withFailureHandler") return function(cb){ onF=cb; return api; };
      if(prop==="withUserObject")     return function(o){ uo=o;  return api; };
      return function(){ attempt(prop, Array.prototype.slice.call(arguments), onS, onF, uo, 1); return api; };
    }});
    return api;
  }

  window.google = window.google || {};
  window.google.script = window.google.script || {};
  Object.defineProperty(window.google.script, "run", { get: makeRunner });
  window.google.script.host = window.google.script.host || { close:function(){}, setHeight:function(){}, editor:{} };
  window.google.script.url  = window.google.script.url  || { getLocation:function(cb){ try{ cb&&cb({parameter:{}}); }catch(e){} } };
})();
