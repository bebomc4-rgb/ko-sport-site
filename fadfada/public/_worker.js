// فضفضة — موقع للفضفضة مع بوت بيسمع، وغرف دردشة، وأصدقاء ورسائل خاصة.
// Cloudflare Pages (advanced mode): هالملف هو السيرفر، والصفحات بنفس المجلد (env.ASSETS).
// التخزين: D1 (env.DB). الذكاء الاصطناعي: Gemini إذا في GEMINI_API_KEY، وإلا Workers AI (env.AI).
// لوحة الإدارة: /admin.html بكلمة سر ADMIN_PASSWORD (Secret بإعدادات Cloudflare، مو بالكود).

const ROOMS = [
  { id: "general", name: "الغرفة العامة", icon: "☕", about: "حكي عام وتعارف" },
  { id: "vent", name: "فضفضة", icon: "🫂", about: "احكي يلي بقلبك، ونحنا منسمع" },
  { id: "sport", name: "رياضة", icon: "🥊", about: "تمرين وأكل صحي ونصايح" },
  { id: "youth", name: "شباب وصبايا", icon: "🌿", about: "دراسة وشغل وحياة" },
];
const KEEP_DAYS = 30; // الرسائل بتنمحى لحالها بعد هالمدة
const MAX_LEN = 500;

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const bad = (error, status = 400) => json({ error }, status);
const now = () => Date.now();
const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const sha = async (s) => hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
const rid = (n = 16) => hex(crypto.getRandomValues(new Uint8Array(n)));
const clean = (s, max) => String(s ?? "").replace(/[\u0000-\u0008\u000b-\u001f\u007f​-‏‪-‮⁦-⁩]/g, "").trim().slice(0, max);

// ---------- قاعدة البيانات (بتنعمل لحالها أول مرة) ----------
let ready = null;
function init(env) {
  if (!ready) ready = env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, tok TEXT NOT NULL, ip TEXT, created INTEGER, last INTEGER, banned INTEGER DEFAULT 0)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS msgs (id INTEGER PRIMARY KEY AUTOINCREMENT, room TEXT NOT NULL, uid TEXT NOT NULL, text TEXT NOT NULL, at INTEGER NOT NULL, del INTEGER DEFAULT 0)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS msgs_room ON msgs (room, id)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS friends (a TEXT NOT NULL, b TEXT NOT NULL, status TEXT NOT NULL, by TEXT NOT NULL, at INTEGER, PRIMARY KEY (a, b))"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS friends_b ON friends (b)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS blocks (uid TEXT NOT NULL, other TEXT NOT NULL, PRIMARY KEY (uid, other))"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS reports (id INTEGER PRIMARY KEY AUTOINCREMENT, msg INTEGER, reporter TEXT, target TEXT, reason TEXT, at INTEGER, done INTEGER DEFAULT 0)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS ipbans (ip TEXT PRIMARY KEY, at INTEGER)"),
  ]).catch((e) => { ready = null; throw e; });
  return ready;
}

// ---------- حدود بسيطة لكل زائر (ذاكرة Cloudflare المؤقتة، بلا كتابة بقاعدة البيانات) ----------
async function limited(key, max, secs) {
  if (typeof caches === "undefined") return false;
  const req = new Request("https://limit.internal/" + encodeURIComponent(key));
  const hit = await caches.default.match(req);
  const n = hit ? parseInt(await hit.text()) || 0 : 0;
  if (n >= max) return true;
  await caches.default.put(req, new Response(String(n + 1), { headers: { "cache-control": "max-age=" + secs } }));
  return false;
}
const ipOf = async (request, env) => sha((request.headers.get("cf-connecting-ip") || "local") + "|" + (env.IP_SALT || "fadfada"));

