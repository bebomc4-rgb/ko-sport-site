// رفيق المسنجر — النافذة الصغيرة
(async () => {
  const $ = (s) => document.querySelector(s);
  const send = (msg) => chrome.runtime.sendMessage(msg);
  let cfg = await send({ type: "config", fresh: true });
  const paint = () => {
    const err = !cfg || cfg.error, s = $("#state");
    $("#conn").textContent = err ? "⚠️ " + ((cfg && cfg.error) || "المجيب مو شغّال") + ". شغّل المنصة (RESTART-ALL.vbs)." : "✓ متصل بالمجيب الآلي";
    $("#on").disabled = $("#mode").disabled = !!err;
    if (!err) { $("#on").checked = cfg.on; $("#mode").value = cfg.mode; }
    s.textContent = err ? "مو متصل" : !cfg.on ? "مطفي" : cfg.mode === "send" ? "بيرد لحالو" : "بيكتب بس";
    s.className = "pill" + (!err && cfg.on ? (cfg.mode === "send" ? " on" : " draft") : "");
  };
  paint();
  const toggle = async (change) => { const r = await send({ type: "toggle", change }); if (r && r.ok !== false) cfg = r; paint(); };
  $("#on").onchange = (e) => toggle({ on: e.target.checked });
  $("#mode").onchange = (e) => toggle({ mode: e.target.value });
  $("#opts").onclick = async () => chrome.tabs.create({ url: (await rafiqServer()) + "/#/messenger" });
  $("#server").value = await rafiqServer();
  $("#server").onchange = async (e) => { await chrome.storage.local.set({ server: e.target.value.trim() }); cfg = await send({ type: "config", fresh: true }); paint(); };

  const URLS = ["https://www.facebook.com/messages/*", "https://web.facebook.com/messages/*", "https://www.messenger.com/*"];
  const tabs = await chrome.tabs.query({ url: URLS });
  $("#tab").textContent = tabs.length ? "✓ صفحة المسنجر مفتوحة. خليها مفتوحة (حتى لو بالخلفية)." : "افتح facebook.com/messages وخليها مفتوحة لحتى يشتغل البوت.";

  $("#diag").onclick = async () => {
    const out = $("#diagOut"); out.style.display = ""; out.textContent = "عم افحص…";
    if (!tabs.length) { out.textContent = "ما في صفحة مسنجر مفتوحة."; return; }
    try {
      const r = await chrome.tabs.sendMessage(tabs[0].id, { type: "diag" });
      const t = r.thread;
      out.textContent = [
        "صندوق الكتابة: " + (r.composer ? "✓ لقيتو" : "✗ ما لقيتو"),
        t ? `المحادثة المفتوحة: ${t.name} · ${t.count} رسالة · ${t.group ? "مجموعة" : "خاص"} · آخر رسالة ${t.lastFromThem ? "منو" : "مني"}` : "ما في محادثة مفتوحة",
        ...(t ? t.last.map((x) => "   " + x) : []),
        `المحادثات بالقائمة: ${r.chats} · مو مقروءة: ${r.unread.length}`,
        ...r.unread.map((x) => "   " + x),
        "عينة: " + r.sample.join(" / "),
      ].join("\n");
    } catch (e) { out.textContent = "ما قدرت احكي مع الصفحة. حدّثها (F5) وجرّب كمان مرة."; }
  };

  const drawLog = async () => {
    const { mem } = await chrome.storage.local.get("mem");
    const list = ((mem && mem.log) || []).slice(-20).reverse();
    const box = $("#log"); box.innerHTML = "";
    if (!list.length) { box.innerHTML = '<small class="hint">لسا ما صار شي</small>'; return; }
    for (const e of list) {
      const d = document.createElement("div");
      const b = document.createElement("b"); b.textContent = `${e.name || "؟"} · ${new Date(e.at).toLocaleTimeString("ar-SY", { hour: "numeric", minute: "2-digit" })}`;
      const s = document.createElement("small"); s.textContent = e.status;
      d.append(b, s);
      if (e.text) { const x = document.createElement("div"); x.style.padding = "2px 0"; x.textContent = "هو: " + e.text; d.append(x); }
      if (e.reply) { const x = document.createElement("div"); x.style.padding = "2px 0"; x.textContent = "البوت: " + e.reply; d.append(x); }
      box.append(d);
    }
  };
  drawLog();
  $("#clear").onclick = async () => { const { mem } = await chrome.storage.local.get("mem"); await chrome.storage.local.set({ mem: { ...(mem || {}), log: [] } }); drawLog(); };
})();
