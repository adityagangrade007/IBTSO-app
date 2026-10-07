"use strict";
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const pct = (x, d = 1) => x == null || isNaN(x) ? "–" : (100 * x).toFixed(d) + "%";
const PAL = ["#0f766e", "#2563eb", "#d97706", "#7c3aed", "#db2777", "#475569", "#0891b2", "#65a30d", "#dc2626", "#a16207"];
const S = { user: null, meta: null, f: { month: "", category: "", region: "", city: "", dealer: "" }, brand: "", view: "dashboard", rivals: null, dealerId: null, dsort: ["share", -1], dpage: 0, dq: "", level: "region" };
const IC = { dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  categories: '<path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
  competitors: '<path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="m21 3-7 7"/><path d="m3 3 7 7"/><path d="M16 21h5v-5"/><path d="M8 21H3v-5"/><path d="m21 21-7-7"/><path d="m3 21 7-7"/>',
  trend: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
  "geo:city": '<path d="M6 22V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v18"/><path d="M2 22h20"/><path d="M10 7h4M10 11h4M10 15h4"/>',
  "geo:region": '<path d="M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3V7Z"/><path d="M9 4v13M15 7v13"/>',
  "geo:national": '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20Z"/>',
  dealers: '<path d="M3 9 4.5 4h15L21 9"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M5 12v8h14v-8"/><path d="M10 20v-5h4v5"/>',
  reports: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="m9 15 3 3 3-3"/>',
  collect: '<path d="M12 20h9"/><path d="M16.4 3.6a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>' };
