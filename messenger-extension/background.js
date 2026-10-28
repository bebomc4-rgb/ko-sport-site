// رفيق المسنجر — الخلفية: بتكتب الرد بعقول الذكاء الاصطناعي (Gemini / Cloudflare / المحلي) وبتطلع إشعارات
importScripts("settings.js");

const cooldown = new Map(); // عقل وصل لحدّو: منرتاح منو شوي

async function callGemini(c, sys, hist) {
  const keys = String(c.keys || "").split(/[\s,]+/).map((k) => k.trim()).filter(Boolean);
  if (!keys.length) throw new Error("ما في مفتاح Gemini");
  // الأدوار لازم تتناوب: منجمع الرسائل ورا بعض من نفس الطرف
  const contents = [];
  for (const x of hist) {
    const role = x.from === "me" ? "model" : "user", prev = contents[contents.length - 1];
    if (prev && prev.role === role) prev.parts[0].text += "\n" + x.text; else contents.push({ role, parts: [{ text: x.text }] });
  }
  while (contents.length && contents[0].role === "model") contents.shift();
  let last = "";
  const start = Math.floor(Math.random() * keys.length);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[(start + i) % keys.length];
    if ((cooldown.get("g:" + key) || 0) > Date.now()) continue;
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(c.model || "gemini-flash-lite-latest")}:generateContent`, {
      method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: sys }] }, contents, generationConfig: { temperature: 0.75, maxOutputTokens: 400 } }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.status === 429) { cooldown.set("g:" + key, Date.now() + 30 * 60e3); last = "مفتاح Gemini خلصت حصتو"; continue; }
    const t = ((j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || []).map((p) => p.text || "").join("").trim();
    if (t) return t;
    last = (j.error && j.error.message) || "Gemini ما رد";
  }
  throw new Error(last || "كل مفاتيح Gemini مرتاحة هلق");
}
async function callCloudflare(c, sys, hist) {
  if (!c.account || !c.token) throw new Error("ناقص Account ID أو Token تبع Cloudflare");
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(c.account.trim())}/ai/run/${c.model || "@cf/meta/llama-3.3-70b-instruct-fp8-fast"}`, {
    method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + c.token.trim() },
    body: JSON.stringify({ messages: [{ role: "system", content: sys }, ...hist.map((x) => ({ role: x.from === "me" ? "assistant" : "user", content: x.text }))], max_tokens: 400, temperature: 0.75 }),
  });
  const j = await r.json().catch(() => ({}));
  const t = String((j.result && j.result.response) || "").trim();
  if (!t) throw new Error((j.errors && j.errors[0] && j.errors[0].message) || "Cloudflare ما رد");
  return t;
}
async function callLocal(c, sys, hist) {
  const r = await fetch(String(c.url || "http://localhost:8080/v1").replace(/\/+$/, "") + "/chat/completions", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: c.model || "local", messages: [{ role: "system", content: sys }, ...hist.map((x) => ({ role: x.from === "me" ? "assistant" : "user", content: x.text }))], max_tokens: 400, temperature: 0.75 }),
  });
  const j = await r.json().catch(() => ({}));
  const t = String((j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || "").trim();
  if (!t) throw new Error("الذكاء المحلي ما رد (شغّال llama-server؟)");
  return t;
}
const CALL = { gemini: callGemini, cloudflare: callCloudflare, local: callLocal };
const NAMES = { gemini: "Gemini", cloudflare: "Cloudflare", local: "المحلي" };

// الرد على محادثة: {name, messages:[{from:"me"|"them", text}]}
async function makeReply(cfg, name, messages) {
  const hist = (messages || []).filter((x) => x && x.text).slice(-14).map((x) => ({ from: x.from === "me" ? "me" : "them", text: String(x.text).slice(0, 1500) }));
  if (!hist.length || hist[hist.length - 1].from !== "them") return { ok: false, error: "آخر رسالة مو من الشخص" };
  const rule = rafiqPerson(cfg, name);
  const lastThem = hist.filter((x) => x.from === "them").slice(-3).map((x) => x.text).join("\n");
  const crisis = RAFIQ_CRISIS.test(lastThem);
  const quick = !crisis && rafiqQuick(cfg, hist[hist.length - 1].text);
  if (quick) return { ok: true, reply: quick, via: "رد جاهز", crisis };
  const sys = rafiqPrompt(cfg, name, rule && !rafiqIgnore(rule) ? rule : "");
  const errs = [];
  for (const p of cfg.order || ["gemini", "cloudflare", "local"]) {
    const c = cfg[p];
    if (!c || !c.on || !CALL[p]) continue;
    try {
      let t = await CALL[p](c, sys, hist);
      t = t.replace(/^["«]|["»]$/g, "").replace(/^(رد|الرد|المساعد)\s*:\s*/i, "").trim();
      return { ok: true, reply: t.slice(0, 1200), via: NAMES[p], crisis };
    } catch (e) { errs.push(NAMES[p] + ": " + (e && e.message)); }
  }
  if (crisis) return { ok: true, reply: "قريت رسالتك وهي مهمة كتير 🤍 إذا حاسس إنك ممكن تأذي حالك، احكي هلق مع حدا قريب منك أو اتصل بالإسعاف 110. وأنا رح احكيك بأقرب وقت.", via: "رد الطوارئ", crisis };
  return { ok: false, error: errs.length ? errs.join(" — ") : "ما في ولا عقل ذكاء اصطناعي مفعّل بالإعدادات" };
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (!msg) return;
  if (msg.type === "reply") {
    rafiqLoad().then((cfg) => makeReply(msg.cfg || cfg, msg.name, msg.messages)).then(reply, (e) => reply({ ok: false, error: String(e && e.message) }));
    return true;
  }
  if (msg.type === "prompt") {
    rafiqLoad().then((cfg) => { const c = msg.cfg || cfg, rule = rafiqPerson(c, msg.name); reply({ prompt: rafiqPrompt(c, msg.name, rule && !rafiqIgnore(rule) ? rule : "") }); });
    return true;
  }
  if (msg.type === "notify") {
    chrome.notifications.create({ type: "basic", iconUrl: "icon128.png", title: msg.title || "رفيق المسنجر", message: msg.text || "", priority: 2, requireInteraction: !!msg.sticky });
  }
});

// شارة على أيقونة الإضافة: شغّال أو لا
async function badge() {
  const cfg = await rafiqLoad();
  chrome.action.setBadgeText({ text: cfg.on ? (cfg.mode === "send" ? "ON" : "✍") : "" });
  chrome.action.setBadgeBackgroundColor({ color: cfg.mode === "send" ? "#0a7cff" : "#e08a00" });
}
chrome.storage.onChanged.addListener((ch) => { if (ch.cfg) badge(); });
chrome.runtime.onInstalled.addListener(badge);
chrome.runtime.onStartup.addListener(badge);
