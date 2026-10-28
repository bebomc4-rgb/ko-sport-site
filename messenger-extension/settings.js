// رفيق المسنجر — كل الإعدادات والذكاء الاصطناعي بالمجيب الآلي (K FAST AI) على نفس الكمبيوتر، بصفحة «مجيب المسنجر».
// الإضافة بتعرف بس وين المجيب (العنوان المحلي).
const RAFIQ_SERVER_DEFAULT = "http://localhost:3000";
async function rafiqServer() {
  const s = await chrome.storage.local.get("server");
  return String(s.server || RAFIQ_SERVER_DEFAULT).replace(/\/+$/, "");
}
