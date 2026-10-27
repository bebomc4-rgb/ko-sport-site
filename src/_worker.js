// KO SPORT — server code (Cloudflare Pages "advanced mode").
// Cloudflare runs this file for every request; it is never served to visitors.
// Bindings to set in the Pages project settings:
//   KV namespace  STORE           (orders, products, images, site settings)
//   Secret        ADMIN_PASSWORD  (dashboard password)
//   Optional      TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID (instant order alerts)

// Replaced by build.mjs with the moment this copy was built — so we can tell which deploy is live.
const BUILD_AT = "__BUILD_AT__";

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });

// owner = the ADMIN_PASSWORD secret; staff accounts (manager / orders) are stored hashed in KV "staff"
function ownerPass(request, env) {
  const pass = env.ADMIN_PASSWORD;
  if (!pass) return false;
  const h = request.headers.get("authorization") || "";
  const given = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (given.length !== pass.length) return false;
  let diff = 0;
  for (let i = 0; i < pass.length; i++) diff |= given.charCodeAt(i) ^ pass.charCodeAt(i);
  return diff === 0;
}
function isAdmin(request, env, scope) {
  const r = env.__role;
  if (!r) return false;
  if (r === "owner") return true;
  if (scope === "owner") return false;
  if (r === "manager") return true;
  return scope === "orders"; // "orders" staff: orders, abandoned carts, customers only
}
async function sha(text) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function sameStr(a, b) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
async function resolveRole(request, env) {
  env.__role = null; env.__staff = "";
  const h = request.headers.get("authorization") || "";
  if (!h.startsWith("Bearer ")) return;
  if (ownerPass(request, env)) { env.__role = "owner"; env.__staff = "المالك"; return; }
  const given = h.slice(7);
  if (!given || given.length > 200 || !env.STORE) return;
  const staff = (await env.STORE.get("staff", "json").catch(() => null)) || [];
  for (const s of staff) {
    if (s.on === false || !s.hash) continue;
    if (sameStr(await sha(s.salt + given), s.hash)) { env.__role = s.role === "orders" ? "orders" : "manager"; env.__staff = s.name; return; }
  }
}
const denied = () => json({ error: "كلمة السر غلط" }, 401);
const clip = (s, n) => String(s ?? "").trim().slice(0, n);
const newKey = () => crypto.randomUUID().replace(/-/g, "").slice(0, 20);
// KV lists keys in ascending order; invert the timestamp so newest orders come first.
const orderKey = (ts, id) => `order:${String(9999999999999 - ts).padStart(13, "0")}:${id}`;

// Products: the KV copy (edited from the dashboard) wins; otherwise the bundled seed file.
async function getProducts(env, request) {
  const fromKv = await env.STORE.get("products", "json");
  if (Array.isArray(fromKv)) return fromKv;
  const r = await env.ASSETS.fetch(new URL("/products.json", request.url));
  return r.json();
}
async function saveProducts(env, list) {
  await env.STORE.put("products", JSON.stringify(list));
  await purgeEdge("products");
}

