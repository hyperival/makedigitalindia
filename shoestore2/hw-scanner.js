// ============================================================
//  hw-scanner.js  —  USB barcode scanner support (TVS BS-L100 etc.)
//
//  A USB HID scanner behaves like a keyboard: it "types" the code
//  very fast and presses Enter. This listens globally for that
//  pattern, so the counter can scan box after box without ever
//  clicking into a field.
//
//  Adds a "🔌 USB Scanner" button next to Live Scan.
//  Load AFTER firestore-shim.js.
// ============================================================
(function () {
  const KEY = 'hwScanner';
  const MAX_GAP = 35;     // ms between keys — scanners are far faster than people
  const MIN_LEN = 3;      // ignore stray keypresses
  let ON = false, buf = '', last = 0, timer = null;

  /* ---------- add the button ---------- */
  function mountButton() {
    const scanBtn = document.getElementById('scanBtn')
                 || document.querySelector('[id*="scan" i][id*="btn" i]');
    if (!scanBtn || document.getElementById('hwBtn')) return false;

    const b = document.createElement('button');
    b.id = 'hwBtn';
    b.type = 'button';
    b.textContent = '🔌 USB Scanner';
    b.style.cssText =
      'padding:13px 14px;border-radius:11px;border:1.5px solid #3b382f;background:#211f1b;' +
      'color:#8b867a;font-weight:800;font-size:.74rem;font-family:inherit;cursor:pointer;' +
      'white-space:nowrap;margin-left:8px';
    b.onclick = () => setOn(!ON);

    // sit it beside the existing scan button
    (scanBtn.parentNode || document.body).insertBefore(b, scanBtn.nextSibling);

    // status line under the row
    const s = document.createElement('div');
    s.id = 'hwMsg';
    s.style.cssText = 'font-size:.72rem;color:#8b867a;text-align:center;margin:6px 0;min-height:16px';
    (scanBtn.parentNode.parentNode || document.body)
      .insertBefore(s, scanBtn.parentNode.nextSibling);
    return true;
  }

  function setOn(v) {
    ON = v;
    const b = document.getElementById('hwBtn');
    if (b) {
      b.style.background = ON ? 'linear-gradient(135deg,#3b82f6,#1d4ed8)' : '#211f1b';
      b.style.color = ON ? '#fff' : '#8b867a';
      b.style.borderColor = ON ? 'transparent' : '#3b382f';
    }
    status(ON ? 'USB scanner ready — just scan, no need to tap anything.' : '');
    try { localStorage.setItem(KEY, ON ? '1' : '0'); } catch (e) {}
    if (ON) beep(1180, .06);
  }
  function status(t) { const s = document.getElementById('hwMsg'); if (s) s.textContent = t; }

  function beep(f, d) {
    try {
      const c = new (window.AudioContext || window.webkitAudioContext)();
      const o = c.createOscillator(), g = c.createGain();
      o.frequency.value = f; o.connect(g); g.connect(c.destination);
      g.gain.setValueAtTime(.1, c.currentTime);
      g.gain.exponentialRampToValueAtTime(.001, c.currentTime + d);
      o.start(); o.stop(c.currentTime + d);
    } catch (e) {}
  }

  /* ---------- hand the code to the app ---------- */
  function submit(code) {
    code = code.trim();
    if (code.length < MIN_LEN) return;
    status('Scanned: ' + code);
    beep(1320, .07);

    // Prefer the app's own handler; fall back to filling its input.
    if (typeof window.onCode === 'function') { window.onCode(code); return; }
    const inp = document.getElementById('manual')
             || document.querySelector('input[placeholder*="SKU" i], input[placeholder*="barcode" i]');
    if (inp) {
      inp.value = code;
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      const go = document.getElementById('goBtn');
      if (go) go.click();
    }
  }

  /* ---------- listen for scanner keystrokes ---------- */
  document.addEventListener('keydown', e => {
    if (!ON) return;

    // Let people type normally in text fields — unless the scanner is clearly firing.
    const t = e.target, typing = t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
    const now = Date.now(), fast = (now - last) < MAX_GAP;
    if (typing && !fast && e.key !== 'Enter') { last = now; return; }

    if (e.key === 'Enter') {
      if (buf.length >= MIN_LEN) { e.preventDefault(); e.stopPropagation();
        const c = buf; buf = ''; clearTimeout(timer); submit(c); }
      else buf = '';
      last = now; return;
    }

    if (e.key.length === 1) {
      if (!fast) buf = '';            // a fresh burst
      buf += e.key;
      last = now;
      clearTimeout(timer);
      // Some scanners send no Enter — flush after a short pause.
      timer = setTimeout(() => { if (buf.length >= MIN_LEN) { const c = buf; buf = ''; submit(c); } }, 120);
      if (buf.length > 2 && !typing) e.preventDefault();
    }
  }, true);

  /* ---------- start up ---------- */
  function init() {
    if (!mountButton()) return setTimeout(init, 500);
    let saved = '0';
    try { saved = localStorage.getItem(KEY) || '0'; } catch (e) {}
    if (saved === '1') setOn(true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
