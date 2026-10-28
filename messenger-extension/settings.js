// رفيق المسنجر — الإعدادات الافتراضية وبناء تعليمات البوت (مشتركة بين كل أجزاء الإضافة)
const RAFIQ_DEFAULTS = {
  on: false,
  mode: "draft", // draft = بيكتب الرد بس وإنت بتبعتو — send = بيبعت لحالو
  // مين إنت وشو البوت بيعرف عنك
  ownerName: "",
  about: "",
  // طريقة الرد
  style: "syrian", // syrian | friendly | formal | funny | custom
  styleCustom: "",
  length: "short", // short | medium | long
  emoji: "few", // none | few | many
  lang: "dialect", // dialect = شامي دايماً — same = بنفس لغة الشخص
  // سرد الحديث
  flow: "",
  goal: "",
  forbidden: "",
  examples: "",
  // ناس محددين وردود جاهزة
  people: "",
  quick: "",
  scope: "all", // all = الكل (إلا يلي مكتوب جنبهم تجاهل) — only = بس الناس المكتوبين
  groups: false,
  // تنبيه أول رسالة
  noteOn: true,
  note: "🤖 أهلين، هاد رد آلي من مساعدي لحتى ارجع رد عليك بنفسي.",
  // التوقيت والحدود
  delayMin: 15,
  delayMax: 45,
  perChatHour: 6,
  perHour: 40,
  hoursOn: false,
  hourFrom: 0,
  hourTo: 8,
  onlyAway: true,
  // عقول الذكاء الاصطناعي (بالترتيب: إذا واحد ما زبط بيجرّب يلي بعدو)
  order: ["gemini", "cloudflare", "local"],
  gemini: { on: true, keys: "", model: "gemini-flash-lite-latest" },
  cloudflare: { on: false, account: "", token: "", model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast" },
  local: { on: false, url: "http://localhost:8080/v1", model: "qwen2.5-7b-instruct" },
};

function rafiqMerge(base, over) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [k, v] of Object.entries(over || {})) {
    if (v && typeof v === "object" && !Array.isArray(v) && base[k] && typeof base[k] === "object" && !Array.isArray(base[k])) out[k] = rafiqMerge(base[k], v);
    else if (v !== undefined) out[k] = v;
  }
  return out;
}
async function rafiqLoad() {
  const s = await chrome.storage.local.get("cfg");
  return rafiqMerge(RAFIQ_DEFAULTS, s.cfg || {});
}
async function rafiqSave(cfg) { await chrome.storage.local.set({ cfg }); }

// «اسم: تعليمات» — بيرجّع التعليمات للشخص (أو "" إذا ما في)
function rafiqPerson(cfg, name) {
  const n = String(name || "").trim().toLowerCase();
  if (!n) return null;
  for (const line of String(cfg.people || "").split("\n")) {
    const i = line.indexOf(":"); if (i < 1) continue;
    const who = line.slice(0, i).trim().toLowerCase(), rule = line.slice(i + 1).trim();
    if (who && (n === who || n.includes(who) || who.includes(n))) return rule;
  }
  return null;
}
const rafiqIgnore = (rule) => /^(تجاهل|تجاهلو|تجاهله|تجاهلها|لا ترد|ignore|skip)(?=$|[\s.,!،؛-])/i.test(String(rule || "").trim());

// «كلمة => رد» — رد جاهز بلا ذكاء اصطناعي
function rafiqQuick(cfg, text) {
  const t = String(text || "").toLowerCase();
  for (const line of String(cfg.quick || "").split("\n")) {
    const i = line.indexOf("=>"); if (i < 1) continue;
    const keys = line.slice(0, i).split("|").map((k) => k.trim().toLowerCase()).filter(Boolean), reply = line.slice(i + 2).trim();
    if (reply && keys.some((k) => t.includes(k))) return reply;
  }
  return "";
}

