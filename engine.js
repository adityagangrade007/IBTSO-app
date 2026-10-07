"use strict";
/* In-browser data engine: synthetic demo data, share calculation, auth/RBAC, local persistence.
   Replaces the server so the whole demo is static and deployable on Vercel. */
const CATEGORIES = ["Air Conditioners", "Refrigerators", "Washing Machines", "Cooking Ranges", "Dishwashers", "TV / Built-ins"];
const BRANDS = {
  "Air Conditioners": { LG: 22, Samsung: 10, Midea: 14, Gree: 16, Panasonic: 8, Haier: 7, Hitachi: 6, Toshiba: 5, Daikin: 6, General: 6 },
  "Refrigerators": { LG: 20, Samsung: 19, Hitachi: 9, Haier: 11, Midea: 10, Toshiba: 8, Panasonic: 6, Whirlpool: 7, Bosch: 6, Philips: 2 },
  "Washing Machines": { LG: 21, Samsung: 17, Haier: 12, Midea: 13, Toshiba: 8, Hitachi: 6, Panasonic: 6, Bosch: 9, Candy: 6, Philips: 2 },
  "Cooking Ranges": { LG: 14, Samsung: 8, Midea: 15, Haier: 9, Ariston: 13, Bosch: 11, Beko: 12, Toshiba: 6, Hitachi: 4, Philips: 2 },
  "Dishwashers": { Bosch: 24, Samsung: 14, LG: 15, Midea: 14, Haier: 8, Beko: 13, Hitachi: 5, Toshiba: 4, Philips: 3 },
  "TV / Built-ins": { Samsung: 24, LG: 19, Hisense: 13, TCL: 12, Sony: 8, Toshiba: 8, Philips: 7, Haier: 5, Midea: 4 },
};
const MONTHS = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"];
const DRIFT = { Midea: .045, Haier: .02, Hisense: .04, TCL: .03, LG: -.012, Samsung: .008, Gree: -.015, Panasonic: -.02, Hitachi: -.008, Bosch: .01, Beko: .015 };
const GEO = { "Muscat": { Muscat: 18, Seeb: 24, Bawshar: 12, Muttrah: 8, Amerat: 4 }, "Batinah": { Sohar: 18, Suwaiq: 8, Barka: 12, Rustaq: 7, Saham: 6, Shinas: 4 },
  "Dhofar": { Salalah: 22, Taqah: 4, Sadah: 3 }, "Dakhiliyah": { Nizwa: 14, Bahla: 5, Izki: 4, Adam: 3, Samail: 5 }, "Sharqiyah": { Sur: 10, Ibra: 6, Bidiyah: 3, Sinaw: 3 },
  "Dhahirah & Buraimi": { Ibri: 10, Buraimi: 10, Yanqul: 3, Dank: 4 } };
const REGBIAS = { "Muscat": { Samsung: 1.15, Sony: 1.4, Bosch: 1.3, LG: 1.05 }, "Batinah": { LG: 1.1, Gree: 1.15, Midea: 1.1 }, "Dhofar": { Midea: 1.3, Haier: 1.25, Hisense: 1.2, Samsung: .9 },
  "Dakhiliyah": { Gree: 1.2, Haier: 1.1, TCL: 1.2 }, "Sharqiyah": { LG: 1.2, Toshiba: 1.2, Gree: 1.1 }, "Dhahirah & Buraimi": { Midea: 1.15, Hisense: 1.2, TCL: 1.15, Samsung: .9 } };
const P1 = ["Al Noor", "Al Fajr", "Gulf Star", "Oman Prime", "Al Khaleej", "Sunrise", "Royal", "Al Ameen", "Desert Rose", "Al Barakah", "Bin Salim", "Al Wafa", "Modern", "Falcon", "Al Hikma", "Zubair", "Al Jabal", "Delta", "Majan", "Al Shorouk", "Pearl", "Horizon", "Al Baraka", "Omani Home", "Al Mazoon", "Nakheel", "Salam", "Union", "Al Madina", "Golden"];
const P2 = ["Electronics", "Home Appliances", "Trading", "Electric Centre", "Appliances", "Home Centre", "Electricals", "Digital House"];