// ---------- مين عم يحكي (رقم الحساب + كلمة السر يلي بتنحفظ بجهازه) ----------
async function who(request, env) {
  const m = /^Bearer ([a-f0-9]{16})\.([a-f0-9]{32})$/.exec(request.headers.get("authorization") || "");
  if (!m) return null;
  const u = await env.DB.prepare("SELECT id, name, tok, banned, last FROM users WHERE id = ?").bind(m[1]).first();
  if (!u || u.tok !== (await sha(m[2]))) return null;
  return u;
}
const tag = (id) => id.slice(-4);
const pub = (u) => ({ id: u.id, name: u.name, tag: tag(u.id) });

// ---------- فلتر الكلام ----------
// كلمات كاملة بس (مو أجزاء من كلمات)، مشان ما تنمنع كلمات عادية متل «عكس» أو «زبون»
const BAD = /(^|[^\p{L}])(كس|زب|زبي|طيز|نيك|ينيك|انيك|بنيك|نيكك|خول|عرص\p{L}*|شرموط\p{L}*|منيوك\p{L}*|كسم\p{L}*|كسخت\p{L}*|قحب\p{L}*|متناك\p{L}*|fuck\p{L}*|bitch\p{L}*)(?=[^\p{L}]|$)/iu;
const hasBad = (t) => BAD.test(String(t).replace(/ـ/g, ""));
// رقم هاتف = 8 أرقام أو أكتر ورا بعض (مع فراغات أو شحطات)
const hasPhone = (t) => (String(t).replace(/[٠-٩]/g, (d) => d.charCodeAt(0) - 1632).match(/\+?\d[\d\s\-().]{6,}\d/g) || []).some((x) => x.replace(/\D/g, "").length >= 8);
const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|me|io|ly|sy|link|xyz|app)\b|t\.me|wa\.me|instagram|facebook|snapchat|telegram|سناب|انستا|واتس|تلغرام|تيليغرام)/i;

// ---------- كلام بيدل على خطر: البوت بيرد بلطف وبتطلع بطاقة أرقام المساعدة ----------
const CRISIS = /(انتحر|انتحار|اقتل حالي|اقتل نفسي|بدي موت|بدي اموت|ابغى اموت|أموت حالي|موت حالي|انهي حياتي|أنهي حياتي|انهي حياتي|خلص من حياتي|ما بدي عيش|مابدي عيش|ما عاد بدي عيش|اذي حالي|أذي حالي|اذية نفسي|أذية نفسي|جرح حالي|اجرح حالي|اقطع ايدي|شفرة|حبوب كتير|kill myself|suicide|end my life|self.?harm)/i;

// ---------- المسارات ----------
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url), path = url.pathname, m = request.method;
    if (!path.startsWith("/api/")) return env.ASSETS.fetch(request);
    if (!env.DB) return bad("قاعدة البيانات مو مربوطة: Settings ← Bindings ← D1 باسم DB", 500);
    try {
      await init(env);
      if (path === "/api/rooms" && m === "GET") return json(ROOMS);
      if (path === "/api/join" && m === "POST") return join(request, env);
      if (path.startsWith("/api/admin/")) return admin(request, env, path, m);
      const u = await who(request, env);
      if (!u) return bad("لازم تفوت من جديد", 401);
      if (u.banned) return json({ error: "حسابك موقوف بسبب مخالفة القوانين", banned: true }, 403);
      if (now() - (u.last || 0) > 5 * 60e3) ctx.waitUntil(env.DB.prepare("UPDATE users SET last = ? WHERE id = ?").bind(now(), u.id).run().catch(() => {}));
      if (path === "/api/me" && m === "GET") return json(pub(u));
      if (path === "/api/me" && m === "POST") return rename(request, env, u);
      if (path === "/api/msgs" && m === "GET") return msgsGet(url, env, u);
      if (path === "/api/msgs" && m === "POST") return msgsPost(request, env, u, ctx);
      if (path === "/api/friends" && m === "GET") return friendsGet(env, u);
      if (path === "/api/friends" && m === "POST") return friendsPost(request, env, u);
      if (path === "/api/block" && m === "GET") return blocksGet(env, u);
      if (path === "/api/block" && m === "POST") return blockPost(request, env, u);
      if (path === "/api/report" && m === "POST") return report(request, env, u, ctx);
      if (path === "/api/ai" && m === "POST") return ai(request, env, u);
      return bad("مو موجود", 404);
    } catch (e) {
      return bad("صار خطأ بالسيرفر، جرّب بعد شوي", 500);
    }
  },
};

