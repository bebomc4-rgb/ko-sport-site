// رفيق المسنجر — النافذة الصغيرة
(async () => {
  const $ = (s) => document.querySelector(s);
  let cfg = await rafiqLoad();
  const paint = () => {
    $("#on").checked = cfg.on; $("#mode").value = cfg.mode;
    const s = $("#state");
    s.textContent = !cfg.on ? "مطفي" : cfg.mode === "send" ? "بيرد لحالو" : "بيكتب بس";
    s.className = "pill" + (cfg.on ? (cfg.mode === "send" ? " on" : " draft") : "");
  };
  paint();
  const save = async () => { await rafiqSave(cfg); paint(); };
  $("#on").onchange = (e) => { cfg.on = e.target.checked; save(); };
  $("#mode").onchange = (e) => { cfg.mode = e.target.value; save(); };
  $("#opts").onclick = () => chrome.runtime.openOptionsPage();

  const URLS = ["https://www.facebook.com/messages/*", "https://web.facebook.com/messages/*", "https://www.messenger.com/*"];
  const tabs = await chrome.tabs.query({ url: URLS });
  const noKey = !(cfg.gemini.on && cfg.gemini.keys.trim()) && !(cfg.cloudflare.on && cfg.cloudflare.token) && !cfg.local.on;
  $("#tab").textContent = (tabs.length ? "✓ صفحة المسنجر مفتوحة. خليها مفتوحة (حتى لو بالخلفية) لحتى يشتغل البوت." : "افتح facebook.com/messages وخليها مفتوحة لحتى يشتغل البوت.") + (noKey ? " ⚠️ لسا ما حطيت مفتاح ذكاء اصطناعي بالإعدادات." : "");

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