// ---- deterministic PRNG so every viewer sees the same demo data ----
let _s = 230; const rnd = () => { _s |= 0; _s = _s + 0x6D2B79F5 | 0; let t = Math.imul(_s ^ _s >>> 15, 1 | _s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const pick = a => a[Math.floor(rnd() * a.length)], uni = (a, b) => a + rnd() * (b - a);
const gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
const wpick = (ks, ws) => { let r = rnd() * ws.reduce((a, b) => a + b, 0); for (let i = 0; i < ks.length; i++) if ((r -= ws[i]) <= 0) return ks[i]; return ks.at(-1); };

const DEALERS = [], DATA = new Map(); // DATA: "month|dealer|category" -> {brand: n}
(function seed() {
  const raw = [], names = new Set();
  for (const [region, cities] of Object.entries(GEO)) for (const [city, n] of Object.entries(cities)) for (let i = 0; i < n; i++) {
    let nm; do nm = pick(P1) + " " + pick(P2); while (names.has(nm)); names.add(nm); raw.push([nm, city, region, pick([.5, .7, .9, 1, 1.2, 1.5, 2])]);
  }
  for (let i = raw.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [raw[i], raw[j]] = [raw[j], raw[i]]; }
  raw.forEach(([name, city, region, size], k) => {
    const id = k + 1; DEALERS.push({ id, code: "IR-" + String(id).padStart(3, "0"), name, city, region });
    const loyal = {}, stocks = {}, base = {};
    CATEGORIES.forEach(c => { loyal[c] = pick(Object.keys(BRANDS[c])); stocks[c] = rnd() < .93; base[c] = Math.max(2, Math.round((7 + 2 * gauss()) * size)); });
    MONTHS.forEach((m, mi) => CATEGORIES.forEach(c => {
      if (!stocks[c]) return;
      const total = Math.max(2, base[c] + pick([-1, 0, 0, 0, 1])), ks = Object.keys(BRANDS[c]);
      const ws = ks.map(b => BRANDS[c][b] * (REGBIAS[region][b] || 1) * Math.pow(1 + (DRIFT[b] || 0), mi) * (loyal[c] === b ? 1.8 : 1) * uni(.6, 1.4));
      const cnt = {}; for (let t = 0; t < total; t++) { const b = wpick(ks, ws); cnt[b] = (cnt[b] || 0) + 1; }
      DATA.set(`${m}|${id}|${c}`, cnt);
    }));
  });
})();
const DMAP = Object.fromEntries(DEALERS.map(d => [d.id, d]));

// ---- persistence (browser only) ----
const LS = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } } };
const OVR = LS.get("ibtso_ovr", {}); Object.entries(OVR).forEach(([k, v]) => Object.keys(v).length ? DATA.set(k, v) : DATA.delete(k));
let ROWS = null; const rows = () => ROWS || (ROWS = [...DATA].flatMap(([k, br]) => { const [m, d, c] = k.split("|"); const dl = DMAP[d]; return Object.entries(br).map(([b, n]) => ({ m, d: +d, c, b, n, city: dl.city, region: dl.region })); }));
function saveEntry(m, d, c, brands) { const k = `${m}|${d}|${c}`, v = Object.fromEntries(Object.entries(brands).map(([b, n]) => [b, Math.max(0, Math.min(99, +n || 0))]).filter(x => x[1] > 0)); OVR[k] = v; v && Object.keys(v).length ? DATA.set(k, v) : DATA.delete(k); ROWS = null; LS.set("ibtso_ovr", OVR); }
function resetData() { localStorage.removeItem("ibtso_ovr"); location.reload(); }

// ---- users / RBAC ----
const ROLES = {
  admin: { label: "IBTSO Admin", any: true, collect: true, users: true, exportData: true, dealers: true, rawData: true },
  manager: { label: "Brand Manager", exportData: true, dealers: true, rawData: false },
  viewer: { label: "Brand Viewer", exportData: true, dealers: false, rawData: false },
};
const can = p => !!ROLES[S.user?.role]?.[p];
const DEMO_USERS = [{ email: "admin@ibtso.com", name: "IBTSO Admin", pw: "ibtso123", role: "admin", brand: "*" },
  { email: "lg@demo.com", name: "LG Category Head", pw: "demo123", role: "manager", brand: "LG" },
  { email: "samsung@demo.com", name: "Samsung Analyst", pw: "demo123", role: "manager", brand: "Samsung" },
  { email: "midea@demo.com", name: "Midea Sales Lead", pw: "demo123", role: "manager", brand: "Midea" },
  { email: "toshiba@demo.com", name: "Toshiba Manager", pw: "demo123", role: "manager", brand: "Toshiba" },
  { email: "philips@demo.com", name: "Philips Manager", pw: "demo123", role: "manager", brand: "Philips" },
  { email: "haier@demo.com", name: "Haier Manager", pw: "demo123", role: "manager", brand: "Haier" },
  { email: "hitachi@demo.com", name: "Hitachi Manager", pw: "demo123", role: "manager", brand: "Hitachi" },
  { email: "viewer@lg.demo.com", name: "LG Sales Rep (view-only)", pw: "demo123", role: "viewer", brand: "LG" }];