// Short edge cache for the public JSON (products, settings): fast first byte, fewer KV reads.
// Saving from the dashboard purges it, so changes show up right away.
const edgeKey = (name) => new Request("https://edge-cache.internal/" + name);
async function edgeCached(name, ctx, produce, request) {
  const cache = typeof caches !== "undefined" ? caches.default : null;
  let res = cache ? await cache.match(edgeKey(name)) : null;
  if (!res) {
    const body = JSON.stringify(await produce());
    const dig = new Uint8Array(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(body)));
    const etag = '"' + [...dig.slice(0, 12)].map((b) => b.toString(16).padStart(2, "0")).join("") + '"';
    res = new Response(body, { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=15", etag } });
    if (cache) ctx.waitUntil(cache.put(edgeKey(name), res.clone()));
  }
  // A returning visitor only downloads the list again if it really changed (304 = a few bytes, no body).
  const tag = res.headers.get("etag"), inm = request && request.headers.get("if-none-match");
  if (tag && inm && inm.split(",").some((t) => t.trim().replace(/^W\//, "") === tag)) {
    return new Response(null, { status: 304, headers: { etag: tag, "cache-control": res.headers.get("cache-control") || "public, max-age=15" } });
  }
  return res;
}
async function purgeEdge(name) {
  if (typeof caches !== "undefined") await caches.default.delete(edgeKey(name));
}

// /reset — wipes everything this browser kept for the shop (service worker, caches, saved copy)
// and reloads. The one page that always shows the live site, whatever a device cached before.
function resetPage() {
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>تصفير النسخة المحفوظة</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#121212;color:#fff;font-family:system-ui,Tahoma,sans-serif;text-align:center;padding:24px}
.b{max-width:380px}h2{margin:0 0 10px;font-size:20px}p{margin:0 0 18px;color:#bbb;line-height:1.7;font-size:15px}
#s{font-size:15px;min-height:26px}a{display:inline-block;margin-top:16px;background:#e11d2e;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700}</style>
</head><body><div class="b"><h2>عم نصفّر النسخة المحفوظة</h2>
<p>رح نمسح كل شي خزّنو هالمتصفح عن المتجر، وبعدها يفتح الموقع بآخر نسخة.</p>
<div id="s">… لحظة</div><a id="go" href="/" hidden>افتح المتجر</a></div>
<script>(async function(){var s=document.getElementById("s"),d=[];
try{if("serviceWorker" in navigator){var rs=await navigator.serviceWorker.getRegistrations();for(var i=0;i<rs.length;i++)await rs[i].unregister();d.push("ألغينا "+rs.length+" service worker")}}catch(e){}
try{if(window.caches){var ks=await caches.keys();for(var j=0;j<ks.length;j++)await caches.delete(ks[j]);d.push("مسحنا "+ks.length+" كاش")}}catch(e){}
try{localStorage.clear();sessionStorage.clear();d.push("مسحنا النسخة المحفوظة")}catch(e){}
s.innerHTML="✅ "+(d.join("<br>")||"ما كان في شي محفوظ")+"<br><br>عم نفتح الموقع…";
document.getElementById("go").hidden=false;
setTimeout(function(){location.replace("/?fresh="+Date.now())},1600);})()<\/script></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

// Public health check: compares what the dashboard wrote to KV against what visitors actually receive.
// No secrets — only counts — so it is safe to open from a phone.
async function diagApi(request, env) {
  const out = { build: BUILD_AT, host: new URL(request.url).host, kvBound: !!env.STORE };
  if (!env.STORE) return json(out);
  try {
    const kvS = (await env.STORE.get("settings", "json")) || null;
    const kvP = await env.STORE.get("products", "json");
    out.kv = {
      settingsSaved: !!kvS,
      slides: ((kvS && kvS.design && kvS.design.slides) || []).length,
      sections: ((kvS && kvS.home && kvS.home.sections) || []).length,
      sectionsOn: ((kvS && kvS.home && kvS.home.sections) || []).filter((x) => x.on !== false).length,
      groups: ((kvS && kvS.design && kvS.design.groups) || []).length,
      productsSaved: Array.isArray(kvP),
      products: Array.isArray(kvP) ? kvP.length : 0,
    };
    const pub = await getSettings(env, request);
    out.public = {
      slides: ((pub.design || {}).slides || []).length,
      sections: ((pub.home || {}).sections || []).length,
      groups: ((pub.design || {}).groups || []).length,
      usingKvHome: !!(kvS && kvS.home && Array.isArray(kvS.home.sections)),
    };
    const list = await getProducts(env, request);
    out.public.products = list.length;
    out.public.visible = list.filter((p) => !p.hidden).length;
    out.public.inStock = list.filter((p) => !p.hidden && p.inStock).length;
    const cache = typeof caches !== "undefined" ? caches.default : null;
    out.edgeCache = cache ? { settings: !!(await cache.match(edgeKey("settings"))), products: !!(await cache.match(edgeKey("products"))) } : "unavailable";
    // ?full=1 — exactly what the home page will build, so a mismatch with what the owner sees is visible at a glance
    if (new URL(request.url).searchParams.has("full")) {
      const D = pub.design || {}, vis = list.filter((p) => !p.hidden);
      out.slides = (D.slides || []).map((s, i) => ({ n: i + 1, title: s.title || "", img: s.img ? "yes" : "NO", imgMobile: s.imgMobile ? "yes" : "no" }));
      out.sections = ((pub.home || {}).sections || []).map((s, i) => ({ n: i + 1, type: s.type, on: s.on !== false, title: s.title || "", count: s.count || "" }));
      out.groupRows = (D.groups || []).map((g) => {
        const match = vis.filter((p) => p.inStock && (g.cats || []).some((c) => p.category === c || (p.also || []).includes(c)));
        return { name: g.name, cats: g.cats || [], totalInStock: match.length, showsOnHome: match.slice(0, 12).length, firstShown: match.slice(0, 12).map((p) => p.name) };
      });
    }
  } catch (e) { out.error = String((e && e.message) || e).slice(0, 200); }
  return json(out);
}

// Site settings: defaults from settings.default.json, overridden by what was saved in the dashboard.
// heavy things (weights, dumbbells, punching bags…): shipping isn't a flat price, it's set when the order is confirmed
const HEAVY_DEF = { on: true, cats: ["أوزان"], words: ["دامبل", "دمبل", "دنبل", "طارة", "طارات", "حديد", "كيس ملاكمة", "دبل باغ", "سترة", "سترة اوزان", "سترة أوزان", "بار", "كيتل", "عقلة", "بنش", "أوزان حديد"] };
const normWords = (s) => " " + String(s || "").replace(/[\-–—_,،.()\[\]/|+:]+/g, " ").replace(/\s+/g, " ").trim() + " ";
function isHeavy(p, H) {
  if (!H || H.on === false || !p) return false;
  if ((H.cats || []).includes(p.category)) return true;
  const n = normWords(p.name);
  return (H.words || []).some((w) => w && n.includes(normWords(w)));
}
async function getSettings(env, request) {
  const def = await (await env.ASSETS.fetch(new URL("/settings.default.json", request.url))).json();
  const kv = (env.STORE && (await env.STORE.get("settings", "json"))) || {};
  const out = {
    ...def, ...kv,
    store: { ...def.store, ...(kv.store || {}) },
    design: { ...def.design, ...(kv.design || {}) },
    delivery: { ...def.delivery, ...(kv.delivery || {}) },
    payments: Array.isArray(kv.payments) ? kv.payments : def.payments,
    home: kv.home && Array.isArray(kv.home.sections) ? kv.home : def.home,
    checkout: { ...def.checkout, ...(kv.checkout || {}) },
    shipping: kv.shipping && Array.isArray(kv.shipping.carriers) ? kv.shipping : def.shipping,
  };
  // defaults the owner asked for: Qadmous ships for $1, heavy things are priced on confirmation
  // a percentage written on the product badge («خصم 5%») is a real discount on every product
  { const bt = String((out.design || {}).cardBadge || ""), mm = bt.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).match(/(\d{1,2}(?:\.\d+)?)\s*[%٪]/);
    if (mm && +mm[1] > 0 && +mm[1] < 100) out.discounts = [...(out.discounts || []).filter((d) => !d.virtual), { id: "badge", type: "auto", kind: "percent", value: +mm[1], scope: "all", on: true, name: bt.replace(/^🎟\s*/, "").slice(0, 60), badge: true, badgeText: bt.slice(0, 40), virtual: true }]; }
  out.shipping = { ...out.shipping, carriers: (out.shipping.carriers || []).map((c) => (c.flatFee === undefined && c.id === "qadmous" ? { ...c, flatFee: 1 } : c)), heavy: out.shipping.heavy || HEAVY_DEF };
  // Al-Awda ships to Al-Hasakah, Deir ez-Zor and Raqqa (added once; after that the owner edits it like any company)
  if (!out.shipping.carriers.some((c) => c.id === "awda")) {
    const EAST = ["الحسكة", "دير الزور", "الرقة"];
    out.shipping.carriers = out.shipping.carriers.map((c) => (c.id === "qadmous" ? { ...c, govs: (c.govs || []).filter((g) => !EAST.includes(g.name)) } : c));
    out.shipping.carriers.push({ id: "awda", name: "شركة العودة للشحن", type: "door", on: true, note: "الشحن لمحافظتك عن طريق شركة العودة — منتواصل معك لنأكد مكان الاستلام", payments: [], govs: EAST.map((name) => ({ name, fee: null, branches: [] })) });
  }
  return out;
}

const FONTS = ["system", "Changa", "Cairo", "Tajawal", "Almarai", "IBM Plex Sans Arabic", "Noto Kufi Arabic", "Noto Sans Arabic", "Readex Pro",
  "El Messiri", "Lalezar", "Reem Kufi", "Markazi Text", "Amiri", "Rubik", "Baloo Bhaijaan 2", "Open Sans"];
const COLOR = /^#[0-9a-fA-F]{6}$/;
const okUrl = (u) => !u || /^\/img\/[a-z0-9]+$/.test(u) || /^https:\/\/[^\s"'<>]+$/.test(u);

async function settingsGet(request, env, ctx) {
  if (request.headers.has("authorization") && isAdmin(request, env)) return json(await getSettings(env, request));
  return edgeCached("settings", ctx, async () => {
    const s = await getSettings(env, request);
    s.discounts = (s.discounts || []).filter((d) => d.type !== "code" && d.on !== false);
    s.pages = (s.pages || []).filter((p) => p.on !== false);
    delete s.dev;
    return s;
  }, request);
}
async function settingsPut(request, env) {
  if (!isAdmin(request, env)) return denied();
  const text = await request.text();
  if (text.length > 200000) return json({ error: "الإعدادات كبيرة كتير" }, 400);
  let s;
  try { s = JSON.parse(text); } catch { return json({ error: "بيانات غلط" }, 400); }
  if (!s || typeof s !== "object" || !s.store || !s.design || !s.delivery || !Array.isArray(s.payments)) return json({ error: "بيانات ناقصة" }, 400);
  if (Array.isArray(s.discounts)) s.discounts = s.discounts.filter((d) => !(d && d.virtual)); // the badge discount is computed, never stored
  if (env.__role !== "owner") { // only the owner may change code that runs on the shop
    const cur = (await env.STORE.get("settings", "json")) || {};
    s.dev = cur.dev || {}; s.apps = { ...(s.apps || {}), ga: (cur.apps || {}).ga || "", fbPixel: (cur.apps || {}).fbPixel || "", tiktok: (cur.apps || {}).tiktok || "", botUrl: (cur.apps || {}).botUrl || "" };
  }
  const ap = s.apps || {}, dv = s.dev || {};
  if (ap.ga && !/^G-[A-Z0-9]{4,14}$/.test(ap.ga)) return json({ error: "رقم Google Analytics لازم يبلّش بـ G-" }, 400);
  if (ap.fbPixel && !/^\d{6,20}$/.test(ap.fbPixel)) return json({ error: "رقم فيسبوك بيكسل لازم يكون أرقام بس" }, 400);
  if (ap.tiktok && !/^[A-Z0-9]{8,30}$/.test(ap.tiktok)) return json({ error: "رقم تيك توك بيكسل غلط" }, 400);
  if (ap.botUrl && !/^https:\/\/[^\s"<>]{4,200}$/.test(ap.botUrl)) return json({ error: "رابط المجيب لازم يبلّش بـ https://" }, 400);
  if (String(dv.head || "").length > 20000 || String(dv.css || "").length > 20000) return json({ error: "الكود طويل كتير" }, 400);
  const nt = (s.notify && s.notify.emails) || [];
  if (!Array.isArray(nt) || nt.length > 5 || nt.some((e) => e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))) return json({ error: "إيميل تنبيهات الطلبات غلط" }, 400);
  if (s.store.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.store.email)) return json({ error: "البريد الإلكتروني غلط" }, 400);
  if (s.store.tz) { try { new Intl.DateTimeFormat("en", { timeZone: s.store.tz }); } catch { return json({ error: "المنطقة الزمنية غلط" }, 400); } }
  const rd = s.redirects || [];
  if (!Array.isArray(rd) || rd.length > 300) return json({ error: "روابط إعادة التوجيه كتير" }, 400);
  for (const r of rd) if (!/^\/[^\s]*$/.test(r.from || "") || r.from === "/" || /^\/(api|assets|img)\//.test(r.from) || !(/^\/[^\s]*$/.test(r.to || "") || /^https?:\/\/[^\s"<>]+$/.test(r.to || ""))) return json({ error: "رابط إعادة توجيه غلط: " + (r.from || "") }, 400);
  if (String(s.robots || "").length > 5000) return json({ error: "ملف robots.txt طويل" }, 400);
  const tx = s.tax || {};
  if (tx.on && !(+tx.rate > 0 && +tx.rate <= 50)) return json({ error: "نسبة الضريبة لازم بين 0 و 50" }, 400);
  if (s.design && s.design.catMeta && (typeof s.design.catMeta !== "object" || Object.values(s.design.catMeta).some((m) => !okUrl(m.image)))) return json({ error: "بيانات المجموعات غلط" }, 400);
  const d = s.design;
  for (const k of ["primary", "dark", "background"]) if (!COLOR.test(d[k] || "")) return json({ error: "لون غلط: " + k }, 400);
  if (!FONTS.includes(d.headingFont) || (d.bodyFont && !FONTS.includes(d.bodyFont))) return json({ error: "خط غير مدعوم" }, 400);
  if (!okUrl(d.logoImage) || !okUrl(d.heroImage) || !okUrl(s.store.shareImage) || !okUrl(d.favicon)) return json({ error: "رابط صورة غلط" }, 400);
  for (const sl of d.slides || []) {
    if (!okUrl(sl.img) || !okUrl(sl.imgMobile)) return json({ error: "صورة شريحة غلط" }, 400);
    if (sl.color && !COLOR.test(sl.color)) return json({ error: "لون نص شريحة غلط" }, 400);
  }
  if ((d.slides || []).length > 20) return json({ error: "أكتر من 20 شريحة" }, 400);
  if (d.colors) for (const [k, v] of Object.entries(d.colors)) if (v && !COLOR.test(v)) return json({ error: "لون غلط: " + k }, 400);
  {
    const obj = (x) => x == null || (typeof x === "object" && !Array.isArray(x)), oneOf = (x, l) => x == null || x === "" || l.includes(x), colOk = (x) => x == null || x === "" || COLOR.test(x), num = (x, lo, hi) => x == null || x === "" || (+x >= lo && +x <= hi);
    if (!oneOf(d.slideDir, ["rtl", "ltr"]) || !oneOf(d.darkPos, ["hdr-start", "hdr-end", "right", "left", "bnav"]) || !oneOf(d.rowDir, ["rtl", "ltr"]) || !oneOf(d.hdrStart, ["cart", "menu"]) || !num(d.darkSize, 28, 64) || !num(d.logoPx, 20, 140) || !okUrl(d.appIcon192) || !okUrl(d.appIcon512) || !oneOf(d.darkDefault, ["light", "dark", "system"])) return json({ error: "خيارات الاتجاه أو الوضع الداكن غلط" }, 400);
    if (![d.fx, d.open, d.bnav, d.games, d.darkPal, d.conv, d.pg].every(obj)) return json({ error: "إعدادات المؤثرات غلط" }, 400);
    if (!obj(d.pz)) return json({ error: "إعدادات السعر غلط" }, 400);
    if (!obj(d.cu)) return json({ error: "إعدادات العملة غلط" }, 400);
    { const u = d.cu || {}; if (!oneOf(u.txt, ["full", "short", "custom"]) || !oneOf(u.pos, ["beside", "below", "same"]) || !num(u.size, 30, 100) || String(u.custom || "").length > 14 || /[<>]/.test(u.custom || "") || !(u.oldUnit == null || typeof u.oldUnit === "boolean")) return json({ error: "خيارات الكلام بعد السعر غلط" }, 400); }
    { const z = d.pz || {}; if (!oneOf(z.lay, ["stack", "inline"]) || !oneOf(z.al, ["center", "start", "end"]) || !oneOf(z.old, ["left", "right", "above", "below"]) || !oneOf(z.off, ["above", "beside", "below", "hide"]) || !oneOf(z.txt, ["pct", "minus", "save"]) || !num(z.ns, 70, 180) || !num(z.os, 35, 100) || ![z.nc, z.oc, z.ob, z.of].every(colOk)) return json({ error: "خيارات السعر والخصم غلط" }, 400); }
    { const g = d.pg || {}; if (!oneOf(g.side, ["left", "right"]) || !oneOf(g.thumbs, ["wrap", "row", "grid", "hide"]) || !oneOf(g.tsize, ["s", "m", "l"]) || !oneOf(g.talign, ["center", "start", "end"]) || !oneOf(g.fx, ["slide", "fade", "zoom", "flip", "cube", "blur", "push"]) || !oneOf(g.dur, ["fast", "normal", "slow"]) || !num(g.speed, 2, 12) || !(g.auto == null || typeof g.auto === "boolean") || !(g.arrows == null || typeof g.arrows === "boolean")) return json({ error: "خيارات صور صفحة المنتج غلط" }, 400); }
    const f = d.fx || {};
    if (!oneOf(f.reveal, ["up", "fade", "zoom", "left", "right", "flip", "blur", "none"]) || !oneOf(f.speed, ["fast", "normal", "slow"]) || !oneOf(f.page, ["fade", "slide", "zoom", "none"]) || !oneOf(f.card, ["lift", "zoom", "glow", "tilt", "none"]) || !oneOf(f.btn, ["shine", "pulse", "ripple"]) || !oneOf(f.img, ["fade", "blur"])) return json({ error: "خيارات المؤثرات غلط" }, 400);
    const op = d.open || {};
    if (!oneOf(op.style, ["none", "up", "pieces", "cascade", "zoom", "fade", "flip", "curtain", "blur"]) || !oneOf(op.speed, ["fast", "normal", "slow"]) || !oneOf(op.freq, ["always", "session"])) return json({ error: "خيارات فتح الصفحة غلط" }, 400);
    const bn = d.bnav;
    if (bn) {
      if (!oneOf(bn.fx, ["none", "pulse", "fire", "glow", "bounce", "shine"]) || !oneOf(bn.fxOn, ["main", "all", "cart"]) || !oneOf(bn.menuTo, ["browse", "kx", "drawer"]) || !(bn.curBtn == null || typeof bn.curBtn === "boolean") || !(bn.darkBtn == null || typeof bn.darkBtn === "boolean")) return json({ error: "حركة أزرار الشريط السفلي غلط" }, 400);
      if (!Array.isArray(bn.items || []) || (bn.items || []).length > 6) return json({ error: "شريط التنقل: الحد 6 أزرار" }, 400);
      for (const it of bn.items || []) if (String(it.label || "").length > 20 || String(it.icon || "").length > 20 || !/^(#\/[^\s"<>]*|\/[^\s"<>]*|https?:\/\/[^\s"<>]+|tel:[\d+]+|menu|search|explore|wa|games|)$/.test(it.link || "")) return json({ error: "زر شريط التنقل غلط" }, 400);
      if (!num(bn.height, 44, 120) || !num(bn.width, 50, 100) || !num(bn.bottom, 0, 40) || !num(bn.radius, 0, 40) || !num(bn.iconSize, 14, 40) || !num(bn.labelSize, 8, 18) || ![bn.bg, bn.fg, bn.active].every(colOk) || !oneOf(bn.activeStyle, ["color", "pill", "dot", "none"])) return json({ error: "قيم شريط التنقل غلط" }, 400);
    }
    const gm = d.games;
    if (gm) {
      if ((gm.prizes || []).length > 12 || !Array.isArray(gm.prizes || [])) return json({ error: "جوائز العجلة: الحد 12" }, 400);
      for (const p of gm.prizes || []) if (String(p.label || "").length > 40 || String(p.code || "").length > 24 || !(p.w == null || p.w === "" || (+p.w >= 0 && +p.w <= 100))) return json({ error: "جائزة العجلة غلط" }, 400);
      if (String(gm.title || "").length > 40) return json({ error: "عنوان الألعاب طويل" }, 400);
    }
    if (!oneOf(d.sliderXe, ["ease-in-out", "linear", "ease-out", "ease-in"]) || !oneOf(d.sliderXk, ["off", "soft"]) || !oneOf(d.sliderXt, ["fade", "static"]) || !num(d.sliderXf, 0.3, 5)) return json({ error: "إعدادات التلاشي الهادئ غلط" }, 400);
    if (d.skin != null && d.skin !== "" && !["none", "flash", "boutique", "street", "express", "tech", "pop"].includes(d.skin)) return json({ error: "نمط القالب غلط" }, 400);
    if (d.conv != null) {
      const cv = d.conv, tm = cv.timer || {};
      if (typeof cv !== "object" || Array.isArray(cv) || typeof tm !== "object") return json({ error: "ميزات المبيعات غلط" }, 400);
      if (String(tm.text || "").length > 60 || String(tm.btn || "").length > 30 || (tm.link && !/^(#\/[^\s"<>]*|\/[^\s"<>]*|https:\/\/[^\s"<>]+)$/.test(tm.link)) || (tm.endsAt && !(Date.parse(tm.endsAt) > 0))) return json({ error: "إعدادات العدّاد غلط" }, 400);
      if (!Array.isArray(cv.trustItems || []) || (cv.trustItems || []).length > 6 || (cv.trustItems || []).some((x) => String(x.i || "").length > 8 || String(x.t || "").length > 60)) return json({ error: "شارات الثقة غلط" }, 400);
    }
    if (s.shipping && s.shipping.heavy != null) { const H = s.shipping.heavy; if (typeof H !== "object" || !Array.isArray(H.cats || []) || !Array.isArray(H.words || []) || (H.words || []).length > 100 || (H.words || []).some((x) => String(x).length > 40)) return json({ error: "قائمة الأغراض التقيلة غلط" }, 400); }
    if (s.shipping && (s.shipping.carriers || []).some((c) => c.flatFee != null && c.flatFee !== "" && !(+c.flatFee >= 0 && +c.flatFee <= 1000))) return json({ error: "سعر الشحن الثابت غلط" }, 400);
    { const K = d.kx; if (K != null && (typeof K !== "object" || !oneOf(K.gStyle, ["cards", "words", "grid", "circles"]) || !oneOf(K.cStyle, ["tiles", "circles", "list"]) || !oneOf(K.anim, ["pop", "slide", "zoom", "fade", "flip", "drop"]) || !oneOf(K.speed, ["fast", "normal", "slow"]) || !num(K.blur, 0, 40) || !num(K.dim, 0, 90) || !num(K.cCols, 1, 4) || !num(K.cStart, 0, 75) || !oneOf(K.gPos, ["top", "center", "bottom"]) || !colOk(K.tint) || (K.gIcons && Object.values(K.gIcons).some((x) => String(x).length > 8)))) return json({ error: "إعدادات نافذة الأقسام غلط" }, 400); }
    if (s.fx != null) { const f = s.fx; if (typeof f !== "object" || Array.isArray(f) || !oneOf(f.mode, ["usd", "syp"]) || !num(f.margin, -1000, 1000) || !num(f.manual, 0, 1000000)) return json({ error: "إعدادات العملة غلط" }, 400); }
    if (!Object.values(d.darkPal || {}).every(colOk)) return json({ error: "ألوان الوضع الداكن غلط" }, 400);
  }
  if (d.radius != null && d.radius !== "" && !(+d.radius >= 0 && +d.radius <= 24)) return json({ error: "زوايا غلط" }, 400);
  if (d.layout && (typeof d.layout !== "object" || Object.entries(d.layout).some(([k, v]) => !LAYOUT[k] || !LAYOUT[k].includes(v)))) return json({ error: "تخطيط غلط" }, 400);
  if (s.discounts != null) {
    if (!Array.isArray(s.discounts) || s.discounts.length > 100) return json({ error: "الخصومات غلط" }, 400);
    const codes = new Set();
    for (const x of s.discounts) {
      if (!["auto", "code"].includes(x.type) || !["percent", "fixed", "freeship"].includes(x.kind)) return json({ error: "نوع خصم غلط" }, 400);
      if (!String(x.name || "").trim() || String(x.name).length > 60) return json({ error: "اسم الخصم ناقص" }, 400);
      if (x.type === "code") { const c = String(x.code || "").toUpperCase(); if (!/^[A-Z0-9_-]{3,20}$/.test(c)) return json({ error: "كود الخصم لازم يكون 3–20 حرف إنكليزي أو رقم" }, 400); if (codes.has(c)) return json({ error: "في كودين متشابهين: " + c }, 400); codes.add(c); }
      if (x.kind === "percent" && !(+x.value > 0 && +x.value <= 100)) return json({ error: "نسبة الخصم لازم بين 1 و 100" }, 400);
      if (x.kind === "fixed" && !(+x.value > 0)) return json({ error: "قيمة الخصم غلط" }, 400);
      if (x.badgeText && String(x.badgeText).length > 40) return json({ error: "نص الشارة طويل" }, 400);
    }
  }
  if (s.promos != null) {
    if (!Array.isArray(s.promos) || s.promos.length > 20) return json({ error: "الإعلانات غلط (الحد 20)" }, 400);
    const ids = new Set();
    for (const x of s.promos) {
      if (!x || typeof x !== "object" || !/^[a-z0-9_-]{1,24}$/i.test(x.id || "") || ids.has(x.id)) return json({ error: "معرّف إعلان غلط" }, 400); ids.add(x.id);
      if (!["popup", "card", "banner"].includes(x.type || "popup") || !["dark", "light", "brand", "gradient"].includes(x.theme || "dark")) return json({ error: "نوع الإعلان غلط" }, 400);
      if (!["load", "scroll", "exit"].includes(x.trigger || "load") || !["always", "session", "day", "week", "once"].includes(x.freq || "session") || !["home", "all"].includes(x.pages || "home")) return json({ error: "خيارات الإعلان غلط" }, 400);
      if (String(x.title || "").length > 80 || String(x.text || "").length > 300 || String(x.badge || "").length > 30 || String(x.btn || "").length > 40 || String(x.name || "").length > 60) return json({ error: "نص الإعلان طويل" }, 400);
      if (x.code && !/^[A-Za-z0-9_-]{2,24}$/.test(x.code)) return json({ error: "كود الإعلان لازم حروف إنكليزية وأرقام" }, 400);
      if (!okUrl(x.image)) return json({ error: "صورة الإعلان غلط" }, 400);
      if (x.link && !/^(\/|#\/|https?:\/\/)[^\s"'<>]*$/.test(x.link)) return json({ error: "رابط الإعلان غلط" }, 400);
      for (const k of ["startAt", "endAt"]) if (x[k] && Number.isNaN(Date.parse(x[k]))) return json({ error: "تاريخ الإعلان غلط" }, 400);
    }
  }
  if (s.pages != null) {
    if (!Array.isArray(s.pages) || s.pages.length > 30) return json({ error: "الصفحات غلط" }, 400);
    const slugs = new Set();
    for (const p of s.pages) {
      if (!String(p.title || "").trim() || String(p.title).length > 80) return json({ error: "عنوان الصفحة ناقص" }, 400);
      if (!/^[\p{L}\p{N}-]{1,60}$/u.test(p.slug || "")) return json({ error: "رابط الصفحة غلط: " + p.title }, 400);
      if (slugs.has(p.slug)) return json({ error: "في صفحتين بنفس الرابط" }, 400); slugs.add(p.slug);
      if (String(p.body || "").length > 20000) return json({ error: "الصفحة طويلة كتير" }, 400);
    }
  }
  if (d.cardBadge != null && String(d.cardBadge).length > 40) return json({ error: "نص الشارة طويل" }, 400);
  if (d.btnShape && !["square", "rounded", "pill"].includes(d.btnShape)) return json({ error: "شكل زر غلط" }, 400);
  if (d.cardStyle && !["flat", "border", "shadow"].includes(d.cardStyle)) return json({ error: "شكل بطاقة غلط" }, 400);
  if (d.themeId && !/^[a-z0-9-]{1,30}$/.test(d.themeId)) return json({ error: "قالب غلط" }, 400);
  for (const k of ["headerBg", "headerText", "textColor", "footerBg", "footerText", "heroBg", "homeText", "productText", "priceColor"]) if (d[k] && !COLOR.test(d[k])) return json({ error: "لون غلط: " + k }, 400);
  for (const p of s.payments) if (!okUrl(p.qr)) return json({ error: "صورة باركود غلط" }, 400);
  if (s.shipping) {
    if (!Array.isArray(s.shipping.carriers)) return json({ error: "شركات الشحن غلط" }, 400);
    for (const c of s.shipping.carriers) {
      if (!c.id || !c.name || !["door", "branch"].includes(c.type) || !Array.isArray(c.govs)) return json({ error: "شركة شحن ناقصة: " + (c.name || "") }, 400);
      for (const g of c.govs) {
        if (!g.name) return json({ error: "محافظة بدون اسم عند " + c.name }, 400);
        if (g.fee !== null && g.fee !== undefined && !(typeof g.fee === "number" && g.fee >= 0)) return json({ error: "سعر توصيل غلط: " + g.name }, 400);
        if (c.type === "branch" && (g.branches || []).some((b) => !b.name)) return json({ error: "فرع بدون اسم بـ " + g.name }, 400);
      }
    }
    if (!s.shipping.carriers.some((c) => c.on !== false && c.govs.length)) return json({ error: "لازم شركة شحن وحدة مفعّلة عالأقل" }, 400);
  }
  for (const sec of (s.home && s.home.sections) || []) if (sec.type === "code" && String(sec.code || "").length > 30000) return json({ error: "الكود طويل كتير" }, 400);
  if (s.home && (!Array.isArray(s.home.sections) || s.home.sections.length > 30)) return json({ error: "أقسام الرئيسية غلط" }, 400);
  for (const sec of (s.home && s.home.sections) || []) {
    if (!okUrl(sec.img) || !okUrl(sec.imgMobile)) return json({ error: "صورة لافتة غلط" }, 400);
    if (sec.type === "ticker") {
      const one = (v, l) => v == null || v === "" || l.includes(v), C6 = (v) => v == null || v === "" || /^#[0-9a-f]{6}$/i.test(v);
      if (String(sec.lines || "").length > 2000 || /[<>]/.test(sec.lines || "") || String(sec.sep || "").length > 3 || /[<>]/.test(sec.sep || "") || !one(sec.mode, ["marquee", "flip", "type"]) || !one(sec.dir, ["rtl", "ltr"]) || !one(sec.speed, ["slow", "normal", "fast"]) || !one(sec.tfx, ["none", "neon", "shine", "pulse", "rainbow"]) || !one(sec.bfx, ["solid", "gradient", "stripes"]) || !one(sec.size, ["s", "m", "l"]) || ![sec.bg, sec.fg, sec.ac].every(C6)) return json({ error: "إعدادات الشريط الترويجي غلط" }, 400);
    }
    if (sec.type === "video") {
      const vs = sec.videos == null ? [] : sec.videos;
      if (!Array.isArray(vs) || vs.length > 20 || vs.some((u) => typeof u !== "string" || u.length > 1000 || /^\s*(javascript|data|vbscript|blob|file):/i.test(u))) return json({ error: "رابط فيديو غلط" }, 400);
    }
  }
  if (s.audio != null) {
    const au = s.audio, mu = (au && au.music) || {}, fx = (au && au.sfx) || {};
    if (typeof au !== "object" || Array.isArray(au)) return json({ error: "إعدادات الصوت غلط" }, 400);
    if (mu.src && (typeof mu.src !== "string" || mu.src.length > 1000 || /^\s*(javascript|data|vbscript|blob|file):/i.test(mu.src))) return json({ error: "رابط الموسيقى غلط" }, 400);
    for (const v of [mu.volume, fx.volume]) if (v != null && v !== "" && !(+v >= 0 && +v <= 100)) return json({ error: "مستوى الصوت لازم بين 0 و 100" }, 400);
    if (fx.style && !["soft", "arcade", "boxing"].includes(fx.style)) return json({ error: "نوع المؤثرات غلط" }, 400);
  }
  if (!Array.isArray(d.groups)) return json({ error: "الأقسام غلط" }, 400);
  if (!s.payments.some((p) => p.enabled)) return json({ error: "لازم تكون في طريقة دفع وحدة مفعّلة عالأقل" }, 400);
  if (!s.shipping && (!Array.isArray(s.delivery.zones) || !s.delivery.zones.some((z) => z.method !== "off"))) return json({ error: "لازم يكون في توصيل لمحافظة وحدة عالأقل" }, 400);
  for (const z of s.delivery.zones || []) {
    if (!["door", "qadmous", "off"].includes(z.method)) return json({ error: "طريقة توصيل غلط" }, 400);
    if (z.fee !== null && !(typeof z.fee === "number" && z.fee >= 0)) return json({ error: "سعر توصيل غلط: " + z.gov }, 400);
  }
  await env.STORE.put("settings", JSON.stringify(s));
  await purgeEdge("settings");
  return json({ ok: true });
}

// Brute-force protection for the dashboard password (per visitor IP, 15 minutes).
async function authGuard(request, env) {
  if (typeof caches === "undefined") return null;
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const key = new Request("https://auth-guard.internal/" + encodeURIComponent(ip));
  const cache = caches.default;
  const hit = await cache.match(key);
  const fails = hit ? parseInt(await hit.text()) || 0 : 0;
  if (fails >= 8) return json({ error: "محاولات كتير غلط. جرّب بعد ربع ساعة." }, 429);
  if (!env.__role) {
    await cache.put(key, new Response(String(fails + 1), { headers: { "cache-control": "max-age=900" } }));
    await new Promise((r) => setTimeout(r, 800));
  }
  return null;
}

// ---------- /api/products ----------
// Visitors get a slim list (only what the shop shows, hidden products removed) → much smaller download.
// The dashboard asks for ?full=1 and gets everything, uncached.
const PUBLIC_FIELDS = ["id", "name", "category", "also", "price", "inStock", "image", "thumb", "images", "options", "sports", "zoom", "thumbs"];
async function productsGet(request, env, ctx) {
  if (new URL(request.url).searchParams.has("full")) return json(await getProducts(env, request));
  return edgeCached("products", ctx, async () => {
    const list = await getProducts(env, request);
    const sales = (await env.STORE.get("sales", "json").catch(() => null)) || {};
    const rstat = {};
    for (const r of (await env.STORE.get("reviews", "json").catch(() => null)) || []) if (r.ok) { const s = rstat[r.pid] || (rstat[r.pid] = [0, 0]); s[0] += r.rating; s[1]++; }
    return list.filter((p) => !p.hidden).map((p) => {
      const o = {};
      if (sales[p.id]) o.sold = sales[p.id];
      if (rstat[p.id]) { o.rt = Math.round((rstat[p.id][0] / rstat[p.id][1]) * 10) / 10; o.rc = rstat[p.id][1]; }
      for (const k of PUBLIC_FIELDS) {
        const v = p[k];
        if (v === undefined || v === "" || (Array.isArray(v) && !v.length)) continue;
        if (k === "images" && v.length < 2) continue; // single photo = same as image
        if (k === "zoom" && v.length === 1 && v[0] === p.image) continue;
        o[k] = v;
      }
      return o;
    });
  }, request);
}
// GET /api/product-info?id=… → description + specs of one product (kept out of the list so the shop loads fast)
async function productInfo(request, env, ctx) {
  const id = new URL(request.url).searchParams.get("id") || "";
  return edgeCached("info:" + encodeURIComponent(id), ctx, async () => {
    const p = (await getProducts(env, request)).find((x) => x.id === id && !x.hidden);
    return p ? { description: p.description || "", specs: p.specs || [], details: p.details || "" } : { description: "", specs: [], details: "" };
  });
}
async function productsPut(request, env) {
  if (!isAdmin(request, env)) return denied();
  const list = await request.json().catch(() => null);
  if (!Array.isArray(list)) return json({ error: "بيانات غلط" }, 400);
  for (const p of list) {
    if (!p || !p.id || !String(p.name || "").trim()) return json({ error: `في منتج بلا اسم${p && p.id ? " (" + p.id + ")" : ""}. اكتبلو اسم وجرّب مرة تانية` }, 400);
    // منتجات قديمة أو جديدة بلا قسم أو سعرها مكتوب كنص: منصلّحها بدل ما نوقف حفظ كل المنتجات
    if (typeof p.price !== "number") p.price = parseFloat(String(p.price ?? "").replace(/[^\d.]/g, ""));
    if (!Number.isFinite(p.price) || p.price < 0) return json({ error: `سعر المنتج «${p.name}» غلط. اكتب رقم وجرّب مرة تانية` }, 400);
    if (!String(p.category || "").trim()) p.category = (p.also || []).find(Boolean) || "منتجات";
  }
  await saveProducts(env, list);
  return json({ ok: true, count: list.length });
}

// ---------- discounts: automatic ones and coupon codes (same maths in the shop) ----------
function calcDiscount(d, items, subtotal, now) {
  if (!d || d.on === false) return null;
  if (d.start && now < Date.parse(d.start)) return null;
  if (d.end && now > Date.parse(d.end) + 864e5) return null;
  if (+d.min > 0 && subtotal < +d.min) return null;
  const elig = items.filter((i) => (d.scope === "cats" ? (d.cats || []).some((c) => i.category === c || (i.also || []).includes(c)) : d.scope === "products" ? (d.pids || []).includes(i.id) : true));
  const base = elig.reduce((a, i) => a + i.price * i.qty, 0);
  if (!base) return null;
  let amount = 0;
  if (d.kind === "percent") amount = (base * Math.min(100, Math.max(0, +d.value || 0))) / 100;
  else if (d.kind === "fixed") amount = Math.min(base, Math.max(0, +d.value || 0));
  amount = Math.round(amount * 100) / 100;
  const freeShip = d.kind === "freeship";
  if (!amount && !freeShip) return null;
  return { id: d.id, name: d.name || "", code: d.type === "code" ? String(d.code || "").toUpperCase() : "", amount, freeShip };
}
function pickDiscount(list, items, subtotal, code, used) {
  const now = Date.now(); let auto = null, coupon = null;
  const want = String(code || "").trim().toUpperCase();
  for (const d of list || []) {
    if (+d.limit > 0 && (used[d.id] || 0) >= +d.limit) continue;
    if (d.type === "code") { if (want && String(d.code || "").trim().toUpperCase() === want) coupon = calcDiscount(d, items, subtotal, now) || coupon; continue; }
    const r = calcDiscount(d, items, subtotal, now);
    if (r && (!auto || r.amount > auto.amount)) auto = r;
  }
  const best = !coupon ? auto : !auto ? coupon : coupon.amount >= auto.amount || coupon.freeShip ? coupon : auto;
  return { best, coupon, wanted: !!want };
}

// ---------- /api/orders ----------
async function ordersPost(request, env, ctx) {
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.items) || !body.items.length || !body.customer) return json({ error: "الطلب ناقص" }, 400);
  if (body.items.length > 50) return json({ error: "عدد المنتجات كبير" }, 400);

  const c = body.customer;
  const customer = {
    name: clip(c.name, 80), phone: clip(c.phone, 20), governorate: clip(c.governorate, 30),
    address: clip(c.address, 200), center: clip(c.center, 120), notes: clip(c.notes, 500),
    email: clip(c.email, 120), altPhone: clip(c.altPhone, 20), postal: clip(c.postal, 20),
  };
  const settings = await getSettings(env, request);
  const CO = settings.checkout || {};
  const words = customer.name.split(/\s+/).filter(Boolean).length;
  const needWords = 3; // first name, father's name, family name
  if (words < needWords) return json({ error: needWords === 3 ? "اكتب الاسم الثلاثي" : needWords === 2 ? "اكتب الاسم الأول والأخير" : "اكتب الاسم" }, 400);
  const hasPhone = customer.phone.replace(/\D/g, "").length >= 9, hasEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email);
  if (customer.phone && !hasPhone) return json({ error: "رقم الموبايل مو صحيح" }, 400);
  if (customer.email && !hasEmail) return json({ error: "الإيميل مو صحيح" }, 400);
  if (!hasPhone) return json({ error: "اكتب رقم الموبايل" }, 400); // no account needed: three names + phone + delivery are enough
  customer.altPhone = ""; customer.postal = "";
  if (!customer.governorate) return json({ error: "اختار المحافظة" }, 400);

  // shipping: governorate → company → branch (or home address) → allowed payment
  let zone, carrier = null, branch = null;
  const carriers = ((settings.shipping && settings.shipping.carriers) || []).filter((c) => c.on !== false);
  if (carriers.length) {
    carrier = carriers.find((c) => c.id === body.carrier);
    const g = carrier && (carrier.govs || []).find((x) => x.name === customer.governorate);
    if (!carrier || !g) return json({ error: "اختار شركة الشحن المتاحة لمحافظتك" }, 400);
    if (carrier.type === "branch") {
      branch = (g.branches || []).find((b) => b.name === body.branch);
      if (!branch) return json({ error: "اختار الفرع" }, 400);
      customer.center = branch.name; customer.address = "";
    } else customer.center = ""; // home delivery: the address is optional, the shop confirms it on WhatsApp
    const flat = carrier.flatFee === "" || carrier.flatFee == null || isNaN(+carrier.flatFee) ? null : +carrier.flatFee;
    zone = { method: carrier.type === "branch" ? "qadmous" : "door", fee: g.fee ?? flat };
  } else {
    zone = settings.delivery.zones.find((z) => z.gov === customer.governorate);
    if (!zone || zone.method === "off") return json({ error: "ما في توصيل لهالمحافظة حالياً" }, 400);
    if (zone.method === "qadmous" && customer.center.length < 3) return json({ error: "اكتب اسم مركز القدموس" }, 400);
    if (zone.method === "door") customer.center = ""; else customer.address = "";
  }
  const enabledPays = settings.payments.filter((p) => p.enabled);
  const allowed = carrier && (carrier.payments || []).length ? enabledPays.filter((p) => carrier.payments.includes(p.id)) : [];
  const usable = allowed.length ? allowed : enabledPays;
  const pay = usable.find((p) => p.id === body.payment) || (!body.payment && usable[0]);
  if (!pay) return json({ error: "اختار طريقة الدفع" }, 400);

  const products = await getProducts(env, request);
  const byId = new Map(products.map((p) => [p.id, p]));
  const items = [];
  for (const it of body.items) {
    const p = byId.get(it.id);
    if (!p || p.hidden) return json({ error: "في منتج بالسلة ما عاد موجود، حدّث الصفحة" }, 409);
    if (!p.inStock) return json({ error: `«${p.name}» صار خالص، شيله من السلة` }, 409);
    const qty = Math.max(1, Math.min(99, parseInt(it.qty) || 1));
    const opt = clip(it.opt, 40);
    if (opt && !(p.options || []).includes(opt)) return json({ error: `الخيار مو صحيح لـ «${p.name}»` }, 400);
    items.push({ id: p.id, name: p.name, opt, qty, price: p.price, image: p.image });
  }
  const round = (n) => Math.round(n * 100) / 100;
  const subtotal = round(items.reduce((s, i) => s + i.price * i.qty, 0));
  const custs = (await env.STORE.get("customers", "json").catch(() => null)) || {};
  const ck = custKey(customer.phone, customer.email);
  if (ck && custs[ck] && custs[ck].blocked) return json({ error: "ما فينا نستقبل طلبات من هالحساب حالياً، تواصل معنا على واتساب" }, 403);
  const used = (await env.STORE.get("disc_used", "json").catch(() => null)) || {};
  const full = items.map((i) => ({ ...i, category: byId.get(i.id).category, also: byId.get(i.id).also || [] }));
  const pd = pickDiscount(settings.discounts, full, subtotal, body.coupon, used);
  if (pd.wanted && !pd.coupon) return json({ error: "كود الخصم مو صالح أو انتهى" }, 400);
  const disc = pd.best;
  const free = (settings.delivery.freeOver > 0 && subtotal >= settings.delivery.freeOver) || (disc && disc.freeShip);
  const heavy = items.some((i) => isHeavy(byId.get(i.id), (settings.shipping || {}).heavy));
  const fee = heavy ? null : free ? 0 : zone.fee; // null = يُحدد لاحقاً (heavy things always)
  const afterDisc = Math.max(0, subtotal - (disc ? disc.amount : 0));
  const T = settings.tax || {};
  const tax = T.on && +T.rate > 0 ? { rate: +T.rate, mode: T.mode === "included" ? "included" : "added", label: T.label || "الضريبة",
    amount: round(T.mode === "included" ? (afterDisc * +T.rate) / (100 + +T.rate) : (afterDisc * +T.rate) / 100) } : null;
  const total = round(afterDisc + (tax && tax.mode === "added" ? tax.amount : 0) + (fee || 0));

  // the currency the visitor was looking at (the rate comes from our own copy, never from the browser)
  let display = { cur: "usd", rate: 0 };
  if (body.cur === "syp") { const r = await fxRate(env, ctx, settings); if (r > 0) display = { cur: "syp", rate: r }; }
  const ts = Date.now();
  let md = "";
  try { md = new Intl.DateTimeFormat("en-GB", { timeZone: settings.store.tz || "Asia/Damascus", month: "2-digit", day: "2-digit" }).formatToParts(new Date(ts)).filter((x) => x.type !== "literal").reverse().map((x) => x.value).join(""); }
  catch { const d = new Date(ts + 3 * 3600e3); md = String(d.getUTCMonth() + 1).padStart(2, "0") + String(d.getUTCDate()).padStart(2, "0"); }
  const id = `KO-${md}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const order = {
    id, createdAt: new Date(ts).toISOString(), status: pay.manual ? "pending_payment" : "new", customer, items, subtotal, total,
    discount: disc ? { name: disc.name, code: disc.code, amount: disc.amount, freeShip: disc.freeShip } : null, tax,
    delivery: { method: zone.method, fee, carrier: carrier ? carrier.name : "", carrierId: carrier ? carrier.id : "", branch: branch ? branch.name : "", branchAddress: branch ? branch.address : "" },
    payment: { id: pay.id, name: pay.name, details: pay.details || "", qr: "", manual: !!pay.manual }, display,
  };
  await env.STORE.put(orderKey(ts, id), JSON.stringify(order));
  await env.STORE.put(`orderid:${id}`, orderKey(ts, id));
  // discount usage + the abandoned cart of this visitor is now an order
  if (disc) ctx.waitUntil((async () => { const u = (await env.STORE.get("disc_used", "json")) || {}; u[disc.id] = (u[disc.id] || 0) + 1; await env.STORE.put("disc_used", JSON.stringify(u)); })().catch(() => {}));
  if (/^[a-z0-9]{8,32}$/.test(body.sid || "")) ctx.waitUntil(env.STORE.delete("cart:" + body.sid).catch(() => {}));
  // best-sellers counter
  ctx.waitUntil((async () => {
    const sales = (await env.STORE.get("sales", "json")) || {};
    for (const i of items) sales[i.id] = (sales[i.id] || 0) + i.qty;
    await env.STORE.put("sales", JSON.stringify(sales));
    await purgeEdge("products");
  })().catch(() => {}));

  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    const text = orderText(order, new URL(request.url).origin);
    ctx.waitUntil(fetch(`https://api.telegram.org/bot${String(env.TELEGRAM_BOT_TOKEN).trim()}/sendMessage`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: String(env.TELEGRAM_CHAT_ID).trim(), text }),
    }).catch(() => {}));
  }
  ctx.waitUntil(pushToAdmins(env, { title: `🛒 طلب جديد ${id}`, body: `${customer.name} — ${customer.governorate || ""} — ${moneyOf(order)(total)}`, url: "/admin", tag: "order-" + id }));
  const mails = ((settings.notify && settings.notify.emails) || []).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)).slice(0, 5);
  if (env.RESEND_API_KEY && mails.length) {
    const h = (x) => String(x ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const html = `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;font-size:15px"><h2>🛒 طلب جديد ${h(id)}</h2><p><b>${h(customer.name)}</b> — ${h(customer.phone)}${customer.email ? " — " + h(customer.email) : ""}<br>${h(customer.governorate)} — ${h(carrier ? carrier.name : "")} ${h(branch ? branch.name : customer.address)}</p><table cellpadding="6" style="border-collapse:collapse">${items.map((i) => `<tr><td>${h(i.name)}${i.opt ? " (" + h(i.opt) + ")" : ""}</td><td>× ${i.qty}</td><td>${settings.currency}${i.price * i.qty}</td></tr>`).join("")}</table>${disc ? `<p>خصم: ${h(disc.name)} −${disc.amount}</p>` : ""}<p><b>المجموع: ${settings.currency}${total}${fee === null ? " + التوصيل" : ""}</b> — الدفع: ${h(pay.name)}</p>${customer.notes ? `<p>ملاحظات: ${h(customer.notes)}</p>` : ""}</div>`;
    ctx.waitUntil(fetch("https://api.resend.com/emails", {
      method: "POST", headers: { authorization: "Bearer " + env.RESEND_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({ from: env.MAIL_FROM || `${settings.store.name || "KO SPORT"} <onboarding@resend.dev>`, to: mails, subject: `طلب جديد ${id} — ${settings.currency}${total}`, html }),
    }).catch(() => {}));
  }
  return json({ ok: true, order }, 201);
}

async function ordersGet(request, env) {
  if (!isAdmin(request, env, "orders")) return denied();
  const url = new URL(request.url);
  const res = await env.STORE.list({ prefix: "order:", limit: 100, cursor: url.searchParams.get("cursor") || undefined });
  const orders = (await Promise.all(res.keys.map((k) => env.STORE.get(k.name, "json")))).filter(Boolean);
  return json({ orders, cursor: res.list_complete ? null : res.cursor });
}

// ---------- simple per-visitor limits (edge cache counters) ----------
async function throttle(request, name, max, secs) {
  if (typeof caches === "undefined") return false;
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const key = new Request(`https://limit.internal/${name}/${encodeURIComponent(ip)}`);
  const hit = await caches.default.match(key);
  const n = hit ? parseInt(await hit.text()) || 0 : 0;
  if (n >= max) return true;
  await caches.default.put(key, new Response(String(n + 1), { headers: { "cache-control": "max-age=" + secs } }));
  return false;
}

// ---------- product reviews: customers write, the owner approves in the dashboard ----------
const getReviews = async (env) => (await env.STORE.get("reviews", "json")) || [];
async function reviewsPost(request, env, ctx) {
  const b = await request.json().catch(() => null);
  if (!b) return json({ error: "الطلب ناقص" }, 400);
  const pid = clip(b.pid, 160), name = clip(b.name, 40), text = clip(b.text, 600), rating = parseInt(b.rating);
  if (!(rating >= 1 && rating <= 5)) return json({ error: "اختار عدد النجوم" }, 400);
  if (name.length < 2) return json({ error: "اكتب اسمك" }, 400);
  const products = await getProducts(env, request);
  const p = products.find((x) => x.id === pid && !x.hidden);
  if (!p) return json({ error: "المنتج مو موجود" }, 404);
  if (await throttle(request, "review", 5, 3600)) return json({ error: "كتبت تقييمات كتير، جرّب بعد شوي" }, 429);
  const settings = await getSettings(env, request);
  const auto = settings.design.reviewsAuto === true;
  const list = await getReviews(env);
  list.push({ id: newKey().slice(0, 12), pid, pname: p.name, name, rating, text, at: new Date().toISOString(), ok: auto });
  if (list.length > 3000) list.splice(0, list.length - 3000);
  await env.STORE.put("reviews", JSON.stringify(list));
  if (auto) { await purgeEdge("products"); await purgeEdge("rev:" + encodeURIComponent(pid)); }
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    ctx.waitUntil(fetch(`https://api.telegram.org/bot${String(env.TELEGRAM_BOT_TOKEN).trim()}/sendMessage`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: String(env.TELEGRAM_CHAT_ID).trim(), text: `⭐ تقييم جديد (${rating}/5) على «${p.name}»\n${name}: ${text}${auto ? "" : "\nبانتظار موافقتك من لوحة التحكم"}` }),
    }).catch(() => {}));
  }
  return json({ ok: true, pending: !auto }, 201);
}
async function reviewsGet(request, env, ctx) {
  const id = new URL(request.url).searchParams.get("id");
  if (id) return edgeCached("rev:" + encodeURIComponent(id), ctx, async () =>
    (await getReviews(env)).filter((r) => r.ok && r.pid === id).reverse().slice(0, 100).map(({ name, rating, text, at }) => ({ name, rating, text, at })));
  if (!isAdmin(request, env)) return denied();
  return json((await getReviews(env)).slice().reverse());
}
async function reviewChange(request, env, rid, del) {
  if (!isAdmin(request, env)) return denied();
  const list = await getReviews(env);
  const i = list.findIndex((r) => r.id === rid);
  if (i < 0) return json({ error: "التقييم مو موجود" }, 404);
  const pid = list[i].pid;
  if (del) list.splice(i, 1);
  else { const b = await request.json().catch(() => ({})); list[i].ok = !!b.ok; }
  await env.STORE.put("reviews", JSON.stringify(list));
  await purgeEdge("products"); await purgeEdge("rev:" + encodeURIComponent(pid));
  return json({ ok: true });
}

// ---------- order tracking for customers: order number + the phone used ----------
async function orderTrack(request, env) {
  const u = new URL(request.url), no = clip(u.searchParams.get("no"), 30).toUpperCase(), phone = clip(u.searchParams.get("phone"), 30);
  if (await throttle(request, "track", 30, 3600)) return json({ error: "محاولات كتير، جرّب بعد شوي" }, 429);
  const miss = () => json({ error: "ما لقينا طلب بهالرقم وهالموبايل" }, 404);
  const key = no && (await env.STORE.get("orderid:" + no));
  if (!key) return miss();
  const o = await env.STORE.get(key, "json");
  const last = (s) => String(s || "").replace(/\D/g, "").slice(-7);
  if (!o || last(phone).length < 7 || last(o.customer.phone) !== last(phone)) return miss();
  return json({ id: o.id, status: o.status, createdAt: o.createdAt, total: o.total, items: o.items.map(({ name, opt, qty, image }) => ({ name, opt, qty, image })),
    delivery: { carrier: o.delivery.carrier, branch: o.delivery.branch, fee: o.delivery.fee }, payment: { name: o.payment.name } });
}

// ---------- coupon check from the checkout page ----------
async function couponCheck(request, env) {
  if (await throttle(request, "coupon", 40, 3600)) return json({ error: "محاولات كتير، جرّب بعد شوي" }, 429);
  const b = await request.json().catch(() => null);
  if (!b || !Array.isArray(b.items)) return json({ error: "الطلب ناقص" }, 400);
  const [settings, products] = await Promise.all([getSettings(env, request), getProducts(env, request)]);
  const byId = new Map(products.map((p) => [p.id, p]));
  const items = b.items.slice(0, 50).map((i) => { const p = byId.get(i.id); return p && { id: p.id, price: p.price, qty: Math.max(1, Math.min(99, parseInt(i.qty) || 1)), category: p.category, also: p.also || [] }; }).filter(Boolean);
  const subtotal = items.reduce((a, i) => a + i.price * i.qty, 0);
  const used = (await env.STORE.get("disc_used", "json").catch(() => null)) || {};
  const pd = pickDiscount(settings.discounts, items, subtotal, b.code, used);
  if (!pd.coupon) {
    const d = (settings.discounts || []).find((x) => x.type === "code" && String(x.code || "").toUpperCase() === String(b.code || "").trim().toUpperCase() && x.on !== false);
    return json({ error: d && +d.min > subtotal ? `الكود بيشتغل للطلبات فوق ${settings.currency}${d.min}` : "كود الخصم مو صالح أو انتهى" }, 404);
  }
  return json({ ok: true, discount: pd.coupon, better: pd.best !== pd.coupon ? pd.best : null });
}
async function discountsUsed(request, env) {
  if (!isAdmin(request, env)) return denied();
  return json((await env.STORE.get("disc_used", "json")) || {});
}

// ---------- abandoned carts: saved when a visitor types a phone at checkout but doesn't finish ----------
async function cartSave(request, env) {
  if (await throttle(request, "cart", 60, 3600)) return json({ ok: false }, 429);
  const b = await request.json().catch(() => null);
  if (!b || !/^[a-z0-9]{8,32}$/.test(b.sid || "") || !Array.isArray(b.items) || !b.items.length) return json({ error: "ناقص" }, 400);
  const phone = clip(b.phone, 30);
  if (phone.replace(/\D/g, "").length < 9) return json({ error: "ناقص" }, 400);
  const products = await getProducts(env, request), byId = new Map(products.map((p) => [p.id, p]));
  const items = b.items.slice(0, 50).map((i) => { const p = byId.get(i.id); return p && { id: p.id, name: p.name, opt: clip(i.opt, 40), qty: Math.max(1, Math.min(99, parseInt(i.qty) || 1)), price: p.price, image: p.thumb || p.image || "" }; }).filter(Boolean);
  if (!items.length) return json({ error: "ناقص" }, 400);
  const cart = { sid: b.sid, at: new Date().toISOString(), name: clip(b.name, 80), phone, gov: clip(b.governorate, 40), items, total: Math.round(items.reduce((a, i) => a + i.price * i.qty, 0) * 100) / 100 };
  await env.STORE.put("cart:" + b.sid, JSON.stringify(cart), { expirationTtl: 30 * 86400 });
  return json({ ok: true });
}
async function cartsGet(request, env) {
  if (!isAdmin(request, env, "orders")) return denied();
  const res = await env.STORE.list({ prefix: "cart:", limit: 300 });
  const carts = (await Promise.all(res.keys.map((k) => env.STORE.get(k.name, "json")))).filter(Boolean).sort((a, b) => b.at.localeCompare(a.at));
  return json(carts);
}
async function cartDelete(request, env, sid) {
  if (!isAdmin(request, env, "orders")) return denied();
  await env.STORE.delete("cart:" + sid);
  return json({ ok: true });
}

// ---------- customers: notes, tags, blocking, manual adds and imports (orders give the rest) ----------
function custKey(phone, email) {
  const d = String(phone || "").replace(/\D/g, "").slice(-9);
  if (d.length >= 9) return "p" + d;
  const e = String(email || "").trim().toLowerCase();
  return e && /@/.test(e) ? "e" + e.slice(0, 80) : "";
}
function cleanCust(b) {
  return { name: clip(b.name, 80), phone: clip(b.phone, 30), email: clip(b.email, 80), gov: clip(b.gov, 40), address: clip(b.address, 160),
    tags: (Array.isArray(b.tags) ? b.tags : String(b.tags || "").split(/[,،]/)).map((t) => clip(t, 24)).filter(Boolean).slice(0, 10),
    note: clip(b.note, 500), blocked: !!b.blocked, manual: !!b.manual, at: b.at || new Date().toISOString() };
}
async function customersApi(request, env, m, key) {
  if (!isAdmin(request, env, "orders")) return denied();
  const all = (await env.STORE.get("customers", "json")) || {};
  if (m === "GET") return json(all);
  if (m === "DELETE") { delete all[key]; await env.STORE.put("customers", JSON.stringify(all)); return json({ ok: true }); }
  const b = await request.json().catch(() => null);
  if (!b) return json({ error: "ناقص" }, 400);
  if (m === "POST") { // import many
    if (!isAdmin(request, env)) return denied();
    let n = 0;
    for (const x of (b.list || []).slice(0, 5000)) { const c = cleanCust({ ...x, manual: true }), k = custKey(c.phone, c.email); if (!k || !c.name) continue; all[k] = { ...c, ...(all[k] || {}), tags: [...new Set([...(all[k]?.tags || []), ...c.tags])] }; n++; }
    await env.STORE.put("customers", JSON.stringify(all));
    return json({ ok: true, added: n });
  }
  const c = cleanCust(b), k = custKey(c.phone, c.email);
  if (!c.name) return json({ error: "اكتب اسم العميل" }, 400);
  if (!k) return json({ error: "اكتب رقم موبايل صحيح أو إيميل" }, 400);
  if (b.oldKey && b.oldKey !== k) delete all[b.oldKey];
  all[k] = c;
  if (Object.keys(all).length > 20000) return json({ error: "العملاء كتار كتير" }, 400);
  await env.STORE.put("customers", JSON.stringify(all));
  return json({ ok: true, key: k, customer: c });
}

// ---------- staff accounts (owner only) ----------
async function staffApi(request, env, m, id) {
  if (!isAdmin(request, env, "owner")) return json({ error: "بس صاحب المتجر بيقدر يدير الموظفين" }, 403);
  const list = (await env.STORE.get("staff", "json")) || [];
  const pub = () => list.map(({ id, name, role, on, at }) => ({ id, name, role, on, at }));
  if (m === "GET") return json(pub());
  if (m === "DELETE") { const i = list.findIndex((s) => s.id === id); if (i >= 0) list.splice(i, 1); await env.STORE.put("staff", JSON.stringify(list)); return json(pub()); }
  const b = await request.json().catch(() => null);
  if (!b) return json({ error: "ناقص" }, 400);
  let s = id ? list.find((x) => x.id === id) : null;
  if (id && !s) return json({ error: "الموظف مو موجود" }, 404);
  if (!s) { if (list.length >= 20) return json({ error: "أقصى شي 20 موظف" }, 400); s = { id: newKey().slice(0, 10), at: new Date().toISOString(), on: true }; list.push(s); }
  if (b.name !== undefined) s.name = clip(b.name, 40);
  if (!s.name) return json({ error: "اكتب اسم الموظف" }, 400);
  if (b.role !== undefined) s.role = b.role === "orders" ? "orders" : "manager";
  if (b.on !== undefined) s.on = !!b.on;
  if (b.password) {
    if (String(b.password).length < 8) return json({ error: "كلمة السر لازم 8 أحرف عالأقل" }, 400);
    if (env.ADMIN_PASSWORD && b.password === env.ADMIN_PASSWORD) return json({ error: "اختار كلمة سر غير كلمة سر المالك" }, 400);
    s.salt = newKey(); s.hash = await sha(s.salt + b.password);
  }
  if (!s.hash) return json({ error: "اكتب كلمة سر للموظف" }, 400);
  await env.STORE.put("staff", JSON.stringify(list));
  return json(pub());
}
async function statusApi(request, env) {
  if (!isAdmin(request, env)) return denied();
  // which Telegram settings this running copy can see (never the values themselves)
  const tok = String(env.TELEGRAM_BOT_TOKEN || "").trim(), chat = String(env.TELEGRAM_CHAT_ID || "").trim();
  const tg = { token: !!tok, chat: !!chat, tokenOk: /^\d{5,}:[\w-]{25,}$/.test(tok), chatOk: /^-?\d{4,}$|^@\w{4,}$/.test(chat) };
  return json({ telegram: !!(tok && chat), tg, ai: !!env.AI, gemini: !!String(env.GEMINI_API_KEY || "").trim(), email: !!env.RESEND_API_KEY, host: new URL(request.url).host, role: env.__role });
}

// «ابعت رسالة تجربة»: tells the owner in plain words why Telegram refuses (bad token, chat not found, …)
async function telegramTest(request, env) {
  if (!isAdmin(request, env, "owner")) return denied();
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return json({ ok: false, why: "missing" });
  try {
    const r = await fetch(`https://api.telegram.org/bot${String(env.TELEGRAM_BOT_TOKEN).trim()}/sendMessage`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: String(env.TELEGRAM_CHAT_ID).trim(), text: "✅ تجربة من متجرك: إشعارات الطلبات شغّالة." }),
    });
    const d = await r.json().catch(() => ({}));
    if (d.ok) return json({ ok: true });
    const desc = String(d.description || r.status);
    const why = r.status === 401 || r.status === 404 ? "token" : /chat not found/i.test(desc) ? "chat" : /blocked|deactivated|kicked/i.test(desc) ? "blocked" : "other";
    return json({ ok: false, why, desc: desc.slice(0, 200) });
  } catch { return json({ ok: false, why: "net" }); }
}