async function join(request, env) {
  const b = await request.json().catch(() => ({}));
  const name = clean(b.name, 20).replace(/\s+/g, " ");
  if (!b.adult) return bad("الموقع للكبار فوق 18 سنة بس");
  if (name.length < 2) return bad("اكتب اسم من حرفين أو أكتر");
  if (!/^[\p{L}\p{N} _.-]+$/u.test(name) || hasBad(name)) return bad("اختار اسم تاني لو سمحت");
  const ip = await ipOf(request, env);
  if (await env.DB.prepare("SELECT 1 FROM ipbans WHERE ip = ?").bind(ip).first()) return bad("ما فيك تفوت من هالجهاز", 403);
  if (await limited("join:" + ip, 6, 3600)) return bad("فتت كتير، جرّب بعد ساعة", 429);
  const id = rid(8), token = rid(16);
  await env.DB.prepare("INSERT INTO users (id, name, tok, ip, created, last) VALUES (?, ?, ?, ?, ?, ?)").bind(id, name, await sha(token), ip, now(), now()).run();
  return json({ id, name, tag: tag(id), key: id + "." + token }, 201);
}

async function rename(request, env, u) {
  const b = await request.json().catch(() => ({}));
  const name = clean(b.name, 20).replace(/\s+/g, " ");
  if (name.length < 2 || !/^[\p{L}\p{N} _.-]+$/u.test(name) || hasBad(name)) return bad("اختار اسم تاني لو سمحت");
  await env.DB.prepare("UPDATE users SET name = ? WHERE id = ?").bind(name, u.id).run();
  return json({ ...pub(u), name });
}

// غرفة عامة: "general"… — محادثة خاصة: "dm:<رقم الصديق>"
const dmRoom = (a, b) => "dm:" + [a, b].sort().join(":");
const pair = (a, b) => (a < b ? [a, b] : [b, a]);
async function areFriends(env, a, b) {
  const [x, y] = pair(a, b);
  return !!(await env.DB.prepare("SELECT 1 FROM friends WHERE a = ? AND b = ? AND status = 'ok'").bind(x, y).first());
}
async function blockedEither(env, a, b) {
  return !!(await env.DB.prepare("SELECT 1 FROM blocks WHERE (uid = ? AND other = ?) OR (uid = ? AND other = ?)").bind(a, b, b, a).first());
}
async function roomOf(env, u, c) {
  c = String(c || "");
  if (ROOMS.some((r) => r.id === c)) return { room: c, public: true };
  const mm = /^dm:([a-f0-9]{16})$/.exec(c);
  if (mm && mm[1] !== u.id && (await areFriends(env, u.id, mm[1]))) return { room: dmRoom(u.id, mm[1]), public: false, other: mm[1] };
  return null;
}

async function msgsGet(url, env, u) {
  const r = await roomOf(env, u, url.searchParams.get("c"));
  if (!r) return bad("هالمحادثة مو متاحة", 404);
  const after = Math.max(0, parseInt(url.searchParams.get("after")) || 0);
  const q = after
    ? env.DB.prepare("SELECT m.id, m.uid, m.text, m.at, u.name FROM msgs m JOIN users u ON u.id = m.uid WHERE m.room = ? AND m.id > ? AND m.del = 0 AND u.banned = 0 AND m.uid NOT IN (SELECT other FROM blocks WHERE uid = ?) ORDER BY m.id LIMIT 100").bind(r.room, after, u.id)
    : env.DB.prepare("SELECT * FROM (SELECT m.id, m.uid, m.text, m.at, u.name FROM msgs m JOIN users u ON u.id = m.uid WHERE m.room = ? AND m.del = 0 AND u.banned = 0 AND m.uid NOT IN (SELECT other FROM blocks WHERE uid = ?) ORDER BY m.id DESC LIMIT 60) ORDER BY id").bind(r.room, u.id);
  const { results } = await q.all();
  return json({ msgs: results.map((x) => ({ id: x.id, uid: x.uid, name: x.name, tag: tag(x.uid), text: x.text, at: x.at, me: x.uid === u.id })) });
}

