/* PWA: service worker, "install the app" bar, and push notifications */
(function () {
  var get = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
  var set = function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} };
  var swOk = "serviceWorker" in navigator && location.protocol !== "file:";
  if (swOk) window.addEventListener("load", function () { navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(function () {}); });

  // ---- push helper (also used by the dashboard) ----
  var KOPush = window.KOPush = {
    supported: function () { return swOk && "PushManager" in window && "Notification" in window; },
    permission: function () { return "Notification" in window ? Notification.permission : "denied"; },
    reg: function () { return navigator.serviceWorker.ready; },
    current: function () { return KOPush.reg().then(function (r) { return r.pushManager.getSubscription(); }); },
    // auth = dashboard password (marks this phone as an "admin" device that gets new-order alerts)
    subscribe: function (auth) {
      return fetch("/api/push/key").then(function (r) { return r.json(); }).then(function (cfg) {
        if (!cfg.key) throw new Error("no key");
        return Notification.requestPermission().then(function (p) {
          if (p !== "granted") throw new Error("denied");
          return KOPush.reg();
        }).then(function (reg) {
          var raw = atob(cfg.key.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((cfg.key.length + 3) % 4));
          var key = new Uint8Array(raw.length); for (var i = 0; i < raw.length; i++) key[i] = raw.charCodeAt(i);
          return reg.pushManager.getSubscription().then(function (old) {
            if (old && old.options && old.options.applicationServerKey) {
              var a = new Uint8Array(old.options.applicationServerKey), same = a.length === key.length;
              for (var j = 0; same && j < a.length; j++) if (a[j] !== key[j]) same = false;
              if (!same) return old.unsubscribe().then(function () { return null; });
            }
            return old;
          }).then(function (s) { return s || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }); });
        });
      }).then(function (s) {
        var h = { "content-type": "application/json" }; if (auth) h.authorization = "Bearer " + auth;
        return fetch("/api/push/subscribe", { method: "POST", headers: h, body: JSON.stringify({ subscription: s.toJSON() }) }).then(function (r) {
          if (!r.ok) throw new Error("server"); return s;
        });
      });
    },
    unsubscribe: function () {
      return KOPush.current().then(function (s) {
        if (!s) return;
        var ep = s.endpoint;
        return s.unsubscribe().then(function () { return fetch("/api/push/unsubscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: ep }) }); });
      });
    },
  };

  // ---- the bar itself (the dashboard preview uses the same builder) ----
  var BDEF = { install: true, notif: true, style: "bar", theme: "dark", icon: "logo", image: "", title: "", text: "", btn: "", nTitle: "", nText: "", nBtn: "", again: 7, devices: "all", hideAfter: 0, pages: "all" };
  var KOBar = window.KOBar = {
    DEF: BDEF,
    make: function (B, mode) {
      B = Object.assign({}, BDEF, B || {});
      var t, s, g;
      if (mode === "notif") { t = B.nTitle || "فعّل إشعارات العروض"; s = B.nText || "اعرف أول بأول بالمنتجات الجديدة والتخفيضات"; g = B.nBtn || "تفعيل"; }
      else if (mode === "combined") { t = B.title || "ثبّت التطبيق وفعّل الإشعارات"; s = B.text || "أسرع من شاشتك الرئيسية، وتوصلك العروض والمنتجات الجديدة على جوالك"; g = B.btn || "تثبيت + تفعيل"; }
      else if (mode === "install") { t = B.title || "ثبّت تطبيق KO SPORT"; s = B.text || "وصول أسرع من شاشتك الرئيسية"; g = B.btn || "تثبيت"; }
      else { t = B.title || "ثبّت تطبيق KO SPORT"; s = B.text || "اضغط مشاركة ثم «إضافة إلى الشاشة الرئيسية»، وبعدها فعّل الإشعارات من التطبيق"; g = ""; }
      var el = document.createElement("div");
      el.className = "pwa-bar pb-" + B.style + " pb-" + B.theme; el.setAttribute("role", "dialog");
      var ic;
      if (B.icon === "bell") { ic = document.createElement("span"); ic.className = "pwa-bell"; ic.textContent = "🔔"; ic.setAttribute("aria-hidden", "true"); }
      else { ic = document.createElement("img"); ic.alt = ""; ic.width = 40; ic.height = 40; ic.src = B.icon === "image" && B.image ? B.image : (window.__koIcon || "/assets/icons/icon-192.png"); }
      var box = document.createElement("div"); box.className = "pwa-t";
      var b = document.createElement("b"); b.textContent = t; var sp = document.createElement("span"); sp.textContent = s; box.appendChild(b); box.appendChild(sp);
      el.appendChild(ic); el.appendChild(box);
      var go = null; if (g) { go = document.createElement("button"); go.type = "button"; go.className = "pwa-go"; go.textContent = g; el.appendChild(go); }
      var x = document.createElement("button"); x.type = "button"; x.className = "pwa-x"; x.setAttribute("aria-label", "إغلاق"); x.textContent = "✕"; el.appendChild(x);
      return { el: el, go: go, x: x, title: b, sub: sp };
    },
  };

  if (/\/admin/.test(location.pathname) || /[?&]preview/.test(location.search)) return;
  var standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  var pushOk = KOPush.supported() && !(ios && !standalone);      // iPhone supports push only inside the installed app
  var cfg = { prompt: true, delay: 1, bar: BDEF }, B = BDEF, dp = null, cur = null, shown = false, busy = false, gone = false, t0 = Date.now();
  var recent = function (k) { return B.again > 0 && Date.now() - (+get(k) || 0) < B.again * 864e5; };
  var canAsk = function () { return pushOk && KOPush.permission() === "default"; };
  var onHome = function () { var h = location.hash.replace(/^#/, ""); return h === "" || h === "/" || h === "/home"; };

  function hide(key) {
    if (cur) { var c = cur; cur = null; c.el.classList.remove("on"); setTimeout(function () { c.el.remove(); }, 450); clearTimeout(c.timer); }
    if (key) { gone = true; if (B.again > 0) set(key, String(Date.now())); }
  }
  function pick() {
    var inst = B.install !== false, wantN = B.notif !== false && canAsk();
    if (dp && inst && !recent("ko_pwa_x")) return wantN ? "combined" : "install";
    if (!dp && ios && !standalone && inst && !recent("ko_pwa_x")) return "ios";
    if (wantN && (get("ko_push_want") || !recent("ko_push_x"))) return "notif";
    return null;
  }
  function done(msg, sub) { busy = true; if (cur) { cur.title.textContent = msg; cur.sub.textContent = sub || ""; if (cur.go) cur.go.remove(); } setTimeout(function () { hide(""); busy = false; gone = true; }, 2600); }
  function render() {
    if (!shown || busy || gone || document.hidden) return;
    if (cfg.prompt === false) return;
    if (B.pages === "home" && !onHome()) return;
    var mode = pick();
    if (!mode) { hide(""); return; }
    if (cur && cur.mode === mode) return;
    hide("");
    var c = KOBar.make(B, mode); c.mode = mode; cur = c;
    document.body.appendChild(c.el);
    requestAnimationFrame(function () { requestAnimationFrame(function () { c.el.classList.add("on"); }); });
    var key = mode === "notif" ? "ko_push_x" : "ko_pwa_x";
    c.x.onclick = function () { hide(key); };
    if (B.hideAfter > 0) c.timer = setTimeout(function () { if (cur === c && !busy) { hide(""); gone = true; } }, B.hideAfter * 1000);
    if (!c.go) return;
    c.go.onclick = function () {
      c.go.disabled = true; busy = true;
      if (mode === "notif") {
        KOPush.subscribe().then(function () { set("ko_push_want", ""); done("تم تفعيل الإشعارات ✓", "رح توصلك أحدث العروض"); }, function () { busy = false; hide(key); });
        return;
      }
      var e = dp; dp = null;
      e.prompt();                                                  // must run inside the tap
      e.userChoice.then(function (r) {
        if (r.outcome !== "accepted") { busy = false; hide(key); return; }
        var both = mode === "combined";
        if (both) set("ko_push_want", "1");                        // if the browser blocks the permission pop-up now, the installed app asks on its first open
        var p = both ? KOPush.subscribe().then(function () { set("ko_push_want", ""); return true; }, function () { return false; }) : Promise.resolve(false);
        p.then(function (on) { done("تم تثبيت التطبيق ✓", on ? "وتم تفعيل الإشعارات" : ""); });
      }).catch(function () { busy = false; hide(""); });
    };
  }

  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); dp = e; render(); });   // may arrive after the bar is already up → upgrade it
  window.addEventListener("appinstalled", function () { dp = null; if (!busy) hide(""); });
  window.addEventListener("hashchange", function () { render(); });

  if (pushOk && KOPush.permission() === "granted") KOPush.subscribe().catch(function () {});   // keep the subscription fresh
  var mobile = /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) || matchMedia("(pointer:coarse)").matches;
  fetch("/api/push/key").then(function (r) { return r.json(); }).catch(function () { return null; }).then(function (c) {
    if (c && c.bar) { cfg = c; B = Object.assign({}, BDEF, c.bar); }
    if (B.devices === "mobile" && !mobile) return;
    var wait = Math.max(0, (+cfg.delay >= 0 ? +cfg.delay : 1) * 1000 - (Date.now() - t0));
    if (get("ko_push_want") && standalone) wait = Math.min(wait, 800);
    setTimeout(function () { shown = true; render(); }, wait);
  });
})();
