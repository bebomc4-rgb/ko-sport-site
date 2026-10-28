# فضفضة — موقع فضفضة وتعارف (منفصل عن المتجر)

صاحب الموقع بيحكي سوري؛ جاوبه باللهجة السورية وباختصار، وبخطوات مرقّمة.

## البنية
- `public/_worker.js` — السيرفر (Cloudflare Pages advanced mode). كل `/api/*` هون.
  - D1 باسم `DB` (الجداول بتنعمل لحالها أول طلب). Workers AI باسم `AI`.
  - البوت «رفيق»: Gemini إذا في `GEMINI_API_KEY`، وإلا Workers AI.
  - لوحة الإدارة: `/admin.html` بكلمة سر `ADMIN_PASSWORD` (Secret، أبداً مو بالكود).
  - اختياري: `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` → كل تبليغ بيوصل عالتلغرام.
- `public/index.html` + `public/app.js` + `public/app.css` — الموقع (صفحة وحدة بروابط `#/ai` `#/rooms` `#/room/<id>` `#/friends` `#/dm/<id>` `#/me`).
- `public/admin.html` — الإدارة: تبليغات، رسائل الغرف، محي رسالة، إيقاف حساب (ومنع الجهاز).
- `test/server.mjs` — سيرفر تجربة محلي (SQLite بدل D1، وبوت تجريبي): `node --no-warnings test/server.mjs public 8790`
- `test/flow.js` — تجربة بمتصفحين (Playwright): `PORT=8790 node test/flow.js`

## قواعد
- الموقع ما إلو علاقة بالواتساب أبداً.
- الحساب بلا كلمة سر: بيضل محفوظ على جهاز الزائر (localStorage). حكي «رفيق» ما بينحفظ بالسيرفر.
- ممنوع أرقام هواتف وروابط بالغرف العامة؛ مسموحة بالخاص بين الأصدقاء بس.
- الرسائل بتنمحى بعد 30 يوم. الموقع للكبار فوق 18.
- أي كلام بيدل على خطر (انتحار/أذية النفس): البوت بيرد بلطف وبتطلع بطاقة الإسعاف 110 والشرطة 112. لا تشيلها.
- بعد أي تعديل: `node --check public/_worker.js public/app.js` وجرّب `test/flow.js`.
- مع كل تعديل على `app.js` أو `app.css`: زيد `?v=N` بـ `index.html` و`admin.html`.

## النشر
مشروع Cloudflare Pages منفصل (fadfada) من نفس الريبو `bebomc4-rgb/ko-sport-site`:
Root directory = `fadfada`، Build command فاضي، Build output = `public`، الفرع `master`.
الروابط: D1 → `DB`، Workers AI → `AI`. الأسرار: `ADMIN_PASSWORD` (وGEMINI_API_KEY اختياري).