async function msgsPost(request, env, u, ctx) {
  const b = await request.json().catch(() => ({}));
  const r = await roomOf(env, u, b.c);
  if (!r) return bad("هالمحادثة مو متاحة", 404);
  const text = clean(b.text, MAX_LEN + 1).replace(/\n{3,}/g, "\n\n");
  if (!text) return bad("اكتب شي");
  if (text.length > MAX_LEN) return bad(`الرسالة طويلة (الحد ${MAX_LEN} حرف)`);
  if (hasBad(text)) return bad("في كلام مو لائق بالرسالة، عدّلها لو سمحت");
  if (r.public && (hasPhone(text) || LINK.test(text))) return bad("ممنوع أرقام الهواتف والروابط والحسابات بالغرف العامة. خليها للرسائل الخاصة مع أصدقائك");
  if (!r.public && (await blockedEither(env, u.id, r.other))) return bad("ما فيك تراسل هالشخص", 403);
  if (await limited("msg:" + u.id, 1, 2)) return bad("شوي شوي، استنى ثانيتين", 429);
  if (await limited("msgm:" + u.id, 25, 60)) return bad("بعتت كتير بدقيقة، ريّح شوي", 429);
  const res = await env.DB.prepare("INSERT INTO msgs (room, uid, text, at) VALUES (?, ?, ?, ?)").bind(r.room, u.id, text, now()).run();
  if (Math.random() < 0.02) ctx.waitUntil(env.DB.prepare("DELETE FROM msgs WHERE at < ?").bind(now() - KEEP_DAYS * 864e5).run().catch(() => {}));
  return json({ id: res.meta.last_row_id, at: now() }, 201);
}

async function friendsGet(env, u) {
  const { results } = await env.DB.prepare("SELECT f.a, f.b, f.status, f.by, f.at, u.name, u.last FROM friends f JOIN users u ON u.id = CASE WHEN f.a = ? THEN f.b ELSE f.a END WHERE (f.a = ? OR f.b = ?) AND u.banned = 0").bind(u.id, u.id, u.id).all();
  const out = { friends: [], incoming: [], outgoing: [] };
  for (const f of results) {
    const id = f.a === u.id ? f.b : f.a, x = { id, name: f.name, tag: tag(id), online: now() - (f.last || 0) < 6 * 60e3 };
    if (f.status === "ok") out.friends.push(x); else if (f.by === u.id) out.outgoing.push(x); else out.incoming.push(x);
  }
  if (out.friends.length) {
    const rooms = out.friends.map((f) => dmRoom(u.id, f.id));
    const { results: last } = await env.DB.prepare(`SELECT room, MAX(id) AS m FROM msgs WHERE del = 0 AND room IN (${rooms.map(() => "?").join(",")}) GROUP BY room`).bind(...rooms).all();
    const lm = new Map(last.map((x) => [x.room, x.m]));
    for (const f of out.friends) f.lastMsg = lm.get(dmRoom(u.id, f.id)) || 0;
    out.friends.sort((p, q) => q.lastMsg - p.lastMsg);
  }
  return json(out);
}

