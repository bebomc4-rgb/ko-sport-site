// قسم التمرين (صاحب المتجر 24/11/2026): مجسّم العضلات، التنين الأسود (المدرّب)، آخر الدراسات، والتغذية.
// بينحمّل لما تنفتح مكتبة التمارين أو التغذية بس (window.KOGym). كل الألوان من متغيّرات الثيم.
(function () {
  "use strict";
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };

  // ---------- مجسّم العضلات (قدّام وورا) ----------
  // كل عضلة إلها مسار للجهة اليسار، والجهة اليمين نفس المسار بالمراية. data-mk = القسم يلي بينفتح بالمكتبة
  var SIL = "M100 62 L88 66 L70 78 C54 80 45 94 44 114 C40 138 40 160 42 178 L37 212 L47 214 L55 180 C59 162 62 142 64 124 L66 140 C66 168 69 190 73 204 C63 236 63 268 71 296 C67 330 69 370 75 412 L72 426 L91 428 L91 410 C93 370 93 330 91 298 C95 270 97 242 99 224 L100 224 Z";
  var FRONT = [
    ["Back:Traps", "M88 68 L72 80 L90 84 Z"],
    ["Shoulders:Front", "M74 84 C62 86 56 94 55 108 L62 112 C64 102 68 96 76 93 Z"],
    ["Shoulders:Side", "M60 84 C50 88 46 98 46 112 L53 110 C53 100 56 92 64 86 Z"],
    ["Chest:Upper", "M98 86 L78 88 C71 92 68 98 69 104 L98 102 Z"],
    ["Chest:Mid", "M98 104 L69 106 C70 117 76 126 88 129 L98 127 Z"],
    ["Chest:Serr", "M66 118 L73 125 L70 137 L63 129 Z"],
    ["Biceps", "M54 114 C48 126 48 142 52 152 L60 150 C62 138 62 124 60 114 Z"],
    ["Forearms", "M50 156 C44 172 42 190 44 204 L52 204 C56 188 58 172 58 156 Z"],
    ["Waist:Upper", "M98 132 L85 132 L85 160 L98 160 Z"],
    ["Waist:Lower", "M98 163 L85 163 C85 181 89 195 98 204 Z"],
    ["Waist:Obl", "M82 132 L72 140 C70 160 72 180 82 197 L83 163 Z"],
    ["Hips:Add", "M98 216 L90 214 C88 240 90 262 94 278 L98 278 Z"],
    ["Quadriceps", "M88 210 L73 206 C64 236 66 268 76 293 L90 291 C88 262 86 236 88 210 Z"],
    ["Calves:Tib", "M76 302 C72 330 74 360 78 392 L86 392 C88 360 88 330 86 302 Z"],
  ];
  var BACK = [
    ["Back:Traps", "M100 64 L87 70 L70 82 L86 92 L100 122 Z"],
    ["Shoulders:Rear", "M70 84 C58 86 51 96 51 110 L58 108 C60 99 64 93 73 90 Z"],
    ["Shoulders:Side", "M60 84 C50 88 46 98 46 112 L52 110 C52 100 55 92 63 86 Z"],
    ["Back:Mid", "M100 124 L87 96 L84 120 L98 138 Z"],
    ["Back:Lats", "M83 112 L66 118 C66 142 72 162 86 178 L96 168 L84 124 Z"],
    ["Back:Lower", "M100 148 L90 150 C88 168 88 182 90 196 L100 198 Z"],
    ["Triceps", "M54 114 C48 126 48 142 52 154 L60 152 C62 138 62 124 60 114 Z"],
    ["Forearms", "M50 158 C44 174 42 190 44 204 L52 204 C56 188 58 174 58 158 Z"],
    ["Glutes", "M100 204 L80 200 C70 212 70 232 80 244 C88 249 96 247 100 242 Z"],
    ["Hamstrings", "M92 250 L74 246 C68 268 70 288 78 302 L92 300 C92 282 92 266 92 250 Z"],
    ["Calves:Gas", "M77 306 C70 328 72 352 80 368 L89 366 C91 346 90 326 87 306 Z"],
  ];
  function side(parts, label, names) {
    var p = parts.map(function (x) { return '<path class="mm" data-mk="' + x[0] + '" d="' + x[1] + '"><title>' + esc(names[x[0]] || x[0]) + "</title></path>"; }).join("");
    return '<figure class="kg-fig"><svg viewBox="30 0 140 440" role="img" aria-label="' + label + '">' +
      '<ellipse class="mb" cx="100" cy="36" rx="20" ry="25"/><path class="mb" d="M89 54 L111 54 L114 72 L86 72 Z"/><path class="mb" d="' + SIL + '"/><path class="mb" d="' + SIL + '" transform="translate(200 0) scale(-1 1)"/>' +
      p + '<g transform="translate(200 0) scale(-1 1)">' + p + "</g></svg><figcaption>" + label + "</figcaption></figure>";
  }
  function map(names) { return '<div class="kg-map" data-kg-map>' + side(FRONT, "من قدّام", names) + side(BACK, "من ورا", names) + '<p class="kg-hint">كبّس على أي عضلة وبتفتحلك تمارينها 👆</p></div>'; }

  // ---------- التنين الأسود: صديق المتدرّب، قوي وصارم ----------
  var TIPS = {
    _: [
      "ما في شي اسمو «ما بقدر». في شي اسمو «ما بدي». قوم اشتغل 🔥",
      "وزن خفيف بتقنية صح أحسن من وزن تقيل بظهر مكسور.",
      "النوم من 7 لـ 9 ساعات جزء من التمرين، مو رفاهية.",
      "البروتين: تقريباً 1.6 لـ 2.2 غرام لكل كيلو من وزنك باليوم.",
      "سجّل أوزانك وتكراراتك. يلي ما بينقاس ما بيتحسّن.",
      "الإحماء 5 لـ 10 دقايق قبل التمرين بيحميك من الإصابة.",
      "زيد الحمل شوي شوي كل أسبوع. هيك بتكبر العضلة.",
      "اشرب مي: تقريباً 35 مل لكل كيلو من وزنك باليوم، وأكتر إذا عرقت كتير.",
      "التزام 80٪ طول السنة أحسن من حماس 100٪ لأسبوع وحدة.",
      "التعب بيروح، والنتيجة بتضل. كمّل.",
      "ارتاح بين المجموعات: دقيقة ونص لـ 3 دقايق للتمارين التقيلة.",
      "العضلة بتكبر وانت مرتاح، مو وانت عم تتمرّن. احترم يوم الراحة.",
    ],
    Chest: ["بالبنش: لوح الكتف لورا ولتحت، والكوع على 45 درجة مو مفتوح عالآخر.", "نزّل الوزن على مهلك لصدرك، وادفع بقوة. النزول نص التمرين."],
    Back: ["اسحب بالكوع مو بالإيد، وحس ظهرك عم يشتغل.", "بالسحب: صدرك لقدّام وكتافك لتحت. لا تشد برقبتك."],
    Shoulders: ["الرفع الجانبي: وزن خفيف، كوع مثني شوي، وما تعلّي فوق الكتف بكتير.", "الكتف الخلفي بيحميك من الإصابة. لا تنساه."],
    Biceps: ["لا تهز جسمك بالكيرل. خلّي الكوع ثابت جنبك.", "نزّل الوزن لآخر الحركة. نص الحركة = نص النتيجة."],
    Triceps: ["التمديد فوق الراس بيشغّل الراس الطويل، وهوي أكبر راس بالترايسبس.", "الكوع ثابت بالبوش داون، والحركة من الساعد بس."],
    Forearms: ["القبضة القوية بتفرق بكل التمارين. علّق حالك عالبار آخر التمرين.", "حمل الأوزان والمشي فيها (فارمر ووك) بيبني ساعد حديد."],
    Waist: ["البطن بينبني بالتمرين، وبيبين بالأكل.", "بالبلانك: الضهر مستقيم والبطن مشدود. 30 ثانية صح أحسن من دقيقتين غلط."],
    Glutes: ["بالهيب ثرست: شد المؤخرة فوق لثانية، والضهر ما يقوّس.", "المؤخرة القوية بتحمي ضهرك وركبك."],
    Hips: ["افتح وسكّر الرجل على مهلك، بلا ما تميل جسمك.", "عضلات الورك بتثبّت الحوض. ضعفها بيوجّع الركبة."],
    Quadriceps: ["بالسكوات: الركبة بتمشي باتجاه أصابع الرجل، والكعب ما يطير.", "انزل لتحت قد ما تقدر وضهرك مستقيم. المدى الكامل بيعطي نتيجة أكبر."],
    Hamstrings: ["بالرومانيان: الورك لورا والضهر مستقيم، وحس بالشد بخلف الفخذ.", "الخلفية الضعيفة سبب أول لتمزّق العضلة. لا تهملها."],
    Calves: ["السمانة بتحب التكرارات والمدى الكامل: نزّل الكعب لآخر شي.", "اثبت ثانية فوق بكل تكرار."],
    Neck: ["الرقبة بتتمرّن على مهل وبوزن خفيف. لا تستعجل."],
    Boxing: ["رجّع إيدك لوجهك بعد كل لكمة. الحماية قبل الضربة.", "اللكمة بتطلع من الرجل والورك، مو من الإيد بس."],
    Cardio: ["الكارديو بيقوّي القلب. 150 دقيقة بالأسبوع على الأقل."],
    Stretching: ["الإطالة بعد التمرين، 20 لـ 30 ثانية لكل عضلة، بلا ما تنط."],
    _nutri: ["سجّل كل لقمة. يلي ما بتسجّلو ما بينحسب، بس جسمك بيحسبو.", "البروتين بكل وجبة: بيض، دجاج، سمك، لبن، عدس.", "ما في أكل ممنوع. في كمية مزبوطة.", "الخضرا قبل الأكل بتشبعك وبتخفف السعرات."],
    _studies: ["العلم ما بيكذب. اقرا، وطبّق، وراقب جسمك.", "دراسة وحدة ما بتغيّر كلشي. شوف الصورة الكاملة."],
  };
  var DRAGON = '<svg class="drg" viewBox="0 0 200 220" aria-hidden="true">' +
    '<g class="drg-tail"><path d="M118 168 C160 182 178 150 186 164 L194 158 L190 176 C172 198 136 198 112 184 Z"/></g>' +
    '<g class="drg-wl"><path d="M74 78 L12 26 L24 66 L4 76 L30 92 L18 114 L64 104 Z"/><path class="drg-mem" d="M66 84 L24 66 M66 90 L30 92 M64 98 L18 114"/></g>' +
    '<g class="drg-wr"><path d="M126 78 L188 26 L176 66 L196 76 L170 92 L182 114 L136 104 Z"/><path class="drg-mem" d="M134 84 L176 66 M134 90 L170 92 M136 98 L182 114"/></g>' +
    '<g class="drg-bd">' +
    '<path d="M80 162 L70 206 L97 206 L98 166 Z"/><path d="M120 162 L130 206 L103 206 L102 166 Z"/>' +
    '<path d="M70 206 L64 214 L100 214 L97 206 Z M130 206 L136 214 L100 214 L103 206 Z"/>' +
    '<path d="M68 78 C56 96 60 140 78 170 L122 170 C140 140 144 96 132 78 Z"/>' +
    '<path class="drg-belly" d="M86 118 L114 118 L112 166 L88 166 Z"/>' +
    '<path class="drg-line" d="M88 128 H112 M88 138 H112 M89 148 H111 M90 158 H110 M100 118 V166"/>' +
    '<path class="drg-hl" d="M74 86 C70 96 72 110 80 116 C90 118 98 110 98 100 Z M126 86 C130 96 128 110 120 116 C110 118 102 110 102 100 Z"/>' +
    '<path d="M66 84 C44 90 38 118 54 128 L76 118 Z"/><path d="M134 84 C156 90 162 118 146 128 L124 118 Z"/>' +
    '<path class="drg-arm" d="M52 120 L140 104 C148 112 146 122 136 126 L60 136 C50 134 48 126 52 120 Z"/>' +
    '<path class="drg-arm2" d="M148 120 L60 106 C52 114 54 122 64 126 L140 136 C150 134 152 126 148 120 Z"/>' +
    '<path class="drg-claw" d="M48 122 l-6 -4 M50 128 l-7 0 M152 122 l6 -4 M150 128 l7 0"/>' +
    "</g>" +
    '<g class="drg-hd">' +
    '<path d="M84 30 L68 2 L92 22 Z M116 30 L132 2 L108 22 Z"/>' +
    '<path d="M78 36 C78 16 122 16 122 36 L128 58 C122 74 78 74 72 58 Z"/>' +
    '<path class="drg-hl" d="M84 24 C92 18 108 18 116 24 L112 30 C104 26 96 26 88 30 Z"/>' +
    '<path class="drg-brow" d="M82 40 L97 45 M118 40 L103 45"/>' +
    '<g class="drg-eyes"><ellipse class="drg-eye" cx="90" cy="48" rx="5" ry="3.2"/><ellipse class="drg-eye" cx="110" cy="48" rx="5" ry="3.2"/></g>' +
    '<path d="M88 62 C94 68 106 68 112 62 L110 70 C104 74 96 74 90 70 Z"/>' +
    '<circle class="drg-nos" cx="95" cy="58" r="1.6"/><circle class="drg-nos" cx="105" cy="58" r="1.6"/>' +
    '<path class="drg-fang" d="M93 68 l2 5 l2 -5 Z M103 68 l2 5 l2 -5 Z"/>' +
    "</g>" +
    '<g class="drg-smoke"><circle cx="95" cy="54" r="4"/><circle cx="105" cy="54" r="4"/></g>' +
    "</svg>";
  var drg = { el: null, ctx: "_", t: 0, last: "" };
  function pick(ctx) {
    var a = (TIPS[ctx] || []).concat(ctx.charAt(0) === "_" && ctx !== "_" ? [] : TIPS._), x;
    for (var i = 0; i < 5; i++) { x = a[Math.floor(Math.random() * a.length)]; if (x !== drg.last) break; }
    drg.last = x; return x;
  }
  function say(text) {
    if (!drg.el) return;
    var b = drg.el.querySelector(".drg-say");
    b.innerHTML = '<b>التنين الأسود</b>' + esc(text);
    drg.el.classList.add("talk");
    clearTimeout(drg.t); drg.t = setTimeout(function () { if (drg.el) drg.el.classList.remove("talk"); }, 9000);
  }
  // 25/11/2026 صاحب المتجر: «احذف شخصية التنين» → ما عاد يطلع (الدالة بتضل لحتى ما ينكسر شي بيناديها)
  function dragon(ctx, greet) {
    return;
    drg.ctx = ctx || "_";
    if (!drg.el) {
      var d = document.createElement("div");
      d.className = "kg-drg"; d.setAttribute("role", "button"); d.setAttribute("tabindex", "0"); d.setAttribute("aria-label", "التنين الأسود: كبسة لنصيحة");
      d.innerHTML = '<div class="drg-say" aria-live="polite"></div>' + DRAGON + '<button type="button" class="drg-x" aria-label="خبّي التنين">×</button>';
      d.addEventListener("click", function (e) {
        if (e.target.closest(".drg-x")) { d.classList.add("hide"); d.classList.remove("talk"); try { sessionStorage.setItem("ko_drg_off", "1"); } catch (er) {} return; }
        d.classList.remove("hide"); d.classList.add("pump"); setTimeout(function () { d.classList.remove("pump"); }, 700); say(pick(drg.ctx));
      });
      document.body.appendChild(d); drg.el = d;
      try { if (sessionStorage.getItem("ko_drg_off")) d.classList.add("hide"); } catch (er) {}
    }
    drg.el.hidden = false;
    if (greet && !drg.el.classList.contains("hide")) setTimeout(function () { say(pick(drg.ctx)); }, 600);
  }
  function dragonHide() { if (drg.el) { drg.el.hidden = true; drg.el.classList.remove("talk"); } }

  // ---------- آخر الدراسات (متل منشورات فيسبوك) ----------
  var CAT = { nutrition: ["🥗", "تغذية رياضية"], medicine: ["🩺", "طب رياضي"], training: ["🏋️", "تدريب وأداء"] };
  var MON = ["كانون التاني", "شباط", "آذار", "نيسان", "أيار", "حزيران", "تموز", "آب", "أيلول", "تشرين الأول", "تشرين التاني", "كانون الأول"];
  function dAr(d) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || ""); return m ? (+m[3] + " " + MON[+m[2] - 1] + " " + m[1]) : ""; }
  // صورة الدراسة: إذا إلها صورة (عن موضوعها، بتنعمل لحالها بالسيرفر) منحطها، وإلا الشكل الملوّن مع الإيموجي
  function banner(s) {
    var c = CAT[s.c] || CAT.training, k = (s.id | 0) % 4;
    var ph = /^p\d+$/.test(s.im || "") ? '<img class="ks-ph" src="/imgs/720/' + s.im + '" srcset="/imgs/480/' + s.im + ' 480w, /imgs/720/' + s.im + ' 720w, /imgs/1080/' + s.im + ' 1080w" sizes="(max-width:640px) 100vw, 640px" alt="" loading="lazy" decoding="async" onerror="this.remove()">' : "";
    var u = s.ph && s.ph.u;
    if (u && /^https:\/\/images\.unsplash\.com\//.test(u)) { // صورة حقيقية من Unsplash (من رابطهم). اسم المصوّر انشال بطلب صاحب المتجر (25/11/2026) وهو عارف إنو Unsplash ممكن يوقّف المفتاح
      var q = u + (u.indexOf("?") < 0 ? "?" : "&") + "fit=crop&crop=entropy&auto=format&q=70&ar=16:7&w=", ut = "?utm_source=ko_sport&utm_medium=referral";
      ph = '<img class="ks-ph" src="' + esc(q) + '720" srcset="' + esc(q) + "480 480w, " + esc(q) + "720 720w, " + esc(q) + '1080 1080w" sizes="(max-width:640px) 100vw, 640px" alt="" loading="lazy" decoding="async" onerror="var p=this.parentNode;p.classList.remove(\'has-ph\');this.remove()">' ;
    }
    return '<div class="ks-img ks-' + esc(s.c) + ' ks-v' + k + (ph ? " has-ph" : "") + '">' + ph + '<span class="ks-emo">' + c[0] + '</span><span class="ks-bt">' + esc(s.type || "") + "</span><b>" + esc((s.tags || [])[0] || c[1]) + "</b></div>";
  }
  // الدائرة جنب اسم المجلة: لوغو المجلة (إذا ما تحمّل، بيضل الإيموجي)
  function avatar(s, c) {
    return '<span class="ks-av ks-' + esc(s.c) + '">' + c[0] + (s.lg ? '<img src="/api/studies/logo?d=' + encodeURIComponent(s.lg) + '" alt="" loading="lazy" onerror="this.remove()">' : "") + "</span>";
  }
  function post(s) {
    var c = CAT[s.c] || CAT.training, link = s.doi ? "https://doi.org/" + encodeURI(s.doi) : "https://pubmed.ncbi.nlm.nih.gov/" + encodeURIComponent(s.id) + "/";
    return '<article class="ks-post"><header class="ks-h">' + avatar(s, c) + '<div><b dir="ltr">' + esc(s.j || s.ja) + "</b><small>" + esc(dAr(s.d)) + " · " + esc(c[1]) + "</small></div></header>" +
      '<h3 class="ks-t">' + esc(s.t) + "</h3>" + banner(s) + '<p class="ks-s">' + esc(s.s) + "</p>" +
      (s.k ? '<div class="ks-k"><b>💡 الخلاصة</b>' + esc(s.k) + "</div>" : "") +
      '<footer class="ks-f"><span class="ks-tags">' + (s.tags || []).map(function (t) { return "<i>#" + esc(String(t).replace(/\s+/g, "_")) + "</i>"; }).join("") + '</span><a href="' + esc(link) + '" target="_blank" rel="noopener">المصدر ↗</a></footer></article>';
  }
  // كل دراسات 2026 لليوم وكل الجديد: 20 بكل صفحة، وكل ما تنزل لتحت بيحمّل لحالو
  async function studies(app, H) {
    app.innerHTML = '<div class="ks"><div class="crumbs"><a href="#/exlib">المكتبة</a></div><h1 class="page-title">📰 آخر الدراسات</h1><p class="ks-lead">كل الأبحاث من أول 2026 لليوم، وكل جديد أول بأول، بالتغذية الرياضية والطب الرياضي والتدريب، من مجلات علمية محكّمة، ملخّصة بالعربي. <b data-ks-n></b></p><div class="ks-chips" data-ks-chips><button class="on" data-c="">الكل</button><button data-c="nutrition">🥗 تغذية</button><button data-c="medicine">🩺 طب رياضي</button><button data-c="training">🏋️ تدريب</button></div><div data-ks-list><div class="loading">جاري التحميل…</div></div><div class="ks-more" data-ks-more></div></div>';
    var f = "", p = 0, more = true, busy = false, gen = 0, n = 0;
    var box = app.querySelector("[data-ks-list]"), tail = app.querySelector("[data-ks-more]");
    async function next() {
      if (busy || !more) return; busy = true; var g = gen;
      tail.innerHTML = p ? '<div class="loading">جاري التحميل…</div>' : "";
      var j = null; try { var r = await fetch("/api/studies?p=" + p + (f ? "&c=" + f : ""), { cache: "no-store" }); j = await r.json(); } catch (e) { j = null; }
      if (g !== gen) return; busy = false;
      if (!j) { tail.innerHTML = '<button class="btn" data-ks-retry>صار خطأ، جرّب كمان مرة</button>'; return; }
      var L = j.list || [];
      if (!p) { box.innerHTML = L.length ? "" : '<div class="empty"><b>عم نجهّز الدراسات</b>الذكاء الاصطناعي عم يقرا ويلخّص هلق. ارجع بعد شوي.</div>'; var nb = app.querySelector("[data-ks-n]"); if (nb) nb.textContent = j.total ? "(" + j.total + " دراسة لهلق)" : ""; }
      box.insertAdjacentHTML("beforeend", L.map(post).join("")); n += L.length;
      p++; more = !!j.more; tail.innerHTML = more ? "" : (n ? '<p class="ks-end">هيك خلصت الدراسات الملخّصة لهلق، وكل يوم في جديد 👌</p>' : "");
      if (more && tail.getBoundingClientRect().top < innerHeight + 600) next();
    }
    tail.onclick = function (e) { if (e.target.closest("[data-ks-retry]")) next(); };
    var io = "IntersectionObserver" in window ? new IntersectionObserver(function (es) { if (!document.body.contains(tail)) { io.disconnect(); return; } if (es[0].isIntersecting) next(); }, { rootMargin: "600px" }) : null;
    if (io) io.observe(tail);
    app.querySelector("[data-ks-chips]").onclick = function (e) { var b = e.target.closest("button"); if (!b) return; f = b.dataset.c; app.querySelectorAll("[data-ks-chips] button").forEach(function (x) { x.classList.toggle("on", x === b); }); gen++; p = 0; n = 0; more = true; busy = false; box.innerHTML = '<div class="loading">جاري التحميل…</div>'; next(); };
    await next(); dragon("_studies", true);
  }

  // ---------- التغذية: متل التطبيقات العالمية وأحسن ----------
  // الهدف من معادلة Mifflin-St Jeor، والمصروف الحقيقي بيتعدّل لحالو من وزنك وأكلك (متل MacroFactor)،
  // يومية بوجبات وبحث عربي بأكل سوري، مي، ألياف، أكلات مفضّلة، ونسخ وجبة امبارح. البيانات بالجهاز وبتنحفظ بحسابك.
  // [الاسم، بالإنكليزي، سعرات، بروتين، كربوهيدرات، دهون (لكل 100 غ)، الحصة، غرامات الحصة]
  var FOODS = [
    ["خبز عربي (رغيف)", "pita bread", 275, 9, 55, 1.2, "رغيف", 70], ["خبز أسمر", "whole wheat bread", 250, 12, 41, 3.5, "شريحة", 35], ["خبز صمون", "baguette", 275, 9, 54, 2, "صمونة", 80], ["كعك", "kaak", 410, 10, 70, 10, "كعكة", 50],
    ["رز أبيض مطبوخ", "white rice cooked", 130, 2.7, 28, 0.3, "صحن", 200], ["رز بسمتي مطبوخ", "basmati rice", 121, 3.5, 25, 0.4, "صحن", 200], ["برغل مطبوخ", "bulgur cooked", 83, 3.1, 19, 0.2, "صحن", 200], ["فريكة مطبوخة", "freekeh", 115, 4.5, 23, 0.8, "صحن", 200],
    ["معكرونة مطبوخة", "pasta cooked", 158, 5.8, 31, 0.9, "صحن", 220], ["شوفان", "oats", 389, 17, 66, 7, "نص كاسة", 40], ["بطاطا مسلوقة", "boiled potato", 87, 1.9, 20, 0.1, "حبة وسط", 170], ["بطاطا مقلية", "french fries", 312, 3.4, 41, 15, "صحن", 150],
    ["بطاطا حلوة", "sweet potato", 90, 2, 21, 0.2, "حبة", 150], ["فول مدمس", "fava beans", 110, 7.6, 19, 0.4, "صحن", 250], ["حمص بطحينة", "hummus", 166, 8, 14, 9.6, "صحن صغير", 150], ["حمص حب مسلوق", "chickpeas cooked", 164, 8.9, 27, 2.6, "كاسة", 165],
    ["عدس مطبوخ", "lentils cooked", 116, 9, 20, 0.4, "كاسة", 200], ["شوربة عدس", "lentil soup", 70, 4.5, 11, 1.2, "زبدية", 300], ["مجدرة", "mujaddara", 165, 6, 26, 4.5, "صحن", 250], ["فلافل", "falafel", 333, 13, 32, 18, "حبة", 17],
    ["سندويشة فلافل", "falafel sandwich", 250, 8, 33, 10, "سندويشة", 230], ["شاورما دجاج (سندويشة)", "chicken shawarma", 215, 13, 21, 9, "سندويشة", 250], ["شاورما لحمة (سندويشة)", "beef shawarma", 240, 13, 20, 12, "سندويشة", 250], ["كبة مقلية", "fried kibbeh", 280, 13, 24, 15, "حبة", 60],
    ["كبة بالصينية", "baked kibbeh", 220, 13, 20, 10, "قطعة", 150], ["تبولة", "tabbouleh", 120, 2.4, 13, 7, "صحن", 150], ["فتوش", "fattoush", 95, 1.8, 10, 5.5, "صحن", 200], ["محشي كوسا", "stuffed zucchini", 95, 4.5, 11, 3.8, "حبة", 120],
    ["ورق عنب", "stuffed grape leaves", 150, 3, 20, 7, "حبة", 25], ["منسف/أرز بلحمة", "rice with meat", 190, 9, 22, 7, "صحن", 300], ["كبسة دجاج", "chicken kabsa", 165, 10, 20, 5, "صحن", 350], ["فتة حمص", "fatteh", 200, 7, 20, 10, "صحن", 300],
    ["مناقيش زعتر", "zaatar manakish", 320, 7, 40, 15, "قطعة", 120], ["مناقيش جبنة", "cheese manakish", 310, 12, 33, 14, "قطعة", 130], ["صفيحة لحمة", "sfiha", 260, 11, 26, 12, "قطعة", 60], ["شيش طاووق", "shish tawook", 165, 25, 2, 6.5, "سيخ", 120],
    ["كباب", "kebab", 250, 18, 2, 19, "سيخ", 100], ["صدر دجاج مشوي", "grilled chicken breast", 165, 31, 0, 3.6, "قطعة", 150], ["فخذ دجاج", "chicken thigh", 209, 26, 0, 11, "قطعة", 120], ["دجاج مقلي (بروستد)", "fried chicken", 290, 24, 11, 17, "قطعة", 150],
    ["لحمة غنم", "lamb", 282, 25, 0, 20, "حصة", 120], ["لحمة بقر قليلة الدهن", "lean beef", 217, 26, 0, 12, "حصة", 120], ["لحمة مفرومة", "ground beef", 254, 17, 0, 20, "حصة", 120], ["كبدة دجاج", "chicken liver", 167, 24, 1, 6.5, "حصة", 100],
    ["سمك مشوي", "grilled fish", 128, 26, 0, 2.7, "قطعة", 150], ["سلمون", "salmon", 208, 20, 0, 13, "قطعة", 150], ["تونة معلبة بالمي", "tuna in water", 116, 26, 0, 0.8, "علبة", 140], ["تونة بالزيت", "tuna in oil", 198, 29, 0, 8, "علبة", 140],
    ["سردين", "sardines", 208, 25, 0, 11, "علبة", 100], ["بيضة مسلوقة", "boiled egg", 155, 13, 1.1, 11, "بيضة", 50], ["بياض بيض", "egg white", 52, 11, 0.7, 0.2, "بياض بيضة", 33], ["عجة/بيض مقلي", "fried egg", 196, 14, 0.8, 15, "بيضة", 50],
    ["لبنة", "labneh", 160, 8, 5, 12, "ملعقة كبيرة", 30], ["جبنة بيضا", "white cheese", 264, 14, 4, 21, "قطعة", 30], ["جبنة عكاوي", "akkawi cheese", 270, 18, 2, 21, "قطعة", 30], ["جبنة قريش/كوتج", "cottage cheese", 98, 11, 3.4, 4.3, "نص كاسة", 110],
    ["لبن (زبادي)", "yogurt", 61, 3.5, 4.7, 3.3, "كاسة", 200], ["لبن يوناني", "greek yogurt", 97, 9, 4, 5, "كاسة", 170], ["حليب كامل الدسم", "whole milk", 61, 3.2, 4.8, 3.3, "كاسة", 240], ["حليب خالي الدسم", "skim milk", 34, 3.4, 5, 0.1, "كاسة", 240],
    ["عيران", "ayran", 37, 1.7, 2.8, 1.7, "كاسة", 250], ["زيتون", "olives", 115, 0.8, 6, 11, "5 حبات", 20], ["زيت زيتون", "olive oil", 884, 0, 0, 100, "ملعقة كبيرة", 14], ["طحينة", "tahini", 595, 17, 21, 54, "ملعقة كبيرة", 15],
    ["زبدة فول سوداني", "peanut butter", 588, 25, 20, 50, "ملعقة كبيرة", 16], ["لوز", "almonds", 579, 21, 22, 50, "حفنة", 28], ["جوز", "walnuts", 654, 15, 14, 65, "حفنة", 28], ["فستق حلبي", "pistachios", 560, 20, 28, 45, "حفنة", 28],
    ["بزر عباد الشمس", "sunflower seeds", 584, 21, 20, 51, "حفنة", 28], ["تمر", "dates", 282, 2.5, 75, 0.4, "حبة", 8], ["موز", "banana", 89, 1.1, 23, 0.3, "حبة", 120], ["تفاح", "apple", 52, 0.3, 14, 0.2, "حبة", 180],
    ["برتقال", "orange", 47, 0.9, 12, 0.1, "حبة", 150], ["عنب", "grapes", 69, 0.7, 18, 0.2, "عنقود صغير", 150], ["بطيخ", "watermelon", 30, 0.6, 7.6, 0.2, "شقفة", 280], ["فريز", "strawberries", 32, 0.7, 7.7, 0.3, "كاسة", 150],
    ["مشمش", "apricot", 48, 1.4, 11, 0.4, "حبة", 35], ["تين", "figs", 74, 0.8, 19, 0.3, "حبة", 50], ["رمان", "pomegranate", 83, 1.7, 19, 1.2, "حبة", 280], ["أفوكادو", "avocado", 160, 2, 9, 15, "نص حبة", 100],
    ["خيار", "cucumber", 15, 0.7, 3.6, 0.1, "حبة", 120], ["بندورة", "tomato", 18, 0.9, 3.9, 0.2, "حبة", 120], ["خس", "lettuce", 15, 1.4, 2.9, 0.2, "صحن", 100], ["سلطة خضرا بلا زيت", "green salad", 20, 1.2, 4, 0.2, "صحن", 200],
    ["بروكلي", "broccoli", 34, 2.8, 7, 0.4, "كاسة", 90], ["سبانخ", "spinach", 23, 2.9, 3.6, 0.4, "كاسة", 60], ["جزر", "carrot", 41, 0.9, 10, 0.2, "حبة", 70], ["فول أخضر/فاصولياء", "green beans", 31, 1.8, 7, 0.2, "صحن", 150],
    ["بامية بالبندورة", "okra stew", 70, 2, 8, 3.5, "صحن", 250], ["ملوخية", "molokhia", 60, 4, 5, 3, "صحن", 250], ["شوربة دجاج", "chicken soup", 40, 3.5, 4, 1.2, "زبدية", 300], ["عصير برتقال طبيعي", "orange juice", 45, 0.7, 10, 0.2, "كاسة", 240],
    ["كولا", "cola", 42, 0, 10.6, 0, "علبة", 330], ["شاي بسكر (ملعقتين)", "tea with sugar", 32, 0, 8, 0, "كاسة", 250], ["قهوة عربية بلا سكر", "arabic coffee", 2, 0.1, 0, 0, "فنجان", 60], ["نسكافيه بحليب وسكر", "coffee with milk", 55, 1.8, 8, 1.8, "كاسة", 250],
    ["عسل", "honey", 304, 0.3, 82, 0, "ملعقة كبيرة", 21], ["سكر", "sugar", 387, 0, 100, 0, "ملعقة صغيرة", 4], ["مربى", "jam", 278, 0.4, 69, 0.1, "ملعقة كبيرة", 20], ["شوكولا حليب", "milk chocolate", 535, 7.7, 59, 30, "قطعة", 40],
    ["بقلاوة", "baklava", 430, 6, 50, 23, "قطعة", 40], ["كنافة", "knafeh", 380, 8, 40, 21, "قطعة", 120], ["هريسة/بسبوسة", "basbousa", 360, 4, 55, 14, "قطعة", 80], ["بسكويت", "biscuits", 480, 6.5, 68, 20, "3 حبات", 30],
    ["شيبس", "chips", 536, 7, 53, 35, "كيس صغير", 30], ["بوشار", "popcorn", 387, 13, 78, 4.5, "كاسة", 10], ["واي بروتين", "whey protein", 380, 78, 8, 5, "سكوب", 30], ["كازين", "casein", 360, 80, 6, 2, "سكوب", 33],
    ["مكمّل كرياتين", "creatine", 0, 0, 0, 0, "5 غرام", 5], ["بار بروتين", "protein bar", 360, 30, 38, 10, "قطعة", 60], ["جاينر", "mass gainer", 380, 15, 75, 3, "سكوب", 100], ["بيتزا", "pizza", 266, 11, 33, 10, "شقفة", 110],
    ["برغر", "burger", 254, 13, 24, 12, "سندويشة", 200], ["همبرغر لحمة (قرص)", "beef patty", 250, 17, 0, 20, "قرص", 113], ["مايونيز", "mayonnaise", 680, 1, 0.6, 75, "ملعقة كبيرة", 14], ["كاتشب", "ketchup", 101, 1, 27, 0.1, "ملعقة كبيرة", 17],
  ];
  var MEALS = [["b", "🌅 الفطور"], ["l", "☀️ الغدا"], ["d", "🌙 العشا"], ["s", "🍎 سناك"]];
  var ACT = [[1.2, "قليل الحركة (شغل مكتبي)"], [1.375, "خفيف: تمرين 1–3 أيام"], [1.55, "متوسط: تمرين 3–5 أيام"], [1.725, "عالي: تمرين 6–7 أيام"], [1.9, "رياضي جداً أو شغل جسدي"]];
  var GOAL = [["cut", "تنشيف (نزول وزن)"], ["keep", "ثبات"], ["bulk", "تضخيم (زيادة عضل)"]];
  var NK = "ko_nutri";
  var N = null;
  var today = function (o) { var d = new Date(); d.setDate(d.getDate() + (o || 0)); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  var r1 = function (x) { return Math.round(x * 10) / 10; };
  function load() { try { N = JSON.parse(localStorage.getItem(NK) || "null"); } catch (e) { N = null; } if (!N) N = { prof: null, days: {}, wt: {}, fav: [], recent: [], custom: [], at: 0 }; return N; }
  var syncT = 0, H0 = null;
  function save() { N.at = Date.now(); try { localStorage.setItem(NK, JSON.stringify(N)); } catch (e) {} clearTimeout(syncT); syncT = setTimeout(function () { if (H0) fetch("/api/nutri", { method: "PUT", headers: Object.assign({ "content-type": "application/json" }, H0.auth()), credentials: "same-origin", body: JSON.stringify(N) }).catch(function () {}); }, 1500); }
  async function pull(H) { try { var r = await fetch("/api/nutri", { headers: H.auth(), credentials: "same-origin", cache: "no-store" }); if (!r.ok) return; var j = await r.json(); if (j && j.data && (j.data.at || 0) > (N.at || 0)) { N = j.data; try { localStorage.setItem(NK, JSON.stringify(N)); } catch (e) {} } } catch (e) {} }
  function targets(p) {
    var w = +p.w, bmr = 10 * w + 6.25 * +p.h - 5 * +p.age + (p.sex === "f" ? -161 : 5), tdee = (p.tdee > 0 ? +p.tdee : bmr * +p.act);
    var rate = +p.rate || 0.5, kcal = p.goal === "cut" ? tdee - rate * 7700 / 7 : p.goal === "bulk" ? tdee + rate * 7700 / 7 : tdee;
    kcal = Math.max(p.sex === "f" ? 1200 : 1500, Math.round(kcal / 10) * 10);
    var pr = Math.round(w * (p.goal === "cut" ? 2.2 : p.goal === "bulk" ? 1.8 : 1.8)), fat = Math.round(Math.max(w * 0.7, kcal * 0.25 / 9)), carb = Math.max(50, Math.round((kcal - pr * 4 - fat * 9) / 4));
    return { kcal: kcal, p: pr, c: carb, f: fat, water: Math.round(w * 35 / 250), fiber: Math.round(kcal / 1000 * 14), bmr: Math.round(bmr), tdee: Math.round(tdee) };
  }
  function dayOf(d) { var x = N.days[d]; if (!x) x = N.days[d] = { m: { b: [], l: [], d: [], s: [] }, water: 0 }; return x; }
  function sum(d) { var t = { kcal: 0, p: 0, c: 0, f: 0 }, x = N.days[d]; if (!x) return t; MEALS.forEach(function (m) { (x.m[m[0]] || []).forEach(function (e) { t.kcal += e.kcal; t.p += e.p; t.c += e.c; t.f += e.f; }); }); return t; }
  function trendW() {
    var ks = Object.keys(N.wt).sort(), out = {}, ema = null;
    ks.forEach(function (k) { ema = ema == null ? N.wt[k] : ema + 0.1 * (N.wt[k] - ema); out[k] = ema; }); return out;
  }
  // المصروف الحقيقي (متل MacroFactor): معدّل الأكل بآخر 21 يوم ناقص تغيّر الوزن (7700 سعرة لكل كيلو)
  function adaptive() {
    var days = [], tw = trendW(), wk = Object.keys(tw).sort();
    for (var i = 1; i <= 21; i++) { var d = today(-i), s = sum(d); if (s.kcal > 300) days.push(s.kcal); }
    if (days.length < 10 || wk.length < 5) return null;
    var a = wk.filter(function (k) { return k >= today(-21); }); if (a.length < 4) return null;
    var dw = tw[a[a.length - 1]] - tw[a[0]], span = Math.max(7, (Date.parse(a[a.length - 1]) - Date.parse(a[0])) / 864e5);
    var avg = days.reduce(function (x, y) { return x + y; }, 0) / days.length;
    return { tdee: Math.round((avg - dw * 7700 / span) / 10) * 10, avg: Math.round(avg), dw: r1(dw), n: days.length };
  }
  function allFoods() { return FOODS.map(function (f, i) { return { k: "f" + i, n: f[0], en: f[1], kcal: f[2], p: f[3], c: f[4], f: f[5], sv: f[6], sg: f[7] }; }).concat((N.custom || []).map(function (f) { return Object.assign({ k: f.k }, f); })); }
  var norm = function (s) { return String(s || "").toLowerCase().replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه"); };

  function nutri(app, H) {
    H0 = H; load();
    var st = { d: today(), add: null, q: "", sel: null };
    pull(H).then(function () { draw(); });
    function ring(v, max) { var p = Math.max(0, Math.min(1, v / (max || 1))), C = 2 * Math.PI * 52; return '<svg viewBox="0 0 120 120" class="kn-ring"><circle cx="60" cy="60" r="52" class="kn-rbg"/><circle cx="60" cy="60" r="52" class="kn-rfg' + (v > max ? " over" : "") + '" stroke-dasharray="' + (C * p).toFixed(1) + " " + C.toFixed(1) + '" transform="rotate(-90 60 60)"/></svg>'; }
    function bar(lbl, v, max, cls) { var p = Math.min(100, Math.round(100 * v / (max || 1))); return '<div class="kn-bar ' + cls + '"><div><b>' + lbl + "</b><span>" + Math.round(v) + " / " + max + " غ</span></div><i><u style=\"width:" + p + '%"></u></i></div>'; }
    function setup() {
      var p = N.prof || { sex: "m", age: 25, h: 175, w: 75, act: 1.55, goal: "keep", rate: 0.5 };
      app.innerHTML = '<div class="kn"><div class="crumbs"><a href="#/exlib">المكتبة</a></div><h1 class="page-title">🍽️ التغذية</h1><p class="kn-lead">جاوب على هالأسئلة مرة وحدة، ومنحسبلك السعرات والبروتين والكربوهيدرات والدهون يلي بتلزمك.</p><form class="kn-form" data-kn-setup>' +
        '<div class="kn-seg"><label><input type="radio" name="sex" value="m"' + (p.sex !== "f" ? " checked" : "") + '> ذكر</label><label><input type="radio" name="sex" value="f"' + (p.sex === "f" ? " checked" : "") + "> أنثى</label></div>" +
        '<div class="kn-3"><label>العمر<input name="age" type="number" inputmode="numeric" min="13" max="90" value="' + p.age + '"></label><label>الطول (سم)<input name="h" type="number" inputmode="numeric" min="120" max="230" value="' + p.h + '"></label><label>الوزن (كغ)<input name="w" type="number" inputmode="decimal" step="0.1" min="35" max="250" value="' + p.w + '"></label></div>' +
        '<label>نشاطك<select name="act">' + ACT.map(function (a) { return '<option value="' + a[0] + '"' + (+p.act === a[0] ? " selected" : "") + ">" + a[1] + "</option>"; }).join("") + "</select></label>" +
        '<label>هدفك<select name="goal">' + GOAL.map(function (g) { return '<option value="' + g[0] + '"' + (p.goal === g[0] ? " selected" : "") + ">" + g[1] + "</option>"; }).join("") + "</select></label>" +
        '<label>السرعة (كغ بالأسبوع)<select name="rate">' + [0.25, 0.5, 0.75, 1].map(function (r) { return '<option value="' + r + '"' + (+p.rate === r ? " selected" : "") + ">" + r + " كغ" + (r === 0.5 ? " (منصوح فيها)" : "") + "</option>"; }).join("") + "</select></label>" +
        '<button class="btn btn-red" type="submit">احسبلي ✓</button></form></div>';
      app.querySelector("[data-kn-setup]").onsubmit = function (e) {
        e.preventDefault(); var f = Object.fromEntries(new FormData(e.target));
        N.prof = { sex: f.sex, age: +f.age, h: +f.h, w: +f.w, act: +f.act, goal: f.goal, rate: +f.rate, tdee: 0 };
        N.wt[today()] = +f.w; save(); draw(); H.toast("✓ انحسب هدفك");
      };
    }
    function entryRow(m, e, i) { return '<li><div><b>' + esc(e.n) + "</b><small>" + Math.round(e.g) + " غ · ب " + r1(e.p) + " · ك " + r1(e.c) + " · د " + r1(e.f) + '</small></div><span>' + Math.round(e.kcal) + '</span><button type="button" data-kn-del="' + m + ":" + i + '" aria-label="احذف">×</button></li>'; }
    function draw() {
      if (!app.isConnected || !N) return;
      if (!N.prof) return setup();
      var T = targets(N.prof), D = dayOf(st.d), S = sum(st.d), left = T.kcal - Math.round(S.kcal), ad = adaptive(), tw = trendW(), wk = Object.keys(tw).sort();
      var wNow = wk.length ? r1(tw[wk[wk.length - 1]]) : N.prof.w;
      app.innerHTML = '<div class="kn"><div class="crumbs"><a href="#/exlib">المكتبة</a></div><h1 class="page-title">🍽️ التغذية</h1>' +
        '<div class="kn-days"><button type="button" data-kn-day="-1" aria-label="اليوم يلي قبل">›</button><b>' + (st.d === today() ? "اليوم" : st.d === today(-1) ? "مبارح" : esc(st.d)) + '</b><button type="button" data-kn-day="1" aria-label="اليوم يلي بعد"' + (st.d >= today() ? " disabled" : "") + ">‹</button></div>" +
        '<section class="kn-top"><div class="kn-rw">' + ring(S.kcal, T.kcal) + '<div class="kn-rt"><b>' + Math.abs(left) + "</b><small>" + (left >= 0 ? "سعرة باقية" : "سعرة زيادة") + "</small></div></div>" +
        '<div class="kn-sum"><div><small>الهدف</small><b>' + T.kcal + '</b></div><div><small>أكلت</small><b>' + Math.round(S.kcal) + "</b></div></div></section>" +
        '<section class="kn-macros">' + bar("بروتين", S.p, T.p, "p") + bar("كربوهيدرات", S.c, T.c, "c") + bar("دهون", S.f, T.f, "f") + "</section>" +
        '<section class="kn-water"><b>💧 المي</b><div>' + Array.from({ length: Math.max(8, T.water) }, function (_, i) { return '<button type="button" data-kn-w="' + (i + 1) + '" class="' + (i < D.water ? "on" : "") + '" aria-label="كاسة ' + (i + 1) + '"></button>'; }).join("") + "</div><small>" + D.water + " من " + T.water + " كاسات (250 مل)</small></section>" +
        MEALS.map(function (m) { var L = D.m[m[0]] || [], k = L.reduce(function (a, e) { return a + e.kcal; }, 0); return '<section class="kn-meal"><header><b>' + m[1] + "</b><span>" + Math.round(k) + ' سعرة</span><button type="button" class="btn btn-dark sm" data-kn-add="' + m[0] + '">+ أضف</button></header>' + (L.length ? "<ul>" + L.map(function (e, i) { return entryRow(m[0], e, i); }).join("") + "</ul>" : "") + "</section>"; }).join("") +
        '<div class="kn-acts"><button type="button" class="btn btn-ghost sm" data-kn-copy>نسخ أكل مبارح لهون</button></div>' +
        '<section class="kn-wt"><header><b>⚖️ الوزن</b><span>الاتجاه: ' + wNow + ' كغ</span></header><div class="kn-wrow"><input type="number" step="0.1" inputmode="decimal" placeholder="وزنك اليوم" data-kn-wv value="' + (N.wt[st.d] || "") + '"><button type="button" class="btn btn-dark sm" data-kn-ws>سجّل</button></div>' + spark(tw) + "</section>" +
        (ad ? '<section class="kn-ad"><b>🧠 مصروفك الحقيقي تقريباً ' + ad.tdee + " سعرة</b><small>من أكلك (" + ad.avg + " بالمعدّل، " + ad.n + " يوم) وتغيّر وزنك (" + ad.dw + " كغ). هيك الهدف بيصير على قدّ جسمك أنت، مو على معادلة.</small>" + (Math.abs(ad.tdee - T.tdee) > 80 ? '<button type="button" class="btn btn-red sm" data-kn-adapt="' + ad.tdee + '">حدّث هدفي</button>' : "<i>✓ هدفك مزبوط</i>") + "</section>" : '<section class="kn-ad soft"><small>🧠 سجّل أكلك ووزنك أسبوعين، ومنحسبلك مصروفك الحقيقي من جسمك (أدق من أي معادلة).</small></section>') +
        '<section class="kn-info"><small>هدفك: ' + (GOAL.find(function (g) { return g[0] === N.prof.goal; }) || [0, ""])[1] + " · الحرق بالراحة " + T.bmr + " · المصروف " + T.tdee + " · ألياف " + T.fiber + ' غ</small><button type="button" class="btn btn-ghost sm" data-kn-edit>عدّل بياناتي</button></section></div>';
    }
    function spark(tw) {
      var ks = Object.keys(N.wt).sort().slice(-30); if (ks.length < 2) return "";
      var v = ks.map(function (k) { return N.wt[k]; }), t = ks.map(function (k) { return tw[k]; }), mn = Math.min.apply(0, v.concat(t)) - 0.5, mx = Math.max.apply(0, v.concat(t)) + 0.5;
      var X = function (i) { return 8 + i * (284 / (ks.length - 1)); }, Y = function (x) { return 70 - (x - mn) / (mx - mn) * 60; };
      return '<svg class="kn-spark" viewBox="0 0 300 80"><path class="t" d="' + t.map(function (x, i) { return (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(x).toFixed(1); }).join("") + '"/>' + v.map(function (x, i) { return '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(x).toFixed(1) + '" r="2.4"/>'; }).join("") + "</svg>";
    }
    function addSheet(meal) {
      st.add = meal; st.q = ""; st.sel = null;
      var foods = allFoods(), byK = {}; foods.forEach(function (f) { byK[f.k] = f; });
      var html = '<div class="kn-add"><input type="search" data-kn-q placeholder="دوّر: رز، دجاج، فلافل…" aria-label="بحث"><div class="kn-list" data-kn-list></div>' +
        '<details class="kn-custom"><summary>➕ أكلة مو موجودة؟ ضيفها</summary><div class="kn-3"><label>الاسم<input data-c-n></label><label>سعرات/100غ<input type="number" data-c-k></label><label>بروتين<input type="number" step="0.1" data-c-p></label><label>كربو<input type="number" step="0.1" data-c-c></label><label>دهون<input type="number" step="0.1" data-c-f></label><label>الحصة (غ)<input type="number" data-c-g value="100"></label></div><button type="button" class="btn btn-dark sm" data-c-save>احفظ الأكلة</button></details>' +
        '<div class="kn-quick"><b>إضافة سريعة</b><div class="kn-3"><label>سعرات<input type="number" data-q-k></label><label>بروتين<input type="number" data-q-p></label><button type="button" class="btn btn-ghost sm" data-q-go>أضف</button></div></div></div>';
      H.sheet("أضف لـ " + (MEALS.find(function (m) { return m[0] === meal; }) || [0, ""])[1], html, function (root) {
        var box = root.querySelector("[data-kn-list]"), q = root.querySelector("[data-kn-q]");
        var list = function () {
          var w = norm(q.value).split(/\s+/).filter(Boolean), rec = (N.recent || []).map(function (k) { return byK[k]; }).filter(Boolean);
          // الكلمة يلي بتبلّش فيها الأكلة أول، وبعدين يلي فيها كلمة بتبلّش هيك، وبعدين الباقي («بيض» ما بيطلّع «رز أبيض» أول شي)
          var score = function (f) { var nn = norm(f.n), s2 = nn + " " + norm(f.en), ws = s2.split(/\s+/); if (!w.every(function (x) { return s2.indexOf(x) >= 0; })) return -1; return (nn.indexOf(w[0]) === 0 ? 4 : 0) + (w.every(function (x) { return ws.some(function (y) { return y.indexOf(x) === 0; }); }) ? 2 : 0); };
          var a = w.length ? foods.map(function (f) { return [score(f), f]; }).filter(function (x) { return x[0] >= 0; }).sort(function (p, q) { return q[0] - p[0]; }).map(function (x) { return x[1]; }).slice(0, 40) : rec.concat(foods.filter(function (f) { return rec.indexOf(f) < 0; })).slice(0, 30);
          box.innerHTML = (!w.length && rec.length ? "<small class=\"kn-h\">آخر يلي أكلتو</small>" : "") + a.map(function (f) { return '<button type="button" class="kn-food" data-f="' + f.k + '"><b>' + esc(f.n) + "</b><small>" + f.kcal + " سعرة/100غ · " + esc(f.sv) + " = " + f.sg + " غ</small></button>"; }).join("") || '<p class="kn-h">ما لقينا شي. ضيفها تحت ⬇️</p>';
        };
        q.oninput = list; list(); setTimeout(function () { q.focus(); }, 200);
        var addE = function (f, g) { var e = { k: f.k, n: f.n, g: g, kcal: f.kcal * g / 100, p: f.p * g / 100, c: f.c * g / 100, f: f.f * g / 100 }; dayOf(st.d).m[meal].push(e); N.recent = [f.k].concat((N.recent || []).filter(function (x) { return x !== f.k; })).slice(0, 20); save(); H.closeSheet(); draw(); H.toast("✓ انضاف " + esc(f.n)); };
        box.onclick = function (ev) {
          var b = ev.target.closest("[data-f]"); if (!b) return; var f = byK[b.dataset.f];
          if (b.nextElementSibling && b.nextElementSibling.classList.contains("kn-amt")) { b.nextElementSibling.remove(); return; }
          box.querySelectorAll(".kn-amt").forEach(function (x) { x.remove(); });
          b.insertAdjacentHTML("afterend", '<div class="kn-amt"><button type="button" data-n="0.5">½ ' + esc(f.sv) + '</button><button type="button" data-n="1">1 ' + esc(f.sv) + '</button><button type="button" data-n="2">2</button><label><input type="number" inputmode="decimal" value="' + f.sg + '" data-g> غ</label><button type="button" class="btn btn-red sm" data-ok>أضف</button></div>');
          var am = b.nextElementSibling;
          am.onclick = function (e2) { var n = e2.target.closest("[data-n]"); if (n) { addE(f, f.sg * +n.dataset.n); return; } if (e2.target.closest("[data-ok]")) { var g = +am.querySelector("[data-g]").value; if (g > 0) addE(f, g); } };
        };
        root.querySelector("[data-c-save]").onclick = function () {
          var g = function (s) { return root.querySelector(s).value; }, n = g("[data-c-n]").trim(), k = +g("[data-c-k]");
          if (!n || !(k >= 0)) return H.toast("اكتب الاسم والسعرات");
          var f = { k: "c" + Date.now().toString(36), n: n, en: "", kcal: k, p: +g("[data-c-p]") || 0, c: +g("[data-c-c]") || 0, f: +g("[data-c-f]") || 0, sv: "حصة", sg: +g("[data-c-g]") || 100 };
          N.custom = (N.custom || []).concat([f]); byK[f.k] = f; foods.push(f); save(); addE(f, f.sg);
        };
        root.querySelector("[data-q-go]").onclick = function () { var k = +root.querySelector("[data-q-k]").value, p = +root.querySelector("[data-q-p]").value || 0; if (!(k > 0)) return H.toast("اكتب السعرات"); dayOf(st.d).m[meal].push({ k: "q", n: "إضافة سريعة", g: 0, kcal: k, p: p, c: 0, f: 0 }); save(); H.closeSheet(); draw(); };
      });
    }
    app.onclick = function (e) {
      var t;
      if ((t = e.target.closest("[data-kn-day]"))) { var d = new Date(st.d); d.setDate(d.getDate() + +t.dataset.knDay); var s = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); if (s <= today()) { st.d = s; draw(); } return; }
      if ((t = e.target.closest("[data-kn-add]"))) return addSheet(t.dataset.knAdd);
      if ((t = e.target.closest("[data-kn-del]"))) { var p = t.dataset.knDel.split(":"); dayOf(st.d).m[p[0]].splice(+p[1], 1); save(); draw(); return; }
      if ((t = e.target.closest("[data-kn-w]"))) { var D = dayOf(st.d), n = +t.dataset.knW; D.water = D.water === n ? n - 1 : n; save(); draw(); if (D.water === targets(N.prof).water) H.toast("💧 خلّصت مي اليوم. عاش!"); return; }
      if (e.target.closest("[data-kn-copy]")) { var y = N.days[today(-1)]; if (!y) return H.toast("ما في أكل مسجّل مبارح"); var D2 = dayOf(st.d); MEALS.forEach(function (m) { D2.m[m[0]] = D2.m[m[0]].concat(JSON.parse(JSON.stringify(y.m[m[0]] || []))); }); save(); draw(); H.toast("✓ انسخ أكل مبارح"); return; }
      if (e.target.closest("[data-kn-ws]")) { var v = +app.querySelector("[data-kn-wv]").value; if (!(v > 30 && v < 300)) return H.toast("اكتب وزنك بالكيلو"); N.wt[st.d] = v; save(); draw(); H.toast("✓ انسجّل الوزن"); return; }
      if ((t = e.target.closest("[data-kn-adapt]"))) { N.prof.tdee = +t.dataset.knAdapt; save(); draw(); H.toast("✓ هدفك صار على قدّ جسمك"); return; }
      if (e.target.closest("[data-kn-edit]")) return setup();
    };
    draw(); dragon("_nutri", true);
  }

  window.KOGym = { map: map, dragon: dragon, dragonHide: dragonHide, say: say, studies: studies, nutri: nutri };
})();
