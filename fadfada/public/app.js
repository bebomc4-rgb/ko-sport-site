// فضفضة — الواجهة (صفحة وحدة بروابط #/...)
(() => {
  "use strict";
  const SITE = "فضفضة";
  const app = document.getElementById("app");
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} },
  };
  let me = LS.get("ff_me", null);
  let timer = null, badgeTimer = null, rooms = null, friendsCache = null;

  // ---------- أدوات صغيرة ----------
  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") e.className = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else if (k === "html") e.innerHTML = v; // نصوص ثابتة من عنا بس، أبداً مو من المستخدمين
      else e.setAttribute(k, v === true ? "" : v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : String(k));
    return e;
  }
  const toast = (t) => { document.querySelectorAll(".toast").forEach((x) => x.remove()); const e = h("div", { class: "toast" }, t); document.body.append(e); setTimeout(() => e.remove(), 3200); };
  const COLORS = ["#2f6f6a", "#e08a5b", "#6c5ce7", "#d35d6e", "#3b82a0", "#8a6d3b", "#5b8c3a", "#a05195"];
  const color = (id) => COLORS[parseInt(String(id).slice(-2), 16) % COLORS.length];
  const avatar = (u, online) => h("div", { class: "avatar" + (online ? " on" : ""), style: `background:${color(u.id)}` }, (u.name || "?").trim().charAt(0));
  const tg = (t) => h("bdi", { dir: "ltr" }, "#" + t); // «#ab12» بيضل مرتب جوّا النص العربي
  const time = (t) => new Date(t).toLocaleTimeString("ar-SY", { hour: "numeric", minute: "2-digit" });
  const dayOf = (t) => new Date(t).toLocaleDateString("ar-SY", { weekday: "long", day: "numeric", month: "long" });
  function sheet(title, opts) {
    const bg = h("div", { class: "sheet-bg", onclick: (e) => { if (e.target === bg) bg.remove(); } },
      h("div", { class: "sheet" }, title ? h("h3", {}, title) : null,
        ...opts.map((o) => h("button", { class: "opt" + (o.red ? " red" : ""), onclick: () => { bg.remove(); o.go(); } }, o.label)),
        h("button", { class: "opt", onclick: () => bg.remove() }, "إلغاء")));
    document.body.append(bg);
  }
  const stop = () => { if (timer) clearTimeout(timer); timer = null; };

  async function api(path, body, method) {
    const r = await fetch("/api/" + path, {
      method: method || (body ? "POST" : "GET"),
      headers: { "content-type": "application/json", ...(me ? { authorization: "Bearer " + me.key } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401 && path !== "join") { LS.del("ff_me"); me = null; route(); throw new Error(j.error || "لازم تفوت من جديد"); }
    if (r.status === 403 && j.banned) { banned(); throw new Error(j.error); }
    if (!r.ok) throw new Error(j.error || "صار خطأ، جرّب كمان مرة");
    return j;
  }

  // ---------- الدخول ----------
  function gate() {
    stop();
    const err = h("div", { class: "err" });
    const name = h("input", { class: "in", maxlength: "20", placeholder: "مثلاً: سامر، نور، أبو علي…", autocomplete: "nickname" });
    const adult = h("input", { type: "checkbox" });
    const go = h("button", { class: "btn" }, "يلا فوت");
    const submit = async () => {
      err.textContent = "";
      if (!adult.checked) { err.textContent = "لازم تأكد إنك فوق 18 سنة وموافق على القوانين"; return; }
      go.disabled = true;
      try { me = await api("join", { name: name.value, adult: true }); LS.set("ff_me", me); location.hash = "#/ai"; route(); }
      catch (e) { err.textContent = e.message; go.disabled = false; }
    };
    go.onclick = submit; name.onkeydown = (e) => { if (e.key === "Enter") submit(); };
    app.replaceChildren(h("div", { class: "gate" },
      h("div", { class: "hero" }, h("div", { class: "big" }, "🫂"), h("h1", {}, SITE), h("p", {}, "احكي يلي بقلبك. في حدا بيسمعك.")),
      h("div", { class: "card" }, h("ul", { class: "rules" },
        h("li", {}, "«رفيق» بوت ذكاء اصطناعي بيسمعك بالشامي. حكيك معو بيضل على جهازك بس."),
        h("li", {}, "بالغرف بتتعرف على ناس وبتضيفهم أصدقاء وبتراسلهم خاص."),
        h("li", {}, "احترم غيرك: لا مسبات، لا تحرش، لا أرقام أو روابط بالغرف العامة."),
        h("li", {}, "فيك تحظر أي حدا أو تبلّغ عنه، والإدارة بتوقف المخالفين."),
        h("li", {}, "رفيق مو دكتور. إذا إنت بخطر اتصل بالإسعاف 110."))),
      h("div", { class: "field" }, h("label", {}, "شو بدك نناديك؟"), name),
      h("label", { class: "check" }, adult, h("span", {}, "عمري فوق 18 سنة وموافق على القوانين")),
      err, go));
    setTimeout(() => name.focus(), 50);
  }

  function banned() {
    stop(); clearTimeout(badgeTimer);
    app.classList.remove("has-nav");
    app.replaceChildren(h("div", { class: "gate" }, h("div", { class: "hero" }, h("div", { class: "big" }, "⛔"), h("h1", {}, "حسابك موقوف"),
      h("p", {}, "انوقف حسابك بسبب مخالفة قوانين الموقع. إذا بتشوف إنو صار غلط، تواصل مع الإدارة."))));
  }

  // ---------- الهيكل: عنوان فوق + قائمة تحت ----------
  function shell(tab, top, body, opts = {}) {
    const nav = h("nav", { class: "nav" }, h("div", { class: "in-nav" },
      ...[["ai", "💬", "رفيق"], ["rooms", "👥", "الغرف"], ["friends", "🤝", "الأصدقاء"], ["me", "🙂", "أنا"]].map(([k, i, t]) =>
        h("a", { href: "#/" + k, class: tab === k ? "on" : "", "data-tab": k }, h("b", {}, i), t))));
    app.replaceChildren(top, body, opts.noNav ? "" : nav);
    app.classList.toggle("has-nav", !opts.noNav);
    badge();
  }
  const topBar = (title, sub, left, back) => h("header", { class: "top" },
    back ? h("button", { class: "icon", onclick: () => history.length > 1 ? history.back() : (location.hash = back), "aria-label": "رجوع" }, "→") : null,
    h("h2", {}, title, sub ? h("span", { class: "sub" }, sub) : null), left || null);

  // عدد طلبات الصداقة والرسائل الجديدة على زر «الأصدقاء»
  async function badge() {
    clearTimeout(badgeTimer);
    if (!me) return;
    try {
      friendsCache = await api("friends");
      const n = friendsCache.incoming.length + friendsCache.friends.filter((f) => f.lastMsg > (LS.get("ff_seen_" + f.id, 0) || 0)).length;
      const a = document.querySelector('[data-tab="friends"]');
      if (a) { a.querySelector(".dot")?.remove(); if (n) a.append(h("span", { class: "dot" }, n > 9 ? "9+" : n)); }
    } catch {}
    badgeTimer = setTimeout(badge, document.hidden ? 60000 : 20000);
  }

  // ---------- محادثة عامة/خاصة (نفس الشكل) ----------
  function chatView({ list, compose, intro }) {
    const box = h("div", { class: "msgs" }, intro || null);
    const ta = h("textarea", { rows: "1", placeholder: compose.placeholder || "اكتب رسالتك…", maxlength: "500" });
    const send = h("button", { class: "send", "aria-label": "إرسال" }, "➤");
    const grow = () => { ta.style.height = "auto"; ta.style.height = Math.min(140, ta.scrollHeight) + "px"; };
    ta.oninput = grow;
    ta.onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey && !matchMedia("(pointer:coarse)").matches) { e.preventDefault(); go(); } };
    const go = async () => {
      const t = ta.value.trim(); if (!t || send.disabled) return;
      send.disabled = true;
      try { await compose.send(t); ta.value = ""; grow(); }
      catch (e) { toast(e.message); }
      send.disabled = false; ta.focus();
    };
    send.onclick = go;
    const atBottom = () => box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    const down = () => { box.scrollTop = box.scrollHeight; window.scrollTo(0, document.body.scrollHeight); };
    return { el: h("div", { class: "chat" }, list || null, box, h("div", { class: "compose" }, ta, send)), box, ta, atBottom, down };
  }
  function bubble(m, onWho, noWho) {
    return h("div", { class: "msg" + (m.me ? " me" : "") + (m.pending ? " pending" : "") + (m.bot ? " bot" : ""), "data-id": m.id || "" },
      !m.me && onWho && !noWho ? h("button", { class: "who", onclick: () => onWho(m) }, m.name, " ", tg(m.tag)) : null,
      h("div", { class: "bub", onclick: !m.me && onWho ? () => onWho(m) : null }, m.text),
      m.at ? h("div", { class: "time" }, time(m.at)) : null);
  }

  async function conversation(c, title, sub, menu, onWho) {
    stop();
    let last = 0, lastDay = "", alive = true;
    const left = menu ? h("button", { class: "icon", onclick: menu, "aria-label": "خيارات" }, "⋯") : null;
    const v = chatView({ compose: { send: async (t) => { await api("msgs", { c, text: t }); await pull(true); } } });
    shell(c.startsWith("dm:") ? "friends" : "rooms", topBar(title, sub, left, c.startsWith("dm:") ? "#/friends" : "#/rooms"), v.el, { noNav: true });
    const put = (list) => {
      const stick = v.atBottom() || !last;
      for (const m of list) {
        if (v.box.querySelector(`[data-id="${m.id}"]`)) continue;
        const d = dayOf(m.at); if (d !== lastDay) { lastDay = d; v.box.append(h("div", { class: "day" }, d)); }
        v.box.append(bubble(m, onWho, c.startsWith("dm:"))); last = Math.max(last, m.id);
      }
      if (c.startsWith("dm:") && last) LS.set("ff_seen_" + c.slice(3), last);
      if (stick) v.down();
    };
    const pull = async (once) => {
      try { const j = await api(`msgs?c=${encodeURIComponent(c)}&after=${last}`); if (!alive) return; put(j.msgs); if (!last && !j.msgs.length) { if (!v.box.querySelector(".empty")) v.box.append(h("div", { class: "empty" }, "ما في رسائل لسا. ابدأ إنت 👋")); } else v.box.querySelector(".empty")?.remove(); }
      catch (e) { if (!once) toast(e.message); }
    };
    await pull();
    const loop = () => { timer = setTimeout(async () => { if (!alive) return; if (!document.hidden) await pull(true); loop(); }, document.hidden ? 15000 : 3000); };
    loop();
    window.addEventListener("hashchange", () => { alive = false; }, { once: true });
  }

  // ---------- رفيق: البوت يلي بيسمع (الحكي بيضل على جهازك) ----------
  const SAFETY = () => h("div", { class: "safety" },
    h("b", {}, "إنت مهم، وما لازم تضل لحالك بهالشي 💛"),
    "احكي هلق مع حدا بتوثق فيه، ولو حاسس إنك ممكن تأذي حالك أو إنك بخطر اتصل:",
    h("div", { class: "nums" }, h("a", { href: "tel:110" }, "🚑 الإسعاف 110"), h("a", { href: "tel:112" }, "👮 الشرطة 112")));
  function aiView() {
    stop();
    let hist = LS.get("ff_ai", []);
    const clear = () => sheet("بدك تمسح كل الحكي مع رفيق؟", [{ label: "إي، امسح", red: true, go: () => { LS.del("ff_ai"); LS.del("ff_ai_crisis"); aiView(); } }]);
    const intro = bubble({ bot: true, text: `أهلين ${me.name} 🤍 أنا رفيق، بوت ذكاء اصطناعي بيسمعك. احكيلي شو بقلبك، ع راحتك. حكينا بيضل على جهازك بس.` });
    let safety = LS.get("ff_ai_crisis", false) ? SAFETY() : null;
    const v = chatView({
      intro, compose: {
        placeholder: "احكي يلي بقلبك…", send: async (t) => {
          hist.push({ role: "user", text: t }); LS.set("ff_ai", hist.slice(-80));
          v.box.append(bubble({ me: true, text: t, at: Date.now() })); v.down();
          const typing = h("div", { class: "msg bot typing" }, h("div", { class: "bub" }, h("i"), h("i"), h("i")));
          v.box.append(typing); v.down();
          try {
            const j = await api("ai", { messages: hist.slice(-16) });
            hist.push({ role: "bot", text: j.reply }); LS.set("ff_ai", hist.slice(-80));
            typing.replaceWith(bubble({ bot: true, text: j.reply, at: Date.now() }));
            if (j.crisis && !safety) { safety = SAFETY(); v.el.prepend(safety); LS.set("ff_ai_crisis", true); }
          } catch (e) { typing.remove(); hist.pop(); LS.set("ff_ai", hist); throw e; }
          v.down();
        },
      },
    });
    for (const m of hist) v.box.append(bubble(m.role === "user" ? { me: true, text: m.text } : { bot: true, text: m.text }));
    if (safety) v.el.prepend(safety);
    v.box.prepend(h("div", { class: "hint" }, "رفيق بوت ذكاء اصطناعي، مو دكتور. للطوارئ: الإسعاف 110"));
    shell("ai", topBar("رفيق 🤍", "بيسمعك، والحكي بيضل عندك", h("button", { class: "icon", onclick: clear, "aria-label": "مسح المحادثة" }, "🗑")), v.el);
    setTimeout(v.down, 30);
  }

  // ---------- الغرف ----------
  async function roomsView() {
    stop();
    const page = h("div", { class: "page" }, h("div", { class: "empty" }, "جاري التحميل…"));
    shell("rooms", topBar("الغرف", "احكي وتعرّف على ناس جداد"), page);
    try { rooms = rooms || (await api("rooms")); } catch (e) { page.replaceChildren(h("div", { class: "empty" }, e.message)); return; }
    page.replaceChildren(h("div", { class: "list" }, ...rooms.map((r) =>
      h("a", { class: "row", href: "#/room/" + r.id }, h("div", { class: "em" }, r.icon), h("div", { class: "tx" }, h("b", {}, r.name), h("small", {}, r.about)), h("span", {}, "←")))),
      h("p", { class: "hint" }, "ممنوع أرقام الهواتف والروابط بالغرف العامة. ضيف الشخص صديق وراسلو خاص."));
  }
  // ضغطة على اسم حدا أو رسالتو
  function personMenu(m) {
    const f = friendsCache, isFriend = f && f.friends.some((x) => x.id === m.uid), sent = f && f.outgoing.some((x) => x.id === m.uid);
    sheet(h("span", {}, m.name, " ", tg(m.tag)), [
      isFriend ? { label: "💬 راسلو خاص", go: () => { location.hash = "#/dm/" + m.uid; } }
        : { label: sent ? "⏳ بعتتلو طلب صداقة" : "🤝 إضافة صديق", go: async () => { if (sent) return; try { const j = await api("friends", { to: m.uid, act: "add" }); toast(j.status === "ok" ? "صرتو أصدقاء 🎉" : "بعتنا طلب الصداقة"); badge(); } catch (e) { toast(e.message); } } },
      { label: "🚩 تبليغ عن هالرسالة", go: () => reportIt({ msg: m.id }) },
      { label: "⛔ حظر", red: true, go: () => blockIt(m.uid, m.name) },
    ]);
  }
  function reportIt(what) {
    sheet("ليش بدك تبلّغ؟", ["مسبات أو إهانة", "تحرش أو كلام جنسي", "إزعاج أو سبام", "حدا عمرو أقل من 18", "شي تاني"].map((reason) => ({
      label: reason, go: async () => { try { await api("report", { ...what, reason }); toast("وصل التبليغ، شكراً إلك 🙏"); } catch (e) { toast(e.message); } },
    })));
  }
  function blockIt(id, name) {
    sheet(`حظر ${name}؟ ما عاد رح تشوف رسايلو ولا يقدر يراسلك.`, [{ label: "إي، احظرو", red: true, go: async () => {
      try { await api("block", { other: id, on: true }); toast("انحظر"); if (location.hash.startsWith("#/dm/")) location.hash = "#/friends"; else route(); } catch (e) { toast(e.message); }
    } }]);
  }

  // ---------- الأصدقاء ----------
  async function friendsView() {
    stop();
    const page = h("div", { class: "page" }, h("div", { class: "empty" }, "جاري التحميل…"));
    shell("friends", topBar("الأصدقاء", "طلبات الصداقة والرسائل الخاصة"), page);
    let f;
    try { f = friendsCache = await api("friends"); } catch (e) { page.replaceChildren(h("div", { class: "empty" }, e.message)); return; }
    const act = (id, a, msg) => async () => { try { await api("friends", { to: id, act: a }); if (msg) toast(msg); friendsView(); } catch (e) { toast(e.message); } };
    const kids = [];
    if (f.incoming.length) kids.push(h("div", { class: "sec" }, "طلبات صداقة"), ...f.incoming.map((u) => h("div", { class: "row" }, avatar(u, u.online),
      h("div", { class: "tx" }, h("b", {}, u.name), h("small", {}, tg(u.tag), " بدو يصير صديقك")),
      h("div", { class: "acts" }, h("button", { class: "btn small", onclick: act(u.id, "accept", "صرتو أصدقاء 🎉") }, "قبول"), h("button", { class: "btn small ghost", onclick: act(u.id, "decline") }, "لا")))));
    kids.push(h("div", { class: "sec" }, "أصدقائي"));
    if (!f.friends.length) kids.push(h("div", { class: "empty" }, "لسا ما عندك أصدقاء. فوت على الغرف واضغط على اسم أي حدا لتضيفو 🤝"));
    kids.push(...f.friends.map((u) => h("a", { class: "row", href: "#/dm/" + u.id }, avatar(u, u.online),
      h("div", { class: "tx" }, h("b", {}, u.name), h("small", {}, u.online ? "متصل هلق" : tg(u.tag))),
      u.lastMsg > (LS.get("ff_seen_" + u.id, 0) || 0) ? h("span", { class: "unread", title: "رسائل جديدة" }) : null)));
    if (f.outgoing.length) kids.push(h("div", { class: "sec" }, "طلبات بعتتها"), ...f.outgoing.map((u) => h("div", { class: "row" }, avatar(u, false),
      h("div", { class: "tx" }, h("b", {}, u.name), h("small", {}, "بانتظار الموافقة")), h("button", { class: "btn small ghost", onclick: act(u.id, "remove") }, "إلغاء"))));
    page.replaceChildren(h("div", { class: "list" }, ...kids));
  }
  async function dmView(id) {
    let f = friendsCache;
    try { f = friendsCache = await api("friends"); } catch {}
    const u = f && f.friends.find((x) => x.id === id);
    if (!u) { toast("لازم تكونو أصدقاء لتراسلو"); location.hash = "#/friends"; return; }
    const menu = () => sheet(u.name, [
      { label: "🚩 تبليغ", go: () => reportIt({ user: id }) },
      { label: "💔 إزالة من الأصدقاء", go: async () => { try { await api("friends", { to: id, act: "remove" }); location.hash = "#/friends"; } catch (e) { toast(e.message); } } },
      { label: "⛔ حظر", red: true, go: () => blockIt(id, u.name) },
    ]);
    conversation("dm:" + id, u.name, u.online ? "متصل هلق" : tg(u.tag), menu, (m) => sheet(`${m.name}`, [{ label: "🚩 تبليغ عن هالرسالة", go: () => reportIt({ msg: m.id }) }]));
  }

  // ---------- أنا ----------
  async function meView() {
    stop();
    const name = h("input", { class: "in", maxlength: "20", value: me.name });
    const save = h("button", { class: "btn small", onclick: async () => { try { const j = await api("me", { name: name.value }); me = { ...me, name: j.name }; LS.set("ff_me", me); toast("تغيّر اسمك"); } catch (e) { toast(e.message); } } }, "حفظ");
    const blocked = h("div", { class: "list" }, h("div", { class: "empty" }, "…"));
    const page = h("div", { class: "page" },
      h("div", { class: "row" }, avatar(me, true), h("div", { class: "tx" }, h("b", {}, me.name), h("small", {}, "رقمك ", tg(me.tag)))),
      h("div", { class: "card field" }, h("label", {}, "غيّر اسمك"), h("div", { style: "display:flex;gap:8px" }, name, save)),
      h("div", { class: "sec" }, "الناس يلي حظرتهم"), blocked,
      h("div", { class: "card" }, h("ul", { class: "rules" },
        h("li", {}, "حسابك محفوظ على هالجهاز بس. إذا مسحت بيانات المتصفح أو طلعت، بيروح حسابك وأصدقاؤك."),
        h("li", {}, "الرسائل بالغرف والخاص بتنمحى لحالها بعد 30 يوم."),
        h("li", {}, "حكيك مع رفيق ما بينحفظ عنا، بيضل على جهازك."))),
      h("button", { class: "btn ghost", onclick: () => sheet("أكيد بدك تطلع؟ ما في طريقة ترجع لنفس الحساب.", [{ label: "إي، اطلع", red: true, go: () => { LS.del("ff_me"); LS.del("ff_ai"); me = null; location.hash = ""; route(); } }]) }, "طلوع من الحساب"));
    shell("me", topBar("أنا", SITE), page);
    try {
      const list = await api("block");
      blocked.replaceChildren(...(list.length ? list.map((u) => h("div", { class: "row" }, avatar(u, false), h("div", { class: "tx" }, h("b", {}, u.name), h("small", {}, tg(u.tag))),
        h("button", { class: "btn small ghost", onclick: async () => { await api("block", { other: u.id, on: false }).catch(() => {}); meView(); } }, "فك الحظر"))) : [h("div", { class: "empty" }, "ما حظرت حدا")]));
    } catch { blocked.replaceChildren(); }
  }

  // ---------- التنقل ----------
  async function route() {
    if (!me) return gate();
    const [, a, b] = (location.hash || "#/ai").replace(/^#/, "").split("/");
    if (a === "rooms") return roomsView();
    if (a === "room" && b) {
      try { rooms = rooms || (await api("rooms")); } catch {}
      const r = (rooms || []).find((x) => x.id === b);
      if (!r) { location.hash = "#/rooms"; return; }
      try { friendsCache = await api("friends"); } catch {}
      return conversation(r.id, r.icon + " " + r.name, r.about, null, personMenu);
    }
    if (a === "friends") return friendsView();
    if (a === "dm" && b) return dmView(b);
    if (a === "me") return meView();
    return aiView();
  }
  window.addEventListener("hashchange", route);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) badge(); });
  route();
})();