// {to, act: "add" | "accept" | "decline" | "remove"}
async function friendsPost(request, env, u) {
  const b = await request.json().catch(() => ({}));
  const other = String(b.to || ""), act = b.act || "add";
  if (!/^[a-f0-9]{16}$/.test(other) || other === u.id) return bad("الشخص مو موجود");
  const o = await env.DB.prepare("SELECT id, banned FROM users WHERE id = ?").bind(other).first();
  if (!o || o.banned) return bad("الشخص مو موجود", 404);
  const [a, b2] = pair(u.id, other);
  const row = await env.DB.prepare("SELECT status, by FROM friends WHERE a = ? AND b = ?").bind(a, b2).first();
  if (act === "remove" || act === "decline") {
    await env.DB.prepare("DELETE FROM friends WHERE a = ? AND b = ?").bind(a, b2).run();
    return json({ ok: true });
  }
  if (await blockedEither(env, u.id, other)) return bad("ما فيك تضيف هالشخص", 403);
  if (act === "accept") {
    if (!row || row.status !== "pending" || row.by === u.id) return bad("ما في طلب صداقة");
    await env.DB.prepare("UPDATE friends SET status = 'ok', at = ? WHERE a = ? AND b = ?").bind(now(), a, b2).run();
    return json({ ok: true, status: "ok" });
  }
  if (row) {
    if (row.status === "pending" && row.by !== u.id) { // هو كمان بعتلك طلب: صرتو أصدقاء
      await env.DB.prepare("UPDATE friends SET status = 'ok', at = ? WHERE a = ? AND b = ?").bind(now(), a, b2).run();
      return json({ ok: true, status: "ok" });
    }
    return json({ ok: true, status: row.status });
  }
  if (await limited("friend:" + u.id, 20, 3600)) return bad("بعتت طلبات كتير، جرّب بعد شوي", 429);
  await env.DB.prepare("INSERT INTO friends (a, b, status, by, at) VALUES (?, ?, 'pending', ?, ?)").bind(a, b2, u.id, now()).run();
  return json({ ok: true, status: "pending" }, 201);
}

async function blocksGet(env, u) {
  const { results } = await env.DB.prepare("SELECT b.other, u.name FROM blocks b JOIN users u ON u.id = b.other WHERE b.uid = ?").bind(u.id).all();
  return json(results.map((x) => ({ id: x.other, name: x.name, tag: tag(x.other) })));
}
// {other, on: true|false}
async function blockPost(request, env, u) {
  const b = await request.json().catch(() => ({}));
  const other = String(b.other || "");
  if (!/^[a-f0-9]{16}$/.test(other) || other === u.id) return bad("الشخص مو موجود");
  if (b.on === false) { await env.DB.prepare("DELETE FROM blocks WHERE uid = ? AND other = ?").bind(u.id, other).run(); return json({ ok: true }); }
  const [a, b2] = pair(u.id, other);
  await env.DB.batch([
    env.DB.prepare("INSERT OR IGNORE INTO blocks (uid, other) VALUES (?, ?)").bind(u.id, other),
    env.DB.prepare("DELETE FROM friends WHERE a = ? AND b = ?").bind(a, b2),
  ]);
  return json({ ok: true });
}

async function report(request, env, u, ctx) {
  const b = await request.json().catch(() => ({}));
  const id = parseInt(b.msg) || 0, reason = clean(b.reason, 200);
  const msg = id ? await env.DB.prepare("SELECT id, uid, room, text FROM msgs WHERE id = ?").bind(id).first() : null;
  const target = msg ? msg.uid : String(b.user || "");
  if (!/^[a-f0-9]{16}$/.test(target) || target === u.id) return bad("ما في شي لتبلّغ عنه");
  if (msg && msg.room.startsWith("dm:") && !msg.room.includes(u.id)) return bad("ما في شي لتبلّغ عنه");
  if (await limited("report:" + u.id, 15, 3600)) return bad("بلّغت كتير، منشوف التبليغات ومنرجعلك", 429);
  await env.DB.prepare("INSERT INTO reports (msg, reporter, target, reason, at) VALUES (?, ?, ?, ?, ?)").bind(msg ? msg.id : null, u.id, target, reason, now()).run();
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) ctx.waitUntil(fetch(`https://api.telegram.org/bot${String(env.TELEGRAM_BOT_TOKEN).trim()}/sendMessage`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: String(env.TELEGRAM_CHAT_ID).trim(), text: `🚩 تبليغ جديد بموقع الفضفضة\nالسبب: ${reason || "—"}${msg ? "\nالرسالة: " + msg.text.slice(0, 300) : ""}\nافتح لوحة الإدارة: ${new URL(request.url).origin}/admin.html`, link_preview_options: { is_disabled: true } }),
  }).catch(() => {}));
  return json({ ok: true }, 201);
}

