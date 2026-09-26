// ============================================================
//  hw-scanner.js — USB barcode scanner support (TVS BS-L100 etc.)
//
//  A USB HID scanner types the code very fast then presses Enter.
//  This listens globally so the counter can scan box after box
//  without clicking into any field.
//
//  Shows its own floating button, independent of the app's markup,
//  so nothing can overwrite it. Load AFTER firestore-shim.js.
// ============================================================
(function () {
  const KEY='hwScanner', MAX_GAP=35, MIN_LEN=3;
  let ON=false, buf='', last=0, timer=null;

  /* ---------- floating UI (never touches the app's DOM) ---------- */
  const box=document.createElement('div');
  box.id='hwBox';
  box.style.cssText=
    'position:fixed;right:14px;bottom:14px;z-index:99999;display:flex;flex-direction:column;'+
    'align-items:flex-end;gap:6px;font-family:system-ui,-apple-system,sans-serif;'+
    'padding-bottom:env(safe-area-inset-bottom,0px)';

  const btn=document.createElement('button');
  btn.type='button';
  btn.textContent='🔌 USB Scanner: OFF';
  btn.style.cssText=
    'padding:12px 16px;border-radius:24px;border:none;cursor:pointer;font-weight:700;'+
    'font-size:13px;background:#2a2823;color:#cbc7bb;box-shadow:0 6px 18px rgba(0,0,0,.35)';
  btn.onclick=()=>setOn(!ON);

  const tag=document.createElement('div');
  tag.style.cssText=
    'background:#000;color:#fff;padding:7px 12px;border-radius:10px;font-size:12px;'+
    'max-width:70vw;display:none;box-shadow:0 6px 18px rgba(0,0,0,.35)';

  box.appendChild(tag); box.appendChild(btn);
  (document.body||document.documentElement).appendChild(box);

  function setOn(v){
    ON=v;
    btn.textContent='🔌 USB Scanner: '+(ON?'ON':'OFF');
    btn.style.background=ON?'linear-gradient(135deg,#3b82f6,#1d4ed8)':'#2a2823';
    btn.style.color=ON?'#fff':'#cbc7bb';
    say(ON?'Ready — just scan, no need to tap anything.':'');
    try{localStorage.setItem(KEY,ON?'1':'0');}catch(e){}
    if(ON)beep(1180,.06);
  }
  function say(t){ tag.textContent=t; tag.style.display=t?'block':'none';
    if(t){clearTimeout(say._t);say._t=setTimeout(()=>{if(ON)say('Ready — just scan.');},2500);} }
  function beep(f,d){try{const c=new(window.AudioContext||window.webkitAudioContext)(),
    o=c.createOscillator(),g=c.createGain();o.frequency.value=f;o.connect(g);g.connect(c.destination);
    g.gain.setValueAtTime(.1,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+d);
    o.start();o.stop(c.currentTime+d);}catch(e){}}

  /* ---------- hand the scanned code to the app ---------- */
  function submit(code){
    code=String(code||'').trim();
    if(code.length<MIN_LEN)return;
    say('Scanned: '+code); beep(1320,.07);

    // 1) the app's own handler, if it exposes one
    if(typeof window.onCode==='function'){ try{ window.onCode(code); return; }catch(e){} }

    // 2) otherwise drive its input box
    const inp=document.getElementById('manual')
          ||document.querySelector('input[placeholder*="SKU" i],input[placeholder*="Barcode" i]');
    if(inp){
      const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
      setter.call(inp,code);
      inp.dispatchEvent(new Event('input',{bubbles:true}));
      inp.dispatchEvent(new Event('change',{bubbles:true}));
      inp.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',keyCode:13,which:13,bubbles:true}));
      const go=document.getElementById('goBtn');
      if(go)go.click();
      return;
    }
    say('Scanned '+code+' — open the Scan page first.');
  }

  /* ---------- listen for the scanner ---------- */
  document.addEventListener('keydown',e=>{
    if(!ON)return;
    const t=e.target, typing=t&&/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
    const now=Date.now(), fast=(now-last)<MAX_GAP;

    if(e.key==='Enter'){
      if(buf.length>=MIN_LEN){ e.preventDefault(); e.stopPropagation();
        const c=buf; buf=''; clearTimeout(timer); submit(c); }
      else buf='';
      last=now; return;
    }
    if(e.key&&e.key.length===1){
      if(typing&&!fast){ last=now; buf=''; return; }   // a person typing
      if(!fast)buf='';
      buf+=e.key; last=now;
      clearTimeout(timer);
      timer=setTimeout(()=>{ if(buf.length>=MIN_LEN){const c=buf;buf='';submit(c);} },120);
      if(buf.length>2&&!typing)e.preventDefault();
    }
  },true);

  try{ if(localStorage.getItem(KEY)==='1') setOn(true); }catch(e){}
  console.log('[hw-scanner] ready — floating button bottom-right');
})();
