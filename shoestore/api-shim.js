// ============================================================
//  api-shim.js  —  lets the Shoe IMS run OUTSIDE Apps Script.
//  Recreates google.script.run so the app's existing calls
//  (google.script.run.getLiveStock(), etc.) travel to your
//  Apps Script Web App over fetch() and return the result.
//
//  Load in <head> BEFORE the app's own script.
// ============================================================
(function () {
  /* ===== PASTE YOUR /exec URL HERE ========================== */
  var EXEC_URL   = "https://script.google.com/macros/s/AKfycbyGaMNhu4sh7abzZ2UezEmN6eFV63KFagp3Wpn0M2VBVwY6ZnEHEdURwsTkrJ7lNCIxnw/exec";
  /* This secret already matches API_SECRET in your Code.gs.    */
  var API_SECRET = "lnBzN83VkRBU1SlLHmy69BQdjkeI0td6";
  /* ========================================================== */

  function station(){ try { return window.__IMS_USER || "Web"; } catch (e) { return "Web"; } }

  function makeRunner(){
    var onS=null, onF=null, uo=null;
    var api = new Proxy({}, { get:function(_t, prop){
      if(prop==="withSuccessHandler") return function(cb){ onS=cb; return api; };
      if(prop==="withFailureHandler") return function(cb){ onF=cb; return api; };
      if(prop==="withUserObject")     return function(o){ uo=o;  return api; };
      return function(){
        var args = Array.prototype.slice.call(arguments);
        fetch(EXEC_URL, {
          method:"POST",
          headers:{ "Content-Type":"text/plain;charset=utf-8" },  // avoids CORS preflight
          body: JSON.stringify({ secret:API_SECRET, api:"call", fn:prop, args:args, station:station() }),
          redirect:"follow"
        })
        .then(function(r){ return r.text(); })
        .then(function(txt){
          var data; try { data = JSON.parse(txt); }
          catch(e){ throw new Error("Unreadable response from server."); }
          if (data && data.__error){ if(onF) onF(new Error(data.__error)); return; }
          if (onS) onS(data ? data.__result : undefined, uo);
        })
        .catch(function(err){ if(onF) onF(err instanceof Error ? err : new Error(String(err))); });
        return api;
      };
    }});
    return api;
  }

  window.google = window.google || {};
  window.google.script = window.google.script || {};
  Object.defineProperty(window.google.script, "run", { get: makeRunner });
  // harmless stubs in case anything references these
  window.google.script.host = window.google.script.host || { close:function(){}, setHeight:function(){}, editor:{} };
  window.google.script.url  = window.google.script.url  || { getLocation:function(cb){ try{ cb && cb({parameter:{}}); }catch(e){} } };
})();