const STATUSES = ["new", "pending_payment", "paid", "confirmed", "shipped", "delivered", "cancelled"];
async function findOrder(env, id) {
  const key = await env.STORE.get(`orderid:${id}`);
  if (!key) return null;
  const order = await env.STORE.get(key, "json");
  return order ? { key, order } : null;
}
async function orderPatch(request, env, id) {
  if (!isAdmin(request, env, "orders")) return denied();
  const found = await findOrder(env, id);
  if (!found) return json({ error: "الطلب مو موجود" }, 404);
  const body = await request.json().catch(() => ({}));
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) return json({ error: "حالة غلط" }, 400);
    found.order.status = body.status;
  }
  if (body.adminNote !== undefined) found.order.adminNote = clip(body.adminNote, 500);
  found.order.updatedAt = new Date().toISOString();
  await env.STORE.put(found.key, JSON.stringify(found.order));
  return json({ ok: true, order: found.order });
}
async function orderDelete(request, env, id) {
  if (!isAdmin(request, env)) return denied();
  const found = await findOrder(env, id);
  if (!found) return json({ error: "الطلب مو موجود" }, 404);
  await env.STORE.delete(found.key);
  await env.STORE.delete(`orderid:${id}`);
  return json({ ok: true });
}

// ---------- /api/images ----------
const MAX_IMG = 3 * 1024 * 1024;
async function imageUpload(request, env) {
  if (!isAdmin(request, env)) return denied();
  const type = request.headers.get("content-type") || "";
  if (!type.startsWith("image/")) return json({ error: "لازم يكون صورة" }, 400);
  const buf = await request.arrayBuffer();
  if (buf.byteLength > MAX_IMG) return json({ error: "الصورة كبيرة (أكتر من 3MB)" }, 400);
  const key = newKey();
  await env.STORE.put(`img:${key}`, buf, { metadata: { type } });
  return json({ url: `/img/${key}` });
}

