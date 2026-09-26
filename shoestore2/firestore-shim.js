// ============================================================
//  firestore-shim.js
//  Lets the ORIGINAL Shoe IMS interface run on Firestore.
//
//  It recreates window.google.script.run, so Index.html keeps
//  calling google.script.run.getLiveStock() etc. exactly as before —
//  but the data now comes from Firestore instead of Apps Script.
//
//  Load in <head> BEFORE the app's own script.
// ============================================================
(function () {
  const CFG = {
    apiKey: "AIzaSyB-WPSe1SoIEC4JwednqMydhj_cvGgOOs8",
    authDomain: "make-digital-india-479fb.firebaseapp.com",
    projectId: "make-digital-india-479fb",
    storageBucket: "make-digital-india-479fb.firebasestorage.app",
    messagingSenderId: "356753740738",
    appId: "1:356753740738:web:71e098ed9d21ca911afc5b"
  };
  const PRODUCTS = "clients/shoestore/products";
  const MOVES    = "clients/shoestore/movements";
  const SALES    = "clients/shoestore/sales";
  const LOW = 5;

  let FB = null;                 // firebase modules, loaded once
  let ALL = [], BY_SKU = {}, GROUPS = {}, BRANDS = [];
  let USER = { name: 'User', role: 'staff', authorized: true };
  let ready = null;

  const flat = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const safeId = s => String(s).replace(/[\/#?%\[\]]/g, '-');
  const gkey = p => (p.brand || '') + '||' + (p.model || '') + '||' + (p.color || '');
  const todayStr = () => new Date().toISOString().slice(0, 10);
  const statusOf = q => q <= 0 ? 'out' : (q <= LOW ? 'low' : 'ok');

  async function boot() {
    const [appM, authM, fsM] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js")
    ]);
    const app = appM.initializeApp(CFG);
    const auth = authM.getAuth(app);
    let db;
    try { db = fsM.initializeFirestore(app, { localCache: fsM.persistentLocalCache() }); }
    catch (e) { db = fsM.initializeFirestore(app, {}); }
    FB = { app, auth, db, ...fsM, onAuthStateChanged: authM.onAuthStateChanged, signOut: authM.signOut };

    // wait for sign-in
    const u = await new Promise(res => {
      const off = authM.onAuthStateChanged(auth, x => { off(); res(x); });
    });
    if (!u) { location.replace('/login.html'); return new Promise(() => {}); }
    USER.name = u.displayName || u.email;
    try {
      const snap = await fsM.getDoc(fsM.doc(db, 'users', u.uid));
      if (!snap.exists()) { location.replace('/login.html?error=noaccess'); return new Promise(() => {}); }
      const p = snap.data();
      if (p.active === false) { await authM.signOut(auth); location.replace('/login.html?error=disabled'); return new Promise(() => {}); }
      USER.role = p.role || 'staff';
      USER.clientId = p.clientId || 'shoestore';
      if (p.businessName) USER.name = p.businessName;
    } catch (e) {}
    window.__IMS_USER = USER.name;
    await refreshIndex();
  }

  async function refreshIndex() {
    const qs = await FB.getDocs(FB.collection(FB.db, PRODUCTS));
    ALL = qs.docs.map(d => d.data());
    BY_SKU = {}; GROUPS = {}; const bs = {};
    ALL.forEach(p => {
      p.qty = Number(p.qty) || 0; p.mrp = Number(p.mrp) || 0;
      BY_SKU[flat(p.sku)] = p;
      if (p.code) BY_SKU[flat(p.code)] = p;      // short scan code
      if (p.brand) bs[p.brand] = 1;
      const k = gkey(p);
      (GROUPS[k] = GROUPS[k] || { brand: p.brand, model: p.model, color: p.color, sizes: [] }).sizes.push(p);
    });
    Object.values(GROUPS).forEach(g =>
      g.sizes.sort((a, b) => (parseFloat(a.size) || 999) - (parseFloat(b.size) || 999)));
    BRANDS = Object.keys(bs).sort();
  }
  function ensure() { return ready || (ready = boot()); }

  // Short numeric code used on printed barcodes. 1D laser scanners cannot
  // resolve a 20-character SKU on a 1x2 label, so each product gets a short
  // code; the SKU still prints as readable text.
  async function ensureCodes() {
    await ensure();
    const used = {}; ALL.forEach(p => { if (p.code) used[p.code] = 1; });
    let next = 100001, made = 0;
    for (const p of ALL) {
      if (p.code) continue;
      while (used[String(next)]) next++;
      p.code = String(next); used[p.code] = 1; made++;
      await FB.updateDoc(FB.doc(FB.db, PRODUCTS, safeId(p.sku)), { code: p.code });
      BY_SKU[flat(p.code)] = p;
    }
    return { assigned: made, total: ALL.length };
  }
  window.__imsEnsureCodes = ensureCodes;
  window.__imsAll = () => ALL;

  /* ---------- helpers the old UI expects ---------- */
  function parseCode(raw) {
    const up = String(raw).trim().toUpperCase(), seg = up.split('-');
    if (seg.length >= 3) {
      const a = seg[0].match(/([A-Z]{2,4}\d{3,5}[A-Z]{0,2})$/);
      const s = seg[1] && seg[1].match(/(\d{3,4})$/);
      if (a) { let sz = ''; if (s) { const n = parseInt(s[1], 10); sz = (n > 15 && n % 10 === 5) ? (n / 10).toString() : String(n); }
        return { token: a[1], size: sz }; }
    }
    return { token: up, size: '' };
  }
  function isPerBox(raw) { const s = String(raw).toUpperCase(); return /:\/\//.test(s) || /VERIFY|TRACK|AUTHENT/.test(s); }
  function findGroup(raw) {
    const p = BY_SKU[flat(raw)];
    if (p) return { g: GROUPS[gkey(p)], size: p.size };
    const pc = parseCode(raw), f = flat(pc.token);
    const p2 = BY_SKU[f];
    if (p2) return { g: GROUPS[gkey(p2)], size: pc.size || p2.size };
    let hit = null, amb = false;
    Object.values(GROUPS).forEach(g => {
      const m = flat(g.model);
      if (m === f || m.startsWith(f) || (f.length >= 3 && m.includes(f))) {
        if (hit && hit !== g) amb = true; else hit = g;
      }
    });
    return (hit && !amb) ? { g: hit, size: pc.size } : null;
  }
  const groupOut = (g, code, sz) => ({
    status: 'found', code: code, brand: g.brand, model: g.model, color: g.color,
    category: g.sizes[0].category || '', image: g.sizes[0].image || '', scannedSize: sz || '',
    sizes: g.sizes.map(p => ({ size: p.size, qty: p.qty, mrp: p.mrp, status: statusOf(p.qty) }))
  });

  /* ---------- the API the old UI calls ---------- */
  const API = {
    async bootstrap() { return { user: { authorized: true, name: USER.name, role: USER.role }, brands: BRANDS }; },
    async getBrands() { return { ok: true, brands: BRANDS }; },

    async getLiveStock(f) {
      f = f || {};
      let rows = ALL.slice();
      if (f.brand) rows = rows.filter(p => p.brand === f.brand);
      if (f.q) { const q = flat(f.q); rows = rows.filter(p => flat(p.model).includes(q) || flat(p.sku).includes(q)); }
      return { ok: true, data: rows.map(p => ({
        sku: p.sku, brand: p.brand, model: p.model, color: p.color, size: p.size,
        mrp: p.mrp, qty: p.qty, status: statusOf(p.qty), barcode: p.barcode || '', img: p.image || '' })) };
    },

    async getCatalogue() {
      const g = {};
      ALL.forEach(p => {
        const k = (p.brand || '') + '||' + (p.model || '');
        const x = g[k] = g[k] || { brand: p.brand, model: p.model, category: p.category || '',
          colors: {}, skus: 0, units: 0, mrpMin: Infinity, mrpMax: 0, img: '' };
        x.colors[p.color] = 1; x.skus++; x.units += p.qty;
        if (p.mrp) { x.mrpMin = Math.min(x.mrpMin, p.mrp); x.mrpMax = Math.max(x.mrpMax, p.mrp); }
        if (!x.img && p.image) x.img = p.image;
      });
      return { ok: true, data: Object.values(g).map(x => ({
        brand: x.brand, model: x.model, category: x.category,
        colors: Object.keys(x.colors).join(', '), numColors: Object.keys(x.colors).length,
        skus: x.skus, units: x.units, mrp: x.mrpMin === Infinity ? 0 : x.mrpMin, mrpMax: x.mrpMax, img: x.img }))
        .sort((a, b) => (a.brand + a.model).localeCompare(b.brand + b.model)) };
    },

    async lookupByBarcode(code) {
      if (!code) return { status: 'empty' };
      if (isPerBox(code)) return { status: 'perbox', code: code };
      const r = findGroup(code);
      if (!r) return { status: 'unknown', code: parseCode(code).token, scannedSize: parseCode(code).size };
      return groupOut(r.g, code, r.size);
    },

    async searchModels(q) {
      const f = flat(q); if (!f) return [];
      return Object.values(GROUPS)
        .filter(g => flat(g.model).includes(f) || flat(g.brand).includes(f))
        .slice(0, 25)
        .map(g => ({ brand: g.brand, model: g.model, color: g.color,
          sizes: g.sizes.length, units: g.sizes.reduce((s, p) => s + p.qty, 0) }));
    },

    async adjustStock(a) {
      const r = findGroup(a.code);
      if (!r) throw new Error('Unknown code: ' + a.code);
      const p = r.g.sizes.find(x => String(x.size) === String(a.size));
      if (!p) throw new Error('Size ' + a.size + ' not found');
      const qty = Math.max(1, Number(a.qty) || 1);
      const mode = String(a.mode || 'in').toLowerCase();
      const ref = FB.doc(FB.db, PRODUCTS, safeId(p.sku));
      const out = await FB.runTransaction(FB.db, async tx => {
        const s = await tx.get(ref);
        if (!s.exists()) throw new Error('SKU missing: ' + p.sku);
        const d = s.data();
        let delta = mode === 'in' ? qty : -qty; if (a.undo) delta = -delta;
        const cur = Number(d.qty) || 0, next = cur + delta;
        if (next < 0) throw new Error('Only ' + cur + ' in stock for size ' + d.size);
        tx.update(ref, { qty: next });
        tx.set(FB.doc(FB.collection(FB.db, MOVES)), { ts: FB.serverTimestamp(), date: todayStr(),
          sku: p.sku, code: a.code, brand: d.brand, model: d.model, color: d.color, size: d.size,
          mode: (a.undo ? 'UNDO-' : '') + mode.toUpperCase(), delta, newQty: next, user: USER.name });
        let amount = 0;
        if (mode === 'sale') {
          amount = (Number(d.mrp) || 0) * qty * (a.undo ? -1 : 1);
          tx.set(FB.doc(FB.collection(FB.db, SALES)), { ts: FB.serverTimestamp(), date: todayStr(),
            sku: p.sku, brand: d.brand, model: d.model, color: d.color, size: d.size,
            mrp: Number(d.mrp) || 0, qty: qty * (a.undo ? -1 : 1), amount, user: USER.name });
        }
        return { newQty: next, delta, mrp: Number(d.mrp) || 0, amount,
                 brand: d.brand, model: d.model, color: d.color, size: d.size };
      });
      p.qty = out.newQty;                         // keep local index fresh
      return { ...out, mode, undo: !!a.undo };
    },

    async getMovements(n) {
      const qs = await FB.getDocs(FB.query(FB.collection(FB.db, MOVES),
        FB.orderBy('ts', 'desc'), FB.limit(Number(n) || 200)));
      return { ok: true, data: qs.docs.map(d => { const m = d.data();
        return { ts: m.ts && m.ts.toDate ? m.ts.toDate().toLocaleString('en-IN',
                   { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : (m.date || ''),
          code: m.sku, brand: m.brand, model: m.model, color: m.color, size: m.size,
          mode: m.mode, delta: Number(m.delta) || 0, newQty: m.newQty, user: m.user }; }) };
    },

    async getSalesLog(n) {
      const qs = await FB.getDocs(FB.query(FB.collection(FB.db, SALES),
        FB.orderBy('ts', 'desc'), FB.limit(Number(n) || 300)));
      let tq = 0, tr = 0;
      const data = qs.docs.map(d => { const s = d.data();
        tq += Number(s.qty) || 0; tr += Number(s.amount) || 0;
        return { date: s.date, brand: s.brand, model: s.model, color: s.color, size: s.size,
          mrp: s.mrp, qty: s.qty, amount: s.amount, customer: '', notes: '', user: s.user }; });
      return { ok: true, data, totalQty: tq, totalRevenue: tr };
    },

    async getItemMaster(f) {
      f = f || {};
      let rows = ALL.slice();
      if (f.brand) rows = rows.filter(p => p.brand === f.brand);
      if (f.q) { const q = flat(f.q); rows = rows.filter(p => flat(p.model).includes(q) || flat(p.sku).includes(q)); }
      return { ok: true, data: rows.slice(0, 300).map(p => ({
        sku: p.sku, brand: p.brand, model: p.model, color: p.color, size: p.size,
        mrp: p.mrp, qty: p.qty, barcode: p.barcode || '', category: p.category || '', image: p.image || '' })),
        total: rows.length };
    },

    async createProduct(p) {
      if (USER.role !== 'admin') throw new Error('Admins only');
      const brand = String(p.brand || '').trim().toUpperCase();
      const model = String(p.model || '').trim().toUpperCase();
      const color = (String(p.color || '').trim() || '-').toUpperCase();
      const sizes = (Array.isArray(p.sizes) ? p.sizes : String(p.sizes || '').split(','))
        .map(s => String(s).trim()).filter(Boolean);
      if (!brand || !model || !sizes.length) throw new Error('Brand, model and sizes are required');
      const mrp = Number(p.mrp) || 0;
      if (!mrp) throw new Error('MRP cannot be 0');
      for (const size of sizes) {
        const sku = (brand + '-' + model + '-' + color + '-' + size).toUpperCase();
        const code = String(100001 + ALL.length + Math.floor(Math.random() * 900));
        await FB.setDoc(FB.doc(FB.db, PRODUCTS, safeId(sku)),
          { sku, code, brand, model, color, size, mrp, qty: Math.max(0, Number(p.qty) || 0),
            reorder_level: Number(p.reorder_level) || LOW, category: p.category || '', gender: p.gender || '' });
      }
      await refreshIndex();
      return { ok: true, created: sizes.length };
    },

    async updateItem(u) {
      const sku = u.sku || u.code;
      const patch = {};
      ['mrp', 'qty', 'reorder_level'].forEach(k => { if (u[k] !== undefined && u[k] !== '') patch[k] = Number(u[k]) || 0; });
      ['color', 'category', 'gender', 'image', 'barcode'].forEach(k => { if (u[k] !== undefined) patch[k] = String(u[k]); });
      await FB.updateDoc(FB.doc(FB.db, PRODUCTS, safeId(sku)), patch);
      const p = BY_SKU[flat(sku)]; if (p) Object.assign(p, patch);
      return { ok: true };
    },

    async mapBarcode(code, brand, model, color) {
      const g = GROUPS[(brand || '') + '||' + (model || '') + '||' + (color || '-')];
      if (!g) throw new Error('Product not found');
      for (const p of g.sizes) {
        const list = String(p.barcode || '').split(',').map(x => x.trim()).filter(Boolean);
        if (list.indexOf(code) === -1) list.push(code);
        await FB.updateDoc(FB.doc(FB.db, PRODUCTS, safeId(p.sku)), { barcode: list.join(',') });
        p.barcode = list.join(',');
      }
      return { ok: true, linked: g.sizes.length };
    },

    async getDashboardData() {
      let totalSkus = 0, totalUnits = 0, zero = 0, low = 0;
      const models = {}, lowList = [];
      ALL.forEach(p => {
        models[p.brand + '|' + p.model] = 1;
        if (p.qty > 0) { totalSkus++; totalUnits += p.qty; } else zero++;
        const lv = Number(p.reorder_level) || LOW;
        if (p.qty <= lv) { low++;
          if (lowList.length < 60) lowList.push({ brand: p.brand, model: p.model, color: p.color, size: p.size, qty: p.qty }); }
      });
      let todayIn = 0, todayOut = 0, todaySalesQty = 0, todayRevenue = 0;
      const series = {}, order = []; const top = {};
      for (let i = 6; i >= 0; i--) { const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
        order.push(d); series[d] = { date: d.slice(5), qty: 0, revenue: 0 }; }
      try {
        const sq = await FB.getDocs(FB.query(FB.collection(FB.db, SALES), FB.orderBy('ts', 'desc'), FB.limit(400)));
        const td = todayStr(), cut = Date.now() - 30 * 864e5;
        sq.forEach(x => { const s = x.data();
          if (s.date === td) { todaySalesQty += Number(s.qty) || 0; todayRevenue += Number(s.amount) || 0; }
          if (series[s.date]) { series[s.date].qty += Number(s.qty) || 0; series[s.date].revenue += Number(s.amount) || 0; }
          const t = s.ts && s.ts.toDate ? s.ts.toDate().getTime() : 0;
          if (t > cut) { const k = (s.brand || '') + ' ' + (s.model || ''); top[k] = (top[k] || 0) + (Number(s.qty) || 0); }
        });
      } catch (e) {}
      try {
        const mq = await FB.getDocs(FB.query(FB.collection(FB.db, MOVES), FB.where('date', '==', todayStr()), FB.limit(400)));
        mq.forEach(x => { const m = x.data();
          if (m.delta > 0) todayIn += m.delta; else todayOut += -m.delta; });
      } catch (e) {}
      return { ok: true, userName: USER.name, role: USER.role,
        generatedAt: new Date().toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
        totalSkus, totalUnits, totalModels: Object.keys(models).length,
        zeroStock: zero, lowStock: low, threshold: LOW,
        todayIn, todayOut, todaySalesQty, todayRevenue,
        week: order.map(k => series[k]), brands: BRANDS,
        topSellers: Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 6)
          .map(([k, v]) => ({ name: k, qty: v })),
        lowList };
    },

    // Labels: build the sheet here and hand back a blob URL the app can open.
    async stageLabels(pick, format) {
      const items = [];
      (pick || []).forEach(x => {
        const sku = x.sku || x.code || x;
        const p = BY_SKU[flat(sku)];
        const copies = Math.max(1, Number(x.copies) || 1);
        if (p) for (let i = 0; i < copies; i++) items.push(p);
      });
      if (!items.length) throw new Error('Nothing selected');
      const cells = items.map(p => `<div class="c">
        <div class="m">${p.brand} ${p.model}</div>
        <svg class="bc" data-v="${p.sku}"></svg>
        <div class="s">${p.sku}</div>
        <div class="s">Size ${p.size}${p.mrp ? ' · ₹' + p.mrp : ''}</div></div>`).join('');
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Labels</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
        <style>body{font-family:Arial,sans-serif;margin:8px}
        .c{display:inline-block;width:31%;margin:1%;padding:5px 3px;border:1px dashed #ccc;
           text-align:center;font-size:9px;vertical-align:top}
        .c .m{font-weight:700}.c .bc{width:100%;height:34px}
        @media print{.c{border:none}button{display:none}}</style></head><body>
        <button onclick="window.print()" style="padding:10px 18px;margin-bottom:10px">Print</button>
        <div>${cells}</div>
        <script>document.querySelectorAll('.bc').forEach(function(s){
          try{JsBarcode(s,s.dataset.v,{format:'CODE128',displayValue:false,margin:0,height:34,width:1.2});}catch(e){}
        });<\/script></body></html>`;
      const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
      return { key: 'local', url };
    },

    async refreshIndex() { await refreshIndex(); return 'Index rebuilt: ' + ALL.length + ' rows.'; },
    async matchLabelText() { throw new Error('Label OCR is not used — scan your printed label instead.'); },
    async parseInvoiceText() { throw new Error('Invoice import is not available in this version.'); },
    async importInvoiceLines() { throw new Error('Invoice import is not available in this version.'); }
  };

  /* ---------- recreate google.script.run ---------- */
  function runner() {
    let onS = null, onF = null, uo = null;
    const api = new Proxy({}, { get(_t, prop) {
      if (prop === 'withSuccessHandler') return cb => { onS = cb; return api; };
      if (prop === 'withFailureHandler') return cb => { onF = cb; return api; };
      if (prop === 'withUserObject')     return o  => { uo = o;  return api; };
      return function () {
        const args = [...arguments];
        ensure()
          .then(() => { const fn = API[prop]; if (!fn) throw new Error('Unknown function: ' + prop); return fn(...args); })
          .then(r => { if (onS) onS(r, uo); })
          .catch(e => { if (onF) onF(e instanceof Error ? e : new Error(String(e))); });
        return api;
      };
    }});
    return api;
  }
  window.google = window.google || {};
  window.google.script = window.google.script || {};
  Object.defineProperty(window.google.script, 'run', { get: runner });
  window.google.script.host = window.google.script.host || { close(){}, setHeight(){}, editor:{} };
  window.google.script.url  = window.google.script.url  || { getLocation(cb){ try{ cb && cb({parameter:{}}); }catch(e){} } };

  ensure();   // start loading immediately
})();
