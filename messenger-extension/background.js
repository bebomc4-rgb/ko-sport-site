// رفيق المسنجر — الخلفية: بتحكي مع المجيب الآلي على الكمبيوتر (الإعدادات + الرد بعقول المنصة) وبتطلع إشعارات
importScripts("settings.js");

let cache = { at: 0, cfg: null };
async function call(path, body) {
  const base = await rafiqServer();
  const r = await fetch(base + path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {});
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "خطأ " + r.status);
  return j;
}
async function config(fresh) {
  if (!fresh && cache.cfg && Date.now() - cache.at < 15000) return cache.cfg;
  try { cache = { at: Date.now(), cfg: await call("/ext/messenger/config") }; }
  catch (e) { cache = { at: Date.now(), cfg: { error: "المجيب الآلي مو شغّال على الكمبيوتر (" + e.message + ")" } }; }
  badge(cache.cfg);
  return cache.cfg;
}
function badge(cfg) {
  const off = !cfg || cfg.error || !cfg.on;
  chrome.action.setBadgeText({ text: cfg && cfg.error ? "!" : off ? "" : cfg.mode === "send" ? "ON" : "✍" });
  chrome.action.setBadgeBackgroundColor({ color: cfg && cfg.error ? "#d92d20" : cfg && cfg.mode === "send" ? "#0a7cff" : "#e08a00" });
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (!msg) return;
  const run = (p) => { p.then(reply, (e) => reply({ ok: false, error: String((e && e.message) || e) })); return true; };
  if (msg.type === "config") return run(config(msg.fresh));
  if (msg.type === "reply") return run(call("/ext/messenger/reply", { name: msg.name, messages: msg.messages }));
  if (msg.type === "log") return run(call("/ext/messenger/log", { entries: [msg.entry] }).catch(() => ({ ok: false })));
  if (msg.type === "toggle") return run(call("/ext/messenger/toggle", msg.change).then((c) => { cache = { at: Date.now(), cfg: c }; badge(c); return c; }));
  if (msg.type === "notify") chrome.notifications.create({ type: "basic", iconUrl: "icon128.png", title: msg.title || "رفيق المسنجر", message: msg.text || "", priority: 2, requireInteraction: !!msg.sticky });
});
chrome.runtime.onInstalled.addListener(() => config(true));
chrome.runtime.onStartup.addListener(() => config(true));
