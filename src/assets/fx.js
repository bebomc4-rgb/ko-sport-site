/* KOFx — visual effects, animated backgrounds and the dark-mode button (settings: design.fx / bgfx / darkBtn / darkDefault / darkPos / darkPal) */
(function () {
  var D = document.documentElement, FX = {}, st = { prog: null, glow: null, top: null, dark: null, bg: null, timers: [], onScroll: false, onMove: false, onClick: false, mo: null, lastY: 0 };
  var HEX = /^#[0-9a-f]{6}$/i, pick = function (v, l, d) { return l.indexOf(v) > -1 ? v : d; };
  var reduce = function () { return D.classList.contains("reduce"); };
  var fine = matchMedia("(hover:hover) and (pointer:fine)").matches;
  var $ = function (s) { return document.querySelector(s); };

  // ---- theme (dark) ----
  FX.can = function (d) { return d && (d.darkBtn === true || (d.darkDefault || "light") !== "light" || ((d.bnav || {}).darkBtn !== false && (d.layout || {}).nav !== "off")); };
  FX.isDark = function (d) {
    if (!FX.can(d)) return false;
    var pref = null; try { pref = localStorage.getItem("ko_theme"); } catch (e) {}
    if (pref) return pref === "dark";
    var dd = d.darkDefault || "light";
    return dd === "dark" || (dd === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  };
  FX.toggle = function () {
    var now = D.getAttribute("data-theme") === "dark";
    try { localStorage.setItem("ko_theme", now ? "light" : "dark"); } catch (e) {}
    D.classList.add("fx-themeflip"); clearTimeout(st.flip); st.flip = setTimeout(function () { D.classList.remove("fx-themeflip"); }, 600);
    if (window.KOApplyDesign) window.KOApplyDesign();
  };
  var SVG = { moon: '<svg class="moon" viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" fill="currentColor"/></svg>', sun: '<svg class="sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.2" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' };
  // one small box inside the header holds the header buttons (currency switch, dark mode), so every header layout keeps its shape
  FX.tools = function (start) {
    var top = $(".top-in"); if (!top) return null;
    var t = top.querySelector(":scope > .hdr-tools");
    if (!t) { t = document.createElement("div"); t.className = "hdr-tools"; top.appendChild(t); }
    t.classList.toggle("pos-start", !!start);
    if (start && t !== top.firstElementChild) top.insertBefore(t, top.firstChild); else if (!start && t !== top.lastElementChild) top.appendChild(t);
    return t;
  };
  FX.toolsTidy = function () { var t = $(".top-in > .hdr-tools"); if (t && !t.children.length) t.remove(); };
  function darkBtn(d) {
    var pos = ["hdr-start", "hdr-end", "right", "left", "bnav"].indexOf(d.darkPos) > -1 ? d.darkPos : "hdr-end";
    if (pos === "bnav") pos = "hdr-end"; // in the bottom bar on phones (drawn by the shop); on big screens it stays in the header
    var inHdr = pos.indexOf("hdr") === 0;
    if (d.darkBtn !== true) { if (st.dark) { st.dark.remove(); st.dark = null; } FX.toolsTidy(); return; }
    var host = inHdr ? FX.tools(pos === "hdr-start") : document.body; if (!host) return;
    if (!st.dark) { var b = document.createElement("button"); b.type = "button"; b.setAttribute("aria-label", "الوضع الداكن"); b.innerHTML = SVG.moon + SVG.sun; b.onclick = FX.toggle; st.dark = b; }
    var el = st.dark;
    el.className = "fx-dark" + (inHdr ? " in-hdr" : "") + (pos === "left" ? " pos-left" : "") + (d.darkPos === "bnav" ? " in-bnav" : "");
    var px = +d.darkSize >= 28 && +d.darkSize <= 64 ? +d.darkSize : (inHdr ? 40 : 44); el.style.setProperty("--dk", px + "px");
    if (el.parentNode !== host) host.appendChild(el);
    FX.toolsTidy();
  }

  // ---- effects ----
  function setAttr(k, v) { if (v && v !== "default") D.setAttribute(k, v); else D.removeAttribute(k); }
  function apply(d, dark) {
    FX.d = d; var f = d.fx || {};
    setAttr("data-fx-reveal", pick(f.reveal, ["up", "fade", "zoom", "left", "right", "flip", "blur", "none"], "default") === "up" ? "" : pick(f.reveal, ["fade", "zoom", "left", "right", "flip", "blur", "none"], ""));
    setAttr("data-fx-page", pick(f.page, ["fade", "slide", "zoom", "none"], ""));
    setAttr("data-fx-card", pick(f.card, ["lift", "zoom", "glow", "tilt", "none"], ""));
    setAttr("data-fx-btn", pick(f.btn, ["shine", "pulse", "ripple"], ""));
    setAttr("data-fx-img", pick(f.img, ["fade", "blur"], ""));
    setAttr("data-fx-hdr", f.hideHeader === true ? "hide" : "");
    setAttr("data-fx-smooth", f.smooth === true ? "on" : "");
    D.style.setProperty("--rvd", { fast: ".3s", normal: ".55s", slow: ".95s" }[pick(f.speed, ["fast", "normal", "slow"], "normal")]);
    D.setAttribute("data-sdir", d.slideDir === "ltr" ? "ltr" : "rtl");
    D.setAttribute("data-theme", dark ? "dark" : "light");
    if (reduce()) { D.setAttribute("data-fx-reveal", "none"); }
    // extras
    toggleEl("prog", f.progress === true, function () { var e = document.createElement("div"); e.className = "fx-prog"; document.body.appendChild(e); return e; });
    toggleEl("glow", f.glow === true && fine && !reduce(), function () { var e = document.createElement("div"); e.className = "fx-glow"; document.body.appendChild(e); return e; });
    toggleEl("top", f.toTop === true, function () { var e = document.createElement("button"); e.type = "button"; e.className = "fx-top"; e.setAttribute("aria-label", "إلى الأعلى"); e.innerHTML = "↑"; e.onclick = function () { window.scrollTo({ top: 0, behavior: reduce() ? "auto" : "smooth" }); }; document.body.appendChild(e); return e; });
    wire(f); darkBtn(d); images(f);
    FX.confetti = f.confetti === true;
  }
  function toggleEl(k, on, make) { if (on) { if (!st[k]) st[k] = make(); } else if (st[k]) { st[k].remove(); st[k] = null; } }
  function wire(f) {
    if (!st.onScroll) {
      st.onScroll = true; var tick = false;
      addEventListener("scroll", function () {
        if (tick) return; tick = true;
        requestAnimationFrame(function () {
          tick = false; var y = scrollY, h = document.documentElement.scrollHeight - innerHeight;
          if (st.prog) st.prog.style.transform = "scaleX(" + (h > 0 ? Math.min(1, y / h) : 0) + ")";
          if (st.top) st.top.classList.toggle("on", y > 700);
          var hd = $(".top"); if (hd && D.getAttribute("data-fx-hdr") === "hide") hd.classList.toggle("fx-hid", y > st.lastY + 4 && y > 160 ? true : (y < st.lastY - 4 ? false : hd.classList.contains("fx-hid")));
          var bn = $(".bnav"); if (bn && D.getAttribute("data-bn-hide") === "on") bn.classList.toggle("bn-hide", y > st.lastY + 4 && y > 160 ? true : (y < st.lastY - 4 ? false : bn.classList.contains("bn-hide")));
          st.lastY = y;
        });
      }, { passive: true });
    }
    if (!st.onMove) {
      st.onMove = true; var raf = 0, px = 0, py = 0;
      addEventListener("pointermove", function (e) {
        if (e.pointerType !== "mouse") return;
        px = e.clientX; py = e.clientY;
        if (st.glow && !raf) raf = requestAnimationFrame(function () { raf = 0; st.glow.style.transform = "translate3d(" + px + "px," + py + "px,0)"; st.glow.classList.add("on"); });
        if (D.getAttribute("data-fx-card") === "tilt") {
          var c = e.target.closest && e.target.closest(".card");
          if (c) { var r = c.getBoundingClientRect(); c.style.setProperty("--ry", ((e.clientX - r.left) / r.width - .5) * 9 + "deg"); c.style.setProperty("--rx", (-((e.clientY - r.top) / r.height - .5)) * 9 + "deg"); }
        }
      }, { passive: true });
      document.addEventListener("pointerout", function (e) { var c = e.target.closest && e.target.closest(".card"); if (c && D.getAttribute("data-fx-card") === "tilt" && !(e.relatedTarget && c.contains(e.relatedTarget))) { c.style.setProperty("--rx", "0deg"); c.style.setProperty("--ry", "0deg"); } });
      document.addEventListener("mouseleave", function () { if (st.glow) st.glow.classList.remove("on"); });
    }
    if (!st.onClick) {
      st.onClick = true;
      document.addEventListener("pointerdown", function (e) {
        if (D.getAttribute("data-fx-btn") !== "ripple") return;
        var b = e.target.closest && e.target.closest(".btn,.add,.buy-now"); if (!b) return;
        var r = b.getBoundingClientRect(), s = Math.max(r.width, r.height) * 2, i = document.createElement("span");
        i.className = "fx-rip"; i.style.cssText = "width:" + s + "px;height:" + s + "px;left:" + (e.clientX - r.left - s / 2) + "px;top:" + (e.clientY - r.top - s / 2) + "px";
        b.appendChild(i); setTimeout(function () { i.remove(); }, 650);
      }, { passive: true });
      addEventListener("hashchange", function () { if (FX.confetti && /^#\/done\//.test(location.hash)) setTimeout(confetti, 350); });
    }
  }
  // images: mark as loaded so the fade/blur-in can play (never leaves an image hidden: a timer reveals everything after 3s)
  function images(f) {
    if (!pick(f.img, ["fade", "blur"], "")) { if (st.mo) { st.mo.disconnect(); st.mo = null; } return; }
    var mark = function (img) { if (img.classList.contains("ld")) return; if (img.complete) img.classList.add("ld"); else { img.addEventListener("load", function () { img.classList.add("ld"); }, { once: true }); img.addEventListener("error", function () { img.classList.add("ld"); }, { once: true }); setTimeout(function () { img.classList.add("ld"); }, 3000); } };
    var scan = function (root) { (root.querySelectorAll ? root.querySelectorAll("img") : []).forEach(mark); if (root.tagName === "IMG") mark(root); };
    var app = $("#app"); if (!app) return;
    scan(app);
    if (!st.mo) { st.mo = new MutationObserver(function (ms) { ms.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1) scan(n); }); }); }); st.mo.observe(app, { childList: true, subtree: true }); }
  }
  // ---- confetti ----
  function confetti() {
    if (reduce()) return;
    var c = document.createElement("canvas"); c.className = "fx-confetti"; document.body.appendChild(c);
    var x = c.getContext("2d"), W = c.width = innerWidth, H = c.height = innerHeight, cols = ["#d9232d", "#f2c230", "#16a34a", "#2563eb", "#a855f7", "#fff"], P = [];
    for (var i = 0; i < 140; i++) P.push({ x: W / 2 + (Math.random() - .5) * 120, y: H * .35, vx: (Math.random() - .5) * 14, vy: -Math.random() * 14 - 4, s: 5 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - .5) * .4, c: cols[i % cols.length] });
    var t0 = performance.now();
    (function f(t) {
      x.clearRect(0, 0, W, H); var age = t - t0;
      P.forEach(function (p) { p.vy += .32; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.vx *= .992; x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.globalAlpha = Math.max(0, 1 - age / 2800); x.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * .66); x.restore(); });
      if (age < 2800) requestAnimationFrame(f); else c.remove();
    })(t0);
  }
  // ---- how the page opens: the site assembles itself (design.open) ----
  var OPEN = ["up", "pieces", "cascade", "zoom", "fade", "flip", "curtain", "blur"];
  FX.open = function (force) {
    var o = (FX.d && FX.d.open) || {}, style = pick(o.style, OPEN, "none");
    if (style === "none" && !force) return;
    if (style === "none") style = "pieces";
    if (!force) {
      if (reduce() || /[?&]preview=1/.test(location.search) || !document.documentElement.animate) return;
      if (o.freq === "session") { try { if (sessionStorage.getItem("ko_open")) return; sessionStorage.setItem("ko_open", "1"); } catch (e) {} }
    }
    var dur = { fast: 450, normal: 800, slow: 1300 }[pick(o.speed, ["fast", "normal", "slow"], "normal")];
    var els = [].slice.call(document.querySelectorAll(".announce:not([hidden]), .top, #app > *, .foot")).filter(function (e) { return e.getClientRects().length; });
    var vh = innerHeight, vis = els.filter(function (e) { var r = e.getBoundingClientRect(); return r.top < vh * 1.1 && r.bottom > -50; }).slice(0, 14);
    var ease = "cubic-bezier(.2,.85,.25,1)", dirs = [[0, -120, 0], [140, 0, 4], [-140, 0, -4], [0, 120, 0], [120, 60, 6], [-120, 60, -6]];
    vis.forEach(function (e, i) {
      var fr, del = i * (style === "cascade" ? 110 : 70), isTop = e.classList.contains("top") || e.classList.contains("announce"), isFoot = e.classList.contains("foot") || e.classList.contains("bnav");
      if (style === "up") fr = [{ opacity: 0, transform: "translate3d(0,90px,0)" }, { opacity: 1, transform: "none" }];
      else if (style === "cascade") fr = [{ opacity: 0, transform: "translate3d(0,34px,0) scale(.98)" }, { opacity: 1, transform: "none" }];
      else if (style === "zoom") fr = [{ opacity: 0, transform: "scale(.82)" }, { opacity: 1, transform: "none" }];
      else if (style === "fade") fr = [{ opacity: 0 }, { opacity: 1 }];
      else if (style === "blur") fr = [{ opacity: 0, filter: "blur(18px)", transform: "scale(1.04)" }, { opacity: 1, filter: "blur(0)", transform: "none" }];
      else if (style === "flip") fr = [{ opacity: 0, transform: "perspective(900px) rotateX(-75deg) translate3d(0,40px,0)", transformOrigin: "50% 0" }, { opacity: 1, transform: "none", transformOrigin: "50% 0" }];
      else if (style === "curtain") fr = [{ clipPath: "inset(0 0 100% 0)", opacity: .2 }, { clipPath: "inset(0 0 0 0)", opacity: 1 }];
      else { var v = isTop ? dirs[0] : isFoot ? dirs[3] : dirs[1 + (i % 2) + (i > 3 ? 2 : 0)]; fr = [{ opacity: 0, transform: "translate3d(" + v[0] + "px," + v[1] + "px,0) rotate(" + v[2] + "deg) scale(.9)" }, { opacity: 1, transform: "none" }]; }
      try { e.animate(fr, { duration: dur, delay: del, easing: ease, fill: "backwards" }); } catch (err) {}
    });
  };
  FX.apply = apply;
  FX.confettiNow = function () { confetti(); };
  window.KOFx = FX;
})();
