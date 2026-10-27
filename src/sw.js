/* KO SPORT service worker — fast repeat visits + offline fallback.
   Products/prices are always fetched fresh from the network first. */
const V = "ko-v115";
const SHELL = "ko-shell-" + V, ASSET = "ko-assets-" + V, IMG = "ko-img-" + V, DATA = "ko-data-" + V;
const KEEP = [SHELL, ASSET, IMG, DATA];

// No pre-caching of the home page: a stored copy of "/" is what used to keep showing an old
// shop after the owner saved. The home page is only kept as an offline fallback, after a real visit.
self.addEventListener("install", (e) => { self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    let upgraded = false;
    for (const k of await caches.keys()) if (!KEEP.includes(k)) { await caches.delete(k); upgraded = true; }
    await self.clients.claim();
    // An open page (also inside the Android app) may still be an old copy: reload it once with the new version.
    // Never in the middle of checkout or the dashboard, so nobody loses what they typed.
    if (upgraded) for (const w of await self.clients.matchAll({ type: "window" })) {
      try { if (!/\/(checkout|done)|admin/.test(new URL(w.url).pathname)) w.navigate(w.url); } catch (e) {}
    }
  })());
});

async function trim(name, max) {
  const c = await caches.open(name), ks = await c.keys();
  for (let i = 0; i < ks.length - max; i++) await c.delete(ks[i]);
}
async function networkFirst(req, name, timeout) {
  // Ask the network first. If it is slow, show the last saved copy (when there is one) and let the
  // fresh copy land in the cache for the next open; with no saved copy, just keep waiting for the network.
  const c = await caches.open(name);
  const net = fetch(req).then((r) => { if (r && r.ok) c.put(req, r.clone()); return r; });
  net.catch(() => {});
  let timer;
  const slow = new Promise((res) => { timer = setTimeout(() => res("slow"), timeout || 3000); });
  try {
    const first = await Promise.race([net, slow]);
    if (first !== "slow") { clearTimeout(timer); return first; }
    const hit = await c.match(req);
    return hit || (await net);
  } catch (err) {
    clearTimeout(timer);
    const hit = await c.match(req);
    if (hit) return hit;
    throw err;
  }
}
async function cacheFirst(req, name, max) {
  const c = await caches.open(name);
  const hit = await c.match(req);
  if (hit) return hit;
  const r = await fetch(req);
  if (r && r.ok) { c.put(req, r.clone()); if (max) trim(name, max); }
  return r;
}
async function swr(req, name, max) {
  const c = await caches.open(name);
  const hit = await c.match(req);
  const net = fetch(req).then((r) => { if (r && r.ok) { c.put(req, r.clone()); trim(name, max); } return r; }).catch(() => null);
  return hit || (await net) || Response.error();
}

self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  const p = url.pathname;
  if (p.startsWith("/admin") || p.startsWith("/media/") || p === "/sw.js" || p === "/reset" || p === "/review" || p === "/map" || p.startsWith("/api/diag") || req.headers.has("range")) return;

  // pages: network first, fall back to the last cached home page
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      try {
        // On a slow connection (no answer in 3.5 s) the last saved copy of this page opens at once,
        // and the fresh one is stored for next time. Always ask the server (cache:"no-cache"), never a page the browser stored earlier, so a visitor never sees an old design
        const r = await networkFirst(new Request(req.url, { cache: "no-cache", credentials: "same-origin", redirect: "manual" }), SHELL, 3500);
        trim(SHELL, 25); // every /ar/… address is its own entry now
        return r;
      } catch {
        const c = await caches.open(SHELL);
        return (await c.match(req)) || (await c.match("/")) ||
          new Response("<meta charset=utf-8><meta name=viewport content='width=device-width'><body style='font-family:sans-serif;text-align:center;padding:3rem;background:#121212;color:#fff'><h2>لا يوجد اتصال بالإنترنت</h2><p>تحقق من الشبكة وحاول مرة أخرى.</p>",
            { status: 503, headers: { "content-type": "text/html;charset=utf-8" } });
      }
    })());
    return;
  }
  if (p.startsWith("/api/")) {
    // only catalogue/settings reads are cached; everything else goes straight to the network
    if (p === "/api/products" || p === "/api/settings") e.respondWith(networkFirst(new Request(url.origin + p, req), DATA, 4000));
    return;
  }
  if (p.startsWith("/assets/")) { e.respondWith(url.searchParams.has("v") ? cacheFirst(req, ASSET, 80) : swr(req, ASSET, 80)); return; }
  if (p.startsWith("/img/") || p.startsWith("/cdn-cgi/image/")) { e.respondWith(swr(req, IMG, 200)); return; }
  if (/\.(png|svg|webmanifest|woff2?)$/.test(p)) e.respondWith(swr(req, ASSET, 80));
});

// ---- push notifications ----
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : "" }; }
  const opt = {
    body: d.body || "", icon: "/assets/icons/icon-192.png", badge: "/assets/icons/badge-96.png",
    dir: "rtl", lang: "ar", data: { url: d.url || "/" }, timestamp: d.ts || Date.now(),
  };
  if (d.image) opt.image = d.image;
  if (d.tag) { opt.tag = d.tag; opt.renotify = true; }
  e.waitUntil((async () => {
    try { const st = await (await fetch("/api/settings")).json(); if (st && st.design && st.design.appIcon192) opt.icon = st.design.appIcon192; } catch {}
    return self.registration.showNotification(d.title || "KO SPORT", opt);
  })());
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const to = new URL((e.notification.data && e.notification.data.url) || "/", self.location.origin).href;
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if (new URL(c.url).origin === self.location.origin) {
        try { await c.focus(); if ("navigate" in c) await c.navigate(to); return; } catch {}
      }
    }
    await self.clients.openWindow(to);
  })());
});
