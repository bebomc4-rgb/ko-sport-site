/* KOGames — small games page (memory, ball tap, wheel of fortune). Configured by design.games */
(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  function h(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} return null; }
  var day = function () { return new Date().toISOString().slice(0, 10); };

  function memory(box) {
    var E = ["⚽", "🏀", "🥊", "🏋️", "🥇", "🎾"], deck = E.concat(E).sort(function () { return Math.random() - .5; }), open = [], moves = 0, done = 0, lock = false;
    var info = h("div", "gm-info"), mv = h("b", "", "0"), best = ls("ko_gm_mem");
    info.appendChild(h("span", "", "الحركات: ")); info.appendChild(mv); if (best) info.appendChild(h("span", "gm-best", "أفضل نتيجة: " + best));
    var grid = h("div", "gm-mem"); box.appendChild(info); box.appendChild(grid);
    deck.forEach(function (em) {
      var c = h("button", "gm-card"); c.type = "button"; c.innerHTML = '<i class="f">?</i><i class="b"></i>'; c.lastChild.textContent = em; c.dataset.e = em;
      c.onclick = function () {
        if (lock || c.classList.contains("on") || c.classList.contains("ok")) return;
        c.classList.add("on"); open.push(c);
        if (open.length === 2) {
          moves++; mv.textContent = moves; lock = true;
          var a = open[0], b = open[1];
          if (a.dataset.e === b.dataset.e) { a.classList.add("ok"); b.classList.add("ok"); open = []; lock = false; if (++done === E.length) win(); }
          else setTimeout(function () { a.classList.remove("on"); b.classList.remove("on"); open = []; lock = false; }, 800);
        }
      };
      grid.appendChild(c);
    });
    function win() {
      var b = +ls("ko_gm_mem") || 999; if (moves < b) ls("ko_gm_mem", String(moves));
      var m = h("div", "gm-win"); m.appendChild(h("b", "", "🎉 برافو! خلّصتها بـ " + moves + " حركة")); var r = h("button", "btn btn-red", "العب مرة ثانية"); r.onclick = function () { box.textContent = ""; memory(box); }; m.appendChild(r); box.appendChild(m);
    }
  }

  function tap(box) {
    var score = 0, left = 20, run = false, best = +ls("ko_gm_tap") || 0, timer = 0, spawn = 0;
    var info = h("div", "gm-info"), sc = h("b", "", "0"), tm = h("b", "", "20");
    info.appendChild(h("span", "", "النقاط: ")); info.appendChild(sc); info.appendChild(h("span", "", " · الوقت: ")); info.appendChild(tm); if (best) info.appendChild(h("span", "gm-best", "أفضل: " + best));
    var arena = h("div", "gm-arena"), start = h("button", "btn btn-red gm-start", "ابدأ"); arena.appendChild(start); box.appendChild(info); box.appendChild(arena);
    function ball() {
      if (!run) return; var b = h("button", "gm-ball", "⚽"); b.type = "button"; var s = 38 + Math.random() * 26;
      b.style.cssText = "width:" + s + "px;height:" + s + "px;left:" + Math.random() * (100 - 14) + "%;top:" + Math.random() * (100 - 18) + "%;font-size:" + s * .7 + "px";
      b.onpointerdown = function (e) { e.preventDefault(); score++; sc.textContent = score; b.classList.add("pop"); setTimeout(function () { b.remove(); }, 160); };
      arena.appendChild(b); setTimeout(function () { b.remove(); }, 1100);
    }
    function end() {
      run = false; clearInterval(timer); clearInterval(spawn); arena.querySelectorAll(".gm-ball").forEach(function (x) { x.remove(); });
      if (score > best) ls("ko_gm_tap", String(score));
      start.textContent = "🎉 " + score + " نقطة — العب مرة ثانية"; start.hidden = false;
    }
    start.onclick = function () { score = 0; left = 20; sc.textContent = 0; tm.textContent = 20; run = true; start.hidden = true; spawn = setInterval(ball, 520); ball(); timer = setInterval(function () { tm.textContent = --left; if (left <= 0) end(); }, 1000); };
    box._stop = function () { clearInterval(timer); clearInterval(spawn); run = false; };
  }

  function wheel(box, cfg) {
    var P = (cfg.prizes || []).filter(function (p) { return p && p.label; }); if (P.length < 2) { box.appendChild(h("p", "gm-note", "ما في جوائز معرّفة للعجلة بعد.")); return; }
    var n = P.length, seg = 360 / n, rot = 0, spun = ls("ko_gm_wheel") === day();
    var cols = ["#d9232d", "#1f2937", "#f2b01e", "#2563eb", "#16a34a", "#8b5cf6", "#e11d48", "#0e7490"];
    var w = h("div", "gm-wheel"), disc = h("div", "gm-disc"), pin = h("div", "gm-pin");
    disc.style.background = "conic-gradient(" + P.map(function (p, i) { return cols[i % cols.length] + " " + i * seg + "deg " + (i + 1) * seg + "deg"; }).join(",") + ")";
    P.forEach(function (p, i) { var l = h("span", "gm-lbl", p.label); l.style.transform = "rotate(" + (i * seg + seg / 2) + "deg) translateY(calc(min(80vw,320px) * -.32))"; disc.appendChild(l); });
    w.appendChild(disc); w.appendChild(pin);
    var btn = h("button", "btn btn-red gm-start", spun ? "لفّيت اليوم — ارجع بكرا" : "لفّ العجلة"); btn.type = "button"; btn.disabled = spun;
    var res = h("div", "gm-res"); box.appendChild(w); box.appendChild(btn); box.appendChild(res);
    function pick() { var t = P.reduce(function (s, p) { return s + (+p.w || 0); }, 0), r = Math.random() * (t || n), a = 0; for (var i = 0; i < n; i++) { a += t ? (+P[i].w || 0) : 1; if (r < a) return i; } return n - 1; }
    btn.onclick = function () {
      var i = pick(); btn.disabled = true; ls("ko_gm_wheel", day());
      var target = 360 - (i * seg + seg / 2) + (Math.random() - .5) * seg * .6; rot += 360 * 5 + ((target - rot % 360) + 360) % 360;
      disc.style.transform = "rotate(" + rot + "deg)";
      setTimeout(function () {
        var p = P[i]; res.textContent = ""; res.appendChild(h("b", "", "🎁 " + p.label));
        if (p.code) { var c = h("button", "gm-code", p.code); c.type = "button"; c.onclick = function () { try { navigator.clipboard.writeText(p.code); c.textContent = "انسخ ✓ " + p.code; } catch (e) {} }; res.appendChild(h("span", "", "كود الخصم (اضغط للنسخ):")); res.appendChild(c); }
        var a = h("a", "btn btn-dark", "تسوّق الآن"); a.href = "#/all"; res.appendChild(a); btn.textContent = "لفّيت اليوم — ارجع بكرا";
      }, 4300);
    };
  }

  window.KOGames = {
    mount: function (app, cfg, o) {
      var root = h("section", "gm-page"), title = h("h1", "gm-title", cfg.title || "ألعاب");
      root.appendChild(title); root.appendChild(h("p", "gm-sub", "سلّي وقتك والعب — وبلكي تربح خصم 🎁"));
      var games = [["memory", "🧠", "لعبة الذاكرة", memory], ["tap", "⚽", "صيد الكرات", tap], ["wheel", "🎡", "عجلة الحظ", wheel]].filter(function (g) { return cfg[g[0]] !== false; });
      var tabs = h("div", "gm-tabs"), stage = h("div", "gm-stage"), cur = null;
      function show(g, b) { if (cur && cur._stop) cur._stop(); tabs.querySelectorAll("button").forEach(function (x) { x.classList.toggle("on", x === b); }); stage.textContent = ""; cur = h("div", "gm-box"); stage.appendChild(cur); g[3](cur, cfg); }
      games.forEach(function (g, i) { var b = h("button", "gm-tab"); b.type = "button"; b.appendChild(h("span", "gm-ic", g[1])); b.appendChild(h("b", "", g[2])); b.onclick = function () { show(g, b); }; tabs.appendChild(b); if (i === 0) setTimeout(function () { show(g, b); }, 0); });
      if (!games.length) root.appendChild(h("p", "gm-note", "ما في ألعاب مفعّلة."));
      root.appendChild(tabs); root.appendChild(stage); app.textContent = ""; app.appendChild(root);
    }
  };
})();