// ---------- البوت يلي بيسمع ----------
const SYSTEM = `إنت «رفيق»، صديق بيسمع بموقع فضفضة. بتحكي باللهجة السورية الشامية، بجمل قصيرة ودافية وبسيطة.
شغلك: تسمع، تفهم شو حاسس الشخص، تعكسلو مشاعره بلطف، وتسأل سؤال واحد لطيف بيساعده يحكي أكتر. ما بتحاضر وما بتحكم على حدا.
إذا طلب نصيحة، اعطيه فكرة أو تنتين عمليات وصغار.
إنت مو دكتور ولا معالج نفسي: لا تشخّص أمراض ولا تقترح أدوية أو جرعات. إذا الموضوع كبير (اكتئاب طويل، صدمة، إدمان)، شجّعه بلطف يحكي مع مختص أو حدا بيوثق فيه.
إذا حكى عن إنو بدو يأذي حالو أو ينهي حياتو أو حدا عم يأذيه: خليك هادي وحنون، قلّو إنو مهم كتير وإنك مبسوط إنو حكى، شجّعه يحكي هلق مع حدا قريب منو أو يتصل بالإسعاف 110، وسألو إذا هو بأمان هلق. لا تعطي أبداً أي معلومة عن طرق الأذى.
لا تطلب معلومات شخصية (اسم كامل، رقم، عنوان). إذا سألك مين إنت، قول إنك بوت ذكاء اصطناعي بيسمع، مو إنسان.
خليك مختصر: بين جملتين وخمس جمل.`;

