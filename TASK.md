# المهمة (من صاحب المتجر)

1. افحص الموقع https://ko-sport.pages.dev ولوحة التحكم https://ko-sport.pages.dev/admin.html (صفحات المتجر، المنتج، السلة، إتمام الطلب، لوحة التحكم عالكمبيوتر والجوال).
   - استعمل `curl`/`node fetch` لتقرأ الصفحات والـ API، ودوّر على أغلاط بالكود بـ `src/`.
2. صلّح كل غلط بتلاقيه بالكود بـ `src/` (اقرأ CLAUDE.md أول).
3. زيد رقم النسخة (`ko-vNN` بـ src/sw.js و `?v=NN` بـ src/index.html و src/admin.html).
4. ابني: `node build.mjs`.
5. ارفع: `npx wrangler pages deploy dist --project-name ko-sport` (إذا طلب تسجيل دخول، خلّي صاحب المتجر يسجّل). إذا اسم المشروع غلط، شوف `npx wrangler pages project list`.
6. احكيلي بالسوري وباختصار شو لقيت وشو صلّحت.