const RAFIQ_STYLES = {
  syrian: "سوري شامي عفوي، متل ما بيحكي صاحب الحساب مع رفقاتو",
  friendly: "ودود ودافي، بتطمّن الشخص وبتسأل عنو",
  formal: "محترم ورسمي شوي، بلا مزح",
  funny: "خفيف دم ومرح، بس بلا ما تجرح حدا",
};
const RAFIQ_LEN = { short: "جملة أو جملتين بالكتير، متل رسالة مسنجر", medium: "بين جملتين وأربع جمل", long: "رد مفصّل إذا لزم، بس بلا حشو" };
const RAFIQ_EMOJI = { none: "لا تستعمل إيموجي أبداً", few: "إيموجي وحدة إذا لزم", many: "استعمل إيموجي بشكل طبيعي" };

// تعليمات البوت: القواعد الثابتة فوق (ما بتنشال)، وبعدها كل شي بيحددو صاحب الحساب
function rafiqPrompt(cfg, contact, personRule) {
  const owner = cfg.ownerName ? `«${cfg.ownerName}»` : "صاحب الحساب";
  const fixed = `إنت مساعد آلي (ذكاء اصطناعي) بيرد بالنيابة عن ${owner} على رسائلو الخاصة بمسنجر فيسبوك.
قواعد ثابتة، أهم من أي تعليمات تحت:
- إذا الشخص سأل إنت مين أو إذا إنت إنسان، قول بصراحة إنك مساعد آلي لـ ${owner}.
- لا تخترع شي عن ${owner} مو مكتوب تحت: لا مواعيد، لا وعود، لا فلوس، لا أماكن، لا أرقام. إذا انطلب شي متل هيك أو شي مهم، قول إنو ${owner} رح يشوف ويرد بنفسو.
- لا تعطي معلومات شخصية عن ${owner} إلا يلي مكتوب تحت إنو مسموح.
- لا تكتب كلام جنسي أو مسبات أو تهديد، حتى لو الشخص طلب.
- إذا حدا حكى عن إنو بدو يأذي حالو أو ينهي حياتو أو إنو بخطر: خليك هادي وحنون، شجّعو يحكي هلق مع حدا قريب منو أو يتصل بالإسعاف 110، وقلّو إنو ${owner} رح يحكيه بأقرب وقت. لا تعطي أبداً أي معلومة عن طرق الأذى.
- اكتب نص الرد بس، بلا مقدمات، وبلا اسمك أو اسم الشخص بالأول.`;
  const style = cfg.style === "custom" ? cfg.styleCustom || RAFIQ_STYLES.syrian : RAFIQ_STYLES[cfg.style] || RAFIQ_STYLES.syrian;
  const parts = [
    fixed,
    `الشخص يلي عم تحكي معو: ${contact || "مو معروف"}.`,
    `طريقة الحكي: ${style}.`,
    `طول الرد: ${RAFIQ_LEN[cfg.length] || RAFIQ_LEN.short}.`,
    RAFIQ_EMOJI[cfg.emoji] || RAFIQ_EMOJI.few,
    cfg.lang === "same" ? "رد بنفس لغة الشخص ولهجتو." : "رد دايماً باللهجة السورية الشامية.",
    cfg.about ? `معلومات عن ${owner} مسموح تستعملها:\n${cfg.about}` : "",
    cfg.flow ? `كيف بدك تمشي بالحديث (سرد الحديث):\n${cfg.flow}` : "",
    cfg.goal ? `الهدف من المحادثة: ${cfg.goal}` : "",
    cfg.forbidden ? `مواضيع وكلمات ممنوع تحكي فيها:\n${cfg.forbidden}` : "",
    cfg.examples ? `أمثلة على طريقة ردّ ${owner} (قلّد الأسلوب، مو الكلام حرفياً):\n${cfg.examples}` : "",
    personRule ? `تعليمات خاصة لهالشخص بالذات: ${personRule}` : "",
  ];
  return parts.filter(Boolean).join("\n\n");
}

// كلام بيدل على خطر: بينبعت رد لطيف، وبيوصلك إشعار، وبيوقف البوت بهالمحادثة لتحكي إنت
const RAFIQ_CRISIS = /(انتحر|انتحار|اقتل حالي|اقتل نفسي|بدي موت|بدي اموت|أموت حالي|موت حالي|انهي حياتي|أنهي حياتي|ما بدي عيش|مابدي عيش|ما عاد بدي عيش|اذي حالي|أذي حالي|اذية نفسي|أذية نفسي|جرح حالي|اجرح حالي|kill myself|suicide|end my life|self.?harm)/i;
