// ko-catalog.js — يربط مجيب الواتساب (K FAST AI) بمنتجات متجر KO SPORT
// بيجيب المنتجات المناسبة لرسالة الزبون (الاسم، السعر بالدولار والليرة، الصورة، الرابط) من الموقع مباشرة،
// وبيعطيها للذكاء الاصطناعي ليجاوب صح، وبيبعت صور المنتجات مع روابطها.
//
// الاستعمال (Node 18 أو أحدث، ما بيحتاج أي مكتبة إضافية):
//   const ko = require("./ko-catalog");
//   const products = await ko.search(textOfCustomer);          // أحسن المنتجات لرسالة الزبون
//   const context  = ko.toPrompt(products);                     // حطّه بالـ prompt قبل ما يجاوب الذكاء الاصطناعي
//   await ko.sendCards(client, chatId, products.slice(0, 3));   // (اختياري) يبعت صورة كل منتج مع اسمه وسعره ورابطه

const STORE = process.env.KO_STORE_URL || "https://ko-sport.pages.dev"; // غيّرها لـ https://ko-sport.online بعد ربط الدومين

// ---- 1) البحث: أحسن المنتجات لكلام الزبون (بيفهم العربي والسوري وأسماء الماركات بالعربي والإنكليزي)
async function search(text, { limit = 5, onlyInStock = false } = {}) {
  const u = `${STORE}/api/catalog/search?q=${encodeURIComponent(String(text || "").slice(0, 200))}&limit=${limit}${onlyInStock ? "&stock=1" : ""}`;
  try {
    const r = await fetch(u, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return [];
    const j = await r.json();
    return j.products || [];
  } catch { return []; }
}

// ---- 2) كل المنتجات (مثلاً لتعمل نسخة عندك تتحدّث كل ساعة)
let cache = null, cacheAt = 0;
async function all() {
  if (cache && Date.now() - cacheAt < 10 * 60 * 1000) return cache;
  const r = await fetch(`${STORE}/api/catalog`, { signal: AbortSignal.timeout(15000) });
  cache = await r.json(); cacheAt = Date.now();
  return cache;
}

// ---- 3) نص قصير للذكاء الاصطناعي: هي المنتجات الحقيقية، ما يخترع غيرها
function money(p) {
  let s = `$${p.price_usd}`;
  if (p.price_syp) s += ` (${p.price_syp.toLocaleString("en-US")} ل.س)`;
  if (p.discount_percent) s += ` — عليه خصم ${p.discount_percent}%، كان $${p.old_price_usd}`;
  return s;
}
function toPrompt(products) {
  if (!products.length) return "ما لقينا منتج مطابق بالمتجر لهالسؤال. اسأل الزبون شو بالزبط بدّه، أو اقترح عليه يتصفح المتجر: " + STORE;
  return "منتجات حقيقية من متجر KO SPORT (جاوب منها بس، لا تخترع أسعار أو منتجات):\n" + products.map((p, i) =>
    `${i + 1}. ${p.name} | القسم: ${p.category} | السعر: ${money(p)} | ${p.in_stock ? "متوفر" : "خالص حالياً"}` +
    (p.options ? ` | الخيارات: ${p.options.join("، ")}` : "") +
    (p.description ? ` | الوصف: ${p.description.slice(0, 220)}` : "") +
    ` | الرابط: ${p.url}`).join("\n");
}

// تعليمات بتنضاف للـ system prompt تبع المجيب
const SYSTEM_RULES = `إنت موظف مبيعات بمتجر KO SPORT للأدوات الرياضية بسوريا. احكي باللهجة السورية وبلطف.
- الأسعار والمنتجات خدها بس من قائمة «منتجات حقيقية» يلي بتوصلك مع كل رسالة. إذا المنتج مو بالقائمة قول ما عنا هلق أو اسأل شو بالزبط بدّه.
- اذكر السعر بالدولار وبالليرة متل ما هو مكتوب، وإذا عليه خصم قول للزبون.
- إذا المنتج «خالص» قول إنه خالص حالياً واقترح شي شبهه من القائمة.
- حط رابط المنتج لما تقترحه ليقدر يطلب من الموقع، أو قلّه يبعتلك اسمه الكامل والمقاس/اللون لتسجّل الطلب.
- التوصيل لكل المحافظات، والسعر النهائي للتوصيل بيتحدد عند التأكيد.`;

// ---- 4) يبعت صورة المنتج مع اسمه وسعره ورابطه
// whatsapp-web.js:  const { MessageMedia } = require("whatsapp-web.js");
async function sendCards(client, chatId, products, lib = "whatsapp-web.js") {
  for (const p of products) {
    const caption = `*${p.name}*\n${money(p)}\n${p.in_stock ? "✅ متوفر" : "❌ خالص حالياً"}\n${p.url}`;
    try {
      if (lib === "whatsapp-web.js") {
        const { MessageMedia } = require("whatsapp-web.js");
        const media = await MessageMedia.fromUrl(p.image, { unsafeMime: true });
        await client.sendMessage(chatId, media, { caption });
      } else if (lib === "baileys") {
        await client.sendMessage(chatId, { image: { url: p.image }, caption });
      } else {
        await client.sendMessage(chatId, caption);
      }
    } catch {
      await client.sendMessage(chatId, caption); // إذا الصورة ما انبعتت، منبعت النص مع الرابط
    }
  }
}

module.exports = { STORE, search, all, toPrompt, SYSTEM_RULES, sendCards };

/* ---------- مثال كامل مع whatsapp-web.js ----------
const { Client, LocalAuth } = require("whatsapp-web.js");
const ko = require("./ko-catalog");
const client = new Client({ authStrategy: new LocalAuth() });
client.on("message", async (msg) => {
  const products = await ko.search(msg.body);                  // 1) جيب المنتجات المناسبة
  const answer = await askAI([                                 // 2) دالة الذكاء الاصطناعي يلي عندك (llama.cpp / Workers AI)
    { role: "system", content: ko.SYSTEM_RULES },
    { role: "system", content: ko.toPrompt(products) },
    { role: "user", content: msg.body },
  ]);
  await msg.reply(answer);                                      // 3) الجواب
  if (products.length && /صور|صورة|شكل|ورجيني|فرجيني|بدي شوف/.test(msg.body)) await ko.sendCards(client, msg.from, products.slice(0, 3)); // 4) الصور إذا طلبها
});
client.initialize();
*/