// ---------- /api/media: uploaded songs and videos ----------
// KV values max out at 25MB, so uploads are capped at 24MB. Served with Range support (iPhone/Safari need it to play at all).
const MAX_MEDIA = 24 * 1024 * 1024;
const MEDIA_TYPES = /^(audio\/(mpeg|mp3|mp4|x-m4a|m4a|aac|ogg|opus|wav|x-wav|wave|webm|flac)|video\/(mp4|webm|ogg|quicktime))$/;
async function mediaUpload(request, env) {
  if (!isAdmin(request, env)) return denied();
  const type = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!MEDIA_TYPES.test(type)) return json({ error: "نوع الملف مو مدعوم. المدعوم: mp3 / m4a / wav / ogg / mp4 / webm" }, 400);
  if ((+request.headers.get("content-length") || 0) > MAX_MEDIA + 4096) return json({ error: "الملف كبير (الحد 24 ميغا). ضغطه أو حط رابط بدل الرفع." }, 400);
  const buf = await request.arrayBuffer();
  if (!buf.byteLength) return json({ error: "الملف فاضي" }, 400);
  if (buf.byteLength > MAX_MEDIA) return json({ error: "الملف كبير (الحد 24 ميغا). ضغطه أو حط رابط بدل الرفع." }, 400);
  const key = newKey();
  await env.STORE.put(`med:${key}`, buf, { metadata: { type } });
  return json({ url: `/media/${key}`, size: buf.byteLength });
}
async function mediaGet(request, env, key) {
  if (!/^[a-z0-9]{10,40}$/.test(key)) return new Response("Not found", { status: 404 });
  const { value, metadata } = await env.STORE.getWithMetadata(`med:${key}`, { type: "arrayBuffer", cacheTtl: 3600 });
  if (!value) return new Response("Not found", { status: 404 });
  const size = value.byteLength;
  const base = { "content-type": metadata?.type || "audio/mpeg", "accept-ranges": "bytes", "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" };
  const m = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") || "");
  if (m && (m[1] || m[2])) {
    let start, end;
    if (m[1] === "") { start = Math.max(0, size - +m[2]); end = size - 1; }
    else { start = +m[1]; end = m[2] === "" ? size - 1 : Math.min(+m[2], size - 1); }
    if (start > end || start >= size) return new Response(null, { status: 416, headers: { ...base, "content-range": `bytes */${size}` } });
    return new Response(value.slice(start, end + 1), { status: 206, headers: { ...base, "content-range": `bytes ${start}-${end}/${size}`, "content-length": String(end - start + 1) } });
  }
  return new Response(request.method === "HEAD" ? null : value, { headers: { ...base, "content-length": String(size) } });
}

// Copies a batch of external images (e.g. from Wuilt) into KV and repoints products.
// The dashboard calls this repeatedly until remaining = 0.
async function imageMigrate(request, env) {
  if (!isAdmin(request, env)) return denied();
  const { limit = 15, retryFailed = false } = await request.json().catch(() => ({}));
  const list = await getProducts(env, request);
  if (retryFailed) for (const p of list) delete p.imageCopyFailed;
  const external = (p) => /^https?:\/\//.test(p.image || "") && !p.imageCopyFailed;
  const batch = list.filter(external).slice(0, Math.min(20, limit));
  const failed = [];
  const done = new Map();
  for (const p of batch) {
    try {
      let url = done.get(p.image);
      if (!url) {
        const r = await fetch(p.image);
        if (!r.ok) throw new Error(String(r.status));
        const buf = await r.arrayBuffer();
        const key = newKey();
        await env.STORE.put(`img:${key}`, buf, { metadata: { type: r.headers.get("content-type") || "image/webp" } });
        url = `/img/${key}`;
        done.set(p.image, url);
      }
      const src = p.image;
      for (const q of list) if (q.image === src) { q.originalImage = src; q.image = url; }
    } catch {
      p.imageCopyFailed = true;
      failed.push(p.name);
    }
  }
  await saveProducts(env, list);
  return json({ copied: done.size, failed, remaining: list.filter(external).length });
}

// ---------- /api/ai/describe: product description + specs written by Cloudflare Workers AI ----------
const AI_MODELS = ["@cf/meta/llama-3.3-70b-instruct-fp8-fast", "@cf/qwen/qwen3-30b-a3b-fp8", "@cf/meta/llama-3.1-8b-instruct"];
async function aiDescribe(request, env) {
  if (!isAdmin(request, env)) return denied();
  if (!env.AI) return json({ error: "الذكاء الاصطناعي مو مربوط: Settings ← Bindings ← Add ← Workers AI، واسمه AI، وبعدين ارفع الموقع من جديد" }, 500);
  const { product: p = {}, store = "KO SPORT" } = await request.json().catch(() => ({}));
  if (!p.name) return json({ error: "المنتج بدون اسم" }, 400);
  const facts = [
    `الاسم: ${clip(p.name, 120)}`, `القسم: ${clip(p.category, 60)}`,
    p.also && p.also.length ? `أقسام أخرى: ${p.also.slice(0, 4).join("، ")}` : "",
    p.options && p.options.length ? `الخيارات المتاحة: ${p.options.slice(0, 12).join("، ")}` : "",
    p.sports && p.sports.length ? `الرياضة: ${p.sports.join("، ")}` : "",
    typeof p.price === "number" ? `السعر: ${p.price}$` : "",
  ].filter(Boolean).join("\n");
  const system = `أنت كاتب محتوى محترف لمتجر ${store} للأدوات الرياضية في سوريا.
اكتب بالعربية الفصحى البسيطة والواضحة، بأسلوب تسويقي صادق ومختصر.
قواعد صارمة:
- لا تخترع أرقاماً أو مقاسات أو أوزاناً أو مواد أو بلد صنع أو ضماناً غير موجود في المعلومات أو في اسم المنتج.
- إذا ذُكر في الاسم ماركة أو مقاس أو وزن أو طول أو لون فاستعمله.
- المواصفات تكون من الاسم والمعطيات، أو صفات عامة صحيحة دائماً لهذا النوع من المنتجات (مثل: الاستخدام المناسب، لمن يناسب).
- أعد JSON فقط بدون أي نص آخر وبدون markdown، بهذا الشكل بالضبط:
{"description":"وصف من 2 إلى 3 جمل","specs":[["البند","القيمة"],["البند","القيمة"]],"features":["ميزة","ميزة"],"usage":["خطوة أو نصيحة استخدام"],"care":["نصيحة عناية"],"fit":["لمين بيناسب"]}
- عدد المواصفات من 4 إلى 6.
- features من 3 إلى 5 جمل قصيرة، usage من 2 إلى 4، care من 2 إلى 3، fit من 1 إلى 3. كلها صحيحة لهذا النوع من المنتجات وبدون أرقام مخترعة.`;
  let last = "";
  for (const model of AI_MODELS) {
    try {
      const out = await env.AI.run(model, {
        messages: [{ role: "system", content: system }, { role: "user", content: `معلومات المنتج:\n${facts}` }],
        max_tokens: 1100, temperature: 0.4,
      });
      let text = typeof out === "string" ? out : out.response ?? out.result?.response ?? (out.choices && out.choices[0]?.message?.content) ?? "";
      if (typeof text !== "string") text = JSON.stringify(text);
      text = text.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/```(json)?/g, "");
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) { last = "رد غير مفهوم"; continue; }
      const j = JSON.parse(m[0]);
      const description = clip(j.description, 700);
      const specs = (Array.isArray(j.specs) ? j.specs : [])
        .map((x) => (Array.isArray(x) ? x : [x && (x.name || x.key || x.k), x && (x.value || x.v)]))
        .filter((x) => x[0] && x[1]).slice(0, 8).map((x) => [clip(x[0], 40), clip(x[1], 120)]);
      if (!description) { last = "وصف فاضي"; continue; }
      const list = (x) => (Array.isArray(x) ? x : []).map((t) => clip(typeof t === "string" ? t : t && (t.text || t.value), 160)).filter(Boolean).slice(0, 6);
      const sec = [["المميزات", list(j.features)], ["طريقة الاستخدام", list(j.usage)], ["العناية", list(j.care)], ["لمين بيناسب", list(j.fit)]].filter(([, a]) => a.length);
      const details = sec.map(([t, a]) => `## ${t}\n` + a.map((x) => "- " + x).join("\n")).join("\n");
      return json({ description, specs, details, model });
    } catch (e) { last = String(e && e.message || e); }
  }
  return json({ error: "ما قدر الذكاء الاصطناعي يكتب: " + last }, 502);
}

