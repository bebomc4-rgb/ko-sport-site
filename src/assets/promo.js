/* KOPromo — promotional ads set from the dashboard (popup / floating card / top banner) */
(function () {
  var LS = function (k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} return null; };
  var SS = function (k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) {} return null; };
  var live = {}, timers = [], handlers = [];

  function active(p, now) {
    if (!p || p.on === false) return false;
    var s = p.startAt && Date.parse(p.startAt), e = p.endAt && Date.parse(p.endAt);
    if (s && now < s) return false;
    if (e && now > e) return false;
    return !!(p.title || p.text || p.image);
  }
  function onHome() { var h = location.hash.replace(/^#/, ""); return h === "" || h === "/" || h === "/home"; }
  function freqOk(p) {
    var f = p.freq || "session", k = "ko_pm_" + p.id;
    if (f === "always") return true;
    if (f === "session") return !SS(k);
    var t = +LS(k) || 0;
    if (!t) return true;
    if (f === "once") return false;
    return Date.now() - t > (f === "week" ? 7 : 1) * 864e5;
  }
  function mark(p) { var f = p.freq || "session", k = "ko_pm_" + p.id; if (f === "session") SS(k, "1"); else if (f !== "always") LS(k, String(Date.now())); }
  function href(l) { l = String(l || ""); if (/^\/#\//.test(l)) return l.slice(1); if (/^(#|\/|https?:\/\/)/.test(l)) return l; return ""; }
  function el(tag, cls, txt) { var n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; }

  function countdown(p, root, onEnd) {
    var end = p.endAt && Date.parse(p.endAt);
    if (!p.countdown || !end) return null;
    var box = el("div", "pm-cd"), cells = {};
    [["d", "يوم"], ["h", "ساعة"], ["m", "دقيقة"], ["s", "ثانية"]].forEach(function (u) {
      var c = el("div"), b = el("b", "", "00"), s = el("small", "", u[1]); c.appendChild(b); c.appendChild(s); box.appendChild(c); cells[u[0]] = { b: b, c: c };
    });
    var pad = function (n) { return (n < 10 ? "0" : "") + n; };
    function tick() {
      var r = Math.max(0, Math.floor((end - Date.now()) / 1000));
      if (!r) { clearInterval(id); onEnd && onEnd(); return; }
      var d = Math.floor(r / 86400); cells.d.c.hidden = !d;
      cells.d.b.textContent = pad(d); cells.h.b.textContent = pad(Math.floor(r % 86400 / 3600)); cells.m.b.textContent = pad(Math.floor(r % 3600 / 60)); cells.s.b.textContent = pad(r % 60);
    }
    var id = setInterval(function () { if (!document.body.contains(root)) clearInterval(id); else tick(); }, 1000);
    tick();
    return box;
  }
  function copy(text, btn) {
    var ok = function () { var o = btn.textContent; btn.textContent = "تم النسخ ✓"; setTimeout(function () { btn.textContent = o; }, 1800); };
    try { navigator.clipboard.writeText(text).then(ok, fb); } catch (e) { fb(); }
    function fb() { var t = el("textarea"); t.value = text; t.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(t); t.select(); try { document.execCommand("copy"); ok(); } catch (e) {} t.remove(); }
  }

  function build(p, close, root) {
    var parts = [];
    if (p.badge) parts.push(el("span", "pm-badge", p.badge));
    if (p.title) parts.push(el("h3", "pm-title", p.title));
    if (p.text) parts.push(el("p", "pm-text", p.text));
    var cd = countdown(p, root, function () { close(true); }); if (cd) parts.push(cd);
    if (p.code) {
      var w = el("div", "pm-code"), c = el("code", "", p.code), b = el("button", "", "نسخ"); b.type = "button";
      b.onclick = function (e) { e.stopPropagation(); copy(p.code, b); };
      w.appendChild(c); w.appendChild(b); parts.push(w);
    }
    if (p.btn) {
      var h = href(p.link), a = el(h ? "a" : "button", "pm-btn", p.btn);
      if (h) { a.href = h; if (/^https?:/.test(h) && h.indexOf(location.origin) !== 0) { a.target = "_blank"; a.rel = "noopener"; } } else a.type = "button";
      a.addEventListener("click", function () { setTimeout(function () { close(); }, 50); });
      parts.push(a);
    }
    return parts;
  }

  function show(p, o) {
    o = o || {};
    var host = o.host || document.body, type = p.type || "popup", root, closed = false;
    var th = " th-" + (p.theme || "dark");
    function close(skipMark) {
      if (closed) return; closed = true;
      delete live[p.id];
      if (!o.preview && !skipMark && type === "banner") mark(p);
      root.classList.remove("on");
      document.removeEventListener("keydown", onKey, true);
      if (type === "popup") document.documentElement.classList.remove("pm-lock");
      setTimeout(function () { root.remove(); }, 520);
    }
    function onKey(e) { if (e.key === "Escape" && type === "popup") { e.preventDefault(); e.stopPropagation(); close(); } }
    var x = el("button", "pm-x", "✕"); x.type = "button"; x.setAttribute("aria-label", "إغلاق"); x.onclick = function () { close(); };
    if (type === "popup") {
      root = el("div", "pm-ov"); var box = el("div", "pm pm-popup" + th); box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true");
      if (p.image) { var im = el("div", "pm-img"), i = el("img"); i.src = p.image; i.alt = ""; i.decoding = "async"; im.appendChild(i); box.appendChild(im); }
      var body = el("div", "pm-body"); build(p, close, root).forEach(function (n) { body.appendChild(n); });
      var no = el("button", "pm-nothx", "لا، شكراً"); no.type = "button"; no.onclick = function () { close(); }; body.appendChild(no);
      box.appendChild(body); box.appendChild(x); root.appendChild(box);
      root.addEventListener("click", function (e) { if (e.target === root) close(); });
      document.documentElement.classList.add("pm-lock");
    } else if (type === "card") {
      root = el("div", "pm pm-card" + th); root.setAttribute("role", "dialog");
      if (p.image) { var im2 = el("div", "pm-img"), i2 = el("img"); i2.src = p.image; i2.alt = ""; im2.appendChild(i2); root.appendChild(im2); }
      var b2 = el("div", "pm-body"); build(p, close, root).forEach(function (n) { b2.appendChild(n); }); root.appendChild(b2); root.appendChild(x);
    } else {
      root = el("div", "pm pm-banner" + th); var inner = el("div"), bar = el("div", "pm-bar");
      build(p, close, root).forEach(function (n) { bar.appendChild(n); }); bar.appendChild(x); inner.appendChild(bar); root.appendChild(inner);
    }
    if (type === "banner" && host === document.body) host.insertBefore(root, host.firstChild); else host.appendChild(root);
    if (o.host && type === "banner") root.style.cssText = "position:fixed;top:0;left:0;right:0";
    document.addEventListener("keydown", onKey, true);
    requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.add("on"); }); });
    live[p.id] = close;
    if (!o.preview && type !== "banner") mark(p);
    return close;
  }

  function schedule(p) {
    var go = function () {
      if (live[p.id] || !active(p, Date.now())) return;
      if (p.pages !== "all" && !onHome()) { var re = function () { window.removeEventListener("hashchange", re); if (onHome()) go(); }; window.addEventListener("hashchange", re); return; }
      if ((p.type || "popup") !== "banner" && (document.querySelector(".pm-ov.on,.pm-card.on"))) { timers.push(setTimeout(go, 8000)); return; }
      if (!freqOk(p)) return;
      show(p);
    };
    var t = p.trigger || "load", d = Math.max(0, Math.min(120, +p.delay || 0)) * 1000;
    if (t === "scroll") {
      var f = function () { if (scrollY > innerHeight * 0.6) { removeEventListener("scroll", f); go(); } };
      addEventListener("scroll", f, { passive: true }); handlers.push(["scroll", f]);
    } else if (t === "exit") {
      var done = false, fire = function () { if (!done) { done = true; go(); } };
      var mo = function (e) { if (e.clientY <= 0 && !e.relatedTarget) { document.removeEventListener("mouseout", mo); fire(); } };
      document.addEventListener("mouseout", mo); handlers.push(["mouseout", mo, document]);
      if ("ontouchstart" in window) timers.push(setTimeout(fire, Math.max(d, 40000)));   // phones have no "leaving" gesture
    } else timers.push(setTimeout(go, d));
  }

  window.KOPromo = {
    show: show,
    init: function (list) {
      if (/[?&]preview=1/.test(location.search) || /\/admin/.test(location.pathname)) return;
      var sig = JSON.stringify(list || []);
      if (this._sig === sig) return; this._sig = sig;
      timers.forEach(clearTimeout); timers = [];
      handlers.forEach(function (h) { (h[2] || window).removeEventListener(h[0], h[1]); }); handlers = [];
      Object.keys(live).forEach(function (k) { live[k](true); });
      (list || []).slice(0, 20).forEach(function (p) { if (active(p, Date.now())) schedule(p); });
    },
  };
})();
