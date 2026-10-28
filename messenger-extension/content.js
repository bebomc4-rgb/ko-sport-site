// رفيق المسنجر — جوّا صفحة المسنجر: بيشوف الرسائل الجديدة، بيطلب الرد، وبيكتبو (أو بيبعتو)
(() => {
  "use strict";
  if (window.__rafiq) return; window.__rafiq = true;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rand = (a, b) => a + Math.random() * Math.max(0, b - a);
  const visible = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  let busy = false, lastInput = 0;
  // إنت عم تستعمل الصفحة؟ (كبسات وضغطات حقيقية بس)
  for (const ev of ["keydown", "mousedown", "touchstart", "wheel"]) addEventListener(ev, (e) => { if (e.isTrusted) lastInput = Date.now(); }, true);

  const threadIdOf = (href) => { const m = /\/t\/([^/?#]+)/.exec(new URL(href, location.href).pathname); return m ? m[1] : ""; };
  const currentId = () => threadIdOf(location.href);

  // ---------- قراءة الصفحة ----------
  function composer() {
    const list = [...document.querySelectorAll('div[role="textbox"][contenteditable="true"]')].filter(visible);
    return list.find((b) => b.closest('[role="main"]')) || list[list.length - 1] || null;
  }
  // عمود المحادثة المفتوحة: أقرب أب لصندوق الكتابة فيه رسائل
  function pane() {
    const box = composer();
    if (!box) return null;
    for (let el = box.parentElement; el && el !== document.body; el = el.parentElement) {
      if (el.querySelector('[role="row"] div[dir="auto"]') && !el.querySelector('[role="navigation"] a[href*="/t/"]')) return el;
    }
    return document.querySelector('[role="main"]');
  }
  function bubbleOf(el, stop) {
    for (let x = el; x && x !== stop; x = x.parentElement) {
      const bg = getComputedStyle(x).backgroundColor, bi = getComputedStyle(x).backgroundImage;
      if ((bg && !/rgba?\(0, 0, 0, 0\)|transparent/.test(bg)) || (bi && bi !== "none")) return x;
    }
    return el;
  }
  const ME_LABEL = /(^|\n)\s*(You sent|You replied|أنت أرسلت|أرسلت|لقد أرسلت|رددت)/;
  function readThread() {
    const p = pane();
    if (!p) return null;
    const pr = p.getBoundingClientRect(), mid = pr.left + pr.width / 2;
    const rtl = getComputedStyle(p).direction === "rtl";
    let rows = [...p.querySelectorAll('[role="row"]')];
    if (!rows.length) rows = [...p.querySelectorAll('div[dir="auto"]')].map((d) => d.parentElement);
    const msgs = [];
    for (const row of rows) {
      if (row.closest('[contenteditable="true"]')) continue;
      const texts = [...row.querySelectorAll('div[dir="auto"]')].filter((d) => !d.closest('[contenteditable="true"]') && !d.querySelector('div[dir="auto"]') && d.innerText.trim());
      if (!texts.length) continue;
      const text = texts.map((d) => d.innerText.trim()).join("\n").slice(0, 1500);
      const b = bubbleOf(texts[0], row), r = b.getBoundingClientRect(), c = r.left + r.width / 2;
      if (Math.abs(c - mid) < pr.width * 0.06 && r.width < pr.width * 0.5 && !ME_LABEL.test(row.innerText)) continue; // سطر بالنص (وقت/تاريخ)
      const from = ME_LABEL.test(row.innerText) ? "me" : (rtl ? c < mid : c > mid) ? "me" : "them";
      const img = row.querySelector("img[alt]");
      msgs.push({ from, text, who: img ? img.alt : "" });
    }
    const head = p.querySelector('h1, h2, [role="heading"]');
    const name = ((head && head.innerText) || document.title.replace(/^\(\d+\)\s*/, "").split("|")[0]).trim().split("\n")[0].slice(0, 60);
    const whos = new Set(msgs.filter((m) => m.from === "them" && m.who).map((m) => m.who));
    const last = msgs[msgs.length - 1];
    const box = composer();
    return { id: currentId(), name, msgs, group: whos.size > 1, lastFromThem: !!last && last.from === "them", draft: !!(box && box.innerText.trim()), box };
  }
  // محادثات فيها رسائل مو مقروءة (بالقائمة الجانبية)
  function unreadRows() {
    const seen = new Set(), out = [];
    for (const a of document.querySelectorAll('a[href*="/t/"]')) {
      const id = threadIdOf(a.href);
      if (!id || seen.has(id) || !visible(a) || a.closest('[role="main"] [role="row"]')) continue;
      seen.add(id);
      const spans = [...a.querySelectorAll("span")].filter((s) => !s.children.length && s.innerText.trim().length > 1);
      const bold = spans.filter((s) => +getComputedStyle(s).fontWeight >= 600).length;
      const label = !!a.querySelector('[aria-label*="nread"], [aria-label*="غير مقروء"]');
      const dot = [...a.querySelectorAll("div, span")].some((e) => {
        const r = e.getBoundingClientRect(); if (r.width < 6 || r.width > 16 || Math.abs(r.width - r.height) > 1.5) return false;
        const m = (getComputedStyle(e).backgroundColor.match(/\d+/g) || []).map(Number);
        return m.length >= 3 && m[2] > 200 && m[0] < 80 && m[1] < 160;
      });
      out.push({ el: a, id, name: (a.innerText || "").trim().split("\n")[0].slice(0, 60), bold, label, dot, unread: label || dot || bold >= 2 });
    }
    return out;
  }

  // ---------- الكتابة والإرسال ----------
  async function typeInto(box, text) {
    box.focus(); await sleep(200);
    let ok = false;
    try { ok = document.execCommand("insertText", false, text); } catch {}
    await sleep(300);
    if (!ok || !box.innerText.trim()) {
      const dt = new DataTransfer(); dt.setData("text/plain", text);
      box.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
      await sleep(400);
    }
    return !!box.innerText.trim();
  }
  async function pressSend(box) {
    const o = { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true };
    box.dispatchEvent(new KeyboardEvent("keydown", o)); box.dispatchEvent(new KeyboardEvent("keyup", o));
    await sleep(1500);
    if (!box.innerText.trim()) return true;
    const btn = [...document.querySelectorAll("[aria-label]")].find((b) => visible(b) && /press enter to send|^send$|^إرسال$|اضغط على Enter|للإرسال/i.test(b.getAttribute("aria-label") || ""));
    if (btn) { btn.click(); await sleep(1500); }
    return !box.innerText.trim();
  }

  // ---------- الذاكرة: شو رد على مين ----------
  async function mem() { const s = await chrome.storage.local.get("mem"); return s.mem || { threads: {}, times: [], log: [] }; }
  async function saveMem(m) { m.log = (m.log || []).slice(-60); m.times = (m.times || []).filter((t) => Date.now() - t < 3600e3); await chrome.storage.local.set({ mem: m }); }
  function log(m, e) { m.log = m.log || []; m.log.push({ at: Date.now(), ...e }); }
  const sigOf = (t) => { const them = t.msgs.filter((x) => x.from === "them"); const l = them[them.length - 1]; return l ? them.length + "|" + l.text.slice(0, 200) : ""; };
  const ask = (msg) => new Promise((res) => { try { chrome.runtime.sendMessage(msg, (r) => res(r || { ok: false, error: chrome.runtime.lastError ? chrome.runtime.lastError.message : "ما في رد" })); } catch (e) { res({ ok: false, error: String(e.message) }); } });
  const notify = (title, text, sticky) => { try { chrome.runtime.sendMessage({ type: "notify", title, text, sticky }); } catch {} };

  function inHours(cfg) {
    if (!cfg.hoursOn) return true;
    const h = new Date().getHours(), a = +cfg.hourFrom, b = +cfg.hourTo;
    return a <= b ? h >= a && h < b : h >= a || h < b;
  }

  // ---------- الرد على المحادثة المفتوحة ----------
  async function handle(cfg, t) {
    if (!t || !t.id || !t.lastFromThem) return false;
    const m = await mem(), th = m.threads[t.id] || {};
    const sig = sigOf(t);
    if (!sig || th.sig === sig || (th.retryAt || 0) > Date.now()) return false;
    const done = async (status, extra = {}) => { th.sig = sig; m.threads[t.id] = { ...th, ...extra }; log(m, { name: t.name, text: t.msgs[t.msgs.length - 1].text.slice(0, 120), status, ...(extra.logReply ? { reply: extra.logReply } : {}) }); delete m.threads[t.id].logReply; await saveMem(m); return true; };
    if (t.group && !cfg.groups) return done("تجاهل: مجموعة");
    const rule = rafiqPerson(cfg, t.name);
    if (rafiqIgnore(rule)) return done("تجاهل: مكتوب بالإعدادات");
    if (cfg.scope === "only" && rule == null) return done("تجاهل: مو بقائمة الناس");
    if ((th.pausedUntil || 0) > Date.now()) return done("موقّف بهالمحادثة");
    const hour = (th.times || []).filter((x) => Date.now() - x < 3600e3);
    if (hour.length >= +cfg.perChatHour) return done("وصل حد الردود لهالشخص بالساعة");
    if ((m.times || []).filter((x) => Date.now() - x < 3600e3).length >= +cfg.perHour) return false; // الحد العام: منرجع بعدين
    if (t.draft) return false; // في شي مكتوب بالصندوق (يمكن إنت): ما منلمسو

    const r = await ask({ type: "reply", name: t.name, messages: t.msgs.slice(-14).map(({ from, text }) => ({ from, text })) });
    if (!r.ok) { m.threads[t.id] = { ...th, retryAt: Date.now() + 90e3 }; log(m, { name: t.name, status: "خطأ: " + r.error }); await saveMem(m); return true; }

    // استنى شوي متل البني آدم، وتأكد إنو ما تغيّر شي (رسالة جديدة أو انتقلت لمحادثة تانية)
    await sleep(rand(+cfg.delayMin, +cfg.delayMax) * 1000);
    const now = readThread();
    if (!now || now.id !== t.id || sigOf(now) !== sig || now.draft) return false;

    let text = String(r.reply || "").replace(/\s*\n+\s*/g, " ").trim();
    const first = !th.noteAt || Date.now() - th.noteAt > 12 * 3600e3;
    if (cfg.noteOn && first && cfg.note) text = cfg.note.trim() + " " + text;
    if (!(await typeInto(now.box, text))) return done("ما قدرت اكتب بصندوق الرسالة");
    let status = "انكتب الرد (بانتظارك تبعتو)";
    const stamp = { noteAt: cfg.noteOn && first ? Date.now() : th.noteAt };
    if (cfg.mode === "send") {
      const sent = await pressSend(now.box);
      status = sent ? "انبعت ✓" : "انكتب بس ما انبعت";
      if (sent) { stamp.times = [...hour, Date.now()]; m.times = [...(m.times || []), Date.now()]; }
    } else notify("رد جاهز لـ " + t.name, "راجعو واضغط إرسال: " + text.slice(0, 90));
    if (r.crisis) {
      stamp.pausedUntil = Date.now() + 24 * 3600e3;
      notify("⚠️ " + t.name + " محتاجك هلق", "كتب كلام بيدل إنو مو منيح. البوت وقف بهالمحادثة، احكيه إنت.", true);
      status += " — ⚠️ رسالة مهمة، وقف البوت بهالمحادثة";
    }
    return done(status + " · " + r.via, { ...stamp, logReply: text.slice(0, 160) });
  }

  async function tick() {
    if (busy) return;
    const cfg = await rafiqLoad();
    if (!cfg.on || !inHours(cfg)) return;
    if (cfg.onlyAway && document.hasFocus() && Date.now() - lastInput < 120e3) return; // إنت عم تستعمل المسنجر
    busy = true;
    try {
      const t = readThread();
      if (await handle(cfg, t)) return;
      if (cfg.mode !== "send") return; // بوضع «بيكتب بس» ما منتنقل بين المحادثات
      const u = unreadRows().filter((x) => x.unread && x.id !== currentId());
      if (!u.length) return;
      u[0].el.click();
      await sleep(3500);
      await handle(cfg, readThread());
    } catch (e) { /* منكمّل بالدورة الجاية */ } finally { busy = false; }
  }
  setInterval(tick, 6000);

  // ---------- فحص الصفحة (من نافذة الإضافة) ----------
  chrome.runtime.onMessage.addListener((msg, sender, reply) => {
    if (!msg || msg.type !== "diag") return;
    const t = readThread(), u = unreadRows();
    reply({
      url: location.pathname.replace(/\/t\/[^/]+/, "/t/…"),
      composer: !!composer(), pane: !!pane(), thread: t ? { name: t.name, group: t.group, draft: t.draft, count: t.msgs.length, lastFromThem: t.lastFromThem,
        last: t.msgs.slice(-4).map((x) => (x.from === "me" ? "أنا: " : "هو: ") + x.text.slice(0, 25)) } : null,
      chats: u.length, unread: u.filter((x) => x.unread).map((x) => x.name.slice(0, 20) + (x.label ? " [label]" : "") + (x.dot ? " [dot]" : "") + ` [b${x.bold}]`).slice(0, 8),
      sample: u.slice(0, 4).map((x) => x.name.slice(0, 15) + ` b${x.bold}${x.dot ? " dot" : ""}`),
    });
  });
})();