const users = () => { const u = LS.get("ibtso_users", null); if (u) return u; LS.set("ibtso_users", DEMO_USERS); return DEMO_USERS; };
const Auth = {
  login(email, pw) { const u = users().find(x => x.email === email.trim().toLowerCase() && x.pw === pw); if (!u) throw new Error("Invalid email or password"); const { pw: _, ...s } = u; return s; },
  signup({ name, email, pw, brand }) {
    email = email.trim().toLowerCase(); if (!name.trim() || !/^\S+@\S+\.\S+$/.test(email)) throw new Error("Enter your name and a valid email");
    if (pw.length < 6) throw new Error("Password must be at least 6 characters"); const u = users();
    if (u.some(x => x.email === email)) throw new Error("An account with this email already exists");
    u.push({ email, name: name.trim(), pw, role: "viewer", brand }); LS.set("ibtso_users", u); return Auth.login(email, pw);
  },
  list: () => users().map(({ pw, ...r }) => r),
  update(email, patch) { const u = users(); const x = u.find(y => y.email === email); if (x) Object.assign(x, patch); LS.set("ibtso_users", u); },
  remove(email) { LS.set("ibtso_users", users().filter(x => x.email !== email)); },
  add(o) { const u = users(); if (u.some(x => x.email === o.email.toLowerCase())) throw new Error("Email already exists"); u.push({ ...o, email: o.email.toLowerCase() }); LS.set("ibtso_users", u); },
};

// ---- queries ----
const GKEY = { brand: r => r.b, category: r => r.c, city: r => r.city, region: r => r.region, dealer: r => r.d, month: r => r.m };
function share(p) {
  const out = new Map(), g = GKEY[p.group] || (() => "All");
  for (const r of rows()) {
    if (p.month && r.m !== p.month || p.category && r.c !== p.category || p.region && r.region !== p.region || p.city && r.city !== p.city || p.dealer && r.d != p.dealer) continue;
    const k = g(r); let o = out.get(k); if (!o) out.set(k, o = { key: k, brands: {}, total: 0 }); o.brands[r.b] = (o.brands[r.b] || 0) + r.n; o.total += r.n;
  }
  return [...out.values()].sort((a, b) => String(a.key).localeCompare(String(b.key), undefined, { numeric: true }));
}
function meta() {
  const regions = {}; DEALERS.forEach(d => (regions[d.region] = regions[d.region] || new Set()).add(d.city));
  const cov = {}, seen = new Set(); DATA.forEach((_, k) => { const [m, d] = k.split("|"); if (!seen.has(m + d)) { seen.add(m + d); cov[m] = (cov[m] || 0) + 1; } });
  const months = [...new Set([...DATA.keys()].map(k => k.split("|")[0]))].sort();
  return { months, categories: CATEGORIES, allBrands: [...new Set(Object.values(BRANDS).flatMap(Object.keys))].sort(), regions: Object.fromEntries(Object.entries(regions).map(([k, v]) => [k, [...v].sort()])), dealers: DEALERS, coverage: cov, catalog: Object.fromEntries(Object.entries(BRANDS).map(([c, b]) => [c, Object.keys(b)])) };
}
const csvEsc = v => /[",\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : v;
const toCsv = (h, rs) => [h, ...rs].map(r => r.map(csvEsc).join(",")).join("\n");
function exportCsv(p) {
  if (p.kind === "raw") return toCsv(["month", "dealer_code", "dealer", "city", "region", "category", "brand", "models_displayed"],
    rows().filter(r => (!p.month || r.m === p.month) && (!p.category || r.c === p.category) && (!p.region || r.region === p.region) && (!p.city || r.city === p.city) && (!p.dealer || r.d == p.dealer))
      .sort((a, b) => a.m.localeCompare(b.m) || a.d - b.d).map(r => [r.m, DMAP[r.d].code, DMAP[r.d].name, r.city, r.region, r.c, r.b, r.n]));
  const out = []; share({ ...p, group: p.group === "dealer" ? "dealer" : p.group }).forEach(o => Object.entries(o.brands).sort((a, b) => b[1] - a[1]).forEach(([b, n]) => out.push([p.group === "dealer" ? DMAP[o.key].code : o.key, b, n, o.total, (100 * n / o.total).toFixed(2)])));
  return toCsv([p.group || "scope", "brand", "models_displayed", "total_models", "visibility_share_pct"], out);
}
function importCsv(text) {
  const lines = text.trim().split(/\r?\n/), h = lines.shift().split(",").map(s => s.trim()), ix = n => h.indexOf(n), g = {}, errors = [], codes = Object.fromEntries(DEALERS.map(d => [d.code, d.id]));
  lines.forEach((l, i) => { const c = l.split(",").map(s => s.trim()); try { const d = codes[c[ix("dealer_code")]], cat = c[ix("category")], n = parseInt(c[ix("models_displayed")] ?? c[ix("models")]); if (!d || !CATEGORIES.includes(cat) || isNaN(n) || !/^\d{4}-\d\d$/.test(c[ix("month")])) throw 0; (g[`${c[ix("month")]}|${d}|${cat}`] = g[`${c[ix("month")]}|${d}|${cat}`] || {})[c[ix("brand")]] = n; } catch { errors.push(`row ${i + 2}: invalid`); } });
  Object.entries(g).forEach(([k, b]) => { const [m, d, c] = k.split("|"); saveEntry(m, +d, c, b); });
  return { imported: Object.keys(g).length, errors: errors.slice(0, 10) };
}
