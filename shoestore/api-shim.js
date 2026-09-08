// ============================================================
//  api-shim.js  —  lets the Shoe IMS run OUTSIDE Apps Script.
//  Recreates google.script.run over fetch(), with a timeout and
//  automatic retry for slow/flaky reads (Apps Script cold starts).
//  Load in <head> BEFORE the app's own script.
// ============================================================
(function () {
  var EXEC_URL   = "https://script.google.com/macros/s/AKfycbyGaMNhu4sh7abzZ2UezEmN6eFV63KFagp3Wpn0M2VBVwY6ZnEHEdURwsTkrJ7lNCIxnw/exec";
  var API_SECRET = "lnBzN83VkRBU1SlLHmy69BQdjkeI0td6";

  var TIMEOUT_MS  = 30000;   // wait up to 30s per try (Apps Script can be slow)
  var MAX_TRIES   = 3;       // total attempts for safe (read-only) calls
  var BACKOFF     = [700, 1600];  // wait between retries

  // Only READ-ONLY functions may be retried. Never retry anything that
  // changes data (a retry could double-count stock!).
  var SAFE = {
    bootstrap:1, getLiveStock:1, getBrands:1, getCatalogue:1, getDashboardData:1,
    getMovements:1, getSalesLog:1, lookupByBarcode:1, searchModels:1,
    getItemMaster:1, parseInvoiceText:1
  };

  function station(){ try { return window.__IMS_USER || "Web"; } catch (e) { return "Web"; } }

  function attempt(prop, args, onS, onF, uo, tryNo){
    var ctrl = (typeof AbortController !== "undefined") ? new AbortController() : null;
    var timer = setTimeout(function(){ if (ctrl) ctrl.abort(); }, TIMEOUT_MS);

    fetch(EXEC_URL, {
      method:"POST",
      headers:{ "Content-Type":"text/plain;charset=utf-8" },
      body: JSON.stringify({ secret:API_SECRET, api:"call", fn:prop, args:args, station:station() }),
      redirect:"follow",
      signal: ctrl ? ctrl.signal : undefined
    })
    .then(function(r){ return r.text(); })
    .then(function(txt){
      clearTimeout(timer);
      var data;
      try { data = JSON.parse(txt); }
      catch(e){ return maybeRetry("Server was slow to respond. Please try again."); }
      if (data && data.__error){ if(onF) onF(new Error(data.__error)); return; }  // real error: don't retry
      if (onS) onS(data ? data.__result : undefined, uo);
    })
    .catch(function(){
      clearTimeout(timer);
      maybeRetry("Network was slow. Please try again.");
    });

    function maybeRetry(msg){
      if (SAFE[prop] && tryNo < MAX_TRIES){
        setTimeout(function(){ attempt(prop, args, onS, onF, uo, tryNo+1); },
                   BACKOFF[tryNo-1] || 1600);
      } else {
        if(onF) onF(new Error(msg));
      }
    }
  }

  function makeRunner(){
    var onS=null, onF=null, uo=null;
    var api = new Proxy({}, { get:function(_t, prop){
      if(prop==="withSuccessHandler") return function(cb){ onS=cb; return api; };
      if(prop==="withFailureHandler") return function(cb){ onF=cb; return api; };
      if(prop==="withUserObject")     return function(o){ uo=o;  return api; };
      return function(){
        attempt(prop, Array.prototype.slice.call(arguments), onS, onF, uo, 1);
        return api;
      };
    }});
    return api;
  }

  window.google = window.google || {};
  window.google.script = window.google.script || {};
  Object.defineProperty(window.google.script, "run", { get: makeRunner });
  window.google.script.host = window.google.script.host || { close:function(){}, setHeight:function(){}, editor:{} };
  window.google.script.url  = window.google.script.url  || { getLocation:function(cb){ try{ cb && cb({parameter:{}}); }catch(e){} } };
})();