// ---------- /api/ai/spell: spelling mistakes only (the Syrian dialect stays as it is) ----------
// The model lists [wrong, right] pairs; only pure spelling fixes are kept: same word once hamza / ة / ى are
// ignored, or one-letter typos in longer words — so dialect words (هاد، متل، بدك…) are never "corrected".
const spNorm = (t) => String(t).replace(/[\u064B-\u0652\u0640]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ؤ/g, "و").replace(/ئ/g, "ي").replace(/ء/g, "").replace(/ة/g, "ه").replace(/ى/g, "ي");
function lev1(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, d = 0;
  while (i < a.length && j < b.length) { if (a[i] === b[j]) { i++; j++; continue; } if (++d > 1) return false; if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; } }
  return d + (a.length - i) + (b.length - j) <= 1;
}
async function aiSpell(request, env) {
  if (!isAdmin(request, env)) return denied();
  if (!env.AI) return json({ error: "الذكاء الاصطناعي مو مربوط" }, 500);
  const { text = "" } = await request.json().catch(() => ({}));
  const src = String(text).slice(0, 3000);
  if (!src.trim()) return json({ fixes: [] });
  const system = `أنت مدقق إملائي لنصوص متجر رياضي مكتوبة باللهجة السورية العامية.
مهمتك: إيجاد الأخطاء الإملائية فقط (همزات ناقصة أو غلط، تاء مربوطة وهاء، ألف مقصورة، حرف ناقص أو زايد أو مبدّل بالغلط).
ممنوع تحويل اللهجة للفصحى: كلمات مثل هاد، هيك، متل، بدك، يلي، شو، مو، كتير، منيح، هلق، عالكيس، بيخلي، بتحمي صحيحة ولا تغيّرها.
ممنوع تغيير أسماء الماركات أو الكلمات الإنكليزية.
أعد JSON فقط: {"fixes":[["الكلمة الغلط","الكلمة الصح"]]} — وإذا ما في أخطاء: {"fixes":[]}`;
  let last = "";
  for (const model of AI_MODELS) {
    try {
      const out = await env.AI.run(model, { messages: [{ role: "system", content: system }, { role: "user", content: src }], max_tokens: 700, temperature: 0.1 });
      let t = typeof out === "string" ? out : out.response ?? out.result?.response ?? (out.choices && out.choices[0]?.message?.content) ?? "";
      if (typeof t !== "string") t = JSON.stringify(t);
      t = t.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/```(json)?/g, "");
      const m = t.match(/\{[\s\S]*\}/); if (!m) { last = "رد غير مفهوم"; continue; }
      const raw = JSON.parse(m[0]).fixes;
      const fixes = (Array.isArray(raw) ? raw : []).filter((x) => Array.isArray(x) && typeof x[0] === "string" && typeof x[1] === "string")
        .map(([a, b]) => [a.trim(), b.trim()])
        .filter(([a, b]) => a && b && a !== b && a.length <= 40 && !/\s/.test(a) && !/\s/.test(b) && src.includes(a))
        .filter(([a, b]) => spNorm(a) === spNorm(b) || (a.length >= 5 && lev1(a, b)))
        .slice(0, 40);
      return json({ fixes, model });
    } catch (e) { last = String(e && e.message || e); }
  }
  return json({ error: "ما قدر الذكاء الاصطناعي يفحص: " + last }, 502);
}

// ---------- /api/gallery: extra product photos from the old Wuilt pages ----------
const WUILT_IMG = /https:\/\/assets\.wuiltstore\.com\/[A-Za-z0-9._~%-]+\.(?:webp|jpe?g|png|gif|avif)/gi;

// POST /api/wuilt/products {apiKey, storeId, offset} → one page of products with all their images,
// read from Wuilt's official API. The key is only passed through, never stored.
async function wuiltProducts(request, env) {
  if (!isAdmin(request, env)) return denied();
  const { apiKey, storeId, offset = 0, mode = "all" } = await request.json().catch(() => ({}));
  if (!apiKey || !storeId) return json({ error: "حط مفتاح الـ API والـ Store ID" }, 400);
  const query = `query($c: ProductsConnectionInput, $f: ProductsFilterInput) {
    products(connection: $c, filter: $f) { totalCount nodes { id title handle images { src originalSrc } } }
  }`;
  // include inactive / draft / unlisted products, and (second pass) archived ones
  const base = { storeIds: [String(storeId).trim()] };
  const filters = mode === "archived" ? [{ ...base, status: "ALL", isArchived: true }, { ...base, isArchived: true }]
    : [{ ...base, status: "ALL" }, base];
  let r, j;
  for (const f of filters) {
    r = await fetch("https://graphql.wuilt.com/", {
      method: "POST",
      headers: { "content-type": "application/json", "X-API-KEY": String(apiKey).trim() },
      body: JSON.stringify({ query, variables: { c: { first: 50, offset }, f } }),
    });
    j = await r.json().catch(() => null);
    if (j && !(j.errors && j.errors.length && /status|isArchived|ProductStatusFilter/i.test(JSON.stringify(j.errors)))) break;
  }
  if (!j) return json({ error: "Wuilt ما رد (" + r.status + ")" }, 502);
  if (j.errors && j.errors.length) return json({ error: "Wuilt: " + j.errors.map((e) => e.message).join(" | ") }, 400);
  const conn = j.data && j.data.products;
  if (!conn) return json({ error: "Wuilt رجّع رد فاضي" }, 502);
  return json({
    total: conn.totalCount,
    products: (conn.nodes || []).map((p) => ({
      title: p.title, handle: p.handle,
      images: (p.images || []).map((i) => i && (i.originalSrc || i.src)).filter(Boolean),
    })),
  });
}

// POST /api/wuilt/collections {apiKey, storeId, op, offset, collectionId} → Wuilt collections (name, image, products).
// Wuilt's schema isn't documented, so we read it first (GraphQL introspection) and build the query from the real field names;
// every Wuilt error is passed back word for word so the owner can send it to us.
async function wuiltCollections(request, env) {
  if (!isAdmin(request, env)) return denied();
  const { apiKey, storeId, op = "list", offset = 0, collectionId = "" } = await request.json().catch(() => ({}));
  if (!apiKey || !storeId) return json({ error: "حط مفتاح الـ API والـ Store ID" }, 400);
  const sid = String(storeId).trim();
  const gql = async (query, variables) => {
    const r = await fetch("https://graphql.wuilt.com/", { method: "POST", headers: { "content-type": "application/json", "X-API-KEY": String(apiKey).trim() }, body: JSON.stringify({ query, variables: variables || {} }) });
    const j = await r.json().catch(() => null);
    if (!j) throw new Error("Wuilt ما رد (" + r.status + ")");
    return j;
  };
  const named = (t) => (t ? t.name || named(t.ofType) : "");
  const T = async (name) => {
    const j = await gql(`{ t: __type(name: "${name}") { name fields { name args { name type { name kind ofType { name kind ofType { name } } } } type { name kind ofType { name kind ofType { name kind ofType { name } } } } } inputFields { name type { name kind ofType { name kind ofType { name } } } } } }`);
    return (j.data && j.data.t) || null;
  };
  const plan = { debug: [] };
  try {
    const Q = await T("Query");
    if (!Q) throw new Error("introspection");
    const qf = Q.fields.find((f) => f.name === "collections") || Q.fields.find((f) => /^collections?$/i.test(f.name)) || Q.fields.find((f) => /collection/i.test(f.name) && /s$/.test(f.name));
    if (!qf) return json({ error: "ما لقينا «collections» بـ Wuilt API. الحقول الموجودة: " + Q.fields.map((f) => f.name).join(", ") }, 400);
    plan.field = qf.name;
    const conn = await T(named(qf.type));
    const nodesF = conn && (conn.fields || []).find((f) => f.name === "nodes");
    const edgesF = conn && (conn.fields || []).find((f) => f.name === "edges");
    plan.list = nodesF ? "nodes" : edgesF ? "edges" : "plain";
    let colName = nodesF ? named(nodesF.type) : edgesF ? named(((await T(named(edgesF.type))).fields || []).find((f) => f.name === "node").type) : named(qf.type);
    const Col = await T(colName);
    const cf = (Col.fields || []).map((f) => f.name), has = (n) => cf.includes(n), pick = (...l) => l.find(has) || "";
    plan.title = pick("title", "name"); plan.handle = pick("handle", "slug", "path");
    const imgF = (Col.fields || []).find((f) => /^(image|coverImage|thumbnail|banner|images)$/.test(f.name));
    if (imgF) { const it = await T(named(imgF.type)); const sub = ((it && it.fields) || []).map((f) => f.name).filter((n) => ["src", "originalSrc", "url"].includes(n)); plan.image = sub.length ? `${imgF.name} { ${sub.join(" ")} }` : imgF.name; }
    plan.count = pick("productsCount", "totalProducts", "numberOfProducts", "productCount");
    const pf = (Col.fields || []).find((f) => f.name === "products");
    if (pf) {
      const pConn = await T(named(pf.type)), pNodes = pConn && (pConn.fields || []).find((f) => f.name === "nodes");
      const argC = (pf.args || []).find((a) => a.name === "connection"), argF = (pf.args || []).find((a) => a.name === "filter");
      plan.products = `products${argC ? "(connection: { first: 100 })" : ""}${pNodes ? " { totalCount nodes { id title handle } }" : " { id title handle }"}`;
      plan.productsNodes = !!pNodes; plan.productsArgs = (pf.args || []).map((a) => a.name);
    }
    const args = qf.args || [], aC = args.find((a) => a.name === "connection"), aF = args.find((a) => a.name === "filter");
    let fil = "";
    if (aF) { const fi = await T(named(aF.type)); const ins = ((fi && fi.inputFields) || []).map((f) => f.name); plan.filterFields = ins; fil = ins.includes("storeIds") ? `filter: { storeIds: ["${sid}"] }` : ins.includes("storeId") ? `filter: { storeId: "${sid}" }` : ""; }
    else if (args.find((a) => a.name === "storeId")) fil = `storeId: "${sid}"`;
    const conA = aC ? `connection: { first: 50, offset: ${+offset || 0} }` : "";
    const argStr = [conA, fil].filter(Boolean).join(", ");
    const sel = ["id", plan.title, plan.handle, plan.image, plan.count, plan.products].filter(Boolean).join(" ");
    const body = plan.list === "nodes" ? `{ totalCount nodes { ${sel} } }` : plan.list === "edges" ? `{ totalCount edges { node { ${sel} } } }` : `{ ${sel} }`;
    // products of one collection, page by page (by the products query filtered on the collection)
    if (op === "members") {
      const P = await T("Query"); const pq = P.fields.find((f) => f.name === "products"); const pfA = pq && (pq.args || []).find((a) => a.name === "filter");
      const pfi = pfA ? await T(named(pfA.type)) : null; const ins = ((pfi && pfi.inputFields) || []).map((f) => f.name);
      const key = ins.find((n) => /^collectionIds$/i.test(n)) || ins.find((n) => /^collectionId$/i.test(n));
      if (!key) {
        if (!pf) return json({ error: "Wuilt ما بيسمح نجيب منتجات المجموعة. حقول الفلتر: " + ins.join(", ") }, 400);
        const q = `{ c: ${qf.name}(${argStr}) ${body} }`; // fall back: read through the collection itself
        const j = await gql(q); if (j.errors && j.errors.length) return json({ error: "Wuilt: " + j.errors.map((e) => e.message).join(" | "), query: q }, 400);
        return json({ products: [], note: "nofilter" });
      }
      const val = /Ids$/i.test(key) ? `["${String(collectionId).replace(/"/g, "")}"]` : `"${String(collectionId).replace(/"/g, "")}"`;
      const tries = [`status: ALL, `, ""];
      for (const st of tries) {
        const q = `{ p: products(connection: { first: 50, offset: ${+offset || 0} }, filter: { storeIds: ["${sid}"], ${st}${key}: ${val} }) { totalCount nodes { id title handle images { src originalSrc } } } }`;
        const j = await gql(q);
        if (j.errors && j.errors.length) { if (st && /status/i.test(JSON.stringify(j.errors))) continue; return json({ error: "Wuilt: " + j.errors.map((e) => e.message).join(" | "), query: q }, 400); }
        const c = j.data.p; return json({ total: c.totalCount, products: (c.nodes || []).map((p) => ({ id: p.id, title: p.title, handle: p.handle, images: (p.images || []).map((i) => i && (i.originalSrc || i.src)).filter(Boolean) })) });
      }
    }
    const q = `{ c: ${qf.name}${argStr ? `(${argStr})` : ""} ${body} }`;
    const j = await gql(q);
    if (j.errors && j.errors.length) return json({ error: "Wuilt: " + j.errors.map((e) => e.message).join(" | "), query: q }, 400);
    const c = j.data.c, rows = plan.list === "nodes" ? c.nodes : plan.list === "edges" ? c.edges.map((e) => e.node) : Array.isArray(c) ? c : [c];
    const imgOf = (x) => { const v = imgF ? x[imgF.name] : null; const o = Array.isArray(v) ? v[0] : v; return typeof o === "string" ? o : o ? o.originalSrc || o.src || o.url || "" : ""; };
    return json({
      total: c.totalCount != null ? c.totalCount : rows.length, plan: { field: plan.field, title: plan.title, handle: plan.handle, image: plan.image || "", count: plan.count || "", products: !!pf },
      collections: rows.map((x) => {
        const pr = x.products ? (plan.productsNodes ? x.products.nodes : x.products) || [] : null;
        return { id: x.id, title: x[plan.title] || "", handle: x[plan.handle] || "", image: imgOf(x), count: plan.count ? x[plan.count] : x.products && x.products.totalCount != null ? x.products.totalCount : pr ? pr.length : null,
          products: pr ? pr.map((p) => ({ id: p.id, title: p.title, handle: p.handle })) : null };
      }),
    });
  } catch (e) {
    return json({ error: "ما قدرنا نقرأ المجموعات من Wuilt: " + String((e && e.message) || e) }, 502);
  }
}

// POST /api/gallery/scan {ids} → every Wuilt image URL found on each product's old page (no writes).
async function galleryScan(request, env) {
  if (!isAdmin(request, env)) return denied();
  const { ids = [] } = await request.json().catch(() => ({}));
  const list = await getProducts(env, request);
  const byId = new Map(list.map((p) => [p.id, p]));
  const results = {}, errors = [];
  await Promise.all(ids.slice(0, 25).map(async (id) => {
    const p = byId.get(id);
    if (!p || !p.oldUrl) return;
    try {
      const r = await fetch(p.oldUrl, { headers: { "user-agent": "Mozilla/5.0 (KO SPORT migration)", accept: "text/html" } });
      if (!r.ok) throw new Error(String(r.status));
      let html = await r.text();
      html = html.replace(/\\u002F/gi, "/").replace(/\\\//g, "/").replace(/%3A/gi, ":").replace(/%2F/gi, "/");
      results[id] = [...new Set(html.match(WUILT_IMG) || [])];
    } catch { errors.push(id); }
  }));
  return json({ results, errors });
}

// POST /api/gallery/copy {items:[{id, urls}]} → copy the images into KV and set product.images.
async function galleryCopy(request, env) {
  if (!isAdmin(request, env)) return denied();
  const body = await request.json().catch(() => ({}));
  const items = body.items || [];
  const list = await getProducts(env, request);
  const byId = new Map(list.map((p) => [p.id, p]));
  const copied = new Map(); // source url → /img/ url (reuse what was already copied)
  for (const p of list) if (p.originalImage && p.image && p.image.startsWith("/img/")) copied.set(p.originalImage, p.image);
  let writes = 0, fetches = 0, stopped = "";
  const done = [];
  for (const it of items) {
    const p = byId.get(it.id);
    if (!p) continue;
    const urls = (it.urls || []).filter((u) => /^https:\/\/[a-z0-9.-]*wuilt(store)?\.com\//i.test(u)).slice(0, 12);
    const out = [];
    for (const u of urls) {
      let local = copied.get(u);
      if (!local) {
        if (fetches >= 40) { stopped = "batch"; break; }
        try {
          fetches++;
          const r = await fetch(u);
          if (!r.ok) continue;
          const buf = await r.arrayBuffer();
          const key = newKey();
          await env.STORE.put(`img:${key}`, buf, { metadata: { type: r.headers.get("content-type") || "image/webp" } });
          writes++;
          local = `/img/${key}`;
          copied.set(u, local);
        } catch (e) {
          if (/limit/i.test(String(e && e.message))) { stopped = "limit"; break; }
          continue;
        }
      }
      out.push(local);
    }
    if (stopped) break;
    const main = p.image;
    p.images = [...new Set([main, ...out].filter(Boolean))];
    p.galleryDone = true;
    if (body.api) { p.galleryApi = true; if (out.length) p.optimized = false; }
    done.push(p.id);
  }
  if (done.length) {
    try { await saveProducts(env, list); writes++; }
    catch (e) { return json({ error: "وصلنا لحد الحفظ اليومي المجاني بـ Cloudflare. كمّل بكرا.", limited: true }, 429); }
  }
  return json({ done, writes, stopped });
}

// Same helper as the shop: resized copy of one of our own photos (Cloudflare Image Transformations), original if anything else.
const imgW = (u, w) => /^\/img\/[a-z0-9]+$/.test(u || "") ? `/cdn-cgi/image/width=${w},quality=75,format=auto,onerror=redirect${u}` : (u || "");
async function imageGet(request, env, ctx, key) {
  const cache = typeof caches !== "undefined" ? caches.default : null;
  const hit = cache && (await cache.match(request));
  if (hit) return hit;
  const { value, metadata } = await env.STORE.getWithMetadata(`img:${key}`, "arrayBuffer");
  if (!value) return new Response("Not found", { status: 404 });
  const res = new Response(value, {
    headers: { "content-type": metadata?.type || "image/webp", "cache-control": "public, max-age=31536000, immutable" },
  });
  if (cache) ctx.waitUntil(cache.put(request, res.clone()));
  return res;
}

// Old Wuilt links (shared on WhatsApp/Facebook) keep working:
// /ar/product/all/<slug> → that product, anything else under /ar → home page.
async function oldWuiltLink(request, env, url) {
  const go = (to) => Response.redirect(new URL(to, url.origin).toString(), 301);
  const strip = (s) => { try { s = decodeURIComponent(s); } catch {} return s.replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "").toLowerCase(); };
  // same word whatever the spelling: dashes = spaces, alef/ya/ta-marbuta variants, no diacritics
  const norm = (s) => strip(s).replace(/[\u064b-\u0652\u0640]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/[-_+\s]+/g, " ").trim();
  const parts = url.pathname.split("/").filter(Boolean); // ["ar","product","<a>","<b>"]
  const list = env.STORE && parts[1] === "product" && parts[2] ? await getProducts(env, request) : null;
  // /ar/product/all/<slug> → that product
  if (list && parts[3]) {
    const slug = strip(parts[3]);
    const p = list.find((x) => x.oldUrl && strip(x.oldUrl.split("/").pop()) === slug);
    if (p) return go("/ar/p/" + encodeURIComponent(p.id));
  }
  // /ar/product/<category-name> → that category (ملابس-تمرين → ملابس تمرين); /ar/product/all → the shop
  if (list && parts[2] && !parts[3] && norm(parts[2]) !== "all") {
    const want = norm(parts[2]);
    const cats = new Set(); list.filter((x) => !x.hidden).forEach((x) => [x.category, ...(x.also || [])].forEach((c) => c && cats.add(c)));
    const cat = [...cats].find((c) => norm(c) === want);
    if (cat) return go("/ar/c/" + encodeURIComponent(cat));
    const p = list.find((x) => x.oldUrl && strip(x.oldUrl.split("/").pop()) === strip(parts[2]));
    if (p) return go("/ar/p/" + encodeURIComponent(p.id));
  }
  if (/\/(page|shop|store|category|categories|collections?|products?)(\/|$)/.test(url.pathname)) return go("/ar/all");
  return go("/ar");
}

// POST /api/images/fetch {url} → copy one outside image (e.g. the old Wuilt share image) into KV.
async function imageFetch(request, env) {
  if (!isAdmin(request, env)) return denied();
  const { url } = await request.json().catch(() => ({}));
  if (!/^https:\/\/[^\s"'<>]+$/.test(url || "")) return json({ error: "رابط غلط" }, 400);
  const r = await fetch(url);
  if (!r.ok) return json({ error: "ما قدرنا نجيب الصورة (" + r.status + ")" }, 502);
  const buf = await r.arrayBuffer();
  if (buf.byteLength > MAX_IMG) return json({ error: "الصورة كبيرة" }, 400);
  const key = newKey();
  await env.STORE.put(`img:${key}`, buf, { metadata: { type: r.headers.get("content-type") || "image/webp" } });
  return json({ url: `/img/${key}` });
}

// The home page HTML gets the real title, description, share image and store info filled in on the server,
// so Google, WhatsApp and Facebook see them without running any JavaScript.
// The current design, small, for the script that paints the page before anything else loads
const EARLY_KEYS = ["primary", "dark", "background", "headingFont", "headerBg", "headerText", "textColor", "footerBg", "footerText", "heroBg", "homeText", "productText", "priceColor", "skin", "logoRound", "logoPx", "layout"];
function earlyDesign(D) {
  const o = {}; for (const k of EARLY_KEYS) if (D && D[k] !== undefined) o[k] = D[k];
  return `<script>window.__koD=${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`;
}
// Deeper /ar/… pages: same theme variables the home page gets, set on <html> before the app runs.
async function themeOnly(env, request, res) {
  try {
    if (typeof HTMLRewriter === "undefined" || !env.STORE) return res;
    const st = await getSettings(env, request);
    return new HTMLRewriter()
      .on("html", { element(e) { e.setAttribute("style", cssVars(st.design || {})); } })
      .on("head", { element(e) { e.prepend(earlyDesign(st.design || {}), { html: true }); } })
      .transform(res);
  } catch { return res; }
}
async function homePage(request, env, res) {
  try { return await homePageInner(request, env, res); } catch { return res; }
}
// tracking codes from «التطبيقات» + owner's code from «أدوات المطورين»
function headExtras(st) {
  const a = st.apps || {}, d = st.dev || {};
  let h = "";
  if (/^G-[A-Z0-9]{4,14}$/.test(a.ga || "")) h += `<script async src="https://www.googletagmanager.com/gtag/js?id=${a.ga}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag("js",new Date());gtag("config","${a.ga}");</script>`;
  if (/^\d{6,20}$/.test(a.fbPixel || "")) h += `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version="2.0";n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,"script","https://connect.facebook.net/en_US/fbevents.js");fbq("init","${a.fbPixel}");fbq("track","PageView");</script>`;
  if (/^[A-Z0-9]{8,30}$/.test(a.tiktok || "")) h += `<script>!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.load=function(e){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i;var o=d.createElement("script");o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load("${a.tiktok}");ttq.page()}(window,document,"ttq");</script>`;
  if (d.css) h += `<style id="ko-custom-css">${String(d.css).replace(/<\/style/gi, "")}</style>`;
  if (d.head) h += String(d.head);
  return h;
}
async function homePageInner(request, env, res) {
  if (typeof HTMLRewriter === "undefined" || !env.STORE) return res;
  let st;
  try { st = await getSettings(env, request); } catch { return res; }
  const origin = new URL(request.url).origin;
  const abs = (u) => (!u ? "" : u.startsWith("/") ? origin + u : u);
  const S = st.store, title = S.seoTitle || S.name, desc = S.seoDescription || S.tagline || "";
  const img = abs(S.shareImage || st.design.heroImage || st.design.logoImage);
  const ld = {
    "@context": "https://schema.org", "@type": "SportingGoodsStore", name: S.name, url: origin + "/ar", description: desc,
    ...(img ? { image: img } : {}), ...(S.whatsapp ? { telephone: "+" + S.whatsapp } : {}),
    address: { "@type": "PostalAddress", streetAddress: S.address, addressCountry: "SY" },
    sameAs: [S.facebook, S.instagram].filter(Boolean),
  };
  const set = (sel, attr, val) => [sel, { element(e) { e.setAttribute(attr, val); } }];
  const rules = [
    ["title", { element(e) { e.setInnerContent(title); } }],
    set('meta[name="description"]', "content", desc),
    set('meta[property="og:title"]', "content", title),
    set('meta[property="og:description"]', "content", desc),
    set('meta[property="og:site_name"]', "content", S.name),
    set('meta[property="og:image"]', "content", img),
    set('meta[property="og:url"]', "content", origin + "/ar"),
    set('link[rel="canonical"]', "href", origin + "/ar"),
    ["head", { element(e) { e.append(headExtras(st), { html: true }); } }],
    ["head", { element(e) { e.append(`<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`, { html: true }); } }],
  ];
  // Server-render what is visible first (logo, announcement, hero, footer) and inline the CSS:
  // the page paints complete on the first byte, with nothing jumping around afterwards.
  const D = st.design, h = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const lr = Number(D.logoRatio) > 0 ? Number(D.logoRatio) : 1;
  const lh = LOGO_H[D.logoSize] || 38;
  const logo = D.logoImage ? `<img src="${h(D.logoImage)}" alt="${h(S.name)}" width="${Math.round(lh * lr)}" height="${lh}">`
    : `${D.logoText1 ? `<span class="logo-ko">${h(D.logoText1)}</span>` : ""}<span class="logo-sport">${h(D.logoText2)}</span>`;
  let stats = "";
  if (D.showHeroStats) {
    try {
      const list = (await getProducts(env, request)).filter((p) => !p.hidden && !(D.hideOutOfStock && !p.inStock));
      const cats = new Set(); list.forEach((p) => [p.category, ...(p.also || [])].forEach((c) => cats.add(c)));
      const cs = ((st.shipping && st.shipping.carriers) || []).filter((c) => c.on !== false);
      const zones = cs.length ? new Set(cs.flatMap((c) => (c.govs || []).map((g) => g.name))).size : (st.delivery.zones || []).filter((z) => z.method !== "off").length;
      stats = `<div class="hero-stats"><div><b>${list.filter((p) => p.inStock).length}</b>منتج متوفر</div><div><b>${cats.size}</b>قسم</div><div><b>${zones}</b>محافظة توصيل</div></div>`;
    } catch {}
  }
  const firstSec = ((st.home && st.home.sections) || []).find((x) => x.on !== false);
  const slides = (D.slides || []).filter((x) => x.img || x.title);
  const heroHtml = () => `<section class="hero${D.heroImage ? " has-img" : ""}"${D.heroImage ? ` style="background-image:url('${h(D.heroImage)}')"` : ""}><h1>${h(D.heroTitle)}</h1><p>${h(D.heroText)}</p>${stats}</section>`;
  const hero = !firstSec || firstSec.type !== "slider" ? "" : `<div class="hsec hs-slider">${slides.length ? slideShell(slides[0], h, ["full", "round", "curve"].includes(D.sliderShape) ? D.sliderShape : D.sliderShape === "peek" && slides.length > 1 ? "round" : "") : heroHtml()}</div>`;
  let css = "";
  try { const r = await env.ASSETS.fetch(new URL("/assets/store.css", request.url)); if (r.ok) css = await r.text(); } catch {}
  rules.push(
    ["[data-logo]", { element(e) { e.setInnerContent(logo, { html: true }); } }],
    ["[data-announce]", { element(e) { if (S.announcement && (D.announceOn ?? true)) { e.removeAttribute("hidden"); e.setInnerContent(`<span>${h(S.announcement)}</span>${D.announceClosable ? '<button class="ann-x" data-ann-close aria-label="إغلاق">✕</button>' : ""}`, { html: true }); } } }],
    ["#app", { element(e) { e.setInnerContent(hero + `<div class="loading" style="padding:40px 0">جاري التحميل…</div>`, { html: true }); } }],
    ["[data-tagline]", { element(e) { e.setInnerContent(S.tagline || ""); } }],
    ["[data-address]", { element(e) { e.setInnerContent(S.address || ""); } }],
    ["[data-footnote]", { element(e) { e.setInnerContent(S.footerNote || ""); } }],
    ["[data-wa]", { element(e) { e.setAttribute("href", "https://wa.me/" + S.whatsapp); } }],
    ["[data-fb]", { element(e) { e.setAttribute("href", S.facebook || "#"); } }],
    ["[data-ig]", { element(e) { e.setAttribute("href", S.instagram || "#"); } }],
    ['meta[name="theme-color"]', { element(e) { e.setAttribute("content", D.dark); } }],
    ["head", { element(e) { e.prepend(earlyDesign(st.design || {}), { html: true }); } }],
    ["html", { element(e) { e.setAttribute("style", cssVars(D)); for (const [k, v] of Object.entries(layoutOf(D))) e.setAttribute("data-l-" + k, v); } }],
    ["[data-headfont]", { element(e) { const u = fontUrl(D); if (u) e.setAttribute("href", u); else e.remove(); } }],
    ['link[rel="icon"]', { element(e) { if (D.favicon) { e.setAttribute("href", D.favicon); e.setAttribute("type", "image/png"); } } }],
  );
  if (css) rules.push(['link[href^="/assets/store.css"]', { element(e) { e.replace(`<style>${css}</style>`, { html: true }); } }]);
  let rw = new HTMLRewriter();
  for (const [sel, h] of rules) rw = rw.on(sel, h);
  return rw.transform(res);
}

// ---------- colour engine: every surface has its own background + text, and text is never allowed to vanish ----------
const THEME_DEFAULTS = {
  hdrBg: "#121212", hdrFg: "", annBg: "#d9232d", annFg: "", pageBg: "#f5f3ef", pageFg: "", cardBg: "#ffffff", cardFg: "",
  price: "", btnBg: "#d9232d", btnFg: "", btn2Bg: "#121212", btn2Fg: "", heroBg: "#121212", heroFg: "", ftrBg: "#121212", ftrFg: "",
};
const HEX = /^#[0-9a-f]{6}$/i;
function lum(hex) {
  const n = parseInt(hex.slice(1), 16), f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(n >> 16) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
}
function contrast(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
// chosen text colour if it is readable on that background, otherwise black or white automatically
function readable(bg, chosen, min) {
  if (chosen && HEX.test(chosen) && contrast(chosen, bg) >= (min || 3)) return chosen;
  return contrast("#121212", bg) >= contrast("#ffffff", bg) ? "#121212" : "#ffffff";
}
function themeColors(D) {
  const legacy = {
    hdrBg: D.headerBg || D.dark, hdrFg: D.headerText, annBg: D.primary, pageBg: D.background, pageFg: D.homeText || D.textColor,
    cardFg: D.productText, price: D.priceColor, btnBg: D.primary, btn2Bg: D.dark, heroBg: D.heroBg || D.dark, ftrBg: D.footerBg || D.dark, ftrFg: D.footerText,
  };
  const src = { ...THEME_DEFAULTS, ...Object.fromEntries(Object.entries(D.colors ? {} : legacy).filter(([, v]) => v)), ...(D.colors || {}) };
  const c = {};
  for (const k of Object.keys(THEME_DEFAULTS)) c[k] = HEX.test(src[k] || "") ? src[k] : k.endsWith("Bg") ? THEME_DEFAULTS[k] : "";
  const out = {
    "hdr-bg": c.hdrBg, "hdr-fg": readable(c.hdrBg, c.hdrFg),
    "ann-bg": c.annBg, "ann-fg": readable(c.annBg, c.annFg),
    "page-bg": c.pageBg, "page-fg": readable(c.pageBg, c.pageFg, 4.5),
    "card-bg": c.cardBg, "card-fg": readable(c.cardBg, c.cardFg, 4.5),
    "btn-bg": c.btnBg, "btn-fg": readable(c.btnBg, c.btnFg),
    "btn2-bg": c.btn2Bg, "btn2-fg": readable(c.btn2Bg, c.btn2Fg),
    "hero-bg": c.heroBg, "hero-fg": readable(c.heroBg, c.heroFg),
    "ftr-bg": c.ftrBg, "ftr-fg": readable(c.ftrBg, c.ftrFg),
  };
  out["price-card"] = readable(c.cardBg, c.price || out["card-fg"]);
  out["price-page"] = readable(c.pageBg, c.price || out["page-fg"]);
  out["link"] = readable(c.pageBg, c.btnBg);          // links / active dots on the page
  out["accent-card"] = readable(c.cardBg, c.btnBg);   // accents inside cards and menus
  return out;
}
const themeCss = (D) => Object.entries(themeColors(D)).map(([k, v]) => `--c-${k}:${v}`).join(";");

const LOGO_H = { s: 30, m: 38, l: 50 };
const LAYOUT = { hdr: ["classic", "center", "inline", "float", "tabs", "app"], hero: ["box", "full", "split", "center", "minimal", "edge"], card: ["classic", "minimal", "center", "framed", "icon", "tall", "store"],
  cat: ["tile", "circle", "pill", "big", "row", "coll"], title: ["plain", "bar", "center", "underline", "caps", "solo"], ftr: ["classic", "center", "line"], cols: ["m", "s", "l"],
  dens: ["normal", "compact", "airy"], ann: ["static", "marquee"], pdp: ["side", "flip", "stack", "store"],
  rows: ["start", "center"], list: ["classic", "store"], nav: ["off", "on"], drawer: ["list", "accordion"], price: ["latin", "arabic"] };
const layoutOf = (D) => Object.fromEntries(Object.entries(LAYOUT).map(([k, o]) => [k, o.includes((D.layout || {})[k]) ? D.layout[k] : o[0]]));
const spaceVars = (D) => (D.secGap !== "" && D.secGap != null && +D.secGap >= 0 ? `--sec-gap:${Math.min(160, +D.secGap)}px;` : "") + (D.afterSlider !== "" && D.afterSlider != null && +D.afterSlider >= 0 ? `--after-slider:${Math.min(160, +D.afterSlider)}px;` : "");
function shapeVars(D) {
  const r = Math.min(24, Math.max(0, Number.isFinite(+D.radius) && D.radius !== "" && D.radius != null ? +D.radius : 14));
  const b = { square: Math.min(r, 4), rounded: Math.max(6, Math.round(r * 0.8)), pill: 999 }[D.btnShape] ?? 12;
  const cs = D.cardStyle || "border";
  return { "--radius": r + "px", "--btn-r": b + "px", "--card-bw": cs === "border" ? "1px" : "0px",
    "--card-sh": cs === "shadow" ? "0 2px 6px rgba(0,0,0,.06),0 10px 28px rgba(0,0,0,.08)" : "0 0 #0000" };
}
function cssVars(D) {
  const ff = (f) => (f && f !== "system" ? `"${f}",` : "");
  const c = (k, v) => (D[k] && COLOR.test(D[k]) ? `--${v}:${D[k]};` : "");
  return c("headerBg", "hdr-bg") + c("headerText", "hdr-fg") + c("textColor", "text") + c("footerBg", "ftr-bg") + c("footerText", "ftr-fg") + c("heroBg", "hero-bg") + c("homeText", "home-text") + c("productText", "prod-text") + c("priceColor", "price-c") +
    themeCss(D) + ";" + `--red:${D.primary};--ink:${D.dark};--paper:${D.background};--head:${ff(D.headingFont)}system-ui,sans-serif;--head-w:${Number(D.headingWeight) || 700};` +
    `--body:${ff(D.bodyFont)}system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif;--body-w:${Number(D.bodyWeight) || 400};--logo-h:${LOGO_H[D.logoSize] || 38}px;` + spaceVars(D) + Object.entries(shapeVars(D)).map(([k, v]) => k + ":" + v).join(";");
}

// first slide of the home slider, same markup the shop script builds (so nothing jumps when it takes over)
function slideShell(sl, h, shape) {
  const al = ["start", "center", "end"].includes(sl.align) ? sl.align : "center";
  const size = Math.min(30, Math.max(14, Number(sl.size) || 18));
  const btn = (b, cls) => (b && b.text ? `<a class="btn ${cls}" href="${h(b.link || "#/all")}">${h(b.text)}</a>` : "");
  return `<section class="slider${shape ? " sh-" + shape : ""}"><div class="sl-track" dir="ltr"><div class="slide" data-align="${al}" style="--tc:${h(sl.color || "#ffffff")};--ts:${size}px">` +
    (sl.img ? `<picture><source media="(max-width:640px)" srcset="${h(imgW(sl.imgMobile || sl.img, 828))}"><img src="${h(imgW(sl.img, 1280))}" alt="${h(sl.title || "")}" width="1600" height="500" fetchpriority="high"></picture>` : "") +
    `<div class="sl-text">${sl.title ? `<h2>${h(sl.title)}</h2>` : ""}${sl.subtitle ? `<p>${h(sl.subtitle)}</p>` : ""}<div class="sl-btns">${btn(sl.btn1, "btn-red")}${btn(sl.btn2, "btn-light")}</div></div></div></div></section>`;
}

// One Google Fonts request for the heading + text fonts ("system" = phone's own font, nothing to load)
function fontUrl(D) {
  const fams = [];
  const add = (name, ws) => { if (name && name !== "system") fams.push(`family=${encodeURIComponent(name).replace(/%20/g, "+")}:wght@${[...new Set(ws)].sort().join(";")}`); };
  const hw = Number(D.headingWeight) || 700, bw = Number(D.bodyWeight) || 400;
  if (D.headingFont === D.bodyFont) add(D.headingFont, [hw, bw, 800]);
  else { add(D.headingFont, [hw, 800]); add(D.bodyFont, [bw, 700]); }
  return fams.length ? `https://fonts.googleapis.com/css2?${fams.join("&")}&display=optional` : "";
}

// robots.txt, sitemap.xml and llms.txt for search engines and AI assistants
// owner's 301 redirects (from «النطاق»)
async function redirectFor(env, request, path) {
  if (!env.STORE) return "";
  if (env.__rd === undefined) { try { env.__rd = (await getSettings(env, request)).redirects || []; } catch { env.__rd = []; } }
  const norm = (p) => { try { p = decodeURIComponent(p); } catch {} return p.replace(/\/+$/, "").toLowerCase() || "/"; };
  const p = norm(path), r = env.__rd.find((x) => norm(x.from) === p);
  return r ? r.to : "";
}
async function siteFiles(request, env, path) {
  const origin = new URL(request.url).origin;
  const txt = (body, type = "text/plain; charset=utf-8") => new Response(body, { headers: { "content-type": type, "cache-control": "public, max-age=3600" } });
  if (path === "/robots.txt") {
    const st0 = await getSettings(env, request).catch(() => ({}));
    if (st0.robots && st0.robots.trim()) return txt(st0.robots.trim() + (/sitemap:/i.test(st0.robots) ? "\n" : `\n\nSitemap: ${origin}/sitemap.xml\n`));
  }
  if (path === "/robots.txt") return txt(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /admin.html\nDisallow: /api/\n\nSitemap: ${origin}/sitemap.xml\n`);
  if (path === "/sitemap.xml") return txt(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url></urlset>\n`, "application/xml; charset=utf-8");
  const st = await getSettings(env, request), S = st.store;
  const cats = (st.design.groups || []).map((g) => `- ${g.name}: ${g.cats.map((c) => (st.design.catLabels || {})[c] || c).join("، ")}`).join("\n");
  return txt(`# ${S.name}\n\n> ${S.seoDescription || S.tagline || ""}\n\n## معلومات المتجر\n\n- الموقع: [${origin}](${origin}/)\n- العنوان: ${S.address || ""}\n- واتساب: [+${S.whatsapp}](https://wa.me/${S.whatsapp})\n${S.facebook ? `- فيسبوك: [${S.name}](${S.facebook})\n` : ""}${S.instagram ? `- إنستغرام: [${S.name}](${S.instagram})\n` : ""}\n## الأقسام\n\n${cats}\n\n## الطلب\n\n${S.footerNote || ""}\n`, "text/markdown; charset=utf-8");
}

// ---------- Web Push notifications (VAPID + RFC 8291 aes128gcm, WebCrypto only — free, no 3rd-party service) ----------
const b64u = (buf) => { let s = ""; const a = new Uint8Array(buf); for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const unb64u = (s) => { s = String(s).replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; const b = atob(s), a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; };
const PUSH_HOST = /^https:\/\/([a-z0-9-]+\.)*(googleapis\.com|mozilla\.com|mozaws\.net|push\.apple\.com|notify\.windows\.com|windows\.com)\//i;
const PUSH_BATCH = 40;           // Cloudflare allows ~50 outgoing requests per invocation → the dashboard sends in chunks
const PUSH_MAX_SUBS = 20000;
const BAR_DEF = { install: true, notif: true, style: "bar", theme: "dark", icon: "logo", image: "", title: "", text: "", btn: "", nTitle: "", nText: "", nBtn: "", again: 7, devices: "all", hideAfter: 0, pages: "all" };
const PUSH_DEF = { prompt: true, delay: 1, orderAlerts: true, bar: BAR_DEF };
function pushCfgClean(b) {
  const x = (b && b.bar) || {}, n = (v, lo, hi, d) => { v = Math.round(+v); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
  return {
    prompt: b.prompt !== false, delay: n(b.delay, 0, 300, 1), orderAlerts: b.orderAlerts !== false,
    bar: {
      install: x.install !== false, notif: x.notif !== false,
      style: ["bar", "sheet", "top"].includes(x.style) ? x.style : "bar", theme: ["dark", "light", "brand", "gradient"].includes(x.theme) ? x.theme : "dark",
      icon: ["logo", "bell", "image"].includes(x.icon) ? x.icon : "logo", image: okUrl(x.image) ? clip(x.image, 500) : "",
      title: clip(x.title, 60), text: clip(x.text, 160), btn: clip(x.btn, 24), nTitle: clip(x.nTitle, 60), nText: clip(x.nText, 160), nBtn: clip(x.nBtn, 24),
      again: n(x.again, 0, 90, 7), devices: ["all", "mobile"].includes(x.devices) ? x.devices : "all", hideAfter: n(x.hideAfter, 0, 120, 0), pages: ["all", "home"].includes(x.pages) ? x.pages : "all",
    },
  };
}

async function pushVapid(env) {
  if (env.__vapid) return env.__vapid;
  let v = await env.STORE.get("push:vapid", "json");
  if (!v) {
    const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    v = { pub: b64u(await crypto.subtle.exportKey("raw", kp.publicKey)), jwk: await crypto.subtle.exportKey("jwk", kp.privateKey) };
    await env.STORE.put("push:vapid", JSON.stringify(v));
  }
  v.key = await crypto.subtle.importKey("jwk", v.jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  return (env.__vapid = v);
}
async function pushCfg(env) { const c = (await env.STORE.get("push:cfg", "json").catch(() => null)) || {}; return { ...PUSH_DEF, ...c, bar: { ...BAR_DEF, ...(c.bar || {}) } }; }
const pushSubs = async (env) => (await env.STORE.get("push:subs", "json")) || [];

async function pushEncrypt(sub, payload) {
  const ua = unb64u(sub.p), auth = unb64u(sub.a);
  const eph = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPub = new Uint8Array(await crypto.subtle.exportKey("raw", eph.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", ua, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const secret = await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, eph.privateKey, 256);
  const enc = new TextEncoder();
  const cat = (...p) => { const o = new Uint8Array(p.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of p) { o.set(x, i); i += x.length; } return o; };
  const hk = async (ikm, salt, info, len) => crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]), len * 8);
  const ikm = new Uint8Array(await hk(new Uint8Array(secret), auth, cat(enc.encode("WebPush: info\0"), ua, asPub), 32));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = new Uint8Array(await hk(ikm, salt, enc.encode("Content-Encoding: aes128gcm\0"), 16));
  const nonce = new Uint8Array(await hk(ikm, salt, enc.encode("Content-Encoding: nonce\0"), 12));
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const data = cat(enc.encode(payload), new Uint8Array([2]));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, data));
  return cat(salt, new Uint8Array([0, 0, 16, 0, 65]), asPub, ct); // rs = 4096, idlen = 65
}
async function pushOne(env, sub, payload, opts = {}) {
  try {
    const v = await pushVapid(env);
    const aud = new URL(sub.e).origin;
    const h = b64u(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
    const c = b64u(new TextEncoder().encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: "mailto:" + (env.PUSH_CONTACT || "admin@ko-sport.online") })));
    const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, v.key, new TextEncoder().encode(h + "." + c));
    const r = await fetch(sub.e, {
      method: "POST",
      headers: { authorization: `vapid t=${h}.${c}.${b64u(sig)}, k=${v.pub}`, "content-encoding": "aes128gcm", "content-type": "application/octet-stream", ttl: String(opts.ttl || 86400), urgency: opts.urgency || "normal" },
      body: await pushEncrypt(sub, payload),
    });
    if (r.status === 404 || r.status === 410) return "gone";
    return r.ok ? "ok" : "fail";
  } catch { return "fail"; }
}
async function pushDrop(env, endpoints) {
  if (!endpoints.length) return;
  const set = new Set(endpoints), cur = await pushSubs(env);
  const left = cur.filter((s) => !set.has(s.e));
  if (left.length !== cur.length) await env.STORE.put("push:subs", JSON.stringify(left));
}
const pushPayload = (m) => JSON.stringify({ title: clip(m.title, 80) || "KO SPORT", body: clip(m.body, 220), url: /^(\/|https?:\/\/)/.test(m.url || "") ? clip(m.url, 500) : "/", image: /^(\/|https:\/\/)/.test(m.image || "") ? clip(m.image, 500) : "", tag: clip(m.tag, 40), ts: Date.now() });

// new order → instant push to the owner's/staff's phones (the devices that enabled alerts from the dashboard)
async function pushToAdmins(env, m) {
  try {
    if (!(await pushCfg(env)).orderAlerts) return;
    const subs = (await pushSubs(env)).filter((s) => s.adm).slice(0, PUSH_BATCH);
    if (!subs.length) return;
    const body = pushPayload(m), res = await Promise.all(subs.map((s) => pushOne(env, s, body, { urgency: "high", ttl: 3600 })));
    await pushDrop(env, subs.filter((_, i) => res[i] === "gone").map((s) => s.e));
  } catch {}
}

async function pushApi(request, env, m, sub) {
  // public: key + prompt settings, subscribe, unsubscribe
  if (sub === "key" && m === "GET") {
    const v = await pushVapid(env), c = await pushCfg(env);
    return json({ key: v.pub, prompt: !!c.prompt, delay: c.delay, bar: c.bar }, 200, { "cache-control": "public, max-age=30" });
  }
  if (sub === "subscribe" && m === "POST") {
    if (await throttle(request, "pushsub", 20, 3600)) return json({ error: "محاولات كتير" }, 429);
    let b; try { b = await request.json(); } catch { return json({ error: "بيانات غلط" }, 400); }
    const s = b && b.subscription, k = (s && s.keys) || {};
    if (!s || typeof s.endpoint !== "string" || s.endpoint.length > 700 || !PUSH_HOST.test(s.endpoint) || typeof k.p256dh !== "string" || typeof k.auth !== "string" || k.p256dh.length > 120 || k.auth.length > 40) return json({ error: "اشتراك غلط" }, 400);
    if (unb64u(k.p256dh).length !== 65 || unb64u(k.auth).length !== 16) return json({ error: "اشتراك غلط" }, 400);
    const adm = !!env.__role && isAdmin(request, env);
    const list = await pushSubs(env), i = list.findIndex((x) => x.e === s.endpoint);
    const rec = { e: s.endpoint, p: k.p256dh, a: k.auth, t: i >= 0 ? list[i].t : Date.now(), adm: adm || (i >= 0 && !!list[i].adm), d: /iphone|ipad|ipod/i.test(request.headers.get("user-agent") || "") ? "ios" : /android/i.test(request.headers.get("user-agent") || "") ? "android" : "pc" };
    if (i >= 0) { if (list[i].p === rec.p && list[i].a === rec.a && !!list[i].adm === rec.adm) return json({ ok: true }); list[i] = rec; }
    else { if (list.length >= PUSH_MAX_SUBS) return json({ error: "ممتلئ" }, 400); list.push(rec); }
    await env.STORE.put("push:subs", JSON.stringify(list));
    return json({ ok: true });
  }
  if (sub === "unsubscribe" && m === "POST") {
    let b; try { b = await request.json(); } catch { return json({ ok: true }); }
    if (b && typeof b.endpoint === "string") {
      const adm = !!env.__role && isAdmin(request, env);
      if (adm && b.adminOnly) { const l = await pushSubs(env); const x = l.find((s) => s.e === b.endpoint); if (x && x.adm) { x.adm = false; await env.STORE.put("push:subs", JSON.stringify(l)); } }
      else await pushDrop(env, [b.endpoint]);
    }
    return json({ ok: true });
  }
  // dashboard only
  if (!isAdmin(request, env)) return denied();
  if (sub === "stats" && m === "GET") {
    const l = await pushSubs(env), log = (await env.STORE.get("push:log", "json")) || [];
    return json({ total: l.length, admins: l.filter((s) => s.adm).length, android: l.filter((s) => s.d === "android").length, ios: l.filter((s) => s.d === "ios").length, pc: l.filter((s) => s.d === "pc").length, cfg: await pushCfg(env), log });
  }
  if (sub === "config" && m === "PUT") {
    let b; try { b = await request.json(); } catch { return json({ error: "بيانات غلط" }, 400); }
    const c = pushCfgClean(b);
    await env.STORE.put("push:cfg", JSON.stringify(c));
    return json({ ok: true, cfg: c });
  }
  if (sub === "send" && m === "POST") {
    let b; try { b = await request.json(); } catch { return json({ error: "بيانات غلط" }, 400); }
    if (!clip(b.title, 80) && !clip(b.body, 220)) return json({ error: "اكتب عنوان أو نص للإشعار" }, 400);
    const all = await pushSubs(env);
    const body = pushPayload(b);
    let list;
    if (b.target === "me" && typeof b.endpoint === "string") list = all.filter((s) => s.e === b.endpoint);
    else if (b.target === "admins") list = all.filter((s) => s.adm);
    else list = all;
    const off = Math.max(0, parseInt(b.offset) || 0), part = list.slice(off, off + PUSH_BATCH);
    const res = await Promise.all(part.map((s) => pushOne(env, s, body)));
    const sent = res.filter((x) => x === "ok").length, gone = part.filter((_, i) => res[i] === "gone").map((s) => s.e);
    await pushDrop(env, gone);
    const next = off + part.length;
    const done = next >= list.length;
    if (b.target !== "me" && /^[a-z0-9]{6,24}$/.test(b.mid || "")) {
      const log = (await env.STORE.get("push:log", "json")) || [];
      let e = log.find((x) => x.id === b.mid);
      if (!e) { e = { id: b.mid, at: new Date().toISOString(), title: clip(b.title, 80), body: clip(b.body, 220), url: clip(b.url, 200), to: list.length, sent: 0, failed: 0 }; log.unshift(e); }
      e.sent += sent; e.failed += part.length - sent - gone.length; e.gone = (e.gone || 0) + gone.length;
      await env.STORE.put("push:log", JSON.stringify(log.slice(0, 30)));
    }
    return json({ ok: true, sent, failed: part.length - sent, gone: gone.length, next, total: list.length, done });
  }
  return json({ error: "Method not allowed" }, 405);
}

// Static files: CSS/JS/fonts are requested with ?v=… so they can be cached for a long time.
async function staticAsset(request, env) {
  const res = await env.ASSETS.fetch(request);
  const url = new URL(request.url);
  if (res.status !== 200) return res;
  const out = new Response(res.body, res);
  if (url.pathname.startsWith("/assets/") && url.searchParams.has("v")) out.headers.set("cache-control", "public, max-age=31536000, immutable");
  else if (url.pathname.endsWith(".json")) out.headers.set("cache-control", "public, max-age=60");
  else out.headers.set("cache-control", "public, max-age=0, must-revalidate");
  if (url.pathname === "/manifest.webmanifest") out.headers.set("content-type", "application/manifest+json; charset=utf-8");
  if (url.pathname === "/sw.js") { out.headers.set("content-type", "application/javascript; charset=utf-8"); out.headers.set("service-worker-allowed", "/"); out.headers.set("cache-control", "no-cache"); }
  if (url.pathname === "/" || url.pathname === "/index.html" || url.pathname === "/index") return homePage(request, env, out);
  return out;
}


// ---------- dollar → Syrian pound (new) rate, read from sp-today.com and kept in KV ----------
const FX_URL = "https://sp-today.com/currency/us-dollar";
const AR_DIG = (t) => String(t).replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/٫/g, ".").replace(/[,٬]/g, "");
function fxParse(html) {
  const text = String(html).replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/\s+/g, " ");
  const num = (x) => parseFloat(AR_DIG(x));
  let m = text.match(/(?:بيع|المبيع)\s*:?\s*([\d٠-٩.,٫٬]+)\s*ل\.?\s?س\.?\s*جديدة/);
  if (m) { const v = num(m[1]); if (v >= 20 && v <= 5000) return v; }
  m = text.match(/(?:بيع|المبيع)\s*:?\s*(?:[\d٠-٩.,٫٬]+\s*ل\.?\s?س\.?\s*جديدة\s*)?([\d٠-٩.,٫٬]+)\s*(?:ل\.?\s?س\.?\s*)?قديمة/);
  if (m) { const v = num(m[1]) / 100; if (v >= 20 && v <= 5000) return Math.round(v * 100) / 100; }
  return 0;
}
async function fxGet(env, ctx, force) {
  const c = await env.STORE.get("fx:usd", "json");
  const fresh = c && c.sell > 0 && Date.now() - (c.at || 0) < 30 * 60 * 1000;
  if (fresh && !force) return c;
  const job = (async () => {
    try {
      const r = await fetch(FX_URL, { headers: { "user-agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Mobile Safari/537.36", "accept-language": "ar,en;q=0.8", accept: "text/html" }, cf: { cacheTtl: 300 } });
      if (!r.ok) throw new Error("الموقع رجّع " + r.status);
      const sell = fxParse(await r.text());
      if (!sell) throw new Error("ما قدرت إقرا سعر المبيع من الصفحة");
      const v = { sell, at: Date.now(), src: "sp-today.com" };
      await env.STORE.put("fx:usd", JSON.stringify(v));
      return v;
    } catch (e) {
      const v = { ...(c || {}), err: String((e && e.message) || e).slice(0, 200), errAt: Date.now() };
      if (c) { try { await env.STORE.put("fx:usd", JSON.stringify({ ...v, at: c.at })); } catch {} }
      return v;
    }
  })();
  if (c && c.sell > 0 && !force) { ctx.waitUntil(job); return c; }
  return job;
}
async function fxApi(request, env, ctx) {
  const force = request.method === "POST";
  if (force && !isAdmin(request, env)) return denied();
  const st = await getSettings(env, request), f = st.fx || {};
  const margin = f.margin === "" || f.margin == null || isNaN(+f.margin) ? 2 : +f.margin;
  const c = (await fxGet(env, ctx, force)) || {};
  const manual = +f.manual > 0 ? +f.manual : 0;
  const rate = manual || (c.sell > 0 ? Math.round((c.sell + margin) * 100) / 100 : 0);
  const out = { rate, sell: c.sell || 0, margin, manual, at: c.at || 0, src: c.src || "sp-today.com", err: c.err && (c.errAt || 0) >= (c.at || 0) ? c.err : "" };
  return new Response(JSON.stringify(out), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": force ? "no-store" : "public, max-age=300" } });
}

// ---------- the order as a message (Telegram): name / phone / where to / the order (+ link) / totals / note ----------
function moneyOf(order) {
  const d = order.display || {};
  return (n) => (d.cur === "syp" && d.rate > 0 ? `${Math.round(Number(n) * d.rate).toLocaleString("en-US")} ل.س جديدة` : `$${Math.round(Number(n) * 100) / 100}`);
}
function orderText(o, origin) {
  const m = moneyOf(o), c = o.customer, dl = o.delivery || {};
  const where = dl.carrierId && /yalla/i.test(dl.carrierId) || /يلا/.test(dl.carrier || "")
    ? `🚚 ${dl.carrier || "يلا غو"} — ${c.governorate}${c.address ? " — " + c.address : ""}`
    : `🚚 ${[c.governorate, dl.carrier, dl.branch ? (/^فرع/.test(dl.branch) ? "" : "فرع ") + dl.branch + (dl.branchAddress ? " (" + dl.branchAddress + ")" : "") : "", c.address, c.center && !dl.branch ? c.center : ""].filter(Boolean).join(" — ")}`;
  const lines = o.items.map((i) => `• ${i.name}${i.opt ? " — " + i.opt : ""} × ${i.qty} = ${m(i.price * i.qty)}`);
  const afterDisc = Math.max(0, o.subtotal - (o.discount ? o.discount.amount : 0));
  const tot = [];
  if (o.discount) tot.push(`🏷 الخصم: ${o.discount.name}${o.discount.code ? " (" + o.discount.code + ")" : ""} −${m(o.discount.amount)}`);
  if (o.tax && o.tax.amount) tot.push(`${o.tax.label}: ${m(o.tax.amount)}${o.tax.mode === "included" ? " (ضمن السعر)" : ""}`);
  if (o.delivery.fee == null) tot.push(`💵 المجموع بدون توصيل: ${m(o.total)}`, "التوصيل: بيتحدد عند التأكيد");
  else if (o.delivery.fee === 0) tot.push(`💵 الإجمالي (التوصيل مجاني): ${m(o.total)}`);
  else tot.push(`💵 المجموع بدون توصيل: ${m(o.total - o.delivery.fee)}`, `التوصيل: ${m(o.delivery.fee)}`, `💵 الإجمالي مع التوصيل: ${m(o.total)}`);
  void afterDisc;
  return [
    `👤 ${c.name}`,
    `📞 ${c.phone}`,
    where,
    `🛒 الطلب ${o.id}: ${origin}/ar/o/${encodeURIComponent(o.id)}`,
    ...lines,
    ...tot,
    c.notes ? `📝 ملاحظة: ${c.notes}` : "",
  ].filter(Boolean).join("\n");
}
async function fxRate(env, ctx, settings) {
  const f = settings.fx || {}, margin = f.margin === "" || f.margin == null || isNaN(+f.margin) ? 2 : +f.margin;
  if (+f.manual > 0) return +f.manual;
  const c = (await fxGet(env, ctx, false)) || {};
  return c.sell > 0 ? Math.round((c.sell + margin) * 100) / 100 : 0;
}
// public, no personal data: what was ordered (for the link in the message and the customer's thank-you page)
async function orderItemsGet(request, env) {
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!/^KO-\d{4}-[A-Z0-9]{4}$/.test(id)) return json({ error: "رقم طلب غلط" }, 400);
  const key = await env.STORE.get("orderid:" + id); if (!key) return json({ error: "الطلب مو موجود" }, 404);
  const o = await env.STORE.get(key, "json"); if (!o) return json({ error: "الطلب مو موجود" }, 404);
  return json({ id: o.id, createdAt: o.createdAt, items: o.items.map((i) => ({ id: i.id, name: i.name, opt: i.opt, qty: i.qty, price: i.price, image: i.image })), subtotal: o.subtotal, discount: o.discount ? { name: o.discount.name, amount: o.discount.amount } : null, fee: o.delivery ? o.delivery.fee : null, total: o.total, display: o.display || null, status: o.status });
}