async function ai(request, env, u) {
  const b = await request.json().catch(() => ({}));
  const hist = (Array.isArray(b.messages) ? b.messages : []).slice(-16)
    .map((x) => ({ role: x.role === "bot" ? "assistant" : "user", text: clean(x.text, 1200) })).filter((x) => x.text);
  if (!hist.length || hist[hist.length - 1].role !== "user") return bad("اكتب شي");
  if (await limited("ai:" + u.id, 1, 2)) return bad("شوي شوي، استنى ثانيتين", 429);
  if (await limited("aih:" + u.id, 80, 3600)) return bad("حكينا كتير هالساعة، ريّح شوي وارجع", 429);
  const crisis = CRISIS.test(hist[hist.length - 1].text) || hist.slice(-4).some((x) => x.role === "user" && CRISIS.test(x.text));
  let reply = "";
  const key = String(env.GEMINI_API_KEY || "").trim();
  if (key) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL || "gemini-flash-lite-latest"}:generateContent`, {
        method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents: hist.map((x) => ({ role: x.role === "assistant" ? "model" : "user", parts: [{ text: x.text }] })),
          generationConfig: { temperature: 0.8, maxOutputTokens: 400 },
          safetySettings: ["HARM_CATEGORY_HARASSMENT", "HARM_CATEGORY_HATE_SPEECH", "HARM_CATEGORY_SEXUALLY_EXPLICIT", "HARM_CATEGORY_DANGEROUS_CONTENT"].map((category) => ({ category, threshold: "BLOCK_MEDIUM_AND_ABOVE" })),
        }),
      });
      const j = await r.json().catch(() => null);
      reply = ((j && j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || []).map((p) => p.text || "").join("").trim();
    } catch {}
  }
  if (!reply && env.AI) {
    try {
      const r = await env.AI.run(env.AI_MODEL || "@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
        messages: [{ role: "system", content: SYSTEM }, ...hist.map((x) => ({ role: x.role, content: x.text }))], max_tokens: 400, temperature: 0.8,
      });
      reply = String((r && r.response) || "").trim();
    } catch {}
  }
  if (!reply) reply = crisis
    ? "أنا هون وعم اسمعك، ومبسوط إنك حكيت. يلي حاسس فيه تقيل كتير، وإنت مو لحالك. إذا حاسس إنك ممكن تأذي حالك، احكي هلق مع حدا قريب منك أو اتصل بالإسعاف 110. إنت بأمان هلق؟"
    : "ما قدرت رد هلق، جرّب تبعت رسالتك كمان مرة بعد شوي 🙏";
  return json({ reply: reply.slice(0, 2000), crisis });
}

// ---------- لوحة الإدارة ----------
async function admin(request, env, path, m) {
  const pass = String(env.ADMIN_PASSWORD || "");
  const given = request.headers.get("x-admin") || "";
  if (!pass) return bad("لازم تحط ADMIN_PASSWORD كـ Secret بإعدادات Cloudflare", 503);
  if ((await sha(given)) !== (await sha(pass))) return bad("كلمة السر غلط", 401);
  const b = m === "POST" ? await request.json().catch(() => ({})) : {};
  if (path === "/api/admin/stats") {
    const day = now() - 864e5;
    const [users, active, msgs, open] = await Promise.all([
      env.DB.prepare("SELECT COUNT(*) n FROM users").first(), env.DB.prepare("SELECT COUNT(*) n FROM users WHERE last > ?").bind(day).first(),
      env.DB.prepare("SELECT COUNT(*) n FROM msgs WHERE at > ?").bind(day).first(), env.DB.prepare("SELECT COUNT(*) n FROM reports WHERE done = 0").first(),
    ]);
    return json({ users: users.n, active: active.n, msgs: msgs.n, reports: open.n });
  }
  if (path === "/api/admin/reports") {
    const { results } = await env.DB.prepare(`SELECT r.id, r.msg, r.reason, r.at, r.done, r.target, t.name tname, t.banned, p.name pname, m.text, m.room, m.del
      FROM reports r LEFT JOIN users t ON t.id = r.target LEFT JOIN users p ON p.id = r.reporter LEFT JOIN msgs m ON m.id = r.msg
      ORDER BY r.done, r.id DESC LIMIT 200`).all();
    return json(results.map((x) => ({ ...x, room: x.room && x.room.startsWith("dm:") ? "رسالة خاصة" : (ROOMS.find((r) => r.id === x.room) || {}).name || x.room })));
  }
  if (path === "/api/admin/msgs") {
    const room = new URL(request.url).searchParams.get("room") || "general";
    if (!ROOMS.some((r) => r.id === room)) return bad("الغرفة مو موجودة");
    const { results } = await env.DB.prepare("SELECT m.id, m.uid, m.text, m.at, m.del, u.name, u.banned FROM msgs m JOIN users u ON u.id = m.uid WHERE m.room = ? ORDER BY m.id DESC LIMIT 150").bind(room).all();
    return json(results);
  }
  if (path === "/api/admin/act" && m === "POST") {
    const uid = /^[a-f0-9]{16}$/.test(b.uid || "") ? b.uid : null, id = parseInt(b.id) || 0;
    if (b.act === "delmsg" && id) await env.DB.prepare("UPDATE msgs SET del = 1 WHERE id = ?").bind(id).run();
    else if (b.act === "ban" && uid) {
      const u = await env.DB.prepare("SELECT ip FROM users WHERE id = ?").bind(uid).first();
      await env.DB.batch([
        env.DB.prepare("UPDATE users SET banned = 1 WHERE id = ?").bind(uid),
        ...(u && u.ip && b.ip ? [env.DB.prepare("INSERT OR IGNORE INTO ipbans (ip, at) VALUES (?, ?)").bind(u.ip, now())] : []),
      ]);
    } else if (b.act === "unban" && uid) {
      const u = await env.DB.prepare("SELECT ip FROM users WHERE id = ?").bind(uid).first();
      await env.DB.batch([env.DB.prepare("UPDATE users SET banned = 0 WHERE id = ?").bind(uid), ...(u && u.ip ? [env.DB.prepare("DELETE FROM ipbans WHERE ip = ?").bind(u.ip)] : [])]);
    } else if (b.act === "done" && id) await env.DB.prepare("UPDATE reports SET done = 1 WHERE id = ?").bind(id).run();
    else return bad("شو بدك تعمل؟");
    return json({ ok: true });
  }
  return bad("مو موجود", 404);
}
