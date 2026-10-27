(() => {
  "use strict";
  let C = {}; // flattened live settings
  let S = null; // full settings object
  const $ = (s, el = document) => el.querySelector(s);
  const app = $("#app");
  const PAGE = 48;
  let products = [];
  let byId = new Map();
  let cats = []; // [{name, count, image}]

  // ---------- helpers ----------
  const NOIMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'%3E%3Crect width='10' height='10' fill='%23ebe7df'/%3E%3C/svg%3E";
  const img = (u) => u || NOIMG;
  // Resized copies made by Cloudflare (Image Transformations): the same photo, sized for the screen, a fraction of the KB.
  // onerror=redirect → if the free monthly quota ever runs out, the original photo is served instead (nothing breaks).
  const LOCAL_IMG = /^\/img\/[a-z0-9]+$/;
  const imgW = (u, w) => LOCAL_IMG.test(u || "") ? `/cdn-cgi/image/width=${w},quality=75,format=auto,onerror=redirect${u}` : (u || NOIMG);
  // product page photo: same sizes as the <link rel=preload> the server puts in the page head
  const PDP_W = [640, 828, 1080], PDP_SIZES = "(max-width:900px) 100vw, 560px";
  const imgSet = (u, ws, sizes) => LOCAL_IMG.test(u || "") ? ` srcset="${ws.map((w) => imgW(u, w) + " " + w + "w").join(", ")}" sizes="${sizes}"` : "";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let LAY = {}; // current layout (from the design template)
  let arFmt = null;
  // shop currency: prices are stored in dollars; in Syrian pounds they are dollars × (today's sell rate + the owner's margin)
  let FXR = 0;
  const curMode = () => {
    const f = (S && S.fx) || {}; let m = f.mode === "syp" ? "syp" : "usd";
    if (f.visitor !== false) { try { const v = localStorage.getItem("ko_cur"); if (v === "usd" || v === "syp") m = v; } catch {} }
    if (window.__cuDemo) m = "syp";
    return m;
  };
  // the words after a price in Syrian pounds (design.cu): «ل.س جديدة», «ل.س» or the owner's own text; drawn beside or under the number
  const cuOf = () => { const c = (S && S.design && S.design.cu) || {}; return { pos: ["beside", "below", "same"].includes(c.pos) ? c.pos : "beside", txt: ["full", "short", "custom"].includes(c.txt) ? c.txt : "full", custom: String(c.custom || "").slice(0, 14), old: c.oldUnit === true }; };
  const cuUnit = () => { const c = cuOf(); return c.txt === "short" ? "ل.س" : c.txt === "custom" && c.custom.trim() ? c.custom.trim() : "ل.س جديدة"; };
  const moneyH = (n) => {
    if (FXR > 0 && curMode() === "syp") { const v = Math.round(Number(n) * FXR); return `<span class="mn"><span class="mn-v">${v.toLocaleString(LAY.price === "arabic" ? "ar-SY" : "en-US")}</span><span class="mn-u">${esc(cuUnit())}</span></span>`; }
    return money(n);
  };
  const money = (n) => {
    if (FXR > 0 && curMode() === "syp") { const v = Math.round(Number(n) * FXR); return `${v.toLocaleString(LAY.price === "arabic" ? "ar-SY" : "en-US")} ${cuUnit()}`; }
    if (LAY.price === "arabic") {
      if (C.currency === "$") { try { arFmt = arFmt || new Intl.NumberFormat("ar-SY", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 2 }); return arFmt.format(Number(n)); } catch {} }
      return `${Number(n).toLocaleString("ar-SY", { maximumFractionDigits: 2 })} ${C.currency}`;
    }
    return `${C.currency}${Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  };
  const ICON = {
    cart: '<svg class="ic" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="10" cy="20.5" r="1.3" fill="currentColor"/><circle cx="17" cy="20.5" r="1.3" fill="currentColor"/></svg>',
    ticket: '<svg class="ic" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M3 8a2 2 0 0 0 0 4v4h18v-4a2 2 0 0 1 0-4V4H3z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="m9 13 5-5M9.5 8.5h.01M13.5 12.5h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    filter: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M3 5h18l-7 8v6l-4 2v-8z" fill="currentColor"/></svg>',
    sort: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="m12 3 6 7H6zM12 21l-6-7h12z" fill="currentColor"/></svg>',
    chev: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="m15 6-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    grid: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  };
  // automatic discounts (coupon codes are checked by the server)
  function calcDiscount(d, items, subtotal) {
    const now = Date.now();
    if (!d || d.on === false || d.type === "code") return null;
    if (d.start && now < Date.parse(d.start)) return null;
    if (d.end && now > Date.parse(d.end) + 864e5) return null;
    if (+d.min > 0 && subtotal < +d.min) return null;
    const elig = items.filter((i) => (d.scope === "cats" ? (d.cats || []).some((c) => i.category === c || (i.also || []).includes(c)) : d.scope === "products" ? (d.pids || []).includes(i.id) : true));
    const base = elig.reduce((a, i) => a + i.price * i.qty, 0);
    if (!base) return null;
    let amount = d.kind === "percent" ? (base * Math.min(100, +d.value || 0)) / 100 : d.kind === "fixed" ? Math.min(base, +d.value || 0) : 0;
    amount = Math.round(amount * 100) / 100;
    if (!amount && d.kind !== "freeship") return null;
    return { id: d.id, name: d.name || "", code: "", amount, freeShip: d.kind === "freeship" };
  }
  function autoDiscount(lines) {
    const items = lines.map((l) => ({ id: l.p.id, price: l.p.price, qty: l.qty, category: l.p.category, also: l.p.also || [] }));
    const sub = items.reduce((a, i) => a + i.price * i.qty, 0);
    let best = null;
    for (const d of S.discounts || []) { const r = calcDiscount(d, items, sub); if (r && (!best || r.amount > best.amount)) best = r; }
    return best;
  }
  // the percentage an automatic discount takes off this product (only discounts without a minimum order show on the price)
  function prodPct(p) {
    let best = 0; if (!p || !p.inStock) return 0;
    if (window.__pzDemo && !(S.discounts || []).some((d) => d.type !== "code" && d.on !== false && d.kind === "percent")) return 15; // dashboard preview: show what a discount looks like
    for (const d of S.discounts || []) {
      if (d.type === "code" || d.on === false || d.kind !== "percent" || +d.min > 0) continue;
      if (d.end && Date.now() > Date.parse(d.end) + 864e5) continue;
      if (d.start && Date.now() < Date.parse(d.start)) continue;
      const ok = d.scope === "cats" ? (d.cats || []).some((c) => p.category === c || (p.also || []).includes(c)) : d.scope === "products" ? (d.pids || []).includes(p.id) : true;
      if (ok) best = Math.max(best, Math.min(100, +d.value || 0));
    }
    return best;
  }
  const netPrice = (p) => { const k = prodPct(p); return k ? Math.round(p.price * (100 - k)) / 100 : p.price; };
  // old price crossed out + the new one
  // the % discount now lives inside the price block (see priceH); offH only shows a plain badge text (e.g. «شحن مجاني»)
  const offH = (p) => { if (prodPct(p)) return ""; const t = p.inStock ? discBadge(p) : ""; return t ? `<span class="off-pill">${esc(t)}</span>` : ""; };
  // price block: discount label, the new price and the old one crossed out — arranged by design.pz from the dashboard
  const pzOf = () => { const z = (S && S.design && S.design.pz) || {}, one = (v, l, f) => (l.includes(v) ? v : f);
    return { lay: one(z.lay, ["stack", "inline"], "stack"), al: one(z.al, ["center", "start", "end"], "center"), old: one(z.old, ["left", "right", "above", "below"], "left"),
      off: one(z.off, ["above", "beside", "below", "hide"], "above"), txt: one(z.txt, ["pct", "minus", "save"], "pct"), lock: z.lock === "on" ? "on" : "off" }; };
  const priceH = (p, qty = 1) => {
    const k = prodPct(p); if (!k) return moneyH(p.price * qty);
    const z = pzOf(), net = netPrice(p);
    const off = z.txt === "minus" ? `-${k}%` : z.txt === "save" ? `وفّر ${money((p.price - net) * qty)}` : `خصم ${k}%`;
    return `<span class="pz"><span class="off-pill pz-off">${off}</span><span class="pz-row"><span class="new-price">${moneyH(net * qty)}</span><s class="old-price">${moneyH(p.price * qty)}</s></span></span>`;
  };
  // badge on a product card when an automatic discount covers it
  function discBadge(p) {
    for (const d of S.discounts || []) {
      if (d.type === "code" || d.on === false || d.badge === false) continue;
      if (d.end && Date.now() > Date.parse(d.end) + 864e5) continue;
      if (d.start && Date.now() < Date.parse(d.start)) continue;
      const ok = d.scope === "cats" ? (d.cats || []).some((c) => p.category === c || (p.also || []).includes(c)) : d.scope === "products" ? (d.pids || []).includes(p.id) : true;
      if (ok) return d.badgeText || (d.kind === "percent" ? `خصم ${d.value}%` : d.kind === "fixed" ? `خصم ${money(d.value)}` : "شحن مجاني");
    }
    return "";
  }
  const stars = (r, cls) => `<span class="stars${cls ? " " + cls : ""}" aria-label="${r ? r + " من 5" : "لا توجد تقييمات"}">${[1, 2, 3, 4, 5].map((i) => `<i class="${r && r >= i - 0.25 ? "on" : ""}">★</i>`).join("")}</span>`;
  const catLabel = (c) => C.catLabels[c] || c;
  const catMeta = (c) => ((S && S.design.catMeta) || {})[c] || {};
  const cHref = (c) => "#/c/" + encodeURIComponent(catMeta(c).slug || c);
  const catFromSlug = (x) => (cats.some((c) => c.name === x) ? x : (Object.entries((S && S.design.catMeta) || {}).find(([, m]) => m.slug === x) || [x])[0]);
  const norm = (s) => String(s || "").toLowerCase()
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/ؤ/g, "و").replace(/ئ/g, "ي");
  const inCat = (p, c) => p.category === c || (p.also || []).includes(c);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };

  // ---------- cart ----------
  let cart = store.get("ko_cart", []); // [{id, opt, qty}]
  const saveCart = () => { store.set("ko_cart", cart); renderCount(); };
  const cartKey = (id, opt) => id + "||" + (opt || "");
  const pixel = (ev, data) => { try { if (window.fbq) fbq("track", ev, data); if (window.gtag) gtag("event", ev === "AddToCart" ? "add_to_cart" : ev === "Purchase" ? "purchase" : ev.toLowerCase(), data); if (window.ttq) ttq.track(ev === "AddToCart" ? "AddToCart" : ev === "Purchase" ? "CompletePayment" : ev, data); } catch {} };
  function addToCart(id, opt, qty = 1, silent = false) {
    { const p0 = byId.get(id); if (p0) pixel("AddToCart", { value: p0.price * qty, currency: "USD", content_ids: [id] }); }
    const line = cart.find((l) => cartKey(l.id, l.opt) === cartKey(id, opt));
    if (line) line.qty += qty; else cart.push({ id, opt: opt || "", qty });
    saveCart();
    if (window.KOMedia) KOMedia.sfx("pop");
    const p = byId.get(id);
    if (!silent) toast(`انضاف «${esc(p?.name)}» للسلة <a href="#/cart">عرض السلة</a>`);
  }
  // the product photo flies into the cart icon, then the icon bumps
  function flyToCart(src) {
    try {
      if (!src || document.documentElement.classList.contains("reduce") || !src.animate) return;
      const root = src.closest(".card") || app.querySelector(".pdp") || src, im = root.querySelector("img");
      const to = [...document.querySelectorAll(".cart-btn,.bnav [data-nav=cart]")].find((e) => e.getClientRects().length);
      if (!im || !to) return;
      const a = im.getBoundingClientRect(), b = to.getBoundingClientRect(); if (!a.width || !b.width) return;
      const sz = Math.min(110, a.width, a.height), x0 = a.left + (a.width - sz) / 2, y0 = a.top + (a.height - sz) / 2;
      const dx = b.left + b.width / 2 - (x0 + sz / 2), dy = b.top + b.height / 2 - (y0 + sz / 2);
      const f = document.createElement("div"); f.className = "fly";
      f.style.cssText = `left:${x0}px;top:${y0}px;width:${sz}px;height:${sz}px;background-image:url("${(im.currentSrc || im.src).replace(/"/g, "%22")}")`;
      document.body.appendChild(f);
      const an = f.animate([
        { transform: "translate3d(0,0,0) scale(1)", opacity: 1 },
        { transform: `translate3d(${dx * 0.5}px,${dy * 0.5 - 70}px,0) scale(.6)`, opacity: 1, offset: 0.5 },
        { transform: `translate3d(${dx}px,${dy}px,0) scale(.12)`, opacity: 0.25 },
      ], { duration: 700, easing: "cubic-bezier(.45,.05,.55,.95)" });
      an.onfinish = an.oncancel = () => { f.remove(); to.classList.remove("bump"); void to.offsetWidth; to.classList.add("bump"); setTimeout(() => to.classList.remove("bump"), 600); };
    } catch {}
  }
  function cartLines() {
    return cart.map((l) => ({ ...l, p: byId.get(l.id) })).filter((l) => l.p);
  }
  const cartTotal = () => cartLines().reduce((s, l) => s + l.p.price * l.qty, 0);
  function renderCount() {
    const n = cart.reduce((s, l) => s + l.qty, 0);
    document.querySelectorAll("[data-cart-count]").forEach((el) => { el.textContent = n; el.hidden = n === 0; });
  }

  let toastT;
  function toast(html) {
    const t = $("[data-toast]");
    t.innerHTML = html; t.classList.add("show");
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 3200);
  }

  // ---------- settings ----------
  function useSettings(settings) {
    RAW = settings;
    if (PV) settings = { ...settings, design: { ...settings.design, ...(PV.design || {}) }, home: PV.home || settings.home, store: { ...settings.store, ...(PV.store || {}) } };
    S = settings;
    if (!PV && window.KOMedia) { try { KOMedia.init(S.audio); } catch {} }
    if (!PV && !PREVIEW && window.KOPromo) { try { KOPromo.init(S.promos); } catch {} }
    const zones = S.delivery.zones || [];
    C = {
      currency: S.currency || "$", ...S.store,
      groups: S.design.groups || [], catLabels: S.design.catLabels || {},
      zones: zones.filter((z) => z.method !== "off"),
      carriers: ((S.shipping && S.shipping.carriers) || []).filter((c) => c.on !== false && (c.govs || []).length),
    };
  }
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(v * (1 + amt))));
    return "#" + [n >> 16, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, "0")).join("");
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
  function fontUrl(d) {
    const fams = [], add = (n, ws) => { if (n && n !== "system") fams.push(`family=${encodeURIComponent(n).replace(/%20/g, "+")}:wght@${[...new Set(ws)].sort().join(";")}`); };
    const hw = +d.headingWeight || 700, bw = +d.bodyWeight || 400;
    if (d.headingFont === d.bodyFont) add(d.headingFont, [hw, bw, 800]); else { add(d.headingFont, [hw, 800]); add(d.bodyFont, [bw, 700]); }
    return fams.length ? `https://fonts.googleapis.com/css2?${fams.join("&")}&display=optional` : "";
  }
  const LAYOUT = { hdr: ["classic", "center", "inline", "float", "tabs", "app"], hero: ["box", "full", "split", "center", "minimal", "edge"], card: ["classic", "minimal", "center", "framed", "icon", "tall", "store"],
    cat: ["tile", "circle", "pill", "big", "row", "coll"], title: ["plain", "bar", "center", "underline", "caps", "solo"], ftr: ["classic", "center", "line"], cols: ["m", "s", "l"],
    dens: ["normal", "compact", "airy"], ann: ["static", "marquee"], pdp: ["side", "flip", "stack", "store"],
    rows: ["start", "center"], list: ["classic", "store"], nav: ["off", "on"], drawer: ["list", "accordion"], price: ["latin", "arabic"] };
  const layoutOf = (D) => Object.fromEntries(Object.entries(LAYOUT).map(([k, o]) => [k, o.includes((D.layout || {})[k]) ? D.layout[k] : o[0]]));
  function shapeVars(D) {
    const r = Math.min(24, Math.max(0, Number.isFinite(+D.radius) && D.radius !== "" && D.radius != null ? +D.radius : 14));
    const b = { square: Math.min(r, 4), rounded: Math.max(6, Math.round(r * 0.8)), pill: 999 }[D.btnShape] ?? 12;
    const cs = D.cardStyle || "border";
    return { "--radius": r + "px", "--btn-r": b + "px", "--card-bw": cs === "border" ? "1px" : "0px",
      "--card-sh": cs === "shadow" ? "0 2px 6px rgba(0,0,0,.06),0 10px 28px rgba(0,0,0,.08)" : "0 0 #0000" };
  }
  // live preview from the dashboard (same-origin iframe with ?preview=1): design, home sections and store info, before saving
  const PREVIEW = /[?&]preview=1/.test(location.search) && window.parent !== window;
  let PV = null, RAW = null;
  // ---------- clean addresses: /ar/cart instead of #/cart ----------
  // The dashboard preview keeps using #/… — it lives in an iframe and must not touch real history.
  const BASE = "/ar", CLEAN = !PREVIEW;
  function routeHref(r) {
    let p = String(r == null ? "/" : r);
    if (p[0] === "#") p = p.slice(1);
    if (p[0] !== "/") p = "/" + p;
    return CLEAN ? BASE + p : "#" + p;
  }
  function curRoute() {
    if (location.hash.indexOf("#/") === 0) return decodeURIComponent(location.hash.slice(1));
    let p = location.pathname;
    if (p === BASE) p = "/";
    else if (p.indexOf(BASE + "/") === 0) p = p.slice(BASE.length);
    try { p = decodeURIComponent(p); } catch (e) {}
    return p || "/";
  }
  // fires the same «hashchange» the shop already listens for, so every existing handler keeps working
  window.KORoute = curRoute; // promo.js / pwa.js / fx.js ask the shop which page is open
  const fireNav = () => window.dispatchEvent(new Event("hashchange"));
  function navTo(r, replace) {
    const u = routeHref(r);
    if (!CLEAN) { if (location.hash !== u) location.replace(u); return; }
    if (location.pathname === u) { fireNav(); return; }
    try { history[replace ? "replaceState" : "pushState"]({}, "", u); } catch (e) { location.assign(u); return; }
    fireNav();
  }
  function fixLinks(root) {
    if (!CLEAN || !root || root.nodeType !== 1) return;
    if (root.matches && root.matches('a[href^="#/"]')) root.setAttribute("href", routeHref(root.getAttribute("href")));
    if (root.querySelectorAll) root.querySelectorAll('a[href^="#/"]').forEach((a) => a.setAttribute("href", routeHref(a.getAttribute("href"))));
  }
  if (CLEAN) {
    // rewrite every link the shop renders, the moment it lands in the page
    new MutationObserver((ms) => { for (const mu of ms) for (const n of mu.addedNodes) fixLinks(n); }).observe(document.documentElement, { childList: true, subtree: true });
    fixLinks(document.body);
    document.addEventListener("click", (e) => {
      if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest && e.target.closest("a[href]"); if (!a || a.target || a.hasAttribute("download")) return;
      const href = a.getAttribute("href") || "";
      if (href.indexOf("#/") === 0) { e.preventDefault(); navTo(href); return; }
      if (a.origin === location.origin && (a.pathname === BASE || a.pathname.indexOf(BASE + "/") === 0)) { e.preventDefault(); navTo(a.pathname.slice(BASE.length) || "/"); }
    });
    window.addEventListener("popstate", fireNav);
    // an old #/… address (or the installed app) turns into a clean one without reloading
    if (location.hash.indexOf("#/") === 0) { try { history.replaceState({}, "", routeHref(decodeURIComponent(location.hash.slice(1)))); } catch (e) {} }
  }
  // inside the dashboard preview, clicking around doesn't add history entries (they'd belong to the dashboard's back button)
  if (PREVIEW) document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest('a[href^="#"]'); if (!a || e.defaultPrevented || a.target) return;
    e.preventDefault(); if (a.getAttribute("href") !== location.hash) location.replace(a.getAttribute("href"));
  });
  if (PREVIEW) window.addEventListener("message", (e) => {
    if (e.origin !== location.origin || !e.data) return;
    if (e.data.koOpen) { if (window.KOFx) KOFx.open(true); return; }
    if (e.data.koKx) { if (kx) closeExplorer(true); setTimeout(openExplorer, 30); return; }
    if (e.data.koGo) { pvGo(e.data.koGo); return; }
    if (!e.data.koPreview) return;
    const m = e.data.koPreview;
    PV = m.design || m.home || m.store ? m : { design: m };
    if (RAW) { const keep = window.scrollY; useSettings(RAW); applyDesign(); chrome(); route(null, true); window.scrollTo(0, keep); }
  });
  // the dashboard follows what you're editing: it sends the page + the spot to show (koGo)
  function pvGo(t) {
    if (!t) return;
    if (t.kx) { $("[data-drawer]").hidden = true; if (kx) closeExplorer(true); setTimeout(openExplorer, 30); return; }
    if (kx) closeExplorer(true);
    $("[data-drawer]").hidden = true;
    let r = t.r || "#/";
    if (r === "#/p/") { const p = products.find((x) => x.inStock && (x.images || []).length > 1) || products.find((x) => x.inStock) || products[0]; r = p ? "#/p/" + encodeURIComponent(p.id) : "#/all"; }
    if ((r === "#/cart" || r === "#/checkout") && !cart.length) { const p = products.find((x) => x.inStock && !(x.options || []).length) || products.find((x) => x.inStock); if (p) { cart = [{ id: p.id, opt: (p.options || [])[0] || "", qty: 1 }]; renderCount(); } }
    const same = (location.hash || "#/") === r;
    if (!same) location.replace(r); // no history entry: the dashboard's back button must not step through the preview
    const at = t.at || "top";
    if (t.open && window.KOFx) setTimeout(() => KOFx.open(true), 450);
    if (t.confetti && window.KOFx && KOFx.confettiNow) setTimeout(() => KOFx.confettiNow(), 500);
    if (t.pzDemo && !window.__pzDemo) { window.__pzDemo = true; route(null, true); }
    if (t.cuDemo && !window.__cuDemo) { window.__cuDemo = true; if (!(FXR > 0)) FXR = 13000; route(null, true); }
    if (t.pgDemo) setTimeout(() => { const n = document.querySelector(".gal-arrow.next"); if (n) { n.click(); setTimeout(() => n.click(), (pgOf(S.design).ms || 600) + 700); } }, 1100);
    if (t.flash) setTimeout(() => { const el = document.querySelector(t.flash); if (el) { el.classList.remove("pv-flash"); void el.offsetWidth; el.classList.add("pv-flash"); } }, 500);
    let n = 0;
    const spot = () => {
      const html = document.documentElement, old = html.style.scrollBehavior; html.style.setProperty("scroll-behavior", "auto", "important");
      if (at === "top") window.scrollTo(0, 0);
      else if (at === "bottom") window.scrollTo(0, document.documentElement.scrollHeight);
      else if (at === "mid") { window.scrollTo(0, 0); setTimeout(() => window.scrollTo({ top: (document.documentElement.scrollHeight - innerHeight) * 0.45, behavior: "smooth" }), 250); }
      else { const el = document.querySelector(at); if (!el) { if (++n < 15) return setTimeout(spot, 120); } else { const hd = document.querySelector("header"); window.scrollTo(0, Math.max(0, el.getBoundingClientRect().top + scrollY - ((hd && hd.offsetHeight) || 0) - 8)); el.classList.remove("pv-flash"); void el.offsetWidth; el.classList.add("pv-flash"); } }
      html.style.scrollBehavior = old;
    };
    setTimeout(() => { spot(); if (t.menu) { const mb = document.querySelector("[data-action=menu]"); if (mb) mb.click(); else $("[data-drawer]").hidden = false; } }, same ? 30 : 260);
    if (at === "bottom") setTimeout(spot, 900);
  }
  // dark mode: swap the surface colours (page / cards / header / footer) and keep the brand colours
  function darkTc(d) {
    const tc = themeColors(d), P = d.darkPal || {}, ok = (v, f) => (HEX.test(v || "") ? v : f);
    const bg = ok(P.bg, "#0f0f13"), card = ok(P.card, "#1a1a20"), hdr = ok(P.hdr, "#16161c"), ftr = ok(P.ftr, "#0b0b0e");
    Object.assign(tc, { "page-bg": bg, "page-fg": readable(bg, "", 4.5), "card-bg": card, "card-fg": readable(card, "", 4.5), "hdr-bg": hdr, "hdr-fg": readable(hdr, ""), "hero-bg": hdr, "hero-fg": readable(hdr, ""), "ftr-bg": ftr, "ftr-fg": readable(ftr, ""), "btn2-bg": card, "btn2-fg": readable(card, "") });
    tc["price-card"] = readable(card, "", 3); tc["price-page"] = readable(bg, "", 3);
    tc.link = readable(bg, d.primary); tc["accent-card"] = readable(card, d.primary);
    return [tc, bg];
  }
  // product page photos: side, small photos under the dots, change effect, autoplay (design.pg)
  const pgOf = (d) => { const g = (d && d.pg) || {}, one = (v, l, f) => (l.includes(v) ? v : f);
    return { side: one(g.side, ["left", "right"], "left"), thumbs: one(g.thumbs, ["wrap", "row", "grid", "hide"], "wrap"), tsize: one(g.tsize, ["s", "m", "l"], "m"), talign: one(g.talign, ["center", "start", "end"], "center"), tdir: one(g.tdir, ["rtl", "ltr"], "rtl"),
      fx: one(g.fx, ["slide", "fade", "zoom", "flip", "cube", "blur", "push"], "slide"), auto: g.auto === true, speed: +g.speed >= 2 && +g.speed <= 12 ? +g.speed : 4,
      ms: { fast: 350, normal: 600, slow: 950 }[one(g.dur, ["fast", "normal", "slow"], "normal")], arrows: g.arrows !== false }; };
  let RAW_READY = false; setTimeout(() => (RAW_READY = true), 0);
  // review box on the product page: 5 stars picked already, name + opinion, send
  document.addEventListener("click", (e) => {
    const rb = e.target.closest && e.target.closest("[data-rv-form] [data-r]"); if (!rb) return;
    const f = rb.closest("[data-rv-form]"), v = +rb.dataset.r; f.dataset.rating = v;
    f.querySelectorAll("[data-r]").forEach((b) => b.classList.toggle("on", +b.dataset.r <= v));
  });
  document.addEventListener("submit", async (e) => {
    const f = e.target.closest && e.target.closest("[data-rv-form]"); if (!f) return;
    e.preventDefault();
    const msg = f.querySelector("[data-rv-msg]"), name = f.querySelector("[data-rv-name]").value.trim(), text = f.querySelector("[data-rv-text]").value.trim(), rating = +(f.dataset.rating || 5);
    if (name.length < 2) { msg.textContent = "اكتب اسمك"; f.querySelector("[data-rv-name]").focus(); return; }
    const btn = f.querySelector("[data-rv-send]"); btn.disabled = true; msg.textContent = "";
    try {
      const res = await fetch("/api/reviews", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pid: f.dataset.pid, name, text, rating }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "صار خطأ");
      f.innerHTML = `<div class="rv-thanks"><b>شكراً لرأيك! 🙏</b><p>${j.pending ? "رح يظهر تقييمك بعد ما نراجعه." : "تقييمك صار ظاهر."}</p></div>`;
    } catch (err) { msg.textContent = err.message; btn.disabled = false; }
  });
  window.KOApplyDesign = () => { if (S) applyDesign(); };
  function applyDesign() {
    const d = S.design, root = document.documentElement.style;
    const dk = !!(window.KOFx && KOFx.isDark(d)); let dkBg = d.background;
    const ff = (f) => (f && f !== "system" ? `"${f}",` : "");
    root.setProperty("--red", d.primary); root.setProperty("--red-dark", shade(d.primary, -0.2));
    { // a very dark main colour (black) would vanish in dark mode: mark it so those blocks turn white there
      let L = 1; try { const t = document.createElement("i"); t.style.color = d.primary || ""; t.style.display = "none"; document.documentElement.appendChild(t); const m = getComputedStyle(t).color.match(/\d+(\.\d+)?/g); t.remove(); if (m && m.length >= 3) L = (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255; } catch {}
      document.documentElement.toggleAttribute("data-pri-dark", L < 0.22); }
    root.setProperty("--ink", d.dark); root.setProperty("--paper", d.background);
    root.setProperty("--head", `${ff(d.headingFont)}system-ui,sans-serif`); root.setProperty("--head-w", +d.headingWeight || 700);
    root.setProperty("--body", `${ff(d.bodyFont)}system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif`); root.setProperty("--body-w", +d.bodyWeight || 400);
    root.setProperty("--logo-h", (+d.logoPx >= 20 && +d.logoPx <= 140 ? +d.logoPx : LOGO_H[d.logoSize] || 38) + "px");
    document.documentElement.setAttribute("data-logo-round", d.logoRound === false ? "off" : "on");
    window.__koIcon = d.appIcon192 || "";
    for (const [k, v] of Object.entries(shapeVars(d))) root.setProperty(k, v);
    const px = (v) => (v !== "" && v != null && +v >= 0 ? Math.min(160, +v) + "px" : "");
    if (px(d.secGap)) root.setProperty("--sec-gap", px(d.secGap)); else root.removeProperty("--sec-gap");
    if (px(d.afterSlider)) root.setProperty("--after-slider", px(d.afterSlider)); else root.removeProperty("--after-slider");
    LAY = layoutOf(d);
    for (const [k, v] of Object.entries(LAY)) document.documentElement.setAttribute("data-l-" + k, v);
    let tcs = themeColors(d); if (dk) [tcs, dkBg] = darkTc(d);
    for (const [k, v] of Object.entries(tcs)) root.setProperty("--c-" + k, v);
    root.setProperty("--paper", dk ? dkBg : d.background);
    for (const [k, v] of dk ? [] : [["headerBg", "hdr-bg"], ["headerText", "hdr-fg"], ["textColor", "text"], ["footerBg", "ftr-bg"], ["footerText", "ftr-fg"], ["heroBg", "hero-bg"], ["homeText", "home-text"], ["productText", "prod-text"], ["priceColor", "price-c"]]) {
      if (/^#[0-9a-f]{6}$/i.test(d[k] || "")) root.setProperty("--" + v, d[k]); else root.removeProperty("--" + v);
    }
    if (dk) for (const v of ["hdr-bg", "hdr-fg", "text", "ftr-bg", "ftr-fg", "hero-bg", "home-text", "prod-text", "price-c"]) root.removeProperty("--" + v);
    const fu = fontUrl(d);
    let fl = $("[data-headfont]");
    if (fu) { if (!fl) { fl = document.createElement("link"); fl.rel = "stylesheet"; fl.dataset.headfont = ""; document.head.appendChild(fl); } if (fl.getAttribute("href") !== fu) fl.href = fu; }
    const fav = d.appIcon192 || d.favicon; if (fav) { const ic = document.querySelector('link[rel="icon"]'); if (ic) { ic.href = fav; ic.type = "image/png"; } }
    if (d.appIcon192) { const ai = document.querySelector('link[rel="apple-touch-icon"]'); if (ai) ai.href = d.appIcon192; }
    document.querySelector('meta[name="theme-color"]').content = dk ? dkBg : d.dark;
    if (window.KOFx) KOFx.apply(d, dk);
    if (typeof renderBnav === "function" && RAW_READY) renderBnav(d);
    { const z = pzOf(), de = document.documentElement, zz = d.pz || {}, HXc = /^#[0-9a-f]{6}$/i;
      de.setAttribute("data-pz-lay", z.lay); de.setAttribute("data-pz-al", z.al); de.setAttribute("data-pz-old", z.old); de.setAttribute("data-pz-off", z.off); de.setAttribute("data-pz-lock", z.lock);
      const sv = (k, v) => (v ? root.setProperty(k, v) : root.removeProperty(k));
      { const cu = cuOf(); de.setAttribute("data-cu-pos", cu.pos); de.setAttribute("data-cu-old", cu.old ? "on" : "off"); const cs = +((d.cu || {}).size); sv("--cu-s", cs >= 30 && cs <= 100 ? cs / 100 : ""); }
      sv("--pz-ns", +zz.ns >= 70 && +zz.ns <= 180 ? +zz.ns / 100 : ""); sv("--pz-os", +zz.os >= 35 && +zz.os <= 100 ? +zz.os / 100 : "");
      sv("--pz-nc", HXc.test(zz.nc || "") ? zz.nc : ""); sv("--pz-oc", HXc.test(zz.oc || "") ? zz.oc : ""); sv("--pz-ob", HXc.test(zz.ob || "") ? zz.ob : ""); sv("--pz-of", HXc.test(zz.of || "") ? zz.of : ""); }
    { // product card (design.cd): name size/weight/lines/colour, price close to the name, luxury looks and hover motion
      const c = d.cd || {}, de = document.documentElement, st = de.style, HX = /^#[0-9a-f]{6}$/i, W = [400, 500, 600, 700, 800];
      const sv = (k, v) => (v === "" || v == null ? st.removeProperty(k) : st.setProperty(k, v)), flag = (a, on) => (on ? de.setAttribute(a, "") : de.removeAttribute(a));
      const ns = +c.nameSize >= 11 && +c.nameSize <= 26 ? +c.nameSize : 0; sv("--cd-ns", ns ? ns + "px" : ""); flag("data-cd-ns", ns);
      const nw = W.includes(+c.nameWeight) ? +c.nameWeight : 0; sv("--cd-nw", nw ? String(nw) : ""); flag("data-cd-nw", nw);
      sv("--cd-nc", HX.test(c.nameColor || "") ? c.nameColor : ""); flag("data-cd-nc", HX.test(c.nameColor || ""));
      de.setAttribute("data-cd-nl", [1, 2, 3].includes(+c.nameLines) ? String(+c.nameLines) : "");
      de.setAttribute("data-cd-near", c.near === false ? "off" : "on");
      sv("--cd-gap", (c.gap !== "" && c.gap != null && +c.gap >= 0 && +c.gap <= 30 ? +c.gap : 4) + "px");
      de.setAttribute("data-cd-na", ["start", "center"].includes(c.nameAlign) ? c.nameAlign : "");
      de.setAttribute("data-cd-look", ["luxe", "noir", "glass", "soft", "frame", "pure"].includes(c.look) ? c.look : "");
      de.setAttribute("data-cd-hov", ["lift", "shine", "zoom", "glow", "tilt", "reveal"].includes(c.hover) ? c.hover : "");
      sv("--cd-ac", HX.test(c.accent || "") ? c.accent : "");
      sv("--cd-r", c.radius !== "" && c.radius != null && +c.radius >= 0 && +c.radius <= 32 ? +c.radius + "px" : ""); flag("data-cd-r", c.radius !== "" && c.radius != null && +c.radius >= 0 && +c.radius <= 32);
    }
    { const g = pgOf(d), de = document.documentElement; de.setAttribute("data-pg-side", g.side); de.setAttribute("data-pg-th", g.thumbs); de.setAttribute("data-pg-ts", g.tsize); de.setAttribute("data-pg-ta", g.talign); de.setAttribute("data-pg-td", g.tdir); de.style.setProperty("--pg-ms", g.ms + "ms"); }
    document.documentElement.setAttribute("data-skin", /^[a-z]{3,12}$/.test(d.skin || "") ? d.skin : "none");
    renderTimer(d);
    document.querySelector('meta[name="description"]').content = C.seoDescription || "";
    const logo = d.logoImage ? `<img src="${esc(d.logoImage)}" alt="${esc(C.name)}">`
      : `${d.logoText1 ? `<span class="logo-ko">${esc(d.logoText1)}</span>` : ""}<span class="logo-sport">${esc(d.logoText2)}</span>`;
    document.querySelectorAll("[data-logo]").forEach((el) => { el.innerHTML = logo; });
    const an = $("[data-announce]"), text = C.announcement || (PREVIEW && (d.announceOn ?? true) ? "✍️ اكتب نص شريط التنبيهات من لوحة التحكم" : "");
    let closed = false; try { closed = !PREVIEW && localStorage.getItem("ko_ann_closed") === text; } catch {}
    const show = !!text && (d.announceOn ?? true) && !(d.announceClosable && closed);
    an.innerHTML = show ? `<span>${esc(text)}</span>${d.announceClosable ? '<button class="ann-x" data-ann-close aria-label="إغلاق">✕</button>' : ""}` : "";
    an.hidden = !show;
    $("[data-footnote]").textContent = C.footerNote || "";
  }


  // ---------- data ----------
  const getJSON = (u) => fetch(u, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  // Settings + products load in parallel; the last copy is kept on the device so repeat visits render instantly.
  async function fetchFresh() {
    const _t = "&_t=" + Date.now();
    // the page head already started both requests (window.__koF): use them instead of asking twice
    const early = window.__koF; window.__koF = null;
    let [st, data] = await Promise.all(early && early.length === 2 ? early : [getJSON("/api/settings?r=1" + _t), getJSON("/api/products?r=1" + _t)]);
    if (!st || !st.store) st = await getJSON("/settings.default.json");
    if (!Array.isArray(data)) data = await getJSON("/products.json");
    if (!st || !Array.isArray(data)) throw new Error("load");
    return [st, data];
  }
  function setData(st, data) {
    useSettings(st);
    applyDesign();
    products = data.filter((p) => !p.hidden && !(S.design.hideOutOfStock && !p.inStock));
    byId = new Map(products.map((p) => [p.id, p]));
    const m = new Map();
    for (const p of products) {
      for (const c of [p.category, ...(p.also || [])]) {
        if (!m.has(c)) m.set(c, { name: c, count: 0, image: "" });
        const e = m.get(c); e.count++;
        if (!e.image && p.inStock && p.image) e.image = p.thumb || p.image;
      }
    }
    cats = [...m.values()];
    for (const c of cats) { const mi = catMeta(c.name).image; if (mi) c.image = mi; }
    cart = cart.filter((l) => byId.has(l.id));
    saveCart();
  }

  // ---------- views ----------
  function card(p) {
    const needsOpt = (p.options || []).length > 0;
    // a plain badge text stays on the photo; a discount sits next to the price; sold-out shows «خالصة» and no discount
    const cb = S.design.cardBadge || "", isDiscText = /[%٪]/.test(cb) || !!discBadge(p);
    const promo = p.inStock && cb && !isDiscText ? `<span class="promo">${ICON.ticket}${esc(cb)}</span>` : "";
    return `<article class="card${p.inStock ? "" : " out"}">
      ${promo}
      <a class="pic" href="#/p/${encodeURIComponent(p.id)}"><img loading="lazy" decoding="async" width="360" height="360" src="${esc(imgW(p.thumb || p.image, 540))}"${imgSet(p.thumb || p.image, [360, 540, 640, 800], "(max-width:640px) 86vw, 340px")} alt="${esc(p.name)}">${p.inStock ? "" : '<span class="out-stamp">خالص</span>'}</a>
      <div class="body">
        <a class="name" href="#/p/${encodeURIComponent(p.id)}">${esc(p.name)}</a>
        ${stars(p.rt)}
        <div class="foot-row">
          <span class="price-box">${p.inStock ? offH(p) : ""}<span class="price">${p.inStock ? priceH(p) : money(p.price)}</span></span>
          ${p.inStock ? (needsOpt
            ? `<a class="add" href="#/p/${encodeURIComponent(p.id)}"><span class="t1">اختار</span><span class="t2">حدد اختيارك</span></a>`
            : `<button class="add" data-add="${esc(p.id)}" aria-label="أضف للسلة">${ICON.cart}<span class="t1">+ للسلة</span><span class="t2">أضف إلى السلّة</span></button>`) : ""}
        </div>
        ${p.inStock && S.design.buyNow ? (needsOpt
          ? `<a class="buy-now" href="#/p/${encodeURIComponent(p.id)}">اشتري الآن</a>`
          : `<button class="buy-now" data-buynow="${esc(p.id)}">اشتري الآن</button>`) : ""}
      </div>
    </article>`;
  }
  const sortStock = (a, b) => (b.inStock - a.inStock);

  function groupOf(c) { return C.groups.find((g) => g.cats.includes(c)); }
  // the order the owner drags into place in the collection editor (design.catMeta[cat].order).
  // Sorting happens BEFORE any slice, so hand-picked items actually make it into a short row.
  function orderBy(items, cats) {
    const ix = new Map();
    for (const c of cats || []) for (const id of catMeta(c).order || []) if (!ix.has(id)) ix.set(id, ix.size);
    if (!ix.size) return items;
    return items.slice().sort((a, b) => (ix.has(a.id) ? ix.get(a.id) : 1e6) - (ix.has(b.id) ? ix.get(b.id) : 1e6));
  }

  // ---------- home page: sections chosen in the dashboard ----------
  function slideHtml(sl, first) {
    const al = ["start", "center", "end"].includes(sl.align) ? sl.align : "center";
    const size = Math.min(30, Math.max(14, +sl.size || 18));
    const btn = (b, cls) => (b && b.text ? `<a class="btn ${cls}" href="${esc(b.link || "#/all")}">${esc(b.text)}</a>` : "");
    return `<div class="slide" data-align="${al}" style="--tc:${esc(sl.color || "#ffffff")};--ts:${size}px">` +
      (sl.img ? `<picture><source media="(max-width:640px)" srcset="${esc(imgW(sl.imgMobile || sl.img, 828))}"><img src="${esc(imgW(sl.img, 1280))}" alt="${esc(sl.title || "")}" width="1600" height="500" ${first ? 'fetchpriority="high" data-nofx' : 'loading="lazy" decoding="async"'}></picture>` : "") +
      `<div class="sl-text">${sl.title ? `<h2>${esc(sl.title)}</h2>` : ""}${sl.subtitle ? `<p>${esc(sl.subtitle)}</p>` : ""}<div class="sl-btns">${btn(sl.btn1, "btn-red")}${btn(sl.btn2, "btn-light")}</div></div></div>`;
  }
  const HERO_FX = ["fade", "zoom", "blur", "wipe", "dip", "slide", "flip", "rise", "circle", "spin", "split", "xfade"], HERO_SH = ["theme", "full", "round", "curve", "peek"];
  function classicHero() {
    const d = S.design, inStock = products.filter((p) => p.inStock).length;
    return `<section class="hero${d.heroImage ? " has-img" : ""}"${d.heroImage ? ` style="background-image:url('${esc(d.heroImage)}')"` : ""}>
      <h1>${esc(d.heroTitle)}</h1><p>${esc(d.heroText)}</p>
      ${d.showHeroStats ? `<div class="hero-stats"><div><b>${inStock}</b>منتج متوفر</div><div><b>${cats.length}</b>قسم</div><div><b>${govList().length}</b>محافظة توصيل</div></div>` : ""}
    </section>`;
  }
  // ---------- conversion helpers (all real data: the cart, the shipping threshold, the owner's own texts) ----------
  const CV = () => (S.design && S.design.conv) || {};
  const trustH = () => { const c = CV(), it = (c.trustItems || []).filter((x) => x && x.t); return c.trust && it.length ? `<ul class="conv-trust">${it.slice(0, 6).map((x) => `<li><span>${esc(x.i || "✔")}</span>${esc(x.t)}</li>`).join("")}</ul>` : ""; };
  const shipBarH = (sub) => {
    const fo = Number((S.delivery || {}).freeOver) || (PREVIEW ? Math.max(50, Math.ceil(sub * 1.6)) : 0); if (!fo || !CV().shipBar) return "";
    const ok = sub >= fo;
    return `<div class="conv-ship${ok ? " ok" : ""}"><div class="cs-t">${ok ? "🎉 توصيلك مجاني!" : `🚚 ضيف بـ <b>${money(fo - sub)}</b> كمان وبيصير التوصيل مجاني`}</div><i><em style="width:${Math.min(100, Math.round((sub / fo) * 100))}%"></em></i></div>`;
  };
  function upsellH(lines) {
    if (!CV().upsell) return "";
    const inCart = new Set(lines.map((l) => l.id)), cs = new Set(lines.map((l) => (byId.get(l.id) || {}).category));
    const items = products.filter((p) => p.inStock && !inCart.has(p.id) && !(p.options || []).length && cs.has(p.category)).sort((a, b) => (b.sold || 0) - (a.sold || 0)).slice(0, 4);
    return items.length ? `<section class="conv-up"><h3>ناسبهم مع طلبك 👌</h3><div>${items.map((p) => `<div class="cu-i"><a href="#/p/${encodeURIComponent(p.id)}"><img loading="lazy" src="${esc(img(p.thumb || p.image))}" alt=""></a><b>${esc(p.name)}</b><span>${money(p.price)}</span><button type="button" data-up="${esc(p.id)}">+ أضف</button></div>`).join("")}</div></section>` : "";
  }
  let cvT = 0;
  function renderTimer(d) {
    const t = (d.conv || {}).timer || {}; let end = Date.parse(t.endsAt || ""); if (PREVIEW && t.on && !(end > Date.now())) end = Date.now() + 2 * 86400000 + 5 * 3600000; let el = $("[data-conv-timer]"); clearInterval(cvT);
    if (!t.on || !end || end <= Date.now()) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement("div"); el.className = "conv-timer"; el.dataset.convTimer = ""; const an = $("[data-announce]"); an.parentNode.insertBefore(el, an.nextSibling); }
    const pad = (n) => String(n).padStart(2, "0"), link = /^(#\/|\/|https:\/\/)/.test(t.link || "") ? t.link : "#/all";
    const tick = () => {
      const s = Math.max(0, Math.floor((end - Date.now()) / 1000)); if (!s) { el.remove(); clearInterval(cvT); return; }
      const dd = Math.floor(s / 86400);
      el.innerHTML = `<span class="ct-t">${esc(t.text || "عرض لوقت محدود")}</span><span class="ct-n">${dd ? `<i><b>${dd}</b>يوم</i>` : ""}<i><b>${pad(Math.floor((s % 86400) / 3600))}</b>ساعة</i><i><b>${pad(Math.floor((s % 3600) / 60))}</b>دقيقة</i><i><b>${pad(s % 60)}</b>ثانية</i></span>${t.btn ? `<a class="ct-b" href="${esc(link)}">${esc(t.btn)}</a>` : ""}`;
    };
    tick(); cvT = setInterval(tick, 1000);
  }
  const secHead = (title, link) => (title ? `<div class="sec-head"><h2>${esc(title)}</h2>${link ? `<a href="${link}">عرض الكل ←</a>` : ""}</div>` : "");
  // a product list for a home section: side slider (auto-moving) or grid, with products-per-row for phone and computer
  function listOf(items, sec) {
    sec = typeof sec === "string" ? { layout: sec } : sec || {};
    if (sec.layout === "spot") return spot(sec, items.map(card), "spot-cards");
    if (sec.layout === "car") return carousel(sec, items.map(card), "car-cards");
    const grid = sec.layout === "grid", pm = +sec.perMob, pd = +sec.perDesk;
    const bgc = sec.noBg ? "transparent" : /^#[0-9a-f]{6}$/i.test(sec.bg || "") ? sec.bg : "";
    const attrs = (pm >= 1 && pm <= 4 ? ` data-pm style="--pm:${pm}` : ` style="`) + (bgc ? `;--cimg:${bgc}` : "") + (pd >= 1 && pd <= 6 ? `;--pd:${pd}" data-pd` : `"`);
    const auto = !grid && sec.auto !== "off" ? ` data-auto="${Math.min(10, Math.max(2, +sec.speed || 4))}"` : "";
    return `<div class="${grid ? "grid" : "row"} slist"${attrs}${auto}>${items.map(card).join("")}</div>`;
  }
  function tiles(sec, items, cls, defGrid) {
    if (sec.layout === "spot") return spot(sec, items, cls);
    if (sec.layout === "car") return carousel(sec, items, cls + " car-wide");
    const grid = sec.layout ? sec.layout === "grid" : !!defGrid, pm = +sec.perMob, pd = +sec.perDesk, bg = /^#[0-9a-f]{6}$/i.test(sec.bg || "") ? sec.bg : "";
    const st = [pm >= 1 && pm <= 4 ? `--pm:${pm}` : "", pd >= 1 && pd <= 6 ? `--pd:${pd}` : "", sec.noBg ? "--cimg:transparent" : bg ? `--cimg:${bg}` : ""].filter(Boolean).join(";");
    return `<div class="tiles ${grid ? "t-grid" : "t-row"} ${cls}"${pm ? " data-pm" : ""}${pd ? " data-pd" : ""}${st ? ` style="${st}"` : ""}>${items.map((h) => `<div class="tile">${h}</div>`).join("")}</div>`;
  }
  function ytId(u) { const m = String(u || "").match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/); return m ? m[1] : ""; }
  const SECTIONS = {
    slider() {
      const slides = (S.design.slides || []).filter((x) => x.img || x.title);
      if (!slides.length) return classicHero();
      const D = S.design, prog = D.sliderProg || (D.sliderBar === false ? "off" : "dot");
      const shape = HERO_SH.includes(D.sliderShape) ? D.sliderShape : "theme";
      // «بالنص»: the slide sits in the middle with the one before and after peeking on the sides
      if (shape === "peek" && slides.length > 1)
        return carousel({ cSize: D.sliderSize, cGap: D.sliderGap, cFx: D.sliderCarFx || "scale", cSide: D.sliderSide, cShape: "round", speed: D.sliderSpeed, auto: "on", cDots: prog !== "off", cLoop: true },
          slides.map((x, i) => slideHtml(x, i === 0)), "car-hero car-wide", { size: 80, gap: 10, fill: prog === "dot", maxDots: 20, speedMax: 15, speedDef: 5 });
      const fx = HERO_FX.includes(D.sliderFx) ? D.sliderFx : "fade", fade = fx !== "slide", bar = prog === "bar" && slides.length > 1;
      return `<section class="slider${fade ? " fx-fade" : ""}${fade && fx !== "fade" ? " fx-" + fx : ""}${fx === "xfade" && D.sliderXk === "soft" ? " xf-kb" : ""}${fx === "xfade" && D.sliderXt === "static" ? " xf-st" : ""}${shape !== "theme" ? " sh-" + shape : ""}"${fx === "xfade" ? ` style="--xf:${Math.min(5, Math.max(0.3, +D.sliderXf || 1.6))}s;--xe:${["ease-in-out", "linear", "ease-out", "ease-in"].includes(D.sliderXe) ? D.sliderXe : "ease-in-out"}"` : ""} data-slider><div class="sl-track" dir="ltr">${slides.map((x, i) => slideHtml(x, i === 0).replace('class="slide"', `class="slide${i ? "" : " on"}"`)).join("")}</div>
        ${slides.length > 1 ? `<div class="dots sl-dots${prog === "dot" ? " fill" : ""}"${fade ? "" : ' dir="ltr"'}>${slides.map((_, i) => `<span data-sl-dot="${i}" class="${i ? "" : "on"}"><i></i></span>`).join("")}</div>
        <button class="sl-nav sl-prev" aria-label="السابقة">‹</button><button class="sl-nav sl-next" aria-label="التالية">›</button>` : ""}
        ${bar ? `<div class="sl-prog" aria-hidden="true"><i data-sl-bar></i></div>` : ""}</section>`;
    },
    categories(sec) {
      const order = C.groups.flatMap((g) => g.cats);
      let sorted = [...cats].sort((a, b) => (order.indexOf(a.name) + 1 || 999) - (order.indexOf(b.name) + 1 || 999));
      if ((sec.cats && sec.cats.length) || sec.pick) sorted = (sec.cats || []).map((n) => cats.find((c) => c.name === n)).filter(Boolean);
      if (!sorted.length) return "";
      // look of each collection (sec.tStyle), its texts (count word, button) and name size
      const tst = ["classic", "circle", "overlay", "chip", "btn", "card", "luxe"].includes(sec.tStyle) ? sec.tStyle : "classic";
      const cntW = sec.countText == null || sec.countText === "" ? "منتج" : String(sec.countText).slice(0, 20), btnT = String(sec.btnText || "").slice(0, 24).trim();
      const tileH = (c) => `<a class="cat-tile" href="${cHref(c.name)}">${tst === "btn" ? "" : `<img loading="lazy" decoding="async" width="360" height="360" src="${esc(imgW(c.image, 360))}" alt="${esc(catLabel(c.name))}">`}<b>${esc(catLabel(c.name))}</b>${sec.showCount === false ? "" : `<span>${c.count} ${esc(cntW)}</span>`}${btnT ? `<i class="ct-btn">${esc(btnT)}</i>` : ""}</a>`;
      const look = ["cst-" + tst, ["s", "l"].includes(sec.nameSize) ? "cns-" + sec.nameSize : ""].filter(Boolean).join(" ");
      if (sec.layout === "spot") return secHead(sec.showTitle === false ? "" : sec.title, "#/all") + `<div class="${look}">${spot(sec, sorted.map(tileH), "spot-cats")}</div>`;
      if (sec.layout === "car") return secHead(sec.showTitle === false ? "" : sec.title, "#/all") + `<div class="${look}">${carousel(sec, sorted.map(tileH), "car-cats")}</div>`;
      const pm = +sec.perMob, pd = +sec.perDesk, bg = /^#[0-9a-f]{6}$/i.test(sec.bg || "") ? sec.bg : "";
      const cls = ["cat-tiles", look, sec.layout === "grid" ? "cs-grid" : sec.layout === "row" ? "cs-row" : "", sec.showNames === false ? "no-names" : "", sec.noBg ? "no-bg" : ""].filter(Boolean).join(" ");
      const style = [pm >= 1 && pm <= 4 ? `--pm:${pm}` : "", pd >= 2 && pd <= 8 ? `--pd:${pd}` : "", !sec.noBg && bg ? `--cimg:${bg}` : ""].filter(Boolean).join(";");
      return secHead(sec.showTitle === false ? "" : sec.title, "#/all") + `<div class="${cls}"${pm ? " data-pm" : ""}${pd ? " data-pd" : ""}${style ? ` style="${style}"` : ""}>${sorted.map(tileH).join("")}</div>`;
    },
    groups(sec) {
      sec = sec || {};
      return C.groups.map((g) => {
        const items = orderBy(products.filter((p) => p.inStock && g.cats.some((c) => inCat(p, c))), g.cats).slice(0, +sec.count || 12);
        return items.length ? secHead(g.name, `#/g/${encodeURIComponent(g.name)}`) + listOf(items, { layout: "row", ...sec }) : "";
      }).join("");
    },
    new(sec) { const items = products.filter((p) => p.inStock).slice(0, +sec.count || 15); return items.length ? secHead(sec.showTitle === false ? "" : sec.title, "#/all") + listOf(items, sec) : ""; },
    best(sec) {
      let items = products.filter((p) => p.inStock && p.sold).sort((a, b) => b.sold - a.sold);
      // until enough orders are recorded, top the list up with in-stock products that have the most photos
      if (items.length < 6) items = items.concat(products.filter((p) => p.inStock && !p.sold).sort((a, b) => ((b.images || []).length - (a.images || []).length))).slice(0, Math.max(items.length, 12));
      items = items.slice(0, +sec.count || 20);
      return items.length ? secHead(sec.showTitle === false ? "" : sec.title, "") + listOf(items, sec) : "";
    },
    products(sec) {
      let list = products.filter((p) => p.inStock && (!sec.cat || inCat(p, sec.cat)));
      if (sec.cat) list = orderBy(list, [sec.cat]);
      const items = list.slice(0, +sec.count || 12);
      return items.length ? secHead(sec.showTitle === false ? "" : sec.title, sec.cat ? `${cHref(sec.cat)}` : "#/all") + listOf(items, sec) : "";
    },
    banner(sec) {
      const items = (sec.items && sec.items.length ? sec.items : [{ img: sec.img, imgMobile: sec.imgMobile, link: sec.link }]).filter((x) => x && x.img);
      if (!items.length) return "";
      const one = (x) => { const pic = `<picture>${x.imgMobile ? `<source media="(max-width:640px)" srcset="${esc(x.imgMobile)}">` : ""}<img src="${esc(x.img)}" alt="${esc(x.alt || sec.title || "")}" loading="lazy" decoding="async" width="1600" height="500"></picture>`; return `<div class="banner">${x.link ? `<a href="${esc(x.link)}">${pic}</a>` : pic}</div>`; };
      return secHead(sec.showTitle === false || !sec.title ? "" : sec.title, "") + (items.length === 1 && !sec.perDesk ? one(items[0]) : tiles(sec, items.map(one), "t-banners"));
    },
    video(sec) {
      const urls = (sec.videos && sec.videos.length ? sec.videos : [sec.url]).filter(Boolean);
      const KM = window.KOMedia; if (!KM) return "";
      const opts = { auto: sec.autoplay !== false, sound: sec.sound !== false, loop: !!sec.loop, controls: sec.controls !== false };
      const tilesH = urls.map((u) => KM.video(u, opts)).filter(Boolean);
      if (!tilesH.length) return "";
      return secHead(sec.showTitle === false ? "" : sec.title, "") + (tilesH.length === 1 && !sec.perDesk ? tilesH[0] : tiles(sec, tilesH, "t-videos"));
    },
    recent(sec) {
      const ids = store.get("ko_recent", []), items = ids.map((i) => byId.get(i)).filter((p) => p && p.inStock).slice(0, +sec.count || 10);
      return items.length ? secHead(sec.showTitle === false ? "" : sec.title || "شاهدتها مؤخراً", "") + listOf(items, sec) : "";
    },
    features(sec) {
      const items = (sec.items || []).filter((x) => x.title);
      return items.length ? secHead(sec.showTitle === false ? "" : sec.title, "") + tiles(sec, items.map((x) => `<div class="feature"><span class="f-ic">${esc(x.icon || "⭐")}</span><b>${esc(x.title)}</b>${x.text ? `<p>${esc(x.text)}</p>` : ""}</div>`), "t-features", true) : "";
    },
    code(sec) {
      if (!sec.code) return "";
      // custom code runs in a sealed box: it can't touch the shop, the cart or the dashboard
      const doc = `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font-family:system-ui,Tahoma,sans-serif}</style></head><body>${sec.code}<script>(function(){function h(){parent.postMessage({koCode:${JSON.stringify(sec.id || "")},h:document.documentElement.scrollHeight},"*")}addEventListener("load",h);new ResizeObserver(h).observe(document.body);setTimeout(h,500)})()<\/script></body></html>`;
      return (sec.title ? secHead(sec.title, "") : "") + `<iframe class="code-sec" data-code-id="${esc(sec.id || "")}" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms" loading="lazy" title="${esc(sec.title || "محتوى")}" srcdoc="${esc(doc)}"></iframe>`;
    },
    // promo ticker: messages that keep moving, flip one after another, or type themselves — with text and background effects
    ticker(sec) {
      const lines = String(sec.lines || "").split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 20); if (!lines.length) return "";
      const one = (v, l, f) => (l.includes(v) ? v : f);
      const mode = one(sec.mode, ["marquee", "flip", "type"], "marquee"), tfx = one(sec.tfx, ["none", "neon", "shine", "pulse", "rainbow"], "none"), bfx = one(sec.bfx, ["solid", "gradient", "stripes"], "solid");
      const HX6 = /^#[0-9a-f]{6}$/i, bg = !sec.noBg && HX6.test(sec.bg || "") ? sec.bg : "", fg = HX6.test(sec.fg || "") ? sec.fg : "", ac = HX6.test(sec.ac || "") ? sec.ac : "";
      const it = (l) => { const [t, link] = l.split("|").map((x) => x.trim()); const ok = link && /^(#\/|\/|https:\/\/)/.test(link); return ok ? `<a class="tk-i" href="${esc(link)}">${esc(t)}</a>` : `<span class="tk-i">${esc(t)}</span>`; };
      const sep = sec.sep === "" ? "" : `<i class="tk-sep" aria-hidden="true">${esc(String(sec.sep ?? "✦").slice(0, 3))}</i>`;
      const vars = `--tk-bg:${bg || "var(--red)"};--tk-fg:${fg || (bg ? readable(bg, "") : "#fff")};--tk-ac:${ac || "#ffd60a"}`;
      let inner;
      if (mode === "marquee") { const run = lines.map((l) => it(l) + sep).join(""); inner = `<div class="tk-track" data-tk-run data-dir="${sec.dir === "ltr" ? "ltr" : "rtl"}" data-sp="${one(sec.speed, ["slow", "normal", "fast"], "normal")}"><div class="tk-run">${run.repeat(3)}</div><div class="tk-run" aria-hidden="true">${run.repeat(3)}</div></div>`; }
      else inner = `<div class="tk-win" data-tk-${mode} data-every="${+sec.every >= 2 && +sec.every <= 12 ? +sec.every : 4}">${lines.map((l, i) => `<div class="tk-slide${i ? "" : " on"}">${it(l)}</div>`).join("")}</div>`;
      return `<div class="tk tk-${mode} tk-t-${tfx} tk-b-${bfx} tk-s-${one(sec.size, ["s", "m", "l"], "m")}${sec.hover === false ? "" : " tk-hp"}" style="${vars}">${inner}</div>`;
    },
    text(sec) {
      const al = ["start", "center", "end"].includes(sec.align) ? sec.align : "start", bg = /^#[0-9a-f]{6}$/i.test(sec.bg || "") && !sec.noBg ? sec.bg : "";
      return sec.title || sec.body ? `<div class="text-sec" style="text-align:${al}${bg ? `;background:${bg};color:${readable(bg, "")}` : ""}">${sec.title && sec.showTitle !== false ? `<h2>${esc(sec.title)}</h2>` : ""}${sec.body ? `<p>${esc(sec.body)}</p>` : ""}</div>` : "";
    },
  };
  // The server already drew the first slide. On the first draw we keep that very element (and its photo) and only
  // add the rest around it: the picture never blinks and the browser doesn't count a "new" big image.
  function keepServerSlider(html) {
    const old = app.querySelector(":scope > .hs-slider > section.slider:not([data-slider])");
    if (!old) return false;
    const tpl = document.createElement("template"); tpl.innerHTML = html;
    const wrap = tpl.content.firstElementChild, neu = wrap && wrap.matches(".hs-slider") && wrap.querySelector(":scope > section.slider");
    const oTrack = old.querySelector(".sl-track"), nTrack = neu && neu.querySelector(":scope > .sl-track");
    const oFirst = oTrack && oTrack.firstElementChild, nFirst = nTrack && nTrack.firstElementChild;
    const oImg = oFirst && oFirst.querySelector("picture img"), nImg = nFirst && nFirst.querySelector("picture img");
    if (!oImg || !nImg || oImg.getAttribute("src") !== nImg.getAttribute("src")) return false;
    const same = (from, to) => { for (const a of [...to.attributes]) to.removeAttribute(a.name); for (const a of [...from.attributes]) to.setAttribute(a.name, a.value); };
    same(wrap, old.parentElement); same(neu, old); same(nTrack, oTrack); same(nFirst, oFirst);
    for (const c of [...oFirst.children]) if (c.tagName !== "PICTURE") c.remove();
    for (const c of [...nFirst.children]) if (c.tagName !== "PICTURE") oFirst.appendChild(c);
    for (const c of [...nTrack.children].slice(1)) oTrack.appendChild(c);
    for (const c of [...neu.children]) if (c !== nTrack) old.appendChild(c);
    for (const c of [...app.children]) if (c !== old.parentElement) c.remove();
    wrap.remove();
    app.appendChild(tpl.content);
    return true;
  }
  function home() {
    const secs = ((S.home && S.home.sections) || []).filter((x) => x.on !== false);
    const html = secs.map((sec) => {
      try {
        let h = (SECTIONS[sec.type] || (() => ""))(sec); if (!h) return "";
        if (sec.full && sec.type !== "slider") h = `<div class="sec-full">${h}</div>`;
        const gt = sec.gapTop !== "" && sec.gapTop != null && +sec.gapTop >= 0 && sec.type !== "slider" ? ` style="--gt:${Math.min(160, +sec.gapTop)}px"` : "";
        return `<div class="hsec hs-${sec.type}" data-si="${S.home.sections.indexOf(sec)}"${gt}>${h}</div>`;
      } catch { return ""; }
    }).join("") || classicHero();
    let kept = false;
    if (!home.ran) { try { kept = keepServerSlider(html); } catch { kept = false; } }
    home.ran = true;
    if (!kept) app.innerHTML = html;
    startSlider(); startRows(); startSpots(); startCars(); startTickers();
    // the product photos already on screen are what Google times as "page loaded": fetch them now, first, with no fade
    let boost = 0;
    for (const im of app.querySelectorAll('.hsec img[loading="lazy"]')) {
      if (boost >= 3) break;
      if (im.closest("[data-clone],.slider,.car-hero")) continue; // hidden copies / stacked slides
      const r = im.getBoundingClientRect();
      if (!r.width || r.top > innerHeight || r.bottom < 0 || r.right < 0 || r.left > innerWidth) continue;
      im.setAttribute("fetchpriority", "high"); im.setAttribute("data-nofx", ""); im.loading = "eager"; boost++;
    }
    if (window.KOMedia) KOMedia.scan(app);
  }
  addEventListener("message", (e) => {
    const d = e.data; if (!d || typeof d.koCode !== "string" || typeof d.h !== "number") return;
    document.querySelectorAll(`iframe.code-sec`).forEach((fr) => { if (fr.contentWindow === e.source) fr.style.height = Math.min(4000, Math.max(40, d.h)) + "px"; });
  });
  // smooth, frame-exact horizontal glide (scroll-snap is switched off while it moves, so nothing fights the animation)
  function glide(el, to, ms, done) {
    if (el._glide) cancelAnimationFrame(el._glide.raf);
    const from = el.scrollLeft, d = to - from; if (Math.abs(d) < 1) { if (done) done(); return; }
    const snap = el.style.scrollSnapType; el.style.scrollSnapType = "none"; el.style.scrollBehavior = "auto";
    const t0 = performance.now(), ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const g = (el._glide = { raf: 0 });
    const step = (now) => {
      const t = Math.min(1, (now - t0) / ms); el.scrollLeft = from + d * ease(t);
      if (t < 1 && el._glide === g) g.raf = requestAnimationFrame(step);
      else if (el._glide === g) { el._glide = null; el.style.scrollSnapType = snap; if (done) done(); }
    };
    g.raf = requestAnimationFrame(step);
  }
  const stopGlide = (el) => { if (el._glide) { cancelAnimationFrame(el._glide.raf); el._glide = null; el.style.scrollSnapType = ""; } };
  // product rows that slide sideways by themselves at a steady rhythm (they rest only while a finger is on them)
  let rowTimers = [];
  let tkTimers = [];
  function startTickers() {
    tkTimers.forEach(clearInterval); tkTimers = [];
    const reduce = document.documentElement.classList.contains("reduce");
    app.querySelectorAll("[data-tk-run]").forEach((tr) => {
      const w = tr.firstElementChild.getBoundingClientRect().width || 600, pxs = { slow: 35, normal: 65, fast: 110 }[tr.dataset.sp] || 65;
      tr.style.setProperty("--tk-dur", Math.max(6, w / pxs) + "s");
    });
    app.querySelectorAll("[data-tk-flip],[data-tk-type]").forEach((win) => {
      const sl = [...win.children]; if (sl.length < 2 && !win.hasAttribute("data-tk-type")) return;
      let i = 0; const type = win.hasAttribute("data-tk-type");
      const typeIt = (el) => { const t = el.firstElementChild; if (!t || reduce) return; const full = t.dataset.full || (t.dataset.full = t.textContent); let k = 0; t.textContent = ""; const iv = setInterval(() => { t.textContent = full.slice(0, ++k); if (k >= full.length || !document.contains(t)) clearInterval(iv); }, 45); };
      if (type) typeIt(sl[0]);
      const t = setInterval(() => {
        if (!document.contains(win)) return clearInterval(t);
        if (document.hidden || (win.matches(":hover") && win.closest(".tk-hp"))) return;
        sl[i].classList.remove("on"); sl[i].classList.add("off"); const prev = sl[i];
        i = (i + 1) % sl.length; sl[i].classList.remove("off"); sl[i].classList.add("on");
        setTimeout(() => prev.classList.remove("off"), 700);
        if (type) typeIt(sl[i]);
      }, (+win.dataset.every || 4) * 1000);
      tkTimers.push(t);
    });
  }
  function startRows() {
    rowTimers.forEach((f) => f()); rowTimers = [];
    if (document.documentElement.classList.contains("reduce")) return;
    app.querySelectorAll(".row[data-auto]").forEach((row) => {
      let seen = false, touching = false, dead = false, raf = 0, t0 = performance.now(), last = t0;
      const every = (+row.dataset.auto || 4) * 1000;
      const io2 = "IntersectionObserver" in window && new IntersectionObserver(([en]) => { seen = en.isIntersecting; }, { threshold: 0.3 });
      if (io2) io2.observe(row); else seen = true;
      const press = () => { touching = true; stopGlide(row); };
      const lift = () => { touching = false; t0 = performance.now(); };
      row.addEventListener("pointerdown", press, { passive: true }); row.addEventListener("touchstart", press, { passive: true });
      ["pointerup", "pointercancel", "touchend", "touchcancel"].forEach((ev) => row.addEventListener(ev, lift, { passive: true }));
      row.addEventListener("wheel", () => { t0 = performance.now(); }, { passive: true });
      let stepPx = 0;
      const next = () => {
        const max = row.scrollWidth - row.clientWidth; if (max <= 4) return;
        if (!stepPx) { const f = row.firstElementChild, g = parseFloat(getComputedStyle(row).columnGap) || 0; stepPx = (f ? f.getBoundingClientRect().width : row.clientWidth / 2) + g; }
        const rtl = getComputedStyle(row).direction === "rtl", sgn = rtl ? -1 : 1, fwd = rowSign() === 1;
        const pos = Math.abs(row.scrollLeft), atEnd = pos >= max - 6, atStart = pos <= 6;
        // snap the target to whole items so every move is exactly one card
        let p = fwd ? (atEnd ? 0 : Math.min(max, Math.round(pos / stepPx + 1) * stepPx)) : (atStart ? max : Math.max(0, Math.round(pos / stepPx - 1) * stepPx));
        if (p > max - 6) p = max;
        glide(row, sgn * p, (fwd ? atEnd : atStart) ? 900 : 650);
      };
      const tick = (now) => {
        if (dead || !document.contains(row)) { if (io2) io2.disconnect(); return; }
        const gap = now - last; last = now;
        if (document.hidden || !seen || touching || gap > 400) t0 += gap;
        else if (now - t0 >= every) { t0 = now; next(); }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      const ro = "ResizeObserver" in window && new ResizeObserver(() => { stepPx = 0; }); if (ro) ro.observe(row);
      rowTimers.push(() => { dead = true; cancelAnimationFrame(raf); stopGlide(row); if (io2) io2.disconnect(); if (ro) ro.disconnect(); });
    });
  }
  // main slider: fade (default, right → left) or sideways; a thin progress bar shows when the next slide comes
  const dirSign = () => (S && S.design && S.design.slideDir === "ltr" ? -1 : 1);
  // home rows / carousels of groups and products can move their own way (design.rowDir), otherwise like the main slider
  const rowSign = () => { const r = S && S.design && S.design.rowDir; return r === "ltr" ? -1 : r === "rtl" ? 1 : dirSign(); };   // 1 = new slides come from the right (Arabic default), −1 = from the left
  let sliderTimer, sliderRaf;
  function startSlider() {
    clearInterval(sliderTimer); cancelAnimationFrame(sliderRaf);
    const sl = app.querySelector("[data-slider]"); if (!sl) return;
    const tr = sl.querySelector(".sl-track"), slides = [...tr.children], n = slides.length; if (n < 2) return;
    const DIR = dirSign(), D = S.design, fade = sl.classList.contains("fx-fade"), wipe = sl.classList.contains("fx-wipe"), xfade = sl.classList.contains("fx-xfade"), outMs = xfade ? Math.round(Math.min(5, Math.max(0.3, +D.sliderXf || 1.6)) * 1000) + 150 : 1300, dur = Math.min(15, Math.max(2, +D.sliderSpeed || 5)) * 1000;
    const dots = sl.querySelectorAll(".sl-dots span"), bar = sl.querySelector("[data-sl-bar]"), fillDots = sl.querySelector(".sl-dots.fill");
    const fillOf = (k) => (fillDots && dots[k] ? dots[k].firstElementChild : null);
    let cur = 0, t0 = performance.now(), last = t0;
    const setDots = (i) => dots.forEach((d, k) => d.classList.toggle("on", k === i));
    sl.style.setProperty("--kb", dur / 1000 + 1.5 + "s");
    // load + decode the other photos in the background so the first change never waits for the network
    setTimeout(() => slides.forEach((s, k) => { const im = s.querySelector("img"); if (im && k) { im.loading = "eager"; if (im.decode) im.decode().catch(() => {}); } }), 700);
    // dir: +1 = next (new slide comes from the right, old one leaves to the left), −1 = previous
    const go = (i, dir, fromDrag) => {
      i = (i + n) % n; if (i === cur && fade) return;
      if (fade) {
        dir = (dir || 1) * DIR;
        sl.style.setProperty("--in", dir > 0 ? "42px" : "-42px"); sl.style.setProperty("--out", dir > 0 ? "-42px" : "42px");
        sl.style.setProperty("--wl", dir > 0 ? "100%" : "0%"); sl.style.setProperty("--wr", dir > 0 ? "0%" : "100%");
        sl.style.setProperty("--ry", dir > 0 ? "1" : "-1");
        if (wipe && !fromDrag) { const s = slides[i]; s.style.transition = "none"; s.style.clipPath = dir > 0 ? "inset(0 0 0 100%)" : "inset(0 100% 0 0)"; void s.offsetWidth; s.style.transition = ""; s.style.clipPath = ""; }
        const prev = slides[cur]; prev.classList.remove("on"); prev.classList.add("out"); setTimeout(() => prev.classList.remove("out"), outMs);
        slides[i].classList.remove("out"); slides[i].classList.add("on");
        cur = i; setDots(i);
      } else tr.scrollTo({ left: i * tr.clientWidth, behavior: "smooth" });
      t0 = performance.now(); if (bar) bar.style.transform = "scaleX(0)";
      dots.forEach((d) => { if (d.firstElementChild) d.firstElementChild.style.transform = "scaleX(0)"; });
    };
    if (!fade) tr.addEventListener("scroll", () => { const c = Math.round(tr.scrollLeft / tr.clientWidth); if (c !== cur) { cur = c; setDots(c); t0 = performance.now(); } }, { passive: true });
    sl.querySelector(".sl-prev").onclick = () => go(cur - 1, -1);
    sl.querySelector(".sl-next").onclick = () => go(cur + 1, 1);
    dots.forEach((d, k) => (d.onclick = () => go(k, k > cur ? 1 : -1)));
    // the slide follows the finger: drag right → left shows the next one fading in, let go to finish (or snap back)
    let drag = null, dragged = 0;
    const clearDrag = (x) => { if (x) { x.style.transform = ""; x.style.opacity = ""; x.style.visibility = ""; x.style.clipPath = ""; x.style.transition = ""; x.style.zIndex = ""; } };
    // touching it restarts the bottom fill from zero (it keeps running right after)
    sl.addEventListener("pointerdown", (e) => {
      if (!fade || e.button > 0 || e.target.closest(".sl-nav,.sl-dots")) return;
      drag = { x: e.clientX, y: e.clientY, dx: 0, axis: null, t: null, id: e.pointerId, W: 0, base: 0, raf: 0, vx: 0, lx: e.clientX, lt: performance.now() };
    });
    // the picture follows the finger; all style writes are batched into one animation frame (no layout reads inside), so it never stutters
    const paintDrag = () => {
      if (!drag || drag.axis !== "x") return;
      const d = drag, dx = d.dx, W = d.W; d.raf = 0;
      const p = Math.min(1, Math.abs(dx) / (W * 0.55)), nextIs = (dx < 0) === (DIR === 1), ti = nextIs ? (cur + 1) % n : (cur - 1 + n) % n;
      if (d.t != null && d.t !== ti) clearDrag(slides[d.t]);
      d.t = ti;
      const c = slides[cur], t = slides[ti];
      if (wipe) { // the curtain edge follows the finger
        const q = Math.min(1, Math.abs(dx) / W);
        sl.style.setProperty("--wl", dx < 0 ? "100%" : "0%"); sl.style.setProperty("--wr", dx < 0 ? "0%" : "100%");
        c.style.transform = `scale(${1 - q * 0.03})`;
        t.style.visibility = "visible"; t.style.opacity = "1"; t.style.zIndex = "3"; t.style.transition = "none";
        t.style.clipPath = dx < 0 ? `inset(0 0 0 ${(1 - q) * 100}%)` : `inset(0 ${(1 - q) * 100}% 0 0)`;
        return;
      }
      if (xfade) { // the photo under the finger fades away, the next one is already waiting behind it
        c.style.opacity = String(1 - Math.min(1, Math.abs(dx) / (W * 0.45))); t.style.visibility = "visible"; t.style.opacity = "1"; t.style.zIndex = "0"; return;
      }
      c.style.transform = `translate3d(${dx}px,0,0) scale(${1 - p * 0.04})`; c.style.opacity = String(1 - p * 0.85);
      t.style.visibility = "visible"; t.style.opacity = String(p);
      t.style.transform = `translate3d(${(dx < 0 ? 1 : -1) * (1 - p) * W * 0.2}px,0,0) scale(${1.06 - 0.06 * p})`;
    };
    sl.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx0 = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.axis) {
        if (Math.abs(dx0) < 8 && Math.abs(dy) < 8) return;
        drag.axis = Math.abs(dx0) > Math.abs(dy) ? "x" : "y";
        if (drag.axis === "x") { t0 = performance.now(); drag.W = sl.clientWidth || 1; drag.base = dx0 < 0 ? -8 : 8; sl.classList.add("dragging"); try { sl.setPointerCapture(e.pointerId); } catch {} }
      }
      if (drag.axis !== "x") return;
      drag.dx = dx0 - drag.base;                         // starts from 0, no jump when the drag begins
      { const nt = performance.now(), dt = nt - drag.lt; if (dt > 0) drag.vx = drag.vx * 0.5 + ((e.clientX - drag.lx) / dt) * 0.5; drag.lx = e.clientX; drag.lt = nt; }
      t0 = performance.now();                            // moving the picture restarts the fill
      if (!drag.raf) drag.raf = requestAnimationFrame(paintDrag);
    });
    const endDrag = () => {
      if (!drag) return;
      const d = drag; drag = null; cancelAnimationFrame(d.raf);
      if (d.axis !== "x") return;                         // a plain tap never touches the fill
      t0 = performance.now();
      dragged = Date.now();
      const c = slides[cur], t = d.t != null ? slides[d.t] : null, commit = t && (Math.abs(d.dx) > d.W * 0.12 || (Math.abs(d.dx) > 22 && Math.abs(d.vx) > 0.3 && Math.sign(d.vx) === Math.sign(d.dx)));
      sl.classList.remove("dragging");
      clearDrag(c); clearDrag(t); // CSS transitions take it from where the finger left it
      if (commit) { sl.classList.add("quick"); clearTimeout(sl._qt); sl._qt = setTimeout(() => sl.classList.remove("quick"), 520); go(d.t, (d.dx < 0) === (DIR === 1) ? 1 : -1, true); }
    };
    sl.addEventListener("pointerup", endDrag); sl.addEventListener("pointercancel", endDrag);
    sl.addEventListener("click", (e) => { if (Date.now() - dragged < 350) { e.preventDefault(); e.stopPropagation(); } }, true);
    // it NEVER stops: no pause on hover, click, touch, drag or scroll — the bottom fill keeps running and the slide flips on time.
    // (if the timer runs out while a finger is still dragging, the drag is cancelled and the next slide comes in)
    const tick = (now) => {
      if (!document.contains(sl)) return;
      const gap = now - last;
      if (document.hidden || gap > 400) t0 += gap; // the tab was asleep: don't skip ahead
      else {
        const p = (now - t0) / dur, f = fillOf(cur);
        if (bar) bar.style.transform = `scaleX(${Math.min(1, p)})`;
        if (f) f.style.transform = `scaleX(${Math.min(1, p)})`;
        if (p >= 1) {
          if (drag && drag.axis === "x") { const d = drag; drag = null; sl.classList.remove("dragging"); clearDrag(slides[cur]); if (d.t != null) clearDrag(slides[d.t]); dragged = Date.now(); }
          go(cur + (fade ? 1 : DIR), fade ? 1 : DIR);
        }
      }
      last = now; sliderRaf = requestAnimationFrame(tick);
    };
    sliderRaf = requestAnimationFrame(tick);
  }
  // «بالنص مع الجوانب»: one item centred on the screen, the one before and after peeking on both sides.
  // size, gap, side size, effect and shape all come from the dashboard; it loops forever and moves by itself.
  const CAR_FX = ["scale", "fade", "cover", "stack", "rise", "flat"], CAR_SH = ["theme", "round", "sharp", "float", "frame", "clean"];
  function carousel(sec, items, cls, o) {
    o = o || {};
    const n = items.length, num = (v, d, lo, hi) => { v = v === "" || v == null || isNaN(+v) ? d : +v; return Math.min(hi, Math.max(lo, v)); };
    const size = num(sec.cSize, o.size || 72, 40, 100), gap = num(sec.cGap, o.gap ?? 14, 0, 60), side = num(sec.cSide, 86, 50, 100);
    const fx = CAR_FX.includes(sec.cFx) ? sec.cFx : "scale", shape = CAR_SH.includes(sec.cShape) ? sec.cShape : "theme";
    const loop = n >= 3 && sec.cLoop !== false, auto = sec.auto === "off" ? 0 : num(sec.speed, o.speedDef || 4, 2, o.speedMax || 10);
    const dots = n > 1 && n <= (o.maxDots || 12) && sec.cDots !== false;
    const bg = sec.noBg ? "transparent" : /^#[0-9a-f]{6}$/i.test(sec.bg || "") ? sec.bg : "";
    const it = (h, i, clone) => `<div class="car-i" data-ci="${i}"${clone ? ' data-clone aria-hidden="true"' : ""}>${clone ? h.replace(/ fetchpriority="high"/, ' loading="lazy"').replace(/<(a|button)\b/g, '<$1 tabindex="-1"') : h}</div>`;
    const real = items.map((h, i) => it(h, i));
    const all = loop ? [...items.map((h, i) => it(h, i, 1)), ...real, ...items.map((h, i) => it(h, i, 1))] : real;
    return `<div class="car ${cls || ""} car-fx-${fx} car-sh-${shape}${sec.showNames === false ? " no-names" : ""}" data-car="${auto}"${loop ? " data-loop" : ""} style="--cs:${size};--cg:${gap}px;--side:${side / 100}${bg ? `;--cimg:${bg}` : ""}">` +
      `<div class="car-track"><div class="car-rail">${all.join("")}</div></div>` +
      (n > 1 ? `<button type="button" class="car-nav car-prev" aria-label="السابق">›</button><button type="button" class="car-nav car-next" aria-label="التالي">‹</button>` : "") +
      (dots ? `<div class="car-dots${o.fill ? " fill" : ""}">${items.map((_, i) => `<span data-cd="${i}"><i></i></span>`).join("")}</div>` : "") + `</div>`;
  }
  let carStops = [];
  // Carousel engine: no native scrolling at all. The finger moves one transform on the rail and every item's effect
  // (--d) is computed from the same number in the same frame, so the picture can never shake or lag behind the finger.
  function startCars() {
    carStops.forEach((f) => f()); carStops = [];
    const reduce = document.documentElement.classList.contains("reduce");
    app.querySelectorAll(".car").forEach((car) => {
      const tr = car.querySelector(".car-track"), rail = car.querySelector(".car-rail"); if (!tr || !rail) return;
      const its = [...rail.children], loop = car.hasAttribute("data-loop"), n = loop ? its.length / 3 : its.length;
      if (!n) return;
      const dots = [...car.querySelectorAll(".car-dots span")], fill = !!car.querySelector(".car-dots.fill"), autoMs = (+car.dataset.car || 0) * 1000;
      const always = car.classList.contains("car-hero");
      const rtl = getComputedStyle(rail).direction === "rtl", vs = rtl ? -1 : 1; // visual sign of "next"
      let step = 0, pos = loop ? n : 0, cur = -1, anim = null, drag = null, dragged = 0, dead = false, loopRaf = 0, frame = 0;
      let seen = !("IntersectionObserver" in window), hold = 0, t0 = performance.now(), last = t0;
      const dv = new Array(its.length);
      // the look of every item is computed here and written straight to its transform/opacity (GPU only).
      // No CSS variables per item → the browser never has to re-style the cards while they move.
      const fx = (car.className.match(/car-fx-(\w+)/) || [])[1] || "scale", side = parseFloat(getComputedStyle(car).getPropertyValue("--side")) || 0.86;
      const kids = its.map((el) => el.firstElementChild || el);
      const dims = new Array(its.length);
      const dimOf = (k) => { let x = dims[k]; if (!x) { x = document.createElement("i"); x.className = "car-dim"; kids[k].appendChild(x); dims[k] = x; } return x; };
      const look = (vd, ad) => {
        const c1 = Math.min(ad, 1), dc = Math.max(-1, Math.min(1, vd));
        let tf = "", op = 1, dm = 0, s;
        if (fx === "scale") { s = 1 - (1 - side) * c1; tf = `translate3d(${(-dc * (1 - s) * 50).toFixed(2)}%,0,0) scale(${s.toFixed(4)})`; dm = c1 * 0.2; }
        else if (fx === "fade") { s = 1 - c1 * 0.04; tf = `scale(${s.toFixed(4)})`; op = 1 - c1 * 0.62; }
        else if (fx === "cover") { s = 1 - (1 - side) * c1; tf = `translate3d(${(-dc * (1 - s) * 50).toFixed(2)}%,0,0) perspective(1000px) rotateY(${(-dc * 38).toFixed(2)}deg) scale(${s.toFixed(4)})`; dm = c1 * 0.28; }
        else if (fx === "stack") { const k = Math.min(ad, 1.6); s = Math.max(0.35, 1 - (1 - side) * 1.6 * k); tf = `translate3d(${(-vd * 40).toFixed(2)}%,${(k * 5).toFixed(1)}px,0) scale(${s.toFixed(4)})`; dm = Math.min(0.5, k * 0.22); op = ad > 2 ? Math.max(0, 1 - (ad - 2)) : 1; }
        else if (fx === "rise") { s = 1 - (1 - side) * c1; tf = `translate3d(${(-dc * (1 - s) * 50).toFixed(2)}%,${(c1 * 22).toFixed(1)}px,0) scale(${s.toFixed(4)})`; dm = c1 * 0.1; }
        else tf = "none";
        return { tf, op, dm };
      };
      const measure = () => { step = its.length > 1 ? Math.abs(its[1].getBoundingClientRect().left - its[0].getBoundingClientRect().left) : its[0].getBoundingClientRect().width; if (!step) step = its[0].offsetWidth || 1; };
      const wrap = () => { // stay inside the middle copy; the copies are identical, so the jump is invisible
        if (!loop) return 0;
        let k = 0; if (pos < n - 0.5) k = n; else if (pos >= 2 * n - 0.5) k = -n;
        if (k) { pos += k; if (anim) { anim.from += k; anim.to += k; } if (drag) drag.p0 += k; }
        return k;
      };
      const paint = () => {
        frame = 0; if (dead) return;
        if (!step) measure();
        rail.style.transform = `translate3d(${-vs * pos * step}px,0,0)`;
        const c = Math.round(pos), from = Math.max(0, c - 4), to = Math.min(its.length - 1, c + 4);
        for (let k = 0; k < its.length; k++) {
          const d = k < from || k > to ? (k < c ? -3 : 3) : Math.max(-3, Math.min(3, k - pos));
          const q = Math.round(d * 500); if (dv[k] === q) continue; dv[k] = q;
          const vd = d * vs, ad = Math.abs(d), L = look(vd, ad), ks = kids[k].style;
          ks.transform = L.tf; ks.opacity = L.op === 1 ? "" : L.op.toFixed(3);
          if (L.dm > 0.005 || dims[k]) dimOf(k).style.opacity = L.dm.toFixed(3);
          its[k].style.zIndex = String(20 - Math.round(ad * 2));
        }
        const best = Math.max(0, Math.min(its.length - 1, c));
        if (best !== cur) {
          if (its[cur]) its[cur].classList.remove("on");
          its[best].classList.add("on"); cur = best;
          const ci = +its[best].dataset.ci; dots.forEach((dd, k) => { dd.classList.toggle("on", k === ci); if (dd.firstElementChild) dd.firstElementChild.style.transform = "scaleX(0)"; });
        }
      };
      const queue = () => { if (!frame) frame = requestAnimationFrame(paint); };
      const ease = (t) => 1 - Math.pow(1 - t, 3);
      const animTo = (target, ms) => {
        if (!loop) target = Math.max(0, Math.min(n - 1, target));
        if (reduce) { pos = target; wrap(); queue(); return; }
        anim = { from: pos, to: target, t: performance.now(), ms: ms || Math.min(650, 320 + Math.abs(target - pos) * 140) };
        const run = (now) => {
          if (!anim || dead) return;
          const k = Math.min(1, (now - anim.t) / anim.ms); pos = anim.from + (anim.to - anim.from) * ease(k); wrap(); paint();
          if (k < 1) anim.raf = requestAnimationFrame(run); else anim = null;
        };
        anim.raf = requestAnimationFrame(run);
      };
      const stopAnim = () => { if (anim) { cancelAnimationFrame(anim.raf); anim = null; } };
      const go = (dir, k) => { const base = anim ? anim.to : Math.round(pos); animTo(k != null ? k : base + dir); t0 = performance.now(); };
      // finger / mouse
      tr.addEventListener("pointerdown", (e) => {
        if (e.button > 0 || e.target.closest(".car-nav,.car-dots")) return;
        stopAnim(); if (!step) measure();
        drag = { x: e.clientX, y: e.clientY, p0: pos, axis: null, id: e.pointerId, v: 0, lx: e.clientX, lt: performance.now() };
        hold = performance.now() + 1200;
      });
      tr.addEventListener("pointermove", (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (!drag.axis) {
          if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
          drag.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
          if (drag.axis === "y") { drag = null; return; }
          drag.x = e.clientX; drag.p0 = pos; car.classList.add("dragging"); try { tr.setPointerCapture(e.pointerId); } catch {}
          t0 = performance.now();
        }
        const nt = performance.now(), dt = nt - drag.lt;
        if (dt > 0) drag.v = drag.v * 0.4 + ((e.clientX - drag.lx) / dt) * 0.6;
        drag.lx = e.clientX; drag.lt = nt;
        let p = drag.p0 - (vs * (e.clientX - drag.x)) / step;
        if (!loop) { if (p < 0) p *= 0.35; else if (p > n - 1) p = n - 1 + (p - (n - 1)) * 0.35; }
        pos = p; wrap(); queue(); hold = performance.now() + 1200; t0 = performance.now();
      });
      const end = (e) => {
        if (!drag || (e && e.pointerId !== drag.id)) return;
        const d = drag; drag = null; car.classList.remove("dragging");
        if (d.axis !== "x") return;
        dragged = Date.now();
        const vItems = (-vs * d.v * 1) / step * 1000;            // items per second, in "next" direction
        let target = Math.round(pos + Math.max(-3, Math.min(3, vItems * 0.18)));
        if (target === Math.round(d.p0) && Math.abs(pos - d.p0) > 0.12) target += pos > d.p0 ? 1 : -1; // a short decisive swipe still moves one
        animTo(target, Math.min(520, Math.max(260, Math.abs(target - pos) * 260)));
        hold = performance.now() + 1200; t0 = performance.now();
      };
      tr.addEventListener("pointerup", end); tr.addEventListener("pointercancel", end);
      // phones hand the touch to the picture under the finger first; moving it to the track fires a "lost capture" on that picture — ignore those
      tr.addEventListener("lostpointercapture", (e) => { if (e.target === tr) end(e); });
      tr.addEventListener("click", (e) => { if (Date.now() - dragged < 350) { e.preventDefault(); e.stopPropagation(); } }, true);
      tr.addEventListener("dragstart", (e) => e.preventDefault());
      // trackpad / mouse wheel sideways
      let wheelT = 0;
      tr.addEventListener("wheel", (e) => {
        if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
        e.preventDefault(); stopAnim(); if (!step) measure();
        pos += (vs * e.deltaX) / step; wrap(); queue(); hold = performance.now() + 1500;
        clearTimeout(wheelT); wheelT = setTimeout(() => animTo(Math.round(pos), 300), 120);
      }, { passive: false });
      const prev = car.querySelector(".car-prev"), next = car.querySelector(".car-next");
      if (prev) prev.onclick = () => { go(-1); hold = performance.now() + 2500; };
      if (next) next.onclick = () => { go(1); hold = performance.now() + 2500; };
      dots.forEach((d, k) => (d.onclick = () => { go(0, loop ? n + k : k); hold = performance.now() + 2500; }));
      measure(); paint();
      const io = "IntersectionObserver" in window && new IntersectionObserver(([en]) => { seen = en.isIntersecting; }, { threshold: 0.35 });
      if (io) io.observe(car);
      const ro = "ResizeObserver" in window && new ResizeObserver(() => { step = 0; dv.fill(undefined); queue(); });
      if (ro) ro.observe(tr);
      const tick = (now) => {
        if (dead || !document.contains(car)) return;
        const gap = now - last;
        if (document.hidden || (!seen && !always) || drag || (!always && now < hold) || gap > 400) t0 += gap;
        else {
          const p = (now - t0) / autoMs;
          if (fill && cur >= 0) { const f = dots[+its[cur].dataset.ci]; if (f && f.firstElementChild) f.firstElementChild.style.transform = `scaleX(${Math.min(1, p)})`; }
          if (p >= 1) go(always ? dirSign() : rowSign());
        }
        last = now; loopRaf = requestAnimationFrame(tick);
      };
      if (autoMs && !reduce && n > 1) loopRaf = requestAnimationFrame(tick);
      carStops.push(() => { dead = true; stopAnim(); cancelAnimationFrame(loopRaf); cancelAnimationFrame(frame); if (io) io.disconnect(); if (ro) ro.disconnect(); });
    });
  }
  // «واحد بالنص»: one item in the middle, changing with a fade (right → left)
  function spot(sec, items, cls) {
    const sz = Math.min(100, Math.max(30, +sec.size || 70)), sp = Math.min(10, Math.max(2, +sec.speed || 4));
    const bg = sec.noBg ? "transparent" : /^#[0-9a-f]{6}$/i.test(sec.bg || "") ? sec.bg : "";
    return `<div class="spot ${cls || ""}${sec.showNames === false ? " no-names" : ""}" data-spot="${sec.auto === "off" ? 0 : sp}" style="--sz:${sz}${bg ? `;--cimg:${bg}` : ""}">${items.map((h, i) => `<div class="spot-i${i ? "" : " on"}">${h}</div>`).join("")}
      ${items.length > 10 ? `<div class="spot-dots spot-count"><button type="button" data-sp-step="-1" aria-label="السابق">›</button><b data-sp-n>1</b> / ${items.length}<button type="button" data-sp-step="1" aria-label="التالي">‹</button></div>`
        : items.length > 1 ? `<div class="spot-dots">${items.map((_, i) => `<span data-sd="${i}" class="${i ? "" : "on"}"></span>`).join("")}</div>` : ""}</div>`;
  }
  let spotTimers = [];
  function startSpots() {
    spotTimers.forEach(clearInterval); spotTimers = [];
    app.querySelectorAll(".spot").forEach((sp) => {
      const its = [...sp.querySelectorAll(":scope > .spot-i")], dots = sp.querySelectorAll(".spot-dots span"), n = its.length; if (n < 2) return;
      let cur = 0, hold = 0;
      const go = (i) => {
        i = (i + n) % n; if (i === cur) return;
        const prev = its[cur]; prev.classList.remove("on"); prev.classList.add("out"); setTimeout(() => prev.classList.remove("out"), 900);
        its[i].classList.remove("out"); its[i].classList.add("on"); cur = i;
        dots.forEach((d, k) => d.classList.toggle("on", k === i));
        const nb = sp.querySelector("[data-sp-n]"); if (nb) nb.textContent = i + 1;
      };
      sp.querySelectorAll("[data-sp-step]").forEach((b) => (b.onclick = () => { go(cur + +b.dataset.spStep); hold = Date.now() + 1500; }));
      dots.forEach((d, k) => (d.onclick = () => { go(k); hold = Date.now() + 1500; }));
      let sx = null;
      sp.addEventListener("pointerdown", (e) => { sx = e.clientX; hold = Date.now() + 2500; }, { passive: true });
      sp.addEventListener("pointerup", (e) => { if (sx == null) return; const dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 40) go(dx < 0 ? cur + 1 : cur - 1); }, { passive: true });
      const secs = +sp.dataset.spot; if (!secs) return;
      const t = setInterval(() => { if (!document.contains(sp)) { clearInterval(t); return; } if (!document.hidden && Date.now() > hold) go(cur + dirSign()); }, secs * 1000);
      spotTimers.push(t);
    });
  }

  // ---------- bottom sheet (filter, sort, write a review) ----------
  function openSheet(title, html, bind) {
    closeSheet();
    const w = document.createElement("div");
    w.className = "sheet-wrap"; w.setAttribute("data-sheet", "");
    w.innerHTML = `<div class="sheet" role="dialog" aria-label="${esc(title)}"><div class="sheet-head"><b>${esc(title)}</b><button type="button" class="icon-btn" data-sheet-x aria-label="إغلاق">✕</button></div><div class="sheet-body">${html}</div></div>`;
    document.body.appendChild(w);
    requestAnimationFrame(() => w.classList.add("open"));
    w.addEventListener("click", (e) => { if (e.target === w || e.target.closest("[data-sheet-x]")) closeSheet(); });
    if (bind) bind(w.querySelector(".sheet-body"));
  }
  function closeSheet() { document.querySelectorAll("[data-sheet]").forEach((x) => x.remove()); }

  function listing({ title, crumbs, items, key, desc, seoTitle, seoDesc }) {
    if (seoTitle) document.title = seoTitle;
    const md = document.querySelector('meta[name="description"]'); if (md) md.content = seoDesc || desc || C.seoDescription || "";
    const st = listing.state[key] || (listing.state[key] = { sort: "default", hideOut: false, shown: PAGE, sub: "", min: "", max: "" });
    const draw = () => {
      let list = items.slice();
      if (st.sub) list = list.filter((p) => inCat(p, st.sub));
      if (st.hideOut) list = list.filter((p) => p.inStock);
      if (st.min !== "") list = list.filter((p) => p.price >= +st.min);
      if (st.max !== "") list = list.filter((p) => p.price <= +st.max);
      if (st.sort === "low") list.sort((a, b) => a.price - b.price);
      else if (st.sort === "name") list.sort((a, b) => a.name.localeCompare(b.name, "ar"));
      else if (st.sort === "high") list.sort((a, b) => b.price - a.price);
      list.sort(sortStock);
      const subs = key.startsWith("g:") ? C.groups.find((g) => "g:" + g.name === key)?.cats.filter((c) => cats.some((x) => x.name === c)) : null;
      const nf = (st.hideOut ? 1 : 0) + (st.sub ? 1 : 0) + (st.min !== "" || st.max !== "" ? 1 : 0);
      const topCats = key === "all" ? `<div class="all-cats">${cats.filter((c) => c.count).map((c) => `<a class="ac" href="${cHref(c.name)}"><span class="ac-img">${c.image ? `<img src="${esc(img(c.image))}" alt="" loading="lazy">` : ""}</span><b>${esc(catLabel(c.name))}</b></a>`).join("")}</div>` : "";
      if (LAY.list === "store") app.innerHTML = `<div class="list-hero"><h1>${esc(title)}</h1>${desc ? `<p>${esc(desc)}</p>` : ""}</div>${topCats}
        <div class="list-bar"><button type="button" data-open-filter>${ICON.filter}<span>تصفية${nf ? ` (${nf})` : ""}</span></button><i></i><button type="button" data-open-sort>${ICON.sort}<span>ترتيب</span></button></div>
        ${list.length ? `<div class="grid">${list.slice(0, st.shown).map(card).join("")}</div>` : `<div class="empty"><b>ما في منتجات هون</b>جرّب تغيّر التصفية أو ابحث باسم المنتج.</div>`}
        ${list.length > st.shown ? `<button class="more" data-more>عرض المزيد (${list.length - st.shown})</button>` : ""}`;
      else app.innerHTML = `<div class="crumbs">${crumbs}</div><h1 class="page-title">${esc(title)}</h1>${desc ? `<p class="list-desc">${esc(desc)}</p>` : ""}${topCats}
        ${subs ? `<div class="chips" style="margin-bottom:10px"><button class="chip${st.sub ? "" : " on"}" data-sub="">الكل</button>${subs.map((c) => `<button class="chip${st.sub === c ? " on" : ""}" data-sub="${esc(c)}">${esc(catLabel(c))}</button>`).join("")}</div>` : ""}
        <div class="toolbar">
          <label class="check"><input type="checkbox" data-hideout ${st.hideOut ? "checked" : ""}> المتوفر بس</label>
          <select data-sort aria-label="ترتيب">
            <option value="default">الترتيب الافتراضي</option>
            <option value="low" ${st.sort === "low" ? "selected" : ""}>السعر: من الأرخص</option>
            <option value="high" ${st.sort === "high" ? "selected" : ""}>السعر: من الأغلى</option>
          </select>
        </div>
        ${list.length ? `<div class="grid">${list.slice(0, st.shown).map(card).join("")}</div>` : `<div class="empty"><b>ما في منتجات هون</b>جرّب قسم تاني أو ابحث باسم المنتج.</div>`}
        ${list.length > st.shown ? `<button class="more" data-more>عرض المزيد (${list.length - st.shown})</button>` : ""}`;
      // endless scroll: the next products load by themselves as the customer reaches the end of the list
      const grid = app.querySelector(".grid"), more = app.querySelector("[data-more]");
      const loadMore = () => {
        if (!grid || !document.contains(grid) || st.shown >= list.length) return;
        grid.insertAdjacentHTML("beforeend", list.slice(st.shown, st.shown + PAGE).map(card).join(""));
        st.shown += PAGE;
        const btn = app.querySelector("[data-more]");
        if (btn) { if (st.shown >= list.length) btn.remove(); else btn.textContent = `عرض المزيد (${list.length - st.shown})`; }
      };
      if (more && "IntersectionObserver" in window) {
        more.classList.add("auto");
        const io2 = new IntersectionObserver((es) => { if (es[0].isIntersecting) { loadMore(); if (st.shown >= list.length) io2.disconnect(); } }, { rootMargin: "0px 0px 900px 0px" });
        io2.observe(more);
      }
      app.onclick = (e) => {
        if (e.target.closest("[data-open-sort]")) {
          openSheet("ترتيب", `<div class="sh-opts">${[["default", "الترتيب الافتراضي"], ["low", "السعر: من الأقل للأعلى"], ["high", "السعر: من الأعلى للأقل"], ["name", "الاسم: أ - ي"]].map(([v, t]) => `<label class="sh-opt"><input type="radio" name="sort" value="${v}" ${st.sort === v ? "checked" : ""}><span>${t}</span></label>`).join("")}</div>`,
            (box) => { box.addEventListener("change", () => { st.sort = box.querySelector("[name=sort]:checked").value; closeSheet(); draw(); }); });
          return;
        }
        if (e.target.closest("[data-open-filter]")) {
          const subs2 = subs || [];
          openSheet("تصفية", `<label class="sh-switch"><span>المتوفر بس</span><input type="checkbox" data-f-out ${st.hideOut ? "checked" : ""}></label>
            ${subs2.length ? `<div class="sh-lbl">القسم</div><div class="chips"><button type="button" class="chip${st.sub ? "" : " on"}" data-f-sub="">الكل</button>${subs2.map((c) => `<button type="button" class="chip${st.sub === c ? " on" : ""}" data-f-sub="${esc(c)}">${esc(catLabel(c))}</button>`).join("")}</div>` : ""}
            <div class="sh-lbl">السعر</div><div class="sh-price"><input type="number" inputmode="decimal" min="0" placeholder="من" data-f-min value="${esc(st.min)}"><span>—</span><input type="number" inputmode="decimal" min="0" placeholder="لـ" data-f-max value="${esc(st.max)}"></div>
            <div class="sh-btns"><button type="button" class="btn btn-dark" data-f-apply>عرض النتائج</button><button type="button" class="btn btn-ghost" data-f-clear>مسح الكل</button></div>`,
            (box) => {
              let sub = st.sub;
              box.addEventListener("click", (ev) => {
                const c = ev.target.closest("[data-f-sub]");
                if (c) { sub = c.dataset.fSub; box.querySelectorAll("[data-f-sub]").forEach((x) => x.classList.toggle("on", x === c)); }
                if (ev.target.closest("[data-f-clear]")) { Object.assign(st, { hideOut: false, sub: "", min: "", max: "", shown: PAGE }); closeSheet(); draw(); }
                if (ev.target.closest("[data-f-apply]")) {
                  Object.assign(st, { hideOut: box.querySelector("[data-f-out]").checked, sub, min: box.querySelector("[data-f-min]").value.trim(), max: box.querySelector("[data-f-max]").value.trim(), shown: PAGE });
                  closeSheet(); draw();
                }
              });
            });
          return;
        }
        if (e.target.closest("[data-more]")) loadMore();
        const s = e.target.closest("[data-sub]");
        if (s) { st.sub = s.dataset.sub; st.shown = PAGE; draw(); }
      };
      app.onchange = (e) => {
        if (e.target.matches("[data-sort]")) { st.sort = e.target.value; draw(); }
        if (e.target.matches("[data-hideout]")) { st.hideOut = e.target.checked; st.shown = PAGE; draw(); }
      };
    };
    draw();
  }
  listing.state = {};

  // «## title» lines and «- item» lines → readable sections
  function detailsH(t) {
    let h = "", open = false;
    for (const raw of String(t || "").split("\n")) {
      const l = raw.trim(); if (!l) continue;
      if (/^#{1,3}\s*/.test(l)) { if (open) { h += "</ul>"; open = false; } h += `<h4 class="dt-h">${esc(l.replace(/^#{1,3}\s*/, ""))}</h4>`; }
      else if (/^[-•*]\s*/.test(l)) { if (!open) { h += '<ul class="dt-l">'; open = true; } h += `<li>${esc(l.replace(/^[-•*]\s*/, ""))}</li>`; }
      else { if (open) { h += "</ul>"; open = false; } h += `<p>${esc(l)}</p>`; }
    }
    return `<div class="details">${h}${open ? "</ul>" : ""}</div>`;
  }
  function product(id) {
    const p = byId.get(id);
    if (!p) { app.innerHTML = `<div class="empty"><b>المنتج مو موجود</b><a href="#/">رجوع للرئيسية</a></div>`; return; }
    document.title = `${p.name} | ${C.name}`;
    const g = groupOf(p.category);
    let opt = "", qty = 1;
    const related = products.filter((x) => x.id !== p.id && x.inStock && inCat(x, p.category)).slice(0, 10);
    { const rc = store.get("ko_recent", []).filter((i) => i !== p.id); rc.unshift(p.id); store.set("ko_recent", rc.slice(0, 12)); }
    const pics = (p.images && p.images.length ? p.images : [p.image]).filter(Boolean);
    const PG = pgOf(S.design), PGX = PG.fx !== "slide" && pics.length > 1;
    const waText = encodeURIComponent(`مرحبا، بدي استفسر عن: ${p.name}\n${location.href}`);
    const ST2 = LAY.pdp === "store", revOn = S.design.reviews !== false;
    const num = (n) => (LAY.price === "arabic" ? Number(n).toLocaleString("ar-SY") : String(n));
    const rateTxt = (rt, rc) => (rc ? `${num(rt)}/${num(5)} - ${num(rc)} ${rc === 1 ? "تقييم" : "تقييمات"}` : `${num(0)}/${num(5)} - لا توجد تقييمات`);
    const crumbsH = ST2 ? `<nav class="crumbs pcrumbs"><a href="#/all">متجر</a>${ICON.chev}<a href="${cHref(p.category)}">${esc(catLabel(p.category))}</a></nav>`
      : `<div class="crumbs"><a href="#/">الرئيسية</a> / ${g ? `<a href="#/g/${encodeURIComponent(g.name)}">${esc(g.name)}</a> / ` : ""}<a href="${cHref(p.category)}">${esc(catLabel(p.category))}</a></div>`;
    const qtyH = `<div class="qty"><button data-q="1" aria-label="زيادة">+</button><input data-qty value="1" inputmode="numeric" aria-label="الكمية"><button data-q="-1" aria-label="إنقاص">−</button></div>`;
    const optsH = (p.options || []).length ? `<div class="opt-label">اختار: <span data-optname style="color:var(--muted);font-weight:400"></span></div>
            <div class="opts">${p.options.map((o) => `<button class="opt" data-opt="${esc(o)}">${esc(o)}</button>`).join("")}</div>` : "";
    const waBtn = `<a class="btn btn-wa" target="_blank" rel="noopener" href="https://wa.me/${C.whatsapp}?text=${waText}">اسأل على واتساب</a>`;
    const soldOut = `<div class="buy-row"><a class="btn btn-wa" target="_blank" rel="noopener" href="https://wa.me/${C.whatsapp}?text=${encodeURIComponent(`مرحبا، إيمتى بيرجع يتوفر: ${p.name}؟\n${location.href}`)}">خبّرني لما يتوفر</a></div>`;
    const infoStore = `<h1>${esc(p.name)}</h1>
          ${revOn ? `<div class="rate-line">${stars(p.rt)}<span data-rate-txt>${rateTxt(p.rt, p.rc)}</span></div>` : ""}
          <div class="pprice">${p.inStock ? offH(p) : ""}<span class="price">${priceH(p)}</span>${p.inStock ? "" : '<em class="sold-out">خالص</em>'}</div>
          ${optsH}
          ${p.inStock ? `<div class="buy-line" data-buyline>${qtyH}<button class="btn btn-black" data-buy>${ICON.cart}<span>أضف إلى السلّة</span></button></div>
            ${S.design.buyNow ? '<button class="btn btn-outline wide" data-buy data-now>اشتري الآن</button>' : ""}
            <a class="wa-link" target="_blank" rel="noopener" href="https://wa.me/${C.whatsapp}?text=${waText}">💬 عندك سؤال؟ راسلنا على واتساب</a>` : soldOut}
          <div class="ptabs" data-ptabs><div class="ptab-heads"><button type="button" class="on" data-ptab-btn="d">وصف المنتج</button><button type="button" data-ptab-btn="s" hidden>المواصفات</button><button type="button" data-ptab-btn="t" hidden>التفاصيل</button></div>
            <div class="ptab" data-ptab="d"><p>${esc(p.name)}</p></div><div class="ptab" data-ptab="s" hidden></div><div class="ptab" data-ptab="t" hidden></div></div>`;
    const reviewsH = revOn ? `<section class="reviews" data-reviews>
        <h2 class="rv-title">التقييمات</h2>
        <div class="rv-mini"><div class="rv-avg"><b data-rv-avg>${num(p.rt || 0)}</b>${stars(p.rt)}<small data-rv-count>${p.rc ? `${num(p.rc)} ${p.rc === 1 ? "تقييم" : "تقييمات"}` : "لسا ما في تقييمات"}</small></div>
          <details class="rv-dist"><summary>التفاصيل</summary><div class="rv-bars" data-rv-bars>${[5, 4, 3, 2, 1].map((i) => `<div><span>${num(i)}</span><i><em></em></i><span>${num(0)}</span></div>`).join("")}</div></details></div>
        <form class="rv-write" data-rv-form data-pid="${esc(p.id)}" novalidate><b class="rv-wt">✎ اكتب رأيك</b>
          <div class="rv-pick" data-rv-pick>${[1, 2, 3, 4, 5].map((i) => `<button type="button" class="on" data-r="${i}" aria-label="${i} نجوم">★</button>`).join("")}</div>
          <input data-rv-name maxlength="40" placeholder="اسمك" value="${esc(((store.get("ko_customer", {}) || {}).name || "").split(" ")[0])}">
          <textarea data-rv-text maxlength="600" rows="2" placeholder="شو رأيك بالمنتج؟ كيف الجودة والمقاس؟"></textarea>
          <div class="rv-wf"><p class="rv-msg" data-rv-msg></p><button type="submit" class="btn btn-dark" data-rv-send>إرسال</button></div></form>
        <div class="rv-list" data-rv-list><p class="rv-empty">لا توجد تقييمات لك بعد!</p></div></section>` : "";
    const relatedH = !related.length ? "" : ST2
      ? `<div class="sec-head rel"><h2>منتجات مشابهة</h2><a href="#/all">شاهد جميع المنتجات</a></div><div class="grid">${related.slice(0, 8).map(card).join("")}</div>`
      : `<div class="sec-head"><h2>منتجات مشابهة</h2><a href="${cHref(p.category)}">عرض القسم ←</a></div><div class="row">${related.map(card).join("")}</div>`;
    app.innerHTML = `${crumbsH}
      <div class="pdp">
        <div class="pdp-media">${(() => {
          const stamp = p.inStock ? "" : '<span class="out-stamp big">خالص</span>';
          if (!pics.length) return `<div class="gal-wrap"><div class="pdp-img"><img src="${esc(img(""))}" alt=""></div>${stamp}</div>`;
          const many = pics.length > 1;
          return `<div class="gal-wrap">
              ${PGX ? `<div class="pdp-img gallery pg-fx pg-${PG.fx}" data-gallery dir="ltr">${pics.map((u, i) => `<img data-zoom="${i}" src="${esc(imgW(u, 1080))}"${imgSet(u, PDP_W, PDP_SIZES)} alt="${esc(p.name)} ${i + 1}" ${i ? 'loading="lazy" decoding="async" fetchpriority="low"' : 'fetchpriority="high" data-nofx class="cur"'} draggable="false">`).join("")}</div>`
              : `<div class="pdp-img gallery" data-gallery dir="ltr">${(many ? [0, ...[...pics.keys()].reverse(), pics.length - 1] : [0]).map((i, k) => `<img data-zoom="${i}" src="${esc(imgW(pics[i], 1080))}"${imgSet(pics[i], PDP_W, PDP_SIZES)} alt="${esc(p.name)} ${i + 1}" ${k === (many ? pics.length : 0) ? 'fetchpriority="high" data-nofx' : 'loading="lazy" decoding="async" fetchpriority="low"'} draggable="false">`).join("")}</div>`}
              ${many ? `<span class="gal-count" data-gcount>1/${pics.length}</span><div class="dots" data-dots>${pics.map((_, i) => `<span class="${i ? "" : "on"}"></span>`).join("")}</div>` : ""}
              <span class="zoom-hint" aria-hidden="true">🔍</span>${stamp}
              ${many && PG.arrows ? `<button type="button" class="gal-arrow next" data-gnav="1" aria-label="الصورة التالية">${ICON.chev}</button><button type="button" class="gal-arrow prev" data-gnav="-1" aria-label="الصورة السابقة">${ICON.chev}</button>` : ""}
            </div>
            ${many ? `<div class="pdp-thumbs" dir="ltr">${pics.map((u, i) => `<button class="${i ? "" : "on"}" data-pic="${i}" aria-label="صورة ${i + 1}"><img src="${esc(imgW((p.thumbs && p.thumbs[i]) || (i ? u : img(p.thumb || u)), 160))}" alt="" loading="lazy" decoding="async" fetchpriority="low"></button>`).join("")}</div>` : ""}`;
        })()}</div>
        <div class="pdp-info">${ST2 ? infoStore : `
          <h1>${esc(p.name)}</h1>
          ${revOn && p.rc ? `<div class="rate-line">${stars(p.rt)}<span data-rate-txt>${rateTxt(p.rt, p.rc)}</span></div>` : ""}
          <div><span class="price">${priceH(p)}</span>
          ${p.inStock ? `${offH(p)}<span class="stock in">● متوفر</span>` : '<em class="sold-out">خالص</em>'}</div>
          ${(p.options || []).length ? `<div class="opt-label">اختار: <span data-optname style="color:var(--muted);font-weight:400"></span></div>
            <div class="opts">${p.options.map((o) => `<button class="opt" data-opt="${esc(o)}">${esc(o)}</button>`).join("")}</div>` : ""}
          ${p.inStock ? `<div class="opt-label">الكمية</div>
          <div class="qty"><button data-q="1" aria-label="زيادة">+</button><input data-qty value="1" inputmode="numeric" aria-label="الكمية"><button data-q="-1" aria-label="إنقاص">−</button></div>
          <div class="buy-row"><button class="btn btn-red" data-buy>أضف للسلة</button>${S.design.buyNow ? '<button class="btn btn-dark" data-buy data-now>اشتري الآن</button>' : ""}<a class="btn btn-wa" target="_blank" rel="noopener" href="https://wa.me/${C.whatsapp}?text=${waText}">اسأل على واتساب</a></div>`
          : `<div class="buy-row"><a class="btn btn-wa" target="_blank" rel="noopener" href="https://wa.me/${C.whatsapp}?text=${encodeURIComponent(`مرحبا، إيمتى بيرجع يتوفر: ${p.name}؟\n${location.href}`)}">خبّرني لما يتوفر</a></div>`}
          <div class="pdp-desc" data-desc hidden></div>
          <div class="info-list">
            <div>🚚 داخل دمشق توصيل لباب البيت، وباقي المحافظات شحن عن طريق القدموس</div>
            <div>💬 أي سؤال؟ راسلنا على واتساب</div>
          </div>
          ${(p.sports || []).length ? `<div class="tags">${p.sports.map((s) => `<span>${esc(s)}</span>`).join("")}</div>` : ""}`}
        </div>
      </div>
      ${reviewsH}
      ${relatedH}`;
    fetch("/api/product-info?id=" + encodeURIComponent(p.id)).then((r) => (r.ok ? r.json() : null)).then((info) => {
      if (ST2) {
        if (!info) return;
        const d = app.querySelector('[data-ptab="d"]'), sp = app.querySelector('[data-ptab="s"]');
        if (d && info.description) d.innerHTML = `<p>${esc(info.description)}</p>`;
        if (sp && (info.specs || []).length) { sp.innerHTML = `<table class="specs">${info.specs.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</table>`; app.querySelector('[data-ptab-btn="s"]').hidden = false; }
        const tt = app.querySelector('[data-ptab="t"]'); if (tt && info.details) { tt.innerHTML = detailsH(info.details); app.querySelector('[data-ptab-btn="t"]').hidden = false; }
        return;
      }
      const box = app.querySelector("[data-desc]");
      if (!box || !info || (!info.description && !(info.specs || []).length)) return;
      box.innerHTML = `${info.description ? `<h3>الوصف</h3><p>${esc(info.description)}</p>` : ""}
        ${(info.specs || []).length ? `<h3>المواصفات</h3><table class="specs">${info.specs.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</table>` : ""}
        ${info.details ? `<h3>التفاصيل</h3>${detailsH(info.details)}` : ""}`;
      box.hidden = false;
    }).catch(() => {});
    const gal = app.querySelector("[data-gallery]");
    // magnifier on mouse hover (computer only) when chosen in the dashboard; click still opens the full-screen viewer
    if (S.design.zoomMode === "hover" && matchMedia("(hover:hover) and (pointer:fine)").matches) {
      app.querySelectorAll(".pdp-img img").forEach((im) => {
        im.addEventListener("mousemove", (e) => { const r = im.getBoundingClientRect(); im.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`; im.classList.add("hz"); });
        im.addEventListener("mouseleave", () => im.classList.remove("hz"));
      });
    }
    // endless carousel: a copy of the last photo sits before the first and a copy of the first after the last,
    // so swiping either way never stops; when we land on a copy we jump silently to the real photo.
    const many = pics.length > 1, W = () => gal.clientWidth;
    const realIdx = (slot) => (slot - 1 + pics.length) % pics.length;
    // slots are laid out right → left (the next photo comes in from the left and the strip moves to the right)
    const goSlot = (slot, smooth) => gal.scrollTo({ left: (pics.length + 1 - slot) * W(), behavior: smooth ? "smooth" : "instant" });
    const slotNow = () => pics.length + 1 - Math.round(gal.scrollLeft / W());
    if (gal && many && !PGX) requestAnimationFrame(() => goSlot(1, false));
    // effect mode (fade / zoom / flip / cube / blur / push): photos stacked, one shown, the chosen animation between them
    let fxCur = 0, fxBusy = false;
    const fxShow = (i, dir) => {
      if (!gal || !PGX) return;
      i = (i + pics.length) % pics.length; if (i === fxCur || fxBusy) return;
      const ims = gal.querySelectorAll("img"), a0 = ims[fxCur], a1 = ims[i];
      dir = dir || (i > fxCur ? 1 : -1); gal.dataset.dir = dir > 0 ? "n" : "p";
      fxBusy = true; a1.loading = "eager";
      a0.classList.remove("cur", "in"); a0.classList.add("out"); a1.classList.remove("out"); a1.classList.add("cur", "in");
      fxCur = i; setActive(i);
      setTimeout(() => { a0.classList.remove("out"); a1.classList.remove("in"); fxBusy = false; }, PG.ms + 30);
    };
    if (gal && PGX) {
      let x0 = null, y0 = 0;
      gal.addEventListener("pointerdown", (e) => { x0 = e.clientX; y0 = e.clientY; });
      gal.addEventListener("pointerup", (e) => { if (x0 == null) return; const dx = e.clientX - x0, dy = e.clientY - y0; x0 = null; if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { gal.dataset.swiped = "1"; setTimeout(() => delete gal.dataset.swiped, 50); fxShow(fxCur + (dx > 0 ? 1 : -1), dx > 0 ? 1 : -1); } });
      gal.addEventListener("pointercancel", () => (x0 = null));
    }
    // autoplay (stops while the visitor touches the photos)
    if (gal && many && PG.auto) {
      let hold = false; const t = setInterval(() => {
        if (!document.contains(gal)) return clearInterval(t);
        if (hold || document.hidden) return;
        if (PGX) fxShow(fxCur + 1, 1); else goSlot(slotNow() + 1, true);
      }, PG.speed * 1000);
      gal.addEventListener("pointerdown", () => (hold = true)); gal.addEventListener("pointerup", () => setTimeout(() => (hold = false), 4000));
      gal.addEventListener("mouseenter", () => (hold = true)); gal.addEventListener("mouseleave", () => (hold = false));
    }
    const setActive = (i) => {
      app.querySelectorAll("[data-pic]").forEach((b) => b.classList.toggle("on", +b.dataset.pic === i));
      app.querySelectorAll("[data-dots] span").forEach((d, k) => d.classList.toggle("on", k === i));
      const c = app.querySelector("[data-gcount]"); if (c) c.textContent = `${i + 1}/${pics.length}`;
    };
    if (gal && many && !PGX) {
      let settle;
      gal.addEventListener("scroll", () => {
        const slot = slotNow();
        setActive(realIdx(slot));
        clearTimeout(settle);
        settle = setTimeout(() => {
          const s2 = slotNow();
          if (s2 === 0) goSlot(pics.length, false);
          else if (s2 === pics.length + 1) goSlot(1, false);
        }, 120);
      }, { passive: true });
    }
    const doBuy = (now) => {
      if ((p.options || []).length && !opt) { toast("اختار اللون / المقاس أول"); const o = app.querySelector(".opts"); if (o) o.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
      const qi = $("[data-qty]");
      qty = Math.max(1, Math.min(99, parseInt(qi && qi.value) || 1));
      addToCart(p.id, opt, qty, !!now);
      if (now) navTo("#/checkout"); else flyToCart(app.querySelector("[data-buyline] button, [data-buy]"));
    };
    // reviews: summary, bars and list
    if (revOn) fetch("/api/reviews?id=" + encodeURIComponent(p.id)).then((r) => (r.ok ? r.json() : [])).then((list) => {
      if (!Array.isArray(list) || !list.length || !document.contains(app.querySelector("[data-reviews]"))) return;
      const n = list.length, avg = Math.round((list.reduce((a, r) => a + r.rating, 0) / n) * 10) / 10;
      app.querySelector("[data-rv-avg]").textContent = num(avg);
      { const st0 = app.querySelector(".rv-avg .stars"); if (st0) st0.outerHTML = stars(avg); }
      app.querySelector("[data-rv-count]").textContent = `${num(n)} ${n === 1 ? "تقييم" : "تقييمات"}`;
      const rt = app.querySelector("[data-rate-txt]"); if (rt) { rt.textContent = rateTxt(avg, n); rt.previousElementSibling.outerHTML = stars(avg); }
      app.querySelectorAll("[data-rv-bars]>div").forEach((row, k) => { const c = list.filter((r) => r.rating === 5 - k).length; row.querySelector("em").style.width = (c / n) * 100 + "%"; row.lastElementChild.textContent = num(c); });
      app.querySelector("[data-rv-list]").innerHTML = list.map((r) => `<article class="rv-item"><div class="rv-top"><b>${esc(r.name)}</b>${stars(r.rating)}<small>${new Date(r.at).toLocaleDateString("ar-SY")}</small></div>${r.text ? `<p>${esc(r.text)}</p>` : ""}</article>`).join("");
    }).catch(() => {});
    if (p.inStock) { const an = app.querySelector("[data-buyline]") || app.querySelector(".buy-row"); const extra = shipBarH(cartTotal()) + trustH(); if (an && extra) { const last = an.parentNode.querySelector("[data-buy][data-now]") || an; last.insertAdjacentHTML("afterend", extra); } }
    // sticky "add to cart" bar when the main button scrolls away (store product page)
    const sticky = $("[data-sticky]"), bl = app.querySelector("[data-buyline]");
    if (ST2 && sticky && bl && "IntersectionObserver" in window) {
      sticky.innerHTML = `<div class="sb-info"><b>${esc(p.name)}</b><span class="price">${priceH(p)}</span></div><button type="button" class="btn btn-black" data-sticky-buy>${ICON.cart}<span>أضف</span></button>`;
      sticky.onclick = (e) => { if (e.target.closest("[data-sticky-buy]")) doBuy(false); };
      const ob = new IntersectionObserver(([en]) => {
        if (!document.contains(bl)) { ob.disconnect(); sticky.hidden = true; return; }
        sticky.hidden = en.isIntersecting || en.boundingClientRect.top > 0;
        document.body.classList.toggle("has-sticky", !sticky.hidden);
      });
      ob.observe(bl);
    }
    app.onclick = (e) => {
      const gn = e.target.closest("[data-gnav]");
      if (gn && gal) { if (PGX) fxShow(fxCur + +gn.dataset.gnav, +gn.dataset.gnav); else goSlot(slotNow() + +gn.dataset.gnav, true); return; }
      const tb = e.target.closest("[data-ptab-btn]");
      if (tb) { app.querySelectorAll("[data-ptab-btn]").forEach((x) => x.classList.toggle("on", x === tb)); app.querySelectorAll("[data-ptab]").forEach((x) => (x.hidden = x.dataset.ptab !== tb.dataset.ptabBtn)); return; }
      if (e.target.closest("[data-write-review]")) { writeReview(p); return; }
      const pic = e.target.closest("[data-pic]");
      // scroll only the gallery itself (never the page) to the chosen photo
      if (pic && gal) { if (PGX) fxShow(+pic.dataset.pic); else goSlot(+pic.dataset.pic + 1, true); }
      if (gal && gal.dataset.swiped) return;
      const z = e.target.closest("[data-zoom]");
      if (z) openViewer(pics.map((u, i) => (p.zoom && p.zoom[i]) || u), +z.dataset.zoom, p.name);
      const o = e.target.closest("[data-opt]");
      if (o) { opt = o.dataset.opt; app.querySelectorAll("[data-opt]").forEach((b) => b.classList.toggle("on", b === o)); $("[data-optname]").textContent = opt; }
      const q = e.target.closest("[data-q]");
      if (q) { qty = Math.max(1, Math.min(99, qty + Number(q.dataset.q))); $("[data-qty]").value = qty; }
      if (e.target.closest("[data-buy]")) doBuy(!!e.target.closest("[data-now]"));
    };
    app.onchange = null;
  }

  function writeReview(p) {
    const me = store.get("ko_customer", {}) || {};
    let rating = 0;
    openSheet("اكتب رأيك", `<p class="sh-sub">${esc(p.name)}</p>
      <div class="rv-pick" data-rv-pick>${[1, 2, 3, 4, 5].map((i) => `<button type="button" data-r="${i}" aria-label="${i} نجوم">★</button>`).join("")}</div>
      <div class="field"><label>اسمك</label><input data-rv-name maxlength="40" value="${esc((me.name || "").split(" ")[0])}"></div>
      <div class="field"><label>رأيك بالمنتج</label><textarea data-rv-text maxlength="600" rows="4" placeholder="شو عجبك؟ كيف الجودة والمقاس؟"></textarea></div>
      <p class="rv-msg" data-rv-msg></p>
      <div class="sh-btns"><button type="button" class="btn btn-dark" data-rv-send>إرسال التقييم</button></div>`, (box) => {
      box.addEventListener("click", async (e) => {
        const r = e.target.closest("[data-r]");
        if (r) { rating = +r.dataset.r; box.querySelectorAll("[data-r]").forEach((b) => b.classList.toggle("on", +b.dataset.r <= rating)); }
        if (!e.target.closest("[data-rv-send]")) return;
        const msg = box.querySelector("[data-rv-msg]"), name = box.querySelector("[data-rv-name]").value.trim(), text = box.querySelector("[data-rv-text]").value.trim();
        if (!rating) { msg.textContent = "اختار عدد النجوم"; return; }
        if (name.length < 2) { msg.textContent = "اكتب اسمك"; return; }
        const btn = e.target.closest("[data-rv-send]"); btn.disabled = true;
        try {
          const res = await fetch("/api/reviews", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pid: p.id, name, text, rating }) });
          const j = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(j.error || "صار خطأ");
          box.innerHTML = `<div class="rv-thanks"><b>شكراً لرأيك! 🙏</b><p>${j.pending ? "رح يظهر تقييمك بعد ما نراجعه." : "تقييمك صار ظاهر."}</p><button type="button" class="btn btn-dark" data-sheet-x>تمام</button></div>`;
        } catch (err) { msg.textContent = err.message; btn.disabled = false; }
      });
    });
  }

  // ---------- "my account": orders made on this device + tracking by order number and phone ----------
  const ST_NAMES = { new: "استلمنا طلبك", pending_payment: "بانتظار التحويل", paid: "وصلنا الدفع", confirmed: "تم تأكيد الطلب", shipped: "انشحن الطلب", delivered: "وصل الطلب", cancelled: "الطلب ملغي" };
  function trackHtml(o) {
    if (o.status === "cancelled") return `<div class="trk cancel"><b>${ST_NAMES.cancelled}</b></div>`;
    const lvl = { new: 0, pending_payment: 0, paid: 1, confirmed: 1, shipped: 2, delivered: 3 }[o.status] ?? 0;
    return `<div class="trk"><div class="trk-now">${esc(ST_NAMES[o.status] || o.status)}</div><ol>${["استلمنا الطلب", "تأكيد", "شحن", "وصل"].map((t, i) => `<li class="${i <= lvl ? "on" : ""}"><i></i><span>${t}</span></li>`).join("")}</ol>
      <small>${o.items.map((i) => `${esc(i.name)}${i.opt ? " (" + esc(i.opt) + ")" : ""} × ${i.qty}`).join("، ")} · ${money(o.total)}${o.delivery && o.delivery.carrier ? " · " + esc(o.delivery.carrier) : ""}</small></div>`;
  }
  async function track(no, phone, out) {
    out.hidden = false; out.innerHTML = `<div class="loading" style="padding:12px">جاري البحث…</div>`;
    try {
      const r = await fetch(`/api/track?no=${encodeURIComponent(no)}&phone=${encodeURIComponent(phone)}`);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "صار خطأ");
      out.innerHTML = trackHtml(j);
    } catch (err) { out.innerHTML = `<div class="trk cancel">${esc(err.message)}</div>`; }
  }
  // simple formatting for the store's own pages: paragraphs, "- " lists, **bold**, links
  function richText(t) {
    const inline = (x) => esc(x).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    return String(t || "").split(/\n{2,}/).map((blk) => {
      const ls = blk.split("\n");
      if (ls.every((l) => /^\s*[-•]\s+/.test(l))) return `<ul>${ls.map((l) => `<li>${inline(l.replace(/^\s*[-•]\s+/, ""))}</li>`).join("")}</ul>`;
      if (/^#\s/.test(blk)) return `<h2>${inline(blk.replace(/^#\s/, ""))}</h2>`;
      return `<p>${ls.map(inline).join("<br>")}</p>`;
    }).join("");
  }
  function page(slug) {
    const pg = (S.pages || []).find((x) => x.slug === slug && x.on !== false);
    if (!pg) { app.innerHTML = `<div class="empty"><b>الصفحة مو موجودة</b><a href="#/">رجوع للرئيسية</a></div>`; return; }
    document.title = `${pg.title} | ${C.name}`;
    app.innerHTML = `<article class="page-doc"><h1 class="page-title">${esc(pg.title)}</h1>${richText(pg.body)}</article>`;
    app.onclick = null; app.onchange = null;
  }
  function account() {
    const list = store.get("ko_orders", []);
    const me = store.get("ko_customer", {}) || {};
    app.innerHTML = `<h1 class="page-title">حسابي</h1>
      <section class="acc-card"><h2>طلباتي</h2>${list.length ? list.map((o) => `<div class="acc-order"><div><b dir="ltr">${esc(o.id)}</b><small>${new Date(o.at).toLocaleDateString("ar-SY")} · ${o.n} منتج · ${money(o.total)}</small></div>
        <button type="button" class="btn btn-ghost sm" data-track="${esc(o.id)}" data-phone="${esc(o.phone)}">تتبّع</button></div><div class="acc-st" data-st="${esc(o.id)}" hidden></div>`).join("") : `<p class="acc-empty">ما في طلبات من هالجهاز لهلق. <a href="#/all">ابدأ التسوق</a></p>`}</section>
      <section class="acc-card"><h2>تتبّع طلب</h2><form class="acc-form" data-track-form><input name="no" placeholder="رقم الطلب (KO-…)" dir="ltr" required><input name="phone" placeholder="رقم الموبايل يلي طلبت فيه" inputmode="tel" dir="ltr" value="${esc(me.phone || "")}" required><button class="btn btn-dark">تتبّع</button></form><div data-track-out hidden></div></section>
      <section class="acc-card acc-links"><a href="#/cart">🛒 السلة</a><a href="https://wa.me/${C.whatsapp}" target="_blank" rel="noopener">💬 تواصل معنا على واتساب</a></section>`;
    app.onclick = (e) => { const b = e.target.closest("[data-track]"); if (b) track(b.dataset.track, b.dataset.phone, app.querySelector(`[data-st="${CSS.escape(b.dataset.track)}"]`)); };
    app.onchange = null;
    app.querySelector("[data-track-form]").addEventListener("submit", (e) => { e.preventDefault(); const f = e.target; track(f.no.value.trim(), f.phone.value.trim(), app.querySelector("[data-track-out]")); });
  }

  // small confirmation box (instead of the browser's plain confirm)
  function askConfirm(text, ok) {
    return new Promise((res) => {
      const d = document.createElement("dialog"); d.className = "ko-confirm";
      d.innerHTML = `<p>${esc(text)}</p><div class="buy-row"><button type="button" class="btn btn-red" data-yes>${esc(ok || "نعم، احذف")}</button><button type="button" class="btn btn-ghost" data-no>إلغاء</button></div>`;
      document.body.appendChild(d);
      const end = (v) => { d.close(); d.remove(); res(v); };
      d.querySelector("[data-yes]").onclick = () => end(true); d.querySelector("[data-no]").onclick = () => end(false);
      d.addEventListener("cancel", (e) => { e.preventDefault(); end(false); });
      d.addEventListener("click", (e) => { if (e.target === d) end(false); });
      d.showModal();
    });
  }
  function cartView() {
    const lines = cartLines();
    if (!lines.length) { app.innerHTML = `<div class="empty"><b>السلة فاضية</b><a class="btn btn-dark" href="#/" style="margin-top:12px">ابدأ التسوق</a></div>`; return; }
    app.innerHTML = `<div class="cart-head"><h1 class="page-title">السلة</h1><button type="button" class="clear-cart" data-clear-cart>🗑 حذف كامل السلة</button></div><div class="cart-wrap">
      <div class="lines">${lines.map((l, i) => `<div class="line">
        <img src="${esc(imgW(l.p.thumb || l.p.image, 200))}" alt="" decoding="async">
        <div><a class="nm" href="#/p/${encodeURIComponent(l.p.id)}">${esc(l.p.name)}</a>${l.opt ? `<div class="op">${esc(l.opt)}</div>` : ""}
          ${l.p.inStock ? "" : `<div class="op" style="color:var(--red)">صار خالص — شيله من السلة</div>`}
          <div class="ctrl"><div class="qty"><button data-lq="${i}" data-d="1">+</button><input value="${l.qty}" readonly aria-label="الكمية"><button data-lq="${i}" data-d="-1">−</button></div><button class="rm" data-rm="${i}" aria-label="حذف المنتج">🗑 حذف</button></div></div>
        <div class="price" style="font-size:18px">${priceH(l.p, l.qty)}</div></div>`).join("")}</div>
      <div class="summary"><h3>ملخص الطلب</h3>${shipBarH(cartTotal())}
        ${(() => { const d = autoDiscount(lines.filter((l) => l.p.inStock)), amt = d && !d.freeShip ? d.amount : 0;
          return (amt ? `<div class="sum-row"><span>قبل الحسم</span><s>${money(cartTotal())}</s></div><div class="sum-row disc"><span>🏷 ${esc(d.name)}</span><b>−${money(amt)}</b></div>` : "") +
            `<div class="sum-row total"><span>المجموع</span><span>${money(cartTotal() - amt)}</span></div><small class="note">المجموع بدون التوصيل.</small>`; })()}
        <small class="note">عندك كود خصم؟ بتكتبه بصفحة إتمام الطلب.</small>
        <a class="btn btn-red" href="#/checkout">إتمام الطلب</a>
${trustH()}
      </div></div>${upsellH(lines)}`;
    app.onclick = (e) => {
      const q = e.target.closest("[data-lq]");
      if (q) { const l = cart[q.dataset.lq]; l.qty = Math.max(1, Math.min(99, l.qty + Number(q.dataset.d))); saveCart(); cartView(); }
      const r = e.target.closest("[data-rm]");
      if (r) { const l = cart[Number(r.dataset.rm)], p = l && byId.get(l.id); askConfirm(`بدك تحذف «${p ? p.name : "المنتج"}» من السلة؟`).then((y) => { if (y) { cart.splice(Number(r.dataset.rm), 1); saveCart(); cartView(); } }); return; }
      if (e.target.closest("[data-clear-cart]")) { askConfirm("بدك تفضّي السلة كلها؟ رح تنحذف كل المنتجات.", "نعم، فضّي السلة").then((y) => { if (y) { cart = []; saveCart(); cartView(); } }); return; }
      const up = e.target.closest("[data-up]");
      if (up) { addToCart(up.dataset.up, "", 1, true); cartView(); }
    };
    app.onchange = null;
  }

  // heavy things (weights, punching bags…): shipping is priced on confirmation (same rule as the server)
  const HEAVY_DEF = { on: true, cats: ["أوزان"], words: ["دامبل", "دمبل", "دنبل", "طارة", "طارات", "حديد", "كيس ملاكمة", "دبل باغ", "سترة", "سترة اوزان", "سترة أوزان", "بار", "كيتل", "عقلة", "بنش", "أوزان حديد"] };
  const normWords = (t) => " " + String(t || "").replace(/[\-–—_,،.()\[\]/|+:]+/g, " ").replace(/\s+/g, " ").trim() + " ";
  const isHeavy = (p) => { const H = (S.shipping && S.shipping.heavy) || HEAVY_DEF; if (!p || H.on === false) return false; if ((H.cats || []).includes(p.category)) return true; const n = normWords(p.name); return (H.words || []).some((w) => w && n.includes(normWords(w))); };
  const flatOf = (c) => (!c || c.flatFee === "" || c.flatFee == null || isNaN(+c.flatFee) ? null : +c.flatFee);
  // governorates customers can pick (from the shipping companies, or the old simple list)
  function govList() {
    if (C.carriers && C.carriers.length) return [...new Set(C.carriers.flatMap((c) => c.govs.map((g) => g.name)))];
    return C.zones.map((z) => z.gov);
  }
  function checkout() {
    const lines = cartLines().filter((l) => l.p.inStock);
    if (!lines.length) { navTo("#/cart"); return; }
    const saved = store.get("ko_customer", {});
    const sub = lines.reduce((s, l) => s + l.p.price * l.qty, 0);
    const freeOver = Number(S.delivery.freeOver) || 0;
    const heavyCart = lines.some((l) => isHeavy(l.p));
    const CO = S.checkout || {};
    const nameLabel = CO.nameMode === "first" ? "الاسم" : CO.nameMode === "first_last" ? "الاسم الأول والأخير" : "الاسم الثلاثي";
    const phoneOn = CO.phoneOn !== false, emailOn = !!CO.emailOn;
    const coNote = CO.note ? `<div class="co-note">${esc(CO.note)}</div>` : "";
    const useCarriers = C.carriers && C.carriers.length;
    // fast home delivery inside Damascus (Yalla Go): its own switch; picking it hides governorate / company / branch
    const YG = useCarriers ? (C.carriers.find((c) => c.type === "door" && /yalla|يلا/i.test(c.id + " " + c.name)) || null) : null;
    const others = useCarriers ? C.carriers.filter((c) => c !== YG) : [];
    let govs = govList();
    if (!govs.length) govs = govList();
    const sn = String(saved.name || "").trim().split(/\s+/), n1 = saved.n1 ?? sn[0] ?? "", n2 = saved.n2 ?? (sn.length > 2 ? sn.slice(1, -1).join(" ") : sn.length === 2 ? "" : "") ?? "", n3 = saved.n3 ?? (sn.length > 1 ? sn[sn.length - 1] : "");
    app.innerHTML = `<h1 class="page-title">إتمام الطلب</h1><div class="cart-wrap">
      <form class="form" data-checkout novalidate>
        <h3><span class="step">1</span> معلوماتك</h3>
        <div class="field"><label for="f-n1">الاسم الأول</label><input id="f-n1" name="n1" autocomplete="given-name" value="${esc(n1)}" required><div class="msg"></div></div>
        <div class="field"><label for="f-n2">اسم الأب</label><input id="f-n2" name="n2" autocomplete="additional-name" value="${esc(n2)}" required><div class="msg"></div></div>
        <div class="field"><label for="f-n3">الكنية</label><input id="f-n3" name="n3" autocomplete="family-name" value="${esc(n3)}" required><div class="msg"></div></div>
        <div class="field"><label for="f-phone">رقم الموبايل</label><input id="f-phone" name="phone" type="tel" inputmode="tel" dir="ltr" placeholder="09xxxxxxxx" autocomplete="tel" value="${esc(saved.phone)}" required><div class="msg"></div></div>
        <h3><span class="step">2</span> التوصيل</h3>
        <div class="field" data-gov-field><label for="f-gov">المحافظة</label><select id="f-gov" name="governorate" required><option value="">اختار المحافظة</option>${govs.map((g) => `<option ${saved.governorate === g ? "selected" : ""}>${esc(g)}</option>`).join("")}</select><div class="msg"></div></div>
        ${heavyCart ? `<div class="note heavy-note" data-heavy-note hidden>🏋️ طلبك فيه أغراض تقيلة (أوزان، دامبل، كيس ملاكمة…)، فسعر الشحن بيتحدد عند التأكيد.</div>` : ""}
        ${useCarriers ? `<div class="field" data-branch-field hidden><label for="f-branch" data-branch-label>فرع القدموس للشحن</label><select id="f-branch" name="branch"></select><small data-branch-addr></small><div class="msg"></div></div>
        <div class="field" data-carrier-field hidden><label>شركة الشحن</label><div class="pay-opts" data-carriers></div><div class="msg"></div></div>` : ""}
        ${YG ? `<label class="yg-opt" data-yg-card hidden><input type="checkbox" name="yalla" ${saved.yalla ? "checked" : ""}><span class="yg-ic">⚡</span><span><small class="yg-or">أو بدل الشحن بالقدموس:</small><b>توصيل سريع لباب البيت عن طريق يلا غو (ضمن دمشق)</b><small>${esc(YG.note || "اختاره إذا كنت بدمشق، والطلب بيوصل لعندك عالبيت")}</small></span></label>` : ""}
        <div class="field" data-door><label for="f-addr">العنوان (اختياري)</label><input id="f-addr" name="address" placeholder="المنطقة، الشارع، البناء، أقرب نقطة دالة" value="${esc(saved.address)}"><small>إذا بتحب اكتب العنوان أو أقرب نقطة دالة، وإلا منتواصل معك</small><div class="msg"></div></div>
        ${useCarriers ? "" : `<div class="field" data-qadmous><label for="f-center">اسم مركز القدموس</label><input id="f-center" name="center" value="${esc(saved.center)}"><div class="msg"></div></div>`}
        ${`<div class="field"><label for="f-notes">ملاحظة (اختياري)</label><textarea id="f-notes" name="notes" rows="2" placeholder="أي شي بدك تخبرنا فيه عن الطلب"></textarea></div>`}
        <h3 data-pay-title><span class="step">3</span> الدفع</h3>
        ${CO.notePos !== "below" ? coNote : ""}
        <div class="field" data-pay-field><div class="pay-opts" data-pays></div><div class="msg"></div></div>
        ${CO.notePos === "below" ? coNote : ""}
        <button class="btn btn-red" data-submit>تأكيد الطلب</button>${trustH()}
        ${S.delivery.note ? `<div class="note">${esc(S.delivery.note)}</div>` : ""}
      </form>
      <div class="summary co-sum"><h3>🧾 طلبك (${lines.reduce((a, l) => a + l.qty, 0)} قطعة)</h3>
        <div class="co-items">${lines.map((l) => `<div class="co-i"><img src="${esc(imgW(l.p.thumb || l.p.image, 200))}" alt="" loading="lazy"><span class="co-n">${esc(l.p.name)}${l.opt ? `<small>${esc(l.opt)}</small>` : ""}<small>الكمية: ${l.qty}${prodPct(l.p) ? ` · <b class="co-pct">حسم ${prodPct(l.p)}%</b>` : ""}</small></span><span class="co-p">${priceH(l.p, l.qty)}</span></div>`).join("")}</div>
        <div class="sum-row" style="border-top:1px solid var(--line);margin-top:6px;padding-top:10px"><span>المجموع قبل الحسم</span><b>${money(sub)}</b></div>
        <div class="sum-row disc" data-disc-row hidden><span data-disc-name></span><b data-disc-amt></b></div>
        <div class="sum-row"><span>التوصيل</span><span data-fee>اختار المحافظة</span></div>
        <div class="sum-row" data-tax-row hidden><span data-tax-name></span><span data-tax-amt></span></div>
        <div class="sum-row total"><span>الإجمالي</span><span data-total>${money(sub)}</span></div>
        <div class="coupon"><div class="coupon-in"><input data-coupon placeholder="كود الخصم" dir="ltr" autocomplete="off" maxlength="20"><button type="button" class="btn btn-dark sm" data-coupon-apply>تطبيق</button></div><small data-coupon-msg></small></div>
        ${freeOver > 0 ? `<div class="note">${sub >= freeOver ? "🎉 توصيلك مجاني!" : `ضيف بـ ${money(freeOver - sub)} كمان وبيصير التوصيل مجاني`}</div>` : ""}
      </div></div>`;
    const f = $("[data-checkout]");
    let coupon = null; // {code, discount} from the server
    const auto = autoDiscount(lines);
    const curDisc = () => (coupon && (!auto || coupon.discount.amount >= auto.amount || coupon.discount.freeShip) ? coupon.discount : auto);
    const showDisc = () => {
      const d = curDisc(), row = $("[data-disc-row]");
      row.hidden = !d;
      if (d) { $("[data-disc-name]").textContent = "🏷 " + (d.code ? `${d.name} (${d.code})` : d.name); $("[data-disc-amt]").textContent = d.freeShip && !d.amount ? "شحن مجاني" : "−" + money(d.amount); }
    };
    $("[data-coupon-apply]").addEventListener("click", async () => {
      const inp = $("[data-coupon]"), msg = $("[data-coupon-msg]"), code = inp.value.trim();
      if (!code) { coupon = null; showDisc(); sync(); msg.textContent = ""; return; }
      msg.textContent = "جاري التحقق…"; msg.className = "";
      try {
        const r = await fetch("/api/coupon", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code, items: lines.map((l) => ({ id: l.id, qty: l.qty })) }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || "الكود مو صالح");
        coupon = { code, discount: j.discount };
        msg.textContent = curDisc() === j.discount ? "✓ انطبق الخصم" : "✓ الكود صالح، بس عندك خصم أحسن منه مطبّق";
        msg.className = "ok";
      } catch (err) { coupon = null; msg.textContent = err.message; msg.className = "bad"; }
      showDisc(); sync();
    });
    // abandoned cart: once a phone number is typed, keep a copy so the store can help finish the order
    let sid = store.get("ko_sid", ""); if (!/^[a-z0-9]{8,32}$/.test(sid)) { sid = Math.random().toString(36).slice(2, 12) + Date.now().toString(36); store.set("ko_sid", sid); }
    let cartT, cartSent = "";
    f.addEventListener("input", () => {
      clearTimeout(cartT);
      cartT = setTimeout(() => {
        const v = Object.fromEntries(new FormData(f)), ph = String(v.phone || "").replace(/\D/g, "");
        if (ph.length < 9) return;
        const payload = JSON.stringify({ sid, name: [v.n1, v.n2, v.n3].filter(Boolean).join(" "), phone: v.phone, governorate: v.governorate || "", items: lines.map((l) => ({ id: l.id, opt: l.opt, qty: l.qty })) });
        if (payload === cartSent) return; cartSent = payload;
        fetch("/api/carts", { method: "POST", headers: { "content-type": "application/json" }, body: payload, keepalive: true }).catch(() => {});
      }, 1500);
    });
    const zoneOf = (g) => C.zones.find((z) => z.gov === g);
    const ygOn = () => !!(YG && f.yalla && f.yalla.checked);
    const carrierOpts = (g) => (YG ? others : C.carriers || []).filter((c) => c.govs.some((x) => x.name === g));
    const curCarrier = () => (ygOn() ? YG : (C.carriers || []).find((c) => c.id === (f.querySelector("[name=carrier]:checked") || {}).value));
    const govVal = () => (ygOn() ? ((YG.govs || []).find((x) => x.name === f.governorate.value) || YG.govs[0] || {}).name || f.governorate.value : f.governorate.value);
    const curGov = () => { const c = curCarrier(); return c && c.govs.find((x) => x.name === govVal()); };
    function showQr() {} // the Sham Cash barcode is no longer shown
    function renderPays() {
      const all = S.payments.filter((p) => p.enabled), c = curCarrier();
      const allowed = c && (c.payments || []).length ? all.filter((p) => c.payments.includes(p.id)) : [];
      const list = allowed.length ? allowed : all;
      const prev = (f.querySelector("[name=payment]:checked") || {}).value || saved.payment;
      f.querySelector("[data-pay-field]").dataset.n = list.length;
      f.querySelector("[data-pays]").innerHTML = list.map((p, i) => `<label class="pay-opt"><input type="radio" name="payment" value="${esc(p.id)}" ${(list.some((x) => x.id === prev) ? prev === p.id : i === 0) ? "checked" : ""}><span><b>${esc(p.name)}</b>${p.details ? `<small>${esc(p.details)}</small>` : ""}</span></label>`).join("");
      showQr();
    }
    const sync = () => {
      const yg = ygOn(), g = govVal();
      // دمشق وريفها: خيارين جنب بعض (القدموس / يلا غو)، الزبون بيختار وما في شي مختار سلفاً
      const damas = /دمشق/.test(f.governorate.value || ""), twoWay = !!(YG && useCarriers && damas), ygc0 = f.querySelector("[data-yg-card]");
      if (ygc0) ygc0.hidden = true;
      if (f.yalla) { const ck0 = f.querySelector("[name=carrier]:checked"), want = twoWay && !!ck0 && ck0.value === YG.id; if (f.yalla.checked !== want) f.yalla.checked = want; }
      let fee = 0, feeTxt = "اختار المحافظة", door = true, ready = !!g;
      if (useCarriers) {
        const opts = carrierOpts(twoWay ? f.governorate.value : g).filter((c) => c !== YG).concat(twoWay ? [YG] : []), box = f.querySelector("[data-carriers]");
        f.querySelector("[data-carrier-field]").hidden = !g || (yg && !twoWay);
        box.classList.toggle("ship2", twoWay);
        const prev = (f.querySelector("[name=carrier]:checked") || {}).value || (twoWay ? "" : saved.carrier);
        box.innerHTML = opts.map((c, i) => `<label class="pay-opt"><input type="radio" name="carrier" value="${esc(c.id)}" ${(opts.some((x) => x.id === prev) ? prev === c.id : !twoWay && i === 0) ? "checked" : ""}><span><b>${esc(c.name)}</b>${c.note ? `<small>${esc(c.note)}</small>` : ""}</span></label>`).join("") || `<div class="note">ما في شحن لهالمحافظة حالياً</div>`;
        if (twoWay && f.yalla) { const ck1 = f.querySelector("[name=carrier]:checked"), want = !!ck1 && ck1.value === YG.id; if (f.yalla.checked !== want) { f.yalla.checked = want; return sync(); } }
        const c = curCarrier(), gv = curGov();
        door = !c || c.type === "door";
        const bf = f.querySelector("[data-branch-field]");
        bf.hidden = yg || !c || c.type !== "branch";
        { const bl = f.querySelector("[data-branch-label]"); if (bl && c) bl.textContent = /القدموس/.test(c.name) ? "فرع القدموس للشحن" : "فرع " + c.name; }
        if (c && c.type === "branch" && gv) {
          const sel = f.branch, prevB = sel.value || saved.branch;
          sel.innerHTML = `<option value="">اختار الفرع</option>` + (gv.branches || []).map((b) => `<option value="${esc(b.name)}" ${prevB === b.name ? "selected" : ""}>${esc(b.name)}</option>`).join("");
          const b = (gv.branches || []).find((x) => x.name === sel.value);
          f.querySelector("[data-branch-addr]").textContent = b ? "📍 " + b.address : "";
        }
        ready = !!gv;
        const gfee = gv ? gv.fee ?? flatOf(c) ?? (c && c.flatFee === undefined && c.id === "qadmous" ? 1 : null) : null;
        if (gv) { if (heavyCart) feeTxt = "بيتحدد عند التأكيد"; else if (freeOver > 0 && sub >= freeOver) feeTxt = "مجاني"; else if (gfee == null) feeTxt = "بيتحدد عند التأكيد"; else { fee = gfee; feeTxt = gfee ? money(gfee) : "مجاني"; } }
        else if (g) feeTxt = "اختار طريقة الشحن";
      } else {
        const z = zoneOf(g); door = !z || z.method === "door";
        f.querySelector("[data-qadmous]").hidden = !z || z.method !== "qadmous";
        if (z) { if (freeOver > 0 && sub >= freeOver) feeTxt = "مجاني"; else if (z.fee == null) feeTxt = "بيتحدد عند التأكيد"; else { fee = z.fee; feeTxt = z.fee ? money(z.fee) : "مجاني"; } }
      }
      f.querySelector("[data-door]").hidden = !g || !door;
      if (ready) renderPays();
      const pf = f.querySelector("[data-pay-field]"), many = +(pf.dataset.n || 0) > 1;
      pf.hidden = f.querySelector("[data-pay-title]").hidden = true; void many; // no payment question: the shop confirms on WhatsApp
      const ygc = f.querySelector("[data-yg-card]"); if (ygc) ygc.classList.toggle("on", yg);
      const d = curDisc();
      if (d && d.freeShip && ready && !heavyCart) { fee = 0; feeTxt = "مجاني 🎉"; }
      const hn = f.querySelector("[data-heavy-note]"); if (hn) hn.hidden = !(heavyCart && ready);
      const after = Math.max(0, sub - (d ? d.amount : 0)), TX = S.tax || {};
      const taxAmt = TX.on && +TX.rate > 0 ? Math.round((TX.mode === "included" ? (after * TX.rate) / (100 + +TX.rate) : (after * TX.rate) / 100) * 100) / 100 : 0;
      const tr = $("[data-tax-row]"); if (tr) { tr.hidden = !taxAmt; $("[data-tax-name]").textContent = `${TX.label || "الضريبة"} (${TX.rate}%${TX.mode === "included" ? " ضمن السعر" : ""})`; $("[data-tax-amt]").textContent = money(taxAmt); }
      const tot = after + (TX.mode === "included" ? 0 : taxAmt) + fee;
      $("[data-fee]").textContent = feeTxt;
      const known = ready && fee > 0;
      $("[data-total]").innerHTML = known ? `${money(tot)}<small class="tot-split">${money(tot - fee)} + ${money(fee)} توصيل</small>` : money(tot);
      $("[data-submit]").textContent = `تأكيد الطلب · ${money(tot)}`;
    };
    f.addEventListener("change", (e) => {
      if (e.target.matches("[name=governorate],[name=carrier],[name=branch],[name=yalla]")) sync();
      if (e.target.matches("[name=payment]")) showQr();
    });
    showDisc(); sync();
    f.addEventListener("input", (e) => { const fl = e.target.closest(".field.err"); if (fl) { fl.classList.remove("err"); fl.querySelector(".msg").textContent = ""; } });
    app.onclick = null; app.onchange = null;
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      f.querySelectorAll(".field").forEach((x) => { x.classList.remove("err"); const m = x.querySelector(".msg"); if (m) m.textContent = ""; });
      const v = Object.fromEntries(new FormData(f));
      v.name = [v.n1, v.n2, v.n3].map((x) => String(x || "").trim()).join(" ").trim();
      if (ygOn()) { v.governorate = govVal(); v.carrier = YG.id; v.branch = ""; }
      const c = curCarrier();
      const door = useCarriers ? !!c && c.type === "door" : (zoneOf(v.governorate) || {}).method === "door";
      const errs = {};
      if (!String(v.n1 || "").trim()) errs.n1 = "اكتب الاسم الأول";
      if (!String(v.n2 || "").trim()) errs.n2 = "اكتب اسم الأب";
      if (!String(v.n3 || "").trim()) errs.n3 = "اكتب الكنية";
      const digits = (v.phone || "").replace(/\D/g, "");
      if (digits.length < 9 || digits.length > 13) errs.phone = digits ? "رقم الموبايل مو صحيح" : "اكتب رقم الموبايل";
      const em = "";
      if (!v.governorate) errs.governorate = "اختار المحافظة";
      else if (useCarriers && !c) errs.carrier = "اختار طريقة الشحن";
      else if (useCarriers && c.type === "branch" && !v.branch) errs.branch = "اختار الفرع";
      if (!useCarriers && v.governorate && !door && (v.center || "").trim().length < 3) errs.center = "اكتب اسم مركز القدموس";
      if (Object.keys(errs).length) {
        for (const [k, m] of Object.entries(errs)) {
          const el = k === "payment" ? f.querySelector("[data-pays]") : k === "carrier" ? f.querySelector("[data-carriers]") : f[k];
          const fl = el && el.closest && el.closest(".field"); if (fl) { fl.classList.add("err"); fl.querySelector(".msg").textContent = m; }
        }
        const first = f.querySelector(".field.err input, .field.err select"); if (first) first.focus(); return;
      }
      store.set("ko_customer", { name: v.name, n1: v.n1, n2: v.n2, n3: v.n3, yalla: ygOn(), phone: v.phone, email: v.email, altPhone: v.altPhone, postal: v.postal, governorate: v.governorate, address: v.address, center: v.center, carrier: v.carrier, branch: v.branch, payment: v.payment });
      const btn = $("[data-submit]"); btn.disabled = true; btn.textContent = "جاري الإرسال…";
      const body = {
        customer: { name: v.name.trim(), phone: (v.phone || "").trim(), email: em, altPhone: (v.altPhone || "").trim(), postal: (v.postal || "").trim(), governorate: v.governorate, address: door ? (v.address || "").trim() : "", center: door ? "" : (v.center || "").trim(), notes: (v.notes || "").trim() },
        carrier: v.carrier || "", branch: v.branch || "", payment: v.payment, sid, cur: FXR > 0 ? curMode() : "usd",
        coupon: coupon && curDisc() === coupon.discount ? coupon.code : "",
        items: lines.map((l) => ({ id: l.id, opt: l.opt, qty: l.qty }))
      };
      try {
        const r = await fetch("/api/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || "صار خطأ");
        cart = []; saveCart(); store.set("ko_sid", "");
        store.set("ko_last_order", j.order);
        pixel("Purchase", { value: j.order.total, currency: "USD" });
        store.set("ko_orders", [{ id: j.order.id, phone: body.customer.phone, at: j.order.createdAt, total: j.order.total, n: j.order.items.reduce((a, i) => a + i.qty, 0) }, ...store.get("ko_orders", [])].slice(0, 20));
        navTo("#/done/" + encodeURIComponent(j.order.id));
      } catch (err) {
        btn.disabled = false; sync();
        toast("ما قدرنا نرسل الطلب: " + esc(err.message) + ` — <a target="_blank" href="https://wa.me/${C.whatsapp}">اطلب على واتساب</a>`);
      }
    });
  }

  // the order in the currency the customer saw when ordering
  const oMoney = (o) => (n) => (o && o.display && o.display.cur === "syp" && o.display.rate > 0 ? `${Math.round(Number(n) * o.display.rate).toLocaleString(LAY.price === "arabic" ? "ar-SY" : "en-US")} ل.س جديدة` : `$${Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 })}`);
  function orderBox(o) {
    const m = oMoney(o), fee = o.delivery ? o.delivery.fee : o.fee, disc = o.discount;
    const sub = fee == null ? o.total : o.total - (fee || 0);
    return `<div class="ob">
      <div class="ob-items">${o.items.map((i) => `<a class="ob-i" href="#/p/${encodeURIComponent(i.id)}"><img src="${esc(img(i.image))}" alt="" loading="lazy"><span class="ob-n">${esc(i.name)}${i.opt ? `<small>${esc(i.opt)}</small>` : ""}</span><span class="ob-q">× ${i.qty}</span><b>${m(i.price * i.qty)}</b></a>`).join("")}</div>
      ${disc ? `<div class="ob-r disc"><span>🏷 الحسم: ${esc(disc.name)}</span><b>−${m(disc.amount)}</b></div>` : ""}
      <div class="ob-r"><span>المجموع (بدون توصيل)</span><b>${m(sub)}</b></div>
      <div class="ob-r sub"><span>التوصيل</span><span>${fee == null ? "بيتحدد عند التأكيد" : fee === 0 ? "مجاني" : m(fee)}</span></div>
      <div class="ob-r tot"><span>الإجمالي</span><b>${m(o.total)}${fee > 0 ? `<small class="tot-split">${m(sub)} + ${m(fee)} توصيل</small>` : ""}</b></div>
    </div>`;
  }
  function done(id) {
    if (window.KOMedia) KOMedia.sfx("success");
    const o0 = store.get("ko_last_order", null), o = o0 && o0.id === id ? o0 : null;
    const m = oMoney(o);
    const msg = o
      ? `مرحبا، عملت طلب من الموقع رقم ${o.id}\n` + o.items.map((i) => `- ${i.name}${i.opt ? " (" + i.opt + ")" : ""} × ${i.qty}`).join("\n") + `${o.discount ? `\nالحسم: ${o.discount.name}` : ""}\nالمجموع بدون توصيل: ${m(o.delivery && o.delivery.fee ? o.total - o.delivery.fee : o.total)}\nالاسم: ${o.customer.name}`
      : `مرحبا، عملت طلب من الموقع رقم ${id}`;
    app.innerHTML = `<div class="done">
      ${o ? orderBox(o) : ""}
      <div class="ok">✓</div><h1>تم إرسال طلبك</h1><p class="done-msg">سوف نتواصل معك في أسرع وقت ممكن على واتساب</p>
      <div>رقم الطلب</div><div class="order-no">${esc(id)}</div>
      ${o && o.delivery && o.delivery.carrier ? `<div class="pay-info"><b>الشحن: ${esc(o.delivery.carrier)}</b>${o.delivery.branch ? `\nالفرع: ${esc(o.delivery.branch)}${o.delivery.branchAddress ? " — " + esc(o.delivery.branchAddress) : ""}` : ""}</div>` : ""}
      <div class="pay-info"><b>طريقة الدفع: لم يتم التحديد بعد</b></div>
      <div class="buy-row" style="justify-content:center"><a class="btn btn-wa" target="_blank" rel="noopener" href="https://wa.me/${C.whatsapp}?text=${encodeURIComponent(msg)}">أرسل الطلب على واتساب</a></div>
      <p class="hint" style="margin-top:16px">بعد ما يوصلك طلبك، رأيك بيفرق معنا كتير: <a href="/review" target="_blank" rel="noopener"><b>قيّمنا على جوجل ⭐</b></a></p></div>`;
    app.onclick = null; app.onchange = null;
  }
  // #/o/ID — what was ordered (the link inside the Telegram message); no personal data
  function orderPage(id) {
    app.innerHTML = '<div class="loading">جاري التحميل…</div>';
    fetch("/api/order-items?id=" + encodeURIComponent(id)).then((r) => r.json()).then((o) => {
      if (!o || !o.items) { app.innerHTML = `<div class="empty"><b>الطلب مو موجود</b></div>`; return; }
      app.innerHTML = `<div class="done"><h1>الطلب ${esc(o.id)}</h1><small class="hint">${new Date(o.createdAt).toLocaleString("ar-SY")}</small>${orderBox(o)}</div>`;
    }).catch(() => { app.innerHTML = `<div class="empty"><b>تعذّر تحميل الطلب</b></div>`; });
  }

  function search(q) {
    const terms = norm(q).split(/\s+/).filter(Boolean);
    const items = products.filter((p) => { const h = norm(p.name + " " + p.category + " " + (p.also || []).join(" ")); return terms.every((t) => h.includes(t)); });
    $("[data-search] input").value = q;
    listing({ title: `نتائج البحث: ${q}`, crumbs: `<a href="#/">الرئيسية</a>`, items, key: "s:" + q });
  }

  // ---------- router ----------
  route.n = 0;
  try { history.scrollRestoration = "manual"; } catch {}
  // instant jump to the top, even when the owner turned on smooth scrolling (that CSS would otherwise animate it)
  const toTop = () => { const de = document.documentElement, st = de.style; st.setProperty("scroll-behavior", "auto", "important"); void getComputedStyle(de).scrollBehavior; window.scrollTo(0, 0); requestAnimationFrame(() => st.removeProperty("scroll-behavior")); };
  // going back to a page you already saw (e.g. the product list) puts you exactly where you were
  let navK = Date.now() % 1e9, curK = null; const scrollMem = {};
  addEventListener("scroll", () => { if (curK != null) scrollMem[curK] = window.scrollY; }, { passive: true });
  function route(e, keepScroll) {
    let hs = history.state; const revisit = !keepScroll && hs && hs.koK != null && scrollMem[hs.koK] != null;
    if (!hs || hs.koK == null) { hs = { ...(hs || {}), koK: ++navK }; try { history.replaceState(hs, ""); } catch {} }
    curK = null; // don't record while the page is swapped
    const h = curRoute();
    let [, a, b] = h.split("/");
    const sticky = $("[data-sticky]"); if (sticky) sticky.hidden = true;
    // jump to the top BEFORE the new page is drawn (instantly, even if smooth scrolling is on), so it opens in place
    if (!keepScroll && !revisit) toTop();
    document.body.classList.remove("has-sticky"); closeSheet();
    if (route.n++ && !keepScroll) { app.classList.remove("pg"); void app.offsetWidth; app.classList.add("pg"); }
    document.body.dataset.page = a || "home";
    const navKey = !a ? "home" : ["all", "c", "g", "search", "browse"].includes(a) ? "all" : ["cart", "checkout"].includes(a) ? "cart" : a === "account" ? "account" : a === "games" ? "games" : "";
    document.querySelectorAll("[data-nav]").forEach((x) => x.classList.toggle("on", x.dataset.nav === navKey));
    $(".top").classList.remove("so");
    document.title = C.seoTitle || C.name;
    const hereHref = routeHref(curRoute()); // curRoute() is decoded, the rendered href is encoded — compare decoded
    const sameHref = (v) => { try { return decodeURIComponent(v || "") === hereHref; } catch (e) { return v === hereHref; } };
    document.querySelectorAll("[data-groups] a").forEach((x) => x.classList.toggle("on", sameHref(x.getAttribute("href"))));
    if (!a) home();
    else if (a === "browse") browse();
    else if (a === "all") listing({ title: "كل المنتجات", crumbs: `<a href="#/">الرئيسية</a>`, items: products, key: "all" });
    else if (a === "c") { b = catFromSlug(b); const g = groupOf(b), mt = catMeta(b), ord = mt.order || [];
      let items = products.filter((p) => inCat(p, b));
      if (ord.length) { const ix = new Map(ord.map((id, i) => [id, i])); items = items.slice().sort((x, y) => (ix.has(x.id) ? ix.get(x.id) : 1e6) - (ix.has(y.id) ? ix.get(y.id) : 1e6)); }
      listing({ title: catLabel(b), desc: mt.desc || "", seoTitle: mt.seoTitle, seoDesc: mt.seoDesc, items, key: "c:" + b, crumbs: `<a href="#/">الرئيسية</a>${g ? ` / <a href="#/g/${encodeURIComponent(g.name)}">${esc(g.name)}</a>` : ""}` }); }
    else if (a === "g") { const g = C.groups.find((x) => x.name === b); listing({ title: b, crumbs: `<a href="#/">الرئيسية</a>`, items: orderBy(products.filter((p) => g && g.cats.some((c) => inCat(p, c))), g && g.cats), key: "g:" + b }); }
    else if (a === "p") product(b);
    else if (a === "cart") cartView();
    else if (a === "checkout") checkout();
    else if (a === "done") done(b);
    else if (a === "search") search(b || "");
    else if (a === "account") account();
    else if (a === "page") page(b || "");
    else if (a === "games" && gamesOn()) gamesPage();
    else if (a === "o" && b) orderPage(b);
    else home();
    if (revisit) { const y = scrollMem[hs.koK], de = document.documentElement.style; de.setProperty("scroll-behavior", "auto", "important"); window.scrollTo(0, y); requestAnimationFrame(() => { window.scrollTo(0, y); de.removeProperty("scroll-behavior"); }); }
    else if (!keepScroll && window.scrollY) toTop();
    curK = hs.koK;
    closeMenu();
    if (!route.o && window.KOFx) { route.o = 1; KOFx.open(); }
  }

  // ---------- games ----------
  const gamesOn = () => !!(S.design.games && S.design.games.on);
  function gamesPage() {
    document.title = ((S.design.games || {}).title || "ألعاب") + " | " + (C.name || "");
    app.innerHTML = '<div class="loading">جاري التحميل…</div>';
    const go = () => { if (curRoute().indexOf("/games") === 0 && window.KOGames) KOGames.mount(app, S.design.games || {}, { name: C.name }); };
    if (window.KOGames) return go();
    if (!document.querySelector("link[data-games]")) { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "/assets/games.css?v=42"; l.dataset.games = ""; document.head.appendChild(l); }
    const sc = document.createElement("script"); sc.src = "/assets/games.js?v=42"; sc.onload = go; sc.onerror = () => { app.innerHTML = '<div class="empty"><b>تعذّر تحميل الألعاب</b></div>'; }; document.head.appendChild(sc);
  }

  // ---------- bottom bar (phones): fully configurable from the dashboard ----------
  const bnMenuTo = () => { const v = ((S.design || {}).bnav || {}).menuTo; return ["browse", "kx", "drawer"].includes(v) ? v : "browse"; };
  // ---------- #/browse: a fast, app-like page with every group and section ----------
  function browse() {
    document.title = "المتجر | " + (C.name || "");
    const inStock = products.filter((p) => p.inStock).length;
    const cimg = (c) => { if (c.image) return imgW(c.image, 420); const p = products.find((x) => x.inStock && inCat(x, c.name)) || products.find((x) => inCat(x, c.name)); return p ? imgW(p.thumb || p.image, 420) : ""; };
    const seen = new Set();
    const card = (c, k) => { seen.add(c.name); const u = cimg(c); return `<a class="br-card" href="${cHref(c.name)}" style="--i:${k}">${u ? `<img loading="lazy" decoding="async" src="${esc(u)}" alt="">` : ""}<span class="br-n"><b>${esc(catLabel(c.name))}</b></span></a>`; };
    const groups = C.groups.map((g, i) => {
      const cs = g.cats.map((n) => cats.find((x) => x.name === n)).filter(Boolean); if (!cs.length) return "";
      const total = products.filter((p) => g.cats.some((c) => inCat(p, c))).length;
      return `<section class="br-grp" id="brg-${i}"><div class="br-gh"><span class="br-ic">${esc(gIcon(g, i))}</span><h2>${esc(g.name)}</h2><a href="#/g/${encodeURIComponent(g.name)}">الكل (${total}) ←</a></div><div class="br-grid">${cs.map(card).join("")}</div></section>`;
    }).join("");
    const rest = cats.filter((c) => !seen.has(c.name) && c.count);
    app.innerHTML = `<div class="browse">
      <div class="br-top"><h1>المتجر</h1><form class="br-search" data-br-search><svg viewBox="0 0 24 24" width="18" height="18"><path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><input type="search" placeholder="دوّر على منتج أو قسم…" enterkeyhint="search" data-br-q></form></div>
      ${C.groups.length > 1 ? `<nav class="br-chips">${C.groups.map((g, i) => `<button type="button" data-br-go="${i}">${esc(gIcon(g, i))} ${esc(g.name)}</button>`).join("")}</nav>` : ""}
      <a class="br-all" href="#/all"><span><b>كل المنتجات</b><small>${cats.length} قسم</small></span><i>←</i></a>
      <div data-br-list>${groups}${rest.length ? `<section class="br-grp"><div class="br-gh"><span class="br-ic">✨</span><h2>أقسام تانية</h2></div><div class="br-grid">${rest.map(card).join("")}</div></section>` : ""}</div>
    </div>`;
    { const hd = document.querySelector("header"), ch = app.querySelector(".br-chips"); if (hd && ch) { const ps = getComputedStyle(hd).position; ch.style.top = (ps === "sticky" || ps === "fixed" ? hd.offsetHeight : 0) + "px"; } }
    const q = app.querySelector("[data-br-q]");
    q.oninput = () => { const t = q.value.trim().toLowerCase(); app.querySelectorAll(".br-card").forEach((a) => (a.hidden = !!t && !a.textContent.toLowerCase().includes(t))); app.querySelectorAll(".br-grp").forEach((g) => (g.hidden = !!t && !g.querySelector(".br-card:not([hidden])"))); };
    app.querySelector("[data-br-search]").onsubmit = (e) => { e.preventDefault(); const t = q.value.trim(); if (t) navTo("#/search/" + encodeURIComponent(t)); };
    app.querySelectorAll("[data-br-go]").forEach((b) => (b.onclick = () => { const el = document.getElementById("brg-" + b.dataset.brGo); if (el) { const hd = document.querySelector("header"); window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - ((hd && hd.offsetHeight) || 0) - 56, behavior: "smooth" }); } }));
  }
  const BIC = { home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z", shop: "M4 9h16l-1-5H5zM5 9v11h14V9M9 20v-6h6v6M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0", cart: "M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6.2M10 20.5h.01M17 20.5h.01", user: "M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21a8 8 0 0 1 16 0", menu: "M4 6h16M4 12h16M4 18h16", search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-3.5-3.5", heart: "M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.4-7 10-7 10z", phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z", whatsapp: "M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3zM8.5 8.5c.5 3 2.5 5 5.5 5.5l1.5-1.5-2-1-1 .7a4 4 0 0 1-2-2l.7-1-1-2z", game: "M6 8h12a4 4 0 0 1 4 4v2a3 3 0 0 1-5.4 1.8L15.5 14h-7l-1.1 1.8A3 3 0 0 1 2 14v-2a4 4 0 0 1 4-4zM8 10v3M6.5 11.5h3M16 11h.01M18 13h.01", tag: "M3 12V4h8l10 10-8 8zM7.5 8h.01", star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z", bell: "M6 17V11a6 6 0 0 1 12 0v6l2 2H4zM10 21h4", gift: "M4 10h16v10H4zM3 7h18v3H3zM12 7v13M12 7S9 3 7 5s2 2 5 2zM12 7s3-4 5-2-2 2-5 2z", grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z", truck: "M2 6h12v10H2zM14 9h4l3 3v4h-7zM6 19.5h.01M17 19.5h.01", info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8h.01", mail: "M3 5h18v14H3zM3 6l9 7 9-7", fire: "M12 3s5 4 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-8z", flash: "M13 2 4 14h7l-1 8 9-12h-7z" };
  const BN_DEF = [["الرئيسية", "home", "#/"], ["متجر", "shop", "#/all"], ["السلّة", "cart", "#/cart"], ["حسابي", "user", "#/account"], ["القائمة", "menu", "menu"]];
  const BN_NAV = { "#/": "home", "#/all": "all", "#/cart": "cart", "#/account": "account", "#/games": "games" };
  // the bottom bar as last shown: put back instantly on the next visit (no flash/jump while the page loads)
  function saveBnSnap(nav) {
    try {
      const de = document.documentElement, cs = de.style, v = {}, a = {};
      ["--bn-h", "--bn-w", "--bn-b", "--bn-r", "--bn-ic", "--bn-fs", "--bn-bg", "--bn-fg", "--bn-ac", "--bn-btn", "--bn-n"].forEach((k) => { const x = cs.getPropertyValue(k); if (x) v[k] = x.trim(); });
      ["data-bn-act", "data-bn-lbl", "data-bn-hide", "data-bn-fx", "data-bn-cur", "data-bn-dark", "data-bn-many", "data-bn-btn", "data-bn-jump", "data-bn-fxhome", "data-l-nav", "data-hdr-start"].forEach((k) => { const x = de.getAttribute(k); if (x != null) a[k] = x; });
      localStorage.setItem("ko_bnav", JSON.stringify({ html: nav.innerHTML.replace(/ class="on"/g, "").replace(/ on"/g, '"'), v, a, dk: de.getAttribute("data-theme") === "dark" }));
    } catch {}
  }
  function renderBnav(d) {
    const nav = document.querySelector("[data-bnav]"); if (!nav) return;
    const b = d.bnav || {}, root = document.documentElement.style, HX = /^#[0-9a-f]{6}$/i;
    let items = Array.isArray(b.items) && b.items.length ? b.items : BN_DEF.map(([label, icon, link]) => ({ label, icon, link }));
    items = items.slice(0, 6);
    const set = (k, v) => (v === "" || v == null ? root.removeProperty(k) : root.setProperty(k, v));
    const n = (v, lo, hi) => (v !== "" && v != null && +v >= lo && +v <= hi ? +v : null);
    set("--bn-h", n(b.height, 44, 120) ? n(b.height, 44, 120) + "px" : ""); set("--bn-w", n(b.width, 50, 100) ? n(b.width, 50, 100) + "%" : "");
    set("--bn-b", n(b.bottom, 0, 40) != null ? n(b.bottom, 0, 40) + "px" : ""); set("--bn-r", n(b.radius, 0, 40) != null ? n(b.radius, 0, 40) + "px" : "");
    set("--bn-ic", n(b.iconSize, 14, 40) ? n(b.iconSize, 14, 40) + "px" : ""); set("--bn-fs", n(b.labelSize, 8, 18) ? n(b.labelSize, 8, 18) + "px" : "");
    // colours: always readable; in dark mode the bar follows the dark header instead of the light colours picked for day
    const dkm = document.documentElement.getAttribute("data-theme") === "dark";
    let hb = getComputedStyle(document.documentElement).getPropertyValue("--c-hdr-bg").trim();
    if (!HX.test(hb)) hb = dkm ? "#16161c" : "#121212";
    const bbg = !dkm && HX.test(b.bg || "") ? b.bg : hb;
    const exact = b.exact === true && !dkm; // «exact»: the colours exactly as picked (no automatic contrast fix)
    set("--bn-bg", bbg); set("--bn-fg", exact && HX.test(b.fg || "") ? b.fg : readable(bbg, dkm ? "" : b.fg, 4.5)); set("--bn-ac", exact && HX.test(b.active || "") ? b.active : readable(bbg, HX.test(b.active || "") ? b.active : d.primary, 3));
    set("--bn-btn", HX.test(b.btnBg || "") ? b.btnBg : ""); document.documentElement.setAttribute("data-bn-btn", HX.test(b.btnBg || "") ? "on" : "off");
    document.documentElement.setAttribute("data-bn-jump", b.jump === false ? "off" : "on"); document.documentElement.setAttribute("data-bn-fxhome", b.fxHome === false ? "off" : "on");
    const de = document.documentElement; de.setAttribute("data-bn-act", ["color", "pill", "dot", "none"].includes(b.activeStyle) ? b.activeStyle : "color");
    de.setAttribute("data-bn-lbl", b.showLabels === false ? "off" : "on"); de.setAttribute("data-bn-hide", b.hideScroll === true ? "on" : "off");
    const fx = ["none", "pulse", "fire", "glow", "bounce", "shine"].includes(b.fx) ? b.fx : b.fx == null ? "fire" : "none", fxOn = ["main", "all", "cart"].includes(b.fxOn) ? b.fxOn : "main";
    de.setAttribute("data-bn-fx", fx);
    const darkIn = b.darkBtn !== false || (d.darkBtn === true && d.darkPos === "bnav"), toBrowse = bnMenuTo() === "browse", curIn = bnCurOn();
    de.setAttribute("data-bn-cur", curIn ? "on" : "off"); de.setAttribute("data-bn-dark", darkIn ? "on" : "off");
    de.setAttribute("data-hdr-start", (d.hdrStart || "cart") === "cart" && LAY.nav !== "off" ? "cart" : "menu"); // without the bottom bar the menu button has to stay
    { const tot = items.length + (darkIn ? 1 : 0) + (curIn ? 1 : 0); set("--bn-n", tot); de.setAttribute("data-bn-many", tot > 5 ? "on" : "off"); }
    const key = JSON.stringify([items, C.whatsapp, gamesOn(), fx, fxOn, darkIn, toBrowse, curIn, dkm]); if (nav.dataset.key === key) { renderBnCur(); return; } nav.dataset.key = key;
    let mainI = items.findIndex((it) => it.link === "menu" || it.link === "explore"); if (mainI < 0) mainI = items.findIndex((it) => it.link === "#/all"); if (mainI < 0) mainI = Math.floor(items.length / 2);
    const fxIdx = (i, it) => fx !== "none" && (fxOn === "all" || (fxOn === "cart" ? it.link === "#/cart" : i === mainI));
    const allTaken = items.some((it) => it.link === "#/all" || it.link === "#/browse");
    nav.innerHTML = items.map((it, i) => {
      const link = String(it.link || "") === "#/all" && toBrowse ? "#/browse" : String(it.link || ""), path = BIC[it.icon] || BIC.star, label = esc(it.label || ""), fc = (fxIdx(i, it) ? ' class="bn-fx"' : "") + (HX.test(it.color || "") ? ` style="--bi:${it.color}"` : "");
      const svg = `<svg viewBox="0 0 24 24"><path d="${path}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      const inner = svg + (label ? `<span>${label}</span>` : "") + (link === "#/cart" ? '<b class="cart-count" data-cart-count hidden>0</b>' : "");
      if (link === "menu" || link === "search" || link === "explore") return `<button type="button"${fc} data-action="${link}"${link === "menu" && toBrowse && !allTaken ? ' data-nav="all"' : ""} aria-label="${label}">${inner}</button>`;
      const href = link === "wa" ? (C.whatsapp ? "https://wa.me/" + C.whatsapp : "#/") : link === "games" ? "#/games" : link || "#/";
      const ext = /^https?:/.test(href) || /^tel:/.test(href);
      return `<a${fc} href="${esc(href)}" data-nav="${BN_NAV[href] || (href === "#/browse" ? "all" : "")}"${ext ? ' target="_blank" rel="noopener"' : ""} aria-label="${label}">${inner}</a>`;
    }).join("") + (curIn ? `<button type="button" class="bn-cur" data-action="cur" aria-label="تبديل العملة"><i class="bn-cur-ic"><b>$</b></i>${b.showLabels === false ? "" : "<span>العملة</span>"}</button>` : "") + (darkIn ? `<button type="button" class="bn-dark" data-action="dark" aria-label="الوضع الداكن"><svg class="moon" viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg><svg class="sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>${b.showLabels === false ? "" : "<span>ليلي</span>"}</button>` : "");
    renderCount(); renderBnCur();
    const cur = document.body.dataset.page, nk = !cur || cur === "home" ? "home" : BN_NAV["#/" + cur] || ""; nav.querySelectorAll("[data-nav]").forEach((x) => x.classList.toggle("on", x.dataset.nav === nk && !!nk));
    saveBnSnap(nav);
  }

  // ---------- currency: today's rate + the visitor's switch ----------
  try { const c = JSON.parse(localStorage.getItem("ko_fxr") || "null"); if (c && c.rate > 0) FXR = c.rate; } catch {}
  let fxLoaded = false;
  function loadRate() {
    if (fxLoaded) return; fxLoaded = true;
    fetch("/api/rate").then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (!j || !(j.rate > 0)) return;
      const changed = Math.abs(j.rate - FXR) > 0.0001; FXR = j.rate;
      try { localStorage.setItem("ko_fxr", JSON.stringify({ rate: j.rate, at: Date.now() })); } catch {}
      if (changed && curMode() === "syp") { renderCurSw(); rerenderPrices(); }
      renderBnav(S.design);
    }).catch(() => {});
  }
  function toggleCur() { const m = curMode() === "syp" ? "usd" : "syp"; try { localStorage.setItem("ko_cur", m); } catch {} renderCurSw(); rerenderPrices(); renderCount(); renderBnCur(); }
  const bnCurOn = () => { const f = S.fx || {}, b = (S.design || {}).bnav || {}; return b.curBtn !== false && f.visitor !== false && (FXR > 0 || f.mode === "syp"); };
  function renderBnCur() { const m = curMode(); document.querySelectorAll(".bnav .bn-cur").forEach((x) => { x.querySelector("b").textContent = m === "syp" ? "ل.س" : "$"; x.classList.toggle("syp", m === "syp"); }); }
  function rerenderPrices() { const keep = window.scrollY; route(null, true); window.scrollTo(0, keep); }
  function renderCurSw() {
    const f = S.fx || {}, want = f.visitor !== false && (FXR > 0 || f.mode === "syp");
    let b = document.querySelector("[data-cur-sw]");
    if (!want) { if (b) { b.remove(); if (window.KOFx) KOFx.toolsTidy(); } return; }
    const host = window.KOFx ? KOFx.tools(S.design.darkBtn === true && S.design.darkPos === "hdr-start") : document.querySelector(".top-in"); if (!host) return;
    if (!b) { b = document.createElement("button"); b.type = "button"; b.className = "cur-sw"; b.dataset.curSw = ""; b.setAttribute("aria-label", "تغيير العملة"); b.onclick = toggleCur; }
    if (b.parentNode !== host) host.insertBefore(b, host.firstChild);
    const m = curMode(); b.innerHTML = `<span class="${m === "usd" ? "on" : ""}"><b>$</b></span><span class="${m === "syp" ? "on" : ""}"><b>ل.س</b></span>`;
  }

  // ---------- chrome ----------
  function chrome() {
    renderBnav(S.design);
    renderCurSw(); loadRate();
    $("[data-groups]").innerHTML = `<a href="#/">الرئيسية</a>` + C.groups.map((g) => `<a href="#/g/${encodeURIComponent(g.name)}">${esc(g.name)}</a>`).join("") + `${gamesOn() ? `<a href="#/games">🎮 ${esc(S.design.games.title || "ألعاب")}</a>` : ""}<a href="#/all">كل المنتجات</a>`;
    if (LAY.drawer === "accordion") {
      const ics = ["#e5484d", "#3e63dd", "#30a46c", "#f76b15", "#8e4ec6", "#0090ff", "#d6409f"];
      const soc = (href, label, path) => href ? `<a href="${esc(href)}" target="_blank" rel="noopener" aria-label="${label}"><svg viewBox="0 0 24 24" width="20" height="20"><path d="${path}" fill="currentColor"/></svg></a>` : "";
      $("[data-drawer-body]").innerHTML = `<div class="dw-head"><span class="logo">${$("[data-logo]").innerHTML}</span><button type="button" class="dw-x" data-action="close-menu" aria-label="إغلاق">✕</button></div>
        <div class="dw-list">${C.groups.map((g, i) => `<details class="dw-grp"><summary><span class="dw-ic" style="color:${ics[i % ics.length]}"><svg viewBox="0 0 24 24" width="18" height="18"><rect x="4" y="4" width="16" height="16" rx="${[8, 3, 8, 3, 6][i % 5]}" fill="none" stroke="currentColor" stroke-width="2.2"/></svg></span><span class="dw-name">${esc(g.name)}</span><i class="dw-pm" aria-hidden="true"></i></summary>
          <div class="dw-cats">${g.cats.map((c) => cats.find((x) => x.name === c)).filter(Boolean).map((c) => `<a href="${cHref(c.name)}">${esc(catLabel(c.name))}</a>`).join("")}</div></details>`).join("")}
          <a class="dw-all" href="#/all"><span class="dw-ic" style="color:#6e56cf">${ICON.grid}</span><span class="dw-name">جميع المنتجات بصفحة واحدة</span></a></div>
        <div class="dw-social"><small>تابعنا على</small><div>
          ${soc(C.facebook, "فيسبوك", "M14 8h3V4h-3a4 4 0 0 0-4 4v2H8v4h2v8h4v-8h3l1-4h-4V8z")}
          ${soc(C.instagram, "إنستغرام", "M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 8a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm5-9.5a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4zM7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3z")}
          ${soc(C.whatsapp ? "https://wa.me/" + C.whatsapp : "", "واتساب", "M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 20zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8 1c-.1.2-.3.2-.5.1a6.5 6.5 0 0 1-3.2-2.8c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.4-.6 1.6-1.2.2-.6.2-1 .1-1.2z")}
        </div></div>`;
    } else $("[data-drawer-body]").innerHTML = `<a href="#/all"><b>كل المنتجات</b><span>${products.length}</span></a>` + C.groups.map((g) => `<h4>${esc(g.name)}</h4>` + g.cats.map((c) => cats.find((x) => x.name === c)).filter(Boolean).map((c) => `<a href="${cHref(c.name)}">${esc(catLabel(c.name))}<span>${c.count}</span></a>`).join("")).join("");
    const pgs = (S.pages || []).filter((x) => x.on !== false && x.footer !== false);
    const fp = $("[data-foot-pages]"); if (fp) { fp.innerHTML = pgs.map((x) => `<a href="#/page/${encodeURIComponent(x.slug)}">${esc(x.title)}</a>`).join(""); fp.hidden = !pgs.length; }
    const dwl = document.querySelector(".dw-list"); if (dwl && pgs.length) dwl.insertAdjacentHTML("beforeend", `<div class="dw-pages">${pgs.map((x) => `<a href="#/page/${encodeURIComponent(x.slug)}">${esc(x.title)}</a>`).join("")}</div>`);
    let wf = $("[data-wa-float]");
    if (false) { // the floating WhatsApp button was removed on purpose
      if (!wf) { wf = document.createElement("a"); wf.className = "wa-float"; wf.dataset.waFloat = ""; wf.target = "_blank"; wf.rel = "noopener"; wf.setAttribute("aria-label", "راسلنا على واتساب"); wf.innerHTML = '<svg viewBox="0 0 24 24" width="30" height="30"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm4.4 12c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8 1c-.1.2-.3.2-.5.1a6.5 6.5 0 0 1-3.2-2.8c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.4-.6 1.6-1.2.2-.6.2-1 .1-1.2z"/></svg>'; document.body.appendChild(wf); }
      wf.href = `https://wa.me/${C.whatsapp}`;
    } else if (wf) wf.remove();
    $("[data-tagline]").textContent = C.tagline;
    $("[data-address]").textContent = C.address;
    $("[data-wa]").href = `https://wa.me/${C.whatsapp}`;
    $("[data-fb]").href = C.facebook;
    $("[data-ig]").href = C.instagram;
  }
  const closeMenu = () => { $("[data-drawer]").hidden = true; closeExplorer(true); };
  // ---------- products explorer: the page blurs, the main groups pop up; picking one lifts it to the top and its sections appear ----------
  let kx = null;
  const GROUP_IC = ["🥊", "🏋️", "⚽", "🎒", "🏃", "🧤", "🎾", "🏊"];
  const gIcon = (g, i) => { const m = ((S.design.kx || {}).gIcons || {})[g.name]; return m ? String(m).slice(0, 4) : GROUP_IC[i % GROUP_IC.length]; };
  function openExplorer() {
    if (kx) { closeExplorer(); return; }
    const K = (S.design && S.design.kx) || {}, pk = (v, l, d) => (l.includes(v) ? v : d), num = (v, d, lo, hi) => (v === "" || v == null || isNaN(+v) ? d : Math.min(hi, Math.max(lo, +v)));
    const el = document.createElement("div");
    el.className = `kx kg-${pk(K.gStyle, ["cards", "words", "grid", "circles"], "cards")} kc-${pk(K.cStyle, ["tiles", "circles", "list"], "tiles")} ka-${pk(K.anim, ["pop", "slide", "zoom", "fade", "flip", "drop"], "pop")}${K.counts === false ? " no-counts" : ""}${K.icons === false ? " no-icons" : ""}`;
    const sp = { fast: 0.6, normal: 1, slow: 1.6 }[pk(K.speed, ["fast", "normal", "slow"], "normal")];
    el.style.cssText = `--kx-blur:${num(K.blur, 16, 0, 40)}px;--kx-dim:${num(K.dim, 45, 0, 90) / 100};--kx-sp:${sp};--kx-cols:${num(K.cCols, 2, 1, 4)};--kx-cs:${num(K.cStart, 45, 0, 75)};--kx-gpos:${{ top: "flex-start", center: "center", bottom: "flex-end" }[pk(K.gPos, ["top", "center", "bottom"], "center")]}${/^#[0-9a-f]{6}$/i.test(K.tint || "") ? `;--kx-tint:${K.tint}` : ""}`;
    el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "الأقسام");
    el.innerHTML = `<div class="kx-bg" data-kx-close></div><div class="kx-in"><div class="kx-top"><button type="button" class="kx-back" data-kx-back hidden aria-label="رجوع">‹ رجوع</button><span class="kx-title" data-kx-title></span><button type="button" class="kx-x" data-kx-close aria-label="إغلاق">✕</button></div><div class="kx-stage" data-kx-stage></div></div>`;
    document.body.appendChild(el); document.documentElement.classList.add("kx-open"); kx = { el };
    showGroups(true);
    el.addEventListener("click", onKx);
  }
  function closeExplorer(now) {
    if (!kx) return; const el = kx.el; kx = null;
    document.documentElement.classList.remove("kx-open");
    if (now) { el.remove(); return; }
    el.classList.add("out"); setTimeout(() => el.remove(), 320);
  }
  function showGroups(first) {
    const st = kx.el.querySelector("[data-kx-stage]"); kx.g = null;
    kx.el.querySelector("[data-kx-back]").hidden = true; kx.el.querySelector("[data-kx-title]").textContent = "";
    const total = products.length;
    st.className = "kx-stage kx-groups";
    st.innerHTML = C.groups.map((g, i) => {
      const n = g.cats.reduce((a, c) => a + ((cats.find((x) => x.name === c) || {}).count || 0), 0);
      return `<button type="button" class="kx-g" data-kx-g="${i}" style="--i:${i}"><span class="kx-ic">${esc(gIcon(g, i))}</span><b>${esc(g.name)}</b><small>${n} منتج</small></button>`;
    }).join("") + `<a class="kx-g kx-all" href="#/all" style="--i:${C.groups.length}"><span class="kx-ic">🛍️</span><b>كل المنتجات</b><small>${total} منتج</small></a>`;
    if (!first) st.querySelectorAll(".kx-g").forEach((x) => x.classList.add("again"));
  }
  function showCats(i, btn) {
    const g = C.groups[i]; if (!g) return; kx.g = i;
    const st = kx.el.querySelector("[data-kx-stage]"), title = kx.el.querySelector("[data-kx-title]");
    // the chosen word flies up to the title, the others fade away
    const from = btn.getBoundingClientRect();
    title.innerHTML = `<span class="kx-ic">${esc(gIcon(g, i))}</span>${esc(g.name)}`;
    const to = title.getBoundingClientRect();
    st.querySelectorAll(".kx-g").forEach((x) => { if (x !== btn) x.classList.add("gone"); });
    if (title.animate && !document.documentElement.classList.contains("reduce")) title.animate([{ transform: `translate(${from.left - to.left}px,${from.top - to.top}px) scale(1.15)`, opacity: 0.6 }, { transform: "none", opacity: 1 }], { duration: 420, easing: "cubic-bezier(.2,.8,.2,1)" });
    btn.classList.add("lift");
    kx.el.querySelector("[data-kx-back]").hidden = false;
    setTimeout(() => {
      if (!kx || kx.g !== i) return;
      const list = g.cats.map((c) => cats.find((x) => x.name === c)).filter(Boolean);
      st.className = "kx-stage kx-cats";
      st.innerHTML = list.map((c, k) => `<a class="kx-c" href="${cHref(c.name)}" style="--i:${k}"><span class="kx-cimg">${c.image ? `<img src="${esc(img(c.image))}" alt="" loading="lazy">` : ""}</span><b>${esc(catLabel(c.name))}</b><small>${c.count}</small></a>`).join("") || `<p class="kx-empty">ما في أقسام هون</p>`;
    }, 260);
  }
  function onKx(e) {
    if (e.target.closest("[data-kx-close]")) { closeExplorer(); return; }
    if (e.target.closest("[data-kx-back]")) { showGroups(false); return; }
    const g = e.target.closest("[data-kx-g]"); if (g) { showCats(+g.dataset.kxG, g); return; }
    if (e.target.closest("a[href]")) setTimeout(() => closeExplorer(), 0);
  }
  addEventListener("keydown", (e) => { if (e.key === "Escape" && kx) closeExplorer(); });
  addEventListener("hashchange", () => { if (kx) closeExplorer(); });
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-action=dark]")) { if (window.KOFx) KOFx.toggle(); return; }
    if (e.target.closest("[data-action=cur]")) { toggleCur(); return; }
    if (e.target.closest(".bnav [data-action=menu]") && bnMenuTo() === "browse") { e.preventDefault(); if (kx) closeExplorer(true); closeMenu(); navTo("#/browse"); return; }
    if (e.target.closest(".bnav [data-action=menu]") && bnMenuTo() === "drawer") { e.preventDefault(); if (kx) closeExplorer(true); $("[data-drawer]").hidden = false; return; }
    if (e.target.closest("[data-action=explore]") || (e.target.closest("[data-action=menu]") && (S.design.kx || {}).on !== false)) { e.preventDefault(); openExplorer(); return; }
    if (kx && e.target.closest(".bnav")) closeExplorer();
    if (e.target.closest("[data-action=menu]")) $("[data-drawer]").hidden = false;
    if (e.target.closest("[data-action=search]")) { const t = $(".top"); t.classList.toggle("so"); if (t.classList.contains("so")) $("[data-search] input").focus(); }
    if (e.target.closest("[data-action=close-menu]") || e.target.matches("[data-drawer]")) closeMenu();
    const now = e.target.closest("[data-buynow]");
    if (now) { addToCart(now.dataset.buynow, "", 1, true); navTo("#/checkout"); return; }
    if (e.target.closest("[data-ann-close]")) { try { localStorage.setItem("ko_ann_closed", C.announcement || ""); } catch {} $("[data-announce]").hidden = true; return; }
    const add = e.target.closest("[data-add]");
    if (add) { addToCart(add.dataset.add, "", 1); flyToCart(add); }
  });
  $("[data-search]").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = e.target.q.value.trim();
    if (q) navTo("#/search/" + encodeURIComponent(q));
  });
  window.addEventListener("hashchange", route);

  // ---------- full-screen photo viewer: swipe between photos, pinch / double-tap to zoom the photo only ----------
  function openViewer(pics, start, name) {
    const v = document.createElement("div");
    v.className = "viewer"; v.setAttribute("role", "dialog"); v.setAttribute("aria-label", name || "الصور");
    v.innerHTML = `<button class="v-close" aria-label="إغلاق">✕</button>
      ${pics.length > 1 ? `<span class="v-count"></span><button class="v-nav v-prev" aria-label="السابقة">‹</button><button class="v-nav v-next" aria-label="التالية">›</button>` : ""}
      <div class="v-track" dir="ltr">${pics.map((u) => `<div class="v-slide"><img src="${esc(u)}" alt="" draggable="false"></div>`).join("")}</div>
      ${pics.length > 1 ? `<div class="dots v-dots" dir="ltr">${pics.map(() => "<span></span>").join("")}</div>` : ""}`;
    document.body.appendChild(v);
    document.documentElement.classList.add("viewer-open");
    const track = v.querySelector(".v-track");
    let cur = start, z = { s: 1, x: 0, y: 0 };
    const imgOf = (i) => track.children[i].firstElementChild;
    const apply = (anim) => {
      const im = imgOf(cur);
      im.style.transition = anim ? "transform .25s" : "none";
      im.style.transform = `translate(${z.x}px,${z.y}px) scale(${z.s})`;
      track.style.overflowX = z.s > 1 ? "hidden" : "auto";
      v.classList.toggle("zoomed", z.s > 1);
    };
    const reset = () => { z = { s: 1, x: 0, y: 0 }; apply(true); };
    const clamp = () => {
      const im = imgOf(cur), w = im.offsetWidth, h = im.offsetHeight;
      const mx = Math.max(0, (w * z.s - innerWidth) / 2), my = Math.max(0, (h * z.s - innerHeight) / 2);
      z.x = Math.min(mx, Math.max(-mx, z.x)); z.y = Math.min(my, Math.max(-my, z.y));
    };
    const zoomAt = (s, cx, cy) => {
      const im = imgOf(cur), r = im.getBoundingClientRect();
      const ox = cx - (r.left + r.width / 2), oy = cy - (r.top + r.height / 2);
      const k = s / z.s;
      z.x += ox * (1 - k); z.y += oy * (1 - k); z.s = s;
      if (s <= 1) z = { s: 1, x: 0, y: 0 }; clamp();
    };
    const show = (i) => {
      cur = Math.max(0, Math.min(pics.length - 1, i));
      const c = v.querySelector(".v-count"); if (c) c.textContent = `${cur + 1}/${pics.length}`;
      v.querySelectorAll(".v-dots span").forEach((d, k) => d.classList.toggle("on", k === cur));
    };
    requestAnimationFrame(() => { track.scrollLeft = start * track.clientWidth; show(start); });
    track.addEventListener("scroll", () => {
      const i = Math.round(track.scrollLeft / track.clientWidth);
      if (i !== cur) { imgOf(cur).style.transform = ""; z = { s: 1, x: 0, y: 0 }; show(i); }
    }, { passive: true });
    // touch: pinch + pan + double tap
    let pinch = null, pan = null, lastTap = 0;
    const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    track.addEventListener("touchstart", (e) => {
      if (e.touches.length === 2) {
        pinch = { d: dist(e.touches), s: z.s, cx: (e.touches[0].clientX + e.touches[1].clientX) / 2, cy: (e.touches[0].clientY + e.touches[1].clientY) / 2 };
        pan = null;
      } else if (e.touches.length === 1) {
        const t = e.touches[0], now = Date.now();
        if (now - lastTap < 280) { e.preventDefault(); z.s > 1 ? reset() : (zoomAt(2.5, t.clientX, t.clientY), apply(true)); lastTap = 0; return; }
        lastTap = now;
        if (z.s > 1) pan = { x: t.clientX - z.x, y: t.clientY - z.y };
      }
    }, { passive: false });
    track.addEventListener("touchmove", (e) => {
      if (pinch && e.touches.length === 2) {
        e.preventDefault();
        const s = Math.min(4, Math.max(1, (pinch.s * dist(e.touches)) / pinch.d));
        zoomAt(s, pinch.cx, pinch.cy); apply(false);
      } else if (pan && e.touches.length === 1 && z.s > 1) {
        e.preventDefault();
        z.x = e.touches[0].clientX - pan.x; z.y = e.touches[0].clientY - pan.y; clamp(); apply(false);
      }
    }, { passive: false });
    track.addEventListener("touchend", (e) => { if (e.touches.length < 2) pinch = null; if (!e.touches.length) pan = null; if (z.s < 1.05 && z.s !== 1) reset(); });
    // mouse: click to zoom in/out where you click, drag to move, wheel to zoom
    let drag = null, moved = false;
    track.addEventListener("mousedown", (e) => { if (z.s > 1) { drag = { x: e.clientX - z.x, y: e.clientY - z.y }; moved = false; e.preventDefault(); } });
    addEventListener("mousemove", onMove);
    function onMove(e) { if (drag) { moved = true; z.x = e.clientX - drag.x; z.y = e.clientY - drag.y; clamp(); apply(false); } }
    addEventListener("mouseup", onUp);
    function onUp() { drag = null; }
    track.addEventListener("click", (e) => {
      if (!e.target.closest("img") || moved) { moved = false; return; }
      if ("ontouchstart" in window) return;
      z.s > 1 ? reset() : (zoomAt(2.5, e.clientX, e.clientY), apply(true));
    });
    track.addEventListener("wheel", (e) => { e.preventDefault(); zoomAt(Math.min(4, Math.max(1, z.s * (e.deltaY < 0 ? 1.15 : 0.87))), e.clientX, e.clientY); apply(false); }, { passive: false });
    const go = (d) => { reset(); track.scrollTo({ left: (cur + d) * track.clientWidth, behavior: "smooth" }); };
    v.querySelector(".v-prev")?.addEventListener("click", () => go(-1));
    v.querySelector(".v-next")?.addEventListener("click", () => go(1));
    const close = () => {
      v.remove(); document.documentElement.classList.remove("viewer-open");
      removeEventListener("mousemove", onMove); removeEventListener("mouseup", onUp); removeEventListener("keydown", onKey); removeEventListener("hashchange", close);
    };
    function onKey(e) { if (e.key === "Escape") close(); if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); }
    addEventListener("keydown", onKey); addEventListener("hashchange", close);
    v.querySelector(".v-close").addEventListener("click", close);
  }

  // Page itself never zooms (only photos in the viewer do)
  document.addEventListener("gesturestart", (e) => { if (!e.target.closest || !e.target.closest(".viewer")) e.preventDefault(); });
  document.addEventListener("touchmove", (e) => { if (e.touches.length > 1 && !(e.target.closest && e.target.closest(".viewer"))) e.preventDefault(); }, { passive: false });

  // ---------- reveal animations ----------
  const animOn = document.documentElement.classList.contains("anim") && "IntersectionObserver" in window;
  const io = animOn && new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { const el = en.target; el.classList.add("in"); io.unobserve(el); setTimeout(() => { el.classList.remove("rv", "in"); el.style.removeProperty("--i"); el.dataset.rvd = "1"; }, 1100); } }), { rootMargin: "0px 0px -6% 0px" });
  let revealQueued = false;
  function reveal() {
    revealQueued = false;
    const els = app.querySelectorAll(".card:not(.rv):not([data-rvd]),.cat-tile:not(.rv):not([data-rvd]),.sec-head:not(.rv):not([data-rvd]),.page-title:not(.rv):not([data-rvd]),.pdp>*:not(.rv):not([data-rvd]),.lines:not(.rv):not([data-rvd]),.summary:not(.rv):not([data-rvd]),.form:not(.rv):not([data-rvd]),.done:not(.rv):not([data-rvd]),.empty:not(.rv):not([data-rvd])");
    let i = 0;
    els.forEach((el) => {
      // items inside sideways lists / carousels are moved by their own effect: a fade-in there would pop in late while swiping
      if (el.closest(".car,.row,.spot,.t-row,.slider")) { el.dataset.rvd = "1"; return; }
      el.classList.add("rv"); el.style.setProperty("--i", Math.min(i++, 6)); io.observe(el);
    });
  }
  if (animOn) new MutationObserver(() => { if (!revealQueued) { revealQueued = true; requestAnimationFrame(reveal); } }).observe(app, { childList: true, subtree: true });

  // ---------- boot ----------
  const snapStore = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
  let booted = false, snapStr = snapStore.get("ko_snap_products");
  const snapSettings = window.__koSnap;
  // if the design saved on this device is older than the one the server just sent, don't paint the old one first
  const srvD = window.__koD;
  const snapStale = !!(srvD && snapSettings && Object.keys(srvD).some((k) => JSON.stringify(srvD[k]) !== JSON.stringify((snapSettings.design || {})[k])));
  // the page head may carry only the critical CSS while the full stylesheet is still arriving: draw nothing before it is in
  const cssReady = new Promise((res) => {
    const l = document.querySelector("link[data-kocss]");
    if (!l || window.__koCss || l.media === "all") return res();
    document.addEventListener("ko:css", res, { once: true });
    setTimeout(res, 5000);
  });
  const fresh = fetchFresh(); fresh.catch(() => {}); // the data keeps loading meanwhile
  cssReady.then(() => {
  if (snapSettings && snapSettings.store && snapStr && !snapStale) {
    try { setData(snapSettings, JSON.parse(snapStr)); chrome(); renderCount(); route(); booted = true; } catch {}
  }
  fresh.then(([st, data]) => {
    const dataStr = JSON.stringify(data), stStr = JSON.stringify(st);
    const changed = dataStr !== snapStr || stStr !== JSON.stringify(snapSettings);
    snapStore.set("ko_snap_settings", stStr);
    snapStore.set("ko_snap_products", dataStr);
    if (!booted) { setData(st, data); chrome(); renderCount(); route(); return; }
    if (changed) {
      setData(st, data); chrome(); renderCount();
      if (!/^\/(checkout|done)/.test(curRoute())) route(null, true);
    }
  }).catch((err) => {
    try { console.error("KO boot", err && err.stack || err); } catch {}
    if (!booted) app.innerHTML = `<div class="empty"><b>ما قدرنا نحمّل المنتجات</b>حدّث الصفحة أو راسلنا على واتساب.</div>`;
  });
  });
})();
