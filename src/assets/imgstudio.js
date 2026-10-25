/* KOStudio — product photo studio in the dashboard:
   • remove the background (AI in the browser, free) or a quick white-background cut
   • the shop's photo identity: same square size, background, margin, shadow, light/colour — saved once, applied to every photo
   • edit with words through Google Gemini «Nano Banana» (needs GEMINI_API_KEY on Cloudflare)
   open(source, {api, style, onStyle, brand}) → Promise<Blob|null> (a square PNG ready to upload) */
(function () {
  var BG_LIB = "https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.4.5/+esm";
  var DEF = { bg: "white", color: "#ffffff", pad: 8, shadow: true, bright: 100, contrast: 100, sat: 100, size: 1200 };
  var PRESETS = ["حط المنتج على خلفية بيضاء نظيفة مع ظل خفيف تحته", "صورة احترافية متل صور الكتالوج مع إضاءة استوديو", "شيل الكتابة والعلامات المائية من الخلفية بس", "حط المنتج على خلفية رمادية فاتحة متدرجة", "خلّي الألوان أوضح والصورة أحدّ بدون ما تغيّر المنتج"];
  var lib = null;
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function loadImg(src) { return new Promise(function (ok, no) { var i = new Image(); i.crossOrigin = "anonymous"; i.onload = function () { ok(i); }; i.onerror = function () { no(new Error("ما قدرنا نفتح الصورة")); }; i.src = src; }); }
  async function toCanvas(source) {
    var bmp;
    if (source instanceof Blob) bmp = await createImageBitmap(source);
    else bmp = await loadImg(source);
    var c = document.createElement("canvas"); c.width = bmp.width; c.height = bmp.height; c.getContext("2d").drawImage(bmp, 0, 0); return c;
  }
  // bounding box of what isn't transparent / isn't the plain background colour
  function bbox(c, transparent) {
    var x = c.getContext("2d"), W = c.width, H = c.height, d = x.getImageData(0, 0, W, H).data, x0 = W, y0 = H, x1 = -1, y1 = -1;
    var ref = [d[0], d[1], d[2]], step = Math.max(1, Math.round(Math.max(W, H) / 600));
    for (var j = 0; j < H; j += step) for (var i = 0; i < W; i += step) {
      var p = (j * W + i) * 4, on = transparent ? d[p + 3] > 20 : Math.abs(d[p] - ref[0]) + Math.abs(d[p + 1] - ref[1]) + Math.abs(d[p + 2] - ref[2]) > 40;
      if (on) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; }
    }
    return x1 < 0 ? { x: 0, y: 0, w: W, h: H } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }
  // quick cut for photos shot on a white / very light background: flood from the edges
  function whiteCut(src) {
    var c = document.createElement("canvas"), W = c.width = src.width, H = c.height = src.height, x = c.getContext("2d");
    x.drawImage(src, 0, 0); var im = x.getImageData(0, 0, W, H), d = im.data, seen = new Uint8Array(W * H), st = [];
    var near = function (p) { return d[p] > 225 && d[p + 1] > 225 && d[p + 2] > 225; };
    for (var i = 0; i < W; i++) { st.push(i, (H - 1) * W + i); } for (var j = 0; j < H; j++) { st.push(j * W, j * W + W - 1); }
    while (st.length) { var k = st.pop(); if (seen[k]) continue; seen[k] = 1; var p = k * 4; if (!near(p)) continue; d[p + 3] = 0; var xx = k % W, yy = (k / W) | 0; if (xx > 0) st.push(k - 1); if (xx < W - 1) st.push(k + 1); if (yy > 0) st.push(k - W); if (yy < H - 1) st.push(k + W); }
    // soften the cut edge a little
    for (var q = 0; q < W * H; q++) { var pp = q * 4; if (d[pp + 3] && d[pp] > 205 && d[pp + 1] > 205 && d[pp + 2] > 205) d[pp + 3] = Math.min(d[pp + 3], 140); }
    x.putImageData(im, 0, 0); return c;
  }
  async function aiCut(src, onStep) {
    if (!lib) { onStep("عم ينزّل نموذج الذكاء الاصطناعي (أول مرة بس، حوالي 40 ميغا)…"); lib = await import(BG_LIB); }
    var blob = await new Promise(function (r) { src.toBlob(r, "image/png"); });
    var out = await (lib.removeBackground || lib.default)(blob, { progress: function (k, a, b) { if (b) onStep("عم يشيل الخلفية… " + Math.round((a / b) * 100) + "%"); } });
    return toCanvas(out);
  }
  // the final square photo in the shop's style
  function compose(cut, transparent, s, brand) {
    var N = s.size || 1200, c = document.createElement("canvas"); c.width = c.height = N; var x = c.getContext("2d");
    var bgc = s.bg === "brand" ? brand || "#d9232d" : s.bg === "gray" ? "#f2f2f4" : s.bg === "custom" ? s.color : "#ffffff";
    if (s.bg === "gradient") { var g = x.createLinearGradient(0, 0, 0, N); g.addColorStop(0, "#ffffff"); g.addColorStop(1, "#e9e9ee"); x.fillStyle = g; } else x.fillStyle = bgc;
    if (s.bg !== "none") x.fillRect(0, 0, N, N);
    var b = bbox(cut, transparent), pad = (Math.max(0, Math.min(35, +s.pad || 0)) / 100) * N, room = N - pad * 2, k = Math.min(room / b.w, room / b.h);
    var w = b.w * k, h = b.h * k, dx = (N - w) / 2, dy = (N - h) / 2;
    x.filter = "brightness(" + (s.bright || 100) + "%) contrast(" + (s.contrast || 100) + "%) saturate(" + (s.sat || 100) + "%)";
    if (s.shadow && transparent) { x.save(); x.shadowColor = "rgba(0,0,0,.22)"; x.shadowBlur = N * 0.035; x.shadowOffsetY = N * 0.018; x.drawImage(cut, b.x, b.y, b.w, b.h, dx, dy, w, h); x.restore(); }
    else x.drawImage(cut, b.x, b.y, b.w, b.h, dx, dy, w, h);
    x.filter = "none"; return c;
  }
  function blobToB64(b) { return new Promise(function (ok) { var r = new FileReader(); r.onload = function () { ok(String(r.result).split(",")[1]); }; r.readAsDataURL(b); }); }
  function b64ToBlob(s, mime) { var bin = atob(s), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: mime || "image/png" }); }

  function open(source, o) {
    o = o || {};
    return new Promise(async function (done) {
      var s = Object.assign({}, DEF, o.style || {}), orig, cut = null, transparent = false, busy = false;
      var d = el("dialog", "kst");
      d.innerHTML = '<div class="kst-h"><b>🪄 استوديو الصور</b><button type="button" class="kst-x" data-x>✕</button></div>' +
        '<div class="kst-body"><div class="kst-view"><canvas data-pv></canvas><div class="kst-busy" data-busy hidden></div><div class="kst-ba"><button type="button" data-before>👁 قبل</button></div></div>' +
        '<div class="kst-tools">' +
        '<section><h4>✂️ الخلفية</h4><div class="kst-row"><button type="button" class="btn btn-red sm" data-ai-cut>شيل الخلفية بالذكاء الاصطناعي (مجاني)</button><button type="button" class="btn btn-ghost sm" data-white-cut>شيل الخلفية البيضاء (سريع)</button><button type="button" class="btn btn-ghost sm" data-reset>رجّع الأصلية</button></div><small class="hint">بيشتغل بمتصفحك بدون أي تكلفة. أول مرة بينزّل النموذج وبياخد شوي وقت.</small></section>' +
        '<section><h4>🎨 هوية صور المتجر</h4>' +
        '<div class="kst-seg" data-bg>' + [["white", "أبيض"], ["gray", "رمادي فاتح"], ["gradient", "متدرّج"], ["brand", "لون المتجر"], ["custom", "لون خاص"], ["none", "شفاف"]].map(function (a) { return '<button type="button" data-v="' + a[0] + '">' + a[1] + "</button>"; }).join("") + '</div>' +
        '<label class="kst-c" data-cwrap>اللون <input type="color" data-color></label>' +
        '<label>المسافة حوالين المنتج <b data-padv></b><input type="range" min="0" max="35" data-pad></label>' +
        '<label class="kst-chk"><input type="checkbox" data-shadow> ظل خفيف تحت المنتج (بعد ما تشيل الخلفية)</label>' +
        '<label>الإضاءة <b data-brv></b><input type="range" min="60" max="150" data-bright></label>' +
        '<label>التباين <b data-cov></b><input type="range" min="60" max="150" data-contrast></label>' +
        '<label>الألوان <b data-sav></b><input type="range" min="0" max="180" data-sat></label>' +
        '<div class="kst-row"><button type="button" class="btn btn-ghost sm" data-save-style>⭐ احفظ كهوية لكل صور المتجر</button></div></section>' +
        '<section><h4>🍌 تعديل بالكلام (Nano Banana)</h4><textarea rows="2" data-prompt placeholder="مثلاً: حط المنتج على خلفية بيضاء نظيفة مع ظل خفيف"></textarea><div class="kst-chips">' + PRESETS.map(function (p) { return '<button type="button" data-preset>' + p + "</button>"; }).join("") + '</div><div class="kst-row"><button type="button" class="btn btn-ghost sm" data-gem>✨ نفّذ بـ Gemini</button></div><small class="hint" data-gem-hint>بيحتاج مفتاح Gemini (GEMINI_API_KEY) على Cloudflare. كل تعديل بيكلّف تقريباً 4 سنت من Google، إلا إذا مفتاحك على الطبقة المجانية.</small></section>' +
        '</div></div><div class="kst-f"><span data-msg class="hint"></span><button type="button" class="btn btn-ghost" data-x>إلغاء</button><button type="button" class="btn btn-red" data-ok>✓ استعمل الصورة</button></div>';
      document.body.appendChild(d); d.showModal();
      var $ = function (q) { return d.querySelector(q); }, pv = $("[data-pv]");
      var msg = function (t) { $("[data-msg]").textContent = t || ""; };
      var setBusy = function (t) { busy = !!t; var b = $("[data-busy]"); b.hidden = !t; b.textContent = t || ""; };
      var draw = function () { var c = compose(cut || orig, transparent, s, o.brand); pv.width = c.width; pv.height = c.height; pv.getContext("2d").drawImage(c, 0, 0); };
      var sync = function () {
        d.querySelectorAll("[data-bg] button").forEach(function (b) { b.classList.toggle("on", b.dataset.v === s.bg); });
        $("[data-cwrap]").hidden = s.bg !== "custom"; $("[data-color]").value = s.color;
        $("[data-pad]").value = s.pad; $("[data-padv]").textContent = s.pad + "%";
        $("[data-shadow]").checked = !!s.shadow;
        $("[data-bright]").value = s.bright; $("[data-brv]").textContent = s.bright + "%";
        $("[data-contrast]").value = s.contrast; $("[data-cov]").textContent = s.contrast + "%";
        $("[data-sat]").value = s.sat; $("[data-sav]").textContent = s.sat + "%";
        draw();
      };
      var end = function (v) { d.close(); d.remove(); done(v); };
      try { setBusy("عم يفتح الصورة…"); orig = await toCanvas(source); setBusy(""); sync(); } catch (e) { setBusy(""); msg(e.message); }
      if (o.gemini === false) $("[data-gem-hint]").innerHTML = "⚠️ مفتاح Gemini مو محطوط. حطه من Cloudflare ← Settings ← Variables and Secrets ← Add (Secret) باسم <b>GEMINI_API_KEY</b>، وجيبه من aistudio.google.com، وبعدين ارفع الموقع من جديد.";
      d.addEventListener("cancel", function (e) { e.preventDefault(); if (!busy) end(null); });
      d.addEventListener("input", function (e) {
        var t = e.target;
        if (t.matches("[data-pad]")) s.pad = +t.value; else if (t.matches("[data-bright]")) s.bright = +t.value; else if (t.matches("[data-contrast]")) s.contrast = +t.value; else if (t.matches("[data-sat]")) s.sat = +t.value; else if (t.matches("[data-color]")) s.color = t.value; else if (t.matches("[data-shadow]")) s.shadow = t.checked; else return;
        sync();
      });
      d.addEventListener("click", async function (e) {
        var t = e.target; if (busy) return;
        if (t.closest("[data-x]")) return end(null);
        var bg = t.closest("[data-bg] [data-v]"); if (bg) { s.bg = bg.dataset.v; return sync(); }
        if (t.closest("[data-shadow]")) return;
        if (t.closest("[data-reset]")) { cut = null; transparent = false; return sync(); }
        if (t.closest("[data-white-cut]")) { cut = whiteCut(orig); transparent = true; msg("انشالت الخلفية الفاتحة ✓"); return sync(); }
        if (t.closest("[data-ai-cut]")) {
          try { setBusy("…"); cut = await aiCut(orig, setBusy); transparent = true; msg("انشالت الخلفية ✓"); }
          catch (err) { msg("ما زبط الذكاء الاصطناعي (" + String(err && err.message || err).slice(0, 80) + ")، جرّب «شيل الخلفية البيضاء»."); }
          setBusy(""); return sync();
        }
        if (t.closest("[data-preset]")) { $("[data-prompt]").value = t.textContent; return; }
        if (t.closest("[data-save-style]")) { if (o.onStyle) o.onStyle(Object.assign({}, s)); msg("⭐ انحفظت الهوية. اكبس «حفظ» بالإعدادات لتنحفظ عالسيرفر."); return; }
        if (t.closest("[data-gem]")) {
          var p = $("[data-prompt]").value.trim(); if (!p) { msg("اكتب شو بدك يتعدّل"); return; }
          try {
            setBusy("✨ عم يعدّل Gemini الصورة…");
            var src = cut || orig, big = document.createElement("canvas"), k = Math.min(1, 1400 / Math.max(src.width, src.height));
            big.width = Math.round(src.width * k); big.height = Math.round(src.height * k); var bx = big.getContext("2d"); bx.fillStyle = "#fff"; bx.fillRect(0, 0, big.width, big.height); bx.drawImage(src, 0, 0, big.width, big.height);
            var blob = await new Promise(function (r) { big.toBlob(r, "image/jpeg", 0.92); });
            var j = await o.api("/api/ai/image-edit", { method: "POST", body: JSON.stringify({ image: await blobToB64(blob), mime: "image/jpeg", prompt: p }) });
            orig = await toCanvas(b64ToBlob(j.image, j.mime)); cut = null; transparent = false; msg("✨ تعدّلت الصورة. فيك تطبّق عليها الهوية كمان.");
          } catch (err) { msg(err.message || String(err)); }
          setBusy(""); return sync();
        }
        if (t.closest("[data-before]")) { var c0 = pv.getContext("2d"); pv.width = orig.width; pv.height = orig.height; c0.drawImage(orig, 0, 0); setTimeout(draw, 1200); return; }
        if (t.closest("[data-ok]")) { var out = compose(cut || orig, transparent, s, o.brand); out.toBlob(function (b) { end(b); }, "image/png"); }
      });
    });
  }
  // apply the saved identity without opening the studio (quick, no background removal)
  async function applyStyle(source, style, brand) { var c = await toCanvas(source); return new Promise(function (ok) { compose(c, false, Object.assign({}, DEF, style || {}), brand).toBlob(ok, "image/png"); }); }
  window.KOStudio = { open: open, applyStyle: applyStyle, DEF: DEF };
})();
