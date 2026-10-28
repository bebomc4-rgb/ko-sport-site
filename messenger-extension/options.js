// رفيق المسنجر — صفحة الإعدادات: كل حقل فيه data-k="المفتاح" بينحفظ لحالو
(async () => {
  let cfg = await rafiqLoad();
  const get = (o, path) => path.split(".").reduce((x, k) => (x == null ? x : x[k]), o);
  const set = (o, path, v) => { const ks = path.split("."), last = ks.pop(); let x = o; for (const k of ks) x = x[k] = x[k] || {}; x[last] = v; };
  const $ = (s) => document.querySelector(s);
  let t = null;
  const save = () => { clearTimeout(t); t = setTimeout(async () => { await rafiqSave(cfg); const s = $("#saved"); s.classList.add("show"); setTimeout(() => s.classList.remove("show"), 900); paint(); }, 400); };

  for (const el of document.querySelectorAll("[data-k]")) {
    const k = el.dataset.k, v = get(cfg, k);
    if (el.type === "checkbox") el.checked = !!v; else el.value = v ?? "";
    el.addEventListener(el.type === "checkbox" || el.tagName === "SELECT" ? "change" : "input", () => {
      set(cfg, k, el.type === "checkbox" ? el.checked : el.type === "number" ? Number(el.value) : el.value);
      save();
    });
  }
  function paint() {
    const s = $("#state");
    s.textContent = !cfg.on ? "مطفي" : cfg.mode === "send" ? "شغّال: بيرد لحالو" : "شغّال: بيكتب بس";
    s.className = "pill" + (cfg.on ? (cfg.mode === "send" ? " on" : " draft") : "");
    $("#customBox").style.display = cfg.style === "custom" ? "" : "none";
  }
  paint();

  // ترتيب العقول
  const NAMES = { gemini: "Gemini", cloudflare: "Cloudflare", local: "المحلي" };
  function drawOrder() {
    const ul = $("#order"); ul.innerHTML = "";
    cfg.order.forEach((p, i) => {
      const li = document.createElement("li");
      li.innerHTML = `<b>${i + 1}.</b> <span>${NAMES[p]}</span>`;
      for (const [d, txt] of [[-1, "▲"], [1, "▼"]]) {
        const b = document.createElement("button"); b.className = "btn ghost small"; b.textContent = txt; b.disabled = (d < 0 && !i) || (d > 0 && i === cfg.order.length - 1);
        b.onclick = () => { const o = [...cfg.order]; [o[i], o[i + d]] = [o[i + d], o[i]]; cfg.order = o; drawOrder(); save(); };
        li.append(b);
      }
      ul.append(li);
    });
  }
  drawOrder();
  $("#showKeys").onclick = (e) => {
    const show = e.target.textContent.includes("إظهار");
    document.querySelectorAll("textarea.secret").forEach((x) => (x.style.webkitTextSecurity = show ? "none" : "disc"));
    document.querySelectorAll('input[data-k="cloudflare.token"]').forEach((x) => (x.type = show ? "text" : "password"));
    e.target.textContent = show ? "خبّي المفاتيح" : "إظهار المفاتيح";
  };

  // تجربة
  const msgs = () => $("#tMsgs").value.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => /^أنا\s*:/.test(l) ? { from: "me", text: l.replace(/^أنا\s*:\s*/, "") } : { from: "them", text: l });
  $("#tGo").onclick = async () => {
    const out = $("#tOut"); out.textContent = "عم يفكّر…"; const t0 = Date.now();
    const r = await chrome.runtime.sendMessage({ type: "reply", cfg, name: $("#tName").value, messages: msgs() });
    out.textContent = r && r.ok ? `${r.reply}\n\n— ${r.via} · ${((Date.now() - t0) / 1000).toFixed(1)} ثانية${r.crisis ? " · ⚠️ رسالة مهمة: البوت رح يوقف بهالمحادثة ويخبرك" : ""}` : "ما زبط: " + ((r && r.error) || "خطأ");
  };
  $("#tPrompt").onclick = async () => {
    const r = await chrome.runtime.sendMessage({ type: "prompt", cfg, name: $("#tName").value });
    $("#tOut").textContent = r.prompt;
  };
})();