const icon = k => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${IC[k] || ""}</svg>`;
const NAV = [["Intelligence", [["dashboard", "Executive Dashboard"], ["categories", "Category Visibility"], ["competitors", "Brand vs Competitor"], ["trend", "Monthly Trend"]]],
  ["Benchmarks", [["geo:city", "City Benchmark"], ["geo:region", "Regional Benchmark"], ["geo:national", "National Benchmark"]]],
  ["Dealers", [["dealers", "Dealer Network (230)"]]], ["Outputs", [["reports", "Reports / Export"]]]];

// ---------- data helpers ----------
const cache = {};
async function api(path, params, opt) {
  const p = params || {};
  if (path === "meta") return meta();
  if (path === "share") { const k = JSON.stringify(p); return cache[k] || (cache[k] = share(p)); }
  if (path === "dealer-entry") return DATA.get(`${p.month}|${p.dealer}|${p.category}`) || {};
  if (path === "entry") { if (!can("collect")) throw new Error("forbidden"); const b = JSON.parse(opt.body); saveEntry(b.month, b.dealer, b.category, b.brands); return { ok: true }; }
  if (path === "import") { if (!can("collect")) throw new Error("forbidden"); return importCsv(opt.body); }
}
const sh = (p, g) => api("share", { ...p, group: g });
const F = (over = {}, drop = []) => { const o = { ...S.f, ...over }; drop.forEach(k => delete o[k]); return o; };
const get = (o, b) => o && o.total ? (o.brands[b] || 0) / o.total : null;
const one = r => r[0] || { brands: {}, total: 0 };
const byKey = rows => Object.fromEntries(rows.map(o => [o.key, o]));
const rank = (o, b) => { const e = Object.entries(o.brands).sort((a, c) => c[1] - a[1]); const i = e.findIndex(x => x[0] === b); return i < 0 ? null : i + 1; };
const leaders = (o, n = 99) => Object.entries(o.brands).sort((a, c) => c[1] - a[1]).slice(0, n).map(([b, v]) => ({ b, v, s: v / o.total }));
const prevMonth = () => { const m = S.meta.months, i = m.indexOf(S.f.month); return i > 0 ? m[i - 1] : null; };
const mlabel = m => { const [y, mo] = m.split("-"); return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][+mo - 1] + " " + y.slice(2); };
const dlt = (a, b) => a == null || b == null ? `<span class="fl">–</span>` : (d => `<span class="${d > 0.0005 ? "up" : d < -0.0005 ? "dn" : "fl"}">${d > 0.0005 ? "▲" : d < -0.0005 ? "▼" : "•"} ${Math.abs(d * 100).toFixed(1)} pts</span>`)(a - b);
const bcol = b => b === S.brand ? PAL[0] : null;
const dealerById = id => S.meta.dealers.find(d => d.id == id);
const scopeText = () => [S.f.category || "All categories", S.f.dealer ? dealerById(S.f.dealer)?.name : S.f.city || S.f.region || "Oman", mlabel(S.f.month)].join(" · ");

// ---------- components ----------
const kpi = (l, v, s) => `<div class="card kpi"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${s || ""}</div></div>`;
const card = (t, sub, body, cls = "") => `<div class="card ${cls}"><h3>${t}</h3><div class="sub">${sub || ""}</div>${body}</div>`;
function bars(rows, { max, mark } = {}) { // rows: {label,v(0-1),txt,hl}
  max = max || Math.max(...rows.map(r => r.v), 0.01);
  return `<div class="bars">${rows.map(r => `<div class="br ${r.hl ? "hl" : ""}"><span class="lb" title="${esc(r.label)}">${esc(r.label)}</span><span class="t"><div class="f" style="width:${Math.max(0, r.v / max * 100)}%"></div>${r.mark != null ? `<i class="mk" title="National benchmark ${pct(r.mark)}" style="left:${r.mark / max * 100}%"></i>` : ""}</span><span class="n">${r.txt ?? pct(r.v)}</span></div>`).join("")}</div>`;
}
function line(series, labels, h = 250) { // series [{name,color,vals}]
  const W = 720, L = 40, R = 28, T = 12, B = 26; const all = series.flatMap(s => s.vals).filter(v => v != null);
  const mx = Math.max(0.05, ...all) * 1.12, mn = Math.min(...all, mx) * 0.85; const lo = Math.max(0, Math.floor(mn * 40) / 40), hi = Math.ceil(mx * 40) / 40;
  const x = i => L + i * (W - L - R) / Math.max(1, labels.length - 1), y = v => T + (1 - (v - lo) / (hi - lo || 1)) * (h - T - B);
  let g = ""; for (let k = 0; k <= 4; k++) { const v = lo + (hi - lo) * k / 4; g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#e2e8f0"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${(v * 100).toFixed(0)}%</text>`; }
  labels.forEach((l, i) => g += `<text x="${x(i)}" y="${h - 6}" text-anchor="middle">${mlabel(l)}</text>`);
  series.forEach(s => {
    const pts = s.vals.map((v, i) => v == null ? null : [x(i), y(v)]).filter(Boolean);
    g += `<polyline fill="none" stroke="${s.color}" stroke-width="${s.hl ? 3 : 2}" points="${pts.map(p => p.join(",")).join(" ")}"/>`;
    s.vals.forEach((v, i) => { if (v != null) g += `<circle cx="${x(i)}" cy="${y(v)}" r="${s.hl ? 4 : 3}" fill="${s.color}"><title>${esc(s.name)} · ${mlabel(labels[i])}: ${pct(v)}</title></circle>`; });
  });
  return `<svg viewBox="0 0 ${W} ${h}" width="100%" role="img">${g}</svg><div class="legend">${series.map(s => `<span style="--c:${s.color}">${esc(s.name)}</span>`).join("")}</div>`;
}
const stack = (o, n = 6) => { const t = leaders(o); const colors = {}; t.slice(0, n).forEach((x, i) => colors[x.b] = x.b === S.brand ? PAL[0] : ["#94a3b8", "#b6c2d0", "#cbd5e1", "#9fb0c3", "#dbe3ec"][i % 5]);
  return `<div class="stack" title="${esc(t.map(x => x.b + " " + pct(x.s)).join(" | "))}">${t.map(x => `<i style="width:${x.s * 100}%;background:${x.b === S.brand ? PAL[0] : colors[x.b] || "#e2e8f0"};border-right:1px solid #fff"></i>`).join("")}</div>`; };
const heat = (d) => { if (d == null) return "–"; const a = Math.min(.5, Math.abs(d) * 6); return `<span class="cell" style="background:${d >= 0 ? `rgba(21,128,61,${a})` : `rgba(185,28,28,${a})`}">${d >= 0 ? "+" : ""}${(d * 100).toFixed(1)}</span>`; };

// ---------- shell ----------
function logout() { S.user = null; sessionStorage.removeItem("u"); Object.keys(cache).forEach(k => delete cache[k]); renderLogin(); }
function renderLogin(err = "", mode = "in") {
  const up = mode === "up";
  $("#app").innerHTML = `<div class="login"><form class="box" id="lf"><div class="logo"><i>▮</i> IBTSO Retail Intelligence</div><h2>${up ? "Create account" : "Sign in"}</h2><p>Brand visibility intelligence across Oman's 230 Independent Retailers.</p>
  ${up ? `<label>Full name</label><input id="nm" autocomplete="name"><label>Brand</label><select id="br">${["LG", "Samsung", "Midea", "Toshiba", "Philips", "Haier", "Hitachi", "Gree", "Panasonic", "Bosch", "Hisense", "TCL", "Sony"].map(b => `<option>${b}</option>`).join("")}</select>` : ""}
  <label>Email</label><input id="em" value="${up ? "" : "admin@ibtso.com"}" autocomplete="username"><label>Password</label><input id="pw" type="password" value="${up ? "" : "ibtso123"}" autocomplete="${up ? "new-password" : "current-password"}">
  <div class="err" id="er">${err}</div><button class="btn" style="width:100%">${up ? "Create account" : "Sign in"}</button>
  <div style="text-align:center;margin-top:12px;font-size:13px">${up ? "Already have an account?" : "New to the platform?"} <a href="#" id="sw" style="color:var(--acc);font-weight:600">${up ? "Sign in" : "Sign up"}</a></div>
  ${up ? `<div class="demo">New accounts start as <b>Brand Viewer</b> (brand-level data only). An IBTSO admin can upgrade the role.</div>` : `<div class="demo"><b>Demo accounts</b> (click to fill)<br>
  <span class="chip" data-e="admin@ibtso.com" data-p="ibtso123">Admin · IBTSO</span><span class="chip" data-e="lg@demo.com">Manager · LG</span><span class="chip" data-e="samsung@demo.com">Manager · Samsung</span><span class="chip" data-e="midea@demo.com">Manager · Midea</span><span class="chip" data-e="viewer@lg.demo.com">Viewer · LG</span><br>
  <span style="display:block;margin-top:8px">Other managers: toshiba / philips / haier / hitachi @demo.com. Password <code>demo123</code> (admin: <code>ibtso123</code>). All data is synthetic.</span></div>`}</form></div>`;
  document.querySelectorAll(".chip").forEach(c => c.onclick = () => { $("#em").value = c.dataset.e; $("#pw").value = c.dataset.p || "demo123"; });
  $("#sw").onclick = e => { e.preventDefault(); renderLogin("", up ? "in" : "up"); };
  $("#lf").onsubmit = e => { e.preventDefault(); try { S.user = up ? Auth.signup({ name: $("#nm").value, email: $("#em").value, pw: $("#pw").value, brand: $("#br").value }) : Auth.login($("#em").value, $("#pw").value); sessionStorage.setItem("u", JSON.stringify(S.user)); S.view = "dashboard"; location.hash = ""; boot(); } catch (x) { $("#er").textContent = x.message; } };
}
async function boot() {
  S.meta = await api("meta"); const m = S.meta.months; S.f.month = m[m.length - 1]; if (S.meta.coverage[S.f.month] < 100 && m.length > 1) S.f.month = m[m.length - 2];
  S.brand = can("any") ? "LG" : S.user.brand; S.view = location.hash.slice(1) || "dashboard"; render();
}
const ACCESS = { dealers: "dealers", dealer: "dealers", reports: "exportData", collect: "collect", users: "users" };
const allowed = v => !ACCESS[v] || can(ACCESS[v]);
function go(v) { S.view = v; location.hash = v; render(); }
async function render() {
  const nav = NAV.map(([h, it]) => [h, it.filter(([k]) => allowed(k.split(":")[0]))]).filter(x => x[1].length).concat(can("collect") ? [["IBTSO Data Team", [["collect", "Data Collection"], ["users", "User Management"]]]] : []);
  const [v, arg] = S.view.split(":");
  const u = S.user, ini = u.name.split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
  $("#app").innerHTML = `<div class="shell"><nav id="nv"><div class="logo"><i>▮</i><span>IBTSO<small>Retail Intelligence</small></span></div>${nav.map(([h, items]) => `<h6>${h}</h6>${items.map(([k, l]) => `<a data-v="${k}" class="${S.view === k || (S.view === "dealer" && k === "dealers") ? "on" : ""}">${icon(k)}<span>${l}</span></a>`).join("")}`).join("")}</nav>
  <div class="col"><header class="topbar noprint"><button class="mbtn" id="mb" aria-label="Menu">☰</button><div class="grow"></div>
  <div class="who"><span class="av">${esc(ini)}</span><span class="wt"><b>${esc(u.name)}</b><small>${ROLES[u.role].label}${can("any") ? "" : " · " + esc(u.brand)}</small></span></div>
  <button class="signout" id="lo">${icon("logout")}<span>Sign out</span></button></header>
  <main><div id="head"></div><div id="flt"></div><div id="view"><div class="card">Loading…</div></div></main></div></div>`;
  document.querySelectorAll("nav a[data-v]").forEach(a => a.onclick = () => go(a.dataset.v));
  $("#lo").onclick = logout; $("#mb").onclick = () => $("#nv").classList.toggle("open"); filters();
  if (!allowed(v)) { head("Access restricted", ""); $("#view").innerHTML = `<div class="card"><h3>🔒 Your role (${ROLES[S.user.role].label}) cannot open this screen.</h3><div class="sub">Ask an IBTSO admin to upgrade your access.</div></div>`; return; }
  try { await ({ users: usersPage, dashboard, categories, competitors, trend, geo, dealers, dealer: dealerPage, reports, collect }[v])(arg); } catch (e) { if (e.message !== "auth") $("#view").innerHTML = `<div class="card">Error: ${esc(e.message)}</div>`; console.error(e); }
}
const TITLES = { dashboard: "Executive Dashboard", categories: "Category Visibility", competitors: "Brand vs Competitor Visibility", trend: "Monthly Visibility Trend", geo: "Benchmark", dealers: "Dealer Network — 230 IR Dealers", dealer: "Dealer Detail", reports: "Reports & Export", collect: "Monthly Data Collection" };
function head(t, sub) { $("#head").innerHTML = `<div class="top"><div><h1>${t}</h1><div class="sub">${sub || ""}</div></div><div class="noprint"><span class="pill">${esc(S.brand)}</span> <span class="pill" style="background:#eef2f6;color:var(--mute)">${ROLES[S.user.role].label}</span></div></div>`; }
function filters() {
  const f = S.f, m = S.meta; const cities = f.region ? m.regions[f.region] : Object.values(m.regions).flat().sort();
  const opt = (arr, cur, all) => (all ? `<option value="">${all}</option>` : "") + arr.map(x => `<option ${x === cur ? "selected" : ""} value="${esc(x)}">${esc(x)}</option>`).join("");
  const d = f.dealer ? dealerById(f.dealer) : null;
  $("#flt").innerHTML = `<div class="filters noprint">
  <div><label>Brand</label><select id="fb" ${can("any") ? "" : "disabled"}>${opt(m.allBrands, S.brand)}</select></div>
  <div><label>Month</label><select id="fm">${m.months.map(x => `<option value="${x}" ${x === f.month ? "selected" : ""}>${mlabel(x)}</option>`).join("")}</select></div>
  <div><label>Category</label><select id="fc">${opt(m.categories, f.category, "All categories")}</select></div>
  <div><label>Region</label><select id="fr">${opt(Object.keys(m.regions), f.region, "All regions")}</select></div>
  <div><label>City</label><select id="fy">${opt(cities, f.city, "All cities")}</select></div>
  ${can("dealers") ? `<div><label>Dealer</label><input id="fd" list="dl" placeholder="All dealers" value="${d ? esc(d.code + " " + d.name) : ""}"><datalist id="dl">${m.dealers.map(x => `<option value="${x.code} ${esc(x.name)}">`).join("")}</datalist></div>` : ""}<div style="flex:0 0 auto;min-width:0;align-self:flex-end"><button class="btn ghost" id="fx">Reset</button></div></div>`;
  $("#fx").onclick = () => { Object.assign(S.f, { category: "", region: "", city: "", dealer: "" }); const m2 = S.meta.months; S.f.month = m2.filter(x => S.meta.coverage[x] >= 100).at(-1) || m2.at(-1); S.dpage = 0; S.dq = ""; render(); };
  const set = (id, fn) => $(id).onchange = e => { fn(e.target.value); S.dpage = 0; render(); };
  set("#fb", v => S.brand = v); set("#fm", v => f.month = v); set("#fc", v => f.category = v);
  set("#fr", v => { f.region = v; f.city = ""; }); set("#fy", v => { f.city = v; if (v) f.region = Object.keys(m.regions).find(r => m.regions[r].includes(v)); });
  if (can("dealers")) set("#fd", v => { const x = m.dealers.find(d => d.code + " " + d.name === v); f.dealer = x ? x.id : ""; if (x) { f.city = x.city; f.region = x.region; } });
}

// ---------- views ----------
async function dashboard() {
  head("Executive Dashboard", `${S.brand} visibility intelligence · ${scopeText()}`);
  const pm = prevMonth(), f = S.f, B = S.brand;
  const [cur, prv, trend, cats, catsP, regs, regsP, dl, nat, natP] = await Promise.all([sh(f), pm ? sh({ ...f, month: pm }) : [], sh(F({}, ["month"]), "month"), sh(F({}, ["category"]), "category"), pm ? sh({ ...F({}, ["category"]), month: pm }, "category") : [], sh(F({}, ["region", "city", "dealer"]), "region"), pm ? sh({ ...F({}, ["region", "city", "dealer"]), month: pm }, "region") : [], sh(f, "dealer"), sh(F({}, ["region", "city", "dealer"])), pm ? sh({ ...F({}, ["region", "city", "dealer"]), month: pm }) : []]);
  if (!one(cur).total) { $("#view").innerHTML = `<div class="card"><h3>No data for this selection</h3><div class="sub">No visibility data has been collected for ${scopeText()}. Try another month or filter, or use Reset.</div></div>`; return; }
  const c = one(cur), p = one(prv), s = get(c, B), sp = get(p, B), leader = leaders(c, 1)[0] || { b: "–", s: 0 };
  const present = dl.filter(o => (o.brands[B] || 0) > 0).length;
  $("#view").innerHTML = `<div class="grid g4">
    ${kpi("Visibility Share", pct(s), `${dlt(s, sp)} vs ${pm ? mlabel(pm) : "n/a"}`)}
    ${kpi("Rank in scope", rank(c, B) ? "#" + rank(c, B) : "–", `of ${Object.keys(c.brands).length} brands · leader ${leader.b} ${pct(leader.s)}`)}
    ${kpi("National Benchmark", pct(get(one(nat), B)), `${dlt(get(one(nat), B), get(one(natP), B))} MoM · ${S.f.category || "all categories"}`)}
    ${kpi("Dealer Presence", present + "<small style='font-size:14px;color:var(--mute)'> / " + dl.length + "</small>", `${pct(present / (dl.length || 1), 0)} of reporting dealers display ${B}`)}</div>
  <div class="grid g2">${card("Brand league", `Visibility share · ${scopeText()}`, bars(leaders(c, 10).map(x => ({ label: x.b, v: x.s, hl: x.b === B, txt: pct(x.s) + " " + ""})), {}))}
  ${card("Share trend", `${B} vs top competitors · ${S.f.category || "all categories"} · ${S.f.dealer ? "selected dealer" : S.f.city || S.f.region || "national"}`, (() => { const tb = [B, ...leaders(trend.at(-1) || { brands: {}, total: 1 }).map(x => x.b).filter(b => b !== B).slice(0, 3)]; return line(tb.map((b, i) => ({ name: b, color: PAL[i], hl: i === 0, vals: trend.map(o => get(o, b)) })), trend.map(o => o.key)); })())}</div>
  <div class="grid g2">${card("Category performance", `${B} share by category vs category leader · ${mlabel(f.month)}`, `<div class="scroll"><table><tr><th>Category</th><th class="r">Share</th><th class="r">MoM</th><th class="r">Rank</th><th>Leader</th></tr>${S.meta.categories.map(k => { const o = byKey(cats)[k], po = byKey(catsP)[k]; const l = o && leaders(o, 1)[0]; return `<tr class="click" data-cat="${esc(k)}"><td>${k}</td><td class="r"><b>${pct(get(o, B))}</b></td><td class="r">${dlt(get(o, B), get(po, B))}</td><td class="r">${o ? "#" + (rank(o, B) || "–") : "–"}</td><td>${l ? l.b + " " + pct(l.s) : "–"}</td></tr>`; }).join("")}</table></div>`)}
  ${card("Regional performance", `${B} share vs national benchmark (marker)`, bars(regs.map(o => ({ label: o.key, v: get(o, B) || 0, mark: get(one(nat), B) })).sort((a, b) => b.v - a.v), { max: Math.max(...regs.map(o => get(o, B) || 0), get(one(nat), B)) * 1.15 }))}</div>
  ${card("Key insights", "Auto-generated from this month's data", `<ul class="ins">${insights(cats, catsP, regs, nat, B).map(i => `<li>${i}</li>`).join("")}</ul>`)}`;
  document.querySelectorAll("tr[data-cat]").forEach(r => r.onclick = () => { S.f.category = r.dataset.cat; render(); });
}
function insights(cats, catsP, regs, nat, B) {
  const out = [], ns = get(one(nat), B), pc = byKey(catsP);
  const mv = cats.map(o => ({ k: o.key, d: get(o, B) - (get(pc[o.key], B) ?? get(o, B)) })).sort((a, b) => b.d - a.d);
  if (mv.length && Math.abs(mv[0].d) > 0.0005) out.push(`<b>${mv[0].k}</b> is ${B}'s fastest-moving category (${mv[0].d > 0 ? "+" : ""}${(mv[0].d * 100).toFixed(1)} pts MoM).`);
  if (mv.length > 1 && mv.at(-1).d < -0.0005) out.push(`<b>${mv.at(-1).k}</b> lost ${(Math.abs(mv.at(-1).d) * 100).toFixed(1)} pts of visibility — review dealer displays.`);
  const r = regs.map(o => ({ k: o.key, s: get(o, B) })).sort((a, b) => b.s - a.s);
  if (r.length) out.push(`Strongest region: <b>${r[0].k}</b> (${pct(r[0].s)}); weakest: <b>${r.at(-1).k}</b> (${pct(r.at(-1).s)}) vs ${pct(ns)} national.`);
  const gap = cats.map(o => ({ k: o.key, g: leaders(o, 1)[0].s - get(o, B), l: leaders(o, 1)[0].b })).filter(x => x.l !== B).sort((a, b) => b.g - a.g)[0];
  if (gap) out.push(`Biggest gap to leader: <b>${gap.k}</b> where ${gap.l} leads by ${(gap.g * 100).toFixed(1)} pts.`);
  return out;
}
async function categories() {
  head("Category Visibility", `Visibility share by category · ${scopeText()}`);
  const B = S.brand, cats = byKey(await sh(F({}, ["category"]), "category")), pm = prevMonth(), P = pm ? byKey(await sh({ ...F({}, ["category"]), month: pm }, "category")) : {};
  $("#view").innerHTML = `<div class="grid g3">${S.meta.categories.map(k => { const o = cats[k]; if (!o) return card(k, "No data", ""); return card(k, `${o.total.toLocaleString()} models displayed · ${B}: <b>${pct(get(o, B))}</b> ${dlt(get(o, B), get(P[k], B))}`, bars(leaders(o, 7).map(x => ({ label: x.b, v: x.s, hl: x.b === B }))) + (rank(o, B) > 7 ? `<div class="note">${B} ranks #${rank(o, B)} (${pct(get(o, B))})</div>` : "")); }).join("")}</div>`;
}
async function competitors() {
  head("Brand vs Competitor Visibility", `${S.brand} against selected rivals · ${scopeText()}`);
  const B = S.brand, f = S.f, cur = one(await sh(f));
  if (!S.rivals || S.rivals.includes(B)) S.rivals = leaders(cur).map(x => x.b).filter(b => b !== B).slice(0, 3);
  const list = [B, ...S.rivals], [cats, trend] = await Promise.all([sh(F({}, ["category"]), "category"), sh(F({}, ["month"]), "month")]);
  $("#view").innerHTML = `<div class="card" style="margin-bottom:14px"><h3>Compare against</h3><div class="sub">Pick competitors (up to 5)</div>${S.meta.allBrands.filter(b => b !== B).map(b => `<span class="chip ${S.rivals.includes(b) ? "on" : ""}" data-b="${b}">${b}</span>`).join("")}</div>
  <div class="grid g2">${card("Overall share", scopeText(), bars(list.map((b, i) => ({ label: b, v: get(cur, b) || 0, hl: i == 0 }))))}
  ${card("Share trend", "Month-on-month", line(list.map((b, i) => ({ name: b, color: PAL[i], hl: i == 0, vals: trend.map(o => get(o, b)) })), trend.map(o => o.key)))}</div>
  ${card("Head-to-head by category", `Share per category · gap = ${B} minus rival (pts)`, `<div class="scroll"><table><tr><th>Category</th>${list.map(b => `<th class="r">${b}</th>`).join("")}${S.rivals.map(b => `<th class="r">Gap vs ${b}</th>`).join("")}</tr>${cats.map(o => `<tr><td>${o.key}</td>${list.map(b => `<td class="r">${pct(get(o, b))}</td>`).join("")}${S.rivals.map(b => `<td class="r">${heat(get(o, B) - get(o, b))}</td>`).join("")}</tr>`).join("")}</table></div>`)}`;
  document.querySelectorAll(".chip[data-b]").forEach(c => c.onclick = () => { const b = c.dataset.b, i = S.rivals.indexOf(b); i >= 0 ? S.rivals.splice(i, 1) : S.rivals.length < 5 && S.rivals.push(b); competitors(); });
}
async function trend() {
  head("Monthly Visibility Trend", `${S.brand} · ${S.f.category || "all categories"} · ${S.f.dealer ? "selected dealer" : S.f.city || S.f.region || "national"}`);
  const B = S.brand, [t, tc] = await Promise.all([sh(F({}, ["month"]), "month"), Promise.all(S.meta.categories.map(c => sh(F({ category: c }, ["month"]), "month")))]);
  const lead = leaders(t.at(-1)).map(x => x.b).filter(b => b !== B).slice(0, 5);
  $("#view").innerHTML = `<div class="grid g2">${card("Brand vs top competitors", "Visibility share by month", line([B, ...lead].map((b, i) => ({ name: b, color: PAL[i], hl: !i, vals: t.map(o => get(o, b)) })), t.map(o => o.key)))}
  ${card(`${B} by category`, "Visibility share by month", line(S.meta.categories.map((c, i) => ({ name: c, color: PAL[i], vals: tc[i].map(o => get(o, B)) })), t.map(o => o.key)))}</div>
  ${card("Month-on-month movement", `${B} share and change`, `<div class="scroll"><table><tr><th>Month</th><th class="r">Share</th><th class="r">MoM change</th><th class="r">Rank</th><th class="r">Models displayed</th><th class="r">Total models</th></tr>${t.map((o, i) => `<tr><td>${mlabel(o.key)}</td><td class="r"><b>${pct(get(o, B))}</b></td><td class="r">${i ? dlt(get(o, B), get(t[i - 1], B)) : "–"}</td><td class="r">#${rank(o, B) || "–"}</td><td class="r">${o.brands[B] || 0}</td><td class="r">${o.total}</td></tr>`).join("")}</table></div>`)}`;
}
async function geo(level) {
  const B = S.brand, f = S.f; level = level || "region";
  head({ city: "City Benchmark", region: "Regional Benchmark", national: "National Benchmark" }[level], `${B} vs national benchmark · ${f.category || "all categories"} · ${mlabel(f.month)}`);
  const bf = F({}, ["region", "city", "dealer"]), nat = one(await sh(bf)), ns = get(nat, B);
  if (level === "national") {
    const [mat, tr] = await Promise.all([sh(bf, "category"), sh(F({}, ["region", "city", "dealer", "month"]), "month")]); const m = byKey(mat), brands = leaders(nat, 10).map(x => x.b);
    $("#view").innerHTML = `<div class="grid g4">${kpi("National Visibility Share", pct(ns), `${B} · across ${S.meta.coverage[f.month] || 230} reporting IR dealers`)}${kpi("National rank", "#" + (rank(nat, B) || "–"), `of ${Object.keys(nat.brands).length} brands`)}${kpi("Total models audited", nat.total.toLocaleString(), mlabel(f.month))}${kpi("IR dealers reporting", S.meta.coverage[f.month] || 0, "of 230 in network")}</div>
    <div class="grid g2">${card("National benchmark — all brands", "Share of models displayed across Oman's IR channel", bars(leaders(nat, 12).map(x => ({ label: x.b, v: x.s, hl: x.b === B }))))}${card("National trend", "", line(brands.slice(0, 5).concat(brands.includes(B) ? [] : [B]).map((b, i) => ({ name: b, color: b === B ? PAL[0] : PAL[i + 1], hl: b === B, vals: tr.map(o => get(o, b)) })), tr.map(o => o.key)))}</div>
    ${card("Brand × category matrix", "National visibility share (%)", `<div class="scroll"><table><tr><th>Brand</th>${S.meta.categories.map(c => `<th class="r">${c}</th>`).join("")}<th class="r">All</th></tr>${brands.map(b => `<tr style="${b === B ? "background:#e6f4f1;font-weight:700" : ""}"><td>${b}</td>${S.meta.categories.map(c => `<td class="r">${(m[c]?.brands[b]) ? pct(get(m[c], b)) : "–"}</td>`).join("")}<td class="r">${pct(get(nat, b))}</td></tr>`).join("")}</table></div>`)}`;
    return;
  }
  const gf = level === "city" ? F({}, ["city", "dealer"]) : F({}, ["region", "city", "dealer"]), rows = (await sh(gf, level)).map(o => ({ o, s: get(o, B), r: rank(o, B), l: leaders(o, 1)[0] })).sort((a, b) => b.s - a.s);
  const geoOf = c => S.meta.dealers.find(d => d.city === c)?.region;
  $("#view").innerHTML = `<div class="grid g2">${card(`${B} share by ${level}`, `Marker = national benchmark ${pct(ns)}`, bars(rows.map(x => ({ label: x.o.key, v: x.s || 0, mark: ns })), { max: Math.max(ns, ...rows.map(x => x.s || 0)) * 1.15 }), "")}
  ${card(`${level === "city" ? "City" : "Regional"} detail`, "Click a row to filter", `<div class="scroll"><table><tr><th>${level}</th>${level === "city" ? "<th>Region</th>" : ""}<th class="r">Models</th><th class="r">${B} share</th><th class="r">vs nat. (pts)</th><th class="r">Rank</th><th>Leader</th></tr>${rows.map(x => `<tr class="click" data-k="${esc(x.o.key)}"><td>${x.o.key}</td>${level === "city" ? `<td>${geoOf(x.o.key)}</td>` : ""}<td class="r">${x.o.total}</td><td class="r"><b>${pct(x.s)}</b></td><td class="r">${heat(x.s - ns)}</td><td class="r">#${x.r || "–"}</td><td>${x.l.b} ${pct(x.l.s)}</td></tr>`).join("")}</table></div>`)}</div>`;
  document.querySelectorAll("tr[data-k]").forEach(r => r.onclick = () => { const k = r.dataset.k; if (level === "city") { S.f.city = k; S.f.region = geoOf(k); } else { S.f.region = k; S.f.city = ""; } go("dealers"); });
}
async function dealers() {
  head("Dealer Network — 230 IR Dealers", `${S.brand} presence by dealer · ${scopeText()}`);
  const B = S.brand, f = { ...S.f, dealer: "" }, data = byKey(await sh(f, "dealer")), nat = get(one(await sh(F({}, ["region", "city", "dealer"]))), B);
  let rows = S.meta.dealers.filter(d => (!f.region || d.region === f.region) && (!f.city || d.city === f.city)).map(d => { const o = data[d.id]; return { ...d, total: o?.total || 0, mine: o?.brands[B] || 0, share: o ? get(o, B) : null, rk: o ? rank(o, B) : null, lead: o ? leaders(o, 1)[0].b : "–" }; });
  const q = S.dq.toLowerCase(); if (q) rows = rows.filter(d => (d.name + d.code + d.city).toLowerCase().includes(q));
  const [k, dir] = S.dsort; rows.sort((a, b) => ((a[k] ?? -1) > (b[k] ?? -1) ? 1 : -1) * dir);
  const PS = 20, pages = Math.ceil(rows.length / PS) || 1; S.dpage = Math.min(S.dpage, pages - 1);
  const H = (key, l, r) => `<th class="${r ? "r" : ""}" data-s="${key}">${l}${k === key ? (dir > 0 ? " ▲" : " ▼") : ""}</th>`;
  $("#view").innerHTML = `<div class="card"><div style="display:flex;gap:10px;align-items:center;margin-bottom:10px;flex-wrap:wrap"><input id="dq" style="max-width:280px" placeholder="Search dealer, code or city" value="${esc(S.dq)}"><span class="note">${rows.length} dealers · ${B} benchmark ${pct(nat)}</span></div>
  <div class="scroll"><table><tr>${H("code", "Code")}${H("name", "Dealer")}${H("city", "City")}${H("region", "Region")}${H("total", "Models", 1)}${H("mine", B + " models", 1)}${H("share", B + " share", 1)}<th class="r">vs nat.</th>${H("rk", "Rank", 1)}${H("lead", "Leader")}</tr>
  ${rows.slice(S.dpage * PS, S.dpage * PS + PS).map(d => `<tr class="click" data-id="${d.id}"><td>${d.code}</td><td>${esc(d.name)}</td><td>${d.city}</td><td>${d.region}</td><td class="r">${d.total}</td><td class="r">${d.mine}</td><td class="r"><b>${pct(d.share)}</b></td><td class="r">${d.share == null ? "–" : heat(d.share - nat)}</td><td class="r">${d.rk ? "#" + d.rk : "–"}</td><td>${d.lead}</td></tr>`).join("")}</table></div>
  <div class="pager"><button class="btn ghost" id="pp">‹ Prev</button>Page ${S.dpage + 1} / ${pages}<button class="btn ghost" id="pn">Next ›</button></div></div>`;
  document.querySelectorAll("th[data-s]").forEach(t => t.onclick = () => { S.dsort = [t.dataset.s, S.dsort[0] === t.dataset.s ? -dir : -1]; dealers(); });
  document.querySelectorAll("tr[data-id]").forEach(r => r.onclick = () => { S.dealerId = r.dataset.id; go("dealer"); });
  $("#pp").onclick = () => { S.dpage = Math.max(0, S.dpage - 1); dealers(); }; $("#pn").onclick = () => { S.dpage = Math.min(pages - 1, S.dpage + 1); dealers(); };
  $("#dq").oninput = e => { S.dq = e.target.value; S.dpage = 0; clearTimeout(S.t); S.t = setTimeout(async () => { await dealers(); const i = $("#dq"); i.focus(); i.setSelectionRange(99, 99); }, 250); };
}
async function dealerPage() {
  const d = dealerById(S.f.dealer || S.dealerId), B = S.brand; if (!d) return go("dealers"); S.dealerId = d.id;
  head(`${d.name} <small style="color:var(--mute);font-weight:400">${d.code}</small>`, `${d.city}, ${d.region} · ${B} visibility at this dealer · ${mlabel(S.f.month)}`);
  const fd = { month: S.f.month, dealer: d.id }, [cats, nat, hist] = await Promise.all([sh(fd, "category"), sh({ month: S.f.month }, "category"), sh({ dealer: d.id }, "month")]), N = byKey(nat), tot = one(await sh(fd));
  const catRow = cats.map(o => ({ o, s: get(o, B), n: get(N[o.key], B), l: leaders(o, 1)[0] }));
  $("#view").innerHTML = `<div class="noprint" style="margin-bottom:10px"><button class="btn ghost" id="bk">‹ Back to dealer network</button></div><div class="grid g4">${kpi(`${B} share at dealer`, pct(get(tot, B)), `${tot.brands[B] || 0} of ${tot.total} models displayed`)}${kpi("Rank at dealer", "#" + (rank(tot, B) || "–"), "all categories")}${kpi("National benchmark", pct(get(one(await sh({ month: S.f.month })), B)), "all categories")}${kpi("Categories stocked", cats.length + " / 6", "")}</div>
  <div class="grid g2">${card("Category visibility", "Share of this dealer's displayed models", `<div class="scroll"><table><tr><th>Category</th><th class="r">Models</th><th class="r">${B}</th><th class="r">Nat.</th><th class="r">Δ</th><th>Mix (${B} highlighted)</th><th>Leader</th></tr>${catRow.map(x => `<tr><td>${x.o.key}</td><td class="r">${x.o.total}</td><td class="r"><b>${pct(x.s)}</b></td><td class="r">${pct(x.n)}</td><td class="r">${heat(x.s - x.n)}</td><td>${stack(x.o)}</td><td>${x.l.b} ${pct(x.l.s)}</td></tr>`).join("")}</table></div>`)}
  ${card(`${B} share history`, "At this dealer, all categories", line([{ name: B, color: PAL[0], hl: 1, vals: hist.map(o => get(o, B)) }], hist.map(o => o.key)))}</div>`;
  $("#bk").onclick = () => { S.f.dealer = ""; go("dealers"); };
}
async function reports() {
  head("Reports & Export", `Exports follow the current filters · ${scopeText()}`);
  const link = (kind, group, label) => `<button class="btn ghost" style="margin:4px 6px 4px 0" data-x="${kind}|${group}">⬇ ${label}</button>`;
  $("#view").innerHTML = `<div class="grid g2">${card("Visibility share reports (CSV)", "Share = brand models displayed ÷ total models displayed in the selected scope", (can("dealers") ? ["brand", "category", "region", "city", "dealer", "month"] : ["brand", "category", "region", "city", "month"]).map(g => link("share", g, "By " + g)).join("") + `<div class="note">Select a category/region/month in the filters to scope the export. Clear "Month" scope by choosing the month you need; trend export uses "By month".</div>`)}
  ${card("Raw dealer data (CSV)", "Dealer × category × brand models displayed — the underlying monthly collection", (can("rawData") ? link("raw", "", "Raw visibility data") : `<div class="note">🔒 Raw dealer-level data is available to IBTSO admins only.</div>`))}</div>
  ${card("Executive summary", "Print or save as PDF", `<button class="btn" onclick="print()">Print / Save as PDF</button><div class="note">Opens your browser's print dialog for the Executive Dashboard layout.</div>`)}
  ${card("Methodology", "", `<ul class="ins"><li><b>Visibility Share</b> = models of a brand displayed ÷ all models displayed, in the selected scope (dealer, city, region or national).</li><li>City, regional and national shares are <b>pooled</b> across dealers (sum of models), so larger displays carry proportionally more weight.</li><li>Data is collected monthly from ~230 Independent Retailers across 6 categories; month-on-month change is shown in percentage points.</li></ul>`)}`;
  document.querySelectorAll("button[data-x]").forEach(b => b.onclick = () => { const [kind, group] = b.dataset.x.split("|"); const csv = exportCsv({ ...S.f, kind, group }); const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = `ibtso_${kind}_${group || "data"}_${S.f.month}.csv`; a.click(); });
}
async function collect() {
  head("Monthly Data Collection", "IBTSO field team: capture models displayed per brand at each IR dealer");
  const m = S.meta, months = [...m.months]; const next = (() => { const [y, mo] = months.at(-1).split("-").map(Number); return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`; })(); months.push(next);
  const st = S.col = S.col || { dealer: m.dealers[0].id, month: next, cat: m.categories[0] };
  const cov = months.map(x => `<tr><td>${mlabel(x)}</td><td class="r">${m.coverage[x] || 0} / 230</td><td><div class="stack"><i style="width:${(m.coverage[x] || 0) / 2.3}%;background:var(--acc)"></i></div></td></tr>`).join("");
  $("#view").innerHTML = `<div class="grid g2"><div class="card"><h3>Dealer visibility entry</h3><div class="sub">Count the models of each brand displayed on the shop floor</div>
  <label>Dealer</label><input id="cd" list="dl" value="${dealerById(st.dealer).code} ${esc(dealerById(st.dealer).name)}"><div class="grid" style="grid-template-columns:1fr 1fr;gap:10px;margin:0"><div><label>Month</label><select id="cm">${months.map(x => `<option value="${x}" ${x === st.month ? "selected" : ""}>${mlabel(x)}</option>`).join("")}</select></div><div><label>Category</label><select id="cc">${m.categories.map(x => `<option ${x === st.cat ? "selected" : ""}>${x}</option>`).join("")}</select></div></div>
  <div id="cf" style="margin-top:12px"></div></div>
  <div><div class="card" style="margin-bottom:14px"><h3>Collection coverage</h3><div class="sub">IR dealers reporting per month</div><table>${cov}</table></div>
  <div class="card"><h3>Bulk CSV import</h3><div class="sub">Columns: month, dealer_code, category, brand, models_displayed</div><input type="file" id="cs" accept=".csv"><div class="note" id="ci"></div><a class="btn ghost" style="display:inline-block;margin-top:8px;text-decoration:none" href="data:text/csv,month,dealer_code,category,brand,models_displayed%0A${next},IR-001,Air Conditioners,LG,4%0A${next},IR-001,Air Conditioners,Midea,2">Download template</a></div></div></div>`;
  const load = async () => { const ex = await api("dealer-entry", { month: st.month, dealer: st.dealer, category: st.cat }, null);
    $("#cf").innerHTML = `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px;margin:0">${m.catalog[st.cat].map(b => `<div><label>${b}</label><input type="number" min="0" max="50" data-b="${b}" value="${ex[b] || 0}"></div>`).join("")}</div><div style="margin-top:12px;display:flex;gap:12px;align-items:center"><button class="btn" id="sv">Save entry</button><span id="tt" class="note"></span></div><div id="sm" class="note"></div>`;
    const upd = () => { const v = [...document.querySelectorAll("#cf input")].map(i => [i.dataset.b, +i.value || 0]), t = v.reduce((a, x) => a + x[1], 0); $("#tt").innerHTML = `Total models: <b>${t}</b> · ` + v.filter(x => x[1]).sort((a, b) => b[1] - a[1]).map(x => `${x[0]} ${t ? (100 * x[1] / t).toFixed(0) : 0}%`).join(", "); }; document.querySelectorAll("#cf input").forEach(i => i.oninput = upd); upd();
    $("#sv").onclick = async () => { const brands = Object.fromEntries([...document.querySelectorAll("#cf input")].map(i => [i.dataset.b, +i.value || 0])); await api("entry", {}, { body: JSON.stringify({ month: st.month, dealer: st.dealer, category: st.cat, brands }) }); await refresh(); $("#sm").innerHTML = `<span class="up">✓ Saved. Dashboards now reflect this entry.</span>`; }; };
  const refresh = async () => { Object.keys(cache).forEach(k => delete cache[k]); S.meta = await api("meta"); };
  $("#cd").onchange = e => { const d = m.dealers.find(x => x.code + " " + x.name === e.target.value); if (d) { st.dealer = d.id; load(); } };
  $("#cm").onchange = e => { st.month = e.target.value; load(); }; $("#cc").onchange = e => { st.cat = e.target.value; load(); };
  $("#cs").onchange = async e => { const r = await api("import", {}, { body: await e.target.files[0].text() }); await refresh(); $("#ci").innerHTML = `Imported ${r.imported} dealer/category submissions.${r.errors.length ? "<br>" + r.errors.map(esc).join("<br>") : ""}`; };
  load();
}
async function usersPage() {
  head("User Management", "Role-based access control · accounts are stored in this browser for the demo");
  const list = Auth.list(), m = S.meta;
  $("#view").innerHTML = `<div class="grid g2"><div class="card"><h3>Accounts</h3><div class="sub">Change roles or remove users</div><div class="scroll"><table><tr><th>Name</th><th>Email</th><th>Brand</th><th>Role</th><th></th></tr>${list.map(u => `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${esc(u.brand)}</td><td><select data-r="${esc(u.email)}" ${u.email === S.user.email ? "disabled" : ""}>${Object.entries(ROLES).map(([k, r]) => `<option value="${k}" ${k === u.role ? "selected" : ""}>${r.label}</option>`).join("")}</select></td><td>${u.email === S.user.email ? "" : `<a data-d="${esc(u.email)}" style="color:var(--neg);cursor:pointer">Remove</a>`}</td></tr>`).join("")}</table></div></div>
  <div><div class="card" style="margin-bottom:14px"><h3>Role permissions</h3><div class="sub">What each role can do</div><div class="scroll"><table><tr><th>Capability</th><th>Admin</th><th>Manager</th><th>Viewer</th></tr>
  ${[["Brand dashboards, benchmarks & trends", 1, 1, 1], ["See other brands' data (brand switcher)", 1, 0, 0], ["Dealer Network & Dealer Detail", 1, 1, 0], ["Reports / CSV export", 1, 1, "Aggregated only"], ["Raw dealer-level export", 1, 0, 0], ["Data Collection & CSV import", 1, 0, 0], ["User Management", 1, 0, 0]].map(r => `<tr><td>${r[0]}</td>${r.slice(1).map(v => `<td>${v === 1 ? "✅" : v === 0 ? "—" : v}</td>`).join("")}</tr>`).join("")}</table></div></div>
  <div class="card"><h3>Add user</h3><label>Name</label><input id="un"><label>Email</label><input id="ue"><label>Password</label><input id="up" value="demo123"><label>Brand</label><select id="ub">${m.allBrands.map(b => `<option>${b}</option>`).join("")}</select><label>Role</label><select id="ur">${Object.entries(ROLES).map(([k, r]) => `<option value="${k}" ${k === "manager" ? "selected" : ""}>${r.label}</option>`).join("")}</select><div class="err" id="ue2"></div><button class="btn" id="ua">Add user</button>
  <div class="note"><a id="rs" style="cursor:pointer;color:var(--neg)">Reset demo (users and collected data)</a></div></div></div></div>`;
  document.querySelectorAll("select[data-r]").forEach(x => x.onchange = () => { Auth.update(x.dataset.r, { role: x.value }); usersPage(); });
  document.querySelectorAll("a[data-d]").forEach(x => x.onclick = () => { Auth.remove(x.dataset.d); usersPage(); });
  $("#ua").onclick = () => { try { Auth.add({ name: $("#un").value || "User", email: $("#ue").value, pw: $("#up").value, brand: $("#ub").value, role: $("#ur").value }); usersPage(); } catch (e) { $("#ue2").textContent = e.message; } };
  $("#rs").onclick = () => { if (confirm("Reset all users and collected data?")) { localStorage.removeItem("ibtso_users"); resetData(); } };
}
addEventListener("hashchange", () => { if (S.user && location.hash.slice(1) !== S.view) { S.view = location.hash.slice(1) || "dashboard"; render(); } });
try { const u = sessionStorage.getItem("u"); if (u) { S.user = JSON.parse(u); boot().catch(logout); } else renderLogin(); } catch { renderLogin(); }
