// Complete store templates ("packs"): look + behaviour + home page + conversion features, from the first visit to the order.
// Each pack is applied as one unit from the dashboard (nothing is saved until the owner presses Save).
(function () {
  var TRUST = [{ i: "💵", t: "الدفع عند الاستلام" }, { i: "🚚", t: "توصيل لكل المحافظات" }, { i: "💬", t: "دعم مباشر عبر واتساب" }];
  var trust4 = TRUST.concat([{ i: "✅", t: "منتجات أصلية ومفحوصة قبل الشحن" }]);
  var F = function (icon, title, text) { return { icon: icon, title: title, text: text || "" }; };
  var perks = function (id, title) { return { id: id, type: "features", on: true, title: title || "", layout: "grid", items: [F("🚚", "توصيل لكل المحافظات"), F("💵", "الدفع عند الاستلام"), F("💬", "دعم عبر واتساب"), F("🔁", "تأكيد الطلب قبل الشحن")] }; };
  var secs = {
    slider: function (i) { return { id: "s" + i, type: "slider", on: true, title: "" }; },
    cats: function (i, t) { return { id: "s" + i, type: "categories", on: true, title: t || "تسوّق حسب القسم" }; },
    news: function (i, t, l) { return { id: "s" + i, type: "new", on: true, title: t || "وصل حديثاً", count: 12, layout: l || "row" }; },
    best: function (i, t, l) { return { id: "s" + i, type: "best", on: true, title: t || "الأكثر مبيعاً", count: 12, layout: l || "row" }; },
    recent: function (i) { return { id: "s" + i, type: "recent", on: true, title: "شاهدتها مؤخراً", count: 10, layout: "row" }; },
    groups: function (i) { return { id: "s" + i, type: "groups", on: true, title: "" }; },
    perks: function (i, t) { return perks("s" + i, t); }
  };
  var bn = function (items, o) { return Object.assign({ items: items, height: 62, width: 100, bottom: 0, radius: 0, iconSize: 24, labelSize: 11, bg: "", fg: "", active: "", activeStyle: "color", showLabels: true, hideScroll: false }, o || {}); };
  var NAV5 = [{ label: "الرئيسية", icon: "home", link: "#/" }, { label: "المتجر", icon: "shop", link: "#/all" }, { label: "السلّة", icon: "cart", link: "#/cart" }, { label: "واتساب", icon: "whatsapp", link: "wa" }, { label: "القائمة", icon: "menu", link: "menu" }];

  window.KO_PACKS = [
    { id: "flash", name: "صاعقة", emoji: "⚡", tag: "للعروض والتخفيضات والبيع السريع", sw: ["#0b0b0f", "#1a1a22", "#e11d2e", "#ffd60a"],
      feats: ["عدّاد تنازلي للعرض أعلى الموقع", "شريط التوصيل المجاني يتعبّى مع السلة", "شارات خصم مائلة وأزرار نابضة", "اقتراحات «ناسبهم مع طلبك» بالسلة", "دخول «قطع بتتركّب» وشريط تنقل عائم", "زر واتساب عائم وطلب سريع بالاسم الأول"],
      design: { colors: { hdrBg: "#0b0b0f", pageBg: "#101015", cardBg: "#1a1a22", btnBg: "#e11d2e", btn2Bg: "#1a1a22", heroBg: "#0b0b0f", ftrBg: "#07070a", annBg: "#e11d2e" }, headingFont: "Changa", bodyFont: "Cairo", radius: 12, cardStyle: "border", btnShape: "rounded", skin: "flash",
        layout: { hdr: "center", hero: "full", card: "icon", cat: "circle", title: "bar", ftr: "classic", cols: "m", dens: "normal", ann: "marquee", pdp: "store", rows: "start", list: "store", nav: "on", drawer: "accordion", price: "latin" },
        open: { style: "pieces", speed: "fast", freq: "session" }, fx: { reveal: "up", speed: "fast", card: "lift", btn: "pulse", progress: true, toTop: true },
        bnav: bn(NAV5, { radius: 22, width: 94, bottom: 8, activeStyle: "pill", bg: "#16161d", fg: "#ffffff", active: "#ffd60a" }), buyNow: true,
        conv: { timer: { on: true, text: "⚡ عرض الصاعقة ينتهي بعد", btn: "تسوّق الآن", link: "#/all", days: 3 }, shipBar: true, trust: true, trustItems: trust4, upsell: true }, games: { on: false } },
      home: [secs.slider(1), secs.perks(2), secs.news(3, "🔥 وصل حديثاً"), secs.best(4, "الأكثر مبيعاً"), secs.recent(5), secs.cats(6, "تسوّق حسب القسم"), secs.groups(7)],
      announcement: "🔥 خصومات لفترة محدودة — الدفع عند الاستلام وتوصيل لكل المحافظات", checkout: { nameMode: "first", emailOn: false, altPhone: false, postal: false }, waFloat: true },

    { id: "boutique", name: "بوتيك", emoji: "◆", tag: "فخم وهادئ للمنتجات الراقية", sw: ["#1b1b1b", "#6b5416", "#faf7f2", "#d4af37"],
      feats: ["تصميم فخم بخطوط رفيعة وصور عمودية كبيرة", "ظهور ناعم وبطيء للعناصر (ستارة)", "اقتراحات بالسلة وشارات ثقة أنيقة", "شريط تنقل بسيط بنقطة للزر الفعّال", "شريط توصيل مجاني جميل بالسلة"],
      design: { colors: { hdrBg: "#ffffff", pageBg: "#faf7f2", cardBg: "#ffffff", btnBg: "#1b1b1b", btn2Bg: "#1b1b1b", heroBg: "#1b1b1b", ftrBg: "#1b1b1b", annBg: "#1b1b1b" }, headingFont: "El Messiri", bodyFont: "IBM Plex Sans Arabic", radius: 2, cardStyle: "flat", btnShape: "square", skin: "boutique",
        layout: { hdr: "center", hero: "center", card: "minimal", cat: "big", title: "center", ftr: "center", cols: "m", dens: "airy", ann: "static", pdp: "stack", rows: "center", list: "classic", nav: "on", drawer: "list", price: "latin" },
        open: { style: "curtain", speed: "slow", freq: "session" }, fx: { reveal: "fade", speed: "slow", page: "fade", card: "zoom", img: "fade", smooth: true },
        bnav: bn(NAV5, { bg: "#ffffff", fg: "#1b1b1b", active: "#1b1b1b", activeStyle: "dot", iconSize: 22 }), buyNow: false,
        conv: { timer: { on: false }, shipBar: true, trust: true, trustItems: TRUST, upsell: true }, games: { on: false } },
      home: [secs.slider(1), secs.cats(2, "مجموعاتنا"), secs.news(3, "وصل حديثاً", "grid"), secs.perks(4), secs.best(5, "الأكثر طلباً"), secs.recent(6)],
      announcement: "توصيل لكل المحافظات — الدفع عند الاستلام", checkout: { nameMode: "full3", emailOn: false }, waFloat: false },

    { id: "street", name: "ستريت", emoji: "🧢", tag: "جريء وشبابي بألوان نيون", sw: ["#000000", "#111111", "#c6ff00", "#ffffff"],
      feats: ["حدود سميكة وظلال حادة بأسلوب الستريت", "عناوين بلاصق مائلة وأزرار تنضغط", "دخول «قطع من كل الجهات» وهيدر يختفي عند النزول", "شريط تنقل بأزرار كبيرة وألعاب", "عدّاد عرض نيون وشارات ثقة بإطار"],
      design: { colors: { hdrBg: "#000000", pageBg: "#0a0a0a", cardBg: "#111111", btnBg: "#c6ff00", btn2Bg: "#111111", heroBg: "#000000", ftrBg: "#000000", annBg: "#c6ff00" }, headingFont: "Lalezar", bodyFont: "Cairo", radius: 0, cardStyle: "border", btnShape: "square", skin: "street",
        layout: { hdr: "inline", hero: "edge", card: "framed", cat: "tile", title: "caps", ftr: "line", cols: "m", dens: "compact", ann: "marquee", pdp: "store", rows: "start", list: "store", nav: "on", drawer: "list", price: "latin" },
        open: { style: "pieces", speed: "fast", freq: "session" }, fx: { reveal: "left", speed: "fast", btn: "ripple", hideHeader: true, toTop: true },
        bnav: bn([{ label: "الرئيسية", icon: "home", link: "#/" }, { label: "المتجر", icon: "fire", link: "#/all" }, { label: "ألعاب", icon: "game", link: "games" }, { label: "السلّة", icon: "cart", link: "#/cart" }], { height: 64, radius: 0, bg: "#000000", fg: "#ffffff", active: "#c6ff00", activeStyle: "pill" }), buyNow: true,
        conv: { timer: { on: true, text: "DROP ينتهي بعد", btn: "الحق", link: "#/all", days: 2 }, shipBar: true, trust: true, trustItems: trust4, upsell: true }, games: { on: true, title: "ألعاب", memory: true, tap: true, wheel: true } },
      home: [secs.slider(1), secs.news(2, "جديد الدروب", "row"), secs.cats(3, "الأقسام"), secs.best(4, "الأكثر مبيعاً"), secs.perks(5), secs.recent(6), secs.groups(7)],
      announcement: "NEW DROP — توصيل لكل المحافظات والدفع عند الاستلام", checkout: { nameMode: "first", emailOn: false, altPhone: false }, waFloat: true },

    { id: "express", name: "إكسبرس", emoji: "🛒", tag: "متجر سريع وكثيف يشجّع على الشراء فوراً", sw: ["#0f3d24", "#16a34a", "#f3f7f4", "#0f172a"],
      feats: ["شبكة كثيفة وزر «أضف للسلة» عريض بكل بطاقة", "شريط التوصيل المجاني ثابت ويتابعك", "شارات ثقة بالسلة والدفع وصفحة المنتج", "اقتراحات سريعة بالسلة بضغطة وحدة", "شاهدتها مؤخراً + طلب بالاسم الأول فقط", "لمعة على أزرار الشراء"],
      design: { colors: { hdrBg: "#ffffff", pageBg: "#f3f7f4", cardBg: "#ffffff", btnBg: "#16a34a", btn2Bg: "#0f172a", heroBg: "#0f3d24", ftrBg: "#0f172a", annBg: "#16a34a" }, headingFont: "Cairo", bodyFont: "Cairo", radius: 12, cardStyle: "border", btnShape: "rounded", skin: "express",
        layout: { hdr: "classic", hero: "box", card: "store", cat: "circle", title: "plain", ftr: "classic", cols: "m", dens: "compact", ann: "static", pdp: "store", rows: "start", list: "store", nav: "on", drawer: "accordion", price: "latin" },
        open: { style: "up", speed: "fast", freq: "session" }, fx: { reveal: "up", speed: "fast", btn: "shine", progress: true, toTop: true },
        bnav: bn(NAV5, { activeStyle: "pill", active: "#16a34a" }), buyNow: true,
        conv: { timer: { on: false }, shipBar: true, trust: true, trustItems: trust4, upsell: true }, games: { on: false } },
      home: [secs.slider(1), secs.perks(2), secs.cats(3, "تسوّق حسب القسم"), secs.best(4, "الأكثر مبيعاً", "grid"), secs.news(5, "وصل حديثاً"), secs.recent(6), secs.groups(7)],
      announcement: "✅ اطلب الآن وادفع عند الاستلام — توصيل لكل المحافظات", checkout: { nameMode: "first", emailOn: false, altPhone: false, postal: false }, waFloat: true },

    { id: "tech", name: "تك", emoji: "💎", tag: "عصري بزجاج وتدرّجات للمنتجات الذكية", sw: ["#0b1020", "#131a33", "#3b82f6", "#06b6d4"],
      feats: ["بطاقات زجاجية وتوهّج وتدرّجات", "ميلان ثلاثي الأبعاد للبطاقات وتوهّج يتبع الماوس", "دخول ضبابي سينمائي", "شريط تنقل عائم زجاجي", "شريط توصيل مجاني وشارات ثقة واقتراحات"],
      design: { colors: { hdrBg: "#0b1020", pageBg: "#0b1020", cardBg: "#131a33", btnBg: "#3b82f6", btn2Bg: "#131a33", heroBg: "#0b1020", ftrBg: "#070a16", annBg: "#3b82f6" }, headingFont: "IBM Plex Sans Arabic", bodyFont: "IBM Plex Sans Arabic", radius: 16, cardStyle: "shadow", btnShape: "rounded", skin: "tech",
        layout: { hdr: "float", hero: "center", card: "minimal", cat: "tile", title: "underline", ftr: "center", cols: "m", dens: "normal", ann: "static", pdp: "side", rows: "start", list: "store", nav: "on", drawer: "accordion", price: "latin" },
        open: { style: "blur", speed: "normal", freq: "session" }, fx: { reveal: "zoom", speed: "normal", page: "zoom", card: "tilt", img: "blur", glow: true, progress: true },
        bnav: bn(NAV5, { radius: 26, width: 92, bottom: 10, activeStyle: "pill", bg: "#131a33", fg: "#e2e8f0", active: "#06b6d4" }), buyNow: true,
        conv: { timer: { on: false }, shipBar: true, trust: true, trustItems: TRUST, upsell: true }, games: { on: false } },
      home: [secs.slider(1), secs.cats(2, "الأقسام"), secs.news(3, "جديدنا", "row"), secs.perks(4), secs.best(5, "الأكثر مبيعاً"), secs.recent(6)],
      announcement: "🚀 شحن لكل المحافظات — الدفع عند الاستلام", checkout: { nameMode: "first_last", emailOn: false }, waFloat: false },

    { id: "pop", name: "بوب", emoji: "🎈", tag: "مرح وملوّن للعائلة والأطفال والهدايا", sw: ["#ff4d6d", "#4361ee", "#fff8e7", "#ffb703"],
      feats: ["بطاقات ملوّنة بحدود سميكة وزوايا دائرية كبيرة", "أزرار «ضغط» مرحة وموجة عند اللمس", "قسم ألعاب (ذاكرة، صيد، عجلة حظ) يشجّع الزائر يرجع", "دخول مكبّر وشريط تنقل كبسولة", "شريط توصيل مجاني واقتراحات بالسلة"],
      design: { colors: { hdrBg: "#ffffff", pageBg: "#fff8e7", cardBg: "#ffffff", btnBg: "#ff4d6d", btn2Bg: "#4361ee", heroBg: "#4361ee", ftrBg: "#3a0ca3", annBg: "#ffb703" }, headingFont: "Baloo Bhaijaan 2", bodyFont: "Cairo", radius: 22, cardStyle: "border", btnShape: "pill", skin: "pop",
        layout: { hdr: "app", hero: "split", card: "center", cat: "circle", title: "center", ftr: "center", cols: "m", dens: "airy", ann: "marquee", pdp: "stack", rows: "center", list: "store", nav: "on", drawer: "accordion", price: "latin" },
        open: { style: "zoom", speed: "normal", freq: "session" }, fx: { reveal: "zoom", speed: "normal", card: "lift", btn: "ripple", toTop: true },
        bnav: bn([{ label: "الرئيسية", icon: "home", link: "#/" }, { label: "المتجر", icon: "gift", link: "#/all" }, { label: "ألعاب", icon: "game", link: "games" }, { label: "السلّة", icon: "cart", link: "#/cart" }, { label: "القائمة", icon: "menu", link: "menu" }], { radius: 28, width: 94, bottom: 8, activeStyle: "pill", bg: "#ffffff", fg: "#3a0ca3", active: "#ff4d6d" }), buyNow: true,
        conv: { timer: { on: false }, shipBar: true, trust: true, trustItems: TRUST, upsell: true }, games: { on: true, title: "ألعاب وجوائز", memory: true, tap: true, wheel: true } },
      home: [secs.slider(1), secs.cats(2, "اختار قسمك 🎈"), secs.news(3, "جديدنا 🎁", "row"), secs.perks(4), secs.best(5, "الأكثر حباً ❤️"), secs.recent(6)],
      announcement: "🎁 جرّب العجلة بقسم الألعاب واربح خصم!", checkout: { nameMode: "first", emailOn: false }, waFloat: true }
  ];
})();
