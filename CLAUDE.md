# KO SPORT — متجر رياضي على Cloudflare Pages

صاحب المتجر بيحكي سوري؛ جاوبه باللهجة السورية وباختصار.

## البنية
- `src/` — كود الموقع الأصلي (عدّل هون بس):
  - `src/_worker.js` — الخادم (Cloudflare Pages advanced mode، ES module). كل `/api/*` هون. التخزين بـ KV (`env.STORE`)، والذكاء الاصطناعي `env.AI`.
  - `src/index.html` + `src/assets/store.js` + `src/assets/store.css` — المتجر (SPA بروابط `#/...`).
  - `src/admin.html` + `src/assets/admin.js` + `src/assets/admin.css` — لوحة التحكم.
  - `src/assets/fx.js` (المؤثرات والوضع الداكن)، `promo.js`، `pwa.js`، `games.js`، `imgstudio.js`، `themes.js`، `packs.js`.
  - `src/sw.js` — service worker (رقم النسخة `ko-vNN`).
- `build.mjs` — `node build.mjs` بيبني `dist/_worker.js` (كل الملفات مضمّنة جوّاه، لأن رفع ملفات كتير من لوحة Cloudflare بيفشل عند صاحب المتجر).
- `ko-catalog.js` — ربط مجيب الواتساب (K FAST AI) بـ `/api/catalog/search`.

## قواعد
- مع كل إصدار: زيد رقم `ko-vNN` بـ `src/sw.js` و `?v=NN` بـ `src/index.html` و `src/admin.html`.
- بعد أي تعديل: `node build.mjs` لازم يمرق بلا أخطاء (`node --check`).
- الرفع: `npx wrangler pages deploy dist --project-name ko-sport` (بيطلب تسجيل دخول Cloudflare أول مرة)، أو اضغط `dist/_worker.js` بملف zip وارفعه من لوحة Cloudflare: Create deployment ← Save and Deploy.
- لا تكتب كلمة سر لوحة التحكم بالكود؛ `ADMIN_PASSWORD` لازم يكون Secret بإعدادات Cloudflare.
- النصوص يلي بتطلع للزبون: سوري مفهوم، ومن دون أغلاط إملائية.

## الفحص
- الموقع: https://ko-sport.pages.dev — لوحة التحكم: /admin.html
- روابط المجيب: /api/catalog ، /api/catalog/search?q=قفاز ، /catalog.txt ، /p/<id>