// ---------- /api/ai/image-edit: edit a product photo with words (Google Gemini «Nano Banana»; needs GEMINI_API_KEY) ----------
async function aiImageEdit(request, env) {
  if (!isAdmin(request, env)) return denied();
  const key = String(env.GEMINI_API_KEY || "").trim();
  if (!key) return json({ error: "تعديل الصور بالكلام بيحتاج مفتاح Gemini: Settings ← Variables and Secrets ← Add ← النوع Secret، الاسم GEMINI_API_KEY، والقيمة المفتاح من aistudio.google.com — وبعدين ارفع الموقع من جديد", need: "gemini" }, 400);
  const b = await request.json().catch(() => ({}));
  const data = String(b.image || ""), mime = /^image\/(png|jpeg|webp)$/.test(b.mime || "") ? b.mime : "image/png";
  if (!data || data.length > 9e6) return json({ error: "الصورة كبيرة أو ناقصة" }, 400);
  const prompt = "You are editing a product photo for an online sports shop. Keep the product itself exactly the same: shape, colours, logos, printed text and proportions. Only do what is asked. Return one square, clean, realistic e-commerce photo.\nRequest (may be Arabic): " + clip(b.prompt, 600);
  let r, j;
  try {
    r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent", {
      method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mime, data } }] }], generationConfig: { responseModalities: ["IMAGE", "TEXT"] } }),
    });
    j = await r.json().catch(() => ({}));
  } catch (e) { return json({ error: "ما قدرنا نوصل لـ Gemini: " + String(e && e.message || e).slice(0, 160) }, 502); }
  if (!r.ok) return json({ error: "Gemini رفض: " + clip((j.error && j.error.message) || r.status, 300) }, 502);
  const parts = (((j.candidates || [])[0] || {}).content || {}).parts || [];
  const im = parts.find((p) => p.inlineData || p.inline_data);
  if (!im) return json({ error: "Gemini ما رجّع صورة" + (parts[0] && parts[0].text ? ": " + clip(parts[0].text, 200) : "") }, 502);
  const d = im.inlineData || im.inline_data;
  return json({ image: d.data, mime: d.mimeType || d.mime_type || "image/png" });
}
// ---------- router ----------
// ---------- catalogue for the WhatsApp bot (and any other app): products with real photos, prices and links ----------
// GET /api/catalog          → every visible product (JSON)
// GET /api/catalog/search?q=قفاز&limit=5&stock=1 → best matches for a customer's message (Arabic-aware)
// GET /api/catalog.txt      → the same as plain text lines (easy to paste into an AI prompt)
// GET /p/<id>               → product link with photo/title preview for WhatsApp, opens the product page
const arN = (t) => String(t || "").toLowerCase().replace(/[ً-ْـ]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/ؤ/g, "و").replace(/ئ/g, "ي").replace(/[^\p{L}\p{N}\s]+/gu, " ").replace(/\s+/g, " ").trim();
function prodPctS(st, p, now) {
  let best = 0; if (!p.inStock) return 0;
  for (const d of st.discounts || []) {
    if (!d || d.on === false || d.type === "code" || d.kind !== "percent" || +d.min > 0) continue;
    if (d.start && now < Date.parse(d.start)) continue;
    if (d.end && now > Date.parse(d.end) + 864e5) continue;
    const ok = d.scope === "cats" ? (d.cats || []).some((c) => p.category === c || (p.also || []).includes(c)) : d.scope === "products" ? (d.pids || []).includes(p.id) : true;
    if (ok) best = Math.max(best, Math.min(100, +d.value || 0));
  }
  return best;
}
function shortCode(id) { let h = 2166136261; for (const c of String(id)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
async function catalogData(request, env, ctx) {
  const st = await getSettings(env, request), all = await getProducts(env, request), now = Date.now();
  const origin = new URL(request.url).origin, abs = (u) => (!u ? "" : u.startsWith("/") ? origin + u : u);
  const rate = await fxRate(env, ctx, st).catch(() => 0);
  const plain = (t) => String(t || "").replace(/^##\s*/gm, "").replace(/^-\s*/gm, "• ").trim();
  const products = all.filter((p) => !p.hidden).map((p) => {
    const k = prodPctS(st, p, now), net = k ? Math.round(p.price * (100 - k)) / 100 : p.price;
    const o = { id: p.id, name: p.name, category: p.category, collections: [p.category, ...(p.also || [])], in_stock: !!p.inStock, price_usd: net };
    if (k) { o.old_price_usd = p.price; o.discount_percent = k; }
    if (rate > 0) { o.price_syp = Math.round(net * rate); if (k) o.old_price_syp = Math.round(p.price * rate); }
    if ((p.options || []).length) o.options = p.options;
    o.image = abs(p.image); o.images = [...new Set([p.image, ...(p.images || [])].filter(Boolean))].map(abs);
    o.url = origin + "/p/" + encodeURIComponent(p.id); o.short = origin + "/s/" + shortCode(p.id);
    if (p.description) o.description = p.description;
    if ((p.specs || []).length) o.specs = p.specs;
    if (p.details) o.details = plain(p.details);
    return o;
  });
  const S = st.store || {};
  return { store: { name: S.name || "", url: origin + "/", whatsapp: S.whatsapp || "", address: S.address || "", syp_rate: rate || null, bot_link: (st.apps || {}).botLink !== false, currency_note: "الأسعار الأساسية بالدولار؛ price_syp = بالليرة السورية الجديدة حسب سعر اليوم", updated_at: new Date().toISOString() }, count: products.length, products };
}
function catalogSearch(data, q, limit, onlyStock) {
  const toks = arN(q).split(" ").filter((t) => t.length > 1 || /\d/.test(t));
  if (!toks.length) return [];
  // common words that don't say what the customer wants
  const STOP = new Set(["بدي", "عندكن", "عندكم", "عندك", "في", "شو", "كم", "سعر", "حق", "قديش", "اريد", "بدنا", "من", "على", "مع", "هل", "يا", "لو", "the", "a", "ابغى", "ممكن", "اي", "شي", "منتج"]);
  // words people type ↔ words in the product names (brands in Arabic/English, everyday Syrian words)
  const SYN = { نط: "قفز", نطه: "قفز", فينوم: "venum", venom: "venum", ايفرلاست: "everlast", ايفرلست: "everlast", اديداس: "adidas", اديدس: "adidas", نايك: "nike", نايكي: "nike", فايرتكس: "fairtex", هوتزو: "hotzo", بوكا: "buka", توينز: "twins", ريبوك: "reebok", جوانتي: "قفاز", جوانتيات: "قفاز", كلفوف: "كفوف", كفوفي: "كفوف", حارس: "حراسه", غولر: "حراسه", واقي: "واقيه", شنطه: "حقيبه", مطره: "مطره", قناني: "مطره", بروتين: "بروتين", اثقال: "اوزان", دمبل: "دامبل", دمبلز: "دامبل", لستك: "مطاط", لاستيك: "مطاط", بوكس: "ملاكمه", ملاكمي: "ملاكمه", تيشرت: "كنزه", بلوزه: "كنزه" };
  const keys = toks.filter((t) => !STOP.has(t)); const T = (keys.length ? keys : toks).map((t) => (SYN[t] && SYN[t] !== t ? [t, SYN[t]] : [t]));
  const scored = [];
  for (const p of data.products) {
    if (onlyStock && !p.in_stock) continue;
    const name = arN(p.name), cat = arN(p.collections.join(" ")), opt = arN((p.options || []).join(" ")), desc = arN((p.description || "").slice(0, 300));
    let s = 0, hit = 0;
    for (const grp of T) {
      let v = 0;
      for (const t of grp) {
        const stem = t.length > 4 ? t.replace(/^ال/, "").replace(/(ات|ين|ون)$/, "") : t;
        let x = 0;
        if (name.includes(t)) x = 4; else if (stem !== t && name.includes(stem)) x = 3;
        else if (cat.includes(t) || (stem !== t && cat.includes(stem))) x = 2;
        else if (opt.includes(t)) x = 1.5; else if (desc.includes(t) || (stem !== t && desc.includes(stem))) x = 0.8;
        v = Math.max(v, x);
      }
      if (v) hit++; s += v;
    }
    if (!s) continue;
    if (hit === T.length) s += 3; if (name.includes(arN(q))) s += 4; if (p.in_stock) s += 0.5;
    scored.push([s, p]);
  }
  return scored.sort((a, b) => b[0] - a[0]).slice(0, limit).map(([, p]) => p);
}
async function catalogApi(request, env, ctx, kind) {
  const u = new URL(request.url);
  const cors = { "access-control-allow-origin": "*", "cache-control": "public, max-age=60" };
  let data;
  const cache = typeof caches !== "undefined" ? caches.default : null, ck = new Request(u.origin + "/__catalog_v1");
  if (cache) { const hit = await cache.match(ck); if (hit) data = await hit.json(); }
  if (!data) { data = await catalogData(request, env, ctx); if (cache) ctx.waitUntil(cache.put(ck, new Response(JSON.stringify(data), { headers: { "content-type": "application/json", "cache-control": "public, max-age=60" } }))); }
  if (kind === "search") {
    const id = u.searchParams.get("id");
    const list = id ? data.products.filter((p) => p.id === id) : catalogSearch(data, u.searchParams.get("q") || "", Math.min(20, Math.max(1, +u.searchParams.get("limit") || 5)), u.searchParams.get("stock") === "1");
    return new Response(JSON.stringify({ query: u.searchParams.get("q") || id || "", count: list.length, store: data.store, products: list }), { headers: { "content-type": "application/json; charset=utf-8", ...cors } });
  }
  if (kind === "txt") {
    const line = (p) => [`• ${p.name}`, `القسم: ${p.category}`, `السعر: $${p.price_usd}${p.price_syp ? ` (${p.price_syp.toLocaleString("en-US")} ل.س)` : ""}${p.discount_percent ? ` بعد خصم ${p.discount_percent}% (كان $${p.old_price_usd})` : ""}`, p.in_stock ? "متوفر" : "خالص", p.options ? `الخيارات: ${p.options.join("، ")}` : "", `الرابط: ${p.url}`, `الصورة: ${p.image}`].filter(Boolean).join(" | ");
    return new Response(`${data.store.name} — ${data.store.url}\n${data.store.currency_note}\n\n` + data.products.map(line).join("\n"), { headers: { "content-type": "text/plain; charset=utf-8", ...cors } });
  }
  return new Response(JSON.stringify(data), { headers: { "content-type": "application/json; charset=utf-8", ...cors } });
}
// a product link that shows the photo, name and price when pasted in WhatsApp, then opens the product
async function productShare(request, env, ctx, id) {
  const data = await catalogData(request, env, ctx).catch(() => null);
  const p = data && data.products.find((x) => x.id === id);
  const go = "/ar/p/" + encodeURIComponent(id), e = (t) => String(t || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const title = p ? `${p.name} — $${p.price_usd}${p.price_syp ? ` (${p.price_syp.toLocaleString("en-US")} ل.س)` : ""}` : (data && data.store.name) || "";
  const desc = p ? (p.description || `${p.category} · ${p.in_stock ? "متوفر" : "خالص"}`).slice(0, 200) : "";
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${e(title)}</title><meta name="viewport" content="width=device-width,initial-scale=1">
<meta property="og:type" content="product"><meta property="og:title" content="${e(title)}"><meta property="og:description" content="${e(desc)}">${p && p.image ? `<meta property="og:image" content="${e(p.image)}">` : ""}<meta property="og:url" content="${e(new URL(request.url).href)}"><meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="${e(new URL(request.url).origin + go)}"><meta http-equiv="refresh" content="0;url=${e(go)}"></head><body><script>location.replace(${JSON.stringify(go)})</script><a href="${e(go)}">${e(title)}</a></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=120" } });
}

export default {
  async fetch(request, rawEnv, ctx) {
    // Accept the KV binding whatever it was named (STORE, store, KV...).
    const env = Object.assign({}, rawEnv);
    if (!env.STORE) {
      for (const k of Object.keys(rawEnv)) {
        const v = rawEnv[k];
        if (k !== "ASSETS" && v && typeof v.get === "function" && typeof v.put === "function" && typeof v.list === "function") { env.STORE = v; break; }
      }
    }
    const url = new URL(request.url);
    const path = url.pathname;
    const m = request.method;
    // the main address ko-sport.online opens the shop at /ar (the app opens that same address)
    if (url.hostname === "ko-sport.online" && path === "/" && m === "GET") {
      return Response.redirect("https://ko-sport.online/ar" + url.search, 301);
    }
    // ko-sport.pages.dev → ko-sport.online (pages only; /api and /media stay reachable for the bot and the app)
    if (url.hostname === "ko-sport.pages.dev" && m === "GET" && !path.startsWith("/api/") && !path.startsWith("/media/")) {
      return Response.redirect("https://ko-sport.online" + path + url.search, 301);
    }
    try {
      if (path === "/api/diag" && m === "GET") return diagApi(request, env);
      if (path.startsWith("/api/") && !env.STORE) return json({ error: "مخزن KV مو مربوط بإعدادات المشروع (الموجود: " + (Object.keys(rawEnv).filter((k) => k !== "ASSETS").join("، ") || "ولا شي") + ")" }, 500);
      if (path.startsWith("/api/") && request.headers.has("authorization")) {
        await resolveRole(request, env);
        const blocked = await authGuard(request, env);
        if (blocked) return blocked;
      }
      if (path === "/manifest.webmanifest" && m === "GET" && env.STORE) {
        // the app icon = the store logo (circular PNGs the dashboard generates when the logo is uploaded)
        try {
          const st = await getSettings(env, request), D = st.design || {};
          const r = await env.ASSETS.fetch(new URL("/manifest.webmanifest", request.url)); const man = await r.json();
          if (D.appIcon512 && D.appIcon192) {
            man.icons = [{ src: D.appIcon192, sizes: "192x192", type: "image/png", purpose: "any" }, { src: D.appIcon512, sizes: "512x512", type: "image/png", purpose: "any" }, { src: D.appIcon512, sizes: "512x512", type: "image/png", purpose: "maskable" }];
            if (man.shortcuts) man.shortcuts.forEach((x) => { x.icons = [{ src: D.appIcon192, sizes: "192x192" }]; });
          }
          if (st.store && st.store.name) { man.short_name = String(st.store.name).slice(0, 20); }
          man.start_url = "/ar/";
          return new Response(JSON.stringify(man), { headers: { "content-type": "application/manifest+json; charset=utf-8", "cache-control": "public, max-age=300" } });
        } catch {}
      }
      if (path === "/api/catalog" && m === "GET" && env.STORE) return catalogApi(request, env, ctx, "json");
      if (path === "/api/catalog/search" && m === "GET" && env.STORE) return catalogApi(request, env, ctx, "search");
      if ((path === "/api/catalog.txt" || path === "/catalog.txt") && m === "GET" && env.STORE) return catalogApi(request, env, ctx, "txt");
      if (path.startsWith("/p/") && m === "GET" && env.STORE) return productShare(request, env, ctx, decodeURIComponent(path.slice(3)));
      if (path.startsWith("/s/") && m === "GET" && env.STORE) { const c = path.slice(3).toLowerCase(), d = await catalogData(request, env, ctx).catch(() => null), hit = d && d.products.find((x) => shortCode(x.id) === c); return hit ? productShare(request, env, ctx, hit.id) : Response.redirect(new URL("/", request.url).href, 302); }
      if (path === "/api/diag/purge" && m === "GET") { await purgeEdge("settings"); await purgeEdge("products"); return json({ ok: true, purged: ["settings", "products"], note: "هاد بيمسح الكاش بهي المنطقة بس" }); }
      if (path === "/reset" && m === "GET") return resetPage();
      // The shop lives under /ar/… : /ar/, /ar/cart, /ar/p/<id> … every address is a real page now.
      if (m === "GET" && /^\/ar\/product(\/|$)/.test(path)) return oldWuiltLink(request, env, url);
      if (m === "GET" && (path === "/ar" || path.startsWith("/ar/"))) {
        const r = await env.ASSETS.fetch(new URL("/index.html", request.url));
        const out = new Response(r.body, r);
        out.headers.set("content-type", "text/html; charset=utf-8");
        out.headers.set("cache-control", "public, max-age=0, must-revalidate");
        // only the shop front gets the server-rendered hero; deeper pages are drawn by the app
        if (path === "/ar" || path === "/ar/") return homePage(request, env, out);
        // deeper pages: put the saved colours/fonts on <html> straight away, so the first paint is already
        // the owner's theme (otherwise the stylesheet's built-in black/white/red shows for a moment)
        return themeOnly(env, request, out);
      }
      // someone typing an old-style address lands on the right page instead of a 404
      if (m === "GET" && /^\/(all|cart|checkout|account|browse|games|search|done|c|g)(\/|$)/.test(path)) {
        return Response.redirect(new URL("/ar" + path + url.search, request.url).href, 302);
      }
      if (path === "/api/rate" && (m === "GET" || m === "POST")) return fxApi(request, env, ctx);
      if (path === "/api/order-items" && m === "GET") return orderItemsGet(request, env);
      if (path === "/api/settings") {
        if (m === "GET") return settingsGet(request, env, ctx);
        if (m === "PUT") return settingsPut(request, env);
        return json({ error: "Method not allowed" }, 405);
      }
      if (path === "/api/login" && m === "POST") return env.__role ? json({ ok: true, role: env.__role, name: env.__staff }) : denied();
      if (path === "/api/products") {
        if (m === "GET") return productsGet(request, env, ctx);
        if (m === "PUT") return productsPut(request, env);
      } else if (path === "/api/orders") {
        if (m === "POST") return ordersPost(request, env, ctx);
        if (m === "GET") return ordersGet(request, env);
      } else if (path.startsWith("/api/orders/")) {
        const id = decodeURIComponent(path.slice("/api/orders/".length));
        if (m === "PATCH") return orderPatch(request, env, id);
        if (m === "DELETE") return orderDelete(request, env, id);
      } else if (path === "/api/images") {
        if (m === "POST") return imageUpload(request, env);
        if (m === "PATCH") return imageMigrate(request, env);
      } else if ((path === "/robots.txt" || path === "/sitemap.xml" || path === "/llms.txt") && m === "GET") {
        return siteFiles(request, env, path);
      } else if (path === "/api/reviews") {
        if (m === "POST") return reviewsPost(request, env, ctx);
        if (m === "GET") return reviewsGet(request, env, ctx);
      } else if (path.startsWith("/api/reviews/")) {
        const rid = decodeURIComponent(path.slice("/api/reviews/".length));
        if (m === "PATCH") return reviewChange(request, env, rid, false);
        if (m === "DELETE") return reviewChange(request, env, rid, true);
      } else if (path === "/api/customers" || path.startsWith("/api/customers/")) {
        return customersApi(request, env, m, decodeURIComponent(path.slice("/api/customers/".length)));
      } else if (path === "/api/staff" || path.startsWith("/api/staff/")) {
        return staffApi(request, env, m, decodeURIComponent(path.slice("/api/staff/".length)));
      } else if (path === "/api/status" && m === "GET") {
        return statusApi(request, env);
      } else if (path === "/api/telegram-test" && m === "POST") {
        return telegramTest(request, env);
      } else if (path === "/api/coupon" && m === "POST") {
        return couponCheck(request, env);
      } else if (path === "/api/discounts/used" && m === "GET") {
        return discountsUsed(request, env);
      } else if (path === "/api/carts") {
        if (m === "POST") return cartSave(request, env);
        if (m === "GET") return cartsGet(request, env);
      } else if (path.startsWith("/api/carts/") && m === "DELETE") {
        return cartDelete(request, env, decodeURIComponent(path.slice("/api/carts/".length)));
      } else if (path === "/api/track" && m === "GET") {
        return orderTrack(request, env);
      } else if (path === "/api/product-info" && m === "GET") {
        return productInfo(request, env, ctx);
      } else if (path === "/api/ai/image-edit" && m === "POST") {
        return aiImageEdit(request, env);
      } else if (path === "/api/ai/describe" && m === "POST") {
        return aiDescribe(request, env);
      } else if (path === "/api/ai/spell" && m === "POST") {
        return aiSpell(request, env);
      } else if (path === "/api/images/fetch" && m === "POST") {
        return imageFetch(request, env);
      } else if (path === "/api/wuilt/collections" && m === "POST") {
        return wuiltCollections(request, env);
      } else if (path === "/api/wuilt/products" && m === "POST") {
        return wuiltProducts(request, env);
      } else if (path === "/api/gallery/scan" && m === "POST") {
        return galleryScan(request, env);
      } else if (path === "/api/gallery/copy" && m === "POST") {
        return galleryCopy(request, env);
      } else if (path.startsWith("/api/push/")) {
        return pushApi(request, env, m, path.slice(10));
      } else if (path === "/api/media" && m === "POST") {
        return mediaUpload(request, env);
      } else if (path.startsWith("/media/") && (m === "GET" || m === "HEAD")) {
        return mediaGet(request, env, path.slice(7));
      } else if (path.startsWith("/img/") && m === "GET") {
        return imageGet(request, env, ctx, path.slice(5));
      } else if (m === "GET" && path !== "/" && !/^\/(assets|index\.html|admin|favicon|manifest|sw\.js)/.test(path) && (await redirectFor(env, request, path))) {
        return Response.redirect(new URL(await redirectFor(env, request, path), url.origin).toString(), 301);
      } else if (m === "GET" && /^\/(ar|en)(\/|$)/.test(path)) {
        return oldWuiltLink(request, env, url);
      } else {
        return staticAsset(request, env);
      }
      return json({ error: "Method not allowed" }, 405);
    } catch (err) {
      return json({ error: "خطأ بالسيرفر: " + (err && err.message) }, 500);
    }
  },
};
